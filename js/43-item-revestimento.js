/**
 * 43-item-revestimento.js
 * PROJETTA.revestimento — FACHADA ÚNICA do REVESTIMENTO
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Alterar codigo do REVESTIMENTO so com autorizacao EXPLICITA:
 *     "vamos mexer no revestimento"
 *
 * ESTADO:
 *   [x] calcularPerfis(item)     — lógica autocontida (Etapa 2)
 *   [x] calcularAcessorios(item) — lógica autocontida (Etapa 3 — Felipe 24/04)
 *   [ ] calcularChapas(item)     — Etapa 4 pendente (chapas ACM, chapa fundo, ripas, etc)
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

  // ═══════════════════════════════════════════════════════════════
  // PERFIS (Etapa 2)
  // ═══════════════════════════════════════════════════════════════
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

    var _getPerf = function(code){
      if(typeof PERFIS_DB === 'undefined' || !PERFIS_DB) return null;
      for(var i=0; i<PERFIS_DB.length; i++){
        if(PERFIS_DB[i].c === code) return PERFIS_DB[i];
      }
      return null;
    };
    var out = [];
    var _push = function(codigo, descricao, compMM, qtd, lh){
      if(qtd <= 0 || compMM <= 0) return;
      var perf = _getPerf(codigo);
      var pesoKg = perf ? (compMM/1000) * (perf.kg||0) * qtd : 0;
      out.push({
        codigo: codigo, descricao: descricao, comp_mm: Math.round(compMM),
        qtd: qtd, secao: 'REVESTIMENTO', pintado: false,
        lh: lh || '90/90 L', obs: 'REV ' + revTipo, bar_len_mm: 6000,
        peso_kg: pesoKg, _perf: perf, _origem: 'revestimento',
        _item_id: item.id || null
      });
    };

    if(revTipo === 'RIPADO'){
      var nRipas = Math.ceil(L / 98);
      var totRipas = nRipas * Q;
      var nTubosPorRipa = Math.max(1, Math.ceil(A / 1000));
      var totTubosFix = nTubosPorRipa * totRipas;
      _push('PA-51X12X1.58',
            'FIXACAO RIPAS ('+nTubosPorRipa+'/ripa × '+totRipas+' ripas)',
            500, totTubosFix, '90/90 L');
    }

    if(revEstrutura === 'SIM'){
      if(revTipo === 'RIPADO'){
        var nMontantes = Math.max(2, Math.ceil(L / 270));
        _push(revTubo, 'MONTANTE VERT REV ('+nMontantes+' un)', A, nMontantes * Q, '90/90 A');
        _push(revTubo, 'TRAVESSA TOPO/BASE REV', L, 2 * Q, '90/90 L');
      } else {
        _push(revTubo, 'PERIM HORIZ REV (topo/base)', L, 2 * Q, '90/90 L');
        _push(revTubo, 'PERIM VERT REV (lados)', A, 2 * Q, '90/90 A');
        var nDiv = Math.max(0, Math.ceil(L / 500) - 1);
        if(nDiv > 0) _push(revTubo, 'DIVISAO VERT REV ('+nDiv+' un)', A, nDiv * Q, '90/90 A');
      }
    }

    return out;
  },

  // ═══════════════════════════════════════════════════════════════
  // ACESSÓRIOS (Etapa 3 — Felipe autorizou 24/04)
  // Lógica autocontida — extraída de crmItemRevCalc (10-crm.js)
  //
  // Regras (aplicáveis a CHAPA e RIPADO):
  //   - Área total = L × A × Q / 1e6 (em m²)
  //   - Fita DFIX 12mm  (PA-FITDF 12X20X1.0): 12m/m² → rolos de 20m
  //   - Silicone Dow Corning 995 PRIME (PA-DOWSIL 995): 25ml/m² → tubos de 300ml
  //
  // Estrutura de alumínio NÃO tem acessórios extras aqui — se houver,
  // fita/dowsil do perímetro já estão inclusos (a área total é área de
  // revestimento, não depende da estrutura).
  // ═══════════════════════════════════════════════════════════════
  calcularAcessorios: function(item){
    if(!item) return [];
    var tipo = (item.tipo||'').toLowerCase();
    if(tipo !== 'revestimento') return [];

    var L = parseFloat(item.largura) || 0;
    var A = parseFloat(item.altura) || 0;
    var Q = parseInt(item.qtd) || 1;
    if(L <= 0 || A <= 0) return [];

    var revTipo = String(item.rev_tipo || 'CHAPA').toUpperCase();
    var m2 = (L * A * Q) / 1e6;

    // Fita DFIX 12mm: 12m/m²
    var fitaMetros = m2 * 12;
    var rolosFita = Math.ceil(fitaMetros / 20);

    // Silicone Dow Corning 995: 25ml/m², tubos de 300ml
    var silML = m2 * 25;
    var silTubos = Math.ceil(silML / 300);

    var out = [];
    if(rolosFita > 0){
      out.push({
        codigo: 'PA-FITDF 12X20X1.0',
        descricao: 'Fita DFix 1,0×12mm — rev '+revTipo+': '+fitaMetros.toFixed(1)+'m ÷ 20m/rolo',
        qtd: rolosFita, unidade: 'rolo', preco_unit: 0,
        aplicacao: 'FAB', grupo: 'FITA DUPLA FACE', obs: 'FITA REV',
        _origem: 'revestimento', _item_id: item.id || null
      });
    }
    if(silTubos > 0){
      out.push({
        codigo: 'PA-DOWSIL 995',
        descricao: 'Silicone Dow Corning 995 PRIME — rev '+revTipo+': '+silML.toFixed(0)+'ml ÷ 300ml/tubo',
        qtd: silTubos, unidade: 'tubo', preco_unit: 0,
        aplicacao: 'FAB', grupo: 'SELANTES', obs: 'DOWSIL REV',
        _origem: 'revestimento', _item_id: item.id || null
      });
    }
    return out;
  },

  // ═══════════════════════════════════════════════════════════════
  // CHAPAS (Etapa 4 — ainda fachada)
  // ═══════════════════════════════════════════════════════════════
  /**
   * Chapas do REVESTIMENTO (Etapa 4 — Felipe 24/04).
   * Lógica AUTOCONTIDA. Zero dependência de DOM ou outros módulos.
   *
   * CHAPA (liso):
   *   nInt = floor(L / 1490)
   *   sobra = L - (nInt × 1490)
   *   Se sobra > 5mm: +1 peça pedaço × A
   *   Total = (nInt + pedaco?) × Q peças de ACM 4mm
   *
   * RIPADO:
   *   a) Chapa de FUNDO: mesma divisão do CHAPA liso
   *   b) Chapas pra produzir RIPAS:
   *      totRipas = ceil(L/98) × Q
   *      chapaAlt = 5000 (A<=4990) | 6000 (A<=5990) | 7000 (A<=6990)
   *      ripasPorChapa = 15 × floor(chapaAlt / A)
   *      nChapasRipa = ceil(totRipas / ripasPorChapa)
   */
  calcularChapas: function(item){
    if(!item || item.tipo !== 'revestimento') return [];
    var L = parseFloat(item.largura) || 0;
    var A = parseFloat(item.altura) || 0;
    var Q = parseInt(item.qtd) || 1;
    if(L <= 0 || A <= 0) return [];

    var revTipo = String(item.rev_tipo || 'CHAPA').toUpperCase();
    var cor     = item.cor_ext || item.cor_chapa || null;
    var mat     = item.material || 'ACM_4MM';
    var UTIL    = 1490; // largura util da chapa ACM

    var out = [];
    var _pushChapa = function(label, w, h, qtd){
      if(w <= 0 || h <= 0 || qtd <= 0) return;
      out.push({
        label:      label,
        w:          Math.round(w),
        h:          Math.round(h),
        qtd:        qtd,
        material:   mat,
        cor:        cor,
        _origem:    'revestimento',
        _item_id:   item.id || null,
        _rev_tipo:  revTipo
      });
    };

    // ─── CHAPA (liso) ou FUNDO do RIPADO ───
    var nInt   = Math.floor(L / UTIL);
    var sobra  = L - (nInt * UTIL);
    var pedaco = sobra > 5 ? sobra : 0;

    var labelPrincipal = revTipo === 'RIPADO' ? 'CHAPA FUNDO REV' : 'CHAPA REV';
    if(nInt > 0)  _pushChapa(labelPrincipal,        UTIL,   A, nInt * Q);
    if(pedaco>0)  _pushChapa(labelPrincipal+' (pedaco)', pedaco, A, 1 * Q);

    // ─── RIPADO: chapas pra produzir as ripas ───
    if(revTipo === 'RIPADO'){
      var nRipas   = Math.ceil(L / 98);
      var totRipas = nRipas * Q;

      var chapaAlt = 0;
      if(A <= 4990)       chapaAlt = 5000;
      else if(A <= 5990)  chapaAlt = 6000;
      else if(A <= 6990)  chapaAlt = 7000;

      if(chapaAlt > 0){
        var ripasLarg     = Math.floor(UTIL / 98); // 15
        var ripasAlt      = Math.floor(chapaAlt / A);
        var ripasPorChapa = ripasLarg * ripasAlt;
        if(ripasPorChapa > 0){
          var nChapasRipa = Math.ceil(totRipas / ripasPorChapa);
          _pushChapa('CHAPA PRODUZIR RIPAS (1500x'+chapaAlt+')', 1500, chapaAlt, nChapasRipa);
        }
      }
    }

    return out;
  },

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

console.log('[PROJETTA.revestimento] módulo carregado — calcularPerfis + calcularAcessorios IMPLEMENTADOS (autocontidos)');
