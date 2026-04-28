/* MODULE 92: STUB (28-abr-2026) — Felipe pediu pra deletar todos modulos
 * de cambio externo. Mantido apenas window.projettaCambio.get() que LE do
 * input mod131-cambio-card. Sem API, sem fallback, sem polling.
 */
(function(){
  'use strict';
  function readVal(id){
    var el = document.getElementById(id);
    if(!el) return 0;
    var v = parseFloat(el.value);
    return (isFinite(v) && v > 0) ? v : 0;
  }
  window.projettaCambio = {
    get: function(){
      return readVal('mod131-cambio-card')
          || readVal('inst-intl-cambio')
          || (parseFloat(window._cambioFixoCard)||0);
    },
    set: function(){ return false; }, // deprecated
    onChange: function(){},
    refresh: function(){ return Promise.resolve(null); },
    getMedia: function(){ return null; }
  };
  try { localStorage.removeItem('projetta_cambio_master_v1'); } catch(e){}
  try { localStorage.removeItem('cambio_usd_brl_media_v1'); } catch(e){}
  console.log('[92-cambio] STUB - le so do card');
})();
