/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.projeto.campos — Schema + captura/restore do form (PROJETO)
 * ─────────────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: dados de PROJETO do card (dimensões, modelo,
 * responsáveis, datas, notas). Separado do CLIENTE porque são domínios
 * diferentes: alterar modelo de porta é uma decisão de projeto, não de
 * identificação do cliente.
 *
 * Nenhum HTTP. Nenhuma dependência externa.
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.projeto = window.PROJETTA.projeto || {};

(function(ns){
  'use strict';

  var SCHEMA = {
    produto:      { label:'Produto',        tipo:'text',   obrigatorio:false },
    modelo:       { label:'Modelo',         tipo:'text',   obrigatorio:false },
    largura:      { label:'Largura (mm)',   tipo:'number', obrigatorio:false },
    altura:       { label:'Altura (mm)',    tipo:'number', obrigatorio:false },
    folhas:       { label:'Folhas',         tipo:'number', obrigatorio:false },
    abertura:     { label:'Abertura',       tipo:'text',   obrigatorio:false },
    reserva:      { label:'Reserva',        tipo:'text',   obrigatorio:false },
    agp:          { label:'AGP',            tipo:'text',   obrigatorio:false },
    origem:       { label:'Origem',         tipo:'text',   obrigatorio:false },
    prioridade:   { label:'Prioridade',     tipo:'text',   obrigatorio:false },
    potencial:    { label:'Potencial',      tipo:'text',   obrigatorio:false },
    responsavel:  { label:'Responsável',    tipo:'text',   obrigatorio:false },
    wrep:         { label:'WREP',           tipo:'text',   obrigatorio:false },
    data_contato: { label:'Data Contato',   tipo:'date',   obrigatorio:false },
    previsao:     { label:'Previsão',       tipo:'date',   obrigatorio:false },
    fechamento:   { label:'Fechamento',     tipo:'date',   obrigatorio:false },
    notas:        { label:'Notas',          tipo:'textarea', obrigatorio:false }
  };

  var ID_ALIASES = {
    produto:      ['produto','card-produto','c-produto','crm-produto'],
    modelo:       ['modelo','card-modelo','c-modelo','crm-modelo','carac-modelo'],
    largura:      ['largura','card-largura','c-largura','crm-largura'],
    altura:       ['altura','card-altura','c-altura','crm-altura'],
    folhas:       ['folhas','folhas-porta','card-folhas','c-folhas','crm-folhas'],
    abertura:     ['abertura','card-abertura','c-abertura','crm-abertura'],
    reserva:      ['reserva','numprojeto','card-reserva','crm-reserva'],
    agp:          ['agp','num-agp','card-agp','crm-agp'],
    origem:       ['origem','card-origem','c-origem','crm-origem'],
    prioridade:   ['prioridade','card-prioridade','c-prioridade','crm-prioridade'],
    potencial:    ['potencial','card-potencial','c-potencial','crm-potencial'],
    responsavel:  ['responsavel','card-responsavel','c-responsavel','crm-responsavel'],
    wrep:         ['wrep','card-wrep','c-wrep','crm-wrep'],
    data_contato: ['data_contato','dataContato','data-contato','card-data-contato','crm-data-contato'],
    previsao:     ['previsao','card-previsao','c-previsao','crm-previsao'],
    fechamento:   ['fechamento','card-fechamento','c-fechamento','crm-fechamento'],
    notas:        ['notas','observacoes','card-notas','c-notas','crm-notas']
  };

  function _getEl(campo){
    var aliases = ID_ALIASES[campo] || [campo];
    for(var i=0; i<aliases.length; i++){
      var el = document.getElementById(aliases[i]);
      if(el) return el;
    }
    return null;
  }

  ns.campos = {
    version: '1.0',
    SCHEMA:  SCHEMA,

    capturarForm: function(){
      var out = {};
      for(var campo in SCHEMA){
        var el = _getEl(campo);
        if(!el) continue;
        var v = el.value;
        if(SCHEMA[campo].tipo === 'number' && v !== '' && v != null){
          var n = parseFloat(v);
          out[campo] = isNaN(n) ? null : n;
        } else {
          out[campo] = v || '';
        }
      }
      return out;
    },

    restaurarForm: function(dados){
      if(!dados || typeof dados !== 'object') return 0;
      var n = 0;
      for(var campo in SCHEMA){
        if(dados[campo] === undefined || dados[campo] === null) continue;
        var el = _getEl(campo);
        if(el){ el.value = dados[campo]; n++; }
      }
      return n;
    },

    validar: function(dados){
      dados = dados || {};
      var erros = [];
      for(var campo in SCHEMA){
        var def = SCHEMA[campo];
        if(def.obrigatorio){
          var v = dados[campo];
          if(v == null || String(v).trim() === ''){
            erros.push('Campo obrigatório vazio: ' + def.label);
          }
        }
        if(def.tipo === 'number' && dados[campo] != null && dados[campo] !== ''){
          var n = parseFloat(dados[campo]);
          if(isNaN(n)) erros.push(def.label + ': esperado número, recebido "' + dados[campo] + '"');
        }
      }
      return erros;
    },

    adicionarAliasId: function(campo, idHtml){
      if(!ID_ALIASES[campo]) ID_ALIASES[campo] = [];
      ID_ALIASES[campo].unshift(idHtml);
    }
  };

  console.log('[PROJETTA.projeto.campos] v' + ns.campos.version + ' carregado — ' +
              Object.keys(SCHEMA).length + ' campos');
})(window.PROJETTA.projeto);
