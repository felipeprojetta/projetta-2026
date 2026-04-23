/**
 * 43-item-revestimento.js
 * PROJETTA.revestimento — FACHADA ÚNICA do REVESTIMENTO
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Código do REVESTIMENTO só muda quando Felipe disser EXPLICITAMENTE:
 *     "vamos mexer no revestimento"
 *
 * HOJE (Etapa 2 Perfis):
 *   calcularPerfis(item) — IMPLEMENTADA (Felipe autorizou 24/04).
 *   Baseada em crmItemRevCalc (10-crm.js) — extrai só a parte de PERFIS
 *   (tubos de fixação das ripas + estrutura de alumínio).
 *   Não entra chapa/fita/silicone aqui — vão na Etapa 3/4.
 *
 *   calcularAcessorios e calcularChapas ainda são fachada.
 *
 * TIPOS SUPORTADOS:
 *   CHAPA: revestimento liso (sem tubos de fixação; só estrutura se rev_estrutura=SIM)
 *   RIPADO: tiras de 98mm + tubos PA-51X12X1.58 (500mm) por trás de cada ripa
 *
 * FÓRMULAS (RIPADO):
 *   nRipas = ceil(L / 98)
 *   nTubosPorRipa = max(1, ceil(A / 1000))
 *   totTubosFix = nTubosPorRipa × nRipas × Q
 *   → PA-51X12X1.58 × 500mm × totTubosFix
 *
 * FÓRMULAS (ESTRUTURA DE ALUMÍNIO, se rev_estrutura='SIM'):
 *   RIPADO:
 *     nMontantes = max(2, ceil(L / 270))
 *     Montantes: rev_tubo × A mm × (nMontantes × Q)
 *     Travessas: rev_tubo × L mm × (2 × Q)
 *   CHAPA:
 *     Perímetro: rev_tubo × L mm × (2 × Q)   + rev_tubo × A mm × (2 × Q)
 *     Divisões:  nDiv = max(0, ceil(L/500)-1) → rev_tubo × A mm × (nDiv × Q)
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

  /**
   * Calcula a lista de perfis de UM item de revestimento.
   * @param {Object} item - {tipo, largura, altura, qtd, rev_tipo, rev_estrutura, rev_tubo, id}
   * @returns {Array} lista de perfis no formato unificado
   */
  calcularPerfis: function(item){
    if(!item) return [];
    var tipo = (item.tipo||'').toLowerCase();
    if(tipo !== 'revestimento') return [];

    var L = parseFloat(item.largura) || 0;
    var A = parseFloat(item.altura) || 0;
    var Q = parseInt(item.qtd) || 1;
    if(L <= 0 || A <= 0) return [];

    var revTipo      = String(item.rev_tipo || 'CHAPA').toUpperCase();
    var revEstrutura = String(item.rev_estrutura || 'NAO').toUpperCase();
    var revTubo      = item.rev_tubo || 'PA-51X12X1.58';

    // Helper: busca perfil no PERFIS_DB pra calcular peso
    var _getPerf = function(code){
      if(typeof PERFIS_DB === 'undefined' || !PERFIS_DB) return null;
      for(var i=0; i<PERFIS_DB.length; i++){
        if(PERFIS_DB[i].c === code) return PERFIS_DB[i];
      }
      return null;
    };

    // Helper: adiciona um corte na lista de saída
    var out = [];
    var _push = function(codigo, descricao, compMM, qtd, lh){
      if(qtd <= 0 || compMM <= 0) return;
      var perf = _getPerf(codigo);
      var pesoKg = perf ? (compMM/1000) * (perf.kg||0) * qtd : 0;
      out.push({
        codigo:      codigo,
        descricao:   descricao,
        comp_mm:     Math.round(compMM),
        qtd:         qtd,
        secao:       'REVESTIMENTO',
        pintado:     false,
        lh:          lh || '90/90 L',
        obs:         'REV ' + revTipo,
        bar_len_mm:  6000,
        peso_kg:     pesoKg,
        _perf:       perf,
        _origem:     'revestimento',
        _item_id:    item.id || null
      });
    };

    // ─── RIPADO: tubos de fixação das ripas (PA-51X12X1.58 × 500mm) ───
    if(revTipo === 'RIPADO'){
      var nRipas = Math.ceil(L / 98);
      var totRipas = nRipas * Q;
      var nTubosPorRipa = Math.max(1, Math.ceil(A / 1000));
      var totTubosFix = nTubosPorRipa * totRipas;
      _push('PA-51X12X1.58',
            'FIXACAO RIPAS (' + nTubosPorRipa + '/ripa × ' + totRipas + ' ripas)',
            500, totTubosFix, '90/90 L');
    }

    // ─── ESTRUTURA DE ALUMÍNIO (opcional) ───
    if(revEstrutura === 'SIM'){
      if(revTipo === 'RIPADO'){
        // Montantes verticais a cada ~270mm + 2 travessas (topo + base)
        var nMontantes = Math.max(2, Math.ceil(L / 270));
        _push(revTubo, 'MONTANTE VERT REV (' + nMontantes + ' un)',
              A, nMontantes * Q, '90/90 A');
        _push(revTubo, 'TRAVESSA TOPO/BASE REV',
              L, 2 * Q, '90/90 L');
      } else {
        // CHAPA: perímetro + divisões verticais a cada 500mm
        _push(revTubo, 'PERIM HORIZ REV (topo/base)',
              L, 2 * Q, '90/90 L');
        _push(revTubo, 'PERIM VERT REV (lados)',
              A, 2 * Q, '90/90 A');
        var nDiv = Math.max(0, Math.ceil(L / 500) - 1);
        if(nDiv > 0){
          _push(revTubo, 'DIVISAO VERT REV (' + nDiv + ' un)',
                A, nDiv * Q, '90/90 A');
        }
      }
    }

    return out;
  },

  // ─── ACESSÓRIOS (Etapa 3 — ainda fachada) ───
  calcularAcessorios: function(item){
    if(typeof window._revCalcularAcessorios === 'function'){
      return window._revCalcularAcessorios(item) || [];
    }
    return [];
  },

  // ─── CHAPAS (Etapa 4 — ainda fachada) ───
  calcularChapas: function(item){
    if(typeof window._revCalcularChapas === 'function'){
      return window._revCalcularChapas(item) || [];
    }
    return [];
  },

  // ─── CAMPOS VISÍVEIS NA UI ───
  camposVisiveis: function(cfg){
    cfg = cfg || {};
    var base = ['largura','altura','rev_tipo','cor_ext','cor_int'];
    if(cfg.rev_tipo === 'RIPADO'){
      base.push('rev_estrutura','rev_tubo','rev_largura_ripa','rev_dist_ripa');
    }
    if(cfg.rev_tipo === 'CHAPA'){
      base.push('rev_lados');
      if(cfg.rev_estrutura === 'SIM') base.push('rev_tubo');
    }
    return base;
  }
};

console.log('[PROJETTA.revestimento] módulo carregado — calcularPerfis() IMPLEMENTADO');
