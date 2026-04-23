/**
 * 41-item-interna.js
 * PROJETTA.interna — FACHADA ÚNICA da PORTA INTERNA (de giro)
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Código da PORTA INTERNA só muda quando Felipe disser:
 *     "vamos mexer na porta interna"
 *
 * HOJE: fachada que delega ao legado. Migração real só mediante autorização.
 */
window.PROJETTA = window.PROJETTA || {};

window.PROJETTA.interna = {
  meta: {
    tipo: 'porta_interna',
    label: 'Porta Interna (Giro)',
    icon: '🚪',
    sistemas: ['GIRO'],
    modelosSuportados: ['01']
  },

  calcularPerfis: function(item){
    if(typeof window._piCalcularPerfis === 'function'){
      return window._piCalcularPerfis(item) || [];
    }
    console.debug('[PROJETTA.interna.calcularPerfis] delega p/ sistema legado');
    return [];
  },

  calcularAcessorios: function(item){
    if(typeof window._piCalcularAcessorios === 'function'){
      return window._piCalcularAcessorios(item) || [];
    }
    console.debug('[PROJETTA.interna.calcularAcessorios] delega p/ sistema legado');
    return [];
  },

  calcularChapas: function(item){
    if(typeof window._piCalcularChapas === 'function'){
      return window._piCalcularChapas(item) || [];
    }
    console.debug('[PROJETTA.interna.calcularChapas] delega p/ sistema legado');
    return [];
  },

  camposVisiveis: function(modelo){
    return ['largura','altura','sistema_pi','folhas_pi',
            'cor_ext','cor_int','fechadura_mecanica','cilindro'];
  }
};

console.log('[PROJETTA.interna] módulo carregado (fachada)');
