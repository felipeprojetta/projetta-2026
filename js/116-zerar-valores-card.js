/* ============================================================================
 * js/116-zerar-valores-card.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "tem que ter um botao ali dentro do card, zerar valores pq ja falei
 *          mil vezes que se nao estiver no quadro dentro de pre orcamento salvos
 *          nao pode ter valor"
 *
 * COMPORTAMENTO:
 *  1. Adiciona botao 🧹 no canto superior direito de cada .crm-card
 *  2. Click: pede confirmacao + identifica card pelo AGP (ou cliente)
 *  3. PATCH banco: valor=0, valor_tabela=0, valor_faturamento=0
 *  4. Atualiza localStorage projetta_crm_v1 (zera valores naquele card)
 *  5. Forca re-render via window.crmRender() se existir
 *  6. Toast de confirmacao
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - NAO modifica js/57-hidratar-local.js (BLINDADO)
 *  - Atua via DOM e fetch
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta116ZerarValoresCardApplied) return;
  window.__projetta116ZerarValoresCardApplied = true;
  console.log("[116-zerar-valores-card] iniciando");

  // Helper: pegar key do Supabase do window (ja existe)
  function sbKey(){ return window._SB_KEY || ""; }
  function sbUrl(){ return "https://plmliavuwlgpwaizfeds.supabase.co"; }

  // Extrair AGP do texto do card (ex: "AGP004414")
  function extrairAgp(card){
    var txt = (card.textContent || "");
    var m = txt.match(/AGP\d{4,}/);
    return m ? m[0] : null;
  }

  // Extrair cliente do .crm-card-client
  function extrairCliente(card){
    var el = card.querySelector(".crm-card-client");
    if(!el) return "";
    return (el.textContent || "").trim().replace(/\s+/g, " ").substring(0, 200);
  }

  function showToast(msg, isError){
    var t = document.createElement("div");
    t.style.cssText = "position:fixed;top:24px;right:24px;background:" + (isError ? "#dc2626" : "#16a34a") + ";color:#fff;padding:12px 20px;border-radius:8px;font-family:system-ui,sans-serif;font-size:14px;font-weight:500;z-index:999999;box-shadow:0 6px 20px rgba(0,0,0,0.3);max-width:400px";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.transition = "opacity 0.4s"; t.style.opacity = "0"; setTimeout(function(){ t.remove(); }, 400); }, 3500);
  }

  async function buscarCardId(agp, cliente){
    var key = sbKey();
    if(!key) throw new Error("sem _SB_KEY");
    var url = sbUrl() + "/rest/v1/crm_oportunidades?select=id,cliente,agp,valor_tabela,valor_faturamento&deleted_at=is.null";
    if(agp){
      url += "&agp=eq." + encodeURIComponent(agp);
    } else if(cliente){
      url += "&cliente=eq." + encodeURIComponent(cliente);
    } else {
      throw new Error("sem AGP nem cliente");
    }
    var r = await fetch(url, { headers: { apikey: key, Authorization: "Bearer " + key } });
    if(!r.ok) throw new Error("HTTP " + r.status);
    var data = await r.json();
    if(!Array.isArray(data) || data.length === 0) return null;
    if(data.length > 1) throw new Error("multiplos cards (" + data.length + ") com mesmo identificador");
    return data[0];
  }

  async function zerarBanco(cardId){
    var key = sbKey();
    var url = sbUrl() + "/rest/v1/crm_oportunidades?id=eq." + encodeURIComponent(cardId);
    var r = await fetch(url, {
      method: "PATCH",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ valor: 0, valor_tabela: 0, valor_faturamento: 0 })
    });
    if(!r.ok){ var t = await r.text(); throw new Error("PATCH HTTP " + r.status + ": " + t); }
    return await r.json();
  }

  function zerarLocalStorage(cardId){
    try {
      var raw = localStorage.getItem("projetta_crm_v1");
      if(!raw) return;
      var arr = JSON.parse(raw);
      if(!Array.isArray(arr)) return;
      var alterado = false;
      arr.forEach(function(it){
        if(it && it.id === cardId){
          it.valor = 0;
          it.valor_tabela = 0;
          it.valor_faturamento = 0;
          alterado = true;
        }
      });
      if(alterado){
        localStorage.setItem("projetta_crm_v1", JSON.stringify(arr));
      }
    } catch(e){ console.warn("[116-zerar] erro localStorage:", e); }
  }

  function rerender(){
    if(typeof window.crmRender === "function"){
      try { window.crmRender(); } catch(e){ console.warn("[116-zerar] erro crmRender:", e); }
    }
  }

  async function tratarClick(card, btn){
    var agp = extrairAgp(card);
    var cliente = extrairCliente(card);
    if(!agp && !cliente){
      showToast("Não consegui identificar o card (sem AGP nem cliente)", true);
      return;
    }
    var rotulo = agp || cliente.substring(0, 40);
    if(!confirm("Zerar valores do card \"" + rotulo + "\"?\n\nIsso vai forcar TAB=0 e FAT=0 no kanban.")) return;
    btn.disabled = true; btn.style.opacity = "0.5";
    try {
      var found = await buscarCardId(agp, cliente);
      if(!found){ showToast("Card nao encontrado no banco", true); btn.disabled = false; btn.style.opacity = ""; return; }
      await zerarBanco(found.id);
      zerarLocalStorage(found.id);
      rerender();
      showToast("✓ Card zerado: " + (found.cliente || rotulo));
      console.log("[116-zerar] card " + found.id + " (" + found.cliente + ") zerado");
    } catch(e){
      console.error("[116-zerar] erro:", e);
      showToast("Erro ao zerar: " + e.message, true);
    } finally {
      btn.disabled = false; btn.style.opacity = "";
    }
  }

  function adicionarBotao(card){
    if(!card || card.__projetta116) return;
    if(card.querySelector(".projetta-116-btn")) return;
    card.__projetta116 = true;

    var btn = document.createElement("button");
    btn.className = "projetta-116-btn";
    btn.title = "Zerar valores deste card";
    btn.textContent = "🧹";
    btn.style.cssText = "position:absolute;top:6px;right:6px;width:24px;height:24px;border:none;background:rgba(220,38,38,0.1);color:#dc2626;border-radius:6px;cursor:pointer;font-size:13px;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;opacity:0.55;transition:opacity 0.15s, background 0.15s;z-index:5";
    btn.onmouseenter = function(){ btn.style.opacity = "1"; btn.style.background = "rgba(220,38,38,0.25)"; };
    btn.onmouseleave = function(){ btn.style.opacity = "0.55"; btn.style.background = "rgba(220,38,38,0.1)"; };
    btn.onclick = function(ev){ ev.stopPropagation(); ev.preventDefault(); tratarClick(card, btn); };

    // Garantir position relative no card pra absolute funcionar
    var cs = window.getComputedStyle(card);
    if(cs.position === "static"){ card.style.position = "relative"; }
    card.appendChild(btn);
  }

  function scan(){
    Array.from(document.querySelectorAll(".crm-card")).forEach(adicionarBotao);
  }

  setTimeout(scan, 250);
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

  console.log("[116-zerar-valores-card] instalado");
})();
