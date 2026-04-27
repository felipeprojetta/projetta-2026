/* ═══════════════════════════════════════════════════════════════════════════
   MODULE 37: FRETE CALC — Calculadora de Frete Internacional (v2)
   ═══════════════════════════════════════════════════════════════════════════
   Felipe 23/04/2026 — v2 (tarde)

   v2 — Reescrita. Felipe: "primeira coisa ali tem que falar se e FCL ou LCL
   ou aereo; se for FCL se e container de 20 dry ou 40 HC; nessa aba rota
   deixe valor por m3 se for LCL ou valor por container se for FCL; posso
   colocar manual ou buscar no banco; alguns itens sao por m3 — mostre o que
   e fixo e o que varia por m3; FCL tem taxa de retirar container pra
   armazem pra estufagem (Pre-Stacking)".

   FLUXO:
     1. TIPO: LCL / FCL / AEREO
     2. (se FCL) CONTAINER: 20'Dry / 40'HC
     3. ROTA: select filtrado por (tipo, container)
     4. CBM (auto da caixa) + outros inputs
     5. BREAKDOWN com cada linha editavel (override temporario)
     6. TOTAIS + Aplicar ao orcamento

   PERSISTENCIA:
     - window._freteCalc (sessao)
     - localStorage['frete_calc_'+cardId] (entre sessoes, inclui overrides)
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var SB='https://plmliavuwlgpwaizfeds.supabase.co';
var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
var CFG_KEYS=['frete_taxas_fixas_v1','frete_rotas_v1','frete_impostos_v1'];

function loadConfig(cb){
  if(window._FRETE_CFG){ cb(window._FRETE_CFG); return; }
  var keysParam=CFG_KEYS.map(function(k){return '"'+k+'"';}).join(',');
  fetch(SB+'/rest/v1/configuracoes?chave=in.('+keysParam+')&select=chave,valor',
    {headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}})
    .then(function(r){return r.json();})
    .then(function(rows){
      var cfg={};
      (rows||[]).forEach(function(r){ cfg[r.chave]=r.valor; });
      if(!cfg.frete_taxas_fixas_v1||!cfg.frete_rotas_v1||!cfg.frete_impostos_v1){
        console.warn('[frete-calc v2] config incompleta:',Object.keys(cfg));
        cb(null); return;
      }
      window._FRETE_CFG=cfg;
      cb(cfg);
    })
    .catch(function(e){ console.error('[frete-calc v2] erro load:',e); cb(null); });
}

// ==================== CAMBIO USD->BRL — NEUTRALIZADO (Felipe 27/04) ====================
// Antes buscava media 30 dias da AwesomeAPI. Agora cambio so vem do card.
async function _fetchCambioMedia30Dias(){ return null; }
function _aplicarCambioAuto(){ /* no-op */ }

function $(id){ return document.getElementById(id); }
function val(id){ var e=$(id); return e?(e.value||''):''; }
function numVal(id){ var e=$(id); return e?(parseFloat(e.value)||0):0; }
function fmtBRL(v){ return 'R$ '+(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtUSD(v){ return 'US$ '+(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function escH(s){ var d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; }

function cbmDaCaixa(){
  var L=numVal('crm-o-cif-caixa-l'), A=numVal('crm-o-cif-caixa-a'), E=numVal('crm-o-cif-caixa-e');
  return (L/1000)*(A/1000)*(E/1000);
}

/* OVERRIDES: { fieldKey: valorNovo } */
window._freteOverrides = window._freteOverrides || {};

function ov(key, defaultValue){
  var o = window._freteOverrides;
  if(Object.prototype.hasOwnProperty.call(o, key)) return parseFloat(o[key])||0;
  return defaultValue;
}

function buildBreakdownLCL(input, cfg){
  var rota=(cfg.frete_rotas_v1.rotas||[]).filter(function(r){return r.id===input.rotaId;})[0];
  if(!rota) return null;
  var tf=cfg.frete_taxas_fixas_v1.LCL;
  var cambio=input.cambio||5, cbm=input.cbm||0;
  var lines=[];

  var oceanUsdCbm = ov('ocean_freight_usd_cbm', rota.usd_cbm);
  lines.push({key:'ocean_freight_usd_cbm', desc:'Ocean Freight LCL', section:'Frete maritimo',
              moeda:'USD', base:oceanUsdCbm, mult:cbm, multLabel:'x '+cbm.toFixed(3)+' m3',
              brl:oceanUsdCbm*cbm*cambio, tipo:'por_m3', editable:true});

  lines.push({key:'oes_usd', desc:'Origin Equipament Surcharge', section:'Taxas de origem',
              moeda:'USD', base:ov('oes_usd', tf.origin_equipament_surcharge_usd), mult:1,
              brl:ov('oes_usd', tf.origin_equipament_surcharge_usd)*cambio, tipo:'fixo', editable:true});
  lines.push({key:'bl_fee_usd', desc:'B/L Fee', section:'Taxas de origem',
              moeda:'USD', base:ov('bl_fee_usd', tf.bl_fee_usd), mult:1,
              brl:ov('bl_fee_usd', tf.bl_fee_usd)*cambio, tipo:'fixo', editable:true});
  var thcRate = ov('thc_usd_cbm', rota.thc_override_usd_per_cbm || tf.thc_origin_usd_per_cbm);
  lines.push({key:'thc_usd_cbm', desc:'THC Origin'+(rota.thc_override_usd_per_cbm?' [rota]':''), section:'Taxas de origem',
              moeda:'USD', base:thcRate, mult:cbm, multLabel:'x '+cbm.toFixed(3)+' m3',
              brl:thcRate*cbm*cambio, tipo:'por_m3', editable:true});
  var loadRate = ov('loading_usd_cbm', rota.loading_override_usd_per_cbm || tf.loading_fee_usd_per_cbm);
  lines.push({key:'loading_usd_cbm', desc:'Loading Fee (TEC)'+(rota.loading_override_usd_per_cbm?' [rota]':''), section:'Taxas de origem',
              moeda:'USD', base:loadRate, mult:cbm, multLabel:'x '+cbm.toFixed(3)+' m3',
              brl:loadRate*cbm*cambio, tipo:'por_m3', editable:true});
  lines.push({key:'vgm_usd', desc:'VGM (Verified Gross Mass)', section:'Taxas de origem',
              moeda:'USD', base:ov('vgm_usd', tf.vgm_usd), mult:1,
              brl:ov('vgm_usd', tf.vgm_usd)*cambio, tipo:'fixo', editable:true});
  var scannerRate = ov('scanner_usd_cbm', tf.scanner_usd_per_cbm);
  lines.push({key:'scanner_usd_cbm', desc:'Scanner / X-Ray', section:'Taxas de origem',
              moeda:'USD', base:scannerRate, mult:cbm, multLabel:'x '+cbm.toFixed(3)+' m3',
              brl:scannerRate*cbm*cambio, tipo:'por_m3', editable:true});
  lines.push({key:'handling_usd', desc:'Handling', section:'Taxas de origem',
              moeda:'USD', base:ov('handling_usd', tf.handling_usd || 80), mult:1,
              brl:ov('handling_usd', tf.handling_usd || 80)*cambio, tipo:'fixo', editable:true});
  lines.push({key:'ams_usd', desc:'Transmissao A.M.S.', section:'Taxas de origem',
              moeda:'USD', base:ov('ams_usd', tf.transmissao_ams_usd || 50), mult:1,
              brl:ov('ams_usd', tf.transmissao_ams_usd || 50)*cambio, tipo:'fixo', editable:true});
  if(input.oversize > 0){
    lines.push({key:'oversize', desc:'Oversize / Over Weight Surcharge', section:'Taxas de origem',
                moeda:'USD', base:input.oversize, mult:1,
                brl:input.oversize*cambio, tipo:'fixo', editable:true});
  }

  var ex = rota.extras_usd || {};
  // Customs Clearance: SEMPRE adicionar, default USD 110 (solicitado 24/04).
  var customsBase = ov('customs_usd', ex.customs_clearence || 110);
  lines.push({key:'customs_usd', desc:'Customs Clearence', section:'Destino '+rota.destino_pais,
              moeda:'USD', base: customsBase, mult:1,
              brl: customsBase*cambio, tipo:'fixo', editable:true});
  if(ex.handling){
    lines.push({key:'handling_dest_usd', desc:'Handling (Destino)', section:'Destino '+rota.destino_pais,
                moeda:'USD', base:ov('handling_dest_usd', ex.handling), mult:1,
                brl:ov('handling_dest_usd', ex.handling)*cambio, tipo:'fixo', editable:true});
  }
  if(ex.transmissao_ams){
    lines.push({key:'ams_dest_usd', desc:'A.M.S. Destino', section:'Destino '+rota.destino_pais,
                moeda:'USD', base:ov('ams_dest_usd', ex.transmissao_ams), mult:1,
                brl:ov('ams_dest_usd', ex.transmissao_ams)*cambio, tipo:'fixo', editable:true});
  }

  if(input.dap > 0){
    lines.push({key:'dap', desc:'DAP Charges', section:'DAP (entrega destino)',
                moeda:'USD', base:input.dap, mult:1,
                brl:input.dap*cambio, tipo:'fixo', editable:true});
  }

  return {lines:lines, rota:rota, cbm:cbm, cambio:cambio};
}

function buildBreakdownFCL(input, cfg, modal){
  var rota=(cfg.frete_rotas_v1.rotas||[]).filter(function(r){return r.id===input.rotaId;})[0];
  if(!rota) return null;
  var tf=cfg.frete_taxas_fixas_v1[modal] || cfg.frete_taxas_fixas_v1.FCL_40HC;
  var cambio=input.cambio||5;
  var lines=[];

  var oceanFlat = ov('ocean_freight_flat_usd', rota.usd_flat);
  var contLbl = modal === 'FCL_20DRY' ? '20\'Dry' : '40\'HC';
  lines.push({key:'ocean_freight_flat_usd', desc:'Ocean Freight '+contLbl, section:'Frete maritimo',
              moeda:'USD', base:oceanFlat, mult:1,
              brl:oceanFlat*cambio, tipo:'fixo', editable:true});
  lines.push({key:'lacre_usd', desc:'LACRE / SEAL', section:'Frete maritimo',
              moeda:'USD', base:ov('lacre_usd', tf.lacre_seal_usd || 11), mult:1,
              brl:ov('lacre_usd', tf.lacre_seal_usd || 11)*cambio, tipo:'fixo', editable:true});

  lines.push({key:'thc_brl', desc:'Origin THC / Terminal Handling', section:'Taxas de origem',
              moeda:'BRL', base:ov('thc_brl', tf.terminal_handling_fee_brl || 1550), mult:1,
              brl:ov('thc_brl', tf.terminal_handling_fee_brl || 1550), tipo:'fixo', editable:true});
  lines.push({key:'bl_brl', desc:'B/L Fee', section:'Taxas de origem',
              moeda:'BRL', base:ov('bl_brl', tf.bl_fee_brl || 700), mult:1,
              brl:ov('bl_brl', tf.bl_fee_brl || 700), tipo:'fixo', editable:true});
  lines.push({key:'tss_usd', desc:'Terminal Security Surcharge', section:'Taxas de origem',
              moeda:'USD', base:ov('tss_usd', tf.terminal_security_surcharge_usd || 38), mult:1,
              brl:ov('tss_usd', tf.terminal_security_surcharge_usd || 38)*cambio, tipo:'fixo', editable:true});
  lines.push({key:'vgm_usd', desc:'VGM (Verified Gross Mass)', section:'Taxas de origem',
              moeda:'USD', base:ov('vgm_usd', tf.vgm_usd || 26), mult:1,
              brl:ov('vgm_usd', tf.vgm_usd || 26)*cambio, tipo:'fixo', editable:true});
  lines.push({key:'local_log_usd', desc:'Local Logistics Fee', section:'Taxas de origem',
              moeda:'USD', base:ov('local_log_usd', tf.local_logistics_fee_usd || 50), mult:1,
              brl:ov('local_log_usd', tf.local_logistics_fee_usd || 50)*cambio, tipo:'fixo', editable:true});
  lines.push({key:'handling_usd', desc:'Handling', section:'Taxas de origem',
              moeda:'USD', base:ov('handling_usd', tf.handling_usd || 80), mult:1,
              brl:ov('handling_usd', tf.handling_usd || 80)*cambio, tipo:'fixo', editable:true});
  lines.push({key:'ams_usd', desc:'Transmissao A.M.S.', section:'Taxas de origem',
              moeda:'USD', base:ov('ams_usd', tf.transmissao_ams_usd || 50), mult:1,
              brl:ov('ams_usd', tf.transmissao_ams_usd || 50)*cambio, tipo:'fixo', editable:true});

  var psBRLDefault = (rota.extras_brl||{}).pre_stacking || tf.pre_stacking_brl_default || 0;
  var psBRL = ov('pre_stacking_brl', psBRLDefault);
  if(psBRL > 0){
    lines.push({key:'pre_stacking_brl', desc:'Pre-Stacking (retirada container + estufagem)', section:'Operacao container',
                moeda:'BRL', base:psBRL, mult:1,
                brl:psBRL, tipo:'fixo', editable:true});
  }

  var exU = rota.extras_usd || {};
  // Customs Clearance: SEMPRE adicionar, default USD 110 (solicitado 24/04).
  var customsBaseFcl = ov('customs_usd', exU.customs_clearence || 110);
  lines.push({key:'customs_usd', desc:'Customs Clearence', section:'Destino '+rota.destino_pais,
              moeda:'USD', base: customsBaseFcl, mult:1,
              brl: customsBaseFcl*cambio, tipo:'fixo', editable:true});
  if(rota.ad_valorem_pct){
    var adV = oceanFlat * rota.ad_valorem_pct;
    lines.push({key:'ad_valorem', desc:'Ad-Valorem ('+(rota.ad_valorem_pct*100).toFixed(2)+'%)', section:'Destino '+rota.destino_pais,
                moeda:'USD', base:adV, mult:1,
                brl:adV*cambio, tipo:'calc', editable:false});
  }

  return {lines:lines, rota:rota, cbm:input.cbm||0, cambio:cambio};
}

function calcFrete(input, cfg){
  var sel=$('frete-calc-tipo'); if(!sel) return null;
  var tipo=sel.value;
  if(!input.rotaId || tipo==='AEREO') return null;

  var bd;
  if(tipo === 'LCL')      bd = buildBreakdownLCL(input, cfg);
  else if(tipo === 'FCL') bd = buildBreakdownFCL(input, cfg, val('frete-calc-fcl-modal')||'FCL_40HC');
  else return null;
  if(!bd) return null;

  var imp = cfg.frete_impostos_v1;
  var cambio = bd.cambio;
  var oceanLine = bd.lines.filter(function(l){return l.key==='ocean_freight_usd_cbm'||l.key==='ocean_freight_flat_usd';})[0];
  var oceanBRL = oceanLine ? oceanLine.brl : 0;
  var dapLine = bd.lines.filter(function(l){return l.key==='dap';})[0];
  var dapBRL = dapLine ? dapLine.brl : 0;
  var iofBase = oceanBRL + dapBRL;
  var iofBRL = input.iofOn ? iofBase * imp.iof.percentual : 0;
  if(iofBRL > 0){
    bd.lines.push({key:'iof', desc:'IOF ('+(imp.iof.percentual*100).toFixed(1)+'% s/ frete+DAP)', section:'Impostos BR',
                   moeda:'BRL', base:iofBRL, mult:1,
                   brl:iofBRL, tipo:'calc', editable:false});
  }
  var issBRL = imp.iss.valor_brl_aprox || 0;
  if(issBRL > 0){
    bd.lines.push({key:'iss', desc:'ISS (reportado — nao soma)', section:'Impostos BR',
                   moeda:'BRL', base:issBRL, mult:1,
                   brl:issBRL, tipo:'calc', editable:false, noSum:true});
  }

  var usdSum = 0, brlSum = 0;
  bd.lines.forEach(function(l){
    if(l.noSum) return;
    if(l.moeda === 'USD') usdSum += (l.base * (l.mult||1));
    brlSum += l.brl;
  });
  bd.usdSum = usdSum;
  bd.totalBRL = brlSum;
  bd.totalUSDEquiv = brlSum / cambio;
  bd.iof = iofBRL;
  bd.iss = issBRL;
  bd.timestamp = new Date().toISOString();
  bd.tipo = tipo;
  bd.modal = tipo === 'FCL' ? (val('frete-calc-fcl-modal')||'FCL_40HC') : tipo;
  return bd;
}

function buildRotaOptions(cfg){
  var sel=$('frete-calc-rota'); if(!sel) return;
  var tipo=val('frete-calc-tipo');
  var fclModal=val('frete-calc-fcl-modal');
  var rotas = (cfg.frete_rotas_v1.rotas||[]).filter(function(r){
    if(tipo === 'LCL')   return r.modal === 'LCL';
    if(tipo === 'FCL')   return r.modal === (fclModal||'FCL_40HC');
    if(tipo === 'AEREO') return r.modal === 'AEREO';
    return false;
  });
  sel.innerHTML='<option value="">— Selecione a rota —</option>';
  rotas.forEach(function(r){
    // Felipe 24/04: se rota for regional (valor_manual=true) ou usd_cbm/usd_flat = 0,
    // mostrar '⚡ valor manual' em vez de 'US$ 0/m3' no dropdown. Usuario edita
    // ocean freight manualmente no breakdown (input 'Valor base' com editable:true).
    var _val = (r.modal === 'LCL') ? (r.usd_cbm||0)
             : ((r.modal === 'FCL_20DRY' || r.modal === 'FCL_40HC') ? (r.usd_flat||0) : 0);
    var _isManual = (r.valor_manual === true) || (_val === 0);
    var _unit = (r.modal === 'LCL') ? '/m3' : ' flat';
    var base = _isManual ? '⚡ valor manual' : ('US$ ' + _val + _unit);
    // So exibir codigo de pais entre parenteses se for ISO curto (US, NG, BR). Nao
    // mostrar pseudo-codigos regionais (AMER_SUL, AMER_NORTE, OR_MED) que ficariam feios.
    var _paisTxt = (r.destino_pais && r.destino_pais.length <= 3) ? (' (' + r.destino_pais + ')') : '';
    var lbl = r.destino_nome + _paisTxt + ' · ' + base;
    var o=document.createElement('option'); o.value=r.id; o.textContent=lbl;
    sel.appendChild(o);
  });
  var obs=$('frete-calc-obs-rota'); if(obs) obs.innerHTML='';
}

function onEditBaseValue(ev){
  var el = ev.target;
  var key = el.getAttribute('data-key');
  if(!key) return;
  var newVal = parseFloat(el.value);
  if(isNaN(newVal) || newVal < 0){ delete window._freteOverrides[key]; }
  else { window._freteOverrides[key] = newVal; }
  // ★ Felipe 24/04: NAO re-renderizar o body todo durante digitacao.
  // A re-renderizacao destruia o <input> que user estava editando e o foco
  // se perdia. Agora atualiza apenas celulas BRL + footer, deixando o input
  // intocado (usuario continua digitando sem interrupcao).
  updateTotalsInPlace();
}

// Atualiza totais sem mexer nos inputs. Usada durante digitacao (evento input).
// O re-render completo so acontece em 'change' (blur) pra atualizar visual
// de override (borda laranja + icone reset).
function updateTotalsInPlace(){
  if(!window._FRETE_CFG) return;
  var tipo = val('frete-calc-tipo');
  if(tipo === 'AEREO') return;
  var inp = currentInput();
  if(!inp) return;
  var r = calcFrete(inp, window._FRETE_CFG);
  window._freteCalcPending = r;

  var body = $('frete-calc-body'); if(!body) return;
  // Atualiza celulas BRL de cada linha (sem tocar nos inputs)
  r.lines.forEach(function(l){
    if(!l.key) return;
    var input = body.querySelector('.frete-calc-edit[data-key="'+l.key+'"]');
    if(!input) return;
    var row = input.closest('tr');
    if(!row || !row.cells) return;
    var brlCell = row.cells[row.cells.length-1];
    if(brlCell){
      // Felipe 24/04: BRL + USD equivalente embaixo (match com renderBreakdown)
      var _usdEqLn = r.cambio > 0 ? (l.brl / r.cambio) : 0;
      var _usdSub2 = '<div style="font-size:9px;color:#888;font-weight:400;margin-top:1px;font-variant-numeric:tabular-nums">= '+fmtUSD(_usdEqLn)+'</div>';
      brlCell.innerHTML = l.noSum
        ? ('<span style="color:#999;font-style:italic">'+fmtBRL(l.brl)+' *</span>'+_usdSub2)
        : ('<b>'+fmtBRL(l.brl)+'</b>'+_usdSub2);
    }
  });

  // Atualiza footer (Felipe 24/04: BRL + USD equivalente em cada card)
  var e;
  var _dualBU = function(brl){
    var usdEq = r.cambio > 0 ? (brl / r.cambio) : 0;
    return fmtBRL(brl) + '<div style="font-size:9px;color:#888;font-weight:400;margin-top:2px;font-variant-numeric:tabular-nums">= '+fmtUSD(usdEq)+'</div>';
  };
  e=$('frete-calc-sum-usd'); if(e) e.textContent = fmtUSD(r.usdSum);
  e=$('frete-calc-sum-brl'); if(e) e.innerHTML = _dualBU(r.usdSum * r.cambio);
  var brlDirect = r.lines.reduce(function(acc,l){
    return acc + (l.moeda==='BRL' && !l.noSum && l.key!=='iof' ? l.brl : 0);
  }, 0);
  e=$('frete-calc-sum-direct'); if(e) e.innerHTML = _dualBU(brlDirect);
  e=$('frete-calc-sum-iof'); if(e) e.innerHTML = _dualBU(r.iof||0);
  e=$('frete-calc-sum-total'); if(e) e.textContent = fmtBRL(r.totalBRL||0);
  e=$('frete-calc-sum-total-usd'); if(e) e.textContent = fmtUSD(r.totalUSDEquiv||0);
}

function renderBreakdown(r){
  var body=$('frete-calc-body'); if(!body) return;
  if(!r){
    body.innerHTML='<tr><td colspan="6" style="text-align:center;color:#888;padding:20px;font-style:italic">Selecione tipo e rota para ver o breakdown</td></tr>';
    return;
  }
  var html='';
  var lastSection='';
  r.lines.forEach(function(l){
    if(l.section && l.section !== lastSection){
      html+='<tr><td colspan="6" style="background:#f5f5f5;font-weight:700;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.4px;padding:5px 8px">'+escH(l.section)+'</td></tr>';
      lastSection = l.section;
    }
    var tipoBadge = l.tipo==='fixo'   ? '<span title="Valor fixo">🔒</span>'
                  : l.tipo==='por_m3' ? '<span title="Varia por m3" style="color:#1565c0">📐</span>'
                  :                     '<span title="Calculado" style="color:#999">∫</span>';
    var isOverridden = Object.prototype.hasOwnProperty.call(window._freteOverrides, l.key);
    var baseCell;
    if(l.editable){
      baseCell = '<input type="number" step="0.01" data-key="'+l.key+'" value="'+l.base+'" class="frete-calc-edit" '
        + 'style="width:70px;padding:3px 5px;border:1px solid '+(isOverridden?'#ff9800':'#ddd')+';'
        + 'background:'+(isOverridden?'#fff3e0':'#fff')+';border-radius:3px;font-size:10px;text-align:right;'
        + 'font-variant-numeric:tabular-nums">'
        + (isOverridden?' <span title="Resetar ao padrao" style="cursor:pointer;color:#ff9800;font-size:12px" data-reset="'+l.key+'">↺</span>':'');
    } else {
      baseCell = '<span style="color:#888;font-size:10px;font-variant-numeric:tabular-nums">'+(l.base||0).toFixed(2)+'</span>';
    }
    var moedaCell = l.moeda==='USD'
      ? '<span style="color:#1565c0;font-weight:600;font-size:10px">USD</span>'
      : '<span style="color:#8e44ad;font-weight:600;font-size:10px">BRL</span>';
    var multCell = l.multLabel
      ? ('<span style="color:#888;font-size:9px">'+escH(l.multLabel)+'</span>')
      : (l.moeda==='USD' ? ('<span style="color:#888;font-size:9px">x '+(r.cambio).toFixed(4)+'</span>') : '');
    // Felipe 24/04: cada linha mostra BRL + USD equivalente embaixo
    var _usdEqLine = r.cambio > 0 ? (l.brl / r.cambio) : 0;
    var _usdSub = '<div style="font-size:9px;color:#888;font-weight:400;margin-top:1px;font-variant-numeric:tabular-nums">= '+fmtUSD(_usdEqLine)+'</div>';
    var brlCell = l.noSum
      ? ('<span style="color:#999;font-style:italic">'+fmtBRL(l.brl)+' *</span>'+_usdSub)
      : ('<b>'+fmtBRL(l.brl)+'</b>'+_usdSub);
    html+='<tr>'
      +'<td style="padding:4px 6px;text-align:center;font-size:11px">'+tipoBadge+'</td>'
      +'<td style="padding:4px 8px;color:#555;font-size:11px">'+escH(l.desc)+'</td>'
      +'<td style="padding:4px 6px;text-align:center">'+moedaCell+'</td>'
      +'<td style="padding:4px 6px;text-align:right">'+baseCell+'</td>'
      +'<td style="padding:4px 6px;text-align:right">'+multCell+'</td>'
      +'<td style="padding:4px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:11px">'+brlCell+'</td>'
      +'</tr>';
  });
  body.innerHTML = html;

  // ★ Felipe 24/04: event delegation no body (elemento persistente entre
  // re-renders, apenas innerHTML muda). Antes os listeners eram adicionados
  // em cada input individual a cada render, mas isso nao sobrevive ao
  // body.innerHTML = html, e os inputs recriados nao tinham handler consistente.
  if(!body._freteDelegBound){
    body._freteDelegBound = true;
    // Evento 'input': dispara a cada tecla. Atualiza total em tempo real
    // SEM re-renderizar (deixando o input intocado).
    body.addEventListener('input', function(ev){
      if(ev.target && ev.target.classList && ev.target.classList.contains('frete-calc-edit')){
        onEditBaseValue(ev);
      }
    });
    // Evento 'change': dispara em blur ou Enter com mudanca. Aqui sim re-renderiza
    // pra atualizar o visual de override (borda laranja + icone reset).
    body.addEventListener('change', function(ev){
      if(ev.target && ev.target.classList && ev.target.classList.contains('frete-calc-edit')){
        recomputeAndRender();
      }
    });
    // Clique no icone de reset (↺)
    body.addEventListener('click', function(ev){
      var resetKey = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-reset');
      if(resetKey){
        delete window._freteOverrides[resetKey];
        recomputeAndRender();
      }
    });
  }

  // Felipe 24/04: BRL + USD equivalente em cada card
  var _dualBU2 = function(brl){
    var usdEq = r.cambio > 0 ? (brl / r.cambio) : 0;
    return fmtBRL(brl) + '<div style="font-size:9px;color:#888;font-weight:400;margin-top:2px;font-variant-numeric:tabular-nums">= '+fmtUSD(usdEq)+'</div>';
  };
  $('frete-calc-sum-usd').textContent = fmtUSD(r.usdSum);
  $('frete-calc-sum-brl').innerHTML = _dualBU2(r.usdSum * r.cambio);
  var brlDirect = r.lines.reduce(function(acc,l){
    return acc + (l.moeda==='BRL' && !l.noSum && l.key!=='iof' ? l.brl : 0);
  }, 0);
  $('frete-calc-sum-direct').innerHTML = _dualBU2(brlDirect);
  $('frete-calc-sum-iof').innerHTML = _dualBU2(r.iof||0);
  $('frete-calc-sum-total').textContent = fmtBRL(r.totalBRL||0);
  $('frete-calc-sum-total-usd').textContent = fmtUSD(r.totalUSDEquiv||0);
  var obs=$('frete-calc-obs-rota');
  if(obs) obs.innerHTML = r.rota && r.rota.obs ? '💡 '+escH(r.rota.obs) : '';
}

function currentInput(){
  var sel=$('frete-calc-rota'); if(!sel) return null;
  var rotaId=sel.value; if(!rotaId) return null;
  return {
    rotaId: rotaId,
    cbm: numVal('frete-calc-cbm'),
    peso: numVal('frete-calc-peso'),
    incoterm: val('crm-o-inst-incoterm') || 'CIF',
    cambio: numVal('frete-calc-cambio') || 5,
    dap: numVal('frete-calc-dap'),
    oversize: numVal('frete-calc-oversize'),
    iofOn: $('frete-calc-iof-on') ? $('frete-calc-iof-on').checked : true
  };
}

function recomputeAndRender(){
  if(!window._FRETE_CFG){ renderBreakdown(null); return; }
  var tipo = val('frete-calc-tipo');
  if(tipo === 'AEREO'){
    var body=$('frete-calc-body');
    if(body) body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:30px;font-style:italic">'
      + '✈️ Modal AEREO em breve — aguardando cotacao.<br>'
      + 'Por enquanto preencha manualmente o campo "Frete Maritimo" no card CRM.</td></tr>';
    $('frete-calc-sum-usd').textContent = '—';
    $('frete-calc-sum-brl').textContent = '—';
    $('frete-calc-sum-direct').textContent = '—';
    $('frete-calc-sum-iof').textContent = '—';
    $('frete-calc-sum-total').textContent = '—';
    $('frete-calc-sum-total-usd').textContent = '—';
    window._freteCalcPending = null;
    return;
  }
  var inp = currentInput();
  if(!inp){ renderBreakdown(null); return; }
  var r = calcFrete(inp, window._FRETE_CFG);
  window._freteCalcPending = r;
  renderBreakdown(r);
}

function onTipoChange(){
  var tipo = val('frete-calc-tipo');
  var fclWrap = $('frete-calc-fcl-wrap');
  if(fclWrap) fclWrap.style.display = (tipo === 'FCL') ? '' : 'none';
  window._freteOverrides = {};
  buildRotaOptions(window._FRETE_CFG);
  recomputeAndRender();
}

function onFclModalChange(){
  window._freteOverrides = {};
  buildRotaOptions(window._FRETE_CFG);
  recomputeAndRender();
}

function onRotaChange(){
  var sel=$('frete-calc-rota');
  if(!sel||!window._FRETE_CFG) return;
  var rotaId=sel.value; if(!rotaId){ recomputeAndRender(); return; }
  var rota=window._FRETE_CFG.frete_rotas_v1.rotas.filter(function(r){return r.id===rotaId;})[0];
  if(!rota) return;
  if(rota.dap_charges_usd!==undefined) $('frete-calc-dap').value = rota.dap_charges_usd||0;
  window._freteOverrides = {};
  recomputeAndRender();
}

window.freteOpenCalc=function(){
  loadConfig(function(cfg){
    if(!cfg){ alert('Erro: nao foi possivel carregar a configuracao de frete da nuvem.'); return; }
    var tipoSel = $('frete-calc-tipo');
    if(tipoSel && !tipoSel.value) tipoSel.value = 'LCL';
    var fclModalSel = $('frete-calc-fcl-modal');
    if(fclModalSel && !fclModalSel.value) fclModalSel.value = 'FCL_40HC';
    $('frete-calc-fcl-wrap').style.display = (tipoSel && tipoSel.value === 'FCL') ? '' : 'none';
    buildRotaOptions(cfg);
    var cbmAuto = cbmDaCaixa();
    if(cbmAuto > 0) $('frete-calc-cbm').value = cbmAuto.toFixed(3);
    // v29: usar cambio MASTER (window.projettaCambio) como fonte de verdade.
    //      Se master nao carregou ainda, cai no inst-intl-cambio legado.
    var cambio = (window.projettaCambio && typeof window.projettaCambio.get === 'function')
                 ? window.projettaCambio.get()
                 : (numVal('inst-intl-cambio') || 0);
    $('frete-calc-cambio').value = cambio;
    _aplicarCambioAuto();
    $('frete-calc-dap').value = 0;
    $('frete-calc-oversize').value = 0;
    $('frete-calc-peso').value = '';
    $('frete-calc-iof-on').checked = true;
    var cardId = window._crmOrcCardId || '_novo';
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem('frete_calc_'+cardId) || 'null'); } catch(e){}
    if(stored && stored.rotaId){
      if(stored.tipo) tipoSel.value = stored.tipo;
      if(stored.modal && stored.modal !== stored.tipo) fclModalSel.value = stored.modal;
      $('frete-calc-fcl-wrap').style.display = (tipoSel.value === 'FCL') ? '' : 'none';
      buildRotaOptions(cfg);
      $('frete-calc-rota').value = stored.rotaId;
      // Felipe 24/04: CBM vem SEMPRE da caixa atual (nao do localStorage antigo).
      // cbmDaCaixa() reflete as dimensoes auto-calculadas; sobrescrever com stored.cbm
      // trazia o valor de uma sessao anterior. Fallback pra stored so se caixa=0.
      if(cbmAuto <= 0 && stored.cbm) $('frete-calc-cbm').value = stored.cbm;
      if(stored.dap != null) $('frete-calc-dap').value = stored.dap;
      if(stored.oversize != null) $('frete-calc-oversize').value = stored.oversize;
      if(stored.iofOn != null) $('frete-calc-iof-on').checked = stored.iofOn;
      window._freteOverrides = stored.overrides || {};
    } else {
      window._freteOverrides = {};
    }
    recomputeAndRender();
    var bg=$('frete-calc-modal'); if(bg) bg.classList.add('open');
  });
};

window.freteCloseCalc=function(){
  var bg=$('frete-calc-modal'); if(bg) bg.classList.remove('open');
};

window.freteAplicar=function(){
  var r = window._freteCalcPending;
  if(!r){ alert('Selecione tipo e rota primeiro.'); return; }
  var totalUSD = Math.round(r.totalUSDEquiv);
  var fm = $('crm-o-cif-frete-maritimo');
  if(fm){ fm.value = totalUSD; fm.dispatchEvent(new Event('input', {bubbles:true})); }
  window._freteCalc = r;
  try {
    var cardId = window._crmOrcCardId || '_novo';
    var inp = currentInput();
    localStorage.setItem('frete_calc_'+cardId, JSON.stringify({
      tipo: r.tipo, modal: r.modal,
      rotaId: inp.rotaId, cbm: inp.cbm, dap: inp.dap, oversize: inp.oversize, iofOn: inp.iofOn,
      overrides: window._freteOverrides || {},
      totalBRL: r.totalBRL, totalUSD: totalUSD, appliedAt: new Date().toISOString()
    }));
  } catch(e){ console.warn('[frete-calc] localStorage save:', e); }
  if(typeof window.crmCifRecalc === 'function') window.crmCifRecalc();
  window.freteCloseCalc();
};

window.freteResetOverrides = function(){
  if(Object.keys(window._freteOverrides||{}).length === 0){
    alert('Nenhum override ativo.');
    return;
  }
  window._freteOverrides = {};
  recomputeAndRender();
};

function wireModalInputs(){
  var ids = ['frete-calc-rota','frete-calc-cbm','frete-calc-peso',
             'frete-calc-cambio','frete-calc-dap','frete-calc-oversize','frete-calc-iof-on'];
  ids.forEach(function(id){
    var el = $(id); if(!el) return;
    if(id === 'frete-calc-rota') el.addEventListener('change', onRotaChange);
    else el.addEventListener('input', recomputeAndRender);
  });
  var tipoSel = $('frete-calc-tipo');
  if(tipoSel) tipoSel.addEventListener('change', onTipoChange);
  var fclSel = $('frete-calc-fcl-modal');
  if(fclSel) fclSel.addEventListener('change', onFclModalChange);
}

function init(){
  wireModalInputs();
  loadConfig(function(cfg){
    if(cfg) console.log('[frete-calc v2] config carregada · '+cfg.frete_rotas_v1.rotas.length+' rotas');
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
