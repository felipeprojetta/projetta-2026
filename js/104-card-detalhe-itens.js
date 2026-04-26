/* ============================================================================
 * js/104-card-detalhe-itens.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "DETALHE CADA ITEM QUE VAI PARA CARD ASSIM FICA MAIS FACIL CONFERIR,
 *          ESTA COLOCANDO PORTA + OUTROS ITENS SOMADOS NO CARD,
 *          CONFIRA TUDO CADA LINHA PARA ESTAR CERTO MESMO VALOR DA PROPOSTA NO CARD"
 *
 * ANTES (card kanban):
 *   Porta:      R$ 119.910 | US$ 23,545
 *   Caixa+Fretes: R$ 27.751 | US$ 5,449   ← AGRUPADO, sem margem 20%
 *   TOTAL:      R$ 147.661 | US$ 28,993   ← errado vs proposta
 *
 * DEPOIS (card kanban detalhado):
 *   Porta:           R$ 119.910 | US$ 23,545
 *   📦 Crate:         R$ 4.073   | US$ 800
 *   🚚 Land Freight:  R$ 8.658   | US$ 1,700
 *   🚢 Sea Freight:   R$ 18.023  | US$ 3,539  ← com margem 20%
 *   TOTAL:           R$ 150.664 | US$ 29,583  ← BATE com proposta
 *
 * Calculo:
 *   Volume caixa = (cif_caixa_a × cif_caixa_l × cif_caixa_e) / 1.000.000.000
 *   Crate USD    = volume × cif_caixa_taxa
 *   Land USD     = cif_frete_terrestre
 *   Sea USD      = cif_frete_maritimo × 1.20    ★ MARGEM 20% INVISIVEL
 *   Porta USD    = card.valor / cambio
 *   Total USD    = Porta + Crate + Land + Sea (com margem)
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/10-crm.js (BLINDADO)
 *  - NAO modifica funcoes _valorRealCardBRL, crmCifRecalc
 *  - Atua via post-processing no DOM apos crmRender
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta104CardDetalheApplied) return;
  window.__projetta104CardDetalheApplied = true;
  console.log("[104-card-detalhe] iniciando");

  var MARGIN_RATE = 0.20;
  var FLAG_ATTR = "data-projetta104Detalhe";

  function fmtBRL(v){
    return "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR");
  }
  function fmtUSD(v){
    return "US$ " + Math.round(Number(v) || 0).toLocaleString("en-US");
  }
  function getCambio(){
    try {
      if(window.projettaCambio && window.projettaCambio.get){
        var c = window.projettaCambio.get();
        if(c > 0) return c;
      }
    } catch(e){}
    return 5.0918;  // fallback
  }

  function findCardData(cardId){
    if(!cardId) return null;
    try {
      var raw = localStorage.getItem("projetta_crm_v1");
      if(!raw) return null;
      var data = JSON.parse(raw);
      var lista = Array.isArray(data) ? data : (data.opps || []);
      return lista.find(function(c){ return c && c.id === cardId; }) || null;
    } catch(e){ return null; }
  }

  function calcularItens(cardData){
    var c = cardData || {};
    var e = c.extras || {};
    var cambio = getCambio();

    // So aplica em internacional com inst_pais
    var quem = String(e.inst_quem || "").toUpperCase();
    if(c.scope !== "internacional" && quem !== "INTERNACIONAL") return null;

    // Porta (valor do card eh em BRL, ja tem porta + instalacao etc)
    var porta_brl = Number(c.valor || c.valor_tabela || 0);
    if(porta_brl <= 0) return null;
    var porta_usd = porta_brl / cambio;

    // Crate
    var a = Number(e.cif_caixa_a || 0);
    var l = Number(e.cif_caixa_l || 0);
    var ee = Number(e.cif_caixa_e || 0);
    var taxa = Number(e.cif_caixa_taxa || 0);
    var vol_m3 = (a * l * ee) / 1000000000;
    var crate_usd = vol_m3 * taxa;
    var crate_brl = crate_usd * cambio;

    // Land Freight
    var land_usd = Number(e.cif_frete_terrestre || 0);
    var land_brl = land_usd * cambio;

    // Sea Freight COM MARGEM 20%
    var sea_usd_orig = Number(e.cif_frete_maritimo || 0);
    var sea_usd = sea_usd_orig * (1 + MARGIN_RATE);
    var sea_brl = sea_usd * cambio;

    // Total USD = soma | Total BRL = total USD × cambio
    var total_usd = porta_usd + crate_usd + land_usd + sea_usd;
    var total_brl = total_usd * cambio;

    // So mostra detalhe se TEM caixa ou fretes (incoterm CIF/FOB)
    var temFretes = (crate_usd > 0 || land_usd > 0 || sea_usd > 0);

    return {
      tem_fretes: temFretes,
      porta: { brl: porta_brl, usd: porta_usd },
      crate: { brl: crate_brl, usd: crate_usd },
      land: { brl: land_brl, usd: land_usd },
      sea: { brl: sea_brl, usd: sea_usd, sea_orig_usd: sea_usd_orig },
      total: { brl: total_brl, usd: total_usd }
    };
  }

  function patchCard(cardEl){
    if(!cardEl) return;
    if(cardEl.getAttribute(FLAG_ATTR) === "1") return;

    var cardId = cardEl.dataset.id || cardEl.getAttribute("data-id");
    if(!cardId){
      // Tentar via onclick ou data attrs
      var ocAttr = cardEl.getAttribute("onclick") || cardEl.outerHTML;
      var m = ocAttr.match(/\b(cm[a-z0-9]{8,})\b/);
      if(m) cardId = m[1];
    }
    if(!cardId) return;

    var data = findCardData(cardId);
    if(!data) return;

    var calc = calcularItens(data);
    if(!calc || !calc.tem_fretes) return;

    // Procurar o footer com Porta: e TOTAL:
    var footer = cardEl.querySelector(".crm-card-footer");
    if(!footer){
      // fallback: pegar o div que tem ambos
      var divs = cardEl.querySelectorAll("div");
      for(var i = 0; i < divs.length; i++){
        var t = divs[i].textContent || "";
        if(/Porta\s*:/i.test(t) && /TOTAL\s*:/i.test(t) && t.length < 500){
          footer = divs[i];
          break;
        }
      }
    }
    if(!footer) return;

    // Preservar elementos depois do footer (resp, avatar, actions)
    // Reescrever interior do footer com itens detalhados
    var newHtml =
      '<div style="font-size:11px;color:#666;line-height:1.5;padding:6px 8px;background:#fafafa;border-radius:6px;margin:4px 0">' +
        '<div style="display:flex;justify-content:space-between;gap:6px"><span>🚪 Porta:</span><span style="font-weight:600">' + fmtBRL(calc.porta.brl) + ' · ' + fmtUSD(calc.porta.usd) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;gap:6px"><span>📦 Crate:</span><span>' + fmtBRL(calc.crate.brl) + ' · ' + fmtUSD(calc.crate.usd) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;gap:6px"><span>🚚 Land Freight:</span><span>' + fmtBRL(calc.land.brl) + ' · ' + fmtUSD(calc.land.usd) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;gap:6px"><span>🚢 Sea Freight:</span><span>' + fmtBRL(calc.sea.brl) + ' · ' + fmtUSD(calc.sea.usd) + ' <span title="margem 20% interna" style="color:#d97706">🛡</span></span></div>' +
        '<div style="display:flex;justify-content:space-between;gap:6px;border-top:1px solid #ddd;margin-top:4px;padding-top:4px;font-weight:700;color:#1565c0"><span>TOTAL:</span><span>' + fmtBRL(calc.total.brl) + ' · ' + fmtUSD(calc.total.usd) + '</span></div>' +
      '</div>';

    footer.innerHTML = newHtml;
    cardEl.setAttribute(FLAG_ATTR, "1");
  }

  function tick(){
    try {
      var cards = document.querySelectorAll(".crm-card.intl, .crm-card");
      for(var i = 0; i < cards.length; i++){
        var c = cards[i];
        // Pular cards sem Porta+TOTAL
        var t = c.textContent || "";
        if(!/Porta\s*:/i.test(t) || !/TOTAL\s*:/i.test(t)) continue;
        patchCard(c);
      }
    } catch(e){
      console.warn("[104-card-detalhe] erro:", e);
    }
  }

  setInterval(tick, 1000);
  setTimeout(tick, 300);
  setTimeout(tick, 1500);

  if(typeof MutationObserver !== "undefined"){
    var mo = new MutationObserver(function(muts){
      var precisa = false;
      for(var i = 0; i < muts.length; i++){
        var t = muts[i].target;
        if(t && t.className && /crm-card|crm-stage-body|sb-s/.test(t.className.toString() || "")){
          // Reset flag se for re-render
          var cards = t.querySelectorAll ? t.querySelectorAll(".crm-card.intl, .crm-card") : [];
          for(var k = 0; k < cards.length; k++){
            cards[k].removeAttribute(FLAG_ATTR);
          }
          precisa = true;
        }
      }
      if(precisa) setTimeout(tick, 80);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  console.log("[104-card-detalhe] instalado");
})();
