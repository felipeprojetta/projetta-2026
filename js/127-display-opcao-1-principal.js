(() => {
  if (window.__MOD_127_LOADED) return;
  window.__MOD_127_LOADED = true;

  // ─── HOOK 1: window.prompt — adiciona " - " ao default "Opcao N" ─────────
  var origPrompt = window.prompt;
  window.prompt = function(msg, defaultText) {
    try {
      if (typeof msg === 'string' && /op[cç][aã]o/i.test(msg) &&
          typeof defaultText === 'string' && /^Op[cç]ao \d+$/.test(defaultText)) {
        defaultText = defaultText + ' - ';
      }
    } catch(e) {}
    return origPrompt.call(window, msg, defaultText);
  };

  // ─── HOOK 2: Display — trocar texto "Principal" por "Opcao 1 - Principal" ──
  // Apenas em badges/cells de tabelas que tem AGP (= contexto de pre-orcamento)
  function traduzPrincipal(){
    try {
      var nodes = document.querySelectorAll('span,td,div,b,strong');
      for (var i=0; i<nodes.length; i++) {
        var el = nodes[i];
        if (el.children.length > 0) continue;
        var txt = (el.textContent || '').trim();
        if (txt !== 'Principal') continue;
        var ctx = el.closest('tr,table,div');
        if (!ctx) continue;
        var ctxTxt = (ctx.textContent || '').substring(0, 800);
        if (!/AGP|RASCUNHO|PR[ÉE]-OR[ÇC]AMENTO|VERS[ÃA]O/i.test(ctxTxt)) continue;
        el.textContent = 'Opcao 1 - Principal';
      }
    } catch(e) { console.warn('[mod 127] erro traduz:', e); }
  }

  var pendingTimer = null;
  function scheduleTraduz(){
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(traduzPrincipal, 200);
  }

  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(scheduleTraduz).observe(document.body, { childList: true, subtree: true });
  }
  setInterval(traduzPrincipal, 1500);
  traduzPrincipal();

  console.log('[mod 127] cosmetico — Principal->Opcao 1 - Principal + prompt nova opcao com traco');
})();
