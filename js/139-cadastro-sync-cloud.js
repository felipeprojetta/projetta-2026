/* ============================================================================
 * js/139-cadastro-sync-cloud.js  —  NOVO (28-abr-2026)
 *
 * Felipe 28/04: precos de acessorios atualizados em uma maquina nao apareciam
 * em outra. Causa: js/15-cadastro_init.js usava SO localStorage. Sem sync.
 *
 * SOLUCAO: sincronizar 4 chaves entre localStorage e Supabase configuracoes:
 *   - projetta_comp_precos     (precos de acessorios)
 *   - projetta_deleted_comps   (acessorios deletados)
 *   - projetta_deleted_perfis  (perfis deletados)
 *   - projetta_preco_kg        (preco por kg)
 *
 * FLUXO:
 *   1. Ao carregar: baixa do Supabase → localStorage (se Supabase mais novo)
 *   2. Ao salvar: localStorage → Supabase (upsert)
 *   3. Realtime: outras maquinas recebem update e atualizam localStorage
 *      automaticamente, refresh do cadastro se aberto.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta139Applied) return;
  window.__projetta139Applied = true;

  var CHAVES_SYNC = [
    'projetta_comp_precos',
    'projetta_deleted_comps',
    'projetta_deleted_perfis',
    'projetta_preco_kg'
  ];

  // Pegar cliente Supabase global
  function sb(){ return window.supa || window.supabase || window._supabase || null; }

  // Wrap localStorage.setItem para detectar mudancas em chaves monitoradas
  var _origSetItem = localStorage.setItem.bind(localStorage);
  var _pendingUploads = {};
  var _uploadTimer = null;

  localStorage.setItem = function(key, value){
    var r = _origSetItem(key, value);
    if(CHAVES_SYNC.indexOf(key) >= 0){
      _pendingUploads[key] = value;
      if(_uploadTimer) clearTimeout(_uploadTimer);
      _uploadTimer = setTimeout(uploadPendentes, 800); // debounce
    }
    return r;
  };

  // Upload do localStorage para Supabase
  async function uploadPendentes(){
    var s = sb();
    if(!s){ console.warn('[139] supabase nao disponivel'); return; }
    var keys = Object.keys(_pendingUploads);
    if(!keys.length) return;
    for(var i=0; i<keys.length; i++){
      var k = keys[i];
      var v = _pendingUploads[k];
      try {
        var parsed;
        try { parsed = JSON.parse(v); } catch(e){ parsed = v; }
        var { error } = await s.from('configuracoes').upsert({
          chave: k,
          valor: parsed,
          updated_at: new Date().toISOString()
        }, { onConflict: 'chave' });
        if(error) console.error('[139] erro upload', k, error);
        else console.log('[139] upload OK:', k);
        delete _pendingUploads[k];
      } catch(e){
        console.error('[139] excecao upload', k, e);
      }
    }
  }

  // Download Supabase → localStorage (no boot)
  async function downloadInicial(){
    var s = sb();
    if(!s){ setTimeout(downloadInicial, 1000); return; }
    try {
      var { data, error } = await s.from('configuracoes')
        .select('chave,valor,updated_at')
        .in('chave', CHAVES_SYNC);
      if(error){ console.error('[139] erro download', error); return; }
      if(!data || !data.length){ console.log('[139] sem dados no supabase ainda'); return; }
      data.forEach(function(row){
        try {
          var v = (typeof row.valor === 'string') ? row.valor : JSON.stringify(row.valor);
          // Comparar com localStorage local: se diferente, atualizar
          var localV = localStorage.getItem(row.chave);
          if(localV !== v){
            _origSetItem(row.chave, v);
            console.log('[139] localStorage atualizado:', row.chave);
          }
        } catch(e){ console.warn('[139] erro aplicar', row.chave, e); }
      });
      // Ja sincronizou - se cadastro aberto, recarregar
      if(typeof window.loadAllPrecos === 'function'){ try{ window.loadAllPrecos(); }catch(e){} }
      if(typeof window.carregarPrecosFech === 'function'){ try{ window.carregarPrecosFech(); }catch(e){} }
    } catch(e){ console.error('[139] excecao download', e); }
  }

  // Realtime: ouvir mudancas de outras maquinas
  function instalarRealtime(){
    var s = sb();
    if(!s){ setTimeout(instalarRealtime, 1500); return; }
    var canal = s.channel('cadastro-sync')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'configuracoes',
            filter: 'chave=in.(' + CHAVES_SYNC.join(',') + ')' },
          function(payload){
            try {
              var row = payload.new || payload.record;
              if(!row || !row.chave || CHAVES_SYNC.indexOf(row.chave) < 0) return;
              var v = (typeof row.valor === 'string') ? row.valor : JSON.stringify(row.valor);
              var localV = localStorage.getItem(row.chave);
              if(localV === v) return; // ja sincronizado
              _origSetItem(row.chave, v);
              console.log('[139 realtime] ' + row.chave + ' atualizado de outra maquina');
              // Avisar usuario com toast (se a fn existe)
              if(typeof window.showSaveToast === 'function'){
                try{ window.showSaveToast('Precos atualizados de outra maquina'); }catch(e){}
              }
              // Re-render cadastro se aberto
              if(typeof window.loadAllPrecos === 'function'){ try{ window.loadAllPrecos(); }catch(e){} }
              if(typeof window.carregarPrecosFech === 'function'){ try{ window.carregarPrecosFech(); }catch(e){} }
              if(typeof window.calc === 'function'){ try{ window.calc(); }catch(e){} }
            } catch(e){ console.error('[139 realtime] erro', e); }
          })
      .subscribe(function(status){
        console.log('[139 realtime] status:', status);
      });
    window._139Canal = canal;
  }

  function init(){
    setTimeout(downloadInicial, 600);   // baixa do Supabase
    setTimeout(instalarRealtime, 1200); // assinar mudancas
    console.log('[139-cadastro-sync] iniciado - sincroniza ' + CHAVES_SYNC.length + ' chaves');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
