(() => {
  if (window.__MOD_127_LOADED) return;
  window.__MOD_127_LOADED = true;

  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var SUPA_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';

  // ── PRECOMPUTA PROXIMO NUM DE OPCAO consultando banco ────
  async function precomputarProxOpcao() {
    try {
      var cardId = window._crmOrcCardId;
      if (!cardId) return;
      var url = SUPA_URL + '/rest/v1/pre_orcamentos?card_id=eq.' + encodeURIComponent(cardId) + '&deleted_at=is.null&select=opcao_nome';
      var res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }});
      if (!res.ok) return;
      var data = await res.json();
      var maxN = 1;
      for (var i = 0; i < data.length; i++) {
        var nome = (data[i].opcao_nome || '').toString();
        var m = nome.match(/Op[cç]ao\s*(\d+)/i);
        if (m) {
          var n = parseInt(m[1]);
          if (n > maxN) maxN = n;
        }
      }
      window.__projettaNextOpcaoNum = maxN + 1;
      console.log('[mod 127] proximo num opcao =', window.__projettaNextOpcaoNum);
    } catch(e) { console.warn('[mod 127] erro precompute:', e); }
  }

  // Quando modal de Revisao/Nova Opcao aparecer, precomputa
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++) {
        var mut = muts[i];
        for (var j = 0; j < mut.addedNodes.length; j++) {
          var node = mut.addedNodes[j];
          if (!node || node.nodeType !== 1) continue;
          if (node.id === 'projetta-104-modal' ||
              (node.querySelector && node.querySelector('#projetta-104-modal')) ||
              node.id === 'modal-escolha-opcao-bg') {
            precomputarProxOpcao();
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── HOOK 1: window.prompt — adicionar " - " e usar prox num correto ──
  var origPrompt = window.prompt;
  window.prompt = function(msg, defaultText) {
    try {
      if (typeof msg === 'string' && /op[cç][aã]o/i.test(msg) &&
          typeof defaultText === 'string' && /^Op[cç]ao \d+$/.test(defaultText)) {
        var n = window.__projettaNextOpcaoNum;
        if (!n) {
          var dm = defaultText.match(/\d+/);
          n = dm ? parseInt(dm[0]) : 2;
        }
        defaultText = 'Opcao ' + n + ' - ';
      }
    } catch(e) {}
    return origPrompt.call(window, msg, defaultText);
  };

  // ── HOOK 2: Display "Principal" → "Opcao 1 - Principal" em tabelas
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
    } catch(e) {}
  }
  var pendingT = null;
  function scheduleT(){ if (pendingT) clearTimeout(pendingT); pendingT = setTimeout(traduzPrincipal, 200); }
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(scheduleT).observe(document.body, { childList: true, subtree: true });
  }
  setInterval(traduzPrincipal, 1500);
  traduzPrincipal();

  console.log('[mod 127 v2] cosmetico + precompute prox opcao carregado');
})();
