/* ============================================================================
 * js/103-pre-orcamento-upsert.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "CONTINUA APARECENDO ESSA MSG SAO SALVAR EM PRE ORCAMENTOS"
 *         (HTTP 409 duplicate key pre_orcamentos_chave_opcao_ativo_key)
 *
 * PROBLEMA:
 *   A tabela pre_orcamentos tem indice UNIQUE PARCIAL:
 *     UNIQUE (chave, opcao_nome) WHERE deleted_at IS NULL
 *   Quando o usuario salva o pre-orcamento pela 2a vez, o app tenta criar
 *   outro registro com mesma (chave, opcao_nome) + deleted_at NULL e bate
 *   na constraint. Resultado: HTTP 409.
 *
 * SOLUCAO:
 *   Interceptar fetch global. Quando detectar POST para /pre_orcamentos:
 *     1. Extrair chave + opcao_nome do body
 *     2. ANTES do POST, fazer PATCH soft-deletando o registro existente
 *        (deleted_at = NOW())
 *     3. Deixar o POST original passar (cria novo registro ativo)
 *   Resultado: nao bate na constraint, mantem historico via deleted_at.
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/81-fix-fluxo-nativo.js (BLINDADO)
 *  - NAO modifica js/23-crm-db.js (BLINDADO)
 *  - Atua via fetch interceptor — fix transparente
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta103PreOrcUpsertApplied) return;
  window.__projetta103PreOrcUpsertApplied = true;
  console.log("[103-pre-orc-upsert] iniciando");

  var origFetch = window.fetch;
  if(!origFetch) return;

  // Detecta URL de pre_orcamentos (Supabase REST)
  function isPreOrcPostUrl(urlStr, method){
    if(!urlStr || method !== "POST") return false;
    return /\/rest\/v1\/pre_orcamentos(?:\?|$)/.test(urlStr);
  }

  function getSupabaseHeaders(originalHeaders){
    // Replicar headers do request original (apikey, Authorization, Content-Type, etc)
    var h = {};
    if(originalHeaders){
      if(originalHeaders.forEach){
        // Headers object
        originalHeaders.forEach(function(v, k){ h[k] = v; });
      } else if(typeof originalHeaders === "object"){
        // Plain object
        for(var k in originalHeaders){
          if(Object.prototype.hasOwnProperty.call(originalHeaders, k)){
            h[k] = originalHeaders[k];
          }
        }
      }
    }
    return h;
  }

  function extractBaseUrl(urlStr){
    // Pegar https://xxx.supabase.co/rest/v1 do url completo
    var m = urlStr.match(/^(https?:\/\/[^/]+\/rest\/v1)/);
    return m ? m[1] : null;
  }

  // Soft-delete do registro existente antes de inserir novo
  async function softDeleteExisting(baseUrl, headers, chave, opcaoNome){
    if(!baseUrl || !chave || !opcaoNome) return false;
    try {
      // PATCH na URL: filtra por chave eq.X & opcao_nome eq.Y & deleted_at is.null
      var url = baseUrl + "/pre_orcamentos" +
                "?chave=eq." + encodeURIComponent(chave) +
                "&opcao_nome=eq." + encodeURIComponent(opcaoNome) +
                "&deleted_at=is.null";
      var nowIso = new Date().toISOString();
      var res = await origFetch(url, {
        method: "PATCH",
        headers: headers,
        body: JSON.stringify({ deleted_at: nowIso })
      });
      if(res.ok){
        console.log("[103-pre-orc-upsert] soft-delete do registro anterior: " + chave + " / " + opcaoNome);
        return true;
      }
      console.warn("[103-pre-orc-upsert] PATCH soft-delete retornou status " + res.status);
      return false;
    } catch(e){
      console.warn("[103-pre-orc-upsert] erro no soft-delete:", e);
      return false;
    }
  }

  window.fetch = async function(input, init){
    try {
      var urlStr = "";
      if(typeof input === "string") urlStr = input;
      else if(input && input.url) urlStr = input.url;
      var method = (init && init.method) || (input && input.method) || "GET";
      method = method.toUpperCase();

      if(isPreOrcPostUrl(urlStr, method)){
        // Extrair body
        var bodyStr = (init && init.body) || (input && input.body) || null;
        if(typeof bodyStr === "string" && bodyStr.length > 0){
          var parsed = null;
          try { parsed = JSON.parse(bodyStr); } catch(e){}
          if(parsed){
            // pode ser array (bulk insert) ou objeto unico
            var registros = Array.isArray(parsed) ? parsed : [parsed];
            var headers = getSupabaseHeaders(init && init.headers);
            // Garantir Content-Type pra PATCH
            if(!headers["Content-Type"] && !headers["content-type"]){
              headers["Content-Type"] = "application/json";
            }
            var baseUrl = extractBaseUrl(urlStr);
            // Soft-delete cada combinacao (chave, opcao_nome) que vai ser inserida
            for(var i = 0; i < registros.length; i++){
              var r = registros[i];
              if(r && r.chave && r.opcao_nome && !r.deleted_at){
                await softDeleteExisting(baseUrl, headers, r.chave, r.opcao_nome);
              }
            }
          }
        }
      }
    } catch(e){
      console.warn("[103-pre-orc-upsert] erro no interceptor (continuando com fetch original):", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[103-pre-orc-upsert] instalado — interceptor ativo");
})();
