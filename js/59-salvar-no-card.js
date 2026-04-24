/**
 * ═══════════════════════════════════════════════════════════════════════
 * 59-salvar-no-card.js — Botão verde "Salvar Item Atual" grava no banco
 * ─────────────────────────────────────────────────────────────────────
 *
 * PROBLEMA:
 * O botão verde "💾 Salvar Item Atual" chama `orcItemSalvarAtual()`
 * que só atualiza window._orcItens em memória + mostra toast verde.
 * Não persiste nada no banco. Felipe reportou "nada mudou no card".
 *
 * SOLUÇÃO:
 * Monkey-patch em orcItemSalvarAtual. Depois da função rodar:
 *   1) Pega _orcItens atual (fonte de verdade da aba Orçamento)
 *   2) Se _crmOrcCardId existe → PATCH em crm_oportunidades.extras.itens
 *   3) Mostra toast COLORIDO grande no canto superior direito:
 *      🟢 VERDE    → salvo no banco
 *      🔵 AZUL     → sem card vinculado
 *      🔴 VERMELHO → erro no PATCH
 *
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  // Toast visual
  function _toast(html, cor, ms){
    var anterior = document.getElementById('projetta-save-toast');
    if(anterior) anterior.remove();
    var t = document.createElement('div');
    t.id = 'projetta-save-toast';
    t.style.cssText =
      'position:fixed;top:80px;right:20px;' +
      'background:' + cor + ';color:#fff;' +
      'padding:14px 22px;border-radius:10px;' +
      'font-size:13px;font-weight:700;z-index:99999;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.3);' +
      'max-width:440px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4500);
  }

  async function _patchItens(cardId, itens){
    var h = {
      apikey:        ANON_KEY,
      Authorization: 'Bearer ' + ANON_KEY,
      'Content-Type':'application/json'
    };

    // 1) Ler extras atual (pra merge)
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
    // Sincronizar colunas principais com 1º item (p/ queries/kanban)
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

  function _resumo(item){
    if(!item) return '';
    var partes = [];
    if(item.largura && item.altura) partes.push(item.largura + '×' + item.altura + 'mm');
    if(item.modelo)                 partes.push('Mod ' + item.modelo);
    if(item.tipo)                   partes.push(item.tipo);
    return partes.join(' · ');
  }

  function _hook(tentativas){
    tentativas = tentativas || 0;
    var orig = window.orcItemSalvarAtual;
    if(typeof orig !== 'function'){
      if(tentativas < 30){
        setTimeout(function(){ _hook(tentativas+1); }, 500);
      } else {
        console.warn('[59-salvar] orcItemSalvarAtual não foi encontrada após 15s');
      }
      return;
    }
    if(orig._bancoHooked) return;

    window.orcItemSalvarAtual = function(){
      // Remover toast verde original (da função legada) logo após criar
      setTimeout(function(){
        var toastsVerdes = document.querySelectorAll('div');
        toastsVerdes.forEach(function(el){
          if(el.textContent && el.textContent.indexOf('Item ') === 0 &&
             el.textContent.indexOf('salvo!') >= 0 &&
             el !== document.getElementById('projetta-save-toast')){
            el.remove();
          }
        });
      }, 50);

      // Roda a lógica original (atualiza _orcItens, renderiza, toast verde curto)
      var r = orig.apply(this, arguments);

      // Captura contexto
      var idx    = window._orcItemAtual;
      var item   = (window._orcItens || [])[idx] || {};
      var resumo = _resumo(item);
      var cardId = window._crmOrcCardId;

      if(!cardId){
        _toast(
          '📝 <b>Item ' + (idx+1) + ' salvo localmente</b><br>' +
          '<span style="font-size:11px;font-weight:400;opacity:.95">' + resumo + '</span><br>' +
          '<span style="font-size:10px;font-weight:400;opacity:.85;display:block;margin-top:6px">' +
          '⚠ Não salvou no card — volte ao CRM, abra um card e clique "Fazer Orçamento" primeiro</span>',
          '#1a5276', 6000
        );
        console.warn('[59-salvar] _crmOrcCardId não definido — salvando só localmente');
        return r;
      }

      // Toast intermediário "salvando..."
      _toast(
        '⏳ <b>Salvando item ' + (idx+1) + ' no card...</b><br>' +
        '<span style="font-size:11px;font-weight:400;opacity:.95">' + resumo + '</span>',
        '#7f8c8d', 3000
      );

      _patchItens(cardId, window._orcItens)
        .then(function(){
          _toast(
            '✅ <b>Item ' + (idx+1) + ' salvo no card!</b><br>' +
            '<span style="font-size:12px;font-weight:600;opacity:1;display:block;margin-top:4px">' + resumo + '</span>' +
            '<span style="font-size:10px;font-weight:400;opacity:.9;display:block;margin-top:6px">' +
            'Card ' + cardId.slice(0,8) + ' · extras.itens atualizado no banco</span>',
            '#27ae60', 5000
          );
          console.log('%c[59-salvar] ✓ ' + cardId + ' — ' + window._orcItens.length + ' itens no banco',
                      'color:#27ae60;font-weight:700;background:#e8f8f0;padding:3px 8px;border-radius:4px');
        })
        .catch(function(err){
          _toast(
            '❌ <b>Erro ao salvar no card!</b><br>' +
            '<span style="font-size:11px;font-weight:400;opacity:.95">' + (err.message || err) + '</span><br>' +
            '<span style="font-size:10px;font-weight:400;opacity:.85;display:block;margin-top:6px">' +
            'Dados locais preservados. Verifique rede/permissão e tente novamente.</span>',
            '#c0392b', 7000
          );
          console.error('[59-salvar] erro no PATCH:', err);
        });

      return r;
    };
    window.orcItemSalvarAtual._bancoHooked = true;

    console.log('%c[59-salvar-no-card] ✓ orcItemSalvarAtual agora grava no banco + toast visual',
                'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ _hook(0); });
  } else {
    _hook(0);
  }

  console.log('[59-salvar-no-card] v1.0 carregado');
})();
