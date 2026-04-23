/**
 * 43-item-revestimento.js
 * PROJETTA.revestimento — FACHADA ÚNICA do REVESTIMENTO
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Código do REVESTIMENTO só muda quando Felipe disser:
 *     "vamos mexer no revestimento"
 *
 * HOJE: fachada. Migração só com autorização explícita.
 *
 * TIPOS SUPORTADOS:
 *   - CHAPA: revestimento liso de ACM
 *   - RIPADO: tiras/ripas de ACM com tubo estrutural por trás
 */
window.PROJETTA = window.PROJETTA || {};

window.PROJETTA.revestimento = {
  meta: {
    tipo: 'revestimento',
    label: 'Revestimento',
    icon: '🪟',
    tipos: ['CHAPA','RIPADO'],
    materiais: ['ACM_4MM','ACM_2MM'],
    tubosSuportados: ['PA-51X12X1.58','PA-51X25X1.5','PA-38X25X1.2']
  },

  calcularPerfis: function(item){
    if(typeof window._revCalcularPerfis === 'function'){
      return window._revCalcularPerfis(item) || [];
    }
    console.debug('[PROJETTA.revestimento.calcularPerfis] delega p/ sistema legado');
    return [];
  },

  calcularAcessorios: function(item){
    if(typeof window._revCalcularAcessorios === 'function'){
      return window._revCalcularAcessorios(item) || [];
    }
    console.debug('[PROJETTA.revestimento.calcularAcessorios] delega p/ sistema legado');
    return [];
  },

  calcularChapas: function(item){
    if(typeof window._revCalcularChapas === 'function'){
      return window._revCalcularChapas(item) || [];
    }
    console.debug('[PROJETTA.revestimento.calcularChapas] delega p/ sistema legado');
    return [];
  },

  camposVisiveis: function(cfg){
    cfg = cfg || {};
    var base = ['largura','altura','rev_tipo','cor_chapa'];
    if(cfg.rev_tipo === 'RIPADO'){
      base.push('rev_estrutura','rev_tubo','rev_largura_ripa','rev_dist_ripa');
    }
    if(cfg.rev_tipo === 'CHAPA'){
      base.push('rev_lados');
    }
    return base;
  }
};

console.log('[PROJETTA.revestimento] módulo carregado (fachada)');
