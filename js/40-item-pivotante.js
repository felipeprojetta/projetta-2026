/**
 * 40-item-pivotante.js
 * PROJETTA.pivotante — FACHADA ÚNICA da PORTA PIVOTANTE
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Alterar codigo de pivotante so com autorizacao EXPLICITA:
 *     "vamos mexer na porta pivotante"
 *
 * ESTADO:
 *   [x] calcularPerfis(item)      — Etapa 2 (Felipe autorizou)
 *   [x] calcularAcessorios(item)  — Etapa 3 (Felipe autorizou)
 *   [ ] calcularChapas(item)      — Etapa 4 pendente
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

  // ═══════════════════════════════════════════════════════════════
  // INJEÇÃO DE DADOS DO ITEM NO DOM (backup + restore)
  // Usada por calcularPerfis E calcularAcessorios
  // ═══════════════════════════════════════════════════════════════
  _injetarNoDOM: function(item){
    var _backup = {};
    var _set = function(id, val){
      if(val === undefined || val === null) return;
      var el = document.getElementById(id);
      if(el){ _backup[id] = el.value; el.value = String(val); }
    };
    _set('largura', item.largura);
    _set('altura',  item.altura);
    _set('folhas-porta', parseInt(item.folhas)||1);
    _set('qtd-portas',   item.qtd || 1);
    _set('carac-modelo', item.modelo || '01');
    _set('plan-modelo',  item.modelo || '01');
    if(item.cava_largura != null)    _set('carac-largura-cava', item.cava_largura);
    if(item.dist_borda != null)      _set('carac-dist-borda-cava', item.dist_borda);
    if(item.friso_vert_qty != null)  _set('carac-friso-vert', item.friso_vert_qty);
    if(item.friso_horiz_qty != null){
      _set('carac-friso-horiz', item.friso_horiz_qty);
      _set('plan-friso-h-qty', item.friso_horiz_qty);
    }
    // Campos de acessórios/fechadura/puxador
    if(item.fech_mecanica != null)     _set('carac-fech-mec', item.fech_mecanica);
    if(item.fechadura_mecanica != null) _set('carac-fech-mec', item.fechadura_mecanica);
    if(item.fech_digital != null)      _set('carac-fech-dig', item.fech_digital);
    if(item.fechadura_digital != null)  _set('carac-fech-dig', item.fechadura_digital);
    if(item.cilindro != null)          _set('carac-cilindro', item.cilindro);
    if(item.puxador != null)           _set('carac-puxador', item.puxador);
    if(item.pux_tam != null)           _set('carac-pux-tam', item.pux_tam);
    if(item.puxador_tamanho != null)    _set('carac-pux-tam', item.puxador_tamanho);
    // Modelo 23 (Boiserie) — Felipe 28/04: card grava nomes curtos (moldura_rev,
    //   moldura_larg_qty, moldura_alt_qty), antes lia nomes longos por engano.
    //   Aceita ambos (curto preferencial) para compat com itens antigos.
    var _mrv = item.moldura_rev      || item.moldura_revestimento;
    var _mlq = (item.moldura_larg_qty != null ? item.moldura_larg_qty : item.moldura_qtd_largura);
    var _maq = (item.moldura_alt_qty  != null ? item.moldura_alt_qty  : item.moldura_qtd_altura);
    if(_mrv)                       _set('plan-moldura-rev', _mrv);
    if(_mlq != null)               _set('plan-moldura-larg-qty', _mlq);
    if(_maq != null)               _set('plan-moldura-alt-qty', _maq);
    if(item.moldura_tipo != null)  _set('plan-moldura-tipo', item.moldura_tipo);
    if(item.moldura_dis1 != null)  _set('plan-moldura-dis1', item.moldura_dis1);
    if(item.moldura_dis2 != null)  _set('plan-moldura-dis2', item.moldura_dis2);
    if(item.moldura_dis3 != null)  _set('plan-moldura-dis3', item.moldura_dis3);

    // ═══ ISOLAMENTO DE ITENS (Felipe 24/04) ═══════════════════════════════
    // Garantia estrita de que NENHUM outro item (fixo, revestimento, multi-porta)
    // vaze no cálculo desta porta pivotante. Felipe: "nao quero nada misturado".
    //  - Desliga tem-fixo (impede _calcFixosCompleto de calcular fixos no DOM)
    //  - Zera _mpItens e _orcItens (impede loops multi-porta e rev-only)
    var _tfEl = document.getElementById('tem-fixo');
    if(_tfEl){ _backup['_chk:tem-fixo'] = _tfEl.checked; _tfEl.checked = false; }
    _backup['_var:_mpItens']  = window._mpItens;   window._mpItens  = [];
    _backup['_var:_orcItens'] = window._orcItens;  window._orcItens = [];

    return _backup;
  },

  _restaurarDOM: function(backup){
    Object.keys(backup||{}).forEach(function(id){
      // Checkbox (ISOLAMENTO — Felipe 24/04)
      if(id.indexOf('_chk:') === 0){
        var elC = document.getElementById(id.slice(5));
        if(elC) elC.checked = backup[id];
        return;
      }
      // Variável global
      if(id === '_var:_mpItens'){  window._mpItens  = backup[id]; return; }
      if(id === '_var:_orcItens'){ window._orcItens = backup[id]; return; }
      // Input normal
      var el = document.getElementById(id);
      if(el) el.value = backup[id];
    });
  },

  // ═══════════════════════════════════════════════════════════════
  // PERFIS (Etapa 2)
  // ═══════════════════════════════════════════════════════════════
  calcularPerfis: function(item){
    if(!item) return this._calcularPerfisViaDOM();
    var tipo = (item.tipo||'').toLowerCase();
    if(tipo !== 'porta_pivotante' && tipo !== 'pivotante') return [];
    if(typeof _calcularDadosPerfis !== 'function') return [];

    var L = parseFloat(item.largura) || 0;
    var H = parseFloat(item.altura) || 0;
    var nFolhas = parseInt(item.folhas) || 1;
    var barraMM = parseFloat(item.barra_mm) || 6000;
    if(L <= 0 || H <= 0) return [];

    var backup = this._injetarNoDOM(item);
    var result = null;
    try { result = _calcularDadosPerfis(L, H, nFolhas, barraMM); }
    catch(e){ console.error('[pvt.calcularPerfis] erro:', e); }
    finally { this._restaurarDOM(backup); }

    if(!result || result.error) return [];
    return (result.cuts || []).map(function(c){
      var pesoKg = c.perf ? ((c.compMM/1000) * (c.perf.kg||0) * c.qty) : 0;
      return {
        codigo: c.code, descricao: c.desc, comp_mm: c.compMM, qtd: c.qty,
        secao: c.secao, pintado: !!c.pintado, lh: c.lh, obs: c.obs,
        bar_len_mm: c.barLenMM, peso_kg: pesoKg,
        _perf: c.perf || null, _origem: 'porta_pivotante', _item_id: item.id || null
      };
    });
  },

  _calcularPerfisViaDOM: function(){
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

  // ═══════════════════════════════════════════════════════════════
  // ACESSÓRIOS (Etapa 3 — Felipe autorizou 24/04)
  // Delega a _calcAcessoriosOS (definida em 17-os_acessorios.js)
  // via injeção DOM — mesma estratégia de calcularPerfis.
  //
  // Acessórios da porta pivotante incluem:
  //   FABRICAÇÃO: Fechadura KESO, Roseta, Cilindro (KESO/UDINESE),
  //     Puxador externo, Parafuso+Bucha pivô (12×nFolhas),
  //     Fita veda frestas escovinha, Veda porta (PA-VEDxxxx),
  //     Q-LON 48800/48700, Lã de Rocha, EPS Placa 50mm,
  //     EPS Canaleta (115/125/135/165 conforme sistema+modelo),
  //     DOWSIL 995, Fita DFix 12mm, Fita DFix 19mm.
  //   OBRA: Fecho unha (2 folhas), Push & Go (H>4m + 2f),
  //     Bucha+Parafuso portal, Contra testa, Caixeta, Primer,
  //     Espuma poliuretano, High Tack, Fechadura digital
  //     (TEDEE/EMTECO/PHILIPS/NUKI conforme seleção).
  // ═══════════════════════════════════════════════════════════════
  calcularAcessorios: function(item){
    if(!item) return this._calcularAcessoriosViaDOM();
    var tipo = (item.tipo||'').toLowerCase();
    if(tipo !== 'porta_pivotante' && tipo !== 'pivotante') return [];
    if(typeof _calcAcessoriosOS !== 'function') return [];
    if(typeof _calcularDadosPerfis !== 'function') return [];

    var L = parseFloat(item.largura)||0;
    var H = parseFloat(item.altura)||0;
    var nFolhas = parseInt(item.folhas)||1;
    if(L<=0 || H<=0) return [];

    var sis = H >= 4000 ? 'PA007' : 'PA006';
    if(item.sis) sis = item.sis;

    var backup = this._injetarNoDOM(item);
    var d = null, rows = [];
    try {
      d = _calcularDadosPerfis(L, H, nFolhas, 6000);
      rows = _calcAcessoriosOS(d, nFolhas, sis) || [];
    } catch(e){
      console.error('[pvt.calcularAcessorios] erro:', e);
      rows = [];
    } finally {
      this._restaurarDOM(backup);
    }

    // ISOLAMENTO: garantia extra — descartar qualquer linha que tenha vazado de FIXO
    return (rows||[])
      .filter(function(r){ return (r.grp || '') !== 'FIXO'; })
      .map(function(r){
        return {
          codigo:     r.code,
          descricao:  r.desc,
          qtd:        r.qty,
          unidade:    'un',
          preco_unit: r.preco || 0,
          aplicacao:  r.apl,
          grupo:      r.grp || '',
          obs:        r.obs || '',
          _origem:    'porta_pivotante',
          _item_id:   item.id || null
        };
      });
  },

  _calcularAcessoriosViaDOM: function(){
    if(typeof _calcAcessoriosOS !== 'function') return [];
    if(typeof _calcularDadosPerfis !== 'function') return [];
    var L = parseFloat((document.getElementById('largura')||{value:0}).value)||0;
    var H = parseFloat((document.getElementById('altura')||{value:0}).value)||0;
    var nFolhas = parseInt((document.getElementById('folhas-porta')||{value:1}).value)||1;
    if(L<=0 || H<=0) return [];
    var sis = H >= 4000 ? 'PA007' : 'PA006';
    try {
      var d = _calcularDadosPerfis(L, H, nFolhas, 6000);
      var rows = _calcAcessoriosOS(d, nFolhas, sis) || [];
      return (rows||[])
        .filter(function(r){ return (r.grp || '') !== 'FIXO'; })
        .map(function(r){
          return {
            codigo: r.code, descricao: r.desc, qtd: r.qty, unidade: 'un',
            preco_unit: r.preco||0, aplicacao: r.apl, grupo: r.grp||'', obs: r.obs||'',
            _origem: 'porta_pivotante'
          };
        });
    } catch(e){ return []; }
  },

  // ═══════════════════════════════════════════════════════════════
  // CHAPAS (Etapa 4 — ainda fachada)
  // ═══════════════════════════════════════════════════════════════
  /**
   * Chapas da PORTA PIVOTANTE (Etapa 4 — Felipe 24/04).
   * Delega a aprovPieces (05-aproveitamento_chapas.js) via injeção DOM
   * com ISOLAMENTO ESTRITO (mesmo padrão de calcularPerfis/calcularAcessorios):
   *  - Desliga tem-fixo
   *  - Zera _mpItens, _orcItens
   *  - Restaura tudo ao final
   *
   * Retorna lista de peças de chapa ACM 4mm da porta (frente+verso).
   * Cada peça: {label, w, h, qtd, material, cor, _origem, _item_id}
   */
  calcularChapas: function(item){
    if(!item) return this._calcularChapasViaDOM();
    var tipo = (item.tipo||'').toLowerCase();
    if(tipo !== 'porta_pivotante' && tipo !== 'pivotante') return [];
    if(typeof aprovPieces !== 'function'){
      console.warn('[pvt.calcularChapas] aprovPieces indisponivel');
      return [];
    }

    var L = parseFloat(item.largura) || 0;
    var A = parseFloat(item.altura)  || 0;
    var fol = parseInt(item.folhas) || 1;
    if(L <= 0 || A <= 0) return [];

    // Normalizar modelo: 23 -> 23acm | 23alu (conforme revestimento da moldura)
    var mod = String(item.modelo || '01');
    if(mod === '23'){
      mod = (item.moldura_revestimento === 'MACICO' || item.moldura_revestimento === 'ALU')
              ? '23alu' : '23acm';
    }

    var backup = this._injetarNoDOM(item);
    var pieces = [];
    try {
      pieces = aprovPieces(L, A, fol, mod) || [];
    } catch(e){
      console.error('[pvt.calcularChapas] erro:', e);
      pieces = [];
    } finally {
      this._restaurarDOM(backup);
    }

    var qtd = parseInt(item.qtd) || 1;
    return pieces.map(function(p){
      return {
        label:    p.label,
        w:        Math.round(p.w),
        h:        Math.round(p.h),
        qtd:      (p.qty || 1) * qtd,
        material: 'ACM_4MM',
        cor:      item.cor_ext || null,
        _origem:  'porta_pivotante',
        _item_id: item.id || null,
        _modelo:  mod
      };
    });
  },

  _calcularChapasViaDOM: function(){
    if(typeof aprovPieces !== 'function') return [];
    var L = parseFloat((document.getElementById('largura')||{value:0}).value) || 0;
    var A = parseFloat((document.getElementById('altura') ||{value:0}).value) || 0;
    var fol = parseInt((document.getElementById('folhas-porta')||{value:1}).value) || 1;
    var mod = (document.getElementById('carac-modelo')||{value:'01'}).value || '01';
    if(L <= 0 || A <= 0) return [];
    try {
      var pieces = aprovPieces(L, A, fol, mod) || [];
      return pieces.map(function(p){
        return {
          label: p.label, w: Math.round(p.w), h: Math.round(p.h),
          qtd: p.qty || 1, material:'ACM_4MM', _origem:'porta_pivotante'
        };
      });
    } catch(e){ return []; }
  },

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

console.log('[PROJETTA.pivotante] módulo carregado — calcularPerfis + calcularAcessorios IMPLEMENTADOS');
