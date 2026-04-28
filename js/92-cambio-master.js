/* MODULE 92: STUB FINAL (28-abr-2026 v3)
 * Felipe: cambio vem 100% do card. window.projettaCambio.get() SEMPRE 0.
 * Quem precisar de cambio LE de o.extras.inst_cambio direto.
 */
(function(){
  'use strict';
  window.projettaCambio = {
    get: function(){ return 0; }, // ★ NUNCA retorna valor — forca leitura do card
    set: function(){ return false; },
    onChange: function(){},
    refresh: function(){ return Promise.resolve(null); },
    getMedia: function(){ return null; }
  };
  try { localStorage.removeItem('projetta_cambio_master_v1'); } catch(e){}
  try { localStorage.removeItem('cambio_usd_brl_media_v1'); } catch(e){}
  console.log('[92-cambio] STUB FINAL - sempre retorna 0');
})();
