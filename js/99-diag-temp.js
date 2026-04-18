/* ╔═══════════════════════════════════════════════════════════════════╗
   ║  DIAGNÓSTICO TEMPORÁRIO — REMOVER APÓS CORRIGIR BUG              ║
   ║  Botão flutuante que mostra estado do CRM/Revisão em popup       ║
   ║  100% READ-ONLY — não altera nenhum dado                         ║
   ╚═══════════════════════════════════════════════════════════════════╝ */
(function(){
  function makeDiagButton(){
    if(document.getElementById('diag-btn-temp')) return;
    var btn = document.createElement('button');
    btn.id = 'diag-btn-temp';
    btn.textContent = '🔍';
    btn.title = 'Diagnóstico CRM (temporário)';
    btn.style.cssText = 'position:fixed;bottom:80px;right:10px;width:44px;height:44px;border-radius:50%;background:#e74c3c;color:#fff;border:none;font-size:18px;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:pointer;';
    btn.onclick = function(){
      try{
        var id = window._crmOrcCardId || null;
        var crmKey = 'projetta_crm_v1';
        var dbKey = 'projetta_orc_db_v1';
        var crmData = [];
        var orcDb = [];
        try{ crmData = JSON.parse(localStorage.getItem(crmKey)||'[]'); }catch(e){}
        try{ var obj = JSON.parse(localStorage.getItem(dbKey)||'{}'); orcDb = obj.sessions || obj || []; }catch(e){}

        var card = crmData.find(function(o){return o.id===id;});
        var entry = null;
        if(typeof currentId !== 'undefined' && currentId){
          entry = orcDb.find(function(e){return e.id===currentId;});
        }

        var txt = '=== DIAG NOVA REVISÃO ===\n\n';
        txt += 'crmOrcCardId: ' + (id||'NULL') + '\n';
        txt += 'currentId: ' + (typeof currentId!=='undefined'?currentId:'undef') + '\n';
        txt += 'currentRev: ' + (typeof currentRev!=='undefined'?currentRev:'undef') + '\n';
        txt += '_pendingRevision: ' + (window._pendingRevision?'SIM':'não') + '\n';
        txt += '_snapshotLock: ' + (window._snapshotLock?'SIM':'não') + '\n';
        txt += '_orcLocked: ' + (window._orcLocked?'SIM':'não') + '\n\n';

        txt += '--- VALORES TELA ---\n';
        var mTab = document.getElementById('m-tab');
        var dFat = document.getElementById('d-fat');
        var mFat = document.getElementById('m-fat');
        txt += 'm-tab DOM: ' + (mTab?mTab.textContent:'(não existe)') + '\n';
        txt += 'd-fat DOM: ' + (dFat?dFat.textContent:'(não existe)') + '\n';
        txt += 'm-fat DOM: ' + (mFat?mFat.textContent:'(não existe)') + '\n';

        if(window._calcResult){
          txt += '_calcResult tab: ' + (window._calcResult._tabTotal||0) + '\n';
          txt += '_calcResult fat: ' + (window._calcResult._fatTotal||0) + '\n\n';
        } else {
          txt += '_calcResult: NULL\n\n';
        }

        txt += '--- CARD CRM ---\n';
        if(card){
          txt += 'cliente: ' + (card.cliente||'') + '\n';
          txt += 'valor: ' + (card.valor||0) + '\n';
          txt += 'valorTabela: ' + (card.valorTabela||0) + '\n';
          txt += 'valorFaturamento: ' + (card.valorFaturamento||0) + '\n';
          var revs = card.revisoes || [];
          txt += 'qtd revisões: ' + revs.length + '\n';
          revs.forEach(function(r,i){
            txt += '  [' + i + '] ' + (r.label||'') + ' tab=' + (r.valorTabela||0) + ' fat=' + (r.valorFaturamento||0) + '\n';
          });
        } else {
          txt += '(card não encontrado)\n';
        }

        txt += '\n--- ENTRY DB (histórico) ---\n';
        if(entry){
          txt += 'entry.id: ' + entry.id + '\n';
          txt += 'entry.crmCardId: ' + (entry.crmCardId||'NULL') + '\n';
          var revisions = entry.revisions || [];
          txt += 'qtd revisions: ' + revisions.length + '\n';
          revisions.forEach(function(r,i){
            var snapFat = r.snapshot?(r.snapshot.fatTotal||'?'):'(sem snap)';
            txt += '  [' + i + '] ' + (r.label||'') + ' crmPronto=' + (r.crmPronto?'SIM':'não') + ' snap.fat=' + snapFat + '\n';
          });
        } else {
          txt += '(entry não encontrado no DB)\n';
        }

        // Também copia pra clipboard se possível
        try{
          if(navigator.clipboard){
            navigator.clipboard.writeText(txt);
          }
        }catch(e){}

        // Mostra num popup
        var pop = document.createElement('div');
        pop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.8);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:8px;padding:16px;max-width:600px;width:100%;font-family:monospace;font-size:11px;white-space:pre;overflow-wrap:break-word;';
        box.textContent = txt;
        var close = document.createElement('button');
        close.textContent = 'FECHAR';
        close.style.cssText = 'display:block;margin:10px auto 0;padding:10px 20px;background:#333;color:#fff;border:none;border-radius:4px;font-size:14px;font-weight:700;';
        close.onclick = function(){document.body.removeChild(pop);};
        box.appendChild(close);
        pop.appendChild(box);
        pop.onclick = function(e){ if(e.target===pop) document.body.removeChild(pop); };
        document.body.appendChild(pop);
      }catch(err){
        alert('DIAG ERRO: ' + err.message);
      }
    };
    document.body.appendChild(btn);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', makeDiagButton);
  } else {
    setTimeout(makeDiagButton, 500);
  }
})();
