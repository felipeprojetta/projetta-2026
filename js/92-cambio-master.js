/* ============================================================
 * MODULE 92: CAMBIO MASTER v2 (27-abr-2026)
 *
 * Felipe 27/04: NEUTRALIZADO. NAO busca mais externamente.
 *  - Removido fetchMedia30d (era o que punha 5.0918 no card)
 *  - Removido init() que sobrescrevia com media
 *  - Removido refresh()
 *  - Mantida interface get/set/onChange pra nao quebrar consumidores
 *  - get() retorna o que ta em localStorage ou 0 (forca usar do card)
 *  - set() persiste, MAS NAO chama crmRender (pra parar de piscar)
 * ============================================================ */
(function(){
  'use strict';

  var STORAGE_KEY = 'projetta_cambio_master_v1';
  var listeners = [];
  var state = { valor: 0, source: 'default' };

  // Restaurar do localStorage
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if(saved && saved.valor > 0){
      state.valor = saved.valor;
      state.source = saved.source || 'manual';
    }
  } catch(e){}

  function getCambio(){ return state.valor; }

  function setCambio(novoValor, source){
    novoValor = parseFloat(novoValor);
    if(!isFinite(novoValor) || novoValor <= 0){ return false; }
    var antigo = state.valor;
    state.valor = novoValor;
    state.source = source || 'manual';
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({valor: state.valor, source: state.source})); } catch(e){}

    if(Math.abs(novoValor - antigo) > 0.0001){
      listeners.forEach(function(cb){ try { cb(novoValor, antigo); } catch(e){} });
      try {
        window.dispatchEvent(new CustomEvent('projetta:cambio-changed', {detail:{valor:novoValor, antigo:antigo, source:state.source}}));
      } catch(e){}
      // ★ NAO chama crmRender aqui (causava piscar)
    }
    return true;
  }

  function onChange(cb){ if(typeof cb === 'function') listeners.push(cb); }

  // API publica — sem refresh, sem getMedia
  window.projettaCambio = {
    get: getCambio,
    set: setCambio,
    onChange: onChange,
    getMedia: function(){ return null; },
    refresh: async function(){ /* no-op */ },
    _state: state
  };

  // Wire UI somente do input #cambio-master-input se existir, sem fetch externo
  function wireUI(){
    var inp = document.getElementById('cambio-master-input');
    if(!inp){ setTimeout(wireUI, 500); return; }
    if(state.valor > 0) inp.value = state.valor.toFixed(4);
    if(!inp.__cmWired){
      inp.__cmWired = true;
      inp.addEventListener('change', function(){ setCambio(inp.value, 'manual'); });
      inp.addEventListener('blur', function(){ setCambio(inp.value, 'manual'); });
      inp.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ inp.blur(); } });
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wireUI);
  } else {
    setTimeout(wireUI, 100);
  }

  console.log('[cambio-master v2] NEUTRALIZADO — sem busca externa');
})();
