/**
 * 42-item-fixo.js
 * PROJETTA.fixo — FACHADA ÚNICA do FIXO
 *
 * REGRA DE OURO (Felipe 24/04):
 *   Código do FIXO só pode ser alterado quando Felipe autorizar
 *   EXPLICITAMENTE:
 *     "vamos mexer no fixo"
 *   Fora disso, NÃO TOCAR em nada daqui.
 *
 * HOJE (Etapa 2 Perfis):
 *   calcularPerfis(item) está IMPLEMENTADA com LÓGICA AUTOCONTIDA.
 *   TODA a lógica de perfis do fixo vive aqui dentro — extraída de
 *   _calcFixosCompleto de 17-os_acessorios.js (Felipe 24/04).
 *
 *   calcularAcessorios (fita dupla face + dowsil) é ETAPA 3.
 *   calcularChapas (aprovFixoPieces) é ETAPA 4.
 *
 * PERFIS DO FIXO — explicação da lógica:
 *   Se item.tem_estrutura = false → SEM perfis (só chapa). Retorna [].
 *   Se item.tem_estrutura = true → calcula quadro de alumínio.
 *
 *   Sistema de perfis (depende da altura):
 *     PA006 (< 4000mm): PA-76X38X1.98, tubo 38.1mm
 *     PA007 (>= 4000mm): PA-101X51X2, tubo 50.8mm
 *
 *   Cortes:
 *     - PERF ALTURA:  2 pçs, comp = A - 2×TUBO
 *     - PERF LARGURA: 2 pçs, comp = L - 20 (folga 10+10)
 *     - TRAV HORIZ:   ceil(A/1000) pçs, comp = (L-20) - 2×TUBO
 *     - TRAV VERT:    max(0, ceil((L-20)/800) - 1) pçs, comp = A - 2×TUBO
 *                     + 2 pçs extras se modelo tiver cava
 *     - TUB CAVA (só se cava): 2 pçs, PA-38X38X1.58, comp = A_perf - 20
 *     - CANT CAVA (só se cava): 4 pçs, PA-CANT-30X30X2.0, comp = A_perf
 *
 *   Todos os cortes são multiplicados por item.qtd (quantidade de fixos iguais).
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

  /**
   * Calcula lista de perfis de UM fixo.
   * @param {Object} item - {tipo:'fixo', largura, altura, tem_estrutura, qtd, sis?, tem_cava?, seq?}
   * @returns {Array} lista de perfis no formato unificado
   */
  calcularPerfis: function(item){
    if(!item) return [];
    if(item.tipo !== 'fixo') return [];

    // ─── Parâmetros do item ───
    var L = parseFloat(item.largura) || 0;
    var A = parseFloat(item.altura)  || 0;
    var qtd = parseInt(item.qtd) || 1;
    var temEstr = (item.tem_estrutura === true || item.tem_estrutura === 'sim' || item.tem_estrutura === 'SIM');
    var temCava = (item.tem_cava === true || item.tem_cava === 'sim' || item.tem_cava === 'SIM');
    var seq = item.seq || 1;
    var fn = 'F' + seq;

    // Validação básica: fixo sem dimensão ou sem estrutura → não tem perfis
    if(!L || !A) return [];
    if(!temEstr) return [];

    // ─── Sistema: PA006 (< 4000) ou PA007 (>= 4000) ───
    // Pode ser sobrescrito por item.sis
    var sis = item.sis || (A >= 4000 ? 'PA007' : 'PA006');
    var COD_PERF = sis === 'PA006' ? 'PA-76X38X1.98' : 'PA-101X51X2';
    var TUBO     = sis === 'PA006' ? 38.1 : 50.8;
    var DESC     = Math.round(2 * TUBO);   // 76mm (PA006) ou 102mm (PA007)
    var FOLGA    = 20;                      // 10mm por lado

    // ─── Dimensões dos cortes ───
    var L_ext  = Math.round(L - FOLGA);     // largura c/ folga (frame externo)
    var A_perf = Math.round(A - DESC);      // altura por dentro topo+base
    var L_trav = Math.round(L_ext - DESC);  // trav horiz por dentro verticais

    // ─── Buscar kg/m em PERFIS_DB ───
    var getKgM = function(code){
      if(typeof PERFIS_DB === 'undefined') return 0;
      var base = code.replace(/-[678]M$/,'');
      for(var i=0; i<PERFIS_DB.length; i++){
        if(PERFIS_DB[i].c === code || PERFIS_DB[i].c === base){
          return PERFIS_DB[i].kg || 0;
        }
      }
      return 0;
    };
    var KG_M      = getKgM(COD_PERF);
    var KG_TUBCA  = getKgM('PA-38X38X1.58');
    var KG_CANTCA = getKgM('PA-CANT-30X30X2.0');

    // ─── MONTAR LISTA DE CORTES ───
    var cuts = [];

    // PERFIL ALTURA — 2 pçs por fixo
    cuts.push({
      code: COD_PERF, desc: 'PERF ALTURA — ' + fn + ' (' + A + '-' + DESC + ')',
      subcat: 'PERFIL ALTURA', compMM: A_perf, qty: 2 * qtd, kgM: KG_M,
      pintado: false, lh: '90/90 A', obs: fn
    });

    // PERFIL LARGURA — 2 pçs por fixo
    cuts.push({
      code: COD_PERF, desc: 'PERF LARGURA — ' + fn + ' (' + L + '-' + FOLGA + ')',
      subcat: 'PERFIL LARGURA', compMM: L_ext, qty: 2 * qtd, kgM: KG_M,
      pintado: false, lh: '90/90 L', obs: fn
    });

    // TRAV HORIZ — ceil(A/1000) pçs por fixo
    var qtdTravH = Math.ceil(A / 1000);
    if(qtdTravH > 0){
      cuts.push({
        code: COD_PERF, desc: 'TRAV HORIZ (' + qtdTravH + '×) — ' + fn + ' (' + L_ext + '-' + DESC + ')',
        subcat: 'TRAVESSA HORIZONTAL', compMM: L_trav, qty: qtdTravH * qtd, kgM: KG_M,
        pintado: false, lh: '90/90 L', obs: fn
      });
    }

    // TRAV VERT — max(0, ceil(L_ext/800) - 1) pçs (+2 se cava)
    var qtdTravV = Math.max(0, Math.ceil(L_ext / 800) - 1);
    if(temCava) qtdTravV += 2;
    if(qtdTravV > 0){
      cuts.push({
        code: COD_PERF,
        desc: 'TRAV VERT (' + qtdTravV + '×' + (temCava ? ' +cava' : '') + ') — ' + fn + ' (' + A + '-' + DESC + ')',
        subcat: 'TRAVESSA VERTICAL', compMM: A_perf, qty: qtdTravV * qtd, kgM: KG_M,
        pintado: false, lh: '90/90 A', obs: fn
      });
    }

    // CAVA — TUB CAVA (2 pçs) + CANT CAVA (4 pçs)
    if(temCava){
      var TUB_CA_FX  = Math.round(A_perf - 20);
      var CANT_CA_FX = A_perf;
      cuts.push({
        code: 'PA-38X38X1.58', desc: 'TUB CAVA — ' + fn,
        subcat: 'PERFIL ALTURA', compMM: TUB_CA_FX, qty: 2 * qtd, kgM: KG_TUBCA,
        pintado: false, lh: '90/90 A', obs: fn + ' BRUTO'
      });
      cuts.push({
        code: 'PA-CANT-30X30X2.0', desc: 'CANT CAVA — ' + fn,
        subcat: 'PERFIL ALTURA', compMM: CANT_CA_FX, qty: 4 * qtd, kgM: KG_CANTCA,
        pintado: true, lh: '90/90 A', obs: fn + ' BNF-TECNO'
      });
    }

    // ─── Converter pro formato unificado ───
    return cuts.map(function(c){
      return {
        codigo:      c.code,
        descricao:   c.desc,
        comp_mm:     c.compMM,
        qtd:         c.qty,
        secao:       'FIXO',
        subcat:      c.subcat,
        pintado:     c.pintado,
        lh:          c.lh,
        obs:         c.obs,
        bar_len_mm:  6000,
        peso_kg:     (c.compMM / 1000) * c.kgM * c.qty,
        _perf:       { c: c.code, kg: c.kgM },
        _origem:     'fixo',
        _item_id:    item.id || null,
        _sis:        sis
      };
    });
  },

  // ─── ACESSÓRIOS (Etapa 3 — ainda fachada) ───
  calcularAcessorios: function(item){
    if(typeof window._fxCalcularAcessorios === 'function'){
      return window._fxCalcularAcessorios(item) || [];
    }
    return [];
  },

  // ─── CHAPAS (Etapa 4 — ainda fachada) ───
  calcularChapas: function(item){
    if(typeof window._fxCalcularChapas === 'function'){
      return window._fxCalcularChapas(item) || [];
    }
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

console.log('[PROJETTA.fixo] módulo carregado — calcularPerfis() IMPLEMENTADO (lógica autocontida)');
