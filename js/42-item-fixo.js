/**
 * 42-item-fixo.js
 * PROJETTA.fixo — FACHADA ÚNICA do FIXO
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Alterar codigo do FIXO so com autorizacao EXPLICITA:
 *     "vamos mexer no fixo"
 *
 * ESTADO:
 *   [x] calcularPerfis(item)     — lógica autocontida (Etapa 2)
 *   [x] calcularAcessorios(item) — lógica autocontida (Etapa 3 — Felipe 24/04)
 *   [ ] calcularChapas(item)     — Etapa 4 pendente
 *
 * PERFIS DO FIXO: quadro de alumínio se item.tem_estrutura=true
 *   Sistema: PA006 (< 4000mm) ou PA007 (>= 4000mm)
 *   Cortes: PERF ALTURA (2), PERF LARGURA (2), TRAV HORIZ (ceil(A/1000)),
 *           TRAV VERT (max(0,ceil(L/800)-1)+2cava), TUB/CANT CAVA (se cava)
 *
 * ACESSÓRIOS DO FIXO (só fixo SUPERIOR, por perímetro da chapa):
 *   - Fita DFix 12mm (PA-FITDF 12X20X1.0) — rolos (20m/rolo)
 *   - Fita DFix 19mm (PA-FITDF 19X20X1.0) — rolos (20m/rolo)
 *   - Dowsil 995   (PA-DOWSIL 995 ESTR SH) — tubos (8m/tubo)
 *   Perímetro = 2×(L+A) × qtd × lados (chapa com folga +100mm)
 *   Fixos LATERAIS não têm acessórios.
 */
window.PROJETTA = window.PROJETTA || {};

window.PROJETTA.fixo = {
  meta: {
    tipo: 'fixo',
    label: 'Fixo',
    icon: '🔲',
    posicoes: ['LATERAL_DIREITO','LATERAL_ESQUERDO','BANDEIRA_SUPERIOR','SUPERIOR','LATERAL'],
    materiais: ['ACM','VIDRO_TEMPERADO','VIDRO_LAMINADO'],
    revestimentoLados: [1, 2]
  },

  // ═══════════════════════════════════════════════════════════════
  // PERFIS (Etapa 2 — lógica autocontida)
  // ═══════════════════════════════════════════════════════════════
  calcularPerfis: function(item){
    if(!item || item.tipo !== 'fixo') return [];
    var L = parseFloat(item.largura) || 0;
    var A = parseFloat(item.altura)  || 0;
    var qtd = parseInt(item.qtd) || 1;
    var temEstr = (item.tem_estrutura === true || item.tem_estrutura === 'sim' || item.tem_estrutura === 'SIM');
    var temCava = (item.tem_cava === true || item.tem_cava === 'sim' || item.tem_cava === 'SIM');
    var seq = item.seq || 1;
    var fn = 'F' + seq;
    if(!L || !A) return [];
    if(!temEstr) return [];

    var sis = item.sis || (A >= 4000 ? 'PA007' : 'PA006');
    var COD_PERF = sis === 'PA006' ? 'PA-76X38X1.98' : 'PA-101X51X2';
    var TUBO = sis === 'PA006' ? 38.1 : 50.8;
    var DESC = Math.round(2 * TUBO);
    var FOLGA = 20;
    var L_ext = Math.round(L - FOLGA);
    var A_perf = Math.round(A - DESC);
    var L_trav = Math.round(L_ext - DESC);

    var getKgM = function(code){
      if(typeof PERFIS_DB === 'undefined') return 0;
      var base = code.replace(/-[678]M$/,'');
      for(var i=0; i<PERFIS_DB.length; i++){
        if(PERFIS_DB[i].c === code || PERFIS_DB[i].c === base) return PERFIS_DB[i].kg || 0;
      }
      return 0;
    };
    var KG_M = getKgM(COD_PERF);
    var KG_TUBCA = getKgM('PA-38X38X1.58');
    var KG_CANTCA = getKgM('PA-CANT-30X30X2.0');

    var cuts = [];
    cuts.push({code:COD_PERF, desc:'PERF ALTURA — '+fn+' ('+A+'-'+DESC+')',
               subcat:'PERFIL ALTURA', compMM:A_perf, qty:2*qtd, kgM:KG_M,
               pintado:false, lh:'90/90 A', obs:fn});
    cuts.push({code:COD_PERF, desc:'PERF LARGURA — '+fn+' ('+L+'-'+FOLGA+')',
               subcat:'PERFIL LARGURA', compMM:L_ext, qty:2*qtd, kgM:KG_M,
               pintado:false, lh:'90/90 L', obs:fn});
    var qtdTravH = Math.ceil(A / 1000);
    if(qtdTravH > 0){
      cuts.push({code:COD_PERF, desc:'TRAV HORIZ ('+qtdTravH+'×) — '+fn+' ('+L_ext+'-'+DESC+')',
                 subcat:'TRAVESSA HORIZONTAL', compMM:L_trav, qty:qtdTravH*qtd, kgM:KG_M,
                 pintado:false, lh:'90/90 L', obs:fn});
    }
    var qtdTravV = Math.max(0, Math.ceil(L_ext / 800) - 1);
    if(temCava) qtdTravV += 2;
    if(qtdTravV > 0){
      cuts.push({code:COD_PERF,
                 desc:'TRAV VERT ('+qtdTravV+'×'+(temCava?' +cava':'')+') — '+fn+' ('+A+'-'+DESC+')',
                 subcat:'TRAVESSA VERTICAL', compMM:A_perf, qty:qtdTravV*qtd, kgM:KG_M,
                 pintado:false, lh:'90/90 A', obs:fn});
    }
    if(temCava){
      var TUB_CA_FX = Math.round(A_perf - 20);
      var CANT_CA_FX = A_perf;
      cuts.push({code:'PA-38X38X1.58', desc:'TUB CAVA — '+fn,
                 subcat:'PERFIL ALTURA', compMM:TUB_CA_FX, qty:2*qtd, kgM:KG_TUBCA,
                 pintado:false, lh:'90/90 A', obs:fn+' BRUTO'});
      cuts.push({code:'PA-CANT-30X30X2.0', desc:'CANT CAVA — '+fn,
                 subcat:'PERFIL ALTURA', compMM:CANT_CA_FX, qty:4*qtd, kgM:KG_CANTCA,
                 pintado:true, lh:'90/90 A', obs:fn+' BNF-TECNO'});
    }

    return cuts.map(function(c){
      return {
        codigo: c.code, descricao: c.desc, comp_mm: c.compMM, qtd: c.qty,
        secao: 'FIXO', subcat: c.subcat, pintado: c.pintado,
        lh: c.lh, obs: c.obs, bar_len_mm: 6000,
        peso_kg: (c.compMM/1000) * c.kgM * c.qty,
        _perf: {c:c.code, kg:c.kgM},
        _origem: 'fixo', _item_id: item.id||null, _sis: sis
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════
  // ACESSÓRIOS (Etapa 3 — Felipe autorizou 24/04)
  // Lógica autocontida — extraída de _calcFixosCompleto (17-os_acessorios.js)
  //
  // Regras:
  //   - Só fixo SUPERIOR tem fita/dowsil. LATERAL retorna [].
  //   - Perímetro = 2*(L+100 + A+100) × qtd × lados (mm)
  //     (+100mm em cada dimensão pra folga de corte da chapa)
  //   - Fita DFIX 12mm: ceil(perim/1000/20) rolos
  //   - Fita DFIX 19mm: ceil(perim/1000/20) rolos
  //   - Dowsil 995:     ceil(perim/1000/8)  tubos
  // ═══════════════════════════════════════════════════════════════
  calcularAcessorios: function(item){
    if(!item || item.tipo !== 'fixo') return [];
    var L = parseFloat(item.largura) || 0;
    var A = parseFloat(item.altura) || 0;
    var qtd = parseInt(item.qtd) || 1;
    var lados = parseInt(item.revestimento_lados || item.lados || 1) || 1;
    if(!L || !A) return [];

    // Normalizar posição do fixo: superior/bandeira → tem acessórios; lateral → não
    var posicao = String(item.posicao || item.posicao_fixo || item.tipo_fixo || 'SUPERIOR').toUpperCase();
    var eSuperior = (posicao.indexOf('SUPERIOR') >= 0 || posicao.indexOf('BANDEIRA') >= 0);
    if(!eSuperior) return [];

    // Perímetro da chapa (com folga +100mm em cada dimensão), por unidade × qtd × lados
    var wPc = L + 100;
    var hPc = A + 100;
    var perimMM = 2 * (wPc + hPc) * qtd * lados;

    var rolosFD12 = Math.ceil(perimMM / 1000 / 20);
    var rolosFD19 = Math.ceil(perimMM / 1000 / 20);
    var tubosDow  = Math.ceil(perimMM / 1000 / 8);

    var fn = 'F' + (item.seq || 1);
    var out = [];
    var _push = function(codigo, descricao, qtd, grupo, obs){
      if(qtd <= 0) return;
      out.push({
        codigo: codigo, descricao: descricao, qtd: qtd, unidade: 'un',
        preco_unit: 0, aplicacao: 'FAB', grupo: grupo, obs: obs,
        _origem: 'fixo', _item_id: item.id || null
      });
    };

    if(rolosFD12 > 0){
      _push('PA-FITDF 12X20X1.0',
            'Fita DFix 12mm — '+fn+' (perím '+(perimMM/1000).toFixed(1)+'m)',
            rolosFD12, 'FITA DUPLA FACE', 'FD12 FIXO');
    }
    if(rolosFD19 > 0){
      _push('PA-FITDF 19X20X1.0',
            'Fita DFix 19mm — '+fn+' (perím '+(perimMM/1000).toFixed(1)+'m)',
            rolosFD19, 'FITA DUPLA FACE', 'FD19 FIXO');
    }
    if(tubosDow > 0){
      _push('PA-DOWSIL 995 ESTR SH',
            'Dowsil 995 — '+fn+' (perím '+(perimMM/1000).toFixed(1)+'m ÷ 8m/tubo)',
            tubosDow, 'SELANTES', 'DOWSIL FIXO');
    }

    return out;
  },

  // ═══════════════════════════════════════════════════════════════
  // CHAPAS (Etapa 4 — ainda fachada)
  // ═══════════════════════════════════════════════════════════════
  /**
   * Chapas do FIXO (Etapa 4 — Felipe 24/04).
   * Delega a aprovFixoPieces (05-aproveitamento_chapas.js).
   *
   * IMPORTANTE: as tampas do fixo (TAMPA MAIOR, TAMPA BOR CAVA, FIT ACAB)
   * usam dimensões da PORTA como referência. Por isso o item do fixo
   * precisa trazer porta_largura/porta_altura/porta_modelo quando possível.
   * Se ausentes, cai em fallback (lê do DOM legado — porta atual no form).
   *
   * ISOLAMENTO: esta função NÃO lê _orcItens nem .fixo-blk. Opera
   * exclusivamente nos dados do item passado.
   */
  calcularChapas: function(item){
    if(!item || item.tipo !== 'fixo') return [];
    if(typeof aprovFixoPieces !== 'function'){
      console.warn('[fx.calcularChapas] aprovFixoPieces indisponivel');
      return [];
    }

    var L = parseFloat(item.largura) || 0;
    var A = parseFloat(item.altura)  || 0;
    var qtd = parseInt(item.qtd) || 1;
    var lados = parseInt(item.revestimento_lados || item.lados || 1) || 1;
    if(!L || !A) return [];

    // Posições LATERAL_DIR/ESQ → sem tampas compartilhadas com porta
    var posicao = String(item.posicao || item.posicao_fixo || 'SUPERIOR').toUpperCase();

    // Dimensões da porta referência (necessárias para TAMPA MAIOR e variantes)
    var Lporta = parseFloat(item.porta_largura) ||
                 parseFloat((document.getElementById('largura')||{value:0}).value) || 0;
    var Aporta = parseFloat(item.porta_altura) ||
                 parseFloat((document.getElementById('altura')||{value:0}).value) || 0;
    var mod    = item.porta_modelo ||
                 (document.getElementById('carac-modelo')||{value:'01'}).value || '01';
    if(mod === '23'){
      mod = (item.moldura_revestimento === 'MACICO' || item.moldura_revestimento === 'ALU')
              ? '23alu' : '23acm';
    }

    var pieces = [];
    try {
      pieces = aprovFixoPieces(Lporta, Aporta, L, A, lados, mod) || [];
    } catch(e){
      console.error('[fx.calcularChapas] erro:', e);
      return [];
    }

    // Multiplicar por qtd de fixos iguais + converter pro formato unificado
    return pieces.map(function(p){
      return {
        label:       p.label,
        w:           Math.round(p.w),
        h:           Math.round(p.h),
        qtd:         (p.qty || 1) * qtd,
        material:    item.tipo_material || 'ACM_4MM',
        cor:         item.cor_ext || null,
        _origem:     'fixo',
        _item_id:    item.id || null,
        _posicao:    posicao,
        _porta_ref:  { L: Lporta, A: Aporta, mod: mod }
      };
    });
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

console.log('[PROJETTA.fixo] módulo carregado — calcularPerfis + calcularAcessorios IMPLEMENTADOS (autocontidos)');
