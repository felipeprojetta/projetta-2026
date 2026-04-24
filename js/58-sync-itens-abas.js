/**
 * ═══════════════════════════════════════════════════════════════════════
 * 58-sync-itens-abas.js — Sincronização entre listas de itens
 * ─────────────────────────────────────────────────────────────────────
 *
 * PROBLEMA QUE RESOLVE:
 * O sistema tem 2 arrays de itens em memória que não conversam:
 *   • window._mpItens  → lista da aba Orçamento (multi-porta)
 *   • window._crmItens → lista do modal Editar Card no CRM
 * Alterar um NÃO propagava pro outro. Ao salvar alteração em 1 aba e
 * navegar pra outra, o usuário via dados antigos.
 *
 * ESTE ARQUIVO:
 *   1) Expõe PROJETTA.syncItens.sincronizarParaCRM() — copia _mpItens
 *      → _crmItens e re-renderiza a lista do CRM.
 *   2) Expõe PROJETTA.syncItens.persistirNoBanco(cardId) — grava os
 *      itens em crm_oportunidades.extras.itens via PATCH.
 *   3) Faz monkey-patch de _mpSalvarItemAtual pra rodar o sync
 *      automaticamente sempre que o Felipe clicar "Salvar Item Atual".
 *
 * SEGURANÇA:
 *   • Se _mpSalvarItemAtual não existir ainda, tenta novamente
 *     depois de 500ms. Falha silenciosa se não achar.
 *   • Se _crmItens/_crmItensRender não existirem, só sincroniza memória.
 *   • Se PATCH falhar, só loga — não derruba UX.
 *   • Fire-and-forget no banco — não bloqueia UI.
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

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
    // Preserva tudo que já existia no crmItem (campos que o mp não conhece).
    var ci = Object.assign({}, crmExistente || {});

    // Defaults pra novo item
    if(!ci.tipo) ci.tipo = mpItem.tipo || 'porta_pivotante';
    if(!ci.id)   ci.id   = mpItem.id   || ('ci_' + Date.now() + '_' + Math.random().toString(36).slice(2,6));

    // Aplica mapeamento (só sobrescreve se mp tem valor não-vazio)
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

    // Campos derivados do mp (_altura, _largura, etc) — usa se o principal ausente
    if(!ci.altura  && mpItem._altura)  ci.altura  = parseFloat(mpItem._altura)  || ci.altura;
    if(!ci.largura && mpItem._largura) ci.largura = parseFloat(mpItem._largura) || ci.largura;
    if(!ci.qtd     && mpItem._qtd)     ci.qtd     = parseInt(mpItem._qtd)       || ci.qtd;
    if(!ci.modelo  && mpItem._modelo)  ci.modelo  = mpItem._modelo;

    return ci;
  }

  window.PROJETTA = window.PROJETTA || {};
  window.PROJETTA.syncItens = {
    version: '1.0',

    /**
     * Copia _mpItens → _crmItens preservando campos que o _mpItem não conhece.
     * Sincronização por ÍNDICE: mpItens[i] ↔ crmItens[i].
     * @returns {number} quantidade de itens sincronizados
     */
    sincronizarParaCRM: function(){
      if(!Array.isArray(window._mpItens) || window._mpItens.length === 0) return 0;
      if(!Array.isArray(window._crmItens)) window._crmItens = [];

      var novo = [];
      window._mpItens.forEach(function(mpItem, i){
        var crmExistente = window._crmItens[i];
        novo.push(_mpItemParaCrmItem(mpItem, crmExistente));
      });
      window._crmItens = novo;

      // Re-renderizar lista do modal CRM, se estiver aberta/visível
      if(typeof window._crmItensRender === 'function'){
        try { window._crmItensRender(); } catch(e){ console.warn('[sync] render CRM:', e); }
      }

      return novo.length;
    },

    /**
     * Grava window._crmItens em crm_oportunidades.extras.itens (merge).
     * Também sincroniza colunas principais (altura/largura/modelo/folhas) com o 1º item.
     * @param {string} cardId
     * @returns {Promise<boolean>}
     */
    async persistirNoBanco(cardId){
      if(!cardId) throw new Error('[sync] cardId obrigatório');
      if(!Array.isArray(window._crmItens)) return false;

      var h = {
        apikey:         ANON_KEY,
        Authorization:  'Bearer ' + ANON_KEY,
        'Content-Type': 'application/json'
      };

      // Ler extras atual (pra merge — não sobrescrever chaves de outras contextos)
      var r1 = await fetch(
        SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras&limit=1',
        { headers: h }
      );
      if(!r1.ok) throw new Error('[sync] HTTP ' + r1.status + ' ao ler extras');
      var rows = await r1.json();
      if(!rows.length) throw new Error('[sync] card não encontrado: ' + cardId);
      var extras = rows[0].extras || {};

      // Atualizar apenas chave 'itens'
      extras.itens = window._crmItens;

      var body = {
        extras:     extras,
        updated_at: new Date().toISOString()
      };

      // Sincronizar colunas principais com o primeiro item (pra queries/kanban)
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
        throw new Error('[sync] PATCH falhou: HTTP ' + r2.status + ' — ' + txt);
      }

      console.log('%c[sync] ✓ ' + cardId.slice(0,8) + ' — ' + window._crmItens.length + ' itens gravados em extras.itens',
                  'color:#27ae60;font-weight:500');
      return true;
    }
  };

  // Monkey-patch: _mpSalvarItemAtual passa a disparar sync após a lógica original
  function _hookSalvarItem(tentativas){
    tentativas = tentativas || 0;
    var orig = window._mpSalvarItemAtual;
    if(typeof orig !== 'function'){
      if(tentativas < 20){
        setTimeout(function(){ _hookSalvarItem(tentativas+1); }, 500);
      } else {
        console.warn('[sync-hook] _mpSalvarItemAtual não foi encontrada após 10s');
      }
      return;
    }
    if(orig._syncHooked) return; // já hooked — evitar duplicação

    window._mpSalvarItemAtual = function(){
      var r = orig.apply(this, arguments);
      try {
        var n = window.PROJETTA.syncItens.sincronizarParaCRM();
        if(n > 0){
          console.log('%c[sync] ' + n + ' item(ns) _mpItens → _crmItens',
                      'color:#1a5276;font-weight:500');
        }
        // Persistir no banco em background (só se tiver card CRM vinculado)
        if(window._crmOrcCardId){
          window.PROJETTA.syncItens.persistirNoBanco(window._crmOrcCardId)
            .catch(function(err){ console.warn('[sync] persistir falhou (in-memory OK):', err.message || err); });
        }
      } catch(e){
        console.warn('[sync-hook] falha:', e);
      }
      return r;
    };
    window._mpSalvarItemAtual._syncHooked = true;
    console.log('%c[58-sync-itens-abas] ✓ _mpSalvarItemAtual agora sincroniza _crmItens + banco',
                'color:#0C447C;font-weight:500;background:#E6F1FB;padding:2px 6px;border-radius:3px');
  }

  // Esperar DOM pronto
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ _hookSalvarItem(0); });
  } else {
    _hookSalvarItem(0);
  }

  console.log('[58-sync-itens-abas] v1.0 carregado');
})();
