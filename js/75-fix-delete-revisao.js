/**
 * ═══════════════════════════════════════════════════════════════════════
 * 75-fix-delete-revisao.js — Fix: excluir revisão NO BANCO também
 * ─────────────────────────────────────────────────────────────────────
 *
 * PROBLEMA:
 *   crmDeleteRevision original só chama cSave(d) (localStorage).
 *   Não faz PATCH no Supabase. O cloud-sync depois restaura do banco.
 *   Resultado: usuário deleta, vê "salvo", revisão volta.
 *
 * FIX:
 *   Substitui window.crmDeleteRevision por versão que:
 *     1. Lê extras atual do banco (fonte da verdade)
 *     2. Remove a revisão em extras.opcoes[ativa].revisoes
 *     3. Atualiza valor/valor_tabela/valor_faturamento top-level
 *     4. PATCH no banco
 *     5. Atualiza localStorage pra ficar em sync
 *     6. Reabre modal pra re-render
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _hdrs(){
    return {
      apikey:         ANON_KEY,
      Authorization:  'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };
  }

  function _toast(html, cor, ms){
    var t = document.getElementById('projetta-save-toast');
    if(t) t.remove();
    t = document.createElement('div');
    t.id = 'projetta-save-toast';
    t.style.cssText =
      'position:fixed;top:80px;right:20px;background:' + cor + ';color:#fff;' +
      'padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;' +
      'z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);' +
      'max-width:440px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4000);
  }

  window.crmDeleteRevision = async function(cardId, revIndex){
    if(!confirm('Excluir esta revisão?\n\nAção irreversível — a revisão será removida do card e do banco.')) return;

    _toast('⏳ <b>Excluindo revisão...</b>', '#7f8c8d', 2500);

    try {
      // 1) Ler extras atual do banco
      var r1 = await fetch(
        SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras',
        { headers: _hdrs() }
      );
      if(!r1.ok) throw new Error('HTTP ' + r1.status + ' ao ler card');
      var rows = await r1.json();
      if(!rows.length) throw new Error('Card não encontrado no banco');

      var extras = rows[0].extras || {};
      if(!Array.isArray(extras.opcoes) || !extras.opcoes.length){
        throw new Error('Card sem opções/revisões no banco');
      }

      // 2) Achar opção ativa
      var opcaoAtivaId = extras.opcaoAtivaId || extras.opcoes[0].id;
      var opcao = extras.opcoes.find(function(o){ return o.id === opcaoAtivaId; });
      if(!opcao || !Array.isArray(opcao.revisoes)){
        throw new Error('Opção ativa sem revisões');
      }
      if(revIndex < 0 || revIndex >= opcao.revisoes.length){
        throw new Error('Índice de revisão inválido');
      }

      // 3) Remover a revisão
      opcao.revisoes.splice(revIndex, 1);

      // 4) Calcular novos valores top-level (última revisão vira principal)
      var dadosUpdate = {
        extras:     extras,
        updated_at: new Date().toISOString()
      };
      if(opcao.revisoes.length > 0){
        var last = opcao.revisoes[opcao.revisoes.length - 1];
        dadosUpdate.valor             = last.valorFaturamento || last.valorTabela || 0;
        dadosUpdate.valor_tabela      = last.valorTabela      || 0;
        dadosUpdate.valor_faturamento = last.valorFaturamento || 0;
      } else {
        dadosUpdate.valor             = 0;
        dadosUpdate.valor_tabela      = 0;
        dadosUpdate.valor_faturamento = 0;
      }

      // 5) PATCH no banco
      var r2 = await fetch(
        SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId),
        {
          method:  'PATCH',
          headers: Object.assign({}, _hdrs(), { Prefer: 'return=minimal' }),
          body:    JSON.stringify(dadosUpdate)
        }
      );
      if(!r2.ok){
        var txt = await r2.text();
        throw new Error('PATCH falhou: HTTP ' + r2.status + ' — ' + txt);
      }

      // 6) Atualizar localStorage pra ficar em sync (evitar cloud-sync restaurar)
      if(typeof cLoad === 'function' && typeof cSave === 'function'){
        try {
          var data = cLoad();
          var idx = data.findIndex(function(o){ return o.id === cardId; });
          if(idx >= 0){
            // Atualiza revisões tanto no formato legacy (data[idx].revisoes)
            // quanto no formato novo (data[idx].opcoes[x].revisoes)
            if(Array.isArray(data[idx].revisoes) && data[idx].revisoes.length > revIndex){
              data[idx].revisoes.splice(revIndex, 1);
            }
            if(Array.isArray(data[idx].opcoes)){
              var op = data[idx].opcoes.find(function(o){ return o.id === opcaoAtivaId; });
              if(op && Array.isArray(op.revisoes) && op.revisoes.length > revIndex){
                op.revisoes.splice(revIndex, 1);
              }
            }
            // Atualiza valores top-level
            data[idx].valor             = dadosUpdate.valor             || 0;
            data[idx].valorTabela       = dadosUpdate.valor_tabela      || 0;
            data[idx].valorFaturamento  = dadosUpdate.valor_faturamento || 0;
            data[idx].updatedAt         = dadosUpdate.updated_at;
            cSave(data);
          }
        } catch(lsErr){
          console.warn('[fix-delete-rev] erro localStorage sync:', lsErr);
        }
      }

      // 7) Re-render
      if(typeof crmOpenModal === 'function'){
        try { crmOpenModal(null, cardId); } catch(e){}
      }
      if(typeof crmRenderKanban === 'function'){
        try { crmRenderKanban(); } catch(e){}
      }

      _toast(
        '✅ <b>Revisão excluída!</b><br>' +
        '<span style="font-size:11px;font-weight:400;opacity:.9">Removida do banco e do cache local</span>',
        '#27ae60', 3500
      );
      console.log('%c[fix-delete-rev] ✓ rev ' + revIndex + ' removida do card ' + cardId,
                  'color:#27ae60;font-weight:700');

    } catch(err){
      _toast('❌ <b>Erro ao excluir revisão</b><br><span style="font-size:11px;font-weight:400">' + (err.message || err) + '</span>', '#c0392b', 6000);
      console.error('[fix-delete-rev] erro:', err);
    }
  };

  console.log('%c[75-fix-delete-revisao] v1.0 — crmDeleteRevision agora faz PATCH no banco',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
