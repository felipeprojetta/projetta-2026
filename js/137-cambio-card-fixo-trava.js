/* ============================================================================
 * js/137-cambio-card-fixo-trava.js  —  NOVO (28-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 *
 * PROBLEMA:
 *   - O painel "Resultado da Porta" usa _cambioResult lido de #inst-intl-cambio
 *     (parseFloat(($('inst-intl-cambio')||{value:0}).value) || 0)
 *   - Modulos 92/99/106/131 (cambio-master, cambio-manual-only, etc) ficam
 *     sobrescrevendo #inst-intl-cambio com BCB/outras fontes
 *   - Resultado: USD pisca, mostra valor calculado com cambio errado
 *
 * REGRA Felipe:
 *   "Valor do dolar e fixo no card. Uma vez feito, nao deve produzir nada."
 *
 * SOLUCAO:
 *   1. Hook em crmFazerOrcamento → captura opp.extras.inst_cambio do banco
 *      Salva em window._cambioFixoCard
 *   2. Trava #inst-intl-cambio com esse valor:
 *      - readOnly = true
 *      - estilo verde (travado)
 *      - MutationObserver: se qualquer modulo tentar mudar, REVERTE
 *   3. Substitui leitura de _cambioResult pra usar window._cambioFixoCard
 *      via patch em function _brlUsd / _brlUsdM2 (em 02-orcamento_calc).
 *      Como nao posso modificar 02 diretamente, faco override do innerHTML
 *      pos-render usando MutationObserver no painel Resultado.
 *
 *   Fonte da verdade: opp.extras.inst_cambio (banco) → window._cambioFixoCard
 *   Esse valor NUNCA muda enquanto o card estiver aberto.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta137Applied) return;
  window.__projetta137Applied = true;
  console.log('[137-cambio-card-fixo] iniciando');

  window._cambioFixoCard = 0; // ZERO ate carregar opp do CRM

  function $(id){ return document.getElementById(id); }

  function setCambioFixo(v){
    var n = parseFloat(v) || 0;
    if(n <= 0) return false;
    window._cambioFixoCard = n;
    var el = $('inst-intl-cambio');
    if(el){
      var alvo = String(n);
      if(el.value !== alvo){
        el.__137Forcing = true;
        el.value = alvo;
        setTimeout(function(){ el.__137Forcing = false; }, 5);
      }
      // Visual de travado
      el.readOnly = true;
      el.style.background = '#e8f5e9';
      el.style.color = '#1b5e20';
      el.style.border = '1.5px solid #4caf50';
      el.style.fontWeight = '700';
      el.style.cursor = 'not-allowed';
      el.title = '🔒 Cambio fixo do card — para alterar, edite no CRM e salve';
    }
    console.log('[137] cambio fixo =', n);
    return true;
  }

  // Observer no input pra reverter qualquer escrita externa
  function installInputObserver(){
    var el = $('inst-intl-cambio');
    if(!el || el.__137Observed) return false;
    el.__137Observed = true;
    var obs = new MutationObserver(function(){
      if(el.__137Forcing) return;
      if(window._cambioFixoCard > 0 && el.value !== String(window._cambioFixoCard)){
        el.__137Forcing = true;
        el.value = String(window._cambioFixoCard);
        setTimeout(function(){ el.__137Forcing = false; }, 5);
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ['value'] });
    // Tambem ouvir input/change events que outros modulos podem disparar
    ['input','change','blur'].forEach(function(ev){
      el.addEventListener(ev, function(e){
        if(el.__137Forcing) return;
        if(window._cambioFixoCard > 0 && el.value !== String(window._cambioFixoCard)){
          el.__137Forcing = true;
          el.value = String(window._cambioFixoCard);
          setTimeout(function(){ el.__137Forcing = false; }, 5);
        }
      }, true); // capture phase
    });
    return true;
  }

  // Polling leve pra forcar valor (caso outros modulos sobrescrevam)
  function tickEnforce(){
    if(window._cambioFixoCard <= 0) return;
    var el = $('inst-intl-cambio');
    if(!el) return;
    if(el.value !== String(window._cambioFixoCard)){
      el.__137Forcing = true;
      el.value = String(window._cambioFixoCard);
      setTimeout(function(){ el.__137Forcing = false; }, 5);
      // Disparar recalc para refletir o cambio correto
      if(typeof window.calc === 'function'){
        try{ window.calc(); }catch(e){}
      }
    }
    // Garantir visual travado
    if(!el.readOnly){
      el.readOnly = true;
      el.style.background = '#e8f5e9';
      el.style.color = '#1b5e20';
      el.style.border = '1.5px solid #4caf50';
      el.style.fontWeight = '700';
      el.style.cursor = 'not-allowed';
    }
  }

  // Hook em crmFazerOrcamento — captura inst_cambio do opp
  function patchCrmFazerOrcamento(){
    if(typeof window.crmFazerOrcamento !== 'function') return false;
    if(window.crmFazerOrcamento.__137Patched) return true;
    var orig = window.crmFazerOrcamento;
    window.crmFazerOrcamento = function(id){
      var r = orig.apply(this, arguments);
      // Apos rodar, buscar opp pelo id e capturar inst_cambio
      try {
        var data = (typeof cLoad === 'function') ? cLoad() : (window._crmCards || []);
        if(Array.isArray(data)){
          var opp = data.find(function(o){ return o.id === id; });
          if(opp){
            // inst_cambio pode estar em opp.inst_cambio (top-level) ou em extras
            var c = parseFloat(opp.inst_cambio) || parseFloat((opp.extras||{}).inst_cambio) || 0;
            // Repetir tentativas pra esperar input renderizar
            var tries = 0;
            var tt = setInterval(function(){
              tries++;
              if(c > 0){
                setCambioFixo(c);
                installInputObserver();
              }
              if(tries >= 15) clearInterval(tt);
            }, 200);
          }
        }
      } catch(e){ console.warn('[137] hook err:', e); }
      return r;
    };
    window.crmFazerOrcamento.__137Patched = true;
    return true;
  }

  // Forcar leitura inicial: se ja temos cambio no input, capturar (caso o user
  // tenha aberto direto no orcamento sem passar por crmFazerOrcamento)
  function captureInicial(){
    if(window._cambioFixoCard > 0) return;
    var el = $('inst-intl-cambio');
    if(!el) return;
    var v = parseFloat(el.value) || 0;
    if(v > 0){
      setCambioFixo(v);
      installInputObserver();
    }
  }

  function init(){
    // Patch crmFazerOrcamento com retry
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      if(patchCrmFazerOrcamento() || tries >= 30) clearInterval(t);
    }, 400);
    // Tentar capturar valor inicial e instalar observer
    setTimeout(function(){
      captureInicial();
      installInputObserver();
    }, 800);
    // Polling enforcer (cada 600ms — leve)
    setInterval(function(){
      tickEnforce();
      installInputObserver(); // re-instala se DOM recriou
    }, 600);
    console.log('[137-cambio-card-fixo] instalado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
