/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.store — FONTE ÚNICA DE VERDADE (reactive global state)
 * ─────────────────────────────────────────────────────────────────────
 *
 * MOTIVAÇÃO:
 * Projetta tem múltiplas abas (Orçamento, CRM, Levantamento Perfis,
 * Acessórios, Superfícies, Custo Real) que trabalham sobre as MESMAS
 * entidades. Historicamente cada aba mantinha sua própria variável global
 * e isso gerava inconsistência (alterar em uma aba não refletia nas outras).
 *
 * SOLUÇÃO:
 * TUDO lê/escreve em PROJETTA.store. Subscribers (funções de render)
 * são notificados automaticamente quando a entidade muda. Persistência
 * automática em localStorage com debounce de 400ms.
 *
 * ENTIDADES:
 *   itens              Array<ItemPedido>    portas/fixos/revest/internas
 *   chapas             Array<Chapa>         ACM de levantamento
 *   perfis             Array<Perfil>        alumínio de levantamento
 *   acessorios         Array<Acessorio>     ferragens/metais
 *   superficies        Array<Superficie>    pintura/tratamento
 *   paramsFinanceiros  Object               margem/impostos/frete/comissão
 *   paramsInstalacao   Object               CEP origem/destino, rota, CIF
 *   cliente            Object               nome/contato/local/scope
 *   projeto            Object               produto/modelo/datas/responsáveis
 *   meta               Object               cardId/revisaoId/user/timestamps
 *
 * API PÚBLICA:
 *   PROJETTA.store.get(key)               → deep clone (leitura imutável)
 *   PROJETTA.store.set(key, value)        → substitui, notifica subs
 *   PROJETTA.store.patch(key, partialObj) → merge obj, notifica subs
 *   PROJETTA.store.subscribe(key, fn)     → retorna unsub()
 *   PROJETTA.store.batch(fn)              → agrega mudanças, 1 notif
 *   PROJETTA.store.reset(keys?)           → zera tudo ou keys específicas
 *   PROJETTA.store.snapshot()             → copy completa (debug)
 *   PROJETTA.store.schema                 → estrutura das entidades
 *
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var LS_KEY = 'projetta_store_v1';
  var DEBOUNCE_MS = 400;

  // Defaults - toda entidade aparece aqui, mesmo que vazia
  function _defaults(){
    return {
      itens:             [],
      chapas:            [],
      perfis:            [],
      acessorios:        [],
      superficies:       [],
      paramsFinanceiros: {},
      paramsInstalacao:  {},
      cliente:           {},
      projeto:           {},
      meta:              { cardId: null, revisaoId: null, user: null, lastChange: null }
    };
  }

  var _state = _defaults();
  var _subs = {};           // { key: [fn1, fn2, ...] }
  var _batchDepth = 0;      // se > 0, acumula changes sem notificar
  var _batchDirty = {};     // keys alteradas durante batch
  var _persistTimer = null;
  var _version = '1.0';

  // ── Helpers ────────────────────────────────────────────────────────────
  function _clone(v){
    if(v === null || v === undefined) return v;
    if(typeof v !== 'object') return v;
    try { return JSON.parse(JSON.stringify(v)); }
    catch(e){ console.warn('[store] clone falhou:', e); return v; }
  }

  function _isEqual(a, b){
    if(a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch(e){ return false; }
  }

  function _notify(key, valor, antigo){
    if(_batchDepth > 0){ _batchDirty[key] = { valor: valor, antigo: antigo }; return; }
    var subs = _subs[key] || [];
    for(var i=0; i<subs.length; i++){
      try { subs[i](valor, antigo, key); }
      catch(e){ console.warn('[store] sub falhou em "'+key+'":', e); }
    }
  }

  function _persist(){
    if(_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(function(){
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(_state));
      } catch(e){
        console.warn('[store] persist falhou:', e);
      }
    }, DEBOUNCE_MS);
  }

  function _hydrate(){
    try {
      var raw = localStorage.getItem(LS_KEY);
      if(!raw) return false;
      var parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object') return false;
      // Merge com defaults (pra garantir todas as keys presentes)
      var d = _defaults();
      for(var k in d){
        _state[k] = (parsed[k] !== undefined) ? parsed[k] : d[k];
      }
      console.log('[store] hidratado de localStorage: ' +
        Object.keys(_state).map(function(k){
          var v = _state[k];
          return k + (Array.isArray(v) ? '['+v.length+']' : '');
        }).join(' '));
      return true;
    } catch(e){
      console.warn('[store] hydrate falhou:', e);
      return false;
    }
  }

  // ── API pública ────────────────────────────────────────────────────────
  var store = {
    version: _version,

    /** Schema — documentação viva das entidades */
    schema: {
      itens:     'Array de itens do pedido (porta_pivotante, porta_interna, fixo, revestimento)',
      chapas:    'Array de chapas ACM com código, cor, dimensões, qtd',
      perfis:    'Array de perfis de alumínio com código, cor, metros lineares',
      acessorios:'Array de ferragens/metais com código, qtd',
      superficies:'Array de superfícies pintadas',
      paramsFinanceiros: 'Objeto: margem, icms, pis, cofins, irpj, csll, comissao, frete%',
      paramsInstalacao:  'Objeto: cep_origem, cep_destino, km, diaria, hoteis, alimentacao',
      cliente:   'Objeto: nome, contato, telefone, email, cep, cidade, estado, pais, endereco, scope',
      projeto:   'Objeto: produto, modelo, reserva, agp, data_contato, previsao, fechamento, responsavel, wrep',
      meta:      'Objeto: cardId, revisaoId, user, lastChange'
    },

    get: function(key){
      if(!key) return _clone(_state);
      if(_state[key] === undefined){
        console.warn('[store] get: key desconhecida "'+key+'"');
        return undefined;
      }
      return _clone(_state[key]);
    },

    set: function(key, valor){
      if(_state[key] === undefined){
        console.warn('[store] set: key desconhecida "'+key+'"');
        return false;
      }
      var antigo = _state[key];
      if(_isEqual(antigo, valor)) return false; // no-op se igual
      _state[key] = _clone(valor);
      _state.meta = _state.meta || {};
      _state.meta.lastChange = { key: key, at: new Date().toISOString() };
      _notify(key, _clone(valor), _clone(antigo));
      _persist();
      return true;
    },

    /** Merge parcial para objetos. Para arrays, use set. */
    patch: function(key, parcial){
      if(_state[key] === undefined){
        console.warn('[store] patch: key desconhecida "'+key+'"');
        return false;
      }
      if(!parcial || typeof parcial !== 'object' || Array.isArray(parcial)){
        console.warn('[store] patch só funciona com objetos');
        return false;
      }
      var atual = _state[key] || {};
      if(Array.isArray(atual)){
        console.warn('[store] patch em array - use set()');
        return false;
      }
      var novo = Object.assign({}, atual, parcial);
      return store.set(key, novo);
    },

    subscribe: function(key, fn){
      if(typeof fn !== 'function'){
        console.warn('[store] subscribe: fn deve ser function');
        return function(){};
      }
      if(!_subs[key]) _subs[key] = [];
      _subs[key].push(fn);
      return function unsub(){
        var i = _subs[key].indexOf(fn);
        if(i >= 0) _subs[key].splice(i, 1);
      };
    },

    batch: function(fn){
      if(typeof fn !== 'function') return;
      _batchDepth++;
      try { fn(); }
      finally {
        _batchDepth--;
        if(_batchDepth === 0){
          // Liberar notificações acumuladas
          var dirty = _batchDirty;
          _batchDirty = {};
          for(var key in dirty){
            var s = _subs[key] || [];
            for(var i=0; i<s.length; i++){
              try { s[i](dirty[key].valor, dirty[key].antigo, key); }
              catch(e){ console.warn('[store] batch sub falhou em "'+key+'":', e); }
            }
          }
        }
      }
    },

    reset: function(keys){
      var d = _defaults();
      if(!keys){
        _state = d;
        // Notifica todas as keys
        for(var k in d){ _notify(k, _clone(d[k]), undefined); }
      } else if(Array.isArray(keys)){
        keys.forEach(function(k){ store.set(k, d[k]); });
      }
      _persist();
    },

    snapshot: function(){ return _clone(_state); },

    // Utility: listar subs registrados (debug)
    _debug: function(){
      var info = {};
      for(var k in _subs) info[k] = _subs[k].length;
      return { state: _clone(_state), subscribers: info };
    }
  };

  window.PROJETTA = window.PROJETTA || {};
  window.PROJETTA.store = store;

  // ── Hidratação automática na inicialização ────────────────────────────
  var hidratado = _hydrate();
  if(!hidratado) console.log('[store] iniciado com defaults (sem localStorage)');

  console.log('%c[PROJETTA.store] v' + _version + ' pronto — ' +
              Object.keys(_state).length + ' entidades gerenciadas',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
