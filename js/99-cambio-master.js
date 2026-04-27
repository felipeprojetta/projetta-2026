/* ============================================================================
 * 99-cambio-master.js v2 (27-abr-2026)
 * Felipe 27/04: NEUTRALIZADO. Nao busca externamente. Apenas sincroniza
 * campos de UI quando user digita.
 * ========================================================================= */
(function(){
'use strict';

var IDS = ['inst-intl-cambio', 'frete-calc-cambio'];
window._CAMBIO_USD_BRL_MASTER = 0;

function _triggerRecalc(){
  try { if(typeof window.calc === 'function') window.calc(); } catch(e){}
  try { if(typeof window.recomputeAndRender === 'function') window.recomputeAndRender(); } catch(e){}
}

var _applying = false;
function _setAllCampos(valor, fonte){
  if(_applying) return;
  _applying = true;
  try {
    var valorStr = (typeof valor === 'number') ? valor.toFixed(4) : String(valor);
    var valorNum = parseFloat(valorStr) || 0;
    if(valorNum <= 0){ _applying = false; return; }
    window._CAMBIO_USD_BRL_MASTER = valorNum;
    IDS.forEach(function(id){
      if(id === fonte) return;
      var el = document.getElementById(id);
      if(el && Math.abs(parseFloat(el.value || 0) - valorNum) > 0.0001){
        el.value = valorStr;
      }
    });
  } finally {
    _applying = false;
  }
  _triggerRecalc();
}

function _wireCampo(id){
  var el = document.getElementById(id);
  if(!el || el.__cambioMasterWired) return;
  el.__cambioMasterWired = true;
  ['input','change','blur'].forEach(function(evt){
    el.addEventListener(evt, function(){
      var v = parseFloat(el.value);
      if(!isNaN(v) && v > 0 && v < 100){
        _setAllCampos(v, id);
      }
    });
  });
}

function _init(){
  IDS.forEach(_wireCampo);
  setInterval(function(){ IDS.forEach(_wireCampo); }, 5000);
  console.log('[99-cambio-master v2] NEUTRALIZADO — sem busca externa, so sync UI');
}

// ★ Stub de refresh — nao faz nada mais
window.cambioMasterRefresh = async function(){ return null; };

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}

})();
