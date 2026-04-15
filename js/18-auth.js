/**
 * 18-auth.js
 * Module: AUTH
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ MODULE: AUTH ══ */
(function(){
'use strict';
var USERS_KEY='projetta_users_v1';
var SESSION_KEY='projetta_auth_session';
var ONLINE_KEY='projetta_online_v1';
var PERMS_KEY='projetta_perms_v1';
var ADMIN_USER='felipe.projetta';
var ADMIN_PASS='12345';

var TABS=['crm','orcamento','proposta','cadastro','os','os-acess','planificador','relatorios'];
var TAB_LABELS={crm:'CRM',orcamento:'Orçamento',proposta:'Proposta',cadastro:'Cadastro',os:'Perfis','os-acess':'Acessórios',planificador:'Superfícies',relatorios:'Relatórios',custoreal:'Custo Real NFE'};
var PERM_OPTS=['Editar','Ver','Bloqueado'];

function getUsers(){
  var adminPass=ADMIN_PASS;
  try{var ap=localStorage.getItem('projetta_admin_pass');if(ap)adminPass=ap;}catch(e){}
  var def=[
    {user:ADMIN_USER,pass:adminPass,date:'Fixo',admin:true},
    {user:'thays.projetta',pass:'12345',date:'06/04/2026'},
    {user:'andressa.projetta',pass:'12345',date:'06/04/2026'}
  ];
  var defNames=def.map(function(d){return d.user;});
  try{var s=localStorage.getItem(USERS_KEY);if(s){var u=JSON.parse(s);if(u.length)return def.concat(u.filter(function(x){return defNames.indexOf(x.user)===-1;}));}}catch(e){}
  return def;
}
function saveUsers(list){
  var defNames=[ADMIN_USER,'thays.projetta','andressa.projetta'];
  var filtered=list.filter(function(x){return defNames.indexOf(x.user)===-1;});
  try{localStorage.setItem(USERS_KEY,JSON.stringify(filtered));}catch(e){}
  if(window._cloudPush) window._cloudPush("projetta_users_v1",filtered);
}
function getPerms(){try{return JSON.parse(localStorage.getItem(PERMS_KEY))||{};}catch(e){return {};}}
function savePerms(p){try{localStorage.setItem(PERMS_KEY,JSON.stringify(p));}catch(e){} if(window._cloudPush) window._cloudPush("projetta_perms_v1",p);}
function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY));}catch(e){return null;}}
function setSession(user){try{localStorage.setItem(SESSION_KEY,JSON.stringify({user:user,ts:Date.now()}));}catch(e){}}
function clearSession(){try{localStorage.removeItem(SESSION_KEY);}catch(e){}}

// Online tracking — synced via Supabase
var _SB_ONLINE='https://plmliavuwlgpwaizfeds.supabase.co';
var _SB_ONLINE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
function setOnline(user){
  try{
    var online=JSON.parse(localStorage.getItem(ONLINE_KEY)||'{}');
    online[user]={ts:Date.now()};
    localStorage.setItem(ONLINE_KEY,JSON.stringify(online));
  }catch(e){}
  // Sync to Supabase
  fetch(_SB_ONLINE+'/rest/v1/configuracoes',{method:'POST',
    headers:{'apikey':_SB_ONLINE_KEY,'Authorization':'Bearer '+_SB_ONLINE_KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates'},
    body:JSON.stringify({chave:ONLINE_KEY+'_'+user,valor:{user:user,ts:Date.now()}})
  }).catch(function(){});
}
function getOnlineUsers(){
  try{
    var online=JSON.parse(localStorage.getItem(ONLINE_KEY)||'{}');
    var now=Date.now();
    var active=[];
    Object.keys(online).forEach(function(u){
      if(now-online[u].ts<60000) active.push(u);
    });
    return active;
  }catch(e){return [];}
}
function removeOnline(user){
  try{var online=JSON.parse(localStorage.getItem(ONLINE_KEY)||'{}');delete online[user];localStorage.setItem(ONLINE_KEY,JSON.stringify(online));}catch(e){}
  fetch(_SB_ONLINE+'/rest/v1/configuracoes?chave=eq.'+ONLINE_KEY+'_'+user,{method:'DELETE',
    headers:{'apikey':_SB_ONLINE_KEY,'Authorization':'Bearer '+_SB_ONLINE_KEY}
  }).catch(function(){});
}
// Poll online users from Supabase every 8s
function syncOnlineFromCloud(){
  fetch(_SB_ONLINE+'/rest/v1/configuracoes?chave=like.'+ONLINE_KEY+'_*&select=valor',
    {headers:{'apikey':_SB_ONLINE_KEY,'Authorization':'Bearer '+_SB_ONLINE_KEY}})
    .then(function(r){return r.json();})
    .then(function(rows){
      if(!rows||!rows.length) return;
      var now=Date.now(), online={};
      rows.forEach(function(r){
        if(r.valor&&r.valor.user&&now-r.valor.ts<60000){
          online[r.valor.user]={ts:r.valor.ts};
        }
      });
      localStorage.setItem(ONLINE_KEY,JSON.stringify(online));
      if(typeof _renderOnlineWidget==='function') _renderOnlineWidget();
      if(typeof _renderAdminOnline==='function') _renderAdminOnline();
    }).catch(function(){});
}
setInterval(syncOnlineFromCloud,8000);
// Keep-alive: refresh own online status every 30s
var _onlineUser=null;
setInterval(function(){if(_onlineUser)setOnline(_onlineUser);},30000);

// ── LOGIN ──
window.authLogin=function(){
  var userEl=document.getElementById('login-user');
  var passEl=document.getElementById('login-pass');
  var errEl=document.getElementById('login-err');
  var u=(userEl.value||'').trim().toLowerCase();
  var p=(passEl.value||'').trim();
  if(!u||!p){errEl.textContent='Preencha usuário e senha.';return;}
  var users=getUsers();
  var found=users.find(function(x){return x.user.toLowerCase()===u&&x.pass===p;});
  if(!found){errEl.textContent='Usuário ou senha incorretos.';return;}
  setSession(found.user);
  setOnline(found.user);
  _onlineUser=found.user;
  _onLoginSuccess(found);
};

function _onLoginSuccess(userObj){
  var overlay=document.getElementById('login-overlay');
  overlay.classList.add('hide');
  setTimeout(function(){overlay.style.display='none';},500);
  // Show user badge
  _showUserBadge(userObj.user);
  // Show admin panel if admin
  if(userObj.admin||userObj.user===ADMIN_USER){
    var ap=document.getElementById('admin-panel');if(ap)ap.style.display='';
  }
  // Apply permissions
  _applyPerms(userObj.user);
  // Online ping
  _startOnlinePing(userObj.user);
}

function _showUserBadge(user){
  var existing=document.getElementById('user-badge');
  if(existing)existing.remove();
  var div=document.createElement('div');
  div.id='user-badge';
  div.className='login-online';
  div.innerHTML='<span class="dot-on"></span><span>'+user+'</span><button onclick="authLogout()" style="margin-left:8px;background:var(--orange);border:none;color:#fff;border-radius:6px;padding:3px 12px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">Sair ↪</button>';
  document.body.appendChild(div);
}

window.authChangePass=function(){
  var session=getSession();if(!session)return;
  authChangePassFor(session.user);
};

window.authChangePassFor=function(targetUser){
  var session=getSession();if(!session)return;
  var isAdmin=session.user===ADMIN_USER;
  var isSelf=session.user===targetUser;
  if(!isAdmin&&!isSelf){alert('Sem permissão.');return;}
  var nova=prompt('Nova senha para "'+targetUser+'":');
  if(!nova||nova.length<3){if(nova!==null)alert('Senha deve ter pelo menos 3 caracteres.');return;}
  var confirma=prompt('Confirme a nova senha:');
  if(nova!==confirma){alert('As senhas não conferem.');return;}
  var users=getUsers();
  var found=users.find(function(x){return x.user===targetUser;});
  if(!found){alert('Usuário não encontrado.');return;}
  found.pass=nova;
  if(found.admin||found.user===ADMIN_USER){
    try{localStorage.setItem('projetta_admin_pass',nova);}catch(e){}
  }
  saveUsers(users);
  _renderAdminUsers();
  alert('✅ Senha de "'+targetUser+'" alterada com sucesso!');
};

var _pingInterval=null;
function _startOnlinePing(user){
  if(_pingInterval)clearInterval(_pingInterval);
  _onlineUser=user;
  _pingInterval=setInterval(function(){setOnline(user);_renderOnlineWidget();},15000);
  setOnline(user);
  syncOnlineFromCloud();
  _createOnlineWidget();
  setTimeout(_renderOnlineWidget,500);
}

function _createOnlineWidget(){
  if(document.getElementById('online-widget'))return;
  var w=document.createElement('div');
  w.id='online-widget';
  w.style.cssText='position:fixed;bottom:14px;right:14px;background:var(--navy);border-radius:12px;padding:8px 14px;z-index:899;box-shadow:0 3px 12px rgba(0,0,0,.25);min-width:120px;font-family:Montserrat,sans-serif';
  w.innerHTML='<div style="font-size:9px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">● Online agora</div><div id="online-widget-list" style="font-size:11px;color:#fff"></div>';
  document.body.appendChild(w);
}

function _renderOnlineWidget(){
  var list=document.getElementById('online-widget-list');if(!list)return;
  var online=getOnlineUsers();
  if(!online.length){list.innerHTML='<span style="opacity:.5">ninguém</span>';return;}
  list.innerHTML=online.map(function(u){return '<div style="display:flex;align-items:center;gap:5px;padding:2px 0"><span style="width:6px;height:6px;border-radius:50%;background:#27ae60;flex-shrink:0"></span>'+u+'</div>';}).join('');
}

window.authLogout=function(){
  var session=getSession();
  if(session)removeOnline(session.user);
  clearSession();
  if(_pingInterval)clearInterval(_pingInterval);
  location.reload();
};

function _applyPerms(user){
  if(user===ADMIN_USER)return; // admin has full access
  var perms=getPerms();
  var userPerms=perms[user]||{};
  TABS.forEach(function(tab){
    var perm=userPerms[tab]||'Editar';
    var tabBtn=document.getElementById('btn-tab-'+tab);
    if(!tabBtn){
      // Try to find by onclick
      document.querySelectorAll('.main-tab').forEach(function(b){
        if(b.getAttribute('onclick')&&b.getAttribute('onclick').indexOf("'"+tab+"'")>=0)tabBtn=b;
      });
    }
    if(perm==='Bloqueado'&&tabBtn){
      tabBtn.style.opacity='.3';tabBtn.style.pointerEvents='none';tabBtn.title='Sem permissão';
    } else if(perm==='Ver'){
      // Read-only: will be handled at form level if needed
    }
  });
}

// ── ADMIN: Users ──
window.authAddUser=function(){
  var uEl=document.getElementById('admin-new-user');
  var pEl=document.getElementById('admin-new-pass');
  var u=(uEl.value||'').trim().toLowerCase();
  var p=(pEl.value||'').trim();
  if(!u||!p){alert('Preencha usuário e senha.');return;}
  var users=getUsers();
  if(users.find(function(x){return x.user.toLowerCase()===u.toLowerCase();})){alert('Usuário já existe.');return;}
  users.push({user:u,pass:p,date:new Date().toLocaleDateString('pt-BR')});
  saveUsers(users);
  uEl.value='';pEl.value='';
  _renderAdminUsers();
  _renderAdminPerms();
};

window.authRemoveUser=function(user){
  if(user===ADMIN_USER){alert('Não é possível remover o administrador.');return;}
  if(!confirm('Remover usuário "'+user+'"?'))return;
  var users=getUsers().filter(function(x){return x.user!==user;});
  saveUsers(users);
  _renderAdminUsers();
  _renderAdminPerms();
};

function _renderAdminUsers(){
  var tbody=document.getElementById('admin-users-list');if(!tbody)return;
  var users=getUsers();
  var session=getSession();
  var html='';
  users.forEach(function(u){
    var isAdmin=u.admin||u.user===ADMIN_USER;
    var isMe=session&&session.user===u.user;
    html+='<tr style="border-bottom:1px solid #eee">';
    html+='<td style="padding:10px 12px;font-weight:700;color:var(--navy)">'+u.user+(isAdmin?' <span style="background:var(--navy);color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800">ADMIN</span>':'')+(isMe?' <span style="background:#27ae60;color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800">VOCÊ</span>':'')+'</td>';
    html+='<td style="padding:10px 12px;color:var(--muted)"><span id="pass-mask-'+u.user.replace(/\./g,'_')+'">'+('•'.repeat(u.pass.length))+'</span><span id="pass-show-'+u.user.replace(/\./g,'_')+'" style="display:none;font-family:monospace">'+u.pass+'</span> <button onclick="var m=document.getElementById(\'pass-mask-'+u.user.replace(/\./g,'_')+'\'),s=document.getElementById(\'pass-show-'+u.user.replace(/\./g,'_')+'\');if(m.style.display!==\'none\'){m.style.display=\'none\';s.style.display=\'\';this.textContent=\'🙈\'}else{m.style.display=\'\';s.style.display=\'none\';this.textContent=\'👁\'}" style="background:none;border:none;font-size:14px;cursor:pointer;padding:2px 4px;vertical-align:middle">👁</button></td>';
    html+='<td style="padding:10px 12px;color:var(--muted);font-size:11px">'+(u.date||'—')+'</td>';
    html+='<td style="padding:10px 12px;text-align:right;white-space:nowrap">';
    html+='<button onclick="authChangePassFor(\''+u.user+'\')" style="padding:4px 12px;border-radius:6px;border:1px solid var(--orange);color:var(--orange);background:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:6px">🔑 Alterar Senha</button>';
    if(!isAdmin) html+='<button onclick="authRemoveUser(\''+u.user+'\')" style="padding:4px 8px;border-radius:6px;border:1px solid #e74c3c;color:#e74c3c;background:#fff;font-size:11px;cursor:pointer;font-family:inherit" title="Remover">✕</button>';
    html+='</td>';
    html+='</tr>';
  });
  tbody.innerHTML=html;
}

// ── ADMIN: Online ──
function _renderAdminOnline(){
  var div=document.getElementById('admin-online-list');if(!div)return;
  var online=getOnlineUsers();
  if(!online.length){div.innerHTML='<div style="color:var(--muted);font-size:12px;padding:6px 0">Nenhum usuário online no momento.</div>';return;}
  var html='<div style="display:flex;flex-wrap:wrap;gap:8px">';
  online.forEach(function(u){
    html+='<div style="display:flex;align-items:center;gap:6px;background:#eef6ff;border:1px solid var(--navy);border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;color:var(--navy)"><span class="dot-on"></span>'+u+'</div>';
  });
  html+='</div>';
  div.innerHTML=html;
}

// ── ADMIN: Permissions ──
function _renderAdminPerms(){
  var tbody=document.getElementById('admin-perms-body');
  if(!tbody)return;
  var users=getUsers().filter(function(u){return !u.admin&&u.user!==ADMIN_USER;});
  var perms=getPerms();
  if(!users.length){tbody.innerHTML='<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px">Adicione usuários acima para configurar permissões.</div>';return;}
  var html='';
  users.forEach(function(u,idx){
    var up=perms[u.user]||{};
    html+='<div style="background:#fff;border:1px solid var(--border-light);border-radius:10px;padding:14px 16px;margin-bottom:12px">';
    html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:14px;font-weight:700;color:var(--navy)">'+u.user+'</span>';
    html+='<button onclick="authSavePerms()" style="padding:5px 16px;border-radius:6px;border:none;background:var(--orange);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">💾 Salvar</button></div>';
    html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';
    TABS.forEach(function(t){
      var val=up[t]||'Editar';
      var bg=val==='Editar'?'#eef6ff':val==='Ver'?'#fef3e2':'#f5f3ef';
      var border=val==='Editar'?'var(--navy)':val==='Ver'?'var(--orange)':'#999';
      var color=val==='Editar'?'var(--navy)':val==='Ver'?'var(--orange)':'#999';
      html+='<div style="background:'+bg+';border:1.5px solid '+border+';border-radius:8px;padding:8px 10px;text-align:center">';
      html+='<div style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.03em;margin-bottom:4px">'+(TAB_LABELS[t]||t)+'</div>';
      html+='<select data-user="'+u.user+'" data-tab="'+t+'" onchange="this.parentElement.style.background=this.value===\'Editar\'?\'#eef6ff\':this.value===\'Ver\'?\'#fef3e2\':\'#f5f3ef\';this.parentElement.style.borderColor=this.value===\'Editar\'?\'#003144\':this.value===\'Ver\'?\'#c47012\':\'#999\'" style="width:100%;padding:5px 4px;border-radius:6px;border:1.5px solid '+border+';font-size:11px;font-weight:700;color:'+color+';background:#fff;cursor:pointer;font-family:inherit;text-align:center">';
      PERM_OPTS.forEach(function(opt){
        var optIcon=opt==='Editar'?'✏️ ':opt==='Ver'?'👁 ':'🚫 ';
        html+='<option value="'+opt+'"'+(val===opt?' selected':'')+'>'+optIcon+opt+'</option>';
      });
      html+='</select></div>';
    });
    html+='</div></div>';
  });
  tbody.innerHTML=html;
}

window.authSavePerms=function(){
  var perms=getPerms();
  var selects=document.querySelectorAll('#admin-perms-body select[data-user]');
  selects.forEach(function(s){
    var user=s.getAttribute('data-user');
    var tab=s.getAttribute('data-tab');
    if(!perms[user])perms[user]={};
    perms[user][tab]=s.value;
  });
  savePerms(perms);
  var msg=document.getElementById('admin-perms-saved');
  if(msg){msg.style.display='inline';setTimeout(function(){msg.style.display='none';},2000);}
  _renderAdminPerms();
};

// ── INIT ──
function _authInit(){
  // Set logo
  var logo=document.querySelector('.header-brand img');
  var loginLogo=document.getElementById('login-logo');
  if(logo&&loginLogo)loginLogo.src=logo.src;
  // Check session
  var session=getSession();
  if(session&&session.user){
    var users=getUsers();
    var found=users.find(function(x){return x.user===session.user;});
    if(found){
      _onLoginSuccess(found);
      return;
    }
  }
  // Show login
  document.getElementById('login-overlay').style.display='flex';
  setTimeout(function(){var u=document.getElementById('login-user');if(u)u.focus();},300);
}

// Render admin panels when switching to cadastro
var _origSwitchTab=window.switchTab;
window.switchTab=function(tabId){
  _origSwitchTab(tabId);
  if(tabId==='cadastro'){
    _renderAdminUsers();
    _renderAdminOnline();
    _renderAdminPerms();
    try{cadRenderRepsWeiku();}catch(e){}
  }
};

// Periodically update online list
setInterval(function(){
  var session=getSession();
  if(session&&session.user){
    _renderOnlineWidget();
    var ap=document.getElementById('admin-online-body');
    if(ap&&ap.style.display!=='none')_renderAdminOnline();
  }
},10000);

document.addEventListener('DOMContentLoaded',function(){setTimeout(_authInit,200);});

// Logout on tab close
window.addEventListener('beforeunload',function(){
  var session=getSession();
  if(session)removeOnline(session.user);
});

})();
/* ══ END MODULE: AUTH ══ */

/* ══ MODULE: MULTI-PORTA ══════════════════════════════════════════════ */
/* Gerencia itens da proposta com portas de tamanhos diferentes */
window._mpItens=[];
window._mpEditingIdx=-1; // -1 = não editando nenhum item

// Campos do formulário que são POR ITEM (cada porta diferente)
var _MP_ITEM_FIELDS=['largura','altura','qtd-portas','folhas-porta',
  'carac-modelo','carac-abertura','carac-folhas',
  'carac-cor-ext','carac-cor-int',
  'carac-fech-mec','carac-fech-dig','carac-cilindro',
  'carac-puxador','carac-pux-tam',
  'carac-largura-cava','carac-dist-borda-cava',
  'carac-largura-friso','carac-dist-borda-friso',
  'carac-friso-vert','carac-friso-horiz',
  'carac-tem-alisar','plan-refilado'];

function _mpCaptureItem(){
  var data={};
  _MP_ITEM_FIELDS.forEach(function(f){
    var el=document.getElementById(f);
    if(!el) return;
    if(el.type==='checkbox') data[f]=el.checked?'1':'0';
    else data[f]=el.value||'';
  });
  // Fixos
  data['tem-fixo']=document.getElementById('tem-fixo')?document.getElementById('tem-fixo').checked:false;
  var fixos=[];
  document.querySelectorAll('.fixo-blk').forEach(function(bl){
    fixos.push({
      larg:(bl.querySelector('.fixo-larg')||{value:''}).value,
      alt:(bl.querySelector('.fixo-alt')||{value:''}).value,
      qty:(bl.querySelector('.fixo-qty')||{value:'1'}).value,
      lado:(bl.querySelector('.fixo-lado')||{value:'esquerdo'}).value,
      lados:(bl.querySelector('.fixo-lados')||{value:'1'}).value,
      estr:(bl.querySelector('.fixo-estr')||{value:'nao'}).value
    });
  });
  data._fixos=fixos;
  // Meta
  var modEl=document.getElementById('carac-modelo');
  data._modeloTxt=modEl&&modEl.selectedIndex>=0?(modEl.options[modEl.selectedIndex].text||''):'';
  data._modelo=modEl?modEl.value:'01';
  data._largura=parseFloat(data['largura'])||0;
  data._altura=parseFloat(data['altura'])||0;
  data._qtd=parseInt(data['qtd-portas'])||1;
  data._folhas=parseInt(data['folhas-porta'])||1;
  return data;
}

function _mpRestoreItem(data){
  if(!data) return;
  _MP_ITEM_FIELDS.forEach(function(f){
    var el=document.getElementById(f);
    if(!el||data[f]===undefined) return;
    if(el.type==='checkbox') el.checked=(data[f]==='1');
    else el.value=data[f];
  });
  // Fixos
  var temFixo=document.getElementById('tem-fixo');
  if(temFixo) temFixo.checked=!!data['tem-fixo'];
  if(typeof toggleFixos==='function') toggleFixos();
  // Remover fixos existentes e recriar
  var fixosList=document.getElementById('fixos-list');
  if(fixosList) fixosList.innerHTML='';
  if(data._fixos&&data._fixos.length>0){
    data._fixos.forEach(function(fx){
      if(typeof addFixo==='function') addFixo();
      var lastBlk=document.querySelector('.fixo-blk:last-child');
      if(lastBlk){
        var larg=lastBlk.querySelector('.fixo-larg');if(larg)larg.value=fx.larg||'';
        var alt=lastBlk.querySelector('.fixo-alt');if(alt)alt.value=fx.alt||'';
        var qty=lastBlk.querySelector('.fixo-qty');if(qty)qty.value=fx.qty||'1';
        var lado=lastBlk.querySelector('.fixo-lado');if(lado)lado.value=fx.lado||'esquerdo';
        var lados=lastBlk.querySelector('.fixo-lados');if(lados)lados.value=fx.lados||'1';
        var estr=lastBlk.querySelector('.fixo-estr');if(estr)estr.value=fx.estr||'nao';
      }
    });
  }
  // Disparar eventos
  ['largura','altura'].forEach(function(id){var el=document.getElementById(id);if(el)el.dispatchEvent(new Event('input',{bubbles:true}));});
  var modEl=document.getElementById('carac-modelo');
  if(modEl) modEl.dispatchEvent(new Event('change',{bubbles:true}));
  if(typeof calc==='function') calc();
}

function _mpNovoItem(){
  // Salvar item atual se estiver editando
  if(window._mpEditingIdx>=0) _mpSalvarItemAtual();
  // Criar novo item com dados atuais do form (ou padrão se vazio)
  var data=_mpCaptureItem();
  data.id='mp_'+Date.now();
  window._mpItens.push(data);
  window._mpEditingIdx=window._mpItens.length-1;
  _mpRender();
  // Limpar form para o novo item
  ['largura','altura'].forEach(function(f){var el=document.getElementById(f);if(el)el.value='';});
  document.getElementById('qtd-portas').value='1';
  var t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 3px 12px rgba(0,0,0,.2)';
  t.textContent='✅ Item '+(window._mpItens.length)+' salvo! Configure o próximo item abaixo.';
  document.body.appendChild(t);setTimeout(function(){t.remove();},3000);
}

function _mpSalvarItemAtual(){
  if(window._mpEditingIdx<0||!window._mpItens[window._mpEditingIdx]) return;
  var data=_mpCaptureItem();
  data.id=window._mpItens[window._mpEditingIdx].id||('mp_'+Date.now());
  window._mpItens[window._mpEditingIdx]=data;
  _mpRender();
  var t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a5276;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 3px 12px rgba(0,0,0,.2)';
  t.textContent='💾 Item '+(window._mpEditingIdx+1)+' atualizado!';
  document.body.appendChild(t);setTimeout(function(){t.remove();},2000);
}

function _mpCarregarItem(idx){
  if(window._mpEditingIdx>=0) _mpSalvarItemAtual(); // salvar atual antes de trocar
  if(!window._mpItens[idx]) return;
  _mpRestoreItem(window._mpItens[idx]);
  window._mpEditingIdx=idx;
  _mpRender();
  // Sync planificador com dados do item
  var it=window._mpItens[idx];
  if(it){
    var mod=it['carac-modelo']||it._modelo||'01';
    if(document.getElementById('plan-modelo')) document.getElementById('plan-modelo').value=mod;
    if(document.getElementById('plan-folhas')) document.getElementById('plan-folhas').value=it['folhas-porta']||it._folhas||'1';
    if(document.getElementById('plan-refilado')) document.getElementById('plan-refilado').value=it['plan-refilado']||'20';
    if(document.getElementById('plan-disborcava')) document.getElementById('plan-disborcava').value=it['carac-dist-borda-cava']||'210';
    if(document.getElementById('plan-largcava')) document.getElementById('plan-largcava').value=it['carac-largura-cava']||'150';
    if(document.getElementById('plan-disbordafriso')) document.getElementById('plan-disbordafriso').value=it['carac-dist-borda-friso']||'';
    if(document.getElementById('plan-largfriso')) document.getElementById('plan-largfriso').value=it['carac-largura-friso']||'';
    // Trigger onModeloChange para ativar cava/friso sections
    if(typeof onModeloChange==='function') try{onModeloChange();}catch(e){}
    // Sync cor da chapa
    var corExt=it['carac-cor-ext']||'';
    if(corExt&&document.getElementById('carac-cor-ext')){
      document.getElementById('carac-cor-ext').value=corExt;
      if(typeof _syncCorToChapa==='function') try{_syncCorToChapa();}catch(e){}
    }
  }
  // Abrir seção Características se fechada
  var caracBody=document.getElementById('carac-body');
  if(caracBody&&caracBody.style.display==='none'){
    caracBody.style.display='';
    var caracBadge=document.getElementById('carac-badge');
    if(caracBadge) caracBadge.innerHTML='&#9650; fechar';
  }
  // Scroll para Características da Porta
  var caracSec=document.getElementById('carac-body')||document.getElementById('largura');
  if(caracSec) caracSec.scrollIntoView({behavior:'smooth',block:'start'});
  // Toast indicando qual item está editando
  var _tIt=document.createElement('div');
  _tIt.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#e67e22;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 3px 12px rgba(0,0,0,.2)';
  _tIt.textContent='✏ Editando Item '+(idx+1)+': '+(it._largura||it['largura']||'?')+'×'+(it._altura||it['altura']||'?')+' mm';
  document.body.appendChild(_tIt);setTimeout(function(){_tIt.remove();},2500);
  // Auto-recalcular planificador e custo
  setTimeout(function(){
    if(typeof planUpd==='function') try{planUpd();}catch(e){}
    if(typeof _autoSelectAndRun==='function') try{_autoSelectAndRun();}catch(e){}
    setTimeout(function(){
      if(typeof planRun==='function') try{planRun();}catch(e){}
      setTimeout(function(){
        if(typeof _syncChapaToOrc==='function') try{_syncChapaToOrc();}catch(e){}
        if(typeof calc==='function') calc();
      },300);
    },300);
  },300);
}

function _mpRender(){
  var list=document.getElementById('mp-list');
  var empty=document.getElementById('mp-empty');
  var banner=document.getElementById('mp-editing-banner');
  var btnSalvar=document.getElementById('mp-btn-salvar');
  if(!window._mpItens.length){
    if(empty) empty.style.display='';
    if(list) list.innerHTML='';
    if(banner) banner.style.display='none';
    if(btnSalvar) btnSalvar.style.display='none';
    window._mpEditingIdx=-1;
    return;
  }
  if(empty) empty.style.display='none';
  if(btnSalvar) btnSalvar.style.display='inline-flex';
  var totalQtd=0;
  var html='';
  window._mpItens.forEach(function(it,i){
    var qtd=parseInt(it._qtd||it['qtd-portas'])||1;
    totalQtd+=qtd;
    var isEditing=i===window._mpEditingIdx;
    var bg=isEditing?'#fff8f0':'#fff';
    var border=isEditing?'border-left:4px solid #e67e22;':'border-left:4px solid transparent;';
    var modelo=it._modeloTxt||it._modelo||'—';
    var L=it._largura||parseFloat(it['largura'])||0;
    var A=it._altura||parseFloat(it['altura'])||0;
    var temFixo=it['tem-fixo']||it.temFixo;
    var nFixos=it._fixos?it._fixos.length:0;
    var _modNome2=(it._modeloTxt||'').toLowerCase();
    var _isCavaCard=_modNome2.indexOf('cava')>=0;
    var _dbCava=it['carac-dist-borda-cava']||'210';
    var _lcCava=it['carac-largura-cava']||'150';
    var corExt=it['carac-cor-ext']||'';
    // Buscar texto da cor externa do select
    var _corExtTxt='';
    if(corExt){var _ceOpt=document.querySelector('#carac-cor-ext option[value=\"'+corExt+'\"]');_corExtTxt=_ceOpt?_ceOpt.textContent:corExt;}
    html+='<div style="padding:8px 14px;background:'+bg+';'+border+'border-bottom:1px solid #eee;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="_mpCarregarItem('+i+')">';
    html+='<span style="font-size:16px;font-weight:800;color:'+(isEditing?'#e67e22':'#003144')+';min-width:28px">'+(i+1)+'</span>';
    html+='<div style="flex:1;min-width:0">';
    html+='<div style="font-size:12px;font-weight:700;color:#003144">'+modelo+'</div>';
    html+='<div style="font-size:10px;color:#888">'+L+' × '+A+' mm';
    if(_isCavaCard) html+=' · <b style="color:#e65100">Cava '+_dbCava+'×'+_lcCava+'</b>';
    if(temFixo) html+=' · '+nFixos+' fixo(s)';
    if(_corExtTxt) html+=' · '+_corExtTxt;
    html+='</div>';
    html+='</div>';
    html+='<span style="background:#e67e22;color:#fff;font-size:12px;font-weight:800;padding:3px 10px;border-radius:12px;min-width:30px;text-align:center">×'+qtd+'</span>';
    if(isEditing) html+='<span style="font-size:10px;color:#e67e22;font-weight:700">✏ editando</span>';
    html+='<button onclick="event.stopPropagation();_mpRemover('+i+')" style="background:none;border:1px solid #e74c3c;color:#e74c3c;border-radius:4px;font-size:10px;cursor:pointer;padding:2px 6px;font-weight:700" title="Remover">✕</button>';
    html+='</div>';
  });
  // Total
  html+='<div style="background:#003144;color:#fff;padding:6px 14px;display:flex;justify-content:space-between;font-size:11px;font-weight:700">';
  html+='<span>TOTAL: '+window._mpItens.length+' item(ns)</span>';
  html+='<span>'+totalQtd+' porta(s)</span></div>';
  if(list) list.innerHTML=html;
  // Banner
  if(banner&&window._mpEditingIdx>=0){
    banner.style.display='flex';
    var label=document.getElementById('mp-editing-label');
    var it=window._mpItens[window._mpEditingIdx];
    if(label) label.textContent='Item '+(window._mpEditingIdx+1)+' — '+(it._modeloTxt||'')+(it._largura?' '+it._largura+'×'+it._altura:'');
  } else if(banner){
    banner.style.display='none';
  }
}

function _mpRemover(idx){
  if(!confirm('Remover item '+(idx+1)+'?'))return;
  window._mpItens.splice(idx,1);
  if(window._mpEditingIdx===idx) window._mpEditingIdx=-1;
  else if(window._mpEditingIdx>idx) window._mpEditingIdx--;
  _mpRender();
}

function _mpGetItens(){
  // Salvar item atual se editando
  if(window._mpEditingIdx>=0&&window._mpItens.length>0) _mpSalvarItemAtual();
  if(window._mpItens.length>0){
    var result=window._mpItens.map(function(it){
      return {
        id:it.id,
        modelo:it._modelo||it['carac-modelo']||'01',
        modeloTxt:it._modeloTxt||'',
        largura:parseFloat(it._largura||it['largura'])||0,
        altura:parseFloat(it._altura||it['altura'])||0,
        folhas:parseInt(it._folhas||it['folhas-porta'])||1,
        qtd:parseInt(it._qtd||it['qtd-portas'])||1,
        abertura:it['carac-abertura']||'',
        temFixo:!!(it['tem-fixo']),
        fixos:it._fixos||null,
        corExt:it['carac-cor-ext']||'',
        corInt:it['carac-cor-int']||''
      };
    });
    console.log('📋 _mpGetItens: '+result.length+' itens → '+result.map(function(r){return r.largura+'×'+r.altura;}).join(', '));
    return result;
  }
  // Sem itens: usar formulário (compatibilidade)
  var modEl=document.getElementById('carac-modelo');
  return [{
    id:'single',
    modelo:modEl?modEl.value:'01',
    modeloTxt:modEl&&modEl.selectedIndex>=0?(modEl.options[modEl.selectedIndex].text||''):'',
    largura:parseFloat(document.getElementById('largura').value)||0,
    altura:parseFloat(document.getElementById('altura').value)||0,
    folhas:parseInt((document.getElementById('folhas-porta')||{value:'1'}).value)||1,
    qtd:parseInt((document.getElementById('qtd-portas')||{value:'1'}).value)||1,
    abertura:(document.getElementById('carac-abertura')||{value:''}).value,
    temFixo:document.getElementById('tem-fixo')?document.getElementById('tem-fixo').checked:false,
    fixos:null,
    corExt:(document.getElementById('carac-cor-ext')||{value:''}).value,
    corInt:(document.getElementById('carac-cor-int')||{value:''}).value
  }];
}

/* Calcula todos os cortes de perfis de todos os itens combinados */
function _mpCalcAllCuts(barraMM){
  var itens=_mpGetItens();
  var allCuts=[];
  var errors=[];
  itens.forEach(function(it,i){
    if(it.largura<=0||it.altura<=0){errors.push('Item '+(i+1)+': sem dimensões');return;}
    var nFolhas=it.folhas||1;
    // Calcular cortes para este item
    try{
      var d=_calcularDadosPerfis(it.largura, it.altura, nFolhas, barraMM);
      if(d.error){errors.push('Item '+(i+1)+': '+d.error);return;}
      // Multiplicar por quantidade deste item
      d.cuts.forEach(function(c){
        c.qty=c.qty*it.qtd;
        c._itemIdx=i; // marcar de qual item veio
        allCuts.push(c);
      });
    }catch(e){errors.push('Item '+(i+1)+': erro no cálculo');}
  });
  return {cuts:allCuts, errors:errors, itens:itens};
}

/* Calcula todas as peças de chapa de todos os itens combinados */
function _mpCalcAllPieces(){
  var itens=_mpGetItens();
  var allPieces=[];
  itens.forEach(function(it,i){
    if(it.largura<=0||it.altura<=0) return;
    var fol=it.folhas||1;
    // Usar planificador de modelo
    var modVal=it.modelo||'01';
    if(typeof plnPecas==='function'){
      var pieces=plnPecas(it.largura, it.altura, fol, modVal);
      pieces.forEach(function(p){
        var pc=Array.isArray(p)?{label:p[0],w:p[1],h:p[2],qty:(p[3]||1)*it.qtd}:{label:p.label,w:p.w,h:p.h,qty:(p.qty||1)*it.qtd};
        pc._itemIdx=i;
        allPieces.push(pc);
      });
    }
  });
  return allPieces;
}
/* Calcula perfis combinados de múltiplas portas (multi-door) */
function _mpCalcCombinedPerfis(barraMM){
  var itens=_mpGetItens();
  var allCuts=[];
  var firstD=null;
  // Salvar estado do form
  var savedQP=document.getElementById('qtd-portas').value;
  var savedL=document.getElementById('largura').value;
  var savedA=document.getElementById('altura').value;
  var savedMod=document.getElementById('carac-modelo')?document.getElementById('carac-modelo').value:'';
  var savedFol=document.getElementById('folhas-porta')?document.getElementById('folhas-porta').value:'1';
  var savedCavaDist=(document.getElementById('carac-dist-borda-cava')||{value:''}).value;
  var savedCavaLarg=(document.getElementById('carac-largura-cava')||{value:''}).value;
  var savedFrisoDist=(document.getElementById('carac-dist-borda-friso')||{value:''}).value;
  var savedFrisoLarg=(document.getElementById('carac-largura-friso')||{value:''}).value;
  // Desligar qP (cada item tem sua qtd)
  document.getElementById('qtd-portas').value='1';

  itens.forEach(function(it,idx){
    if(it.largura<=0||it.altura<=0) return;
    // Setar form para este item (todos os campos que _calcularDadosPerfis lê)
    document.getElementById('largura').value=it.largura;
    document.getElementById('altura').value=it.altura;
    if(document.getElementById('carac-modelo')) document.getElementById('carac-modelo').value=it.modelo||'01';
    if(document.getElementById('folhas-porta')) document.getElementById('folhas-porta').value=it.folhas||'1';
    // Setar cava/friso do item (lidos pelo _calcularDadosPerfis)
    var _mpIt=window._mpItens&&window._mpItens[idx]?window._mpItens[idx]:null;
    if(_mpIt){
      if(document.getElementById('carac-dist-borda-cava')) document.getElementById('carac-dist-borda-cava').value=_mpIt['carac-dist-borda-cava']||'210';
      if(document.getElementById('carac-largura-cava')) document.getElementById('carac-largura-cava').value=_mpIt['carac-largura-cava']||'150';
      if(document.getElementById('carac-dist-borda-friso')) document.getElementById('carac-dist-borda-friso').value=_mpIt['carac-dist-borda-friso']||'';
      if(document.getElementById('carac-largura-friso')) document.getElementById('carac-largura-friso').value=_mpIt['carac-largura-friso']||'';
    }
    // Calcular cortes deste item
    try{
      var d=_calcularDadosPerfis(it.largura,it.altura,it.folhas||1,barraMM);
      if(d.error) return;
      if(!firstD) firstD=d;
      // Coletar cortes (sem qP pois qtd-portas=1), multiplicar por qty do item
      d.cuts.forEach(function(c){
        allCuts.push({
          code:c.code, desc:c.desc, compMM:c.compMM,
          qty:c.qty*it.qtd,
          pintado:c.pintado, secao:c.secao,
          barLenMM:c.barLenMM, lh:c.lh||'', obs:c.obs||'',
          perf:c.perf, kgM:c.kgM||0,
          isSplit:c.isSplit, splitPieces:c.splitPieces,
          splitDesc:c.splitDesc||'',
          _itemIdx:idx, _itemLabel:'Item '+(idx+1)+': '+it.modeloTxt+' '+it.largura+'×'+it.altura
        });
      });
    }catch(e){console.warn('MP item '+idx+' error:',e);}
  });

  // Restaurar form
  document.getElementById('qtd-portas').value=savedQP;
  document.getElementById('largura').value=savedL;
  document.getElementById('altura').value=savedA;
  if(document.getElementById('carac-modelo')) document.getElementById('carac-modelo').value=savedMod;
  if(document.getElementById('folhas-porta')) document.getElementById('folhas-porta').value=savedFol;
  if(document.getElementById('carac-dist-borda-cava')) document.getElementById('carac-dist-borda-cava').value=savedCavaDist;
  if(document.getElementById('carac-largura-cava')) document.getElementById('carac-largura-cava').value=savedCavaLarg;
  if(document.getElementById('carac-dist-borda-friso')) document.getElementById('carac-dist-borda-friso').value=savedFrisoDist;
  if(document.getElementById('carac-largura-friso')) document.getElementById('carac-largura-friso').value=savedFrisoLarg;

  if(!firstD) return {error:'Nenhum item válido na tabela multi-porta'};

  // ── Re-otimizar barras com TODOS os cortes combinados ──
  var kgTecno=parseFloat((document.getElementById('pf-kg-tecnoperfil')||{value:0}).value)||0;
  var kgMerc=parseFloat((document.getElementById('pf-kg-mercado')||{value:0}).value)||0;
  var kgWeiku=parseFloat((document.getElementById('pf-kg-weiku')||{value:0}).value)||0;
  var precoPint=parseFloat((document.getElementById('pf-preco-pintura')||{value:0}).value)||0;

  function _getPerf(code){
    for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===code)return PERFIS_DB[i];}
    var base=code.replace(/-[678]M$/,'');
    for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===base)return PERFIS_DB[i];}
    return null;
  }
  function _getPrecoKg(p){
    if(!p)return kgMerc;
    var f=p.f||'';
    if(f==='TECNOPERFIL'||f==='PROJETTA')return kgTecno;
    if(f==='WEIKU')return kgWeiku;
    if(f==='PERFISUD')return kgTecno;
    return kgMerc;
  }

  // Agrupar e otimizar
  var groups={},seenKeys=[];
  allCuts.forEach(function(c){
    if(!c.perf) c.perf=_getPerf(c.code);
    if(!c.kgM && c.perf) c.kgM=c.perf.kg||0;
    var key=c.code;
    if(!groups[key]){
      groups[key]={code:key,allCuts:[],pintado:c.pintado,barLenMM:c.barLenMM,perf:c.perf,precoKg:_getPrecoKg(c.perf)};
      seenKeys.push(key);
    }
    for(var i=0;i<c.qty;i++){
      if(c.isSplit&&c.splitPieces){
        c.splitPieces.forEach(function(p){groups[key].allCuts.push(p);});
      } else {
        groups[key].allCuts.push(c.compMM);
      }
    }
  });

  var groupRes={};
  seenKeys.forEach(function(key){
    var g=groups[key];
    var bars=binPackFFD(g.allCuts,g.barLenMM);
    var nBars=bars.length;
    var totUsed=g.allCuts.reduce(function(s,x){return s+x;},0);
    var totBruto=bars.reduce(function(s,b){return s+b.barLen;},0);
    var aprov=totBruto>0?totUsed/totBruto*100:0;
    var kgM=g.perf?g.perf.kg:0;
    var kgLiq=totUsed/1000*kgM;
    var kgBruto=totBruto/1000*kgM;
    var custoPerfil=kgBruto*g.precoKg;
    var custoPintura=g.pintado?kgBruto*precoPint:0;
    var barsDetail=bars.map(function(b){
      return {len:b.barLen,items:b.items.slice().sort(function(a,x){return x-a;}),remaining:b.remaining,sobra:b.sobra!=null?b.sobra:b.remaining};
    });
    groupRes[key]={nBars:nBars,totUsed:totUsed,totBruto:totBruto,aprov:aprov,
      kgLiq:kgLiq,kgBruto:kgBruto,precoKg:g.precoKg,
      custoPerfil:custoPerfil,custoPintura:custoPintura,custoTotal:custoPerfil+custoPintura,
      barLenMM:g.barLenMM,pintado:g.pintado,barsDetail:barsDetail};
  });

  // Montar d compatível com o retorno de _calcularDadosPerfis
  var merged={
    cuts:allCuts, groupRes:groupRes, seenKeys:seenKeys,
    sis:firstD.sis, N_H:firstD.N_H,
    temCava:firstD.temCava, larguraCava:firstD.larguraCava,
    travCavaSize:firstD.travCavaSize,
    vedaSize:firstD.vedaSize, vedaCode:firstD.vedaCode, vedaQty:firstD.vedaQty,
    folhaPAPA:firstD.folhaPAPA,
    kgTecno:kgTecno, kgMerc:kgMerc, precoPint:precoPint,
    isPintado:firstD.isPintado,
    _multiDoor:true, _itens:itens
  };
  // Calcular peso perfis FOLHA por porta
  var _perfisPerDoor={};
  var _perfisTotalFolha=0;
  allCuts.forEach(function(c){
    if((c.secao==='FOLHA'||c.secao==='FRISO')&&c.perf){
      var kg=(c.compMM/1000)*(c.perf.kg||0)*c.qty;
      _perfisTotalFolha+=kg;
      var di=c._itemIdx;
      if(di!==undefined) _perfisPerDoor[di]=(_perfisPerDoor[di]||0)+kg;
    }
  });
  window._pesoPerfisFolha=_perfisTotalFolha;
  window._perfisPerDoor=_perfisPerDoor;
  return merged;
}

/* Calcula todas as peças de chapa para multi-door combinado */
function _mpCalcAllPiecesCombined(){
  var itens=_mpGetItens();
  var allPieces=[];
  var savedMod=document.getElementById('plan-modelo')?document.getElementById('plan-modelo').value:'';
  var savedFol=document.getElementById('plan-folhas')?document.getElementById('plan-folhas').value:'1';
  var savedPDC=(document.getElementById('plan-disborcava')||{value:''}).value;
  var savedPLC=(document.getElementById('plan-largcava')||{value:''}).value;
  var savedPDF=(document.getElementById('plan-disbordafriso')||{value:''}).value;
  var savedPLF=(document.getElementById('plan-largfriso')||{value:''}).value;
  var savedREF=(document.getElementById('plan-refilado')||{value:'20'}).value;

  itens.forEach(function(it,idx){
    if(it.largura<=0||it.altura<=0) return;
    if(document.getElementById('plan-modelo')) document.getElementById('plan-modelo').value=it.modelo||'01';
    if(document.getElementById('plan-folhas')) document.getElementById('plan-folhas').value=it.folhas||'1';
    // Setar cava/friso do item para plnPecas
    var _mpIt=window._mpItens&&window._mpItens[idx]?window._mpItens[idx]:null;
    if(_mpIt){
      if(document.getElementById('plan-disborcava')) document.getElementById('plan-disborcava').value=_mpIt['carac-dist-borda-cava']||'210';
      if(document.getElementById('plan-largcava')) document.getElementById('plan-largcava').value=_mpIt['carac-largura-cava']||'150';
      if(document.getElementById('plan-disbordafriso')) document.getElementById('plan-disbordafriso').value=_mpIt['carac-dist-borda-friso']||'';
      if(document.getElementById('plan-largfriso')) document.getElementById('plan-largfriso').value=_mpIt['carac-largura-friso']||'';
      if(document.getElementById('plan-refilado')) document.getElementById('plan-refilado').value=_mpIt['plan-refilado']||'20';
    }
    try{
      var pieces=plnPecas(it.largura, it.altura, it.folhas||1, it.modelo||'01');
      var _iTag=' [P'+(idx+1)+' '+it.largura+'×'+it.altura+']';
      // Cores do item
      var _corExt=(_mpIt&&(_mpIt['carac-cor-ext']||''))||it.corExt||'';
      var _corInt=(_mpIt&&(_mpIt['carac-cor-int']||''))||it.corInt||'';
      var _sameCor=(!_corInt||_corExt===_corInt);
      // Peças de superfície (frente+costas) vs estrutura (só ext)
      var _surfaceLabels=['TAMPA','CAVA','ACAB LAT','FRISO','RIPAS'];
      function _isSurface(lbl){var u=lbl.toUpperCase();for(var s=0;s<_surfaceLabels.length;s++){if(u.indexOf(_surfaceLabels[s])>=0)return true;}return false;}

      pieces.forEach(function(p){
        var lbl=Array.isArray(p)?p[0]:p.label;
        var w=Array.isArray(p)?p[1]:p.w;
        var h=Array.isArray(p)?p[2]:p.h;
        var q=(Array.isArray(p)?(p[3]||1):(p.qty||1))*it.qtd;
        var clr=Array.isArray(p)?p[4]||'':p.color||'';

        if(_sameCor){
          // Mesma cor ext/int: tudo junto
          var pc={label:lbl+_iTag,w:w,h:h,qty:q,color:clr,_itemIdx:idx,_cor:_corExt};
          allPieces.push(pc);
        } else if(_isSurface(lbl)){
          // Cores diferentes: split frente/costas
          var qExt=Math.ceil(q/2);
          var qInt=Math.floor(q/2);
          if(qExt>0) allPieces.push({label:lbl+' EXT'+_iTag,w:w,h:h,qty:qExt,color:clr,_itemIdx:idx,_cor:_corExt});
          if(qInt>0) allPieces.push({label:lbl+' INT'+_iTag,w:w,h:h,qty:qInt,color:clr,_itemIdx:idx,_cor:_corInt});
        } else {
          // Estrutura: tudo cor externa
          allPieces.push({label:lbl+_iTag,w:w,h:h,qty:q,color:clr,_itemIdx:idx,_cor:_corExt});
        }
      });
    }catch(e){console.warn('MP chapas item '+idx+':',e);}
  });

  // Restaurar
  if(document.getElementById('plan-modelo')) document.getElementById('plan-modelo').value=savedMod;
  if(document.getElementById('plan-folhas')) document.getElementById('plan-folhas').value=savedFol;
  if(document.getElementById('plan-disborcava')) document.getElementById('plan-disborcava').value=savedPDC;
  if(document.getElementById('plan-largcava')) document.getElementById('plan-largcava').value=savedPLC;
  if(document.getElementById('plan-disbordafriso')) document.getElementById('plan-disbordafriso').value=savedPDF;
  if(document.getElementById('plan-largfriso')) document.getElementById('plan-largfriso').value=savedPLF;
  if(document.getElementById('plan-refilado')) document.getElementById('plan-refilado').value=savedREF;
  return allPieces;
}
/* ── Popula tabela de itens na proposta comercial (multi-porta) ── */
function _populatePropostaItens(){
  var tbody=document.getElementById('prop-items-tbody');
  var container=document.getElementById('prop-doors-container');
  if(!tbody) return;
  if(!window._mpItens||window._mpItens.length===0) return;
  var brl2=function(v){return v>0?'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'\u2014';};
  var parseVal=function(el){if(!el)return 0;var t=el.textContent||'';return parseFloat(t.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;};
  // Usar PREÇO TABELA TOTAL (m-tab) — já inclui fabricação + instalação + overhead com markup
  // NÃO somar r-inst separadamente pois m-tab já contém tudo
  var tabTotal=parseVal(document.getElementById('m-tab'))||parseVal(document.getElementById('m-tab-porta'));
  var freteEl=document.getElementById('lr-frete');
  var frete=0;
  if(freteEl){var fv=freteEl.value||'0';frete=parseFloat(fv.replace(/\./g,'').replace(',','.'))||0;}
  // Calcular áreas e proporções
  var items=[];
  var totalArea=0;
  window._mpItens.forEach(function(it,i){
    var L=parseFloat(it._largura||it['largura'])||0;
    var A=parseFloat(it._altura||it['altura'])||0;
    var q=parseInt(it._qtd||it['qtd-portas'])||1;
    var area=L*A/1e6*q;
    var modNum=it._modelo||it['carac-modelo']||'01';
    var modTxt=it._modeloTxt||'';
    if(!modTxt||modTxt==='undefined'){
      var modSel=document.getElementById('carac-modelo');
      if(modSel){for(var mi=0;mi<modSel.options.length;mi++){if(modSel.options[mi].value===modNum){modTxt=modSel.options[mi].text;break;}}}
      if(!modTxt) modTxt='Porta Pivotante';
    }
    var folhas=parseInt(it._folhas||it['folhas-porta'])||1;
    var corExt=it['carac-cor-ext']||'—';
    var corInt=it['carac-cor-int']||corExt;
    var fechMec=it['carac-fech-mec']||'—';
    var fechDig=it['carac-fech-dig']||'NÃO SE APLICA';
    var puxador=it['carac-puxador']||'—';
    var cilindro=it['carac-cilindro']||'—';
    var sistema=A<4000?'PA006 NOVO':'PA007 NOVO';
    var imgSrc=(typeof MODEL_IMGS!=='undefined'&&MODEL_IMGS[modNum])||'';
    if(typeof _modeloImgCache!=='undefined'&&_modeloImgCache[modNum]) imgSrc=_modeloImgCache[modNum];
    var tipo=it._tipo||'porta_pivotante';
    var descProposta=tipo==='fixo'?'Fixo Projetta by Weiku':tipo==='revestimento'?'Revestimento Projetta by Weiku':'Porta Projetta by Weiku';
    items.push({idx:i,L:L,A:A,q:q,area:area,modNum:modNum,modTxt:modTxt,descProposta:descProposta,tipo:tipo,folhas:folhas,corExt:corExt,corInt:corInt,fechMec:fechMec,fechDig:fechDig,puxador:puxador,cilindro:cilindro,sistema:sistema,imgSrc:imgSrc});
    totalArea+=area;
  });
  // Ordenar por área (maior primeiro)
  items.sort(function(a,b){return b.area-a.area;});
  // Esconder bloco single-door
  var singleBlock=document.getElementById('prop-single-door-block');
  if(singleBlock) singleBlock.style.display='none';
  // Gerar blocos por porta
  var doorsHtml='';
  var totalQtd=0,totalValor=0,tableHtml='';
  items.forEach(function(it,sortIdx){
    var prop=totalArea>0?it.area/totalArea:0;
    var valorItem=(tabTotal+frete)*prop;
    totalValor+=valorItem;
    totalQtd+=it.q;
    var valorUn=it.q>0?valorItem/it.q:0;
    var areaUn=it.L*it.A/1e6;
    // Bloco visual da porta
    doorsHtml+='<div style="display:flex;gap:12px;border:1px solid #ccc;border-radius:3px;padding:8px;margin-bottom:6px">';
    doorsHtml+='<div style="flex:0 0 200px;max-height:320px;border:1px solid #ddd;border-radius:3px;display:flex;align-items:center;justify-content:center;background:#f9f9f9;overflow:hidden">';
    if(it.imgSrc) doorsHtml+='<img src="'+it.imgSrc+'" style="max-width:100%;max-height:320px" alt="Modelo">';
    else doorsHtml+='<span style="color:#aaa;font-size:9px;text-align:center">Imagem do<br>modelo</span>';
    doorsHtml+='</div>';
    doorsHtml+='<div style="flex:1">';
    doorsHtml+='<div style="font-size:12px;font-weight:800;color:var(--navy);margin-bottom:4px">'+it.descProposta.toUpperCase()+'</div>';
    doorsHtml+='<div style="display:flex;gap:15px;font-size:10px;margin-bottom:2px"><span><b>Qtd:</b> '+it.q+'</span><span><b>L:</b> '+Math.round(it.L)+'</span><span><b>H:</b> '+Math.round(it.A)+'</span></div>';
    doorsHtml+='<div style="font-size:10px;margin-bottom:4px"><b>Área Porta:</b> '+areaUn.toFixed(2)+'m²</div>';
    doorsHtml+='<div style="font-size:9.5px;color:#444;line-height:1.5">';
    doorsHtml+='<div><b>SISTEMA</b>: '+it.sistema+'</div>';
    doorsHtml+='<div><b>TIPO DE ABERTURA</b>: PIVOTANTE</div>';
    doorsHtml+='<div><b>NUMERO DE FOLHAS</b>: '+it.folhas+' FOLHA'+(it.folhas>1?'S':'')+'</div>';
    doorsHtml+='<div><b>MODELO</b>: '+it.modTxt+'</div>';
    doorsHtml+='<div><b>FECHADURA MECÂNICA</b>: '+it.fechMec+'</div>';
    doorsHtml+='<div><b>FECHADURA DIGITAL</b>: '+it.fechDig+'</div>';
    doorsHtml+='<div><b>PUXADOR</b>: '+it.puxador+'</div>';
    doorsHtml+='<div><b>COR CHAPA EXTERNA</b>: '+it.corExt+'</div>';
    doorsHtml+='<div><b>COR CHAPA INTERNA</b>: '+it.corInt+'</div>';
    doorsHtml+='<div><b>CILINDRO</b>: '+it.cilindro+'</div>';
    doorsHtml+='</div>';
    doorsHtml+='<div style="margin-top:6px;padding:4px 8px;background:#f0ebe0;border-radius:3px;font-size:11px;font-weight:800;color:var(--navy);text-align:right">'+brl2(valorItem)+'</div>';
    doorsHtml+='</div></div>';
    // Linha da tabela de itens
    tableHtml+='<tr>'
      +'<td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-weight:700">'+(sortIdx+1).toString().padStart(2,'0')+'</td>'
      +'<td style="padding:4px 8px;border:1px solid #ccc">'+it.descProposta+'</td>'
      +'<td style="padding:4px 8px;border:1px solid #ccc;text-align:center">'+Math.round(it.L)+' \u00d7 '+Math.round(it.A)+'</td>'
      +'<td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-weight:700">'+it.q+'</td>'
      +'<td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-weight:700">'+brl2(valorUn)+'</td>'
      +'<td style="padding:4px 8px;border:1px solid #ccc;text-align:center;font-weight:700">'+brl2(valorItem)+'</td>'
      +'</tr>';
  });
  // Total row
  tableHtml+='<tr style="background:#f0ebe0;font-weight:800">'
    +'<td colspan="3" style="padding:6px 8px;border:1px solid #ccc;text-align:right">Total \u00c1rea: '+totalArea.toFixed(1)+' m\u00b2</td>'
    +'<td style="padding:6px 8px;border:1px solid #ccc;text-align:center">'+totalQtd+'</td>'
    +'<td style="padding:6px 8px;border:1px solid #ccc"></td>'
    +'<td style="padding:6px 8px;border:1px solid #ccc;text-align:center;font-size:13px">'+brl2(totalValor)+'</td>'
    +'</tr>';
  // Inserir blocos de portas
  if(container) container.innerHTML=doorsHtml;
  tbody.innerHTML=tableHtml;
  // Atualizar totais
  var qtdEl=document.getElementById('prop-qtd');if(qtdEl)qtdEl.textContent=totalQtd;
  var qtdPEl=document.getElementById('prop-qtd-porta');if(qtdPEl)qtdPEl.textContent=totalQtd;
  var propTotalOrcEl=document.getElementById('prop-total-orcamento');
  if(propTotalOrcEl) propTotalOrcEl.textContent=brl2(totalValor);
  var propTotalOrcEl2=document.getElementById('prop-total-orc');
  if(propTotalOrcEl2) propTotalOrcEl2.textContent=brl2(totalValor);
  // Área total
  var areaEl=document.getElementById('prop-area-total');if(areaEl)areaEl.textContent=totalArea.toFixed(1);
}



/* ══ ROMANEIO DE COMPRA — Lista consolidada para pedir material ══ */
function gerarRomaneio(){
  if(!window._lastOSData){alert('Gere a OS primeiro.');return;}
  var d=window._lastOSData;
  var brl=function(v){return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var cliente=(document.getElementById('cliente')||{value:''}).value||'—';
  var agp=(document.getElementById('num-agp')||{value:''}).value||'—';

  // 1. PERFIS — agrupar por código
  var perfis=[];
  d.seenKeys.forEach(function(key){
    var r=d.groupRes[key];if(!r||r.nBars===0)return;
    var perf=null;for(var i=0;i<PERFIS_DB.length;i++){if(PERFIS_DB[i].c===key||PERFIS_DB[i].c===key.replace(/-[678]M$/,'')){perf=PERFIS_DB[i];break;}}
    perfis.push({code:key,desc:perf?perf.d:key,forn:perf?perf.f:'—',nBars:r.nBars,barLen:r.barLenMM/1000,kgBruto:r.kgBruto,pintado:r.pintado,custo:r.custoTotal});
  });

  // 2. CHAPAS — do planificador
  var chapas=[];
  for(var qi=1;qi<=20;qi++){
    var selEl=document.getElementById('acm-sel-'+qi);
    var qtyEl=document.getElementById('acm-qty-'+qi);
    if(!selEl||!qtyEl) break;
    var qty=parseInt(qtyEl.value)||0;if(qty===0)continue;
    var parts=selEl.value.split('|');
    var preco=parseFloat(parts[0])||0;
    var opt=selEl.options[selEl.selectedIndex];
    chapas.push({desc:opt?opt.text:'Chapa ACM',qty:qty,preco:preco,total:preco*qty});
  }

  // 3. ACESSÓRIOS — calcular diretamente
  var acessRows=[];
  var acessTotal=0;
  try{
    var nFolhas=parseInt((document.getElementById('folhas-porta')||{value:1}).value)||1;
    var sis=d.sis||(document.getElementById('prod-sistema')||{value:''}).value||'PA006';
    acessRows=_calcAcessoriosOS(d,nFolhas,sis);
    // Adicionar veda porta se disponível
    if(d.vedaCode&&d.vedaPreco){
      acessRows.push({qty:2*nFolhas,code:d.vedaCode,desc:'Veda Porta Automático '+d.vedaSize+'mm',preco:d.vedaPreco,apl:'FAB',grp:'VEDA',obs:'VEDA PORTA'});
    }
  }catch(e){console.warn('Romaneio: acessórios',e);}

  // Gerar janela
  var w=window.open('','_blank','width=800,height=900');
  w.document.write('<!DOCTYPE html><html><head><title>Romaneio de Compra</title>');
  w.document.write('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Montserrat,Arial,sans-serif;padding:16px;background:#f7f6f3}');
  w.document.write('.pg{max-width:700px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.06);padding:20px}');
  w.document.write('.hdr{background:linear-gradient(135deg,#003144,#00526b);color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:16px}');
  w.document.write('.hdr h1{font-size:16px;font-weight:800}.hdr-sub{font-size:10px;opacity:.7;margin-top:3px}');
  w.document.write('.sec{border:1px solid #ddd;border-radius:6px;margin-bottom:12px;overflow:hidden}');
  w.document.write('.sec-h{background:#f0f4f6;padding:8px 12px;font-size:11px;font-weight:800;color:#c47012;text-transform:uppercase;letter-spacing:.05em}');
  w.document.write('table{width:100%;border-collapse:collapse;font-size:10px}');
  w.document.write('th{background:#eee;padding:4px 8px;border:0.5px solid #ddd;text-align:left;font-size:9px;text-transform:uppercase;color:#666}');
  w.document.write('td{padding:4px 8px;border-bottom:0.5px solid #eee}');
  w.document.write('.tot{background:#003144;color:#fff;font-weight:700;font-size:11px}');
  w.document.write('@media print{body{padding:0;background:#fff}.pg{box-shadow:none;border-radius:0}}');
  w.document.write('</style></head><body><div class="pg">');

  // Header
  w.document.write('<div class="hdr"><h1>📦 ROMANEIO DE COMPRA</h1>');
  w.document.write('<div class="hdr-sub">Cliente: '+cliente+' | AGP: '+agp+' | Data: '+new Date().toLocaleDateString('pt-BR')+'</div></div>');

  // PERFIS
  w.document.write('<div class="sec"><div class="sec-h">🔩 Perfis de Alumínio</div><table>');
  w.document.write('<tr><th>Código</th><th>Descrição</th><th>Fornecedor</th><th style="text-align:center">Barras</th><th style="text-align:center">Barra (m)</th><th style="text-align:right">Kg Bruto</th><th style="text-align:center">Pintura</th><th style="text-align:right">Custo</th></tr>');
  var totKg=0,totCusto=0,totBars=0;
  perfis.forEach(function(p){
    totKg+=p.kgBruto;totCusto+=p.custo;totBars+=p.nBars;
    w.document.write('<tr><td style="font-weight:700;color:#003144;white-space:nowrap">'+p.code+'</td><td>'+p.desc+'</td><td style="font-size:9px;color:#888">'+p.forn+'</td><td style="text-align:center;font-weight:700">'+p.nBars+'</td><td style="text-align:center">'+p.barLen+'m</td><td style="text-align:right">'+p.kgBruto.toFixed(2)+'</td><td style="text-align:center">'+(p.pintado?'🎨 Sim':'—')+'</td><td style="text-align:right;font-weight:700">'+brl(p.custo)+'</td></tr>');
  });
  w.document.write('<tr class="tot"><td colspan="3">TOTAL PERFIS</td><td style="text-align:center">'+totBars+'</td><td></td><td style="text-align:right">'+totKg.toFixed(2)+' kg</td><td></td><td style="text-align:right">'+brl(totCusto)+'</td></tr>');
  w.document.write('</table></div>');

  // CHAPAS
  if(chapas.length>0){
    w.document.write('<div class="sec"><div class="sec-h">🪵 Chapas ACM</div><table>');
    w.document.write('<tr><th>Chapa</th><th style="text-align:center">Quantidade</th><th style="text-align:right">Preço Unit.</th><th style="text-align:right">Total</th></tr>');
    var totChapa=0;
    chapas.forEach(function(c){totChapa+=c.total;
      w.document.write('<tr><td>'+c.desc+'</td><td style="text-align:center;font-weight:700">'+c.qty+'</td><td style="text-align:right">'+brl(c.preco)+'</td><td style="text-align:right;font-weight:700">'+brl(c.total)+'</td></tr>');
    });
    w.document.write('<tr class="tot"><td>TOTAL CHAPAS</td><td></td><td></td><td style="text-align:right">'+brl(totChapa)+'</td></tr>');
    w.document.write('</table></div>');
  }

  // ACESSÓRIOS
  if(acessRows.length>0){
    w.document.write('<div class="sec"><div class="sec-h">🔧 Acessórios e Componentes</div><table>');
    w.document.write('<tr><th style="text-align:center">Qtd</th><th>Código</th><th>Descrição</th><th>Grupo</th><th style="text-align:right">Preço Unit.</th><th style="text-align:right">Total</th></tr>');
    var totAcess=0;
    acessRows.forEach(function(a){
      var t=a.qty*(a.preco||0);totAcess+=t;
      w.document.write('<tr><td style="text-align:center;font-weight:700">'+a.qty+'</td><td style="font-weight:700;color:#003144;white-space:nowrap;font-size:9px">'+a.code+'</td><td style="font-size:9px">'+a.desc+'</td><td style="font-size:9px;color:#888">'+(a.obs||a.grp||'')+'</td><td style="text-align:right">'+brl(a.preco||0)+'</td><td style="text-align:right;font-weight:700">'+brl(t)+'</td></tr>');
    });
    w.document.write('<tr class="tot"><td colspan="5">TOTAL ACESSÓRIOS</td><td style="text-align:right">'+brl(totAcess)+'</td></tr>');
    w.document.write('</table></div>');
  }

  // TOTAL GERAL
  var totChapas=0;chapas.forEach(function(c){totChapas+=c.total;});
  var totAcessGeral=0;acessRows.forEach(function(a){totAcessGeral+=a.qty*(a.preco||0);});
  var totalGeral=totCusto+totChapas+totAcessGeral;
  w.document.write('<div style="background:#003144;color:#fff;border-radius:6px;padding:12px 16px;margin-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:12px">');
  w.document.write('<span style="font-weight:700">TOTAL GERAL DO ROMANEIO</span>');
  w.document.write('<span style="font-size:16px;font-weight:800">'+brl(totalGeral)+'</span>');
  w.document.write('</div>');
  w.document.write('<div style="display:flex;justify-content:space-around;margin-top:6px;font-size:9px;color:#888">');
  w.document.write('<span>Perfis: '+brl(totCusto)+'</span><span>Chapas: '+brl(totChapas)+'</span><span>Acessórios: '+brl(totAcessGeral)+'</span>');
  w.document.write('</div>');

  w.document.write('<div style="text-align:center;font-size:9px;color:#999;margin-top:12px">Gerado em '+new Date().toLocaleString('pt-BR')+' — Projetta v6</div>');
  w.document.write('</div></body></html>');
  w.document.close();
  setTimeout(function(){w.print();},500);
}

/* ══ RELATÓRIO DE PRODUÇÃO — Para chão de fábrica ══ */
function gerarRelatorioProducao(){
  if(!window._lastOSData){alert('Gere a OS primeiro.');return;}
  var d=window._lastOSData;
  var brl=function(v){return 'R$ '+v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});};
  var cliente=(document.getElementById('cliente')||{value:''}).value||'—';
  var agp=(document.getElementById('num-agp')||{value:''}).value||'—';
  var L=(document.getElementById('largura')||{value:0}).value;
  var A=(document.getElementById('altura')||{value:0}).value;
  var modelo=(document.getElementById('carac-modelo')||{}).selectedIndex>=0?(document.getElementById('carac-modelo').options[document.getElementById('carac-modelo').selectedIndex].text||''):'';

  var w=window.open('','_blank','width=800,height=900');
  w.document.write('<!DOCTYPE html><html><head><title>Relatório de Produção</title>');
  w.document.write('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Montserrat,Arial,sans-serif;padding:16px;background:#f7f6f3}');
  w.document.write('.pg{max-width:700px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.06);padding:20px}');
  w.document.write('.hdr{background:linear-gradient(135deg,#8e44ad,#6c3483);color:#fff;padding:14px 18px;border-radius:8px;margin-bottom:16px}');
  w.document.write('.hdr h1{font-size:16px;font-weight:800}.hdr-sub{font-size:10px;opacity:.7;margin-top:3px}');
  w.document.write('.sec{border:1px solid #ddd;border-radius:6px;margin-bottom:12px;overflow:hidden}');
  w.document.write('.sec-h{background:#f0f4f6;padding:8px 12px;font-size:11px;font-weight:800;color:#8e44ad;text-transform:uppercase;letter-spacing:.05em}');
  w.document.write('table{width:100%;border-collapse:collapse;font-size:10px}');
  w.document.write('th{background:#eee;padding:4px 8px;border:0.5px solid #ddd;text-align:left;font-size:9px;text-transform:uppercase;color:#666}');
  w.document.write('td{padding:4px 8px;border-bottom:0.5px solid #eee}');
  w.document.write('.check{width:18px;height:18px;border:2px solid #999;border-radius:3px;display:inline-block}');
  w.document.write('@media print{body{padding:0;background:#fff}.pg{box-shadow:none;border-radius:0}}');
  w.document.write('</style></head><body><div class="pg">');

  // Header
  w.document.write('<div class="hdr"><h1>🏭 RELATÓRIO DE PRODUÇÃO</h1>');
  w.document.write('<div class="hdr-sub">Cliente: '+cliente+' | AGP: '+agp+' | Modelo: '+modelo+' | Vão: '+L+'×'+A+'mm</div>');
  w.document.write('<div class="hdr-sub">Data: '+new Date().toLocaleDateString('pt-BR')+' | OS: '+new Date().getTime()+'</div></div>');

  // ETAPAS DE PRODUÇÃO
  var etapas=['CORTE DE PERFIS','USINAGEM','MONTAGEM PORTAL','MONTAGEM QUADRO','COLAGEM DE CHAPAS','CONFERÊNCIA E EMBALAGEM','INSTALAÇÃO'];
  w.document.write('<div class="sec"><div class="sec-h">📋 Checklist de Etapas</div><table>');
  w.document.write('<tr><th style="width:30px">✓</th><th>Etapa</th><th style="width:80px">Horas</th><th style="width:100px">Responsável</th><th style="width:80px">Data</th></tr>');
  var horasMap={'CORTE DE PERFIS':(document.getElementById('h-corte')||{value:0}).value,'MONTAGEM PORTAL':(document.getElementById('h-portal')||{value:0}).value,'MONTAGEM QUADRO':(document.getElementById('h-quadro')||{value:0}).value,'COLAGEM DE CHAPAS':(document.getElementById('h-colagem')||{value:0}).value,'CONFERÊNCIA E EMBALAGEM':(document.getElementById('h-conf')||{value:0}).value};
  etapas.forEach(function(e){
    var h=horasMap[e]||'—';
    w.document.write('<tr><td style="text-align:center"><span class="check"></span></td><td style="font-weight:700">'+e+'</td><td style="text-align:center">'+(h!=='—'?h+'h':'—')+'</td><td></td><td></td></tr>');
  });
  w.document.write('</table></div>');

  // LISTA DE CORTE POR BARRA
  w.document.write('<div class="sec"><div class="sec-h">✂️ Lista de Corte por Barra</div><table>');
  w.document.write('<tr><th>Perfil</th><th style="text-align:center">Barra</th><th style="text-align:center">Barras</th><th>Cortes (mm)</th><th style="text-align:center">Aprov.</th></tr>');
  d.seenKeys.forEach(function(key){
    var r=d.groupRes[key];if(!r||r.nBars===0)return;
    if(r.barsDetail){
      r.barsDetail.forEach(function(bar,bi){
        var items=bar.items.map(function(x){return x+'mm';}).join(' + ');
        var aprov=bar.len>0?((bar.len-bar.sobra)/bar.len*100).toFixed(0):'—';
        w.document.write('<tr><td style="font-weight:700;color:#003144;font-size:9px;white-space:nowrap">'+key+(bi===0?' ('+r.nBars+'x)':'')+'</td><td style="text-align:center;font-size:9px">'+(bar.len/1000)+'m</td><td style="text-align:center;font-weight:700">#'+(bi+1)+'</td><td style="font-size:9px">'+items+'</td><td style="text-align:center;color:'+(parseInt(aprov)>85?'#27ae60':'#e67e22')+'">'+aprov+'%</td></tr>');
      });
    } else {
      w.document.write('<tr><td style="font-weight:700">'+key+'</td><td style="text-align:center">'+(r.barLenMM/1000)+'m</td><td style="text-align:center;font-weight:700">'+r.nBars+'</td><td>—</td><td>'+r.aprov.toFixed(0)+'%</td></tr>');
    }
  });
  w.document.write('</table></div>');

  // MULTI-PORTA info
  if(window._mpItens&&window._mpItens.length>0){
    w.document.write('<div class="sec"><div class="sec-h">🚪 Itens da Proposta</div><table>');
    w.document.write('<tr><th>#</th><th>Modelo</th><th style="text-align:center">Medidas</th><th style="text-align:center">Qtd</th><th style="text-align:center">Fixo</th></tr>');
    window._mpItens.forEach(function(it,i){
      w.document.write('<tr><td style="font-weight:700">'+(i+1)+'</td><td>'+it.modeloTxt+'</td><td style="text-align:center">'+it.largura+'×'+it.altura+'</td><td style="text-align:center;font-weight:700">'+it.qtd+'</td><td style="text-align:center">'+(it.temFixo?'✓':'—')+'</td></tr>');
    });
    w.document.write('</table></div>');
  }

  w.document.write('<div style="text-align:center;font-size:9px;color:#999;margin-top:12px">Gerado em '+new Date().toLocaleString('pt-BR')+' — Projetta v6</div>');
  w.document.write('</div></body></html>');
  w.document.close();
  setTimeout(function(){w.print();},500);
}
/* ══ RESUMO DA OBRA (estilo CEM) ═════════════════════════════════ */
function _updateResumoObra(){
  var panel=document.getElementById('resumo-obra');
  if(!panel) return;
  var brl=function(v){return v?'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2}):'—';};
  // Só mostrar se OS foi gerada
  if(!window._osGeradoUmaVez){panel.style.display='none';return;}
  panel.style.display='';

  // Área
  var W=parseFloat((document.getElementById('largura')||{value:0}).value)||0;
  var H=parseFloat((document.getElementById('altura')||{value:0}).value)||0;
  var m2=(W/1000)*(H/1000);
  var qP=parseInt((document.getElementById('qtd-portas')||{value:1}).value)||1;
  if(window._mpItens&&window._mpItens.length>0){
    qP=window._mpItens.reduce(function(s,it){return s+(parseInt(it._qtd||it['qtd-portas'])||1);},0);
    m2=0;
    window._mpItens.forEach(function(it){
      var l=parseFloat(it._largura||it['largura'])||0;
      var a=parseFloat(it._altura||it['altura'])||0;
      var q=parseInt(it._qtd||it['qtd-portas'])||1;
      m2+=(l/1000)*(a/1000)*q;
    });
  } else { m2=m2*qP; }
  document.getElementById('ro-area').textContent=m2.toFixed(2)+' m²';
  document.getElementById('ro-pecas').textContent=qP+' porta(s)'+(window._mpItens&&window._mpItens.length>1?' · '+window._mpItens.length+' itens':'');

  // Perfis
  var d=window._lastOSData;
  if(d){
    var kgLiq=0,kgBru=0,custoPerfis=0,custoBru=0;
    d.seenKeys.forEach(function(key){
      var r=d.groupRes[key];if(!r)return;
      kgLiq+=r.kgLiq||0;kgBru+=r.kgBruto||0;
      custoPerfis+=r.custoTotal||0;
      custoBru+=r.custoTotalBru||0;
    });
    document.getElementById('ro-perfis-kg').textContent=kgBru.toFixed(1)+' / '+kgLiq.toFixed(1)+' kg';
    document.getElementById('ro-perfis-bruto').textContent='bruto / líquido';
    document.getElementById('ro-perfis-val').textContent=brl(custoPerfis);
  }

  // Chapas — separar ACM e ALU
  var _nACM=window._chapasACM||0;
  var _nALU=window._chapasALU||0;
  if(!_nACM){var qEl=document.getElementById('plan-acm-qty');if(qEl)_nACM=parseInt(qEl.value)||0;}
  var subAcm=parseFloat((document.getElementById('sub-acm')||{textContent:'0'}).textContent.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
  var subAlu=parseFloat((document.getElementById('sub-alu')||{textContent:'0'}).textContent.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
  var pesoChapa=window._planPesoBrutoACM||0;

  // Info ACM
  var _acmCorEl=document.getElementById('plan-acm-cor');
  var _acmCorTxt=(_acmCorEl&&_acmCorEl.selectedIndex>0)?_acmCorEl.options[_acmCorEl.selectedIndex].text.split('·')[0].trim():'';
  var _acmTam='';
  if(window.PLN_SD) _acmTam=(window.PLN_SD.w||1500)+'×'+(window.PLN_SD.h||6000)+'mm';

  // Info ALU
  var _aluCorEl=document.getElementById('plan-alu-cor');
  var _aluCorTxt=(_aluCorEl&&_aluCorEl.selectedIndex>0)?_aluCorEl.options[_aluCorEl.selectedIndex].text.split('·')[0].trim():'';
  var _aluTam='';
  var _aluCSel=document.getElementById('plan-chapa-alu');
  if(_aluCSel&&_aluCSel.value){var _ap=_aluCSel.value.split('|');_aluTam=_ap[0]+'×'+_ap[1]+'mm';}

  if(_nALU>0){
    // Mostrar separado: ACM + ALU
    document.getElementById('ro-chapas-qty').innerHTML=_nACM+' ACM + '+_nALU+' ALU';
    var _infoLines=[];
    if(_acmCorTxt) _infoLines.push(_acmCorTxt+' · '+_acmTam);
    if(_aluCorTxt) _infoLines.push('🔷 '+_aluCorTxt+' · '+_aluTam);
    var _infoEl=document.getElementById('ro-chapas-info');
    if(_infoEl) _infoEl.innerHTML=_infoLines.join('<br>')||'';
    document.getElementById('ro-chapas-peso').textContent=pesoChapa>0?pesoChapa.toFixed(1)+' kg':'';
    document.getElementById('ro-chapas-val').innerHTML='ACM '+brl(subAcm)+'<br>🔷 ALU '+brl(subAlu)+'<br><b>Total '+brl(subAcm+subAlu)+'</b>';
  } else {
    // Só ACM
    document.getElementById('ro-chapas-qty').textContent=_nACM+' chapa(s)';
    var _chapaInfo=[];
    if(_acmCorTxt) _chapaInfo.push(_acmCorTxt);
    if(_acmTam) _chapaInfo.push(_acmTam);
    var _infoEl=document.getElementById('ro-chapas-info');
    if(_infoEl) _infoEl.textContent=_chapaInfo.join(' · ')||'';
    document.getElementById('ro-chapas-peso').textContent=pesoChapa>0?pesoChapa.toFixed(1)+' kg':'';
    document.getElementById('ro-chapas-val').textContent=brl(subAcm);
  }

  // Acessórios
  var fabAcess=parseFloat((document.getElementById('fab-custo-acess')||{value:'0'}).value.replace(/\./g,'').replace(',','.'))||0;
  document.getElementById('ro-acess-val').textContent=brl(fabAcess);

  // MO
  var totalH=parseFloat((document.getElementById('sub-h')||{textContent:'0'}).textContent)||0;
  var subMO=parseFloat((document.getElementById('sub-mo')||{textContent:'0'}).textContent.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
  document.getElementById('ro-horas').textContent=totalH+'h (×2 op.)';
  document.getElementById('ro-mo-val').textContent=brl(subMO);

  // Instalação
  var subInst=parseFloat((document.getElementById('r-inst')||{textContent:'0'}).textContent.replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
  document.getElementById('ro-inst-val').textContent=brl(subInst);

  // Custo Total + Preços
  var custoEl=document.getElementById('m-custo');
  var tabEl=document.getElementById('m-tab');
  var fatEl=document.getElementById('m-fat');
  document.getElementById('ro-custo-total').textContent=custoEl?custoEl.textContent:'—';
  document.getElementById('ro-tab').textContent=tabEl?tabEl.textContent:'—';
  document.getElementById('ro-fat').textContent=fatEl?fatEl.textContent:'—';

  document.getElementById('resumo-obra-status').textContent='Calculada ✓';
}
/* ══ END RESUMO DA OBRA ══ */

/* ══ IA LEVANTAMENTO AUTOMÁTICO ═══════════════════════════════════ */
window._iaImageB64=null;
window._iaItens=[];

function _iaFileSelected(input){
  if(!input.files||!input.files[0])return;
  var file=input.files[0];
  var reader=new FileReader();
  reader.onload=function(e){
    window._iaImageB64=e.target.result;
    var thumb=document.getElementById('ia-img-thumb');
    var prev=document.getElementById('ia-img-preview');
    if(thumb&&prev){thumb.src=e.target.result;prev.style.display='';}
  };
  reader.readAsDataURL(file);
}

async function _iaAnalisar(){
  var texto=(document.getElementById('ia-texto')||{value:''}).value.trim();
  var contexto=(document.getElementById('ia-contexto')||{value:''}).value.trim();
  var imgB64=window._iaImageB64;

  if(!texto&&!imgB64){alert('Envie uma imagem ou cole um texto para a IA analisar.');return;}

  var btn=document.getElementById('ia-btn-analisar');
  var loading=document.getElementById('ia-loading');
  var resultado=document.getElementById('ia-resultado');
  btn.disabled=true;btn.textContent='⏳ Analisando...';
  loading.style.display='';resultado.style.display='none';

  var sysPrompt='Você é um especialista em levantamento de medidas para fábricas de portas e esquadrias. '
    +'Analise a imagem ou texto fornecido e extraia TODOS os itens de portas/esquadrias. '
    +'Para cada item extraia: modelo (cava, lisa, ripado, etc.), largura (mm), altura (mm), quantidade, '
    +'se tem fixo (esquerdo/direito/ambos), largura do fixo, abertura (esquerda/direita), '
    +'cor externa, cor interna, observações. '
    +'Se não conseguir determinar algum campo, use "—" como valor. '
    +'RESPONDA APENAS em JSON, sem markdown, sem explicação, formato: '
    +'[{"modelo":"01","modeloTxt":"Cava","largura":1200,"altura":2400,"qtd":2,"folhas":1,'
    +'"abertura":"direita","temFixo":true,"fixoLado":"esquerdo","fixoLarg":400,'
    +'"corExt":"BONE WHITE","corInt":"BONE WHITE","obs":""}] '
    +'Modelos disponíveis: 01=Cava, 02=Cava+1FrisoVert, 03=Cava+2FrisoHoriz, 08=Cava+Ripado, '
    +'10=PuxadorExterno Lisa, 15=PuxadorExterno+Ripado, 22=CavaPremium, 24=CavaHorizontal. '
    +'Se o texto mencionar "cava" use modelo 01, "ripado" use 08, "lisa" use 10. '
    +(contexto?'Contexto adicional do usuário: '+contexto:'');

  var userContent=[];
  if(imgB64){
    var mtype=imgB64.indexOf('data:image/png')===0?'image/png':'image/jpeg';
    var b64data=imgB64.split(',')[1];
    userContent.push({type:'image',source:{type:'base64',media_type:mtype,data:b64data}});
  }
  var textMsg='Analise e extraia os itens de portas/esquadrias.';
  if(texto) textMsg+='\n\nTexto do levantamento:\n'+texto;
  if(contexto) textMsg+='\n\nContexto: '+contexto;
  userContent.push({type:'text',text:textMsg});

  try{
    var resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:2000,
        system:sysPrompt,
        messages:[{role:'user',content:userContent}]
      })
    });
    var data=await resp.json();
    var rawText=data.content?data.content.map(function(c){return c.text||'';}).join(''):'';
    document.getElementById('ia-raw').textContent=rawText;

    // Parse JSON
    var clean=rawText.replace(/```json|```/g,'').trim();
    var itens=JSON.parse(clean);
    window._iaItens=itens;
    _iaRenderResultado(itens);
  }catch(e){
    console.error('IA error:',e);
    alert('Erro na análise: '+e.message+'\nVerifique o console para detalhes.');
  }finally{
    btn.disabled=false;btn.textContent='🤖 Analisar com IA';
    loading.style.display='none';
  }
}

function _iaRenderResultado(itens){
  var body=document.getElementById('ia-resultado-body');
  var res=document.getElementById('ia-resultado');
  if(!itens||!itens.length){
    body.innerHTML='<div style="padding:16px;text-align:center;color:#888">Nenhum item identificado. Tente uma imagem mais clara ou adicione texto.</div>';
    res.style.display='';return;
  }
  var html='<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html+='<thead><tr style="background:#f0f4f6">';
  html+='<th style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;width:30px">#</th>';
  html+='<th style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:left">Modelo</th>';
  html+='<th style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">L×A (mm)</th>';
  html+='<th style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">Qtd</th>';
  html+='<th style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">Fixo</th>';
  html+='<th style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center">Abertura</th>';
  html+='<th style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:left">Obs</th>';
  html+='</tr></thead><tbody>';
  itens.forEach(function(it,i){
    var bg=i%2===0?'#fff':'#f9f8f5';
    var fixoTxt=it.temFixo?(it.fixoLado||'sim')+(it.fixoLarg?' '+it.fixoLarg+'mm':''):'—';
    html+='<tr style="background:'+bg+'">';
    html+='<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:center;font-weight:700;color:#8e44ad">'+(i+1)+'</td>';
    html+='<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-weight:600">'+(it.modeloTxt||it.modelo||'—')+'</td>';
    html+='<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:center;font-weight:700">'+(it.largura||'—')+' × '+(it.altura||'—')+'</td>';
    html+='<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:center;font-weight:800;color:#e67e22;font-size:13px">'+(it.qtd||1)+'</td>';
    html+='<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:center;font-size:10px">'+fixoTxt+'</td>';
    html+='<td style="padding:5px 8px;border-bottom:0.5px solid #eee;text-align:center;font-size:10px">'+(it.abertura||'—')+'</td>';
    html+='<td style="padding:5px 8px;border-bottom:0.5px solid #eee;font-size:10px;color:#888">'+(it.obs||'—')+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table>';
  body.innerHTML=html;
  res.style.display='';
}

function _iaAdicionarTodos(){
  if(!window._iaItens||!window._iaItens.length){alert('Nenhum item para adicionar.');return;}
  var nomes=_getModelosNomes();
  window._iaItens.forEach(function(it){
    var code=it.modelo||'01';
    var nome=nomes[code]||it.modeloTxt||'Modelo '+code;
    window._mpItens.push({
      id:'mp_'+Date.now()+'_'+Math.random().toString(36).substr(2,4),
      modelo:code, modeloTxt:code+' - '+nome,
      largura:parseInt(it.largura)||1200,
      altura:parseInt(it.altura)||2400,
      folhas:parseInt(it.folhas)||1,
      qtd:parseInt(it.qtd)||1,
      abertura:it.abertura||'direita',
      temFixo:!!it.temFixo,
      fixos:it.temFixo?[{lado:it.fixoLado||'esquerdo',largura:parseInt(it.fixoLarg)||400,altura:parseInt(it.altura)||2400}]:null,
      corExt:it.corExt||'',corInt:it.corInt||''
    });
  });
  _mpRender();
  // Preencher primeiro item no formulário
  if(window._mpItens.length>0){
    var first=window._mpItens[0];
    document.getElementById('largura').value=first.largura;
    document.getElementById('altura').value=first.altura;
    document.getElementById('qtd-portas').value='1';
    var modEl=document.getElementById('carac-modelo');
    if(modEl){for(var i=0;i<modEl.options.length;i++){if(modEl.options[i].value===first.modelo){modEl.selectedIndex=i;break;}}}
    ['largura','altura'].forEach(function(id){var el=document.getElementById(id);if(el)el.dispatchEvent(new Event('input',{bubbles:true}));});
    if(modEl) modEl.dispatchEvent(new Event('change',{bubbles:true}));
  }
  switchTab('orcamento');
  var t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#27ae60;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';
  t.textContent='✅ '+window._iaItens.length+' itens adicionados à proposta pela IA!';
  document.body.appendChild(t);setTimeout(function(){t.remove();},4000);
}

function _iaLimpar(){
  window._iaItens=[];
  window._iaImageB64=null;
  document.getElementById('ia-texto').value='';
  document.getElementById('ia-contexto').value='';
  document.getElementById('ia-resultado').style.display='none';
  document.getElementById('ia-img-preview').style.display='none';
  document.getElementById('ia-file-input').value='';
}

// Drag & Drop
document.addEventListener('DOMContentLoaded',function(){
  var dz=document.getElementById('ia-drop-zone');
  if(!dz)return;
  dz.addEventListener('dragover',function(e){e.preventDefault();dz.style.borderColor='#27ae60';dz.style.background='#f0fff5';});
  dz.addEventListener('dragleave',function(){dz.style.borderColor='#8e44ad';dz.style.background='#faf5ff';});
  dz.addEventListener('drop',function(e){
    e.preventDefault();dz.style.borderColor='#8e44ad';dz.style.background='#faf5ff';
    if(e.dataTransfer.files&&e.dataTransfer.files[0]){
      var input=document.getElementById('ia-file-input');
      input.files=e.dataTransfer.files;
      _iaFileSelected(input);
    }
  });
});
/* ══ END IA LEVANTAMENTO ══ */

/* ══ PAINEL DE CONFIGURAÇÃO DE PARÂMETROS POR MODELO ══ */
function _abrirParamsModelo(code, nome){
  var params=_getModeloParams(code);
  var tipo=_TIPO_MODELO[code]||'cava';
  var ov=document.createElement('div');
  ov.id='modal-params-modelo';
  ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.onclick=function(e){if(e.target===ov)ov.remove();};
  var grps={};
  _MODELOS_PARAMS_FIELDS.forEach(function(f){
    if(!grps[f.grp]) grps[f.grp]=[];
    grps[f.grp].push(f);
  });
  var html='<div style="background:#fff;border-radius:12px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif">';
  html+='<div style="background:linear-gradient(135deg,#8e44ad,#6c3483);color:#fff;padding:14px 18px;border-radius:12px 12px 0 0">';
  html+='<div style="font-size:14px;font-weight:800">⚙ Parâmetros do Modelo '+code+'</div>';
  html+='<div style="font-size:11px;opacity:.7">'+nome+' — tipo: '+tipo+'</div></div>';
  html+='<div style="padding:16px">';
  var groups=Object.keys(grps);
  groups.forEach(function(g){
    html+='<div style="font-size:10px;font-weight:800;color:#8e44ad;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px">'+g+'</div>';
    grps[g].forEach(function(f){
      var val=params[f.key]!==undefined?params[f.key]:f.def;
      html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;gap:8px">';
      html+='<label style="font-size:11px;color:#444;flex:1">'+f.label+'</label>';
      html+='<input type="number" id="mp-'+code+'-'+f.key+'" value="'+val+'" min="'+f.min+'" max="'+f.max+'" step="'+f.step+'" ';
      html+='style="width:80px;padding:5px 8px;border:1px solid #ccc;border-radius:6px;font-size:12px;font-weight:700;text-align:right;font-family:inherit">';
      html+='<span style="font-size:9px;color:#aaa;width:40px;text-align:center">('+f.def+')</span>';
      html+='</div>';
    });
  });
  html+='<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">';
  html+='<button onclick="_resetParamsModelo(\''+code+'\')" style="padding:8px 16px;border-radius:6px;border:1px solid #e74c3c;color:#e74c3c;font-size:12px;font-weight:700;cursor:pointer;background:#fff;font-family:inherit">🔄 Restaurar Padrão</button>';
  html+='<button onclick="_salvarParamsModelo(\''+code+'\')" style="padding:8px 20px;border-radius:6px;border:none;background:#8e44ad;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">💾 Salvar</button>';
  html+='</div></div></div>';
  ov.innerHTML=html;
  document.body.appendChild(ov);
}

function _salvarParamsModelo(code){
  var params={};
  _MODELOS_PARAMS_FIELDS.forEach(function(f){
    var el=document.getElementById('mp-'+code+'-'+f.key);
    if(el) params[f.key]=parseFloat(el.value)||f.def;
  });
  _saveModeloParams(code, params);
  var modal=document.getElementById('modal-params-modelo');
  if(modal) modal.remove();
  var t=document.createElement('div');t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#8e44ad;color:#fff;padding:10px 20px;border-radius:20px;font-size:12px;font-weight:700;z-index:99999;box-shadow:0 3px 12px rgba(0,0,0,.2)';
  t.textContent='✅ Parâmetros do modelo '+code+' salvos!';
  document.body.appendChild(t);setTimeout(function(){t.remove();},3000);
}

function _resetParamsModelo(code){
  if(!confirm('Restaurar parâmetros padrão para modelo '+code+'?'))return;
  try{
    var saved=localStorage.getItem('projetta_modelo_params');
    var all=saved?JSON.parse(saved):{};
    delete all[code];
    localStorage.setItem('projetta_modelo_params',JSON.stringify(all));
  }catch(e){}
  var modal=document.getElementById('modal-params-modelo');
  if(modal) modal.remove();
  _abrirParamsModelo(code, _getModelosNomes()[code]||'');
}
/* ══ END MODULE: MULTI-PORTA ══ */
