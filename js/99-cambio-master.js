/* 99-cambio-master STUB v3 — Felipe 27/04 */
(function(){
  'use strict';
  window._CAMBIO_USD_BRL_MASTER = 0;
  window.cambioMasterRefresh = async function(){ return null; };
  // Sync entre campos quando user digita (sem fetch externo)
  var IDS = ['inst-intl-cambio', 'frete-calc-cambio'];
  function wire(id){
    var el = document.getElementById(id);
    if(!el || el.__w) return;
    el.__w = true;
    ['change','blur'].forEach(function(ev){
      el.addEventListener(ev, function(){
        var v = parseFloat(el.value);
        if(isFinite(v) && v > 0){
          window._CAMBIO_USD_BRL_MASTER = v;
          IDS.forEach(function(oid){
            if(oid === id) return;
            var oel = document.getElementById(oid);
            if(oel) oel.value = v.toFixed(4);
          });
        }
      });
    });
  }
  function init(){ IDS.forEach(wire); setInterval(function(){ IDS.forEach(wire); }, 5000); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  console.log('[99 stub] sem fetch externo');
})();
