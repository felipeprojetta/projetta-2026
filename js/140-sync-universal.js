/* ============================================================================
 * js/140-sync-universal.js  —  NOVO (28-abr-2026)
 *
 * Felipe 28/04: "TUDO DEVE SER SINCRONIZADO AUTOMATICAMENTE, NADA DEVE FICAR
 *                LOCAL. SISTEMA ONLINE PARA TODOS OS USUARIOS."
 *
 * SISTEMA UNIVERSAL de sincronizacao localStorage <-> Supabase configuracoes
 * com Realtime push para todos os usuarios conectados.
 *
 * COBRE 17 CHAVES COMPARTILHADAS entre toda a equipe Projetta:
 * - Cadastros (precos acessorios, perfis kg, preco kg)
 * - Customizacoes (chapas/perfis/comps custom + deletados)
 * - Modelos (modelos, params, imagens)
 * - Pessoas (users, perms, rep cargos, rep comms)
 * - NF-e (historico)
 * - CRM Settings (stages, origens, products, team, wreps)
 *
 * NAO sincroniza (ficam local mesmo):
 * - projetta_session, projetta_current_user (login local)
 * - projetta_v3 (rascunho de orcamento da sessao atual)
 * - frete_calc_*, __proj117_ids_ocultos (UI temporaria)
 *
 * FLUXO:
 *   1. Boot: download de TODAS as chaves do Supabase para localStorage
 *   2. Hook localStorage.setItem: detecta mudanca em chave monitorada e
 *      faz upload pro Supabase (debounce 600ms)
 *   3. Realtime: ouvir postgres_changes em configuracoes. Quando uma chave
 *      muda em outra maquina, baixa, atualiza localStorage local, faz
 *      re-render automatico e mostra toast.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta140Applied) return;
  window.__projetta140Applied = true;

  // Lista DEFINITIVA de chaves que sincronizam
  var CHAVES_SYNC = [
    // Cadastros
    'projetta_comp_precos',
    'projetta_preco_kg',
    'projetta_perfis_kg',
    // Customizacoes (adicionar/deletar items)
    'projetta_custom_chapas',
    'projetta_custom_comps',
    'projetta_custom_perfis',
    'projetta_deleted_chapas',
    'projetta_deleted_comps',
    'projetta_deleted_perfis',
    // Modelos
    'projetta_modelos',
    'projetta_modelo_params',
    // Equipe
    'projetta_users_v1',
    'projetta_perms_v1',
    'projetta_rep_cargos',
    'projetta_rep_comms',
    // NF-e
    'projetta_nfe_hist',
    // CRM config
    'projetta_crm_settings_v1'
  ];

  // Prefix sync (chaves dinamicas como projetta_modelo_img_XX)
  var PREFIXOS_SYNC = [
    'projetta_modelo_img_'
  ];

  function chaveDeveSincronizar(k){
    if(!k || typeof k !== 'string') return false;
    if(CHAVES_SYNC.indexOf(k) >= 0) return true;
    for(var i=0; i<PREFIXOS_SYNC.length; i++){
      if(k.indexOf(PREFIXOS_SYNC[i]) === 0) return true;
    }
    return false;
  }

  function sb(){ return window.supa || window.supabase || window._supabase || null; }

  // ── HOOK localStorage ─────────────────────────────────────────────────────
  var _origSetItem = localStorage.setItem.bind(localStorage);
  var _origRemoveItem = localStorage.removeItem.bind(localStorage);
  var _pendingUploads = {};
  var _uploadTimer = null;
  // Flag para evitar loop quando aplicar valor vindo de Realtime
  var _aplicandoRealtime = false;

  localStorage.setItem = function(key, value){
    var r = _origSetItem(key, value);
    if(!_aplicandoRealtime && chaveDeveSincronizar(key)){
      _pendingUploads[key] = { tipo: 'set', valor: value };
      agendarUpload();
    }
    return r;
  };

  localStorage.removeItem = function(key){
    var r = _origRemoveItem(key);
    if(!_aplicandoRealtime && chaveDeveSincronizar(key)){
      _pendingUploads[key] = { tipo: 'del' };
      agendarUpload();
    }
    return r;
  };

  function agendarUpload(){
    if(_uploadTimer) clearTimeout(_uploadTimer);
    _uploadTimer = setTimeout(uploadPendentes, 600);
  }

  async function uploadPendentes(){
    var s = sb();
    if(!s){ console.warn('[140] supabase nao disponivel - retry em 1s'); setTimeout(uploadPendentes, 1000); return; }
    var keys = Object.keys(_pendingUploads);
    if(!keys.length) return;
    for(var i=0; i<keys.length; i++){
      var k = keys[i];
      var op = _pendingUploads[k];
      try {
        if(op.tipo === 'del'){
          var resDel = await s.from('configuracoes').delete().eq('chave', k);
          if(resDel.error) console.error('[140] erro delete', k, resDel.error);
          else console.log('[140] delete OK:', k);
        } else {
          var parsed;
          try { parsed = JSON.parse(op.valor); } catch(e){ parsed = op.valor; }
          var resSet = await s.from('configuracoes').upsert({
            chave: k,
            valor: parsed,
            updated_at: new Date().toISOString()
          }, { onConflict: 'chave' });
          if(resSet.error) console.error('[140] erro upload', k, resSet.error);
          else console.log('[140] upload OK:', k);
        }
        delete _pendingUploads[k];
      } catch(e){ console.error('[140] excecao', k, e); }
    }
  }

  // ── DOWNLOAD INICIAL ──────────────────────────────────────────────────────
  async function downloadInicial(){
    var s = sb();
    if(!s){ setTimeout(downloadInicial, 1000); return; }
    try {
      // 1. Chaves fixas
      var resp1 = await s.from('configuracoes')
        .select('chave,valor,updated_at')
        .in('chave', CHAVES_SYNC);
      // 2. Chaves com prefix
      var resp2 = await s.from('configuracoes')
        .select('chave,valor,updated_at')
        .or(PREFIXOS_SYNC.map(function(p){ return 'chave.like.'+p+'%'; }).join(','));

      var todas = (resp1.data||[]).concat(resp2.data||[]);
      if(!todas.length){ console.log('[140] sem dados no supabase ainda'); return; }

      _aplicandoRealtime = true;
      todas.forEach(function(row){
        try {
          var v = (typeof row.valor === 'string') ? row.valor : JSON.stringify(row.valor);
          var localV = localStorage.getItem(row.chave);
          if(localV !== v){
            _origSetItem(row.chave, v);
            console.log('[140] localStorage atualizado:', row.chave);
          }
        } catch(e){ console.warn('[140] erro aplicar', row.chave, e); }
      });
      _aplicandoRealtime = false;

      // Re-renderizar UIs que dependem dessas chaves
      reRenderTudo();
      console.log('[140] download inicial completo:', todas.length, 'chaves');
    } catch(e){ _aplicandoRealtime = false; console.error('[140] excecao download', e); }
  }

  function reRenderTudo(){
    var fns = [
      'loadAllPrecos','carregarPrecosFech','loadModelos','loadPrecoKg',
      '_renderAdminUsers','_renderAdminPerms','populateReps',
      '_populateCorSelects','_populateManualAcessSelect','_populateManualPerfilSelect',
      'crmRender','renderClientesTab','calc'
    ];
    fns.forEach(function(fn){
      if(typeof window[fn] === 'function'){
        try{ window[fn](); }catch(e){}
      }
    });
  }

  // ── REALTIME ──────────────────────────────────────────────────────────────
  function instalarRealtime(){
    var s = sb();
    if(!s){ setTimeout(instalarRealtime, 1500); return; }
    var canal = s.channel('projetta-sync-universal')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'configuracoes' },
          function(payload){
            try {
              var row = payload.new || payload.old || payload.record;
              if(!row || !row.chave) return;
              if(!chaveDeveSincronizar(row.chave)) return;

              if(payload.eventType === 'DELETE'){
                _aplicandoRealtime = true;
                _origRemoveItem(row.chave);
                _aplicandoRealtime = false;
                console.log('[140 realtime] ' + row.chave + ' removido em outra maquina');
              } else {
                var v = (typeof row.valor === 'string') ? row.valor : JSON.stringify(row.valor);
                var localV = localStorage.getItem(row.chave);
                if(localV === v) return; // ja sincronizado
                _aplicandoRealtime = true;
                _origSetItem(row.chave, v);
                _aplicandoRealtime = false;
                console.log('[140 realtime] ' + row.chave + ' atualizado de outra maquina');
              }

              // Toast (debounce - so um toast por rajada)
              showSyncToast();
              // Re-render
              setTimeout(reRenderTudo, 100);
            } catch(e){ _aplicandoRealtime = false; console.error('[140 realtime] erro', e); }
          })
      .subscribe(function(status){
        console.log('[140 realtime] status:', status);
      });
    window._140Canal = canal;
  }

  // Toast
  var _toastTimer = null;
  function showSyncToast(){
    if(_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function(){
      var existing = document.getElementById('proj140-toast');
      if(existing) existing.remove();
      var t = document.createElement('div');
      t.id = 'proj140-toast';
      t.textContent = '☁️ Dados sincronizados de outra máquina';
      t.style.cssText = 'position:fixed;top:20px;right:20px;background:#1a3a4a;color:#fff;padding:10px 18px;border-radius:8px;font-size:12px;font-weight:700;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;animation:proj140fade .4s';
      document.body.appendChild(t);
      setTimeout(function(){
        t.style.opacity='0';
        t.style.transition='opacity .4s';
        setTimeout(function(){t.remove();}, 400);
      }, 2200);
    }, 250);
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  function init(){
    setTimeout(downloadInicial, 700);
    setTimeout(instalarRealtime, 1300);
    console.log('[140-sync-universal] iniciado - sincroniza ' + CHAVES_SYNC.length + ' chaves + ' + PREFIXOS_SYNC.length + ' prefixos');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
