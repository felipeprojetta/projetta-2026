/* ============================================================================
 * js/104-card-detalhe-itens.js  —  Modulo NOVO (26-abr-2026 v2)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "DETALHE CADA ITEM QUE VAI PARA CARD ASSIM FICA MAIS FACIL CONFERIR,
 *          ESTA COLOCANDO PORTA + OUTROS ITENS SOMADOS NO CARD,
 *          CONFIRA TUDO CADA LINHA PARA ESTAR CERTO MESMO VALOR DA PROPOSTA NO CARD"
 *
 * RESULTADO no card kanban (internacional CIF/FOB):
 *   🚪 Porta:         R$ 119.910 · US$ 23,545
 *   📦 Crate:         R$ 4.073   · US$ 800
 *   🚚 Land Freight:  R$ 8.658   · US$ 1,700
 *   🚢 Sea Freight:   R$ 18.023  · US$ 3,539  ← com margem 20% interna
 *   ─────────────────────────────────────────
 *   TOTAL:            R$ 150.664
 *                     US$ 29,584    ← BATE com proposta
 *
 * Identificacao do card: via nome do cliente (`.crm-card-client`) cruzado com
 * localStorage `projetta_crm_v1`. NAO depende de data-id (que nao existe).
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - Atua via post-processing no DOM apos crmRender / mutations
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta104CardDetalheV2Applied) return;
  window.__projetta104CardDetalheV2Applied = true;
  console.log("[104-card-detalhe-v2] iniciando");

  var MARGIN_RATE = 0.20;
  var FLAG_ATTR = "data-projetta104DetalheV2";

  function fmtBRL(v){ return "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR"); }
  function fmtUSD(v){ return "US$ " + Math.round(Number(v) || 0).toLocaleString("en-US"); }

  function getCambio(){
    try {
      if(window.projettaCambio && window.projettaCambio.get){
        var c = window.projettaCambio.get();
        if(c > 0) return c;
      }
    } catch(e){}
    return 5.0918;
  }

  function getLocalStorageCards(){
    try {
      var raw = localStorage.getItem("projetta_crm_v1");
      if(!raw) return [];
      var data = JSON.parse(raw);
      var lista = Array.isArray(data) ? data : (data.opps || []);
      return lista || [];
    } catch(e){ return []; }
  }

  // Identifica card por NOME DO CLIENTE (cruzado com localStorage)
  function findCardData(cardEl){
    var clientEl = cardEl.querySelector(".crm-card-client");
    if(!clientEl) return null;
    var nome = (clientEl.textContent || "").trim();
    if(!nome || nome.length < 2) return null;

    var cards = getLocalStorageCards();
    if(cards.length === 0) return null;

    // Filtrar so internacionais (com sinais)
    var candidatos = cards.filter(function(c){
      if(!c || c.deleted_at) return false;
      if(!c.cliente) return false;
      var quem = String((c.extras && c.extras.inst_quem) || c.inst_quem || "").toUpperCase();
      var inco = String((c.extras && c.extras.inst_incoterm) || c.inst_incoterm || "").toUpperCase();
      var ehIntl = c.scope === "internacional"
                || quem === "INTERNACIONAL"
                || inco === "CIF" || inco === "FOB" || inco === "EXW"
                || (c.pais && c.pais.length > 0);
      return ehIntl;
    });

    // Match exato primeiro
    var found = candidatos.find(function(c){ return c.cliente === nome; });
    if(found) return found;

    // Match parcial
    found = candidatos.find(function(c){
      return c.cliente.indexOf(nome) >= 0 || nome.indexOf(c.cliente) >= 0;
    });
    return found || null;
  }

  function getExtra(c, key){
    if(!c) return 0;
    var v = (c.extras && c.extras[key] != null) ? c.extras[key] : c[key];
    return parseFloat(v) || 0;
  }

  function calcularItens(cardData){
    var c = cardData || {};
    var cambio = getCambio();
    var inco = String(getExtra(c, "inst_incoterm") ? "" : (c.extras && c.extras.inst_incoterm) || c.inst_incoterm || "").toUpperCase();
    if(!inco) inco = String((c.extras && c.extras.inst_incoterm) || c.inst_incoterm || "").toUpperCase();
    var ehCif = inco === "CIF";
    var ehFob = inco === "FOB";

    // Porta (BRL)
    var porta_brl = parseFloat(c.valorFaturamento) || parseFloat(c.valorTabela) || parseFloat(c.valor) || parseFloat(c.valor_tabela) || 0;
    if(porta_brl <= 0) return null;
    var porta_usd = porta_brl / cambio;

    // Crate (so se CIF ou FOB)
    var crate_usd = 0;
    if(ehCif || ehFob){
      var a = getExtra(c, "cif_caixa_a");
      var l = getExtra(c, "cif_caixa_l");
      var ee = getExtra(c, "cif_caixa_e");
      var taxa = getExtra(c, "cif_caixa_taxa") || 100;
      var vol_m3 = (a * l * ee) / 1e9;
      crate_usd = vol_m3 * taxa;
    }
    var crate_brl = crate_usd * cambio;

    // Land Freight (so se CIF ou FOB)
    var land_usd = (ehCif || ehFob) ? getExtra(c, "cif_frete_terrestre") : 0;
    var land_brl = land_usd * cambio;

    // Sea Freight COM MARGEM 20% (so se CIF)
    var sea_usd_orig = ehCif ? getExtra(c, "cif_frete_maritimo") : 0;
    var sea_usd = sea_usd_orig * (1 + MARGIN_RATE);
    var sea_brl = sea_usd * cambio;

    // Total
    var total_usd = porta_usd + crate_usd + land_usd + sea_usd;
    var total_brl = porta_brl + crate_brl + land_brl + sea_brl;

    var temFretes = (crate_usd > 0 || land_usd > 0 || sea_usd > 0);

    return {
      tem_fretes: temFretes,
      incoterm: inco,
      porta: { brl: porta_brl, usd: porta_usd },
      crate: { brl: crate_brl, usd: crate_usd },
      land: { brl: land_brl, usd: land_usd },
      sea: { brl: sea_brl, usd: sea_usd, sea_orig_usd: sea_usd_orig },
      total: { brl: total_brl, usd: total_usd }
    };
  }

  // Achar o bloco visual: div com style "linear-gradient" ou que contem Porta+TOTAL
  function findValorBloco(cardEl){
    var divs = cardEl.querySelectorAll("div");
    for(var i = 0; i < divs.length; i++){
      var d = divs[i];
      var t = d.textContent || "";
      if(t.length > 600 || t.length < 30) continue;
      // Tem que ter Porta: e TOTAL: e estar no card (nao nos sub-elements de outros cards)
      if(/Porta\s*:/i.test(t) && /TOTAL\s*:/i.test(t)){
        // Pegar o MENOR (mais interno) que casa
        return d;
      }
    }
    return null;
  }

  function patchCard(cardEl){
    if(cardEl.getAttribute(FLAG_ATTR) === "1") return;

    var data = findCardData(cardEl);
    if(!data) return;

    var calc = calcularItens(data);
    if(!calc || !calc.tem_fretes) return;

    var bloco = findValorBloco(cardEl);
    if(!bloco) return;

    // Construir novo HTML detalhado
    var lines = [];
    lines.push('<div style="display:flex;justify-content:space-between;color:#555"><span>🚪 Porta:</span><span style="font-weight:600">' + fmtBRL(calc.porta.brl) + ' · ' + fmtUSD(calc.porta.usd) + '</span></div>');
    if(calc.crate.usd > 0){
      lines.push('<div style="display:flex;justify-content:space-between;color:#555;margin-top:1px"><span>📦 Crate:</span><span style="font-weight:600">' + fmtBRL(calc.crate.brl) + ' · ' + fmtUSD(calc.crate.usd) + '</span></div>');
    }
    if(calc.land.usd > 0){
      lines.push('<div style="display:flex;justify-content:space-between;color:#555;margin-top:1px"><span>🚚 Land Freight:</span><span style="font-weight:600">' + fmtBRL(calc.land.brl) + ' · ' + fmtUSD(calc.land.usd) + '</span></div>');
    }
    if(calc.sea.usd > 0){
      lines.push('<div style="display:flex;justify-content:space-between;color:#555;margin-top:1px"><span>🚢 Sea Freight:</span><span style="font-weight:600">' + fmtBRL(calc.sea.brl) + ' · ' + fmtUSD(calc.sea.usd) + ' <span title="margem 20% interna" style="color:#d97706">🛡</span></span></div>');
    }
    lines.push('<div style="display:flex;justify-content:space-between;margin-top:4px;padding-top:4px;border-top:1px dashed rgba(230,81,0,.3)"><span style="color:#003144;font-weight:800">TOTAL:</span><span style="color:#e65100;font-weight:800;font-size:11px">' + fmtBRL(calc.total.brl) + '</span></div>');
    lines.push('<div style="text-align:right;color:#1565c0;font-weight:700;font-size:10px">' + fmtUSD(calc.total.usd) + '</div>');

    var newInner = lines.join("");

    // Preservar style do bloco mas trocar conteudo interno
    bloco.innerHTML = newInner;
    cardEl.setAttribute(FLAG_ATTR, "1");
  }

  function tick(){
    try {
      var cards = document.querySelectorAll(".crm-card");
      for(var i = 0; i < cards.length; i++){
        patchCard(cards[i]);
      }
    } catch(e){
      console.warn("[104-card-detalhe-v2] erro:", e);
    }
  }

  function resetFlags(){
    var cards = document.querySelectorAll("[" + FLAG_ATTR + "]");
    for(var i = 0; i < cards.length; i++){
      cards[i].removeAttribute(FLAG_ATTR);
    }
  }

  setInterval(tick, 2000);
  setTimeout(tick, 200);
  setTimeout(tick, 800);
  setTimeout(tick, 2500);

  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      for(var i = 0; i < muts.length && !precisa; i++){
        var t = muts[i].target;
        if(!t || !t.className) continue;
        var cn = t.className.toString ? t.className.toString() : String(t.className);
        if(/crm-card|crm-stage-body|sb-s/.test(cn)){
          precisa = true;
        }
      }
      if(precisa){
        resetFlags();
        setTimeout(tick, 80);
      }
    });
    if(document.body){
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Reagir a mudanca de cambio
  if(window.projettaCambio && typeof window.projettaCambio.onChange === "function"){
    window.projettaCambio.onChange(function(){
      resetFlags();
      setTimeout(tick, 100);
    });
  }

  console.log("[104-card-detalhe-v2] instalado");
})();
