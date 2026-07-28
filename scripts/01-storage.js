/* 01-storage.js — Storage (legacy adapter sincrono).
   Modulos antigos ainda usam Storage.scope(). Nao usar em codigo novo:
   prefira Database.scope() (async) que e' o padrao do sistema. */

/* ============================================================
   STORAGE (LEGACY — mantido por compatibilidade)
   ============================================================
   Modulos antigos (Auth, Cadastros) ainda usam Storage.scope().
   Storage agora e' um adapter sincrono que delega ao Database.
   IMPORTANTE: NOVOS MODULOS NAO DEVEM USAR ISTO.
   Use Database.scope() (async) em todo modulo novo.
   ============================================================ */
const Storage = (() => {
  /* Adapter sincrono: enquanto driver for 'local', podemos retornar
     direto sem await. Isso quebra a regra do async, mas mantem o
     codigo legado funcionando ate ser migrado.
     Quando driver virar 'supabase', Storage sera removido e os
     chamadores antigos serao migrados pra Database (async).

     Felipe sessao 2026-08-02: set() e remove() do Storage agora
     respeitam Database.isReadOnly() pra protecao anti-perda. Em
     read-only, escritas em chaves de dados de negocio sao
     BLOQUEADAS com throw. */
  const PREFIX = 'projetta:';

  // Felipe sessao 32: CACHE EM MEMORIA pra contornar localStorage quota cheia.
  //
  // Bug observado: quando localStorage estoura quota (~10MB no Chrome),
  // setItem falha silenciosamente. O get subsequente le do localStorage
  // (que nao tem o valor novo OU tem valor STALE de antes da falha).
  // Sintoma: lead recem-criado some, 'orcamento_lead_ativo' fica null,
  // versao recem-criada nao e' encontrada por atualizarVersao.
  //
  // Fix v2 (commit em curso): _memCache + _dirtyKeys.
  //   - _memCache: Map<scope+key, value> em memoria. set() sempre grava aqui.
  //   - _dirtyKeys: Set<scope+key>. Marca chaves onde localStorage falhou
  //     no ultimo set (stale). get() consulta _dirtyKeys: se chave dirty,
  //     confia no memCache em vez do localStorage stale.
  //
  // Pra chaves nao-dirty (caso comum), comportamento e' identico ao antes:
  //   - get le do localStorage primeiro
  //   - memCache so' e' usado como fallback final se localStorage nao tem
  //
  // Isso preserva integracoes com Database.js (syncFromCloud, mergeProtegido,
  // realtime) que escrevem direto no localStorage — get continua respeitando
  // esses writes, EXCETO em chaves marcadas como dirty (onde memCache e' mais
  // novo que localStorage stale).
  //
  // Reload zera memCache+dirtyKeys (closure novo). syncFromCloud do Database
  // puxa tudo do Supabase no boot. Supabase = source-of-truth.
  const _memCache = new Map();
  const _dirtyKeys = new Set();
  function _memKey(scope, k) { return scope + ':' + k; }

  // Felipe sessao 32 (auto-cleanup): quando localStorage estoura quota,
  // tenta liberar espaco automaticamente apagando chaves descartaveis
  // (backups diarios auto-regeneram; forensics ja estao no Supabase).
  // Retorna numero de chaves removidas. Se >0, vale a pena tentar setItem
  // de novo.
  //
  // Felipe sessao 34: expandido pra cobrir TODOS os padroes de lixo
  // historico que enchiam o localStorage do Felipe (diagnostico: 9.99MB
  // de 10MB ocupados, PKCE verifier nao conseguia salvar). Adicionados:
  //   - *_backup_sessao\d+      (backups antigos de sessao de dev)
  //   - *__pre_*                (snapshots pre-mudancas)
  //   - projetta_crm_v1         (legado V1, ja' migrou)
  function _tentarLiberarEspaco() {
    var removidos = 0;
    var keysParaRemover = [];
    var bytesLiberados = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        // Felipe sessao 34: padroes ampliados de "lixo descartavel local"
        // (todos sao redundantes - existem no Supabase ou nao sao mais usados)
        var ehLixo = false;
        if (k.indexOf(PREFIX) === 0) {
          // Chaves do projetta:* com prefixo
          if (k.indexOf(PREFIX + 'backup_diario:') === 0
              || k.indexOf(PREFIX + 'backup_manual:') === 0
              || k.indexOf(':forensic_') !== -1
              || k.indexOf('forensic') !== -1          // Felipe sessao 37: leads__forensic_* etc (key-level)
              || /:.*backup_20\d{2}/.test(k)            // backup_2026*
              || /_backup_sessao\d+/.test(k)            // _backup_sessao13/14
              || /__pre_/.test(k)                       // __pre_ezy_color etc
              // Felipe s37 (quota): staging da extracao/conferencia Weiku.
              // Sao 100% redundantes — vivem no Supabase e NENHUMA tela le
              // do local. Chegavam a ocupar ~0.5MB no navegador do Felipe,
              // segurando os leads novos de fora. NAO inclui weiku:reservas
              // (essa a aba Weiku usa de verdade).
              || /:(detalhes_paginas|detalhes_api|conferencia_robo|pasta1_conf)$/.test(k)
              || /:excel_(conf|full)_/.test(k)
              // Felipe s37 (quota): historico de precos congelados — 2.27MB
              // no navegador do Felipe. Supabase-only (ver 00-database.js):
              // nunca e' lido em tela, so' escrito. Limpa o que ja' ficou
              // preso no local de sessoes anteriores.
              || k.indexOf('precos_snapshots_arquivo') !== -1) {
            ehLixo = true;
          }
        } else if (k === 'projetta_crm_v1') {
          // Legado V1 (sem prefixo projetta:) - migrou pra V7 ja' faz tempo
          ehLixo = true;
        }
        if (ehLixo) {
          var v = localStorage.getItem(k) || '';
          bytesLiberados += (k.length + v.length) * 2;
          keysParaRemover.push(k);
        }
      }
      keysParaRemover.forEach(function(k) {
        try { localStorage.removeItem(k); removidos++; } catch(_) {}
      });
      if (removidos > 0) {
        console.warn('[Storage] 🧹 Auto-cleanup: ' + removidos + ' chaves descartaveis removidas, ~'
          + (bytesLiberados/1024).toFixed(0) + ' KB liberados.');
      }
    } catch(_) {}
    return removidos;
  }

  /**
   * Felipe s37 — VARREDURA POR TAMANHO (fix definitivo do "Memoria cheia").
   *
   * A inversao de fonte de verdade manda pra RAM toda chave acima de
   * MAX_CACHE_LOCAL_BYTES. So' que ela so' tira a chave do disco NA HORA
   * DE GRAVAR (_guardarSoNaMemoria). Chave grande que ja' estava no
   * localStorage de ANTES da inversao, e que ninguem regravou, fica presa
   * la' pra sempre — e o _tentarLiberarEspaco nao a remove porque so'
   * conhece padroes de lixo (forensic, backup_, __pre_...).
   *
   * Diagnostico real: orcamentos:negocios = 2,2MB de JSON. localStorage
   * conta em UTF-16, entao ocupa ~4,4MB — sozinho quase o teto de 5MB do
   * Chrome. Somado a weiku:reservas e crm:leads, estourava. Resultado: o
   * banner vermelho na tela do Felipe e gravacoes se perdendo (a PTAX do
   * A&A nao persistiu por causa disto).
   *
   * Esta varredura remove do disco QUALQUER chave acima do teto. E' por
   * tamanho, entao se auto-mantem: chave que crescer sai sozinha, sem
   * ninguem precisar atualizar lista.
   *
   * SEGURANCA — o que NUNCA e' removido:
   *   - a fila de escritas offline (unico lugar onde vive: seria perda real)
   *   - scopes locais que nao existem no Supabase (auth_session, app, ui)
   *   - chaves de sessao/login
   * O resto tem o Supabase como fonte e e' repovoado pelo syncFromCloud,
   * que o boot ja' espera antes de renderizar.
   */
  // Teto de cache local por chave. Declarado AQUI (e nao junto do bloco da
  // inversao, mais abaixo) porque a varredura de boot roda antes daquele
  // ponto do arquivo — com const la' embaixo dava ReferenceError de TDZ e a
  // varredura falhava calada dentro do try/catch.
  const MAX_CACHE_LOCAL_BYTES = 300 * 1024;   // 300KB por chave

  const SCOPES_LOCAIS = ['auth_session', 'app', 'ui', 'auth', 'session', 'debug'];
  const KEYS_LOCAIS = [
    'session', 'session_user', 'last_login', 'last_route', 'ui_state',
    'auth_token', 'user_prefs',
    // flags de seed: sao booleanos locais, nao dado de negocio
    'acessorios_seeded', 'modelos_seeded', 'perfis_seeded',
    'superficies_seeded', 'representantes_seeded', 'cores_seeded',
  ];

  /** A chave pode morar no disco do navegador? */
  function _podeFicarNoDisco(scopeName, k) {
    if (SCOPES_LOCAIS.indexOf(scopeName) >= 0) return true;
    if (KEYS_LOCAIS.indexOf(k) >= 0) return true;
    return false;   // dado de negocio: RAM + Supabase, nunca disco
  }

  function _varrerChavesGrandesDoDisco() {
    var removidos = 0, bytes = 0;
    var PROTEGIDOS_SCOPE = ['auth_session', 'app', 'ui', 'auth', 'session', 'debug'];
    var PROTEGIDOS_SUFIXO = ['session', 'session_user', 'last_login', 'auth_token', 'user_prefs'];
    try {
      var alvo = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(PREFIX) !== 0) continue;
        // fila de escritas offline: NUNCA remover (nao existe no Supabase)
        if (k.indexOf('_sync_fila_pendentes') !== -1) continue;
        var resto = k.slice(PREFIX.length);
        var sep = resto.indexOf(':');
        var scopeK = sep >= 0 ? resto.slice(0, sep) : '';
        var keyK = sep >= 0 ? resto.slice(sep + 1) : resto;
        if (PROTEGIDOS_SCOPE.indexOf(scopeK) >= 0) continue;
        if (PROTEGIDOS_SUFIXO.indexOf(keyK) >= 0) continue;
        var v = localStorage.getItem(k) || '';
        // Politica: dado de negocio nao mora no disco (qualquer tamanho).
        // Fallback por tamanho pra chave local que tenha inchado.
        if (!_podeFicarNoDisco(scopeK, keyK) || v.length > MAX_CACHE_LOCAL_BYTES) {
          alvo.push(k);
          bytes += (k.length + v.length) * 2;
        }
      }
      alvo.forEach(function (k) {
        try { localStorage.removeItem(k); removidos++; } catch (_) {}
      });
      if (removidos > 0) {
        console.warn('[Storage] 🧹 Varredura por tamanho: ' + removidos
          + ' chave(s) grande(s) removida(s) do disco, ~' + (bytes / 1024 / 1024).toFixed(2)
          + 'MB liberados. Elas vivem em RAM + Supabase (repovoadas pelo syncFromCloud).');
        console.warn('[Storage]   removidas: ' + alvo.join(', '));
      }
    } catch (e) {
      console.warn('[Storage] varredura por tamanho falhou (ignorando):', e.message);
    }
    return removidos;
  }

  // Felipe sessao 34: LIMPEZA PROATIVA NO BOOT. Em vez de esperar
  // QuotaExceeded acontecer (que ai' o erro chega em ponto critico tipo
  // PKCE verifier do login), limpa o lixo conhecido JA' no carregamento
  // do modulo Storage. Roda silencioso se quota < 80%, ou avisa no console
  // se passou disso.
  (function _limpezaBootProativa() {
    try {
      // Felipe s37: PRIMEIRO a varredura por tamanho. Roda SEMPRE, nao
      // so' quando a quota ja' esta apertada — chave grande no disco e'
      // violacao da politica (RAM + Supabase), entao sai independente do
      // quanto sobrou de espaco. E' o que faltava pro banner vermelho
      // parar de voltar: antes so' se limpava lixo de padrao conhecido,
      // e as chaves grandes legitimas ficavam presas.
      _varrerChavesGrandesDoDisco();

      // Mede quota usada
      var totalBytes = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        totalBytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
      var totalMB = totalBytes / 1024 / 1024;
      // Felipe s37: com dado de negocio fora do disco, o localStorage passa
      // a guardar so' sessao/login/rota/preferencias — algo em torno de
      // centenas de KB. Se passar de 1MB e' porque alguma chave nova esta
      // vazando pro disco: limpa e registra, pra nunca mais chegar perto do
      // teto de 5MB do Chrome ("nao quero mais esse negocio de espaco 5mb
      // todo santo dia excedendo e travando").
      var QUOTA_ALVO_MB = 1;
      if (totalMB > QUOTA_ALVO_MB) {
        console.warn('[Storage] localStorage em ' + totalMB.toFixed(2)
          + 'MB (esperado <' + QUOTA_ALVO_MB + 'MB). Limpando...');
        var removidos = _tentarLiberarEspaco();
        // Lista o que sobrou grande, pra achar o vazamento rapido.
        try {
          var maiores = [];
          for (var j = 0; j < localStorage.length; j++) {
            var kk = localStorage.key(j);
            var vv = localStorage.getItem(kk) || '';
            if (vv.length > 50 * 1024) maiores.push(kk + ' (' + (vv.length / 1024).toFixed(0) + 'KB)');
          }
          if (maiores.length) {
            console.warn('[Storage] chaves grandes no disco: ' + maiores.join(', '));
          }
        } catch (_) {}
        if (removidos === 0 && totalMB > 3) {
          console.warn('[Storage] espaco apertado e nada pra limpar — avise o Felipe.');
        }
      }
    } catch(e) {
      // Boot resiliente - se algo der erro aqui, continua sem limpar
      console.warn('[Storage] limpeza boot falhou (ignorando):', e.message);
    }
  })();

  // Felipe s37: AVISO VISIVEL DE QUOTA.
  // Antes a falha por quota so' ia pro console — o usuario nunca via.
  // Consequencia real: o navegador do Felipe ficou meses preso em 254
  // leads enquanto o banco tinha 285, e ninguem percebeu.
  //
  // Regras deste aviso (pra NUNCA sobrecarregar):
  //   - dispara no maximo 1x por sessao (flag de modulo, nao re-renderiza)
  //   - HTML puro, sem dependencia de framework/tela carregada
  //   - se o DOM ainda nao existe, agenda pro DOMContentLoaded e sai
  //   - qualquer erro aqui e' engolido: NUNCA pode quebrar um save
  var _avisoQuotaMostrado = false;
  function _avisarQuotaNaTela() {
    // Felipe s37: DESLIGADO. O banner vermelho "Memoria do navegador cheia"
    // nao aparece mais. Ele fazia sentido quando o dado de negocio morava no
    // localStorage: quota cheia = usuario vendo dado velho, e precisava saber.
    // Agora dado de negocio nunca toca o disco (RAM + Supabase, repovoado pelo
    // syncFromCloud antes de renderizar), entao a tela SEMPRE reflete o
    // servidor e o aviso so' assustaria sem haver acao possivel.
    // A funcao continua aqui, exportada e chamavel — se um dia a politica
    // mudar, basta remover o return abaixo pra religar o banner.
    console.warn('[Storage] aviso de quota suprimido (dado de negocio nao usa disco).');
    return;
    if (_avisoQuotaMostrado) return;
    _avisoQuotaMostrado = true;
    try {
      var montar = function () {
        try {
          if (!document || !document.body) return;
          if (document.getElementById('projetta-aviso-quota')) return;
          var d = document.createElement('div');
          d.id = 'projetta-aviso-quota';
          d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;'
            + 'background:#b91c1c;color:#fff;padding:10px 46px 10px 16px;'
            + 'font:600 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;'
            + 'box-shadow:0 2px 8px rgba(0,0,0,.3);';
          d.innerHTML = '⚠️ <b>Memoria do navegador cheia.</b> '
            + 'Dados novos (leads, orcamentos) podem NAO aparecer nesta tela ate' + ' liberar espaco. '
            + 'Nada foi perdido — o servidor esta' + ' correto. '
            + 'Recarregue a pagina; se o aviso voltar, avise o Felipe.'
            + '<span id="projetta-aviso-quota-x" style="position:absolute;right:14px;top:8px;'
            + 'cursor:pointer;font-size:20px;line-height:1;padding:0 4px;">&times;</span>';
          document.body.appendChild(d);
          var x = document.getElementById('projetta-aviso-quota-x');
          if (x) x.onclick = function () { try { d.remove(); } catch (_) {} };
        } catch (_) {}
      };
      if (document && document.body) montar();
      else if (document) document.addEventListener('DOMContentLoaded', montar, { once: true });
    } catch (_) {}
  }

  // ============================================================
  // Felipe s37 — INVERSAO DA FONTE DE VERDADE ("modo Bitrix")
  // ============================================================
  // ANTES: o navegador GUARDAVA os dados (localStorage) e o Supabase
  // recebia copia. O teto de 5MB do Chrome virava teto do sistema —
  // e quando estourava, gravacao de lead/orcamento se perdia calada.
  //
  // AGORA: Supabase e' a fonte. Dados pesados ficam em MEMORIA durante
  // a sessao (populados pelo syncFromCloud, que o boot ja' espera antes
  // de renderizar) e NUNCA ocupam o localStorage. O localStorage guarda
  // so' o que e' pequeno e/ou local (sessao, preferencias, chaves leves).
  //
  // Por que por TAMANHO e nao por lista fixa: qualquer chave que cresca
  // demais sai do disco automaticamente, sem precisar de manutencao.
  // Chave leve continua cacheada (abre rapido, funciona offline).
  // (MAX_CACHE_LOCAL_BYTES declarado la' em cima — a varredura de boot
  //  precisa dele ANTES deste ponto do arquivo.)

  // ============================================================
  // Felipe s37 — NAVEGADOR NAO GUARDA DADO
  // ============================================================
  // "quero isso igual um sistema de verdade que roda na nuvem,
  //  nao depende de cache de navegador"
  //
  // ANTES: qualquer chave abaixo de 300KB ia pro localStorage. Isso
  // mantinha o navegador como LUGAR DE GUARDAR DADO — e por isso existia
  // teto, aviso de "memoria cheia" e gravacao que se perdia calada
  // (a PTAX do A&A nao persistiu por isso).
  //
  // AGORA a regra e' por NATUREZA da chave, nao por tamanho:
  //   - dado de negocio (leads, orcamentos, cadastros, weiku...) NUNCA
  //     toca o disco. Vive em RAM durante a sessao (populado pelo
  //     syncFromCloud, que o boot ja' espera antes de renderizar) e no
  //     Supabase pra sempre. Fonte de verdade unica: o servidor.
  //   - so' fica no disco o que e' do PROPRIO navegador e nao existe no
  //     servidor: sessao, login, rota atual, preferencias de tela, flags
  //     de seed. Tudo isso e' minusculo — o localStorage nunca mais
  //     chega perto do teto, entao o aviso vermelho deixa de existir.
  //
  // Consequencia aceita: sem conexao o sistema nao abre com os dados
  // (igual Bitrix/Salesforce). Escritas feitas offline continuam
  // protegidas pela fila _sync_fila_pendentes.
  // (SCOPES_LOCAIS / KEYS_LOCAIS / _podeFicarNoDisco declarados la' em cima —
  //  a varredura de boot precisa deles antes deste ponto do arquivo.)


  /**
   * Decide se a chave fica FORA do disco.
   * scopeName/k opcionais: sem eles cai na regra antiga (so' tamanho),
   * pra nao quebrar chamador que ainda nao passa o scope.
   */
  function _pesadaDemaisParaLocal(serializado, scopeName, k) {
    if (typeof scopeName === 'string') return !_podeFicarNoDisco(scopeName, k);
    return typeof serializado === 'string' && serializado.length > MAX_CACHE_LOCAL_BYTES;
  }

  // Guarda em RAM e garante que a chave NAO ocupe localStorage.
  // Marca dirty pra que get() sirva o memCache (e nunca um disco stale).
  function _guardarSoNaMemoria(scopeName, k, value) {
    const mk = _memKey(scopeName, k);
    _memCache.set(mk, value);
    _dirtyKeys.add(mk);
    try { localStorage.removeItem(PREFIX + scopeName + ':' + k); } catch (_) {}
  }

  // Whitelist de chaves/scopes seguras (mesmo do Database)
  // que podem ser escritas mesmo em read-only.
  function _isReadOnlyBlocked(scopeName, k) {
    try {
      if (typeof Database === 'undefined') return false;
      if (typeof Database.isReadOnly !== 'function') return false;
      if (!Database.isReadOnly()) return false;
    } catch(_) { return false; }
    var SAFE_KEYS = [
      'acessorios_seeded', 'modelos_seeded', 'perfis_seeded',
      'superficies_seeded', 'representantes_seeded', 'cores_seeded',
      'session_user', 'last_login', 'last_route', 'ui_state',
      'auth_token', 'user_prefs',
    ];
    var SAFE_SCOPES = ['auth', 'session', 'ui', 'debug'];
    if (SAFE_KEYS.indexOf(k) >= 0) return false;
    if (SAFE_SCOPES.indexOf(scopeName) >= 0) return false;
    return true; // bloqueado
  }

  // Felipe sessao 2026-08-02: defesa em profundidade pra permissoes.
  // Se scope='cadastros' e user nao tem permissao, BLOQUEIA escrita.
  // Felipe sessao 2026-08-02 V2: agora consulta Permissoes.podeEditarChave
  // (granular) - permite que admin libere acessos pontuais por usuario.
  function _isPermissaoBlocked(scopeName, k) {
    // Felipe: trava de permissao DESATIVADA temporariamente — ambos os
    // usuarios ficam livres pra editar cadastros (inclusive fotos de modelos)
    // enquanto NAO existe a tela pra configurar "o que cada um pode mexer".
    // Pra RELIGAR a trava depois: basta remover o `return false;` abaixo — toda
    // a logica de admin/permissao granular continua intacta.
    return false;
    try {
      if (scopeName !== 'cadastros') return false; // so' bloqueia cadastros
      if (typeof Auth === 'undefined') return false;
      // Admin sempre pode
      if (Auth.isAdmin && Auth.isAdmin()) return false;
      // Excecoes (chaves operacionais que podem rodar mesmo sem admin):
      var SAFE_CADASTROS_KEYS = [
        'acessorios_seeded', 'modelos_seeded', 'perfis_seeded',
        'superficies_seeded', 'representantes_seeded', 'cores_seeded',
      ];
      if (SAFE_CADASTROS_KEYS.indexOf(k) >= 0) return false;
      // Permissoes granulares (overrides por usuario)
      var session = Auth.currentUser ? Auth.currentUser() : null;
      if (session && typeof Permissoes !== 'undefined' && Permissoes.podeEditarChave) {
        if (Permissoes.podeEditarChave(session.username, k)) return false;
      }
      return true; // bloqueado
    } catch(_) { return false; }
  }

  return {
    // Felipe s37: exposto pro 00-database.js avisar na tela quando a
    // gravacao vinda do SYNC falhar por quota (caminho por onde chegam
    // os leads criados pela Paula/Thays). Idempotente: 1x por sessao.
    _avisarQuota: _avisarQuotaNaTela,
    // Felipe s37 (modo Bitrix): usado pelo syncFromCloud pra decidir se a
    // chave vinda do Supabase entra no disco ou fica so' em RAM.
    _pesadaDemais: _pesadaDemaisParaLocal,
    _guardarSoNaMemoria: _guardarSoNaMemoria,
    _limiteCacheLocal: MAX_CACHE_LOCAL_BYTES,
    // Felipe sessao 27: aplica mudanca vinda do realtime polling DENTRO do
    // _memCache (e ajusta dirty), em vez de o polling gravar so' no localStorage
    // cru. Garante que Storage.get() devolva o valor remoto recem-sincronizado
    // mesmo quando a chave estava dirty por quota (imagens base64 dos modelos).
    // Bug resolvido: Paula salva 3 versoes, banco tem as 3, Felipe so' via 1.
    _applyRemote(scopeName, k, value) {
      const mk = _memKey(scopeName, k);
      _memCache.set(mk, value);
      // Felipe s37 (modo Bitrix): pesada -> so' RAM, nao ocupa disco.
      let _ser = null;
      try { _ser = JSON.stringify(value); } catch (_) { _ser = null; }
      if (_pesadaDemaisParaLocal(_ser, scopeName, k)) { _guardarSoNaMemoria(scopeName, k, value); return; }
      try {
        localStorage.setItem(PREFIX + scopeName + ':' + k, _ser !== null ? _ser : JSON.stringify(value));
        _dirtyKeys.delete(mk);   // localStorage e memCache em sincronia
      } catch (_) {
        // localStorage cheio: memCache tem a verdade remota. Marca dirty pra
        // get() devolver o memCache (e NAO o localStorage stale).
        _dirtyKeys.add(mk);
      }
    },
    scope(scopeName) {
      return {
        get(k, fallback = null) {
          const mk = _memKey(scopeName, k);
          // Felipe sessao 32 (fix v2): se localStorage esta marcado dirty
          // (ultimo set falhou por quota), confia direto no memCache pra essa
          // chave. Resolve: lead novo some, atualizarVersao nao acha versao
          // recem-criada, etc.
          if (_dirtyKeys.has(mk)) {
            const memVal = _memCache.get(mk);
            if (memVal !== undefined) return memVal;
          }
          try {
            const raw = localStorage.getItem(PREFIX + scopeName + ':' + k);
            if (raw !== null) return JSON.parse(raw);
          } catch (e) { /* corrupted localStorage entry — falls back below */ }
          // Fallback final: memCache mesmo quando nao dirty (caso onde
          // localStorage esta vazio mas set anterior nao falhou — improvavel
          // mas defensivo).
          const memVal = _memCache.get(mk);
          if (memVal !== undefined) return memVal;
          return fallback;
        },
        set(k, value) {
          // Felipe sessao 2026-08-02: bloqueio anti-perda em read-only
          if (_isReadOnlyBlocked(scopeName, k)) {
            console.warn('[Storage] ⛔ Escrita bloqueada (read-only):', scopeName, '/', k);
            try {
              if (typeof window !== 'undefined' && window.alert && !window._dbReadOnlyAlertShown) {
                window._dbReadOnlyAlertShown = true;
                setTimeout(function() {
                  window.alert('⛔ Sistema em modo SOMENTE LEITURA.\n\n' +
                    'Não foi possível conectar à nuvem (Supabase) na inicialização.\n' +
                    'Pra proteger seus dados, edições estão bloqueadas.\n\n' +
                    '• Recarregue a página (Ctrl+Shift+R)\n' +
                    '• Verifique sua conexão de internet\n' +
                    '• Há um botão "↻ Sync" no canto inferior direito da tela');
                  window._dbReadOnlyAlertShown = false;
                }, 100);
              }
            } catch(_) {}
            return;
          }
          // Felipe sessao 2026-08-02: bloqueio por permissao (defesa em profundidade)
          if (_isPermissaoBlocked(scopeName, k)) {
            console.warn('[Storage] ⛔ Escrita bloqueada (sem permissao):', scopeName, '/', k);
            try {
              if (typeof window !== 'undefined' && window.alert && !window._permissaoAlertShown) {
                window._permissaoAlertShown = true;
                setTimeout(function() {
                  window.alert('🔒 Acesso restrito.\n\n' +
                    'Esta área é só do administrador. Você consegue visualizar mas não editar.\n\n' +
                    'Se precisar alterar algo aqui, peça pro Felipe.');
                  window._permissaoAlertShown = false;
                }, 100);
              }
            } catch(_) {}
            return;
          }
          // Felipe (sessao 2026-05-10): localStorage e' cache opcional, Supabase
          // e' source-of-truth. Quando quota estoura, NAO deve travar o save —
          // segue normalmente pra sbUpsert. Sintoma anterior: nao deixava
          // selecionar chapa em Lev. Superficies pq atualizarVersao -> saveAll
          // -> Storage.set falhava aqui ANTES do sbUpsert rodar.
          //
          // Felipe sessao 32: SEMPRE grava no _memCache primeiro. Garante que
          // get() subsequente acha a chave mesmo se localStorage estiver cheio
          // (caso 'novo lead some apos clicar Montar Orcamento').
          //
          // Felipe sessao 32 (v2): rastreia _dirtyKeys. Sucesso no localStorage
          // -> limpa dirty (memCache e localStorage sincronizados). Falha por
          // quota -> marca dirty (memCache mais novo que localStorage stale).
          const mk = _memKey(scopeName, k);
          _memCache.set(mk, value);
          // Felipe s37 (modo Bitrix): chave pesada NAO vai pro disco.
          // Fica em RAM nesta sessao e no Supabase pra sempre. Evita o
          // ciclo "tenta gravar 2MB -> estoura quota -> derruba a
          // gravacao do lead junto".
          let _serial = null;
          try { _serial = JSON.stringify(value); } catch (_) { _serial = null; }
          if (_pesadaDemaisParaLocal(_serial, scopeName, k)) {
            _guardarSoNaMemoria(scopeName, k, value);
          } else {
          try {
            localStorage.setItem(PREFIX + scopeName + ':' + k, _serial !== null ? _serial : JSON.stringify(value));
            _dirtyKeys.delete(mk);
          } catch (lsErr) {
            if (lsErr && (lsErr.name === 'QuotaExceededError' || /quota/i.test(lsErr.message || ''))) {
              // Felipe sessao 32: tenta liberar espaco automaticamente
              // (backup_diario, forensics) e refaz setItem. Se conseguir,
              // sai limpo. Se nao, marca dirty.
              const liberadas = _tentarLiberarEspaco();
              let recuperou = false;
              if (liberadas > 0) {
                try {
                  localStorage.setItem(PREFIX + scopeName + ':' + k, JSON.stringify(value));
                  _dirtyKeys.delete(mk);
                  recuperou = true;
                } catch (_) { /* ainda nao coube */ }
              }
              if (!recuperou) {
                _dirtyKeys.add(mk);
                console.warn('[Storage] localStorage quota cheia — chave servida da RAM. Supabase permanece source-of-truth.', scopeName + '/' + k);
                // Felipe s37: o BANNER VERMELHO na tela foi REMOVIDO.
                // Ele existia porque dado de negocio morava no disco e a
                // falha de quota significava "voce esta vendo dado velho".
                // Agora dado de negocio nunca vai pro disco (RAM+Supabase),
                // entao chegar aqui so' pode ser chave LOCAL pequena
                // (sessao/preferencia) — nao ha' risco de dado velho em tela
                // e nao ha' nada que o usuario possa fazer a respeito.
                // Assustar o usuario com banner sem acao possivel e' pior
                // que registrar no console pro Felipe ver se precisar.
              }
            } else {
              console.warn('[Storage] localStorage.setItem falhou (nao-quota):', lsErr);
            }
          }
          }  // fim do else (chave leve -> cacheia em disco)
          // Sync pro Supabase em background (via Database sbUpsert interno)
          // Felipe (sessao 18): registra timestamp local ANTES do upsert
          // pra ativar protecao anti-stale (evita realtime polling
          // sobrescrever delete recente com versao antiga do server).
          if (typeof Database !== 'undefined') {
            if (Database._registrarWriteLocal) {
              try { Database._registrarWriteLocal(scopeName, k); } catch(_) {}
            }
            if (Database._sbUpsert) {
              try { Database._sbUpsert(scopeName, k, value); } catch(_) {}
            }
          }
          Events.emit('db:change', { scope: scopeName, key: k, value });
        },
        remove(k) {
          if (_isReadOnlyBlocked(scopeName, k)) {
            console.warn('[Storage] ⛔ Remove bloqueado (read-only):', scopeName, '/', k);
            return;
          }
          if (_isPermissaoBlocked(scopeName, k)) {
            console.warn('[Storage] ⛔ Remove bloqueado (sem permissao):', scopeName, '/', k);
            return;
          }
          // Felipe sessao 32: limpa cache em memoria + dirty state tambem
          const mk = _memKey(scopeName, k);
          _memCache.delete(mk);
          _dirtyKeys.delete(mk);
          localStorage.removeItem(PREFIX + scopeName + ':' + k);
          Events.emit('db:change', { scope: scopeName, key: k, value: null });
        },
      };
    },
  };
})();

if (typeof window !== 'undefined') window.Storage = Storage;
