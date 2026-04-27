(() => {
  if (window.__MOD_129_LOADED) return;
  window.__MOD_129_LOADED = true;

  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var SUPA_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';

  function setPropRev(versao) {
    var revEl = document.getElementById('prop-rev');
    if (!revEl) return false;
    var v = String(versao);
    if (revEl.textContent !== v) {
      revEl.textContent = v;
      console.log('[mod 129] prop-rev = V' + v);
    }
    return true;
  }

  // ─── ESTRATEGIA A: hook em window.reimprimirVersao
  function hookReimprimirVersao() {
    if (typeof window.reimprimirVersao !== 'function') return false;
    if (window.reimprimirVersao.__mod129Patched) return true;
    var orig = window.reimprimirVersao;
    var wrapped = async function(id) {
      try {
        var url = SUPA_URL + '/rest/v1/versoes_aprovadas?id=eq.' + encodeURIComponent(id) + '&select=versao';
        var res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }});
        if (res.ok) {
          var data = await res.json();
          if (data && data[0] && data[0].versao) {
            window.__projettaCurrentRev = data[0].versao;
            console.log('[mod 129] reimprimirVersao → currentRev = V' + data[0].versao);
          }
        }
      } catch(e) { console.warn('[mod 129] reimp:', e); }
      return orig.apply(this, arguments);
    };
    wrapped.__mod129Patched = true;
    window.reimprimirVersao = wrapped;
    console.log('[mod 129] reimprimirVersao hooked');
    return true;
  }

  // ─── ESTRATEGIA B: hook em window.fetch — quando INSERT versoes_aprovadas, pega versao
  (function hookFetch() {
    var origFetch = window.fetch;
    window.fetch = function(url, opts) {
      try {
        if (typeof url === 'string' &&
            url.indexOf('/rest/v1/versoes_aprovadas') >= 0 &&
            opts && (opts.method === 'POST' || opts.method === 'post') &&
            opts.body) {
          var body = (typeof opts.body === 'string') ? JSON.parse(opts.body) : opts.body;
          if (body && body.versao) {
            window.__projettaCurrentRev = body.versao;
            console.log('[mod 129] INSERT versoes_aprovadas → currentRev = V' + body.versao);
          }
        }
      } catch(e) {}
      return origFetch.apply(this, arguments);
    };
  })();

  // ─── ESTRATEGIA C: hook em populateProposta — depois dela roda, atualiza prop-rev
  function hookPopulateProposta() {
    if (typeof window.populateProposta !== 'function') return false;
    if (window.populateProposta.__mod129Patched) return true;
    var orig = window.populateProposta;
    var wrapped = function() {
      var ret = orig.apply(this, arguments);
      try {
        if (window.__projettaCurrentRev) {
          setPropRev(window.__projettaCurrentRev);
        }
      } catch(e) {}
      return ret;
    };
    wrapped.__mod129Patched = true;
    window.populateProposta = wrapped;
    console.log('[mod 129] populateProposta hooked');
    return true;
  }

  // ─── ESTRATEGIA D: hook em html2canvas — antes de capturar, força prop-rev
  function hookHtml2Canvas() {
    if (typeof window.html2canvas !== 'function') return false;
    if (window.html2canvas.__mod129Patched) return true;
    var orig = window.html2canvas;
    var wrapped = function(el, opts) {
      try {
        if (window.__projettaCurrentRev) setPropRev(window.__projettaCurrentRev);
      } catch(e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__mod129Patched = true;
    try { Object.keys(orig).forEach(function(k){ wrapped[k] = orig[k]; }); } catch(e) {}
    window.html2canvas = wrapped;
    console.log('[mod 129] html2canvas hooked');
    return true;
  }

  // ─── Hooks que dependem de funcoes existirem — tentar a cada 300ms
  var allHooks = setInterval(function() {
    var allDone = hookReimprimirVersao() &&
                  hookPopulateProposta() &&
                  hookHtml2Canvas();
    // Nao paramos enquanto html2canvas nao estiver carregada (ela eh carregada sob demanda)
  }, 300);

  // ─── ESTRATEGIA E (fallback): clique em "Reimprimir" — pega versao do texto
  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest && e.target.closest('button,a');
    if (!btn) return;
    var txt = (btn.textContent || '').trim();
    if (!/reimpr|🖨/i.test(txt)) return;
    var row = btn.closest('tr,div');
    while (row && row !== document.body) {
      var rowTxt = row.textContent || '';
      var vm = rowTxt.match(/\bV(\d+)\b/);
      if (vm) {
        window.__projettaCurrentRev = parseInt(vm[1]);
        console.log('[mod 129] click reimprimir → currentRev = V' + vm[1]);
        return;
      }
      row = row.parentElement;
    }
  }, true);

  console.log('[mod 129 v3] Estrategias A-E ativas');
})();
