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

  // Pega versao ativa do card no banco
  async function getVersaoAtivaCard(cardId) {
    if (!cardId) return null;
    try {
      var url = SUPA_URL + '/rest/v1/versoes_aprovadas?card_id=eq.' + encodeURIComponent(cardId) + '&ativa=eq.true&order=versao.desc&limit=1&select=versao';
      var res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }});
      if (!res.ok) return null;
      var data = await res.json();
      if (data && data[0]) return data[0].versao;
    } catch(e) { console.warn('[mod 129]', e); }
    return null;
  }

  // ── Estrategia 1: hook em window.downloadProposta — extrai V<N> do baseNome
  function hookDownloadProposta() {
    if (typeof window.downloadProposta !== 'function') return false;
    if (window.downloadProposta.__mod129Patched) return true;
    var orig = window.downloadProposta;
    var wrapped = function(baseNome) {
      try {
        var m = (baseNome || '').match(/V(\d+)/i);
        if (m) setPropRev(m[1]);
      } catch(e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__mod129Patched = true;
    window.downloadProposta = wrapped;
    console.log('[mod 129] window.downloadProposta hooked');
    return true;
  }
  var hookT = setInterval(function(){ if (hookDownloadProposta()) clearInterval(hookT); }, 300);

  // ── Estrategia 2: clique em "Reimprimir" — pega versao da linha
  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest && e.target.closest('button,a');
    if (!btn) return;
    var txt = (btn.textContent || '').trim();
    if (!/reimpr|🖨|imprimir/i.test(txt)) return;
    var row = btn.closest('tr,div');
    while (row && row !== document.body) {
      var rowTxt = row.textContent || '';
      var vm = rowTxt.match(/\bV(\d+)\b/);
      if (vm) {
        setTimeout(function(){ setPropRev(vm[1]); }, 300);
        setTimeout(function(){ setPropRev(vm[1]); }, 800);
        setTimeout(function(){ setPropRev(vm[1]); }, 1500);
        return;
      }
      row = row.parentElement;
    }
  }, true);

  // ── Estrategia 3: MutationObserver no prop-agp — quando proposta eh montada,
  //    busca versao ativa do banco e atualiza prop-rev
  function watchPropAgp() {
    var propAgp = document.getElementById('prop-agp');
    if (!propAgp) { setTimeout(watchPropAgp, 500); return; }
    new MutationObserver(async function() {
      var cardId = window._crmOrcCardId;
      if (!cardId) return;
      var ver = await getVersaoAtivaCard(cardId);
      if (ver) setPropRev(ver);
    }).observe(propAgp, { childList: true, characterData: true, subtree: true });
    console.log('[mod 129] watchPropAgp ativo');
  }
  watchPropAgp();

  console.log('[mod 129 v2] Atualiza prop-rev no PDF/Proposta carregado');
})();
