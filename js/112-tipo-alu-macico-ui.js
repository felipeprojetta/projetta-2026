/* ============================================================================
 * js/112-tipo-alu-macico-ui.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * ETAPA B (parte 1 — UI) do refactor de revestimento.
 *
 * COMPORTAMENTO:
 *  1. Adiciona 2 novas opcoes no select rev_tipo:
 *      value="ALU_MACICO"          label="Chapa Alu Macico 2.5"
 *      value="ALU_MACICO_BOISERIE" label="Chapa Alu Macico 2.5 + Boiserie"
 *  2. Quando user seleciona uma das opcoes Alu Macico:
 *      - Esconde os campos cor_ext e cor_int (cores ACM)
 *      - Esconde os search inputs proximos (crm-color-search)
 *      - MOSTRA cor_macico (ja existe no app, com SOLIDA + MADEIRA)
 *  3. Quando volta pra CHAPA ou RIPADO:
 *      - Mostra cor_ext e cor_int
 *      - Esconde cor_macico
 *
 * ATENCAO: Mod 112 cuida APENAS da UI. O CALCULO ainda usa formula da chapa ACM
 * (sera corrigido no mod 113).
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/13-planificador_ui.js (BLINDADO)
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - NAO modifica js/43-item-revestimento.js
 *  - NAO modifica js/01-shared.js
 *  - Atua apenas via DOM
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta112AluMacicoUiApplied) return;
  window.__projetta112AluMacicoUiApplied = true;
  console.log("[112-tipo-alu-macico-ui] iniciando");

  var NOVAS_OPCOES = [
    { value: "ALU_MACICO",          label: "Chapa Alu Maciço 2.5" },
    { value: "ALU_MACICO_BOISERIE", label: "Chapa Alu Maciço 2.5 + Boiserie" }
  ];

  function isAluMacico(value){
    return value === "ALU_MACICO" || value === "ALU_MACICO_BOISERIE";
  }

  function adicionarOpcoes(sel){
    if(!sel || sel.tagName !== "SELECT") return;
    // So processa selects que tem CHAPA + RIPADO (revestimento)
    var temChapa = false, temRipado = false;
    Array.from(sel.options).forEach(function(o){
      if(o.value === "CHAPA") temChapa = true;
      if(o.value === "RIPADO") temRipado = true;
    });
    if(!temChapa || !temRipado) return;

    NOVAS_OPCOES.forEach(function(opt){
      var jaTem = Array.from(sel.options).some(function(o){ return o.value === opt.value; });
      if(!jaTem){
        var optEl = document.createElement("option");
        optEl.value = opt.value;
        optEl.textContent = opt.label;
        sel.appendChild(optEl);
        console.log("[112-alu-ui] adicionada opcao " + opt.value + " ao select " + sel.id);
      }
    });

    // Hookar listener (1x)
    if(!sel.__projetta112Hooked){
      sel.__projetta112Hooked = true;
      sel.addEventListener("change", function(){ aplicarVisibilidade(sel); });
      // Aplicar visibilidade inicial baseada no valor atual
      aplicarVisibilidade(sel);
    }
  }

  // Pega os "primos" cor_ext, cor_int e cor_macico baseado no select rev_tipo
  function getCamposCor(sel){
    if(!sel || !sel.id) return null;
    // ID padrao: crmit-ci_TIMESTAMP_HASH-rev_tipo  -> trocar -rev_tipo por -cor_xxx
    var prefix = sel.id.replace(/-rev_tipo$/, "");
    return {
      cor_ext:    document.getElementById(prefix + "-cor_ext"),
      cor_int:    document.getElementById(prefix + "-cor_int"),
      cor_macico: document.getElementById(prefix + "-cor_macico")
    };
  }

  // Pega o "wrapper crm-field" mais proximo (avo do select)
  function getCrmField(el){
    if(!el) return null;
    var p = el.parentElement;
    while(p && p !== document.body){
      if(p.classList && p.classList.contains("crm-field")) return p;
      p = p.parentElement;
    }
    return el.parentElement && el.parentElement.parentElement;
  }

  // Tambem esconder o input crm-color-search ANTERIOR ao select (busca da cor)
  function getSearchInput(corSel){
    if(!corSel) return null;
    // Procura input.crm-color-search no mesmo crm-field
    var fld = getCrmField(corSel);
    if(!fld) return null;
    return fld.querySelector("input.crm-color-search");
  }

  function setVisivel(field, visivel){
    if(!field) return;
    if(visivel){
      field.style.display = "";
      field.removeAttribute("data-projetta112Hidden");
    } else {
      field.style.display = "none";
      field.setAttribute("data-projetta112Hidden", "1");
    }
  }

  function aplicarVisibilidade(sel){
    if(!sel) return;
    var campos = getCamposCor(sel);
    if(!campos) return;
    var fldExt = getCrmField(campos.cor_ext);
    var fldInt = getCrmField(campos.cor_int);
    var fldMac = getCrmField(campos.cor_macico);
    var aluMode = isAluMacico(sel.value);

    setVisivel(fldExt, !aluMode);
    setVisivel(fldInt, !aluMode);
    setVisivel(fldMac, aluMode);

    console.log("[112-alu-ui] tipo=" + sel.value + " aluMode=" + aluMode + " (cor_ext/int " + (aluMode?"escondido":"visivel") + ", cor_macico " + (aluMode?"visivel":"escondido") + ")");
  }

  function scan(){
    try {
      Array.from(document.querySelectorAll("select")).forEach(adicionarOpcoes);
    } catch(e){
      console.warn("[112-alu-ui] erro:", e);
    }
  }

  setTimeout(scan, 200);
  setTimeout(scan, 1500);
  setInterval(scan, 1500);

  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      muts.forEach(function(m){ if(m.addedNodes && m.addedNodes.length){ precisa = true; } });
      if(precisa) setTimeout(scan, 50);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[112-tipo-alu-macico-ui] instalado");
})();
