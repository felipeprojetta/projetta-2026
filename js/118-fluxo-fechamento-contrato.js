/* ============================================================================
 * js/118-fluxo-fechamento-contrato.js  — v1 (27-abr-2026)
 * Autorizado por Felipe Xavier de Lima.
 *
 * SUBSTITUI mod 107 (desativado).
 *
 * COMPORTAMENTO:
 *  1. Detecta drag-drop pra coluna Fechado (s6)
 *  2. Modal 1 (rapido): Data fechamento contrato + Valor final fechado
 *     - Mostra ajuste % de lucro (vermelho se negativo)
 *     - Cancelar = aborta drop / Continuar = move card pra s6
 *  3. Apos drop OK, abre Modal 2 (Contrato completo):
 *     - Identificacao (ATP + auto-busca em weiku_reservas)
 *     - Comprador (nome, CPF, RG, endereco, emails, telefone)
 *     - Entrega/Obra (endereco, CNO, pessoa autorizada)
 *     - Preco (produtos + servicos breakdown)
 *     - Pagamento (forma, parcelas — calcula auto)
 *  4. Salvar = INSERT em orcamentos_fechados
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta118FluxoFechamentoApplied) return;
  window.__projetta118FluxoFechamentoApplied = "v1";
  console.log("[118-fluxo-fechamento] iniciando");

  var SB_URL = "https://plmliavuwlgpwaizfeds.supabase.co";
  var origFetch = window.fetch;

  function sbFetch(path, init){
    init = init || {};
    init.headers = Object.assign({
      "apikey": window._SB_KEY,
      "Authorization": "Bearer " + window._SB_KEY,
      "Content-Type": "application/json"
    }, init.headers || {});
    return origFetch.call(window, SB_URL + path, init);
  }

  function fmtBRL(v){
    var n = Number(v) || 0;
    return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function parseBRL(str){
    if(typeof str !== "string") return Number(str) || 0;
    return Number(str.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
  }
  function hoje(){ return new Date().toISOString().substring(0,10); }
  function addDias(dataIso, dias){
    var d = new Date(dataIso + "T00:00:00");
    d.setDate(d.getDate() + dias);
    return d.toISOString().substring(0,10);
  }
  function addMeses(dataIso, meses){
    var d = new Date(dataIso + "T00:00:00");
    d.setMonth(d.getMonth() + meses);
    return d.toISOString().substring(0,10);
  }
  function formatarData(iso){
    if(!iso) return "";
    var d = new Date(iso + "T00:00:00");
    var dd = String(d.getDate()).padStart(2,"0");
    var mm = String(d.getMonth()+1).padStart(2,"0");
    var yy = d.getFullYear();
    return dd + "/" + mm + "/" + yy;
  }
  // Estado: cards processados nesta sessao (evita re-trigger por race)
  var cardsProcessando = {};

  var STAGE_FECHADO = "s6";
  var STAGE_INTRANET = "s1777269819911";

  // Detecta POST upsert OU PATCH em /crm_oportunidades pra Fechado ou Intranet
  function getStageDestino(urlStr, method, init){
    if(method !== "PATCH" && method !== "POST") return null;
    if(!/\/rest\/v1\/crm_oportunidades(\?|$)/.test(urlStr)) return null;
    var bodyStr = (init && init.body) || null;
    if(typeof bodyStr !== "string") return null;
    try {
      var p = JSON.parse(bodyStr);
      var rec = Array.isArray(p) ? p[0] : p;
      if(!rec) return null;
      var destino = null;
      if(rec.stage === STAGE_FECHADO) destino = "fechado";
      else if(rec.stage === STAGE_INTRANET) destino = "intranet";
      else return null;
      var card_id = rec.id || null;
      if(!card_id){
        var m = urlStr.match(/id=eq\.([^&]+)/);
        if(m) card_id = decodeURIComponent(m[1]);
      }
      return card_id ? { card_id: card_id, registro: rec, destino: destino } : null;
    } catch(e){ return null; }
  }

  // Wrap fetch — detecta drop pra Fechado
  window.fetch = async function(input, init){
    try {
      var urlStr = typeof input === "string" ? input : (input && input.url) || "";
      var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      var detectado = getStageDestino(urlStr, method, init);
      if(detectado){
        var card_id = detectado.card_id;
        if(cardsProcessando[card_id]){
          delete cardsProcessando[card_id];
          return origFetch.apply(this, arguments);
        }
        if(detectado.destino === "fechado"){
          // Drop em Fechado (s6) → Modal 1 (data + valor)
          console.log("[118] interceptando drop pra Fechado — card " + card_id);
          var dadosM1 = await mostrarModal1(card_id);
          if(!dadosM1){
            console.log("[118] usuario cancelou Modal 1 — abortando drop");
            setTimeout(function(){
              var btnR = document.querySelector("[onclick*=refresh],[onclick*=Refresh]");
              if(btnR) btnR.click();
            }, 100);
            return new Response(JSON.stringify({ error: "drop cancelado" }), { status: 409, headers: { "Content-Type": "application/json" } });
          }
          cardsProcessando[card_id] = true;
          var resp = await origFetch.apply(this, arguments);
          console.log("[118] Fechado registrado. Felipe vai criar no Weiku, depois arrastar pra Intranet (Modal 2)");
          return resp;
        } else if(detectado.destino === "intranet"){
          // Drop em Intranet (s1777269819911) → Modal 2 (contrato completo)
          console.log("[118] interceptando drop pra Intranet — card " + card_id);
          cardsProcessando[card_id] = true;
          var resp2 = await origFetch.apply(this, arguments);
          // Abrir Modal 2 apos drop
          setTimeout(function(){ mostrarModal2(card_id); }, 600);
          return resp2;
        }
      }
    } catch(e){ console.warn("[118] erro no interceptor:", e); }
    return origFetch.apply(this, arguments);
  };
  async function mostrarModal1(card_id){
    // Buscar dados do card pra mostrar valor original
    var card = null;
    try {
      var r = await sbFetch("/rest/v1/crm_oportunidades?id=eq." + encodeURIComponent(card_id) + "&select=cliente,agp,valor_tabela,valor_faturamento");
      var arr = await r.json();
      if(arr && arr.length) card = arr[0];
    } catch(e){}
    if(!card){ alert("Erro ao carregar dados do card"); return null; }

    var card_id_do_drop = card_id;
    return new Promise(function(resolve){
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui";
      ov.innerHTML = 
        '<div style="background:#fff;border-radius:14px;padding:28px;width:480px;max-width:92vw;box-shadow:0 25px 70px rgba(0,0,0,.4);border-top:5px solid #16a34a">' +
          '<div style="font-size:22px;font-weight:700;color:#166534;margin-bottom:6px">🏆 Confirmar Fechamento</div>' +
          '<div style="font-size:13px;color:#6b7280;margin-bottom:18px">' + (card.cliente||"") + ' • ' + (card.agp||"-") + '</div>' +
          '<div style="background:#f3f4f6;padding:12px;border-radius:8px;margin-bottom:18px">' +
            '<div style="font-size:11px;color:#6b7280">Faturamento original</div>' +
            '<div style="font-size:18px;font-weight:700;color:#111827">' + fmtBRL(card.valor_faturamento) + '</div>' +
          '</div>' +
          '<label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">📅 Data Fechamento Pedido</label>' +
          '<input type="date" id="m1-data" value="' + hoje() + '" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;margin-bottom:14px">' +
          '<label style="display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px">💰 Valor Final Fechado (R$)</label>' +
          '<input type="number" step="0.01" id="m1-valor" value="' + (card.valor_faturamento || 0) + '" style="width:100%;padding:10px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;margin-bottom:14px">' +
          '<div id="m1-ajuste" style="background:#f3f4f6;padding:10px;border-radius:8px;margin-bottom:18px;font-size:13px"></div>' +
          '<div style="display:flex;gap:10px">' +
            '<button id="m1-cancelar" style="flex:1;background:#f3f4f6;color:#374151;border:none;padding:11px;border-radius:8px;cursor:pointer;font-weight:600">Cancelar</button>' +
            '<button id="m1-ok" style="flex:2;background:#16a34a;color:#fff;border:none;padding:11px;border-radius:8px;cursor:pointer;font-weight:600">Continuar →</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);

      var inpVal = ov.querySelector("#m1-valor");
      var divAj = ov.querySelector("#m1-ajuste");
      function recalc(){
        var v = parseFloat(inpVal.value) || 0;
        var orig = parseFloat(card.valor_faturamento) || 0;
        if(orig <= 0){ divAj.innerHTML = "Sem valor original — primeira venda"; return; }
        var diff = v - orig;
        var pct = (diff/orig)*100;
        var cor = pct < 0 ? "#dc2626" : (pct > 0 ? "#16a34a" : "#6b7280");
        var sinal = pct < 0 ? "▼" : (pct > 0 ? "▲" : "—");
        divAj.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><span>Variação:</span><span style="color:' + cor + ';font-weight:700">' + sinal + ' ' + Math.abs(pct).toFixed(2) + '% (' + fmtBRL(diff) + ')</span></div>';
      }
      recalc();
      inpVal.oninput = recalc;

      ov.querySelector("#m1-cancelar").onclick = function(){ ov.remove(); resolve(null); };
      ov.querySelector("#m1-ok").onclick = async function(){
        var data = ov.querySelector("#m1-data").value;
        var valor = parseFloat(inpVal.value) || 0;
        if(!data){ alert("Informe a data de fechamento"); return; }
        if(valor <= 0){ alert("Informe valor fechado válido"); return; }
        var btnOk = this;
        btnOk.disabled = true;
        btnOk.innerHTML = "💾 Salvando...";
        try {
          var ajuste = null;
          if(card.valor_faturamento > 0){
            ajuste = ((valor - card.valor_faturamento) / card.valor_faturamento) * 100;
          }
          // INSERT parcial em orcamentos_fechados (Modal 2 fará UPDATE depois com dados do contrato)
          var registroParcial = {
            id: "of_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
            card_id: card_id_do_drop,
            cliente: card.cliente,
            agp: card.agp,
            valor_fechado: valor,
            valor_original_versao: card.valor_faturamento,
            valor_tabela: card.valor_tabela,
            valor_faturamento: card.valor_faturamento,
            ajuste_percentual_lucro: ajuste,
            data_fechamento_pedido: data,
            fechado_em: new Date().toISOString(),
            fechado_por: "felipe.projetta"
          };
          var r2 = await sbFetch("/rest/v1/orcamentos_fechados", {
            method: "POST",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify(registroParcial)
          });
          if(r2.status >= 400){
            var t = await r2.text();
            throw new Error("HTTP " + r2.status + ": " + t.substring(0, 200));
          }
          ov.remove();
          // Notificacao discreta
          var n = document.createElement("div");
          n.style.cssText = "position:fixed;top:20px;right:20px;background:#16a34a;color:#fff;padding:14px 20px;border-radius:10px;box-shadow:0 8px 25px rgba(0,0,0,.2);z-index:1000000;font-family:system-ui;font-size:13px;font-weight:600";
          n.innerHTML = "✓ Fechamento registrado<br><span style=\"font-size:11px;font-weight:400\">" + fmtBRL(valor) + " • Aguardando contrato (preencha ATP depois)</span>";
          document.body.appendChild(n);
          setTimeout(function(){ n.style.opacity = "0"; n.style.transition = "opacity .4s"; }, 3000);
          setTimeout(function(){ if(n.parentElement) n.remove(); }, 3500);
          resolve({ data_fechamento: data, valor_fechado: valor, valor_original: card.valor_faturamento, card: card });
        } catch(e){
          console.error("[118] erro INSERT parcial:", e);
          alert("⚠ Erro ao registrar fechamento: " + e.message);
          btnOk.disabled = false;
          btnOk.innerHTML = "Continuar →";
        }
      };
    });
  }
  function htmlModal2(card, dadosM1){
    try {
      if(!card) card = {};
      if(!dadosM1) dadosM1 = {};
      var v = parseFloat(dadosM1.valor_fechado) || 0;
      var produtosDefault = (v / 2).toFixed(2);
      var servicosDefault = (v / 2).toFixed(2);
      var clienteN = (card.cliente || "").toString();
      var agp = (card.agp || "-").toString();
      var reserva = (card.reserva || "-").toString();
      var dataF = formatarData(dadosM1.data_fechamento) || "-";
      var valorFmt = fmtBRL(v);
      var totalFmt = fmtBRL(v);
      var hojeStr = hoje();

      var p = [];
      // CONTAINER + HEADER
      p.push("<div style=\"background:#fff;border-radius:14px;width:760px;max-width:96vw;max-height:92vh;overflow-y:auto;box-shadow:0 25px 70px rgba(0,0,0,.4);border-top:5px solid #16a34a\">");
      p.push("<div style=\"position:sticky;top:0;background:#fff;padding:20px 24px 14px;border-bottom:1px solid #e5e7eb;z-index:1\">");
      p.push("<div style=\"font-size:20px;font-weight:700;color:#166534\">📋 Contrato de Compra e Venda</div>");
      p.push("<div style=\"font-size:12px;color:#6b7280;margin-top:4px\">" + clienteN + " • " + agp + " • Reserva " + reserva + " • Fechado em " + dataF + " • " + valorFmt + "</div>");
      p.push("</div><div style=\"padding:18px 24px\">");

      // SECAO 1: IDENTIFICACAO
      p.push("<div style=\"background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px\">");
      p.push("<div style=\"font-size:13px;font-weight:700;color:#1f2937;margin-bottom:10px\">📋 Identificação</div>");
      p.push("<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:10px\">");
      p.push(campoInput("m2-atp", "ATP (puxa do Weiku ao perder foco)", "text", "", "Numero ATP", "border:2px solid #fbbf24"));
      p.push(campoInput("m2-dt-assin", "Data Assinatura Contrato", "date", hojeStr));
      p.push(campoSelect("m2-tipo-obra", "Tipo Obra", ["NOVO", "REFORMA"]));
      p.push(campoInput("m2-repres", "Representante", "text", "", "Nome do representante"));
      p.push("</div></div>");

      // SECAO 2: COMPRADOR
      p.push("<div style=\"background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px\">");
      p.push("<div style=\"font-size:13px;font-weight:700;color:#1f2937;margin-bottom:10px\">👤 1.1 Comprador (Pessoa Física)</div>");
      p.push("<div style=\"display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:8px\">");
      p.push(campoInput("m2-nome", "Nome Completo", "text", clienteN));
      p.push(campoInput("m2-cpf", "CPF", "text", "", "000.000.000-00"));
      p.push("</div>");
      p.push("<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px\">");
      p.push(campoInput("m2-rg", "RG", "text", "", "00.000.000-0"));
      p.push(campoInput("m2-rg-uf", "Órgão / UF", "text", "", "SSP/SP"));
      p.push("</div>");
      p.push("<div style=\"display:grid;grid-template-columns:3fr 1fr 1fr;gap:10px;margin-bottom:8px\">");
      p.push(campoInput("m2-rua", "Endereço (Rua)", "text"));
      p.push(campoInput("m2-num", "Número", "text"));
      p.push(campoInput("m2-comp", "Complemento", "text"));
      p.push("</div>");
      p.push("<div style=\"display:grid;grid-template-columns:2fr 1fr 2fr;gap:10px;margin-bottom:8px\">");
      p.push(campoInput("m2-bairro", "Bairro", "text"));
      p.push(campoInput("m2-cep", "CEP", "text", "", "00000-000"));
      p.push(campoInput("m2-cid", "Cidade / UF", "text"));
      p.push("</div>");
      p.push("<div style=\"display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px\">");
      p.push(campoInput("m2-email", "E-mail", "email"));
      p.push(campoInput("m2-email-nfe", "E-mail NFe", "email"));
      p.push(campoInput("m2-tel", "Telefone", "text", "", "(00) 00000-0000"));
      p.push("</div></div>");

      // SECAO 3: ENTREGA / OBRA
      p.push("<div style=\"background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px\">");
      p.push("<div style=\"font-size:13px;font-weight:700;color:#1f2937;margin-bottom:10px;display:flex;justify-content:space-between\">");
      p.push("<span>🚚 Endereço de Entrega / Obra</span>");
      p.push("<label style=\"font-size:11px;font-weight:500;color:#6b7280;cursor:pointer\"><input type=\"checkbox\" id=\"m2-mesma-end\" style=\"margin-right:4px\"> Igual ao residencial</label>");
      p.push("</div>");
      p.push("<div style=\"display:grid;grid-template-columns:3fr 1fr 1fr;gap:10px;margin-bottom:8px\">");
      p.push(campoInput("m2-er", "Endereço Obra", "text"));
      p.push(campoInput("m2-en", "Número", "text"));
      p.push(campoInput("m2-ec", "Complemento", "text"));
      p.push("</div>");
      p.push("<div style=\"display:grid;grid-template-columns:2fr 1fr 2fr;gap:10px;margin-bottom:8px\">");
      p.push(campoInput("m2-eb", "Bairro", "text"));
      p.push(campoInput("m2-ecep", "CEP", "text"));
      p.push(campoInput("m2-ecid", "Cidade / UF", "text"));
      p.push("</div>");
      p.push("<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px\">");
      p.push(campoInput("m2-cno", "CNO (Cadastro Nacional Obras)", "text", "", "Opcional"));
      p.push(campoInput("m2-ref", "Ponto Referência", "text"));
      p.push("</div>");
      p.push("<div style=\"display:grid;grid-template-columns:2fr 1fr 2fr;gap:10px\">");
      p.push(campoInput("m2-pa", "Pessoa Autorizada Receber", "text"));
      p.push(campoInput("m2-pt", "Telefone", "text"));
      p.push(campoInput("m2-pe", "E-mail", "email"));
      p.push("</div></div>");

      // SECAO 4: PRECO
      p.push("<div style=\"background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px\">");
      p.push("<div style=\"font-size:13px;font-weight:700;color:#1f2937;margin-bottom:10px\">💰 Preço (Total: " + totalFmt + ")</div>");
      p.push("<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:10px\">");
      p.push(campoInput("m2-prod", "Produtos (R$)", "number", produtosDefault));
      p.push(campoInput("m2-serv", "Serviços (R$)", "number", servicosDefault));
      p.push("</div>");
      p.push("<div id=\"m2-soma-aviso\" style=\"margin-top:8px;font-size:12px;color:#6b7280\"></div>");
      p.push("</div>");

      // SECAO 5: PAGAMENTO
      p.push("<div style=\"background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px\">");
      p.push("<div style=\"font-size:13px;font-weight:700;color:#1f2937;margin-bottom:10px\">💳 Condições de Pagamento</div>");
      p.push("<div style=\"display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px\">");
      p.push(campoSelect("m2-forma", "Forma", ["BOLETO", "PIX", "BOLETO_PIX", "OUTRO"]));
      p.push(campoInput("m2-qtdp", "Qtd Parcelas", "number", "1"));
      p.push(campoInput("m2-dt1", "Data 1ª Parcela", "date", hojeStr));
      p.push("</div>");
      p.push("<div id=\"m2-parcelas-preview\" style=\"background:#fff;border-radius:6px;padding:10px;font-size:12px;border:1px dashed #d1d5db\"></div>");
      p.push("</div>");

      // FECHAR padding
      p.push("</div>");

      // FOOTER
      p.push("<div style=\"position:sticky;bottom:0;background:#fff;padding:14px 24px;border-top:1px solid #e5e7eb;display:flex;gap:10px;justify-content:flex-end\">");
      p.push("<button id=\"m2-cancelar\" style=\"background:#f3f4f6;color:#374151;border:none;padding:11px 20px;border-radius:8px;cursor:pointer;font-weight:600\">Cancelar (mantém em Fechado)</button>");
      p.push("<button id=\"m2-salvar\" style=\"background:#16a34a;color:#fff;border:none;padding:11px 28px;border-radius:8px;cursor:pointer;font-weight:600\">💾 Salvar Contrato</button>");
      p.push("</div>");

      p.push("</div>");
      return p.join("");
    } catch(err){
      console.error("[118] htmlModal2 erro:", err);
      return "<div style=\"background:#fee;color:#c00;padding:30px;border-radius:10px;font-family:system-ui;max-width:600px\"><b>⚠ Erro construindo Modal 2:</b><br>" + (err.message||err) + "</div>";
    }
  }

  // Helpers para construcao de campos do modal 2
  function campoInput(id, label, tipo, val, placeholder, extraStyle){
    val = val == null ? "" : String(val);
    placeholder = placeholder || "";
    extraStyle = extraStyle || "";
    var style = "width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;" + extraStyle;
    return "<div><label style=\"font-size:11px;color:#6b7280;font-weight:600\">" + label + "</label><input id=\"" + id + "\" type=\"" + tipo + "\" value=\"" + escAttr(val) + "\" placeholder=\"" + escAttr(placeholder) + "\" style=\"" + style + "\"></div>";
  }
  function campoSelect(id, label, opcoes){
    var opts = opcoes.map(function(o){ return "<option value=\"" + escAttr(o) + "\">" + o + "</option>"; }).join("");
    return "<div><label style=\"font-size:11px;color:#6b7280;font-weight:600\">" + label + "</label><select id=\"" + id + "\" style=\"width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px\">" + opts + "</select></div>";
  }
  function escAttr(s){ return String(s||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
  async function mostrarModal2(card_id){
    // Buscar dados do card e do orcamento_fechado existente (Modal 1 ja salvou parcial)
    var card = {};
    var existente = null;
    try {
      var rc = await sbFetch("/rest/v1/crm_oportunidades?id=eq." + encodeURIComponent(card_id) + "&select=cliente,agp,reserva,valor_tabela,valor_faturamento");
      var arr = await rc.json();
      if(arr && arr.length) card = arr[0];
      var rOf = await sbFetch("/rest/v1/orcamentos_fechados?card_id=eq." + encodeURIComponent(card_id) + "&select=*&order=fechado_em.desc.nullslast&limit=1");
      var ofArr = await rOf.json();
      if(ofArr && ofArr.length) existente = ofArr[0];
    } catch(e){ console.error("[118] erro carregando dados:", e); }
    if(!existente){
      console.warn("[118] sem registro do Modal 1 — criar parcial");
      existente = { valor_fechado: card.valor_faturamento, valor_original_versao: card.valor_faturamento, data_fechamento_pedido: new Date().toISOString().substring(0,10) };
    }
    var dadosM1 = {
      data_fechamento: existente.data_fechamento_pedido,
      valor_fechado: parseFloat(existente.valor_fechado) || parseFloat(card.valor_faturamento) || 0,
      valor_original: parseFloat(existente.valor_original_versao) || parseFloat(card.valor_faturamento) || 0,
      card: card
    };
    card.reserva = card.reserva || (existente && existente.reserva);

    return new Promise(function(resolve){
      var ov = document.createElement("div");
      ov.id = "proj118-modal2";
      ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:system-ui;padding:20px";
      ov.innerHTML = htmlModal2(card, dadosM1);
      document.body.appendChild(ov);

      // PRE-PREENCHER campos do Modal 2 com dados existentes (do Modal 1)
      if(existente){
        function setIfPresent(id, val){
          if(val == null || val === "") return;
          var el = ov.querySelector("#" + id);
          if(el) el.value = val;
        }
        setIfPresent("m2-atp", existente.atp);
        setIfPresent("m2-dt-assin", existente.data_assinatura_contrato);
        setIfPresent("m2-tipo-obra", existente.tipo_obra);
        setIfPresent("m2-repres", existente.representante);
        setIfPresent("m2-nome", existente.cliente_fechamento || card.cliente);
        setIfPresent("m2-cpf", existente.cpf_comprador);
        setIfPresent("m2-rg", existente.rg_comprador);
        setIfPresent("m2-rg-uf", existente.rg_orgao_uf);
        setIfPresent("m2-rua", existente.endereco_rua);
        setIfPresent("m2-num", existente.endereco_numero);
        setIfPresent("m2-comp", existente.endereco_complemento);
        setIfPresent("m2-bairro", existente.endereco_bairro);
        setIfPresent("m2-cep", existente.endereco_cep);
        setIfPresent("m2-cid", existente.endereco_cidade);
        setIfPresent("m2-email", existente.email_comprador);
        setIfPresent("m2-email-nfe", existente.email_nfe_comprador);
        setIfPresent("m2-tel", existente.telefone_comprador);
        setIfPresent("m2-er", existente.entrega_rua);
        setIfPresent("m2-en", existente.entrega_numero);
        setIfPresent("m2-ec", existente.entrega_complemento);
        setIfPresent("m2-eb", existente.entrega_bairro);
        setIfPresent("m2-ecep", existente.entrega_cep);
        setIfPresent("m2-ecid", existente.entrega_cidade);
        setIfPresent("m2-cno", existente.entrega_cno);
        setIfPresent("m2-ref", existente.entrega_ponto_referencia);
        setIfPresent("m2-pa", existente.entrega_pessoa_autorizada);
        setIfPresent("m2-pt", existente.entrega_telefone);
        setIfPresent("m2-pe", existente.entrega_email);
        if(existente.valor_produtos) setIfPresent("m2-prod", existente.valor_produtos);
        if(existente.valor_servicos) setIfPresent("m2-serv", existente.valor_servicos);
        setIfPresent("m2-forma", existente.forma_pagamento);
        if(existente.qtd_parcelas) setIfPresent("m2-qtdp", existente.qtd_parcelas);
        setIfPresent("m2-dt1", existente.data_primeira_parcela);
      }

      // Auto-buscar weiku via ATP
      var inpAtp = ov.querySelector("#m2-atp");
      inpAtp.onblur = async function(){
        var atp = (inpAtp.value||"").trim();
        if(!atp){ return; }
        inpAtp.style.background = "#fef9c3";
        try {
          var r = await sbFetch("/rest/v1/weiku_reservas?atp=eq." + encodeURIComponent(atp) + "&select=nome,email,telefone,cep,cidade_uf,reserva_interna&limit=1");
          var d = await r.json();
          if(d && d.length){
            var w = d[0];
            if(w.nome){ ov.querySelector("#m2-nome").value = w.nome; }
            if(w.email){ ov.querySelector("#m2-email").value = w.email; ov.querySelector("#m2-email-nfe").value = w.email; }
            if(w.telefone){ ov.querySelector("#m2-tel").value = w.telefone; }
            if(w.cep){ ov.querySelector("#m2-cep").value = w.cep; }
            if(w.cidade_uf){ ov.querySelector("#m2-cid").value = w.cidade_uf; }
            inpAtp.style.background = "#dcfce7";
            inpAtp.style.borderColor = "#16a34a";
            console.log("[118] dados do weiku puxados via ATP " + atp);
          } else {
            inpAtp.style.background = "#fee2e2";
            inpAtp.title = "ATP não encontrado no Weiku";
          }
        } catch(e){
          inpAtp.style.background = "#fee2e2";
          console.error("[118] erro buscando ATP:", e);
        }
      };

      // Mesmo endereço (checkbox)
      var chk = ov.querySelector("#m2-mesma-end");
      chk.onchange = function(){
        if(chk.checked){
          ov.querySelector("#m2-er").value   = ov.querySelector("#m2-rua").value;
          ov.querySelector("#m2-en").value   = ov.querySelector("#m2-num").value;
          ov.querySelector("#m2-ec").value   = ov.querySelector("#m2-comp").value;
          ov.querySelector("#m2-eb").value   = ov.querySelector("#m2-bairro").value;
          ov.querySelector("#m2-ecep").value = ov.querySelector("#m2-cep").value;
          ov.querySelector("#m2-ecid").value = ov.querySelector("#m2-cid").value;
        }
      };

      // Soma produtos+serviços vs valor fechado
      var inpProd = ov.querySelector("#m2-prod");
      var inpServ = ov.querySelector("#m2-serv");
      var divSoma = ov.querySelector("#m2-soma-aviso");
      function recalcSoma(){
        var p = parseFloat(inpProd.value) || 0;
        var s = parseFloat(inpServ.value) || 0;
        var t = p + s;
        var fechado = dadosM1.valor_fechado;
        if(Math.abs(t - fechado) < 0.01){
          divSoma.innerHTML = "✓ Soma (" + fmtBRL(t) + ") confere com o total fechado";
          divSoma.style.color = "#16a34a";
        } else {
          var diff = fechado - t;
          divSoma.innerHTML = "⚠ Soma " + fmtBRL(t) + " ≠ Total " + fmtBRL(fechado) + " (diferença: " + fmtBRL(diff) + ")";
          divSoma.style.color = "#dc2626";
        }
      }
      inpProd.oninput = recalcSoma;
      inpServ.oninput = recalcSoma;
      recalcSoma();

      // Calcular parcelas
      var inpQtd = ov.querySelector("#m2-qtdp");
      var inpDt1 = ov.querySelector("#m2-dt1");
      var divPrev = ov.querySelector("#m2-parcelas-preview");
      function recalcParcelas(){
        var q = parseInt(inpQtd.value) || 1;
        var dt = inpDt1.value;
        var v = dadosM1.valor_fechado;
        if(q <= 0 || !dt){ divPrev.innerHTML = ""; return; }
        var valorParcela = v / q;
        var rows = [];
        for(var i = 0; i < q; i++){
          var venc = i === 0 ? dt : addMeses(dt, i);
          rows.push("<div style=\"display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dotted #e5e7eb\"><span><b>" + (i+1) + "ª</b> em " + formatarData(venc) + "</span><span>" + fmtBRL(valorParcela) + "</span></div>");
        }
        divPrev.innerHTML = rows.join("");
      }
      inpQtd.oninput = recalcParcelas;
      inpDt1.onchange = recalcParcelas;
      recalcParcelas();

      // Cancelar
      ov.querySelector("#m2-cancelar").onclick = function(){
        if(!confirm("Cancelar contrato? Card permanece em Fechado mas sem dados de contrato salvos. Você poderá preencher depois.")) return;
        ov.remove();
        resolve(null);
      };

      // Salvar
      ov.querySelector("#m2-salvar").onclick = async function(){
        var btn = this;
        btn.disabled = true;
        btn.innerHTML = "💾 Salvando...";

        var qtdParcelas = parseInt(inpQtd.value) || 1;
        var dt1 = inpDt1.value;
        var valor = dadosM1.valor_fechado;
        var valorParcela = valor / qtdParcelas;
        var parcelas = [];
        for(var i = 0; i < qtdParcelas; i++){
          var venc = i === 0 ? dt1 : addMeses(dt1, i);
          parcelas.push({ num: i+1, percentual: 100/qtdParcelas, vencimento: venc, valor: valorParcela });
        }

        var ajusteLucro = null;
        if(dadosM1.valor_original && dadosM1.valor_original > 0){
          ajusteLucro = ((dadosM1.valor_fechado - dadosM1.valor_original) / dadosM1.valor_original) * 100;
        }

        var registro = {
          id: "of_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
          card_id: card_id,
          cliente: card.cliente,
          agp: card.agp,
          reserva: card.reserva,
          valor_fechado: valor,
          valor_original_versao: dadosM1.valor_original,
          ajuste_percentual_lucro: ajusteLucro,
          data_fechamento_pedido: dadosM1.data_fechamento,
          data_assinatura_contrato: ov.querySelector("#m2-dt-assin").value,
          tipo_obra: ov.querySelector("#m2-tipo-obra").value,
          representante: ov.querySelector("#m2-repres").value,
          atp: (ov.querySelector("#m2-atp").value||"").trim() || null,
          cliente_fechamento: ov.querySelector("#m2-nome").value,
          cpf_comprador: ov.querySelector("#m2-cpf").value,
          rg_comprador: ov.querySelector("#m2-rg").value,
          rg_orgao_uf: ov.querySelector("#m2-rg-uf").value,
          email_comprador: ov.querySelector("#m2-email").value,
          email_nfe_comprador: ov.querySelector("#m2-email-nfe").value,
          telefone_comprador: ov.querySelector("#m2-tel").value,
          endereco_rua: ov.querySelector("#m2-rua").value,
          endereco_numero: ov.querySelector("#m2-num").value,
          endereco_complemento: ov.querySelector("#m2-comp").value,
          endereco_bairro: ov.querySelector("#m2-bairro").value,
          endereco_cep: ov.querySelector("#m2-cep").value,
          endereco_cidade: ov.querySelector("#m2-cid").value,
          entrega_rua: ov.querySelector("#m2-er").value,
          entrega_numero: ov.querySelector("#m2-en").value,
          entrega_complemento: ov.querySelector("#m2-ec").value,
          entrega_bairro: ov.querySelector("#m2-eb").value,
          entrega_cep: ov.querySelector("#m2-ecep").value,
          entrega_cidade: ov.querySelector("#m2-ecid").value,
          entrega_cno: ov.querySelector("#m2-cno").value,
          entrega_ponto_referencia: ov.querySelector("#m2-ref").value,
          entrega_pessoa_autorizada: ov.querySelector("#m2-pa").value,
          entrega_telefone: ov.querySelector("#m2-pt").value,
          entrega_email: ov.querySelector("#m2-pe").value,
          valor_produtos: parseFloat(ov.querySelector("#m2-prod").value) || 0,
          valor_servicos: parseFloat(ov.querySelector("#m2-serv").value) || 0,
          forma_pagamento: ov.querySelector("#m2-forma").value,
          qtd_parcelas: qtdParcelas,
          data_primeira_parcela: dt1,
          parcelas: parcelas,
          fechado_em: new Date().toISOString(),
          fechado_por: "felipe.projetta"
        };

        try {
          var r;
          if(existente && existente.id){
            // UPDATE registro existente (do Modal 1)
            delete registro.id; // não trocar PK
            registro.updated_at = new Date().toISOString();
            r = await sbFetch("/rest/v1/orcamentos_fechados?id=eq." + encodeURIComponent(existente.id), {
              method: "PATCH",
              headers: { "Prefer": "return=representation" },
              body: JSON.stringify(registro)
            });
          } else {
            // INSERT novo
            r = await sbFetch("/rest/v1/orcamentos_fechados", {
              method: "POST",
              headers: { "Prefer": "return=representation" },
              body: JSON.stringify(registro)
            });
          }
          if(r.status >= 400){
            var t = await r.text();
            throw new Error("HTTP " + r.status + ": " + t.substring(0,200));
          }
          ov.remove();
          alert("✓ Contrato salvo com sucesso!\n\n" + (existente && existente.id ? "Atualizado" : "Criado") + " em orcamentos_fechados.\nValor fechado: " + fmtBRL(valor));
          console.log("[118] contrato salvo:", registro);
          resolve(registro);
        } catch(e){
          console.error("[118] erro salvando:", e);
          alert("⚠ Erro ao salvar: " + e.message);
          btn.disabled = false;
          btn.innerHTML = "💾 Salvar Contrato";
        }
      };
    });
  }

  console.log("[118-fluxo-fechamento] instalado");
})();