/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.cliente.campos — Schema + captura/restore do form
 * ─────────────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: traduzir o form HTML ↔ objeto JS pros dados
 * de CLIENTE do card. Nenhum HTTP. Nenhuma dependência externa.
 *
 * API:
 *   PROJETTA.cliente.campos.SCHEMA
 *   PROJETTA.cliente.campos.capturarForm()  → {cliente, telefone, ...}
 *   PROJETTA.cliente.campos.restaurarForm(dados) → n campos preenchidos
 *   PROJETTA.cliente.campos.validar(dados) → [erros]
 *   PROJETTA.cliente.campos.adicionarAliasId(campo, idHtml) → void
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.cliente = window.PROJETTA.cliente || {};

(function(ns){
  'use strict';

  var SCHEMA = {
    cliente:  { label:'Cliente',  tipo:'text',   obrigatorio:true  },
    contato:  { label:'Contato',  tipo:'text',   obrigatorio:false },
    telefone: { label:'Telefone', tipo:'text',   obrigatorio:false },
    email:    { label:'E-mail',   tipo:'email',  obrigatorio:false },
    cep:      { label:'CEP',      tipo:'text',   obrigatorio:false },
    cidade:   { label:'Cidade',   tipo:'text',   obrigatorio:false },
    estado:   { label:'Estado',   tipo:'text',   obrigatorio:false },
    pais:     { label:'País',     tipo:'text',   obrigatorio:false },
    endereco: { label:'Endereço', tipo:'text',   obrigatorio:false },
    scope:    { label:'Escopo',   tipo:'select', obrigatorio:false,
                opcoes:['nacional','internacional'] }
  };

  // Aliases de ID HTML. O form pode usar variantes — tentamos cada um.
  var ID_ALIASES = {
    cliente:  ['cliente','card-cliente','c-cliente','crm-cliente'],
    contato:  ['contato','card-contato','c-contato','crm-contato'],
    telefone: ['telefone','card-telefone','c-telefone','crm-telefone'],
    email:    ['email','card-email','c-email','crm-email'],
    cep:      ['cep','card-cep','c-cep','crm-cep'],
    cidade:   ['cidade','card-cidade','c-cidade','crm-cidade'],
    estado:   ['estado','uf','card-estado','c-estado','crm-uf'],
    pais:     ['pais','card-pais','c-pais','crm-pais'],
    endereco: ['endereco','card-endereco','c-endereco','crm-endereco'],
    scope:    ['scope','card-scope','c-scope','crm-scope']
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
        if(el) out[campo] = el.value || '';
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
        if(def.opcoes && dados[campo] && def.opcoes.indexOf(dados[campo]) < 0){
          erros.push(def.label + ': valor "' + dados[campo] + '" não é válido. Esperado: ' + def.opcoes.join(', '));
        }
      }
      return erros;
    },

    adicionarAliasId: function(campo, idHtml){
      if(!ID_ALIASES[campo]) ID_ALIASES[campo] = [];
      ID_ALIASES[campo].unshift(idHtml);
    }
  };

  console.log('[PROJETTA.cliente.campos] v' + ns.campos.version + ' carregado — ' +
              Object.keys(SCHEMA).length + ' campos');
})(window.PROJETTA.cliente);
