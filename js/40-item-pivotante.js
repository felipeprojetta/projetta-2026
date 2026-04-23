/**
 * 40-item-pivotante.js
 * PROJETTA.pivotante — FACHADA ÚNICA da PORTA PIVOTANTE
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Código de cálculo/lógica da PORTA PIVOTANTE só pode ser alterado
 *   quando Felipe autorizar EXPLICITAMENTE:
 *     "vamos mexer na porta pivotante"
 *   Fora disso, NÃO TOCAR em nada daqui.
 *
 * HOJE (Etapa 2 Perfis):
 *   calcularPerfis(item) está IMPLEMENTADA — chama _calcularDadosPerfis()
 *   (definida em 06-engenharia_perfis.js) injetando os dados do item.
 *   Para itens com campos ausentes, usa valores padrão.
 *   Retorna lista consolidada de perfis no formato unificado.
 *
 *   calcularAcessorios e calcularChapas ainda são fachada (Etapa 3/4).
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

  /**
   * Calcula a lista de perfis de UMA porta pivotante.
   * @param {Object} item - dados da porta (largura, altura, folhas, modelo, ...)
   * @returns {Array} lista de perfis no formato unificado
   */
  calcularPerfis: function(item){
    if(!item){
      // Sem item: usa dados atuais do DOM (comportamento atual do sistema)
      return this._calcularViaDOM();
    }
    var tipo = (item.tipo||'').toLowerCase();
    if(tipo !== 'porta_pivotante' && tipo !== 'pivotante'){
      console.warn('[PROJETTA.pivotante.calcularPerfis] tipo nao-pivotante:', item.tipo);
      return [];
    }
    if(typeof _calcularDadosPerfis !== 'function'){
      console.warn('[PROJETTA.pivotante.calcularPerfis] _calcularDadosPerfis nao disponivel');
      return [];
    }

    var L = parseFloat(item.largura) || 0;
    var H = parseFloat(item.altura) || 0;
    var nFolhas = parseInt(item.folhas) || 1;
    var barraMM = parseFloat(item.barra_mm) || 6000;

    if(L <= 0 || H <= 0){
      console.warn('[PROJETTA.pivotante.calcularPerfis] L/H invalidos:', L, H);
      return [];
    }

    // ─── Injecao dos dados do item no DOM (backup + restore) ───
    var _backup = {};
    var _setVal = function(id, val){
      if(val === undefined || val === null) return;
      var el = document.getElementById(id);
      if(el){
        _backup[id] = el.value;
        el.value = String(val);
      }
    };
    var _setSelect = function(id, val){
      if(val === undefined || val === null) return;
      var el = document.getElementById(id);
      if(el){
        _backup[id] = el.value;
        el.value = String(val);
      }
    };

    _setVal('largura', item.largura);
    _setVal('altura', item.altura);
    _setVal('folhas-porta', nFolhas);
    _setVal('qtd-portas', item.qtd || 1);
    _setSelect('carac-modelo', item.modelo || '01');
    _setSelect('plan-modelo', item.modelo || '01');
    if(item.cava_largura != null)    _setVal('carac-largura-cava', item.cava_largura);
    if(item.dist_borda != null)      _setVal('carac-dist-borda-cava', item.dist_borda);
    if(item.friso_vert_qty != null)  _setVal('carac-friso-vert', item.friso_vert_qty);
    if(item.friso_horiz_qty != null) _setVal('carac-friso-horiz', item.friso_horiz_qty);
    if(item.friso_horiz_qty != null) _setVal('plan-friso-h-qty', item.friso_horiz_qty);
    // Modelo 23 (Boiserie)
    if(item.moldura_revestimento)         _setSelect('plan-moldura-rev', item.moldura_revestimento);
    if(item.moldura_qtd_largura != null)  _setVal('plan-moldura-larg-qty', item.moldura_qtd_largura);
    if(item.moldura_qtd_altura != null)   _setVal('plan-moldura-alt-qty', item.moldura_qtd_altura);
    if(item.moldura_tipo != null)         _setVal('plan-moldura-tipo', item.moldura_tipo);
    if(item.moldura_dis1 != null)         _setVal('plan-moldura-dis1', item.moldura_dis1);
    if(item.moldura_dis2 != null)         _setVal('plan-moldura-dis2', item.moldura_dis2);
    if(item.moldura_dis3 != null)         _setVal('plan-moldura-dis3', item.moldura_dis3);

    var result = null;
    try {
      result = _calcularDadosPerfis(L, H, nFolhas, barraMM);
    } catch(e){
      console.error('[PROJETTA.pivotante.calcularPerfis] erro:', e);
      result = null;
    } finally {
      // ─── Restaurar valores do DOM ───
      Object.keys(_backup).forEach(function(id){
        var el = document.getElementById(id);
        if(el) el.value = _backup[id];
      });
    }

    if(!result || result.error){
      console.warn('[PROJETTA.pivotante.calcularPerfis]', result && result.error ? result.error : 'sem resultado');
      return [];
    }

    // ─── Converter cuts -> formato unificado ───
    return (result.cuts || []).map(function(c){
      var pesoKg = c.perf ? ((c.compMM/1000) * (c.perf.kg||0) * c.qty) : 0;
      return {
        codigo:      c.code,
        descricao:   c.desc,
        comp_mm:     c.compMM,
        qtd:         c.qty,
        secao:       c.secao,
        pintado:     !!c.pintado,
        lh:          c.lh,
        obs:         c.obs,
        bar_len_mm:  c.barLenMM,
        peso_kg:     pesoKg,
        _perf:       c.perf || null,
        _origem:     'porta_pivotante',
        _item_id:    item.id || null
      };
    });
  },

  // Helper: calcula usando dados atuais do DOM (sem item)
  _calcularViaDOM: function(){
    if(typeof _calcularDadosPerfis !== 'function') return [];
    var L = parseFloat((document.getElementById('largura')||{value:0}).value)||0;
    var H = parseFloat((document.getElementById('altura')||{value:0}).value)||0;
    var nFolhas = parseInt((document.getElementById('folhas-porta')||{value:1}).value)||1;
    var barraMM = (parseFloat((document.getElementById('pf-barra-m')||{value:6}).value)||6)*1000;
    if(L<=0 || H<=0) return [];
    try {
      var r = _calcularDadosPerfis(L, H, nFolhas, barraMM);
      if(!r || r.error) return [];
      return (r.cuts || []).map(function(c){
        return {
          codigo: c.code, descricao: c.desc, comp_mm: c.compMM, qtd: c.qty,
          secao: c.secao, pintado: !!c.pintado, lh: c.lh, obs: c.obs,
          bar_len_mm: c.barLenMM,
          peso_kg: c.perf ? (c.compMM/1000)*(c.perf.kg||0)*c.qty : 0,
          _perf: c.perf||null, _origem: 'porta_pivotante'
        };
      });
    } catch(e){ return []; }
  },

  // ─── ACESSÓRIOS (Etapa 3 — ainda fachada) ───
  calcularAcessorios: function(item){
    if(typeof window._pvtCalcularAcessorios === 'function'){
      return window._pvtCalcularAcessorios(item) || [];
    }
    return [];
  },

  // ─── CHAPAS (Etapa 4 — ainda fachada) ───
  calcularChapas: function(item){
    if(typeof window._pvtCalcularChapas === 'function'){
      return window._pvtCalcularChapas(item) || [];
    }
    return [];
  },

  // ─── CAMPOS VISÍVEIS POR MODELO ───
  camposVisiveis: function(modelo){
    var base = ['largura','altura','modelo','abertura','folhas',
                'cor_ext','cor_int','puxador',
                'fechadura_mecanica','fechadura_digital','cilindro'];
    var m = String(modelo||'');
    if(['01','06','16','22'].indexOf(m) >= 0) base.push('cava_largura','cava_cantoneira');
    if(m === '01') base.push('dist_borda');
    if(['06','16','22'].indexOf(m) >= 0) base.push('friso_qtd','friso_espessura');
    if(m === '23') base.push('moldura_qtd_largura','moldura_qtd_altura','moldura_dist_borda','moldura_revestimento');
    return base;
  }
};

console.log('[PROJETTA.pivotante] módulo carregado — calcularPerfis() IMPLEMENTADO');
