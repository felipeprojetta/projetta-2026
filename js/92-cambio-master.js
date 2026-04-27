/* ============================================================
 * MODULE 92: CAMBIO MASTER v3 (27-abr-2026)
 *
 * Felipe 27/04: NEUTRALIZADO + AUTO-LIMPEZA.
 *  - Limpa cache AwesomeAPI (cambio_usd_brl_media_v1) ao carregar
 *  - Limpa state se source='media' (descartar 5.0918 antigo)
 *  - Sem fetch externo
 *  - get() retorna SO valor manual ou 0
 * ============================================================ */
(function(){
  'use strict';

  var STORAGE_KEY = 'projetta_cambio_master_v1';
  var MEDIA_CACHE_KEY = 'cambio_usd_brl_media_v1';
  var listeners = [];
  var state = { valor: 0, source: 'default' };

  // ★ LIMPEZA AUTOMATICA ao carregar
  try { localStorage.removeItem(MEDIA_CACHE_KEY); } catch(e){}

  // Restaurar do localStorage SO se source='manual'
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if(saved && saved.valor > 0 && saved.source === 'manual'){
      state.valor = saved.valor;
      state.source = 'manual';
    } else {
      // descartar valores com source='media' ou 'default' antigos
      try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
    }
  } catch(e){}

  function getCambio(){ return state.valor; }

  function setCambio(novoValor, source){
    novoValor = parseFloat(novoValor);
    if(!isFinite(novoValor) || novoValor <= 0){ return false; }
    // ★ So aceita source='manual' (rejeita media de qualquer fonte)
    if(source && source !== 'manual') return false;
    var antigo = state.valor;
    state.valor = novoValor;
    state.source = 'manual';
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({valor: state.valor, source: 'manual'})); } catch(e){}

    if(Math.abs(novoValor - antigo) > 0.0001){
      listeners.forEach(function(cb){ try { cb(novoValor, antigo); } catch(e){} });
      try {
        window.dispatchEvent(new CustomEvent('projetta:cambio-changed', {detail:{valor:novoValor, antigo:antigo, source:'manual'}}));
      } catch(e){}
    }
    return true;
  }

  function onChange(cb){ if(typeof cb === 'function') listeners.push(cb); }

  window.projettaCambio = {
    get: getCambio,
    set: setCambio,
    onChange: onChange,
    getMedia: function(){ return null; },
    refresh: async function(){ /* no-op */ },
    _state: state
  };

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

  console.log('[cambio-master v3] NEUTRALIZADO + AUTO-LIMPEZA — sem fetch, descarta media antiga');
})();
