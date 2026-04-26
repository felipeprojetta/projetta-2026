/* ============================================================================
 * js/100-frete-maritimo-margem.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "sempre no frete maritimo calcule uma margem de seguranca de 20%"
 * Modo escolhido: OPCAO B — margem transparente (linha separada na proposta).
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - NAO modifica js/10-crm.js / crmCifRecalc (BLINDADO)
 *  - NAO modifica js/37-frete-calc.js (BLINDADO)
 *  - Atua apenas no DOM via MutationObserver no #prop-fob-cif-block
 *
 * COMPORTAMENTO:
 *  Quando a proposta internacional (CIF) gera o bloco "SHIPPING COSTS BREAKDOWN":
 *
 *  ANTES:
 *    Ocean freight (Santos -> destination port)         USD 3,500.00
 *    TOTAL CIF                                          USD ...
 *
 *  DEPOIS (Opcao B):
 *    Ocean freight (Santos -> destination port)         USD 3,500.00
 *    Safety margin (20%)                                USD   700.00
 *    TOTAL CIF                                          USD ... (+700)
 *
 * Funciona em PT (Frete maritimo / Margem de seguranca) e EN.
 * Modal CRM e pipeline ficam INTOCADOS — a margem aparece SO na proposta
 * (que e o documento que vai pro cliente). O 20% extra cobrado eh o buffer real
 * pro Felipe contra variacoes cambiais, atrasos, e custos imprevistos.
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta100FreteMargemApplied) return;
  window.__projetta100FreteMargemApplied = true;
  console.log("[100-frete-margem] iniciando");

  var MARGIN_RATE = 0.20;  // 20% margem de seguranca
  var FLAG_ATTR = "data-projetta100MarginApplied";

  // Regex pra detectar linha do frete maritimo (em PT e EN)
  var FREIGHT_LABEL_REGEX = new RegExp("(Ocean\\s+freight|Frete\\s+mar[ií]timo)", "i");
  var TOTAL_LABEL_REGEX = new RegExp("(TOTAL)\\s+(CIF|FOB|EXW)", "i");

  function fmtUSD(v){
    return "USD " + Number(v).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function parseUSDValue(text){
    if(!text) return 0;
    // Tirar tudo exceto digitos, virgula, ponto
    var clean = String(text).replace(/[^\d,.]/g, "");
    if(!clean) return 0;
    // Detectar formato: se tem virgula como separador decimal (PT-BR), trocar
    // Padrao: "3,500.00" (en) ou "3.500,00" (pt) ou "3500" (sem)
    var lastComma = clean.lastIndexOf(",");
    var lastDot = clean.lastIndexOf(".");
    if(lastComma > lastDot){
      // Formato PT: 3.500,00 -> 3500.00
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato EN: 3,500.00 -> 3500.00
      clean = clean.replace(/,/g, "");
    }
    var n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  function patchProposta(){
    var block = document.getElementById("prop-fob-cif-block");
    if(!block) return;
    if(block.getAttribute(FLAG_ATTR) === "1") return;  // ja aplicado

    var rows = block.querySelectorAll("tr");
    if(!rows || rows.length === 0) return;

    // Achar linha do frete maritimo
    var freightRow = null;
    var freightUSD = 0;
    var isEn = true;
    for(var i = 0; i < rows.length; i++){
      var t = rows[i].textContent || "";
      if(FREIGHT_LABEL_REGEX.test(t)){
        freightRow = rows[i];
        isEn = /Ocean\s+freight/i.test(t);
        // Extrair USD do ultimo TD
        var cells = rows[i].querySelectorAll("td");
        if(cells.length >= 2){
          var lastCellText = (cells[cells.length - 1].textContent || "").trim();
          freightUSD = parseUSDValue(lastCellText);
        }
        break;
      }
    }

    if(!freightRow || freightUSD <= 0) return;

    var marginUSD = freightUSD * MARGIN_RATE;
    var labelMargin = isEn
      ? "Safety margin (20%)"
      : "Margem de seguran\u00e7a (20%)";

    // Construir nova linha clonando o estilo da freightRow
    var newRow = freightRow.cloneNode(true);
    var newCells = newRow.querySelectorAll("td");
    if(newCells.length >= 2){
      // Primeira celula: label
      newCells[0].textContent = labelMargin;
      // Estilizar como secundario (italico + cor mais clara)
      newCells[0].style.fontStyle = "italic";
      newCells[0].style.color = "#666";
      // Limpar celulas intermediarias se houver
      for(var j = 1; j < newCells.length - 1; j++){
        newCells[j].textContent = "";
      }
      // Ultima celula: valor USD
      var lastNewCell = newCells[newCells.length - 1];
      lastNewCell.textContent = fmtUSD(marginUSD);
      lastNewCell.style.fontStyle = "italic";
      lastNewCell.style.color = "#666";
    }

    // Inserir nova linha apos freightRow
    if(freightRow.parentNode){
      freightRow.parentNode.insertBefore(newRow, freightRow.nextSibling);
    }

    // Atualizar TOTAL CIF/FOB — somar a margem no total existente
    for(var k = 0; k < rows.length; k++){
      var tt = rows[k].textContent || "";
      if(TOTAL_LABEL_REGEX.test(tt)){
        var totalCells = rows[k].querySelectorAll("td");
        if(totalCells.length > 0){
          var totalCell = totalCells[totalCells.length - 1];
          var oldTotal = parseUSDValue(totalCell.textContent || "");
          if(oldTotal > 0){
            var newTotal = oldTotal + marginUSD;
            totalCell.textContent = fmtUSD(newTotal);
          }
        }
        break;
      }
    }

    block.setAttribute(FLAG_ATTR, "1");
    console.log("[100-frete-margem] margem 20% aplicada: +USD " + marginUSD.toFixed(2));
  }

  function tick(){
    try { patchProposta(); } catch(e){ console.warn("[100-frete-margem] erro:", e); }
  }

  // Polling 800ms — aplica quando proposta intl renderiza
  setInterval(tick, 800);
  setTimeout(tick, 200);
  setTimeout(tick, 1500);

  // MutationObserver: quando #prop-fob-cif-block muda, RESETAR flag e re-aplicar
  // (porque as funcoes da proposta sobrescrevem todo o innerHTML)
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      for(var i = 0; i < muts.length; i++){
        var t = muts[i].target;
        if(t && t.id === "prop-fob-cif-block"){
          // Detectar se foi um RE-render (mais TR foram criadas) — resetar flag
          var hasFreshContent = false;
          if(muts[i].addedNodes){
            for(var n = 0; n < muts[i].addedNodes.length; n++){
              var an = muts[i].addedNodes[n];
              if(an.nodeType === 1){ hasFreshContent = true; break; }
            }
          }
          if(hasFreshContent){
            t.removeAttribute(FLAG_ATTR);
            setTimeout(tick, 60);
          }
          return;
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[100-frete-margem] instalado");
})();
