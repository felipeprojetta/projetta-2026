/* ============================================================================
 * js/108-validar-duplicatas-reserva-agp.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "ja veja para nenhum reserva ser duplicada, nao permita reserva
 *          duplicada, se eu for inserir qualquer coisa no card com reserva
 *          ou agp duplicado me avise e nao permita"
 *
 * COMPORTAMENTO:
 *  - Intercepta POST/PATCH em /rest/v1/crm_oportunidades
 *  - Se body tem reserva: verifica se existe outro card ATIVO com mesma reserva
 *  - Se body tem agp: verifica se existe outro card ATIVO com mesmo agp
 *  - Se duplicado: BLOQUEIA + mostra alerta vermelho com nome do card existente
 *  - Permite atualizar o proprio card (nao compara com ele mesmo)
 *  - Compara apenas com cards ATIVOS (deleted_at IS NULL)
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta108DuplicatasApplied) return;
  window.__projetta108DuplicatasApplied = true;
  console.log("[108-validar-duplicatas] iniciando");

  var origFetch = window.fetch;
  if(!origFetch) return;

  function isCrmWriteUrl(urlStr, method){
    if(!urlStr) return false;
    if(method !== "POST" && method !== "PATCH") return false;
    return /\/rest\/v1\/crm_oportunidades(?:\?|$)/.test(urlStr);
  }
  function extractBaseUrl(urlStr){
    var m = urlStr.match(/^(https?:\/\/[^/]+\/rest\/v1)/);
    return m ? m[1] : null;
  }
  function extractCardId(urlStr){
    var m = urlStr.match(/id=eq\.([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function getHeaders(orig){
    var h = {};
    if(orig){
      if(orig.forEach){ orig.forEach(function(v, k){ h[k] = v; }); }
      else if(typeof orig === "object"){
        for(var k in orig){ if(Object.prototype.hasOwnProperty.call(orig, k)){ h[k] = orig[k]; } }
      }
    }
    return h;
  }

  // Verifica se existe outro card ativo com mesmo (campo, valor)
  // Retorna: { duplicado: true, cliente: "...", id: "..." } ou null
  async function checkDuplicado(baseUrl, headers, campo, valor, ignoreId){
    if(!valor || String(valor).trim() === "") return null;
    try {
      var url = baseUrl + "/crm_oportunidades" +
                "?" + campo + "=eq." + encodeURIComponent(String(valor).trim()) +
                "&deleted_at=is.null" +
                "&select=id,cliente,stage,reserva,agp" +
                "&limit=5";
      var res = await origFetch(url, { method: "GET", headers: headers });
      if(!res.ok) return null;
      var data = await res.json();
      if(!Array.isArray(data) || data.length === 0) return null;
      // Filtrar o proprio card se ignoreId fornecido
      var outros = data.filter(function(c){ return c.id !== ignoreId; });
      if(outros.length === 0) return null;
      return { duplicado: true, cliente: outros[0].cliente, id: outros[0].id, valor: valor };
    } catch(e){
      console.warn("[108-duplicatas] erro check:", e);
      return null;
    }
  }

  // Modal de alerta
  function showAlerta(campo, valor, clienteExistente, idExistente){
    return new Promise(function(resolve){
      var existing = document.getElementById("projetta-108-modal");
      if(existing) existing.remove();
      var overlay = document.createElement("div");
      overlay.id = "projetta-108-modal";
      overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif";
      var nomeCampo = campo === "reserva" ? "Reserva" : "AGP";
      overlay.innerHTML = (
        '<div style="background:#fff;border-radius:14px;padding:28px;max-width:480px;box-shadow:0 25px 70px rgba(0,0,0,0.4);border-top:5px solid #dc2626">' +
          '<div style="font-size:48px;margin-bottom:8px;text-align:center">⛔</div>' +
          '<div style="font-size:20px;font-weight:700;color:#991b1b;margin-bottom:8px;text-align:center">' + nomeCampo + ' duplicado!</div>' +
          '<div style="font-size:14px;color:#374151;margin-bottom:18px;text-align:center;line-height:1.5">' +
            'O ' + nomeCampo.toLowerCase() + ' <b style="color:#dc2626">' + valor + '</b> ja esta em uso pelo card:<br>' +
            '<b style="color:#1f2937">' + (clienteExistente || idExistente) + '</b>' +
          '</div>' +
          '<div style="background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:8px;font-size:12px;color:#991b1b;margin-bottom:18px">' +
            '⚠ Nao e permitido duplicar ' + nomeCampo.toLowerCase() + '. Cada ' + nomeCampo.toLowerCase() + ' deve ser unica entre os cards ativos.' +
          '</div>' +
          '<button id="proj108-ok" style="width:100%;background:#dc2626;color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600">Entendi</button>' +
        '</div>'
      );
      document.body.appendChild(overlay);
      function cleanup(){ overlay.remove(); document.removeEventListener("keydown", esc); }
      overlay.querySelector("#proj108-ok").onclick = function(){ cleanup(); resolve(); };
      function esc(e){ if(e.key === "Escape" || e.key === "Enter"){ cleanup(); resolve(); } }
      document.addEventListener("keydown", esc);
    });
  }

  window.fetch = async function(input, init){
    try {
      var urlStr = "";
      if(typeof input === "string") urlStr = input;
      else if(input && input.url) urlStr = input.url;
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

      if(isCrmWriteUrl(urlStr, method)){
        var bodyStr = (init && init.body) || (input && input.body) || null;
        if(typeof bodyStr === "string" && bodyStr.length > 0){
          var parsed = null;
          try { parsed = JSON.parse(bodyStr); } catch(e){}
          if(parsed){
            var registros = Array.isArray(parsed) ? parsed : [parsed];
            var headers = getHeaders(init && init.headers);
            if(!headers["Content-Type"] && !headers["content-type"]){
              headers["Content-Type"] = "application/json";
            }
            var baseUrl = extractBaseUrl(urlStr);
            var ignoreId = (method === "PATCH") ? extractCardId(urlStr) : null;

            // Verificar duplicatas pra cada registro
            for(var i = 0; i < registros.length; i++){
              var r = registros[i];
              if(!r) continue;
              var idDoBody = r.id || ignoreId;

              // Checar reserva
              if(r.reserva && String(r.reserva).trim() !== ""){
                var dupReserva = await checkDuplicado(baseUrl, headers, "reserva", r.reserva, idDoBody);
                if(dupReserva){
                  console.warn("[108-duplicatas] BLOQUEADO: reserva " + r.reserva + " ja em uso por " + dupReserva.cliente);
                  await showAlerta("reserva", r.reserva, dupReserva.cliente, dupReserva.id);
                  return new Response(JSON.stringify({ error: "Reserva duplicada", reserva: r.reserva, cliente_existente: dupReserva.cliente }), {
                    status: 409, headers: { "Content-Type": "application/json" }
                  });
                }
              }

              // Checar AGP
              if(r.agp && String(r.agp).trim() !== ""){
                var dupAgp = await checkDuplicado(baseUrl, headers, "agp", r.agp, idDoBody);
                if(dupAgp){
                  console.warn("[108-duplicatas] BLOQUEADO: AGP " + r.agp + " ja em uso por " + dupAgp.cliente);
                  await showAlerta("agp", r.agp, dupAgp.cliente, dupAgp.id);
                  return new Response(JSON.stringify({ error: "AGP duplicado", agp: r.agp, cliente_existente: dupAgp.cliente }), {
                    status: 409, headers: { "Content-Type": "application/json" }
                  });
                }
              }
            }
          }
        }
      }
    } catch(e){
      console.warn("[108-duplicatas] erro no interceptor:", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[108-validar-duplicatas] instalado");
})();
