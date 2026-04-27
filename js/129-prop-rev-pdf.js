(() => {
  if (window.__MOD_129_LOADED) return;
  window.__MOD_129_LOADED = true;

  function setPropRev(versao) {
    var revEl = document.getElementById('prop-rev');
    if (!revEl) return false;
    if (revEl.textContent !== String(versao)) {
      revEl.textContent = String(versao);
      console.log('[mod 129] prop-rev = V' + versao);
    }
    return true;
  }

  // Estrategia 1: Hook em window.downloadProposta. baseNome eh tipo
  //   "AGP004616 - 146149 - Rubiela E Alessandro - V2 - Proposta Comercial"
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

  // Tenta fazer o hook a cada 500ms ate window.downloadProposta existir
  var hookTimer = setInterval(function() {
    if (hookDownloadProposta()) clearInterval(hookTimer);
  }, 500);

  // Estrategia 2 (fallback): clique em "Reimprimir" — pega versao da linha
  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest && e.target.closest('button,a');
    if (!btn) return;
    var txt = (btn.textContent || '').trim();
    if (!/reimpr|🖨|imprimir/i.test(txt)) return;

    // Buscar versao na linha (V1, V2, V3...)
    var row = btn.closest('tr,div');
    while (row && row !== document.body) {
      var rowTxt = row.textContent || '';
      var vm = rowTxt.match(/\bV(\d+)\b/);
      if (vm) {
        // Aguardar DOM carregar a proposta e setar
        setTimeout(function(){ setPropRev(vm[1]); }, 300);
        setTimeout(function(){ setPropRev(vm[1]); }, 800);
        setTimeout(function(){ setPropRev(vm[1]); }, 1500);
        return;
      }
      row = row.parentElement;
    }
  }, true);

  console.log('[mod 129] Atualiza prop-rev no PDF/Proposta carregado');
})();
