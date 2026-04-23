/* ═══════════════════════════════════════════════════════════════════════════
   MODULE 39: CAIXA AUTO — Dimensoes da caixa de madeira fumigada automaticas
   ═══════════════════════════════════════════════════════════════════════════
   Felipe 24/04/2026

   Regras (Felipe):
     altura_caixa    = largura_vao + 100 + 250 = largura_vao + 350
     largura_caixa   = altura_vao + 250              (nomenclatura Felipe: "comprimento")
     espessura_caixa = 600 se apenas 1 item, 0 se mais itens

   Fonte das dimensoes do vao:
     1) window._orcItens (se populado) — usa MAX de cada dimensao
     2) Fallback: campos #largura / #altura / #qtd-portas do card principal

   Campos afetados (todos readonly, visual bege):
     #crm-o-cif-caixa-a = altura   (mm)
     #crm-o-cif-caixa-l = largura  (mm)
     #crm-o-cif-caixa-e = espessura (mm)

   Recalculo disparado em:
     - Input em #largura / #altura / #qtd-portas / #folhas-porta
     - crmIncotermChange (monkey-patched)
     - crmFazerOrcamento (monkey-patched) com delay de 500ms
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

function $(id){ return document.getElementById(id); }
function num(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; }

function hasFixoMarked(){
  var el = document.getElementById('tem-fixo');
  return !!(el && el.checked);
}

function hasRevestimentoVisible(){
  var el = document.getElementById('card-carac-revestimento');
  if(!el) return false;
  try {
    var cs = window.getComputedStyle(el).display;
    return cs && cs !== 'none';
  } catch(e){ return false; }
}

function crmCaixaAutoCalc(){
  // 1) Tentar _orcItens primeiro
  var items = Array.isArray(window._orcItens) ? window._orcItens : [];
  var validItems = items.filter(function(it){
    return it && num(it.largura) > 0 && num(it.altura) > 0;
  });

  var maxLargura = 0, maxAltura = 0, qtdItens = 0;
  if(validItems.length > 0){
    validItems.forEach(function(it){
      var l = num(it.largura), a = num(it.altura);
      if(l > maxLargura) maxLargura = l;
      if(a > maxAltura) maxAltura = a;
      qtdItens++;
    });
  } else {
    // 2) Fallback: campos principais do card
    maxLargura = num(($('largura')||{value:0}).value);
    maxAltura = num(($('altura')||{value:0}).value);
    var qtdEl = $('qtd-portas');
    qtdItens = qtdEl ? (parseInt(qtdEl.value,10) || 0) : 0;
    if(qtdItens === 0 && maxLargura > 0 && maxAltura > 0) qtdItens = 1;
  }

  if(qtdItens === 0 || maxLargura <= 0 || maxAltura <= 0) return false;

  function roundUp50(x){ return Math.ceil(x / 50) * 50; }

  // Altura e comprimento (largura da caixa) sempre auto, arredondados em 50
  var caixaAltura     = roundUp50(maxLargura + 350);   // largura_vao + 100 + 250
  var caixaComprimento = roundUp50(maxAltura + 250);   // altura_vao  + 250

  // Espessura: so 600 automatico se:
  //   - apenas 1 item
  //   - NAO tem fixo marcado
  //   - NAO tem revestimento visivel
  // Em qualquer outro caso: manual (user digita)
  var temFixo = hasFixoMarked();
  var temRev  = hasRevestimentoVisible();
  var espessuraAuto = (qtdItens === 1) && !temFixo && !temRev;

  var elA = $('crm-o-cif-caixa-a');
  var elL = $('crm-o-cif-caixa-l');
  var elE = $('crm-o-cif-caixa-e');
  var changed = false;

  if(elA && elA.value !== String(caixaAltura))      { elA.value = caixaAltura;      changed = true; }
  if(elL && elL.value !== String(caixaComprimento)){ elL.value = caixaComprimento;  changed = true; }

  if(elE){
    if(espessuraAuto){
      // Modo AUTO: forca 600, readonly, bege
      if(elE.value !== '600'){ elE.value = '600'; changed = true; }
      elE.readOnly = true;
      elE.style.background = '#fffaf3';
      elE.style.color = '#555';
      elE.style.borderStyle = 'dashed';
      elE.style.borderColor = '';
      elE.style.fontWeight = '';
      elE.style.cursor = 'not-allowed';
      elE.placeholder = '600';
      elE.title = 'Auto: 600 para 1 item unico sem fixo e sem revestimento';
      elE._caixaMode = 'auto';
    } else {
      // Modo MANUAL: editavel, borda laranja, alerta visual
      // Transicao auto→manual: se tinha 600 (auto), limpar pra user digitar
      if(elE._caixaMode !== 'manual'){
        if(elE.value === '600' || elE.value === '0') { elE.value = ''; changed = true; }
        elE._caixaMode = 'manual';
      }
      elE.readOnly = false;
      elE.style.background = '#fff8ec';
      elE.style.color = '#c47012';
      elE.style.borderStyle = 'solid';
      elE.style.borderColor = '#e67e22';
      elE.style.fontWeight = '700';
      elE.style.cursor = 'text';
      elE.placeholder = 'inserir manual';
      var motivo = [];
      if(qtdItens > 1) motivo.push('mais de 1 item');
      if(temFixo) motivo.push('item com fixo');
      if(temRev)  motivo.push('item com revestimento');
      elE.title = 'Inserir manualmente — ' + motivo.join(', ');
    }
  }

  if(changed && typeof window.crmCifRecalc === 'function'){
    window.crmCifRecalc();
  }
  return changed;
}
window.crmCaixaAutoCalc = crmCaixaAutoCalc;

function markReadonly(){
  // Altura e Comprimento sao SEMPRE readonly (auto-calculados).
  // Espessura e dinamica: estilo/readonly controlados em crmCaixaAutoCalc.
  var ids = ['crm-o-cif-caixa-a','crm-o-cif-caixa-l'];
  var titles = {
    'crm-o-cif-caixa-a': 'Auto: largura do vao + 350, arredondado pra cima em multiplos de 50mm',
    'crm-o-cif-caixa-l': 'Auto: altura do vao + 250, arredondado pra cima em multiplos de 50mm'
  };
  ids.forEach(function(id){
    var el = $(id);
    if(el && !el._caixaAutoMarked){
      el._caixaAutoMarked = true;
      el.readOnly = true;
      el.title = titles[id] || 'Dimensao calculada automaticamente';
      el.style.background = '#fffaf3';
      el.style.color = '#555';
      el.style.cursor = 'not-allowed';
      el.style.borderStyle = 'dashed';
    }
  });
}

function attachInputHooks(){
  var ids = ['largura','altura','qtd-portas','folhas-porta','tem-fixo','carac-modelo'];
  ids.forEach(function(id){
    var el = $(id);
    if(el && !el._caixaAutoHooked){
      el._caixaAutoHooked = true;
      el.addEventListener('input',  function(){ setTimeout(crmCaixaAutoCalc, 30); });
      el.addEventListener('change', function(){ setTimeout(crmCaixaAutoCalc, 30); });
    }
  });

  // Card de revestimento: nao ha evento quando display muda via JS externo,
  // entao usamos MutationObserver no style/attributes pra reagir.
  var revCard = document.getElementById('card-carac-revestimento');
  if(revCard && !revCard._caixaAutoObserved && typeof MutationObserver === 'function'){
    revCard._caixaAutoObserved = true;
    var mo = new MutationObserver(function(){
      setTimeout(crmCaixaAutoCalc, 30);
    });
    mo.observe(revCard, { attributes: true, attributeFilter: ['style','class'] });
  }
}

function patchGlobalFns(){
  // Monkey-patch crmIncotermChange: recalc qdo user muda pra CIF/FOB/DAP
  var origInc = window.crmIncotermChange;
  if(typeof origInc === 'function' && !origInc._caixaPatched){
    window.crmIncotermChange = function(){
      var r = origInc.apply(this, arguments);
      setTimeout(crmCaixaAutoCalc, 50);
      return r;
    };
    window.crmIncotermChange._caixaPatched = true;
  }

  // Monkey-patch crmFazerOrcamento: recalc apos carregar itens do card
  var origFaz = window.crmFazerOrcamento;
  if(typeof origFaz === 'function' && !origFaz._caixaPatched){
    window.crmFazerOrcamento = function(){
      var r = origFaz.apply(this, arguments);
      setTimeout(crmCaixaAutoCalc, 500);
      return r;
    };
    window.crmFazerOrcamento._caixaPatched = true;
  }
}

function init(){
  markReadonly();
  attachInputHooks();

  // Retry patching porque funcoes alvo podem ser carregadas depois
  var tries = 0;
  var timer = setInterval(function(){
    tries++;
    markReadonly();
    attachInputHooks();
    patchGlobalFns();
    var done = (window.crmIncotermChange && window.crmIncotermChange._caixaPatched) &&
               (window.crmFazerOrcamento && window.crmFazerOrcamento._caixaPatched);
    if(done || tries >= 12){
      clearInterval(timer);
      console.log('[caixa-auto] init em ' + tries + ' tentativa(s)');
    }
  }, 500);

  // Tentativa inicial
  setTimeout(crmCaixaAutoCalc, 100);
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
