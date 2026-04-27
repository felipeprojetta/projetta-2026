/* ============================================================================
 * js/106-cambio-so-internacional.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "SOBRE CAMBIO ATUAL SO DEVE PARECER QUANDO ORCAMENTO FOR INTERNACIONAL"
 *
 * COMPORTAMENTO:
 *  - Detecta se o card aberto eh INTERNACIONAL (crm-o-inst-quem = INTERNACIONAL)
 *    OU se o scope do card eh "internacional"
 *  - Se NAO for internacional: esconde o painel #cambio-master-box
 *  - Se for internacional: mostra normalmente
 *  - Reage a mudancas dinamicamente (MutationObserver + listeners)
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/92-cambio-master.js (BLINDADO)
 *  - NAO modifica js/99-cambio-master.js (BLINDADO)
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - Atua apenas no DOM via display:none/block
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta106CambioApplied) return;
  window.__projetta106CambioApplied = true;
  console.log("[106-cambio-so-internacional] iniciando");

  var FLAG_VISIBILIDADE = "data-projetta106Visibility";

  function isInternacional(){
    // 1. Modal CRM aberto: checar input crm-o-inst-quem
    var inp = document.getElementById("crm-o-inst-quem");
    if(inp && inp.offsetParent !== null && inp.value){
      return /INTERNACIONAL/i.test(inp.value);
    }
    // 2. Card no _currentOpp/_currentCard
    try {
      if(window._currentOpp){
        var s = (window._currentOpp.scope || "").toLowerCase();
        if(s) return s === "internacional";
        var q = window._currentOpp.extras && window._currentOpp.extras.inst_quem;
        if(q) return /INTERNACIONAL/i.test(q);
      }
      if(window._currentCard){
        var s2 = (window._currentCard.scope || "").toLowerCase();
        if(s2) return s2 === "internacional";
      }
    } catch(e){}
    // 3. Aba ativa do CRM: filtro de scope na URL ou DOM
    var ativeTab = document.querySelector(".crm-scope-tab.active, [data-scope-active=\"true\"]");
    if(ativeTab){
      var sc = (ativeTab.getAttribute("data-scope") || ativeTab.textContent || "").toLowerCase();
      if(/internacional/.test(sc)) return true;
      if(/nacional/.test(sc)) return false;
    }
    // 4. DEFAULT: nao mostra (assume nacional)
    return false;
  }

  function aplicarVisibilidade(){
    var box = document.getElementById("cambio-master-box");
    if(!box) return;
    var deveExibir = isInternacional();
    var atual = box.getAttribute(FLAG_VISIBILIDADE);
    var novo = deveExibir ? "show" : "hide";
    if(atual === novo) return;
    if(deveExibir){
      // Restaurar display original
      box.style.display = "";
      box.removeAttribute("data-projetta106Hidden");
    } else {
      box.style.display = "none";
      box.setAttribute("data-projetta106Hidden", "1");
    }
    box.setAttribute(FLAG_VISIBILIDADE, novo);
    console.log("[106-cambio] " + (deveExibir ? "mostrando" : "escondendo") + " painel cambio (internacional=" + deveExibir + ")");
  }

  // Hook nos inputs de scope/inst_quem
  function attachListeners(){
    var inp = document.getElementById("crm-o-inst-quem");
    if(inp && !inp.__projetta106Hooked){
      inp.__projetta106Hooked = true;
      inp.addEventListener("change", aplicarVisibilidade);
      inp.addEventListener("input", aplicarVisibilidade);
    }
    var scopeBtns = document.querySelectorAll("[data-scope]");
    scopeBtns.forEach(function(b){
      if(!b.__projetta106Hooked){
        b.__projetta106Hooked = true;
        b.addEventListener("click", function(){ setTimeout(aplicarVisibilidade, 80); });
      }
    });
  }

  function tick(){
    try {
      attachListeners();
      aplicarVisibilidade();
    } catch(e){
      console.warn("[106-cambio] erro:", e);
    }
  }

  // Polling regular
  setInterval(tick, 600);
  setTimeout(tick, 200);
  setTimeout(tick, 1500);

  // MutationObserver: detecta mudancas no DOM (ex: modal abriu/fechou)
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      for(var i = 0; i < muts.length && !precisa; i++){
        var t = muts[i].target;
        if(!t || !t.id) continue;
        if(/cambio|crm|opp|scope/i.test(t.id)){
          precisa = true;
        }
      }
      if(precisa) setTimeout(tick, 50);
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "class", "data-scope-active"] });
  }

  console.log("[106-cambio-so-internacional] instalado");
})();
