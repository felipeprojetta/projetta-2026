/* ============================================================================
 * js/109-autopreencher-data-reserva.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "ao colocar a reserva ja puxe essa data dentro do intranet e
 *          coloque como data primeiro contato"
 *
 * COMPORTAMENTO:
 *  - Detecta input/blur no campo de reserva do modal CRM (crm-o-reserva)
 *  - Faz query em weiku_reservas pelo num_reserva
 *  - Pega data_reserva e preenche automaticamente data_contato (crm-o-data)
 *  - Reage em tempo real
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js, js/23-crm-db.js (BLINDADOS)
 *  - Atua via DOM listeners + supabase REST
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta109AutoDataApplied) return;
  window.__projetta109AutoDataApplied = true;
  console.log("[109-autopreencher-data-reserva] iniciando");

  function getSupabaseUrl(){
    return "https://plmliavuwlgpwaizfeds.supabase.co/rest/v1";
  }
  function getApiKey(){
    return window._SB_KEY || (window.SUPABASE_KEY) || (window.supabase && window.supabase.supabaseKey) || null;
  }

  async function buscarDataReservaIntranet(numReserva){
    var n = parseInt(String(numReserva).trim().replace(/\D/g, ""));
    if(!n || n <= 0) return null;
    var key = getApiKey();
    if(!key){ console.warn("[109-data] sem apikey"); return null; }
    try {
      var url = getSupabaseUrl() + "/weiku_reservas?num_reserva=eq." + n +
                "&select=num_reserva,data_reserva,nome&limit=1";
      var res = await fetch(url, { headers: { "apikey": key, "Authorization": "Bearer " + key } });
      if(!res.ok) return null;
      var data = await res.json();
      if(Array.isArray(data) && data.length > 0) return data[0];
      return null;
    } catch(e){ console.warn("[109-data] erro:", e); return null; }
  }

  function showToast(msg, tipo){
    var t = document.createElement("div");
    t.style.cssText = "position:fixed;top:20px;right:20px;z-index:999998;padding:10px 16px;border-radius:8px;color:#fff;font-size:12px;font-weight:600;box-shadow:0 6px 18px rgba(0,0,0,0.18);background:" + (tipo==="ok" ? "#10b981" : (tipo==="warn" ? "#f59e0b" : "#6b7280"));
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity = "0"; t.style.transition = "opacity 0.4s"; }, 2200);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 2700);
  }

  async function aplicarDataAutomatica(){
    var inpReserva = document.getElementById("crm-o-reserva");
    var inpData = document.getElementById("crm-o-data");
    if(!inpReserva || !inpData) return;
    var num = (inpReserva.value || "").trim();
    if(!num) return;
    // Evita queries repetidas pra mesma reserva
    if(inpReserva.__projetta109LastReserva === num) return;
    inpReserva.__projetta109LastReserva = num;

    var info = await buscarDataReservaIntranet(num);
    if(!info){
      // Reserva nao existe na intranet — silencia (deixa Felipe digitar manual)
      console.log("[109-data] reserva " + num + " nao encontrada na intranet");
      return;
    }
    if(info.data_reserva){
      var atual = (inpData.value || "").trim();
      // So sobrescreve se vazio OU diferente — evita conflito com edicao manual
      if(!atual || atual === "" || atual !== info.data_reserva){
        inpData.value = info.data_reserva;
        inpData.dispatchEvent(new Event("input", { bubbles: true }));
        inpData.dispatchEvent(new Event("change", { bubbles: true }));
        console.log("[109-data] data " + info.data_reserva + " preenchida pra reserva " + num);
        showToast("✔ Data " + info.data_reserva.split("-").reverse().join("/") + " puxada da intranet (reserva " + num + ")", "ok");
      }
    }
  }

  function attachListeners(){
    var inp = document.getElementById("crm-o-reserva");
    if(inp && !inp.__projetta109Hooked){
      inp.__projetta109Hooked = true;
      inp.addEventListener("blur", aplicarDataAutomatica);
      inp.addEventListener("change", aplicarDataAutomatica);
      // Tambem ao colar (Enter ou paste)
      inp.addEventListener("paste", function(){ setTimeout(aplicarDataAutomatica, 100); });
      inp.addEventListener("keydown", function(e){
        if(e.key === "Enter" || e.key === "Tab"){ setTimeout(aplicarDataAutomatica, 80); }
      });
      console.log("[109-data] listeners attached em crm-o-reserva");
    }
  }

  // Polling pra detectar quando o modal CRM abre (input vai aparecer dinamicamente)
  setInterval(attachListeners, 500);
  setTimeout(attachListeners, 300);

  // MutationObserver
  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(){ attachListeners(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[109-autopreencher-data-reserva] instalado");
})();
