/**
 * 40-item-pivotante.js
 * PROJETTA.pivotante — FACHADA ÚNICA da PORTA PIVOTANTE
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Código de cálculo/lógica da PORTA PIVOTANTE só pode ser alterado
 *   quando Felipe autorizar EXPLICITAMENTE com a frase:
 *     "vamos mexer na porta pivotante"
 *   Fora disso, NÃO TOCAR em nada daqui.
 *
 * HOJE: este módulo é uma FACHADA que delega para funções legadas
 *       espalhadas em outros arquivos. As funções reais continuam
 *       onde estão até a migração explícita item-por-item ser autorizada.
 *
 * API PÚBLICA:
 *   PROJETTA.pivotante.meta                  → metadados do item
 *   PROJETTA.pivotante.calcularPerfis(item)  → Array de perfis
 *   PROJETTA.pivotante.calcularAcessorios()  → Array de acessórios
 *   PROJETTA.pivotante.calcularChapas()      → Array de peças de chapa
 *   PROJETTA.pivotante.camposVisiveis(modelo) → Array de nomes de campos
 */
window.PROJETTA = window.PROJETTA || {};

window.PROJETTA.pivotante = {
  meta: {
    tipo: 'porta_pivotante',
    label: 'Porta Pivotante',
    icon: '🚪',
    sistemas: ['PA007','PA006','PA005','PA-5818','PA-5040','PA-5018'],
    modelosSuportados: ['01','02','03','04','05','06','10','16','22','23']
  },

  // ─── CÁLCULO DE PERFIS ───
  calcularPerfis: function(item){
    if(typeof window._pvtCalcularPerfis === 'function'){
      return window._pvtCalcularPerfis(item) || [];
    }
    // Fallback: funções legadas existentes (gerarOS, _calcPerfisPorta etc)
    // Mantém comportamento antigo. Migração real virá quando autorizado.
    console.debug('[PROJETTA.pivotante.calcularPerfis] delega p/ sistema legado');
    return [];
  },

  // ─── CÁLCULO DE ACESSÓRIOS ───
  calcularAcessorios: function(item){
    if(typeof window._pvtCalcularAcessorios === 'function'){
      return window._pvtCalcularAcessorios(item) || [];
    }
    console.debug('[PROJETTA.pivotante.calcularAcessorios] delega p/ sistema legado');
    return [];
  },

  // ─── CÁLCULO DE CHAPAS ───
  calcularChapas: function(item){
    if(typeof window._pvtCalcularChapas === 'function'){
      return window._pvtCalcularChapas(item) || [];
    }
    console.debug('[PROJETTA.pivotante.calcularChapas] delega p/ sistema legado');
    return [];
  },

  // ─── CARACTERÍSTICAS VISÍVEIS POR MODELO ───
  camposVisiveis: function(modelo){
    var base = ['largura','altura','modelo','abertura','folhas',
                'cor_ext','cor_int','puxador',
                'fechadura_mecanica','fechadura_digital','cilindro'];
    var m = String(modelo||'');
    if(['01','06','16','22'].indexOf(m) >= 0) base.push('cava_largura','cava_cantoneira');
    if(m === '01') base.push('dist_borda');
    if(['06','16'].indexOf(m) >= 0) base.push('friso_qtd','friso_espessura');
    if(m === '22') base.push('friso_qtd','friso_espessura');
    if(m === '23') base.push('moldura_qtd_largura','moldura_qtd_altura','moldura_dist_borda','moldura_revestimento');
    return base;
  }
};

console.log('[PROJETTA.pivotante] módulo carregado (fachada)');
