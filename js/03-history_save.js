/**
 * 03-history_save.js
 * MODE: KILL-SWITCH MINIMO (Felipe 24/04)
 * Toda logica de salvamento/memorial/freeze/revisoes foi NEUTRALIZADA.
 * _SAVE_MIN.salvarValoresNoCard faz PATCH em crm_oportunidades.valor_tabela/valor_faturamento.
 * Funcoes antigas viram no-op.
 */

window._SAVE_MIN = {
  SUPABASE_URL: 'https://plmliavuwlgpwaizfeds.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858',
  salvarValoresNoCard: function(cardId, valorTabela, valorFaturamento){
    if(!cardId){ console.warn('[SAVE_MIN] cardId vazio'); return Promise.resolve(false); }
    var url = this.SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId);
    var body = {
      valor_tabela: parseFloat(valorTabela) || 0,
      valor_faturamento: parseFloat(valorFaturamento) || 0,
      updated_at: new Date().toISOString(),
      updated_by: (localStorage.getItem('projetta_user_name') || 'anon')
    };
    return fetch(url, {
      method: 'PATCH',
      headers: { 'apikey': this.ANON_KEY, 'Authorization': 'Bearer ' + this.ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body)
    }).then(function(res){
      if(!res.ok){ return res.text().then(function(t){ console.error('[SAVE_MIN] HTTP',res.status,t); return false; }); }
      console.log('[SAVE_MIN] OK card', cardId, 'tab:', body.valor_tabela, 'fat:', body.valor_faturamento);
      return true;
    }).catch(function(e){ console.error('[SAVE_MIN] erro:',e); return false; });
  }
};

// STUBS no-op
var LS_KEY = 'projetta_v3_DISABLED';
var currentId = null, currentRev = null, saveMode = 'new';
function loadDB(){ return []; }
function saveDB(){}
function saveNew(){}
function saveRevision(){}
function captureSnapshot(){ return {}; }
function captureFormData(){ return {}; }
function restoreFormData(){}
function renderHistory(){}
function updateBanner(){}
function _persistSession(){}
function _restoreSession(){ return false; }
function now(){ return new Date().toISOString(); }
function toggleHist(){}
function _isSnapshotValid(){ return false; }
function _hideMemorial(){ var p=document.getElementById('memorial-panel'); if(p) p.style.display='none'; }
function showMemorial(){}
function _restoreSnapshotDisplay(){}
function _openSectionsAndScroll(){}
function _revClearTimers(){}
function _revDelay(fn, ms){ return setTimeout(fn, ms); }
function _setOrcLock(v){ window._orcLocked = !!v; }
function salvarRapido(){}
function novaRevisao(){}

window.loadDB = loadDB; window.saveDB = saveDB;
window.saveNew = saveNew; window.saveRevision = saveRevision;
window.captureSnapshot = captureSnapshot; window.captureFormData = captureFormData;
window.restoreFormData = restoreFormData; window.renderHistory = renderHistory;
window.updateBanner = updateBanner; window.toggleHist = toggleHist;
window.loadRevision = function(){}; window.loadRevisionMemorial = function(){};
window._isSnapshotValid = _isSnapshotValid; window._hideMemorial = _hideMemorial;
window.showMemorial = showMemorial; window._restoreSnapshotDisplay = _restoreSnapshotDisplay;
window._setOrcLock = _setOrcLock; window.salvarRapido = salvarRapido;
window.novaRevisao = novaRevisao;
window._snapshotLock = false; window._orcLocked = false; window._pendingRevision = false;

// Limpar localStorage legado
try {
  localStorage.removeItem('projetta_v3'); localStorage.removeItem('orcamentos');
  Object.keys(localStorage).filter(function(k){ return /^freeze_|^proposta_img_|^projetta_hotpatch/.test(k); })
    .forEach(function(k){ try{localStorage.removeItem(k);}catch(e){} });
} catch(e){}

console.log('[03-history_save] KILL-SWITCH ATIVO: salvamento minimo via _SAVE_MIN');


// ═══════════════════════════════════════════════════════════════════════
// ONE-SHOT RESET V3 NUCLEAR — Felipe 24/04 (banco tambem zerado em extras).
// Apaga localStorage.projetta_crm_v1 INTEIRO. No proximo tick o 23-crm-db
// faz hydrate do Supabase (que ja esta limpo) e o LS fica correto.
// ═══════════════════════════════════════════════════════════════════════
(function(){
  var FLAG = 'projetta_reset_24_04_v3';
  if(localStorage.getItem(FLAG)) return;
  try {
    // Apagar TOTALMENTE o cache do CRM. Hydrate do banco (que esta
    // com extras.opcoes[].revisoes=[] e valores=0) vai repovoar correto.
    localStorage.removeItem('projetta_crm_v1');
    // Limpar qualquer outra coisa relacionada
    ['projetta_v3','orcamentos','projetta_pdf_log',
     'projetta_reset_24_04_v1','projetta_reset_24_04_v2'].forEach(function(k){
      try { localStorage.removeItem(k); } catch(e){}
    });
    Object.keys(localStorage).filter(function(k){
      return /^freeze_|^proposta_img_|^projetta_hotpatch|^projetta_snapshot/.test(k);
    }).forEach(function(k){
      try { localStorage.removeItem(k); } catch(e){}
    });
    localStorage.setItem(FLAG, new Date().toISOString());
    console.log('%c[RESET V3 NUCLEAR 24/04] LS do CRM apagado. Hydrate do Supabase vai repovoar limpo.', 'color:#c0392b;font-weight:bold;background:#fff3cd;padding:4px 8px');
  } catch(e){
    console.error('[RESET V3] erro:', e);
  }
})();
