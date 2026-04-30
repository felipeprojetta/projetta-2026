/* ============================================================================
 * js/114-botao-estrela-principal-pipeline.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "quero opcao dentro do orcamento pre salvo para escolher qual versao vai pro card"
 *
 * COMPORTAMENTO:
 *  1. Detecta modal "PRE-ORCAMENTOS E VERSOES" aberto
 *  2. Adiciona coluna "⭐ Pipeline" antes da coluna Acoes em ambas tabelas:
 *      - RASCUNHOS EDITAVEIS (pre_orcamentos)
 *      - VERSOES APROVADAS - CONGELADAS (versoes_aprovadas)
 *  3. Botao ⭐ amarelo preenchido = esta vai pro card no kanban
 *  4. Botao ⭐ apenas borda = nao vai pro card
 *  5. Click no botao:
 *      a. PATCH desmarca TODAS outras opcoes do mesmo card_id (em ambas tabelas)
 *      b. PATCH marca esta como principal_pipeline=true
 *      c. Trigger trg_*_valores_sync recalcula card no kanban automaticamente
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - Atua via DOM
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta114BotaoEstrelaApplied) return;
  window.__projetta114BotaoEstrelaApplied = true;
  console.log("[114-botao-estrela] iniciando");

  var SB_URL = "https://plmliavuwlgpwaizfeds.supabase.co";

  function sbFetch(path, init){
    init = init || {};
    init.headers = Object.assign({
      "apikey": window._SB_KEY,
      "Authorization": "Bearer " + window._SB_KEY,
      "Content-Type": "application/json"
    }, init.headers || {});
    return fetch(SB_URL + path, init);
  }

  function findModal(){
    var tituloEl = null;
    var todos = document.querySelectorAll("*");
    for(var i = 0; i < todos.length; i++){
      var el = todos[i];
      if(el.children.length === 0){
        var t = (el.textContent || "").trim();
        if(/pr[ée]-or[çc]amentos\s+e\s+vers[õo]es/i.test(t)){ tituloEl = el; break; }
      }
    }
    if(!tituloEl) return null;
    var modal = tituloEl;
    for(var k = 0; k < 15; k++){
      var next = modal.parentElement;
      if(!next || next === document.body) break;
      if(next.querySelectorAll("table").length >= 1) modal = next;
      else { modal = next; if(modal.style.position === "fixed") break; }
    }
    return modal;
  }

  function classificarTabela(t){
    var hs = Array.from(t.querySelectorAll("thead th, thead td")).map(function(th){ return (th.textContent||"").trim(); });
    if(hs.indexOf("Aprovado em") >= 0) return "versoes_aprovadas";
    if(hs.indexOf("Atualizado") >= 0) return "pre_orcamentos";
    return null;
  }

  function adicionarHeaderEstrela(t){
    var trHead = t.querySelector("thead tr");
    if(!trHead || trHead.__projetta114StarHeader) return;
    trHead.__projetta114StarHeader = true;
    var thStar = document.createElement("th");
    thStar.textContent = "⭐ Pipeline";
    thStar.style.cssText = "padding:8px 6px;color:#92400e;font-size:11px;text-align:center;background:#fef3c7";
    var lastTh = trHead.lastElementChild;
    trHead.insertBefore(thStar, lastTh);
  }

  function aplicarVisualBotao(btn, isPrincipal){
    if(isPrincipal){
      btn.style.background = "#f59e0b";
      btn.style.color = "#fff";
      btn.style.borderColor = "#d97706";
      btn.dataset.principal = "true";
      btn.title = "Esta opção vai pro card no kanban (clique pra trocar)";
    } else {
      btn.style.background = "transparent";
      btn.style.color = "#92400e";
      btn.style.borderColor = "#fbbf24";
      btn.dataset.principal = "false";
      btn.title = "Clique pra marcar esta opção como a que vai pro card";
    }
  }

  function adicionarBotaoEstrelaNaLinha(tr, tabelaTipo){
    if(tr.__projetta114Hooked) return;
    tr.__projetta114Hooked = true;

    var cliente = (tr.children[0] && tr.children[0].textContent || "").trim();
    var opcao   = (tr.children[1] && tr.children[1].textContent || "").trim();
    var versao  = null;
    if(tabelaTipo === "versoes_aprovadas"){
      var verTxt = (tr.children[2] && tr.children[2].textContent || "").trim();
      var m = verTxt.match(/V(\d+)/i);
      if(m) versao = parseInt(m[1], 10);
    }

    var tdStar = document.createElement("td");
    tdStar.style.cssText = "text-align:center;padding:6px";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText = "border:1.5px solid #fbbf24;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:14px;transition:all 0.2s;font-weight:600";
    btn.textContent = "⭐";
    btn.dataset.tabela = tabelaTipo;
    btn.dataset.cliente = cliente;
    btn.dataset.opcao = opcao;
    if(versao !== null) btn.dataset.versao = versao;

    aplicarVisualBotao(btn, false);

    btn.onclick = async function(){
      if(btn.dataset.busy === "1") return;
      btn.dataset.busy = "1";
      btn.disabled = true;
      btn.textContent = "⏳";
      try {
        // 1. Buscar card_id desta linha
        var qBuscar = "?cliente=eq." + encodeURIComponent(cliente) + "&opcao_nome=eq." + encodeURIComponent(opcao);
        if(tabelaTipo === "versoes_aprovadas" && versao !== null){
          qBuscar += "&versao=eq." + versao + "&ativa=eq.true";
        } else {
          qBuscar += "&deleted_at=is.null";
        }
        var r1 = await sbFetch("/rest/v1/" + tabelaTipo + qBuscar + "&select=id,card_id");
        var dados = await r1.json();
        if(!dados || !dados.length){ throw new Error("Item nao encontrado no banco"); }
        var card_id = dados[0].card_id;
        var item_id = dados[0].id;

        // 2. Desmarcar TODAS outras opcoes deste card_id em AMBAS tabelas
        await sbFetch("/rest/v1/pre_orcamentos?card_id=eq." + encodeURIComponent(card_id), {
          method: "PATCH",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ principal_pipeline: false })
        });
        await sbFetch("/rest/v1/versoes_aprovadas?card_id=eq." + encodeURIComponent(card_id) + "&ativa=eq.true", {
          method: "PATCH",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ principal_pipeline: false })
        });

        // 3. Marcar ESTA como principal
        await sbFetch("/rest/v1/" + tabelaTipo + "?id=eq." + encodeURIComponent(item_id), {
          method: "PATCH",
          headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ principal_pipeline: true })
        });

        // 4. Atualizar visual: desmarcar todos botoes do modal, marcar este
        var modal = findModal();
        if(modal){
          var btns = modal.querySelectorAll('button[data-projetta114-star="1"]');
          for(var i = 0; i < btns.length; i++){ aplicarVisualBotao(btns[i], false); }
        }
        aplicarVisualBotao(btn, true);
        console.log("[114-botao-estrela] marcou " + tabelaTipo + " id=" + item_id + " (card=" + card_id + ", opcao=" + opcao + ") como principal_pipeline=true");

        // Notificar usuario sutilmente
        var aviso = document.createElement("div");
        aviso.textContent = "✓ \"" + opcao + "\" agora vai pro card no kanban";
        aviso.style.cssText = "position:fixed;bottom:20px;right:20px;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 8px 25px rgba(0,0,0,0.2);z-index:1000000;font-family:system-ui;font-size:14px;font-weight:600";
        document.body.appendChild(aviso);
        setTimeout(function(){ aviso.style.opacity = "0"; aviso.style.transition = "opacity 0.4s"; }, 2000);
        setTimeout(function(){ aviso.remove(); }, 2500);
      } catch(e){
        console.error("[114-botao-estrela] erro:", e);
        alert("Erro ao marcar como principal: " + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "⭐";
        btn.dataset.busy = "0";
      }
    };
    btn.setAttribute("data-projetta114-star", "1");
    tdStar.appendChild(btn);

    var lastTd = tr.lastElementChild;
    tr.insertBefore(tdStar, lastTd);
  }

  async function carregarEstadoPrincipal(modal){
    // Pegar primeiro card_id de qualquer linha (todos do mesmo card)
    var primeiraLinha = modal.querySelector("tbody tr");
    if(!primeiraLinha) return;
    var primeiroCliente = (primeiraLinha.children[0] && primeiraLinha.children[0].textContent || "").trim();
    if(!primeiroCliente) return;

    try {
      // Buscar card pelo cliente (assumindo cliente unico no contexto deste modal)
      var r = await sbFetch("/rest/v1/pre_orcamentos?cliente=eq." + encodeURIComponent(primeiroCliente) + "&deleted_at=is.null&select=card_id&limit=1");
      var d = await r.json();
      if(!d || !d.length) return;
      var card_id = d[0].card_id;

      var rPre = await sbFetch("/rest/v1/pre_orcamentos?card_id=eq." + encodeURIComponent(card_id) + "&deleted_at=is.null&principal_pipeline=eq.true&select=id,opcao_nome");
      var preP = await rPre.json();
      var rVer = await sbFetch("/rest/v1/versoes_aprovadas?card_id=eq." + encodeURIComponent(card_id) + "&ativa=eq.true&principal_pipeline=eq.true&select=id,opcao_nome,versao");
      var verP = await rVer.json();

      var btns = modal.querySelectorAll('button[data-projetta114-star="1"]');
      for(var i = 0; i < btns.length; i++){
        var b = btns[i];
        var match = false;
        if(b.dataset.tabela === "pre_orcamentos"){
          match = preP.some(function(p){ return p.opcao_nome === b.dataset.opcao; });
        } else if(b.dataset.tabela === "versoes_aprovadas"){
          match = verP.some(function(v){
            return v.opcao_nome === b.dataset.opcao && String(v.versao) === b.dataset.versao;
          });
        }
        aplicarVisualBotao(b, match);
      }
    } catch(e){
      console.warn("[114-botao-estrela] erro carregando estado:", e);
    }
  }

  function processar(){
    var modal = findModal();
    if(!modal) return;
    var tabs = Array.from(modal.querySelectorAll("table"));
    var algoNovo = false;
    tabs.forEach(function(t){
      var tipo = classificarTabela(t);
      if(!tipo) return;
      adicionarHeaderEstrela(t);
      Array.from(t.querySelectorAll("tbody tr")).forEach(function(tr){
        if(!tr.__projetta114Hooked){
          adicionarBotaoEstrelaNaLinha(tr, tipo);
          algoNovo = true;
        }
      });
    });
    if(algoNovo){ carregarEstadoPrincipal(modal); }
  }

  setInterval(processar, 700);
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      muts.forEach(function(m){ if(m.addedNodes && m.addedNodes.length){ precisa = true; } });
      if(precisa) setTimeout(processar, 100);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[114-botao-estrela] instalado");
})();
