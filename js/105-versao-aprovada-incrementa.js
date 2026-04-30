/* ============================================================================
 * js/105-versao-aprovada-incrementa.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "VERSAO APROVADA SEMPRE GERA OUTRA VERSAO A QUE FOI APROVADO
 *          FOI ENVAIDA PARA CLIENTE ENTAO SEMPRE TEM QUE FICAR SALVA
 *          [...]
 *          UMA VEZ APROVADO CONGELA E NADA MUDA"
 *
 * COMPORTAMENTO:
 *  - Intercepta POST /rest/v1/versoes_aprovadas
 *  - Consulta MAX(versao) existente para (chave, opcao_nome)
 *  - 1a aprovacao: cria V1 com AGP-1, ativa=true
 *  - 2a aprovacao: marca V1 como ativa=false (congela), cria V2 com AGP-2 ativa
 *  - 3a aprovacao: marca V2 como ativa=false, cria V3 com AGP-3, etc.
 *
 * VANTAGENS DO TRIGGER versoes_aprovadas_imutavel JA EXISTENTE:
 *  - DELETE bloqueado por banco -> historico nunca se perde
 *  - UPDATE bloqueado em todos os campos exceto "ativa"
 *  - PATCH ativa=false e PERMITIDO -> congela versao antiga
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/81-fix-fluxo-nativo.js (BLINDADO)
 *  - NAO modifica js/23-crm-db.js (BLINDADO)
 *  - NAO toca em triggers existentes
 *  - Atua via fetch interceptor
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta105VersaoAprovadaApplied) return;
  window.__projetta105VersaoAprovadaApplied = true;
  console.log("[105-versao-aprovada-incrementa] iniciando");

  var origFetch = window.fetch;
  if(!origFetch) return;

  function isVersaoPostUrl(urlStr, method){
    if(!urlStr || method !== "POST") return false;
    return /\/rest\/v1\/versoes_aprovadas(?:\?|$)/.test(urlStr);
  }

  function getHeaders(orig){
    var h = {};
    if(orig){
      if(orig.forEach){
        orig.forEach(function(v, k){ h[k] = v; });
      } else if(typeof orig === "object"){
        for(var k in orig){
          if(Object.prototype.hasOwnProperty.call(orig, k)){
            h[k] = orig[k];
          }
        }
      }
    }
    return h;
  }

  function extractBaseUrl(urlStr){
    var m = urlStr.match(/^(https?:\/\/[^/]+\/rest\/v1)/);
    return m ? m[1] : null;
  }

  // Pega versao MAX atual pra (chave, opcao_nome) — inclui versoes ativas e congeladas
  async function getMaxVersao(baseUrl, headers, chave, opcaoNome){
    try {
      var url = baseUrl + "/versoes_aprovadas" +
                "?chave=eq." + encodeURIComponent(chave) +
                "&opcao_nome=eq." + encodeURIComponent(opcaoNome) +
                "&select=versao,id,ativa" +
                "&order=versao.desc&limit=1";
      var res = await origFetch(url, { method: "GET", headers: headers });
      if(!res.ok) return 0;
      var data = await res.json();
      return data && data.length > 0 ? (parseInt(data[0].versao) || 0) : 0;
    } catch(e){
      console.warn("[105-versao] erro getMaxVersao:", e);
      return 0;
    }
  }

  // Congela todas as versoes anteriores (ativa=false)
  async function congelarAnteriores(baseUrl, headers, chave, opcaoNome){
    try {
      var url = baseUrl + "/versoes_aprovadas" +
                "?chave=eq." + encodeURIComponent(chave) +
                "&opcao_nome=eq." + encodeURIComponent(opcaoNome) +
                "&ativa=is.true";
      return await origFetch(url, {
        method: "PATCH",
        headers: headers,
        body: JSON.stringify({ ativa: false })
      });
    } catch(e){
      console.warn("[105-versao] erro congelar:", e);
    }
  }

  // Adiciona/atualiza sufixo "-N" no AGP
  function aplicarSufixoAGP(agp, versao){
    if(!agp) return agp;
    // Remove sufixo "-N" antigo se houver, e aplica novo
    var clean = String(agp).replace(/-\d+$/, "");
    return clean + "-" + versao;
  }

  // Toast feedback
  function showToast(msg, tipo){
    var t = document.createElement("div");
    t.style.cssText = [
      "position:fixed","top:20px","right:20px","z-index:999998",
      "padding:12px 18px","border-radius:8px","color:#fff","font-size:13px",
      "font-weight:600","box-shadow:0 8px 24px rgba(0,0,0,0.2)",
      "background:" + (tipo === "ok" ? "#10b981" : "#ef4444"),
      "transition:opacity 0.3s"
    ].join(";");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity = "0"; }, 2400);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 2900);
  }

  window.fetch = async function(input, init){
    try {
      var urlStr = "";
      if(typeof input === "string") urlStr = input;
      else if(input && input.url) urlStr = input.url;
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

      if(isVersaoPostUrl(urlStr, method)){
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

            // Processar cada registro
            for(var i = 0; i < registros.length; i++){
              var r = registros[i];
              if(!r || !r.chave || !r.opcao_nome) continue;

              var maxVersao = await getMaxVersao(baseUrl, headers, r.chave, r.opcao_nome);
              var novaVersao = maxVersao + 1;

              // Aplicar versao incrementada e flag ativa=true
              r.versao = novaVersao;
              r.ativa = true;
              if(r.agp){
                r.agp = aplicarSufixoAGP(r.agp, novaVersao);
              }

              // Congelar anteriores se existirem
              if(maxVersao > 0){
                await congelarAnteriores(baseUrl, headers, r.chave, r.opcao_nome);
                console.log("[105-versao] V" + maxVersao + " congelada -> criando V" + novaVersao + " (AGP " + r.agp + ")");
                showToast("✔ Nova versao V" + novaVersao + " criada (anteriores congeladas)", "ok");
              } else {
                console.log("[105-versao] 1a aprovacao -> criando V1 (AGP " + r.agp + ")");
                showToast("✔ Versao V1 aprovada (AGP " + r.agp + ")", "ok");
              }
            }

            var newBody = Array.isArray(parsed) ? registros : registros[0];
            var newInit = Object.assign({}, init || {}, { body: JSON.stringify(newBody) });
            return origFetch(input, newInit);
          }
        }
      }
    } catch(e){
      console.warn("[105-versao] erro no interceptor:", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[105-versao-aprovada-incrementa] instalado");
})();
