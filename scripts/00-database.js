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
  function sbUpsert(scope, key, value) {
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
  async function syncFromCloud() {
    try {
      var res = await fetch(SUPABASE_URL + '/rest/v1/kv_store?select=scope,key,valor&order=scope,key', {
        headers: sbHeaders(false),
      });
      if (!res.ok) {
        console.warn('[DB] syncFromCloud HTTP', res.status);
        return false;
      }
      var rows = await res.json();
      if (!Array.isArray(rows)) return false;
      var count = 0;
      rows.forEach(function(r) {
        var lsKey = PREFIX + r.scope + ':' + r.key;
        try {
          // NAO sobrescreve dados locais com arrays vazios do Supabase.
          // Isso evita perder leads/dados que ainda nao foram syncados.
          var valorSb = r.valor;
          if (Array.isArray(valorSb) && valorSb.length === 0) {
            var localRaw = localStorage.getItem(lsKey);
            if (localRaw !== null) {
              try {
                var localVal = JSON.parse(localRaw);
                if (Array.isArray(localVal) && localVal.length > 0) {
                  // Local tem dados, Supabase vazio — preserva local
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
      return true;
    } catch(e) {
      console.warn('[DB] syncFromCloud falhou (modo offline):', e.message);
      return false;
    }
  }

  // Envia TUDO do localStorage → Supabase (backup completo)
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
      localStorage.setItem(PREFIX + scope + ':' + key, JSON.stringify(value));
      // Sync pro Supabase em background (nao bloqueia)
      sbUpsert(scope, key, value);
      // Emite evento local
      Events.emit('db:change', { scope: scope, key: key, value: value });
      return value;
    },

    remove: function(scope, key) {
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

  // Realtime via polling: verifica mudancas no Supabase a cada 10s.
  // Se encontrar dados mais novos, atualiza localStorage e emite eventos.
  var _lastSync = null;
  var _realtimeTimer = null;

  function startRealtime() {
    if (_realtimeTimer) return;
    _lastSync = new Date().toISOString();
    _realtimeTimer = setInterval(async function() {
      try {
        var url = SUPABASE_URL + '/rest/v1/kv_store?select=scope,key,valor,updated_at&order=updated_at.desc&limit=50';
        if (_lastSync) {
          url += '&updated_at=gt.' + encodeURIComponent(_lastSync);
        }
        var res = await fetch(url, { headers: sbHeaders(false) });
        if (!res.ok) return;
        var rows = await res.json();
        if (!Array.isArray(rows) || rows.length === 0) return;
        var changed = false;
        rows.forEach(function(r) {
          var lsKey = PREFIX + r.scope + ':' + r.key;
          var localRaw = localStorage.getItem(lsKey);
          var remoteVal = JSON.stringify(r.valor);
          if (localRaw !== remoteVal) {
            localStorage.setItem(lsKey, remoteVal);
            Events.emit('db:change', { scope: r.scope, key: r.key, value: r.valor, remote: true });
            changed = true;
          }
        });
        _lastSync = rows[0].updated_at;
        if (changed) {
          console.log('[DB] Realtime: ' + rows.length + ' mudanca(s) do cloud aplicadas');
          Events.emit('db:realtime-sync', { count: rows.length });
        }
      } catch(e) {
        // silencioso — polling nao deve travar o app
      }
    }, 10000);
  }

  function stopRealtime() {
    if (_realtimeTimer) { clearInterval(_realtimeTimer); _realtimeTimer = null; }
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
  };
})();
