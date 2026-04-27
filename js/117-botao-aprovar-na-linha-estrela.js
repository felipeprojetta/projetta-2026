/* ============================================================================
 * js/117-botao-aprovar-na-linha-estrela.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "o botao de orcamento aprovado deve ficar ai dentro esse verde,
 *          ao lado da estrela marcada, ai clico nele e ai sim aprova fica
 *          ate mais facil nao preciso abrir o cliente so clico dentro do
 *          proprio quadro, se movimento estrela botao movimenta tbm"
 *
 * COMPORTAMENTO:
 *  - Adiciona botao verde "🏆 Aprovar" SOMENTE na linha que esta com ⭐ marcada
 *  - Quando user marca outra linha, botao se MOVE pra essa linha
 *  - Click no botao: clica no "🏆 Aprovar para Envio" original do app
 *  - Mod 116 garante que so a opcao marcada com ⭐ vire versao aprovada
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/81-fix-fluxo-nativo.js (BLINDADO)
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - Atua via DOM
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta117BotaoAprovarLinhaApplied) return;
  window.__projetta117BotaoAprovarLinhaApplied = true;
  console.log("[117-botao-aprovar-linha] iniciando");

  function findBotaoAprovarOriginal(){
    var btns = Array.from(document.querySelectorAll("button"));
    return btns.find(function(b){
      var t = (b.textContent || "").trim();
      return /Aprovar.*Envio|🏆.*Aprovar/i.test(t) && b.id !== "proj117-aprovar-na-linha";
    });
  }

  function criarBotaoAprovar(){
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "proj117-btn-tmp"; // sera renomeado por linha
    btn.setAttribute("data-projetta117-aprovar", "1");
    btn.style.cssText = "background:#16a34a;color:#fff;border:none;padding:5px 11px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;margin-left:6px;box-shadow:0 2px 6px rgba(22,163,74,0.3);transition:all 0.15s;white-space:nowrap";
    btn.innerHTML = "🏆 Aprovar";
    btn.title = "Aprovar esta opção (a marcada com ⭐) e gerar versão congelada";
    btn.onmouseover = function(){ btn.style.background = "#15803d"; btn.style.transform = "translateY(-1px)"; };
    btn.onmouseout  = function(){ btn.style.background = "#16a34a"; btn.style.transform = "translateY(0)"; };
    btn.onclick = function(){
      // Confirmacao rapida
      var nomeOpcao = btn.dataset.opcao || "esta opcao";
      if(!confirm("Aprovar \"" + nomeOpcao + "\" como versao congelada?\n\nClick OK pra confirmar.")) return;
      // Achar e clicar no botao original
      var btnOrig = findBotaoAprovarOriginal();
      if(!btnOrig){
        alert('Botao "Aprovar para Envio" original nao encontrado. Tente fechar o modal e clicar manualmente.');
        return;
      }
      btn.disabled = true;
      btn.innerHTML = "⏳ Aprovando...";
      btn.style.background = "#9ca3af";
      console.log("[117-aprovar-linha] disparando click no botao original (mod 116 vai filtrar pelas estrelas)");
      // Pequeno delay pra UI responder
      setTimeout(function(){ btnOrig.click(); }, 150);
      setTimeout(function(){
        btn.disabled = false;
        btn.innerHTML = "🏆 Aprovar";
        btn.style.background = "#16a34a";
      }, 4000);
    };
    return btn;
  }

  function findModalEStrelas(){
    var titulos = Array.from(document.querySelectorAll("*")).filter(function(el){
      return el.children.length === 0 && /pr[ée]-or[çc]amentos\s+e\s+vers[õo]es/i.test((el.textContent||"").trim());
    });
    if(!titulos.length) return null;
    var modal = titulos[0];
    for(var i=0; i<15; i++){
      var n = modal.parentElement;
      if(!n || n === document.body) break;
      if(n.querySelectorAll("table").length >= 1) modal = n;
      else { modal = n; if(modal.style && modal.style.position === "fixed") break; }
    }
    return modal;
  }

  function processar(){
    var modal = findModalEStrelas();
    if(!modal) return;

    var estrelas = modal.querySelectorAll('button[data-projetta114-star="1"]');
    if(!estrelas.length) return;

    estrelas.forEach(function(btnStar){
      var ehPrincipal = btnStar.dataset.principal === "true";
      var td = btnStar.closest("td");
      if(!td) return;
      var btnAprovar = td.querySelector('button[data-projetta117-aprovar="1"]');

      if(ehPrincipal){
        // Esta linha esta com estrela — precisa ter botao Aprovar
        if(!btnAprovar){
          btnAprovar = criarBotaoAprovar();
          btnAprovar.dataset.opcao = btnStar.dataset.opcao || "";
          // Inserir DEPOIS do botao estrela
          if(btnStar.nextSibling) td.insertBefore(btnAprovar, btnStar.nextSibling);
          else td.appendChild(btnAprovar);
          console.log("[117-aprovar-linha] botao Aprovar adicionado na linha de \"" + (btnStar.dataset.opcao||"?") + "\"");
        } else {
          // Atualizar nome da opcao
          btnAprovar.dataset.opcao = btnStar.dataset.opcao || "";
        }
      } else {
        // Linha nao tem estrela — remover botao Aprovar se houver
        if(btnAprovar){
          btnAprovar.remove();
          console.log("[117-aprovar-linha] botao Aprovar removido da linha de \"" + (btnStar.dataset.opcao||"?") + "\"");
        }
      }
    });
  }

  setInterval(processar, 600);
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      muts.forEach(function(m){ if(m.addedNodes && m.addedNodes.length){ precisa = true; } if(m.attributeName === "data-principal"){ precisa = true; } });
      if(precisa) setTimeout(processar, 80);
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-principal"] });
  }

  console.log("[117-botao-aprovar-linha] instalado");
})();
