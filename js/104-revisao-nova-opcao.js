/* ============================================================================
 * js/104-revisao-nova-opcao.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "QUANDO CLICAR EM EDITAR SE FOR SOMENTE REVISAR GRAVA EM CIMA, SE
 *          FALAR QUE E UMA NOVA OPCAO AI GRAVA UMA NOVA VERSAO"
 *
 * COMPORTAMENTO:
 *  - Ao salvar pre-orcamento, intercepta o POST.
 *  - Se NAO existe registro com (chave, opcao_nome) ativo: salva direto (1o save).
 *  - Se EXISTE: abre modal perguntando:
 *      [REVISAO] -> faz PATCH no existente (grava em cima)
 *      [NOVA OPCAO] -> pede nome, faz INSERT com novo opcao_nome (mantem o antigo)
 *      [CANCELAR] -> nao salva
 *
 * SUBSTITUI MODULO 103:
 *  - Define window.__projetta103PreOrcUpsertApplied = true antes de mod103 rodar
 *  - Carrega ANTES de mod103 no index.html
 *  - O mod103 ve a flag e desiste de instalar (mantendo a regra de blindagem)
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/81-fix-fluxo-nativo.js (BLINDADO)
 *  - NAO modifica js/23-crm-db.js (BLINDADO)
 *  - Atua via fetch interceptor
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta104RevisaoApplied) return;
  window.__projetta104RevisaoApplied = true;
  // Bloqueia mod103 (substituido por este modulo)
  window.__projetta103PreOrcUpsertApplied = true;
  console.log("[104-revisao-nova-opcao] iniciando — substituindo mod103");

  var origFetch = window.fetch;
  if(!origFetch) return;

  function isPreOrcPostUrl(urlStr, method){
    if(!urlStr || method !== "POST") return false;
    return /\/rest\/v1\/pre_orcamentos(?:\?|$)/.test(urlStr);
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

  // Verifica se existe registro ativo com mesma chave + opcao_nome
  async function checkExists(baseUrl, headers, chave, opcaoNome){
    try {
      var url = baseUrl + "/pre_orcamentos" +
                "?chave=eq." + encodeURIComponent(chave) +
                "&opcao_nome=eq." + encodeURIComponent(opcaoNome) +
                "&deleted_at=is.null" +
                "&select=id";
      var res = await origFetch(url, { method: "GET", headers: headers });
      if(!res.ok) return null;
      var data = await res.json();
      if(Array.isArray(data) && data.length > 0) return data[0].id;
      return null;
    } catch(e){
      console.warn("[104-revisao] erro check:", e);
      return null;
    }
  }

  // PATCH no registro existente (Revisao - grava em cima)
  async function patchExistente(baseUrl, headers, idExistente, novoBody){
    var url = baseUrl + "/pre_orcamentos?id=eq." + encodeURIComponent(idExistente);
    var bodyClean = Object.assign({}, novoBody);
    delete bodyClean.id;
    bodyClean.updated_at = new Date().toISOString();
    var patchHeaders = Object.assign({}, headers, { "Prefer": "return=representation" });
    return await origFetch(url, {
      method: "PATCH",
      headers: patchHeaders,
      body: JSON.stringify(bodyClean)
    });
  }

  // Sugere nome pra Nova Opcao
  function sugerirNome(atual){
    if(!atual) return "Opcao 2";
    if(/principal/i.test(atual)) return "Opcao 2";
    var m = atual.match(/(\d+)\s*$/);
    if(m) return atual.replace(/(\d+)\s*$/, "") + (parseInt(m[1]) + 1);
    return atual + " v2";
  }

  // Modal UI
  function showRevisaoModal(opcaoAtual){
    return new Promise(function(resolve){
      var existing = document.getElementById("projetta-104-modal");
      if(existing) existing.remove();

      var overlay = document.createElement("div");
      overlay.id = "projetta-104-modal";
      overlay.style.cssText = [
        "position:fixed","top:0","left:0","width:100vw","height:100vh",
        "background:rgba(0,0,0,0.65)","z-index:999999",
        "display:flex","align-items:center","justify-content:center",
        "font-family:system-ui,-apple-system,sans-serif",
        "animation:proj104fadein 0.18s ease"
      ].join(";");

      // Animation keyframes (so puxa uma vez)
      if(!document.getElementById("proj104-style")){
        var sty = document.createElement("style");
        sty.id = "proj104-style";
        sty.textContent = "@keyframes proj104fadein{from{opacity:0}to{opacity:1}} #proj104-card{animation:proj104slidein 0.22s cubic-bezier(.16,1,.3,1)} @keyframes proj104slidein{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}";
        document.head.appendChild(sty);
      }

      overlay.innerHTML = (
        '<div id="proj104-card" style="background:#fff;border-radius:14px;padding:28px;max-width:520px;width:90%;box-shadow:0 25px 70px rgba(0,0,0,0.4)">' +
          '<div style="font-size:20px;font-weight:700;color:#1f2937;margin-bottom:6px">💾 Pre-orcamento ja existe</div>' +
          '<div style="font-size:13px;color:#6b7280;margin-bottom:22px;line-height:1.5">Ja existe um pre-orcamento salvo para a opcao <b style="color:#374151">"' + opcaoAtual + '"</b>.<br>O que voce quer fazer?</div>' +
          '<div style="display:flex;flex-direction:column;gap:10px">' +
            '<button id="proj104-btn-revisao" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;padding:16px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;text-align:left;transition:transform 0.1s">' +
              '<div style="display:flex;align-items:center;gap:8px;font-size:15px"><span style="font-size:18px">🔄</span> Revisao &mdash; Gravar em cima</div>' +
              '<div style="font-size:11px;font-weight:400;margin-top:5px;opacity:0.92;line-height:1.4">O pre-orcamento atual sera atualizado. Os dados antigos serao substituidos.</div>' +
            '</button>' +
            '<button id="proj104-btn-nova" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:16px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;text-align:left;transition:transform 0.1s">' +
              '<div style="display:flex;align-items:center;gap:8px;font-size:15px"><span style="font-size:18px">➕</span> Nova Opcao &mdash; Criar nova versao</div>' +
              '<div style="font-size:11px;font-weight:400;margin-top:5px;opacity:0.92;line-height:1.4">Cria nova opcao mantendo o pre-orcamento anterior intacto como historico.</div>' +
            '</button>' +
            '<button id="proj104-btn-cancel" style="background:#f3f4f6;color:#374151;border:1px solid #d1d5db;padding:11px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;margin-top:4px">❌ Cancelar (nao salvar)</button>' +
          '</div>' +
        '</div>'
      );

      document.body.appendChild(overlay);

      function cleanup(){ overlay.remove(); document.removeEventListener("keydown", escHandler); }

      overlay.querySelector("#proj104-btn-revisao").onclick = function(){
        cleanup();
        resolve("revisao");
      };
      overlay.querySelector("#proj104-btn-nova").onclick = function(){
        var nome = window.prompt("Nome da nova opcao:", sugerirNome(opcaoAtual));
        if(!nome || !nome.trim()){ cleanup(); resolve("cancel"); return; }
        cleanup();
        resolve({ tipo: "nova", nome: nome.trim() });
      };
      overlay.querySelector("#proj104-btn-cancel").onclick = function(){
        cleanup();
        resolve("cancel");
      };
      // Click no overlay (fora do card) tambem cancela
      overlay.onclick = function(e){
        if(e.target === overlay){ cleanup(); resolve("cancel"); }
      };
      function escHandler(e){
        if(e.key === "Escape"){ cleanup(); resolve("cancel"); }
      }
      document.addEventListener("keydown", escHandler);
    });
  }

  // Toast de feedback (canto superior direito)
  function showToast(msg, tipo){
    var t = document.createElement("div");
    t.style.cssText = [
      "position:fixed","top:20px","right:20px","z-index:999998",
      "padding:12px 18px","border-radius:8px","color:#fff","font-size:13px",
      "font-weight:600","box-shadow:0 8px 24px rgba(0,0,0,0.2)",
      "background:" + (tipo === "ok" ? "#10b981" : "#ef4444"),
      "animation:proj104slidein 0.25s ease"
    ].join(";");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity = "0"; t.style.transition = "opacity 0.4s"; }, 2400);
    setTimeout(function(){ t.remove(); }, 2900);
  }

  window.fetch = async function(input, init){
    try {
      var urlStr = "";
      if(typeof input === "string") urlStr = input;
      else if(input && input.url) urlStr = input.url;
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

      if(isPreOrcPostUrl(urlStr, method)){
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

            // Por enquanto trata 1 registro (caso normal — multi-registro seria batch raro)
            var r = registros[0];
            if(r && r.chave && r.opcao_nome && !r.deleted_at){
              var idExistente = await checkExists(baseUrl, headers, r.chave, r.opcao_nome);
              if(idExistente){
                console.log("[104-revisao] registro existente detectado, abrindo modal");
                var escolha = await showRevisaoModal(r.opcao_nome);
                if(escolha === "cancel"){
                  showToast("⚠ Salvamento cancelado", "ok");
                  // Retornar resposta sintetica de "cancelado" pra app nao quebrar
                  return new Response(JSON.stringify([{ id: idExistente, _cancelado: true }]), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                  });
                }
                if(escolha === "revisao"){
                  console.log("[104-revisao] aplicando REVISAO em " + idExistente);
                  var patchRes = await patchExistente(baseUrl, headers, idExistente, r);
                  if(patchRes.ok){
                    showToast("✔ Revisao salva (gravado em cima)", "ok");
                  } else {
                    showToast("✗ Erro ao salvar revisao", "erro");
                  }
                  return patchRes;
                }
                if(typeof escolha === "object" && escolha.tipo === "nova"){
                  console.log("[104-revisao] criando NOVA OPCAO: " + escolha.nome);
                  // Renomear opcao_nome no body, deixar POST passar normal
                  r.opcao_nome = escolha.nome;
                  // Tambem garantir id novo
                  if(r.id) r.id = r.id + "_v" + Date.now().toString(36);
                  var newBody = Array.isArray(parsed) ? [r] : r;
                  var newInit = Object.assign({}, init || {}, { body: JSON.stringify(newBody) });
                  var insertRes = await origFetch(input, newInit);
                  if(insertRes.ok){
                    showToast("✔ Nova opcao criada: " + escolha.nome, "ok");
                  } else {
                    showToast("✗ Erro ao criar nova opcao", "erro");
                  }
                  return insertRes;
                }
              }
              // Nao existe -> primeiro save, deixa passar normal
            }
          }
        }
      }
    } catch(e){
      console.warn("[104-revisao] erro no interceptor:", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[104-revisao-nova-opcao] instalado");
})();
