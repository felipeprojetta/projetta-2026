/**
 * 21-block-21.js
 * Module: BLOCK-21
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
/* ══ CLOUD SYNC: Auto-load on start ══ */
(function(){
  function _syncAllFromCloud(){
    // 1. Orçamentos
    if(typeof _syncOrcFromCloud==='function') _syncOrcFromCloud();
    // 2. Usuários
    if(window._cloudPull){
      window._cloudPull("projetta_users_v1",function(data){
        if(!data||!Array.isArray(data)||!data.length)return;
        var local=[];try{local=JSON.parse(localStorage.getItem('projetta_users_v1'))||[];}catch(e){}
        if(!local.length){
          try{localStorage.setItem('projetta_users_v1',JSON.stringify(data));}catch(e){}
          if(typeof _renderAdminUsers==='function')try{_renderAdminUsers();}catch(e){}
          console.log('☁️ Usuários restaurados da nuvem');
        }
      });
      // 3. Permissões
      window._cloudPull("projetta_perms_v1",function(data){
        if(!data||typeof data!=='object'||!Object.keys(data).length)return;
        var local={};try{local=JSON.parse(localStorage.getItem('projetta_perms_v1'))||{};}catch(e){}
        if(!Object.keys(local).length){
          try{localStorage.setItem('projetta_perms_v1',JSON.stringify(data));}catch(e){}
          if(typeof _renderAdminPerms==='function')try{_renderAdminPerms();}catch(e){}
          console.log('☁️ Permissões restauradas da nuvem');
        }
      });
    }
  }
  if(document.readyState==='complete'||document.readyState==='interactive'){
    setTimeout(_syncAllFromCloud,800);
  } else {
    document.addEventListener('DOMContentLoaded',function(){setTimeout(_syncAllFromCloud,800);});
  }
  console.log('☁️ Cloud Sync init loaded');
})();
