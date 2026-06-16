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
              || /:.*backup_20\d{2}/.test(k)            // backup_2026*
              || /_backup_sessao\d+/.test(k)            // _backup_sessao13/14
              || /__pre_/.test(k)) {                    // __pre_ezy_color etc
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

  // Felipe sessao 34: LIMPEZA PROATIVA NO BOOT. Em vez de esperar
  // QuotaExceeded acontecer (que ai' o erro chega em ponto critico tipo
  // PKCE verifier do login), limpa o lixo conhecido JA' no carregamento
  // do modulo Storage. Roda silencioso se quota < 80%, ou avisa no console
  // se passou disso.
  (function _limpezaBootProativa() {
    try {
      // Mede quota usada
      var totalBytes = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        totalBytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
      var totalMB = totalBytes / 1024 / 1024;
      // Quota tipica de localStorage e' 5-10MB. Acima de 7MB ja' e' risco.
      var QUOTA_ALVO_MB = 7;
      if (totalMB > QUOTA_ALVO_MB) {
        console.warn('[Storage] 🚨 localStorage usando ' + totalMB.toFixed(2)
          + 'MB (alvo: <' + QUOTA_ALVO_MB + 'MB). Rodando limpeza preventiva...');
        var removidos = _tentarLiberarEspaco();
        if (removidos === 0) {
          console.warn('[Storage] ⚠️ Nada pra limpar, mas espaco apertado. PKCE e outros saves podem falhar.');
        }
      }
    } catch(e) {
      // Boot resiliente - se algo der erro aqui, continua sem limpar
      console.warn('[Storage] limpeza boot falhou (ignorando):', e.message);
    }
  })();

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
    // Felipe sessao 27: aplica mudanca vinda do realtime polling DENTRO do
    // _memCache (e ajusta dirty), em vez de o polling gravar so' no localStorage
    // cru. Garante que Storage.get() devolva o valor remoto recem-sincronizado
    // mesmo quando a chave estava dirty por quota (imagens base64 dos modelos).
    // Bug resolvido: Paula salva 3 versoes, banco tem as 3, Felipe so' via 1.
    _applyRemote(scopeName, k, value) {
      const mk = _memKey(scopeName, k);
      _memCache.set(mk, value);
      try {
        localStorage.setItem(PREFIX + scopeName + ':' + k, JSON.stringify(value));
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
          try {
            localStorage.setItem(PREFIX + scopeName + ':' + k, JSON.stringify(value));
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
                console.warn('[Storage] ⚠️ localStorage quota cheia (mesmo apos cleanup) — usando cache em memoria. Supabase permanece source-of-truth.', scopeName + '/' + k);
              }
            } else {
              console.warn('[Storage] localStorage.setItem falhou (nao-quota):', lsErr);
            }
          }
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
