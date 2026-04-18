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
        var dbKey = 'projetta_v3';
        var crmData = [];
        var orcDb = [];
        try{ crmData = JSON.parse(localStorage.getItem(crmKey)||'[]'); if(!Array.isArray(crmData)) crmData = []; }catch(e){}
        try{
          var raw = JSON.parse(localStorage.getItem(dbKey)||'[]');
          orcDb = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.sessions) ? raw.sessions : []);
        }catch(e){}

        var card = crmData.find(function(o){return o.id===id;});
        var entry = null;
        if(typeof currentId !== 'undefined' && currentId && Array.isArray(orcDb)){
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

        txt += '\n--- LOG DO CLIQUE ---\n';
        var log = window._diagLog || [];
        if(log.length === 0){
          txt += '(nenhum clique no botão verde capturado ainda)\n';
          txt += 'Clique no botão verde COM o hook carregado!\n';
        } else {
          log.forEach(function(e,i){
            txt += '['+i+'] ' + (e.momento||'?') + '\n';
            Object.keys(e).forEach(function(k){
              if(k!=='momento' && k!=='t'){
                txt += '   ' + k + ' = ' + JSON.stringify(e[k]) + '\n';
              }
            });
          });
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

  // ── HOOK: interceptar crmOrcamentoPronto para capturar estado no clique ──
  // 100% READ-ONLY — só copia valores antes/depois, não interfere no fluxo original
  setTimeout(function installHook(){
    if(typeof window.crmOrcamentoPronto !== 'function'){
      // ainda não carregou, tenta de novo
      setTimeout(installHook, 500);
      return;
    }
    if(window._orcamentoProntoOriginal) return; // já hookado
    window._orcamentoProntoOriginal = window.crmOrcamentoPronto;
    window._diagLog = [];

    window.crmOrcamentoPronto = function(){
      var snap = {
        t: new Date().toISOString(),
        momento: 'ANTES do crmOrcamentoPronto',
        crmOrcCardId: window._crmOrcCardId || null,
        currentId: (typeof currentId !== 'undefined') ? currentId : 'undef',
        currentRev: (typeof currentRev !== 'undefined') ? currentRev : 'undef',
        pendingRevision: !!window._pendingRevision,
        snapshotLock: !!window._snapshotLock,
        orcLocked: !!window._orcLocked,
        m_tab: (document.getElementById('m-tab')||{}).textContent || '',
        d_fat: (document.getElementById('d-fat')||{}).textContent || '',
        calc_tab: window._calcResult ? window._calcResult._tabTotal : null,
        calc_fat: window._calcResult ? window._calcResult._fatTotal : null
      };
      window._diagLog.push(snap);

      // Executa original intocado
      var result = window._orcamentoProntoOriginal.apply(this, arguments);

      // Agenda capturas em 300ms, 1s, 3s, 6s para ver quando os valores mudam
      [300, 1000, 3000, 6000].forEach(function(delay){
        setTimeout(function(){
          try{
            var cardNow = null;
            var id = window._crmOrcCardId;
            if(id){
              var cd = JSON.parse(localStorage.getItem('projetta_crm_v1')||'[]');
              cardNow = cd.find(function(o){return o.id===id;});
            }
            window._diagLog.push({
              t: new Date().toISOString(),
              momento: 'DEPOIS +'+delay+'ms',
              card_valor: cardNow ? cardNow.valor : '(sem card)',
              card_valorTabela: cardNow ? cardNow.valorTabela : '(sem card)',
              card_valorFaturamento: cardNow ? cardNow.valorFaturamento : '(sem card)',
              card_nRev: cardNow && cardNow.revisoes ? cardNow.revisoes.length : 0,
              ultimaRev_tab: cardNow && cardNow.revisoes && cardNow.revisoes.length>0 ? cardNow.revisoes[cardNow.revisoes.length-1].valorTabela : null,
              ultimaRev_fat: cardNow && cardNow.revisoes && cardNow.revisoes.length>0 ? cardNow.revisoes[cardNow.revisoes.length-1].valorFaturamento : null,
              _calcResult_tab: window._calcResult ? window._calcResult._tabTotal : null,
              _calcResult_fat: window._calcResult ? window._calcResult._fatTotal : null,
              m_tab: (document.getElementById('m-tab')||{}).textContent || '',
              d_fat: (document.getElementById('d-fat')||{}).textContent || ''
            });
          }catch(e){ window._diagLog.push({erro: e.message}); }
        }, delay);
      });

      return result;
    };
    console.log('[DIAG] hook crmOrcamentoPronto instalado');
  }, 1500);
})();
