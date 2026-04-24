/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.bind — Two-way binding entre inputs do DOM e o store
 * ─────────────────────────────────────────────────────────────────────
 *
 * Completa o sistema iniciado em 02-store.js + 03-store-bridge.js.
 *
 * PROBLEMA:
 * Mesmo com _mpItens/_crmItens ligados ao store, os INPUTS VISUAIS
 * (id="largura", id="altura", id="carac-modelo", etc.) continuavam
 * lendo/escrevendo direto no DOM. User digitava, ficava preso no
 * input até alguma função legada capturar.
 *
 * SOLUÇÃO:
 * Escuta GLOBAL de eventos 'input' e 'change' no document. Se o
 * elemento alterado tem um ID mapeado, espelha imediatamente no store.
 * Na direção oposta: subscriber em store.itens atualiza os inputs
 * visíveis quando a entidade muda.
 *
 * CONCEITO "ITEM ATIVO":
 * A UI do Projetta mostra UM item expandido/editado por vez. O bind
 * usa PROJETTA.bind.setAtivo(index) pra saber qual item o input atual
 * está editando. Código legado chama setAtivo quando troca de item.
 *
 * API:
 *   PROJETTA.bind.setAtivo(index)     → define qual item é o "ativo"
 *   PROJETTA.bind.getAtivo()          → retorna index atual
 *   PROJETTA.bind.syncFromStore()     → força atualização DOM ← store
 *   PROJETTA.bind.syncToStore()       → força atualização store ← DOM
 *   PROJETTA.bind.addMapping(id, def) → registra novo campo
 *   PROJETTA.bind.MAP                 → tabela atual de mapeamento
 *
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  if(!window.PROJETTA || !window.PROJETTA.store){
    console.error('[bind] PROJETTA.store não carregado — bind abortado');
    return;
  }
  var store = window.PROJETTA.store;

  // ── MAPEAMENTO: ID do input → { field: campo no objeto, tipo } ─────────
  // Todos os campos do inventário (~30). ITEM é o objeto dentro de store.itens[ativo]
  var MAP = {
    // Dimensões
    'largura':            { field: 'largura',         tipo: 'number' },
    'altura':             { field: 'altura',          tipo: 'number' },
    'qtd-portas':         { field: 'qtd',             tipo: 'number' },
    'folhas-porta':       { field: 'folhas',          tipo: 'text'   },
    'abertura':           { field: 'abertura',        tipo: 'text'   },

    // Modelo e cor
    'carac-modelo':       { field: 'modelo',          tipo: 'text'   },
    'carac-cor-ext':      { field: 'cor_ext',         tipo: 'text'   },
    'carac-cor-int':      { field: 'cor_int',         tipo: 'text'   },
    'carac-cor-macico':   { field: 'cor_macico',      tipo: 'text'   },

    // Cava
    'dist_borda_cava':    { field: 'dist_borda_cava', tipo: 'number' },
    'largura_cava':       { field: 'largura_cava',    tipo: 'number' },
    'cantoneira_cava':    { field: 'cantoneira_cava', tipo: 'number' },

    // Frisos
    'qtd_frisos':         { field: 'qtd_frisos',      tipo: 'number' },
    'espessura_friso':    { field: 'espessura_friso', tipo: 'number' },
    'dist_borda_friso':   { field: 'dist_borda_friso',tipo: 'number' },

    // Molduras (modelo 23)
    'qtd_moldura':        { field: 'qtd_moldura',     tipo: 'number' },
    'dist_borda_moldura': { field: 'dist_borda_moldura', tipo: 'number' },

    // Fechaduras e puxadores
    'puxador':            { field: 'puxador',         tipo: 'text'   },
    'pux_tam':            { field: 'pux_tam',         tipo: 'text'   },
    'cilindro':           { field: 'cilindro',        tipo: 'text'   },
    'fech_mec':           { field: 'fech_mec',        tipo: 'text'   },
    'fech_dig':           { field: 'fech_dig',        tipo: 'text'   },

    // Flags e variantes
    'refilado':           { field: 'refilado',        tipo: 'bool'   },
    'tem_alisar':         { field: 'tem_alisar',      tipo: 'bool'   },
    'tem_estrutura':      { field: 'tem_estrutura',   tipo: 'text'   },
    'tipo_material':      { field: 'tipo_material',   tipo: 'text'   },
    'revestimento_lados': { field: 'revestimento_lados', tipo: 'text' },
    'tipo_fixacao':       { field: 'tipo_fixacao',    tipo: 'text'   },
    'tipo_vidro':         { field: 'tipo_vidro',      tipo: 'text'   },
    'sistema_pi':         { field: 'sistema_pi',      tipo: 'text'   }
  };

  var _ativo = 0;
  var _syncing = false; // evita loop store → DOM → store

  // ── Helpers ────────────────────────────────────────────────────────────
  function _parseValue(el, tipo){
    if(el.type === 'checkbox') return el.checked;
    var v = el.value;
    if(tipo === 'number'){
      if(v === '' || v == null) return null;
      var n = parseFloat(v);
      return isNaN(n) ? null : n;
    }
    if(tipo === 'bool'){
      return v === '1' || v === 'true' || v === 'SIM' || v === true;
    }
    return v;
  }

  function _formatValue(v, tipo, el){
    if(v == null) return '';
    if(tipo === 'bool' && el && el.type === 'checkbox'){
      el.checked = !!v;
      return null; // não set .value em checkbox
    }
    return String(v);
  }

  // ── DOM → Store (listener global) ──────────────────────────────────────
  function _domToStore(e){
    var el = e.target;
    if(!el || !el.id) return;
    var def = MAP[el.id];
    if(!def) return;
    if(_syncing) return;

    var itens = store.get('itens') || [];
    while(itens.length <= _ativo) itens.push({});
    var item = Object.assign({}, itens[_ativo]);
    item[def.field] = _parseValue(el, def.tipo);
    itens[_ativo] = item;
    store.set('itens', itens);
  }

  // ── Store → DOM ────────────────────────────────────────────────────────
  function _storeToDom(){
    var itens = store.get('itens') || [];
    var item = itens[_ativo] || {};
    _syncing = true;
    try {
      for(var id in MAP){
        var el = document.getElementById(id);
        if(!el) continue;
        var def = MAP[id];
        var v = item[def.field];
        if(v === undefined) continue;
        var formatted = _formatValue(v, def.tipo, el);
        if(formatted !== null && el.value !== formatted){
          el.value = formatted;
        }
      }
    } finally {
      _syncing = false;
    }
  }

  // ── Instalar listeners globais ────────────────────────────────────────
  function _install(){
    document.addEventListener('input',  _domToStore, true);
    document.addEventListener('change', _domToStore, true);
    store.subscribe('itens', function(){ _storeToDom(); });
    console.log('[bind] ✓ listeners globais instalados ('+Object.keys(MAP).length+' campos mapeados)');
  }

  // ── API pública ────────────────────────────────────────────────────────
  window.PROJETTA.bind = {
    version: '1.0',
    MAP:     MAP,

    setAtivo: function(index){
      var i = parseInt(index) || 0;
      if(i < 0) i = 0;
      _ativo = i;
      _storeToDom();
    },

    getAtivo: function(){ return _ativo; },

    syncFromStore: function(){ _storeToDom(); },

    syncToStore: function(){
      // Varre todos inputs mapeados do DOM e grava no store
      var itens = store.get('itens') || [];
      while(itens.length <= _ativo) itens.push({});
      var item = Object.assign({}, itens[_ativo]);
      for(var id in MAP){
        var el = document.getElementById(id);
        if(!el) continue;
        item[MAP[id].field] = _parseValue(el, MAP[id].tipo);
      }
      itens[_ativo] = item;
      store.set('itens', itens);
    },

    addMapping: function(id, field, tipo){
      MAP[id] = { field: field, tipo: tipo || 'text' };
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _install);
  } else {
    _install();
  }

  console.log('%c[PROJETTA.bind] v1.0 pronto — two-way DOM ↔ store',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
