/* ============================================================================
 * js/119-recalc-dashboard-pipeline-ganho.js  — v3 (28-abr-2026)
 * Autorizado por Felipe Xavier de Lima.
 *
 * Felipe 27/04: PIPELINE PISCA porque setInterval(2500) recalcula com
 * valor_faturamento do banco (sem componente CIF×cambio fixo do card),
 * e MutationObserver REVERTIA correcoes do 10-crm.js.
 *
 * v3: NEUTRALIZA pipeline/totais — deixa por conta do 10-crm.js
 * (que ja calcula CORRETO usando inst_cambio fixo do card + CIF).
 * Mantem APENAS:
 *   - Ganho Mes (#ck-gain) — vem de orcamentos_fechados
 *   - Ganho Ano (#ck-gain-ano) — vem de orcamentos_fechados
 *   - Ticket Medio (#ck-ticket) — derivado do ganho ano
 *
 * NAO MEXE em ck-pipe / ck-tot-tab / ck-tot-fat (10-crm cuida).
 *
 * REMOVIDOS: setInterval(2500), MutationObserver agressivo, hook fetch
 * em crm_oportunidades. Throttle minimo 30s entre fetchs.
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
      mes: mesAno ? parseInt(mesAno.substring(5,7), 10) : null,
      anoMes: mesAno ? parseInt(mesAno.substring(0,4), 10) : null
    };
  }

  var jaCalculando = false;
  var ultimoFetchMs = 0;

  async function recalcularGanhos(force){
    if(jaCalculando) return;
    var agora = Date.now();
    if(!force && agora - ultimoFetchMs < 30000) return; // throttle 30s
    ultimoFetchMs = agora;
    jaCalculando = true;
    try {
      var f = getFiltros();
      var anoSel = parseInt(f.ano, 10);

      // Fechados do ANO selecionado
      var anoStart = anoSel + "-01-01";
      var anoEnd = anoSel + "-12-31";
      var rOf = await sbFetch("/rest/v1/orcamentos_fechados?data_fechamento_pedido=gte." + anoStart + "&data_fechamento_pedido=lte." + anoEnd + "&select=card_id,valor_fechado,data_fechamento_pedido");
      var fechados = await rOf.json();
      if(!Array.isArray(fechados)) fechados = [];

      // Ganho Mes
      var ganhoMes = 0, qtdGanhosMes = 0;
      var fechadosDoMes = [];
      if(f.anoMes && f.mes){
        if(f.anoMes === anoSel){
          fechadosDoMes = fechados.filter(function(fc){
            var dt = fc.data_fechamento_pedido || "";
            return dt.substring(0,7) === f.mesAno;
          });
        } else {
          var dtMesStart = f.mesAno + "-01";
          var dtMesEnd = f.mesAno + "-31";
          var rMes = await sbFetch("/rest/v1/orcamentos_fechados?data_fechamento_pedido=gte." + dtMesStart + "&data_fechamento_pedido=lte." + dtMesEnd + "&select=valor_fechado");
          fechadosDoMes = await rMes.json();
          if(!Array.isArray(fechadosDoMes)) fechadosDoMes = [];
        }
      }
      fechadosDoMes.forEach(function(fc){
        ganhoMes += parseFloat(fc.valor_fechado) || 0;
        qtdGanhosMes++;
      });

      // Ganho Ano
      var ganhoAno = 0, qtdGanhosAno = 0;
      fechados.forEach(function(fc){
        ganhoAno += parseFloat(fc.valor_fechado) || 0;
        qtdGanhosAno++;
      });

      // Ticket Medio
      var ticket = qtdGanhosAno > 0 ? (ganhoAno / qtdGanhosAno) : 0;

      // Atualizar DOM — SO os 3 KPIs de ganho. Pipeline/Totais NAO mexemos.
      setText("ck-gain", fmtBRL(ganhoMes));
      setText("ck-gain-ano", fmtBRL(ganhoAno));
      setText("ck-ticket", fmtBRL(ticket));

      // Subtitulos so dos KPIs de ganho
      var subs = document.querySelectorAll(".crm-kpi .crm-kpi-sub");
      subs.forEach(function(s){
        var lbl = s.parentElement && s.parentElement.querySelector(".crm-kpi-label");
        if(!lbl) return;
        var ltxt = (lbl.textContent||"").toLowerCase();
        if(/ganho.*m[eê]s/.test(ltxt)) s.textContent = qtdGanhosMes + " contrato(s) · " + (f.mesAno || "");
        else if(/ganho.*ano/.test(ltxt)) s.textContent = qtdGanhosAno + " contrato(s) · ano " + anoSel;
        else if(/ticket/.test(ltxt)) s.textContent = "valor médio por ganho · " + anoSel;
      });

      console.log("[119 v3] ganhos: mes=" + fmtBRL(ganhoMes) + "(" + qtdGanhosMes + ") | ano=" + fmtBRL(ganhoAno) + "(" + qtdGanhosAno + ") | ticket=" + fmtBRL(ticket));
    } catch(e){
      console.warn("[119 v3] erro:", e);
    } finally {
      jaCalculando = false;
    }
  }

  // Inicial — sem setInterval periodico
  setTimeout(function(){ recalcularGanhos(true); }, 1500);

  // Listener nos filtros (recalcula imediato — bypassa throttle)
  function attachFilters(){
    ["ck-gain-mes-sel", "ck-gain-ano-sel"].forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el.__projetta119Hooked){
        el.__projetta119Hooked = true;
        el.addEventListener("change", function(){
          setTimeout(function(){ recalcularGanhos(true); }, 50);
        });
      }
    });
  }
  attachFilters();
  setInterval(attachFilters, 5000);

  // Hook fetch APENAS em orcamentos_fechados (POST/PATCH = novo ganho)
  // NAO em crm_oportunidades — isso causava o piscar.
  var origFetch = window.fetch;
  window.fetch = async function(input, init){
    var resp = await origFetch.apply(this, arguments);
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if(/POST|PATCH/.test(method) && /\/rest\/v1\/orcamentos_fechados/.test(url)){
        ultimoFetchMs = 0; // bypassa throttle
        setTimeout(function(){ recalcularGanhos(true); }, 800);
      }
    } catch(e){}
    return resp;
  };

  console.log("[119-recalc-dash v3] instalado — pipeline NAO sobrescrito (10-crm cuida)");
})();
