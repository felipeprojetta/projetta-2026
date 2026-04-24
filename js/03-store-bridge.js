/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.store bridge — Compatibilidade com código legado
 * ─────────────────────────────────────────────────────────────────────
 *
 * Faz variáveis globais legadas (window._mpItens, window._crmItens, etc.)
 * serem ALIASES do store central. Qualquer operação nelas escreve no
 * store, qualquer leitura lê do store. Código antigo continua funcionando
 * SEM precisar ser reescrito — mas agora está sincronizado.
 *
 * BRIDGES ATIVOS:
 *   window._mpItens   ↔ store.get/set('itens')
 *   window._crmItens  ↔ store.get/set('itens')
 *   (mesma entidade — duas janelas pro mesmo array)
 *
 * O QUE FUNCIONA AUTOMATICAMENTE (intercepta e notifica store):
 *   _mpItens = [...]                    ✓ setter direto
 *   _mpItens.push(item)                 ✓ método mutator
 *   _mpItens.splice(i, 1)               ✓ método mutator
 *   _mpItens.pop/shift/unshift/sort     ✓ métodos mutator
 *   _mpItens[i] = novoItem              ✓ atribuição por índice
 *   _mpItens[i].altura = 3000           ✓ mutação deep (proxy aninhado)
 *
 * O QUE FAZ (em todos os casos acima):
 *   1) Aplica a mudança ao estado do store
 *   2) Persiste em localStorage (debounce 400ms)
 *   3) Notifica subscribers ('itens')
 *   4) Sub automático chama _crmItensRender() se estiver disponível
 *
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  if(!window.PROJETTA || !window.PROJETTA.store){
    console.error('[store-bridge] PROJETTA.store não carregado — bridge abortado');
    return;
  }
  var store = window.PROJETTA.store;

  // ── Proxy handlers ─────────────────────────────────────────────────────
  var MUTATORS = ['push','pop','shift','unshift','splice','sort','reverse','fill','copyWithin'];

  function _proxyArray(storeKey){
    // Retorna um Proxy que parece um array mas todas mutações vão pro store
    return new Proxy([], {
      get: function(_, prop){
        var atual = store.get(storeKey) || [];
        // Intercepta métodos mutators
        if(MUTATORS.indexOf(prop) >= 0){
          return function(){
            var copia = atual.slice();
            var r = copia[prop].apply(copia, arguments);
            store.set(storeKey, copia);
            return r;
          };
        }
        // Caso [i] retorne objeto, embrulhar em proxy deep
        var v = atual[prop];
        if(v !== null && typeof v === 'object' && !isNaN(Number(prop))){
          return _proxyObject(storeKey, Number(prop));
        }
        // Outros: length, map, filter, forEach, [i] primitivos, etc.
        return typeof v === 'function' ? v.bind(atual) : v;
      },
      set: function(_, prop, val){
        var atual = (store.get(storeKey) || []).slice();
        atual[prop] = val;
        store.set(storeKey, atual);
        return true;
      },
      has: function(_, prop){
        var atual = store.get(storeKey) || [];
        return prop in atual;
      },
      ownKeys: function(){
        var atual = store.get(storeKey) || [];
        return Reflect.ownKeys(atual);
      },
      getOwnPropertyDescriptor: function(_, prop){
        var atual = store.get(storeKey) || [];
        var d = Object.getOwnPropertyDescriptor(atual, prop);
        if(d) d.configurable = true;
        return d;
      }
    });
  }

  function _proxyObject(storeKey, index){
    // Proxy para item individual dentro do array. Mutações disparam set no store.
    return new Proxy({}, {
      get: function(_, prop){
        var arr = store.get(storeKey) || [];
        var item = arr[index] || {};
        return item[prop];
      },
      set: function(_, prop, val){
        var arr = (store.get(storeKey) || []).slice();
        var item = Object.assign({}, arr[index] || {});
        item[prop] = val;
        arr[index] = item;
        store.set(storeKey, arr);
        return true;
      },
      has: function(_, prop){
        var arr = store.get(storeKey) || [];
        var item = arr[index] || {};
        return prop in item;
      },
      ownKeys: function(){
        var arr = store.get(storeKey) || [];
        var item = arr[index] || {};
        return Reflect.ownKeys(item);
      },
      getOwnPropertyDescriptor: function(_, prop){
        var arr = store.get(storeKey) || [];
        var item = arr[index] || {};
        var d = Object.getOwnPropertyDescriptor(item, prop);
        if(d) d.configurable = true;
        return d;
      }
    });
  }

  // ── Instalar bridges em window ─────────────────────────────────────────
  function _bridgeArray(globalName, storeKey){
    // Se já existe valor legacy no window, migrar pro store
    try {
      if(Array.isArray(window[globalName]) && window[globalName].length > 0){
        var atualStore = store.get(storeKey) || [];
        if(atualStore.length === 0){
          console.log('[bridge] migrando '+window[globalName].length+' '+globalName+' para store.'+storeKey);
          store.set(storeKey, window[globalName].slice());
        }
      }
    } catch(e){ /* window[globalName] pode não existir ainda */ }

    Object.defineProperty(window, globalName, {
      configurable: true,
      get: function(){ return _proxyArray(storeKey); },
      set: function(v){
        if(!Array.isArray(v)) v = [];
        store.set(storeKey, v.slice());
      }
    });
  }

  // Instalar bridges
  _bridgeArray('_mpItens',  'itens');
  _bridgeArray('_crmItens', 'itens');

  // ── Subscribers automáticos: quando 'itens' muda, re-render UIs que estão abertas ──
  store.subscribe('itens', function(novo, antigo){
    // Modal CRM (lista de itens do card)
    if(typeof window._crmItensRender === 'function'){
      try { window._crmItensRender(); } catch(e){ console.warn('[bridge] _crmItensRender:', e); }
    }
    // Aba Orçamento (lista de itens multi-porta)
    if(typeof window._mpRender === 'function'){
      try { window._mpRender(); } catch(e){ console.warn('[bridge] _mpRender:', e); }
    }
  });

  console.log('%c[store-bridge] ✓ _mpItens ↔ _crmItens ↔ store.itens sincronizados',
              'color:#0C447C;font-weight:500;background:#E6F1FB;padding:2px 6px;border-radius:3px');
})();
