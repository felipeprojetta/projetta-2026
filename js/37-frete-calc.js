/* ═══════════════════════════════════════════════════════════════════════════
   MODULE 37: FRETE CALC — Calculadora automática de frete internacional
   ═══════════════════════════════════════════════════════════════════════════
   Felipe 23/04/2026

   Integra com o bloco CIF existente (#crm-inst-cif-box). Botão "🧮 Calcular"
   abre modal que computa frete marítimo completo (ocean + taxas origem +
   destino + impostos BR) baseado em rotas cadastradas na nuvem.

   DEPENDÊNCIAS:
   - Supabase tabela `configuracoes` com chaves:
       frete_taxas_fixas_v1, frete_rotas_v1, frete_impostos_v1
   - DOM: #crm-o-cif-frete-maritimo (destino do total USD)
   - DOM: #crm-o-cif-caixa-l / -a / -e (origem do CBM automático)
   - Função global: crmCifRecalc()

   NÃO MODIFICA: captureSnapshot, _captureOrcValues, _salvarSnapshotECRM,
   crmOrcamentoPronto — apenas escreve no campo `crm-o-cif-frete-maritimo`
   que já é lido por _captureOrcValues naturalmente.

   PERSISTÊNCIA DO BREAKDOWN:
   - window._freteCalc (session)
   - localStorage['frete_calc_' + cardId] (entre sessões)
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
        console.warn('[frete-calc] config incompleta:',Object.keys(cfg));
        cb(null); return;
      }
      window._FRETE_CFG=cfg;
      cb(cfg);
    })
    .catch(function(e){ console.error('[frete-calc] erro load:',e); cb(null); });
}

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

function calcFrete(input, cfg){
  var rotas=cfg.frete_rotas_v1.rotas;
  var rota=rotas.filter(function(r){return r.id===input.rotaId;})[0];
  if(!rota) return null;

  var tf=cfg.frete_taxas_fixas_v1[rota.modal];
  var imp=cfg.frete_impostos_v1;
  var lines=[], usdSum=0, brlDir=0;
  var cambio=input.cambio||5, cbm=input.cbm||0;

  function au(desc,v){ if(!v) return; lines.push({desc:desc, moeda:'USD', valor:v, brl:v*cambio}); usdSum+=v; }
  function ab(desc,v){ if(!v) return; lines.push({desc:desc, moeda:'BRL', valor:v, brl:v}); brlDir+=v; }
  function sec(t){ lines.push({section:t}); }

  if(rota.modal==='LCL'){
    sec('Frete marítimo');
    au('Ocean Freight LCL (US$ '+rota.usd_cbm+'/CBM × '+cbm.toFixed(3)+' m³)', cbm*rota.usd_cbm);
    sec('Taxas de origem');
    au('Origin Equipament Surcharge', tf.origin_equipament_surcharge_usd);
    au('B/L Fee', tf.bl_fee_usd);
    var thcRate=rota.thc_override_usd_per_cbm||tf.thc_origin_usd_per_cbm;
    var loadRate=rota.loading_override_usd_per_cbm||tf.loading_fee_usd_per_cbm;
    au('THC (Origin)'+(rota.thc_override_usd_per_cbm?' [rota override]':''), cbm*thcRate);
    au('Loading Fee'+(rota.loading_override_usd_per_cbm?' [rota override]':''), cbm*loadRate);
    au('VGM (Verified Gross Mass)', tf.vgm_usd);
    au('Scanner', cbm*tf.scanner_usd_per_cbm);
    if(input.oversize>0) au('Over Weight Surcharge', input.oversize);
    var ex=rota.extras_usd||{};
    if(ex.handling||ex.customs_clearence||ex.transmissao_ams){
      sec('Destino '+rota.destino_pais);
      if(ex.handling) au('Handling', ex.handling);
      if(ex.customs_clearence) au('Customs Clearence', ex.customs_clearence);
      if(ex.transmissao_ams) au('Transmissão AMS', ex.transmissao_ams);
    }
    if(input.dap>0){ sec('DAP (entrega no destino)'); au('DAP Charges', input.dap); }
  } else if(rota.modal==='FCL_40HC'){
    sec('Frete marítimo');
    au('Frete marítimo container 40HC', rota.usd_flat);
    au('LACRE / SEAL', tf.lacre_seal_usd);
    sec('Taxas de origem');
    ab('Terminal Handling Fee', tf.terminal_handling_fee_brl);
    ab('B/L Fee', tf.bl_fee_brl);
    au('Terminal Security Surcharge', tf.terminal_security_surcharge_usd);
    au('VGM (Verified Gross Mass)', tf.vgm_usd);
    au('Local Logistics Fee', tf.local_logistics_fee_usd);
    au('Handling', tf.handling_usd);
    var exU=rota.extras_usd||{}, exB=rota.extras_brl||{};
    if(exU.customs_clearence||exB.pre_stacking||rota.ad_valorem_pct){
      sec('Destino '+rota.destino_pais);
      if(exU.customs_clearence) au('Customs Clearence', exU.customs_clearence);
      if(exB.pre_stacking) ab('Recebimento Antecipado — Pre Stacking', exB.pre_stacking);
      if(rota.ad_valorem_pct) au('Ad-Valorem ('+(rota.ad_valorem_pct*100).toFixed(2)+'%)', rota.usd_flat*rota.ad_valorem_pct);
    }
  }

  var oceanForIof=(rota.modal==='LCL'? cbm*rota.usd_cbm : rota.usd_flat)+(input.dap||0);
  var iofBrl=input.iofOn? oceanForIof*imp.iof.percentual*cambio : 0;
  var issBrl=imp.iss.valor_brl_aprox||0;

  if(iofBrl||issBrl){
    sec('Impostos BR');
    if(iofBrl) ab('IOF ('+(imp.iof.percentual*100).toFixed(1)+'% s/ frete internacional)', iofBrl);
    if(issBrl){ lines.push({desc:'ISS (reportado — não soma no total)', moeda:'BRL', valor:issBrl, brl:issBrl, noSum:true}); }
  }

  var totalBRL=usdSum*cambio + brlDir + iofBrl;
  return {
    lines:lines, usdSum:usdSum, brlDirect:brlDir, iof:iofBrl, iss:issBrl,
    totalBRL:totalBRL, totalUSDEquiv:totalBRL/cambio,
    rota:rota, cbm:cbm, cambio:cambio, dap:input.dap, oversize:input.oversize,
    iofOn:input.iofOn, timestamp:new Date().toISOString()
  };
}

function buildRotaOptions(cfg){
  var sel=$('frete-calc-rota'); if(!sel) return;
  sel.innerHTML='<option value="">— Selecione a rota —</option>';
  cfg.frete_rotas_v1.rotas.forEach(function(r){
    var lbl=r.destino_nome+' ('+r.destino_pais+') · '+r.modal+' · '+(r.modal==='LCL'?('US$ '+r.usd_cbm+'/CBM'):('US$ '+r.usd_flat+' flat'));
    var o=document.createElement('option'); o.value=r.id; o.textContent=lbl;
    sel.appendChild(o);
  });
}

function renderBreakdown(r){
  var body=$('frete-calc-body'); if(!body) return;
  if(!r){ body.innerHTML='<tr><td colspan="4" style="text-align:center;color:#888;padding:20px;font-style:italic">Selecione uma rota para ver o breakdown</td></tr>'; return; }
  var html='';
  r.lines.forEach(function(l){
    if(l.section){
      html+='<tr><td colspan="4" style="background:#f5f5f5;font-weight:700;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.4px;padding:5px 8px">'+escH(l.section)+'</td></tr>';
    } else {
      var origin = l.moeda==='USD' ? fmtUSD(l.valor) : 'BRL';
      var mult = l.moeda==='USD' ? ('× '+r.cambio.toFixed(4)) : '';
      var brlDisplay = l.noSum ? ('<span style="color:#999;font-style:italic">'+fmtBRL(l.brl)+' *</span>') : ('<b>'+fmtBRL(l.brl)+'</b>');
      html+='<tr><td style="padding:5px 8px;color:#555;font-size:11px">'+escH(l.desc)+'</td><td style="padding:5px 8px;text-align:right;color:#888;font-size:10px;font-variant-numeric:tabular-nums">'+origin+'</td><td style="padding:5px 8px;text-align:right;color:#888;font-size:10px">'+mult+'</td><td style="padding:5px 8px;text-align:right;font-variant-numeric:tabular-nums;font-size:11px">'+brlDisplay+'</td></tr>';
    }
  });
  body.innerHTML=html;
  $('frete-calc-sum-usd').textContent=fmtUSD(r.usdSum);
  $('frete-calc-sum-brl').textContent=fmtBRL(r.usdSum*r.cambio);
  $('frete-calc-sum-direct').textContent=fmtBRL(r.brlDirect);
  $('frete-calc-sum-iof').textContent=fmtBRL(r.iof);
  $('frete-calc-sum-total').textContent=fmtBRL(r.totalBRL);
  $('frete-calc-sum-total-usd').textContent=fmtUSD(r.totalUSDEquiv);
  var obs=$('frete-calc-obs-rota');
  if(obs) obs.innerHTML = r.rota.obs ? '💡 '+escH(r.rota.obs) : '';
}

function currentInput(){
  var sel=$('frete-calc-rota'); if(!sel) return null;
  var rotaId=sel.value; if(!rotaId) return null;
  return {
    rotaId:rotaId, cbm:numVal('frete-calc-cbm'), peso:numVal('frete-calc-peso'),
    incoterm:val('crm-o-inst-incoterm')||'CIF', cambio:numVal('frete-calc-cambio')||5,
    dap:numVal('frete-calc-dap'), oversize:numVal('frete-calc-oversize'),
    iofOn: $('frete-calc-iof-on') ? $('frete-calc-iof-on').checked : true
  };
}

function recomputeAndRender(){
  if(!window._FRETE_CFG){ renderBreakdown(null); return; }
  var inp=currentInput();
  if(!inp){ renderBreakdown(null); return; }
  var r=calcFrete(inp, window._FRETE_CFG);
  window._freteCalcPending=r;
  renderBreakdown(r);
}

function onRotaChange(){
  var sel=$('frete-calc-rota');
  if(!sel||!window._FRETE_CFG) return;
  var rotaId=sel.value; if(!rotaId){ recomputeAndRender(); return; }
  var rota=window._FRETE_CFG.frete_rotas_v1.rotas.filter(function(r){return r.id===rotaId;})[0];
  if(!rota) return;
  if(rota.dap_charges_usd!==undefined) $('frete-calc-dap').value=rota.dap_charges_usd||0;
  recomputeAndRender();
}

window.freteOpenCalc=function(){
  loadConfig(function(cfg){
    if(!cfg){ alert('Erro: não foi possível carregar a configuração de frete da nuvem.'); return; }
    buildRotaOptions(cfg);
    var cbmAuto=cbmDaCaixa();
    if(cbmAuto>0) $('frete-calc-cbm').value=cbmAuto.toFixed(3);
    var cambio=numVal('inst-intl-cambio')||5.20;
    $('frete-calc-cambio').value=cambio;
    $('frete-calc-dap').value=0; $('frete-calc-oversize').value=0; $('frete-calc-peso').value='';
    $('frete-calc-iof-on').checked=true;
    var cardId=window._crmOrcCardId||'_novo';
    var stored=null;
    try{ stored=JSON.parse(localStorage.getItem('frete_calc_'+cardId)||'null'); }catch(e){}
    if(stored && stored.rotaId){
      $('frete-calc-rota').value=stored.rotaId;
      if(stored.cbm) $('frete-calc-cbm').value=stored.cbm;
      if(stored.dap!=null) $('frete-calc-dap').value=stored.dap;
      if(stored.oversize!=null) $('frete-calc-oversize').value=stored.oversize;
      if(stored.iofOn!=null) $('frete-calc-iof-on').checked=stored.iofOn;
    }
    recomputeAndRender();
    var bg=$('frete-calc-modal'); if(bg) bg.classList.add('open');
  });
};

window.freteCloseCalc=function(){
  var bg=$('frete-calc-modal'); if(bg) bg.classList.remove('open');
};

window.freteAplicar=function(){
  var r=window._freteCalcPending;
  if(!r){ alert('Selecione uma rota primeiro.'); return; }
  var totalUSD=Math.round(r.totalUSDEquiv);
  var fm=$('crm-o-cif-frete-maritimo');
  if(fm){ fm.value=totalUSD; fm.dispatchEvent(new Event('input',{bubbles:true})); }
  window._freteCalc=r;
  try{
    var cardId=window._crmOrcCardId||'_novo';
    var inp=currentInput();
    localStorage.setItem('frete_calc_'+cardId, JSON.stringify({
      rotaId:inp.rotaId, cbm:inp.cbm, dap:inp.dap, oversize:inp.oversize, iofOn:inp.iofOn,
      totalBRL:r.totalBRL, totalUSD:totalUSD, appliedAt:new Date().toISOString()
    }));
  }catch(e){ console.warn('[frete-calc] localStorage save:',e); }
  if(typeof window.crmCifRecalc==='function') window.crmCifRecalc();
  window.freteCloseCalc();
};

function wireModalInputs(){
  var ids=['frete-calc-rota','frete-calc-cbm','frete-calc-peso','frete-calc-cambio','frete-calc-dap','frete-calc-oversize','frete-calc-iof-on'];
  ids.forEach(function(id){
    var el=$(id); if(!el) return;
    if(id==='frete-calc-rota') el.addEventListener('change', onRotaChange);
    else el.addEventListener('input', recomputeAndRender);
  });
}

function init(){
  wireModalInputs();
  loadConfig(function(cfg){
    if(cfg) console.log('[frete-calc] config carregada · '+cfg.frete_rotas_v1.rotas.length+' rotas');
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
