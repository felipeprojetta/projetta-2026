/* ============================================================================
 * js/110-renomear-label-data.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "mude nome para data reserva intranet"
 *
 * COMPORTAMENTO:
 *  - Procura textos "Data Primeiro Contato", "Data 1o Contato", "1o Contato"
 *    no DOM (labels, headers, etc) e troca para "Data Reserva Intranet"
 *  - Reage a mudancas dinamicas
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - Atua via text node replacement (sem mexer em event handlers)
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta110RenomearLabelApplied) return;
  window.__projetta110RenomearLabelApplied = true;
  console.log("[110-renomear-label-data] iniciando");

  var PADROES = [
    { de: /Data\s+Primeiro\s+Contato/gi, para: "Data Reserva Intranet" },
    { de: /Data\s+1[ºo°]\s*Contato/gi, para: "Data Reserva Intranet" },
    { de: /Primeiro\s+Contato/gi, para: "Reserva Intranet" },
    { de: /1[ºo°]\s+Contato/gi, para: "Reserva Intranet" }
  ];

  function processNode(node){
    if(!node) return;
    if(node.nodeType === 3){
      // Text node
      var orig = node.nodeValue;
      if(!orig) return;
      var novo = orig;
      for(var i = 0; i < PADROES.length; i++){
        novo = novo.replace(PADROES[i].de, PADROES[i].para);
      }
      if(novo !== orig){ node.nodeValue = novo; }
    } else if(node.nodeType === 1 && node.childNodes){
      // Element — processa filhos
      // Pula scripts/styles/inputs (nao tem texto visivel relevante)
      var tag = node.tagName;
      if(tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") return;
      // Tambem checar atributos placeholder e title
      if(node.getAttribute){
        ["placeholder", "title", "aria-label"].forEach(function(attr){
          var v = node.getAttribute(attr);
          if(v){
            var novoV = v;
            for(var j = 0; j < PADROES.length; j++){
              novoV = novoV.replace(PADROES[j].de, PADROES[j].para);
            }
            if(novoV !== v) node.setAttribute(attr, novoV);
          }
        });
      }
      for(var k = 0; k < node.childNodes.length; k++){
        processNode(node.childNodes[k]);
      }
    }
  }

  function scan(){
    try { processNode(document.body); }
    catch(e){ console.warn("[110-label] erro scan:", e); }
  }

  // Scan inicial e regular
  setTimeout(scan, 200);
  setTimeout(scan, 1500);
  setInterval(scan, 1500);

  // Observer pra mudancas dinamicas
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        if(m.addedNodes && m.addedNodes.length){
          m.addedNodes.forEach(function(n){ processNode(n); });
        }
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[110-renomear-label-data] instalado");
})();
