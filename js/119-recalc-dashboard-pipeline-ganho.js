/* ============================================================================
 * js/119-recalc-dashboard-pipeline-ganho.js  — v2 (27-abr-2026)
 * Autorizado por Felipe Xavier de Lima.
 *
 * v2: respeita filtros #ck-gain-mes-sel e #ck-gain-ano-sel
 *
 * REGRAS:
 *  - Pipeline (#ck-pipe): SEMPRE soma cards em stages ABERTOS (s2-s5). NAO filtra por tempo.
 *  - Ganho Mes (#ck-gain): soma orcamentos_fechados WHERE data_fechamento = mes/ano do filtro #ck-gain-mes-sel
 *  - Ganho Ano (#ck-gain-ano): soma orcamentos_fechados WHERE year = #ck-gain-ano-sel
 *  - Ticket Medio (#ck-ticket): ganho_ano_filtrado / qtd_ganhos_ano_filtrado
 *  - Total Tabela (#ck-tot-tab): soma valor_tabela de cards em stages ABERTOS
 *  - Total Faturamento (#ck-tot-fat): soma valor_faturamento de cards em stages ABERTOS
 *
 *  Recalcula: ao carregar + a cada 8s + ao mudar selects + apos POST/PATCH em CRM
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta119RecalcDashApplied) return;
  window.__projetta119RecalcDashApplied = "v2";
  console.log("[119-recalc-dash v2] iniciando");

  var SB_URL = "https://plmliavuwlgpwaizfeds.supabase.co";
  var STAGES_ABERTOS = ["s2","s3","s3b","s1777050576466","s4","s5"];

  function sbFetch(path){
    return fetch(SB_URL + path, {
      headers: {
        "apikey": window._SB_KEY,
        "Authorization": "Bearer " + window._SB_KEY
      }
    });
  }
  function fmtBRL(v){ return "R$ " + Math.round(Number(v)||0).toLocaleString("pt-BR"); }
  // Cache de valores calculados pelo mod 119 — fonte de verdade
  var dashCache = {};

  function setText(id, txt){
    dashCache[id] = txt;
    var el = document.getElementById(id);
    if(el && el.textContent !== txt){ el.textContent = txt; }
  }

  // MutationObserver: se outro mod sobrescrever um KPI, re-aplicamos
  function instalarObserver(){
    if(window.__proj119Observer) return;
    var ids = ["ck-pipe","ck-gain","ck-gain-ano","ck-ticket","ck-tot-tab","ck-tot-fat"];
    ids.forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      var obs = new MutationObserver(function(){
        var desejado = dashCache[id];
        if(desejado != null && el.textContent !== desejado){
          // Outro mod sobrescreveu — restaurar nosso valor
          el.textContent = desejado;
        }
      });
      obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
    window.__proj119Observer = true;
    console.log("[119 v2] MutationObserver instalado nos KPIs");
  }
  setTimeout(instalarObserver, 2500);
  setInterval(instalarObserver, 5000);  // re-instalar se DOM for recriado

  function getFiltros(){
    var mesEl = document.getElementById("ck-gain-mes-sel");
    var anoEl = document.getElementById("ck-gain-ano-sel");
    var mesAno = mesEl ? mesEl.value : "";   // "2026-04"
    var anoSel = anoEl ? anoEl.value : "";   // "2026"
    return {
      mesAno: mesAno,
      ano: anoSel || (mesAno ? mesAno.substring(0,4) : new Date().getFullYear().toString()),
      mes: mesAno ? parseInt(mesAno.substring(5,7), 10) : null,
      anoMes: mesAno ? parseInt(mesAno.substring(0,4), 10) : null
    };
  }

  var jaCalculando = false;

  async function recalcular(){
    if(jaCalculando) return;
    jaCalculando = true;
    try {
      var f = getFiltros();
      var anoSel = parseInt(f.ano, 10);

      // 1. Cards (sempre TODOS)
      var rCards = await sbFetch("/rest/v1/crm_oportunidades?deleted_at=is.null&select=id,stage,valor,valor_tabela,valor_faturamento");
      var cards = await rCards.json();
      if(!Array.isArray(cards)) return;

      // 2. Fechados do ANO SELECIONADO
      var anoStart = anoSel + "-01-01";
      var anoEnd = anoSel + "-12-31";
      var rOf = await sbFetch("/rest/v1/orcamentos_fechados?data_fechamento_pedido=gte." + anoStart + "&data_fechamento_pedido=lte." + anoEnd + "&select=card_id,valor_fechado,data_fechamento_pedido");
      var fechados = await rOf.json();
      if(!Array.isArray(fechados)) fechados = [];

      // 3. Pipeline + Total Tabela/Fat (stages ABERTOS, sem filtro de tempo)
      var pipelineFat = 0, totalTab = 0, totalFat = 0, qtdAbertos = 0;
      cards.forEach(function(c){
        if(STAGES_ABERTOS.indexOf(c.stage) >= 0){
          pipelineFat += parseFloat(c.valor_faturamento) || 0;
          totalTab += parseFloat(c.valor_tabela) || 0;
          totalFat += parseFloat(c.valor_faturamento) || 0;
          qtdAbertos++;
        }
      });

      // 4. Ganho Mes (do mes-ano selecionado em #ck-gain-mes-sel)
      // 5. Ganho Ano (do ano selecionado em #ck-gain-ano-sel)
      var ganhoMes = 0, qtdGanhosMes = 0;
      var ganhoAno = 0, qtdGanhosAno = 0;

      // Pra ganho mes, precisamos buscar por mesAno especifico (pode ser ano DIFERENTE do ck-gain-ano-sel)
      var fechadosDoMes = [];
      if(f.anoMes && f.mes){
        // Buscar fechados especificamente do mes-ano selecionado
        if(f.anoMes === anoSel){
          // Mesmo ano — filtrar do array ja carregado
          fechadosDoMes = fechados.filter(function(fc){
            var dt = fc.data_fechamento_pedido || "";
            return dt.substring(0,7) === f.mesAno;
          });
        } else {
          // Anos diferentes — query separada
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

      fechados.forEach(function(fc){
        ganhoAno += parseFloat(fc.valor_fechado) || 0;
        qtdGanhosAno++;
      });

      // 6. Ticket Medio = ganho_ano / qtd_ganhos_ano
      var ticket = qtdGanhosAno > 0 ? (ganhoAno / qtdGanhosAno) : 0;

      // 7. Atualizar DOM
      setText("ck-pipe", fmtBRL(pipelineFat));
      setText("ck-gain", fmtBRL(ganhoMes));
      setText("ck-gain-ano", fmtBRL(ganhoAno));
      setText("ck-ticket", fmtBRL(ticket));
      setText("ck-tot-tab", fmtBRL(totalTab));
      setText("ck-tot-fat", fmtBRL(totalFat));

      // 8. Subtitulos
      var subs = document.querySelectorAll(".crm-kpi .crm-kpi-sub");
      subs.forEach(function(s){
        var lbl = s.parentElement && s.parentElement.querySelector(".crm-kpi-label");
        if(!lbl) return;
        var ltxt = (lbl.textContent||"").toLowerCase();
        if(/pipeline/.test(ltxt)) s.textContent = qtdAbertos + " ativas (todas as colunas em aberto)";
        else if(/ganho.*m[eê]s/.test(ltxt)) s.textContent = qtdGanhosMes + " contrato(s) · " + (f.mesAno || "");
        else if(/ganho.*ano/.test(ltxt)) s.textContent = qtdGanhosAno + " contrato(s) · ano " + anoSel;
        else if(/ticket/.test(ltxt)) s.textContent = "valor médio por ganho · " + anoSel;
      });

      console.log("[119 v2] dash: filtro mes=" + f.mesAno + " ano=" + anoSel + " | pipe=" + fmtBRL(pipelineFat) + "(" + qtdAbertos + ") | ganho_mes=" + fmtBRL(ganhoMes) + "(" + qtdGanhosMes + ") | ganho_ano=" + fmtBRL(ganhoAno) + "(" + qtdGanhosAno + ")");
    } catch(e){
      console.warn("[119 v2] erro:", e);
    } finally {
      jaCalculando = false;
    }
  }

  // Inicial + interval + listeners
  setTimeout(recalcular, 1500);
  setInterval(recalcular, 2500);

  // Listener nos filtros (recalcula imediato)
  function attachFilters(){
    ["ck-gain-mes-sel", "ck-gain-ano-sel"].forEach(function(id){
      var el = document.getElementById(id);
      if(el && !el.__projetta119Hooked){
        el.__projetta119Hooked = true;
        el.addEventListener("change", function(){ setTimeout(recalcular, 50); });
      }
    });
  }
  attachFilters();
  setInterval(attachFilters, 3000);

  // Hook em mudancas relevantes (POST/PATCH)
  var origFetch = window.fetch;
  window.fetch = async function(input, init){
    var resp = await origFetch.apply(this, arguments);
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if(/POST|PATCH/.test(method) && /\/rest\/v1\/(crm_oportunidades|orcamentos_fechados|versoes_aprovadas)/.test(url)){
        setTimeout(recalcular, 800);
      }
    } catch(e){}
    return resp;
  };

  console.log("[119-recalc-dash v2] instalado");
})();