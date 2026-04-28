/* ============================================================
 * MODULE 92: CAMBIO MASTER — fonte unica e o campo do card
 * ============================================================
 * Sem API, sem fallback, sem cache, sem localStorage.
 * mod131-cambio-card e a fonte oficial. Os outros campos
 * (inst-intl-cambio, cambio-master-input, frete-calc-cambio)
 * espelham ele.
 */
(function(){
  'use strict';
  var FONTE = 'mod131-cambio-card';
  var ESPELHOS = ['inst-intl-cambio','cambio-master-input','frete-calc-cambio'];
  var listeners = [];

  function readVal(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseFloat(el.value);
    return (isFinite(v) && v > 0) ? v : 0;
  }

  function getCambio() {
    return readVal(FONTE) || readVal('inst-intl-cambio');
  }

  function setCambio(v) {
    v = parseFloat(v);
    if (!isFinite(v) || v < 0) return false;
    var str = v > 0 ? v.toFixed(4) : '';
    [FONTE].concat(ESPELHOS).forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.value = str;
    });
    listeners.forEach(function(cb){ try { cb(v); } catch(e){} });
    if (typeof window.calc === 'function') { try { window.calc(); } catch(e){} }
    return true;
  }

  function onChange(cb){ if (typeof cb === 'function') listeners.push(cb); }

  window.projettaCambio = {
    get: getCambio,
    set: setCambio,
    onChange: onChange,
    refresh: function(){ return Promise.resolve(null); },
    getMedia: function(){ return null; }
  };

  try { localStorage.removeItem('projetta_cambio_master_v1'); } catch(e){}
  try { localStorage.removeItem('cambio_usd_brl_media_v1'); } catch(e){}

  function hideLegacyUI() {
    ['cambio-master-box','inst-intl-cambio-info','crm-inst-cambio-info',
     'cambio-master-refresh','cambio-master-usar-media','cambio-master-extra',
     'cambio-master-media','cambio-master-badge'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideLegacyUI);
  } else { hideLegacyUI(); }

  console.log('[92-cambio v2] fonte unica: ' + FONTE);
})();
