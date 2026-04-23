/* ═══════════════════════════════════════════════════════════════════════════
   MODULE 38: FRETE ADMIN — Cadastro de rotas + patches p/ DAP condicional
   ═══════════════════════════════════════════════════════════════════════════
   Felipe 23/04/2026

   Adiciona CRUD de rotas LCL e FCL na aba Cadastro. Também monkey-patcha:
   - window.crmIncotermChange → inclui DAP na lista de incoterms que mostram CIF box
   - window.freteOpenCalc → esconde campo DAP Charges no modal quando incoterm != DAP

   NÃO modifica js/37-frete-calc.js. Usa Supabase REST direto (mesmo padrão
   dos outros módulos).
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var SB='https://plmliavuwlgpwaizfeds.supabase.co';
var KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

var _rotas=null, _rotasOriginal=null, _editing=null, _loaded=false;

function $(id){ return document.getElementById(id); }
function esc(s){ var d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; }
function num(id){ var el=$(id); return el?(parseFloat(el.value)||0):0; }
function str(id){ var el=$(id); return el?(el.value||''):''; }
function setVal(id,v){ var el=$(id); if(el) el.value=v==null?'':String(v); }

/* ── Load rotas do Supabase ────────────────────────────────────────────── */
function loadRotas(force){
  if(_loaded && !force && _rotas) return Promise.resolve();
  return fetch(SB+'/rest/v1/configuracoes?chave=eq.frete_rotas_v1&select=valor&limit=1',
    {headers:{'apikey':KEY,'Authorization':'Bearer '+KEY}})
    .then(function(r){return r.json();})
    .then(function(rows){
      var val=rows && rows[0] ? rows[0].valor : {rotas:[]};
      _rotas=(val.rotas||[]).slice();
      _rotasOriginal=JSON.stringify(_rotas);
      _loaded=true;
    })
    .catch(function(e){
      console.error('[frete-admin] erro ao carregar rotas:', e);
      _rotas=[]; _rotasOriginal='[]'; _loaded=true;
    });
}

window.freteAdminLoad=function(){
  if(!$('cad-frete-body')) return;
  loadRotas().then(render);
};

/* ── Render tabelas ───────────────────────────────────────────────────── */
function render(){
  if(!_rotas) return;
  var lcl=_rotas.filter(function(r){return r.modal==='LCL';});
  var fcl=_rotas.filter(function(r){return r.modal==='FCL_40HC';});
  var tbLcl=$('cad-frete-lcl-tbody'), tbFcl=$('cad-frete-fcl-tbody');
  if(tbLcl) tbLcl.innerHTML = lcl.length ? lcl.map(renderRow).join('') : emptyRow();
  if(tbFcl) tbFcl.innerHTML = fcl.length ? fcl.map(renderRow).join('') : emptyRow();
  updateDirty();
}

function emptyRow(){ return '<tr><td colspan="6" style="text-align:center;color:#888;padding:12px;font-style:italic">Nenhuma rota cadastrada</td></tr>'; }

function renderRow(r){
  var preco = r.modal==='LCL' ? ('US$ '+(r.usd_cbm||0)+'/CBM') : ('US$ '+(r.usd_flat||0)+' flat');
  var extras=[];
  if(r.dap_charges_usd) extras.push('DAP $'+r.dap_charges_usd);
  if(r.thc_override_usd_per_cbm) extras.push('THC ovr');
  if(r.ad_valorem_pct) extras.push('Ad-Val '+(r.ad_valorem_pct*100).toFixed(2)+'%');
  if(r.extras_brl && r.extras_brl.pre_stacking) extras.push('PreStk R$'+r.extras_brl.pre_stacking);
  var pais=(r.destino_pais||'')+(r.destino_uf?('/'+r.destino_uf):'');
  return '<tr>'
    +'<td style="padding:5px 8px;font-weight:600">'+esc(r.destino_nome||'—')+'</td>'
    +'<td style="padding:5px 8px;color:#666;font-size:11px">'+esc(pais)+'</td>'
    +'<td style="padding:5px 8px;font-variant-numeric:tabular-nums">'+esc(preco)+'</td>'
    +'<td style="padding:5px 8px;color:#888;font-size:10px">'+esc(extras.join(' · '))+'</td>'
    +'<td style="padding:5px 8px;color:#666;font-size:10px">'+esc(r.validade||'—')+'</td>'
    +'<td style="padding:5px 8px;text-align:right;white-space:nowrap">'
    +'<button type="button" onclick="freteAdminEdit(\''+esc(r.id)+'\')" style="border:none;background:transparent;cursor:pointer;padding:2px 5px;font-size:13px" title="Editar">✏️</button>'
    +'<button type="button" onclick="freteAdminDelete(\''+esc(r.id)+'\')" style="border:none;background:transparent;cursor:pointer;padding:2px 5px;font-size:13px" title="Remover">🗑️</button>'
    +'</td></tr>';
}

function updateDirty(){
  var dirty = _rotas && _rotasOriginal && JSON.stringify(_rotas)!==_rotasOriginal;
  var el=$('cad-frete-dirty');
  if(el){
    el.textContent = dirty ? '● Alterações não salvas' : '';
    el.style.color = dirty ? '#e67e22' : '#888';
  }
}

/* ── Modal edição ─────────────────────────────────────────────────────── */
window._freteAdminModalChange=function(){
  var mod=str('frete-admin-modal');
  var lcl=$('frete-admin-lcl-fields'), fcl=$('frete-admin-fcl-fields');
  if(lcl) lcl.style.display = (mod==='LCL') ? '' : 'none';
  if(fcl) fcl.style.display = (mod==='FCL_40HC') ? '' : 'none';
};

function openModal(rota, isNew){
  _editing={id: rota ? rota.id : null, isNew: !!isNew};
  rota = rota || {modal:'LCL', destino_nome:'', destino_pais:'', destino_uf:'', usd_cbm:0, validade:'', obs:''};
  var t=$('frete-admin-modal-title'); if(t) t.textContent = isNew ? '+ Nova Rota' : 'Editar Rota — '+rota.id;
  setVal('frete-admin-id', rota.id);
  var idEl=$('frete-admin-id'); if(idEl) idEl.readOnly = !isNew;
  setVal('frete-admin-modal', rota.modal || 'LCL');
  setVal('frete-admin-destino-nome', rota.destino_nome);
  setVal('frete-admin-destino-pais', rota.destino_pais);
  setVal('frete-admin-destino-uf', rota.destino_uf);
  setVal('frete-admin-usd-cbm', rota.usd_cbm || '');
  setVal('frete-admin-usd-flat', rota.usd_flat || '');
  setVal('frete-admin-validade', rota.validade || '');
  setVal('frete-admin-dap', rota.dap_charges_usd || '');
  setVal('frete-admin-thc-override', rota.thc_override_usd_per_cbm || '');
  setVal('frete-admin-loading-override', rota.loading_override_usd_per_cbm || '');
  var ex=rota.extras_usd||{};
  setVal('frete-admin-ex-handling', ex.handling || '');
  setVal('frete-admin-ex-customs-lcl', ex.customs_clearence || '');
  setVal('frete-admin-ex-customs-fcl', ex.customs_clearence || '');
  setVal('frete-admin-ex-ams', ex.transmissao_ams || '');
  var exb=rota.extras_brl||{};
  setVal('frete-admin-ex-prestacking', exb.pre_stacking || '');
  setVal('frete-admin-ad-valorem', rota.ad_valorem_pct ? (rota.ad_valorem_pct*100).toFixed(2) : '');
  setVal('frete-admin-obs', rota.obs || '');
  window._freteAdminModalChange();
  var bg=$('frete-admin-modal-bg'); if(bg) bg.classList.add('open');
}

window.freteAdminEdit=function(id){
  var r=_rotas.filter(function(x){return x.id===id;})[0];
  if(r) openModal(r, false);
};

window.freteAdminNew=function(modalType){
  openModal({modal: modalType || 'LCL'}, true);
};

window.freteAdminDelete=function(id){
  if(!confirm('Remover a rota "'+id+'" da lista?\n\n(A alteração só persiste depois de clicar em "Salvar Alterações")')) return;
  _rotas=_rotas.filter(function(r){return r.id!==id;});
  render();
};

window.freteAdminClose=function(){
  var bg=$('frete-admin-modal-bg'); if(bg) bg.classList.remove('open');
  _editing=null;
};

window.freteAdminSaveRota=function(){
  var id=str('frete-admin-id').trim();
  if(!id){ alert('ID único é obrigatório (ex: tokyo_lcl)'); return; }
  if(!/^[a-z0-9_]+$/.test(id)){ alert('ID só aceita letras minúsculas, números e _'); return; }
  var destino=str('frete-admin-destino-nome').trim();
  if(!destino){ alert('Nome do destino é obrigatório'); return; }
  var mod=str('frete-admin-modal');
  var rota={
    id:id, destino_nome:destino, modal:mod,
    destino_pais: str('frete-admin-destino-pais').trim().toUpperCase() || null,
    destino_uf: str('frete-admin-destino-uf').trim().toUpperCase() || null,
    validade: str('frete-admin-validade').trim() || null,
    obs: str('frete-admin-obs').trim() || null
  };
  if(mod==='LCL'){
    rota.usd_cbm = num('frete-admin-usd-cbm');
    if(rota.usd_cbm<=0){ alert('US$/CBM é obrigatório e deve ser > 0'); return; }
    var dap=num('frete-admin-dap'); if(dap>0) rota.dap_charges_usd=dap;
    var thcO=num('frete-admin-thc-override'); if(thcO>0) rota.thc_override_usd_per_cbm=thcO;
    var loadO=num('frete-admin-loading-override'); if(loadO>0) rota.loading_override_usd_per_cbm=loadO;
    var ex={};
    var h=num('frete-admin-ex-handling'); if(h>0) ex.handling=h;
    var c=num('frete-admin-ex-customs-lcl'); if(c>0) ex.customs_clearence=c;
    var a=num('frete-admin-ex-ams'); if(a>0) ex.transmissao_ams=a;
    rota.extras_usd=ex;
  } else {
    rota.usd_flat = num('frete-admin-usd-flat');
    if(rota.usd_flat<=0){ alert('US$ flat é obrigatório e deve ser > 0'); return; }
    var exu={};
    var c2=num('frete-admin-ex-customs-fcl'); if(c2>0) exu.customs_clearence=c2;
    rota.extras_usd=exu;
    var exb={};
    var ps=num('frete-admin-ex-prestacking'); if(ps>0) exb.pre_stacking=ps;
    if(Object.keys(exb).length) rota.extras_brl=exb;
    var av=num('frete-admin-ad-valorem'); if(av>0) rota.ad_valorem_pct = av/100;
  }
  if(_editing && _editing.isNew){
    if(_rotas.some(function(r){return r.id===id;})){ alert('ID "'+id+'" já existe. Use outro.'); return; }
    _rotas.push(rota);
  } else {
    var origId=(_editing && _editing.id) || id;
    var idx=_rotas.findIndex(function(r){return r.id===origId;});
    if(idx>=0) _rotas[idx]=rota; else _rotas.push(rota);
  }
  render();
  window.freteAdminClose();
};

window.freteAdminDiscard=function(){
  if(!_rotasOriginal) return;
  if(JSON.stringify(_rotas)===_rotasOriginal){ alert('Nenhuma alteração pendente'); return; }
  if(!confirm('Descartar todas as alterações locais e restaurar da nuvem?')) return;
  _rotas=JSON.parse(_rotasOriginal);
  render();
};

window.freteAdminSaveAll=function(){
  var btn=$('cad-frete-save-btn');
  if(btn){ btn.disabled=true; btn.textContent='Salvando…'; }
  var payload={
    versao:1,
    atualizado_em:new Date().toISOString().slice(0,10),
    fonte:'Editado via Cadastro → Frete Internacional',
    rotas:_rotas
  };
  fetch(SB+'/rest/v1/configuracoes',{
    method:'POST',
    headers:{
      'apikey':KEY,'Authorization':'Bearer '+KEY,
      'Content-Type':'application/json',
      'Prefer':'return=minimal,resolution=merge-duplicates'
    },
    body: JSON.stringify({chave:'frete_rotas_v1', valor:payload})
  }).then(function(r){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar Alterações'; }
    if(r.ok){
      _rotasOriginal=JSON.stringify(_rotas);
      window._FRETE_CFG=null; /* invalida cache do frete-calc pra próximo openCalc recarregar */
      updateDirty();
      alert('✓ '+_rotas.length+' rotas salvas na nuvem.');
    } else {
      r.text().then(function(t){ alert('Erro ao salvar: HTTP '+r.status+'\n'+t.substring(0,200)); });
    }
  }).catch(function(e){
    if(btn){ btn.disabled=false; btn.textContent='💾 Salvar Alterações'; }
    alert('Erro de rede: '+e.message);
  });
};

/* ── Monkey-patch crmIncotermChange pra DAP abrir o box CIF ─────────── */
function patchIncoterm(){
  var orig = window.crmIncotermChange;
  if(!orig || orig._dapPatched) return false;
  window.crmIncotermChange = function(){
    var r = orig.apply(this, arguments);
    try {
      var sel=document.getElementById('crm-o-inst-incoterm');
      var box=document.getElementById('crm-inst-cif-box');
      var title=document.getElementById('crm-cif-box-title');
      var totLbl=document.getElementById('crm-cif-total-label');
      var marWrap=document.getElementById('crm-cif-maritimo-wrap');
      if(sel && sel.value==='DAP' && box){
        box.style.display='';
        if(title) title.innerHTML='📦 Embalagem e Frete DAP (valores em USD)';
        if(totLbl) totLbl.textContent='Total DAP (caixa + fretes + entrega):';
        if(marWrap) marWrap.style.display='';
      }
    } catch(e){ console.warn('[frete-admin] incoterm patch:', e); }
    return r;
  };
  window.crmIncotermChange._dapPatched = true;
  return true;
}

/* ── Monkey-patch freteOpenCalc pra esconder DAP quando incoterm != DAP ─── */
function patchFreteOpen(){
  var orig = window.freteOpenCalc;
  if(!orig || orig._dapPatched) return false;
  window.freteOpenCalc = function(){
    var r = orig.apply(this, arguments);
    setTimeout(function(){
      try {
        var inc = (document.getElementById('crm-o-inst-incoterm')||{}).value || 'CIF';
        var dapWrap = document.getElementById('frete-calc-dap-wrap');
        if(dapWrap) dapWrap.style.display = (inc==='DAP') ? '' : 'none';
        if(inc !== 'DAP'){
          var dapInput = document.getElementById('frete-calc-dap');
          if(dapInput && +dapInput.value > 0){
            dapInput.value = 0;
            dapInput.dispatchEvent(new Event('input', {bubbles:true}));
          }
        }
      } catch(e){ console.warn('[frete-admin] freteOpen patch:', e); }
    }, 100);
    return r;
  };
  window.freteOpenCalc._dapPatched = true;
  return true;
}

/* ── Init ──────────────────────────────────────────────────────────────── */
function init(){
  /* Re-tenta patching por 5s caso frete-calc carregue depois */
  var tries=0;
  var timer=setInterval(function(){
    tries++;
    var a=patchIncoterm(), b=patchFreteOpen();
    if((a || window.crmIncotermChange && window.crmIncotermChange._dapPatched) &&
       (b || window.freteOpenCalc && window.freteOpenCalc._dapPatched)){
      clearInterval(timer);
      console.log('[frete-admin] patches aplicados em '+tries+' tentativa(s)');
    } else if(tries>=10){
      clearInterval(timer);
      console.warn('[frete-admin] patches incompletos apos '+tries+' tentativas');
    }
  }, 500);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
