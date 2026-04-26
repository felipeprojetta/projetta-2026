/* ============================================================================
 * js/101-frete-margem-display-crm.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "MOSTRE NESSE CAMPO O ORIGINAL E +20% MOSTRANDO TOTAL COM 20% A MAIS
 *          PARA CONFERENCIA COM A PROPOSTA"
 *
 * Adiciona um indicador visual abaixo do input crm-o-cif-frete-maritimo no
 * modal CRM mostrando:
 *
 *   FRETE MARITIMO (US$): [ 3777 ]
 *   ℹ Original: US$ 3,777.00 | +20%: US$ 755.40 | Cliente paga: US$ 4,532.40
 *
 * Ajuda Felipe a conferir o valor que aparecera na proposta com a margem ja
 * embutida.
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - NAO altera o input nem outros campos
 *  - Apenas insere um <div> de display abaixo do input
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta101FreteMargemDisplayApplied) return;
  window.__projetta101FreteMargemDisplayApplied = true;
  console.log("[101-frete-margem-display] iniciando");

  var MARGIN_RATE = 0.20;
  var DISPLAY_ID = "projetta-101-margem-display";

  function fmtUSD(v){
    return Number(v).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getInputValue(inp){
    var raw = (inp.value || "").trim();
    if(!raw) return 0;
    // Input tipo number aceita ponto como decimal e nao tem milhar
    // Mas se for digitado a mao com formato pt-BR pode ter ponto/virgula
    var clean = raw.replace(/[^\d,.]/g, "");
    if(!clean) return 0;
    var lastComma = clean.lastIndexOf(",");
    var lastDot = clean.lastIndexOf(".");
    if(lastComma >= 0 && lastDot >= 0){
      if(lastComma > lastDot){
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        clean = clean.replace(/,/g, "");
      }
    } else if(lastComma >= 0){
      var ac = clean.length - lastComma - 1;
      if(ac === 3) clean = clean.replace(/,/g, "");
      else clean = clean.replace(",", ".");
    } else if(lastDot >= 0){
      var ad = clean.length - lastDot - 1;
      if(ad === 3) clean = clean.replace(/\./g, "");
    }
    var n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  function ensureDisplay(inp){
    var existing = document.getElementById(DISPLAY_ID);
    if(existing) return existing;
    var div = document.createElement("div");
    div.id = DISPLAY_ID;
    div.style.cssText = [
      "margin-top:6px",
      "padding:8px 10px",
      "background:linear-gradient(90deg,#fff8e1 0%,#fef3c7 100%)",
      "border:1px dashed #d97706",
      "border-radius:6px",
      "font-size:11px",
      "font-family:inherit",
      "color:#78350f",
      "display:none"
    ].join(";");
    // Inserir logo apos o input (no mesmo wrap)
    var parent = inp.parentElement;
    if(parent){
      // Tentar inserir apos o input
      if(inp.nextSibling) parent.insertBefore(div, inp.nextSibling);
      else parent.appendChild(div);
    }
    return div;
  }

  function atualizar(){
    var inp = document.getElementById("crm-o-cif-frete-maritimo");
    if(!inp) return;
    if(inp.offsetParent === null) return; // input nao visivel (modal fechado)

    var div = ensureDisplay(inp);
    var val = getInputValue(inp);

    if(val <= 0){
      div.style.display = "none";
      return;
    }

    var margem = val * MARGIN_RATE;
    var total = val + margem;

    div.innerHTML =
      '<span style="font-weight:700">🛡 Margem interna 20% (invisivel ao cliente):</span><br>' +
      '<span style="display:inline-block;margin-top:3px">' +
      '<span style="color:#666">Original:</span> <b>US$ ' + fmtUSD(val) + '</b>' +
      ' &nbsp;<span style="color:#999">+ 20% =</span> US$ ' + fmtUSD(margem) +' ' +
      ' &nbsp;<span style="color:#1565c0;font-weight:700">→ Cliente paga: US$ ' + fmtUSD(total) + '</span>' +
      '</span>';
    div.style.display = "block";
  }

  // Hook: quando o usuario digita no input, atualizar imediatamente
  function attachInputListener(){
    var inp = document.getElementById("crm-o-cif-frete-maritimo");
    if(!inp || inp.__projetta101Hooked) return;
    inp.__projetta101Hooked = true;
    inp.addEventListener("input", atualizar);
    inp.addEventListener("change", atualizar);
  }

  function tick(){
    try {
      attachInputListener();
      atualizar();
    } catch(e){
      console.warn("[101-frete-margem-display] erro:", e);
    }
  }

  setInterval(tick, 700);
  setTimeout(tick, 200);
  setTimeout(tick, 1500);

  console.log("[101-frete-margem-display] instalado");
})();
