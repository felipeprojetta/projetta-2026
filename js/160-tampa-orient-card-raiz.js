/* ============================================================================
 * js/160-tampa-orient-card-raiz.js  —  (28-abr-2026)
 *
 * Felipe 28/04: "raiz e o card o que coloco card leva para levantamento de
 * superficies". Mover seletor Sentido das Tampas (Vertical/Horizontal) para
 * dentro do card (Itens do Pedido) e sincronizar com o Planificador.
 *
 * Tambem:
 *  - Esconder coluna roxa (#friso-config) para modelos 06 e 16 (so e usada
 *    para friso vertical: dist-borda-friso + largura-friso)
 *
 * ARQUITETURA (Felipe):
 *  Card (Itens do Pedido) = RAIZ
 *    -> Salvar Item Atual (botao verde)
 *    -> Levantamento de Superficies (Planificador) puxa o orient do card
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta160Applied) return;
  window.__projetta160Applied = true;

  function $(id){ return document.getElementById(id); }
  var DEFAULT_ORIENT = 'vertical';

  /* ════════════════════════════════════════════════════════════════════════
   * FIX A — Esconder coluna roxa #friso-config para modelos 06 e 16
   * ════════════════════════════════════════════════════════════════════════ */
  function ajustarFrisoConfigPorModelo(){
    var el = $('friso-config'); if(!el) return;
    var modSel = $('carac-modelo');
    var mod = modSel ? (modSel.value || '') : '';
    var ehHoriz = (mod === '06' || mod === '16');
    if(ehHoriz){
      el.style.display = 'none';
    }
    // Para outros modelos: NAO mexer (deixar onModeloChange original cuidar)
  }
  // Hook em onModeloChange para sempre esconder em 06/16
  function hookOnModeloChange(){
    var orig = window.onModeloChange;
    if(typeof orig !== 'function'){ setTimeout(hookOnModeloChange, 400); return; }
    if(orig.__sub160Hooked) return;
    window.onModeloChange = function(){
      var r = orig.apply(this, arguments);
      try { ajustarFrisoConfigPorModelo(); } catch(e){}
      return r;
    };
    window.onModeloChange.__sub160Hooked = true;
    console.log('[160] onModeloChange hooked');
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX B — Inserir select "Sentido das Tampas" no card (Itens do Pedido)
   *   Quando aparece um item com pre+'friso_h_qty' (modelo 06/16), adiciona
   *   o select logo apos os campos de quantidade/espessura.
   *
   *   Persistencia: window._tampaOrientByItem[idx] = 'vertical' | 'horizontal'
   *   Backup tambem em item.tampa_orient quando salvar.
   * ════════════════════════════════════════════════════════════════════════ */
  if(!window._tampaOrientByItem) window._tampaOrientByItem = {};

  function buildSelectOrient(idxOrPre, currentValue){
    var wrap = document.createElement('div');
    wrap.className = 'crm-field tampa-orient-field';
    wrap.style.cssText = 'flex:1 0 100%;margin-top:6px;background:#fff8e1;border:1.5px solid #ff9800;border-radius:6px;padding:8px 10px';
    wrap.innerHTML =
      '<label style="font-size:11px;font-weight:700;color:#e65100;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:4px">↻ Sentido das Tampas</label>' +
      '<select id="' + idxOrPre + 'tampa_orient" style="width:100%;padding:5px 8px;border:1.5px solid #ff9800;border-radius:6px;font-size:13px;background:#fff;color:#e65100;font-weight:700;outline:none">' +
        '<option value="vertical"' + (currentValue==='vertical'?' selected':'') + '>↕ Vertical (padrão)</option>' +
        '<option value="horizontal"' + (currentValue==='horizontal'?' selected':'') + '>↔ Horizontal (L↔H invertido)</option>' +
      '</select>';
    return wrap;
  }

  function instalarSelectsItens(){
    // Cada item tem id = pre + 'friso_h_qty' onde pre = 'i' + idx + '_' (ou similar)
    var inputsQty = document.querySelectorAll('input[id$="friso_h_qty"]');
    inputsQty.forEach(function(inp){
      var fullId = inp.id; // ex: "i0_friso_h_qty"
      var pre = fullId.substring(0, fullId.length - 'friso_h_qty'.length);
      var orientId = pre + 'tampa_orient';
      if($(orientId)) return; // ja instalado

      // Achar container pai (.crm-row contendo qty + esp)
      var row = inp.closest('.crm-row'); if(!row) return;
      // Idx do item (extrair de pre se possivel)
      var idxMatch = pre.match(/(\d+)/);
      var idx = idxMatch ? parseInt(idxMatch[1]) : 0;

      // Valor atual: lookup memoria + _orcItens
      var current = (window._tampaOrientByItem && window._tampaOrientByItem[idx]) || DEFAULT_ORIENT;
      try {
        var it = (window._orcItens || [])[idx];
        if(it && it.tampa_orient) current = it.tampa_orient;
      } catch(e){}

      // Inserir apos a row
      var sel = buildSelectOrient(pre, current);
      row.insertAdjacentElement('afterend', sel);

      // Listener
      var s = $(orientId);
      if(s){
        s.addEventListener('change', function(){
          var v = s.value || DEFAULT_ORIENT;
          window._tampaOrientByItem[idx] = v;
          // Sincronizar imediatamente com o item (se estiver editando)
          try {
            var it = (window._orcItens || [])[idx];
            if(it) it.tampa_orient = v;
          } catch(e){}
          // Sincronizar com plan-tampa-orient se este card e o item ATIVO
          var planSel = $('plan-tampa-orient');
          if(planSel && idx === (window._orcItemAtual||0)){
            planSel.value = v;
            if(typeof window.planUpd === 'function'){
              try { window.planUpd(); } catch(e){}
            }
          }
          // Trigger osAutoUpdate para refletir no orcamento
          if(typeof window._osAutoUpdate === 'function'){
            try { window._osAutoUpdate(); } catch(e){}
          }
          console.log('[160] tampa_orient item ' + idx + ' = ' + v);
        });
      }
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX C — Persistir tampa_orient quando salvar item (botao verde)
   *   Hook no orcItemSalvarAtual + crmItemSave para gravar no item antes do save
   * ════════════════════════════════════════════════════════════════════════ */
  function ensurePersistOnSave(){
    // Persiste no _orcItens[i].tampa_orient ANTES do save real
    function snapshotAllOrients(){
      var inputsQty = document.querySelectorAll('input[id$="friso_h_qty"]');
      inputsQty.forEach(function(inp){
        var fullId = inp.id;
        var pre = fullId.substring(0, fullId.length - 'friso_h_qty'.length);
        var orientEl = $(pre + 'tampa_orient');
        if(!orientEl) return;
        var idxMatch = pre.match(/(\d+)/);
        var idx = idxMatch ? parseInt(idxMatch[1]) : 0;
        var v = orientEl.value || DEFAULT_ORIENT;
        window._tampaOrientByItem = window._tampaOrientByItem || {};
        window._tampaOrientByItem[idx] = v;
        try {
          if(window._orcItens && window._orcItens[idx]){
            window._orcItens[idx].tampa_orient = v;
          }
        } catch(e){}
      });
    }
    // Hook orcItemSalvarAtual
    var orig = window.orcItemSalvarAtual;
    if(typeof orig === 'function' && !orig.__sub160Hooked){
      window.orcItemSalvarAtual = function(){
        try { snapshotAllOrients(); } catch(e){}
        return orig.apply(this, arguments);
      };
      window.orcItemSalvarAtual.__sub160Hooked = true;
    }
    // Hook salvarItemAtualComBanco (botao verde - js/71)
    var orig2 = window.salvarItemAtualComBanco;
    if(typeof orig2 === 'function' && !orig2.__sub160Hooked){
      window.salvarItemAtualComBanco = function(){
        try { snapshotAllOrients(); } catch(e){}
        return orig2.apply(this, arguments);
      };
      window.salvarItemAtualComBanco.__sub160Hooked = true;
    }
    if(!orig || !orig2) setTimeout(ensurePersistOnSave, 600);
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX D — Quando carregar/abrir card, sincroniza tampa_orient para plan
   * ════════════════════════════════════════════════════════════════════════ */
  function syncCardToPlan(){
    var planSel = $('plan-tampa-orient');
    if(!planSel) return;
    var idx = window._orcItemAtual || 0;
    var v = DEFAULT_ORIENT;
    try {
      if(window._orcItens && window._orcItens[idx] && window._orcItens[idx].tampa_orient){
        v = window._orcItens[idx].tampa_orient;
      } else if(window._tampaOrientByItem && window._tampaOrientByItem[idx]){
        v = window._tampaOrientByItem[idx];
      }
    } catch(e){}
    if(planSel.value !== v){
      planSel.value = v;
      if(typeof window.planUpd === 'function'){
        try { window.planUpd(); } catch(e){}
      }
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
   * INIT — MutationObserver para detectar inserção de items dinamicamente
   * ════════════════════════════════════════════════════════════════════════ */
  function init(){
    setTimeout(function(){
      ajustarFrisoConfigPorModelo();
      hookOnModeloChange();
      ensurePersistOnSave();
      instalarSelectsItens();
      syncCardToPlan();
    }, 800);

    // Reagir a mudanças do DOM (modal CRM abre, itens são re-renderizados)
    if(typeof MutationObserver !== 'undefined'){
      var debounceTimer = null;
      var mo = new MutationObserver(function(muts){
        var precisa = false;
        for(var i = 0; i < muts.length && !precisa; i++){
          var added = muts[i].addedNodes;
          for(var j = 0; j < added.length; j++){
            var n = added[j];
            if(n.nodeType !== 1) continue;
            // Se tem input com friso_h_qty dentro, instalar
            try {
              if(n.querySelector && n.querySelector('input[id$="friso_h_qty"]')){
                precisa = true; break;
              }
            } catch(e){}
          }
        }
        if(precisa){
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(function(){
            try {
              instalarSelectsItens();
              ajustarFrisoConfigPorModelo();
            } catch(e){}
          }, 150);
        }
      });
      if(document.body) mo.observe(document.body, { childList: true, subtree: true });
    }

    // Reforço periódico
    setInterval(function(){
      try {
        ajustarFrisoConfigPorModelo();
        instalarSelectsItens();
      } catch(e){}
    }, 2500);

    console.log('[160-tampa-orient-card-raiz] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
