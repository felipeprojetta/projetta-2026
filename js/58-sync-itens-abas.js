/**
 * ═══════════════════════════════════════════════════════════════════════
 * 58-sync-itens-abas.js — Sync entre listas + feedback visual ao salvar
 * ─────────────────────────────────────────────────────────────────────
 *
 * Hook em _mpSalvarItemAtual que:
 *   1) Sincroniza _mpItens → _crmItens (via store, já automático pelo bridge)
 *   2) Persiste em crm_oportunidades.extras.itens (via PATCH)
 *   3) Mostra toast visual GRANDE pro usuário VER o que aconteceu:
 *      • 🟢 VERDE  → salvo no card (PATCH ok)
 *      • 🔵 AZUL   → salvo apenas local (sem card vinculado)
 *      • 🔴 VERMELHO → erro no PATCH
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  // ── Toast visual ───────────────────────────────────────────────────────
  function _toast(texto, cor, duracao){
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
      'max-width:420px;line-height:1.4;' +
      'font-family:inherit';
    t.innerHTML = texto;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, duracao || 4000);
  }

  // Mapeamento: chave do _mpItem (ID de input) → campo do _crmItem (formato banco)
  var MAP_MP_TO_CRM = {
    'largura':          'largura',
    'altura':           'altura',
    'qtd-portas':       'qtd',
    'folhas-porta':     'folhas',
    'abertura':         'abertura',
    'carac-modelo':     'modelo',
    'carac-cor-ext':    'cor_ext',
    'carac-cor-int':    'cor_int',
    'carac-cor-macico': 'cor_macico',
    'puxador':          'puxador',
    'cilindro':         'cilindro',
    'fech_mec':         'fech_mec',
    'fech_dig':         'fech_dig',
    'pux_tam':          'pux_tam',
    'refilado':         'refilado',
    'tem_alisar':       'tem_alisar'
  };

  function _mpItemParaCrmItem(mpItem, crmExistente){
    var ci = Object.assign({}, crmExistente || {});
    if(!ci.tipo) ci.tipo = mpItem.tipo || 'porta_pivotante';
    if(!ci.id)   ci.id   = mpItem.id   || ('ci_' + Date.now() + '_' + Math.random().toString(36).slice(2,6));

    for(var mpKey in MAP_MP_TO_CRM){
      var v = mpItem[mpKey];
      if(v === undefined || v === null || v === '') continue;
      var crmKey = MAP_MP_TO_CRM[mpKey];
      if(crmKey === 'altura' || crmKey === 'largura' || crmKey === 'qtd'){
        var n = parseFloat(v);
        if(!isNaN(n)) ci[crmKey] = n;
      } else {
        ci[crmKey] = v;
      }
    }

    if(!ci.altura  && mpItem._altura)  ci.altura  = parseFloat(mpItem._altura)  || ci.altura;
    if(!ci.largura && mpItem._largura) ci.largura = parseFloat(mpItem._largura) || ci.largura;
    if(!ci.qtd     && mpItem._qtd)     ci.qtd     = parseInt(mpItem._qtd)       || ci.qtd;
    if(!ci.modelo  && mpItem._modelo)  ci.modelo  = mpItem._modelo;

    return ci;
  }

  window.PROJETTA = window.PROJETTA || {};
  window.PROJETTA.syncItens = {
    version: '2.0',

    sincronizarParaCRM: function(){
      if(!Array.isArray(window._mpItens) || window._mpItens.length === 0) return 0;
      var crmAtual = Array.isArray(window._crmItens) ? window._crmItens : [];

      var novo = [];
      window._mpItens.forEach(function(mpItem, i){
        novo.push(_mpItemParaCrmItem(mpItem, crmAtual[i]));
      });

      // Escrever via window._crmItens (passa pelo bridge → store)
      window._crmItens = novo;

      // Re-renderizar lista do modal CRM
      if(typeof window._crmItensRender === 'function'){
        try { window._crmItensRender(); } catch(e){ console.warn('[sync] render CRM:', e); }
      }
      return novo.length;
    },

    async persistirNoBanco(cardId){
      if(!cardId) throw new Error('cardId obrigatório');
      if(!Array.isArray(window._crmItens)) return false;

      var h = {
        apikey:         ANON_KEY,
        Authorization:  'Bearer ' + ANON_KEY,
        'Content-Type': 'application/json'
      };

      var r1 = await fetch(
        SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras&limit=1',
        { headers: h }
      );
      if(!r1.ok) throw new Error('HTTP ' + r1.status + ' ao ler extras');
      var rows = await r1.json();
      if(!rows.length) throw new Error('card não encontrado: ' + cardId);
      var extras = rows[0].extras || {};
      extras.itens = window._crmItens;

      var body = { extras: extras, updated_at: new Date().toISOString() };
      if(window._crmItens.length > 0){
        var first = window._crmItens[0];
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
  };

  // Monkey-patch _mpSalvarItemAtual com feedback visual
  function _hookSalvarItem(tentativas){
    tentativas = tentativas || 0;
    var orig = window._mpSalvarItemAtual;
    if(typeof orig !== 'function'){
      if(tentativas < 20){
        setTimeout(function(){ _hookSalvarItem(tentativas+1); }, 500);
      } else {
        console.warn('[sync-hook] _mpSalvarItemAtual não encontrada após 10s');
      }
      return;
    }
    if(orig._syncHooked) return;

    window._mpSalvarItemAtual = function(){
      var idx = window._mpEditingIdx;
      var r = orig.apply(this, arguments);

      try {
        // 1) Sincronizar estruturas em memória
        var n = window.PROJETTA.syncItens.sincronizarParaCRM();

        // 2) Obter dados do item pra toast
        var item = (window._crmItens && window._crmItens[idx]) || {};
        var resumo = '';
        if(item.largura && item.altura) resumo = item.largura + '×' + item.altura + 'mm';
        if(item.modelo) resumo = (resumo ? resumo + ' · Mod ' + item.modelo : 'Mod ' + item.modelo);

        // 3) Feedback visual
        var cardId = window._crmOrcCardId;
        if(!cardId){
          // Sem card vinculado — salvou só em memória/local
          _toast(
            '📝 <b>Item ' + (idx+1) + ' salvo localmente</b><br>' +
            '<span style="font-size:11px;font-weight:400;opacity:.95">' + resumo + '</span><br>' +
            '<span style="font-size:10px;font-weight:400;opacity:.85">⚠ Sem card vinculado — abra um card no CRM e clique "Fazer Orçamento" pra salvar no card</span>',
            '#1a5276', 5000
          );
        } else {
          // Tem cardId — tentar PATCH no banco
          _toast(
            '⏳ <b>Salvando item ' + (idx+1) + ' no card...</b><br>' +
            '<span style="font-size:11px;font-weight:400;opacity:.95">' + resumo + '</span>',
            '#7f8c8d', 3000
          );
          window.PROJETTA.syncItens.persistirNoBanco(cardId)
            .then(function(){
              _toast(
                '✓ <b>Item ' + (idx+1) + ' salvo no card!</b><br>' +
                '<span style="font-size:11px;font-weight:400;opacity:.95">' + resumo + '</span><br>' +
                '<span style="font-size:10px;font-weight:400;opacity:.85">Card ' + cardId.slice(0,8) + ' atualizado no banco</span>',
                '#27ae60', 4000
              );
              console.log('%c[sync] ✓ ' + cardId.slice(0,8) + ' — ' + window._crmItens.length + ' itens gravados',
                          'color:#27ae60;font-weight:600;font-size:13px');
            })
            .catch(function(err){
              _toast(
                '⚠ <b>Erro ao salvar no card!</b><br>' +
                '<span style="font-size:11px;font-weight:400;opacity:.95">' + (err.message || err) + '</span><br>' +
                '<span style="font-size:10px;font-weight:400;opacity:.85">Dados locais preservados — tente novamente</span>',
                '#c0392b', 6000
              );
              console.error('[sync] erro:', err);
            });
        }
      } catch(e){
        _toast(
          '⚠ <b>Erro interno no sync</b><br>' +
          '<span style="font-size:11px;font-weight:400;opacity:.95">' + (e.message || e) + '</span>',
          '#c0392b', 5000
        );
        console.warn('[sync-hook] falha:', e);
      }
      return r;
    };
    window._mpSalvarItemAtual._syncHooked = true;
    console.log('%c[58-sync] ✓ hook instalado com toast visual',
                'color:#0C447C;font-weight:500;background:#E6F1FB;padding:2px 6px;border-radius:3px');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ _hookSalvarItem(0); });
  } else {
    _hookSalvarItem(0);
  }

  console.log('[58-sync-itens-abas] v2.0 carregado');
})();
