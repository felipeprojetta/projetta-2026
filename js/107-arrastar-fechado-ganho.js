/* ============================================================================
 * js/107-arrastar-fechado-ganho.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "QUANDO ARRASTA PARA O GANHO ABRE TODO ORCAMENTO PARA EU TE DIZER
 *          QUAL VALOR FECHEI E FAZ AJUSTE NAS PROCENTAGENS DE LUCRO PARA
 *          CHEGAR NO VALOR QUE FECHEI"
 *
 * COMPORTAMENTO:
 *  - Detecta PATCH /rest/v1/crm_oportunidades com {stage: "s6"} (Fechado)
 *  - PAUSA o PATCH, abre modal pedindo valor fechado
 *  - Calcula ajuste percentual de lucro para chegar no valor
 *  - Cria registro em orcamentos_fechados (snapshot da versao aprovada ativa)
 *  - Libera o PATCH original (move stage para s6)
 *
 * REQUER: card deve ter pelo menos 1 versao_aprovada ativa
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - NAO modifica js/23-crm-db.js (BLINDADO)
 *  - NAO modifica js/81-fix-fluxo-nativo.js (BLINDADO)
 *  - Atua via fetch interceptor
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta107FechadoGanhoApplied) return;
  window.__projetta107FechadoGanhoApplied = true;
  console.log("[107-arrastar-fechado-ganho] iniciando");

  var STAGE_GANHO = "s6";  // Fechado
  var origFetch = window.fetch;
  if(!origFetch) return;

  function isCrmPatch(urlStr, method){
    if(!urlStr || method !== "PATCH") return false;
    return /\/rest\/v1\/crm_oportunidades\?id=eq\./.test(urlStr);
  }

  function extractCardId(urlStr){
    var m = urlStr.match(/id=eq\.([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function extractBaseUrl(urlStr){
    var m = urlStr.match(/^(https?:\/\/[^/]+\/rest\/v1)/);
    return m ? m[1] : null;
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

  function fmtBRL(v){
    return "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseBRL(text){
    if(!text) return 0;
    var clean = String(text).replace(/[^\d,.]/g, "");
    if(!clean) return 0;
    var lastComma = clean.lastIndexOf(",");
    var lastDot = clean.lastIndexOf(".");
    if(lastComma >= 0 && lastDot >= 0){
      if(lastComma > lastDot){ clean = clean.replace(/\./g, "").replace(",", "."); }
      else { clean = clean.replace(/,/g, ""); }
    } else if(lastComma >= 0){
      var ac = clean.length - lastComma - 1;
      if(ac === 3) clean = clean.replace(/,/g, "");
      else clean = clean.replace(",", ".");
    } else if(lastDot >= 0){
      var ad = clean.length - lastDot - 1;
      if(ad === 3) clean = clean.replace(/\./g, "");
    }
    var n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  // Pega versao aprovada ATIVA do card
  async function getVersaoAprovadaAtiva(baseUrl, headers, cardId){
    try {
      var url = baseUrl + "/versoes_aprovadas" +
                "?card_id=eq." + encodeURIComponent(cardId) +
                "&ativa=is.true&select=*&order=versao.desc&limit=1";
      var res = await origFetch(url, { method: "GET", headers: headers });
      if(!res.ok) return null;
      var data = await res.json();
      return (data && data.length > 0) ? data[0] : null;
    } catch(e){
      console.warn("[107-fechado] erro getVersao:", e);
      return null;
    }
  }

  // Cria registro em orcamentos_fechados
  async function criarOrcamentoFechado(baseUrl, headers, versao, valorFechado, ajustePerc){
    var registro = {
      id: "of_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
      chave: versao.chave,
      versao: versao.versao,
      card_id: versao.card_id,
      cliente: versao.cliente,
      agp: versao.agp,
      reserva: versao.reserva,
      // Snapshot completo (copia todos os jsonb da versao aprovada)
      dados_cliente: versao.dados_cliente,
      dados_projeto: versao.dados_projeto,
      params_financeiros: versao.params_financeiros,
      itens: versao.itens,
      resultado: versao.resultado,
      precos_snapshot: versao.precos_snapshot,
      inputs_raw: versao.inputs_raw,
      paineis_html: versao.paineis_html,
      globais: versao.globais,
      opcao_nome: versao.opcao_nome,
      // Valores
      valor_tabela: versao.valor_tabela,
      valor_faturamento: versao.valor_faturamento,
      valor_fechado: valorFechado,
      valor_original_versao: versao.valor_faturamento,
      ajuste_percentual_lucro: ajustePerc,
      versao_aprovada_origem_id: versao.id,
      // Auditoria
      aprovado_em: versao.aprovado_em,
      aprovado_por: versao.aprovado_por,
      fechado_em: new Date().toISOString(),
      fechado_por: "felipe.projetta"
    };
    var res = await origFetch(baseUrl + "/orcamentos_fechados", {
      method: "POST",
      headers: Object.assign({}, headers, { "Prefer": "return=representation", "Content-Type": "application/json" }),
      body: JSON.stringify(registro)
    });
    return res;
  }

  // Modal
  function showModal(versao){
    return new Promise(function(resolve){
      var existing = document.getElementById("projetta-107-modal");
      if(existing) existing.remove();

      var valorAprovado = parseFloat(versao.valor_faturamento) || 0;
      var valorTabela = parseFloat(versao.valor_tabela) || 0;

      var overlay = document.createElement("div");
      overlay.id = "projetta-107-modal";
      overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.65);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif";

      overlay.innerHTML = (
        '<div style="background:#fff;border-radius:14px;padding:28px;max-width:540px;width:92%;box-shadow:0 25px 70px rgba(0,0,0,0.4)">' +
          '<div style="font-size:22px;font-weight:700;color:#1f2937;margin-bottom:6px">🏆 Mover para FECHADO</div>' +
          '<div style="font-size:13px;color:#6b7280;margin-bottom:20px">Cliente: <b>' + (versao.cliente||"") + '</b> · AGP: <b>' + (versao.agp||"") + '</b> · V' + versao.versao + '</div>' +
          '<div style="background:#f3f4f6;padding:14px 16px;border-radius:8px;margin-bottom:18px;font-size:13px">' +
            '<div style="display:flex;justify-content:space-between;color:#4b5563"><span>Valor de Tabela:</span><b style="color:#1f2937">' + fmtBRL(valorTabela) + '</b></div>' +
            '<div style="display:flex;justify-content:space-between;color:#4b5563;margin-top:6px"><span>Valor de Faturamento:</span><b style="color:#1f2937">' + fmtBRL(valorAprovado) + '</b></div>' +
          '</div>' +
          '<label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">💰 Valor que você fechou:</label>' +
          '<input id="proj107-valor" type="text" value="' + fmtBRL(valorAprovado) + '" style="width:100%;padding:14px;font-size:18px;font-weight:700;color:#059669;border:2px solid #10b981;border-radius:8px;text-align:right;box-sizing:border-box">' +
          '<div id="proj107-preview" style="margin-top:14px;padding:12px 14px;background:#fef3c7;border:1px dashed #d97706;border-radius:8px;font-size:13px;color:#78350f"></div>' +
          '<div style="display:flex;gap:10px;margin-top:22px">' +
            '<button id="proj107-cancel" style="flex:1;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;padding:13px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500">Cancelar</button>' +
            '<button id="proj107-ok" style="flex:2;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:13px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🏆 Confirmar e mover para Fechado</button>' +
          '</div>' +
        '</div>'
      );

      document.body.appendChild(overlay);

      var inp = overlay.querySelector("#proj107-valor");
      var preview = overlay.querySelector("#proj107-preview");

      function atualizarPreview(){
        var valFechado = parseBRL(inp.value);
        if(valFechado <= 0){
          preview.innerHTML = "⚠ Digite um valor valido";
          preview.style.background = "#fee2e2";
          preview.style.borderColor = "#dc2626";
          preview.style.color = "#991b1b";
          return;
        }
        var diff = valorAprovado - valFechado;
        var perc = valorAprovado > 0 ? (diff / valorAprovado * 100) : 0;
        var sinal = diff > 0 ? "Desconto" : (diff < 0 ? "Acrescimo" : "Sem ajuste");
        preview.innerHTML =
          '<b>📊 Ajuste calculado:</b><br>' +
          '<span style="display:inline-block;margin-top:4px">' +
            sinal + ': <b>' + fmtBRL(Math.abs(diff)) + '</b> (' +
            (diff >= 0 ? "-" : "+") + Math.abs(perc).toFixed(2) + '%)' +
          '</span>';
        preview.style.background = diff > 0 ? "#fef3c7" : (diff < 0 ? "#dcfce7" : "#e0e7ff");
        preview.style.borderColor = diff > 0 ? "#d97706" : (diff < 0 ? "#16a34a" : "#6366f1");
        preview.style.color = diff > 0 ? "#78350f" : (diff < 0 ? "#14532d" : "#312e81");
      }

      inp.addEventListener("input", atualizarPreview);
      inp.addEventListener("blur", function(){
        var v = parseBRL(inp.value);
        if(v > 0) inp.value = fmtBRL(v);
      });
      inp.focus();
      inp.select();
      setTimeout(atualizarPreview, 50);

      function cleanup(){ overlay.remove(); document.removeEventListener("keydown", escHandler); }

      overlay.querySelector("#proj107-ok").onclick = function(){
        var valFechado = parseBRL(inp.value);
        if(valFechado <= 0){
          alert("Digite um valor valido");
          return;
        }
        var perc = valorAprovado > 0 ? ((valorAprovado - valFechado) / valorAprovado * 100) : 0;
        cleanup();
        resolve({ ok: true, valor: valFechado, perc: perc });
      };
      overlay.querySelector("#proj107-cancel").onclick = function(){
        cleanup(); resolve({ ok: false });
      };
      overlay.onclick = function(e){
        if(e.target === overlay){ cleanup(); resolve({ ok: false }); }
      };
      function escHandler(e){
        if(e.key === "Escape"){ cleanup(); resolve({ ok: false }); }
      }
      document.addEventListener("keydown", escHandler);
    });
  }

  function showToast(msg, tipo){
    var t = document.createElement("div");
    t.style.cssText = "position:fixed;top:20px;right:20px;z-index:999998;padding:12px 18px;border-radius:8px;color:#fff;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.2);background:" + (tipo==="ok" ? "#10b981" : "#ef4444");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity = "0"; t.style.transition = "opacity 0.4s"; }, 2800);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 3300);
  }

  window.fetch = async function(input, init){
    try {
      var urlStr = "";
      if(typeof input === "string") urlStr = input;
      else if(input && input.url) urlStr = input.url;
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();

      if(isCrmPatch(urlStr, method)){
        var bodyStr = (init && init.body) || (input && input.body) || null;
        if(typeof bodyStr === "string" && bodyStr.length > 0){
          var parsed = null;
          try { parsed = JSON.parse(bodyStr); } catch(e){}
          if(parsed && parsed.stage === STAGE_GANHO){
            var cardId = extractCardId(urlStr);
            var headers = getHeaders(init && init.headers);
            if(!headers["Content-Type"] && !headers["content-type"]){
              headers["Content-Type"] = "application/json";
            }
            var baseUrl = extractBaseUrl(urlStr);

            // Buscar versao aprovada ativa
            var versao = await getVersaoAprovadaAtiva(baseUrl, headers, cardId);
            if(!versao){
              showToast("⚠ Card sem versao aprovada — aprove primeiro", "erro");
              return new Response(JSON.stringify({ error: "Sem versao aprovada" }), {
                status: 400, headers: { "Content-Type": "application/json" }
              });
            }

            // Modal pedindo valor fechado
            console.log("[107-fechado] abrindo modal pra card " + cardId + " (V" + versao.versao + ")");
            var resultado = await showModal(versao);
            if(!resultado.ok){
              showToast("Cancelado — card NAO foi movido", "ok");
              return new Response(JSON.stringify({ cancelado: true }), {
                status: 200, headers: { "Content-Type": "application/json" }
              });
            }

            // Criar orcamento_fechado
            var ofRes = await criarOrcamentoFechado(baseUrl, headers, versao, resultado.valor, resultado.perc);
            if(!ofRes.ok){
              var errTxt = await ofRes.text();
              console.error("[107-fechado] erro orcamentos_fechados:", errTxt);
              showToast("✗ Erro ao salvar fechamento", "erro");
              return new Response(JSON.stringify({ error: errTxt }), {
                status: 500, headers: { "Content-Type": "application/json" }
              });
            }
            console.log("[107-fechado] orcamento_fechado criado: V" + versao.versao + " -> R$ " + resultado.valor.toFixed(2));
            showToast("✔ Fechado em " + fmtBRL(resultado.valor) + " (" + (resultado.perc >= 0 ? "-" : "+") + Math.abs(resultado.perc).toFixed(1) + "%)", "ok");

            // Liberar PATCH original (move stage para s6)
            return origFetch.apply(this, arguments);
          }
        }
      }
    } catch(e){
      console.warn("[107-fechado] erro no interceptor:", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[107-arrastar-fechado-ganho] instalado");
})();
