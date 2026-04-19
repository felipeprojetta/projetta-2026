/**
 * 03-history_save.js
 * Module: HISTORY_SAVE
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: HISTORY_SAVE ══ */
/* ══════════════════════════════════════════════════════
   SAVE / HISTORY SYSTEM
   ══════════════════════════════════════════════════════ */
const LS_KEY='projetta_v3';
let currentId=null, currentRev=null, saveMode='new';

function _persistSession(){
  try{
    if(currentId) localStorage.setItem('projetta_session',JSON.stringify({id:currentId,rev:currentRev}));
    else localStorage.removeItem('projetta_session');
  }catch(e){}
}
function _autoRestoreSession(){
  try{
    var s=localStorage.getItem('projetta_session');
    if(!s) return false;
    var sess=JSON.parse(s);
    if(!sess.id) return false;
    var db=loadDB();
    var entry=db.find(function(e){return e.id===sess.id;});
    if(!entry) return false;
    var revIdx=sess.rev||0;
    if(revIdx>=entry.revisions.length) revIdx=entry.revisions.length-1;
    loadRevision(sess.id, revIdx);
    return true;
  }catch(e){ return false; }
}

function loadDB(){ try{return JSON.parse(localStorage.getItem(LS_KEY))||[];}catch{return [];} }
function saveDB(db){ localStorage.setItem(LS_KEY,JSON.stringify(db)); window._cloudPush("projetta_v3",db); }
function _syncOrcFromCloud(){
  window._cloudPull("projetta_v3",function(data){
    if(!data)return;
    var local=loadDB();
    if(!local||!local.length||(Array.isArray(data)&&data.length>local.length)){
      try{localStorage.setItem(LS_KEY,JSON.stringify(data));}catch(e){}
      if(typeof renderHistory==='function')try{renderHistory();}catch(e){}
      console.log('☁️ Orçamentos restaurados da nuvem: '+data.length+' registros');
    }
  });
}

function captureFormData(){
  // capture chapa blocks
  const acmBlocks=[];
  for(let i=1;i<=aC;i++){
    if(!$('acm-blk-'+i)) continue;
    acmBlocks.push({sel:$('acm-sel-'+i).value, qty:$('acm-qty-'+i).value});
  }
  const aluBlocks=[];
  for(let i=1;i<=lC;i++){
    if(!$('alu-blk-'+i)) continue;
    aluBlocks.push({sel:$('alu-sel-'+i).value, qty:$('alu-qty-'+i).value});
  }
  // Peças manuais do planificador
  const manualPcs=[];
  var mpRows=document.getElementById('plan-manual-tbody');
  if(mpRows){for(var i=0;i<mpRows.children.length;i++){
    var rid=mpRows.children[i].id;
    manualPcs.push({n:$(rid+'-n').value,w:$(rid+'-w').value,h:$(rid+'-h').value,q:$(rid+'-q').value});
  }}
  const fields=['cliente','numprojeto','num-agp','num-atp','dataprojeto','responsavel','largura','altura','qtd-portas',
    'folhas-porta','rep-sel','cep-cliente','ac-fechadura','qtd-fechaduras',
    'carac-abertura','carac-folhas','carac-fech-mec','carac-fech-dig','carac-cilindro','carac-puxador','carac-pux-tam','carac-cor-ext','carac-cor-int','carac-modelo','carac-dist-borda-cava','carac-largura-cava','carac-dist-borda-friso','carac-largura-friso','carac-ripado-total','carac-ripado-2lados',
    'plan-modelo','plan-folhas','plan-chapa','plan-layout',
    'plan-disborcava','plan-largcava','plan-disbordafriso','plan-largfriso','plan-friso-h-qty','plan-friso-h-esp','plan-ripa-qty','plan-ripa-larg','plan-ripa-dist','plan-moldura-rev','plan-moldura-larg-qty','plan-moldura-alt-qty','plan-moldura-tipo','plan-moldura-dis1','plan-moldura-dis2','plan-moldura-dis3','plan-moldura-divisao','plan-acm-cor','plan-acm-qty','plan-alu-cor','plan-alu-qty','plan-chapa-alu','plan-refilado','carac-cor-macico',
    'fab-mat-perfis','fab-custo-pintura','fab-custo-acess','h-portal','h-quadro','h-corte','h-colagem','h-conf','custo-hora',
    'dias','pessoas','diaria','km','carros','desl-override','hotel-dia','alim','munk','terceiros','inst-quem','inst-terceiros-valor','inst-terceiros-transp',
    'overhead','impostos','com-rep','com-rt','com-gest','lucro-alvo','desconto','markup-desc'];
  const data={acmBlocks,aluBlocks,manualPcs,_isATP:window._isATP,_osGeradoUmaVez:!!window._osGeradoUmaVez};
  fields.forEach(f=>{const el=$(f);if(el)data[f]=el.value;});
  // Salvar checkbox alisar
  var _alisarEl=document.getElementById('carac-tem-alisar');
  if(_alisarEl) data['carac-tem-alisar']=_alisarEl.checked?'1':'0';
  // Salvar texto do modelo (não só o value)
  var modEl=document.getElementById('carac-modelo');
  if(modEl&&modEl.selectedIndex>=0) data['carac-modelo-txt']=(modEl.options[modEl.selectedIndex]||{text:''}).text;
  // ATP address fields
  ['atp-rua','atp-numero','atp-bairro','atp-complemento','atp-cidade','atp-cep','cli-telefone','cli-email'].forEach(f=>{var el=$(f);if(el)data[f]=el.value;});
  // Capturar fixos
  var temFixoEl=document.getElementById('tem-fixo');
  data['tem-fixo'] = temFixoEl ? temFixoEl.checked : false;
  var fixoIdx=1;
  document.querySelectorAll('.fixo-blk').forEach(function(bl){
    var lf=(bl.querySelector('.fixo-larg')||{value:''}).value;
    var af=(bl.querySelector('.fixo-alt') ||{value:''}).value;
    var ld=(bl.querySelector('.fixo-lados')||{value:''}).value;
    var tp=(bl.querySelector('.fixo-tipo')||{value:'superior'}).value;
    var lado=(bl.querySelector('.fixo-lado')||{value:''}).value;
    var qf=(bl.querySelector('.fixo-qty')||{value:'1'}).value;
    var ef=(bl.querySelector('.fixo-estr')||{value:'nao'}).value;
    data['fixo-larg-'+fixoIdx]=lf;
    data['fixo-alt-'+fixoIdx]=af;
    data['fixo-lados-'+fixoIdx]=ld;
    data['fixo-tipo-'+fixoIdx]=tp;
    data['fixo-lado-'+fixoIdx]=lado;
    data['fixo-qty-'+fixoIdx]=qf;
    data['fixo-estr-'+fixoIdx]=ef;
    fixoIdx++;
  });
  // Salvar itens multi-porta
  if(window._mpItens && window._mpItens.length > 0){
    data['_mpItens']=JSON.stringify(window._mpItens);
  }
  return data;
}


/* ── SNAPSHOT: congela todos os valores calculados ── */
function captureSnapshot(){
  var _t=function(id){var e=document.getElementById(id);return e?e.textContent:'';};
  var cr=window._calcResult||{};
  var snap={
    ts: cr.ts||new Date().toISOString(),
    largura: (document.getElementById('largura')||{}).value||'',
    altura: (document.getElementById('altura')||{}).value||'',
    m2: _t('r-m2')||cr.m2||'',
    qtdPortas: (document.getElementById('qtd-portas')||{}).value||'1',
    custoTotal: _t('m-custo')||cr.custoTotal||'',
    custoM2: _t('m-custo-m2')||cr.custoM2||'',
    custoPorta: _t('m-custo-porta')||cr.custoPorta||'',
    tabTotal: _t('m-tab')||cr.tabTotal||'',
    tabM2: _t('m-tab-m2')||cr.tabM2||'',
    tabPorta: _t('m-tab-porta')||cr.tabPorta||'',
    tabPortaM2: _t('m-tab-porta-m2')||cr.tabPortaM2||'',
    fatTotal: _t('m-fat')||cr.fatTotal||'',
    fatM2: _t('m-fat-m2')||cr.fatM2||'',
    fatPorta: _t('m-fat-porta')||cr.fatPorta||'',
    fatPortaM2: _t('m-fat-porta-m2')||cr.fatPortaM2||'',
    mkp: _t('m-mkp')||cr.mkp||'',
    mkpPorta: _t('m-mkp-porta')||cr.mkpPorta||'',
    mbPorta: _t('pct-mb-porta')||cr.mbPorta||'',
    mlPorta: _t('pct-ml-porta')||cr.mlPorta||'',
    mb: _t('pct-mb')||cr.mb||'',
    ml: _t('pct-ml')||cr.ml||'',
    metaLucro: _t('pct-meta')||cr.metaLucro||'',
    badge: _t('badge-st')||cr.badge||'',
    dreTab: _t('d-tab')||cr.dreTab||'',
    dreDescVal: _t('d-desc-val')||cr.dreDescVal||'',
    dreDescPct: _t('d-desc-pct')||cr.dreDescPct||'',
    dreFat: _t('d-fat')||cr.dreFat||'',
    dreImp: _t('d-imp')||cr.dreImp||'', dreImpPct: _t('d-imp-pct')||cr.dreImpPct||'',
    dreRep: _t('d-rep')||cr.dreRep||'', dreRepPct: _t('d-rep-pct')||cr.dreRepPct||'',
    dreRt: _t('d-rt')||cr.dreRt||'', dreRtPct: _t('d-rt-pct')||cr.dreRtPct||'',
    dreGest: _t('d-gest')||cr.dreGest||'', dreGestPct: _t('d-gest-pct')||cr.dreGestPct||'',
    dreCusto: _t('d-custo')||cr.dreCusto||'',
    dreLb: _t('d-lb')||cr.dreLb||'',
    dreIrpj: _t('d-irpj')||cr.dreIrpj||'',
    dreLl: _t('d-ll')||cr.dreLl||'',
    subFab: _t('r-fab')||cr.subFab||'',
    matPerfis: (document.getElementById('fab-mat-perfis')||{}).value||cr.matPerfis||'',
    custoPintura: (document.getElementById('fab-custo-pintura')||{}).value||cr.custoPintura||'',
    custoAcess: (document.getElementById('fab-custo-acess')||{}).value||cr.custoAcess||'',
    subInst: _t('r-inst')||cr.subInst||'',
    // Horas
    hPortal: (document.getElementById('h-portal')||{}).value||'',
    hQuadro: (document.getElementById('h-quadro')||{}).value||'',
    hCorte: (document.getElementById('h-corte')||{}).value||'',
    hColagem: (document.getElementById('h-colagem')||{}).value||'',
    hConf: (document.getElementById('h-conf')||{}).value||'',
    custoHora: (document.getElementById('custo-hora')||{}).value||'',
    // Comissões
    comRep: (document.getElementById('com-rep')||{}).value||'',
    comRt: (document.getElementById('com-rt')||{}).value||'',
    comGest: (document.getElementById('com-gest')||{}).value||'',
    // Impostos/Overhead
    impostos: (document.getElementById('impostos')||{}).value||'',
    overhead: (document.getElementById('overhead')||{}).value||'',
    lucroAlvo: (document.getElementById('lucro-alvo')||{}).value||'',
    desconto: (document.getElementById('desconto')||{}).value||'',
    // Representante
    repNome: (document.getElementById('rep-sel')||{}).selectedIndex>=0?(document.getElementById('rep-sel').options[document.getElementById('rep-sel').selectedIndex]||{}).text:'',
    // Características
    modelo: (document.getElementById('carac-modelo')||{}).selectedIndex>=0?(document.getElementById('carac-modelo').options[document.getElementById('carac-modelo').selectedIndex]||{}).text:'',
    abertura: (document.getElementById('carac-abertura')||{}).value||'',
    folhas: (document.getElementById('carac-folhas')||{}).value||'',
    corExt: (document.getElementById('carac-cor-ext')||{}).value||'',
    corInt: (document.getElementById('carac-cor-int')||{}).value||'',
    fechMec: (document.getElementById('carac-fech-mec')||{}).value||'',
    fechDig: (document.getElementById('carac-fech-dig')||{}).value||'',
    cilindro: (document.getElementById('carac-cilindro')||{}).value||'',
    puxador: (document.getElementById('carac-puxador')||{}).value||'',
    // Chapas info
    chapaCorLabel: (function(){var s=document.getElementById('plan-acm-cor');return s&&s.selectedIndex>0?s.options[s.selectedIndex].text:'';})(),
    chapaQty: (document.getElementById('plan-acm-qty')||{}).value||'',
    chapaSize: (function(){var s=document.getElementById('plan-chapa');return s?s.value:'';})(),
    aluCorLabel: (function(){var s=document.getElementById('plan-alu-cor');return s&&s.selectedIndex>0?s.options[s.selectedIndex].text:'';})(),
    aluQty: (document.getElementById('plan-alu-qty')||{}).value||'0',
    subAcm: (document.getElementById('sub-acm')||{textContent:'0'}).textContent||'',
    subAlu: (document.getElementById('sub-alu')||{textContent:'0'}).textContent||'',
    subPerf: _t('sub-perf')||'',
    subPerfMat: _t('sub-perf-mat')||'',
    subPerfPin: _t('sub-perf-pin')||'',
    subPerfAcess: _t('sub-perf-acess')||'',
    subMO: _t('sub-mo')||'',
  };
  // Levantamento de material: capturar HTML das tabelas OS
  var osTab=document.getElementById('tab-os');
  if(osTab) snap.levantamentoHTML=osTab.innerHTML;
  // OS Acessórios
  var osAcTab=document.getElementById('tab-os-acess');
  if(osAcTab) snap.osAcessHTML=osAcTab.innerHTML;
  // Planificador
  var planTab=document.getElementById('tab-planificador');
  if(planTab){
    var planTables=planTab.querySelectorAll('table');
    var planHTML='';planTables.forEach(function(t){planHTML+=t.outerHTML;});
    if(planHTML) snap.planificadorHTML=planHTML;
  }
  return snap;
}

function restoreFormData(data){
  // clear blocks
  document.getElementById('acm-list').innerHTML='';
  document.getElementById('alu-list').innerHTML='';
  aC=0; lC=0;

  const fields=['cliente','numprojeto','num-agp','num-atp','dataprojeto','responsavel','largura','altura','qtd-portas',
    'folhas-porta','rep-sel','cep-cliente','ac-fechadura','qtd-fechaduras',
    'carac-abertura','carac-folhas','carac-fech-mec','carac-fech-dig','carac-cilindro','carac-puxador','carac-pux-tam','carac-cor-ext','carac-cor-int','carac-modelo','carac-dist-borda-cava','carac-largura-cava','carac-dist-borda-friso','carac-largura-friso','carac-ripado-total','carac-ripado-2lados',
    'plan-modelo','plan-folhas','plan-chapa','plan-layout',
    'plan-disborcava','plan-largcava','plan-disbordafriso','plan-largfriso','plan-friso-h-qty','plan-friso-h-esp','plan-ripa-qty','plan-ripa-larg','plan-ripa-dist','plan-moldura-rev','plan-moldura-larg-qty','plan-moldura-alt-qty','plan-moldura-tipo','plan-moldura-dis1','plan-moldura-dis2','plan-moldura-dis3','plan-moldura-divisao','plan-acm-cor','plan-acm-qty','plan-alu-cor','plan-alu-qty','plan-chapa-alu','plan-refilado','carac-cor-macico',
    'fab-mat-perfis','fab-custo-pintura','fab-custo-acess','h-portal','h-quadro','h-corte','h-colagem','h-conf','custo-hora',
    'dias','pessoas','diaria','km','carros','desl-override','hotel-dia','alim','munk','terceiros','inst-quem','inst-terceiros-valor','inst-terceiros-transp',
    'overhead','impostos','com-rep','com-rt','com-gest','lucro-alvo','desconto'];
  fields.forEach(f=>{const el=$(f);if(el&&data[f]!==undefined&&data[f]!=='')el.value=data[f];});

  // Restaurar visibilidade puxador externo e modelo preview
  togglePuxadorTam();
  toggleInstQuem();
  if(!window._suppressAutoSelect) onModeloChange();
  // Restaurar alisar
  var _rAlEl=document.getElementById('carac-tem-alisar');
  if(_rAlEl&&data['carac-tem-alisar']!==undefined) _rAlEl.checked=(data['carac-tem-alisar']==='1');

  (data.acmBlocks||[]).forEach(b=>addACM(b.sel,b.qty));
  (data.aluBlocks||[]).forEach(b=>addALU(b.sel,b.qty));
  if(!data.acmBlocks||!data.acmBlocks.length) addACM();
  if(!data.aluBlocks||!data.aluBlocks.length) addALU();

  // Re-aplicar campos do planificador DEPOIS de addACM/addALU (que repopulam opções)
  if(window._suppressAutoSelect){
    // Forçar filtro de opções pelo tamanho de chapa salvo
    if(typeof filtrarChapasACM==='function') try{filtrarChapasACM();}catch(e){}
    // Re-setar valores que foram perdidos pelo repopulate
    ['plan-acm-cor','plan-acm-qty','plan-alu-cor','plan-alu-qty','plan-chapa-alu'].forEach(function(fid){
      var el=document.getElementById(fid);
      if(el&&data[fid]!==undefined&&data[fid]!=='') el.value=data[fid];
    });
  }

  // Restaurar peças manuais
  if(data.manualPcs&&data.manualPcs.length){
    document.getElementById('plan-manual-tbody').innerHTML='';
    data.manualPcs.forEach(function(pc){
      addManualPiece();
      var rows=document.getElementById('plan-manual-tbody').children;
      var rid=rows[rows.length-1].id;
      if(pc.n) $(rid+'-n').value=pc.n;
      if(pc.w) $(rid+'-w').value=pc.w;
      if(pc.h) $(rid+'-h').value=pc.h;
      if(pc.q) $(rid+'-q').value=pc.q;
    });
  }

  // Disparar eventos dependentes (NÃO quando restaurando snapshot válido)
  if(!window._suppressAutoSelect){
    if(typeof onRepChange==='function') try{onRepChange();}catch(e){}
    if(typeof onModeloChange==='function') try{onModeloChange();}catch(e){}
    if(typeof syncFolhas==='function'&&data['folhas-porta']) try{syncFolhas(data['folhas-porta']);}catch(e){}
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
  }
  // Restaurar ATP status
  if(data._isATP){
    window._isATP = true;
    var badge=$('status-badge');if(badge){badge.textContent='PEDIDO FECHADO';badge.style.background='#1a5276';}
    var atpRow=$('atp-field-row');if(atpRow)atpRow.style.display='';var atpCont=$('atp-contato-row');if(atpCont)atpCont.style.display='';
    var end=$('atp-endereco');if(end)end.style.display='';
    var btn=$('btn-gerar-atp');if(btn){btn.textContent='✓ ATP GERADA';btn.style.background='#27ae60';btn.style.borderColor='#27ae60';}
    ['atp-rua','atp-numero','atp-bairro','atp-complemento','atp-cidade','atp-cep','cli-telefone','cli-email'].forEach(function(f){var el=$(f);if(el&&data[f])el.value=data[f];});
  } else {
    window._isATP = false;
    var badge=$('status-badge');if(badge){badge.textContent='ORÇAMENTO';badge.style.background='#e67e22';}
    var atpRow=$('atp-field-row');if(atpRow)atpRow.style.display='none';var atpCont=$('atp-contato-row');if(atpCont)atpCont.style.display='none';
    var end=$('atp-endereco');if(end)end.style.display='none';
    var btn=$('btn-gerar-atp');if(btn){btn.textContent='📋 Gerar ATP';btn.style.background='#1a5276';btn.style.borderColor='#1a5276';}
    ['atp-rua','atp-numero','atp-bairro','atp-complemento','atp-cidade','atp-cep'].forEach(function(f){var el=$(f);if(el)el.value='';});
  }
  // Restaurar flag OS gerada (sem isso, calc() zera tudo)
  // Para orçamentos antigos sem o flag, detectar se tinha horas salvas
  if(data._osGeradoUmaVez !== undefined){
    window._osGeradoUmaVez = !!data._osGeradoUmaVez;
  } else {
    window._osGeradoUmaVez = !!(parseFloat(data['h-portal'])||parseFloat(data['h-quadro'])||parseFloat(data['h-corte'])||parseFloat(data['h-colagem'])||parseFloat(data['h-conf'])||parseFloat(data['custo-hora']));
  }
  // Restaurar fixos
  var _fixoList=document.getElementById('fixos-list');
  if(_fixoList) _fixoList.innerHTML='';
  fixoCount=0;
  if(data['tem-fixo']==='true'||data['tem-fixo']===true){
    var tfCk=document.getElementById('tem-fixo');
    if(tfCk){tfCk.checked=true;if(typeof toggleFixos==='function')toggleFixos();}
    var _fxi=1;
    while(data['fixo-larg-'+_fxi]||data['fixo-alt-'+_fxi]){
      addFixo();
      var _lastBlk=document.querySelectorAll('.fixo-blk');
      var _lb=_lastBlk[_lastBlk.length-1];
      if(_lb){
        var _fl=_lb.querySelector('.fixo-larg');if(_fl)_fl.value=data['fixo-larg-'+_fxi]||'';
        var _fa=_lb.querySelector('.fixo-alt');if(_fa)_fa.value=data['fixo-alt-'+_fxi]||'';
        var _fld=_lb.querySelector('.fixo-lados');if(_fld)_fld.value=data['fixo-lados-'+_fxi]||'1';
        var _ft=_lb.querySelector('.fixo-tipo');if(_ft){_ft.value=data['fixo-tipo-'+_fxi]||'superior';toggleFixoTipo(_ft);}
        var _fla=_lb.querySelector('.fixo-lado');if(_fla)_fla.value=data['fixo-lado-'+_fxi]||'esquerdo';
        var _fq=_lb.querySelector('.fixo-qty');if(_fq)_fq.value=data['fixo-qty-'+_fxi]||'1';
        var _fe=_lb.querySelector('.fixo-estr');if(_fe)_fe.value=data['fixo-estr-'+_fxi]||'nao';
      }
      _fxi++;
    }
  }
  // Restaurar itens multi-porta
  if(data['_mpItens']){
    try{ window._mpItens=JSON.parse(data['_mpItens']); }catch(e){ window._mpItens=[]; }
    if(typeof _mpRender==='function') _mpRender();
  } else {
    window._mpItens=[];
    if(typeof _mpRender==='function') _mpRender();
  }
  calc();
}

function now(){ return new Date().toLocaleString('pt-BR'); }

/* save new orçamento */
function saveNew(name){
  _setOrcLock(false);
  window._orcLocked=false;
  const db=loadDB();
  const id='orc_'+Date.now();
  const data=captureFormData();
  const entry={
    id, name,
    client: data['cliente']||'',
    project: data['numprojeto']||'',
    createdAt: now(),
    revisions:[{rev:0, label:'Original', savedAt:now(), data, snapshot:captureSnapshot()}]
  };
  db.unshift(entry);
  saveDB(db);
  currentId=id; currentRev=0;
  _persistSession();
  updateBanner(name,'Original');
  renderHistory();
}

/* save revision on existing */
function saveRevision(name){
  const db=loadDB();
  const idx=db.findIndex(e=>e.id===currentId);
  if(idx<0){saveNew(name);return;}
  const data=captureFormData();
  const revNum=db[idx].revisions.length;
  db[idx].revisions.push({rev:revNum, label:name||('Revisão '+revNum), savedAt:now(), data, snapshot:captureSnapshot()});
  db[idx].client=data['cliente']||db[idx].client;
  db[idx].project=data['numprojeto']||db[idx].project;
  saveDB(db);
  currentRev=revNum;
  updateBanner(db[idx].name, name||('Revisão '+revNum));
  renderHistory();
}

function updateBanner(name, revLabel){
  const b=$('cur-banner'); b.classList.add('show');
  $('cur-name').textContent=name;
  $('cur-orig-badge').textContent=revLabel==='Original'?'Original':'';
  const rb=$('cur-rev-badge');
  if(revLabel!=='Original'){rb.style.display='';rb.textContent=revLabel;}
  else rb.style.display='none';
  $('hist-count').textContent=loadDB().length;
  // Recalcular tudo após restaurar campos (inclui instalação)
  setTimeout(function(){
    if(typeof calc==='function') calc();
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
    if(typeof _osAutoUpdate==='function') try{_osAutoUpdate();}catch(e){}
  }, 100);
}

/* ══════════════════════════════════════════════════════════
   MÓDULO: CARREGAR REVISÃO / MEMORIAL / CONGELAMENTO
   ══════════════════════════════════════════════════════════ */

/* IDs de todos os elementos de display que precisam ser gerenciados */
var _DISPLAY_IDS={
  resultado:['m-custo','m-custo-m2','m-custo-porta','m-custo-porta-m2','m-tab','m-tab-m2','m-tab-porta','m-tab-porta-m2','m-fat','m-fat-m2','m-fat-porta','m-fat-porta-m2','m-mkp','m-mkp-porta'],
  margens:['pct-mb-porta','pct-ml-porta','pct-mb','pct-ml','pct-meta','badge-st'],
  dre:['d-tab','d-tab-porta','d-desc-val','d-desc-pct','d-fat','d-fat-porta','d-imp','d-imp-pct','d-rep','d-rep-pct','d-rt','d-rt-pct','d-gest','d-gest-pct','d-custo','d-custo-porta','d-lb','d-irpj','d-ll'],
  subtotais:['r-m2','r-fab','r-inst'],
  detalhamento:['d-custo-fab','d-custo-inst','d-tab-sp','d-fat-sp','d-tab-inst','d-fat-inst'],
  porm2:['s-cm2','s-tm2','s-fm2','s-tm2p','s-fm2p','s-desc']
};

/* Limpar TODOS os elementos de display para evitar resíduos */
function _clearResultDisplay(){
  var resetDash=['badge-st','m-mkp','m-mkp-porta','m-custo-m2','m-custo-porta-m2','m-tab-m2','m-tab-porta-m2','m-fat-m2','m-fat-porta-m2','r-m2',
    'd-custo-fab','d-custo-inst','d-tab-sp','d-fat-sp','d-tab-inst','d-fat-inst',
    's-cm2','s-tm2','s-fm2','s-tm2p','s-fm2p','s-desc',
    'd-desc-pct','d-imp-pct','d-rep-pct','d-rt-pct','d-gest-pct','pct-meta'];
  var all=[].concat(_DISPLAY_IDS.resultado,_DISPLAY_IDS.margens,_DISPLAY_IDS.dre,_DISPLAY_IDS.subtotais,_DISPLAY_IDS.detalhamento,_DISPLAY_IDS.porm2);
  all.forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.textContent=resetDash.indexOf(id)>=0?'—':'R$ 0';
  });
  // Zerar barras de margem
  ['bar-mb-porta','bar-ml-porta','bar-mb','bar-ml','bar-meta'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.width='0%';
  });
}

/* Verificar se snapshot tem valores reais (não só zeros) */
function _isSnapshotValid(snap){
  if(!snap) return false;
  var c=(snap.custoTotal||'').replace(/[^\d,\.]/g,'').replace(',','.');
  var f=(snap.fatTotal||'').replace(/[^\d,\.]/g,'').replace(',','.');
  var t=(snap.tabTotal||'').replace(/[^\d,\.]/g,'').replace(',','.');
  return (parseFloat(c)>0)||(parseFloat(f)>0)||(parseFloat(t)>0);
}

/* Esconder memorial panel */
function _hideMemorial(){
  var p=document.getElementById('memorial-panel');
  if(p) p.style.display='none';
}

/* Timer central — cancela pendentes ao recarregar */
var _revTimers=[];
function _revClearTimers(){
  _revTimers.forEach(function(t){clearTimeout(t);});
  _revTimers=[];
}
function _revDelay(fn,ms){
  var t=setTimeout(fn,ms);
  _revTimers.push(t);
  return t;
}

/* ── CARREGAR REVISÃO ── */
window.loadRevision=function(id,revIdx){
  var db=loadDB();
  var entry=db.find(function(e){return e.id===id;});
  if(!entry) return;
  var rev=entry.revisions[revIdx];
  if(!rev) return;
  
  // 1. Cancelar operações anteriores
  _revClearTimers();
  
  // 2. Destravar formulário completamente
  window._snapshotLock=false;
  window._orcLocked=false;
  _setOrcLock(false);
  _hideMemorial();
  
  // 3. Registrar sessão
  currentId=id; currentRev=revIdx;
  window._pendingRevision=false;
  _persistSession();
  
  // 4. Limpar displays antigos (evita resíduos de outro orçamento)
  _clearResultDisplay();
  
  // 5. Avaliar snapshot ANTES de restaurar form (precisa do flag _suppressAutoSelect)
  var snapValid=_isSnapshotValid(rev.snapshot);
  var shouldLock=snapValid||!!rev.crmPronto;
  
  // 6. Restaurar dados do formulário
  if(rev.data){
    // Flag para evitar auto-seleção durante restore quando snapshot válido
    if(snapValid) window._suppressAutoSelect=true;
    restoreFormData(rev.data);
    window._suppressAutoSelect=false;
  }
  updateBanner(entry.name, rev.label);
  
  // 7. Se snapshot válido: restaurar display e memorial
  if(snapValid){
    _restoreSnapshotDisplay(rev.snapshot);
    showMemorial(rev.snapshot, entry.name, rev.label);
    if(!window._forceUnlockAfterLoad) window._snapshotLock=true;
  }
  
  // 8. Reset UI
  var ibar=document.getElementById('orc-itens-bar');
  if(ibar) ibar.classList.remove('show');
  window._orcItens=[];window._orcItemAtual=-1;
  var gcw=document.getElementById('gerar-custo-wrap');if(gcw)gcw.style.display='';
  var iqw=document.getElementById('inst-quem-wrap');if(iqw)iqw.style.display='';
  
  // 9. Layout + recalc (único timeout)
  _revDelay(function(){
    if(typeof toggleInstQuem==='function') try{toggleInstQuem();}catch(e){}
    // Se snapshot válido: NÃO recalcular — preservar valores salvos
    if(snapValid && !window._forceUnlockAfterLoad){
      // onModeloChange NÃO roda (dispara _autoSelectAndRun → sobrescreve cor/chapa)
      // Apenas restaurar comissão e horas do snapshot
      if(rev.snapshot){
        var s=rev.snapshot;
        if(s.comRep){var cr=document.getElementById('com-rep');if(cr)cr.value=s.comRep;}
        if(s.comRt){var crt=document.getElementById('com-rt');if(crt)crt.value=s.comRt;}
        if(s.comGest){var cg=document.getElementById('com-gest');if(cg)cg.value=s.comGest;}
        if(s.hPortal){var hp=document.getElementById('h-portal');if(hp)hp.value=s.hPortal;}
        if(s.hQuadro){var hq=document.getElementById('h-quadro');if(hq)hq.value=s.hQuadro;}
        if(s.hCorte){var hc=document.getElementById('h-corte');if(hc)hc.value=s.hCorte;}
        if(s.hColagem){var hcol=document.getElementById('h-colagem');if(hcol)hcol.value=s.hColagem;}
        if(s.hConf){var hcnf=document.getElementById('h-conf');if(hcnf)hcnf.value=s.hConf;}
        if(s.desconto){var dsc=document.getElementById('desconto');if(dsc)dsc.value=s.desconto;}
        if(s.impostos){var imp=document.getElementById('impostos');if(imp)imp.value=s.impostos;}
        if(s.custoHora){var ch=document.getElementById('custo-hora');if(ch)ch.value=s.custoHora;}
        if(s.overhead){var oh=document.getElementById('overhead');if(oh)oh.value=s.overhead;}
        if(s.lucroAlvo){var la=document.getElementById('lucro-alvo');if(la)la.value=s.lucroAlvo;}
        /* ╔══════════════════════════════════════════════════════════════╗
           ║  CONGELAMENTO: restaurar HTML das abas OS do snapshot.      ║
           ║  Isso garante que perfis, acessórios e chapas mostrem      ║
           ║  os valores da ÉPOCA do orçamento, não os preços atuais.   ║
           ╚══════════════════════════════════════════════════════════════╝ */
        if(s.levantamentoHTML){var _osT=document.getElementById('tab-os');if(_osT)_osT.innerHTML=s.levantamentoHTML;}
        if(s.osAcessHTML){var _osA=document.getElementById('tab-os-acess');if(_osA)_osA.innerHTML=s.osAcessHTML;}
        // Restaurar valores de fabricação do snapshot
        if(s.matPerfis){var mp=document.getElementById('fab-mat-perfis');if(mp)mp.value=s.matPerfis;}
        if(s.custoPintura){var cp=document.getElementById('fab-custo-pintura');if(cp)cp.value=s.custoPintura;}
        if(s.custoAcess){var ca=document.getElementById('fab-custo-acess');if(ca)ca.value=s.custoAcess;}
      }
    } else {
      // Sem snapshot ou forceUnlock: recalcular tudo
      if(typeof onModeloChange==='function') try{onModeloChange();}catch(e){}
      if(typeof planUpd==='function') try{planUpd();}catch(e){}
      if(!snapValid){
        window._snapshotLock=false;
        if(typeof gerarCustoTotal==='function') try{gerarCustoTotal();}catch(e){}
      }
    }
    // Travar se necessário (MAS NÃO se forceUnlock está ativo)
    if(shouldLock && !window._forceUnlockAfterLoad){
      _setOrcLock(true);
      var lb=document.getElementById('orc-lock-banner');
      if(lb){
        lb.innerHTML=rev.crmPronto
          ?'🔒 Orçamento travado — PDF salvo no card. Para alterar, clique em <b>Nova Revisão</b>.'
          :'🔒 CONGELADO — valores de '+(rev.snapshot&&rev.snapshot.ts?new Date(rev.snapshot.ts).toLocaleString("pt-BR"):rev.savedAt||'')+'. Para editar, clique em <b>Nova Revisão</b>.';
      }
    }
  }, 400);
  
  toggleHist();
};

/* ── ABRIR MEMORIAL DE CÁLCULO (botão dedicado na aba Clientes) ── */
window.loadRevisionMemorial=function(id,revIdx){
  // ═══════════════════════════════════════════════════════════════════
  // MEMORIAL = 100% READ-ONLY
  //   - NÃO chama loadRevision (que chamava restoreFormData e sobrescrevia form)
  //   - NÃO chama switchTab (fica onde o usuário está)
  //   - NÃO chama gerarCustoTotal (não recalcula nada)
  //   - NÃO toca em NENHUM campo do form global
  //   - NÃO seta flags de lock/snapshot
  //   - APENAS lê o snapshot do DB e mostra o painel lateral direito
  // ═══════════════════════════════════════════════════════════════════
  var db=loadDB();
  var entry=db.find(function(e){return e.id===id;});
  if(!entry){ alert('Orçamento não encontrado.'); return; }
  var ri=Math.min(revIdx||0, entry.revisions.length-1);
  var rev=entry.revisions[ri];
  if(!rev){ alert('Revisão não encontrada.'); return; }

  var snapValid=_isSnapshotValid(rev.snapshot);
  if(!snapValid){
    alert('Memorial não disponível — snapshot vazio ou inválido.\n\nClique em "Nova Revisão" no card para recalcular e gerar um memorial completo.');
    return;
  }

  // Mostrar painel lateral — showMemorial é auto-suficiente, só usa o snapshot
  var name = entry.client || entry.name || '';
  var label = rev.label || ('Rev '+(ri+1));
  showMemorial(rev.snapshot, name, label);

  // Forçar exibição do panel (caso tenha sido escondido)
  var panel=document.getElementById('memorial-panel');
  if(panel) panel.style.display='';
};

/* ── Abrir seções colapsáveis e scroll até DRE ── */
function _openSectionsAndScroll(){
  ['param','fab','inst','carac'].forEach(function(sec){
    var b=document.getElementById(sec+'-body');
    var bg=document.getElementById(sec+'-badge');
    if(b) b.style.display='block';
    if(bg) bg.innerHTML='&#9650; fechar';
  });
  var dreEl=document.querySelector('.dre');
  if(dreEl) dreEl.scrollIntoView({behavior:'smooth',block:'center'});
}

/* ── Restaurar display do snapshot (SEMPRE sobrescreve, nunca deixa resíduo) ── */
function _restoreSnapshotDisplay(snap){
  if(!snap) return;
  var _s=function(id,val){var el=document.getElementById(id);if(el) el.textContent=val||'R$ 0';};
  var _b=function(id,val){var el=document.getElementById(id);if(el) el.textContent=val||'—';};
  // Custos
  _s('m-custo',snap.custoTotal); _s('m-custo-m2',snap.custoM2); _s('m-custo-porta',snap.custoPorta);
  // Tabela
  _s('m-tab',snap.tabTotal); _s('m-tab-m2',snap.tabM2); _s('m-tab-porta',snap.tabPorta); _s('m-tab-porta-m2',snap.tabPortaM2);
  // Faturamento
  _s('m-fat',snap.fatTotal); _s('m-fat-m2',snap.fatM2); _s('m-fat-porta',snap.fatPorta); _s('m-fat-porta-m2',snap.fatPortaM2);
  // Markup
  _b('m-mkp',snap.mkp); _b('m-mkp-porta',snap.mkpPorta);
  // Margens
  _b('pct-mb-porta',snap.mbPorta); _b('pct-ml-porta',snap.mlPorta);
  _b('pct-mb',snap.mb); _b('pct-ml',snap.ml); _b('pct-meta',snap.metaLucro);
  _b('badge-st',snap.badge);
  // DRE
  _s('d-tab',snap.dreTab); _s('d-desc-val',snap.dreDescVal); _b('d-desc-pct',snap.dreDescPct);
  _s('d-fat',snap.dreFat);
  _s('d-imp',snap.dreImp); _b('d-imp-pct',snap.dreImpPct);
  _s('d-rep',snap.dreRep); _b('d-rep-pct',snap.dreRepPct);
  _s('d-rt',snap.dreRt); _b('d-rt-pct',snap.dreRtPct);
  _s('d-gest',snap.dreGest); _b('d-gest-pct',snap.dreGestPct);
  _s('d-custo',snap.dreCusto); _s('d-lb',snap.dreLb);
  _s('d-irpj',snap.dreIrpj); _s('d-ll',snap.dreLl);
  // M² e Sub-totais
  _b('r-m2',snap.m2); _s('r-fab',snap.subFab); _s('r-inst',snap.subInst);
  // Sub-totais fabricação
  if(snap.subAcm) _s('sub-acm',snap.subAcm);
  if(snap.subAlu) _s('sub-alu',snap.subAlu);
  if(snap.subPerf) _s('sub-perf',snap.subPerf);
  if(snap.subPerfMat) _s('sub-perf-mat',snap.subPerfMat);
  if(snap.subPerfPin) _s('sub-perf-pin',snap.subPerfPin);
  if(snap.subPerfAcess) _s('sub-perf-acess',snap.subPerfAcess);
  if(snap.subMO) _s('sub-mo',snap.subMO);
  // Resumo da Obra — Chapas (restaurar cor e qty do snapshot)
  if(snap.chapaCorLabel){
    var roQ=document.getElementById('ro-chapas-qty');
    var roI=document.getElementById('ro-chapas-info');
    var roV=document.getElementById('ro-chapas-val');
    var _nAcm=parseInt(snap.chapaQty)||0;
    var _nAlu=parseInt(snap.aluQty)||0;
    if(roQ) roQ.textContent=_nAlu>0?(_nAcm+' ACM + '+_nAlu+' ALU'):(_nAcm+' chapa(s)');
    if(roI) roI.textContent=snap.chapaCorLabel.split('·')[0].trim();
    if(roV) roV.textContent=snap.subAcm||'';
  }
}


/* ── Lock/Unlock orçamento ── */
function _setOrcLock(locked){
  window._orcLocked=!!locked;
  // Todos os inputs/selects da aba Orçamento
  var orcTab=document.getElementById('tab-orcamento');
  if(!orcTab) return;
  var inputs=orcTab.querySelectorAll('input,select,textarea');
  inputs.forEach(function(el){
    if(locked){
      el.dataset.wasDisabled=el.disabled?'1':'';
      el.disabled=true;
      el.style.opacity='0.7';
      el.style.pointerEvents='none';
    } else {
      if(el.dataset.wasDisabled!=='1') el.disabled=false;
      el.style.opacity='';
      el.style.pointerEvents='';
    }
  });
  // Botões que devem ser desabilitados quando travado
  ['btn-gerar-atp'].forEach(function(id){
    var b=document.getElementById(id);if(b){b.disabled=locked;b.style.opacity=locked?'0.5':'';}
  });
  // Banner de trava visual
  var lockBanner=document.getElementById('orc-lock-banner');
  if(!lockBanner){
    lockBanner=document.createElement('div');lockBanner.id='orc-lock-banner';
    lockBanner.style.cssText='display:none;background:linear-gradient(135deg,#1a5276,#003144);color:#fff;padding:10px 16px;border-radius:8px;margin:8px 0;text-align:center;font-size:12px;font-weight:700;font-family:inherit';
    lockBanner.innerHTML='🔒 Orçamento travado — PDF salvo no card. Para alterar, clique em <b>Nova Revisão</b>.';
    var curBanner=document.getElementById('cur-banner');
    if(curBanner) curBanner.parentNode.insertBefore(lockBanner,curBanner.nextSibling);
  }
  lockBanner.style.display=locked?'block':'none';
}

/* ── Memorial de Cálculo ── */
function showMemorial(snap, orcName, revLabel){
  var mem=document.getElementById('memorial-panel');
  if(!mem){
    mem=document.createElement('div');mem.id='memorial-panel';
    mem.style.cssText='position:fixed;top:0;right:0;width:420px;height:100vh;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,0.15);z-index:9998;overflow-y:auto;font-family:inherit;display:none;transition:transform 0.3s';
    document.body.appendChild(mem);
  }
  var _brl=function(v){return v||'R$ 0';};
  var html='<div style="padding:16px;border-bottom:2px solid #e67e22;background:linear-gradient(135deg,#fef9f0,#fff)">';
  html+='<div style="display:flex;justify-content:space-between;align-items:center"><div>';
  html+='<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#e67e22;font-weight:700">Memorial de Cálculo</div>';
  html+='<div style="font-size:16px;font-weight:700;color:#1a3c5e">'+orcName+'</div>';
  html+='<div style="font-size:11px;color:#888">'+revLabel+' — Salvo em '+(snap.ts?new Date(snap.ts).toLocaleString("pt-BR"):"")+'</div>';
  html+='</div><button onclick="document.getElementById(\'memorial-panel\').style.display=\'none\'" style="border:none;background:none;font-size:20px;cursor:pointer;color:#999">✕</button></div></div>';
  // Especificação
  html+='<div style="padding:14px 16px;border-bottom:1px solid #eee">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">📐 Especificação</div>';
  html+='<table style="width:100%;font-size:12px;border-collapse:collapse">';
  var _r=function(l,v){return '<tr><td style="padding:3px 0;color:#888;width:45%">'+l+'</td><td style="padding:3px 0;font-weight:600">'+v+'</td></tr>';};
  html+=_r('Dimensões',snap.largura+'×'+snap.altura+' mm');
  html+=_r('Área',snap.m2);
  html+=_r('Quantidade',snap.qtdPortas+' porta(s)');
  html+=_r('Modelo',snap.modelo);
  html+=_r('Abertura',snap.abertura);
  html+=_r('Folhas',snap.folhas);
  html+=_r('Cor externa',snap.corExt);
  html+=_r('Cor interna',snap.corInt);
  html+=_r('Fechadura mec.',snap.fechMec);
  html+=_r('Fechadura dig.',snap.fechDig);
  html+=_r('Cilindro',snap.cilindro);
  html+=_r('Puxador',snap.puxador);
  html+=_r('Representante',snap.repNome);
  html+='</table></div>';
  // Custos congelados
  html+='<div style="padding:14px 16px;border-bottom:1px solid #eee">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">💰 Custos Congelados</div>';
  html+='<table style="width:100%;font-size:12px;border-collapse:collapse">';
  html+=_r('Material perfis','R$ '+snap.matPerfis);
  html+=_r('Pintura','R$ '+snap.custoPintura);
  html+=_r('Acessórios','R$ '+snap.custoAcess);
  html+=_r('Sub Fabricação',snap.subFab);
  html+=_r('Sub Instalação',snap.subInst);
  html+=_r('Custo hora','R$ '+snap.custoHora+'/h');
  html+='<tr><td colspan="2" style="padding:6px 0;border-top:2px solid #1a3c5e"></td></tr>';
  html+=_r('<b>CUSTO TOTAL</b>','<span style="font-size:14px;color:#c0392b">'+snap.custoTotal+'</span>');
  html+='</table></div>';
  // Preços
  html+='<div style="padding:14px 16px;border-bottom:1px solid #eee">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">🏷️ Preços Congelados</div>';
  html+='<table style="width:100%;font-size:12px;border-collapse:collapse">';
  html+=_r('Preço Tabela',snap.tabTotal);
  html+=_r('Desconto',snap.dreDescVal+' ('+snap.dreDescPct+')');
  html+=_r('<b>FATURAMENTO</b>','<span style="font-size:14px;color:#27ae60">'+snap.fatTotal+'</span>');
  html+=_r('Tabela/m²',snap.tabM2);
  html+=_r('Fat/m²',snap.fatM2);
  html+=_r('Markup',snap.mkp);
  html+='</table></div>';
  // DRE
  html+='<div style="padding:14px 16px;border-bottom:1px solid #eee">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">📊 DRE Congelada</div>';
  html+='<table style="width:100%;font-size:12px;border-collapse:collapse">';
  html+=_r('Impostos',snap.dreImp+' ('+snap.dreImpPct+'%)');
  html+=_r('Comissão rep.',snap.dreRep+' ('+snap.dreRepPct+'%)');
  html+=_r('Comissão RT',snap.dreRt+' ('+snap.dreRtPct+'%)');
  html+=_r('Comissão gestão',snap.dreGest+' ('+snap.dreGestPct+'%)');
  html+=_r('Custo',snap.dreCusto);
  html+=_r('Lucro bruto','<b>'+snap.dreLb+'</b>');
  html+=_r('IRPJ/CSLL',snap.dreIrpj);
  html+=_r('Lucro líquido','<b style="color:#27ae60">'+snap.dreLl+'</b>');
  html+='<tr><td colspan="2" style="padding:6px 0;border-top:1px solid #ddd"></td></tr>';
  html+=_r('Margem bruta',snap.mb+'%');
  html+=_r('Margem líquida',snap.ml+'%');
  html+=_r('Meta lucro',snap.metaLucro+'%');
  html+=_r('Status',snap.badge);
  html+='</table></div>';
  // Horas fabricação
  html+='<div style="padding:14px 16px;border-bottom:1px solid #eee">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">🔧 Horas de Fabricação</div>';
  html+='<table style="width:100%;font-size:12px;border-collapse:collapse">';
  html+=_r('Portal',snap.hPortal+'h');
  html+=_r('Quadro',snap.hQuadro+'h');
  html+=_r('Corte',snap.hCorte+'h');
  html+=_r('Colagem',snap.hColagem+'h');
  html+=_r('Conferência',snap.hConf+'h');
  html+='</table></div>';
  // Parâmetros
  html+='<div style="padding:14px 16px;border-bottom:1px solid #eee">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px">⚙️ Parâmetros Utilizados</div>';
  html+='<table style="width:100%;font-size:12px;border-collapse:collapse">';
  html+=_r('Impostos',snap.impostos+'%');
  html+=_r('Overhead',snap.overhead+'%');
  html+=_r('Comissão rep.',snap.comRep+'%');
  html+=_r('Comissão RT',snap.comRt+'%');
  html+=_r('Comissão gestão',snap.comGest+'%');
  html+=_r('Lucro alvo',snap.lucroAlvo+'%');
  html+=_r('Desconto',snap.desconto+'%');
  html+='</table></div>';
  html+='<div style="padding:20px 16px;text-align:center;color:#999;font-size:10px">🔒 Valores congelados no momento do salvamento.<br>Para alterar, crie uma nova revisão.</div>';
  // Levantamento de material (se capturado)
  if(snap.levantamentoHTML){
    html+='<div style="padding:14px 16px;border-top:2px solid #e67e22">';
    html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px;cursor:pointer" onclick="var c=this.nextElementSibling;c.style.display=c.style.display===\'none\'?\'block\':\'none\'">📋 Levantamento de Material (clique para expandir)</div>';
    html+='<div style="display:none;max-height:400px;overflow-y:auto;font-size:10px;border:1px solid #eee;border-radius:6px;padding:8px;background:#fafafa">'+snap.levantamentoHTML+'</div>';
    html+='</div>';
  }
  if(snap.osAcessHTML){
    html+='<div style="padding:14px 16px">';
    html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a3c5e;margin-bottom:8px;cursor:pointer" onclick="var c=this.nextElementSibling;c.style.display=c.style.display===\'none\'?\'block\':\'none\'">🔩 Acessórios (clique para expandir)</div>';
    html+='<div style="display:none;max-height:400px;overflow-y:auto;font-size:10px;border:1px solid #eee;border-radius:6px;padding:8px;background:#fafafa">'+snap.osAcessHTML+'</div>';
    html+='</div>';
  }
  mem.innerHTML=html;
  mem.style.display='block';
}


window.deleteOrc=function(id){
  if(!confirm('Excluir este orçamento e todas as suas revisões?')) return;
  try{
    var db=loadDB().filter(function(e){return e.id!==id;});
    saveDB(db);
    if(currentId===id){currentId=null;currentRev=null;_persistSession();$('cur-banner').classList.remove('show');}
    // Limpar vínculo CRM se era este orçamento
    if(window._crmOrcCardId){
      var crmBtn=document.getElementById('crm-orc-pronto-btn');if(crmBtn)crmBtn.style.display='none';
      window._crmOrcCardId=null;
    }
    renderHistory();
  }catch(e){console.error('Erro ao excluir:',e);alert('Erro ao excluir.');}
};

window.deleteRev=function(id,revIdx){
  try{
    var db=loadDB();
    var idx=db.findIndex(function(e){return e.id===id;});
    if(idx<0) return;
    if(db[idx].revisions.length<=1){alert('Não é possível excluir o único registro.');return;}
    if(!confirm('Excluir esta revisão?')) return;
    db[idx].revisions.splice(revIdx,1);
    db[idx].revisions.forEach(function(r,i){r.rev=i;});
    saveDB(db);
    if(currentId===id&&currentRev>=db[idx].revisions.length){currentRev=db[idx].revisions.length-1;_persistSession();}
    renderHistory();
  }catch(e){console.error('Erro ao excluir revisão:',e);alert('Erro ao excluir revisão.');}
};

/* render history panel */
function renderHistory(){
  try{
    var db=loadDB();
    var countEl=$('hist-count');if(countEl)countEl.textContent=db.length;
    var body=$('hist-body');if(!body)return;
    var searchEl=$('hist-search');
    var q=searchEl?searchEl.value.toLowerCase().trim():'';
    var filtered=q?db.filter(function(e){
      var text=(e.name||'')+' '+(e.client||'')+' '+(e.project||'');
      if(e.revisions)e.revisions.forEach(function(r){text+=' '+(r.label||'');if(r.data){text+=' '+(r.data['num-atp']||'')+' '+(r.data['numprojeto']||'')+' '+(r.data['num-agp']||'');}});
      return text.toLowerCase().indexOf(q)>=0;
    }):db;
    if(!filtered.length){
      body.innerHTML='<div class="hist-empty" style="padding:24px;text-align:center">'+(q?'🔍 Nenhum resultado para "<b>'+q+'</b>"':'<div style="font-size:24px;margin-bottom:8px">📂</div><b>Nenhum orçamento salvo</b><br><span style="font-size:11px;color:#aaa">Clique em <b>💾 SALVAR</b> para guardar o orçamento atual.<br>Use <b>Nova revisão</b> para criar revisões (Rev01, Rev02...).<br>Busque por nome do cliente, nº reserva ou AGP.</span>')+'</div>';
      return;
    }
    var h='<table class="hist-table"><thead><tr><th>Nome</th><th>Cliente</th><th>Reserva</th><th>Criado</th><th></th></tr></thead><tbody>';
    filtered.forEach(function(e){
      var pills=(e.revisions||[]).map(function(r,i){
        var isCurrent=(currentId===e.id&&currentRev===i);
        var canDel=(e.revisions||[]).length>1;
        return '<span style="position:relative;display:inline-flex;margin:2px">'+ 
          '<button class="rpill '+(i===0?'orig':'')+'" style="'+(isCurrent?'outline:2px solid var(--navy);':'')+'position:relative" onclick="loadRevision(\''+e.id+'\','+i+')">'+
          (r.label||'Rev '+i)+'<br><span style="font-size:9px;font-weight:400">'+(r.savedAt||'')+'</span>'+
          (isCurrent?'<span style="position:absolute;top:-6px;right:-4px;font-size:8px">📍</span>':'')+
        '</button>'+
        (canDel?'<button onclick="event.stopPropagation();deleteRev(\''+e.id+'\','+i+')" style="position:absolute;top:-7px;left:-7px;width:18px;height:18px;border-radius:50%;background:#e74c3c;color:#fff;border:2px solid #fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;z-index:1;box-shadow:0 1px 3px rgba(0,0,0,.3)" title="Excluir esta revisão">×</button>':'')+
        '</span>';
      }).join('');
      // Extrair dados da revisão mais recente para exibir no nome
      var _lastRev = (e.revisions&&e.revisions.length) ? e.revisions[e.revisions.length-1] : null;
      var _d = _lastRev ? (_lastRev.data||{}) : {};
      var _L    = _d['largura']   ? _d['largura']+'mm'   : '';
      var _A    = _d['altura']    ? _d['altura']+'mm'    : '';
      var _mod  = '';
      var _modV = _d['carac-modelo-txt']||_d['carac-modelo']||'';
      var _cor  = _d['carac-cor-ext']||'';
      if(_modV) _mod = _modV;
      // Fixos
      var _fixos = [];
      if(_d['tem-fixo']==='true'||_d['tem-fixo']===true){
        var _fi=1;
        while(_d['fixo-larg-'+_fi]||_d['fixo-alt-'+_fi]){
          var _fl=_d['fixo-larg-'+_fi], _fa=_d['fixo-alt-'+_fi];
          if(_fl&&_fa) _fixos.push(_fl+'×'+_fa);
          _fi++;
        }
      }
      // Montar subtítulo
      var _sub = [];
      if(_L&&_A) _sub.push(_L+'×'+_A);
      if(_mod)   _sub.push(_mod);
      if(_cor)   _sub.push(_cor);
      if(_fixos.length) _sub.push('Fixo: '+_fixos.join(', '));
      var _subHtml = _sub.length ? '<br><span style="font-size:9px;color:#888;font-weight:400">'+_sub.join(' · ')+'</span>' : '';
      h+='<tr><td style="font-weight:700;max-width:200px;overflow:hidden;vertical-align:top">'+(e.name||'—')+_subHtml+'</td>'+
        '<td style="font-size:11px">'+(e.client||'—')+'</td>'+
        '<td style="color:#1a5276;font-size:11px;font-weight:600">'+(e.project||'—')+'</td>'+
        '<td style="color:#aaa;font-size:10px">'+(e.createdAt||'')+'</td>'+
        '<td><button class="del-btn" title="Excluir orçamento" onclick="deleteOrc(\''+e.id+'\')">×</button></td></tr>';
      h+='<tr><td colspan="5" style="padding:4px 8px 10px 8px;border-bottom:2px solid var(--border-light,#eee)"><div class="rev-pills" style="display:flex;flex-wrap:wrap;gap:2px">'+pills+'</div></td></tr>';
    });
    h+='</tbody></table>';
    body.innerHTML=h;
  }catch(e){console.error('renderHistory error:',e);}
}

/* ── SALVAR RAPIDO ────────────────────────────────────── */
function salvarRapido(){
  var _wasPendingRevision=!!window._pendingRevision;
  if(!currentId){
    // Primeiro salvamento: criar entry automático com nome do cliente
    var cliente=$('cliente').value.trim()||'Sem nome';
    var reserva=$('numprojeto').value.trim();
    var nome=cliente+(reserva?' — '+reserva:'');
    saveNew(nome);
    window._pendingRevision=false;
    var ind=document.getElementById('autosave-ind');
    if(ind){ind.textContent='✓ Salvo como "'+nome+'"';ind.style.opacity='1';ind.style.color='#1a7a20';setTimeout(function(){ind.style.opacity='0';},3000);}
  } else if(window._pendingRevision){
    // NOVA REVISÃO: criar revisão nova (não sobrescrever)
    var db=loadDB();
    var idx=db.findIndex(function(e){return e.id===currentId;});
    if(idx<0) return;
    var data=captureFormData();
    var nextNum=db[idx].revisions.length;
    var padNum=nextNum<10?'0'+nextNum:''+nextNum;
    var cliente=(data['cliente']||'').trim()||db[idx].client||'Sem nome';
    var label=cliente+' Rev'+padNum;
    db[idx].revisions.push({rev:nextNum, label:label, savedAt:now(), data:data, snapshot:captureSnapshot()});
    db[idx].client=data['cliente']||db[idx].client;
    db[idx].project=data['numprojeto']||db[idx].project;
    if(cliente) db[idx].name=cliente+(data['numprojeto']?' — '+data['numprojeto']:'');
    currentRev=nextNum;
    saveDB(db);
    _persistSession();
    $('cur-rev-badge').textContent=label;
    $('cur-rev-badge').style.display='';
    $('cur-name').textContent=db[idx].name;
    window._pendingRevision=false;
    var ind=document.getElementById('autosave-ind');
    if(ind){ind.textContent='✓ '+label+' salva!';ind.style.opacity='1';ind.style.color='#1a7a20';setTimeout(function(){ind.style.opacity='0';},3000);}
  } else {
    // Já existe: atualizar revisão atual silenciosamente
    var db=loadDB();
    var idx=db.findIndex(function(e){return e.id===currentId;});
    if(idx<0) return;
    var rev=db[idx].revisions[currentRev];
    /* ╔══════════════════════════════════════════════════════════════════╗
       ║  PROTEÇÃO: NUNCA sobrescrever snapshot de revisão TRAVADA.     ║
       ║  Se crmPronto=true ou snapshot já tem valores financeiros,     ║
       ║  o snapshot é SAGRADO — NÃO TOQUE!                            ║
       ╚══════════════════════════════════════════════════════════════════╝ */
    var _snapProtegido=!!(rev.crmPronto || (rev.snapshot && rev.snapshot.custoTotal && rev.snapshot.custoTotal!=='R$ 0'));
    var data=captureFormData();
    rev.data=data;
    rev.savedAt=now();
    // Só atualiza snapshot se NÃO protegido
    if(!_snapProtegido){
      try{rev.snapshot=captureSnapshot();}catch(e){}
    }
    db[idx].client=data['cliente']||db[idx].client;
    db[idx].project=data['numprojeto']||db[idx].project;
    var cliente=data['cliente']||'';
    var reserva=data['numprojeto']||'';
    if(cliente) db[idx].name=cliente+(reserva?' — '+reserva:'');
    saveDB(db);
    _persistSession();
    $('cur-name').textContent=db[idx].name;
    var ind=document.getElementById('autosave-ind');
    if(ind){ind.textContent='✓ Salvo!';ind.style.opacity='1';ind.style.color='#1a7a20';setTimeout(function(){ind.style.opacity='0';},2000);}
  }
  $('hist-count').textContent=loadDB().length;
  // ══ Sincronizar valores com card CRM vinculado ao SALVAR ══
  if(window._crmOrcCardId && typeof _captureOrcValues==='function'){
    try{
      var _sv=_captureOrcValues();
      if(_sv.tab>0||_sv.fat>0){
        var _cd=JSON.parse(localStorage.getItem('projetta_crm_v1')||'[]');
        var _ci=_cd.findIndex(function(o){return o.id===window._crmOrcCardId;});
        if(_ci>=0){
          _cd[_ci].valor=_sv.fat;
          _cd[_ci].valorTabela=_sv.tab;
          _cd[_ci].valorFaturamento=_sv.fat;
          _cd[_ci].updatedAt=new Date().toISOString();
          // Se foi nova revisão (pendingRevision acabou de ser processada): criar revisão CRM
          if(_wasPendingRevision){
            if(!_cd[_ci].revisoes) _cd[_ci].revisoes=[];
            var _revNum=_cd[_ci].revisoes.length;
            var _revLabel=_revNum===0?'Original':'Revisão '+_revNum;
            _cd[_ci].revisoes.push({
              rev:_revNum, label:_revLabel,
              data:new Date().toISOString(),
              valorTabela:_sv.tab, valorFaturamento:_sv.fat
            });
          } else if(_cd[_ci].revisoes&&_cd[_ci].revisoes.length>0){
            // Atualizar última revisão com valores atuais
            var _lastR=_cd[_ci].revisoes[_cd[_ci].revisoes.length-1];
            _lastR.valorTabela=_sv.tab;
            _lastR.valorFaturamento=_sv.fat;
          }
          localStorage.setItem('projetta_crm_v1',JSON.stringify(_cd));
          // Cloud sync CRM
          if(typeof cSave==='function'){try{cSave(_cd);}catch(e){}}
          if(typeof crmRender==='function') crmRender();
        }
      }
    }catch(e){}
  }
  // Após salvar: SEMPRE mostrar botão "Pronto para Envio"
  // Verificar se é primeiro envio ou revisão
  var _temEnvioAnterior=false;
  if(window._crmOrcCardId){
    try{
      var crmData=cLoad();
      var crmIdx=crmData.findIndex(function(o){return o.id===window._crmOrcCardId;});
      if(crmIdx>=0 && crmData[crmIdx].revisoes && crmData[crmIdx].revisoes.length>0){
        _temEnvioAnterior=true;
      }
    }catch(e){}
  }
  var btnP=document.getElementById('crm-orc-pronto-btn');
  var btnAtt=document.getElementById('crm-atualizar-btn');
  if(_temEnvioAnterior){
    // Já enviou Original → mostrar "Pronto para Envio" (gera PDF) + "Atualizar Valor"
    if(btnP){btnP.style.display='inline-flex';btnP.textContent='✅ Orçamento Pronto para Envio';}
    if(btnAtt){btnAtt.style.display='inline-flex';btnAtt.textContent='🔄 Atualizar Valor no Card';}
  } else {
    // Primeiro salvamento → mostrar apenas "Pronto para Envio"
    if(btnP){btnP.style.display='inline-flex';btnP.textContent='✅ Orçamento Pronto para Envio';}
    if(btnAtt) btnAtt.style.display='none';
  }
}

function novaRevisao(){
  // Cancelar timers pendentes e destravar orçamento para edição
  _revClearTimers();
  window._snapshotLock=false;
  window._orcLocked=false;
  _setOrcLock(false);
  _hideMemorial();
  
  // Mostrar botão GERAR CUSTO COMPLETO para recalcular
  var gcw=document.getElementById('gerar-custo-wrap');if(gcw)gcw.style.display='';
  
  // Se tem itens do CRM, permitir edição nos itens
  if(window._orcItens && window._orcItens.length > 0){
    // Mostrar barra de itens como editável
    var bar=document.getElementById('orc-itens-bar');
    if(bar) bar.classList.add('show');
  }
  
  // Abrir Características da Porta para edição
  var caracBody=document.getElementById('carac-body');
  if(caracBody) caracBody.style.display='';
  
  if(!currentId){
    salvarRapido();
    if(!currentId) return;
  }
  
  // NÃO criar revisão agora — só marca que está em modo revisão
  // A revisão será criada quando o usuário clicar SALVAR
  window._pendingRevision = true;
  
  // Esconder botões CRM (só aparecem após SALVAR)
  var btnPronto=document.getElementById('crm-orc-pronto-btn');if(btnPronto)btnPronto.style.display='none';
  var btnAtt=document.getElementById('crm-atualizar-btn');if(btnAtt)btnAtt.style.display='none';
  var btnPdf=document.getElementById('crm-gerar-pdf-btn');if(btnPdf)btnPdf.style.display='none';
  
  // Visual feedback
  var ind=document.getElementById('autosave-ind');
  if(ind){ind.textContent='✏️ Modo revisão — edite e clique SALVAR';ind.style.opacity='1';ind.style.color='#e67e22';}
  
  // Toast
  var t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#e67e22;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';
  t.textContent='✏️ Campos liberados para revisão! Edite e clique SALVAR.';
  document.body.appendChild(t);setTimeout(function(){t.remove();},4000);
}

/* modal flow */
function openSaveNew(){
  saveMode='new';
  $('modal-title').textContent='Salvar novo orçamento';
  $('modal-desc').textContent='Dê um nome para identificar este orçamento';
  $('modal-name').value=($('cliente').value||'')+' — '+($('numprojeto').value||'');
  $('save-modal').classList.add('open');
  setTimeout(()=>$('modal-name').focus(),100);
}
function openSaveModal(){
  if(!currentId){openSaveNew();return;}
  saveMode='revision';
  const db=loadDB();
  const entry=db.find(e=>e.id===currentId);
  const nextNum=entry?entry.revisions.length:1;
  $('modal-title').textContent='Salvar revisão';
  $('modal-desc').textContent=`Orçamento: ${entry?entry.name:'—'} · será criada Revisão ${nextNum}`;
  $('modal-name').value='Revisão '+nextNum;
  $('save-modal').classList.add('open');
  setTimeout(()=>$('modal-name').focus(),100);
}
function closeModal(){$('save-modal').classList.remove('open');}

/* ══ ATP — PEDIDO FECHADO ══════════════════════════════════ */
window._isATP = false;

function abrirModalATP(){
  if(window._isATP){ alert('Este pedido já possui ATP gerada.'); return; }
  var agp = ($('num-agp')||{value:''}).value;
  if(!agp){ alert('Preencha o número AGP antes de gerar a ATP.'); return; }
  var cliente = ($('cliente')||{value:''}).value;
  $('atp-cliente-nome').value = cliente;
  $('atp-modal').classList.add('open');
}

function fecharModalATP(){ $('atp-modal').classList.remove('open'); }

function confirmarATP(){
  var nome = ($('atp-cliente-nome')||{value:''}).value.trim();
  var numAtp = ($('atp-numero-input')||{value:''}).value.trim();
  if(!nome){ alert('Informe o nome completo do cliente.'); return; }
  if(!numAtp){ alert('Informe o número da ATP.'); return; }
  if(!confirm('Confirmar geração da ATP?\n\nO orçamento atual (AGP) será salvo como revisão.\nUma nova versão ATP será criada do zero para produção.')) return;

  // 1. Garantir que existe um save
  if(!currentId){ salvarRapido(); if(!currentId) return; }

  // 2. Salvar estado atual do AGP como revisão final
  var db = loadDB();
  var entry = db.find(function(e){return e.id===currentId;});
  if(!entry){ alert('Erro ao localizar orçamento.'); return; }

  // Atualizar revisão atual com dados mais recentes
  var agpData = captureFormData();
  entry.revisions[currentRev].data = agpData;
  entry.revisions[currentRev].savedAt = now();

  // Criar revisão "AGP Final" com snapshot completo
  var agpRevNum = entry.revisions.length;
  entry.revisions.push({
    rev: agpRevNum,
    label: 'AGP Final (antes da ATP)',
    savedAt: now(),
    data: JSON.parse(JSON.stringify(agpData))
  });

  // 3. Guardar dados do cliente
  var agp = ($('num-agp')||{value:''}).value;
  var reserva = ($('numprojeto')||{value:''}).value;
  var dataProj = ($('dataprojeto')||{value:''}).value;
  var resp = ($('responsavel')||{value:''}).value;
  var rep = ($('rep-sel')||{value:''}).value;
  var cep = ($('cep-cliente')||{value:''}).value;
  var custoHora = ($('custo-hora')||{value:''}).value;
  var diaria = ($('diaria')||{value:''}).value;

  // 4. Zerar tudo
  ['largura','altura','qtd-portas','folhas-porta','ac-fechadura','qtd-fechaduras',
   'carac-abertura','carac-folhas','carac-fech-mec','carac-fech-dig','carac-cilindro','carac-puxador','carac-pux-tam','carac-cor-ext','carac-cor-int','carac-modelo','carac-dist-borda-cava','carac-largura-cava','carac-dist-borda-friso','carac-largura-friso','carac-ripado-total','carac-ripado-2lados',
   'fab-mat-perfis','fab-custo-pintura','fab-custo-acess','h-portal','h-quadro','h-corte','h-colagem','h-conf',
   'dias','pessoas','km','carros','hotel-dia','alim','munk','terceiros','inst-quem','inst-terceiros-valor','inst-terceiros-transp','desconto'
  ].forEach(function(f){var el=$(f);if(el)el.value='';});

  // 5. Restaurar dados do cliente
  $('cliente').value = nome;
  $('num-agp').value = agp;
  $('num-atp').value = numAtp;
  $('numprojeto').value = reserva;
  $('dataprojeto').value = dataProj;
  $('responsavel').value = resp;
  $('rep-sel').value = rep;
  $('cep-cliente').value = cep;
  if(custoHora) $('custo-hora').value = custoHora;
  if(diaria) $('diaria').value = diaria;

  // 6. Mudar status visual
  window._isATP = true;
  var badge = $('status-badge');
  if(badge){ badge.textContent = 'PEDIDO FECHADO'; badge.style.background = '#1a5276'; }
  var atpRow = $('atp-field-row');
  if(atpRow) atpRow.style.display = '';
  var end = $('atp-endereco');
  if(end) end.style.display = '';
  var ib = $('ident-body');
  if(ib && ib.style.display==='none'){ ib.style.display=''; var ibadge=$('ident-badge'); if(ibadge) ibadge.innerHTML='&#9650;'; }
  var btn = $('btn-gerar-atp');
  if(btn){ btn.textContent='✓ ATP GERADA'; btn.style.background='#27ae60'; btn.style.borderColor='#27ae60'; }
  if(cep) $('atp-cep').value = cep;
  var cidadeEl = $('cep-cidade');
  if(cidadeEl && cidadeEl.textContent) $('atp-cidade').value = cidadeEl.textContent.trim();

  fecharModalATP();
  calc();

  // 7. Salvar revisão ATP (estado zerado com dados do cliente)
  var atpRevNum = entry.revisions.length;
  var atpData = captureFormData();
  var atpLabel = nome + ' ATP' + numAtp;
  entry.revisions.push({
    rev: atpRevNum,
    label: atpLabel,
    savedAt: now(),
    data: atpData
  });
  currentRev = atpRevNum;
  _persistSession();
  saveDB(db);

  // Atualizar banner
  $('cur-rev-badge').textContent = atpLabel;
  $('cur-rev-badge').style.display = '';
  $('hist-count').textContent = loadDB().length;

  var ind = document.getElementById('autosave-ind');
  if(ind){ind.textContent='✓ ATP gerada e salva!';ind.style.opacity='1';setTimeout(function(){ind.style.opacity='0';},3000);}

  alert('ATP '+numAtp+' gerada com sucesso!\n\nHistórico salvo:\n• Revisões do AGP preservadas\n• AGP Final salvo como snapshot\n• ATP criada do zero para produção\n\nPreencha o endereço e as novas medidas.');
}
function confirmSave(){
  const name=$('modal-name').value.trim()||'Sem nome';
  if(saveMode==='new') saveNew(name);
  else saveRevision(name);
  closeModal();
}
$('modal-name').addEventListener('keydown',e=>{if(e.key==='Enter')confirmSave();});
$('save-modal').addEventListener('click',e=>{if(e.target===$('save-modal'))closeModal();});

window.toggleHist=function(){
  var p=$('hist-panel');
  p.classList.toggle('open');
  if(p.classList.contains('open')) renderHistory();
};

/* ── Expose all onclick-called functions to global scope ── */
window.renderHistory=renderHistory;
window.salvarRapido=salvarRapido;
window.novaRevisao=novaRevisao;
// window.zerarValores=zerarValores; // moved to MODULE ORCAMENTO_UI
window.newOrcamento=newOrcamento;
window.abrirModalATP=abrirModalATP;
window.confirmarATP=confirmarATP;
window.fecharModalATP=fecharModalATP;
window.confirmSave=confirmSave;
window.closeModal=closeModal;
window.openSaveNew=openSaveNew;
window.openSaveModal=openSaveModal;

function resetToDefaults(){
  window._snapshotLock=false;
  window._orcLocked=false;
  window._pendingRevision=false;
  window._forceUnlockAfterLoad=false;
  window._custoCalculado=false;
  window._osGeradoUmaVez=false;
  try{_setOrcLock(false);}catch(e){}
  document.getElementById('acm-list').innerHTML='';
  document.getElementById('alu-list').innerHTML='';
  aC=0; lC=0;
  // Limpar TODOS os campos de texto
  ['cliente','numprojeto','num-agp','num-atp','responsavel'].forEach(f=>{var el=$(f);if(el)el.value='';});
  $('dataprojeto').valueAsDate=new Date();
  // dimensões — vazio
  ['largura','altura'].forEach(f=>{$(f).value='';});
  // Limpar tabela multi-porta
  window._mpItens=[];
  if(typeof _mpRender==='function') _mpRender();
  // folhas
  var fol=$('folhas-porta');if(fol)fol.selectedIndex=0;
  // fabricação — vazio exceto custo-hora fixo
  ['fab-mat-perfis','fab-custo-pintura','fab-custo-acess','h-portal','h-quadro','h-corte','h-colagem','h-conf'].forEach(f=>{var el=$(f);if(el){el.value='';el.dataset.auto='';el.dataset.manual='';el.style.cssText='';}});
  // Reset fab manual overrides
  if(window._fabManual){window._fabManual={mat:false,pin:false,acess:false};}
  // Reset manual alerts
  ['fab-mat-alert','fab-pin-alert','fab-acess-alert'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
  // Reset auto labels
  ['h-portal-auto','h-quadro-auto','h-colagem-auto','h-conf-auto','dias-auto'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='';});
  // Reset sistema produção
  var prodSis=$('prod-sistema');if(prodSis)prodSis.value='auto';
  // Quantidade portas e fechaduras
  var qtdP=$('qtd-portas');if(qtdP)qtdP.value='';
  var qtdF=$('qtd-fechaduras');if(qtdF)qtdF.value='';
  $('custo-hora').value=110;
  // instalação — vazio exceto valores fixos
  ['dias','pessoas','km','carros','munk','terceiros','pedagio','inst-terceiros-valor','inst-terceiros-transp'].forEach(f=>{var el=$(f);if(el){el.value='';el.dataset.auto='';el.dataset.manual='';}});
  var _iqEl=document.getElementById('inst-quem');if(_iqEl){_iqEl.value='PROJETTA';toggleInstQuem();}
  var _dEl=document.getElementById('desconto');if(_dEl)_dEl.dataset.manual='';
  $('diaria').value=550;
  $('hotel-dia').value=350;
  $('alim').value=90;
  // parâmetros financeiros — defaults
  $('overhead').value=5;
  $('impostos').value=18;
  $('com-rep').value=7;
  $('com-rt').value=5;
  $('com-gest').value=1;
  $('lucro-alvo').value=15;   // margem inicial sempre 15%
  var _mkEl=document.getElementById('markup-desc');
  if(_mkEl){_mkEl.value=20;_mkEl.dataset.manual='';} // markup auto 20%
  var _dcEl=document.getElementById('desconto');
  if(_dcEl){_dcEl.value=20;_dcEl.dataset.manual='';} // desconto auto 20%
  // representante e cep
  var repSel=$('rep-sel');if(repSel)repSel.selectedIndex=0;
  var cep=$('cep-cliente');if(cep)cep.value='';
  var cepInfo=document.getElementById('cep-info');if(cepInfo)cepInfo.style.display='none';
  var cepCidade=document.getElementById('cep-cidade');if(cepCidade)cepCidade.textContent='';
  // acessorios
  var acFech=$('ac-fechadura');if(acFech)acFech.selectedIndex=0;
  // características da porta — reset ALL selects AND friso inputs
  ['carac-abertura','carac-folhas','carac-fech-mec','carac-puxador','carac-pux-tam','carac-cor-ext','carac-cor-int','carac-modelo'].forEach(function(id){
    var el=$(id);if(el)el.selectedIndex=0;
  });
  // Fechadura digital: default = Não se aplica
  var _fdEl=document.getElementById('carac-fech-dig');
  if(_fdEl) _fdEl.value='NÃO SE APLICA';
  // Cilindro default: KESO
  var _cilEl=document.getElementById('carac-cilindro');
  if(_cilEl){ _cilEl.value='KESO'; }
  // Reset friso inputs to 0
  ['carac-friso-vert','carac-friso-horiz','carac-dist-borda-friso','carac-largura-friso'].forEach(function(id){
    var el=$(id);if(el)el.value='0';
  });
  // Reset ripado fields
  var _rtEl=$('carac-ripado-total');if(_rtEl)_rtEl.value='NAO';
  var _r2El=$('carac-ripado-2lados');if(_r2El)_r2El.value='SIM';
  var _ripSec=document.getElementById('ripado-section');if(_ripSec)_ripSec.style.display='none';
  // Force-hide fechadura panel and accessory info
  var rcFech=document.getElementById('rc-fechadura');if(rcFech)rcFech.style.display='none';
  var aiPanel=document.getElementById('acess-info');if(aiPanel)aiPanel.style.display='none';
  var dFatFRow=document.getElementById('d-fat-fech-row');if(dFatFRow)dFatFRow.style.display='none';
  var dCustoFRow=document.getElementById('d-custo-fech-row');if(dCustoFRow)dCustoFRow.style.display='none';
  var puxRow=document.getElementById('carac-pux-tam-row');if(puxRow)puxRow.style.display='none';
  var modPrev=document.getElementById('carac-modelo-preview');if(modPrev)modPrev.style.display='none';
  // planificador — limpar modelo e variáveis
  var planMod=$('plan-modelo');if(planMod)planMod.selectedIndex=0;
  var planFol=$('plan-folhas');if(planFol)planFol.selectedIndex=0;
  ['plan-disborcava','plan-largcava','plan-disbordafriso','plan-largfriso'].forEach(f=>{var el=$(f);if(el)el.value='';});
  // limpar peças manuais
  var mpTb=document.getElementById('plan-manual-tbody');
  if(mpTb)mpTb.innerHTML='';
  var mpEmpty=document.getElementById('plan-manual-empty');
  if(mpEmpty)mpEmpty.style.display='';
  // adicionar 1 bloco ACM e 1 ALU vazios
  addACM(); addALU();
  // Fechar todas as seções
  ['ident-body','dim-body','carac-body','param-body','fab-body','acess-body','inst-body'].forEach(function(id){
    var el=document.getElementById(id); if(el){ el.style.display='none'; }
  });
  ['ident-badge','dim-badge','carac-badge','param-badge','fab-badge','inst-badge'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.innerHTML='&#9660; clique para abrir';
  });
  var pb=document.getElementById('plan-body');
  if(pb){pb.style.display='none';}
  var pbadge=document.getElementById('plan-badge');
  if(pbadge) pbadge.innerHTML='&#9660; clique para abrir';
  // Limpar resultado planificador
  var planResult=document.getElementById('plan-result');
  if(planResult) planResult.style.display='none';
  // Limpar levantamento de perfis (OS)
  var osDoc=document.getElementById('os-doc');if(osDoc)osDoc.style.display='none';
  var osEmpty=document.getElementById('os-empty');if(osEmpty){osEmpty.style.display='';osEmpty.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">Preencha as <b>Características da Porta</b> para gerar o levantamento automaticamente.</div>';}
  // Limpar levantamento de acessórios
  var osaContent=document.getElementById('osa-content');if(osaContent)osaContent.innerHTML='<div style="text-align:center;color:#aaa;padding:40px;font-size:13px">Preencha as <b>Características da Porta</b> (largura, altura, sistema e modelo) para gerar automaticamente.</div>';
  var osaTotalWrap=document.getElementById('osa-total-wrap');if(osaTotalWrap)osaTotalWrap.style.display='none';
  // Limpar acessórios manuais
  var osaManualTbody=document.getElementById('osa-manual-tbody');if(osaManualTbody)osaManualTbody.innerHTML='';
  var osaManualEmpty=document.getElementById('osa-manual-empty');if(osaManualEmpty)osaManualEmpty.style.display='';
  var osaManualTotal=document.getElementById('osa-manual-total');if(osaManualTotal)osaManualTotal.style.display='none';
  // Limpar perfis manuais
  var ospManualTbody=document.getElementById('osp-manual-tbody');if(ospManualTbody)ospManualTbody.innerHTML='';
  var ospManualEmpty=document.getElementById('osp-manual-empty');if(ospManualEmpty)ospManualEmpty.style.display='';
  // Limpar alerta dobradiça
  var dobAlert=document.getElementById('osa-dob-alert');if(dobAlert)dobAlert.remove();
  // Limpar resumo chapas no orçamento
  var fabAcmTbody=document.getElementById('fab-acm-tbody');if(fabAcmTbody)fabAcmTbody.innerHTML='';
  var fabAcmTable=document.getElementById('fab-acm-table');if(fabAcmTable)fabAcmTable.style.display='none';
  var fabAcmEmpty=document.getElementById('fab-acm-empty');if(fabAcmEmpty)fabAcmEmpty.style.display='';
  var fabAluTbody=document.getElementById('fab-alu-tbody');if(fabAluTbody)fabAluTbody.innerHTML='';
  var fabAluTable=document.getElementById('fab-alu-table');if(fabAluTable)fabAluTable.style.display='none';
  var fabAluEmpty=document.getElementById('fab-alu-empty');if(fabAluEmpty)fabAluEmpty.style.display='';
  // Limpar Resumo da Obra
  var resumoObra=document.getElementById('resumo-obra');if(resumoObra)resumoObra.style.display='none';
  ['ro-perfis-kg','ro-perfis-bruto','ro-perfis-val','ro-chapas-qty','ro-chapas-peso','ro-chapas-val','ro-inst-val','ro-custo-total'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='—';});
  ['ro-pecas','ro-comp-val','ro-mao-val'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='—';});
  // Esconder multi-porta section
  var mpSec=document.getElementById('multi-porta-section');if(mpSec)mpSec.style.display='none';
  // Reset flags de OS
  window._osGeradoUmaVez=false;
  window._lastOSData=null;
  // Limpar seleção de chapas no planificador
  var planAcmCor=document.getElementById('plan-acm-cor');if(planAcmCor)planAcmCor.selectedIndex=0;
  var planAluCor=document.getElementById('plan-alu-cor');if(planAluCor)planAluCor.selectedIndex=0;
  var planAcmQty=document.getElementById('plan-acm-qty');if(planAcmQty)planAcmQty.value='1';
  var planAluQty=document.getElementById('plan-alu-qty');if(planAluQty)planAluQty.value='0';
  // Reset OS generation flag
  if(typeof window._osGenerated!=='undefined') window._osGenerated=false;
  calc();
  // Force-zero ALL cost fields and result displays after calc
  setTimeout(function(){
    _clearResultDisplay();
    ['fab-mat-perfis','fab-custo-pintura','fab-custo-acess'].forEach(function(id){
      var e=document.getElementById(id);if(e)e.value='';
    });
    if(window._fabManual){window._fabManual={mat:false,pin:false,acess:false};}
    ['fab-mat-alert','fab-pin-alert','fab-acess-alert'].forEach(function(id){
      var e=document.getElementById(id);if(e)e.style.display='none';
    });
    // Zero all sub-* result spans
    ['sub-acm','sub-alu','sub-perf-mat','sub-perf-pin','sub-perf-acess','sub-perf','sub-mo','sub-sal',
     'r-hotel','sub-alim','sub-munk','sub-ped','sub-terc','osa-total-geral',
     'acess-custo','acess-pfat','m-custo-fech','m-tab-fech','m-fat-fech',
     'd-fat-fech','d-custo-fech','m-custo','m-tab','m-fat','d-fat','d-custo','d-lb','d-ll',
     'm-custo-porta','m-tab-porta','m-fat-porta'].forEach(function(id){
      var e=document.getElementById(id);if(e){
        if(/R\$|^\d/.test(e.textContent))e.textContent='R$ 0';
      }
    });
    // Zero res-* result spans
    document.querySelectorAll('[id^="res-"]').forEach(function(e){
      if(e.tagName==='SPAN'||e.tagName==='DIV'){
        if(/R\$/.test(e.textContent)||/^\d/.test(e.textContent.trim()))e.textContent='R$ 0';
      }
    });
  },100);
}

/* ══ END MODULE: HISTORY_SAVE ══ */
