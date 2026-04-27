/* ============================================================================
 * js/115-bloquear-aprovacao-dupla.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "aprovacao vai ser a versao que estiver aberta"
 *
 * BUG OBSERVADO:
 *  Soraya Favilla — ao clicar em aprovar, o app gerou DUAS versoes
 *  aprovadas (Principal V1 + Opcao 2 V1) com 0.6 segundos de diferenca.
 *  Felipe so queria aprovar a opcao que estava aberta.
 *
 * COMPORTAMENTO:
 *  - Mantem lock por card_id (timestamp do ultimo POST aceito)
 *  - Se outro POST /versoes_aprovadas pra mesmo card_id chega em < 3s,
 *    BLOQUEIA + mostra alerta
 *  - Permite POST espacado (>= 3s) — user pode aprovar opcoes diferentes
 *    em momentos diferentes
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - NAO modifica js/13-planificador_ui.js (BLINDADO)
 *  - NAO modifica js/81-fix-fluxo-nativo.js (BLINDADO)
 *  - Atua via fetch interceptor
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta115BloqAprovDuplaApplied) return;
  window.__projetta115BloqAprovDuplaApplied = true;
  console.log("[115-bloquear-aprovacao-dupla] iniciando");

  var origFetch = window.fetch;
  if(!origFetch) return;

  var WINDOW_MS = 3000; // janela de bloqueio: 3 segundos
  var ultimoPostPorCard = {}; // { card_id: { ts: Date.now(), opcao_nome: "..." } }

  function isVersaoAprovadaPost(urlStr, method){
    if(!urlStr || method !== "POST") return false;
    return /\/rest\/v1\/versoes_aprovadas(?:\?|$)/.test(urlStr);
  }

  function showAlerta(cardId, opcaoBloqueada, opcaoAprovada, segundosAtras){
    var existing = document.getElementById("projetta-115-modal");
    if(existing) existing.remove();
    var overlay = document.createElement("div");
    overlay.id = "projetta-115-modal";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif";
    overlay.innerHTML = (
      '<div style="background:#fff;border-radius:14px;padding:28px;max-width:520px;box-shadow:0 25px 70px rgba(0,0,0,0.4);border-top:5px solid #f59e0b">' +
        '<div style="font-size:48px;text-align:center;margin-bottom:8px">⚠</div>' +
        '<div style="font-size:20px;font-weight:700;color:#92400e;margin-bottom:10px;text-align:center">Aprovacao multipla bloqueada</div>' +
        '<div style="font-size:14px;color:#374151;margin-bottom:18px;line-height:1.5">' +
          'Voce ja aprovou a opcao <b>"' + (opcaoAprovada || "anterior") + '"</b> ha ' + segundosAtras + ' segundos.<br><br>' +
          'A tentativa de aprovar tambem <b>"' + (opcaoBloqueada || "outra opcao") + '"</b> foi <b style="color:#dc2626">BLOQUEADA</b> automaticamente.' +
        '</div>' +
        '<div style="background:#fef3c7;padding:11px;border-radius:8px;font-size:12px;color:#78350f;margin-bottom:18px">' +
          '💡 Apenas a opcao que voce CLICOU em aprovar deve ser congelada. Se voce realmente quer aprovar outra opcao, espere mais alguns segundos e clique manualmente nela.' +
        '</div>' +
        '<button id="proj115-ok" style="width:100%;background:#f59e0b;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">Entendi</button>' +
      '</div>'
    );
    document.body.appendChild(overlay);
    var cleanup = function(){ overlay.remove(); document.removeEventListener("keydown", esc); };
    overlay.querySelector("#proj115-ok").onclick = cleanup;
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
            if(r && r.card_id){
              var agora = Date.now();
              var anterior = ultimoPostPorCard[r.card_id];
              if(anterior && (agora - anterior.ts) < WINDOW_MS){
                var segundos = ((agora - anterior.ts) / 1000).toFixed(1);
                console.warn("[115-bloq-aprov] BLOQUEADO POST duplo pra card " + r.card_id + " (anterior ha " + segundos + "s, opcao_anterior=" + anterior.opcao_nome + ", opcao_nova=" + r.opcao_nome + ")");
                showAlerta(r.card_id, r.opcao_nome, anterior.opcao_nome, segundos);
                return new Response(JSON.stringify({ error: "Aprovacao dupla bloqueada", anterior: anterior.opcao_nome, bloqueado: r.opcao_nome }), {
                  status: 409,
                  headers: { "Content-Type": "application/json" }
                });
              }
              // Permitir e marcar timestamp
              ultimoPostPorCard[r.card_id] = { ts: agora, opcao_nome: r.opcao_nome };
              console.log("[115-bloq-aprov] permitindo POST: card=" + r.card_id + " opcao=" + r.opcao_nome);
            }
          }
        }
      }
    } catch(e){
      console.warn("[115-bloq-aprov] erro:", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[115-bloquear-aprovacao-dupla] instalado (lock " + WINDOW_MS + "ms por card_id)");
})();
