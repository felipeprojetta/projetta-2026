/* MODULE 92: cambio-master STUB v3 — Felipe 27/04 */
(function(){
  'use strict';
  var listeners = [];
  var state = { valor: 0 };
  // Mantem interface mas SEM fetch externo
  window.projettaCambio = {
    get: function(){ return state.valor; },
    set: function(v){
      v = parseFloat(v);
      if(!isFinite(v) || v <= 0) return false;
      var old = state.valor;
      state.valor = v;
      try { localStorage.setItem('projetta_cambio_master_v1', JSON.stringify({valor:v, source:'manual'})); } catch(e){}
      listeners.forEach(function(cb){ try{cb(v,old);}catch(e){} });
      return true;
    },
    onChange: function(cb){ if(typeof cb==='function') listeners.push(cb); },
    getMedia: function(){ return null; },
    refresh: async function(){ /* no-op */ }
  };
  console.log('[92 stub] sem fetch externo');
})();
