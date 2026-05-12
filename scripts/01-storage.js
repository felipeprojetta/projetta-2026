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
    scope(scopeName) {
      return {
        get(k, fallback = null) {
          try {
            const raw = localStorage.getItem(PREFIX + scopeName + ':' + k);
            return raw === null ? fallback : JSON.parse(raw);
          } catch (e) { return fallback; }
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
          try {
            localStorage.setItem(PREFIX + scopeName + ':' + k, JSON.stringify(value));
          } catch (lsErr) {
            if (lsErr && (lsErr.name === 'QuotaExceededError' || /quota/i.test(lsErr.message || ''))) {
              console.warn('[Storage] ⚠️ localStorage quota cheia — pulando cache local. Supabase permanece source-of-truth.', scopeName + '/' + k);
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
          localStorage.removeItem(PREFIX + scopeName + ':' + k);
          Events.emit('db:change', { scope: scopeName, key: k, value: null });
        },
      };
    },
  };
})();

if (typeof window !== 'undefined') window.Storage = Storage;
