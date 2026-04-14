/**
 * 19-block-19.js
 * Module: BLOCK-19
 * Extraído automaticamente de index.html
 * NÃO EDITE index.html — edite este arquivo.
 */
(function () {
  'use strict';

  var ORIGIN = '*'; // tightened at runtime via PROJETTA_INIT
  var _bridgeReady = false;
  var _pendingQueue = []; // saves queued before parent ack

  /* ── helpers ─────────────────────────────────────────────────────── */
  function toParent(msg) {
    if (window.parent !== window) window.parent.postMessage(msg, ORIGIN);
  }

  /* ── override saveDB ─────────────────────────────────────────────── */
  var _nativeSaveDB = window.saveDB;
  window.saveDB = function (db) {
    // Keep localStorage as fallback / immediate read
    try { localStorage.setItem('projetta_v3', JSON.stringify(db)); } catch (e) {}
    // Push to parent → Supabase
    toParent({ type: 'PROJETTA_SAVE', db: db });
  };

  /* ☁ ORÇAMENTO SYNC */
  (function(){
    var SB='https://plmliavuwlgpwaizfeds.supabase.co',SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
    var ROW='engine_shared_db',_w=false,_lt=null;
    function h(){return{'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json','Prefer':'return=representation'};}
    function save(db){fetch(SB+'/rest/v1/configuracoes',{method:'POST',headers:Object.assign(h(),{'Prefer':'resolution=merge-duplicates'}),body:JSON.stringify({chave:ROW,valor:{db:db,ts:new Date().toISOString()}})}).catch(function(){});}
    function load(cb){fetch(SB+'/rest/v1/configuracoes?chave=eq.'+ROW+'&select=valor&limit=1',{headers:h()}).then(function(r){return r.json();}).then(function(rows){cb(rows&&rows.length>0?rows[0].valor:null);}).catch(function(){cb(null);});}
    var _p=window.saveDB;
    window.saveDB=function(db){_p(db);_w=true;save(db);setTimeout(function(){_w=false;},3000);};
    window.addEventListener('DOMContentLoaded',function(){
      load(function(val){if(!val){var l=JSON.parse(localStorage.getItem('projetta_v3')||'[]');if(l.length>0)save(l);}
        else{var c=val.db||[],l=JSON.parse(localStorage.getItem('projetta_v3')||'[]');if(c.length>=l.length){localStorage.setItem('projetta_v3',JSON.stringify(c));try{renderHistory();}catch(e){}}else save(l);_lt=val.ts;}});
      setInterval(function(){if(_w)return;load(function(val){if(!val||val.ts===_lt){if(!_lt&&val)_lt=val.ts;return;}_lt=val.ts;var c=val.db||[];localStorage.setItem('projetta_v3',JSON.stringify(c));try{renderHistory();}catch(e){}try{refreshHistCount();}catch(e){};});},4000);
    });
    window.addEventListener('load',function(){});
  })();

  /* ── override _persistSession ────────────────────────────────────── */
  var _nativePersist = window._persistSession;
  window._persistSession = function () {
    if (typeof _nativePersist === 'function') _nativePersist();
    toParent({
      type: 'PROJETTA_SESSION',
      id: window.currentId || null,
      rev: window.currentRev || 0
    });
  };

  /* ── listen for messages from Next.js parent ─────────────────────── */
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.type) return;

    // Parent confirms which origin to use
    if (d.type === 'PROJETTA_ORIGIN') {
      ORIGIN = e.origin;
    }

    // Parent sends initial DB + optional active session
    if (d.type === 'PROJETTA_INIT') {
      if (d.db && Array.isArray(d.db)) {
        try { localStorage.setItem('projetta_v3', JSON.stringify(d.db)); } catch (e2) {}
      }
      if (d.sessionId) {
        try {
          localStorage.setItem('projetta_session', JSON.stringify({
            id: d.sessionId,
            rev: typeof d.sessionRev === 'number' ? d.sessionRev : 0
          }));
        } catch (e3) {}
        // Trigger restore after small delay (DOM may still be settling)
        setTimeout(function () {
          if (typeof _autoRestoreSession === 'function') {
            try { _autoRestoreSession(); } catch (ex) {}
          }
          if (typeof renderHistory === 'function') {
            try { renderHistory(); } catch (ex) {}
          }
        }, 120);
      } else {
        // Just refresh history list
        setTimeout(function () {
          if (typeof renderHistory === 'function') try { renderHistory(); } catch (ex) {}
        }, 80);
      }
      _bridgeReady = true;
    }

    // Parent requests current form snapshot (for forced save)
    if (d.type === 'PROJETTA_REQUEST_SNAPSHOT') {
      var snap = null;
      try {
        snap = typeof captureFormData === 'function' ? captureFormData() : null;
      } catch (ex) {}
      toParent({ type: 'PROJETTA_SNAPSHOT', snapshot: snap, requestId: d.requestId });
    }

    // Parent requests switching to a specific orçamento
    if (d.type === 'PROJETTA_OPEN') {
      if (d.id) {
        try {
          localStorage.setItem('projetta_session', JSON.stringify({ id: d.id, rev: d.rev || 0 }));
          if (typeof _autoRestoreSession === 'function') _autoRestoreSession();
        } catch (ex) {}
      }
    }
  });

  /* ── signal ready ────────────────────────────────────────────────── */
  // Small delay to ensure all inline scripts have run
  setTimeout(function () {
    toParent({ type: 'PROJETTA_READY' });
  }, 200);

})();

// ── PERFIS DO QUADRO FIXO — renderização separada ────────────────────────────
function _renderFixosPerfis(){
  var perfisRows = window._lastFixosPerfisRows || [];
  var container  = document.getElementById('fixo-perfis-card');
  if(!container) return;
  if(perfisRows.length === 0){ container.style.display='none'; return; }

  var map = {};
  perfisRows.forEach(function(r){
    var key = r.code+'|'+r.mm;
    if(!map[key]) map[key]={mm:r.mm, qty:0, code:r.code, desc:r.desc};
    map[key].qty += r.qty;
  });

  var tbHtml=''; var totalBarras=0;
  Object.keys(map).sort(function(a,b){ return map[b].mm - map[a].mm; }).forEach(function(key){
    var row=map[key];
    var barras=Math.ceil(row.mm*row.qty/6000);
    totalBarras+=barras;
    tbHtml+='<tr style="background:#faf7fc"><td style="padding:5px 8px;border:0.5px solid #eee;text-align:center;font-weight:700;color:#6c3483">'+row.qty+'×</td><td style="padding:5px 8px;border:0.5px solid #eee;font-size:9px;color:#6c3483;font-weight:600">'+row.code+'</td><td style="padding:5px 8px;border:0.5px solid #eee">'+row.desc+'</td><td style="padding:5px 8px;border:0.5px solid #eee;text-align:right;font-weight:700">'+row.mm+' mm</td><td style="padding:5px 8px;border:0.5px solid #eee;text-align:center">'+barras+' barra(s)</td></tr>';
  });

  container.innerHTML=
    '<div style="background:#6c3483;color:#fff;border-radius:8px 8px 0 0;padding:10px 14px;font-size:12px;font-weight:700;letter-spacing:.05em">🔲 PERFIS DO QUADRO FIXO</div>'+
    '<div style="background:#fff;border:2px solid #6c3483;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">'+
    '<table style="width:100%;border-collapse:collapse;font-size:11px">'+
    '<thead><tr style="background:#f3ecfa">'+
    '<th style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:center;width:44px">Qtd</th>'+
    '<th style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:left;width:140px">Código</th>'+
    '<th style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:left">Descrição</th>'+
    '<th style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:right;width:80px">Corte (mm)</th>'+
    '<th style="padding:5px 8px;border-bottom:1px solid #ddd;text-align:center;width:90px">Barras</th>'+
    '</tr></thead><tbody>'+tbHtml+'</tbody>'+
    '<tfoot><tr style="background:#f3ecfa"><td colspan="4" style="padding:5px 8px;text-align:right;font-weight:700;font-size:11px;color:#6c3483">Total barras necessárias</td>'+
    '<td style="padding:5px 8px;text-align:center;font-weight:700;color:#6c3483">'+totalBarras+' barra(s)</td></tr></tfoot>'+
    '</table></div>';
  container.style.display='block';
  container.style.marginTop='16px';
}


// ── Campos de horas — edição manual vs automático ────────────────────────────
var HORA_STYLE_AUTO   = 'width:100%;padding:5px 8px;border:0.5px solid #c9c6bf;border-radius:6px;font-size:13px;background:#fffef5;color:var(--navy);font-weight:600;outline:none;text-align:right';
var HORA_STYLE_MANUAL = 'width:100%;padding:5px 8px;border:2px solid #e67e22;border-radius:6px;font-size:13px;background:#fff8f0;color:#c0392b;font-weight:700;outline:none;text-align:right';

function _onHoraManual(el, autoLblId){
  el.dataset.manual = '1';
  el.dataset.auto   = '';
  el.style.cssText  = HORA_STYLE_MANUAL;
  var msg = document.getElementById(el.id+'-manual-msg');
  if(msg) msg.style.display = 'block';
  var lbl = document.getElementById(autoLblId);
  if(lbl) lbl.textContent = '';
  calc();
}

function _resetHoraAuto(elId){
  var el = document.getElementById(elId);
  if(!el || el.dataset.manual === '1') return; // não resetar se editado manualmente
  el.style.cssText = HORA_STYLE_AUTO;
  var msg = document.getElementById(elId+'-manual-msg');
  if(msg) msg.style.display = 'none';
}

function _setHoraAuto(elId, value, lbl, lblText){
  var el = document.getElementById(elId);
  if(!el) return;
  if(el.dataset.manual === '1') return; // respeitar edição manual
  el.value = value;
  el.style.cssText = HORA_STYLE_AUTO;
  var msg = document.getElementById(elId+'-manual-msg');
  if(msg) msg.style.display = 'none';
  var lblEl = document.getElementById(lbl);
  if(lblEl) lblEl.textContent = lblText;
}


// ── Filtro de busca nos acessórios manuais ────────────────────────────────────
function _filtrarAcessManual(query){
  var sel = document.getElementById('osa-manual-sel');
  if(!sel) return;
  var q = (query||'').toUpperCase().trim();
  var allOpts = window._osaManualOptsAll;
  if(!allOpts){
    // Guardar todas as opções na primeira vez
    allOpts = Array.from(sel.options).map(function(o){ return {value:o.value, text:o.text}; });
    window._osaManualOptsAll = allOpts;
  }
  var filtered = q ? allOpts.filter(function(o){
    return o.text.toUpperCase().indexOf(q)>=0 || o.value.toUpperCase().indexOf(q)>=0;
  }) : allOpts;
  sel.innerHTML = filtered.map(function(o){
    return '<option value="'+o.value+'">'+o.text+'</option>';
  }).join('');
  // Mostrar contagem
  var inp = document.getElementById('osa-acess-filtro');
  if(inp && q) inp.style.borderColor = filtered.length > 0 ? '#27ae60' : '#e74c3c';
  else if(inp) inp.style.borderColor = '#c9c6bf';
}


// ── Filtro de perfis nas tabelas de lógica ────────────────────────────────────
function _filtrarTabelaLogicas(query, tbodyId){
  var tbody = document.getElementById(tbodyId);
  if(!tbody) return;
  var q = (query||'').toUpperCase().trim();
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function(tr){
    if(!q){ tr.style.display=''; return; }
    var txt = tr.textContent.toUpperCase();
    tr.style.display = txt.indexOf(q)>=0 ? '' : 'none';
  });
}

// ── Filtro no Cadastro de Perfis ──────────────────────────────────────────────
function _filtrarPerfisDB(query){
  var tbody = document.getElementById('pf-db-tbody');
  if(!tbody) return;
  var q = (query||'').toUpperCase().trim();
  var inp = document.getElementById('pf-db-filtro');
  var rows = tbody.querySelectorAll('tr');
  var count = 0;
  rows.forEach(function(tr){
    if(!q){ tr.style.display=''; count++; return; }
    var txt = tr.textContent.toUpperCase();
    var show = txt.indexOf(q)>=0;
    tr.style.display = show ? '' : 'none';
    if(show) count++;
  });
  if(inp) inp.style.borderColor = !q ? '#c9c6bf' : count>0 ? '#27ae60' : '#e74c3c';
}

