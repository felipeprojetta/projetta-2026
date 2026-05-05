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
            // Retorna silenciosamente - nao quebra fluxos legacy de seed
            return;
          }
          localStorage.setItem(PREFIX + scopeName + ':' + k, JSON.stringify(value));
          // Sync pro Supabase em background (via Database sbUpsert interno)
          if (typeof Database !== 'undefined' && Database._sbUpsert) {
            try { Database._sbUpsert(scopeName, k, value); } catch(_) {}
          }
          Events.emit('db:change', { scope: scopeName, key: k, value });
        },
        remove(k) {
          if (_isReadOnlyBlocked(scopeName, k)) {
            console.warn('[Storage] ⛔ Remove bloqueado (read-only):', scopeName, '/', k);
            return;
          }
          localStorage.removeItem(PREFIX + scopeName + ':' + k);
          Events.emit('db:change', { scope: scopeName, key: k, value: null });
        },
      };
    },
  };
})();
