/* ============================================================================
 * js/135-caixa-ctrl-sem-inst.js  —  Modulo NOVO (27-abr-2026)  v2
 *
 * Autorizado por Felipe Xavier de Lima.
 *
 * RESOLVE 2 PROBLEMAS:
 *
 * 1) CAIXA DE MADEIRA (CRM Internacional FOB/CIF):
 *    Substitui polling de 700ms por 3 botoes manuais.
 *
 * 2) INSTALACAO 'SEM' aparecendo no Resultado, Painel Intl e Proposta:
 *    a. Override calcInstIntl() pra retornar 0 quando inst-quem='SEM'
 *    b. Forca window._instIntlFat=0 em ciclo curto
 *    c. Painel "Resultado da Porta": d-custo-inst, d-tab-inst, d-fat-inst → '—'
 *    d. Painel TOTAL INTERNACIONAL: esconde card "Preco Instalacao"
 *       e recalcula totals (so Preco Porta)
 *    e. Proposta: esconde linha INTERNATIONAL INSTALLATION (single + multi)
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta135Applied) return;
  window.__projetta135Applied = true;
  console.log('[135-caixa-ctrl-sem-inst] iniciando v2');

  window._caixaCtrlOverride = true;
  window._crmIntlSemCaixa = false;

  var IDS_CAIXA_DIM = ['crm-o-cif-caixa-a','crm-o-cif-caixa-l','crm-o-cif-caixa-e'];
  var ID_BOX = 'crm-inst-cif-box';
  var ID_BTN_BAR = 'caixa-ctrl-btnbar';

  function $(id){ return document.getElementById(id); }
  function num(v){ var n=parseFloat(v); return isNaN(n)?0:n; }
  function roundUp50(v){ return Math.ceil(v/50)*50; }

  // ─── PARTE 1: CONTROLES DA CAIXA ───────────────────────────────────
  function getItensComMedida(){
    var items = window._crmItens || [];
    return items.filter(function(it){
      if(!it) return false;
      return num(it.largura) > 0 && num(it.altura) > 0;
    });
  }

  function calcAuto(){
    var itens = getItensComMedida();
    if(!itens.length) return null;
    var maxL = 0, maxA = 0;
    itens.forEach(function(i){
      var l = num(i.largura), a = num(i.altura);
      if(l > maxL) maxL = l;
      if(a > maxA) maxA = a;
    });
    return {
      a: roundUp50(maxL + 350),
      l: roundUp50(maxA + 250),
      e: itens.length === 1 ? 600 : 0
    };
  }

  function applyAuto(showAlert){
    var c = calcAuto();
    if(!c){
      if(showAlert) alert('Adicione largura e altura nos itens da porta primeiro.');
      return false;
    }
    window._crmIntlSemCaixa = false;
    var map = { 'crm-o-cif-caixa-a': c.a, 'crm-o-cif-caixa-l': c.l, 'crm-o-cif-caixa-e': c.e };
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = false;
      el.readOnly = true;
      el.value = String(map[id]);
      el.style.background = '#fffaf3';
      el.style.color = '#555';
      el.style.borderStyle = 'dashed';
      el.style.borderColor = '#ff9800';
      el.style.cursor = 'not-allowed';
      el.style.fontWeight = '';
      el.title = '🔓 Auto: '+(id.endsWith('-a')?'maior LARGURA + 350':id.endsWith('-l')?'maior ALTURA + 250':'600 (1 item) ou 0 (multi)')+', arred 50mm';
    });
    if(typeof window.crmCifRecalc === 'function'){ try{ window.crmCifRecalc(); }catch(e){} }
    updateBtnState('auto');
    return true;
  }

  function applyManual(){
    window._crmIntlSemCaixa = false;
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = false;
      el.readOnly = false;
      el.style.background = '#fff8ec';
      el.style.color = '#c47012';
      el.style.borderStyle = 'solid';
      el.style.borderColor = '#e67e22';
      el.style.cursor = 'text';
      el.style.fontWeight = '700';
      el.title = '✏️ Edicao manual';
    });
    var first = $(IDS_CAIXA_DIM[0]);
    if(first) try{ first.focus(); first.select(); }catch(e){}
    updateBtnState('manual');
  }

  function applySemCaixa(){
    window._crmIntlSemCaixa = true;
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = true;
      el.readOnly = true;
      el.value = '0';
      el.style.background = '#f5f5f5';
      el.style.color = '#999';
      el.style.borderStyle = 'dashed';
      el.style.borderColor = '#ccc';
      el.style.cursor = 'not-allowed';
      el.style.fontWeight = '';
      el.title = '🚫 Cliente nao quer caixa de madeira';
    });
    if(typeof window.crmCifRecalc === 'function'){ try{ window.crmCifRecalc(); }catch(e){} }
    updateBtnState('sem');
  }

  function updateBtnState(mode){
    var b1 = $('caixa-btn-auto'), b2 = $('caixa-btn-manual'), b3 = $('caixa-btn-sem');
    [b1,b2,b3].forEach(function(b){
      if(!b) return;
      b.style.fontWeight = '600';
      b.style.opacity = '0.65';
      b.style.boxShadow = 'none';
    });
    var active = mode==='auto'?b1: mode==='manual'?b2: mode==='sem'?b3: null;
    if(active){
      active.style.fontWeight = '800';
      active.style.opacity = '1';
      active.style.boxShadow = '0 2px 6px rgba(0,0,0,.18)';
    }
    var info = $('caixa-ctrl-mode-info');
    if(info){
      info.textContent = mode==='auto'? '🔄 Modo automatico (de Largura×Altura dos itens)'
                       : mode==='manual'? '✏️ Modo manual (campos editaveis)'
                       : mode==='sem'? '🚫 Sem caixa de madeira — linha suprimida na proposta'
                       : '';
      info.style.color = mode==='auto'?'#e65100': mode==='manual'?'#c47012': mode==='sem'?'#777':'#888';
    }
  }

  function injectButtonBar(){
    var box = $(ID_BOX);
    if(!box) return false;
    if($(ID_BTN_BAR)) return true;
    var titleEl = $('crm-cif-box-title');
    if(!titleEl) return false;
    var bar = document.createElement('div');
    bar.id = ID_BTN_BAR;
    bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px;align-items:center';
    bar.innerHTML =
      '<button type="button" id="caixa-btn-auto" '+
        'style="padding:5px 11px;border-radius:6px;border:1.5px solid #ff9800;background:#fff;color:#e65100;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit" '+
        'title="Recalcula automaticamente">🔄 Atualizar</button>'+
      '<button type="button" id="caixa-btn-manual" '+
        'style="padding:5px 11px;border-radius:6px;border:1.5px solid #e67e22;background:#fff;color:#c47012;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit" '+
        'title="Editar manual">✏️ Manual</button>'+
      '<button type="button" id="caixa-btn-sem" '+
        'style="padding:5px 11px;border-radius:6px;border:1.5px solid #999;background:#fff;color:#555;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit" '+
        'title="Cliente nao quer caixa">🚫 Sem caixa</button>'+
      '<span id="caixa-ctrl-mode-info" style="font-size:9.5px;color:#888;margin-left:auto;font-style:italic"></span>';
    titleEl.parentNode.insertBefore(bar, titleEl.nextSibling);
    $('caixa-btn-auto').addEventListener('click', function(){ applyAuto(true); });
    $('caixa-btn-manual').addEventListener('click', applyManual);
    $('caixa-btn-sem').addEventListener('click', applySemCaixa);
    return true;
  }

  // ─── PARTE 2: SEM INSTALACAO — corte na raiz ────────────────────────
  function isInstQuemSEM(){
    var iq = $('inst-quem');
    var cq = $('crm-o-inst-quem');
    var v1 = iq ? (iq.value||'').toUpperCase() : '';
    var v2 = cq ? (cq.value||'').toUpperCase() : '';
    return v1 === 'SEM' || v2 === 'SEM';
  }

  function patchCalcInstIntl(){
    if(typeof window.calcInstIntl !== 'function') return false;
    if(window.calcInstIntl.__semPatched) return true;
    var orig = window.calcInstIntl;
    window.calcInstIntl = function(){
      if(isInstQuemSEM()){
        window._instIntlFat = 0;
        window._instIntlCusto = 0;
        return 0;
      }
      return orig.apply(this, arguments);
    };
    window.calcInstIntl.__semPatched = true;
    return true;
  }

  function forceZeroInstFat(){
    if(isInstQuemSEM()){
      window._instIntlFat = 0;
      window._instIntlCusto = 0;
    }
  }

  function fixResultadoPorta(){
    if(!isInstQuemSEM()) return;
    [['d-custo-inst','—'],['d-tab-inst','—'],['d-fat-inst','—']].forEach(function(p){
      var el = $(p[0]);
      if(el && el.textContent !== p[1]) el.textContent = p[1];
    });
    var rInst = $('r-inst');
    if(rInst && rInst.textContent !== 'R$ 0' && rInst.textContent !== '—') rInst.textContent = 'R$ 0';
  }

  function fixIntlTotalPanel(){
    var panel = $('resultado-intl-total');
    if(!panel) return;
    var instCard = $('intl-preco-inst');
    var instCardWrapper = instCard ? instCard.parentNode : null;
    var rcGrid = instCardWrapper ? instCardWrapper.parentNode : null;
    var portaEl = $('intl-preco-porta');
    var portaUsdEl = $('intl-preco-porta-usd');
    var totalFatEl = $('intl-total-fat');
    var totalUsdEl = $('intl-total-usd');

    if(isInstQuemSEM()){
      if(instCardWrapper) instCardWrapper.style.display = 'none';
      if(rcGrid) rcGrid.style.gridTemplateColumns = '1fr';
      var hdr = panel.querySelector('.rh');
      if(hdr && !hdr.__semRenamed){
        hdr.__originalTxt = hdr.textContent;
        hdr.textContent = '🌍 Total Internacional — Porta';
        hdr.__semRenamed = true;
      }
      if(portaEl && totalFatEl){
        var portaTxt = portaEl.textContent || '';
        if(totalFatEl.textContent !== portaTxt) totalFatEl.textContent = portaTxt;
      }
      if(portaUsdEl && totalUsdEl){
        var usdTxt = portaUsdEl.textContent || '';
        if(usdTxt && totalUsdEl.textContent !== usdTxt) totalUsdEl.textContent = usdTxt;
      }
    } else {
      if(instCardWrapper && instCardWrapper.style.display === 'none') instCardWrapper.style.display = '';
      if(rcGrid && rcGrid.style.gridTemplateColumns === '1fr') rcGrid.style.gridTemplateColumns = '';
      var hdr2 = panel.querySelector('.rh');
      if(hdr2 && hdr2.__semRenamed){
        hdr2.textContent = hdr2.__originalTxt || '🌍 Total Internacional — Porta + Instalação';
        hdr2.__semRenamed = false;
      }
    }
  }

  function fixPropostaInst(){
    if(!isInstQuemSEM()) return;
    var rowInst = $('prop-row-inst');
    if(rowInst) rowInst.style.display = 'none';
    var propScope = $('proposta-page') || $('proposta-container') || document;
    var rows = propScope.querySelectorAll('tr');
    Array.prototype.forEach.call(rows, function(tr){
      var t = (tr.textContent||'').toUpperCase();
      if(/INTERNATIONAL INSTALLATION/.test(t)
        || /INSTALAÇÃO INTERNACIONAL/.test(t)
        || /INSTALACAO INTERNACIONAL/.test(t)
        || /NOT INCLUDED/.test(t) && /INSTALL/.test(t)
        || /NÃO INCLUSA/.test(t) && /INSTALA/.test(t)){
        tr.style.display = 'none';
      }
    });
  }

  function patchProposta(){
    if(typeof window.populateProposta !== 'function') return false;
    if(window.populateProposta.__semInstPatched) return true;
    var orig = window.populateProposta;
    window.populateProposta = function(){
      forceZeroInstFat();
      var r = orig.apply(this, arguments);
      try{ setTimeout(fixPropostaInst, 50); }catch(e){}
      try{ setTimeout(fixPropostaInst, 300); }catch(e){}
      return r;
    };
    window.populateProposta.__semInstPatched = true;
    return true;
  }

  function patchCalc(){
    if(typeof window.calc !== 'function') return false;
    if(window.calc.__semInstPatched) return true;
    var orig = window.calc;
    window.calc = function(){
      forceZeroInstFat();
      return orig.apply(this, arguments);
    };
    window.calc.__semInstPatched = true;
    return true;
  }

  // ─── INIT ───────────────────────────────────────────────────────────
  function tick(){
    injectButtonBar();
    forceZeroInstFat();
    fixResultadoPorta();
    fixIntlTotalPanel();
  }

  function init(){
    setInterval(tick, 500);
    setTimeout(tick, 200);
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      var ok1 = patchProposta();
      var ok2 = patchCalcInstIntl();
      var ok3 = patchCalc();
      if((ok1 && ok2 && ok3) || tries >= 30) clearInterval(t);
    }, 400);
    var iq = $('inst-quem');
    if(iq && !iq.__sem135){
      iq.__sem135 = true;
      ['change','input'].forEach(function(ev){
        iq.addEventListener(ev, function(){
          forceZeroInstFat();
          setTimeout(tick, 50);
          setTimeout(tick, 300);
        });
      });
    }
    var cq = $('crm-o-inst-quem');
    if(cq && !cq.__sem135){
      cq.__sem135 = true;
      cq.addEventListener('change', function(){
        forceZeroInstFat();
        setTimeout(tick, 100);
      });
    }
    console.log('[135-caixa-ctrl-sem-inst] v2 instalado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
