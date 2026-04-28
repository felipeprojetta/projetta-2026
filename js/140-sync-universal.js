/* ============================================================================
 * js/140-sync-universal.js  —  v2 (28-abr-2026)
 *
 * SYNC universal localStorage <-> Supabase configuracoes via FETCH DIRETO.
 * v2: NAO depende de window.supabase (que nao existe no Projetta).
 * Usa fetch + REST como o resto do sistema.
 *
 * Realtime: usa supabase-js client SE estiver disponivel (carregado tarde),
 * senao faz polling de 8s pra detectar mudancas.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta140Applied) return;
  window.__projetta140Applied = true;

  var SB_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  var CHAVES_SYNC = [
    'projetta_comp_precos','projetta_preco_kg','projetta_perfis_kg',
    'projetta_custom_chapas','projetta_custom_comps','projetta_custom_perfis',
    'projetta_deleted_chapas','projetta_deleted_comps','projetta_deleted_perfis',
    'projetta_modelos','projetta_modelo_params',
    'projetta_users_v1','projetta_perms_v1','projetta_rep_cargos','projetta_rep_comms',
    'projetta_crm_settings_v1'
  ];
  var PREFIXOS_SYNC = ['projetta_modelo_img_'];

  function chaveDeveSincronizar(k){
    if(!k || typeof k !== 'string') return false;
    if(CHAVES_SYNC.indexOf(k) >= 0) return true;
    for(var i=0; i<PREFIXOS_SYNC.length; i++){
      if(k.indexOf(PREFIXOS_SYNC[i]) === 0) return true;
    }
    return false;
  }

  // Hook localStorage
  var _origSetItem = localStorage.setItem.bind(localStorage);
  var _origRemoveItem = localStorage.removeItem.bind(localStorage);
  var _pendingUploads = {};
  var _uploadTimer = null;
  var _aplicandoRealtime = false;
  var _ultimosHashes = {}; // Para polling detectar mudancas

  localStorage.setItem = function(key, value){
    var r = _origSetItem(key, value);
    if(!_aplicandoRealtime && chaveDeveSincronizar(key)){
      _pendingUploads[key] = { tipo: 'set', valor: value };
      if(_uploadTimer) clearTimeout(_uploadTimer);
      _uploadTimer = setTimeout(uploadPendentes, 600);
    }
    return r;
  };

  localStorage.removeItem = function(key){
    var r = _origRemoveItem(key);
    if(!_aplicandoRealtime && chaveDeveSincronizar(key)){
      _pendingUploads[key] = { tipo: 'del' };
      if(_uploadTimer) clearTimeout(_uploadTimer);
      _uploadTimer = setTimeout(uploadPendentes, 600);
    }
    return r;
  };

  function uploadPendentes(){
    var keys = Object.keys(_pendingUploads);
    if(!keys.length) return;
    keys.forEach(function(k){
      var op = _pendingUploads[k];
      delete _pendingUploads[k];
      if(op.tipo === 'del'){
        fetch(SB_URL + '/rest/v1/configuracoes?chave=eq.' + encodeURIComponent(k), {
          method: 'DELETE',
          headers: H
        }).then(function(r){
          if(r.ok) console.log('[140] delete OK:', k);
          else console.warn('[140] delete falhou:', k, r.status);
        }).catch(function(e){ console.warn('[140] delete erro:', k, e); });
      } else {
        var parsed; try { parsed = JSON.parse(op.valor); } catch(e){ parsed = op.valor; }
        fetch(SB_URL + '/rest/v1/configuracoes', {
          method: 'POST',
          headers: Object.assign({}, H, {
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
          }),
          body: JSON.stringify({
            chave: k,
            valor: parsed,
            updated_at: new Date().toISOString()
          })
        }).then(function(r){
          if(r.ok) console.log('[140] upload OK:', k);
          else console.warn('[140] upload falhou:', k, r.status);
        }).catch(function(e){ console.warn('[140] upload erro:', k, e); });
      }
    });
  }

  // Download inicial
  function downloadInicial(){
    // Chaves fixas
    var inList = '(' + CHAVES_SYNC.map(function(k){ return '"'+k+'"'; }).join(',') + ')';
    Promise.all([
      fetch(SB_URL + '/rest/v1/configuracoes?chave=in.' + encodeURIComponent(inList) + '&select=chave,valor,updated_at',
            { headers: H }).then(function(r){ return r.ok ? r.json() : []; }),
      fetch(SB_URL + '/rest/v1/configuracoes?chave=like.projetta_modelo_img_*&select=chave,valor,updated_at',
            { headers: H }).then(function(r){ return r.ok ? r.json() : []; })
    ]).then(function(results){
      var todas = [].concat(results[0]||[], results[1]||[]);
      if(!todas.length){ console.log('[140] sem dados no supabase'); return; }
      _aplicandoRealtime = true;
      todas.forEach(function(row){
        try {
          var v = (typeof row.valor === 'string') ? row.valor : JSON.stringify(row.valor);
          var localV = localStorage.getItem(row.chave);
          if(localV !== v){
            _origSetItem(row.chave, v);
            _ultimosHashes[row.chave] = simpleHash(v);
            console.log('[140] localStorage atualizado:', row.chave);
          } else {
            _ultimosHashes[row.chave] = simpleHash(v);
          }
        } catch(e){}
      });
      _aplicandoRealtime = false;
      reRenderTudo();
      console.log('[140] download inicial OK:', todas.length, 'chaves');
    }).catch(function(e){ console.error('[140] download erro:', e); });
  }

  function simpleHash(s){
    var h = 0; for(var i=0; i<s.length; i++) h = ((h<<5)-h+s.charCodeAt(i))|0; return h;
  }

  function reRenderTudo(){
    var fns = ['loadAllPrecos','carregarPrecosFech','loadModelos','loadPrecoKg',
               '_renderAdminUsers','_renderAdminPerms','populateReps',
               '_populateCorSelects','_populateManualAcessSelect','_populateManualPerfilSelect',
               'crmRender','renderClientesTab','calc'];
    fns.forEach(function(fn){
      if(typeof window[fn] === 'function'){ try{ window[fn](); }catch(e){} }
    });
  }

  // Polling - detectar mudancas no Supabase a cada 8s
  function poll(){
    var inList = '(' + CHAVES_SYNC.map(function(k){ return '"'+k+'"'; }).join(',') + ')';
    fetch(SB_URL + '/rest/v1/configuracoes?chave=in.' + encodeURIComponent(inList) + '&select=chave,valor',
          { headers: H })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){
        if(!rows || !rows.length) return;
        var mudou = false;
        _aplicandoRealtime = true;
        rows.forEach(function(row){
          var v = (typeof row.valor === 'string') ? row.valor : JSON.stringify(row.valor);
          var h = simpleHash(v);
          if(_ultimosHashes[row.chave] !== h){
            _ultimosHashes[row.chave] = h;
            var localV = localStorage.getItem(row.chave);
            if(localV !== v){
              _origSetItem(row.chave, v);
              mudou = true;
              console.log('[140 poll] ' + row.chave + ' atualizado de outra maquina');
            }
          }
        });
        _aplicandoRealtime = false;
        if(mudou){ showSyncToast(); reRenderTudo(); }
      }).catch(function(){});
  }

  var _toastTimer = null;
  function showSyncToast(){
    if(_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function(){
      var t = document.getElementById('proj140-toast'); if(t) t.remove();
      t = document.createElement('div');
      t.id = 'proj140-toast';
      t.textContent = '☁️ Dados sincronizados de outra máquina';
      t.style.cssText = 'position:fixed;top:20px;right:20px;background:#1a3a4a;color:#fff;padding:10px 18px;border-radius:8px;font-size:12px;font-weight:700;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif';
      document.body.appendChild(t);
      setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){t.remove();},400); }, 2200);
    }, 250);
  }

  function init(){
    setTimeout(downloadInicial, 700);
    setInterval(poll, 8000); // polling a cada 8s
    console.log('[140-sync-universal v2] iniciado - sincroniza ' + CHAVES_SYNC.length + ' chaves + ' + PREFIXOS_SYNC.length + ' prefixos (polling 8s)');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
