/* ============================================================================
 * js/113-alu-macico-cor-options.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * ETAPA B (parte 2 — calculo) do refactor de revestimento.
 *
 * COMPORTAMENTO:
 *  - Quando rev_tipo eh ALU_MACICO ou ALU_MACICO_BOISERIE:
 *    Popula cor_macico com as 8 opcoes de chapa (4 SOLIDA + 4 MADEIRA)
 *    Format value: "preco|area" (igual ACM) — planificador le do mesmo jeito
 *
 *  - Quando volta pra CHAPA ou RIPADO (tipos ACM):
 *    Restaura as 2 opcoes originais do cor_macico (SOLIDA / MADEIRA categorias)
 *
 * TABELA DE PRECOS (extraida de js/01-shared.js linha 155-159):
 *  SOLIDA:
 *    1500×3000 → R$ 1.429,38 (4.5m²)
 *    1500×5000 → R$ 2.382,30 (7.5m²)
 *    1500×6000 → R$ 2.858,76 (9.0m²)
 *    1500×6600 → R$ 3.045,64 (9.9m²)
 *  MADEIRA:
 *    1500×3000 → R$ 2.291,87 (4.5m²)
 *    1500×5000 → R$ 3.819,78 (7.5m²)
 *    1500×6000 → R$ 4.583,73 (9.0m²)
 *    1500×6600 → R$ 4.883,37 (9.9m²)
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/13-planificador_ui.js (BLINDADO)
 *  - NAO modifica js/01-shared.js
 *  - Atua via DOM
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta113AluCorOptionsApplied) return;
  window.__projetta113AluCorOptionsApplied = true;
  console.log("[113-alu-macico-cor-options] iniciando");

  // Tabela de chapas Alu Macico (de js/01-shared.js)
  // Format: { l: label, p: preco_total_chapa, a: area_m2, w: largura_mm, h: altura_mm, cat: categoria }
  var ALU_CHAPAS = [
    { l: "ALU 2,5mm SÓLIDA · 1500×3000",  p: 1429.38, a: 4.5, w: 1500, h: 3000, cat: "SOLIDA"  },
    { l: "ALU 2,5mm SÓLIDA · 1500×5000",  p: 2382.30, a: 7.5, w: 1500, h: 5000, cat: "SOLIDA"  },
    { l: "ALU 2,5mm SÓLIDA · 1500×6000",  p: 2858.76, a: 9.0, w: 1500, h: 6000, cat: "SOLIDA"  },
    { l: "ALU 2,5mm SÓLIDA · 1500×6600",  p: 3045.64, a: 9.9, w: 1500, h: 6600, cat: "SOLIDA"  },
    { l: "ALU 2,5mm MADEIRA · 1500×3000", p: 2291.87, a: 4.5, w: 1500, h: 3000, cat: "MADEIRA" },
    { l: "ALU 2,5mm MADEIRA · 1500×5000", p: 3819.78, a: 7.5, w: 1500, h: 5000, cat: "MADEIRA" },
    { l: "ALU 2,5mm MADEIRA · 1500×6000", p: 4583.73, a: 9.0, w: 1500, h: 6000, cat: "MADEIRA" },
    { l: "ALU 2,5mm MADEIRA · 1500×6600", p: 4883.37, a: 9.9, w: 1500, h: 6600, cat: "MADEIRA" }
  ];

  function fmtBRL(v){
    return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function isAluMacico(value){
    return value === "ALU_MACICO" || value === "ALU_MACICO_BOISERIE";
  }

  // Salva opcoes originais antes de sobrescrever (idempotente)
  function backupOpcoes(sel){
    if(!sel) return;
    if(sel.__projetta113Original) return;  // ja salvo
    sel.__projetta113Original = Array.from(sel.options).map(function(o){
      return { value: o.value, text: o.textContent };
    });
  }

  function restaurarOriginal(sel){
    if(!sel || !sel.__projetta113Original) return;
    if(sel.__projetta113EmModoAlu !== true) return;  // ja esta no original
    var atual = sel.value;
    sel.innerHTML = "";
    sel.__projetta113Original.forEach(function(opt){
      var o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.text;
      sel.appendChild(o);
    });
    sel.__projetta113EmModoAlu = false;
    // Tentar restaurar valor anterior
    if(Array.from(sel.options).some(function(o){ return o.value === atual; })){
      sel.value = atual;
    }
  }

  function popularComAluChapas(sel){
    if(!sel) return;
    backupOpcoes(sel);
    if(sel.__projetta113EmModoAlu === true) return;  // ja populado

    sel.innerHTML = "";
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— Selecionar chapa Alu Maciço —";
    sel.appendChild(placeholder);

    ALU_CHAPAS.forEach(function(ch){
      var o = document.createElement("option");
      o.value = ch.p.toFixed(2) + "|" + ch.a;
      o.textContent = ch.l + "  ·  " + fmtBRL(ch.p) + "/chapa";
      o.setAttribute("data-projetta113-cat", ch.cat);
      o.setAttribute("data-projetta113-w", ch.w);
      o.setAttribute("data-projetta113-h", ch.h);
      sel.appendChild(o);
    });

    sel.__projetta113EmModoAlu = true;
    console.log("[113-alu-cor] cor_macico " + sel.id + " populado com " + ALU_CHAPAS.length + " chapas Alu");
  }

  function processarRevTipoSelect(tipoSel){
    if(!tipoSel || !tipoSel.id || !tipoSel.id.endsWith("-rev_tipo")) return;
    var prefix = tipoSel.id.replace(/-rev_tipo$/, "");
    var corMacicoSel = document.getElementById(prefix + "-cor_macico");
    if(!corMacicoSel) return;

    if(isAluMacico(tipoSel.value)){
      popularComAluChapas(corMacicoSel);
    } else {
      restaurarOriginal(corMacicoSel);
    }
  }

  function attachListeners(){
    Array.from(document.querySelectorAll("[id$=\"-rev_tipo\"]")).forEach(function(sel){
      if(sel.__projetta113Hooked) return;
      sel.__projetta113Hooked = true;
      sel.addEventListener("change", function(){ processarRevTipoSelect(sel); });
      // Aplicar imediatamente baseado no valor atual
      processarRevTipoSelect(sel);
    });
  }

  setTimeout(attachListeners, 250);
  setTimeout(attachListeners, 1500);
  setInterval(attachListeners, 1500);

  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      muts.forEach(function(m){ if(m.addedNodes && m.addedNodes.length){ precisa = true; } });
      if(precisa) setTimeout(attachListeners, 50);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[113-alu-macico-cor-options] instalado");
})();
