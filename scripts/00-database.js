/* 00-database.js — camada de dados (Database).
   Felipe (sessao 31): TUDO sincronizado via Supabase v7.kv_store.
   localStorage serve apenas de CACHE local (rapido).
   Fonte de verdade: Supabase.

   Fluxo:
   - get(): le do localStorage (cache rapido)
   - set(): grava no localStorage E no Supabase (background)
   - startup: puxa TUDO do Supabase pra localStorage
   - Realtime: subscribe em mudancas remotas (futuro)
*/
const Database = (() => {
  const PREFIX = 'projetta:';
  // [SESSAO 33] Migracao para SP sa-east-1 (Pro+Medium) - melhor latencia 10x
  // Antigo us-east-1: plmliavuwlgpwaizfeds (manter pausado por 7-30d como fallback)
  const SUPABASE_URL = 'https://maqmawofimmfxeyfmcmp.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcW1hd29maW1tZnhleWZtY21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTUzOTEsImV4cCI6MjA5NDc5MTM5MX0.7NNp2SynjxSVSyBvbh4Jm5TFbaybYnny-HzaKUPefrc';
  const SCHEMA = 'v7';

  // ────────────────────────────────────────────────────────────────────────
  // Felipe sessao 2026-08-02: PROTECAO CRITICA ANTI-PERDA DE DADOS
  // ────────────────────────────────────────────────────────────────────────
  // Felipe perdeu precos cadastrados de acessorios depois que o sync inicial
  // do Supabase falhou em outro notebook que estava adormecido. Estado
  // localStorage velho (vazio/seed) sobrescreveu Supabase via write-through.
  //
  // Solucao: ate' provarmos que o Supabase carregou OK no boot, o sistema
  // fica em READ-ONLY MODE - leituras OK, escritas BLOQUEADAS.
  //
  // Estados:
  //   _readOnlyMode = true  (DEFAULT)  → set() bloqueado, mostra alert
  //   _readOnlyMode = false (apos sync) → write-through normal
  //
  // syncFromCloud() libera write mode SE recebeu pelo menos 1 row do
  // servidor (= ha conexao + esquema OK + dados existem). Se 0 rows mas
  // HTTP 200, e' projeto novo - tambem libera.
  // Se erro de rede ou HTTP != 200, MANTEM read-only.
  // ────────────────────────────────────────────────────────────────────────
  let _readOnlyMode = true;
  let _syncStatus = { lastSync: null, online: false, error: 'aguardando_boot' };
  const _statusListeners = [];
  function _emitStatus() {
    _statusListeners.forEach(function(cb) { try { cb(_syncStatus, _readOnlyMode); } catch(_){} });
  }
  function isReadOnly() { return _readOnlyMode; }
  function getSyncStatus() { return Object.assign({}, _syncStatus); }
  function onSyncStatusChange(cb) { _statusListeners.push(cb); }

  // Headers pra REST API Supabase
  function sbHeaders(write) {
    var h = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Accept-Profile': SCHEMA,
    };
    if (write) {
      h['Content-Type'] = 'application/json';
      h['Content-Profile'] = SCHEMA;
      h['Prefer'] = 'resolution=merge-duplicates,return=minimal';
    }
    return h;
  }

  // Upsert no Supabase (background, nao bloqueia)
  // PROTECAO: NUNCA envia arrays vazios — evita sobrescrever dados reais.
  // Felipe sessao 11: DEBOUNCE por scope+key — durante o boot, multiplos
  // store.set() pra mesma chave disparam em sequencia rapida. Sem debounce,
  // o 1o request (sem vidros) pode chegar no Supabase DEPOIS do 2o (com
  // vidros), sobrescrevendo. Debounce garante que so' o ULTIMO valor e' enviado.
  var _sbUpsertTimers = {};

  // Felipe sessao 12 (bug Noemi - lead atualizado mas versao nao):
  // _sbUpsertPayloads guarda o ultimo (scope, key, value) pendente em cada
  // timer. flushSbUpsertPendentes() pega todos os pendentes, cancela timers
  // e executa as requests IMEDIATO. Operacoes criticas (aprovarOrcamento)
  // devem chamar flush apos saveAll/setLead pra garantir que ambos vao
  // pro cloud antes de qualquer fechamento de aba.
  var _sbUpsertPayloads = {};

  // Felipe sessao 34 (bug Thays Juliana - orcamento aprovado nao foi pro banco):
  // MAX-WAIT TIMER. Antes, cada call do sbUpsert resetava o debounce - se o
  // usuario digitava continuamente (typing reativo, recalculo iterativo, etc),
  // o flush ficava ADIADO INFINITAMENTE. Em cenarios reais, a Thays editou
  // varios campos em sequencia, cada um resetando o debounce, ate' ela
  // aprovar e fechar a aba. Resultado: somente o save inicial (12:56:59)
  // chegou no banco, todos os updates subsequentes presos no debounce
  // foram CANCELADOS quando ela fechou.
  // FIX: marca quando o primeiro upsert pra esse timerKey foi agendado.
  // Se passou MAX_WAIT desde entao, forca flush imediato em vez de reagendar.
  var _sbUpsertFirstAt = {};
  var SBUPSERT_DEBOUNCE_MS = 500;
  var SBUPSERT_MAX_WAIT_MS = 3000;  // forca flush apos 3s mesmo com novos triggers

  // Felipe sessao 32: FILA DE UPSERTS PENDENTES quando rede falha.
  // Persistida em localStorage pra sobreviver a reload. Quando _sbUpsertExecuta
  // falha (rede), o item entra na fila. Drenagem automatica a cada 30s e
  // imediata ao detectar volta de conexao (syncFromCloud OK).
  //
  // Politica: pra mesma (scope, key), so' o ULTIMO valor fica na fila
  // (dedupe automatico). Maximo 100 itens (se passar, descarta os mais antigos).
  var _FILA_PENDENTES_KEY = PREFIX + '_sync_fila_pendentes';
  var _FILA_MAX = 100;
  function _filaCarregar() {
    try {
      var raw = localStorage.getItem(_FILA_PENDENTES_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch(_) { return []; }
  }
  function _filaSalvar(arr) {
    try {
      localStorage.setItem(_FILA_PENDENTES_KEY, JSON.stringify(arr.slice(-_FILA_MAX)));
    } catch(_) {}
  }
  function _filaEnfileirar(scope, key, value) {
    var fila = _filaCarregar();
    // Dedupe: remove anteriores pra mesma chave (ultimo vence)
    for (var i = fila.length - 1; i >= 0; i--) {
      if (fila[i].scope === scope && fila[i].key === key) fila.splice(i, 1);
    }
    fila.push({ scope: scope, key: key, value: value, ts: Date.now() });
    _filaSalvar(fila);
    console.warn('[DB] 📦 upsert enfileirado pra retry (offline): ' + scope + '/' + key + ' (total fila: ' + fila.length + ')');
  }
  async function _filaDrenar() {
    var fila = _filaCarregar();
    if (fila.length === 0) return 0;
    console.log('[DB] 🔄 tentando drenar fila pendente: ' + fila.length + ' itens');
    var aindaPendentes = [];
    var ok = 0;
    for (var i = 0; i < fila.length; i++) {
      var item = fila[i];
      try {
        var sucesso = await _sbUpsertExecuta(item.scope, item.key, item.value);
        if (sucesso) ok++;
        else aindaPendentes.push(item);
      } catch(_) {
        aindaPendentes.push(item);
      }
    }
    _filaSalvar(aindaPendentes);
    if (ok > 0) console.log('[DB] ✅ drenado ' + ok + ' itens da fila. Restam ' + aindaPendentes.length + '.');
    return ok;
  }
  // Drenagem automatica a cada 30s
  setInterval(function() {
    var fila = _filaCarregar();
    if (fila.length > 0 && !_readOnlyMode) _filaDrenar();
  }, 30000);

  // Felipe sessao 13 — BUG CRITICO "cadastro mostra 7,09 mas orcamento usa 14,18".
  // Causa-raiz: usuario importa planilha → set() local atualiza localStorage
  // imediato, mas sbUpsert tem debounce 500ms. Antes do upload propagar,
  // o realtime polling (3s) busca rows do Supabase com updated_at>last_sync
  // e sobrescreve o localStorage com dados ANTIGOS (que ainda nao foram
  // atualizados pelo upload pendente do usuario). Cadastro mostra valor
  // novo (state em memoria), mas orcamento le do localStorage corrompido.
  //
  // Fix: registramos timestamp local de cada set(). O realtime polling
  // ignora rows REMOTAS que sao MAIS VELHAS que nosso ultimo set local
  // (dentro de janela de 30s — depois assume que upload ja propagou).
  var _localWriteTs = {};
  var LOCAL_WRITE_PROTECT_MS = 30000;
  function _registrarWriteLocal(scope, key) {
    _localWriteTs[scope + '/' + key] = new Date();
  }
  function _writeLocalEhMaisNovoQue(scope, key, remoteTsIso) {
    var combo = scope + '/' + key;
    var localTs = _localWriteTs[combo];
    if (!localTs) return false;
    var ageMs = Date.now() - localTs.getTime();
    if (ageMs > LOCAL_WRITE_PROTECT_MS) {
      // Janela expirou — limpa e aceita remote
      delete _localWriteTs[combo];
      return false;
    }
    try {
      var remoteTs = new Date(remoteTsIso);
      return remoteTs.getTime() < localTs.getTime();
    } catch(_) { return false; }
  }

  // Felipe sessao 12 (3a sobrescrita da Andressa): MERGE protetor pra
  // auth/users. Antes de sobrescrever, busca versao cloud. Se cloud tem
  // mais usuarios que local, faz uniao por username (cloud ganha em
  // conflito de mesmo username — pq cloud e' fonte da verdade).
  // Sem isso, navegador velho com [Felipe] sobrescrevia [Felipe,Andressa]
  // do cloud. Acontece quando o usuario abre o sistema antes do sync
  // inicial completar e algum failsafe chama store.set('users', users).
  //
  // Felipe sessao 34 (Andressa demitida volta no merge): adicionada lista
  // de TOMBSTONES (auth/users_deletados). Usernames nessa lista NUNCA voltam
  // ao auth/users em nenhuma direcao - filtrados tanto do cloud quanto do
  // local antes do merge. Sem tombstone, deletar usuario era impossivel
  // se ele continuasse vivo em cache de outro browser - o merge resurectava.
  async function mergeProtegido_users(localValue) {
    if (!Array.isArray(localValue)) return localValue;
    try {
      // Busca tombstones ANTES de tudo
      var deletadosUrl = SUPABASE_URL + '/rest/v1/kv_store?scope=eq.auth&key=eq.users_deletados&select=valor';
      var deletadosRes = await fetch(deletadosUrl, { headers: sbHeaders(false) });
      var deletadosSet = {};
      if (deletadosRes.ok) {
        var deletadosRows = await deletadosRes.json();
        if (Array.isArray(deletadosRows) && deletadosRows.length > 0 && Array.isArray(deletadosRows[0].valor)) {
          deletadosRows[0].valor.forEach(function(t) {
            if (t && t.username) deletadosSet[t.username] = true;
          });
        }
      }

      var url = SUPABASE_URL + '/rest/v1/kv_store?scope=eq.auth&key=eq.users&select=valor';
      var res = await fetch(url, { headers: sbHeaders(false) });
      if (!res.ok) {
        // Mesmo sem cloud, aplica tombstones no local
        return localValue.filter(function(u) {
          return !(u && u.username && deletadosSet[u.username]);
        });
      }
      var rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        return localValue.filter(function(u) {
          return !(u && u.username && deletadosSet[u.username]);
        });
      }
      var cloudValue = rows[0].valor;
      if (!Array.isArray(cloudValue)) {
        return localValue.filter(function(u) {
          return !(u && u.username && deletadosSet[u.username]);
        });
      }
      // Merge: cloud + locais novos (locais que nao tem no cloud),
      // EXCLUINDO tombstones em ambos os lados
      var byUsername = {};
      cloudValue.forEach(function(u) {
        if (u && u.username && !deletadosSet[u.username]) byUsername[u.username] = u;
      });
      var adicionados = 0;
      var filtradosPorTombstone = 0;
      localValue.forEach(function(u) {
        if (!u || !u.username) return;
        if (deletadosSet[u.username]) {
          filtradosPorTombstone++;
          return;
        }
        if (!byUsername[u.username]) {
          byUsername[u.username] = u;
          adicionados++;
        }
      });
      var merged = Object.values(byUsername);
      if (filtradosPorTombstone > 0) {
        console.warn('[DB] mergeProtegido_users: ' + filtradosPorTombstone +
                     ' usuario(s) filtrado(s) por tombstone (auth/users_deletados)');
      }
      if (merged.length > localValue.length) {
        console.warn('[DB] mergeProtegido_users: cloud tinha ' + cloudValue.length +
                     ' usuarios, local ' + localValue.length + ' — uniao = ' +
                     merged.length + ' (impedindo sobrescrita por cache stale)');
      }
      return merged;
    } catch(e) {
      console.warn('[DB] mergeProtegido_users falhou — enviando local:', e.message);
      return localValue;
    }
  }

  // Felipe sessao 12: merge anti-sobrescrita generico pra listas de cadastro
  // (superficies/acessorios/perfis/modelos/representantes). Identifica cada
  // item pela CHAVE NATURAL (codigo OU descricao) e faz UNIAO. Cloud ganha
  // em conflito mesmo nome - se 2 maquinas editam o "mesmo" item ao mesmo
  // tempo, o ultimo a salvar perde local. Mas NUNCA mais "Laminado 4+4
  // sumiu" pq cliente velho mandou lista sem ele. (Felipe: "perdi um vidro
  // que salvei laminado 4+4 sumiu... nao teria que salvar imediato super base").
  async function mergeProtegido_lista(scope, key, localValue, chaveItemFn) {
    if (!Array.isArray(localValue)) return localValue;
    try {
      var url = SUPABASE_URL + '/rest/v1/kv_store?scope=eq.' + scope + '&key=eq.' + key + '&select=valor';
      var res = await fetch(url, { headers: sbHeaders(false) });
      if (!res.ok) return localValue;
      var rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return localValue;
      var cloudValue = rows[0].valor;
      if (!Array.isArray(cloudValue)) return localValue;
      // Index cloud pela chave natural
      var byChave = {};
      cloudValue.forEach(function(item) {
        var ch = chaveItemFn(item);
        if (ch) byChave[ch] = item;
      });
      var adicionados = 0;
      var atualizados = 0;
      localValue.forEach(function(item) {
        var ch = chaveItemFn(item);
        if (!ch) return;
        if (!byChave[ch]) {
          // Item novo (so' local) — adiciona ao merge
          byChave[ch] = item;
          adicionados++;
        } else {
          // Item existe nos 2 — usa LOCAL (presume edicao recente)
          // Se isso causar perda de edicao concorrente, e' aceitavel —
          // o que NAO e' aceitavel e' SUMIR um item que existe no cloud.
          byChave[ch] = item;
          atualizados++;
        }
      });
      var merged = Object.values(byChave);
      if (merged.length > localValue.length) {
        console.warn('[DB] mergeProtegido_lista ' + scope + '/' + key +
                     ': cloud tinha ' + cloudValue.length +
                     ' itens, local ' + localValue.length + ' — uniao = ' +
                     merged.length + ' (preservou ' + (merged.length - localValue.length) +
                     ' itens que sumiriam por cache stale)');
      }
      // Felipe sessao 14: TOMBSTONES — registra deletados intencionais
      // pra evitar que o merge ressuscite items que o usuario apagou.
      // Bug: Felipe deletava vidro Switchglass, salvava local, mas
      // mergeProtegido_lista (uniao com cloud que ainda tinha) restaurava.
      // Solucao: chave 'superficies_lista__deleted' guarda lista de chaves
      // (descricoes normalizadas) deletadas. Filtra do merge final.
      try {
        var tombKey = key + '__deleted';
        var tombUrl = SUPABASE_URL + '/rest/v1/kv_store?scope=eq.' + scope + '&key=eq.' + tombKey + '&select=valor';
        var tombRes = await fetch(tombUrl, { headers: sbHeaders(false) });
        if (tombRes.ok) {
          var tombRows = await tombRes.json();
          if (Array.isArray(tombRows) && tombRows.length > 0 && Array.isArray(tombRows[0].valor) && tombRows[0].valor.length > 0) {
            var tombSet = {};
            tombRows[0].valor.forEach(function(k) { tombSet[String(k).toUpperCase()] = true; });
            var antes = merged.length;
            merged = merged.filter(function(item) {
              var ch = chaveItemFn(item);
              return !ch || !tombSet[String(ch).toUpperCase()];
            });
            if (merged.length < antes) {
              console.log('[DB] tombstones removeu ' + (antes - merged.length) + ' itens deletados intencionalmente');
            }
          }
        }
      } catch(_){}
      return merged;
    } catch(e) {
      console.warn('[DB] mergeProtegido_lista ' + scope + '/' + key + ' falhou — enviando local:', e.message);
      return localValue;
    }
  }
  // Chaves naturais por scope/key (codigo OU descricao OU id)
  function _chaveSuperficie(s) { return s && s.descricao ? String(s.descricao).trim().toUpperCase() : null; }
  function _chaveAcessorio(a)  { return a && a.codigo    ? String(a.codigo).trim().toUpperCase() : null; }
  function _chavePerfil(p)     { return p && p.codigo    ? String(p.codigo).trim().toUpperCase() : null; }
  function _chaveModelo(m)     { return m && m.numero != null ? String(m.numero) : null; }
  function _chaveRep(r)        { return r && r.followup ? String(r.followup).trim() : null; }

  // Felipe sessao 12: merge protetor pra orcamentos/negocios. Resolve
  // bug critico onde "V2 sumia" — cliente velho com 1 versao em cache
  // sobrescrevia o cloud que tinha 2 versoes. Tactica: pra cada negocio,
  // adiciona ao LOCAL as versoes que existem no CLOUD mas nao no local
  // (matching por neg.id e v.id). Negocios inteiros que sumiram do
  // local mas estao no cloud sao re-adicionados.
  // NAO resolve conflito de edicao concorrente (mesma versao editada
  // em 2 lugares - ultimo que salva ganha) — isso e' tradeoff aceitavel.
  // RESOLVE: V2 nunca mais e' apagada por cache stale.
  async function mergeProtegido_negocios(localValue) {
    if (!Array.isArray(localValue)) return localValue;
    try {
      var url = SUPABASE_URL + '/rest/v1/kv_store?scope=eq.orcamentos&key=eq.negocios&select=valor';
      // Felipe (sessao atual): CURA do furo "merge cai pra local stale quando a
      // nuvem falha" — causa raiz da perda da V1 do Antonio. Antes, qualquer
      // hiccup no fetch (res nao-ok / vazio / erro) abortava a protecao e
      // enviava o local; se stale, derrubava versoes. Agora tenta ate 3x antes
      // de desistir, reduzindo muito a chance de cair no fallback desprotegido.
      // (A trava no banco e' a rede de seguranca final caso ainda assim caia.)
      var cloudValue = null;
      for (var _tent = 0; _tent < 3; _tent++) {
        try {
          var res = await fetch(url, { headers: sbHeaders(false) });
          if (res.ok) {
            var rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0].valor)) {
              cloudValue = rows[0].valor;
              break;
            }
          }
        } catch (_fe) { /* tenta de novo */ }
        if (_tent < 2) { await new Promise(function(r){ setTimeout(r, 300); }); }
      }
      if (!Array.isArray(cloudValue)) return localValue;

      // Index cloud: pra cada negocio.id, mapeia versoes_por_id e opcao_de_cada_versao
      var cloudNegoMap = {};
      cloudValue.forEach(function(neg) {
        if (!neg || !neg.id) return;
        var versoesMap = {};
        (neg.opcoes || []).forEach(function(o) {
          (o.versoes || []).forEach(function(v) {
            if (v && v.id) versoesMap[v.id] = { ver: v, opcaoId: o.id };
          });
        });
        cloudNegoMap[neg.id] = { neg: neg, versoesMap: versoesMap };
      });

      // Index local pra detectar negocios que sumiram
      var localNegIds = new Set();
      localValue.forEach(function(neg) { if (neg && neg.id) localNegIds.add(neg.id); });

      // Felipe (sessao atual): mapa leadId -> etapa (best-effort do Storage
      // local). Usado pra decidir se uma versao protegida (cura 2) deve voltar:
      // so' volta se o orcamento ja' foi ENVIADO (lead em orcamento-enviado/
      // negociacao/fechado). Antes da trava nova, qualquer versao APROVADA
      // voltava — o que impedia deletar versao de orcamento ainda nao enviado.
      // Se nao der pra ler a etapa, default = NAO forca (respeita o tombstone);
      // a trava no banco continua sendo a rede de seguranca dos enviados.
      var etapaPorLead = {};
      try {
        if (window.Storage && window.Storage.scope) {
          var _leads = window.Storage.scope('crm').get('leads') || [];
          if (Array.isArray(_leads)) {
            _leads.forEach(function(ld) {
              if (ld && ld.id) etapaPorLead[ld.id] = String(ld.etapa || '');
            });
          }
        }
      } catch (_eL) {}
      function _leadEnviado(neg) {
        var e = etapaPorLead[neg && neg.leadId];
        return e === 'orcamento-enviado' || e === 'negociacao' || e === 'fechado';
      }

      // Clona local pra modificar em segurança
      var resultado = JSON.parse(JSON.stringify(localValue));
      var versoesPreservadas = 0;
      var negociosPreservados = 0;

      // 1. Pra cada negocio LOCAL, adiciona versoes do cloud que nao estao no local
      resultado.forEach(function(neg) {
        if (!neg || !neg.id) return;
        var cloudInfo = cloudNegoMap[neg.id];
        if (!cloudInfo) return;
        // Felipe sessao 12: TOMBSTONE - lista de IDs de versoes que o usuario
        // DELETOU intencionalmente. Merge nao re-adiciona elas mesmo se
        // ainda existem no cloud. Sem isso, deletarVersao falhava porque
        // o cloud ainda tinha a versao e o merge re-injetava.
        var deletadasLocal = new Set(Array.isArray(neg._versoesDeletadas) ? neg._versoesDeletadas : []);
        var localVerIds = new Set();
        (neg.opcoes || []).forEach(function(o) {
          (o.versoes || []).forEach(function(v) {
            if (v && v.id) localVerIds.add(v.id);
          });
        });
        Object.keys(cloudInfo.versoesMap).forEach(function(verId) {
          if (localVerIds.has(verId)) return;
          var info = cloudInfo.versoesMap[verId];
          var _vc = (info && info.ver) || {};
          // Felipe (sessao atual): versao volta de baixo do tombstone SO' se o
          // orcamento ja' foi ENVIADO (lead em orcamento-enviado/negociacao/
          // fechado) E a versao e' aprovada/no-card. Orcamento ainda nao
          // enviado: respeita o tombstone (pode deletar/editar versao a vontade).
          var _enviada = _leadEnviado(neg)
                         && ((_vc.status === 'fechada') || _vc.aprovadoEm)
                         && _vc.enviadoParaCard !== false;
          if (deletadasLocal.has(verId) && !_enviada) return;  // tombstone vale p/ nao-enviados
          // Acha opcao correspondente no local
          var opc = (neg.opcoes || []).find(function(o) { return o.id === info.opcaoId; });
          if (!opc && neg.opcoes && neg.opcoes.length > 0) opc = neg.opcoes[0]; // fallback opcao A
          if (opc) {
            (opc.versoes = opc.versoes || []).push(info.ver);
            versoesPreservadas++;
          }
        });
      });

      // Felipe sessao 12 (problema R\$ 73.750 vs R\$ 214.343): pra versoes
      // que existem em AMBOS local E cloud, se o cloud tem campos de
      // CALCULO/APROVACAO preenchidos e o local esta zerado, rehidrata
      // do cloud. Cenario tipico: outra sessao (Andressa em outra maquina)
      // editou e calculou; meu navegador tem localStorage stale com
      // custoFab/custoInst zerados; ao salvar, sobrescreveria o cloud.
      //
      // Regra anti-conflito: SO rehidrata se LOCAL.subFab=0 E CLOUD.subFab>0.
      // Isso garante que NAO sobrescrevemos edicoes legitimas locais
      // (se o user fez Limpar Tela proposital, local.subFab=0 mas
      // cloud tambem ja' foi atualizado pra 0 pelo proprio user antes
      // do reload). Logo se cloud.subFab>0 e local.subFab=0, e' sinal
      // claro de cache stale local.
      var camposRehidratados = 0;
      resultado.forEach(function(neg) {
        if (!neg || !neg.id) return;
        var cloudInfo = cloudNegoMap[neg.id];
        if (!cloudInfo) return;
        (neg.opcoes || []).forEach(function(opc) {
          (opc.versoes || []).forEach(function(vLocal, idx) {
            if (!vLocal || !vLocal.id) return;
            var info = cloudInfo.versoesMap[vLocal.id];
            if (!info || !info.ver) return;
            var vCloud = info.ver;
            // Heuristica: local zerado + cloud preenchido = stale
            var localZerado = (Number(vLocal.subFab) || 0) === 0
                           && (Number(vLocal.subInst) || 0) === 0;
            var cloudPreenchido = (Number(vCloud.subFab) || 0) > 0
                               || (Number(vCloud.subInst) || 0) > 0;
            if (!(localZerado && cloudPreenchido)) return;

            // Felipe sessao 31: se a versao LOCAL tem _zeradoEm recente
            // (< 60s), e' uma limpeza intencional do botao 'Limpar Tela',
            // NAO cache stale. Pula a rehidratacao pra respeitar o
            // intent do usuario. Bug observado: clicar Limpar Tela zerava
            // subFab=0 local, merge via cloud com valores antigos e
            // restaurava tudo -> 'botao nao limpa'.
            try {
              if (vLocal._zeradoEm) {
                var zeradoMs = new Date(vLocal._zeradoEm).getTime();
                if (!isNaN(zeradoMs) && (Date.now() - zeradoMs) < 60000) {
                  return; // limpeza recente — respeita
                }
              }
            } catch(_) {}

            // Rehidrata os campos de calculo/aprovacao do cloud.
            // Mantem ITENS do local intactos (preserva edicao em curso).
            var camposCloudWinners = [
              'subFab', 'subInst',
              'custoFab', 'custoInst',
              'parametros', 'subtotais', 'total',
              'calculadoEm',
              'aprovadoEm', 'aprovadoPor', 'valorAprovado',
              'precoProposta', 'enviadoParaCard',
              'precos_snapshot',
              '_zerosIntencionais',
            ];
            camposCloudWinners.forEach(function(campo) {
              if (vCloud[campo] !== undefined && vCloud[campo] !== null) {
                vLocal[campo] = JSON.parse(JSON.stringify(vCloud[campo]));
              }
            });
            // calcDirty=true porque ITENS pode ter sido editado depois
            // do calculo do cloud (caso o user editou item mas nao
            // recalculou). Sinal pra UI mostrar 'desatualizado'.
            // Se nao foi editado, ficar dirty=true nao quebra - so'
            // pede pra clicar Recalcular.
            // Excecao: se cloud.calcDirty=false e local.itens === cloud.itens,
            // poderia preservar — mas comparar itens e' caro e raro o
            // ganho. Aceito o tradeoff.
            vLocal.calcDirty = true;
            camposRehidratados++;
          });
        });
      });
      if (camposRehidratados > 0) {
        console.warn('[DB] mergeProtegido_negocios: REHIDRATADAS ' + camposRehidratados +
                     ' versao(es) onde local tinha custos zerados mas cloud tinha valores. ' +
                     'Cache stale local foi corrigido com dados do Supabase.');
      }

      // 2. Pra cada negocio CLOUD que nao esta no local, adiciona inteiro
      cloudValue.forEach(function(neg) {
        if (!neg || !neg.id) return;
        if (!localNegIds.has(neg.id)) {
          resultado.push(JSON.parse(JSON.stringify(neg)));
          negociosPreservados++;
        }
      });

      if (versoesPreservadas > 0 || negociosPreservados > 0) {
        console.warn('[DB] mergeProtegido_negocios: preservou ' + versoesPreservadas +
                     ' versao(es) e ' + negociosPreservados + ' negocio(s) que sumiriam ' +
                     'por cache stale (cloud tinha ' + cloudValue.length +
                     ' negocios, local tinha ' + localValue.length + ')');
      }
      return resultado;
    } catch(e) {
      console.warn('[DB] mergeProtegido_negocios falhou — enviando local:', e.message);
      return localValue;
    }
  }

  function sbUpsert(scope, key, value) {
    // Se for array vazio, NAO sobrescreve o cloud
    if (Array.isArray(value) && value.length === 0) return;
    var timerKey = scope + '::' + key;
    var agora = Date.now();

    // Felipe sessao 34: MAX-WAIT protege contra debounce infinito.
    // Quando primeiro upsert pra esse key chega, marca timestamp. Se
    // ja' passou MAX_WAIT_MS desde entao, FLUSH IMEDIATO (nao reagenda).
    // Sem isso, usuario digitando continuamente nunca dispara o flush.
    if (!_sbUpsertFirstAt[timerKey]) {
      _sbUpsertFirstAt[timerKey] = agora;
    }
    var esperando = agora - _sbUpsertFirstAt[timerKey];

    if (_sbUpsertTimers[timerKey]) clearTimeout(_sbUpsertTimers[timerKey]);
    // Felipe sessao 12: guarda ultimo payload pra flushSbUpsertPendentes
    _sbUpsertPayloads[timerKey] = { scope: scope, key: key, value: value };

    if (esperando >= SBUPSERT_MAX_WAIT_MS) {
      // Felipe sessao 34: max-wait atingido - flush imediato em vez de
      // reagendar 500ms. Evita perda total em digitacao continua.
      delete _sbUpsertTimers[timerKey];
      delete _sbUpsertPayloads[timerKey];
      delete _sbUpsertFirstAt[timerKey];
      console.info('[DB] sbUpsert max-wait (' + esperando + 'ms) - flush imediato: ' + timerKey);
      _sbUpsertExecuta(scope, key, value);
      return;
    }

    _sbUpsertTimers[timerKey] = setTimeout(function() {
      delete _sbUpsertTimers[timerKey];
      delete _sbUpsertPayloads[timerKey];
      delete _sbUpsertFirstAt[timerKey];
      _sbUpsertExecuta(scope, key, value);
    }, SBUPSERT_DEBOUNCE_MS);  // 500ms debounce — ultimo valor ganha
  }

  // Felipe sessao 12: extraido pra _sbUpsertExecuta pra ser reutilizado
  // por sbUpsert (debounced) e flushSbUpsertPendentes (imediato).
  async function _sbUpsertExecuta(scope, key, value) {
      // Felipe sessao 12: protecao especial pra auth/users
      var valorFinal = value;
      if (scope === 'auth' && key === 'users') {
        valorFinal = await mergeProtegido_users(value);
        // Se merge retornou mais users que tinhamos local, atualizar
        // localStorage tb pra manter consistencia.
        if (Array.isArray(valorFinal) && Array.isArray(value) && valorFinal.length > value.length) {
          try { localStorage.setItem(PREFIX + scope + ':' + key, JSON.stringify(valorFinal)); } catch(_){}
        }
      }
      // Felipe sessao 12: merge anti-sobrescrita pra listas de cadastros.
      // Resolve "vidro Laminado 4+4 sumiu" e classes similares.
      else if (scope === 'cadastros') {
        var chaveFn = null;
        if      (key === 'superficies_lista')    chaveFn = _chaveSuperficie;
        else if (key === 'acessorios_lista')     chaveFn = _chaveAcessorio;
        else if (key === 'perfis_lista')         chaveFn = _chavePerfil;
        else if (key === 'modelos_lista')        chaveFn = _chaveModelo;
        else if (key === 'representantes_lista') chaveFn = _chaveRep;
        if (chaveFn) {
          valorFinal = await mergeProtegido_lista(scope, key, value, chaveFn);
          if (Array.isArray(valorFinal) && Array.isArray(value) && valorFinal.length > value.length) {
            try { localStorage.setItem(PREFIX + scope + ':' + key, JSON.stringify(valorFinal)); } catch(_){}
          }
        }
      }
      // Felipe sessao 12: merge anti-sobrescrita pra orcamentos/negocios.
      // Resolve "V2 sumiu ao voltar uma tela" - cliente velho com cache
      // de 1 versao sobrescrevia o cloud que tinha V2 nova.
      else if (scope === 'orcamentos' && key === 'negocios') {
        valorFinal = await mergeProtegido_negocios(value);
        if (Array.isArray(valorFinal) && Array.isArray(value) && valorFinal.length >= value.length) {
          try { localStorage.setItem(PREFIX + scope + ':' + key, JSON.stringify(valorFinal)); } catch(_){}
        }
      }

      // Felipe sessao 12: Auth nao tem getUser() — tem currentUser() que
      // retorna {username, name, role, loggedAt}. Por isso updated_by
      // estava sempre vazio no Supabase. Agora extrai username da sessao.
      var usuario = '';
      try {
        var u = window.Auth && window.Auth.currentUser && window.Auth.currentUser();
        if (u && u.username) usuario = u.username;
      } catch(_){}

      // Felipe sessao 12 (bug Noemi - lead salvo mas negocios nao):
      // keepalive: true tem limite de 64kb por origem. Quando o payload
      // de 'negocios' ultrapassa esse limite (cresceu pra 67kb com
      // dados de Felipe+Andressa), o browser DESCARTA SILENCIOSAMENTE
      // a request se a aba fechar antes do response. Lead (23kb) passa
      // dentro do limite mas negocios (67kb) nao. Resultado: aprovacao
      // parcial onde lead.valor atualiza mas versao.aprovadoEm nao.
      //
      // FIX: serializa o body, mede o tamanho, e SO' usa keepalive se
      // estiver dentro do limite seguro de 60kb (margem de erro pros
      // headers + estrutura JSON).
      var body = JSON.stringify({
        scope: scope,
        key: key,
        valor: valorFinal,
        updated_by: String(usuario),
      });
      var podeKeepalive = body.length < 60000;  // < 60kb - margem segura

      var fetchOpts = {
        method: 'POST',
        headers: sbHeaders(true),
        body: body,
      };
      if (podeKeepalive) {
        fetchOpts.keepalive = true;
      }
      // Retorna Promise pra flushSbUpsertPendentes poder esperar com Promise.all
      return fetch(SUPABASE_URL + '/rest/v1/kv_store', fetchOpts).then(function(res) {
        if (!res.ok) {
          // Felipe (sessao 32): classifica 4xx pra distinguir BUG real vs
          // PROTECAO legitima (triggers anti-perda/anti-seed do banco).
          // Mensagens de protecao -> console.info (esperado). Bug real -> error.
          return res.text().then(function(body) {
            var msg = String(body || '');
            var ehProtecao = /anti-perda|anti-seed|BLOQUEADA|provavel perda de dados/i.test(msg);
            if (ehProtecao) {
              console.info('[DB] sync nao aplicado por protecao do banco:',
                scope + '/' + key,
                '— Postgres retornou:', msg.substring(0, 200));
            } else {
              console.error('[DB] sbUpsert FALHOU:', scope, '/', key, 'HTTP', res.status,
                msg ? '— ' + msg.substring(0, 200) : '');
              // Felipe sessao 32: 5xx vai pra fila (servidor temporariamente fora).
              // 4xx geralmente e' bug do request — nao enfileira pra nao spammar.
              if (res.status >= 500 && res.status < 600) {
                _filaEnfileirar(scope, key, value);
              }
            }
            return false;
          }).catch(function() {
            console.error('[DB] sbUpsert FALHOU:', scope, '/', key, 'HTTP', res.status);
            return false;
          });
        }
        return true;
      }).catch(function(e) {
        console.error('[DB] sbUpsert FALHOU (rede):', scope, '/', key, e.message);
        // Felipe sessao 32: erro de rede -> enfileira pra retry quando voltar.
        // Garante que dados nao se perdem em modo offline. Drenagem automatica
        // a cada 30s e' imediata quando syncFromCloud volta a funcionar.
        _filaEnfileirar(scope, key, value);
        return false;
      });
  }

  // Felipe sessao 12 (bug Noemi): forca flush imediato de TODOS os
  // upserts pendentes (cancelando o debounce de 500ms). Usado em
  // operacoes criticas onde a atomicidade entre 2 saves importa
  // (ex: aprovarOrcamento atualiza versao + lead - ambos devem ir
  // pro cloud, nao apenas um). Retorna Promise.all das requests.
  function flushSbUpsertPendentes() {
    var promises = [];
    var keys = Object.keys(_sbUpsertTimers);
    keys.forEach(function(timerKey) {
      clearTimeout(_sbUpsertTimers[timerKey]);
      delete _sbUpsertTimers[timerKey];
      var p = _sbUpsertPayloads[timerKey];
      delete _sbUpsertPayloads[timerKey];
      delete _sbUpsertFirstAt[timerKey];  // Felipe sessao 34: limpa max-wait tb
      if (p) {
        promises.push(_sbUpsertExecuta(p.scope, p.key, p.value));
      }
    });
    return Promise.all(promises);
  }

  // Felipe sessao 34 (bug Thays Juliana - tudo na Producao sumiu no PC do
  // Felipe). CAUSA: Thays editou orcamento no PC dela, cada Storage.set
  // disparou sbUpsert com debounce de 500ms. Ela fechou aba (ou trocou pra
  // outra) antes do timer disparar. Resultado: dados perdidos silenciosamente.
  //
  // FIX: handlers de beforeunload/pagehide/visibilitychange disparam
  // _sbFlushBeforeUnload(), que faz fetch SINCRONO com keepalive:true
  // pra cada payload pendente. keepalive permite browser manter a request
  // viva ate' completar mesmo apos aba fechar (limite 64kb por request).
  //
  // pagehide e' o evento mais confiavel pra detectar saida da pagina em
  // mobile/safari. beforeunload funciona em desktop. visibilitychange
  // 'hidden' captura troca de aba ou minimizar janela. Os 3 juntos cobrem
  // ~100% dos casos de saida.
  function _sbFlushBeforeUnload() {
    var keys = Object.keys(_sbUpsertPayloads);
    if (keys.length === 0) return;

    var usuario = '';
    try {
      var u = window.Auth && window.Auth.currentUser && window.Auth.currentUser();
      if (u && u.username) usuario = u.username;
    } catch(_){}

    keys.forEach(function(timerKey) {
      var p = _sbUpsertPayloads[timerKey];
      if (!p) return;
      // Cancela debounce
      clearTimeout(_sbUpsertTimers[timerKey]);
      delete _sbUpsertTimers[timerKey];
      delete _sbUpsertPayloads[timerKey];
      delete _sbUpsertFirstAt[timerKey];

      // Body direto (sem mergeProtegido - tarde demais pra fazer fetch
      // de merge num beforeunload). keepalive obrigatorio.
      try {
        var body = JSON.stringify({
          scope: p.scope,
          key: p.key,
          valor: p.value,
          updated_by: String(usuario),
        });
        if (body.length > 60000) {
          console.warn('[DB] _sbFlushBeforeUnload: payload ' + p.scope + '/' + p.key +
                       ' tem ' + body.length + 'b - excede 60kb keepalive, pode falhar');
        }
        // fetch sincrono com keepalive:true - browser mantem rodando
        // mesmo apos aba fechar. NAO da' pra await aqui (a aba ja' foi).
        fetch(SUPABASE_URL + '/rest/v1/kv_store', {
          method: 'POST',
          headers: sbHeaders(true),
          body: body,
          keepalive: true,
        }).catch(function(e) {
          // Fallback: enfileira pra retry no proximo boot
          try { _filaEnfileirar(p.scope, p.key, p.value); } catch(_){}
        });
      } catch(e) {
        // Em caso de erro, enfileira pra proxima sessao
        try { _filaEnfileirar(p.scope, p.key, p.value); } catch(_){}
      }
    });
  }

  // Felipe sessao 34: registra os 3 handlers. Quando qualquer um dispara,
  // tenta enviar pendentes com keepalive. pagehide e' o mais confiavel
  // (especialmente mobile/safari onde beforeunload nao sempre dispara).
  // visibilitychange captura troca de aba ou minimizar (caso mais comum
  // do dia-a-dia onde usuario nao fecha mas tira foco da pagina).
  window.addEventListener('beforeunload', _sbFlushBeforeUnload);
  window.addEventListener('pagehide',     _sbFlushBeforeUnload);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') _sbFlushBeforeUnload();
  });

  // Delete no Supabase (background)
  function sbDelete(scope, key) {
    fetch(SUPABASE_URL + '/rest/v1/kv_store?scope=eq.' + encodeURIComponent(scope) + '&key=eq.' + encodeURIComponent(key), {
      method: 'DELETE',
      headers: sbHeaders(true),
    }).catch(function(e) {
      console.warn('[DB] Supabase delete falhou:', e.message);
    });
  }

  // Carrega TUDO do Supabase → localStorage (chamado no startup)
  // Felipe sessao 2026-08-02: ESTA FUNCAO E' A UNICA que pode liberar
  // _readOnlyMode = false. Sucesso aqui = sistema pode escrever.
  async function syncFromCloud() {
    try {
      // Felipe sessao 32: timeout de 30s no fetch. Sem isso, se a conexao
      // travar (rede pessima, DNS pendurado, Supabase nao respondendo),
      // o boot ficava preso pra sempre na tela 'Carregando banco de dados...'
      // sem nunca cair no retry. Agora aborta apos 30s -> throw -> retry
      // silencioso do boot (99-boot.js).
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, 30000);
      var res;
      try {
        // Felipe sessao 32: filtro de scope REMOVIDO. PostgREST tava
        // retornando 4xx por causa do '*' no not.like, ou alguma quirk
        // da versao. Volta a baixar tudo e filtra no cliente (mais lento
        // mas funcional). Anti-cache de backups e' aplicado em rowsBackup
        // depois.
        res = await fetch(SUPABASE_URL + '/rest/v1/kv_store?select=scope,key,valor&order=scope,key', {
          headers: sbHeaders(false),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        var bodyTxt = '';
        try { bodyTxt = await res.text(); } catch(_) {}
        console.error('[DB] syncFromCloud HTTP', res.status, '- body:', (bodyTxt||'').substring(0, 200));
        _syncStatus = { lastSync: null, online: false, error: 'http_' + res.status + (bodyTxt ? ': ' + bodyTxt.substring(0,80) : '') };
        _emitStatus();
        return false;
      }
      var rows;
      try {
        rows = await res.json();
      } catch(eJson) {
        console.error('[DB] syncFromCloud parse error:', eJson.message);
        _syncStatus = { lastSync: null, online: false, error: 'parse_error: ' + eJson.message };
        _emitStatus();
        return false;
      }
      if (!Array.isArray(rows)) {
        console.error('[DB] syncFromCloud resposta nao e array. Tipo:', typeof rows, '- conteudo:', JSON.stringify(rows).substring(0, 200));
        _syncStatus = { lastSync: null, online: false, error: 'resposta_invalida: ' + JSON.stringify(rows).substring(0,80) };
        _emitStatus();
        return false;
      }
      if (rows.length === 0) {
        console.error('[DB] syncFromCloud retornou array VAZIO. Banco realmente vazio? Possivel RLS bloqueando.');
        _syncStatus = { lastSync: null, online: false, error: 'banco_vazio' };
        _emitStatus();
        return false;
      }
      var count = 0;
      // Felipe (sessao 09): NUNCA sincronizar chaves de SESSAO via cloud.
      // Bug original: outro navegador fazia syncToCloud com SUA sessao,
      // depois syncFromCloud no navegador do Felipe puxava e sobrescrevia,
      // trocando o usuário logado e causando "Acesso restrito".
      // Felipe sessao 12: 'users' SAI do bloqueio — lista de usuarios
      // cadastrados E global (mesma pra todos), tem que sincronizar pra
      // novos cadastros propagarem entre maquinas. Bug Andressa: cadastrava
      // no PC do Felipe e nao conseguia logar do PC dela.
      // 'session', 'session_user', 'last_login' continuam locais (per-device).
      var NEVER_SYNC_KEYS = ['session', 'session_user', 'last_login'];
      var NEVER_SYNC_SCOPES = ['auth_session']; // 'auth' continua liberado pra users
      // Felipe sessao 32: PARTICIONAMENTO + AUTO-LIMPEZA DE QUOTA
      // BUG anterior: try/catch engolia QuotaExceededError silenciosamente.
      // localStorage estourava (10MB cheio de backup_diario/manual) e
      // chaves grandes como orcamentos/negocios falhavam em ser gravadas,
      // mantendo cache stale e sumindo dados pro usuario.
      // FIX: separa CORE (negocio) vs BACKUPS (recuperaveis do Supabase).
      // Escreve CORE primeiro. Se quota estourar, limpa backups LOCAIS
      // (sao copias - source-of-truth e' o Supabase) e tenta de novo.

      function _ehChaveBackupLocal(scope, key) {
        return scope === 'backup_diario'
            || scope === 'backup_manual'
            || (typeof key === 'string' && (key.indexOf('backup_diario') === 0 || key.indexOf('backup_manual') === 0));
      }

      function _limparBackupsLocais() {
        var liberados = 0, bytes = 0;
        try {
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var k = localStorage.key(i);
            if (!k) continue;
            if (k.indexOf(PREFIX + 'backup_diario') === 0
             || k.indexOf(PREFIX + 'backup_manual') === 0) {
              bytes += (localStorage.getItem(k) || '').length;
              localStorage.removeItem(k);
              liberados++;
            }
          }
        } catch(_) {}
        return { liberados: liberados, kb: (bytes/1024).toFixed(1) };
      }

      // Limpa as linhas neg_* (formato 1-linha-por-orcamento desta sessao) que
      // ficaram ENTULHADAS no localStorage. No modelo array restaurado elas nao
      // sao usadas e so' ocupam espaco (~3.5MB) — causavam quota cheia e card
      // sem botao "Abrir Orcamento". Source-of-truth e' o array 'negocios'.
      function _limparNegRowsLocais() {
        var n = 0, bytes = 0;
        try {
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var k = localStorage.key(i);
            if (!k) continue;
            if (k.indexOf(PREFIX + 'orcamentos:neg_') === 0) {
              bytes += (localStorage.getItem(k) || '').length;
              localStorage.removeItem(k);
              n++;
            }
          }
        } catch(_) {}
        return { n: n, kb: (bytes/1024).toFixed(1) };
      }

      function _ehErroDeQuota(e) {
        if (!e) return false;
        return e.name === 'QuotaExceededError'
            || e.code === 22 || e.code === 1014
            || /quota/i.test(String(e.message || ''));
      }

      // Particiona
      var rowsCore = [];
      var rowsBackup = [];
      rows.forEach(function(r) {
        if (NEVER_SYNC_SCOPES.indexOf(r.scope) >= 0) return;
        if (NEVER_SYNC_KEYS.indexOf(r.key) >= 0) return;
        // Modelo array restaurado: os orcamentos vivem no array 'negocios'.
        // As linhas neg_* (formato 1-linha-por-orcamento desta sessao) viram
        // apenas backup no banco — NAO baixar pro local (evita quota; o array
        // ja' contem o estado consolidado de todas elas).
        if (r.scope === 'orcamentos' && typeof r.key === 'string' && r.key.indexOf('neg_') === 0) return;
        if (_ehChaveBackupLocal(r.scope, r.key)) rowsBackup.push(r);
        else rowsCore.push(r);
      });

      // Felipe sessao 32: LIMPEZA PROATIVA. Antes de baixar o CORE, remove
      // qualquer backup que tenha sobrado no localStorage de syncs antigos
      // (quando ainda baixavamos backups). Libera espaco preventivamente
      // pra evitar quota cheia durante a gravacao do core.
      try {
        var preLimpos = _limparBackupsLocais();
        if (preLimpos.liberados > 0) {
          console.log('[DB] syncFromCloud: pre-limpeza removeu ' + preLimpos.liberados
            + ' backups locais (' + preLimpos.kb + ' KB liberados)');
        }
      } catch(_) {}

      // Limpa tambem as linhas neg_* antigas entulhadas (modelo array restaurado)
      try {
        var negLimpos = _limparNegRowsLocais();
        if (negLimpos.n > 0) {
          console.log('[DB] syncFromCloud: removidas ' + negLimpos.n
            + ' linhas neg_* locais do formato antigo (' + negLimpos.kb + ' KB liberados)');
        }
      } catch(_) {}

      var jaLimpouBackups = false;

      function _gravarUmaRow(r) {
        var lsKey = PREFIX + r.scope + ':' + r.key;
        var valorSb = r.valor;
        // Felipe (sessao 32): backups tem Supabase como source-of-truth.
        // Quota excedida em backup local NAO e' erro real — e' o cache
        // limitando enquanto o backup ja' vive no cloud. Loga em debug.
        var ehBackup = _ehChaveBackupLocal(r.scope, r.key);
        // Protecao: nao sobrescreve local nao-vazio com cloud vazio
        if (Array.isArray(valorSb) && valorSb.length === 0) {
          var localRaw = localStorage.getItem(lsKey);
          if (localRaw !== null) {
            try {
              var localVal = JSON.parse(localRaw);
              if (Array.isArray(localVal) && localVal.length > 0) return true;
            } catch(_) {}
          }
        }
        try {
          localStorage.setItem(lsKey, JSON.stringify(valorSb));
          return true;
        } catch(e) {
          if (_ehErroDeQuota(e) && !jaLimpouBackups) {
            jaLimpouBackups = true;
            var stats = _limparBackupsLocais();
            console.warn('[DB] localStorage cheio durante sync — liberados '
              + stats.liberados + ' backups locais (' + stats.kb + ' KB). Re-tentando...');
            try {
              localStorage.setItem(lsKey, JSON.stringify(valorSb));
              return true;
            } catch(e2) {
              // Backup ainda nao cabe → debug. Core ainda nao cabe → error real.
              if (ehBackup) {
                console.debug('[DB] backup local nao cacheado (Supabase permanece source-of-truth):',
                  lsKey, '(' + (JSON.stringify(valorSb).length/1024).toFixed(1) + ' KB)');
              } else {
                console.error('[DB] ❌ Quota ainda excedida apos limpar backups. Chave CRITICA: '
                  + lsKey + ' (' + (JSON.stringify(valorSb).length/1024).toFixed(1) + ' KB)');
              }
              return false;
            }
          }
          if (_ehErroDeQuota(e)) {
            if (ehBackup) {
              // Sem rumor no console — esperado, Supabase tem o backup
              console.debug('[DB] backup local nao cacheado:', lsKey);
            } else {
              console.error('[DB] ❌ Quota localStorage excedida. Chave CRITICA: ' + lsKey);
            }
            return false;
          }
          // outro erro qualquer — loga mas nao quebra
          console.warn('[DB] erro ao gravar ' + lsKey + ':', e.message);
          return false;
        }
      }

      // PASSO 1: grava CORE (negocios, leads, cadastros, etc) — prioridade maxima
      // Felipe (sessao atual): bug "143 vs 162 leads". O localStorage vive perto
      // da quota (~10MB) e a imagem base64 dos modelos (cadastros/modelos_lista,
      // ~1.87MB) gravava ANTES do crm/leads — enchia a quota e o lead novo da
      // Paula nao cabia, ficando stale. Fix: grava os CRITICOS pequenos primeiro
      // (crm/leads, orcamentos/negocios), e os blobs gigantes (modelos) por ULTIMO.
      // Sem eviccao: so' reordena. Se o blob nao couber no fim, degrada o cache
      // de imagens (recuperavel do cloud) em vez de perder o lead novo.
      function _prioridadeCore(r) {
        if (r.scope === 'crm' && r.key === 'leads') return 0;
        if (r.scope === 'orcamentos' && r.key === 'negocios') return 1;
        if (r.scope === 'kanban-producao' && r.key === 'leads') return 2;
        if (r.scope === 'cadastros' && (r.key === 'modelos_lista' || r.key === 'modelos_internos_lista')) return 9;
        return 5;
      }
      rowsCore.sort(function(a, b) { return _prioridadeCore(a) - _prioridadeCore(b); });
      rowsCore.forEach(function(r) { if (_gravarUmaRow(r)) count++; });

      // Felipe sessao 32: PASSO 2 (backups locais) DESATIVADO. Backups
      // (backup_diario, backup_manual) sao COPIAS — source-of-truth e' o
      // Supabase. Nao tem porque baixar pro localStorage:
      //   - 5 dias × 1.87 MB de backup_diario:modelos_lista = 9.35 MB
      //   - + backup_manual com snapshots de 2 MB cada
      //   = enchia o localStorage (~10 MB limite Chrome) so' com COPIAS
      //   - cache stale, dados sumindo, popups 'Erro ao conectar'
      // Se algum dia precisar restaurar um backup, le direto do Supabase
      // via SQL. Nao precisa estar local.
      // rowsBackup.forEach(function(r) { if (_gravarUmaRow(r)) count++; });

      console.log('[DB] syncFromCloud: ' + count + ' chaves carregadas do Supabase'
        + ' (core=' + rowsCore.length + ', backups skipped=' + rowsBackup.length + ')');

      // ✅ SUCESSO TOTAL → libera write mode
      _readOnlyMode = false;
      _syncStatus = { lastSync: Date.now(), online: true, error: null };
      _emitStatus();
      console.log('[DB] ✅ Modo de escrita LIBERADO. Sistema pronto pra editar.');
      // Felipe sessao 32: voltou online -> drena fila de pendentes do modo offline.
      // Best-effort, nao bloqueia o boot.
      setTimeout(function() { _filaDrenar(); }, 1000);
      return true;
    } catch(e) {
      console.warn('[DB] syncFromCloud falhou (modo offline):', e.message, '- READ-ONLY mantido');
      _syncStatus = { lastSync: null, online: false, error: e.message };
      _emitStatus();
      return false;
    }
  }

  // syncToCloud DESABILITADO — causava perda de dados.
  async function syncToCloud() {
    console.warn('[DB] syncToCloud DESABILITADO.');
    return true;
  }

  // Driver principal
  var driver = {
    type: 'supabase+local',

    get: function(scope, key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + scope + ':' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch(e) { return fallback; }
    },

    set: function(scope, key, value) {
      // ────────────────────────────────────────────────────────────────────
      // Felipe sessao 2026-08-02: PROTECAO ANTI-PERDA
      // Em read-only mode, BLOQUEIA escritas em chaves de dados de negocio.
      // Permite escritas em chaves "seguras" (flags de boot, session, debug)
      // pra nao quebrar fluxos de inicializacao.
      // ────────────────────────────────────────────────────────────────────
      if (_readOnlyMode) {
        // Whitelist de chaves que SEMPRE podem ser escritas
        var SAFE_KEYS = [
          'acessorios_seeded', 'modelos_seeded', 'perfis_seeded',
          'superficies_seeded', 'representantes_seeded', 'cores_seeded',
          'session_user', 'last_login', 'last_route', 'ui_state',
          'auth_token', 'user_prefs',
        ];
        var SAFE_SCOPES = ['auth', 'session', 'ui', 'debug'];
        var keyOk   = SAFE_KEYS.indexOf(key) >= 0;
        var scopeOk = SAFE_SCOPES.indexOf(scope) >= 0;

        if (!keyOk && !scopeOk) {
          // BLOQUEIA escrita - retorna silenciosamente pra nao quebrar fluxos.
          // Alert mostrado pra usuario perceber.
          console.warn('[DB] ⛔ Escrita bloqueada (read-only):', scope, '/', key, '- razao:', _syncStatus.error);
          try {
            if (typeof window !== 'undefined' && window.alert && !window._dbReadOnlyAlertShown) {
              window._dbReadOnlyAlertShown = true;
              setTimeout(function() {
                window.alert('⛔ Sistema em modo SOMENTE LEITURA.\n\n' +
                  'Não foi possível conectar à nuvem (Supabase) na inicialização.\n' +
                  'Pra proteger seus dados, edições estão bloqueadas.\n\n' +
                  '• Recarregue a página (Ctrl+Shift+R)\n' +
                  '• Verifique sua conexão de internet\n' +
                  '• Há um botão "↻ Sync" no canto inferior direito da tela\n\n' +
                  'Erro: ' + (_syncStatus.error || 'sem detalhes'));
                window._dbReadOnlyAlertShown = false;
              }, 100);
            }
          } catch(_) {}
          return value; // Retorna o value pra simular sucesso (nao quebra fluxo)
        }
      }

      // Permissão granular REMOVIDA — todos podem editar cadastros.

      // Felipe (sessao 2026-05-10): localStorage e' cache opcional, Supabase
      // e' source-of-truth. Quando quota estoura, NAO deve travar o save —
      // segue normalmente pra sbUpsert. Sintoma anterior: 'Erro ao salvar
      // selecao: setItem ... exceeded the quota' bloqueava persistencia.
      try {
        localStorage.setItem(PREFIX + scope + ':' + key, JSON.stringify(value));
      } catch (lsErr) {
        if (lsErr && (lsErr.name === 'QuotaExceededError' || /quota/i.test(lsErr.message || ''))) {
          console.warn('[DB] ⚠️ localStorage quota cheia — pulando cache local. Supabase permanece source-of-truth.', scope + '/' + key);
        } else {
          console.warn('[DB] localStorage.setItem falhou (nao-quota):', lsErr);
        }
      }
      // Felipe sessao 13: marca timestamp local pra proteger contra
      // overwrite por realtime polling com dados stale do Supabase.
      _registrarWriteLocal(scope, key);
      sbUpsert(scope, key, value);
      Events.emit('db:change', { scope: scope, key: key, value: value });
      return value;
    },

    remove: function(scope, key) {
      if (_readOnlyMode) {
        console.warn('[DB] ⛔ Remove bloqueado (read-only):', scope, '/', key);
        return false;
      }
      localStorage.removeItem(PREFIX + scope + ':' + key);
      sbDelete(scope, key);
      Events.emit('db:change', { scope: scope, key: key, value: null });
      return true;
    },

    list: function(scope, keyPrefix) {
      keyPrefix = keyPrefix || '';
      var out = {};
      var fullPrefix = PREFIX + scope + ':' + keyPrefix;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(fullPrefix)) {
          try { out[k.slice((PREFIX + scope + ':').length)] = JSON.parse(localStorage.getItem(k)); }
          catch(e) {}
        }
      }
      return out;
    },
  };

  function scope(scopeName) {
    return {
      get:    function(k, fallback) { return driver.get(scopeName, k, fallback); },
      set:    function(k, value)    { return driver.set(scopeName, k, value); },
      remove: function(k)           { return driver.remove(scopeName, k); },
      list:   function(prefix)      { return driver.list(scopeName, prefix || ''); },
      subscribe: function(callback) {
        var handler = function(payload) {
          if (payload.scope === scopeName) callback(payload);
        };
        Events.on('db:change', handler);
        return function() { Events.off('db:change', handler); };
      },
    };
  }

  // Realtime via polling: verifica mudancas no Supabase a cada 5s.
  // Felipe sessao 2026-08-02: 'a cada alteracao deve salvar atualizar
  // automaticamente sem ter que apertar F5'.
  // - Polling 5s (antes 10s)
  // - Sem limit (antes era limit=50, podia perder mudancas em rajada)
  // - Emite db:change com remote:true pra modulos re-renderizarem
  // - DETECTA VOLTA DO FOCUS (notebook adormecido) e forca sync imediato
  var _lastSync = null;
  var _realtimeTimer = null;
  var _realtimeFocusHandler = null;

  function startRealtime() {
    if (_realtimeTimer) return;
    _lastSync = new Date().toISOString();
    _realtimeTimer = setInterval(async function() {
      try {
        var url = SUPABASE_URL + '/rest/v1/kv_store?select=scope,key,valor,updated_at&order=updated_at.desc';
        if (_lastSync) {
          url += '&updated_at=gt.' + encodeURIComponent(_lastSync);
        }
        var res = await fetch(url, { headers: sbHeaders(false) });
        if (!res.ok) return;
        var rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) return;
        var changed = false;
        var chavesAlteradas = [];
        // Felipe (sessao atual): "Paula coloca cliente tem que aparecer
        // automaticamente pra mim". O realtime gravava direto no localStorage
        // sem tratar quota — quando o localStorage estourava (~10MB), o
        // setItem do lead novo falhava SILENCIOSO, a tela travava no dado
        // velho (ex: 143 leads em vez de 162) e so' um F5 resolvia (o boot
        // limpa backups antes de gravar). Agora o polling tambem limpa
        // backups locais (recuperaveis do Supabase) e tenta de novo, e uma
        // falha numa chave NAO aborta as demais.
        function _limparBackupsLocaisRT() {
          var n = 0;
          try {
            for (var i = localStorage.length - 1; i >= 0; i--) {
              var k = localStorage.key(i);
              if (!k) continue;
              if (k.indexOf(PREFIX + 'backup_diario') === 0 ||
                  k.indexOf(PREFIX + 'backup_manual') === 0 ||
                  k.indexOf(PREFIX + 'orcamentos:neg_') === 0) {
                try { localStorage.removeItem(k); n++; } catch (_) {}
              }
            }
          } catch (_) {}
          return n;
        }
        rows.forEach(function(r) {
          // Felipe (sessao 09): NUNCA sincronizar SESSAO via realtime.
          // Felipe sessao 12: 'users' agora sincroniza (cadastros novos
          // precisam propagar entre maquinas - bug Andressa).
          if (r.key === 'session' || r.key === 'session_user' || r.key === 'last_login') return;
          // Felipe sessao 13: PROTECAO ANTI-STALE. Se acabamos de fazer
          // set() local pra esta chave (janela de 30s), e o registro
          // remoto e' MAIS VELHO que nosso write, IGNORA — caso contrario
          // sobrescreveriamos o write recente do usuario com dado obsoleto
          // (bug Felipe: importou planilha 7,09 mas orcamento via 14,18).
          if (_writeLocalEhMaisNovoQue(r.scope, r.key, r.updated_at)) {
            console.log('[DB] 🛡 Realtime IGNOROU stale: ' + r.scope + '/' + r.key + ' (write local mais novo)');
            return;
          }
          try {
            var lsKey = PREFIX + r.scope + ':' + r.key;
            var localRaw = localStorage.getItem(lsKey);
            var remoteVal = JSON.stringify(r.valor);
            if (localRaw !== remoteVal) {
              // Felipe sessao 27: aplica via Storage._applyRemote -> atualiza o
              // _memCache (e ajusta o dirty) em vez de gravar so' no localStorage
              // cru. Sem isso, se orcamentos:negocios estava dirty (quota cheia
              // das imagens base64 dos modelos), o Storage.get() devolvia o
              // memCache velho e a tela ignorava este sync — ex: Paula salva 3
              // versoes, banco tem as 3, mas o Felipe so' via 1.
              if (typeof Storage !== 'undefined' && Storage._applyRemote) {
                Storage._applyRemote(r.scope, r.key, r.valor);
                if (localStorage.getItem(lsKey) !== remoteVal) {
                  // cache em disco nao coube: libera backups locais
                  // (recuperaveis do Supabase) e reaplica. O memCache ja tem a
                  // verdade independente do localStorage.
                  var lib = _limparBackupsLocaisRT();
                  console.warn('[DB] 🔄 realtime: quota cheia em ' + r.scope + '/' + r.key
                    + ' — liberou ' + lib + ' backups locais (memCache mantem a verdade)');
                  Storage._applyRemote(r.scope, r.key, r.valor);
                }
              } else {
                // fallback defensivo: Storage indisponivel -> comportamento antigo
                try {
                  localStorage.setItem(lsKey, remoteVal);
                } catch (eQuota) {
                  _limparBackupsLocaisRT();
                  try { localStorage.setItem(lsKey, remoteVal); } catch (_) {}
                }
              }
              // Felipe sessao 2026-08-02: flag remote:true permite modulos
              // distinguirem 'mudei eu' vs 'outro usuario mudou'.
              Events.emit('db:change', { scope: r.scope, key: r.key, value: r.valor, remote: true });
              changed = true;
              chavesAlteradas.push(r.scope + '/' + r.key);
            }
          } catch (eRow) {
            console.warn('[DB] realtime: falha ao aplicar ' + r.scope + '/' + r.key
              + ' (segue com as demais):', eRow && eRow.message);
          }
        });
        _lastSync = rows[0].updated_at;
        if (changed) {
          console.log('[DB] 🔄 Realtime: ' + rows.length + ' mudanca(s) do cloud aplicadas:', chavesAlteradas.join(', '));
          Events.emit('db:realtime-sync', { count: rows.length, chaves: chavesAlteradas });
        }
      } catch(e) {
        // silencioso — polling nao deve travar o app
      }
    }, 3000);  // Felipe sessao 12: 3s (era 5s) — mais "tempo real" pra colaboracao

    // Felipe sessao 2026-08-02: detecta volta do focus (aba/notebook
    // que estava em background ou adormecido) e dispara polling
    // imediato pra sincronizar sem esperar 5s.
    if (typeof document !== 'undefined' && !_realtimeFocusHandler) {
      _realtimeFocusHandler = async function() {
        if (document.visibilityState === 'visible') {
          console.log('[DB] 👀 Aba voltou ao foco - forcando sync imediato');
          // Resync completo (caso o aba tenha ficado horas dormindo)
          try {
            await syncFromCloud();
          } catch(_) {}
        }
      };
      document.addEventListener('visibilitychange', _realtimeFocusHandler);
      // Tambem captura window.focus (volta de outra aba/janela)
      window.addEventListener('focus', _realtimeFocusHandler);
    }
  }

  function stopRealtime() {
    if (_realtimeTimer) { clearInterval(_realtimeTimer); _realtimeTimer = null; }
    if (_realtimeFocusHandler) {
      try {
        document.removeEventListener('visibilitychange', _realtimeFocusHandler);
        window.removeEventListener('focus', _realtimeFocusHandler);
      } catch(_) {}
      _realtimeFocusHandler = null;
    }
  }

  // Felipe sessao 14: API de TOMBSTONES — registra delecoes intencionais
  // pra mergeProtegido_lista respeitar. Sem isso, deletar um item local
  // era ressuscitado pelo merge com cloud (uniao). Resolve bug "apago
  // vidro e fica voltando".
  async function adicionarTombstone(scope, listKey, chaveStr) {
    if (!chaveStr) return;
    var tombKey = listKey + '__deleted';
    var lista = [];
    try {
      var url = SUPABASE_URL + '/rest/v1/kv_store?scope=eq.' + scope + '&key=eq.' + tombKey + '&select=valor';
      var res = await fetch(url, { headers: sbHeaders(false) });
      if (res.ok) {
        var rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0].valor)) {
          lista = rows[0].valor.slice();
        }
      }
    } catch(_){}
    var k = String(chaveStr).toUpperCase();
    var jaTem = lista.some(function(x){ return String(x).toUpperCase() === k; });
    if (jaTem) return;
    lista.push(chaveStr);
    // Salva via sbUpsert (mesmo caminho dos saves normais)
    sbUpsert(scope, tombKey, lista);
  }

  async function removerTombstone(scope, listKey, chaveStr) {
    if (!chaveStr) return;
    var tombKey = listKey + '__deleted';
    try {
      var url = SUPABASE_URL + '/rest/v1/kv_store?scope=eq.' + scope + '&key=eq.' + tombKey + '&select=valor';
      var res = await fetch(url, { headers: sbHeaders(false) });
      if (!res.ok) return;
      var rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0].valor)) return;
      var k = String(chaveStr).toUpperCase();
      var nova = rows[0].valor.filter(function(x){ return String(x).toUpperCase() !== k; });
      if (nova.length !== rows[0].valor.length) sbUpsert(scope, tombKey, nova);
    } catch(_){}
  }

  return {
    driver: function() { return driver.type; },
    scope: scope,
    syncFromCloud: syncFromCloud,
    syncToCloud: syncToCloud,
    _sbUpsert: sbUpsert,
    // Felipe sessao 18: expor _registrarWriteLocal pra Storage.set
    // ativar a protecao anti-stale (evita realtime polling sobrescrever
    // delete recente com versao antiga do server).
    _registrarWriteLocal: _registrarWriteLocal,
    // Felipe sessao 12: flush imediato de saves pendentes (operacoes
    // criticas tipo aprovarOrcamento usam pra garantir atomicidade)
    flushSbUpsertPendentes: flushSbUpsertPendentes,
    startRealtime: startRealtime,
    stopRealtime: stopRealtime,
    SUPABASE_URL: SUPABASE_URL,
    // Felipe sessao 33: expoe a KEY tambem pra outros modulos (ex:
    // 21-modelos.js upload de imagem pro Storage) reusarem em vez de
    // hardcodar — evita ficar apontando pro banco antigo numa migracao.
    SUPABASE_KEY: SUPABASE_KEY,
    // Felipe sessao 2026-08-02: protecao anti-perda
    isReadOnly: isReadOnly,
    // Felipe sessao 32: usado pelo botao "Continuar Offline" do boot
    // quando Supabase esta inacessivel. Libera modo escrita pro user
    // poder trabalhar com cache local. Realtime polling continua tentando
    // sync em background — quando voltar, write-through retoma.
    forceLiberarEscrita: function() {
      _readOnlyMode = false;
      _syncStatus = { lastSync: null, online: false, error: 'offline_mode_user_choice' };
      _emitStatus();
      console.warn('[DB] forceLiberarEscrita: modo escrita liberado em MODO OFFLINE. Use com cuidado.');
    },
    getSyncStatus: getSyncStatus,
    onSyncStatusChange: onSyncStatusChange,
    // Felipe sessao 14: tombstones (delecoes intencionais)
    adicionarTombstone: adicionarTombstone,
    removerTombstone: removerTombstone,
  };
})();

// Felipe sessao 2026-08-02 V3: expoe globalmente. Em browsers strict
// mode 'const' top-level NAO vira automaticamente window.X.
if (typeof window !== 'undefined') window.Database = Database;
