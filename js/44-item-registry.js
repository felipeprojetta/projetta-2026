/**
 * 44-item-registry.js
 * PROJETTA.itens — registro central dos 4 módulos de item
 *
 * Os 3 agregadores (Levantamento de Perfis / Acessórios / Chapas) usam
 * este registry pra descobrir quais itens existem e chamar os cálculos
 * individualmente, depois somar.
 *
 * EXEMPLO DE USO pelo Levantamento de Perfis:
 *   var perfisConsolidados = [];
 *   window._orcItens.forEach(function(item){
 *     var mod = PROJETTA.itens.porTipo(item.tipo);
 *     if(mod){
 *       var perfisDoItem = mod.calcularPerfis(item);
 *       perfisConsolidados = perfisConsolidados.concat(perfisDoItem);
 *     }
 *   });
 *   // Depois agrupa e manda pro planificador
 */
window.PROJETTA = window.PROJETTA || {};

window.PROJETTA.itens = {
  todos: function(){
    return [
      window.PROJETTA.pivotante,
      window.PROJETTA.interna,
      window.PROJETTA.fixo,
      window.PROJETTA.revestimento
    ].filter(Boolean);
  },

  porTipo: function(tipo){
    if(!tipo) return null;
    var map = {
      'porta_pivotante': window.PROJETTA.pivotante,
      'pivotante':       window.PROJETTA.pivotante,
      'porta_interna':   window.PROJETTA.interna,
      'interna':         window.PROJETTA.interna,
      'giro':            window.PROJETTA.interna,
      'fixo':            window.PROJETTA.fixo,
      'revestimento':    window.PROJETTA.revestimento
    };
    return map[tipo] || null;
  },

  // Consolida: chama calcularX em TODOS os itens do orçamento e concatena
  consolidarPerfis: function(itensOrc){
    itensOrc = itensOrc || window._orcItens || [];
    var out = [];
    itensOrc.forEach(function(it){
      var mod = PROJETTA.itens.porTipo(it.tipo);
      if(mod && typeof mod.calcularPerfis === 'function'){
        try { out = out.concat(mod.calcularPerfis(it) || []); }
        catch(e){ console.warn('[PROJETTA.itens.consolidarPerfis]', it.tipo, e); }
      }
    });
    return out;
  },

  consolidarAcessorios: function(itensOrc){
    itensOrc = itensOrc || window._orcItens || [];
    var out = [];
    itensOrc.forEach(function(it){
      var mod = PROJETTA.itens.porTipo(it.tipo);
      if(mod && typeof mod.calcularAcessorios === 'function'){
        try { out = out.concat(mod.calcularAcessorios(it) || []); }
        catch(e){ console.warn('[PROJETTA.itens.consolidarAcessorios]', it.tipo, e); }
      }
    });
    return out;
  },

  consolidarChapas: function(itensOrc){
    itensOrc = itensOrc || window._orcItens || [];
    var out = [];
    itensOrc.forEach(function(it){
      var mod = PROJETTA.itens.porTipo(it.tipo);
      if(mod && typeof mod.calcularChapas === 'function'){
        try { out = out.concat(mod.calcularChapas(it) || []); }
        catch(e){ console.warn('[PROJETTA.itens.consolidarChapas]', it.tipo, e); }
      }
    });
    return out;
  }
};

console.log('[PROJETTA.itens] registry carregado — 4 itens:',
  PROJETTA.itens.todos().map(function(i){ return i.meta.tipo; }).join(', '));
