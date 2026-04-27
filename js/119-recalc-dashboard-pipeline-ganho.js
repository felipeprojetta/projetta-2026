/* ============================================================================
 * 119-recalc-dashboard-pipeline-ganho.js — v3 (27-abr-2026)
 *
 * Felipe 27/04: NEUTRALIZADO parcialmente.
 *  - REMOVIDO setInterval(2500) que sobrescreve ck-pipe/ck-tot-tab/ck-tot-fat
 *    (causava o card piscar e ignorar componente CIF)
 *  - REMOVIDO MutationObserver agressivo que travava KPIs em valor errado
 *  - MANTIDA apenas atualizacao de Ganho Mes/Ano (vem de orcamentos_fechados,
 *    logica diferente que o 10-crm nao faz)
 *  - Pipeline, Total Tabela, Total Faturam ficam por conta do 10-crm.js
 *    (que ja calcula CORRETO incluindo CIF×cambio)
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta119RecalcDashApplied) return;
  window.__projetta119RecalcDashApplied = "v3";
  console.log("[119-recalc-dash v3] iniciando — SO ganho mes/ano");

  var SB_URL = "https://plmliavuwlgpwaizfeds.supabase.co";

  function sbFetch(path){
    return fetch(SB_URL + path, {
      headers: {
        "apikey": window._SB_KEY,
        "Authorization": "Bearer " + window._SB_KEY
      }
    });
  }
  function fmtBRL(v){ return "R$ " + Math.round(Number(v)||0).toLocaleString("pt-BR"); }

  function setText(id, txt){
    var el = document.getElementById(id);
    if(el && el.textContent !== txt){ el.textContent = txt; }
  }

  function getFiltros(){
    var mesEl = document.getElementById("ck-gain-mes-sel");
    var anoEl = document.getElementById("ck-gain-ano-sel");
    var mesAno = mesEl ? mesEl.value : "";
    var anoSel = anoEl ? anoEl.value : "";
    return {
      mesAno: mesAno,
      ano: anoSel || (mesAno ? mesAno.substring(0,4) : new Date().getFullYear().toString()),
      anoMes: mesAno ? parseInt(mesAno.substring(0,4), 10) : null
    };
  }

  var jaCalculando = false;
  var ultimoFetchMs = 0;

  async function recalcularGanhos(){
    if(jaCalculando) return;
    // Throttle: minimo 30s entre chamadas (evita spam)
    var agora = Date.now();
    if(agora - ultimoFetchMs < 30000) return;
    ultimoFetchMs = agora;
    jaCalculando = true;
    try {
      var f = getFiltros();
      var anoSel = parseInt(f.ano, 10);

      var anoStart = anoSel + "-01-01";
      var anoEnd = anoSel + "-12-31";
      var rOf = await sbFetch("/rest/v1/orcamentos_fechados?data_fechamento_pedido=gte." + anoStart + "&data_fechamento_pedido=lte." + anoEnd + "&select=card_id,valor_fechado,data_fechamento_pedido");
      var fechados = await rOf.json();
      if(!Array.isArray(fechados)) fechados = [];

      var ganhoMes = 0, qtdGanhosMes = 0;
      var ganhoAno = 0, qtdGanhosAno = 0;

      var fechadosDoMes = [];
      if(f.mesAno){
        if(f.anoMes === anoSel){
          fechadosDoMes = fechados.filter(function(fc){
            return (fc.data_fechamento_pedido || "").substring(0,7) === f.mesAno;
          });
        }
      }
      fechadosDoMes.forEach(function(fc){
        ganhoMes += parseFloat(fc.valor_fechado) || 0;
        qtdGanhosMes++;
      });

      fechados.forEach(function(fc){
        ganhoAno += parseFloat(fc.valor_fechado) || 0;
        qtdGanhosAno++;
      });

      var ticket = qtdGanhosAno > 0 ? (ganhoAno / qtdGanhosAno) : 0;

      // ★ SO ganhos. Pipeline/Tab/Fat ficam por conta do 10-crm.js
      setText("ck-gain", fmtBRL(ganhoMes));
      setText("ck-gain-ano", fmtBRL(ganhoAno));
      setText("ck-ticket", fmtBRL(ticket));

      console.log("[119 v3] ganhos: mes=" + fmtBRL(ganhoMes) + "(" + qtdGanhosMes + ") ano=" + fmtBRL(ganhoAno) + "(" + qtdGanhosAno + ")");
    } catch(e){
      console.warn("[119 v3] erro:", e);
    } finally {
      jaCalculando = false;
    }
  }

  // Inicial + listeners. SEM setInterval(2500). SEM MutationObserver.
  setTimeout(recalcularGanhos, 2000);

  function attachFilters(){
    ["ck-gain-mes-sel", "ck-gain-ano-sel"].forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el.__projetta119Hooked){
        el.__projetta119Hooked = true;
        el.addEventListener("change", function(){
          ultimoFetchMs = 0; // permite refresh imediato
          setTimeout(recalcularGanhos, 50);
        });
      }
    });
  }
  attachFilters();
  setInterval(attachFilters, 5000);

  // Hook em POST/PATCH em orcamentos_fechados (recalcula ganhos quando fecha contrato)
  var origFetch = window.fetch;
  window.fetch = async function(input, init){
    var resp = await origFetch.apply(this, arguments);
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if(/POST|PATCH/.test(method) && /\/rest\/v1\/orcamentos_fechados/.test(url)){
        ultimoFetchMs = 0;
        setTimeout(recalcularGanhos, 800);
      }
    } catch(e){}
    return resp;
  };

  console.log("[119-recalc-dash v3] instalado — sem piscar, sem sobrescrever pipeline");
})();
