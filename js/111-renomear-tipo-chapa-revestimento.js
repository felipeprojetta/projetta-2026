/* ============================================================================
 * js/111-renomear-tipo-chapa-revestimento.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * ETAPA A do refactor de revestimento.
 *
 * COMPORTAMENTO:
 *  - Detecta selects que contem options com value="CHAPA" ou "RIPADO"
 *    (sao os tipos de revestimento definidos em js/43-item-revestimento.js)
 *  - Renomeia APENAS os LABELS visiveis:
 *      "CHAPA"  -> "Chapa ACM 4mm"
 *      "RIPADO" -> "Chapa ACM 4mm com Ripado"
 *  - NAO altera os values (cont. CHAPA / RIPADO) — preserva 100% da logica
 *  - Reage a mudancas do DOM (selects gerados dinamicamente)
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/43-item-revestimento.js
 *  - NAO modifica js/13-planificador_ui.js (BLINDADO)
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - Atua apenas no textContent das options
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta111RenomearTipoChapaApplied) return;
  window.__projetta111RenomearTipoChapaApplied = true;
  console.log("[111-renomear-tipo-chapa] iniciando");

  var MAPA = {
    "CHAPA": "Chapa ACM 4mm",
    "RIPADO": "Chapa ACM 4mm com Ripado"
  };

  function processarOption(opt){
    if(!opt || opt.tagName !== "OPTION") return;
    var v = (opt.value || "").trim();
    if(!v || !MAPA[v]) return;
    var atual = (opt.textContent || "").trim();
    if(atual === MAPA[v]) return;  // ja renomeado
    // Renomeia apenas se o label atual eh exatamente o value (ainda nao renomeado)
    if(atual === v || /^(CHAPA|RIPADO)$/i.test(atual)){
      opt.textContent = MAPA[v];
      console.log("[111-renomear] option \"" + v + "\" renomeada para \"" + MAPA[v] + "\"");
    }
  }

  function processarSelect(sel){
    if(!sel || sel.tagName !== "SELECT") return;
    // So processa selects que tem AMBAS as options CHAPA e RIPADO (revestimento)
    var temChapa = false, temRipado = false;
    Array.from(sel.options).forEach(function(o){
      if(o.value === "CHAPA") temChapa = true;
      if(o.value === "RIPADO") temRipado = true;
    });
    if(!temChapa && !temRipado) return;  // nao eh select de revestimento
    Array.from(sel.options).forEach(processarOption);
  }

  function scan(){
    try {
      Array.from(document.querySelectorAll("select")).forEach(processarSelect);
    } catch(e){
      console.warn("[111-renomear] erro:", e);
    }
  }

  // Scan inicial e periodico (selects podem ser gerados dinamicamente)
  setTimeout(scan, 200);
  setTimeout(scan, 1500);
  setInterval(scan, 1500);

  // Observer pra mudancas do DOM
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      muts.forEach(function(m){
        if(m.addedNodes && m.addedNodes.length){ precisa = true; }
      });
      if(precisa) setTimeout(scan, 50);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[111-renomear-tipo-chapa] instalado");
})();
