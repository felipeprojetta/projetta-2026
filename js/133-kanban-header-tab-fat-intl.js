(() => {
  if (window.__MOD_133_LOADED) return;
  window.__MOD_133_LOADED = true;

  // ═══════════════════════════════════════════════════════════════
  // Recalcula headers Tab/Fat das colunas do kanban:
  // - INTERNACIONAL: Tab = Fat = _valorRealCardBRL (porta + caixa + frete×1.2)
  // - NACIONAL: Tab = sum(valorTabela), Fat = sum(_valorRealCardBRL)
  // ═══════════════════════════════════════════════════════════════

  function fmtBRL(n) {
    return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  }

  function ehInternacional(o) {
    if (!o) return false;
    return o.scope === 'internacional'
      || (o.inst_quem||'').toString().toUpperCase() === 'INTERNACIONAL'
      || ['CIF','FOB','EXW'].indexOf((o.inst_incoterm||'').toString().toUpperCase()) >= 0
      || !!(o.pais||'').toString().trim();
  }

  function recalcKanbanHeaders() {
    if (typeof window.cLoad !== 'function') return;
    if (typeof window._valorRealCardBRL !== 'function') return;

    var data;
    try { data = window.cLoad(); } catch(e){ return; }
    if (!Array.isArray(data)) return;

    var stages = document.querySelectorAll('.crm-stage');
    if (!stages.length) return;

    stages.forEach(function(stage){
      var stageId = stage.getAttribute('data-stage');
      if (!stageId) return;
      var cards = data.filter(function(o){ return o && o.stage === stageId && !o.deleted_at; });

      var tv = 0, tvTab = 0;
      cards.forEach(function(o){
        try {
          var realBRL = window._valorRealCardBRL(o) || 0;
          tv += realBRL;
          if (ehInternacional(o)) {
            // ★ Felipe: Internacional → Tab = Fat = Total (sem markup/desconto)
            tvTab += realBRL;
          } else {
            tvTab += parseFloat(o.valorTabela) || 0;
          }
        } catch(e){}
      });

      var header = stage.querySelector('.crm-stage-header');
      if (!header) return;
      var vals = header.querySelectorAll('.crm-stage-val');
      vals.forEach(function(el){
        var t = (el.textContent || '').trim();
        if (/^Tab:/i.test(t)) {
          var novoTab = tvTab > 0 ? 'Tab: ' + fmtBRL(tvTab) : '';
          if (el.textContent !== novoTab) el.textContent = novoTab;
        } else if (/^Fat:/i.test(t)) {
          var novoFat = tv > 0 ? 'Fat: ' + fmtBRL(tv) : '';
          if (el.textContent !== novoFat) el.textContent = novoFat;
        }
      });
    });
  }

  // Hook em crmRender pra disparar apos cada render
  function hookCrmRender() {
    if (typeof window.crmRender !== 'function') return false;
    if (window.crmRender.__mod133) return true;
    var orig = window.crmRender;
    window.crmRender = function() {
      var ret = orig.apply(this, arguments);
      setTimeout(recalcKanbanHeaders, 50);
      setTimeout(recalcKanbanHeaders, 300);
      return ret;
    };
    window.crmRender.__mod133 = true;
    console.log('[mod 133] crmRender hooked');
    return true;
  }

  // Polling pra garantir hook + render
  setInterval(function(){
    hookCrmRender();
    recalcKanbanHeaders();
  }, 1500);

  // Re-render quando cambio mudar
  if (window.addEventListener) {
    window.addEventListener('projetta:cambio-changed', function(){
      try { if (typeof window.crmRender === 'function') window.crmRender(); } catch(e){}
      setTimeout(recalcKanbanHeaders, 200);
    });
  }

  // MutationObserver no pipeline pra repatch quando DOM mudar
  function observePipeline() {
    var pipe = document.getElementById('crm-pipeline');
    if (!pipe) { setTimeout(observePipeline, 500); return; }
    var pendingT = null;
    new MutationObserver(function(){
      if (pendingT) clearTimeout(pendingT);
      pendingT = setTimeout(recalcKanbanHeaders, 100);
    }).observe(pipe, { childList: true, subtree: true });
    console.log('[mod 133] pipeline observer ativo');
  }
  observePipeline();

  setTimeout(recalcKanbanHeaders, 800);
  setTimeout(recalcKanbanHeaders, 2500);

  console.log('[mod 133] carregado — Tab/Fat header: internacional Tab=Fat=Total');
})();
