/* ============================================================================
 * js/119-recalc-dashboard-pipeline-ganho.js  — v1 (27-abr-2026)
 * Autorizado por Felipe Xavier de Lima.
 *
 * COMPORTAMENTO:
 *  Recalcula KPIs do dashboard com lógica correta:
 *  - Pipeline (#ck-pipe): soma cards em stages ABERTOS (s2, s3, s3b, revisado, s4, s5)
 *    NAO inclui Fechado (s6), Intranet (s1777269819911) nem Perdido (s7)
 *  - Ganho Mes (#ck-gain): soma orcamentos_fechados.valor_fechado WHERE mes atual
 *  - Ganho Ano (#ck-gain-ano): mesma, ano atual
 *  - Ticket Medio (#ck-ticket): ganho_ano / qtd_ganhos_ano
 *  - Total Tabela (#ck-tot-tab): soma valor_tabela de cards em stages ABERTOS
 *  - Total Faturamento (#ck-tot-fat): soma valor_faturamento de cards em stages ABERTOS
 *
 *  Roda na carga + a cada 5s + apos mudancas no kanban
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta119RecalcDashApplied) return;
  window.__projetta119RecalcDashApplied = "v1";
  console.log("[119-recalc-dash] iniciando");

  var SB_URL = "https://plmliavuwlgpwaizfeds.supabase.co";
  var STAGES_ABERTOS = ["s2","s3","s3b","s1777050576466","s4","s5"];
  var STAGES_FECHADOS = ["s6","s1777269819911","s7"];

  function sbFetch(path){
    return fetch(SB_URL + path, {
      headers: {
        "apikey": window._SB_KEY,
        "Authorization": "Bearer " + window._SB_KEY
      }
    });
  }

  function fmtBRL(v){
    var n = Math.round(Number(v) || 0);
    return "R$ " + n.toLocaleString("pt-BR");
  }

  function setText(id, txt){
    var el = document.getElementById(id);
    if(el && el.textContent !== txt){ el.textContent = txt; }
  }

  var jaCalculando = false;

  async function recalcular(){
    if(jaCalculando) return;
    jaCalculando = true;
    try {
      // 1. Pegar TODOS os cards ativos
      var rCards = await sbFetch("/rest/v1/crm_oportunidades?deleted_at=is.null&select=id,stage,valor,valor_tabela,valor_faturamento");
      var cards = await rCards.json();
      if(!Array.isArray(cards)) return;

      // 2. Pegar fechados do mes/ano atual
      var hoje = new Date();
      var anoAtual = hoje.getFullYear();
      var mesAtual = hoje.getMonth() + 1;
      var ymStart = anoAtual + "-" + String(mesAtual).padStart(2,"0") + "-01";
      var ymEnd = anoAtual + "-" + String(mesAtual).padStart(2,"0") + "-31";
      var anoStart = anoAtual + "-01-01";
      var anoEnd = anoAtual + "-12-31";

      var rOf = await sbFetch("/rest/v1/orcamentos_fechados?data_fechamento_pedido=gte." + anoStart + "&data_fechamento_pedido=lte." + anoEnd + "&select=card_id,valor_fechado,data_fechamento_pedido");
      var fechados = await rOf.json();
      if(!Array.isArray(fechados)) fechados = [];

      // 3. Calcular Pipeline e Total Tabela/Faturamento (stages ABERTOS)
      var pipelineFat = 0;
      var totalTab = 0;
      var totalFat = 0;
      var qtdAbertos = 0;

      cards.forEach(function(c){
        if(STAGES_ABERTOS.indexOf(c.stage) >= 0){
          pipelineFat += parseFloat(c.valor_faturamento) || 0;
          totalTab += parseFloat(c.valor_tabela) || 0;
          totalFat += parseFloat(c.valor_faturamento) || 0;
          qtdAbertos++;
        }
      });

      // 4. Calcular Ganho Mes/Ano (de orcamentos_fechados)
      var ganhoMes = 0;
      var ganhoAno = 0;
      var qtdGanhosMes = 0;
      var qtdGanhosAno = 0;

      fechados.forEach(function(f){
        var v = parseFloat(f.valor_fechado) || 0;
        var dt = f.data_fechamento_pedido;
        if(!dt) return;
        var ano = parseInt(dt.substring(0,4), 10);
        var mes = parseInt(dt.substring(5,7), 10);
        if(ano === anoAtual){
          ganhoAno += v;
          qtdGanhosAno++;
          if(mes === mesAtual){
            ganhoMes += v;
            qtdGanhosMes++;
          }
        }
      });

      // 5. Ticket medio = ganho_ano / qtd_ganhos_ano
      var ticket = qtdGanhosAno > 0 ? (ganhoAno / qtdGanhosAno) : 0;

      // 6. Atualizar DOM
      setText("ck-pipe", fmtBRL(pipelineFat));
      setText("ck-gain", fmtBRL(ganhoMes));
      setText("ck-gain-ano", fmtBRL(ganhoAno));
      setText("ck-ticket", fmtBRL(ticket));
      setText("ck-tot-tab", fmtBRL(totalTab));
      setText("ck-tot-fat", fmtBRL(totalFat));

      // 7. Atualizar contadores (subtítulos)
      var pipeSub = document.querySelector(".crm-kpi.kpi-blue .crm-kpi-sub");
      if(pipeSub) pipeSub.textContent = qtdAbertos + " ativas";
      var gainSub = document.querySelector(".crm-kpi.kpi-green .crm-kpi-sub");
      if(gainSub) gainSub.textContent = qtdGanhosMes + " contratos · mês fiscal atual";
      var gAnoSub = document.querySelector(".crm-kpi:not(.kpi-blue):not(.kpi-green):not(.kpi-orange):not(.kpi-purple) .crm-kpi-sub");
      // Esse seletor é frágil — pode não pegar todos. Vou tentar via texto:
      var subs = document.querySelectorAll(".crm-kpi .crm-kpi-sub");
      subs.forEach(function(s){
        var lbl = s.parentElement && s.parentElement.querySelector(".crm-kpi-label");
        if(!lbl) return;
        var ltxt = (lbl.textContent||"").toLowerCase();
        if(/ganho\s*ano/i.test(ltxt)) s.textContent = qtdGanhosAno + " contratos · ano " + anoAtual;
      });

      console.log("[119] dashboard atualizado: pipe=" + fmtBRL(pipelineFat) + " ganho_mes=" + fmtBRL(ganhoMes) + "(" + qtdGanhosMes + ") ganho_ano=" + fmtBRL(ganhoAno) + "(" + qtdGanhosAno + ")");
    } catch(e){
      console.warn("[119] erro:", e);
    } finally {
      jaCalculando = false;
    }
  }

  // Roda inicial + a cada 8s
  setTimeout(recalcular, 1500);
  setInterval(recalcular, 8000);

  // Hook em mudancas relevantes (intercept fetch)
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

  console.log("[119-recalc-dash] instalado");
})();