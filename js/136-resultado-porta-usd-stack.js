/* ============================================================================
 * js/136-resultado-porta-usd-stack.js  —  NOVO (28-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 *
 * Felipe 28/04: no painel Resultado da Porta os valores aparecem como
 *   "R$ 39.922,78 · US$ 8,148"
 * tudo na mesma linha. Felipe quer USD EMBAIXO do BRL pra nao precisar
 * fazer conta visual:
 *   "R$ 39.922,78"
 *   "US$ 8,148"
 *
 * SOLUCAO: MutationObserver nos elementos do painel. Quando textContent
 * tem padrao "...· US$ X..." substitui por innerHTML com <br>.
 *
 * Aplica em:
 *   - m-custo-porta / m-custo-porta-m2
 *   - m-tab-porta   / m-tab-porta-m2
 *   - m-fat-porta   / m-fat-porta-m2
 *   - d-custo-fab   / d-custo-inst
 *   - d-tab-sp / d-fat-sp / d-tab-inst / d-fat-inst
 *   - s-cm2 / s-tm2 / s-fm2 / s-tm2p / s-fm2p
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta136Applied) return;
  window.__projetta136Applied = true;
  console.log('[136-resultado-usd-stack] iniciando');

  var IDS = [
    'm-custo-porta','m-custo-porta-m2',
    'm-tab-porta','m-tab-porta-m2',
    'm-fat-porta','m-fat-porta-m2',
    'd-custo-fab','d-custo-inst',
    'd-tab-sp','d-fat-sp','d-tab-inst','d-fat-inst',
    's-cm2','s-tm2','s-fm2','s-tm2p','s-fm2p'
  ];

  // Regex: captura "R$ X..." + separador "·" + "US$ Y..."
  // Aceita variantes: "·" U+00B7, "•" U+2022, "|", " - ", " — "
  var RE_SEP = /^(.+?)\s*[·•|]\s*(US\$[^<]+)$/;

  function $(id){ return document.getElementById(id); }

  function looksProcessed(html){
    // Ja tem <br> entre R$ e US$? skip
    return /R\$[^<]*<br\s*\/?>\s*US\$/i.test(html);
  }

  function stackUsd(el){
    if(!el) return;
    var html = el.innerHTML || '';
    if(looksProcessed(html)) return;
    var txt = (el.textContent || '').trim();
    if(!txt || txt === '—' || txt === 'R$ 0') return;

    // Match BRL + sep + USD
    var m = txt.match(RE_SEP);
    if(!m) return;
    var brl = m[1].trim();
    var usd = m[2].trim();
    // Nao processar se ambos ja estao em elementos separados (defensive)
    var tag = (el.tagName||'').toUpperCase();
    var fontSize = (el.classList && el.classList.contains('ms')) ? '0.85em' : '0.78em';
    // Construir HTML de 2 linhas
    var newHtml = brl + '<br><span style="color:#1565c0;font-size:'+fontSize+';font-weight:600;display:inline-block;margin-top:1px">'+ usd +'</span>';
    if(el.innerHTML !== newHtml){
      el.__136Applying = true;
      el.innerHTML = newHtml;
      // Reset flag apos micro-tick
      setTimeout(function(){ el.__136Applying = false; }, 5);
    }
  }

  function stackAll(){
    IDS.forEach(function(id){
      var el = $(id);
      if(el && !el.__136Applying) stackUsd(el);
    });
  }

  function installObservers(){
    IDS.forEach(function(id){
      var el = $(id);
      if(!el || el.__136Observed) return;
      el.__136Observed = true;
      var obs = new MutationObserver(function(muts){
        if(el.__136Applying) return; // ignorar nossa propria mudanca
        // Reagendar apos micro-tick (deixa calc() terminar)
        clearTimeout(el.__136Timer);
        el.__136Timer = setTimeout(function(){ stackUsd(el); }, 30);
      });
      obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
  }

  function init(){
    stackAll();
    installObservers();
    // Polling leve pra pegar elementos que aparecem depois (lazy render)
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      stackAll();
      installObservers();
      if(tries >= 20) clearInterval(t);
    }, 600);
    console.log('[136-resultado-usd-stack] instalado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
