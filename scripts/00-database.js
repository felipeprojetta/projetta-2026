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
  function sbUpsert(scope, key, value) {
    // Se for array vazio, NAO sobrescreve o cloud
    if (Array.isArray(value) && value.length === 0) return;
    var usuario = '';
    try { usuario = (window.Auth && window.Auth.getUser()) || ''; } catch(_){}
    fetch(SUPABASE_URL + '/rest/v1/kv_store', {
      method: 'POST',
      headers: sbHeaders(true),
      body: JSON.stringify({
        scope: scope,
        key: key,
        valor: value,
        updated_by: String(usuario),
      }),
    }).catch(function(e) {
      console.warn('[DB] Supabase upsert falhou (dados locais OK):', e.message);
    });
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
      rows.forEach(function(r) {
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

  // Envia TUDO do localStorage → Supabase (backup completo)
  // PROTECAO: NUNCA envia arrays vazios — evita sobrescrever dados reais no cloud.
  async function syncToCloud() {
    try {
      var rows = [];
      var usuario = '';
      try { usuario = (window.Auth && window.Auth.getUser()) || ''; } catch(_){}
      for (var i = 0; i < localStorage.length; i++) {
        var lsKey = localStorage.key(i);
        if (!lsKey || !lsKey.startsWith(PREFIX)) continue;
        var rest = lsKey.slice(PREFIX.length);
        var dotPos = rest.indexOf(':');
        if (dotPos < 0) continue;
        var scope = rest.slice(0, dotPos);
        var key = rest.slice(dotPos + 1);
        try {
          var valor = JSON.parse(localStorage.getItem(lsKey));
          // PROTECAO: nao enviar arrays vazios pro cloud (evita apagar dados)
          if (Array.isArray(valor) && valor.length === 0) continue;
          rows.push({ scope: scope, key: key, valor: valor, updated_by: usuario });
        } catch(_) {}
      }
      if (!rows.length) return true;
      // Upsert em batch (max 500 por chamada)
      for (var batch = 0; batch < rows.length; batch += 500) {
        var chunk = rows.slice(batch, batch + 500);
        await fetch(SUPABASE_URL + '/rest/v1/kv_store', {
          method: 'POST',
          headers: sbHeaders(true),
          body: JSON.stringify(chunk),
        });
      }
      console.log('[DB] syncToCloud: ' + rows.length + ' chaves enviadas pro Supabase');
      return true;
    } catch(e) {
      console.warn('[DB] syncToCloud falhou:', e.message);
      return false;
    }
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

      // Felipe sessao 2026-08-02: defesa por permissao
      if (scope === 'cadastros' && typeof Auth !== 'undefined' && Auth.can && !Auth.can('cadastros:editar')) {
        var SAFE_CADASTROS_KEYS = [
          'acessorios_seeded', 'modelos_seeded', 'perfis_seeded',
          'superficies_seeded', 'representantes_seeded', 'cores_seeded',
        ];
        if (SAFE_CADASTROS_KEYS.indexOf(key) < 0) {
          console.warn('[DB] ⛔ Escrita em cadastros bloqueada (sem permissao):', key);
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
          return value;
        }
      }

      localStorage.setItem(PREFIX + scope + ':' + key, JSON.stringify(value));
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
    }, 5000);  // Felipe: 5s pra parecer 'tempo real'

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

  return {
    driver: function() { return driver.type; },
    scope: scope,
    syncFromCloud: syncFromCloud,
    syncToCloud: syncToCloud,
    _sbUpsert: sbUpsert,
    startRealtime: startRealtime,
    stopRealtime: stopRealtime,
    SUPABASE_URL: SUPABASE_URL,
    // Felipe sessao 2026-08-02: protecao anti-perda
    isReadOnly: isReadOnly,
    getSyncStatus: getSyncStatus,
    onSyncStatusChange: onSyncStatusChange,
  };
})();
