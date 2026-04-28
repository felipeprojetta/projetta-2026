/* ============================================================================
 * js/160-tampa-orient-card-raiz.js  —  v2 (28-abr-2026)
 *
 * Felipe 28/04: "raiz e o card o que coloco card leva para levantamento de
 * superficies"
 *
 * O CARD (modal CRM "Itens do Pedido") usa prefixo de ID:
 *   pre = 'crmit-' + item.id + '-'
 * Ex: 'crmit-ci_1777411023_x4f2-friso_h_qty'
 *
 * Estrategia:
 *  - Detectar input cujo id MATCH /^crmit-(ci_.+)-friso_h_qty$/ (modelo 06/16)
 *  - Inserir select "Sentido das Tampas" depois da row qty/esp
 *  - Persistir em item.tampa_orient direto no window._crmItens
 *  - Hook em _crmItensSaveFromDOM para incluir tampa_orient (igual ao tem_alisar)
 *  - Sincronizar item ATIVO -> #plan-tampa-orient
 *  - Esconder coluna roxa #friso-config para modelos 06 e 16
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta160V2Applied) return;
  window.__projetta160V2Applied = true;

  function $(id){ return document.getElementById(id); }
  var DEFAULT_ORIENT = 'vertical';
  var ID_RE = /^crmit-(ci_[A-Za-z0-9_]+)-friso_h_qty$/;

  /* ════════════════════════════════════════════════════════════════════════
   * FIX A — Esconder coluna roxa #friso-config para modelos 06 e 16
   * ════════════════════════════════════════════════════════════════════════ */
  function ajustarFrisoConfigPorModelo(){
    var el = $('friso-config'); if(!el) return;
    var modSel = $('carac-modelo');
    var mod = modSel ? (modSel.value || '') : '';
    if(mod === '06' || mod === '16'){
      el.style.display = 'none';
    }
  }
  function hookOnModeloChange(){
    var orig = window.onModeloChange;
    if(typeof orig !== 'function'){ setTimeout(hookOnModeloChange, 400); return; }
    if(orig.__sub160V2Hooked) return;
    window.onModeloChange = function(){
      var r = orig.apply(this, arguments);
      try { ajustarFrisoConfigPorModelo(); } catch(e){}
      return r;
    };
    window.onModeloChange.__sub160V2Hooked = true;
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX B — Inserir select "Sentido das Tampas" no item do card CRM
   * ════════════════════════════════════════════════════════════════════════ */
  function buildSelectOrient(itemId, currentValue){
    var wrap = document.createElement('div');
    wrap.className = 'crm-row tampa-orient-row';
    wrap.setAttribute('data-tampa-orient', '1');
    wrap.style.cssText = 'background:#fff8e1;border:1.5px solid #ff9800;border-radius:6px;padding:8px 10px;margin:6px 0';
    wrap.innerHTML =
      '<div class="crm-field" style="flex:1">' +
        '<label style="font-size:11px;font-weight:700;color:#e65100;text-transform:uppercase;letter-spacing:.04em">↻ Sentido das Tampas <small style="color:#888;font-weight:500;text-transform:none">(planificador)</small></label>' +
        '<select id="crmit-' + itemId + '-tampa_orient" style="width:100%;padding:6px 8px;border:1.5px solid #ff9800;border-radius:6px;font-size:13px;background:#fff;color:#e65100;font-weight:700;outline:none">' +
          '<option value="vertical"' + (currentValue==='vertical'?' selected':'') + '>↕ Vertical (padrão — altura na vertical)</option>' +
          '<option value="horizontal"' + (currentValue==='horizontal'?' selected':'') + '>↔ Horizontal (deita na chapa — economiza espaço)</option>' +
        '</select>' +
      '</div>';
    return wrap;
  }

  function getItemById(itemId){
    if(!window._crmItens) return null;
    for(var i = 0; i < window._crmItens.length; i++){
      if(window._crmItens[i] && window._crmItens[i].id === itemId) return window._crmItens[i];
    }
    return null;
  }

  function instalarSelectsItens(){
    // Busca todos inputs friso_h_qty do CRM modal
    var inputsQty = document.querySelectorAll('input[id^="crmit-"][id$="-friso_h_qty"]');
    inputsQty.forEach(function(inp){
      var m = inp.id.match(ID_RE);
      if(!m) return;
      var itemId = m[1];
      var orientId = 'crmit-' + itemId + '-tampa_orient';
      if($(orientId)) return; // ja instalado

      // Achar container pai (.crm-row contendo qty + esp)
      var row = inp.closest('.crm-row'); if(!row) return;
      // Verificar se a row está visivel (display nao none) — modelo 06/16 ativa
      var wrap = row.parentElement;
      var hidden = false;
      if(row.style.display === 'none' || (wrap && wrap.style.display === 'none')){
        hidden = true;
      }
      if(hidden) return;

      // Valor atual: lookup no _crmItens
      var item = getItemById(itemId);
      var current = (item && item.tampa_orient) || DEFAULT_ORIENT;

      // Inserir apos a row
      var sel = buildSelectOrient(itemId, current);
      row.insertAdjacentElement('afterend', sel);

      // Listener
      var s = $(orientId);
      if(s){
        s.addEventListener('change', function(){
          var v = s.value || DEFAULT_ORIENT;
          // Persistir no item
          var it = getItemById(itemId);
          if(it) it.tampa_orient = v;
          // Atualizar _orcItens correspondente (se aberto no orçamento)
          try {
            if(window._orcItens){
              for(var i = 0; i < window._orcItens.length; i++){
                if(window._orcItens[i] && window._orcItens[i].id === itemId){
                  window._orcItens[i].tampa_orient = v;
                  // Se este e o item ATIVO, atualizar plan-tampa-orient
                  if(i === window._orcItemAtual){
                    var planSel = $('plan-tampa-orient');
                    if(planSel){
                      planSel.value = v;
                      if(typeof window.planUpd === 'function'){
                        try { window.planUpd(); } catch(e){}
                      }
                    }
                  }
                  break;
                }
              }
            }
          } catch(e){}
          console.log('[160-v2] tampa_orient ' + itemId + ' = ' + v);
        });
      }
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX C — Hook em _crmItensSaveFromDOM para persistir tampa_orient
   * ════════════════════════════════════════════════════════════════════════ */
  function hookSaveFromDOM(){
    var orig = window._crmItensSaveFromDOM;
    if(typeof orig !== 'function'){ setTimeout(hookSaveFromDOM, 600); return; }
    if(orig.__sub160V2Hooked) return;
    window._crmItensSaveFromDOM = function(){
      var r = orig.apply(this, arguments);
      try {
        // Após o save padrão, ler tampa_orient de cada item e persistir
        if(window._crmItens){
          window._crmItens.forEach(function(it){
            if(!it || !it.id) return;
            var sel = $('crmit-' + it.id + '-tampa_orient');
            if(sel) it.tampa_orient = sel.value || DEFAULT_ORIENT;
          });
        }
      } catch(e){ console.warn('[160-v2] saveFromDOM hook err:', e); }
      return r;
    };
    window._crmItensSaveFromDOM.__sub160V2Hooked = true;
    console.log('[160-v2] _crmItensSaveFromDOM hooked');
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX D — Hook em orcItemSalvarAtual (botao verde) e syncCardToPlan
   * ════════════════════════════════════════════════════════════════════════ */
  function hookOrcSalvar(){
    var orig = window.orcItemSalvarAtual;
    if(typeof orig === 'function' && !orig.__sub160V2Hooked){
      window.orcItemSalvarAtual = function(){
        try { syncOrcAtualToCRM(); } catch(e){}
        return orig.apply(this, arguments);
      };
      window.orcItemSalvarAtual.__sub160V2Hooked = true;
    }
    var orig2 = window.salvarItemAtualComBanco;
    if(typeof orig2 === 'function' && !orig2.__sub160V2Hooked){
      window.salvarItemAtualComBanco = function(){
        try { syncOrcAtualToCRM(); } catch(e){}
        return orig2.apply(this, arguments);
      };
      window.salvarItemAtualComBanco.__sub160V2Hooked = true;
    }
    if(typeof window.orcItemSalvarAtual !== 'function' || typeof window.salvarItemAtualComBanco !== 'function'){
      setTimeout(hookOrcSalvar, 700);
    }
  }
  // Quando aperta botao verde, copia plan-tampa-orient -> _orcItens[atual] -> _crmItens correspondente
  function syncOrcAtualToCRM(){
    var planSel = $('plan-tampa-orient');
    if(!planSel) return;
    var v = planSel.value || DEFAULT_ORIENT;
    var idx = window._orcItemAtual;
    if(idx == null || idx < 0) return;
    try {
      if(window._orcItens && window._orcItens[idx]){
        window._orcItens[idx].tampa_orient = v;
        var orcId = window._orcItens[idx].id;
        var crmIt = getItemById(orcId);
        if(crmIt) crmIt.tampa_orient = v;
      }
    } catch(e){}
  }

  /* ════════════════════════════════════════════════════════════════════════
   * INIT
   * ════════════════════════════════════════════════════════════════════════ */
  function init(){
    setTimeout(function(){
      ajustarFrisoConfigPorModelo();
      hookOnModeloChange();
      hookSaveFromDOM();
      hookOrcSalvar();
      instalarSelectsItens();
    }, 800);

    if(typeof MutationObserver !== 'undefined'){
      var deb = null;
      var mo = new MutationObserver(function(muts){
        var precisa = false;
        for(var i = 0; i < muts.length && !precisa; i++){
          var added = muts[i].addedNodes;
          for(var j = 0; j < added.length; j++){
            var n = added[j];
            if(n.nodeType !== 1) continue;
            try {
              if(n.id && /crmit-ci_/.test(n.id)) { precisa = true; break; }
              if(n.querySelector && n.querySelector('input[id^="crmit-"][id$="-friso_h_qty"]')){
                precisa = true; break;
              }
            } catch(e){}
          }
        }
        if(precisa){
          clearTimeout(deb);
          deb = setTimeout(function(){
            try { instalarSelectsItens(); ajustarFrisoConfigPorModelo(); } catch(e){}
          }, 120);
        }
      });
      if(document.body) mo.observe(document.body, { childList: true, subtree: true });
    }

    // Reforco periodico
    setInterval(function(){
      try {
        ajustarFrisoConfigPorModelo();
        instalarSelectsItens();
      } catch(e){}
    }, 2500);

    console.log('[160-tampa-orient-card-raiz v2] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
