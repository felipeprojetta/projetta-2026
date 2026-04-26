/* ============================================================================
 * js/102-incoterm-port-destination.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "ao lado de CIF - LOCAL DE ENTREGA PORTO DE DESTINO
 *          ( NOME DO PAIS QUE COLOCAMOS NO CARD ) DOMINICAN REPUBLIC"
 *
 * Adiciona ao lado do tag "INCOTERM 2020 - CIF" o local de entrega:
 *
 *   ANTES:
 *     INCOTERM 2020 - CIF                          Cost, Insurance & Freight
 *
 *   DEPOIS:
 *     INCOTERM 2020 - CIF · Port of destination: DOMINICAN REPUBLIC
 *                                                Cost, Insurance & Freight
 *
 * Fonte do pais (mesmo do mod98):
 *   1. crm-o-inst-pais (modal CRM aberto)
 *   2. window._currentOpp.extras.inst_pais
 *   3. localStorage projetta_crm_v1 cruzando com prop-cliente
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - Atua via MutationObserver + polling no DOM
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta102IncotermPortApplied) return;
  window.__projetta102IncotermPortApplied = true;
  console.log("[102-incoterm-port] iniciando");

  var FLAG_ATTR = "data-projetta102Applied";

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

  function detectarIdioma(){
    // Heuristica: se o documento tem palavras tipicas EN, eh ingles
    var sample = (document.body.textContent || "").substring(0, 5000);
    if(/Cost,\s+Insurance\s+&\s+Freight|Free\s+On\s+Board|Ex\s+Works|Total\s+Quote|Buyer|Seller/i.test(sample)) return "en";
    if(/Custo,\s+Seguro|Livre\s+a\s+Bordo|Na\s+F[áa]brica|Comprador|Vendedor/i.test(sample)) return "pt";
    return "en"; // default ingles para proposta intl
  }

  function patchIncotermLine(country){
    if(!country) return 0;
    var lang = detectarIdioma();
    var label = (lang === "pt") ? "Porto de destino" : "Port of destination";
    var countryUp = country.toUpperCase();

    // Procurar elementos que contem "INCOTERM 2020"
    var aplicados = 0;
    var candidatos = document.querySelectorAll("div, span, p, td, h1, h2, h3, h4");
    for(var i = 0; i < candidatos.length; i++){
      var el = candidatos[i];
      if(el.getAttribute(FLAG_ATTR) === country) continue;
      var t = (el.textContent || "").trim();
      if(t.length > 500) continue;
      if(t.length < 15) continue;
      // So elementos com INCOTERM 2020
      if(!/INCOTERM\s*2020/i.test(t)) continue;
      // Que tenham CIF, FOB ou EXW
      var incotermMatch = t.match(/\b(CIF|FOB|EXW)\b/);
      if(!incotermMatch) continue;
      // Skip se ja contem o pais ou label
      if(t.indexOf(countryUp) >= 0) continue;
      if(t.indexOf(country) >= 0) continue;
      if(t.indexOf(label) >= 0) continue;
      // Skip se for container muito grande
      if(el.children.length > 20) continue;
      // Skip se for o body/html/documentElement
      if(el === document.body || el === document.documentElement) continue;

      var html = el.innerHTML;
      var incotermTag = incotermMatch[0];

      // Substituir o tag CIF/FOB/EXW por: TAG + " · Port of destination: PAIS"
      // Usar regex word boundary pra nao casar dentro de palavra
      var re = new RegExp("(\\b" + incotermTag + "\\b)(?![\\w·])", "i");
      var injection = " · " + label + ": " + countryUp;
      var newHtml = html.replace(re, "$1" + injection);

      if(newHtml !== html){
        el.innerHTML = newHtml;
        el.setAttribute(FLAG_ATTR, country);
        aplicados++;
        console.log("[102-incoterm-port] adicionado: " + label + " = " + countryUp);
      }
    }
    return aplicados;
  }

  function tick(){
    try {
      var country = getDestinationCountry();
      if(!country) return;
      patchIncotermLine(country);
    } catch(e){
      console.warn("[102-incoterm-port] erro:", e);
    }
  }

  setInterval(tick, 800);
  setTimeout(tick, 200);
  setTimeout(tick, 1500);

  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      for(var i = 0; i < muts.length; i++){
        var t = muts[i].target;
        if(t && t.id && /prop|proposta/i.test(t.id || "")){
          // Limpar flag pra forcar re-injection (caso pais tenha mudado)
          var marcados = t.querySelectorAll("[" + FLAG_ATTR + "]");
          for(var k = 0; k < marcados.length; k++) marcados[k].removeAttribute(FLAG_ATTR);
          precisa = true;
        }
      }
      if(precisa) setTimeout(tick, 80);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[102-incoterm-port] instalado");
})();
