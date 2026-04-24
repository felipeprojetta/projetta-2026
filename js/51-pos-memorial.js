/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.posorc.memorial — Submódulo de memorial de cálculo
 * ─────────────────────────────────────────────────────────────────────
 *
 * RESPONSABILIDADE ÚNICA: capturar em JSON o memorial de cálculo
 * completo do orçamento no estado atual (leitura da UI + window._calcResult).
 *
 * CONTRATO:
 *   - Síncrono, não faz HTTP.
 *   - Zero efeito colateral — só lê o DOM e o state global.
 *   - Retorna objeto estruturado por aba (caracteristicas, fabricacao,
 *     instalacao, perfis, acessorios, chapas, valores).
 *   - Campos ausentes viram null/[] — nunca lança por falta de dado.
 *
 * API PÚBLICA:
 *   PROJETTA.posorc.memorial.capturar()
 *     → { gerado_em, caracteristicas, fabricacao, instalacao,
 *         perfis, acessorios, chapas, valores }
 *
 *   PROJETTA.posorc.memorial.temDados()
 *     → boolean (true se window._calcResult tem valores > 0)
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.posorc = window.PROJETTA.posorc || {};

(function(ns){
  'use strict';

  function _val(id){
    var el = document.getElementById(id);
    return el ? el.value : null;
  }

  function _num(id){
    var v = _val(id);
    if(v == null || v === '') return null;
    var n = parseFloat(String(v).replace(/\./g,'').replace(',','.'));
    return isNaN(n) ? null : n;
  }

  function _capCaracteristicas(){
    // Se há múltiplos itens (_orcItens), captura todos. Senão, captura
    // os campos do formulário principal.
    var out = [];
    var itens = window._orcItens;
    if(Array.isArray(itens) && itens.length){
      itens.forEach(function(it){
        out.push({
          id:         it.id || null,
          tipo:       it.tipo || null,
          qtd:        parseInt(it.qtd) || 1,
          largura:    parseFloat(it.largura) || null,
          altura:     parseFloat(it.altura)  || null,
          modelo:     it.modelo || null,
          abertura:   it.abertura || null,
          folhas:     parseInt(it.folhas) || null,
          cor_ext:    it.cor_ext || null,
          cor_int:    it.cor_int || null,
          cor_macico: it.cor_macico || null,
          puxador:    it.puxador || null,
          fechadura:  it.fechadura_mecanica || it.fech_mec || null,
          cilindro:   it.cilindro || null,
          detalhes:   JSON.parse(JSON.stringify(it))
        });
      });
    } else {
      out.push({
        id:         null,
        tipo:       'porta_pivotante',
        qtd:        1,
        largura:    _num('largura'),
        altura:     _num('altura'),
        modelo:     _val('carac-modelo'),
        abertura:   _val('abertura'),
        folhas:     parseInt(_val('folhas-porta')) || 1,
        cor_ext:    _val('cor-ext'),
        cor_int:    _val('cor-int'),
        detalhes:   null
      });
    }
    return out;
  }

  function _capPerfis(){
    // Se há PROJETTA.itens.consolidarPerfis, usa. Senão, array vazio.
    try {
      if(window.PROJETTA && window.PROJETTA.itens && 
         typeof window.PROJETTA.itens.consolidarPerfis === 'function'){
        return window.PROJETTA.itens.consolidarPerfis(window._orcItens || []) || [];
      }
    } catch(e){ console.warn('[posorc.memorial] consolidarPerfis falhou:', e); }
    return [];
  }

  function _capAcessorios(){
    try {
      if(window.PROJETTA && window.PROJETTA.itens &&
         typeof window.PROJETTA.itens.consolidarAcessorios === 'function'){
        return window.PROJETTA.itens.consolidarAcessorios(window._orcItens || []) || [];
      }
    } catch(e){ console.warn('[posorc.memorial] consolidarAcessorios falhou:', e); }
    return [];
  }

  function _capChapas(){
    try {
      if(window.PROJETTA && window.PROJETTA.itens &&
         typeof window.PROJETTA.itens.consolidarChapas === 'function'){
        return window.PROJETTA.itens.consolidarChapas(window._orcItens || []) || [];
      }
    } catch(e){ console.warn('[posorc.memorial] consolidarChapas falhou:', e); }
    return [];
  }

  function _capFabricacao(){
    // Lê de window._calcResult se existir — não depende da UI
    var r = window._calcResult || {};
    return {
      tempo_horas:       parseFloat(r._fabricTempo) || null,
      mao_obra_bruta:    parseFloat(r._fabricMO) || null,
      mao_obra_indireta: parseFloat(r._fabricMOI) || null,
      custo_total:       parseFloat(r._fabricTotal) || null
    };
  }

  function _capInstalacao(){
    var r = window._calcResult || {};
    var ehIntl = !!(_val('inst-incoterm') || _val('inst-pais'));
    return {
      eh_internacional: ehIntl,
      pessoas:          parseInt(_val('inst-pessoas')) || null,
      dias:             parseInt(_val('inst-dias')) || null,
      mo_diaria:        _num('inst-mo'),
      hotel:            _num('inst-hotel'),
      alimentacao:      _num('inst-alim'),
      carro:            _num('inst-carro'),
      passagem:         _num('inst-passagem'),
      seguro:           _num('inst-seguro'),
      incoterm:         _val('inst-incoterm'),
      pais:             _val('inst-pais'),
      custo_total:      parseFloat(r._instalTotal) || null
    };
  }

  function _capValores(){
    var r = window._calcResult || {};
    return {
      custo_total:      parseFloat(r._custoTotal) || null,
      preco_tabela:     parseFloat(r._tabTotal)   || null,
      preco_faturamento:parseFloat(r._fatTotal)   || null,
      markup_pct:       parseFloat(r._markupPct)  || null
    };
  }

  ns.memorial = {
    version: '1.0',

    /**
     * Captura o memorial de cálculo completo.
     * @returns {object} Memorial estruturado por aba.
     */
    capturar: function(){
      return {
        gerado_em:       new Date().toISOString(),
        caracteristicas: _capCaracteristicas(),
        fabricacao:      _capFabricacao(),
        instalacao:      _capInstalacao(),
        perfis:          _capPerfis(),
        acessorios:      _capAcessorios(),
        chapas:          _capChapas(),
        valores:         _capValores()
      };
    },

    /**
     * Checa se há valores calculados prontos pra capturar.
     * @returns {boolean}
     */
    temDados: function(){
      var r = window._calcResult;
      if(!r) return false;
      return (parseFloat(r._tabTotal) > 0) || (parseFloat(r._fatTotal) > 0);
    }
  };

  console.log('[PROJETTA.posorc.memorial] v' + ns.memorial.version + ' carregado');
})(window.PROJETTA.posorc);
