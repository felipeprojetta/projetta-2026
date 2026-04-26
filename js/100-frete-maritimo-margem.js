/* ============================================================================
 * js/100-frete-maritimo-margem.js  —  Modulo NOVO (26-abr-2026, v5)
 *
 * Autorizado por Felipe Xavier de Lima.
 *
 * v5: SEM CASAS DECIMAIS + detecta multiplos padroes de TOTAL (Total Quote,
 *     TOTAL CIF, etc) + atualiza TODOS elementos visiveis com totais
 *
 *  ANTES (com bug v4):
 *    Sea Freight: US$ 4,532.40
 *    TOTAL = 29,821 (soma desatualizada — bug)
 *
 *  DEPOIS (v5):
 *    Sea Freight: US$ 4,532  (sem decimais)
 *    Total Quote = US$ 30,577  (atualizado)
 *    Total Area: 10.6 m² (NAO altera porque m²)
 *
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta100FreteMargemApplied) return;
  window.__projetta100FreteMargemApplied = true;
  console.log("[100-frete-margem] iniciando v5");

  var MARGIN_RATE = 0.20;
  var FLAG_ATTR = "data-projetta100MarginV5";
  var ROW_FLAG_ATTR = "data-projetta100RowMarginV5";

  // Regex pra detectar linha do frete maritimo (PT/EN, varias variacoes)
  var FREIGHT_LABEL_REGEX = new RegExp("(Ocean\\s+freight|Sea\\s+Freight|Frete\\s+mar[ií]timo|Frete\\s+maritimo)", "i");
  // Regex pra TOTAL — exclui "Total Area" (que e m², nao USD)
  // Casa: "TOTAL CIF/FOB/EXW", "Total Quote", "Total Geral", "TOTAL"
  var TOTAL_LABEL_REGEX = /Total\s+(?:Quote|CIF|FOB|EXW|GERAL|Geral|Price|Value)|(?:^|\s|>)TOTAL(?=\s*[:|<]|$)/i;

  function fmtUSD_int(v){
    // SEM decimais — Felipe nao quer decimais
    return "US$ " + Math.round(Number(v)).toLocaleString("en-US");
  }

  function parseUSDValue(text){
    if(!text) return 0;
    var clean = String(text).replace(/[^\d,.]/g, "");
    if(!clean) return 0;
    var lastComma = clean.lastIndexOf(",");
    var lastDot = clean.lastIndexOf(".");
    var hasComma = lastComma >= 0;
    var hasDot = lastDot >= 0;
    if(hasComma && hasDot){
      if(lastComma > lastDot){
        clean = clean.replace(/\./g, "").replace(",", ".");
      } else {
        clean = clean.replace(/,/g, "");
      }
    } else if(hasComma){
      var afterComma = clean.length - lastComma - 1;
      if(afterComma === 3) clean = clean.replace(/,/g, "");
      else clean = clean.replace(",", ".");
    } else if(hasDot){
      var afterDot = clean.length - lastDot - 1;
      if(afterDot === 3) clean = clean.replace(/\./g, "");
    }
    var n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  // Substitui valor numerico em uma string preservando prefixos USD/US$
  function substituirValor(textoOriginal, novoValor){
    var t = String(textoOriginal);
    if(/USD/i.test(t)) return "USD " + Math.round(novoValor).toLocaleString("en-US");
    if(/US\$/i.test(t)) return "US$ " + Math.round(novoValor).toLocaleString("en-US");
    return Math.round(novoValor).toLocaleString("en-US");
  }

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

  // Procura linha do frete em um container, retorna { row, diff }
  function patchFreightRow(container){
    if(!container) return null;
    var rows = container.querySelectorAll("tr");
    for(var i = 0; i < rows.length; i++){
      var row = rows[i];
      var t = row.textContent || "";
      if(FREIGHT_LABEL_REGEX.test(t) && !TOTAL_LABEL_REGEX.test(t)){
        var cells = row.querySelectorAll("td");
        if(cells.length === 0) continue;
        var diffUltima = 0;
        for(var c = cells.length - 1; c >= 0; c--){
          var cellTxt = (cells[c].textContent || "").trim();
          if(/USD|US\$/i.test(cellTxt) && parseUSDValue(cellTxt) > 0){
            var diff = aplicarMargemNaCelula(cells[c]);
            if(diff > 0 && diffUltima === 0){
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

  // Atualiza TODOS elementos com Total Quote, TOTAL CIF, etc no DOCUMENTO INTEIRO
  function atualizarTodosTotais(diff){
    if(diff <= 0) return 0;
    var totaisAtualizados = 0;

    // 1. TRs com TOTAL (em qualquer tabela)
    var rows = document.querySelectorAll("tr");
    for(var i = 0; i < rows.length; i++){
      var row = rows[i];
      if(row.getAttribute(ROW_FLAG_ATTR) === "total") continue;
      var rowText = row.textContent || "";
      // Pular linhas de m² ou peso
      if(/m²|m2|kg|lb/i.test(rowText) && !TOTAL_LABEL_REGEX.test(rowText)) continue;
      // So aplicar se tem padrao de TOTAL
      if(!TOTAL_LABEL_REGEX.test(rowText)) continue;
      var cells = row.querySelectorAll("td");
      for(var c = cells.length - 1; c >= 0; c--){
        var cellTxt = (cells[c].textContent || "").trim();
        if(/USD|US\$/i.test(cellTxt) && parseUSDValue(cellTxt) > 0){
          var oldVal = parseUSDValue(cellTxt);
          cells[c].textContent = substituirValor(cellTxt, oldVal + diff);
          row.setAttribute(ROW_FLAG_ATTR, "total");
          totaisAtualizados++;
          break; // so a ULTIMA celula USD da row
        }
      }
    }

    // 2. Elementos NAO tabela (div, span) com "Total Quote: US$ X" no mesmo elemento
    var spans = document.querySelectorAll("div, span, p, b, strong");
    for(var s = 0; s < spans.length; s++){
      var el = spans[s];
      if(el.getAttribute(ROW_FLAG_ATTR) === "total") continue;
      // So elementos folha (sem filhos com texto)
      if(el.children.length > 5) continue;
      var t2 = (el.textContent || "").trim();
      // Casar "Total Quote: US$ X" ou "TOTAL: US$ X" no proprio elemento
      if(t2.length > 200) continue;
      if(!/total/i.test(t2)) continue;
      // Pular se for "Total Area" ou similar com m²
      if(/m²|m2/i.test(t2) && !/USD|US\$/.test(t2)) continue;
      if(!/USD|US\$/i.test(t2)) continue;
      // Casar padrao tipo "Total Quote: US$ 29,821"
      var match = t2.match(/(Total\s+(?:Quote|Price|CIF|FOB|EXW|Geral|GERAL|Value)|TOTAL)\s*[:]?\s*(US?\$?\s*[\d,.\s]+)/i);
      if(!match) continue;
      var valorAtual = parseUSDValue(match[2]);
      if(valorAtual <= 0) continue;
      var valorNovo = valorAtual + diff;
      // Substituir DENTRO do innerHTML preservando estrutura
      el.innerHTML = el.innerHTML.replace(match[2], substituirValor(match[2], valorNovo));
      el.setAttribute(ROW_FLAG_ATTR, "total");
      totaisAtualizados++;
    }

    return totaisAtualizados;
  }

  function patchContainer(container){
    if(!container) return;
    if(container.getAttribute(FLAG_ATTR) === "1") return;
    var resultado = patchFreightRow(container);
    if(!resultado) return;
    container.setAttribute(FLAG_ATTR, "1");
    // Atualizar TODOS os totais da pagina (nao so do container)
    var qtd = atualizarTodosTotais(resultado.diff);
    console.log("[100-frete-margem] margem 20% INVISIVEL aplicada: +US$ " + Math.round(resultado.diff) + " (" + qtd + " totais atualizados)");
  }

  function tick(){
    try {
      var block = document.getElementById("prop-fob-cif-block");
      if(block) patchContainer(block);
      var tbody = document.getElementById("prop-items-tbody");
      if(tbody){
        var table = tbody.closest("table") || tbody.parentElement;
        if(table) patchContainer(table);
      }
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

  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      for(var i = 0; i < muts.length; i++){
        var t = muts[i].target;
        if(!t || !t.id) continue;
        if(/prop-fob-cif-block|prop-items|proposta-pg/.test(t.id || "")){
          t.removeAttribute(FLAG_ATTR);
          var marcadas = t.querySelectorAll("[" + ROW_FLAG_ATTR + "]");
          for(var k = 0; k < marcadas.length; k++) marcadas[k].removeAttribute(ROW_FLAG_ATTR);
          // Resetar TODOS os totais marcados na pagina
          var totaisMarcados = document.querySelectorAll("[" + ROW_FLAG_ATTR + "=\"total\"]");
          for(var m = 0; m < totaisMarcados.length; m++) totaisMarcados[m].removeAttribute(ROW_FLAG_ATTR);
          precisa = true;
        }
      }
      if(precisa) setTimeout(tick, 60);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[100-frete-margem] v5 instalado");
})();
