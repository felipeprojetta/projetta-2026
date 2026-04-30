/* ============================================================================
 * js/117-botao-aprovar-na-linha-estrela.js  — v3 (27-abr-2026)
 * Autorizado por Felipe Xavier.
 *
 * BUG QUE V3 RESOLVE:
 *  App nativo gera PNG/PDF de TODAS opcoes do card, nao so a aprovada.
 *  Mod 116-aprovar-so-marcada filtra apenas POST /versoes_aprovadas, mas
 *  os arquivos JA foram gerados antes.
 *
 * SOLUCAO V3 — soft-delete temporario:
 *  1. Antes de aprovar: deleted_at=NOW() nos pre_orcamentos QUE NAO SAO o ⭐
 *  2. App so "ve" o pre_orcamento da estrela
 *  3. Click Abrir + 2.5s + Click Aprovar para Envio
 *  4. App processa SOMENTE o ⭐ (gera PNG/PDF/POST so dessa)
 *  5. Aguarda 12s pra app finalizar geracao de arquivos
 *  6. Restaura deleted_at=null nos outros pre_orcamentos
 *  7. Safety net: localStorage rastreia IDs ocultos. Se algo travar,
 *     proxima carga do app detecta e restaura automaticamente
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta117BotaoAprovarLinhaApplied) return;
  window.__projetta117BotaoAprovarLinhaApplied = "v3";
  console.log("[117 v3] iniciando");

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

  function findBotaoAprovarHeader(){
    return Array.from(document.querySelectorAll("button")).find(function(b){
      var t = (b.textContent || "").trim();
      return /Aprovar.*Envio/i.test(t) && !b.hasAttribute("data-projetta117-aprovar");
    });
  }

  function findBotaoAbrirNaLinha(tr){
    if(!tr) return null;
    return Array.from(tr.querySelectorAll("button, a")).find(function(b){
      var t = (b.textContent || "").trim();
      return /(^|\s)abrir(\s|$)|📂\s*abrir/i.test(t);
    });
  }

  function findModal(){
    var titulos = Array.from(document.querySelectorAll("*")).filter(function(el){
      return el.children.length === 0 && /pr[ée]-or[çc]amentos\s+e\s+vers[õo]es/i.test((el.textContent||"").trim());
    });
    if(!titulos.length) return null;
    var m = titulos[0];
    for(var i=0; i<15; i++){
      var n = m.parentElement;
      if(!n || n === document.body) break;
      if(n.querySelectorAll("table").length >= 1) m = n;
      else { m = n; if(m.style && m.style.position === "fixed") break; }
    }
    return m;
  }

  // localStorage pra rastrear IDs ocultos (safety net)
  function setIdsOcultos(arr){
    try { localStorage.setItem("__proj117_ids_ocultos", JSON.stringify({ ids: arr, ts: Date.now() })); } catch(e){}
  }
  function getIdsOcultos(){
    try { var s = localStorage.getItem("__proj117_ids_ocultos"); return s ? JSON.parse(s) : null; } catch(e){ return null; }
  }
  function clearIdsOcultos(){
    try { localStorage.removeItem("__proj117_ids_ocultos"); } catch(e){}
  }

  async function restaurarOcultos(ids, motivo){
    if(!ids || !ids.length){ clearIdsOcultos(); return; }
    try {
      console.log("[117 v3] restaurando " + ids.length + " pre_orcamentos ocultos (" + motivo + ")");
      var qs = "id=in.(" + ids.map(function(i){ return encodeURIComponent(i); }).join(",") + ")";
      var r = await sbFetch("/rest/v1/pre_orcamentos?" + qs, {
        method: "PATCH",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({ deleted_at: null })
      });
      if(r.status >= 200 && r.status < 300){
        clearIdsOcultos();
        console.log("[117 v3] restauracao OK (" + ids.length + " IDs)");
      } else {
        var t = await r.text();
        throw new Error("HTTP " + r.status + " " + t);
      }
    } catch(e){
      console.error("[117 v3] ERRO na restauracao:", e);
      alert("⚠ ERRO ao restaurar pre_orcamentos ocultos. IDs: " + ids.join(", ") + "\nAvise o suporte.");
    }
  }

  // Auto-restore na carga (caso erro anterior)
  (function checarRestauracaoPendente(){
    var dados = getIdsOcultos();
    if(dados && dados.ids && dados.ids.length){
      var idade = Date.now() - (dados.ts || 0);
      if(idade > 30000){
        console.warn("[117 v3] auto-restore detectou ocultos pendentes de " + Math.round(idade/1000) + "s atras");
        restaurarOcultos(dados.ids, "auto-restore na carga");
      }
    }
  })();

  function criarBotao(){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-projetta117-aprovar", "1");
    btn.style.cssText = "background:#16a34a;color:#fff;border:none;padding:5px 11px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-left:6px;box-shadow:0 2px 6px rgba(22,163,74,0.3);transition:all 0.15s;white-space:nowrap";
    btn.innerHTML = "🏆 Aprovar";
    btn.title = "Aprovar SOMENTE esta opção (esconde outras temporariamente)";
    btn.onmouseover = function(){ if(!btn.disabled){ btn.style.background = "#15803d"; btn.style.transform = "translateY(-1px)"; } };
    btn.onmouseout  = function(){ if(!btn.disabled){ btn.style.background = "#16a34a"; btn.style.transform = "translateY(0)"; } };

    btn.onclick = async function(){
      var nomeOpcao = btn.dataset.opcao || "esta opcao";

      if(!confirm("Aprovar SOMENTE \"" + nomeOpcao + "\" como versão congelada?\n\n• Outras opções ficam ESCONDIDAS temporariamente (12s)\n• Apenas esta opção gera PNG/PDF\n• Outras voltam automaticamente depois")) return;

      btn.disabled = true;
      btn.innerHTML = "⏳ Escondendo outras...";
      btn.style.background = "#9ca3af";
      btn.style.cursor = "wait";

      var ind = document.createElement("div");
      ind.id = "proj117-flutuante";
      ind.style.cssText = "position:fixed;top:80px;right:20px;background:#fbbf24;color:#92400e;padding:14px 20px;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.25);z-index:1000000;font-family:system-ui;font-size:14px;font-weight:600;border:2px solid #f59e0b;max-width:340px";
      ind.innerHTML = "⏳ Preparando aprovação de <b>" + nomeOpcao + "</b>";
      document.body.appendChild(ind);

      var idsOcultos = [];
      var card_id = null;

      try {
        // 1. Achar card_id pelo cliente da linha
        var tr = btn.closest("tr");
        var cliente = (tr.children[0] && tr.children[0].textContent || "").trim();

        var rCard = await sbFetch("/rest/v1/pre_orcamentos?cliente=eq." + encodeURIComponent(cliente) + "&opcao_nome=eq." + encodeURIComponent(nomeOpcao) + "&deleted_at=is.null&select=card_id&limit=1");
        var dCard = await rCard.json();
        if(!dCard || !dCard.length) throw new Error("pre_orcamento desta opcao nao encontrado");
        card_id = dCard[0].card_id;

        // 2. Buscar TODOS pre_orcamentos ATIVOS deste card
        var r = await sbFetch("/rest/v1/pre_orcamentos?card_id=eq." + encodeURIComponent(card_id) + "&deleted_at=is.null&select=id,opcao_nome");
        var todos = await r.json();
        if(!todos || !todos.length) throw new Error("nenhum pre_orcamento encontrado");

        // 3. Filtrar os que NAO sao o da estrela
        var paraOcultar = todos.filter(function(p){ return p.opcao_nome !== nomeOpcao; });
        idsOcultos = paraOcultar.map(function(p){ return p.id; });
        console.log("[117 v3] vai ocultar " + idsOcultos.length + " pre_orcamentos: " + paraOcultar.map(function(p){return p.opcao_nome;}).join(", "));

        // 4. SOFT-DELETE temporario
        if(idsOcultos.length){
          setIdsOcultos(idsOcultos);
          var nowIso = new Date().toISOString();
          var qs = "id=in.(" + idsOcultos.map(function(i){ return encodeURIComponent(i); }).join(",") + ")";
          var rDel = await sbFetch("/rest/v1/pre_orcamentos?" + qs, {
            method: "PATCH",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify({ deleted_at: nowIso })
          });
          if(rDel.status >= 400) throw new Error("falha ao soft-delete (" + rDel.status + ")");
          console.log("[117 v3] " + idsOcultos.length + " pre_orcamentos ocultados");
        }

        // Safety net: forcar restauracao em 60s mesmo se algo der errado
        setTimeout(function(){
          var dados = getIdsOcultos();
          if(dados && dados.ids && dados.ids.length){
            console.warn("[117 v3] safety net 60s — forcando restauracao");
            restaurarOcultos(dados.ids, "safety net 60s");
          }
        }, 60000);

        // 5. Click Abrir
        ind.innerHTML = "📂 Abrindo orçamento <b>" + nomeOpcao + "</b>";
        var btnAbrir = findBotaoAbrirNaLinha(tr);
        if(!btnAbrir){
          await restaurarOcultos(idsOcultos, "erro: botao Abrir nao encontrado");
          throw new Error("botao Abrir nao encontrado");
        }
        console.log("[117 v3] step 1: clicando Abrir de " + nomeOpcao);
        btnAbrir.click();

        // 6. Espera 2.5s e dispara aprovar
        setTimeout(function(){
          ind.style.background = "#dbeafe";
          ind.style.color = "#1e40af";
          ind.style.borderColor = "#3b82f6";
          ind.innerHTML = "🏆 Disparando Aprovar para Envio<br><span style=\"font-size:12px;font-weight:400\">" + nomeOpcao + "</span>";

          var btnHeader = findBotaoAprovarHeader();
          if(!btnHeader){
            ind.style.background = "#fee2e2";
            ind.style.color = "#b91c1c";
            ind.innerHTML = "❌ Botao Aprovar nao encontrado<br>Restaurando...";
            restaurarOcultos(idsOcultos, "erro: botao Aprovar nao encontrado");
            setTimeout(function(){ ind.remove(); }, 5000);
            return;
          }
          console.log("[117 v3] step 2: clicando Aprovar para Envio do header");
          btnHeader.click();

          // 7. Aguardar 10s pro app gerar arquivos e DEPOIS restaurar
          setTimeout(function(){
            ind.style.background = "#fef9c3";
            ind.style.color = "#713f12";
            ind.innerHTML = "⏳ Restaurando outras opções...";

            restaurarOcultos(idsOcultos, "fluxo normal apos aprovacao").then(function(){
              ind.style.background = "#dcfce7";
              ind.style.color = "#166534";
              ind.style.borderColor = "#16a34a";
              ind.innerHTML = "✓ Aprovação concluída<br><span style=\"font-size:12px;font-weight:400\">" + nomeOpcao + " — outras opções restauradas</span>";
              setTimeout(function(){ ind.style.opacity = "0"; ind.style.transition = "opacity 0.4s"; }, 2500);
              setTimeout(function(){ if(ind.parentElement) ind.remove(); }, 3000);
            });
          }, 10000);
        }, 2500);

      } catch(e){
        console.error("[117 v3] ERRO:", e);
        ind.style.background = "#fee2e2";
        ind.style.color = "#b91c1c";
        ind.style.borderColor = "#dc2626";
        ind.innerHTML = "❌ Erro: " + (e.message || "desconhecido") + "<br>Restaurando...";
        if(idsOcultos.length){ await restaurarOcultos(idsOcultos, "erro no fluxo"); }
        setTimeout(function(){ if(ind.parentElement) ind.remove(); }, 5000);
        btn.disabled = false;
        btn.innerHTML = "🏆 Aprovar";
        btn.style.background = "#16a34a";
        btn.style.cursor = "pointer";
      }
    };
    return btn;
  }

  function processar(){
    var modal = findModal();
    if(!modal) return;
    var estrelas = modal.querySelectorAll('button[data-projetta114-star="1"]');
    if(!estrelas.length) return;
    estrelas.forEach(function(btnStar){
      var ehPrincipal = btnStar.dataset.principal === "true";
      var td = btnStar.closest("td");
      if(!td) return;
      var btnApr = td.querySelector('button[data-projetta117-aprovar="1"]');
      if(ehPrincipal){
        if(!btnApr){
          btnApr = criarBotao();
          btnApr.dataset.opcao = btnStar.dataset.opcao || "";
          if(btnStar.nextSibling) td.insertBefore(btnApr, btnStar.nextSibling);
          else td.appendChild(btnApr);
        } else {
          btnApr.dataset.opcao = btnStar.dataset.opcao || "";
        }
      } else {
        if(btnApr) btnApr.remove();
      }
    });
  }

  setInterval(processar, 600);
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      muts.forEach(function(m){ if(m.addedNodes && m.addedNodes.length) precisa = true; if(m.attributeName === "data-principal") precisa = true; });
      if(precisa) setTimeout(processar, 80);
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-principal"] });
  }

  console.log("[117 v3] instalado");
})();
