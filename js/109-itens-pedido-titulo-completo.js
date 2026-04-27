/* ============================================================================
 * js/109-itens-pedido-titulo-completo.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "no campo Itens do Pedido traga nome cliente, numero reserva
 *          numero do AGP"
 *
 * COMPORTAMENTO:
 *  - Atualiza o titulo .orc-itens-bar-title de:
 *    "📦 Itens do Pedido — {cliente}"
 *    para:
 *    "📦 Itens do Pedido — {cliente} · Reserva {numprojeto} · AGP {num-agp}"
 *  - Le inputs: #cliente, #numprojeto, #num-agp
 *  - Polling 500ms + listeners nos inputs
 *  - Idempotente: nao duplica info ja inserida
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - Atua apenas alterando textContent do titulo
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta109TituloApplied) return;
  window.__projetta109TituloApplied = true;
  console.log("[109-itens-pedido-titulo] iniciando");

  function val(id){
    var el = document.getElementById(id);
    if(!el) return "";
    return (el.value || "").toString().trim();
  }

  function buildTitulo(){
    var cliente = val("cliente");
    var reserva = val("numprojeto");
    var agp = val("num-agp");
    var partes = ["📦 Itens do Pedido"];
    if(cliente){
      var sub = cliente;
      if(reserva) sub += " · Reserva " + reserva;
      if(agp) sub += " · AGP " + agp;
      return "📦 Itens do Pedido — " + sub;
    }
    return "📦 Itens do Pedido — Cliente";
  }

  function aplicarTitulo(){
    var titulo = document.querySelector(".orc-itens-bar-title");
    if(!titulo) return;
    var novo = buildTitulo();
    if(titulo.textContent !== novo){
      titulo.textContent = novo;
    }
  }

  function attachListeners(){
    ["cliente", "numprojeto", "num-agp"].forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el.__projetta109Hooked){
        el.__projetta109Hooked = true;
        el.addEventListener("input", aplicarTitulo);
        el.addEventListener("change", aplicarTitulo);
        el.addEventListener("blur", aplicarTitulo);
      }
    });
  }

  function tick(){
    try {
      attachListeners();
      aplicarTitulo();
    } catch(e){
      console.warn("[109-titulo] erro:", e);
    }
  }

  // Polling
  setInterval(tick, 500);
  setTimeout(tick, 200);
  setTimeout(tick, 1500);

  // MutationObserver no DOM (caso o titulo seja recriado)
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(){ setTimeout(tick, 30); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[109-itens-pedido-titulo] instalado");
})();
