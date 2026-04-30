/* ============================================================================
 * js/138-proposta-live-update.js  —  NOVO (28-abr-2026)
 *
 * Felipe 28/04: ao desmarcar alisar (ou mudar fechadura digital, cilindro, etc.)
 * dentro de uma revisao, a aba Proposta nao reflete a mudanca em tempo real.
 *
 * SOLUCAO: instalar listener nos campos relevantes do orcamento. Quando mudam,
 * dispara populateProposta() automaticamente, com debounce de 200ms.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta138Applied) return;
  window.__projetta138Applied = true;

  var DEBOUNCE_MS = 200;
  var _timer = null;

  // Lista de IDs cuja mudanca deve refletir na proposta imediatamente
  var IDS_REPOPULAR = [
    'carac-tem-alisar',     // checkbox alisar
    'carac-fech-mec',       // fechadura mecanica
    'carac-fech-dig',       // fechadura digital
    'carac-cilindro',       // cilindro
    'carac-puxador',        // puxador
    'carac-pux-tam',        // tamanho puxador
    'carac-cor-ext',        // cor externa
    'carac-cor-int',        // cor interna
    'carac-modelo',         // modelo
    'carac-abertura',       // tipo de abertura
    'carac-folhas',         // folhas
    'altura',               // altura
    'largura',              // largura
    'qtd-portas'            // quantidade
  ];

  function refreshProposta(){
    if(_timer) clearTimeout(_timer);
    _timer = setTimeout(function(){
      try {
        if(typeof window.populateProposta === 'function'){
          window.populateProposta();
        } else if(typeof populateProposta === 'function'){
          populateProposta();
        }
      } catch(e){ console.warn('[138] erro ao repopular proposta:', e); }
    }, DEBOUNCE_MS);
  }

  function attachListener(id){
    var el = document.getElementById(id);
    if(!el || el.__138Hooked) return false;
    el.__138Hooked = true;
    var ev = (el.type === 'checkbox' || el.type === 'radio') ? 'change'
           : (el.tagName === 'SELECT')                       ? 'change'
           :                                                    'input';
    el.addEventListener(ev, refreshProposta);
    el.addEventListener('change', refreshProposta);
    return true;
  }

  function attachAll(){
    IDS_REPOPULAR.forEach(attachListener);
  }

  function init(){
    attachAll();
    // Re-attach se DOM recriou (ex: trocar de revisao)
    var mo = new MutationObserver(function(muts){
      // Reagir apenas se algum dos IDs apareceu/sumiu
      var precisaReatachar = false;
      muts.forEach(function(m){
        if(m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0){
          precisaReatachar = true;
        }
      });
      if(precisaReatachar) attachAll();
    });
    if(document.body) mo.observe(document.body, { childList: true, subtree: true });
    console.log('[138-proposta-live-update] listeners instalados em', IDS_REPOPULAR.length, 'campos');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
