/* ============================================================================
 * js/116-aprovar-so-marcada-estrela.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "e simples o que vai quando clicar em aprovado para envio e o que
 *          esta com a estrela ativada"
 *
 * COMPORTAMENTO:
 *  - Intercepta POST /versoes_aprovadas
 *  - Para cada POST, descobre qual eh a opcao marcada com ⭐ no card_id
 *    (busca no pre_orcamentos com principal_pipeline=true)
 *  - Se opcao_nome do POST BATE com a marcada: deixa passar
 *  - Se NAO BATE: bloqueia silenciosamente (log apenas)
 *  - Se NENHUMA opcao tem ⭐ marcada: alerta + bloqueia tudo
 *
 * Eh complementar ao mod 115 (lock 3s por timestamp).
 * Os 2 mods juntos garantem que apenas 1 opcao por aprovacao seja processada.
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/81-fix-fluxo-nativo.js (BLINDADO)
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - Atua via fetch interceptor
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta116AprovOnlyStarApplied) return;
  window.__projetta116AprovOnlyStarApplied = true;
  console.log("[116-aprovar-so-marcada] iniciando");

  var SB_URL = "https://plmliavuwlgpwaizfeds.supabase.co";
  var origFetch = window.fetch;
  if(!origFetch){ console.warn("[116] fetch indisponivel"); return; }

  // Cache de "qual opcao esta marcada com estrela" por card_id (15s)
  var cacheMarcada = {};  // { card_id: { opcao_nome, ts } }

  function isVersaoAprovadaPost(urlStr, method){
    if(!urlStr || method !== "POST") return false;
    return /\/rest\/v1\/versoes_aprovadas(?:\?|$)/.test(urlStr);
  }

  // Busca no banco quem eh principal_pipeline=true (em ambas tabelas)
  async function descobrirMarcada(card_id){
    var c = cacheMarcada[card_id];
    if(c && (Date.now() - c.ts) < 15000) return c.opcao_nome;

    try {
      var headers = {
        "apikey": window._SB_KEY,
        "Authorization": "Bearer " + window._SB_KEY
      };
      // Olhar primeiro pre_orcamentos
      var r = await origFetch.call(window, SB_URL + "/rest/v1/pre_orcamentos?card_id=eq." + encodeURIComponent(card_id) + "&principal_pipeline=eq.true&deleted_at=is.null&select=opcao_nome", { headers: headers });
      var arr = await r.json();
      if(arr && arr.length){
        cacheMarcada[card_id] = { opcao_nome: arr[0].opcao_nome, ts: Date.now() };
        return arr[0].opcao_nome;
      }
      // Se nao tem em pre_orcamentos, olhar versoes_aprovadas
      var r2 = await origFetch.call(window, SB_URL + "/rest/v1/versoes_aprovadas?card_id=eq." + encodeURIComponent(card_id) + "&ativa=eq.true&principal_pipeline=eq.true&select=opcao_nome", { headers: headers });
      var arr2 = await r2.json();
      if(arr2 && arr2.length){
        cacheMarcada[card_id] = { opcao_nome: arr2[0].opcao_nome, ts: Date.now() };
        return arr2[0].opcao_nome;
      }
      cacheMarcada[card_id] = { opcao_nome: null, ts: Date.now() };
      return null;
    } catch(e){
      console.warn("[116] erro buscando marcada:", e);
      return null;
    }
  }

  // Reset cache quando user marca nova estrela (mod 114)
  window.__projetta116InvalidarCache = function(card_id){
    if(card_id) delete cacheMarcada[card_id];
    else cacheMarcada = {};
  };

  var alertasMostradosPorCard = {};

  function mostrarAlertaSemEstrela(opcao_nome, card_id){
    if(alertasMostradosPorCard[card_id]) return;
    alertasMostradosPorCard[card_id] = true;
    setTimeout(function(){ delete alertasMostradosPorCard[card_id]; }, 5000);

    var existing = document.getElementById("projetta-116-modal");
    if(existing) existing.remove();
    var overlay = document.createElement("div");
    overlay.id = "projetta-116-modal";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif";
    overlay.innerHTML = (
      '<div style="background:#fff;border-radius:14px;padding:28px;max-width:520px;box-shadow:0 25px 70px rgba(0,0,0,0.4);border-top:5px solid #f59e0b">' +
        '<div style="font-size:48px;text-align:center;margin-bottom:8px">⭐</div>' +
        '<div style="font-size:20px;font-weight:700;color:#92400e;margin-bottom:10px;text-align:center">Marque a opcao com ⭐ primeiro</div>' +
        '<div style="font-size:14px;color:#374151;margin-bottom:18px;line-height:1.5">' +
          'Voce clicou em <b>Aprovar para Envio</b>, mas <b>nenhuma opcao</b> esta marcada com ⭐ Pipeline.<br><br>' +
          'Abra <b>📋 Pre-Orcamentos Salvos</b>, marque a opcao que voce quer aprovar com a estrela ⭐, depois clique em Aprovar para Envio novamente.' +
        '</div>' +
        '<button id="proj116-ok" style="width:100%;background:#f59e0b;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">Entendi</button>' +
      '</div>'
    );
    document.body.appendChild(overlay);
    var cleanup = function(){ overlay.remove(); document.removeEventListener("keydown", esc); };
    overlay.querySelector("#proj116-ok").onclick = cleanup;
    function esc(e){ if(e.key === "Escape" || e.key === "Enter"){ cleanup(); } }
    document.addEventListener("keydown", esc);
  }

  window.fetch = async function(input, init){
    try {
      var urlStr = "";
      if(typeof input === "string") urlStr = input;
      else if(input && input.url) urlStr = input.url;
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

      if(isVersaoAprovadaPost(urlStr, method)){
        var bodyStr = (init && init.body) || (input && input.body) || null;
        if(typeof bodyStr === "string" && bodyStr.length > 0){
          var parsed = null;
          try { parsed = JSON.parse(bodyStr); } catch(e){}
          if(parsed){
            var registros = Array.isArray(parsed) ? parsed : [parsed];
            var r = registros[0];
            if(r && r.card_id && r.opcao_nome){
              var marcada = await descobrirMarcada(r.card_id);
              if(!marcada){
                console.warn("[116] BLOQUEADO POST de \"" + r.opcao_nome + "\" — nenhuma opcao marcada com estrela no card " + r.card_id);
                mostrarAlertaSemEstrela(r.opcao_nome, r.card_id);
                return new Response(JSON.stringify({ error: "Nenhuma opcao marcada com estrela", bloqueado: r.opcao_nome }), {
                  status: 409,
                  headers: { "Content-Type": "application/json" }
                });
              }
              if(marcada !== r.opcao_nome){
                console.warn("[116] BLOQUEADO POST de \"" + r.opcao_nome + "\" porque a marcada com ⭐ eh \"" + marcada + "\" (card " + r.card_id + ")");
                return new Response(JSON.stringify({ error: "Opcao nao eh a marcada com estrela", marcada: marcada, bloqueado: r.opcao_nome }), {
                  status: 409,
                  headers: { "Content-Type": "application/json" }
                });
              }
              console.log("[116] PERMITIDO POST de \"" + r.opcao_nome + "\" (eh a marcada com ⭐)");
              // Invalida cache para forcar refresh apos aprovacao
              setTimeout(function(){ delete cacheMarcada[r.card_id]; }, 500);
            }
          }
        }
      }
    } catch(e){
      console.warn("[116] erro:", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[116-aprovar-so-marcada] instalado (filtra POST /versoes_aprovadas pela ⭐)");
})();
