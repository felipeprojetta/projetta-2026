/**
 * 42-item-fixo.js
 * PROJETTA.fixo — FACHADA ÚNICA do FIXO
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Código do FIXO só muda quando Felipe disser:
 *     "vamos mexer no fixo"
 *
 * HOJE: fachada. Migração só com autorização explícita.
 *
 * ATENÇÃO: o fixo é o item com MAIOR acoplamento no código legado
 * (724 menções em 16 arquivos). A migração real terá que ser muito
 * cuidadosa para não quebrar cálculo de porta+fixo combinado.
 */
window.PROJETTA = window.PROJETTA || {};

window.PROJETTA.fixo = {
  meta: {
    tipo: 'fixo',
    label: 'Fixo',
    icon: '🔲',
    posicoes: ['LATERAL_DIREITO','LATERAL_ESQUERDO','BANDEIRA_SUPERIOR'],
    materiais: ['ACM','VIDRO_TEMPERADO','VIDRO_LAMINADO'],
    revestimentoLados: [1, 2]
  },

  calcularPerfis: function(item){
    if(typeof window._fxCalcularPerfis === 'function'){
      return window._fxCalcularPerfis(item) || [];
    }
    console.debug('[PROJETTA.fixo.calcularPerfis] delega p/ sistema legado');
    return [];
  },

  calcularAcessorios: function(item){
    if(typeof window._fxCalcularAcessorios === 'function'){
      return window._fxCalcularAcessorios(item) || [];
    }
    console.debug('[PROJETTA.fixo.calcularAcessorios] delega p/ sistema legado');
    return [];
  },

  calcularChapas: function(item){
    if(typeof window._fxCalcularChapas === 'function'){
      return window._fxCalcularChapas(item) || [];
    }
    console.debug('[PROJETTA.fixo.calcularChapas] delega p/ sistema legado');
    return [];
  },

  camposVisiveis: function(cfg){
    cfg = cfg || {};
    var base = ['largura','altura','posicao','tipo_material',
                'tem_estrutura','cor_ext','cor_int'];
    if(cfg.tipo_material === 'ACM'){
      base.push('revestimento_lados');
    }
    if(cfg.tipo_material === 'VIDRO_TEMPERADO' || cfg.tipo_material === 'VIDRO_LAMINADO'){
      base.push('espessura_vidro');
    }
    return base;
  }
};

console.log('[PROJETTA.fixo] módulo carregado (fachada)');
