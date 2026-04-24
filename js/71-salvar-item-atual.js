/**
 * ═══════════════════════════════════════════════════════════════════════
 * 71-salvar-item-atual.js — Botão "💾 Salvar Item Atual" grava no banco
 * ─────────────────────────────────────────────────────────────────────
 *
 * Define window.salvarItemAtualComBanco() que:
 *   1) Roda orcItemSalvarAtual() original (atualiza _orcItens em memória)
 *   2) Se tem _crmOrcCardId → PATCH em crm_oportunidades.extras.itens
 *   3) Mostra toast grande colorido:
 *      🟢 VERDE    → salvo no card
 *      🔵 AZUL     → sem card vinculado (abrir via "Fazer Orçamento")
 *      🔴 VERMELHO → erro no PATCH
 *
 * O HTML do botão foi trocado pra chamar esta função diretamente
 * (onclick="salvarItemAtualComBanco()") — sem hooks de timing.
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

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
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4500);
  }

  function _resumo(item){
    if(!item) return '';
    var p = [];
    if(item.largura && item.altura) p.push(item.largura + '×' + item.altura + 'mm');
    if(item.modelo)                 p.push('Mod ' + item.modelo);
    return p.join(' · ');
  }

  async function _patchItensNoBanco(cardId, itens){
    var h = {
      apikey:         ANON_KEY,
      Authorization:  'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };

    // Ler extras atual pra merge (não sobrescrever outras chaves)
    var r1 = await fetch(
      SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras&limit=1',
      { headers: h }
    );
    if(!r1.ok) throw new Error('HTTP ' + r1.status + ' ao ler card');
    var rows = await r1.json();
    if(!rows.length) throw new Error('Card não encontrado: ' + cardId);
    var extras = rows[0].extras || {};
    extras.itens = itens;

    var body = { extras: extras, updated_at: new Date().toISOString() };
    if(itens.length > 0){
      var first = itens[0];
      if(first.largura != null) body.largura = first.largura;
      if(first.altura  != null) body.altura  = first.altura;
      if(first.modelo)          body.modelo  = first.modelo;
      if(first.folhas)          body.folhas  = first.folhas;
    }

    var r2 = await fetch(
      SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId),
      {
        method:  'PATCH',
        headers: Object.assign({}, h, { Prefer: 'return=minimal' }),
        body:    JSON.stringify(body)
      }
    );
    if(!r2.ok){
      var txt = await r2.text();
      throw new Error('HTTP ' + r2.status + ' — ' + txt);
    }
    return true;
  }

  // Função principal (chamada pelo onclick do botão)
  window.salvarItemAtualComBanco = function(){
    // 1) Roda a função original (atualiza _orcItens, re-render)
    if(typeof window.orcItemSalvarAtual === 'function'){
      try { window.orcItemSalvarAtual(); }
      catch(e){
        _toast('⚠ <b>Erro interno</b><br><span style="font-size:11px;font-weight:400">' + (e.message||e) + '</span>', '#c0392b', 5000);
        console.error('[salvar-item] orcItemSalvarAtual falhou:', e);
        return;
      }
    } else {
      _toast('⚠ <b>orcItemSalvarAtual não encontrada</b><br><span style="font-size:11px;font-weight:400">Código do Projetta pode não ter carregado</span>', '#c0392b', 5000);
      return;
    }

    var idx    = window._orcItemAtual;
    var item   = (window._orcItens || [])[idx] || {};
    var resumo = _resumo(item);
    var cardId = window._crmOrcCardId;

    // 2) Sem card vinculado → toast azul, não tenta banco
    if(!cardId){
      _toast(
        '📝 <b>Item ' + (idx+1) + ' salvo localmente</b><br>' +
        '<span style="font-size:11px;font-weight:400;opacity:.95">' + resumo + '</span><br>' +
        '<span style="font-size:10px;font-weight:400;opacity:.85;display:block;margin-top:6px">' +
        '⚠ Sem card vinculado — salve no card abrindo via "Fazer Orçamento" no CRM</span>',
        '#1a5276', 6000
      );
      return;
    }

    // 3) Tem card → mostra "⏳ salvando" e dispara PATCH
    _toast(
      '⏳ <b>Salvando no card ' + cardId.slice(0,8) + '...</b><br>' +
      '<span style="font-size:11px;font-weight:400;opacity:.95">Item ' + (idx+1) + ': ' + resumo + '</span>',
      '#7f8c8d', 3000
    );

    _patchItensNoBanco(cardId, window._orcItens || [])
      .then(function(){
        _toast(
          '✅ <b>Item ' + (idx+1) + ' salvo no card!</b><br>' +
          '<span style="font-size:12px;font-weight:600;display:block;margin-top:4px">' + resumo + '</span>' +
          '<span style="font-size:10px;font-weight:400;opacity:.9;display:block;margin-top:6px">' +
          'Card ' + cardId.slice(0,8) + ' · extras.itens atualizado no banco</span>',
          '#27ae60', 5000
        );
        console.log('%c[salvar-item] ✓ banco atualizado — card ' + cardId,
                    'color:#27ae60;font-weight:700;background:#e8f8f0;padding:3px 8px;border-radius:4px');
      })
      .catch(function(err){
        _toast(
          '❌ <b>Erro ao salvar no card!</b><br>' +
          '<span style="font-size:11px;font-weight:400">' + (err.message || err) + '</span><br>' +
          '<span style="font-size:10px;font-weight:400;opacity:.85;display:block;margin-top:6px">' +
          'Dados locais preservados.</span>',
          '#c0392b', 7000
        );
        console.error('[salvar-item] PATCH erro:', err);
      });
  };

  console.log('%c[71-salvar-item-atual] v1.0 pronto — window.salvarItemAtualComBanco()',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
