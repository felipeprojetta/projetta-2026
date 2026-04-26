/* ============================================================================
 * js/98-proposta-pais-destino.js  —  Modulo NOVO (26-abr-2026, v2)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "na proposta comercial em ingles coloque ao lado do incoterm CIF
 *          o pais de destino, esse que acabamos de setar"
 *
 * v2 (fix): regex original perdeu os \\s por causa de escape em template literal.
 *           agora usando RegExp constructor pra evitar problema de escape.
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - NAO altera as funcoes _injectPropostaFobCif / _injectPropostaIncotermBox
 *  - Atua apenas no DOM via MutationObserver no elemento de saida
 *
 * COMPORTAMENTO:
 *  Antes:  "🚢 CIF — SHIPPING COSTS BREAKDOWN (USD)"
 *  Depois: "🚢 CIF · UNITED STATES — SHIPPING COSTS BREAKDOWN (USD)"
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta98PropPaisDestinoApplied) return;
  window.__projetta98PropPaisDestinoApplied = true;
  console.log("[98-prop-pais-destino] iniciando v2");

  var FLAG_DONE_ATTR = "data-projetta98Applied";

  // Construir regex via RegExp constructor pra evitar problema de escape em template literal.
  // Padrao 1: "🚢 [CIF/FOB/EXW] —"  (com qualquer espacamento)
  var SHIP_REGEX = new RegExp("(\uD83D\uDEA2\\s+)(CIF|FOB|EXW)(\\s*[\u2014-])", "g");
  // Padrao 2: tag CIF/FOB/EXW seguido de — Cost/Custo/Free/Livre/Ex Works/Na Fabrica
  var INCOTERM_TAG_REGEX = new RegExp("(>|^|\\s)(CIF|FOB|EXW)(\\s*[\u2014-]\\s*(?:Cost|Custo|Free|Livre|Ex Works|Na Fabrica))", "g");

  function getDestinationCountry(){
    try {
      var inp = document.getElementById("crm-o-inst-pais");
      if(inp && inp.value && inp.value.trim()) return inp.value.trim();
    } catch(e){}

    try {
      if(window._currentOpp){
        var p = window._currentOpp.extras && window._currentOpp.extras.inst_pais;
        if(p) return p;
        if(window._currentOpp.pais) return window._currentOpp.pais;
      }
      if(window._currentCard){
        var p2 = window._currentCard.extras && window._currentCard.extras.inst_pais;
        if(p2) return p2;
        if(window._currentCard.pais) return window._currentCard.pais;
      }
    } catch(e){}

    try {
      var clienteEl = document.getElementById("prop-cliente");
      if(!clienteEl) return null;
      var cliente = (clienteEl.textContent||"").trim();
      if(!cliente) return null;

      var raw = localStorage.getItem("projetta_crm_v1");
      if(!raw) return null;
      var data = JSON.parse(raw);
      var lista = Array.isArray(data) ? data : (data.opps || []);

      var match = lista.find(function(c){
        if(!c || !c.cliente) return false;
        return c.cliente === cliente || cliente.indexOf(c.cliente) >= 0 || c.cliente.indexOf(cliente) >= 0;
      });
      if(match){
        var p3 = (match.extras && match.extras.inst_pais) || match.pais;
        if(p3) return p3;
      }
    } catch(e){}

    return null;
  }

  function injetarPaisNoElemento(el, country){
    if(!el || !country) return false;
    if(el.getAttribute(FLAG_DONE_ATTR) === country) return false;

    var html = el.innerHTML;
    if(!html) return false;

    var jaTemPais = html.indexOf("· " + country) >= 0
                 || html.indexOf("(" + country + ")") >= 0
                 || html.indexOf("· " + country.toUpperCase()) >= 0;
    if(jaTemPais){
      el.setAttribute(FLAG_DONE_ATTR, country);
      return false;
    }

    var countryUp = country.toUpperCase();
    var novoHtml = html;

    // Reset regex lastIndex (RegExp com flag g mantem state)
    SHIP_REGEX.lastIndex = 0;
    INCOTERM_TAG_REGEX.lastIndex = 0;

    novoHtml = novoHtml.replace(SHIP_REGEX, "$1$2 · " + countryUp + "$3");
    novoHtml = novoHtml.replace(INCOTERM_TAG_REGEX, "$1$2 · " + countryUp + "$3");

    if(novoHtml !== html){
      el.innerHTML = novoHtml;
      el.setAttribute(FLAG_DONE_ATTR, country);
      console.log("[98-prop-pais-destino] pais injetado: " + country);
      return true;
    }
    return false;
  }

  function tick(){
    var country = getDestinationCountry();
    if(!country) return;

    var seletores = ["#prop-fob-cif-block", "#prop-incoterm-box", "#prop-incoterm-block"];
    seletores.forEach(function(s){
      try {
        var el = document.querySelector(s);
        if(el) injetarPaisNoElemento(el, country);
      } catch(e){}
    });

    try {
      var todos = document.querySelectorAll("div, section");
      var SHIP_DETECT = new RegExp("\uD83D\uDEA2\\s+(CIF|FOB|EXW)\\s*[\u2014-]");
      for(var i = 0; i < todos.length; i++){
        var d = todos[i];
        if(d.children.length > 30) continue;
        var txt = d.textContent || "";
        if(SHIP_DETECT.test(txt) && txt.length < 5000){
          injetarPaisNoElemento(d, country);
        }
      }
    } catch(e){}
  }

  setInterval(tick, 800);
  setTimeout(tick, 200);
  setTimeout(tick, 1500);

  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      for(var i = 0; i < muts.length; i++){
        var t = muts[i].target;
        if(t && t.id && /prop-fob-cif-block|prop-incoterm/.test(t.id)){
          t.removeAttribute(FLAG_DONE_ATTR);
          setTimeout(tick, 50);
          return;
        }
      }
      setTimeout(tick, 100);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: false });
  }

  console.log("[98-prop-pais-destino] v2 instalado");
})();
