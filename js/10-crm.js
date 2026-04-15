/**
 * 10-crm.js
 * Module: CRM
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: CRM ══ */
(function(){
var CK='projetta_crm_v1', SK='projetta_crm_settings_v1';
var _editId=null, _view='kanban', _scope='nacional', _stageId=null, _dragId=null;

/* ── Defaults ──────────────────────────────────── */
var D_STAGES=[
  {id:'s2',label:'Qualificação',color:'#3498db',icon:'🔍'},
  {id:'s3',label:'Fazer Orçamento',color:'#e67e22',icon:'📋'},
  {id:'s3b',label:'Orçamento Pronto',color:'#f39c12',icon:'📧'},
  {id:'s4',label:'Proposta Enviada',color:'#9b59b6',icon:'📤'},
  {id:'s5',label:'Negociação',color:'#e74c3c',icon:'🤝'},
  {id:'s6',label:'Fechado Ganho',color:'#27ae60',icon:'🏆'},
  {id:'s7',label:'Perdido',color:'#7f8c8d',icon:'💔'},
];
var D_ORIGINS=['Weiku do Brasil','WhatsApp','Instagram','Indicação','Parceiro','Digital','Prospecção Ativa','Retorno','Licitação','Feira / Evento','Site'];
var D_PRODUCTS=['Porta ACM Pivotante','Porta ACM de Giro','Fachada ACM','Janela ACM','Revestimento ACM','Cobertura ACM','Projeto Especial'];
var D_TEAM=[
  {name:'ANDRESSA BACHUR LIMA',color:'#9b59b6'},
  {name:'THAYS AGUIAR DOS SANTOS',color:'#27ae60'},
  {name:'FELIPE XAVIER DE LIMA',color:'#003144'},
];

/* ── Settings ───────────────────────────────────── */
function gS(){try{return JSON.parse(localStorage.getItem(SK))||{};}catch(e){return{};}}
function sS(s){localStorage.setItem(SK,JSON.stringify(s));}
function gStages(){
  var s=gS();
  var st=(s.stages||[]).length?s.stages:D_STAGES;
  // Migrar: remover Prospecção (s1) se ainda existir nos salvos
  var had=st.length;
  st=st.filter(function(x){return x.id!=='s1';});
  if(st.length<had){s.stages=st;sS(s);}
  return st;
}
function gOrigins(){var s=gS();return(s.origins||[]).length?s.origins:D_ORIGINS;}
function gProducts(){var s=gS();return(s.products||[]).length?s.products:D_PRODUCTS;}
function gTeam(){var s=gS();return(s.team||[]).length?s.team:D_TEAM;}
function gWReps(){var s=gS();return(s.wreps||[]).length?s.wreps:D_WREPS;}
var D_WREPS=['Adalberto Fanderuff','Adriana Karen de Souza','Adriano Dorigon','Alessandra R. Wihby (MT_ARWC)','Ampliar GO','Camila Vitorassi Preve','Carina Ap. Kazahaya (KAR)','Centenário SP','CRJ','D&A','Diego Luiz Frigeri (Solaris)','Dion Lenon Hernandes','Ericson Venancio dos Santos','Felipe Xavier','Gervásio Santa Rosa','Gustavo Guarenghi (Qualitá 4)','Igor Lopes de Almeida (Lidere MT)','Emily Rocha (Qualitá 3)','João de Lara (Qualitá 5)','Jhonathan S. Matos (Central Coberturas)','Julia Lemes','Leonardo Guarenghi','Luana F. Silveira','Luciane C. de Grabalos (Euro)','Luiz Fernando Starke','Luiz Severino Moretto','Marcelo Abarca de Oliveira','Márcio Daniel Gnigler (MDG)','Nelson E. Colantuano','Primeira Linha MS','Rafael C. Jung Sperotto (Fazsol)','Rodrigo Aguiar Diniz','Ronei de Jesus Lyra','Rosa Madeiras Limeira','Rubens A. Grando Postali (Elo Forte)','Simone Fraga / Deise (Tuti)','Thays (Comercial)'];

/* ── CRM Data ────────────────────────────────────── */
function cLoad(){try{return JSON.parse(localStorage.getItem(CK))||[];}catch(e){return[];}}
function cSave(d){
  try{
    localStorage.setItem(CK,JSON.stringify(d));
  }catch(e){
    // localStorage full — try removing attachment data to free space
    if(e.name==='QuotaExceededError'||e.code===22||e.code===1014){
      console.warn('localStorage cheio, tentando salvar sem anexos grandes...');
      var lite=d.map(function(o){
        var copy=Object.assign({},o);
        if(copy.anexos&&copy.anexos.length>0){
          copy.anexos=copy.anexos.map(function(a){return{name:a.name,type:a.type,date:a.date,data:a.type&&a.type.startsWith('image/')?a.data.slice(0,200)+'...':a.data};});
        }
        return copy;
      });
      try{localStorage.setItem(CK,JSON.stringify(lite));}catch(e2){
        alert('⚠ Armazenamento cheio! Remova anexos ou exclua oportunidades antigas.');
      }
    }
  }
  // Cloud sync — Supabase Projetta
  var SB='https://plmliavuwlgpwaizfeds.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var cloudData=d.map(function(o){var c=Object.assign({},o);delete c.anexos;return c;});
  fetch(SB+'/rest/v1/configuracoes',{method:'POST',
    headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({chave:CK,valor:{db:cloudData,ts:new Date().toISOString()}})
  }).catch(function(){});
}
function cCloudLoad(cb){
  var SB='https://plmliavuwlgpwaizfeds.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  fetch(SB+'/rest/v1/configuracoes?chave=eq.'+CK+'&select=valor&limit=1',
    {headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}})
    .then(function(r){return r.json();})
    .then(function(rows){cb(rows&&rows.length?rows[0].valor:null);})
    .catch(function(){cb(null);});
}

/* ── Helpers ────────────────────────────────────── */
function uuid(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function brl(v){return(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2});}
function dateLabel(s){if(!s)return'';var d=new Date(s+'T00:00:00');return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});}
function isThisMonth(s){if(!s)return false;var d=new Date(s),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}
function daysFrom(s){if(!s)return 999;return Math.ceil((new Date(s+'T00:00:00')-new Date())/(1000*86400));}
function escH(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function el(id){return document.getElementById(id);}
function val(id){return(el(id)||{}).value||'';}
function setVal(id,v){var e=el(id);if(e)e.value=v||'';}
function nameColor(name){
  var t=gTeam();var m=t.find(function(x){return x.name===name;});
  if(m)return m.color;
  var c=['#003144','#9b59b6','#27ae60','#e67e22','#2980b9'],h=0;
  for(var i=0;i<name.length;i++)h=(h*31+name.charCodeAt(i))&0xFFFFFF;
  return c[Math.abs(h)%c.length];
}

/* ── KPIs ────────────────────────────────────────── */
function updateKPIs(all){
  var stages=gStages();
  var wonIds=stages.filter(function(s){return/gan|won/i.test(s.label);}).map(function(s){return s.id;});
  var lostIds=stages.filter(function(s){return/perd|lost/i.test(s.label);}).map(function(s){return s.id;});
  var ativos=all.filter(function(o){return wonIds.indexOf(o.stage)<0&&lostIds.indexOf(o.stage)<0;});
  var ganhos=all.filter(function(o){return wonIds.indexOf(o.stage)>=0;});
  var perdidos=all.filter(function(o){return lostIds.indexOf(o.stage)>=0;});
  var ganhosMes=ganhos.filter(function(o){return isThisMonth(o.updatedAt||o.createdAt);});
  var intl=all.filter(function(o){return o.scope==='internacional';});
  var pipe=ativos.reduce(function(s,o){return s+(parseFloat(o.valor)||0);},0);
  var gMes=ganhosMes.reduce(function(s,o){return s+(parseFloat(o.valor)||0);},0);
  var ativosComValor=ativos.filter(function(o){return(parseFloat(o.valor)||0)>0;});
  var ticket=ativosComValor.length>0?pipe/ativosComValor.length:0;
  var conv=(ganhos.length+perdidos.length)>0?Math.round(ganhos.length/(ganhos.length+perdidos.length)*100):0;
  if(el('ck-pipe')){el('ck-pipe').textContent=brl(pipe);el('ck-pipe-s').textContent=ativos.length+' ativas';}
  if(el('ck-gain')){el('ck-gain').textContent=brl(gMes);el('ck-gain-s').textContent=ganhosMes.length+' contratos';}
  if(el('ck-ticket'))el('ck-ticket').textContent=brl(ticket);
  var ckTicketSub=document.querySelector('#ck-ticket')&&document.querySelector('#ck-ticket').parentNode?document.querySelector('#ck-ticket').parentNode.querySelector('.crm-kpi-sub'):null;
  if(ckTicketSub) ckTicketSub.textContent=ativosComValor.length+' com valor';
  if(el('ck-conv'))el('ck-conv').textContent=conv+'%';
  if(el('ck-intl')){el('ck-intl').textContent=intl.length;el('ck-intl-s').textContent='internacional'+(intl.length!==1?'s':'');}
  // Total Tabela e Faturamento (todas ativas)
  var totTab=ativos.reduce(function(s,o){return s+(parseFloat(o.valorTabela)||0);},0);
  var totFat=ativos.reduce(function(s,o){return s+(parseFloat(o.valorFaturamento)||parseFloat(o.valor)||0);},0);
  if(el('ck-tot-tab')){el('ck-tot-tab').textContent=brl(totTab);el('ck-tot-tab-s').textContent=ativos.filter(function(o){return o.valorTabela>0;}).length+' com tabela';}
  if(el('ck-tot-fat')){el('ck-tot-fat').textContent=brl(totFat);el('ck-tot-fat-s').textContent=ativos.filter(function(o){return(o.valorFaturamento||o.valor)>0;}).length+' com faturamento';}
  // Filters
  var resps=[...new Set(all.map(function(o){return o.responsavel;}).filter(Boolean))];
  var rs=el('crm-f-resp-filter');if(rs){var cv=rs.value;rs.innerHTML='<option value="">👤 Todos</option>';resps.forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;if(r===cv)o.selected=true;rs.appendChild(o);});}
  var origs=[...new Set(all.map(function(o){return o.origem;}).filter(Boolean))];
  var os=el('crm-f-origin-filter');if(os){var cv2=os.value;os.innerHTML='<option value="">🔖 Origem</option>';origs.forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;if(r===cv2)o.selected=true;os.appendChild(o);});}
  // Representante Weiku filter
  var wreps=[...new Set(all.map(function(o){return o.wrep;}).filter(Boolean))].sort();
  var ws=el('crm-f-wrep-filter');if(ws){var cv3=ws.value;ws.innerHTML='<option value="">🏢 Representante</option>';wreps.forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;if(r===cv3)o.selected=true;ws.appendChild(o);});}
}

/* ── Render ──────────────────────────────────────── */
window.crmRender=function(){
  var all=cLoad();
  // Migrar cards s1 (Prospecção removida) → s2 (Qualificação)
  var _mig=false;all.forEach(function(o){if(o.stage==='s1'){o.stage='s2';_mig=true;}});if(_mig)cSave(all);
  var q=(val('crm-search')).toLowerCase();
  var fR=val('crm-f-resp-filter'),fO=val('crm-f-origin-filter'),fS=val('crm-f-scope-filter');
  var fReg=val('crm-f-regiao-filter'),fGer=val('crm-f-gerente-filter'),fWrep=val('crm-f-wrep-filter');
  var fil=all.filter(function(o){
    if(q&&!(o.cliente||'').toLowerCase().includes(q)&&!(o.produto||'').toLowerCase().includes(q)&&!(o.cidade||'').toLowerCase().includes(q)&&!(o.wrep||'').toLowerCase().includes(q)&&!(o.agp||'').toLowerCase().includes(q)&&!(o.reserva||'').toLowerCase().includes(q))return false;
    if(fR&&o.responsavel!==fR)return false;
    if(fO&&o.origem!==fO)return false;
    if(fS&&o.scope!==fS)return false;
    if(fWrep&&(o.wrep||'')!==fWrep)return false;
    if(fReg){
      var oreg=getRepRegiao(o.wrep);
      if(!oreg)return false;
      if(fReg.length<=5){if(!oreg.startsWith(fReg))return false;}
      else{if(oreg!==fReg)return false;}
    }
    if(fGer){
      var oreg2=getRepRegiao(o.wrep);
      var gn=getGerenteDaRegiao(oreg2);
      if(gn.toUpperCase()!==fGer.toUpperCase())return false;
    }
    return true;
  });
  updateKPIs(all);
  if(_view==='kanban')renderKanban(fil);
  else renderList(fil);
};

/* ── Kanban ──────────────────────────────────────── */
function renderKanban(fil){
  var board=el('crm-pipeline');if(!board)return;
  var stages=gStages();board.innerHTML='';
  stages.forEach(function(st){
    var cards=fil.filter(function(o){return o.stage===st.id;});
    var tv=cards.reduce(function(s,o){return s+(parseFloat(o.valorFaturamento)||parseFloat(o.valor)||0);},0);
    var tvTab=cards.reduce(function(s,o){return s+(parseFloat(o.valorTabela)||0);},0);
    var isFazerOrc=/fazer.*or|orcamento/i.test(st.label);
    var col=document.createElement('div');col.className='crm-stage';col.setAttribute('data-stage',st.id);
    col.innerHTML=
      '<div class="crm-stage-header">'+
        '<div class="crm-stage-title-row">'+
          '<div class="crm-stage-title"><div class="crm-stage-dot" style="background:'+st.color+'"></div><span>'+st.icon+' '+escH(st.label)+'</span></div>'+
          '<span class="crm-stage-count">'+cards.length+'</span>'+
        '</div>'+
        (tvTab>0?'<div class="crm-stage-val" style="color:var(--navy)">Tab: '+brl(tvTab)+'</div>':'')+
        (tv>0?'<div class="crm-stage-val" style="color:#e67e22;font-weight:700">Fat: '+brl(tv)+'</div>':'')+
      '</div>'+
      '<div class="crm-stage-body" id="sb-'+st.id+'"></div>'+
      '<div class="crm-stage-footer"><button class="crm-stage-add-btn" onclick="crmOpenModal(\''+st.id+'\')">+ Adicionar</button></div>';
    board.appendChild(col);
    var body=col.querySelector('#sb-'+st.id);
    body.addEventListener('dragover',function(e){e.preventDefault();body.classList.add('drag-over');});
    body.addEventListener('dragleave',function(e){if(!body.contains(e.relatedTarget))body.classList.remove('drag-over');});
    body.addEventListener('drop',function(e){
      e.preventDefault();body.classList.remove('drag-over');
      if(!_dragId)return;
      var data=cLoad();var idx=data.findIndex(function(o){return o.id===_dragId;});
      if(idx>=0){data[idx].stage=st.id;data[idx].updatedAt=new Date().toISOString();cSave(data);crmRender();}
      _dragId=null;
    });
    if(!cards.length){
      body.innerHTML='<div class="crm-empty"><div class="crm-empty-icon">📭</div>Nenhuma oportunidade</div>';
    } else {
      cards.forEach(function(o){body.appendChild(buildCard(o,st,isFazerOrc));});
    }
  });
}

/* ── Card ────────────────────────────────────────── */
function buildCard(o,st,isFazerOrc){
  var card=document.createElement('div');
  card.className='crm-card'+(o.scope==='internacional'?' intl':'')+(o.prioridade==='alta'?' pri-alta':o.prioridade==='baixa'?' pri-baixa':'');
  card.setAttribute('draggable','true');
  card.addEventListener('dragstart',function(e){_dragId=o.id;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
  card.addEventListener('dragend',function(){card.classList.remove('dragging');_dragId=null;});

  var locStr=o.scope==='internacional'
    ?(o.cidade?o.cidade+', ':'')+escH(o.pais||'')
    :(o.cidade||'')+(o.estado?' – '+o.estado:'');

  // Build card content — only show relevant info
  var html='';
  if(o.scope==='internacional') html+='<div class="crm-card-intl-tag">🌍 INTERNACIONAL</div>';
  html+='<div class="crm-card-client">'+escH(o.cliente||'Sem nome')+'</div>';
  if(locStr) html+='<div class="crm-card-sub">📍 '+locStr+'</div>';
  if(o.produto) html+='<div class="crm-card-sub">'+escH(o.produto)+'</div>';
  if(o.largura||o.altura) html+='<div class="crm-card-dims">📐 '+(o.largura||'?')+'×'+(o.altura||'?')+' mm'+(o.abertura?' · '+o.abertura.charAt(0)+o.abertura.slice(1).toLowerCase():'')+'</div>';
  // Mostrar info de cada item (modelo, folhas, digital, cor)
  if(o.itens&&o.itens.length>0){
    var _itemInfo=o.itens.filter(function(it){return it.tipo==='porta_pivotante';}).map(function(it,i){
      var parts=[];
      if(it.largura&&it.altura) parts.push(it.largura+'×'+it.altura);
      if(it.modelo) parts.push('Mod.'+it.modelo);
      if(it.folhas&&it.folhas!=='1') parts.push(it.folhas+'fls');
      if(it.fech_dig&&it.fech_dig!==''&&it.fech_dig!=='Nenhuma') parts.push('🔒'+it.fech_dig);
      if(it.cor_ext) parts.push('🎨'+it.cor_ext);
      if(it.cor_macico) parts.push('🔷'+it.cor_macico);
      return parts.length?('P'+(i+1)+': '+parts.join(' · ')):'';
    }).filter(Boolean);
    if(_itemInfo.length) html+='<div class="crm-card-sub" style="font-size:10px;line-height:1.5;font-weight:600">'+_itemInfo.join('<br>')+'</div>';
  } else {
    var _singleParts=[];
    if(o.modelo) _singleParts.push('Mod. '+o.modelo);
    if(o.folhas&&o.folhas!=='1') _singleParts.push(o.folhas+' folhas');
    if(o.cor_ext) _singleParts.push('🎨'+o.cor_ext);
    if(o.cor_macico) _singleParts.push('🔷'+o.cor_macico);
    if(_singleParts.length) html+='<div class="crm-card-sub" style="font-size:10px;font-weight:600">'+_singleParts.join(' · ')+'</div>';
  }
  if(o.wrep) html+='<div class="crm-card-sub" style="color:#2980b9;font-weight:700;font-size:9px">👤 Rep: '+escH(o.wrep)+'</div>';
  if(o.reserva) html+='<div class="crm-card-sub" style="font-size:9px;color:#1a5276;font-weight:700">📋 Reserva: '+escH(o.reserva)+'</div>';
  if(o.agp) html+='<div class="crm-card-sub" style="font-size:9px;color:#c0392b;font-weight:800">📋 AGP: '+escH(o.agp)+'</div>';
  // Prioridade + Potencial badges
  if(o.prioridade==='alta') html+='<div style="font-size:9px;font-weight:800;color:#e74c3c;background:#fde;padding:2px 6px;border-radius:4px;display:inline-block;margin:2px 0">🔴 PRIORIDADE ALTA</div>';
  else if(o.prioridade==='baixa') html+='<div style="font-size:9px;color:#27ae60;margin:1px 0">🟢 Prioridade baixa</div>';
  if(o.potencial==='alto') html+='<div style="font-size:9px;font-weight:700;color:#e67e22;margin:2px 0">🔥 Alto Potencial</div>';
  else if(o.potencial==='medio') html+='<div style="font-size:9px;color:#f39c12;margin:1px 0">⚡ Médio Potencial</div>';
  else if(o.potencial==='baixo') html+='<div style="font-size:9px;color:#95a5a6;margin:1px 0">💤 Baixo Potencial</div>';
  if(o.anexos&&o.anexos.length>0) html+='<div class="crm-card-attach-badge">📎 '+o.anexos.length+' anexo'+(o.anexos.length>1?'s':'')+'</div>';
  // Valores: Tabela e Faturamento
  if(o.valorTabela>0||o.valorFaturamento>0){
    html+='<div style="margin:4px 0 2px;padding:5px 7px;background:rgba(0,49,68,.04);border-radius:6px;font-size:10px">';
    if(o.valorTabela>0) html+='<div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#888">Tabela:</span><span style="font-weight:700;color:var(--navy)">'+brl(o.valorTabela)+'</span></div>';
    if(o.valorFaturamento>0) html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:1px"><span style="color:#888">Faturamento:</span><span style="font-weight:800;color:#e67e22">'+brl(o.valorFaturamento)+'</span></div>';
    html+='</div>';
  } else if(o.valor>0) {
    html+='<div class="crm-card-value">'+brl(o.valor)+'</div>';
  }
  // Revisões badge
  if(o.revisoes&&o.revisoes.length>0){
    var lastRev=o.revisoes[o.revisoes.length-1];
    var badgeLabel=lastRev.label||(o.revisoes.length===1?'Original':'Revisão '+(o.revisoes.length-1));
    var badgeColor=o.revisoes.length===1?'#27ae60':'#9b59b6';
    html+='<div style="display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap">';
    html+='<span style="font-size:10px;font-weight:700;color:#fff;background:'+badgeColor+';border-radius:4px;padding:2px 8px">'+badgeLabel+'</span>';
    if(o.revisoes.length>1) html+='<span style="font-size:9px;color:#888">('+o.revisoes.length+' versões)</span>';
    html+='</div>';
  }
  if(o.dataContato) html+='<div style="font-size:9px;color:var(--hint);margin-top:2px">📅 1º contato: '+dateLabel(o.dataContato)+'</div>';

  var days=daysFrom(o.fechamento);
  var urgente=days<=3&&o.fechamento&&!/(gan|won|perd|lost)/i.test(st.label);
  html+='<div class="crm-card-footer">'+
    '<div class="crm-card-resp">'+
      (o.responsavel?'<div class="crm-avatar" style="background:'+nameColor(o.responsavel)+'">'+o.responsavel.charAt(0)+'</div><span>'+escH(o.responsavel.split(' ')[0])+'</span>':'<span style="color:var(--hint)">Sem resp.</span>')+
    '</div>'+
    (o.fechamento?'<div class="crm-card-date" style="color:'+(urgente?'#e74c3c':'var(--hint)')+'">'+dateLabel(o.fechamento)+'</div>':'')+
  '</div>';

  // Fazer Orçamento button
  if(isFazerOrc){
    html+='<button class="crm-fazer-orc-btn" onclick="event.stopPropagation();crmFazerOrcamento(\''+o.id+'\')">📋 Fazer Orçamento</button>';
  }

  html+='<div class="crm-card-actions">'+
    '<button class="crm-card-act" title="Compartilhar" onclick="event.stopPropagation();crmCompartilharCard(\''+o.id+'\')" style="color:#27ae60">📤</button>'+
    '<button class="crm-card-act" title="Mover" onclick="event.stopPropagation();crmQuickMove(\''+o.id+'\')">↕</button>'+
    '<button class="crm-card-act" title="Editar" onclick="event.stopPropagation();crmOpenModal(null,\''+o.id+'\')">✏</button>'+
    '<button class="crm-card-act" title="Excluir" onclick="event.stopPropagation();crmDeleteOpp(\''+o.id+'\')">🗑</button>'+
  '</div>';

  card.innerHTML=html;
  card.addEventListener('click',function(e){if(!e.target.closest('.crm-card-actions,.crm-fazer-orc-btn'))crmOpenModal(null,o.id);});
  return card;
}

/* ── List View ───────────────────────────────────── */
function renderList(fil){
  var tb=el('crm-list-body');if(!tb)return;
  var stages=gStages();tb.innerHTML='';
  if(!fil.length){tb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--hint)">Nenhuma oportunidade encontrada</td></tr>';return;}
  fil.forEach(function(o){
    var st=stages.find(function(s){return s.id===o.stage;})||stages[0];
    var locStr=o.scope==='internacional'?(o.cidade||'')+(o.pais?', '+o.pais:''):(o.cidade||'')+(o.estado?' – '+o.estado:'');
    var tr=document.createElement('tr');
    tr.onclick=function(){crmOpenModal(null,o.id);};
    tr.innerHTML='<td><b style="color:var(--navy)">'+(o.scope==='internacional'?'🌍 ':'')+escH(o.cliente||'—')+'</b>'+(locStr?'<br><small style="color:var(--muted)">'+escH(locStr)+'</small>':'')+'</td>'+
      '<td style="font-size:11px;color:var(--muted)">'+escH(o.produto||'—')+'</td>'+
      '<td style="font-size:11px;font-family:monospace">'+(o.largura?o.largura+'×'+(o.altura||'?')+'mm':'—')+(o.reserva?' <small style="color:#1a5276">Res:'+o.reserva+'</small>':'')+(o.agp?' <small style="color:#c0392b;font-weight:700">AGP:'+o.agp+'</small>':'')+'</td>'+
      '<td style="font-weight:700;color:#e67e22">'+brl(o.valor)+'</td>'+
      '<td><span class="crm-stage-badge" style="background:'+st.color+'22;color:'+st.color+'">'+st.icon+' '+escH(st.label)+'</span></td>'+
      '<td style="font-size:11px">'+escH(o.responsavel||'—')+(o.wrep?'<br><small style="color:#2980b9">'+escH(o.wrep)+'</small>':'')+'</td>'+
      '<td style="font-size:11px;color:var(--hint)">'+dateLabel(o.fechamento)+'</td>'+
      '<td><button class="crm-btn-ghost" style="padding:4px 8px;font-size:10px" onclick="event.stopPropagation();crmOpenModal(null,\''+o.id+'\')">✏</button></td>';
    tb.appendChild(tr);
  });
}

/* ── Quick Move ──────────────────────────────────── */
window.crmQuickMove=function(id){
  var data=cLoad();var opp=data.find(function(o){return o.id===id;});if(!opp)return;
  var stages=gStages();
  var div=document.createElement('div');div.style.cssText='position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)';
  div.onclick=function(e){if(e.target===div)div.remove();};
  var inner='<div style="background:#fff;border-radius:16px;padding:20px;max-width:300px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3)"><div style="font-weight:800;color:var(--navy);margin-bottom:14px;font-size:14px">↕ Mover: '+escH(opp.cliente)+'</div><div style="display:flex;flex-direction:column;gap:6px">';
  stages.forEach(function(s){inner+='<button onclick="crmMoveStage(\''+id+'\',\''+s.id+'\');this.closest(\'[style*=fixed]\').remove()" style="padding:9px 14px;border-radius:10px;border:2px solid '+s.color+';cursor:pointer;font-size:12px;font-weight:700;text-align:left;transition:.1s;'+(opp.stage===s.id?'background:'+s.color+';color:#fff':'background:#fff;color:var(--navy)')+'">'+(opp.stage===s.id?'✓ ':'')+s.icon+' '+s.label+'</button>';});
  inner+='</div></div>';div.innerHTML=inner;document.body.appendChild(div);
};
window.crmMoveStage=function(id,sid){
  var data=cLoad();var i=data.findIndex(function(o){return o.id===id;});
  if(i>=0){data[i].stage=sid;data[i].updatedAt=new Date().toISOString();cSave(data);crmRender();
    if(sid==='s3b'&&typeof _onStageOrcamentoPronto==='function')_onStageOrcamentoPronto();
  }
};

/* ── View Toggle ─────────────────────────────────── */
window.crmSetView=function(v){
  _view=v;
  el('crm-kanban-view').style.display=v==='kanban'?'block':'none';
  el('crm-list-view').style.display=v==='list'?'block':'none';
  el('crm-vk').classList.toggle('active',v==='kanban');
  el('crm-vl').classList.toggle('active',v==='list');
  crmRender();
};

/* ── Nacional/Internacional ──────────────────────── */
window.crmSetScope=function(scope){
  _scope=scope;
  var btnNac=el('crm-btn-nac');
  var btnIntl=el('crm-btn-intl');
  if(btnNac){btnNac.style.background=scope==='nacional'?'#e3f2fd':'#fff';btnNac.style.fontWeight=scope==='nacional'?'800':'600';}
  if(btnIntl){btnIntl.style.background=scope==='internacional'?'#fff3e0':'#fff';btnIntl.style.fontWeight=scope==='internacional'?'800':'600';}
  var locNac=el('crm-loc-nacional');if(locNac)locNac.style.display=scope==='nacional'?'block':'none';
  var locIntl=el('crm-loc-internacional');if(locIntl)locIntl.style.display=scope==='internacional'?'block':'none';
};

/* ── CEP ─────────────────────────────────────────── */
window.crmCepMask=function(inp){
  var v=inp.value.replace(/\D/g,'').slice(0,8);
  if(v.length>5)v=v.slice(0,5)+'-'+v.slice(5);
  inp.value=v;
  if(v.replace('-','').length===8)crmBuscarCep();
};
window.crmBuscarCep=function(){
  var cep=val('crm-o-cep').replace(/\D/g,'');
  var st=el('crm-cep-status');
  if(cep.length!==8){if(st){st.textContent='CEP inválido';st.className='crm-cep-status err';}return;}
  if(st){st.textContent='⏳ Buscando...';st.className='crm-cep-status';}
  // Try fetch first, fallback to JSONP for file:// protocol
  fetch('https://viacep.com.br/ws/'+cep+'/json/')
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.erro){if(st){st.textContent='❌ CEP não encontrado';st.className='crm-cep-status err';}return;}
      setVal('crm-o-estado',d.uf||'');
      setVal('crm-o-cidade-nac',d.localidade||'');
      if(st){st.textContent='✅ '+d.localidade+' – '+d.uf;st.className='crm-cep-status ok';}
    })
    .catch(function(){
      // Fallback: JSONP via script tag (works from file:// protocol)
      var cbName='_viacepCb'+Date.now();
      window[cbName]=function(d){
        delete window[cbName];
        if(!d||d.erro){if(st){st.textContent='❌ CEP não encontrado';st.className='crm-cep-status err';}return;}
        setVal('crm-o-estado',d.uf||'');
        setVal('crm-o-cidade-nac',d.localidade||'');
        if(st){st.textContent='✅ '+d.localidade+' – '+d.uf;st.className='crm-cep-status ok';}
      };
      var sc=document.createElement('script');
      sc.src='https://viacep.com.br/ws/'+cep+'/json/?callback='+cbName;
      sc.onerror=function(){delete window[cbName];if(st){st.textContent='❌ Erro de rede — preencha manualmente';st.className='crm-cep-status err';}};
      document.head.appendChild(sc);
      setTimeout(function(){try{document.head.removeChild(sc);}catch(e){}},5000);
    });
};

/* ── Brasil Cidades ──────────────────────────────── */
var ESTADOS={AC:'Acre',AL:'Alagoas',AM:'Amazonas',AP:'Amapá',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MG:'Minas Gerais',MS:'Mato Grosso do Sul',MT:'Mato Grosso',PA:'Pará',PB:'Paraíba',PE:'Pernambuco',PI:'Piauí',PR:'Paraná',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RO:'Rondônia',RR:'Roraima',RS:'Rio Grande do Sul',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins'};
var CIDADES={AC:['Rio Branco','Cruzeiro do Sul','Feijó','Sena Madureira'],AL:['Maceió','Arapiraca','Rio Largo','Palmeira dos Índios'],AM:['Manaus','Parintins','Itacoatiara','Manacapuru'],AP:['Macapá','Santana'],BA:['Salvador','Feira de Santana','Vitória da Conquista','Camaçari','Juazeiro','Ilhéus','Itabuna','Lauro de Freitas','Barreiras','Jequié','Porto Seguro'],CE:['Fortaleza','Caucaia','Juazeiro do Norte','Maracanaú','Sobral','Crato'],DF:['Brasília','Ceilândia','Taguatinga','Samambaia','Planaltina','Gama'],ES:['Vitória','Vila Velha','Serra','Cariacica','Linhares','Cachoeiro de Itapemirim','Guarapari'],GO:['Goiânia','Aparecida de Goiânia','Anápolis','Rio Verde','Luziânia','Trindade','Formosa','Catalão'],MA:['São Luís','Imperatriz','Timon','Caxias','Açailândia'],MG:['Belo Horizonte','Uberlândia','Contagem','Juiz de Fora','Betim','Montes Claros','Uberaba','Governador Valadares','Ipatinga','Sete Lagoas','Divinópolis','Poços de Caldas','Patos de Minas','Varginha','Araguari','Ituiutaba','Araxá'],MS:['Campo Grande','Dourados','Três Lagoas','Corumbá','Ponta Porã'],MT:['Cuiabá','Várzea Grande','Rondonópolis','Sinop','Tangará da Serra'],PA:['Belém','Ananindeua','Santarém','Marabá','Castanhal','Parauapebas'],PB:['João Pessoa','Campina Grande','Santa Rita','Patos'],PE:['Recife','Caruaru','Olinda','Petrolina','Paulista','Garanhuns','Jaboatão dos Guararapes'],PI:['Teresina','Parnaíba','Picos','Floriano'],PR:['Curitiba','Londrina','Maringá','Ponta Grossa','Cascavel','São José dos Pinhais','Foz do Iguaçu','Colombo','Guarapuava'],RJ:['Rio de Janeiro','São Gonçalo','Duque de Caxias','Nova Iguaçu','Niterói','Belford Roxo','Campos dos Goytacazes','Petrópolis','Macaé','Volta Redonda','Cabo Frio'],RN:['Natal','Mossoró','Parnamirim'],RO:['Porto Velho','Ji-Paraná','Cacoal','Ariquemes'],RR:['Boa Vista'],RS:['Porto Alegre','Caxias do Sul','Pelotas','Canoas','Santa Maria','Gravataí','Novo Hamburgo','São Leopoldo','Rio Grande','Passo Fundo'],SC:['Florianópolis','Joinville','Blumenau','São José','Chapecó','Criciúma','Itajaí','Jaraguá do Sul','Balneário Camboriú'],SE:['Aracaju','Nossa Senhora do Socorro','Lagarto'],SP:['São Paulo','Guarulhos','Campinas','São Bernardo do Campo','Santo André','Osasco','Ribeirão Preto','Sorocaba','Mauá','São José dos Campos','Santos','Mogi das Cruzes','Diadema','Jundiaí','Piracicaba','Bauru','São José do Rio Preto','Franca','Guarujá','Limeira','Praia Grande','Suzano','Taubaté','Barueri','Americana','São Vicente','Marília','São Carlos','Botucatu','Presidente Prudente'],TO:['Palmas','Araguaína','Gurupi']};

function populateStates(){
  var s=el('crm-o-estado');if(!s)return;
  var cur=s.value;s.innerHTML='<option value="">Selecione o estado...</option>';
  Object.keys(ESTADOS).sort().forEach(function(uf){var o=document.createElement('option');o.value=uf;o.textContent=uf+' – '+ESTADOS[uf];if(uf===cur)o.selected=true;s.appendChild(o);});
}
window.crmLoadCities=function(){setVal('crm-o-cidade-nac','');var ac=el('crm-city-ac');if(ac)ac.style.display='none';};
window.crmCityAC=function(){
  var uf=val('crm-o-estado'),q=val('crm-o-cidade-nac').toLowerCase().trim();
  var ac=el('crm-city-ac');if(!ac)return;
  if(!q){ac.style.display='none';return;}
  var cities=uf&&CIDADES[uf]?CIDADES[uf]:Object.values(CIDADES).reduce(function(a,b){return a.concat(b);});
  var matches=cities.filter(function(c){return c.toLowerCase().includes(q);}).slice(0,10);
  if(!matches.length){ac.style.display='none';return;}
  ac.innerHTML='';ac.style.display='block';
  matches.forEach(function(c){var i=document.createElement('div');i.className='crm-ac-item';i.textContent=c;i.onmousedown=function(e){e.preventDefault();setVal('crm-o-cidade-nac',c);ac.style.display='none';};ac.appendChild(i);});
};

/* ── Searchable Dropdowns ────────────────────────── */
window.crmToggleDrop=function(ddId){
  var dd=el(ddId);if(!dd)return;
  var was=dd.classList.contains('open');
  document.querySelectorAll('.crm-select-dropdown.open').forEach(function(d){d.classList.remove('open');});
  if(!was){dd.classList.add('open');var si=dd.querySelector('input[type=text]');if(si){si.value='';crmFilterDrop(ddId,'');si.focus();}}
};
window.crmFilterDrop=function(ddId,q){
  q=q.toLowerCase();
  var dd=el(ddId);if(!dd)return;
  dd.querySelectorAll('.crm-select-opt').forEach(function(opt){opt.style.display=(!q||opt.textContent.toLowerCase().includes(q))?'flex':'none';});
};

function buildDrop(ddId,items,onSelect,current){
  var dd=el(ddId);if(!dd)return;
  var opts=dd.querySelector('[id$="-opts"]');if(!opts)return;
  opts.innerHTML='';
  items.forEach(function(item){
    var label=typeof item==='object'?item.name:item;
    var v=typeof item==='object'?item.name:item;
    var opt=document.createElement('div');opt.className='crm-select-opt'+(v===current?' selected':'');
    if(typeof item==='object'&&item.color){
      opt.innerHTML='<div class="crm-avatar" style="background:'+item.color+';width:20px;height:20px;font-size:9px">'+label.charAt(0)+'</div>'+escH(label);
    } else opt.textContent=label;
    opt.onclick=function(){dd.querySelectorAll('.crm-select-opt').forEach(function(o){o.classList.remove('selected');});opt.classList.add('selected');onSelect(v,label);dd.classList.remove('open');};
    opts.appendChild(opt);
  });
}

/* ── Weiku rep field show/hide ───────────────────── */
function showWeikunField(show){
  var f=el('crm-weiku-field');if(!f)return;
  f.style.display=show?'block':'none';
  if(show){
    // Build reps dropdown
    var reps=[];
    // Try from engine
    var engSel=document.getElementById('rep-sel');
    if(engSel){reps=Array.from(engSel.options).filter(function(o){return o.value;}).map(function(o){return o.text||o.value;});}
    // From settings
    var settReps=gWReps();settReps.forEach(function(r){if(!reps.includes(r))reps.push(r);});
    buildDrop('crm-wrep-dd',reps,function(v){setVal('crm-o-wrep',v);el('crm-o-wrep-text').textContent=v;},val('crm-o-wrep'));
    if(reps.length===0){
      var d=el('crm-wrep-dd');if(d){var opts=d.querySelector('#crm-wrep-opts');if(opts)opts.innerHTML='<div style="padding:10px 12px;font-size:11px;color:var(--muted)">Nenhum representante cadastrado.<br>Adicione em ⚙️ Configurar → Equipe</div>';}
    }
  }
}
window.crmToggleWeikunField=showWeikunField; // expose

function showParceiroField(show){
  var f=el('crm-parceiro-field');if(!f)return;
  f.style.display=show?'block':'none';
}

function buildSelects(opp){
  // Products
  buildDrop('crm-product-dd',gProducts(),function(v){setVal('crm-o-produto',v);el('crm-o-product-text').textContent=v;},opp?opp.produto:'');
  if(opp&&opp.produto)el('crm-o-product-text').textContent=opp.produto;
  else el('crm-o-product-text').textContent='Selecione...';

  // Team
  var team=gTeam();
  buildDrop('crm-resp-dd',team,function(v){
    setVal('crm-o-resp',v);
    var m=team.find(function(t){return t.name===v;});
    el('crm-o-resp-text').innerHTML=(m?'<div class="crm-avatar" style="background:'+m.color+';width:20px;height:20px;font-size:9px">'+v.charAt(0)+'</div>':'')+escH(v);
  },opp?opp.responsavel:'');
  if(opp&&opp.responsavel){
    var m=team.find(function(t){return t.name===opp.responsavel;});
    el('crm-o-resp-text').innerHTML=(m?'<div class="crm-avatar" style="background:'+m.color+';width:20px;height:20px;font-size:9px">'+opp.responsavel.charAt(0)+'</div>':'')+escH(opp.responsavel);
    setVal('crm-o-resp',opp.responsavel);
  } else {el('crm-o-resp-text').textContent='Selecione...';setVal('crm-o-resp','');}

  // Origins — with Weiku trigger
  var dd=el('crm-orig-dd');var opts=el('crm-orig-opts');if(opts)opts.innerHTML='';
  gOrigins().forEach(function(orig){
    var opt=document.createElement('div');opt.className='crm-select-opt'+(opp&&opp.origem===orig?' selected':'');
    var icon=orig==='Weiku do Brasil'?'👤 ':orig==='WhatsApp'?'💬 ':orig==='Instagram'?'📸 ':orig==='Parceiro'?'🤝 ':'';
    opt.innerHTML='<span>'+icon+escH(orig)+'</span>';
    opt.onclick=function(){
      dd.querySelectorAll('.crm-select-opt').forEach(function(o){o.classList.remove('selected');});
      opt.classList.add('selected');
      setVal('crm-o-origem',orig);
      el('crm-o-orig-text').textContent=icon+orig;
      dd.classList.remove('open');
      // Reset Weiku rep when changing origin
      if(orig==='Weiku do Brasil'){
        setVal('crm-o-wrep','');
        if(el('crm-o-wrep-text'))el('crm-o-wrep-text').textContent='Selecione o representante...';
      }
      showWeikunField(orig==='Weiku do Brasil');
      showParceiroField(orig==='Parceiro');
    };
    opts.appendChild(opt);
  });
  if(opp&&opp.origem){el('crm-o-orig-text').textContent=opp.origem;setVal('crm-o-origem',opp.origem);}
  else{el('crm-o-orig-text').textContent='Selecione...';setVal('crm-o-origem','');}

  showWeikunField(opp&&opp.origem==='Weiku do Brasil');
  showParceiroField(opp&&opp.origem==='Parceiro');
  if(opp&&opp.parceiro_nome){
    var pnEl=document.getElementById('crm-o-parceiro-nome');
    if(pnEl) pnEl.value=opp.parceiro_nome;
  }
  if(opp&&opp.wrep){
    setVal('crm-o-wrep',opp.wrep);
    if(el('crm-o-wrep-text'))el('crm-o-wrep-text').textContent=opp.wrep;
  }
}

function buildStagePills(curId){
  var sel=el('crm-stage-select');if(!sel)return;
  sel.innerHTML='';
  gStages().forEach(function(s){
    var opt=document.createElement('option');opt.value=s.id;opt.textContent=s.icon+' '+s.label;
    if(s.id===curId)opt.selected=true;
    sel.appendChild(opt);
  });
  _stageId=curId||gStages()[0].id;
  crmUpdateStageDisplay();
}
window.crmUpdateStageDisplay=function(){
  var sel=el('crm-stage-select');var cur=el('crm-stage-current');
  if(!sel||!cur)return;
  var sid=sel.value;_stageId=sid;
  var st=gStages().find(function(s){return s.id===sid;});
  if(st){cur.style.background=st.color;cur.textContent=st.icon+' '+st.label;}
  var stages=gStages();var idx=stages.findIndex(function(s){return s.id===sid;});
  // Prioridade + Potencial: show from Qualificação (index 1) onwards
  var priField=el('crm-prioridade-field');
  if(priField) priField.style.display=(idx>=1)?'grid':'none';
  // Previsão de Fechamento: hide on Prospecção (index 0)
  var fechField=el('crm-fechamento-field');
  if(fechField) fechField.style.display=(idx>=1)?'block':'none';
  // Reserva: show from Fazer Orçamento (index 2) onwards
  var resRow=el('crm-reserva-agp-row');
  if(resRow) resRow.style.display=(idx>=2)?'grid':'none';
  // AGP: show from Fazer Orçamento (index 2) onwards
  var agpField=el('crm-agp-field');
  if(agpField) agpField.style.display=(idx>=2)?'block':'none';
  // Update field highlights
  crmCheckFieldHighlights();
};

/* ── Highlight new fields only when empty ──────── */
function crmCheckFieldHighlights(){
  document.querySelectorAll('.crm-field-new').forEach(function(field){
    var inp=field.querySelector('input,select');
    if(inp&&inp.value&&inp.value.trim()&&inp.value!==''){
      field.classList.add('crm-field-filled');
    } else {
      field.classList.remove('crm-field-filled');
    }
  });
}
// Attach listeners to new fields
document.addEventListener('change',function(e){
  if(e.target.closest&&e.target.closest('.crm-field-new'))crmCheckFieldHighlights();
});
document.addEventListener('input',function(e){
  if(e.target.closest&&e.target.closest('.crm-field-new'))crmCheckFieldHighlights();
});

/* ── Open Modal ──────────────────────────────────── */
window.crmOpenModal=function(defaultStage,editId){
  _editId=editId||null;
  var modal=el('crm-opp-modal');if(!modal)return;
  populateStates();
  if(typeof _populateCorSelects==='function')_populateCorSelects();
  var opp=editId?cLoad().find(function(o){return o.id===editId;}):null;
  var sid=opp?opp.stage:(defaultStage||gStages()[0].id);
  buildStagePills(sid);
  buildSelects(opp);
  el('crm-modal-title').textContent=editId?'Editar Oportunidade':'Nova Oportunidade';
  el('crm-modal-sub').textContent=opp?'Criado em '+dateLabel(opp.createdAt):'';
  el('crm-del-btn').style.display=editId?'flex':'none';
  if(opp){
    // Load itens
    if(opp.itens&&opp.itens.length>0){
      _crmItensFromCardData(opp.itens);
    } else if(opp.largura&&opp.altura){
      // Backward compat: convert old single-item to itens array
      _crmItensFromCardData([{tipo:'porta_pivotante',qtd:1,largura:opp.largura,altura:opp.altura,modelo:opp.modelo||'',abertura:opp.abertura||'PIVOTANTE',folhas:opp.folhas||'1',cor_ext:opp.cor_ext||'',cor_int:opp.cor_int||'',cor_macico:opp.cor_macico||''}]);
    } else {
      _crmItens=[];_crmItensRender();
    }
    setVal('crm-o-cliente',opp.cliente);setVal('crm-o-contato',opp.contato);setVal('crm-o-email',opp.email||'');
    setVal('crm-o-data-contato',opp.dataContato||opp.createdAt?(opp.dataContato||opp.createdAt.slice(0,10)):'');
    setVal('crm-o-valor',opp.valor||'');setVal('crm-o-fechamento',opp.fechamento);
    setVal('crm-o-prioridade',opp.prioridade||'');setVal('crm-o-potencial',opp.potencial||'');setVal('crm-o-notas',opp.notas);
    setVal('crm-o-largura',opp.largura||'');setVal('crm-o-altura',opp.altura||'');
    setVal('crm-o-abertura',opp.abertura||'');setVal('crm-o-modelo',opp.modelo||'');
    setVal('crm-o-folhas',opp.folhas||'1');
    setVal('crm-o-cor-ext',opp.cor_ext||'');setVal('crm-o-cor-int',opp.cor_int||'');setVal('crm-o-cor-macico',opp.cor_macico||'');
    setVal('crm-o-reserva',opp.reserva||'');setVal('crm-o-agp',opp.agp||'');
    setVal('crm-o-cep',opp.cep||'');
    // Instalação
    setVal('crm-o-inst-quem',opp.inst_quem||'PROJETTA');
    setVal('crm-o-inst-valor',opp.inst_valor||'');
    setVal('crm-o-inst-transp',opp.inst_transp||'');
    setVal('crm-o-inst-pais',opp.inst_pais||'');
    setVal('crm-o-inst-aero',opp.inst_aero||'');
    setVal('crm-o-inst-porte',opp.inst_porte||'M');
    setVal('crm-o-inst-pessoas',opp.inst_pessoas||3);
    setVal('crm-o-inst-dias',opp.inst_dias||3);
    setVal('crm-o-inst-udigru',opp.inst_udigru||2000);
    setVal('crm-o-inst-passagem',opp.inst_passagem||10000);
    setVal('crm-o-inst-hotel',opp.inst_hotel||1700);
    setVal('crm-o-inst-alim',opp.inst_alim||300);
    setVal('crm-o-inst-seguro',opp.inst_seguro||300);
    setVal('crm-o-inst-carro',opp.inst_carro||850);
    setVal('crm-o-inst-mo',opp.inst_mo||500);
    setVal('crm-o-inst-margem',opp.inst_margem||10);
    setVal('crm-o-inst-cambio',opp.inst_cambio||5.20);
    if(typeof crmInstQuemChange==='function') crmInstQuemChange();
    var cepSt=el('crm-cep-status');if(cepSt)cepSt.textContent='';
    crmSetScope(opp.scope||'nacional');
    if(opp.scope==='internacional'){setVal('crm-o-pais',opp.pais);setVal('crm-o-cidade-intl',opp.cidade);}
    else{setVal('crm-o-estado',opp.estado||'');setVal('crm-o-cidade-nac',opp.cidade||'');}
    // Load attachments from cloud
    _modalAttachs=[];
    crmRenderAttachments();
    var loadingDiv=el('crm-attach-grid');
    if(loadingDiv)loadingDiv.innerHTML='<div style="font-size:11px;color:var(--hint);padding:6px 0">⏳ Carregando anexos...</div>';
    crmLoadAttachCloud(editId,function(cloudAttachs){
      _modalAttachs=cloudAttachs||[];
      crmRenderAttachments();
    });
    // Render revision history
    var revSec=el('crm-revisoes-section');
    var revList=el('crm-revisoes-list');
    if(revSec&&revList){
      if(opp.revisoes&&opp.revisoes.length>0){
        revSec.style.display='block';
        var rh='<table style="width:100%;border-collapse:collapse;font-size:13px">';
        rh+='<tr style="border-bottom:2px solid var(--border-light)"><th style="padding:8px 10px;text-align:left;color:var(--hint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">Rev</th><th style="padding:8px 10px;text-align:left;color:var(--hint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">Data</th><th style="padding:8px 10px;text-align:right;color:var(--hint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">Tabela</th><th style="padding:8px 10px;text-align:right;color:var(--hint);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">Faturamento</th><th style="width:40px"></th></tr>';
        opp.revisoes.forEach(function(rv,ri){
          var isLast=ri===opp.revisoes.length-1;
          var bg=isLast?'background:rgba(0,49,68,.06)':'';
          var revDisplay=ri===0?(rv.label||'Original'):(rv.label||'Revisão '+ri);
          // Valores: CRM revision é autoritativo (usuario aprovou esses valores)
          var _dispTab=rv.valorTabela||0, _dispFat=rv.valorFaturamento||0;
          rh+='<tr style="border-bottom:1px solid var(--border-light);'+bg+'">';
          rh+='<td style="padding:8px 10px;font-weight:700;font-size:13px;color:'+(ri===0?'#27ae60':'#9b59b6')+';cursor:pointer;text-decoration:underline" onclick="crmAbrirRevisao(\''+editId+'\','+ri+')" title="Clique para abrir Memorial e carregar no Orçamento">'+revDisplay+(isLast?' ✓':'')+'</td>';
          rh+='<td style="padding:8px 10px;color:var(--muted);font-size:13px">'+new Date(rv.data).toLocaleDateString('pt-BR')+'</td>';
          rh+='<td style="padding:8px 10px;text-align:right;font-weight:700;font-size:13px;color:var(--navy)">'+brl(_dispTab)+'</td>';
          rh+='<td style="padding:8px 10px;text-align:right;font-weight:800;font-size:13px;color:#e67e22">'+brl(_dispFat)+'</td>';
          var hasProposal=opp.revisoes[ri].pdfCloud||(opp.revisoes[ri].pdfPages&&opp.revisoes[ri].pdfPages.length>0);
          rh+='<td style="padding:4px 6px;text-align:center;white-space:nowrap">';
          if(hasProposal) rh+='<button onclick="event.stopPropagation();crmVerProposta(\''+editId+'\','+ri+')" style="background:none;border:1px solid #27ae60;color:#27ae60;border-radius:6px;font-size:10px;cursor:pointer;padding:3px 6px;font-weight:700;margin-right:3px" title="Ver proposta salva">📄</button>';
          rh+='<button onclick="crmDeleteRevision(\''+editId+'\','+ri+')" style="background:none;border:1px solid #e74c3c;color:#e74c3c;border-radius:6px;font-size:10px;cursor:pointer;padding:3px 6px;font-weight:700" title="Excluir revisão">✕</button></td>';
          rh+='</tr>';
        });
        rh+='</table>';
        // Dropdown para escolher qual revisão exibe no pipeline
        rh+='<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
        rh+='<label style="font-size:11px;font-weight:700;color:var(--navy)">📊 Valor no Pipeline:</label>';
        rh+='<select id="crm-rev-pipeline-sel" onchange="crmSetPipelineRev(\''+editId+'\',this.value)" style="padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">';
        opp.revisoes.forEach(function(rv,ri){
          var revDisplay=ri===0?(rv.label||'Original'):(rv.label||'Revisão '+ri);
          var sel=(opp.revPipeline===ri||(opp.revPipeline===undefined&&ri===opp.revisoes.length-1))?'selected':'';
          rh+='<option value="'+ri+'" '+sel+'>'+revDisplay+' — '+brl(rv.valorFaturamento||0)+'</option>';
        });
        rh+='</select>';
        rh+='</div>';
        rh+='<div style="margin-top:10px;display:flex;gap:8px">';
        rh+='<button onclick="crmAbrirRevisao(\''+editId+'\','+(opp.revisoes.length-1)+')" style="background:#e67e22;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">📋 Abrir Memorial</button>';
        rh+='<button onclick="crmNovaRevisao(\''+editId+'\')" style="background:#003144;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">➕ Nova Revisão</button>';
        rh+='</div>';
        revList.innerHTML=rh;
      } else {
        revSec.style.display='none';
        revList.innerHTML='';
      }
    }
  } else {
    ['crm-o-cliente','crm-o-contato','crm-o-email','crm-o-valor','crm-o-notas','crm-o-pais','crm-o-cidade-intl','crm-o-cidade-nac','crm-o-largura','crm-o-altura','crm-o-cep'].forEach(function(id){setVal(id,'');});
    _crmItens=[];_crmItensRender();
    setVal('crm-o-data-contato',new Date().toISOString().slice(0,10));
    setVal('crm-o-fechamento','');setVal('crm-o-prioridade','');setVal('crm-o-potencial','');
    setVal('crm-o-abertura','');setVal('crm-o-modelo','');setVal('crm-o-estado','');
    setVal('crm-o-folhas','');setVal('crm-o-reserva','');setVal('crm-o-agp','');setVal('crm-o-cor-ext','');setVal('crm-o-cor-int','');
    setVal('crm-o-inst-quem','PROJETTA');setVal('crm-o-inst-valor','');setVal('crm-o-inst-transp','');
    setVal('crm-o-inst-pais','');setVal('crm-o-inst-aero','');setVal('crm-o-inst-porte','M');
    setVal('crm-o-inst-pessoas',3);setVal('crm-o-inst-dias',3);setVal('crm-o-inst-udigru',2000);
    setVal('crm-o-inst-passagem',10000);setVal('crm-o-inst-hotel',1700);setVal('crm-o-inst-alim',300);
    setVal('crm-o-inst-seguro',300);setVal('crm-o-inst-carro',850);setVal('crm-o-inst-mo',500);
    setVal('crm-o-inst-margem',10);setVal('crm-o-inst-cambio',5.20);
    if(typeof crmInstQuemChange==='function') crmInstQuemChange();
    var cepSt=el('crm-cep-status');if(cepSt)cepSt.textContent='';
    crmSetScope('nacional');showWeikunField(false);
    _modalAttachs=[];crmRenderAttachments();
    // Hide revision history for new entries
    var revSec=el('crm-revisoes-section');if(revSec)revSec.style.display='none';
  }
  modal.classList.add('open');
  setTimeout(function(){var c=el('crm-o-cliente');if(c)c.focus();crmCheckFieldHighlights();},120);
};
window.crmCloseModal=function(){el('crm-opp-modal').classList.remove('open');_editId=null;};

/* ── SAVE — captura TODOS os campos diretamente ──── */
// Buscar Reserva Weiku no CRM modal
window.crmBuscarReservaWeiku=function(){
  var numEl=document.getElementById('crm-o-reserva');
  var num=(numEl?numEl.value:'').trim();
  var status=document.getElementById('crm-reserva-status');
  if(!num){if(status){status.textContent='⚠ Digite o nº da reserva';status.style.color='#b71c1c';}return;}
  if(status){status.textContent='⏳ Buscando reserva '+num+' na Weiku...';status.style.color='var(--orange)';}

  // Helper: preencher campos do CRM modal a partir dos dados encontrados
  function _preencherCRM(found){
    var nome=found.nome||found.cliente||found.name||found.razao_social||'';
    var email=found.email||found.e_mail||'';
    var tel=found.telefone||found.fone||found.whatsapp||found.celular||found.phone||'';
    var cep=found.cep||found.zip||'';
    var agp=found.agp||found.ag||found.num_agp||found.codigo_agp||'';
    var cidade=found.cidade||found.city||'';
    var uf=found.uf||found.estado||found.state||'';
    var cidadeUf=found.cidade_uf||(cidade&&uf?cidade+'/'+uf:cidade||'');
    var rep=found.representante||found.rep||found.vendedor||found.follow_up||'';
    var produto=found.produto||found.product||found.reserva_para||'';

    var nEl=document.getElementById('crm-o-cliente');if(nEl&&nome)nEl.value=typeof _toTitleCase==='function'?_toTitleCase(nome):nome;
    var eEl=document.getElementById('crm-o-email');if(eEl&&email)eEl.value=email;
    var tEl=document.getElementById('crm-o-contato');if(tEl&&tel)tEl.value=tel;
    if(cep&&cep!=='XXX'){var cEl=document.getElementById('crm-o-cep');if(cEl){cEl.value=cep;if(typeof crmBuscarCep==='function')setTimeout(crmBuscarCep,300);}}
    var aEl=document.getElementById('crm-o-agp');if(aEl&&agp)aEl.value=agp;

    // Cidade/UF
    if(cidadeUf){
      var parts=cidadeUf.split('/');
      var crmCidade=document.getElementById('crm-o-cidade');if(crmCidade)crmCidade.value=(parts[0]||'').trim();
      var crmUf=document.getElementById('crm-o-estado');
      if(crmUf&&(parts[1]||uf)){
        var ufVal=(parts[1]||uf||'').trim().toUpperCase();
        for(var i=0;i<crmUf.options.length;i++){
          if(crmUf.options[i].value===ufVal||crmUf.options[i].text.toUpperCase().indexOf(ufVal)>=0){crmUf.selectedIndex=i;break;}
        }
      }
    }

    // Representante Weiku
    if(rep){
      var repW=document.getElementById('crm-o-wrep');
      if(!repW) repW=document.getElementById('crm-o-rep-weiku');
      if(repW){
        var rn=rep.toUpperCase();
        for(var i=0;i<repW.options.length;i++){
          if(repW.options[i].text.toUpperCase().indexOf(rn)>=0){repW.selectedIndex=i;break;}
        }
      }
    }

    // Produto
    if(produto){
      var prodHidden=document.getElementById('crm-o-produto');
      var prodText=document.getElementById('crm-o-product-text');
      if(prodHidden){
        var pn=produto.toUpperCase();
        var products=gProducts();
        var pm=products.find(function(p){return p.toUpperCase().indexOf(pn)>=0;});
        if(pm){prodHidden.value=pm;if(prodText)prodText.textContent=pm;}
      }
    }

    // Status
    var campos=[];
    if(nome)campos.push('Nome');if(email)campos.push('Email');if(tel)campos.push('WhatsApp');
    if(cep&&cep!=='XXX')campos.push('CEP');if(cidadeUf)campos.push('Cidade');if(rep)campos.push('Rep');if(agp)campos.push('AGP');
    if(status){
      status.innerHTML='✅ <b>'+num+'</b> — '+(typeof _toTitleCase==='function'?_toTitleCase(nome):nome)+(cidadeUf?' | '+cidadeUf:'')+(agp?' | <span style="color:#c0392b;font-weight:800">'+agp+'</span>':'')+' <span style="color:#888">('+campos.join(', ')+')</span>';
      status.style.color='#27ae60';
    }
  }

  // 1) Tentar API Weiku direta
  fetch('https://intranet.weiku.com.br/v2/api/reservas/reserva/'+num,{
    method:'GET',headers:{'Accept':'application/json'},mode:'cors'
  }).then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  }).then(function(data){
    // API pode retornar objeto direto ou {data: {...}} ou array
    var found=data;
    if(data.data) found=data.data;
    if(Array.isArray(found)) found=found[0];
    if(!found||(!found.nome&&!found.cliente&&!found.name&&!found.razao_social)){
      throw new Error('Reserva não encontrada na API');
    }
    console.log('[WeikuAPI] Reserva '+num+' encontrada:', found);
    _preencherCRM(found);
  }).catch(function(apiErr){
    console.warn('[WeikuAPI] Falha, tentando Supabase:', apiErr.message);
    if(status){status.textContent='⏳ API indisponível, buscando no cache...';status.style.color='var(--orange)';}
    // 2) Fallback: Supabase cache
    var SB='https://plmliavuwlgpwaizfeds.supabase.co';
    var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
    Promise.all([
      fetch(SB+'/rest/v1/configuracoes?chave=eq.weiku_reservas_detalhe&select=valor&limit=1',{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}).then(function(r){return r.json();}),
      fetch(SB+'/rest/v1/configuracoes?chave=eq.weiku_reservas&select=valor&limit=1',{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}}).then(function(r){return r.json();})
    ]).then(function(results){
      var detalhes=(results[0]&&results[0][0]&&results[0][0].valor)?results[0][0].valor.reservas:[];
      var basicas=(results[1]&&results[1][0]&&results[1][0].valor)?results[1][0].valor.reservas:[];
      var found=detalhes.find(function(r){return r.reserva===num;})||basicas.find(function(r){return r.reserva===num||r.ag===num;});
      if(!found){
        if(status){status.textContent='⚠ Reserva '+num+' não encontrada (API offline + cache vazio)';status.style.color='#b71c1c';}
        return;
      }
      _preencherCRM(found);
    }).catch(function(e){
      if(status){status.textContent='❌ Erro: '+e.message;status.style.color='#b71c1c';}
    });
  });
};


/* ═══ CRM ITEMS SYSTEM ═══════════════════════════════════════════ */
window._crmItens = [];

var CRM_ITEM_TYPES = {
  porta_pivotante: {label:'Porta Pivotante', icon:'🚪', desc:'Porta de entrada com pivô'},
  fixo:            {label:'Fixo / Lateral',   icon:'🔲', desc:'Vidro fixo, lateral ou bandeira'},
  porta_interna:   {label:'Porta Interna',    icon:'🚪', desc:'Em breve', disabled:true},
  revestimento:    {label:'Revestimento',     icon:'🧱', desc:'Em breve', disabled:true}
};

window._crmGetCorOptions=function(mode){
  // mode: 'alu' = ALU categories only; default = ACM full list
  if(mode==='alu'){
    return '<option value="">— Selecione —</option><option value="ALU SOLIDA METALIZADA">Sólida / Metalizada</option><option value="ALU MADEIRA">Madeira</option>';
  }
  var mainSel=document.getElementById('carac-cor-ext');
  if(mainSel&&mainSel.options.length>1){
    var h='<option value="">— Selecione —</option>';
    for(var i=1;i<mainSel.options.length;i++) h+='<option value="'+mainSel.options[i].value+'">'+mainSel.options[i].text+'</option>';
    return h;
  }
  return '<option value="">— Selecione —</option>';
}

window._crmSwitchCorMode=function(itemId){
  var pre='crm-item-'+itemId+'-';
  var modEl=document.getElementById(pre+'modelo');
  var revEl=document.getElementById(pre+'moldura_rev');
  var mod=modEl?modEl.value:'';
  var rev=revEl?revEl.value:'ACM';
  var mode=(mod==='23'&&rev==='MACICO')?'alu':'acm';
  var opts=_crmGetCorOptions(mode);
  ['cor_ext','cor_int'].forEach(function(f){
    var sel=document.getElementById(pre+f);
    if(sel){var v=sel.value;sel.innerHTML=opts;if(v)sel.value=v;}
  });
}

window.crmItemAdd=function(){
  // Show type picker
  var list=document.getElementById('crm-itens-list');
  var empty=document.getElementById('crm-itens-empty');
  // Check if picker already open
  if(document.getElementById('crm-type-picker')){document.getElementById('crm-type-picker').remove();return;}
  var picker=document.createElement('div');
  picker.id='crm-type-picker';
  picker.className='crm-type-picker';
  Object.keys(CRM_ITEM_TYPES).forEach(function(key){
    var t=CRM_ITEM_TYPES[key];
    picker.innerHTML+='<div class="crm-type-btn'+(t.disabled?' disabled':'')+'" onclick="'+(t.disabled?'':'crmItemCreate(\''+key+'\')')+'"><span class="icon">'+t.icon+'</span><span class="lbl">'+t.label+'</span><span class="desc">'+t.desc+'</span></div>';
  });
  list.parentNode.insertBefore(picker,list);
}

window.crmItemCreate=function(tipo){
  var picker=document.getElementById('crm-type-picker');if(picker)picker.remove();
  var item={
    id:'ci_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),
    tipo:tipo,
    qtd:1,
    largura:'',altura:'',
    cor_ext:'',cor_int:'',cor_macico:''
  };
  if(tipo==='porta_pivotante'){
    item.modelo='';item.abertura='PIVOTANTE';item.folhas='';
    item.fech_mec='';item.fech_dig='NÃO SE APLICA';item.cilindro='KESO';item.puxador='';
    item.dist_borda_cava='210';item.largura_cava='150';item.cantoneira_cava='30';
    item.tem_alisar=true;
  }
  if(tipo==='fixo'){
    item.tipo_fixacao='';item.revestimento_lados='';item.tem_estrutura='';
    item.tipo_material='';item.tipo_vidro='';
  }
  _crmItens.push(item);
  _crmItensRender();
  setTimeout(function(){
    var el=document.getElementById('crm-item-'+item.id);
    if(el)el.classList.add('open');
  },50);
}

window.crmItemRemove=function(id){
  if(!confirm('Remover este item?'))return;
  _crmItens=_crmItens.filter(function(i){return i.id!==id;});
  _crmItensRender();
}

// ── Auto-seleção por altura, modelo e fechadura digital ──
window.crmItemAutoSelect=function(id){
  var item=_crmItens.find(function(i){return i.id===id;});
  if(!item||item.tipo!=='porta_pivotante')return;
  var pre='crmit-'+id+'-';
  var H=parseInt((document.getElementById(pre+'altura')||{value:0}).value)||0;
  var modelo=(document.getElementById(pre+'modelo')||{value:''}).value;
  var fechDig=(document.getElementById(pre+'fech_dig')||{value:''}).value.toUpperCase();

  // Auto-select FECHADURA MECÂNICA por altura (mesma lógica de _autoSelectFechadura)
  if(H>0){
    var TUB=(typeof _isInternacional==='function'&&_isInternacional())?50.8:(H>=4000?50.8:38.1);
    var PA_F=Math.round(H-10-TUB-28+8);
    var inicio=1020;
    if(fechDig.indexOf('PHILIPS')>=0) inicio=1380;
    var opcoes=[
      {val:'24 PINOS',comp:6000},{val:'16 PINOS',comp:4000},
      {val:'12 PINOS',comp:2000},{val:'08 PINOS',comp:800},{val:'04 PINOS',comp:400}
    ];
    var sel=document.getElementById(pre+'fech_mec');
    if(sel){
      var found=false;
      for(var i=0;i<opcoes.length;i++){
        if(inicio+opcoes[i].comp<=PA_F){sel.value=opcoes[i].val;found=true;break;}
      }
      if(!found)sel.value='04 PINOS';
    }
  }

  // Auto-select PUXADOR por modelo (modelos com cava = CAVA, lisa = EXTERNO)
  if(modelo){
    var modInt=parseInt(modelo)||0;
    var cavaMods=[1,2,3,4,5,6,7,8,9,19,22,24]; // modelos com nome "cava"
    var puxSel=document.getElementById(pre+'puxador');
    if(puxSel) puxSel.value=cavaMods.indexOf(modInt)>=0?'CAVA':'EXTERNO';
    // Modelo 22: defaults cava 250/250, friso 0/0
    if(modelo==='22'){
      var dcEl=document.getElementById(pre+'dist_borda_cava');
      var lcEl=document.getElementById(pre+'largura_cava');
      var dfEl=document.getElementById(pre+'dist_borda_friso');
      var lfEl=document.getElementById(pre+'largura_friso');
      if(dcEl&&(!dcEl.value||dcEl.value==='210')) dcEl.value='250';
      if(lcEl&&(!lcEl.value||lcEl.value==='150')) lcEl.value='250';
      if(dfEl&&(!dfEl.value||dfEl.value==='150')) dfEl.value='0';
      if(lfEl&&(!lfEl.value||lfEl.value==='10')) lfEl.value='0';
    }
    // Mostrar/esconder campos de cava ao trocar modelo
    var cavaWrap=document.getElementById(pre+'cava_wrap');
    var frisoWrap=document.getElementById(pre+'friso_wrap');
    if(cavaWrap||frisoWrap){
      var _modSel2=document.getElementById(pre+'modelo');
      var _modTxt2=_modSel2&&_modSel2.selectedIndex>=0?(_modSel2.options[_modSel2.selectedIndex].text||'').toLowerCase():'';
      if(cavaWrap) cavaWrap.style.display=_modTxt2.indexOf('cava')>=0?'':'none';
      if(frisoWrap) frisoWrap.style.display=(_modTxt2.indexOf('friso')>=0||_modTxt2.indexOf('premium')>=0)?'':'none';
      // Toggle friso horizontal vs vertical
      var _isFH=(modelo==='06'||modelo==='16');
      var fhWrap=document.getElementById(pre+'friso_h_wrap');
      var fvWrap=document.getElementById(pre+'friso_v_wrap');
      if(fhWrap) fhWrap.style.display=_isFH?'':'none';
      if(fvWrap) fvWrap.style.display=_isFH?'none':'';
      // Toggle moldura section for modelo 23
      var moldWrap=document.getElementById(pre+'moldura_wrap');
      if(moldWrap) moldWrap.style.display=(modelo==='23')?'':'none';
      // Toggle ripado section for modelos 08, 15, 20, 21
      var ripWrap=document.getElementById(pre+'ripado_wrap');
      if(ripWrap) ripWrap.style.display=(['08','15','20','21'].indexOf(modelo)>=0)?'':'none';
    }
    // Switch cor options: modelo 23 MACICO → ALU only
    if(typeof _crmSwitchCorMode==='function') _crmSwitchCorMode(id);
    // Tamanho puxador: setar 1.5 default e mostrar/esconder
    var puxTamRow=document.getElementById(pre+'pux_tam_row');
    var puxTamSel=document.getElementById(pre+'pux_tam');
    if(cavaMods.indexOf(modInt)<0){
      if(puxTamRow) puxTamRow.style.display='';
      if(puxTamSel&&!puxTamSel.value) puxTamSel.value='1.5';
    } else {
      if(puxTamRow) puxTamRow.style.display='none';
    }
  }
}

// Toggle puxador tamanho visibility no CRM item
window.crmItemPuxChange=function(id){
  var pre='crmit-'+id+'-';
  var pux=(document.getElementById(pre+'puxador')||{value:''}).value;
  var row=document.getElementById(pre+'pux_tam_row');
  if(row) row.style.display=pux==='EXTERNO'?'':'none';
  if(pux==='EXTERNO'){
    var tam=document.getElementById(pre+'pux_tam');
    if(tam&&!tam.value) tam.value='1.5';
  }
}

// Trigger auto-select when altura changes
window.crmItemAlturaChange=function(id){
  crmItemAutoSelect(id);
}

// Show/hide vidro field for fixo items
window.crmItemFixoMaterial=function(id){
  var pre='crmit-'+id+'-';
  var mat=(document.getElementById(pre+'tipo_material')||{value:''}).value;
  var wrap=document.getElementById(pre+'vidro_wrap');
  if(wrap) wrap.style.display=mat==='VIDRO'?'':'none';
}

// Show/hide instalação fields based on Quem instala
window.crmInstQuemChange=function(){
  var sel=document.getElementById('crm-o-inst-quem');
  var terc=document.getElementById('crm-inst-terceiros');
  var intl=document.getElementById('crm-inst-internacional');
  if(!sel)return;
  var v=sel.value;
  if(terc) terc.style.display=(v==='TERCEIROS')?'':'none';
  if(intl) intl.style.display=(v==='INTERNACIONAL')?'':'none';
  if(v==='INTERNACIONAL'){ crmInstCalcIntl(); crmInstFetchCambio(); }
}

window.crmInstPorteChange=function(){
  var porte=(document.getElementById('crm-o-inst-porte')||{value:'M'}).value;
  var pEl=document.getElementById('crm-o-inst-pessoas');
  var dEl=document.getElementById('crm-o-inst-dias');
  if(porte==='P'){if(pEl)pEl.value=2;if(dEl)dEl.value=2;}
  if(porte==='M'){if(pEl)pEl.value=3;if(dEl)dEl.value=3;}
  if(porte==='G'){if(pEl)pEl.value=3;if(dEl)dEl.value=4;}
  crmInstCalcIntl();
}

window.crmInstCalcIntl=function(){
  var gv=function(id){return parseFloat((document.getElementById(id)||{value:0}).value)||0;};
  var pessoas=gv('crm-o-inst-pessoas');
  var diasInst=gv('crm-o-inst-dias');
  var diasViagem=4; // 2 ida + 2 volta fixo
  var diasTotal=diasInst+diasViagem;
  var cambio=gv('crm-o-inst-cambio')||5.20;
  var margemLiq=gv('crm-o-inst-margem')/100;

  var udiGru=gv('crm-o-inst-udigru');
  var passagem=gv('crm-o-inst-passagem')*pessoas;
  var diasHotel=diasTotal-2;
  var hotel=gv('crm-o-inst-hotel')*diasHotel;
  var alim=gv('crm-o-inst-alim')*pessoas*diasTotal;
  var seguro=gv('crm-o-inst-seguro')*pessoas;
  var carro=gv('crm-o-inst-carro')*diasTotal;
  var mo=gv('crm-o-inst-mo')*diasInst;

  var custoTotal=udiGru+passagem+hotel+alim+seguro+carro+mo;

  // DRE — impostos NFS-e exportação (próprio da instalação)
  var pctImp=parseFloat((document.getElementById('inst-intl-imp')||{value:8.65}).value)||0;
  var pctCom=0;
  var pctRep=0;
  var pctGest=0;
  var pctMargemLiq=margemLiq*100;

  // Markup: Preço = Custo / (1 - imp% - com% - rep% - gest% - margem%)
  var totalDeduc=(pctImp+pctCom+pctRep+pctGest+pctMargemLiq)/100;
  var divisor=Math.max(0.01, 1-totalDeduc);
  var precoVenda=custoTotal/divisor;
  var lucroLiq=precoVenda*margemLiq;
  var impostos=precoVenda*(pctImp/100);
  var comissao=precoVenda*(pctCom/100);
  var repasse=precoVenda*(pctRep/100);
  var gestao=precoVenda*(pctGest/100);

  var brl=function(v){return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var usd=function(v){return 'US$ '+(v/cambio).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var dual=function(v){return brl(v)+' <small style="color:#1565c0">('+usd(v)+')</small>';};

  var res=document.getElementById('crm-inst-intl-result');
  if(!res)return;
  var aero=(document.getElementById('crm-o-inst-aero')||{value:''}).value||'???';
  res.innerHTML=
    '<div style="font-size:9px;color:#666;margin-bottom:4px">GRU → <b>'+aero+'</b> · '+pessoas+' pess × '+diasViagem+' dias ('+diasInst+' inst + 2 viagem) · Câmbio: R$ '+cambio.toFixed(2)+'</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:9.5px">'+
    '<div>🛫 UDI→GRU: '+dual(udiGru)+'</div>'+
    '<div>✈️ Passagens ('+pessoas+'p): '+dual(passagem)+'</div>'+
    '<div>🏨 Hotel ('+diasHotel+'d): '+dual(hotel)+'</div>'+
    '<div>🍽️ Alimentação: '+dual(alim)+'</div>'+
    '<div>🏥 Seguro: '+dual(seguro)+'</div>'+
    '<div>🚗 Carro+Gas: '+dual(carro)+'</div>'+
    '<div>👷 Mão de Obra ('+diasInst+'d): '+dual(mo)+'</div>'+
    '</div>'+
    '<hr style="margin:6px 0;border:none;border-top:1px solid #90caf9">'+
    '<div style="font-size:9px;font-weight:700;color:#1565c0;margin-bottom:3px">📊 DRE INSTALAÇÃO</div>'+
    '<div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:2px 8px;font-size:9.5px">'+
    '<div>Custo Total:</div><div>'+brl(custoTotal)+'</div><div style="color:#1565c0">'+usd(custoTotal)+'</div>'+
    '<div style="color:#c0392b">Impostos ('+pctImp.toFixed(1)+'%):</div><div style="color:#c0392b">- '+brl(impostos)+'</div><div style="color:#c0392b">- '+usd(impostos)+'</div>'+
    (pctCom>0?'<div>Comissão ('+pctCom.toFixed(1)+'%):</div><div>- '+brl(comissao)+'</div><div>- '+usd(comissao)+'</div>':'')+
    (pctRep>0?'<div>Repasse ('+pctRep.toFixed(1)+'%):</div><div>- '+brl(repasse)+'</div><div>- '+usd(repasse)+'</div>':'')+
    (pctGest>0?'<div>Gestão ('+pctGest.toFixed(1)+'%):</div><div>- '+brl(gestao)+'</div><div>- '+usd(gestao)+'</div>':'')+
    '</div>'+
    '<hr style="margin:4px 0;border:none;border-top:1px dashed #90caf9">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">'+
    '<div style="color:#27ae60;font-weight:800">💰 Lucro Líq ('+pctMargemLiq.toFixed(0)+'%): '+brl(lucroLiq)+'</div>'+
    '<div style="color:#27ae60;font-weight:700">'+usd(lucroLiq)+'</div>'+
    '</div>'+
    '<div style="background:#003144;color:#fff;padding:6px 10px;border-radius:5px;margin-top:6px;display:flex;justify-content:space-between;font-size:12px;font-weight:800">'+
    '<span>PREÇO VENDA INSTALAÇÃO:</span>'+
    '<span>'+brl(precoVenda)+'</span>'+
    '</div>'+
    '<div style="text-align:right;font-size:10px;color:#1565c0;font-weight:700;margin-top:2px">'+usd(precoVenda)+'</div>';

  window._instIntlTotal=precoVenda;
  window._instIntlCusto=custoTotal;
}

window.crmInstFetchCambio=function(){
  var info=document.getElementById('crm-inst-cambio-info');
  if(info) info.textContent='Buscando cotação BCB...';
  var end=new Date();var start=new Date();start.setDate(start.getDate()-90);
  var fmt=function(d){var m=''+(d.getMonth()+1),dd=''+d.getDate(),y=d.getFullYear();return m+'/'+dd+'/'+y;};
  fetch('https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@di,dataFinalCotacao=@df)?@di=%27'+fmt(start)+'%27&@df=%27'+fmt(end)+'%27&$format=json&$select=cotacaoVenda,dataHoraCotacao')
  .then(function(r){return r.json();})
  .then(function(data){
    var vals=data.value||[];
    if(vals.length>0){
      var sum=0;vals.forEach(function(v){sum+=v.cotacaoVenda;});
      var media=(sum/vals.length).toFixed(2);
      var el=document.getElementById('crm-o-inst-cambio');
      if(el)el.value=media;
      if(info)info.textContent='✅ Média BCB ('+vals.length+' dias): R$ '+media;
      crmInstCalcIntl();
    }
  }).catch(function(e){
    if(info)info.textContent='⚠️ Erro API BCB. Usando default.';
  });
}

window.crmItemDuplicate=function(id){
  var orig=_crmItens.find(function(i){return i.id===id;});
  if(!orig)return;
  var copy=JSON.parse(JSON.stringify(orig));
  copy.id='ci_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);
  _crmItens.push(copy);
  _crmItensRender();
}

window.crmItemToggle=function(id){
  // Save current open item data before toggling
  _crmItensSaveFromDOM();
  var el=document.getElementById('crm-item-'+id);
  if(el)el.classList.toggle('open');
}

/* ── Salvar Item e abrir próximo ── */
window.crmItemSaveAndNext=function(id){
  // 1. Salvar dados do item atual
  _crmItensSaveFromDOM();
  // 2. Fechar item atual
  var el=document.getElementById('crm-item-'+id);
  if(el) el.classList.remove('open');
  // 3. Encontrar próximo item e abrir
  var idx=_crmItens.findIndex(function(it){return it.id===id;});
  if(idx>=0 && idx<_crmItens.length-1){
    var nextId=_crmItens[idx+1].id;
    var nextEl=document.getElementById('crm-item-'+nextId);
    if(nextEl){nextEl.classList.add('open');nextEl.scrollIntoView({behavior:'smooth',block:'start'});}
  }
  // Toast
  var toast=document.createElement('div');toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:8px 18px;border-radius:16px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.2)';
  toast.textContent='💾 Item '+(idx+1)+' salvo!'+(idx<_crmItens.length-1?' → Item '+(idx+2):'');
  document.body.appendChild(toast);setTimeout(function(){toast.remove();},2000);
}

window._crmItensSaveFromDOM=function(){
  _crmItens.forEach(function(item){
    var pre='crmit-'+item.id+'-';
    var fields=['qtd','largura','altura','cor_ext','cor_int','cor_macico'];
    if(item.tipo==='porta_pivotante') fields=fields.concat(['modelo','abertura','folhas','fech_mec','fech_dig','cilindro','puxador','pux_tam','dist_borda_cava','largura_cava','cantoneira_cava','dist_borda_friso','largura_friso','friso_h_qty','friso_h_esp','refilado','moldura_rev','moldura_larg_qty','moldura_alt_qty','ripado_total','ripado_2lados']);
    if(item.tipo==='fixo') fields=fields.concat(['tipo_fixacao','tipo_vidro','revestimento_lados','tem_estrutura','tipo_material']);
    fields.forEach(function(f){
      var el=document.getElementById(pre+f);
      if(el) item[f]=el.value;
    });
    // Checkbox fields
    var _cbAlisar=document.getElementById(pre+'tem_alisar');
    if(_cbAlisar) item.tem_alisar=_cbAlisar.checked;
  });
}

window._crmItensRender=function(){
  var list=document.getElementById('crm-itens-list');
  var empty=document.getElementById('crm-itens-empty');
  if(!list)return;
  
  // Save current values first
  _crmItensSaveFromDOM();
  
  if(!_crmItens.length){
    list.innerHTML='';
    if(empty)empty.style.display='';
    return;
  }
  if(empty)empty.style.display='none';
  
  var corOpts=_crmGetCorOptions();
  var modeloOpts='<option value="">— Selecione —</option><option value="01">01 - Cava</option><option value="02">02 - Cava + Friso</option><option value="03">03 - Cava + 2 Frisos H</option><option value="04">04 - Cava + Friso V&H</option><option value="05">05 - Cava + Friso V & 2H</option><option value="06">06 - Cava + Frisos H Variável</option><option value="07">07 - Cava + Frisos V Múltiplo</option><option value="08">08 - Cava + Ripado</option><option value="09">09 - Cava Dupla</option><option value="10">10 - Lisa</option><option value="11">11 - Friso Vertical</option><option value="12">12 - Pux Ext + Friso V&H</option><option value="13">13 - Pux Ext + Friso V & 2H</option><option value="14">14 - Pux Ext + Frisos V Múltiplo</option><option value="15">15 - Ripado</option><option value="16">16 - Pux Ext + Frisos H Variável</option><option value="17">17 - Pux Ext + Frisos H Inclinado</option><option value="18">18 - Pux Ext + Geométricos</option><option value="19">19 - Cava + Geométricos</option><option value="20">20 - Pux Ext + Ripas H</option><option value="21">21 - Friso Angular</option><option value="22">22 - Cava Premium</option><option value="23">23 - Molduras</option><option value="24">24 - Cava Horizontal</option>';
  
  var h='';
  _crmItens.forEach(function(item,idx){
    var t=CRM_ITEM_TYPES[item.tipo]||{label:item.tipo,icon:'📦'};
    var dimStr=(item.largura&&item.altura)?item.largura+'×'+item.altura+'mm':'sem medidas';
    var modStr=item.modelo?('Mod '+item.modelo):'';
    var sub=[dimStr,modStr,item.cor_ext].filter(Boolean).join(' · ');
    
    h+='<div class="crm-item" id="crm-item-'+item.id+'">';
    h+='<div class="crm-item-hdr" onclick="crmItemToggle(\''+item.id+'\')">';
    h+='<span class="crm-item-icon">'+t.icon+'</span>';
    h+='<div class="crm-item-info"><div class="crm-item-title">Item '+(idx+1)+': '+t.label+'</div><div class="crm-item-sub">'+sub+'</div></div>';
    h+='<div class="crm-item-badges">';
    if(item.qtd>1) h+='<span class="crm-item-badge qty">×'+item.qtd+'</span>';
    if(item.largura&&item.altura) h+='<span class="crm-item-badge dim">'+item.largura+'×'+item.altura+'</span>';
    h+='</div>';
    h+='<span class="crm-item-chevron">▶</span>';
    h+='</div>';
    
    // Body with fields
    var pre='crmit-'+item.id+'-';
    h+='<div class="crm-item-body">';
    
    // Common fields: Qtd, Largura, Altura
    h+='<div class="crm-row">';
    h+='<div class="crm-field"><label>Quantidade</label><input type="number" id="'+pre+'qtd" value="'+(item.qtd||1)+'" min="1" max="50"></div>';
    h+='<div class="crm-field"><label>Largura (mm)</label><input type="number" id="'+pre+'largura" value="'+(item.largura||'')+'" placeholder="ex: 1996" min="200" max="5000" onwheel="event.preventDefault()"></div>';
    h+='</div>';
    h+='<div class="crm-row">';
    h+='<div class="crm-field"><label>Altura (mm)</label><input type="number" id="'+pre+'altura" value="'+(item.altura||'')+'" placeholder="ex: 6174" min="200" max="8000" onchange="crmItemAutoSelect(\''+item.id+'\')" onwheel="event.preventDefault()"></div>';
    
    if(item.tipo==='porta_pivotante'){
      h+='<div class="crm-field"><label>Abertura</label><select id="'+pre+'abertura"><option value="PIVOTANTE"'+(item.abertura==='PIVOTANTE'?' selected':'')+'>Pivotante</option><option value="DOBRADIÇA"'+(item.abertura==='DOBRADIÇA'?' selected':'')+'>Dobradiça</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Modelo</label><select id="'+pre+'modelo" onchange="crmItemAutoSelect(\''+item.id+'\')"><option value="">— Selecione —</option>'+modeloOpts.replace('value="'+item.modelo+'"','value="'+item.modelo+'" selected')+'</select></div>';
      h+='<div class="crm-field"><label>Folhas</label><select id="'+pre+'folhas"><option value="">— Selecione —</option><option value="1"'+(item.folhas==='1'?' selected':'')+'>1 folha</option><option value="2"'+(item.folhas==='2'?' selected':'')+'>2 folhas</option></select></div>';
      h+='</div>';
      // Fechaduras
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🔐 Fechaduras</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Mecânica <small style="color:#888">(auto por altura)</small></label><select id="'+pre+'fech_mec"><option value="">— Selecione —</option><option value="04 PINOS">04 pinos</option><option value="08 PINOS">08 pinos</option><option value="12 PINOS">12 pinos</option><option value="16 PINOS">16 pinos</option><option value="24 PINOS">24 pinos</option></select></div>';
      h+='<div class="crm-field"><label>Digital</label><select id="'+pre+'fech_dig" onchange="crmItemAutoSelect(\''+item.id+'\')"><option value="">— Selecione —</option><option value="NÃO SE APLICA">Não se aplica</option><option value="TEDEE">Tedee</option><option value="PHILIPS 9300">Philips 9300</option><option value="EMTECO">Emteco</option><option value="PHILIPS">Philips</option><option value="NUKI">Nuki</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Cilindro</label><select id="'+pre+'cilindro"><option value="">— Selecione —</option><option value="KESO">Keso</option><option value="UDINESE">Udinese</option></select></div>';
      h+='<div class="crm-field"><label>Puxador <small style="color:#888">(auto por modelo)</small></label><select id="'+pre+'puxador" onchange="crmItemPuxChange(\''+item.id+'\')"><option value="">— Selecione —</option><option value="CAVA">Cava</option><option value="EXTERNO">Puxador Externo</option></select></div>';
      h+='</div>';
      // Tamanho puxador externo
      var _isExt=item.puxador==='EXTERNO'||(!_temCava&&item.modelo);
      h+='<div id="'+pre+'pux_tam_row" class="crm-row" style="'+(_isExt?'':'display:none')+'">';
      h+='<div class="crm-field"><label>Tamanho Puxador</label><select id="'+pre+'pux_tam"><option value="1.0"'+(item.pux_tam==='1.0'?' selected':'')+'>1.0 m (1000mm)</option><option value="1.5"'+(!item.pux_tam||item.pux_tam==='1.5'?' selected':'')+'>1.5 m (1500mm)</option><option value="1.8"'+(item.pux_tam==='1.8'?' selected':'')+'>1.8 m (1800mm)</option><option value="2.0"'+(item.pux_tam==='2.0'?' selected':'')+'>2.0 m (2000mm)</option><option value="CLIENTE"'+(item.pux_tam==='CLIENTE'?' selected':'')+'>Envio pelo Cliente</option></select></div>';
      h+='</div>';
      // Config Cava — sempre renderiza, visibilidade controlada por id
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">✂️ Refilado Tampas</div>';
      h+='<div class="crm-row"><div class="crm-field"><label>Refilado (mm)</label><select id="'+pre+'refilado" style="width:100%"><option value="20"'+(item.refilado==='15'||item.refilado==='10'?'':' selected')+'>20 mm (padrão)</option><option value="15"'+(item.refilado==='15'?' selected':'')+'>15 mm</option><option value="10"'+(item.refilado==='10'?' selected':'')+'>10 mm</option></select></div></div>';
      var _modInt=parseInt(item.modelo)||0;
      var _temCava=false;
      var _modOptMatch=modeloOpts.match(new RegExp('value="'+item.modelo+'"[^>]*>([^<]+)'));
      if(_modOptMatch) _temCava=_modOptMatch[1].toLowerCase().indexOf('cava')>=0;
      h+='<div id="'+pre+'cava_wrap" style="'+(_temCava?'':'display:none')+'">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">⚙️ Configuração da Cava</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Dist. Borda Cava (mm)</label><input type="number" id="'+pre+'dist_borda_cava" value="'+(item.dist_borda_cava||210)+'" min="50" max="500"></div>';
      h+='<div class="crm-field"><label>Largura Cava (mm)</label><input type="number" id="'+pre+'largura_cava" value="'+(item.largura_cava||150)+'" min="50" max="400"></div>';
      h+='</div></div>';
      // Config Friso — visível quando modelo tem "friso" no nome
      var _temFriso=false;
      if(_modOptMatch){var _modTxtLow=_modOptMatch[1].toLowerCase();_temFriso=_modTxtLow.indexOf('friso')>=0||_modTxtLow.indexOf('premium')>=0;}
      if(item.modelo==='22') _temFriso=true;
      var _isFrisoHoriz=(item.modelo==='06'||item.modelo==='16');
      h+='<div id="'+pre+'friso_wrap" style="'+(_temFriso?'':'display:none')+'">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">📐 Configuração do Friso</div>';
      // Friso HORIZONTAL (modelo 06/16): Quantidade + Espessura
      h+='<div id="'+pre+'friso_h_wrap" class="crm-row" style="'+(_isFrisoHoriz?'':'display:none')+'">';
      h+='<div class="crm-field"><label>Quantidade Frisos</label><input type="number" id="'+pre+'friso_h_qty" value="'+(item.friso_h_qty||3)+'" min="1" max="20"></div>';
      h+='<div class="crm-field"><label>Espessura Friso (mm)</label><input type="number" id="'+pre+'friso_h_esp" value="'+(item.friso_h_esp||10)+'" min="1" max="50"></div>';
      h+='</div>';
      // Friso VERTICAL (outros modelos): Dist. Borda + Espessura
      h+='<div id="'+pre+'friso_v_wrap" class="crm-row" style="'+(!_isFrisoHoriz?'':'display:none')+'">';
      h+='<div class="crm-field"><label>Dist. Borda Friso (mm)</label><input type="number" id="'+pre+'dist_borda_friso" value="'+(item.dist_borda_friso||150)+'" min="0" max="500"></div>';
      h+='<div class="crm-field"><label>Espessura Friso (mm)</label><input type="number" id="'+pre+'largura_friso" value="'+(item.largura_friso||10)+'" min="1" max="200"></div>';
      h+='</div>';
      h+='</div>';
      // Config Molduras — visível apenas para modelo 23
      var _isMoldura=(item.modelo==='23');
      h+='<div id="'+pre+'moldura_wrap" style="'+(_isMoldura?'':'display:none')+'">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🏛️ Configuração de Molduras</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Revestimento</label><select id="'+pre+'moldura_rev" onchange="_crmSwitchCorMode(\''+item.id+'\')"><option value="ACM"'+(item.moldura_rev==='ACM'||!item.moldura_rev?' selected':'')+'>ACM 4mm</option><option value="MACICO"'+(item.moldura_rev==='MACICO'?' selected':'')+'>Maciço 2.5mm (Boiserie)</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Molduras na Largura</label><input type="number" id="'+pre+'moldura_larg_qty" value="'+(item.moldura_larg_qty||2)+'" min="1" max="6" onwheel="event.preventDefault()"></div>';
      h+='<div class="crm-field"><label>Molduras na Altura</label><input type="number" id="'+pre+'moldura_alt_qty" value="'+(item.moldura_alt_qty||2)+'" min="1" max="6" onwheel="event.preventDefault()"></div>';
      h+='</div>';
      h+='</div>';
      // Config Ripado — visível para modelos 08, 15, 20, 21
      var _isRipMod=['08','15','20','21'].indexOf(item.modelo)>=0;
      h+='<div id="'+pre+'ripado_wrap" style="'+(_isRipMod?'':'display:none')+'">';
      h+='<div style="font-size:10px;font-weight:700;color:#c47012;margin:8px 0 4px">🔲 Configuração do Ripado</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Ripado Total?</label><select id="'+pre+'ripado_total"><option value="NAO"'+(item.ripado_total==='SIM'?'':' selected')+'>Não (descontando cava/bordas)</option><option value="SIM"'+(item.ripado_total==='SIM'?' selected':'')+'>Sim (largura total)</option></select></div>';
      h+='<div class="crm-field"><label>Ripado 2 lados?</label><select id="'+pre+'ripado_2lados"><option value="SIM"'+(item.ripado_2lados==='NAO'?'':' selected')+'>Sim (frente + verso)</option><option value="NAO"'+(item.ripado_2lados==='NAO'?' selected':'')+'>Não (1 lado)</option></select></div>';
      h+='</div></div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="'+pre+'tem_alisar"'+(item.tem_alisar?' checked':'')+' style="width:14px;height:14px"> Tem Alisar</label></div>';
      h+='<div class="crm-field"></div>';
      h+='</div>';
    } else if(item.tipo==='fixo'){
      h+='<div class="crm-field"><label>Posição</label><select id="'+pre+'tipo_fixacao"><option value="">— Selecione —</option><option value="LATERAL"'+(item.tipo_fixacao==='LATERAL'?' selected':'')+'>Lateral</option><option value="BANDEIRA"'+(item.tipo_fixacao==='BANDEIRA'?' selected':'')+'>Bandeira (superior)</option><option value="INFERIOR"'+(item.tipo_fixacao==='INFERIOR'?' selected':'')+'>Inferior</option></select></div>';
      h+='</div>';
      h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🔲 Configuração do Fixo</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Revestimento</label><select id="'+pre+'revestimento_lados"><option value="">— Selecione —</option><option value="2"'+(item.revestimento_lados==='2'?' selected':'')+'>2 lados</option><option value="1"'+(item.revestimento_lados==='1'?' selected':'')+'>1 lado</option></select></div>';
      h+='<div class="crm-field"><label>Estrutura Alumínio</label><select id="'+pre+'tem_estrutura"><option value="">— Selecione —</option><option value="SIM"'+(item.tem_estrutura==='SIM'?' selected':'')+'>Sim</option><option value="NÃO"'+(item.tem_estrutura==='NÃO'?' selected':'')+'>Não</option></select></div>';
      h+='</div>';
      h+='<div class="crm-row">';
      h+='<div class="crm-field"><label>Tipo Material</label><select id="'+pre+'tipo_material" onchange="crmItemFixoMaterial(\''+item.id+'\')"><option value="">— Selecione —</option><option value="ACM"'+(item.tipo_material==='ACM'?' selected':'')+'>ACM (Chapa)</option><option value="VIDRO"'+(item.tipo_material==='VIDRO'?' selected':'')+'>Vidro</option></select></div>';
      h+='<div class="crm-field" id="'+pre+'vidro_wrap" style="'+(item.tipo_material==='VIDRO'?'':'display:none')+'"><label>Tipo de Vidro</label><select id="'+pre+'tipo_vidro"><option value="">— Selecione —</option><option value="TEMPERADO"'+(item.tipo_vidro==='TEMPERADO'?' selected':'')+'>Temperado</option><option value="LAMINADO"'+(item.tipo_vidro==='LAMINADO'?' selected':'')+'>Laminado</option><option value="INSULADO"'+(item.tipo_vidro==='INSULADO'?' selected':'')+'>Insulado</option><option value="PINAZO"'+(item.tipo_vidro==='PINAZO'?' selected':'')+'>Com Pinazo</option></select></div>';
      h+='</div>';
    } else {
      h+='<div class="crm-field"></div></div>';
    }
    
    // Cores: Maciço → 1 ACM + Cor Maciço (ALU_DATA) | ACM → Ext + Int
    var _isMacItem = item.moldura_rev === 'MACICO';
    h+='<div style="font-size:10px;font-weight:700;color:var(--navy);margin:8px 0 4px">🎨 Cores</div>';
    h+='<div class="crm-row">';
    if(_isMacItem){
      h+='<div class="crm-field"><label>Cor ACM</label><select id="'+pre+'cor_ext" style="font-size:10px">'+corOpts.replace('value="'+item.cor_ext+'"','value="'+item.cor_ext+'" selected')+'</select></div>';
      // Cor Maciço com opções do ALU_DATA
      var _aluCorHtml='<option value="">— Selecione —</option>';
      if(typeof ALU_DATA!=='undefined'){ALU_DATA.forEach(function(g){_aluCorHtml+='<optgroup label="'+g.g+'">';var _cs={};g.o.forEach(function(it){var nm=it.l.split('·')[0].split('×')[0].trim();if(!_cs[nm])_cs[nm]=it.l.split('·')[0].trim();});Object.keys(_cs).forEach(function(c){_aluCorHtml+='<option value="'+_cs[c]+'"'+(_cs[c]===item.cor_macico?' selected':'')+'>'+_cs[c]+'</option>';});_aluCorHtml+='</optgroup>';});}
      h+='<div class="crm-field"><label>🔷 Cor Maciço</label><select id="'+pre+'cor_macico" style="font-size:10px;border-color:#6c3483;color:#6c3483">'+_aluCorHtml+'</select></div>';
    } else {
      h+='<div class="crm-field"><label>Cor Externa</label><select id="'+pre+'cor_ext" style="font-size:10px">'+corOpts.replace('value="'+item.cor_ext+'"','value="'+item.cor_ext+'" selected')+'</select></div>';
      h+='<div class="crm-field"><label>Cor Interna</label><select id="'+pre+'cor_int" style="font-size:10px">'+corOpts.replace('value="'+item.cor_int+'"','value="'+item.cor_int+'" selected')+'</select></div>';
    }
    h+='</div>';
    
    // Actions
    h+='<div class="crm-item-actions">';
    h+='<button class="dup" onclick="event.stopPropagation();crmItemSaveAndNext(\''+item.id+'\')" style="background:#27ae60;color:#fff;border-color:#27ae60">💾 Salvar Item</button>';
    h+='<button class="dup" onclick="event.stopPropagation();crmItemDuplicate(\''+item.id+'\')">📋 Duplicar</button>';
    h+='<button class="del" onclick="event.stopPropagation();crmItemRemove(\''+item.id+'\')">🗑 Remover</button>';
    h+='</div>';
    
    h+='</div>'; // body
    h+='</div>'; // crm-item
  });
  
  list.innerHTML=h;
  
  // Re-apply selected values for selects (the replace trick doesn't always work)
  _crmItens.forEach(function(item){
    var pre='crmit-'+item.id+'-';
    var fields=item.tipo==='porta_pivotante'?['modelo','abertura','folhas','fech_mec','fech_dig','cilindro','puxador','pux_tam','cor_ext','cor_int','cor_macico','dist_borda_cava','largura_cava','cantoneira_cava','dist_borda_friso','largura_friso','friso_h_qty','friso_h_esp','refilado','moldura_rev','moldura_larg_qty','moldura_alt_qty','ripado_total','ripado_2lados']:['tipo_fixacao','tipo_vidro','revestimento_lados','tem_estrutura','tipo_material','cor_ext','cor_int','cor_macico'];
    fields.forEach(function(f){
      var el=document.getElementById(pre+f);
      if(el&&item[f]) el.value=item[f];
    });
    // Checkbox
    var _cbA=document.getElementById(pre+'tem_alisar');
    if(_cbA) _cbA.checked=!!item.tem_alisar;
  });
  
  // Auto-select fechadura/puxador for items with altura set
  setTimeout(function(){
    _crmItens.forEach(function(item){
      if(item.tipo==='porta_pivotante' && item.altura && parseInt(item.altura)>0){
        crmItemAutoSelect(item.id);
      }
      if(item.tipo==='fixo'){
        crmItemFixoMaterial(item.id);
      }
      // Re-apply cor values after mode switch (ALU values won't stick on ACM selects)
      var pre='crmit-'+item.id+'-';
      if(item.cor_ext){var ce=document.getElementById(pre+'cor_ext');if(ce)ce.value=item.cor_ext;}
      if(item.cor_int){var ci=document.getElementById(pre+'cor_int');if(ci)ci.value=item.cor_int;}
    });
  }, 100);
}

window._crmItensToCardData=function(){
  _crmItensSaveFromDOM();
  return _crmItens.map(function(item){
    var clean={id:item.id,tipo:item.tipo,qtd:parseInt(item.qtd)||1,largura:parseInt(item.largura)||0,altura:parseInt(item.altura)||0,cor_ext:item.cor_ext||'',cor_int:item.cor_int||''};
    if(item.tipo==='porta_pivotante'){
      clean.modelo=item.modelo||'';clean.abertura=item.abertura||'PIVOTANTE';clean.folhas=item.folhas||'1';
      clean.fech_mec=item.fech_mec||'';clean.fech_dig=item.fech_dig||'';clean.cilindro=item.cilindro||'';clean.puxador=item.puxador||'';clean.pux_tam=item.pux_tam||'1.5';
      clean.dist_borda_cava=item.dist_borda_cava||'210';clean.largura_cava=item.largura_cava||'150';clean.cantoneira_cava=item.cantoneira_cava||'30';
      clean.dist_borda_friso=item.dist_borda_friso||'';clean.largura_friso=item.largura_friso||'';clean.refilado=item.refilado||'20';
      clean.friso_vert=item.friso_vert||'0';clean.friso_horiz=item.friso_horiz||'0';clean.friso_h_qty=item.friso_h_qty||'3';clean.friso_h_esp=item.friso_h_esp||'10';clean.tem_alisar=!!item.tem_alisar;
      clean.moldura_rev=item.moldura_rev||'ACM';clean.moldura_larg_qty=item.moldura_larg_qty||'2';clean.moldura_alt_qty=item.moldura_alt_qty||'2';
      clean.ripado_total=item.ripado_total||'NAO';clean.ripado_2lados=item.ripado_2lados||'SIM';
    }
    if(item.tipo==='fixo'){
      clean.tipo_vidro=item.tipo_vidro||'';clean.tipo_fixacao=item.tipo_fixacao||'';clean.revestimento_lados=item.revestimento_lados||'2';clean.tem_estrutura=item.tem_estrutura||'SIM';clean.tipo_material=item.tipo_material||'ACM';
    }
    return clean;
  });
}

window._crmItensFromCardData=function(itens){
  _crmItens=(itens||[]).map(function(it){
    return Object.assign({},it,{id:it.id||('ci_'+Date.now()+'_'+Math.random().toString(36).substr(2,4))});
  });
  _crmItensRender();
}


window.crmSaveOpp=function(){
  var cliente=val('crm-o-cliente').trim();
  if(!cliente){var c=el('crm-o-cliente');if(c)c.focus();return;}

  var scope=_scope;
  var cidade=scope==='internacional'?val('crm-o-cidade-intl').trim():val('crm-o-cidade-nac').trim();
  var now=new Date().toISOString();

  var opp={
    cliente:   cliente,
    contato:   val('crm-o-contato').trim(),
    email:     val('crm-o-email').trim(),
    dataContato: val('crm-o-data-contato'),
    produto:   val('crm-o-produto'),
    responsavel: val('crm-o-resp'),
    origem:    val('crm-o-origem'),
    wrep:      val('crm-o-wrep'),          // Weiku rep
    parceiro_nome: val('crm-o-parceiro-nome')||'',
    valor:     parseFloat(val('crm-o-valor'))||0,
    fechamento:val('crm-o-fechamento'),
    prioridade:val('crm-o-prioridade')||'',
    potencial: val('crm-o-potencial')||'',
    notas:     val('crm-o-notas').trim(),
    largura:   (_crmItens.length?parseInt(_crmItens[0].largura):parseInt(val('crm-o-largura')))||0,
    altura:    (_crmItens.length?parseInt(_crmItens[0].altura):parseInt(val('crm-o-altura')))||0,
    abertura:  val('crm-o-abertura'),
    modelo:    val('crm-o-modelo'),
    folhas:    val('crm-o-folhas')||'1',
    cor_ext:   val('crm-o-cor-ext'),
    cor_int:   val('crm-o-cor-int'),
    cor_macico: val('crm-o-cor-macico'),
    reserva:   val('crm-o-reserva').trim(),
    itens:     _crmItensToCardData(),
    inst_quem: val('crm-o-inst-quem')||'PROJETTA',
    inst_valor: parseFloat(val('crm-o-inst-valor'))||0,
    inst_transp: parseFloat(val('crm-o-inst-transp'))||0,
    inst_pais: val('crm-o-inst-pais')||'',
    inst_aero: val('crm-o-inst-aero')||'',
    inst_porte: val('crm-o-inst-porte')||'M',
    inst_pessoas: parseInt(val('crm-o-inst-pessoas'))||3,
    inst_dias: parseInt(val('crm-o-inst-dias'))||3,
    inst_udigru: parseFloat(val('crm-o-inst-udigru'))||2000,
    inst_passagem: parseFloat(val('crm-o-inst-passagem'))||10000,
    inst_hotel: parseFloat(val('crm-o-inst-hotel'))||1700,
    inst_alim: parseFloat(val('crm-o-inst-alim'))||300,
    inst_seguro: parseFloat(val('crm-o-inst-seguro'))||300,
    inst_carro: parseFloat(val('crm-o-inst-carro'))||850,
    inst_mo: parseFloat(val('crm-o-inst-mo'))||500,
    inst_margem: parseFloat(val('crm-o-inst-margem'))||10,
    inst_cambio: parseFloat(val('crm-o-inst-cambio'))||5.20,
    inst_intl_total: window._instIntlTotal||0,
    agp:       val('crm-o-agp').trim(),
    cep:       val('crm-o-cep'),
    scope:     scope,
    cidade:    cidade,
    estado:    scope==='nacional'?val('crm-o-estado'):'',
    pais:      scope==='internacional'?val('crm-o-pais').trim():'',
    stage:     _stageId||gStages()[0].id,
    updatedAt: now,
    anexos:    _modalAttachs.map(function(a){return{name:a.name,type:a.type,date:a.date};}), // metadata only in localStorage
  };

  var data=cLoad();
  var dealId=_editId;
  if(_editId){
    var idx=data.findIndex(function(o){return o.id===_editId;});
    if(idx>=0){
      opp.anexos=_modalAttachs.map(function(a){return{name:a.name,type:a.type,date:a.date};});
      // Preservar campos que não estão no modal (revisoes, valorTabela etc)
      var existing=data[idx];
      ['revisoes','revPipeline','valorTabela','valorFaturamento','createdAt'].forEach(function(k){
        if(existing[k]!==undefined && opp[k]===undefined) opp[k]=existing[k];
      });
      data[idx]=Object.assign(data[idx],opp);
    }
  } else {
    dealId=uuid();opp.id=dealId;opp.createdAt=now;data.unshift(opp);
    // CRÍTICO: atualizar _editId para que próximos saves atualizem em vez de criar duplicata
    _editId=dealId;
  }
  cSave(data);
  // Save full attachments (with base64 data) to cloud
  if(_modalAttachs.length>0)crmSaveAttachCloud(dealId,_modalAttachs);
  _modalAttachs=[];
  // NÃO fechar modal — só salvar e mostrar confirmação
  // NÃO re-abrir modal (colapsa items abertos). Só atualizar kanban.
  crmRender();
  var _svToast=document.createElement('div');_svToast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:8px 18px;border-radius:16px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.2)';
  _svToast.textContent='💾 Card salvo!';document.body.appendChild(_svToast);setTimeout(function(){_svToast.remove();},2000);
};

window.crmDeleteOpp=function(id){
  if(!id)return;
  if(!confirm('Excluir esta oportunidade e todos os orçamentos associados?'))return;
  var data=cLoad();
  var card=data.find(function(o){return o.id===id;});
  var clienteName=card?card.cliente:'';
  var filtered=data.filter(function(o){return o.id!==id;});
  if(filtered.length===data.length){alert('Erro: oportunidade não encontrada.');return;}
  cSave(filtered);
  crmDeleteAttachCloud(id);
  // Também limpar orçamentos associados a este cliente
  if(clienteName){
    var db=loadDB();
    var dbFiltered=db.filter(function(e){return(e.client||'').trim()!==clienteName.trim();});
    if(dbFiltered.length<db.length){
      saveDB(dbFiltered);
      console.log('🗑 Removidos '+(db.length-dbFiltered.length)+' orçamento(s) de '+clienteName);
    }
  }
  crmRender();
  if(typeof renderClientesTab==='function') renderClientesTab();
};
window.crmDeleteFromModal=function(){
  if(_editId){
    var id=_editId;
    crmCloseModal();
    setTimeout(function(){crmDeleteOpp(id);},150);
  }
};

/* ═══ ORC ITEMS — Itens do CRM no Orçamento ═══ */
window._orcItens = [];      // Array of items from CRM
window._orcItemAtual = -1;  // Index of currently editing item

function orcItensFromCRM(itens, cliente){
  window._orcItens = (itens||[]).map(function(it,i){
    return Object.assign({}, it, {_idx:i, _configured:false, _formData:null});
  });
  window._orcItemAtual = -1;
  var bar = document.getElementById('orc-itens-bar');
  if(bar){
    bar.classList.toggle('show', window._orcItens.length > 0);
  }
  var cliEl = document.getElementById('orc-itens-cli');
  if(cliEl) cliEl.textContent = cliente || 'Cliente';
  
  // ── Criar blocos de fixo a partir dos itens CRM tipo "fixo" ────
  var fixoItens = window._orcItens.filter(function(it){ return it.tipo === 'fixo'; });
  if(fixoItens.length > 0){
    // Ativar sistema de fixos
    var tfEl = document.getElementById('tem-fixo');
    if(tfEl){ tfEl.checked = true; if(typeof toggleFixos==='function') toggleFixos(); }
    // Limpar fixos existentes
    var fList = document.getElementById('fixos-list');
    if(fList) fList.innerHTML = '';
    // Criar bloco para cada fixo do CRM
    fixoItens.forEach(function(fx, fi){
      var qty = parseInt(fx.qtd) || 1;
      if(typeof addFixo === 'function') addFixo();
      var blks = document.querySelectorAll('.fixo-blk');
      var last = blks[blks.length - 1];
      if(last){
        var larg = last.querySelector('.fixo-larg'); if(larg) larg.value = fx.largura || '';
        var alt  = last.querySelector('.fixo-alt');  if(alt)  alt.value  = fx.altura  || '';
        var lados= last.querySelector('.fixo-lados');if(lados)lados.value= fx.revestimento_lados || '2';
        var estr = last.querySelector('.fixo-estr'); if(estr) estr.value = fx.tem_estrutura==='SIM' ? 'sim' : 'nao';
        // Tipo: BANDEIRA → superior, LATERAL → lateral
        var tipo = last.querySelector('.fixo-tipo');
        if(tipo){
          tipo.value = (fx.tipo_fixacao==='LATERAL')?'lateral':'superior';
          toggleFixoTipo(tipo);
        }
        // Lado: só para lateral
        var lado = last.querySelector('.fixo-lado');
        if(lado && fx.tipo_fixacao==='LATERAL') lado.value = 'esquerdo';
        // Quantidade
        var qtyEl = last.querySelector('.fixo-qty'); if(qtyEl) qtyEl.value = qty;
      }
    });
  }
  
  orcItensRender();
  // Auto-select first porta item (or first item)
  if(window._orcItens.length > 0){
    var firstPorta = window._orcItens.findIndex(function(it){ return it.tipo === 'porta_pivotante'; });
    var selectIdx = firstPorta >= 0 ? firstPorta : 0;
    setTimeout(function(){ orcItemSelecionar(selectIdx); }, 200);
    setTimeout(function(){
      var _caracBody = document.getElementById('carac-body');
      if(_caracBody) _caracBody.style.display = '';
    }, 400);
  }
}

function orcItensRender(){
  var grid = document.getElementById('orc-itens-grid');
  if(!grid) return;
  if(!window._orcItens.length){ grid.innerHTML=''; return; }
  
  var TIPOS = {porta_pivotante:{icon:'🚪',label:'Porta Pivotante'},fixo:{icon:'🔲',label:'Fixo'},porta_interna:{icon:'🚪',label:'Porta Interna'},revestimento:{icon:'🧱',label:'Revestimento'}};
  
  var h = '';
  window._orcItens.forEach(function(it, idx){
    var t = TIPOS[it.tipo] || {icon:'📦',label:it.tipo};
    var isActive = idx === window._orcItemAtual;
    var isDone = it._configured;
    h += '<div class="orc-item-card'+(isActive?' active':'')+(isDone?' done':'')+'" onclick="orcItemSelecionar('+idx+')">';
    h += '<span class="oic-check">✅</span>';
    if(it.qtd > 1) h += '<span class="oic-qty">×'+it.qtd+'</span>';
    h += '<div class="oic-num">Item '+(idx+1)+'</div>';
    h += '<div class="oic-icon">'+t.icon+'</div>';
    h += '<div class="oic-tipo">'+t.label+'</div>';
    if(it.largura && it.altura) h += '<div class="oic-dim">'+it.largura+' × '+it.altura+' mm</div>';
    var details = [];
    if(it.modelo) details.push('Mod '+it.modelo);
    if(it.cor_ext) details.push(it.cor_ext.substring(0,20));
    if(details.length) h += '<div class="oic-mod">'+details.join(' · ')+'</div>';
    h += '</div>';
  });
  grid.innerHTML = h;
}

function orcItemSalvarAtual(){
  if(window._orcItemAtual < 0 || !window._orcItens.length) return;
  // Capture current form data into the item
  var it = window._orcItens[window._orcItemAtual];
  if(!it) return;
  // Capture from form
  it.largura = parseInt((document.getElementById('largura')||{value:0}).value) || it.largura;
  it.altura = parseInt((document.getElementById('altura')||{value:0}).value) || it.altura;
  it._configured = true;
  // Capture all form data for this item
  if(typeof captureFormData === 'function'){
    it._formData = captureFormData();
  }
  orcItensRender();
  // Toast
  var toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 3px 12px rgba(0,0,0,.2)';
  toast.textContent = '✅ Item '+(window._orcItemAtual+1)+' salvo!';
  document.body.appendChild(toast);
  setTimeout(function(){toast.remove();},2000);
}

function orcItemSelecionar(idx){
  if(idx < 0 || idx >= window._orcItens.length) return;
  
  // Save current item before switching
  if(window._orcItemAtual >= 0 && window._orcItemAtual !== idx){
    var cur = window._orcItens[window._orcItemAtual];
    if(cur && typeof captureFormData === 'function'){
      cur._formData = captureFormData();
      cur.largura = parseInt((document.getElementById('largura')||{value:0}).value) || cur.largura;
      cur.altura = parseInt((document.getElementById('altura')||{value:0}).value) || cur.altura;
    }
  }
  
  window._orcItemAtual = idx;
  var it = window._orcItens[idx];
  orcItensRender();
  
  // If item has saved form data, restore it
  if(it._formData && typeof restoreFormData === 'function'){
    restoreFormData(it._formData);
    setTimeout(function(){
      if(typeof calc==='function') try{calc();}catch(e){}
    }, 200);
    return;
  }
  
  // Otherwise, load from CRM item data into form
  function setF(fid,v){
    var e=document.getElementById(fid);
    if(e && v !== undefined && v !== null && v !== ''){
      e.value = v;
      ['input','change'].forEach(function(evt){e.dispatchEvent(new Event(evt,{bubbles:true}));});
    }
  }
  
  setF('largura', it.largura);
  setF('altura', it.altura);
  setF('qtd-portas', it.qtd || 1);
  
  if(it.tipo === 'porta_pivotante'){
    setF('carac-abertura', it.abertura || 'PIVOTANTE');
    setF('carac-modelo', it.modelo);
    setF('folhas-porta', it.folhas || '1');
    setF('carac-folhas', it.folhas || '1');
    if(it.cor_ext) setF('carac-cor-ext', it.cor_ext);
    if(it.cor_int) setF('carac-cor-int', it.cor_int);
    if(it.cor_macico){
      // Guardar para setar depois de _checkCorMode popular as opções
      window._pendingCorMacico = it.cor_macico;
    }
    if(it.fech_mec) setF('carac-fech-mec', it.fech_mec);
    if(it.fech_dig) setF('carac-fech-dig', it.fech_dig);
    if(it.cilindro) setF('carac-cilindro', it.cilindro);
    if(it.puxador) setF('carac-puxador', it.puxador);
    // Cava config
    if(it.dist_borda_cava) setF('carac-dist-borda-cava', it.dist_borda_cava);
    if(it.largura_cava) setF('carac-largura-cava', it.largura_cava);
    if(it.dist_borda_friso) setF('carac-dist-borda-friso', it.dist_borda_friso);
    if(it.largura_friso) setF('carac-largura-friso', it.largura_friso);
    if(it.friso_vert) setF('carac-friso-vert', it.friso_vert);
    if(it.friso_horiz) setF('carac-friso-horiz', it.friso_horiz);
    // Modelo 06/16: carregar quantidade e espessura friso horizontal
    if(it.friso_h_qty) setF('plan-friso-h-qty', it.friso_h_qty);
    if(it.friso_h_esp) setF('plan-friso-h-esp', it.friso_h_esp);
    // Modelo 23: carregar configuração de molduras
    if(it.moldura_rev) setF('plan-moldura-rev', it.moldura_rev);
    if(it.moldura_larg_qty) setF('plan-moldura-larg-qty', it.moldura_larg_qty);
    if(it.moldura_alt_qty) setF('plan-moldura-alt-qty', it.moldura_alt_qty);
    if(it.refilado) setF('plan-refilado', it.refilado);
    // Ripado config
    if(it.ripado_total) setF('carac-ripado-total', it.ripado_total);
    if(it.ripado_2lados) setF('carac-ripado-2lados', it.ripado_2lados);
    var _alisarEl = document.getElementById('carac-tem-alisar');
    if(_alisarEl) _alisarEl.checked = !!it.tem_alisar;
    if(typeof onModeloChange==='function' && it.modelo) try{onModeloChange();}catch(e){}
    // Forçar verificação cor ALU/ACM após todos campos carregados
    if(typeof _checkCorMode==='function') setTimeout(function(){
      _checkCorMode();
      // Agora setar cor maciço (opções já populadas)
      if(window._pendingCorMacico){
        setF('carac-cor-macico', window._pendingCorMacico);
        window._pendingCorMacico=null;
      }
    }, 200);
  }
  
  if(it.tipo === 'fixo'){
    // For fixo, set dimensions and cor, leave model empty
    if(it.cor_ext) setF('carac-cor-ext', it.cor_ext);
    if(it.cor_int) setF('carac-cor-int', it.cor_int);
  }
  
  setTimeout(function(){
    if(typeof calc==='function') try{calc();}catch(e){}
    // Sync planificador and model
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
    if(typeof onModeloChange==='function') try{onModeloChange();}catch(e){}
    if(typeof _checkCorMode==='function') setTimeout(_checkCorMode, 200);
    if(typeof _osAutoGenerate==='function') try{window._osAutoMode=true;_osAutoGenerate();window._osAutoMode=false;}catch(e){}
  }, 300);
}

// Backward compat: restore form data
function restoreFormData(data){
  if(!data) return;
  Object.keys(data).forEach(function(key){
    var el = document.getElementById(key);
    if(!el) return;
    if(el.type === 'checkbox'){
      el.checked = (data[key] === true || data[key] === 'true');
    } else {
      el.value = data[key] || '';
    }
  });
  // Trigger change events on key fields
  ['largura','altura','carac-modelo','carac-cor-ext','carac-cor-int','folhas-porta'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.dispatchEvent(new Event('change',{bubbles:true}));
  });
}


/* ── Fazer Orçamento ─────────────────────────────── */
window._crmOrcCardId=null;
window.crmFazerOrcamento=function(id){
  // Salvar dados atuais do CRM antes de carregar
  if(typeof _crmItensSaveFromDOM==='function') try{_crmItensSaveFromDOM();}catch(e){}
  if(typeof crmSaveCard==='function') try{crmSaveCard();}catch(e){}
  var opp=cLoad().find(function(o){return o.id===id;});if(!opp)return;
  window._crmOrcCardId=id;
  if(typeof switchTab==='function')switchTab('orcamento');
  setTimeout(function(){
    // Salvar orçamento atual se tem dados e iniciar novo
    var clienteAtual=(document.getElementById('cliente')||{}).value;
    if(clienteAtual && clienteAtual.trim() && typeof salvarRapido==='function'){
      try{salvarRapido();}catch(e){}
    }
    // Desconectar do orçamento salvo anterior
    if(typeof currentId!=='undefined'){currentId=null;currentRev=null;}
    if(typeof _persistSession==='function')try{_persistSession();}catch(e){}
    if(typeof window._isATP!=='undefined')window._isATP=false;
    var curBanner=document.getElementById('cur-banner');if(curBanner)curBanner.classList.remove('show');
    // Zerar tudo
    window._snapshotLock=false;
    window._orcLocked=false;
    window._pendingRevision=false;
    window._forceUnlockAfterLoad=false;
    window._custoCalculado=false;
    window._osGeradoUmaVez=false;
    try{_setOrcLock(false);}catch(e){}
    try{_hideMemorial();}catch(e){}
    var lockBanner=document.getElementById('orc-lock-banner');if(lockBanner)lockBanner.style.display='none';
    if(typeof resetToDefaults==='function')try{resetToDefaults();}catch(e){}
    // Reset visual ATP
    var badge=document.getElementById('status-badge');if(badge){badge.textContent='ORÇAMENTO';badge.style.background='#e67e22';}
    var atpRow=document.getElementById('atp-field-row');if(atpRow)atpRow.style.display='none';
    var atpCont=document.getElementById('atp-contato-row');if(atpCont)atpCont.style.display='none';
    var endEl=document.getElementById('atp-endereco');if(endEl)endEl.style.display='none';
    var btnAtp=document.getElementById('btn-gerar-atp');if(btnAtp){btnAtp.textContent='📋 Gerar ATP';btnAtp.style.background='#1a5276';btnAtp.style.borderColor='#1a5276';}

    // Agora preencher com dados do CRM
    function setF(fid,v){var e=document.getElementById(fid);if(e&&v){e.value=v;['input','change'].forEach(function(evt){e.dispatchEvent(new Event(evt,{bubbles:true}));});}}
    setF('cliente',opp.cliente);
    
    // Transfer items to Orçamento
    if(opp.itens && opp.itens.length > 0){
      orcItensFromCRM(opp.itens, opp.cliente);
    } else if(opp.largura && opp.altura){
      // Backward compat: single item
      orcItensFromCRM([{tipo:'porta_pivotante',qtd:1,largura:opp.largura,altura:opp.altura,modelo:opp.modelo||'',abertura:opp.abertura||'PIVOTANTE',folhas:opp.folhas||'1',cor_ext:opp.cor_ext||'',cor_int:opp.cor_int||''}], opp.cliente);
    }
    // Transfer instalação — internacional auto-seleciona instalação internacional
    var instQuem=opp.inst_quem||'PROJETTA';
    if(opp.scope==='internacional') instQuem='INTERNACIONAL';
    setF('inst-quem',instQuem);
    if(instQuem==='TERCEIROS'){
      setF('inst-terceiros-valor',opp.inst_valor||'');
      setF('inst-terceiros-transp',opp.inst_transp||'');
    }
    if(typeof toggleInstQuem==='function') toggleInstQuem();
    setF('largura',opp.largura||'');
    setF('altura',opp.altura||'');
    // Responsavel (Thays/Felipe/Andressa) — map to the select
    if(opp.responsavel){setF('responsavel',opp.responsavel);}
    setF('carac-abertura',opp.abertura);
    setF('carac-modelo',opp.modelo);
    // Número de Folhas
    if(opp.folhas){setF('folhas-porta',opp.folhas);setF('carac-folhas',opp.folhas);}
    // Cores da chapa
    if(opp.cor_ext)setF('carac-cor-ext',opp.cor_ext);
    if(opp.cor_int)setF('carac-cor-int',opp.cor_int);
    // Número da Reserva
    if(opp.reserva){setF('numprojeto',opp.reserva);}
    if(opp.agp){setF('num-agp',opp.agp);}
    // Transfer CEP
    if(opp.cep)setF('cep-cliente',opp.cep);
    // Representante externo
    var repSel=document.getElementById('rep-sel');
    if(repSel){
      if(opp.origem==='Weiku do Brasil'&&opp.wrep){
        // Try to match Weiku rep
        var matched=false;
        for(var ri=0;ri<repSel.options.length;ri++){
          if(repSel.options[ri].text.toLowerCase().includes(opp.wrep.split('(')[0].trim().toLowerCase().slice(0,10))||
             repSel.options[ri].value.toLowerCase().includes(opp.wrep.split('(')[0].trim().toLowerCase().slice(0,10))){
            repSel.selectedIndex=ri;matched=true;
            repSel.dispatchEvent(new Event('change',{bubbles:true}));break;
          }
        }
      } else {
        // Não é Weiku → usar Projetta Portas como representante
        var projOpt=null;
        for(var ri=0;ri<repSel.options.length;ri++){
          if(repSel.options[ri].text.toLowerCase().includes('projetta')){projOpt=ri;break;}
        }
        if(projOpt!==null){repSel.selectedIndex=projOpt;}
        else{
          // Adicionar opção Projetta se não existe
          var opt=document.createElement('option');opt.value='PROJETTA';opt.text='Projetta Portas Exclusivas LTDA';
          repSel.add(opt);repSel.value='PROJETTA';
        }
        repSel.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
    if(typeof calc==='function')try{calc();}catch(e){}
    if(typeof onModeloChange==='function'&&opp.modelo)try{onModeloChange();}catch(e){}
    // If CEP was set, try to search
    // Auto-buscar CEP do card no orçamento
    if(opp.cep){
      setTimeout(function(){
        var cepEl=document.getElementById('cep-cliente');
        if(cepEl && cepEl.value){
          if(typeof buscaCep==='function') try{buscaCep();}catch(e){}
        }
      }, 600); // aguardar campos preenchidos
    }
    var t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';t.textContent='✅ '+opp.cliente+' — calculando orçamento...';document.body.appendChild(t);setTimeout(function(){t.remove();},4000);
    // Auto-gerar OS e calcular tudo
    setTimeout(function(){
      // Esconder botão GERAR CUSTO COMPLETO (auto-calculado)
      var gcw=document.getElementById('gerar-custo-wrap');if(gcw)gcw.style.display='none';
      // ── Sincronizar itens CRM → multi-porta para cálculo combinado ──
      if(window._orcItens && window._orcItens.length > 1){
        window._mpItens=[];
        console.log('🔄 CRM→_mpItens sync: '+window._orcItens.length+' itens');
        window._orcItens.forEach(function(oi,idx){
          if(oi.tipo!=='porta_pivotante') return;
          console.log('  Item '+(idx+1)+': '+oi.largura+'×'+oi.altura+' mod='+oi.modelo+' fech='+oi.fech_mec);
          var mp={id:'mp_crm_'+idx};
          mp['largura']=String(oi.largura||'');
          mp['altura']=String(oi.altura||'');
          mp['qtd-portas']=String(oi.qtd||'1');
          mp['folhas-porta']=String(oi.folhas||'1');
          mp['carac-modelo']=oi.modelo||'01';
          mp['carac-abertura']=oi.abertura||'PIVOTANTE';
          mp['carac-cor-ext']=oi.cor_ext||'';
          mp['carac-cor-int']=oi.cor_int||'';
          mp['carac-fech-mec']=oi.fech_mec||'';
          mp['carac-fech-dig']=oi.fech_dig||'';
          mp['carac-cilindro']=oi.cilindro||'';
          mp['carac-puxador']=oi.puxador||'';
          mp['carac-pux-tam']=oi.pux_tam||'1.5';
          mp['carac-dist-borda-cava']=oi.dist_borda_cava||'210';
          mp['carac-largura-cava']=oi.largura_cava||'150';
          mp['carac-dist-borda-friso']=oi.dist_borda_friso||'';
          mp['carac-largura-friso']=oi.largura_friso||'';
          mp['carac-friso-vert']=oi.friso_vert||'0';
          mp['carac-friso-horiz']=oi.friso_horiz||'0';
          mp['carac-tem-alisar']=oi.tem_alisar?'1':'0';
          mp['carac-ripado-total']=oi.ripado_total||'NAO';
          mp['carac-ripado-2lados']=oi.ripado_2lados||'SIM';
          mp['plan-refilado']=oi.refilado||'20';
          mp['tem-fixo']=false;
          mp._fixos=[];
          mp._modelo=oi.modelo||'01';
          mp._tipo=oi.tipo||'porta_pivotante';
          var modOpt=document.querySelector('#carac-modelo option[value="'+oi.modelo+'"]');
          mp._modeloTxt=modOpt?modOpt.textContent:(oi.modelo||'');
          mp._largura=parseFloat(oi.largura)||0;
          mp._altura=parseFloat(oi.altura)||0;
          mp._qtd=parseInt(oi.qtd)||1;
          mp._folhas=parseInt(oi.folhas)||1;
          window._mpItens.push(mp);
        });
        window._mpEditingIdx=-1;
        if(typeof _mpRender==='function') _mpRender();
        // Mostrar painel multi-porta no orçamento
        var mpSec=document.getElementById('multi-porta-section');
        if(mpSec) mpSec.style.display='';
        console.log('✅ _mpItens criados: '+window._mpItens.length+' itens → '+window._mpItens.map(function(m){return m._largura+'×'+m._altura;}).join(', '));
        // Garantir form com dados do primeiro item para gerarCustoTotal
        var _first=window._mpItens[0];
        if(_first){
          document.getElementById('largura').value=_first._largura||_first['largura']||'';
          document.getElementById('altura').value=_first._altura||_first['altura']||'';
          if(document.getElementById('carac-modelo'))document.getElementById('carac-modelo').value=_first['carac-modelo']||_first._modelo||'01';
          if(document.getElementById('folhas-porta'))document.getElementById('folhas-porta').value=_first['folhas-porta']||_first._folhas||'1';
          if(document.getElementById('plan-refilado'))document.getElementById('plan-refilado').value=_first['plan-refilado']||'20';
          // Sync cor para planificador puxar chapa correta
          if(document.getElementById('carac-cor-ext')&&_first['carac-cor-ext'])document.getElementById('carac-cor-ext').value=_first['carac-cor-ext'];
          if(document.getElementById('carac-cor-int')&&_first['carac-cor-int'])document.getElementById('carac-cor-int').value=_first['carac-cor-int'];
          if(document.getElementById('carac-cor-macico')&&_first['carac-cor-macico'])document.getElementById('carac-cor-macico').value=_first['carac-cor-macico'];
          // Sync planificador model/cava/friso
          if(document.getElementById('plan-modelo'))document.getElementById('plan-modelo').value=_first['carac-modelo']||_first._modelo||'01';
          if(document.getElementById('plan-folhas'))document.getElementById('plan-folhas').value=_first['folhas-porta']||_first._folhas||'1';
          if(document.getElementById('plan-disborcava'))document.getElementById('plan-disborcava').value=_first['carac-dist-borda-cava']||'210';
          if(document.getElementById('plan-largcava'))document.getElementById('plan-largcava').value=_first['carac-largura-cava']||'150';
          if(document.getElementById('plan-disbordafriso'))document.getElementById('plan-disbordafriso').value=_first['carac-dist-borda-friso']||'';
          if(document.getElementById('plan-largfriso'))document.getElementById('plan-largfriso').value=_first['carac-largura-friso']||'';
          // Fech/cil/pux
          if(document.getElementById('carac-fech-mec')&&_first['carac-fech-mec'])document.getElementById('carac-fech-mec').value=_first['carac-fech-mec'];
          if(document.getElementById('carac-fech-dig')&&_first['carac-fech-dig'])document.getElementById('carac-fech-dig').value=_first['carac-fech-dig'];
          if(document.getElementById('carac-cilindro')&&_first['carac-cilindro'])document.getElementById('carac-cilindro').value=_first['carac-cilindro'];
          if(document.getElementById('carac-puxador')&&_first['carac-puxador'])document.getElementById('carac-puxador').value=_first['carac-puxador'];
          if(typeof onModeloChange==='function')try{onModeloChange();}catch(e){}
        }
      }
      window._osAutoMode=true;
      if(typeof gerarCustoTotal==='function'){
        try{
          gerarCustoTotal();
        }catch(e){
          console.warn('auto-gerarCustoTotal:',e);
          try{if(typeof gerarOS==='function')gerarOS();}catch(e2){console.warn('fallback gerarOS:',e2);}
        }
      }
      window._osAutoMode=false;
      // Auto-run planificador com todas as peças combinadas
      setTimeout(function(){
        try{
          // 1) Sync cor do primeiro item para carac-cor-ext (necessário para planificador)
          var _f1=window._mpItens&&window._mpItens[0];
          if(_f1){
            var _corF=_f1['carac-cor-ext']||'';
            if(_corF&&document.getElementById('carac-cor-ext'))document.getElementById('carac-cor-ext').value=_corF;
          }
          // 2) Atualizar peças
          if(typeof planUpd==='function') planUpd();
          // 3) Simulação + seleção melhor chapa + cor
          if(typeof _autoSelectAndRun==='function') _autoSelectAndRun();
          // 4) Rodar planRun (Calcular aproveitamento) automático
          setTimeout(function(){
            try{
              if(typeof planRun==='function') planRun();
              // 5) Usar resultado nas chapas
              setTimeout(function(){
                try{
                  if(typeof _syncChapaToOrc==='function') _syncChapaToOrc();
                  if(typeof _updateFabChapaResumo==='function') _updateFabChapaResumo();
                  if(typeof calc==='function') calc();
                }catch(e3){console.warn('auto-sync:',e3);}
              },300);
            }catch(e2){console.warn('auto-planRun:',e2);}
          },300);
        }catch(e){console.warn('auto-plan:',e);}
      },600);
    }, 1200);
    // Botões CRM: escondidos até o usuário SALVAR o orçamento
    var btn=document.getElementById('crm-orc-pronto-btn');
    if(btn){btn.style.display='none';btn.setAttribute('data-id',id);}
    var btnAtt=document.getElementById('crm-atualizar-btn');
    if(btnAtt){btnAtt.style.display='none';}
  },350);
};
/* ── Compartilhar Card — Link/WhatsApp/Download ── */
window.crmCompartilharCard=function(cardId){
  var data=cLoad();
  var card=data.find(function(o){return o.id===cardId;});
  if(!card){alert('Card não encontrado.');return;}
  var brl=function(v){return v?'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';};
  var lastRev=card.revisoes&&card.revisoes.length>0?card.revisoes[card.revisoes.length-1]:null;
  var valorTab=lastRev?brl(lastRev.valorTabela):brl(card.valorTabela||card.valor);
  var valorFat=lastRev?brl(lastRev.valorFaturamento):brl(card.valorFaturamento||card.valor);
  var revLabel=lastRev?lastRev.label:'—';

  // Texto para WhatsApp
  var wppText='*PROJETTA PORTAS EXCLUSIVAS*\n\n'
    +'📋 *Proposta Comercial*\n'
    +'👤 Cliente: *'+card.cliente+'*\n'
    +(card.agp?'📌 AGP: '+card.agp+'\n':'')
    +(card.reserva?'📌 Reserva: '+card.reserva+'\n':'')
    +(card.largura?'📐 Medidas: '+card.largura+' × '+card.altura+' mm\n':'')
    +(card.modelo?'🚪 Modelo: '+card.modelo+'\n':'')
    +'\n💰 *Valores:*\n'
    +'Tabela: '+valorTab+'\n'
    +'Faturamento: '+valorFat+'\n'
    +'Versão: '+revLabel+'\n'
    +'\n📅 '+new Date().toLocaleDateString('pt-BR');

  // Texto para copiar
  var copyText='PROJETTA PORTAS EXCLUSIVAS\n'
    +'Proposta: '+card.cliente+'\n'
    +(card.agp?'AGP: '+card.agp+'\n':'')
    +(card.largura?'Medidas: '+card.largura+'×'+card.altura+'mm\n':'')
    +'Tabela: '+valorTab+' | Fat: '+valorFat+'\n'
    +'Versão: '+revLabel;

  // Modal de compartilhamento
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  var html='<div style="background:#fff;border-radius:12px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;overflow:hidden">';
  html+='<div style="background:linear-gradient(135deg,#27ae60,#2ecc71);color:#fff;padding:14px 18px;border-radius:12px 12px 0 0">';
  html+='<div style="font-size:15px;font-weight:800">📤 Compartilhar Proposta</div>';
  html+='<div style="font-size:11px;opacity:.8">'+card.cliente+' — '+valorFat+'</div></div>';
  html+='<div style="padding:16px;display:flex;flex-direction:column;gap:10px">';

  // WhatsApp
  html+='<a href="https://wa.me/?text='+encodeURIComponent(wppText)+'" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:13px">📱 Enviar por WhatsApp</a>';

  // Email
  var emailSubject='Proposta Projetta - '+card.cliente;
  var emailBody=copyText;
  html+='<a href="mailto:?subject='+encodeURIComponent(emailSubject)+'&body='+encodeURIComponent(emailBody)+'" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:8px;background:#3498db;color:#fff;text-decoration:none;font-weight:700;font-size:13px">📧 Enviar por E-mail</a>';

  // Copiar texto
  html+='<button onclick="navigator.clipboard.writeText(\''+copyText.replace(/'/g,"\\'").replace(/\n/g,"\\n")+'\').then(function(){this.textContent=\'✅ Copiado!\'}.bind(this))" style="padding:12px 16px;border-radius:8px;background:#f0f0f0;border:1px solid #ddd;color:#333;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;text-align:left">📋 Copiar Texto da Proposta</button>';

  // Ver proposta salva (se tiver PDF)
  if(lastRev&&(lastRev.pdfCloud||(lastRev.pdfPages&&lastRev.pdfPages.length>0))){
    html+='<button onclick="document.querySelector(\'div[style*=fixed]\').remove();crmVerProposta(\''+cardId+'\','+(card.revisoes.length-1)+')" style="padding:12px 16px;border-radius:8px;background:#8e44ad;color:#fff;border:none;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">📄 Ver PDF da Proposta</button>';
  }

  // Link direto (gera página standalone)
  html+='<button onclick="_gerarPaginaProposta(\''+cardId+'\')" style="padding:12px 16px;border-radius:8px;background:#e67e22;color:#fff;border:none;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">🔗 Gerar Página da Proposta</button>';

  html+='<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:8px;background:none;border:none;color:#999;font-size:12px;cursor:pointer;font-family:inherit">Fechar</button>';
  html+='</div></div>';
  ov.innerHTML=html;
  document.body.appendChild(ov);
};

/* ── Gerar página standalone da proposta ── */
function _gerarPaginaProposta(cardId){
  var data=cLoad();
  var card=data.find(function(o){return o.id===cardId;});
  if(!card)return;
  var brl=function(v){return v?'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';};
  var lastRev=card.revisoes&&card.revisoes.length>0?card.revisoes[card.revisoes.length-1]:null;
  var w=window.open('','_blank');
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">');
  w.document.write('<title>Proposta - '+card.cliente+'</title>');
  w.document.write('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#f5f5f5;color:#333}');
  w.document.write('.pg{max-width:600px;margin:0 auto;background:#fff;min-height:100vh}');
  w.document.write('.hdr{background:linear-gradient(135deg,#003144,#00526b);color:#fff;padding:24px 20px;text-align:center}');
  w.document.write('.hdr h1{font-size:14px;letter-spacing:2px;opacity:.7;margin-bottom:8px}');
  w.document.write('.hdr h2{font-size:20px;font-weight:800}');
  w.document.write('.body{padding:20px}.card{border:1px solid #eee;border-radius:10px;padding:16px;margin-bottom:12px}');
  w.document.write('.card-t{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px;font-weight:700}');
  w.document.write('.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f5f5f5;font-size:14px}');
  w.document.write('.row:last-child{border:none}.lbl{color:#888}.val{font-weight:700;color:#003144}');
  w.document.write('.total{background:#003144;color:#fff;border-radius:10px;padding:16px;text-align:center;margin:12px 0}');
  w.document.write('.total .v{font-size:28px;font-weight:800}');
  w.document.write('.foot{text-align:center;padding:20px;font-size:10px;color:#aaa}');
  w.document.write('img{width:100%;border-radius:8px;margin:8px 0}');
  w.document.write('</style></head><body><div class="pg">');
  w.document.write('<div class="hdr"><h1>PROJETTA PORTAS EXCLUSIVAS</h1><h2>Proposta Comercial</h2></div>');
  w.document.write('<div class="body">');
  // Cliente
  w.document.write('<div class="card"><div class="card-t">Cliente</div>');
  w.document.write('<div class="row"><span class="lbl">Nome</span><span class="val">'+card.cliente+'</span></div>');
  if(card.agp) w.document.write('<div class="row"><span class="lbl">AGP</span><span class="val">'+card.agp+'</span></div>');
  if(card.reserva) w.document.write('<div class="row"><span class="lbl">Reserva</span><span class="val">'+card.reserva+'</span></div>');
  if(card.cidade) w.document.write('<div class="row"><span class="lbl">Cidade</span><span class="val">'+card.cidade+'</span></div>');
  w.document.write('</div>');
  // Produto
  if(card.largura||card.modelo){
    w.document.write('<div class="card"><div class="card-t">Produto</div>');
    if(card.largura) w.document.write('<div class="row"><span class="lbl">Medidas</span><span class="val">'+card.largura+' × '+card.altura+' mm</span></div>');
    if(card.modelo) w.document.write('<div class="row"><span class="lbl">Modelo</span><span class="val">'+card.modelo+'</span></div>');
    if(card.abertura) w.document.write('<div class="row"><span class="lbl">Abertura</span><span class="val">'+card.abertura+'</span></div>');
    w.document.write('</div>');
  }
  // Valores
  w.document.write('<div class="total"><div style="font-size:11px;opacity:.6;margin-bottom:4px">VALOR DA PROPOSTA</div>');
  w.document.write('<div class="v">'+brl(lastRev?lastRev.valorFaturamento:card.valorFaturamento||card.valor)+'</div>');
  w.document.write('<div style="font-size:11px;opacity:.5;margin-top:4px">'+(lastRev?lastRev.label:'')+'</div></div>');
  // Revisões
  if(card.revisoes&&card.revisoes.length>0){
    w.document.write('<div class="card"><div class="card-t">Histórico de Versões</div>');
    card.revisoes.forEach(function(rv){
      w.document.write('<div class="row"><span class="lbl">'+(rv.label||'—')+'</span><span class="val">'+brl(rv.valorFaturamento)+'</span></div>');
    });
    w.document.write('</div>');
  }
  // PDF pages (thumbnail ou local)
  if(lastRev&&(lastRev.pdfThumb||lastRev.pdfPages)){
    w.document.write('<div class="card"><div class="card-t">Proposta Visual</div>');
    if(lastRev.pdfPages){
      lastRev.pdfPages.forEach(function(pg,i){
        w.document.write('<img src="'+pg+'" alt="Página '+(i+1)+'">');
      });
    } else if(lastRev.pdfThumb){
      w.document.write('<img src="'+lastRev.pdfThumb+'" alt="Thumbnail proposta">');
      w.document.write('<p style="color:#888;font-size:10px">Imagem reduzida — versão completa na nuvem</p>');
    }
    w.document.write('</div>');
  }
  w.document.write('<div class="foot">Gerado em '+new Date().toLocaleString('pt-BR')+'<br>Projetta Portas Exclusivas — projetta.com.br</div>');
  w.document.write('</div></div></body></html>');
  w.document.close();
}

/* ── Escolher qual revisão exibe no Pipeline ── */
window.crmSetPipelineRev=function(cardId,revIdx){
  var ri=parseInt(revIdx)||0;
  var data=cLoad();
  var idx=data.findIndex(function(o){return o.id===cardId;});
  if(idx<0)return;
  var opp=data[idx];
  if(!opp.revisoes||!opp.revisoes[ri])return;
  var rv=opp.revisoes[ri];
  opp.revPipeline=ri;
  opp.valor=rv.valorFaturamento||rv.valorTabela||0;
  opp.valorTabela=rv.valorTabela||0;
  opp.valorFaturamento=rv.valorFaturamento||0;
  opp.updatedAt=new Date().toISOString();
  cSave(data);
  if(typeof crmRender==='function') crmRender();
  var revDisplay=ri===0?(rv.label||'Original'):(rv.label||'Revisão '+ri);
  var toast=document.createElement('div');toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#003144;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2)';toast.textContent='📊 Pipeline usando valores de: '+revDisplay+' — Fat: '+brl(rv.valorFaturamento||0);document.body.appendChild(toast);setTimeout(function(){toast.remove();},3000);
};

window.crmDeleteRevision=function(cardId,revIndex){
  if(!confirm('Excluir esta revisão?'))return;
  var data=cLoad();
  var idx=data.findIndex(function(o){return o.id===cardId;});
  if(idx<0)return;
  if(!data[idx].revisoes)return;
  data[idx].revisoes.splice(revIndex,1);
  if(data[idx].revisoes.length>0){
    var last=data[idx].revisoes[data[idx].revisoes.length-1];
    if(last){
      data[idx].valor=last.valorFaturamento||last.valorTabela||data[idx].valor;
      data[idx].valorTabela=last.valorTabela||data[idx].valorTabela;
      data[idx].valorFaturamento=last.valorFaturamento||data[idx].valorFaturamento;
    }
  } else {
    data[idx].valor=0;data[idx].valorTabela=0;data[idx].valorFaturamento=0;
  }
  data[idx].updatedAt=new Date().toISOString();
  cSave(data);
  crmOpenModal(null, cardId);
};

/* ── Abrir Revisão do CRM: carrega orçamento + mostra Memorial ── */
window.crmAbrirRevisao=function(cardId, revIdx){
  // Buscar entry do orçamento vinculado a este card
  var db=loadDB();
  var entry=db.find(function(e){return e.crmCardId===cardId;});
  // Fallback: buscar por nome do card CRM
  if(!entry){
    var crmData=cLoad();var card=crmData.find(function(o){return o.id===cardId;});
    if(card&&card.cliente){
      var nome=card.cliente.toUpperCase().trim();
      entry=db.find(function(e){return e.client&&e.client.toUpperCase().trim()===nome;});
    }
    if(!entry&&card&&card.reserva){
      entry=db.find(function(e){return e.project&&e.project===card.reserva;});
    }
  }
  if(!entry){alert('Orçamento não encontrado. Clique em "Fazer Orçamento" e depois "Orçamento Pronto para Envio" primeiro.');return;}
  var ri=Math.min(revIdx||0, entry.revisions.length-1);
  // Fechar modal CRM
  var modal=document.getElementById('crm-modal');if(modal)modal.style.display='none';
  // Carregar revisão e mostrar memorial
  if(typeof loadRevisionMemorial==='function'){
    loadRevisionMemorial(entry.id, ri);
  } else {
    loadRevision(entry.id, ri);
    switchTab('orcamento');
  }
};

/* ── Nova Revisão a partir do CRM ── */
window.crmNovaRevisao=function(cardId){
  var db=loadDB();
  var entry=db.find(function(e){return e.crmCardId===cardId;});
  if(!entry){
    var crmData=cLoad();var card=crmData.find(function(o){return o.id===cardId;});
    if(card&&card.cliente){
      var nome=card.cliente.toUpperCase().trim();
      entry=db.find(function(e){return e.client&&e.client.toUpperCase().trim()===nome;});
    }
  }
  if(!entry){alert('Orçamento não encontrado. Clique em "Fazer Orçamento" e depois "Orçamento Pronto para Envio" primeiro.');return;}
  var modal=document.getElementById('crm-modal');if(modal)modal.style.display='none';
  // Flag: próximo loadRevision NÃO deve travar (será desbloqueado para edição)
  window._forceUnlockAfterLoad=true;
  var lastRev=entry.revisions.length-1;
  loadRevision(entry.id, lastRev);
  switchTab('orcamento');
  // Desbloquear em 3 etapas para garantir
  function _forceUnlock(){
    window._snapshotLock=false;
    window._orcLocked=false;
    window._forceUnlockAfterLoad=false;
    window._custoCalculado=false; // FORÇAR recálculo ao apertar Pronto
    // Desabilitar TODOS inputs forçadamente (bypass wasDisabled)
    var orcTab=document.getElementById('tab-orcamento');
    if(orcTab){
      orcTab.querySelectorAll('input,select,textarea').forEach(function(el){
        el.disabled=false;
        el.style.opacity='';
        el.style.pointerEvents='';
        delete el.dataset.wasDisabled;
      });
    }
    _hideMemorial();
    var lb=document.getElementById('orc-lock-banner');if(lb)lb.style.display='none';
    var gcw=document.getElementById('gerar-custo-wrap');if(gcw)gcw.style.display='';
    var btnPdf=document.getElementById('crm-gerar-pdf-btn');if(btnPdf)btnPdf.style.display='none';
    // Nova revisão
    window._pendingRevision=true;
    var ind=document.getElementById('autosave-ind');
    if(ind){ind.textContent='📝 Editando nova revisão...';ind.style.opacity='1';ind.style.color='#e67e22';}
  }
  setTimeout(function(){
    _forceUnlock();
    if(typeof onModeloChange==='function') try{onModeloChange();}catch(e){}
    if(typeof _checkCorMode==='function') setTimeout(_checkCorMode, 200);
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
    if(typeof calc==='function') try{calc();}catch(e){}
  }, 1000);
  // Segurança: desbloquear de novo em 2s caso algo tenha re-travado
  setTimeout(_forceUnlock, 2000);
};

window.crmOrcamentoPronto=function(){
  try{
  var id=window._crmOrcCardId;
  var revLabel='Original';

  // Se tem card CRM vinculado: mover card para Orçamento Pronto (sem salvar valores ainda)
  if(id){
    var data=cLoad();var idx=data.findIndex(function(o){return o.id===id;});
    if(idx>=0){
      var isFirst=!data[idx].revisoes||data[idx].revisoes.length===0;
      var stages=gStages();
      var enviarStage=stages.find(function(s){return s.id==='s3b';})||stages.find(function(s){return/pronto|feito|enviar/i.test(s.label);});
      if(enviarStage) data[idx].stage=enviarStage.id;
      data[idx].updatedAt=new Date().toISOString();
      var agpEl=document.getElementById('num-agp');
      if(agpEl&&agpEl.value.trim()) data[idx].agp=agpEl.value.trim();
      var resEl=document.getElementById('numprojeto');
      if(resEl&&resEl.value.trim()) data[idx].reserva=resEl.value.trim();
      if(!data[idx].revisoes) data[idx].revisoes=[];
      var revNum=data[idx].revisoes.length;
      revLabel=isFirst?'Original':'Revisão '+revNum;
      // NÃO salvar valores aqui — serão salvos no callback _onCustoCompleto
      data[idx].revisoes.push({rev:revNum, label:revLabel, data:new Date().toISOString(), valorTabela:0, valorFaturamento:0});
      cSave(data);
    }
  }
  // Esconder botões após envio e TRAVAR orçamento
  var btn=document.getElementById('crm-orc-pronto-btn');if(btn)btn.style.display='none';
  var btnAtt=document.getElementById('crm-atualizar-btn');if(btnAtt)btnAtt.style.display='none';
  // PASSO 1: Verificar se entry atual pertence a ESTE card CRM
  // Se currentId aponta para outro cliente, forçar criação de novo entry
  if(currentId && id){
    var _dbCheck=loadDB();var _oiCheck=_dbCheck.findIndex(function(e){return e.id===currentId;});
    if(_oiCheck>=0 && _dbCheck[_oiCheck].crmCardId && _dbCheck[_oiCheck].crmCardId!==id){
      // Entry atual é de OUTRO card — forçar novo
      currentId=null; currentRev=null;
    }
    // Também verificar se já existe entry vinculado a ESTE card
    var _existente=_dbCheck.find(function(e){return e.crmCardId===id;});
    if(_existente){
      currentId=_existente.id; currentRev=_existente.revisions.length-1;
    }
  }
  // PASSO 2: Salvar entry primeiro (garante currentId)
  if(typeof salvarRapido==='function') try{salvarRapido();}catch(e){console.warn('salvarRapido:',e);}
  // PASSO 3: Vincular crmCardId IMEDIATAMENTE
  if(currentId){
    var _db2=loadDB();var _oi=_db2.findIndex(function(e){return e.id===currentId;});
    if(_oi>=0){
      _db2[_oi].crmCardId=id;
      var _rev=_db2[_oi].revisions[currentRev];
      if(_rev) _rev.crmPronto=true;
      saveDB(_db2);
    }
  }
  // PASSO 4: Capturar snapshot + atualizar CRM
  // Função única que salva tudo de uma vez
  var _salvarSnapshotECRM=function(){
    // captureSnapshot() e _captureOrcValues() agora leem de window._calcResult
    var _snap=null;
    try{_snap=captureSnapshot();}catch(e){}
    var _vals=typeof _captureOrcValues==='function'?_captureOrcValues():{tab:0,fat:0};
    if(currentId){
      var _db3=loadDB();var _oi3=_db3.findIndex(function(e){return e.id===currentId;});
      if(_oi3>=0){
        var _rev3=_db3[_oi3].revisions[currentRev];
        if(_rev3){
          _rev3.snapshot=_snap;
          _rev3.savedAt=new Date().toISOString().replace('T',' ').substring(0,16);
        }
        saveDB(_db3);
      }
    }
    if(id){
      var _crmD=cLoad();var _ci=_crmD.findIndex(function(o){return o.id===id;});
      if(_ci>=0){
        _crmD[_ci].valor=_vals.fat;
        _crmD[_ci].valorTabela=_vals.tab;
        _crmD[_ci].valorFaturamento=_vals.fat;
        if(_crmD[_ci].revisoes&&_crmD[_ci].revisoes.length>0){
          var _lr=_crmD[_ci].revisoes[_crmD[_ci].revisoes.length-1];
          _lr.valorTabela=_vals.tab;
          _lr.valorFaturamento=_vals.fat;
        }
        cSave(_crmD);
        if(typeof crmRender==='function') crmRender();
      }
    }
    window._snapshotLock=true;
    _setOrcLock(true);
    // Mostrar botão Gerar PDF
    var pdfBtn=document.getElementById('crm-gerar-pdf-btn');if(pdfBtn)pdfBtn.style.display='inline-flex';
    // Toast
    var toast=document.createElement('div');toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';toast.textContent='✅ '+revLabel+' congelada! Valores salvos no card. Clique "Gerar PDF" para proposta.';document.body.appendChild(toast);setTimeout(function(){toast.remove();},5000);
    if(typeof crmRender==='function') crmRender();
  };
  // Se custo já foi gerado (usuário clicou Gerar Custo antes) → salvar DIRETO sem recalcular
  if(window._osGeradoUmaVez && window._custoCalculado){
    _salvarSnapshotECRM();
  } else {
    // Custo não foi gerado → calcular primeiro, depois salvar
    // gerarCustoTotal atualiza window._calcResult → captureSnapshot/captureOrcValues leem dele
    window._snapshotLock=false;
    window._onCustoCompleto=_salvarSnapshotECRM;
    if(typeof gerarCustoTotal==='function') try{gerarCustoTotal();}catch(e){console.warn('gerarCusto:',e);}
  }
  }catch(err){
    console.error('crmOrcamentoPronto erro:',err);
    alert('Erro ao salvar: '+err.message);
  }
};

/* ── Gerar PDF da Proposta (botão separado) ── */
window.crmGerarPDF=function(){
  var id=window._crmOrcCardId;
  var revLabel='Original';
  if(id){
    var data=JSON.parse(localStorage.getItem('projetta_crm_v1')||'[]');
    var idx=data.findIndex(function(o){return o.id===id;});
    if(idx>=0&&data[idx].revisoes&&data[idx].revisoes.length>0){
      revLabel=data[idx].revisoes[data[idx].revisoes.length-1].label||'Original';
    }
  }
  var btn=document.getElementById('crm-gerar-pdf-btn');
  if(btn){btn.textContent='⏳ Gerando PDF...';btn.disabled=true;}
  // Temporariamente desbloquear para calc() e populateProposta() funcionarem
  var wasLocked=window._snapshotLock;
  window._snapshotLock=false;
  if(typeof calc==='function') try{calc();}catch(e){}
  // Capturar nome do cliente UMA VEZ (evita nomes diferentes entre PDF e PNG)
  var _clienteFixo=_getBestClientName();
  window._pdfClienteOverride=_clienteFixo;
  // 1. Gerar PDF download
  _showToast('⏳ Gerando PDF...','#e67e22');
  setTimeout(function(){
    _gerarPropostaPDF(function(pdf,blob){
      pdf.save(_pdfFileName());
      _showToast('✅ Proposta PDF baixada!','#27ae60');
      // 2. Gerar RC (Resultado Porta) PNG download
      setTimeout(function(){
        if(typeof printPainelRep==='function') printPainelRep();
        // 2b. Gerar Memorial de Cálculo (Resumo da Obra) PNG
        setTimeout(function(){
          if(typeof printMemorialCalculo==='function') printMemorialCalculo();
          // 2c. Gerar Margens PNG
          setTimeout(function(){
            if(typeof printMargens==='function') printMargens();
            _showToast('✅ PDF + RC + MC + MR baixados!','#27ae60');
            delete window._pdfClienteOverride;
          },700);
        },700);
      },500);
      // 3. Salvar imagens no card CRM
      _exportPropostaToCard(id, revLabel, function(captures){
        var nPages=captures?captures.length:0;
        _showToast('📄 '+nPages+' página(s) salvas no card','#8e44ad');
        if(btn){btn.textContent='📄 Gerar PDF';btn.disabled=false;}
        if(typeof crmRender==='function') crmRender();
        // Re-travar se estava travado
        if(wasLocked) window._snapshotLock=true;
      });
    });
  },300);
};

/* ── Atualizar Valor para Card (sem mudar etapa) ── */
window.crmAtualizarValorCard=function(){
  var id=window._crmOrcCardId;if(!id){alert('Nenhum card vinculado. Use "Fazer Orçamento" no CRM primeiro.');return;}
  var data=cLoad();var idx=data.findIndex(function(o){return o.id===id;});
  if(idx<0){alert('Card não encontrado no CRM.');window._crmOrcCardId=null;return;}

  // Callback: salvar valores DEPOIS do cálculo completo
  var _salvarValores=function(){
    var data2=cLoad();var idx2=data2.findIndex(function(o){return o.id===id;});
    if(idx2<0) return;
    var vals=_captureOrcValues();
    if(vals.fat<=0&&vals.tab<=0){alert('Valores zerados — verifique o orçamento.');return;}
    data2[idx2].updatedAt=new Date().toISOString();
    data2[idx2].valor=vals.fat;
    data2[idx2].valorTabela=vals.tab;
    data2[idx2].valorFaturamento=vals.fat;
    // Nova revisão no card
    if(!data2[idx2].revisoes) data2[idx2].revisoes=[];
    var revNum=data2[idx2].revisoes.length;
    var revLabel='Revisão '+revNum;
    data2[idx2].revisoes.push({rev:revNum,label:revLabel,data:new Date().toISOString(),valorTabela:vals.tab,valorFaturamento:vals.fat});
    // AGP e Reserva
    var agpEl=document.getElementById('num-agp');
    if(agpEl&&agpEl.value.trim()) data2[idx2].agp=agpEl.value.trim();
    var resEl=document.getElementById('numprojeto');
    if(resEl&&resEl.value.trim()) data2[idx2].reserva=resEl.value.trim();
    cSave(data2);
    crmRender();
    // Exportar proposta silenciosamente
    _exportPropostaToCard(id, revLabel, function(captures){
      var nPages=captures?captures.length:0;
      var toast2=document.createElement('div');toast2.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#2980b9;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';toast2.textContent='🔄 '+revLabel+' atualizada! '+nPages+' pág. Tab: '+brl(vals.tab)+' | Fat: '+brl(vals.fat);document.body.appendChild(toast2);setTimeout(function(){toast2.remove();},5000);
    });
    // Esconder botões e travar
    var btnAtt=document.getElementById('crm-atualizar-btn');if(btnAtt)btnAtt.style.display='none';
    var btnPronto=document.getElementById('crm-orc-pronto-btn');if(btnPronto)btnPronto.style.display='none';
    if(typeof salvarRapido==='function') try{salvarRapido();}catch(e){}
    if(currentId){
      var _db3=loadDB();var _oi3=_db3.findIndex(function(e){return e.id===currentId;});
      if(_oi3>=0&&_db3[_oi3].revisions[currentRev]){
        _db3[_oi3].revisions[currentRev].crmPronto=true;
        try{_db3[_oi3].revisions[currentRev].snapshot=captureSnapshot();}catch(e){}
        saveDB(_db3);
      }
    }
    if(typeof renderClientesTab==='function') try{renderClientesTab();}catch(e){}
    window._snapshotLock=true;
    _setOrcLock(true);
  };

  // FORÇAR recálculo antes de capturar valores (async — callback salva depois)
  window._snapshotLock=false;
  window._custoCalculado=false;
  window._onCustoCompleto=_salvarValores;
  if(typeof gerarCustoTotal==='function') try{gerarCustoTotal();}catch(e){_salvarValores();}
};

/* ── Helper: capturar valores do orçamento ──────── */
/* ── Ver Proposta salva no card ── */
window.crmVerProposta=function(cardId, revIndex){
  var data=cLoad();
  var card=data.find(function(o){return o.id===cardId;});
  if(!card||!card.revisoes||!card.revisoes[revIndex]){alert('Revisão não encontrada.');return;}
  var rev=card.revisoes[revIndex];

  function _showPages(pages){
    var ov=document.createElement('div');
    ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.9);z-index:99999;overflow-y:auto;padding:20px;cursor:pointer';
    ov.onclick=function(e){if(e.target===ov)ov.remove();};
    var inner='<div style="max-width:800px;margin:0 auto;text-align:center">';
    inner+='<div style="color:#fff;font-size:14px;font-weight:700;margin-bottom:12px">📄 '+(rev.label||'Proposta')+' — '+(card.cliente||'')+'<br><span style="font-size:11px;opacity:.6">'+(rev.pdfDate?new Date(rev.pdfDate).toLocaleString('pt-BR'):'')+'</span></div>';
    inner+='<div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px"><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:8px 20px;border-radius:8px;border:none;background:#e74c3c;color:#fff;font-weight:700;cursor:pointer;font-size:13px">✕ Fechar</button></div>';
    for(var i=0;i<pages.length;i++){
      inner+='<div style="margin-bottom:16px"><img src="'+pages[i]+'" style="width:100%;border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,.5)"><div style="color:#888;font-size:10px;margin-top:4px">Página '+(i+1)+' de '+pages.length+'</div></div>';
    }
    inner+='</div>';
    ov.innerHTML=inner;
    document.body.appendChild(ov);
  }

  // Se imagens estão na nuvem, buscar do Supabase
  if(rev.pdfCloud){
    var _sbUrl=window._SB_URL, _sbKey=window._SB_KEY;
    var _imgKey='proposta_img_'+cardId;
    _showToast('☁️ Carregando proposta da nuvem...','#3498db');
    fetch(_sbUrl+'/rest/v1/configuracoes?chave=eq.'+_imgKey+'&select=valor&limit=1',{
      headers:{'apikey':_sbKey,'Authorization':'Bearer '+_sbKey}
    }).then(function(r){return r.json();}).then(function(rows){
      if(rows&&rows[0]&&rows[0].valor&&rows[0].valor.pages){
        _showPages(rows[0].valor.pages);
      } else {
        alert('Imagens não encontradas na nuvem.');
      }
    }).catch(function(e){alert('Erro ao carregar da nuvem: '+e.message);});
    return;
  }
  // Fallback: localStorage (compatibilidade com dados antigos)
  if(!rev.pdfPages||!rev.pdfPages.length){alert('Nenhuma proposta salva nesta revisão.');return;}
  _showPages(rev.pdfPages);
};

function _captureOrcValues(){
  // LER DO DOM — é o que o usuário VÊ na tela
  var valorTabEl=document.getElementById('m-tab');
  var valorTab=0;
  if(valorTabEl){var vb=valorTabEl.textContent.replace(/[^\d,.]/g,'').replace(/\./g,'').replace(',','.');valorTab=parseFloat(vb)||0;}
  var valorFatEl=document.getElementById('d-fat');
  var valorFat=0;
  if(valorFatEl){var vt=valorFatEl.textContent.replace(/[^\d,.]/g,'').replace(/\./g,'').replace(',','.');valorFat=parseFloat(vt)||0;}
  // Fallback: _calcResult (se DOM vazio)
  if(valorTab===0&&valorFat===0){
    var cr=window._calcResult;
    if(cr&&cr._tabTotal>0) return{tab:cr._tabTotal,fat:cr._fatTotal};
  }
  return{tab:valorTab,fat:valorFat};
}

/* ── Export CSV ──────────────────────────────────── */
window.crmExportCSV=function(){
  var all=cLoad();var stages=gStages();
  var rows=[['Cliente','Data 1° Contato','Escopo','País','Estado','Cidade','CEP','Produto','Largura','Altura','Abertura','Modelo','Folhas','Reserva','AGP','Valor','Valor Tabela','Valor Faturamento','Etapa','Responsável','Rep.Weiku','Origem','Previsão','Prioridade','Notas']];
  all.forEach(function(o){var st=stages.find(function(s){return s.id===o.stage;})||{label:o.stage};rows.push([o.cliente,o.dataContato||'',o.scope==='internacional'?'Internacional':'Nacional',o.pais||'',o.estado||'',o.cidade||'',o.cep||'',o.produto||'',o.largura||'',o.altura||'',o.abertura||'',o.modelo||'',o.folhas||'1',o.reserva||'',o.agp||'',o.valor,o.valorTabela||'',o.valorFaturamento||'',st.label,o.responsavel||'',o.wrep||'',o.origem||'',o.fechamento||'',o.prioridade||'',(o.notas||'').replace(/,/g,';')]);});
  var csv=rows.map(function(r){return r.map(function(c){return'"'+(c||'')+'"';}).join(',');}).join('\n');
  var a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent('\uFEFF'+csv);a.download='crm-projetta-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
};

/* ── Import ──────────────────────────────────────── */
window.crmOpenImport=function(){el('crm-import-modal').classList.add('open');};
window.crmCloseImport=function(){el('crm-import-modal').classList.remove('open');};
window.crmReadImportFile=function(input){
  var f=input.files[0];if(!f)return;
  var r=new FileReader();r.onload=function(e){el('crm-import-text').value=e.target.result;};r.readAsText(f);
};
window.crmDoImport=function(){
  var txt=(el('crm-import-text')||{}).value;if(!txt||!txt.trim()){alert('Cole ou carregue dados primeiro.');return;}
  var lines=txt.trim().split('\n');
  var sep=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
  var headers=lines[0].split(sep).map(function(h){return h.trim().replace(/"/g,'').toLowerCase();});
  var stages=gStages();var data=cLoad();var count=0;
  for(var i=1;i<lines.length;i++){
    var vals=lines[i].split(sep).map(function(v){return v.trim().replace(/"/g,'');});
    if(vals.length<2||!vals[1])continue;
    var get=function(names){for(var n=0;n<names.length;n++){var idx=headers.indexOf(names[n]);if(idx>=0&&vals[idx])return vals[idx];}return '';};
    var cliente=get(['cliente','nome','client','name'])||vals[1]||'';
    if(!cliente)continue;
    // Check duplicates
    if(data.find(function(o){return o.cliente===cliente;}))continue;
    var rep=get(['representante','rep','rep.weiku','wrep']);
    var origem=get(['origem','origin','source'])||'';
    if(!origem&&rep)origem='Weiku do Brasil';
    if(!origem)origem='Direto';
    var valor=parseFloat(get(['valor','vlr','value','vlr_novo'])||'0')||0;
    var stageLabel=get(['etapa','stage','status'])||'';
    var stageId=stages[0].id;
    if(stageLabel){var found=stages.find(function(s){return s.label.toLowerCase().includes(stageLabel.toLowerCase());});if(found)stageId=found.id;}
    var opp={
      id:uuid(),
      cliente:cliente,
      contato:get(['contato','telefone','tel','phone']),
      produto:get(['produto','product','modelo']),
      responsavel:get(['orcamentista','responsavel','resp']),
      origem:origem,
      wrep:rep,
      valor:valor,
      fechamento:get(['fechamento','previsao','date']),
      prioridade:'normal',
      notas:get(['notas','obs','observacoes']),
      largura:parseInt(get(['largura','l','width']))||0,
      altura:parseInt(get(['altura','a','height']))||0,
      abertura:get(['abertura','tipo']),
      modelo:get(['modelo','model']),
      folhas:get(['folhas','num_folhas','numero_folhas'])||'1',
      reserva:get(['reserva','numprojeto','projeto','project']),
      agp:get(['agp','num_agp']),
      cep:get(['cep']),
      scope:'nacional',
      cidade:get(['cidade','city']),
      estado:get(['estado','uf','state']),
      pais:'',
      stage:stageId,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      anexos:[]
    };
    data.unshift(opp);count++;
  }
  if(count>0){cSave(data);crmRender();}
  var st=el('crm-import-status');
  if(st){st.style.display='block';st.textContent='✅ '+count+' oportunidades importadas com sucesso!';}
  if(count>0)setTimeout(function(){crmCloseImport();},1500);
  else{if(st){st.style.display='block';st.style.color='#e74c3c';st.textContent='⚠ Nenhum registro novo importado (duplicatas ou formato inválido).';}}
};

/* ── Attachments (anexos) — Cloud Storage via Supabase ── */
var _modalAttachs=[];
window._SB_URL=window._SB_URL||'https://plmliavuwlgpwaizfeds.supabase.co';
window._SB_KEY=window._SB_KEY||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

function crmSaveAttachCloud(dealId,attachs){
  if(!dealId||!attachs||!attachs.length)return;
  var key='crm_attach_'+dealId;
  fetch(_SB_URL+'/rest/v1/configuracoes',{method:'POST',
    headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({chave:key,valor:{attachs:attachs,ts:new Date().toISOString()}})
  }).catch(function(e){console.warn('Erro ao salvar anexos na nuvem:',e);});
}
function crmLoadAttachCloud(dealId,cb){
  if(!dealId){cb([]);return;}
  var key='crm_attach_'+dealId;
  fetch(_SB_URL+'/rest/v1/configuracoes?chave=eq.'+key+'&select=valor&limit=1',
    {headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}})
    .then(function(r){return r.json();})
    .then(function(rows){cb(rows&&rows.length&&rows[0].valor?rows[0].valor.attachs||[]:[]); })
    .catch(function(){cb([]);});
}
function crmDeleteAttachCloud(dealId){
  if(!dealId)return;
  var key='crm_attach_'+dealId;
  fetch(_SB_URL+'/rest/v1/configuracoes?chave=eq.'+key,{method:'DELETE',
    headers:{'apikey':_SB_KEY,'Authorization':'Bearer '+_SB_KEY}}).catch(function(){});
}

function crmCompressImage(file,cb){
  if(!file.type.startsWith('image/')){
    var reader=new FileReader();
    reader.onload=function(e){cb({name:file.name,type:file.type,data:e.target.result,date:new Date().toISOString().slice(0,10)});};
    reader.readAsDataURL(file);
    return;
  }
  var reader=new FileReader();
  reader.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var maxW=400,maxH=400;
      var w=img.width,h=img.height;
      if(w>maxW){h=h*(maxW/w);w=maxW;}
      if(h>maxH){w=w*(maxH/h);h=maxH;}
      var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
      var compressed=canvas.toDataURL('image/jpeg',0.6);
      cb({name:file.name,type:'image/jpeg',data:compressed,date:new Date().toISOString().slice(0,10)});
    };
    img.onerror=function(){
      cb({name:file.name,type:file.type,data:e.target.result,date:new Date().toISOString().slice(0,10)});
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}
window.crmHandleAttachFiles=function(files){
  if(!files||!files.length)return;
  var pending=files.length;
  Array.from(files).forEach(function(f){
    crmCompressImage(f,function(att){
      _modalAttachs.push(att);
      pending--;
      crmRenderAttachments();
      if(pending===0){
        var drop=el('crm-attach-drop');
        if(drop){drop.style.borderColor='#27ae60';drop.style.color='#27ae60';
          setTimeout(function(){drop.style.borderColor='';drop.style.color='';},1500);}
      }
    });
  });
  var inp=el('crm-attach-input');if(inp)inp.value='';
};
window.crmRenderAttachments=function(){
  var grid=el('crm-attach-grid');if(!grid)return;
  grid.innerHTML='';
  if(!_modalAttachs.length){grid.innerHTML='<div style="font-size:11px;color:var(--hint);padding:6px 0">Nenhum anexo ainda</div>';return;}
  _modalAttachs.forEach(function(a,i){
    var div=document.createElement('div');div.className='crm-attach-item';
    if(a.type&&a.type.startsWith('image/')){
      div.innerHTML='<img src="'+a.data+'" alt="'+escH(a.name)+'"><div class="crm-attach-name">'+escH(a.name)+'</div><button class="crm-attach-del" onclick="event.stopPropagation();crmRemoveAttach('+i+')">✕</button>';
    } else {
      div.innerHTML='<div class="crm-attach-file">📄</div><div class="crm-attach-name">'+escH(a.name)+'</div><button class="crm-attach-del" onclick="event.stopPropagation();crmRemoveAttach('+i+')">✕</button>';
    }
    grid.appendChild(div);
  });
  grid.innerHTML+='<div style="font-size:10px;color:var(--hint);padding:4px 0">'+_modalAttachs.length+' anexo'+((_modalAttachs.length>1)?'s':'')+'</div>';
};
window.crmRemoveAttach=function(i){_modalAttachs.splice(i,1);crmRenderAttachments();};

/* ── Settings ─────────────────────────────────────── */
window.crmOpenSettings=function(){renderSettings();el('crm-settings-modal').classList.add('open');};
window.crmCloseSettings=function(){el('crm-settings-modal').classList.remove('open');};
window.crmStTab=function(tab,btn){
  document.querySelectorAll('.crm-settings-section').forEach(function(s){s.classList.remove('active');});
  document.querySelectorAll('.crm-stab').forEach(function(b){b.classList.remove('active');});
  el('crm-set-'+tab).classList.add('active');btn.classList.add('active');
};
var _tmpSt=null;
function renderSettings(){
  _tmpSt=null;
  // Stages — with up/down reorder
  var sl=el('crm-stages-list');sl.innerHTML='';
  gStages().forEach(function(st,i,arr){
    var d=document.createElement('div');d.className='crm-stage-item';d.setAttribute('data-idx',i);
    // Grip
    var grip=document.createElement('span');grip.className='crm-stage-grip';grip.title='Arrastar';grip.textContent='☰';d.appendChild(grip);
    // Color
    var colorInp=document.createElement('input');colorInp.type='color';colorInp.className='crm-stage-color';colorInp.value=st.color;
    colorInp.addEventListener('input',function(){crmEditStage(i,'color',this.value);});d.appendChild(colorInp);
    // Icon
    var iconInp=document.createElement('input');iconInp.type='text';iconInp.value=st.icon;iconInp.style.cssText='width:40px;text-align:center';
    iconInp.addEventListener('input',function(){crmEditStage(i,'icon',this.value);});d.appendChild(iconInp);
    // Label
    var labelInp=document.createElement('input');labelInp.type='text';labelInp.value=st.label;labelInp.style.cssText='flex:1';
    labelInp.addEventListener('input',function(){crmEditStage(i,'label',this.value);});d.appendChild(labelInp);
    // Up
    var btnUp=document.createElement('button');btnUp.className='crm-stage-move-btn';btnUp.title='Subir';btnUp.textContent='▲';
    if(i===0)btnUp.disabled=true;btnUp.onclick=function(){crmMoveStageItem(i,-1);};d.appendChild(btnUp);
    // Down
    var btnDn=document.createElement('button');btnDn.className='crm-stage-move-btn';btnDn.title='Descer';btnDn.textContent='▼';
    if(i===arr.length-1)btnDn.disabled=true;btnDn.onclick=function(){crmMoveStageItem(i,1);};d.appendChild(btnDn);
    // Delete
    var btnDel=document.createElement('button');btnDel.style.cssText='background:#fde;color:#e74c3c;border:none;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px';btnDel.textContent='✕';
    btnDel.onclick=function(){crmRemoveStageItem(i);};d.appendChild(btnDel);
    sl.appendChild(d);
  });
  // Origins — same layout as stages (list with inline edit)
  var ol=el('crm-orig-list');if(ol){ol.innerHTML='';
  gOrigins().forEach(function(orig,i,arr){
    var d=document.createElement('div');d.className='crm-stage-item';
    d.innerHTML=
      '<span class="crm-stage-grip">☰</span>'+
      '<input type="text" value="'+escH(orig)+'" style="flex:1" oninput="crmEditOrigin('+i+',this.value)">'+
      '<button class="crm-stage-move-btn" title="Subir" onclick="crmMoveOriginItem('+i+',-1)"'+(i===0?' disabled':'')+'>▲</button>'+
      '<button class="crm-stage-move-btn" title="Descer" onclick="crmMoveOriginItem('+i+',1)"'+(i===arr.length-1?' disabled':'')+'>▼</button>'+
      '<button onclick="crmRemoveOrigin('+i+')" style="background:#fde;color:#e74c3c;border:none;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px">✕</button>';
    ol.appendChild(d);
  });}
  // Products — same layout as stages
  var pl=el('crm-prod-list');if(pl){pl.innerHTML='';
  gProducts().forEach(function(prod,i,arr){
    var d=document.createElement('div');d.className='crm-stage-item';
    d.innerHTML=
      '<span class="crm-stage-grip">☰</span>'+
      '<input type="text" value="'+escH(prod)+'" style="flex:1" oninput="crmEditProduct('+i+',this.value)">'+
      '<button class="crm-stage-move-btn" title="Subir" onclick="crmMoveProductItem('+i+',-1)"'+(i===0?' disabled':'')+'>▲</button>'+
      '<button class="crm-stage-move-btn" title="Descer" onclick="crmMoveProductItem('+i+',1)"'+(i===arr.length-1?' disabled':'')+'>▼</button>'+
      '<button onclick="crmRemoveProduct('+i+')" style="background:#fde;color:#e74c3c;border:none;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:11px">✕</button>';
    pl.appendChild(d);
  });}
  // Team
  var tl=el('crm-team-list');tl.innerHTML='';
  gTeam().forEach(function(m,i){
    tl.innerHTML+='<div class="crm-team-item"><div class="crm-avatar" style="background:'+m.color+';width:26px;height:26px;font-size:10px">'+m.name.charAt(0)+'</div><span style="flex:1;font-size:12px;font-weight:600">'+escH(m.name)+'</span><button onclick="var s=gS();s.team=gTeam().slice();s.team.splice('+i+',1);sS(s);renderSettings()" style="background:#fde;color:#e74c3c;border:none;border-radius:7px;padding:4px 8px;cursor:pointer;font-size:10px">✕</button></div>';
  });
}
/* ── Stage reorder ──── */
window.crmEditStage=function(i,prop,val){
  if(!_tmpSt)_tmpSt=gStages().map(function(s){return Object.assign({},s);});
  _tmpSt[i][prop]=val;
};
window.crmRemoveStageItem=function(i){
  if(!_tmpSt)_tmpSt=gStages().map(function(s){return Object.assign({},s);});
  _tmpSt.splice(i,1);
  var s=gS();s.stages=_tmpSt;sS(s);
  renderSettings();
};
window.crmMoveStageItem=function(i,dir){
  try{
    var stages=gStages().map(function(s){return Object.assign({},s);}); // Deep copy
    var j=i+dir;if(j<0||j>=stages.length)return;
    var tmp=stages[i];stages[i]=stages[j];stages[j]=tmp;
    _tmpSt=stages;
    var s=gS();s.stages=stages;sS(s);
    renderSettings();
    crmRender();
  }catch(e){console.error('Erro ao mover etapa:',e);}
};
/* ── Origin helpers ──── */
window._tmpOrigins=null;
window.crmEditOrigin=function(i,v){var s=gS();if(!s.origins)s.origins=gOrigins().slice();s.origins[i]=v;sS(s);};
window.crmRemoveOrigin=function(i){var s=gS();s.origins=gOrigins().slice();s.origins.splice(i,1);sS(s);renderSettings();};
window.crmMoveOriginItem=function(i,dir){var s=gS();s.origins=gOrigins().slice();var j=i+dir;if(j<0||j>=s.origins.length)return;var tmp=s.origins[i];s.origins[i]=s.origins[j];s.origins[j]=tmp;sS(s);renderSettings();};
window.crmAddOriginItem=function(){var inp=el('crm-new-orig');if(!inp||!inp.value.trim())return;var s=gS();s.origins=gOrigins().slice();if(!s.origins.includes(inp.value.trim()))s.origins.push(inp.value.trim());sS(s);inp.value='';renderSettings();};
/* ── Product helpers ──── */
window.crmEditProduct=function(i,v){var s=gS();if(!s.products)s.products=gProducts().slice();s.products[i]=v;sS(s);};
window.crmRemoveProduct=function(i){var s=gS();s.products=gProducts().slice();s.products.splice(i,1);sS(s);renderSettings();};
window.crmMoveProductItem=function(i,dir){var s=gS();s.products=gProducts().slice();var j=i+dir;if(j<0||j>=s.products.length)return;var tmp=s.products[i];s.products[i]=s.products[j];s.products[j]=tmp;sS(s);renderSettings();};
window.crmAddProductItem=function(){var inp=el('crm-new-prod');if(!inp||!inp.value.trim())return;var s=gS();s.products=gProducts().slice();if(!s.products.includes(inp.value.trim()))s.products.push(inp.value.trim());sS(s);inp.value='';renderSettings();};
function renderTagList(containerId,items,type){
  var c=el(containerId);if(!c)return;c.innerHTML='';
  items.forEach(function(item,i){
    var tag=document.createElement('div');tag.className='crm-tag';
    tag.innerHTML='<span class="crm-tag-text">'+escH(item)+'</span><span class="crm-tag-del" onclick="removeTag(\''+type+'\','+i+')">✕</span>';
    tag.ondblclick=function(){tag.innerHTML='<input value="'+escH(item)+'" style="border:none;outline:none;font-family:inherit;font-size:11px;font-weight:600;background:transparent;width:140px" onblur="saveTagEdit(\''+type+'\','+i+',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()"><span onclick="renderSettings()" style="cursor:pointer;color:var(--hint);margin-left:4px">✓</span>';tag.querySelector('input').focus();};
    c.appendChild(tag);
  });
}
window.removeTag=function(type,i){
  var s=gS();
  if(type==='origem'){s.origins=gOrigins().slice();s.origins.splice(i,1);}
  else if(type==='produto'){s.products=gProducts().slice();s.products.splice(i,1);}
  else if(type==='wrep'){s.wreps=gWReps().slice();s.wreps.splice(i,1);}
  sS(s);renderSettings();
};
window.saveTagEdit=function(type,i,newVal){
  if(!newVal.trim())return;var s=gS();
  if(type==='origem'){s.origins=gOrigins().slice();s.origins[i]=newVal.trim();}
  else if(type==='produto'){s.products=gProducts().slice();s.products[i]=newVal.trim();}
  else if(type==='wrep'){s.wreps=gWReps().slice();s.wreps[i]=newVal.trim();}
  sS(s);renderSettings();
};
window.crmAddTag=function(type){
  var ids={origem:'crm-new-orig',produto:'crm-new-prod',wrep:'crm-new-wrep'};
  var inpId=ids[type];var v=(el(inpId)||{}).value;if(!v||!v.trim())return;v=v.trim();
  var s=gS();
  if(type==='origem'){s.origins=gOrigins().slice();if(!s.origins.includes(v))s.origins.push(v);}
  else if(type==='produto'){s.products=gProducts().slice();if(!s.products.includes(v))s.products.push(v);}
  else if(type==='wrep'){s.wreps=gWReps().slice();if(!s.wreps.includes(v))s.wreps.push(v);}
  sS(s);setVal(inpId,'');renderSettings();
};
window.crmAddStage=function(){if(!_tmpSt)_tmpSt=gStages().slice();_tmpSt.push({id:'s'+Date.now(),label:'Nova Etapa',color:'#7f8c8d',icon:'⭕'});var s=gS();s.stages=_tmpSt;sS(s);renderSettings();};
window.crmAddMember=function(){
  var name=(el('crm-new-member')||{}).value;if(!name||!name.trim())return;
  var color=(el('crm-new-member-color')||{}).value||'#003144';
  var s=gS();s.team=gTeam().slice();if(!s.team.find(function(m){return m.name===name.trim();}))s.team.push({name:name.trim(),color:color});
  sS(s);setVal('crm-new-member','');renderSettings();
};
window.crmSaveSettings=function(){
  var s=gS();
  if(_tmpSt)s.stages=_tmpSt;
  sS(s);
  // Cloud sync settings
  var SB='https://plmliavuwlgpwaizfeds.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  fetch(SB+'/rest/v1/configuracoes',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},body:JSON.stringify({chave:SK,valor:{data:s,ts:new Date().toISOString()}})}).catch(function(){});
  crmCloseSettings();crmRender();
};

/* ── Click outside ───────────────────────────────── */
document.addEventListener('click',function(e){
  var ac=el('crm-city-ac');
  if(ac&&!ac.contains(e.target)&&e.target.id!=='crm-o-cidade-nac')ac.style.display='none';
  document.querySelectorAll('.crm-select-dropdown.open').forEach(function(dd){
    if(!dd.contains(e.target)){var prev=dd.previousElementSibling;if(!prev||!prev.contains(e.target))dd.classList.remove('open');}
  });
});

/* ── Init + Cloud Sync + Seed Data ────────────────── */
function crmSeedIfEmpty(){
  // CRM zerado — sem seed data
  return;
  var existing=cLoad();
  if(existing.length>0)return;
  var stages=gStages();
  var sEnviada=stages.find(function(s){return/enviada/i.test(s.label);})||{id:'s4'};
  var sFazer=stages.find(function(s){return/fazer/i.test(s.label);})||{id:'s3'};
  var sGanho=stages.find(function(s){return/ganho|won/i.test(s.label);})||{id:'s6'};
  var sPerdido=stages.find(function(s){return/perdido|lost/i.test(s.label);})||{id:'s7'};
  var sProsp=stages[0]||{id:'s1'};
  var now=new Date().toISOString();
  // Key data from ORÇAMENTOS_2026.xlsx — mapped by color:
  // azul claro (theme:8) = Proposta Enviada, verde (theme:9+FECHADO) = Fechado Ganho
  // branco (theme:0) = Fazer Orçamento, vermelho (theme:5) = Perdido, sem cor = Prospecção
  var seed=[
    {c:'FABIO RATTI',d:'2023-01-13',r:'Adalberto Fanderuff',o:'Weiku do Brasil',v:71409,l:1200,a:4850,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'SORAYA FAVILLA',d:'2024-05-21',r:'Thays (Comercial)',o:'Weiku do Brasil',v:70000,l:1349,a:5662,st:sGanho.id,ci:'INDAIATUBA',uf:'SP',md:'23'},
    {c:'SANDRA CURY',d:'2025-04-29',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:82020,l:2050,a:3000,st:sEnviada.id,ci:'VINHEDO',uf:'SP',md:'08'},
    {c:'SIDNEI E ELAINE',d:'2025-05-06',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:174000,l:2650,a:4500,st:sGanho.id,ci:'SANTANA DE PARNAÍBA',uf:'SP',md:'23'},
    {c:'ALEXANDRE E ERIKA',d:'2025-05-27',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:106637,l:1900,a:2500,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'BRUNO HENRIQUE DA SILVA',d:'2025-06-02',r:'Thays (Comercial)',o:'Weiku do Brasil',v:96000,l:2000,a:6500,st:sGanho.id,ci:'ARARAQUARA',uf:'SP',md:'15'},
    {c:'JULIANA WUSTRO',d:'2025-07-07',r:'Adriano Dorigon',o:'Weiku do Brasil',v:88326,l:2200,a:3400,st:sEnviada.id,ci:'CHAPECÓ',uf:'SC',md:'22'},
    {c:'BINO SCHMIDT',d:'2025-07-15',r:'Rubens A. Grando Postali (Elo Forte)',o:'Weiku do Brasil',v:0,l:1300,a:2800,st:sFazer.id,ci:'SEBERI',uf:'RS',md:'10'},
    {c:'EDUARDO ROBERTO E HEGLEN DREZZA',d:'2025-07-18',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:50213,l:1600,a:2850,st:sEnviada.id,ci:'JUNDIAÍ',uf:'SP',md:'01'},
    {c:'EDGAR PASQUALI',d:'2025-07-23',r:'Carina Ap. Kazahaya (KAR)',o:'Weiku do Brasil',v:117716,l:1500,a:5800,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ADRIANO DA SILVA PINHEIRO',d:'2025-09-03',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:72500,l:1500,a:3950,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'MARIANGELA SANTOS',d:'2025-09-19',r:'Luiz Severino Moretto',o:'Weiku do Brasil',v:48806,l:1260,a:2570,st:sEnviada.id,ci:'ITAPEVA',uf:'SP',md:'22'},
    {c:'ELEN E LEANDRO MARIN',d:'2025-10-01',r:'Ericson Venancio dos Santos',o:'Weiku do Brasil',v:89000,l:1750,a:4800,st:sGanho.id,ci:'PRESIDENTE PRUDENTE',uf:'SP',md:'23'},
    {c:'RODRIGO ANDREATTO',d:'2025-10-24',r:'Rubens A. Grando Postali (Elo Forte)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sFazer.id,ci:'',uf:'',md:''},
    {c:'ANDRIOS PASSOS',d:'2025-10-28',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:63811,l:1500,a:2153,st:sEnviada.id,ci:'SANTANA DE PARNAÍBA',uf:'SP',md:'23'},
    {c:'MARCIO PICCHI',d:'2025-11-27',r:'Thays (Comercial)',o:'Weiku do Brasil',v:91000,l:1800,a:5950,st:sGanho.id,ci:'BARUERI',uf:'SP',md:'01'},
    {c:'KRISTINA ELISABETH WOLTERS',d:'2025-12-11',r:'Marcelo Abarca de Oliveira',o:'Weiku do Brasil',v:49543,l:1400,a:3000,st:sFazer.id,ci:'JABOTICABAL',uf:'SP',md:'23'},
    {c:'MM ARQUITETURA',d:'2025-12-17',r:'Thays (Comercial)',o:'Weiku do Brasil',v:200000,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'GUTO SPINA',d:'2025-12-17',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:80000,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'LEO SANTANA',d:'2025-12-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'SUZANE RENIER',d:'2025-12-19',r:'Ronei de Jesus Lyra',o:'Weiku do Brasil',v:52000,l:1400,a:3500,st:sEnviada.id,ci:'',uf:'',md:'23'},
    {c:'ROSE E SERGIO PONTAROLLO',d:'2025-12-22',r:'Carina Ap. Kazahaya (KAR)',o:'Weiku do Brasil',v:85000,l:1700,a:4200,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'MHAMAD KAMEL FAYAD',d:'2025-12-23',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:120000,l:2100,a:5000,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ÉRICA FARDIN',d:'2025-12-23',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:55000,l:1400,a:2800,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'BRUNO DIAS ELIAS',d:'2025-12-23',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:95000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'FERNANDA E THIAGO ZAVIA',d:'2025-12-22',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:78000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'CLOVIS E GIANA',d:'2025-12-22',r:'Adriano Dorigon',o:'Weiku do Brasil',v:65000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'RESIDENCIA BRAUDE - WEIKU',d:'2025-12-22',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:130000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ANDREA E JUAN',d:'2025-12-22',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:60000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ROBERTO B LIMA',d:'2025-12-22',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:45000,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'FABIO ARCARO KUHL',d:'2026-01-06',r:'Ericson Venancio dos Santos',o:'Weiku do Brasil',v:50000,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'MATHEUS BALDAN',d:'2026-01-08',r:'Rodrigo Aguiar Diniz',o:'Weiku do Brasil',v:129000,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'DÉBORA E SÉRGIO',d:'2026-01-06',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:75000,l:1500,a:3200,st:sPerdido.id,ci:'',uf:'',md:''},
    {c:'EDIR SOCCOL JUNIOR',d:'2025-12-26',r:'Adriano Dorigon',o:'Weiku do Brasil',v:45000,l:1300,a:2600,st:sPerdido.id,ci:'',uf:'',md:''},
    {c:'FABIANO E PRISCILA',d:'2026-01-07',r:'',o:'Direto',v:0,l:0,a:0,st:sFazer.id,ci:'',uf:'',md:''},
    {c:'GUILHERME E MARIANA DALZOTTO',d:'2026-01-03',r:'',o:'Direto',v:0,l:0,a:0,st:sFazer.id,ci:'',uf:'',md:''},
    {c:'DANILO DE SOUZA SANTOS',d:'2026-01-07',r:'',o:'Direto',v:0,l:0,a:0,st:sFazer.id,ci:'',uf:'',md:''},
    {c:'ADRIANO DORIGON (140966)',d:'2026-01-15',r:'Adriano Dorigon',o:'Weiku do Brasil',v:45182,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'DEMARRE - DESIGN STUDIO',d:'2026-01-20',r:'',o:'Direto',v:237310,l:0,a:0,st:sGanho.id,ci:'',uf:'',md:''},
    {c:'MARINA LINA (LF)',d:'2026-01-08',r:'Luiz Fernando Starke',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'BERNARDO AMARAL',d:'2026-01-08',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'RESIDÊNCIA FÁBIO',d:'2026-01-08',r:'Gervásio Santa Rosa',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'RAPHAEL LARA',d:'2026-01-09',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'PRISCILA E LINEU',d:'2026-01-09',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'MERYANGELLI E ALEX',d:'2026-01-10',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ALESSANDRA E GUILHERME',d:'2026-01-10',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'LILIAN VIEIRA',d:'2026-01-10',r:'Carina Ap. Kazahaya (KAR)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'FRANCIELLE E GUSTAVO',d:'2026-01-10',r:'',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'VALTER LUIZ MOREIRA DE RESENDE',d:'2026-01-10',r:'Luiz Severino Moretto',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'NEWTON BRIÃO MARQUES',d:'2026-01-10',r:'Gervásio Santa Rosa',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'BIANCA OLIVEIRA DE SOUZA',d:'2026-01-14',r:'Carina Ap. Kazahaya (KAR)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'IGOR E EMMELYN',d:'2026-01-14',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'CARLOS FRAGOSO',d:'2026-01-14',r:'Márcio Daniel Gnigler (MDG)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'ISAIAS ROSA RAMOS JUNIOR',d:'2026-01-16',r:'Adalberto Fanderuff',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'MARIA TEREZA H. RIBEIRO',d:'2026-01-16',r:'Adalberto Fanderuff',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'WEIKU DOURADOS',d:'2026-01-17',r:'Primeira Linha MS',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'DOURADOS',uf:'MS',md:''},
    {c:'LUCAS GARBULHA DE CASTRO',d:'2026-01-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'DIANA LOPES',d:'2026-01-17',r:'Luciane C. de Grabalos (Euro)',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'CARLOS ANTÔNIO DA SILVA',d:'2026-01-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'RODRIGO DE OLIVEIRA KATAYAMA',d:'2026-01-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
    {c:'LEONICE ALVES',d:'2026-01-17',r:'Camila Vitorassi Preve',o:'Weiku do Brasil',v:0,l:0,a:0,st:sEnviada.id,ci:'',uf:'',md:''},
  ];
  var data=[];
  seed.forEach(function(s){
    data.push({
      id:uuid(),cliente:s.c,contato:'',produto:s.md?'Porta ACM Modelo '+s.md:'Porta ACM',
      responsavel:'',origem:s.o,wrep:s.r,valor:s.v,
      fechamento:'',prioridade:'normal',notas:'Importado da planilha ORÇAMENTOS 2026',
      largura:s.l,altura:s.a,abertura:'',modelo:s.md,cep:'',
      scope:'nacional',cidade:s.ci,estado:s.uf,pais:'',
      stage:s.st,createdAt:s.d+'T00:00:00.000Z',updatedAt:now,anexos:[]
    });
  });
  cSave(data);
}

document.addEventListener('DOMContentLoaded',function(){
  var _crmJustCleared=false;
  // CLEAR FLAG removido permanentemente — nunca mais apagar dados automaticamente

  // Seed data if empty (desativado)
  crmSeedIfEmpty();

  // Migration: ensure "Orçamento Pronto" stage exists
  var s=gS();var st=s.stages||[];
  if(st.length>0&&!st.find(function(x){return x.id==='s3b'||/pronto/i.test(x.label);})){
    var idx=st.findIndex(function(x){return/fazer/i.test(x.label);});
    if(idx>=0)st.splice(idx+1,0,{id:'s3b',label:'Orçamento Pronto',color:'#f39c12',icon:'📧'});
    else st.splice(3,0,{id:'s3b',label:'Orçamento Pronto',color:'#f39c12',icon:'📧'});
    s.stages=st;sS(s);
  }
  if(st.length>0){var old=st.find(function(x){return x.id==='s3b'&&(/enviar.*or/i.test(x.label)||/feito/i.test(x.label))&&!/pronto/i.test(x.label);});if(old){old.label='Orçamento Pronto';s.stages=st;sS(s);}}

  // Migration: add Weiku do Brasil to origins if missing
  var ors=s.origins||[];
  if(ors.length>0&&!ors.find(function(x){return x==='Weiku do Brasil';})){
    var wi=ors.indexOf('Representante Weiku');
    if(wi>=0)ors[wi]='Weiku do Brasil'; else ors.unshift('Weiku do Brasil');
    s.origins=ors;sS(s);
  }

  // Migrate existing cards: Representante Weiku → Weiku do Brasil
  if(!_crmJustCleared){
    var data=cLoad();var changed=false;
    data.forEach(function(o){if(o.origem==='Representante Weiku'){o.origem='Weiku do Brasil';changed=true;}});
    if(changed)cSave(data);
  }

  // Helper: merge cloud data
  function mergeCloudLocal(cloudDb){
    var local=cLoad();
    var localMap={};local.forEach(function(o){if(o.id)localMap[o.id]=o;});
    return cloudDb.map(function(co){
      var lo=localMap[co.id];
      if(lo&&lo.anexos&&lo.anexos.length>0){co.anexos=lo.anexos;}
      if(lo&&lo.dataContato&&!co.dataContato){co.dataContato=lo.dataContato;}
      return co;
    });
  }

  // Skip cloud sync if we just cleared — render empty CRM
  if(_crmJustCleared){
    crmRender();
  } else {
    // Load settings from cloud
    var SB='https://plmliavuwlgpwaizfeds.supabase.co',KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
    fetch(SB+'/rest/v1/configuracoes?chave=eq.'+SK+'&select=valor&limit=1',{headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}})
      .then(function(r){return r.json();}).then(function(rows){if(rows&&rows.length&&rows[0].valor&&rows[0].valor.data){sS(rows[0].valor.data);}}).catch(function(){});

    // Load CRM data from cloud
    cCloudLoad(function(val){
      if(val&&val.db&&val.db.length>0){
        var local=cLoad();
        if(val.db.length>=local.length){
          var merged=mergeCloudLocal(val.db);
          localStorage.setItem(CK,JSON.stringify(merged));
        }
      }
      crmRender();
    });
  }

  // Poll for changes every 5s (skip if just cleared)
  var _lastTs=null;
  setInterval(function(){
    if(_crmJustCleared) return; // Don't re-import during clear session
    cCloudLoad(function(val){
      if(!val||val.ts===_lastTs){if(!_lastTs&&val)_lastTs=val.ts;return;}
      _lastTs=val.ts;
      if(val.db){
        var merged=mergeCloudLocal(val.db);
        localStorage.setItem(CK,JSON.stringify(merged));
        crmRender();
      }
    });
  },5000);
});

})(); /* end CRM final */

/* ══ END MODULE: CRM ══ */

/* ══ MODULE: MESSAGING ══ */
/* ── NÃO EDITE OUTROS MÓDULOS AO ALTERAR ESTE ── */
/* ── Mensagem padrão + envio WhatsApp/Email ── */
var _MSG_KEY='projetta_msg_padrao';
function _getMsgPadrao(){
  try{var s=localStorage.getItem(_MSG_KEY);if(s)return s;}catch(e){}
  var el=document.getElementById('msg-padrao-texto');
  return el?el.value:'';
}
function salvarMsgPadrao(){
  var el=document.getElementById('msg-padrao-texto');
  if(!el)return;
  try{localStorage.setItem(_MSG_KEY,el.value);}catch(e){}
  var s=document.getElementById('msg-padrao-saved');
  if(s){s.style.display='inline';setTimeout(function(){s.style.display='none';},2000);}
}
function _carregarMsgPadrao(){
  var saved=null;
  try{saved=localStorage.getItem(_MSG_KEY);}catch(e){}
  // Reset if old format (missing new tokens)
  if(saved && (saved.indexOf('{cliente}')<0 || saved.indexOf('{detalhes}')<0 || saved.indexOf('{instalacao}')<0)){
    try{localStorage.removeItem(_MSG_KEY);}catch(e){}
    saved=null;
  }
  if(saved){var el=document.getElementById('msg-padrao-texto');if(el)el.value=saved;}
}
document.addEventListener('DOMContentLoaded',_carregarMsgPadrao);

function _buildMsg(){
  var msg=_getMsgPadrao();
  var cliente=(document.getElementById('crm-o-cliente')||{}).value||'';
  var produto=(document.getElementById('crm-o-produto')||{}).value||'';
  var valorEl=document.getElementById('crm-o-valor');
  var valor=valorEl&&valorEl.value?'R$ '+Number(valorEl.value).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';
  // Details from budget
  var larg=(document.getElementById('largura')||{}).value||(document.getElementById('crm-o-largura')||{}).value||'';
  var alt=(document.getElementById('altura')||{}).value||(document.getElementById('crm-o-altura')||{}).value||'';
  var modSel=document.getElementById('carac-modelo');
  var modelo=modSel&&modSel.selectedIndex>0?modSel.options[modSel.selectedIndex].text:'';
  var folhasSel=document.getElementById('carac-folhas');
  var folhas=folhasSel&&folhasSel.selectedIndex>0?folhasSel.options[folhasSel.selectedIndex].text:'';
  var detalhes='';
  if(larg||alt||modelo||folhas){
    detalhes='*Detalhes do Projeto:*';
    if(larg&&alt) detalhes+='\n• Dimensões: '+larg+' × '+alt+' mm';
    if(modelo) detalhes+='\n• Modelo: '+modelo;
    if(folhas) detalhes+='\n• Folhas: '+folhas;
  }
  // Installation location from CRM or budget
  var cep=(document.getElementById('crm-o-cep')||{}).value||(document.getElementById('cep-cliente')||{}).value||'';
  var cidadeEl=document.getElementById('crm-o-cidade-nac');
  var cidade=cidadeEl?cidadeEl.value:'';
  if(!cidade){var cEl=document.getElementById('cep-cidade');if(cEl)cidade=cEl.textContent||'';}
  var estadoEl=document.getElementById('crm-o-estado');
  var estado=estadoEl&&estadoEl.value?estadoEl.value:'';
  var instalacao='';
  if(cep||cidade||estado){
    instalacao='*Local de Instalação:*';
    if(cidade) instalacao+='\n• Cidade: '+cidade+(estado?' - '+estado:'');
    if(cep) instalacao+='\n• CEP: '+cep;
  }
  // Replace ALL tokens — only what's in the template gets sent
  msg=msg.replace(/\{cliente\}/gi,cliente)
         .replace(/\{produto\}/gi,produto)
         .replace(/\{valor\}/gi,valor)
         .replace(/\{detalhes\}/gi,detalhes)
         .replace(/\{instalacao\}/gi,instalacao);
  return msg;
}

var _cachedPdfBlob=null,_cachedPdfName='';

function _gerarPropostaPDF(cb){
  // Always populate proposta data before capturing
  if(typeof populateProposta==='function')populateProposta();
  var pages=document.querySelectorAll('.proposta-page');
  if(!pages.length){alert('Nenhuma proposta encontrada. Gere o orçamento primeiro.');return;}
  var tab=document.getElementById('tab-proposta');
  var wasHidden=!tab.classList.contains('on');
  if(wasHidden){tab.style.display='block';tab.style.position='absolute';tab.style.left='-9999px';}
  var jsPDF=window.jspdf.jsPDF;
  var pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  var pIdx=0;
  function next(){
    if(pIdx>=pages.length){
      if(wasHidden){tab.style.display='';tab.style.position='';tab.style.left='';}
      var blob=pdf.output('blob');
      _cachedPdfBlob=blob;_cachedPdfName=_pdfFileName();
      cb(pdf,blob);return;
    }
    var pg=pages[pIdx];
    html2canvas(pg,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false}).then(function(canvas){
      var imgData=canvas.toDataURL('image/jpeg',0.92);
      var w=210,h=canvas.height*w/canvas.width;
      if(pIdx>0)pdf.addPage();
      pdf.addImage(imgData,'JPEG',0,0,w,h);
      pIdx++;next();
    }).catch(function(){pIdx++;next();});
  }
  next();
}

function _pdfFileName(){
  var agp=(document.getElementById('num-agp')||document.getElementById('crm-o-agp')||{value:''}).value||'';
  var reserva=(document.getElementById('numprojeto')||document.getElementById('crm-o-reserva')||{value:''}).value||'';
  var cl=_getBestClientName();
  var parts=[agp,reserva,cl].filter(Boolean);
  var name=parts.join(' - ').replace(/[^a-zA-Z0-9\u00C0-\u017F \-]/g,'').replace(/ +/g,' ').trim();
  return (name||'Proposta_Projetta')+'.pdf';
}

// Fonte unificada do nome do cliente (usada por PDF e PNG)
function _getBestClientName(){
  // 0. Override global (usado quando PDF+PNG gerados juntos)
  if(window._pdfClienteOverride) return window._pdfClienteOverride;
  // 1. Se tem card CRM vinculado, usar nome do card (mais confiável)
  if(window._crmOrcCardId){
    try{
      var data=JSON.parse(localStorage.getItem('projetta_crm_v1')||'[]');
      var card=data.find(function(o){return o.id===window._crmOrcCardId;});
      if(card&&card.cliente) return card.cliente;
    }catch(e){}
  }
  // 2. Campo CRM modal (se aberto)
  var crmCli=(document.getElementById('crm-o-cliente')||{value:''}).value;
  if(crmCli) return crmCli;
  // 3. Campo orçamento
  return (document.getElementById('cliente')||{value:''}).value||'';
}

function _showToast(msg,color){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:10px;font-size:13px;font-weight:700;color:#fff;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.3);font-family:Montserrat,sans-serif;background:'+(color||'#27ae60');
  t.textContent=msg;document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='0';t.style.transition='opacity .4s';setTimeout(function(){t.remove();},500);},3500);
}

function _onStageOrcamentoPronto(){
  _showToast('\u23F3 Gerando PDF da proposta...','#e67e22');
  // Garantir cálculo atualizado antes de gerar proposta
  if(typeof calc==='function') calc();
  setTimeout(function(){
    _gerarPropostaPDF(function(pdf,blob){
      pdf.save(_pdfFileName());
      _showToast('\u2705 PDF da proposta gerado e baixado!','#27ae60');
    });
  },500);
}

function crmEnviarWhatsApp(){
  var tel=(document.getElementById('crm-o-contato')||{}).value||'';
  tel=tel.replace(/\D/g,'');
  if(!tel){alert('Preencha o n\u00famero de WhatsApp.');return;}
  if(tel.length<=11)tel='55'+tel;
  var msg=_buildMsg();
  window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(msg),'_blank');
}

function crmEnviarEmail(){
  var email=(document.getElementById('crm-o-email')||{}).value||'';
  if(!email||email.indexOf('@')<0){alert('Preencha o email do cliente.');return;}
  var cliente=(document.getElementById('crm-o-cliente')||{}).value||'Cliente';
  var msg=_buildMsg();
  var subject='Proposta Comercial \u2014 Projetta by Weiku \u2014 '+cliente;
  window.open('mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(msg),'_blank');
}
/* ══ END MODULE: MESSAGING ══ */
