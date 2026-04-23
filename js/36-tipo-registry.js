/**
 * 29-tipo-registry.js
 * ★ Felipe 23/04: ARQUITETURA MODULAR POR TIPO DE ITEM.
 *
 * Felipe: "separa a programacao e modulos diferente para nao sobrepor nada:
 *  porta, porta interna, fixos, revestimentos"
 *
 * Este arquivo é o REGISTRY central — toda regra específica por tipo vive
 * aqui. Quando um fix é feito pra REVESTIMENTO, ele NÃO pode afetar PORTA
 * (e vice-versa). O registry expõe funções puras (sem side-effects em DOM)
 * que podem ser chamadas por qualquer lugar do código.
 *
 * TIPOS SUPORTADOS:
 *  - porta_pivotante (default)
 *  - porta_interna
 *  - fixo
 *  - revestimento
 *
 * USO:
 *   var tipo = window._tipoRegistry.detectarTipo(item);
 *   var handler = window._tipoRegistry.handlers[tipo];
 *   var horas = handler.horasTrabalho(item);
 *   var camposEscondidos = handler.camposUIEscondidos();
 */

(function(){
  'use strict';

  // ════════════════════════════════════════════════════════════════════
  // HANDLER: PORTA PIVOTANTE (default)
  // ════════════════════════════════════════════════════════════════════
  var PORTA_PIVOTANTE = {
    tipo: 'porta_pivotante',
    label: 'Porta Pivotante',
    corBadge: '#2e7d32',

    // Horas de trabalho por etapa.
    // Recebe item e retorna {portal, quadro, colagem, conf, corteExtra}
    // NOTA: corte é calculado no planificador pelo nº de chapas, não aqui.
    horasTrabalho: function(item){
      var A = parseFloat(item._altura || item.altura || 0);
      var F = parseInt(item._folhas || item.folhas || 1);
      var Q = parseInt(item._qtd || item.qtd || 1);
      var modelo = item._modelo || item.modelo || '01';
      var modeloTxt = (item._modeloTxt || '').toLowerCase();
      var isCava = modeloTxt.indexOf('cava')>=0 || ['01','02','03','04','05','06','07','08','09','19','22','24'].indexOf(modelo)>=0;
      var isRip = ['08','15','20','21'].indexOf(modelo)>=0;
      // Portal
      var hPortal = (A<=2800 ? 5 : A<=4000 ? 7 : 10) * (F===2 ? 2 : 1);
      // Quadro
      var hQuadro = (A<=2800 ? 5 : A<=4000 ? 7 : 10) * (F===2 ? 2 : 1);
      // Colagem: dias × 9h
      var d;
      if(isCava){ d = A<=2800?2 : A<=4000?3 : 4; }
      else { var dCava = A<=2800?2 : A<=4000?3 : 4; d = Math.max(1, dCava-1); }
      if(isRip) d += A<=4000 ? 1 : 2;
      if(modelo==='06') d += 1;
      d = Math.max(2, d);
      var hColagem = (F===2 ? d*2 : d) * 9;
      // Conferência
      var cfB = A<6000?3:4;
      var hConf = F===2 ? cfB*2 : cfB;
      return {
        portal:  hPortal * Q,
        quadro:  hQuadro * Q,
        colagem: hColagem * Q,
        conf:    hConf * Q,
        corteExtra: 0  // corte é contado pelo planificador
      };
    },

    // Campos UI a ESCONDER na aba Orçamento pra esse tipo
    camposUIEscondidos: function(){ return []; }, // porta mostra tudo
    // Chapas usadas pra calcular corte (inclui PORTA, PORTAL, FIXO anexado)
    chapasRelevantesPraCorte: function(){ return ['PORTA','PORTAL','FIXO']; }
  };

  // ════════════════════════════════════════════════════════════════════
  // HANDLER: PORTA INTERNA
  // ════════════════════════════════════════════════════════════════════
  var PORTA_INTERNA = {
    tipo: 'porta_interna',
    label: 'Porta Interna',
    corBadge: '#1565c0',
    horasTrabalho: function(item){
      // Porta interna é uma porta simplificada — sem portal, sem quadro
      // estrutural. Só montagem de folha + colagem.
      var A = parseFloat(item._altura || item.altura || 0);
      var Q = parseInt(item._qtd || item.qtd || 1);
      var hColagem = 2 * 9; // 2 dias
      var hConf = 3;
      return {
        portal: 0,
        quadro: 4 * Q,  // só quadro da folha
        colagem: hColagem * Q,
        conf: hConf * Q,
        corteExtra: 0
      };
    },
    camposUIEscondidos: function(){ return ['plan-portal-row']; },
    chapasRelevantesPraCorte: function(){ return ['PORTA']; }
  };

  // ════════════════════════════════════════════════════════════════════
  // HANDLER: FIXO
  // ════════════════════════════════════════════════════════════════════
  var FIXO = {
    tipo: 'fixo',
    label: 'Fixo',
    corBadge: '#1565c0',
    horasTrabalho: function(item){
      // Fixos são anexados em portas. Se chegou aqui isolado, conta pouco.
      var Q = parseInt(item._qtd || item.qtd || 1);
      return {
        portal: 0,
        quadro: 2 * Q,
        colagem: 9 * Q,  // 1 dia
        conf: 1 * Q,
        corteExtra: 0
      };
    },
    camposUIEscondidos: function(){ return ['plan-cava-row','plan-friso-row','plan-ripa-row']; },
    chapasRelevantesPraCorte: function(){ return ['FIXO']; }
  };

  // ════════════════════════════════════════════════════════════════════
  // HANDLER: REVESTIMENTO
  // ════════════════════════════════════════════════════════════════════
  var REVESTIMENTO = {
    tipo: 'revestimento',
    label: 'Revestimento',
    corBadge: '#6a1b9a',

    horasTrabalho: function(item){
      // Revestimento NÃO tem portal, quadro ou colagem de porta.
      // Corte é contado pelo nº de chapas no planificador.
      // Conferência: só 1h por peça de revestimento.
      var Q = parseInt(item._qtd || item.qtd || 1);
      var isRipado = (item._rev_tipo || item.rev_tipo) === 'RIPADO';
      // Ripado tem colagem de ripa no fundo: 1h por ripa
      var hRipado = 0;
      if(isRipado){
        var L = parseFloat(item._largura || item.largura || 0);
        var nRipas = Math.ceil(L / 90);
        hRipado = nRipas * 0.1 * Q; // ~6min por ripa
      }
      return {
        portal: 0,
        quadro: 0,
        colagem: hRipado,  // só se ripado
        conf: 0.5 * Q,     // 30min por peça
        corteExtra: 0
      };
    },

    // Revestimento ESCONDE tudo de porta
    camposUIEscondidos: function(){
      return [
        'plan-modelo-row',
        'plan-folhas-row',
        'plan-cava-row',
        'plan-friso-row',
        'plan-friso-h-row',
        'plan-ripa-row',
        'plan-moldura-row',
        'plan-refilado-row'
      ];
    },
    chapasRelevantesPraCorte: function(){ return ['REVESTIMENTO']; }
  };

  // ════════════════════════════════════════════════════════════════════
  // REGISTRY PUBLIC API
  // ════════════════════════════════════════════════════════════════════
  var HANDLERS = {
    'porta_pivotante': PORTA_PIVOTANTE,
    'porta_interna':   PORTA_INTERNA,
    'fixo':            FIXO,
    'revestimento':    REVESTIMENTO
  };

  window._tipoRegistry = {
    handlers: HANDLERS,

    // Detectar tipo de um item (_mpItens ou _orcItens)
    detectarTipo: function(item){
      if(!item) return 'porta_pivotante';
      var t = item._tipo || item.tipo || 'porta_pivotante';
      return HANDLERS[t] ? t : 'porta_pivotante';
    },

    getHandler: function(item){
      return HANDLERS[this.detectarTipo(item)] || PORTA_PIVOTANTE;
    },

    // Dado uma lista de items, soma horas de trabalho por etapa
    somarHorasTrabalho: function(itens){
      var total = {portal:0, quadro:0, colagem:0, conf:0, corteExtra:0};
      (itens || []).forEach(function(it){
        var h = window._tipoRegistry.getHandler(it).horasTrabalho(it);
        total.portal     += h.portal;
        total.quadro     += h.quadro;
        total.colagem    += h.colagem;
        total.conf       += h.conf;
        total.corteExtra += h.corteExtra;
      });
      return total;
    },

    // True se a lista de items é "rev-only" (só revestimento)
    isRevOnly: function(itens){
      if(!itens || !itens.length) return false;
      return itens.every(function(it){
        var t = window._tipoRegistry.detectarTipo(it);
        return t === 'revestimento' || t === 'fixo';
      });
    },

    // União dos campos UI a esconder dado os tipos presentes
    camposEscondidosParaItens: function(itens){
      if(!itens || !itens.length) return [];
      // Se TODOS são do mesmo tipo, esconder os campos desse tipo
      var tipos = itens.map(function(it){return window._tipoRegistry.detectarTipo(it);});
      var tiposUnicos = Array.from(new Set(tipos));
      if(tiposUnicos.length === 1){
        return HANDLERS[tiposUnicos[0]].camposUIEscondidos();
      }
      // Mix de tipos: intersecção (só esconde o que é escondido por TODOS)
      var interSec = HANDLERS[tiposUnicos[0]].camposUIEscondidos();
      for(var i=1; i<tiposUnicos.length; i++){
        var campos = HANDLERS[tiposUnicos[i]].camposUIEscondidos();
        interSec = interSec.filter(function(c){return campos.indexOf(c) >= 0;});
      }
      return interSec;
    }
  };

  try {
    console.log('%c[tipo-registry] carregado — 4 tipos: porta_pivotante, porta_interna, fixo, revestimento',
      'background:#003144;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700');
  } catch(e){}
})();
