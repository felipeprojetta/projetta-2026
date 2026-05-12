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
  const SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
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
  async function mergeProtegido_users(localValue) {
    if (!Array.isArray(localValue)) return localValue;
    try {
      var url = SUPABASE_URL + '/rest/v1/kv_store?scope=eq.auth&key=eq.users&select=valor';
      var res = await fetch(url, { headers: sbHeaders(false) });
      if (!res.ok) return localValue;
      var rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return localValue;
      var cloudValue = rows[0].valor;
      if (!Array.isArray(cloudValue)) return localValue;
      // Merge: cloud + locais novos (locais que nao tem no cloud)
      var byUsername = {};
      cloudValue.forEach(function(u) {
        if (u && u.username) byUsername[u.username] = u;
      });
      var adicionados = 0;
      localValue.forEach(function(u) {
        if (u && u.username && !byUsername[u.username]) {
          byUsername[u.username] = u;
          adicionados++;
        }
      });
      var merged = Object.values(byUsername);
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
      var res = await fetch(url, { headers: sbHeaders(false) });
      if (!res.ok) return localValue;
      var rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return localValue;
      var cloudValue = rows[0].valor;
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
          if (deletadasLocal.has(verId)) return;  // pula versoes deletadas (tombstone)
          var info = cloudInfo.versoesMap[verId];
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
    if (_sbUpsertTimers[timerKey]) clearTimeout(_sbUpsertTimers[timerKey]);
    // Felipe sessao 12: guarda ultimo payload pra flushSbUpsertPendentes
    _sbUpsertPayloads[timerKey] = { scope: scope, key: key, value: value };
    _sbUpsertTimers[timerKey] = setTimeout(function() {
      delete _sbUpsertTimers[timerKey];
      delete _sbUpsertPayloads[timerKey];
      _sbUpsertExecuta(scope, key, value);
    }, 500);  // 500ms debounce — ultimo valor ganha
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
          console.error('[DB] sbUpsert FALHOU:', scope, '/', key, 'HTTP', res.status);
          return false;
        }
        return true;
      }).catch(function(e) {
        console.error('[DB] sbUpsert FALHOU (rede):', scope, '/', key, e.message);
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
      if (p) {
        promises.push(_sbUpsertExecuta(p.scope, p.key, p.value));
      }
    });
    return Promise.all(promises);
  }

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
      var res = await fetch(SUPABASE_URL + '/rest/v1/kv_store?select=scope,key,valor&order=scope,key', {
        headers: sbHeaders(false),
      });
      if (!res.ok) {
        console.warn('[DB] syncFromCloud HTTP', res.status, '- READ-ONLY mantido');
        _syncStatus = { lastSync: null, online: false, error: 'http_' + res.status };
        _emitStatus();
        return false;
      }
      var rows = await res.json();
      if (!Array.isArray(rows)) {
        _syncStatus = { lastSync: null, online: false, error: 'resposta_invalida' };
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
      rows.forEach(function(r) {
        // Bloqueia chaves de autenticação
        if (NEVER_SYNC_SCOPES.indexOf(r.scope) >= 0) return;
        if (NEVER_SYNC_KEYS.indexOf(r.key) >= 0) return;
        var lsKey = PREFIX + r.scope + ':' + r.key;
        try {
          var valorSb = r.valor;
          if (Array.isArray(valorSb) && valorSb.length === 0) {
            var localRaw = localStorage.getItem(lsKey);
            if (localRaw !== null) {
              try {
                var localVal = JSON.parse(localRaw);
                if (Array.isArray(localVal) && localVal.length > 0) {
                  return;
                }
              } catch(_) {}
            }
          }
          localStorage.setItem(lsKey, JSON.stringify(valorSb));
          count++;
        } catch(e) {}
      });
      console.log('[DB] syncFromCloud: ' + count + ' chaves carregadas do Supabase');

      // ✅ SUCESSO TOTAL → libera write mode
      _readOnlyMode = false;
      _syncStatus = { lastSync: Date.now(), online: true, error: null };
      _emitStatus();
      console.log('[DB] ✅ Modo de escrita LIBERADO. Sistema pronto pra editar.');
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
          var lsKey = PREFIX + r.scope + ':' + r.key;
          var localRaw = localStorage.getItem(lsKey);
          var remoteVal = JSON.stringify(r.valor);
          if (localRaw !== remoteVal) {
            localStorage.setItem(lsKey, remoteVal);
            // Felipe sessao 2026-08-02: flag remote:true permite modulos
            // distinguirem 'mudei eu' vs 'outro usuario mudou'.
            Events.emit('db:change', { scope: r.scope, key: r.key, value: r.valor, remote: true });
            changed = true;
            chavesAlteradas.push(r.scope + '/' + r.key);
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
    // Felipe sessao 2026-08-02: protecao anti-perda
    isReadOnly: isReadOnly,
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
