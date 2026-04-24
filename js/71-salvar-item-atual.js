/**
 * 71-salvar-item-atual.js v2 — Botão "💾 Salvar Item Atual" grava no banco
 * Funções declaradas com "function X(){}" nem sempre ficam em window.X
 * (depende de modo estrito/contexto). Por isso testamos sem o prefixo window.
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

  // Helper: chama a função original com múltiplos fallbacks (window.X ou X direto)
  function _chamaOriginal(){
    // 1) window.orcItemSalvarAtual
    if(typeof window.orcItemSalvarAtual === 'function'){
      window.orcItemSalvarAtual();
      return true;
    }
    // 2) Variável no escopo global (function orcItemSalvarAtual(){})
    try {
      if(typeof orcItemSalvarAtual === 'function'){
        orcItemSalvarAtual();
        return true;
      }
    } catch(e){ /* ReferenceError */ }
    // 3) eval como última tentativa
    try {
      var fn = (new Function('return typeof orcItemSalvarAtual !== "undefined" ? orcItemSalvarAtual : null'))();
      if(typeof fn === 'function'){
        fn();
        return true;
      }
    } catch(e){ /* impossível */ }
    return false;
  }

  async function _patchItensNoBanco(cardId, itens){
    var h = {
      apikey:         ANON_KEY,
      Authorization:  'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };

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

  window.salvarItemAtualComBanco = function(){
    // 1) Tenta rodar a função original
    var ok = _chamaOriginal();
    if(!ok){
      _toast(
        '⚠ <b>orcItemSalvarAtual não carregada</b><br>' +
        '<span style="font-size:11px;font-weight:400">Recarregue a página (Ctrl+Shift+R)</span>',
        '#c0392b', 5000
      );
      return;
    }

    var idx    = window._orcItemAtual;
    var item   = (window._orcItens || [])[idx] || {};
    var resumo = _resumo(item);
    var cardId = window._crmOrcCardId;

    if(!cardId){
      _toast(
        '📝 <b>Item ' + (idx+1) + ' salvo localmente</b><br>' +
        '<span style="font-size:11px;font-weight:400;opacity:.95">' + resumo + '</span><br>' +
        '<span style="font-size:10px;font-weight:400;opacity:.85;display:block;margin-top:6px">' +
        '⚠ Sem card vinculado — use "Fazer Orçamento" a partir de um card no CRM</span>',
        '#1a5276', 6000
      );
      return;
    }

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
      })
      .catch(function(err){
        _toast(
          '❌ <b>Erro ao salvar no card!</b><br>' +
          '<span style="font-size:11px;font-weight:400">' + (err.message || err) + '</span>',
          '#c0392b', 7000
        );
        console.error('[salvar-item] PATCH erro:', err);
      });
  };

  console.log('%c[71-salvar-item-atual] v2 pronto — window.salvarItemAtualComBanco()',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
