/* ============================================================================
 * js/100-frete-maritimo-margem.js  —  Modulo NOVO (26-abr-2026, v3)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido original: "sempre no frete maritimo calcule uma margem de seguranca de 20%"
 * CORRECAO Felipe: "NAO E PARA APARECER PARA CLIENTE ESSA MARGEM ISSO E UMA
 *                  MARGEM INTERNA"
 *
 * v3: margem INVISIVEL ao cliente. Multiplica o valor do frete maritimo por
 *     1.20 IN-PLACE (na propria celula), sem adicionar linha separada. O
 *     cliente ve apenas o valor final ja com 20% somado. O Felipe digita
 *     o custo real (ex: USD 3500) no card CRM, mas a proposta mostra USD 4200.
 *
 *  ANTES (na proposta):
 *    Ocean freight (Santos -> destination port)         USD 3,500.00
 *    TOTAL CIF                                          USD 9,540.00
 *
 *  DEPOIS (na proposta — cliente NAO sabe que tem 20% embutido):
 *    Ocean freight (Santos -> destination port)         USD 4,200.00
 *    TOTAL CIF                                          USD 10,240.00
 *
 * Cobertura ampla — patcha qualquer um destes locais:
 *  - #prop-fob-cif-block (bloco SHIPPING COSTS BREAKDOWN)
 *  - #prop-items-tbody (tabela principal: linha com "Sea Freight" / "Ocean freight")
 *  - Linhas TR de qualquer outro container que contenham frete maritimo
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - NAO modifica js/37-frete-calc.js (BLINDADO)
 *  - Atua apenas no DOM via MutationObserver / polling
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta100FreteMargemApplied) return;
  window.__projetta100FreteMargemApplied = true;
  console.log("[100-frete-margem] iniciando v3 (invisivel)");

  var MARGIN_RATE = 0.20;  // 20% margem de seguranca interna
  var FLAG_ATTR = "data-projetta100MarginV3";
  var ROW_FLAG_ATTR = "data-projetta100RowMarginV3";

  // Regex pra detectar linha do frete maritimo (em PT/EN, varias variacoes)
  var FREIGHT_LABEL_REGEX = new RegExp("(Ocean\\s+freight|Sea\\s+Freight|Frete\\s+mar[ií]timo|Frete\\s+maritimo)", "i");
  var TOTAL_LABEL_REGEX = new RegExp("(TOTAL)\\s+(CIF|FOB|EXW|GERAL)", "i");

  function fmtUSD(v){
    return "USD " + Number(v).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function parseUSDValue(text){
    // FIX v4: detectar formato PT-BR ("3.777" = 3777 milhar) vs EN ("3.777" = 3.777 decimal)
    // Heuristica: se ha exatamente 3 digitos depois do ultimo separador, eh milhar
    if(!text) return 0;
    var clean = String(text).replace(/[^\d,.]/g, "");
    if(!clean) return 0;
    var lastComma = clean.lastIndexOf(",");
    var lastDot = clean.lastIndexOf(".");
    var hasComma = lastComma >= 0;
    var hasDot = lastDot >= 0;
    if(hasComma && hasDot){
      // Ambos: o ultimo eh decimal, o anterior eh milhar
      if(lastComma > lastDot){
        // Ex: "3.777,50" -> 3777.50 (PT-BR)
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        // Ex: "3,777.50" -> 3777.50 (EN-US)
        clean = clean.replace(/,/g, "");
      }
    } else if(hasComma){
      var afterComma = clean.length - lastComma - 1;
      if(afterComma === 3){
        // 3 digitos depois -> milhar (ex: "3,777" EN-US sem decimal)
        clean = clean.replace(/,/g, "");
      } else {
        // 1 ou 2 digitos -> decimal (ex: "3,77" PT-BR)
        clean = clean.replace(",", ".");
      }
    } else if(hasDot){
      var afterDot = clean.length - lastDot - 1;
      if(afterDot === 3){
        // 3 digitos depois -> milhar (ex: "3.777" PT-BR sem decimal) ★ FIX BUG 4.53
        clean = clean.replace(/\./g, "");
      }
      // 1 ou 2 digitos -> ja eh decimal valido (ex: "4.53")
    }
    var n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  // Substitui o numero USD em uma string preservando prefixos/sufixos
  // Ex: "USD 3,500.00" + 4200 -> "USD 4,200.00"
  function substituirValor(textoOriginal, novoValor){
    var fmt = Number(novoValor).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    // Se tinha USD, manter "USD X". Senao, so o numero.
    if(/USD/i.test(textoOriginal)) return "USD " + fmt;
    if(/US\$/i.test(textoOriginal)) return "US$ " + fmt;
    return fmt;
  }

  // Multiplica o valor numerico de uma celula por (1 + MARGIN_RATE), retornando a diff
  function aplicarMargemNaCelula(cell){
    if(!cell || cell.getAttribute(ROW_FLAG_ATTR) === "1") return 0;
    var txt = cell.textContent || "";
    var valor = parseUSDValue(txt);
    if(valor <= 0) return 0;
    var novoValor = valor * (1 + MARGIN_RATE);
    var diff = novoValor - valor;
    cell.textContent = substituirValor(txt, novoValor);
    cell.setAttribute(ROW_FLAG_ATTR, "1");
    return diff;
  }

  // Procura tr/celula contendo o label do frete maritimo dentro de um container
  // Retorna { freightCell, freightDiff } ou null
  function patchFreightRow(container){
    if(!container) return null;
    var rows = container.querySelectorAll("tr");
    for(var i = 0; i < rows.length; i++){
      var row = rows[i];
      var t = row.textContent || "";
      if(FREIGHT_LABEL_REGEX.test(t) && !TOTAL_LABEL_REGEX.test(t)){
        var cells = row.querySelectorAll("td");
        if(cells.length === 0) continue;
        // O valor USD geralmente e a ULTIMA td com numero
        // Mas em layouts complexos pode ser outra coluna (ex: prop-items tem qtd, valor unit, total)
        // Vou tentar a ultima td com numero
        // Multiplicar TODAS as celulas USD desta linha (Unit + Total + ...)
        // mas somar diff so da ULTIMA pro TOTAL CIF (que e a soma da coluna Total)
        var diffUltima = 0;
        for(var c = cells.length - 1; c >= 0; c--){
          var cellTxt = (cells[c].textContent || "").trim();
          if(/USD|US\$/i.test(cellTxt) && parseUSDValue(cellTxt) > 0){
            var diff = aplicarMargemNaCelula(cells[c]);
            if(diff > 0 && diffUltima === 0){
              // Primeira celula com valor (de tras pra frente) e o "Total"
              diffUltima = diff;
            }
          }
        }
        if(diffUltima > 0){
          return { row: row, diff: diffUltima };
        }
      }
    }
    return null;
  }

  // Atualiza o TOTAL CIF/FOB/GERAL somando a diff
  function atualizarTotal(container, diff){
    if(!container || diff <= 0) return false;
    var rows = container.querySelectorAll("tr");
    for(var i = 0; i < rows.length; i++){
      var t = rows[i].textContent || "";
      if(TOTAL_LABEL_REGEX.test(t)){
        var cells = rows[i].querySelectorAll("td");
        if(cells.length === 0) continue;
        for(var c = cells.length - 1; c >= 0; c--){
          var cellTxt = (cells[c].textContent || "").trim();
          var v = parseUSDValue(cellTxt);
          if(v > 0){
            cells[c].textContent = substituirValor(cellTxt, v + diff);
            return true;
          }
        }
      }
    }
    return false;
  }

  function patchContainer(container){
    if(!container) return;
    if(container.getAttribute(FLAG_ATTR) === "1") return;

    var resultado = patchFreightRow(container);
    if(!resultado) return;

    // Atualizar TOTAL no mesmo container (se existir)
    atualizarTotal(container, resultado.diff);

    container.setAttribute(FLAG_ATTR, "1");
    console.log("[100-frete-margem] margem 20% INVISIVEL aplicada: +USD " + resultado.diff.toFixed(2));
  }

  function tick(){
    try {
      // 1. Patch no bloco SHIPPING COSTS BREAKDOWN
      var block = document.getElementById("prop-fob-cif-block");
      if(block) patchContainer(block);

      // 2. Patch na tabela principal de items da proposta
      var tbody = document.getElementById("prop-items-tbody");
      if(tbody){
        // tbody nao e o container completo (precisa do <table> que tem o TOTAL fora do tbody)
        var table = tbody.closest("table") || tbody.parentElement;
        if(table) patchContainer(table);
      }

      // 3. Patch generico — procura por containers com frete maritimo nao patcheados
      var containers = document.querySelectorAll("table, [id*=\"prop\"]");
      for(var i = 0; i < containers.length; i++){
        var c = containers[i];
        if(c.getAttribute(FLAG_ATTR) === "1") continue;
        var txt = c.textContent || "";
        if(FREIGHT_LABEL_REGEX.test(txt) && txt.length < 8000){
          patchContainer(c);
        }
      }
    } catch(e){
      console.warn("[100-frete-margem] erro:", e);
    }
  }

  setInterval(tick, 800);
  setTimeout(tick, 200);
  setTimeout(tick, 1500);

  // MutationObserver: quando containers mudam, RESETAR flag e re-aplicar
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisaTick = false;
      for(var i = 0; i < muts.length; i++){
        var t = muts[i].target;
        if(!t || !t.id) continue;
        if(/prop-fob-cif-block|prop-items|proposta-pg/.test(t.id || "")){
          // Reset flag pra forcar re-patch
          t.removeAttribute(FLAG_ATTR);
          // Tambem resetar nas celulas filhas
          var celulasMarcadas = t.querySelectorAll("[" + ROW_FLAG_ATTR + "]");
          for(var k = 0; k < celulasMarcadas.length; k++){
            celulasMarcadas[k].removeAttribute(ROW_FLAG_ATTR);
          }
          precisaTick = true;
        }
      }
      if(precisaTick) setTimeout(tick, 60);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[100-frete-margem] v3 instalado");
})();
