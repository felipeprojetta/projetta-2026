/* ============================================================================
 * js/104-card-detalhe-itens.js — v3 (27-abr-2026)
 *
 * Felipe 27/04: 
 *  - Cambio AGORA vem do CARD (o.inst_cambio em extras OU direto), nao do
 *    projettaCambio. Sem fallback 5.0918.
 *  - Reduzido o polling pra parar de piscar.
 *  - Reset de flag SO quando muda numero de cards (nao a cada mutation).
 * ========================================================================== */
(function(){
  "use strict";
  if(window.__projetta104CardDetalheV3Applied) return;
  window.__projetta104CardDetalheV3Applied = true;
  console.log("[104-card-detalhe-v3] iniciando");

  var MARGIN_RATE = 0.20;
  var FLAG_ATTR = "data-projetta104DetalheV3";
  var ULTIMA_CHAVE_RENDER = ""; // pra detectar quando precisa re-renderizar

  function fmtBRL(v){ return "R$ " + Math.round(Number(v) || 0).toLocaleString("pt-BR"); }
  function fmtUSD(v){ return "US$ " + Math.round(Number(v) || 0).toLocaleString("en-US"); }

  function getExtra(c, key){
    if(!c) return 0;
    var v = (c.extras && c.extras[key] != null) ? c.extras[key] : c[key];
    return parseFloat(v) || 0;
  }
  function getExtraStr(c, key){
    if(!c) return "";
    var v = (c.extras && c.extras[key] != null) ? c.extras[key] : c[key];
    return (v == null) ? "" : String(v);
  }

  // ★ Cambio AGORA vem do card. Sem fallback 5.0918.
  function getCambioCard(c){
    var cc = getExtra(c, "inst_cambio");
    if(cc > 0) return cc;
    try {
      if(window.projettaCambio && window.projettaCambio.get){
        var c2 = window.projettaCambio.get();
        if(c2 > 0) return c2;
      }
    } catch(e){}
    return 0;
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

  function findCardData(cardEl){
    var clientEl = cardEl.querySelector(".crm-card-client");
    if(!clientEl) return null;
    var nome = (clientEl.textContent || "").trim();
    if(!nome || nome.length < 2) return null;

    var cards = getLocalStorageCards();
    if(cards.length === 0) return null;

    var candidatos = cards.filter(function(c){
      if(!c || c.deleted_at) return false;
      if(!c.cliente) return false;
      var quem = getExtraStr(c, "inst_quem").toUpperCase();
      var inco = getExtraStr(c, "inst_incoterm").toUpperCase();
      var ehIntl = c.scope === "internacional"
                || quem === "INTERNACIONAL"
                || inco === "CIF" || inco === "FOB" || inco === "EXW"
                || (c.pais && c.pais.length > 0);
      return ehIntl;
    });

    var found = candidatos.find(function(c){ return c.cliente === nome; });
    if(found) return found;
    found = candidatos.find(function(c){
      return c.cliente.indexOf(nome) >= 0 || nome.indexOf(c.cliente) >= 0;
    });
    return found || null;
  }

  function calcularItens(cardData){
    var c = cardData || {};
    var cambio = getCambioCard(c);
    if(cambio <= 0) return null;

    var inco = getExtraStr(c, "inst_incoterm").toUpperCase();
    var ehCif = inco === "CIF";
    var ehFob = inco === "FOB";

    var porta_brl = parseFloat(c.valorFaturamento) || parseFloat(c.valorTabela) || parseFloat(c.valor) || parseFloat(c.valor_tabela) || 0;
    if(porta_brl <= 0) return null;
    var porta_usd = porta_brl / cambio;

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

    var land_usd = (ehCif || ehFob) ? getExtra(c, "cif_frete_terrestre") : 0;
    var land_brl = land_usd * cambio;

    var sea_usd_orig = ehCif ? getExtra(c, "cif_frete_maritimo") : 0;
    var sea_usd = sea_usd_orig * (1 + MARGIN_RATE);
    var sea_brl = sea_usd * cambio;

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

  function findValorBloco(cardEl){
    var divs = cardEl.querySelectorAll("div");
    for(var i = 0; i < divs.length; i++){
      var d = divs[i];
      var t = d.textContent || "";
      if(t.length > 600 || t.length < 30) continue;
      if(/Porta\s*:/i.test(t) && /TOTAL\s*:/i.test(t)){
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

    bloco.innerHTML = lines.join("");
    cardEl.setAttribute(FLAG_ATTR, "1");
  }

  function tick(){
    try {
      var cards = document.querySelectorAll(".crm-card");
      // Construir uma chave que muda quando layout muda
      var chave = cards.length + ":";
      for(var i = 0; i < cards.length; i++){
        var c = cards[i].querySelector(".crm-card-client");
        chave += (c ? c.textContent : "") + "|";
      }
      // So re-renderiza se a chave mudou (cards foram recriados pelo crmRender)
      if(chave !== ULTIMA_CHAVE_RENDER){
        ULTIMA_CHAVE_RENDER = chave;
        for(var j = 0; j < cards.length; j++){
          cards[j].removeAttribute(FLAG_ATTR);
          patchCard(cards[j]);
        }
      } else {
        // Layout igual — so patcheia cards que ainda nao foram patcheados
        for(var k = 0; k < cards.length; k++){
          patchCard(cards[k]);
        }
      }
    } catch(e){
      console.warn("[104-card-detalhe-v3] erro:", e);
    }
  }

  // ★ Reduzido drasticamente: tick a cada 5s + apenas timeouts iniciais
  setInterval(tick, 5000);
  setTimeout(tick, 300);
  setTimeout(tick, 1500);

  // ★ MutationObserver SO no #crm-pipeline e SO na lista direta de filhos
  //   (nao subtree). Isso evita re-render quando algo dentro do card muda.
  if(typeof MutationObserver !== "undefined"){
    var inicializouObserver = false;
    function tentaObservar(){
      if(inicializouObserver) return;
      var pipe = document.getElementById("crm-pipeline");
      if(!pipe){ setTimeout(tentaObservar, 500); return; }
      inicializouObserver = true;
      var mo = new MutationObserver(function(){
        // Espera estabilizar antes de re-render
        setTimeout(tick, 150);
      });
      mo.observe(pipe, { childList: true, subtree: false });
    }
    tentaObservar();
  }

  // Reagir a mudanca de cambio (raro, mas suporta)
  if(window.projettaCambio && typeof window.projettaCambio.onChange === "function"){
    window.projettaCambio.onChange(function(){
      ULTIMA_CHAVE_RENDER = ""; // forca re-render
      setTimeout(tick, 100);
    });
  }

  console.log("[104-card-detalhe-v3] instalado");
})();
