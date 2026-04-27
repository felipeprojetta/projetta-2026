/* ============================================================================
 * js/117-botao-aprovar-na-linha-estrela.js  — v2 (27-abr-2026)
 * Autorizado por Felipe Xavier.
 *
 * COMPORTAMENTO v2:
 *  1. Botao verde "🏆 Aprovar" aparece na linha que tem ⭐ marcada
 *  2. Ao clicar:
 *     a. Pede confirmacao
 *     b. Click em "📂 Abrir" da MESMA linha (carrega o orcamento)
 *     c. Aguarda 2.5s pro orcamento carregar (cliente, dados, etc)
 *     d. Click em "🏆 Aprovar para Envio" do header
 *     e. App processa (1 POST limpo, com cliente preenchido)
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta117BotaoAprovarLinhaApplied) return;
  window.__projetta117BotaoAprovarLinhaApplied = "v2";
  console.log("[117 v2] iniciando");

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

  function criarBotao(){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-projetta117-aprovar", "1");
    btn.style.cssText = "background:#16a34a;color:#fff;border:none;padding:5px 11px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-left:6px;box-shadow:0 2px 6px rgba(22,163,74,0.3);transition:all 0.15s;white-space:nowrap";
    btn.innerHTML = "🏆 Aprovar";
    btn.title = "Abrir orçamento desta linha e disparar Aprovar para Envio";
    btn.onmouseover = function(){ if(!btn.disabled){ btn.style.background = "#15803d"; btn.style.transform = "translateY(-1px)"; } };
    btn.onmouseout  = function(){ if(!btn.disabled){ btn.style.background = "#16a34a"; btn.style.transform = "translateY(0)"; } };
    btn.onclick = function(){
      var nomeOpcao = btn.dataset.opcao || "esta opcao";
      if(!confirm("Aprovar \"" + nomeOpcao + "\" como versão congelada?\n\n1. Vou abrir o orçamento desta linha\n2. Aguardar 2.5s pra carregar\n3. Clicar em Aprovar para Envio")) return;
      var tr = btn.closest("tr");
      var btnAbrir = findBotaoAbrirNaLinha(tr);
      if(!btnAbrir){
        alert("Botao Abrir nao encontrado na linha");
        return;
      }
      btn.disabled = true;
      btn.innerHTML = "⏳ Abrindo...";
      btn.style.background = "#9ca3af";
      btn.style.cursor = "wait";

      // Indicador flutuante (sobrevive ao fechamento do modal)
      var ind = document.createElement("div");
      ind.id = "proj117-flutuante";
      ind.style.cssText = "position:fixed;top:80px;right:20px;background:#fbbf24;color:#92400e;padding:14px 20px;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.25);z-index:1000000;font-family:system-ui;font-size:14px;font-weight:600;border:2px solid #f59e0b;max-width:340px";
      ind.innerHTML = "⏳ Abrindo orçamento <b>" + nomeOpcao + "</b><br><span style=\"font-size:12px;font-weight:400\">Aguardando dados carregarem...</span>";
      document.body.appendChild(ind);

      console.log("[117 v2] step 1: clicando em \"Abrir\" da linha de " + nomeOpcao);
      btnAbrir.click();

      // Aguardar carregar e disparar aprovar
      setTimeout(function(){
        ind.style.background = "#dbeafe";
        ind.style.color = "#1e40af";
        ind.style.borderColor = "#3b82f6";
        ind.innerHTML = "🏆 Disparando Aprovar para Envio<br><span style=\"font-size:12px;font-weight:400\">" + nomeOpcao + "</span>";

        var btnHeader = findBotaoAprovarHeader();
        if(!btnHeader){
          ind.style.background = "#fee2e2";
          ind.style.color = "#b91c1c";
          ind.style.borderColor = "#dc2626";
          ind.innerHTML = "❌ Botao Aprovar para Envio nao encontrado<br><span style=\"font-size:12px;font-weight:400\">Clique manualmente</span>";
          setTimeout(function(){ ind.remove(); }, 5000);
          return;
        }

        console.log("[117 v2] step 2: clicando em Aprovar para Envio do header");
        btnHeader.click();

        setTimeout(function(){
          ind.style.background = "#dcfce7";
          ind.style.color = "#166534";
          ind.style.borderColor = "#16a34a";
          ind.innerHTML = "✓ Aprovacao disparada<br><span style=\"font-size:12px;font-weight:400\">Verifique versoes aprovadas no banco</span>";
          setTimeout(function(){ ind.style.opacity = "0"; ind.style.transition = "opacity 0.4s"; }, 2200);
          setTimeout(function(){ if(ind.parentElement) ind.remove(); }, 2700);
        }, 1500);
      }, 2500);
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

  console.log("[117 v2] instalado");
})();