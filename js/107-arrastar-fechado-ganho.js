/* ============================================================================
 * js/107-arrastar-fechado-ganho.js  —  Modulo NOVO (26-abr-2026, v2)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: arrastar para Fechado (s6) abre modal com:
 *   - Valor fechado (input)
 *   - Nome cliente para contrato (editavel, pode diferir do orcamento)
 *   - AGP + Reserva (somente leitura, congelados)
 *   - Endereco completo (rua, numero, bairro, cep, cidade, estado, complemento)
 *   - ATP NAO aparece no momento (preenchido manualmente depois)
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta107FechadoGanhoApplied) return;
  window.__projetta107FechadoGanhoApplied = true;
  console.log("[107-arrastar-fechado-ganho] iniciando v2");

  var STAGE_GANHO = "s6";
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
  function escHtml(s){
    if(s == null) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
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

  // Pega dados completos do card (pra puxar endereco, telefone, etc)
  async function getCard(baseUrl, headers, cardId){
    try {
      var url = baseUrl + "/crm_oportunidades?id=eq." + encodeURIComponent(cardId) + "&select=*&limit=1";
      var res = await origFetch(url, { method: "GET", headers: headers });
      if(!res.ok) return null;
      var data = await res.json();
      return (data && data.length > 0) ? data[0] : null;
    } catch(e){ return null; }
  }

  async function criarOrcamentoFechado(baseUrl, headers, versao, dados){
    var registro = {
      id: "of_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
      chave: versao.chave,
      versao: versao.versao,
      card_id: versao.card_id,
      cliente: versao.cliente,
      agp: versao.agp,
      reserva: versao.reserva,
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
      valor_tabela: versao.valor_tabela,
      valor_faturamento: versao.valor_faturamento,
      // Dados do fechamento
      valor_fechado: dados.valor,
      valor_original_versao: versao.valor_faturamento,
      ajuste_percentual_lucro: dados.perc,
      versao_aprovada_origem_id: versao.id,
      cliente_fechamento: dados.cliente_fechamento,
      endereco_rua: dados.endereco_rua,
      endereco_numero: dados.endereco_numero,
      endereco_bairro: dados.endereco_bairro,
      endereco_cep: dados.endereco_cep,
      endereco_cidade: dados.endereco_cidade,
      endereco_estado: dados.endereco_estado,
      endereco_complemento: dados.endereco_complemento,
      // ATP NAO preenchido aqui — Felipe coloca depois
      aprovado_em: versao.aprovado_em,
      aprovado_por: versao.aprovado_por,
      fechado_em: new Date().toISOString(),
      fechado_por: "felipe.projetta"
    };
    return await origFetch(baseUrl + "/orcamentos_fechados", {
      method: "POST",
      headers: Object.assign({}, headers, { "Prefer": "return=representation", "Content-Type": "application/json" }),
      body: JSON.stringify(registro)
    });
  }

  function showModal(versao, card){
    return new Promise(function(resolve){
      var existing = document.getElementById("projetta-107-modal");
      if(existing) existing.remove();

      var valorAprovado = parseFloat(versao.valor_faturamento) || 0;
      var valorTabela = parseFloat(versao.valor_tabela) || 0;
      var clienteOrig = versao.cliente || (card ? card.cliente : "") || "";
      var enderecoCard = (card && card.endereco) ? card.endereco : "";
      var cidadeCard = (card && card.cidade) ? card.cidade : "";
      var estadoCard = (card && card.estado) ? card.estado : "";
      var cepCard = (card && card.cep) ? card.cep : "";

      var overlay = document.createElement("div");
      overlay.id = "projetta-107-modal";
      overlay.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.65);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;overflow-y:auto;padding:20px";

      function inputStyle(){
        return "width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;box-sizing:border-box;background:#fff;color:#111";
      }
      function readonlyStyle(){
        return "width:100%;padding:9px 11px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;box-sizing:border-box;background:#f3f4f6;color:#6b7280;cursor:not-allowed";
      }
      function lblStyle(){
        return "display:block;font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px";
      }

      overlay.innerHTML = (
        '<div style="background:#fff;border-radius:14px;padding:24px;max-width:640px;width:100%;box-shadow:0 25px 70px rgba(0,0,0,0.4);max-height:92vh;overflow-y:auto">' +
          '<div style="font-size:22px;font-weight:700;color:#1f2937;margin-bottom:4px">🏆 Mover para FECHADO</div>' +
          '<div style="font-size:12px;color:#9ca3af;margin-bottom:18px">V' + versao.versao + ' · Preencha os dados do contrato' + '</div>' +

          // Linha 1: AGP + Reserva (readonly)
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
            '<div><label style="'+lblStyle()+'">AGP (congelado)</label><input type="text" value="'+escHtml(versao.agp||"")+'" readonly style="'+readonlyStyle()+'"></div>' +
            '<div><label style="'+lblStyle()+'">Reserva (congelado)</label><input type="text" value="'+escHtml(versao.reserva||"")+'" readonly style="'+readonlyStyle()+'"></div>' +
          '</div>' +

          // Linha 2: Cliente fechamento (editavel)
          '<div style="margin-bottom:12px">' +
            '<label style="'+lblStyle()+'">Nome do cliente para contrato (editavel)</label>' +
            '<input id="proj107-cliente" type="text" value="'+escHtml(clienteOrig)+'" style="'+inputStyle()+'">' +
            '<div style="font-size:10px;color:#9ca3af;margin-top:2px">Pode diferir do nome do orcamento (ex: orcamento em nome da esposa, contrato em nome do marido)</div>' +
          '</div>' +

          // Linha 3: Valor fechado
          '<div style="margin-bottom:18px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px">' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;color:#166534;margin-bottom:6px">' +
              '<span>Tabela: <b>'+fmtBRL(valorTabela)+'</b></span>' +
              '<span>Faturamento: <b>'+fmtBRL(valorAprovado)+'</b></span>' +
            '</div>' +
            '<label style="'+lblStyle()+';color:#065f46">💰 Valor que voce fechou:</label>' +
            '<input id="proj107-valor" type="text" value="'+fmtBRL(valorAprovado)+'" style="width:100%;padding:12px;font-size:18px;font-weight:700;color:#059669;border:2px solid #10b981;border-radius:8px;text-align:right;box-sizing:border-box;background:#fff">' +
            '<div id="proj107-preview" style="margin-top:10px;padding:8px 10px;background:#fff;border-radius:6px;font-size:12px"></div>' +
          '</div>' +

          // Bloco endereco
          '<div style="margin-bottom:12px">' +
            '<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb">📍 Endereco do contrato</div>' +
            '<div style="display:grid;grid-template-columns:3fr 1fr;gap:8px;margin-bottom:8px">' +
              '<div><label style="'+lblStyle()+'">Rua</label><input id="proj107-rua" type="text" value="'+escHtml(enderecoCard)+'" style="'+inputStyle()+'"></div>' +
              '<div><label style="'+lblStyle()+'">Numero</label><input id="proj107-numero" type="text" value="" style="'+inputStyle()+'"></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">' +
              '<div><label style="'+lblStyle()+'">Bairro</label><input id="proj107-bairro" type="text" value="" style="'+inputStyle()+'"></div>' +
              '<div><label style="'+lblStyle()+'">CEP</label><input id="proj107-cep" type="text" value="'+escHtml(cepCard)+'" style="'+inputStyle()+'"></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">' +
              '<div><label style="'+lblStyle()+'">Cidade</label><input id="proj107-cidade" type="text" value="'+escHtml(cidadeCard)+'" style="'+inputStyle()+'"></div>' +
              '<div><label style="'+lblStyle()+'">Estado</label><input id="proj107-estado" type="text" value="'+escHtml(estadoCard)+'" maxlength="2" style="'+inputStyle()+';text-transform:uppercase"></div>' +
            '</div>' +
            '<div><label style="'+lblStyle()+'">Complemento (opcional)</label><input id="proj107-comp" type="text" value="" style="'+inputStyle()+'"></div>' +
          '</div>' +

          '<div style="display:flex;gap:10px;margin-top:18px">' +
            '<button id="proj107-cancel" style="flex:1;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;padding:12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500">Cancelar</button>' +
            '<button id="proj107-ok" style="flex:2;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:12px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🏆 Confirmar fechamento</button>' +
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
          preview.style.background = "#fee2e2"; preview.style.color = "#991b1b";
          return;
        }
        var diff = valorAprovado - valFechado;
        var perc = valorAprovado > 0 ? (diff / valorAprovado * 100) : 0;
        var sinal = diff > 0 ? "Desconto" : (diff < 0 ? "Acrescimo" : "Sem ajuste");
        preview.innerHTML = '<b>📊 '+sinal+':</b> '+fmtBRL(Math.abs(diff))+' ('+(diff >= 0 ? "-" : "+")+Math.abs(perc).toFixed(2)+'%)';
        preview.style.background = diff > 0 ? "#fef3c7" : (diff < 0 ? "#dcfce7" : "#e0e7ff");
        preview.style.color = diff > 0 ? "#78350f" : (diff < 0 ? "#14532d" : "#312e81");
      }
      inp.addEventListener("input", atualizarPreview);
      inp.addEventListener("blur", function(){
        var v = parseBRL(inp.value); if(v > 0) inp.value = fmtBRL(v);
      });
      inp.focus(); inp.select();
      setTimeout(atualizarPreview, 50);

      function cleanup(){ overlay.remove(); document.removeEventListener("keydown", escHandler); }

      overlay.querySelector("#proj107-ok").onclick = function(){
        var valFechado = parseBRL(inp.value);
        if(valFechado <= 0){ alert("Digite um valor valido"); return; }
        var perc = valorAprovado > 0 ? ((valorAprovado - valFechado) / valorAprovado * 100) : 0;
        var dados = {
          valor: valFechado,
          perc: perc,
          cliente_fechamento: overlay.querySelector("#proj107-cliente").value.trim(),
          endereco_rua: overlay.querySelector("#proj107-rua").value.trim(),
          endereco_numero: overlay.querySelector("#proj107-numero").value.trim(),
          endereco_bairro: overlay.querySelector("#proj107-bairro").value.trim(),
          endereco_cep: overlay.querySelector("#proj107-cep").value.trim(),
          endereco_cidade: overlay.querySelector("#proj107-cidade").value.trim(),
          endereco_estado: overlay.querySelector("#proj107-estado").value.trim().toUpperCase(),
          endereco_complemento: overlay.querySelector("#proj107-comp").value.trim()
        };
        cleanup();
        resolve({ ok: true, dados: dados });
      };
      overlay.querySelector("#proj107-cancel").onclick = function(){ cleanup(); resolve({ ok: false }); };
      overlay.onclick = function(e){ if(e.target === overlay){ cleanup(); resolve({ ok: false }); } };
      function escHandler(e){ if(e.key === "Escape"){ cleanup(); resolve({ ok: false }); } }
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

            var versao = await getVersaoAprovadaAtiva(baseUrl, headers, cardId);
            if(!versao){
              showToast("⚠ Card sem versao aprovada — aprove primeiro", "erro");
              return new Response(JSON.stringify({ error: "Sem versao aprovada" }), { status: 400, headers: { "Content-Type": "application/json" } });
            }

            var card = await getCard(baseUrl, headers, cardId);

            console.log("[107-fechado] abrindo modal pra card " + cardId + " (V" + versao.versao + ")");
            var resultado = await showModal(versao, card);
            if(!resultado.ok){
              showToast("Cancelado — card NAO foi movido", "ok");
              return new Response(JSON.stringify({ cancelado: true }), { status: 200, headers: { "Content-Type": "application/json" } });
            }

            var ofRes = await criarOrcamentoFechado(baseUrl, headers, versao, resultado.dados);
            if(!ofRes.ok){
              var errTxt = await ofRes.text();
              console.error("[107-fechado] erro orcamentos_fechados:", errTxt);
              showToast("✗ Erro ao salvar fechamento", "erro");
              return new Response(JSON.stringify({ error: errTxt }), { status: 500, headers: { "Content-Type": "application/json" } });
            }
            console.log("[107-fechado] orcamento_fechado criado");
            showToast("✔ Fechado em " + fmtBRL(resultado.dados.valor), "ok");

            return origFetch.apply(this, arguments);
          }
        }
      }
    } catch(e){
      console.warn("[107-fechado] erro no interceptor:", e);
    }
    return origFetch.apply(this, arguments);
  };

  console.log("[107-arrastar-fechado-ganho] instalado v2");
})();
