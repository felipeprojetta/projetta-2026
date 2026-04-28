/* ============================================================================
 * js/156-fix-drag-stage-persist.js  —  Fix drag não persiste (28-abr-2026)
 *
 * Felipe 28/04: "fazer ormcaneto para para proposta enviado, ele volta
 * para ormcaneot"
 *
 * BUG IDENTIFICADO (race condition):
 *   1) Drag s3→s4: cSave(data) atualiza localStorage com stage=s4
 *   2) crmRender mostra em s4
 *   3) ❌ MAS NUNCA chama PATCH no Supabase com novo stage
 *   4) Banco continua com stage=s3
 *   5) 57-hidratar-local _syncSilencioso (focus/visibilitychange/polling)
 *      chama hidratarCrmLocal({forcar:true})
 *   6) Sobrescreve localStorage com dados do banco (stage=s3)
 *   7) crmRender → card volta pra s3
 *
 * SOLUCAO:
 *   A) Hook cSave: ao salvar localStorage, COMPARA com snapshot anterior
 *      e faz PATCH no banco para cada card que teve stage modificado
 *   B) BLOQUEIA _syncSilencioso por 5s apos cada cSave (da tempo do PATCH)
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta156Applied) return;
  window.__projetta156Applied = true;

  var SB = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
  var CK = 'projetta_crm_v1';

  function toast(html, color, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:10px 16px;border-radius:8px;font-size:12px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:380px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 2500);
  }

  // Snapshot anterior (cards por id → stage)
  var _stageSnapshot = {};

  function _capturarSnapshot(){
    var snap = {};
    try {
      var raw = localStorage.getItem(CK);
      if(!raw) return snap;
      var arr = JSON.parse(raw);
      if(!Array.isArray(arr)) return snap;
      arr.forEach(function(c){
        if(c && c.id) snap[c.id] = c.stage || '';
      });
    } catch(e){}
    return snap;
  }

  // Inicializar snapshot
  setTimeout(function(){ _stageSnapshot = _capturarSnapshot(); }, 1000);

  // Bloqueio temporario de _syncSilencioso após PATCH
  var _bloqSyncAte = 0;
  function bloquearSyncPor(ms){
    _bloqSyncAte = Date.now() + ms;
  }

  // Hook em _syncSilencioso para respeitar bloqueio
  setTimeout(function(){
    var origSync = window._syncSilencioso;
    if(typeof origSync === 'function' && !origSync.__sub156Hooked){
      window._syncSilencioso = function(motivo){
        if(Date.now() < _bloqSyncAte){
          var rem = Math.ceil((_bloqSyncAte - Date.now())/1000);
          console.log('[156] sync ' + motivo + ' BLOQUEADO (drag recente, aguardar ' + rem + 's)');
          return;
        }
        return origSync.apply(this, arguments);
      };
      window._syncSilencioso.__sub156Hooked = true;
      console.log('[156] _syncSilencioso interceptado com bloqueio temporario');
    }
  }, 1500);

  // Patch direto no banco com novos stages
  async function patchStageNoSupabase(cardId, novoStage){
    try {
      var r = await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId), {
        method: 'PATCH',
        headers: Object.assign({}, H, { Prefer: 'return=minimal' }),
        body: JSON.stringify({ stage: novoStage, updated_at: new Date().toISOString() })
      });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return true;
    } catch(e){
      console.error('[156 patch] cardId=' + cardId + ' falhou:', e);
      return false;
    }
  }

  // Hook em cSave: detecta mudancas de stage e faz PATCH
  function hookCSave(){
    var origCSave = window.cSave;
    if(typeof origCSave !== 'function'){ setTimeout(hookCSave, 300); return; }
    if(origCSave.__sub156Hooked) return;

    window.cSave = function(d){
      // Chama original primeiro (salva localStorage)
      var r = origCSave.apply(this, arguments);

      // Comparar stages
      try {
        if(!Array.isArray(d)) return r;
        var mudancas = [];
        d.forEach(function(c){
          if(!c || !c.id) return;
          var stageAnterior = _stageSnapshot[c.id];
          var stageAtual = c.stage || '';
          // Se stage mudou (ou e card novo com stage definido)
          if(stageAnterior !== undefined && stageAnterior !== stageAtual){
            mudancas.push({ id: c.id, de: stageAnterior, para: stageAtual, cliente: c.cliente || '?' });
          }
        });

        // Atualizar snapshot
        _stageSnapshot = _capturarSnapshot();

        if(mudancas.length === 0) return r;

        console.log('[156] detectou ' + mudancas.length + ' mudanca(s) de stage:', mudancas);

        // Bloquear sync por 5 segundos
        bloquearSyncPor(5000);

        // PATCH cada card que teve stage modificado
        mudancas.forEach(function(m){
          patchStageNoSupabase(m.id, m.para).then(function(ok){
            if(ok){
              console.log('[156] ✓ ' + m.cliente + ': ' + m.de + ' → ' + m.para);
              toast('✅ <b>' + m.cliente + '</b><br><span style="font-size:11px;font-weight:400">' + m.de + ' → ' + m.para + ' (banco atualizado)</span>', '#27ae60', 2500);
            } else {
              toast('⚠ Falha ao salvar mudança no banco', '#c0392b', 4000);
            }
          });
        });
      } catch(e){
        console.warn('[156 hook]', e);
      }

      return r;
    };
    window.cSave.__sub156Hooked = true;
    console.log('[156] cSave hooked - PATCH automatico em mudancas de stage');
  }

  function init(){
    hookCSave();
    console.log('[156-fix-drag-stage-persist] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
