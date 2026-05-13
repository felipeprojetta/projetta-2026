/* 38-chapas-porta-externa.js — Motor declarativo de geração de peças
 * de chapa para Porta Externa.
 *
 * Felipe (sessao 2026-09 — REESCRITA): substitui versão anterior que
 * tinha discrepâncias com a planilha. Cada peça é definida numa
 * TABELA declarativa, com fórmulas vindas DIRETO do Excel
 * PRECIFICAÇÃO_01_04_2026.xlsx.
 *
 * Modelos suportados (1 e 2 folhas):
 *   01 — Cava
 *   02 — Cava + Friso Vertical (qtdFrisos variável)
 *   03 — Cava + Friso Horizontal
 *   04 — Cava + Friso Horizontal + Friso Vertical
 *   06 — Cava + N Frisos Horizontais (qtdFrisos variável, divide tampa)
 *   08 — Cava + Ripado
 *   10 — Puxador Externo Lisa
 *   11 — Puxador Externo + Friso Vertical
 *   15 — Puxador Externo + Ripado
 */
const ChapasPortaExterna = (() => {
  'use strict';

  // ------------------------------------------------------------------
  // CONSTANTES POR FAMÍLIA (76 vs 101)
  // ------------------------------------------------------------------
  const VARS_FAM_DEFAULT = {
    '76':  { ESPPIV:28, TRANSPIV:8, FGLD:10, FGLE:10, FGA:10, TUBLPORTAL:38,    TUBLPORTA:38,    VEDPT:35 },
    '101': { ESPPIV:28, TRANSPIV:8, FGLD:10, FGLE:10, FGA:10, TUBLPORTAL:51,    TUBLPORTA:102,   VEDPT:35 },
  };
  const VARS_CHAPAS_DEFAULT = {
    REF:            20,
    PORTAL_LD:      171.5,
    PORTAL_LE:      171.5,
    U_LARG_1F:      90,
    U_LARG_2F:      128,
    U_LARG_CENTRAL: 128,
  };

  function getVarsFam() {
    try {
      if (window.Storage && window.Storage.scope) {
        const salvas = window.Storage.scope('cadastros').get('regras_variaveis_porta_externa');
        if (salvas && salvas['76'] && salvas['101']) {
          return {
            '76':  Object.assign({}, VARS_FAM_DEFAULT['76'],  salvas['76']),
            '101': Object.assign({}, VARS_FAM_DEFAULT['101'], salvas['101']),
          };
        }
      }
    } catch (e) {}
    return VARS_FAM_DEFAULT;
  }
  function getVarsChapas() {
    try {
      if (window.Storage && window.Storage.scope) {
        const salvas = window.Storage.scope('cadastros').get('regras_variaveis_chapas');
        if (salvas && typeof salvas === 'object') return Object.assign({}, VARS_CHAPAS_DEFAULT, salvas);
      }
    } catch (e) {}
    return Object.assign({}, VARS_CHAPAS_DEFAULT);
  }

  // ------------------------------------------------------------------
  // QUADRO — fórmulas direto da planilha (G2/G3/G4)
  // ------------------------------------------------------------------
  function obterFamilia(item) {
    const A = parseFloat(String(item.altura || '').replace(',', '.')) || 0;
    return (A > 4000) ? '101' : '76';
  }

  function calcularQuadro(item) {
    const L = parseFloat(String(item.largura || '').replace(',', '.')) || 0;
    const H = parseFloat(String(item.altura  || '').replace(',', '.')) || 0;
    const nFolhas = Number(item.nFolhas) || 1;
    if (!L || !H) return null;

    const familia = obterFamilia(item);
    const v = getVarsFam()[familia];
    const vc = getVarsChapas();

    // Felipe sessao 13: folgas EDITAVEIS POR ITEM. Default global vem
    // de getVarsFam() (regras_variaveis_porta_externa, 10mm padrao).
    // Override por item: item.fglDir / item.fglEsq / item.fgSup.
    // Se o usuario preencheu no form, usa o valor do item; senao, usa
    // o default global. Numero invalido/0 tambem cai pro global.
    const _toNum = (raw, fallback) => {
      if (raw === '' || raw === null || raw === undefined) return fallback;
      const n = Number(String(raw).replace(',', '.'));
      return (Number.isFinite(n) && n >= 0) ? n : fallback;
    };
    const FGLD_eff = _toNum(item.fglDir, v.FGLD);
    const FGLE_eff = _toNum(item.fglEsq, v.FGLE);
    const FGA_eff  = _toNum(item.fgSup, v.FGA);

    // Felipe (sessao 13, planilha PRECIFICAÇÃO_01_04_2026 atualizada):
    // Modelo 23 + Aluminio Macico tem U_LARG_2F e U_LARG_CENTRAL = 133
    // (em vez de 128 padrao do ACM e demais modelos). Fonte: planilha
    // E2 (lQuadro2F) e E3 (lQuadro1F) das abas "MODELO 23 - ACM" vs
    // "MODELO 23 - ALUMINIO MACICO" — a unica diferenca de E2/E3 entre
    // as duas abas e' o +128/+128 (ACM) virar +133/+133 (AM).
    // Efeito: lQuadro1F_AM = lQuadro1F_ACM + 5; lQuadro2F_AM = lQuadro2F_ACM + 10.
    const mNum = Number(item.modeloExterno || item.modeloInterno || item.modeloNumero) || 0;
    const rev = String(item.revestimento || '').toLowerCase();
    const ehMod23AM = (mNum === 23) && /aluminio.*macico/.test(rev) && /2\s*mm/.test(rev);
    const U_LARG_1F      = vc.U_LARG_1F;
    const U_LARG_2F      = ehMod23AM ? 133 : vc.U_LARG_2F;
    const U_LARG_CENTRAL = ehMod23AM ? 133 : vc.U_LARG_CENTRAL;

    const alturaQuadro    = H - FGA_eff - v.TUBLPORTAL - v.ESPPIV + v.TRANSPIV;
    const larguraQuadro1F = L - (FGLD_eff + FGLE_eff) - vc.PORTAL_LD - vc.PORTAL_LE + U_LARG_1F + U_LARG_CENTRAL;
    const larguraQuadro2F = L - vc.REF              - vc.PORTAL_LD - vc.PORTAL_LE + U_LARG_2F + U_LARG_CENTRAL;
    const larguraQuadro   = (nFolhas === 2) ? larguraQuadro2F : larguraQuadro1F;

    return {
      alturaQuadro:    Math.round(alturaQuadro    * 100) / 100,
      larguraQuadro1F: Math.round(larguraQuadro1F * 100) / 100,
      larguraQuadro2F: Math.round(larguraQuadro2F * 100) / 100,
      larguraQuadro:   Math.round(larguraQuadro   * 100) / 100,
      familia, nFolhas,
    };
  }

  // ------------------------------------------------------------------
  // CONTEXTO compartilhado pelas fórmulas declarativas
  // ------------------------------------------------------------------
  function construirContexto(item, lado, quadro) {
    const v  = getVarsFam()[quadro.familia];
    const vc = getVarsChapas();
    const num = key => Number(item[key]) || 0;

    // Felipe sessao 13: folgas EDITAVEIS POR ITEM (mesma logica do
    // calcularQuadro). Override no item: fglDir/fglEsq/fgSup. Vazio =
    // usa default global do cadastro. As pecas que usam ctx.FGA e
    // ctx.FGLD_FGLE (ex: u_portal_comp = L - FGLD_FGLE) precisam ler
    // o effective, nao o global, senao gera peca de tamanho errado.
    const _toNum = (raw, fallback) => {
      if (raw === '' || raw === null || raw === undefined) return fallback;
      const n = Number(String(raw).replace(',', '.'));
      return (Number.isFinite(n) && n >= 0) ? n : fallback;
    };
    const FGLD_eff = _toNum(item.fglDir, v.FGLD);
    const FGLE_eff = _toNum(item.fglEsq, v.FGLE);
    const FGA_eff  = _toNum(item.fgSup, v.FGA);

    const corExt   = String(item.corExterna || '').trim();
    const corInt   = String(item.corInterna || '').trim();
    const corCava  = String(item.corCava || '').trim();
    const corUnica = corExt && corExt === corInt;
    // Felipe sessao 13: cores da CHAPA AM (Aluminio Maciço) — separadas
    // de corExterna/corInterna (que viram cor da CHAPA ACM no Mod23 AM).
    // Pecas com ehPecaAM=true em materializar usam essas cores.
    const corAM_Ext = String(item.corChapaAM_Ext || '').trim();
    const corAM_Int = String(item.corChapaAM_Int || '').trim();
    const corAM_Unica = corAM_Ext && corAM_Ext === corAM_Int;

    // Felipe sessao 14: Modelo 23 NAO TEM cava (planilha
    // PRECIFICACAO_01_04_2026 abas "MODELO 23 - ACM" e "MODELO 23 -
    // ALUMINIO MACICO" tem C7 e C8 VAZIOS = 0). Itens legados podem
    // ter distanciaBordaCava e tamanhoCava salvos do modelo anterior
    // (ex: 210 e 150). Forcamos 0 aqui pra Mod 23 — fórmulas que usam
    // dBC e tamCava (Tampa Maior, tm_base_2f, tm_base_2f_menos1) ficam
    // com os valores corretos da planilha. Sem fix: TAMPA_MAIOR 01 dava
    // 836 em vez de 1196 (diferenca 360 = 210+150 do item legado).
    const _modeloEhMod23 = (
      Number(item.modeloExterno || item.modeloInterno || item.modeloNumero) === 23
    );
    const dBC_eff     = _modeloEhMod23 ? 0 : num('distanciaBordaCava');
    const tamCava_eff = _modeloEhMod23 ? 0 : num('tamanhoCava');

    return {
      item, lado, quadro,
      L: parseFloat(String(item.largura || '').replace(',', '.')) || 0,
      H: parseFloat(String(item.altura  || '').replace(',', '.')) || 0,
      familia: quadro.familia,
      fam: quadro.familia === '101' ? 'PA007' : 'PA006',
      nFolhas: quadro.nFolhas,
      alturaQuadro:    quadro.alturaQuadro,
      larguraQuadro:   quadro.larguraQuadro,
      larguraQuadro1F: quadro.larguraQuadro1F,
      larguraQuadro2F: quadro.larguraQuadro2F,
      REF: vc.REF,
      FGA: FGA_eff, FGLD_FGLE: FGLD_eff + FGLE_eff,
      ESPPIV: v.ESPPIV, TRANSPIV: v.TRANSPIV,
      TUBLPORTAL: v.TUBLPORTAL, TUBLPORTA: v.TUBLPORTA,
      dBC:     dBC_eff,
      tamCava: tamCava_eff,
      dBFV:    num('distanciaBordaFrisoVertical'),
      dBFH:    num('distanciaBordaFrisoHorizontal'),
      eF:        num('espessuraFriso'),
      qtdFrisos: Math.max(0, num('quantidadeFrisos') || 0),
      espacRipas: num('espacamentoRipas'),
      tipoRipado: String(item.tipoRipado || 'Total').toLowerCase(),
      duasFaces:  String(item.modeloDuasFaces || 'sim').toLowerCase() === 'sim',
      larguraAlisar:    num('largura_alisar') || 100,
      espessuraParede:  num('espessura_parede') || 250,
      // Felipe sessao 12: dist1aMoldura usada nas formulas Boiserie do
      // modelo 23 + Aluminio Macico (G27=1048-C29/2-C29, etc).
      // Default 150 (valor da planilha quando o user nao preencheu).
      dist1aMoldura:    num('distanciaBorda1aMoldura') || 150,
      // Felipe sessao 14: variaveis pra molduras MULTIPLAS no Mod 23
      //   Quantidade de molduras: 1 (default), 2 ou 3
      //   Distancia 1a -> 2a moldura: usado quando qtde >= 2
      //   Distancia 2a -> 3a moldura: usado quando qtde >= 3
      // Cada moldura adicional reduz a dimensao da anterior em 2*dist
      // (porque a moldura interna fica deslocada dist nos 4 lados).
      qtdMolduras: Math.max(1, parseInt(item.quantidadeMolduras, 10) || 1),
      dist12Mold:  num('distancia1a2aMoldura') || 0,
      dist23Mold:  num('distancia2a3aMoldura') || 0,
      // Felipe (sessao 26 fix): respeitar flag tem_alisar das caracteristicas.
      // Se 'Nao' -> nao gerar pecas de alisar (default 'Sim' pra retrocompat).
      //
      // Felipe sessao 2026-05-10: alisar pode ser '1 lado' (so' externo
      // ou so' interno) ou 'Sim' (= ambos, retrocompat) ou 'Nao' (sem).
      // 'quando tem fixo superior alisar e somente interno e essa
      // decisao alterara quantidade de pecas nas chapas'.
      // Valores possiveis de item.tem_alisar:
      //   'Sim'     -> ext + int (legado, retrocompat com cadastros antigos)
      //   'Externo' -> so' externo (1 lado)
      //   'Interno' -> so' interno (1 lado, default quando ha fixo superior)
      //   'Nao'     -> sem alisar (preserva comportamento existente)
      // Cada peca de alisar usa essas 2 flags pra decidir ext/int.
      // (Antes era 1 flag boolean 'temAlisar' aplicada a ambos.)
      temAlisar: String(item.tem_alisar || 'Sim').toLowerCase() !== 'nao',
      temAlisarExt: (function() {
        var v = String(item.tem_alisar || 'Sim').toLowerCase();
        return v === 'sim' || v === 'externo';  // 'Sim' (legado) e 'Externo' = tem ext
      })(),
      temAlisarInt: (function() {
        var v = String(item.tem_alisar || 'Sim').toLowerCase();
        return v === 'sim' || v === 'interno';  // 'Sim' (legado) e 'Interno' = tem int
      })(),
      corExt, corInt, corCava, corUnica,
      // Felipe sessao 13: cores da CHAPA AM (Mod23 + Aluminio Macico)
      corAM_Ext, corAM_Int, corAM_Unica,
    };
  }

  // ------------------------------------------------------------------
  // FÓRMULAS — extraídas literalmente das células da planilha Excel
  // ------------------------------------------------------------------
  const F = {
    cava_largura: ctx => ctx.tamCava + 23 + 23 + 35 + 35,
    cava_comp:    ctx => ctx.fam === 'PA007' ? ctx.alturaQuadro - 293 : ctx.alturaQuadro - 240,
    l_da_cava_largura: ctx => ctx.tamCava + 100 - 10,
    l_da_cava_comp:    ctx => 210,
    tampa_borda_cava_largura: ctx => ctx.dBC + (ctx.REF * 2) - 1 - 1,
    tampa_maior_1f_largura_com_cava: ctx => (ctx.larguraQuadro1F - ctx.dBC - 1 - ctx.tamCava - 1) + ctx.REF + ctx.REF,
    tampa_maior_1f_largura_lisa: ctx => (ctx.larguraQuadro1F - ctx.dBC - 1 - ctx.tamCava) + ctx.REF + ctx.REF,
    acab_lat_1: ctx => 70 + 18.5,
    acab_lat_2: ctx => 70 + ctx.REF,
    acab_lat_z: ctx => ctx.fam === 'PA007' ? (18.5 + 78.5 + 13) : (18.5 + 53.5 + 13),
    u_portal_duas_cores: ctx => ctx.TUBLPORTAL + 4 + ctx.TUBLPORTA/2 + ctx.TUBLPORTAL + 4 + 9,
    u_portal_uma_cor:    ctx => ctx.TUBLPORTAL + 4 + ctx.TUBLPORTA   + ctx.TUBLPORTAL + 4 + 9,
    u_portal_comp:       ctx => ctx.L - ctx.FGLD_FGLE,
    bat_01:    ctx => ctx.fam === 'PA007' ? (18.5 + 23) : (18.5 + 24),
    bat_02_z:  ctx => ctx.fam === 'PA007' ? (33 + 19)   : (56 + 19),
    bat_03:    ctx => ctx.fam === 'PA007' ? (61 + ctx.REF) : (62 + ctx.REF),
    bat_comp:  ctx => ctx.alturaQuadro + 116,
    tap_furo_largura: ctx => ctx.fam === 'PA007' ? (79 + 2*ctx.REF) : (54 + 2*ctx.REF),
    // Felipe sessao 12 - Modelo 23 + Aluminio Macico:
    // Quando modelo=23 E revestimento=Aluminio Macico, as fitas e tampas
    // perdem o '+2*REF' (que e a dobra do revestimento sobre as bordas - 
    // so faz sentido em ACM). Helper _ehMod23AM detecta o caso.
    // Aplicado nas fitas (fit_acab_me/ma/lar) e nas tampas (modelo 23
    // direto, ja inline).
    _ehMod23AM: ctx => {
      const mNum = Number(ctx.item?.modeloExterno || ctx.item?.modeloInterno || ctx.item?.modeloNumero) || 0;
      if (mNum !== 23) return false;
      const rev = String(ctx.item?.revestimento || '').toLowerCase();
      return /aluminio.*macico/.test(rev) && /2\s*mm/.test(rev);
    },
    // _refExtra(ctx) retorna 2*REF normalmente, ou 0 quando modelo 23 + AM.
    _refExtra: ctx => F._ehMod23AM(ctx) ? 0 : (2 * ctx.REF),
    fit_acab_me:  ctx => 36.5 + F._refExtra(ctx),
    fit_acab_ma:  ctx => 74.5 + F._refExtra(ctx),
    // Felipe sessao 14 (planilha PRECIFICACAO_01_04_2026 atualizada):
    // Em Mod 23 AM, FIT_ACAB_LAR mudou:
    //   ANTES: TUBLPORTAL + 10
    //   AGORA: TUBLPORTA + 10 + 4 (R21 col F = "=$C$14+10+4")
    // Em Mod 23 ACM e demais modelos: continua TUBLPORTAL + 10 + 2*REF.
    fit_acab_lar: ctx => F._ehMod23AM(ctx)
      ? ctx.TUBLPORTA + 10 + 4
      : ctx.TUBLPORTAL + 10 + 2 * ctx.REF,
    // ALISAR — Felipe planilha: (espessuraParede - 80/2) + 5 + larguraAlisar + REF
    // Nota: 80/2 é DIVIDIDO ANTES (=40), NÃO (esp-80)/2.
    alisar_largura: ctx => (ctx.espessuraParede - 80/2) + 5 + ctx.larguraAlisar + ctx.REF,
    alisar_altura_comp:  ctx => ctx.H + ctx.larguraAlisar + 100,
    alisar_largura_comp: ctx => ctx.L + 100,
    tm_base_2f: ctx => (ctx.larguraQuadro2F - ctx.dBC*2 - ctx.tamCava*2) / 2,
    // Felipe (sessao 29): A planilha NOVA tem -1 DENTRO da divisao em
    // TM02 e TM03 (mas NAO em TM01). Diferenca: -0.5mm. Bug do motor
    // anterior. Aplicado em modelos 02, 03, 04, 08, 11, 12, 13, 15
    // (modelo 22 nao usa — fórmula diferente com -34*4).
    tm_base_2f_menos1: ctx => (ctx.larguraQuadro2F - 1 - ctx.dBC*2 - ctx.tamCava*2) / 2,
    tampa_maior_06_comp: ctx => {
      const n = ctx.qtdFrisos;
      if (n <= 0) return ctx.alturaQuadro;
      return (ctx.alturaQuadro - n * ctx.eF) / (n + 1) + 2*ctx.REF;
    },
    // ====================================================================
    // Felipe sessao 14: MOLDURAS DO MOD 23 ACM (peças de chapa)
    // Aba "MODELO 23 - ACM" planilha PRECIFICACAO_01_04_2026:
    //   1F: MOLDURA HORIZONTAL 1 (qty 8), VERTICAL 1 (qty 4), VERTICAL 2 (qty 4)
    //   2F: MOLDURA HORIZONTAL 1 (qty 4), 2 (qty 8), 3 (qty 4),
    //        VERTICAL 1 (qty 8), VERTICAL 2 (qty 8)
    // Largura (espessura do perfil): 143 mm — constante na planilha.
    // Quando nao for ACM (= AM) viram perfis Boiserie em 31-perfis-porta-externa.js
    // (ehMod23AM la' aplica). Aqui geramos APENAS quando NAO for AM.
    // ====================================================================
    _C29:    ctx => Number(ctx.dist1aMoldura) || 150,
    // J9 1F = TAMPA_MAIOR_largura - 2*REF (planilha: G26 = J9 ou J9-C29*2)
    //   Em ACM, TAMPA_MAIOR_ = larguraQuadro1F - dBC - tamCava - 1 - frisos*X + 2*REF
    //   Logo J9 (sem o +2*REF) = larguraQuadro1F - dBC - tamCava - 1 - dBFV*qtdFrisos - eF*qtdFrisos
    mold_J9: ctx =>
      ctx.larguraQuadro1F - ctx.dBC - ctx.tamCava - 1
      - ctx.dBFV * ctx.qtdFrisos - ctx.eF * ctx.qtdFrisos,
    mold_horiz_1F: ctx => {
      const J9 = F.mold_J9(ctx);
      const C29 = F._C29(ctx);
      return ctx.qtdFrisos > 0 ? J9 : (J9 - 2*C29);
    },
    // VERTICAL 1: 1048 - C29/2 - C29 (constante 1048 da planilha)
    mold_vert_1: ctx => {
      const C29 = F._C29(ctx);
      return 1048 - C29/2 - C29;
    },
    // VERTICAL 2: alturaQuadro - 3*C29 - VERTICAL_1
    mold_vert_2: ctx => {
      const C29 = F._C29(ctx);
      return ctx.alturaQuadro - 3*C29 - F.mold_vert_1(ctx);
    },
    // Q9, Q10, Q11 = TAMPA_MAIOR 01/02/03 - 2*REF (planilha 2F)
    //   Q9  = tm_base_2f + 10.5 - 1 - dBFV*qtdFrisos - eF*qtdFrisos
    //   Q10 = tm_base_2f_menos1 - 28 - dBFV*qtdFrisos - eF*qtdFrisos
    //   Q11 = tm_base_2f_menos1 - 28 - 38 - dBFV*qtdFrisos - eF*qtdFrisos
    mold_Q9:  ctx => F.tm_base_2f(ctx) + 10.5 - 1
                     - ctx.dBFV * ctx.qtdFrisos - ctx.eF * ctx.qtdFrisos,
    mold_Q10: ctx => F.tm_base_2f_menos1(ctx) - 28
                     - ctx.dBFV * ctx.qtdFrisos - ctx.eF * ctx.qtdFrisos,
    mold_Q11: ctx => F.tm_base_2f_menos1(ctx) - 28 - 38
                     - ctx.dBFV * ctx.qtdFrisos - ctx.eF * ctx.qtdFrisos,
    mold_horiz_2F_1: ctx => {
      const Q = F.mold_Q9(ctx);
      const C29 = F._C29(ctx);
      return ctx.qtdFrisos > 0 ? Q : (Q - 2*C29);
    },
    mold_horiz_2F_2: ctx => {
      const Q = F.mold_Q10(ctx);
      const C29 = F._C29(ctx);
      return ctx.qtdFrisos > 0 ? Q : (Q - 2*C29);
    },
    mold_horiz_2F_3: ctx => {
      const Q = F.mold_Q11(ctx);
      const C29 = F._C29(ctx);
      return ctx.qtdFrisos > 0 ? Q : (Q - 2*C29);
    },
    // Felipe sessao 14: MOLDURAS MULTIPLAS (qtdMolduras 1, 2 ou 3)
    // Cada moldura adicional fica DENTRO da anterior, deslocada em
    // dist12 (ou dist23) nos 4 lados. Logo as dimensoes diminuem 2×dist.
    //   Moldura 1: dimensao base (sem decremento)
    //   Moldura 2: base - 2*dist12
    //   Moldura 3: base - 2*dist12 - 2*dist23
    mold_dec_2: ctx => 2 * (Number(ctx.dist12Mold) || 0),
    mold_dec_3: ctx => 2 * (Number(ctx.dist12Mold) || 0)
                       + 2 * (Number(ctx.dist23Mold) || 0),
    // Helper qty: retorna qtdBase se item tem >= N molduras, senao 0.
    // Sempre 0 em Mod 23 AM (la' viram perfis Boiserie em 31-perfis).
    mold_qty: function(n, qtdBase) {
      return ctx => {
        if (F._ehMod23AM(ctx)) return 0;
        return (Number(ctx.qtdMolduras) || 1) >= n ? qtdBase : 0;
      };
    },
  };

  // ------------------------------------------------------------------
  // PEÇAS UNIVERSAIS (1F e 2F)
  // ------------------------------------------------------------------
  // Felipe (planilha): em 2F, ACAB_LAT_* dobram (1 por folha × 2 folhas).
  // BAT, TAP_FURO, FIT_ACAB, U_PORTAL, ALISAR — qty igual em 1F e 2F (parte do portal).
  function pecasUniversais(variant) {
    const isF1 = variant === '1F';
    const acabExt = isF1 ? 1 : 2;
    const acabInt = isF1 ? 1 : 2;

    return [
      { id: 'acab_lat_1', label: 'Acabamento Lateral 1',
        largura: F.acab_lat_1, comp: ctx => ctx.alturaQuadro,
        ext: acabExt, int: acabInt, categoria: 'porta' },
      { id: 'acab_lat_2', label: 'Acabamento Lateral 2',
        largura: F.acab_lat_2, comp: ctx => ctx.alturaQuadro,
        ext: acabExt, int: acabInt, categoria: 'porta' },
      { id: 'acab_lat_z', label: 'Acabamento Lateral Z',
        largura: F.acab_lat_z, comp: ctx => ctx.alturaQuadro,
        ext: acabExt, int: acabInt, categoria: 'porta' },

      { id: 'u_portal_duas_cores', label: 'U Portal (2 Cores)',
        largura: F.u_portal_duas_cores, comp: F.u_portal_comp,
        ext: ctx => ctx.corUnica ? 0 : 1, int: ctx => ctx.corUnica ? 0 : 1,
        categoria: 'portal' },
      { id: 'u_portal_uma_cor', label: 'U Portal (1 Cor)',
        largura: F.u_portal_uma_cor, comp: F.u_portal_comp,
        ext: ctx => ctx.corUnica ? 1 : 0, int: 0,
        categoria: 'portal' },

      { id: 'bat_01', label: 'Batente 01',
        largura: F.bat_01, comp: F.bat_comp, ext: 1, int: 1, categoria: 'portal' },
      { id: 'bat_02_z', label: 'Batente 02 Z',
        largura: F.bat_02_z, comp: F.bat_comp, ext: 1, int: 1, categoria: 'portal' },
      { id: 'bat_03', label: 'Batente 03',
        largura: F.bat_03, comp: F.bat_comp, ext: 1, int: 1, categoria: 'portal' },

      // TAP_FURO planilha qty=3 (impar). Distribuir 2 ext + 1 int.
      // Felipe revisar — pode ser 2 ext + 2 int (4 total) se obs "2/2" prevalecer.
      { id: 'tap_furo', label: 'Tampa de Furo',
        largura: F.tap_furo_largura, comp: F.bat_comp,
        ext: 2, int: 1, categoria: 'portal',
        observacao: 'qty 3 da planilha distribuida 2 ext + 1 int' },

      // FIT_ACAB — cor única: 2 no externo; cor diferente: 1 ext + 1 int
      { id: 'fit_acab_me', label: 'Fita Acabamento Menor',
        largura: F.fit_acab_me, comp: F.bat_comp,
        ext: ctx => ctx.corUnica ? 2 : 1, int: ctx => ctx.corUnica ? 0 : 1,
        categoria: 'portal' },
      { id: 'fit_acab_ma', label: 'Fita Acabamento Maior',
        largura: F.fit_acab_ma, comp: F.bat_comp,
        ext: ctx => ctx.corUnica ? 2 : 1, int: ctx => ctx.corUnica ? 0 : 1,
        categoria: 'portal' },
      { id: 'fit_acab_lar_fita', label: 'Fita Acabamento Largura',
        largura: F.fit_acab_lar, comp: F.bat_comp,
        ext: ctx => ctx.corUnica ? 2 : 1, int: ctx => ctx.corUnica ? 0 : 1,
        categoria: 'portal' },

      // ALISAR_ALTURA qty=5 — distribui 3 ext + 2 int. Felipe revisar.
      // Felipe (sessao 26 fix): so' gera se item.tem_alisar !== 'Nao'.
      // Felipe sessao 2026-05-10: separar ext/int em flags independentes.
      // Felipe confirmou: '1 lado (so interno) -> altura 3 largura 1' -
      // ou seja, quando so' tem 1 lado, todas as pecas vao pra esse lado
      // (nao distribui 3 ext + 2 int). Comportamento por valor:
      //   'Sim' (legado/ambos): ext=3, int=2 (igual antes)
      //   'Externo' (so' ext):  ext=3 (todos vao pra externo), int=0
      //                         Convertemos 2 int em 0 (sao quem fica do
      //                         lado interno, e nao existe lado interno).
      //                         NAO somamos 5 pro externo porque o
      //                         externo continua precisando de 3 pecas.
      //   'Interno' (so' int):  ext=0, int=3 (pegamos 3 - mesmo numero
      //                         da Altura porque agora todo o '5' do
      //                         legado se torna so' Altura no interno)
      //                         Felipe pediu '3 altura' explicitamente.
      //   'Nao' (sem):          ext=0, int=0 (preserva comportamento)
      { id: 'alisar_altura', label: 'Alisar Altura',
        largura: F.alisar_largura, comp: F.alisar_altura_comp,
        ext: ctx => ctx.temAlisarExt && ctx.temAlisarInt ? 3 : (ctx.temAlisarExt ? 3 : 0),
        int: ctx => ctx.temAlisarExt && ctx.temAlisarInt ? 2 : (ctx.temAlisarInt ? 3 : 0),
        categoria: 'portal',
        observacao: 'qty 5 da planilha distribuida 3 ext + 2 int (ou 3 quando 1 lado, Felipe)' },
      // Felipe sessao 2026-05-10 (Alisar Largura): '1 largura' quando 1 lado.
      //   'Sim' (ambos):   ext=1, int=1 (igual antes)
      //   'Externo' so':   ext=1, int=0
      //   'Interno' so':   ext=0, int=1
      //   'Nao':           ext=0, int=0
      { id: 'alisar_largura', label: 'Alisar Largura',
        largura: F.alisar_largura, comp: F.alisar_largura_comp,
        ext: ctx => ctx.temAlisarExt ? 1 : 0,
        int: ctx => ctx.temAlisarInt ? 1 : 0,
        categoria: 'portal' },
    ];
  }

  // ------------------------------------------------------------------
  // QUANTIDADE DE RIPAS (modelos 08 e 15)
  // ------------------------------------------------------------------
  function calcularQtdRipas(ctx) {
    const espac = ctx.espacRipas || 30;
    const denom = 60 + espac;
    if (denom === 0) return 0;
    const numerador = ctx.tipoRipado === 'parcial'
      ? (ctx.L - ctx.dBC - ctx.tamCava - ctx.dBC)
      : ctx.L;
    return Math.ceil(numerador / denom);
  }

  // ------------------------------------------------------------------
  // TABELA DE PEÇAS POR MODELO
  // ------------------------------------------------------------------
  const TABELA = {
    1: {
      '1F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'l_da_cava', label: 'L da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: F.tampa_maior_1f_largura_com_cava, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
      ],
      '2F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_da_cava', label: 'Tampa da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 4, int: 4, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          // Felipe (sessao 29 fix): planilha mod 01 tem +10 (nao +10.5)
          largura: ctx => F.tm_base_2f(ctx) + 10 + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          // Felipe (sessao 29 fix): planilha tem -1 dentro da divisao
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          // Felipe (sessao 29 fix): planilha tem -1 dentro da divisao
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_menor', label: 'Tampa Menor',
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
      ],
    },

    2: {
      '1F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'l_da_cava', label: 'L da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: ctx => (ctx.larguraQuadro1F - ctx.dBC - 1 - ctx.tamCava - 1 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos) + 2*ctx.REF,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_borda_friso_vertical', label: 'Tampa Borda Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          largura: ctx => 100 + ctx.eF, comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
      ],
      '2F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_da_cava', label: 'Tampa da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 4, int: 4, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10 + 2*ctx.REF - 1 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          // Felipe (sessao 29 fix): planilha tem -1 dentro da divisao
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          // Felipe (sessao 29 fix): planilha tem -1 dentro da divisao
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_menor', label: 'Tampa Menor',
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_borda_friso_vertical', label: 'Tampa Borda Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          largura: ctx => 100 + ctx.eF, comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta' },
      ],
    },

    3: {
      '1F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'friso_horizontal_cava', label: 'Friso Horizontal Cava',
          largura: ctx => ctx.larguraQuadro1F, comp: ctx => 250,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true,
          observacao: 'Felipe: confirmar dimensoes (planilha truncada)' },
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: F.tampa_maior_1f_largura_com_cava,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          largura: F.tampa_borda_cava_largura,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_friso_horizontal', label: 'Tampa Friso Horizontal',
          largura: ctx => (ctx.larguraQuadro1F - 1) + 2*ctx.REF,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 2, int: 2, categoria: 'porta' },
        { id: 'friso_horizontal', label: 'Friso Horizontal',
          largura: ctx => ctx.larguraQuadro1F,
          comp: ctx => ctx.eF + 100,
          ext: 1, int: 1, categoria: 'porta' },
      ],
      '2F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_da_cava', label: 'Tampa da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 4, int: 4, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10.5 + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          largura: F.tampa_borda_cava_largura,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'friso_horizontal', label: 'Friso Horizontal',
          largura: ctx => ctx.larguraQuadro2F + 50,
          comp: ctx => ctx.eF + 100,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tm01_friso_vert', label: 'Tampa Maior 01 - Friso Vert.',
          largura: ctx => ctx.larguraQuadro2F/2 + 10.5 + 2*ctx.REF - 1,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tm02_friso_vert', label: 'Tampa Maior 02 - Friso Vert.',
          largura: ctx => ctx.larguraQuadro2F/2 + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tm03_friso_vert', label: 'Tampa Maior 03 - Friso Vert.',
          largura: ctx => ctx.larguraQuadro2F/2 + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 0, int: 1, categoria: 'porta' },
      ],
    },

    4: {
      '1F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'l_da_cava', label: 'L da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: ctx => F.tampa_maior_1f_largura_com_cava(ctx) - ctx.dBFV - ctx.eF,
          comp: ctx => ctx.larguraQuadro1F - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          largura: F.tampa_borda_cava_largura,
          comp: ctx => ctx.larguraQuadro1F - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_friso_horizontal', label: 'Tampa Friso Horizontal',
          largura: ctx => (ctx.larguraQuadro1F - 1) + 2*ctx.REF - ctx.dBFV - ctx.eF,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_menor_canto', label: 'Tampa Menor Canto',
          largura: ctx => ctx.dBFH + 2*ctx.REF,
          comp: ctx => ctx.dBFV + ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_friso_vertical', label: 'Tampa Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.larguraQuadro1F - 2*ctx.dBFV - 2*ctx.eF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          largura: ctx => ctx.eF + 100,
          comp: ctx => ctx.alturaQuadro + 100,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'friso_horizontal', label: 'Friso Horizontal',
          largura: ctx => ctx.eF + 100,
          comp: ctx => ctx.larguraQuadro1F,
          ext: 1, int: 1, categoria: 'porta' },
      ],
      '2F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_da_cava', label: 'Tampa da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 4, int: 4, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10.5 + 2*ctx.REF - 1,
          comp: ctx => ctx.larguraQuadro2F - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.larguraQuadro2F - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.larguraQuadro2F - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          largura: F.tampa_borda_cava_largura,
          comp: ctx => ctx.larguraQuadro2F - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_friso_horizontal_01', label: 'Tampa Friso Horizontal 01',
          largura: ctx => ctx.larguraQuadro2F/2 + 10.5,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_friso_horizontal_02', label: 'Tampa Friso Horizontal 02',
          largura: ctx => ctx.larguraQuadro2F/2 - 28,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_friso_horizontal_03', label: 'Tampa Friso Horizontal 03',
          largura: ctx => ctx.larguraQuadro2F/2 - 28 - 38,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_menor_canto', label: 'Tampa Menor Canto',
          largura: ctx => ctx.dBFH + 2*ctx.REF,
          comp: ctx => ctx.dBFV + ctx.REF,
          ext: 4, int: 4, categoria: 'porta' },
        { id: 'tampa_01_friso_vertical', label: 'Tampa 01 Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.larguraQuadro2F - 2*ctx.dBFV - 2*ctx.eF,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_02_friso_vertical', label: 'Tampa 02 Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.larguraQuadro2F - 2*ctx.dBFV - 2*ctx.eF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_03_friso_vertical', label: 'Tampa 03 Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.larguraQuadro2F - 2*ctx.dBFV - 2*ctx.eF,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          largura: ctx => ctx.eF + 100,
          comp: ctx => ctx.alturaQuadro,
          ext: 2, int: 2, categoria: 'porta' },
        { id: 'friso_horizontal', label: 'Friso Horizontal',
          largura: ctx => ctx.eF + 100,
          comp: ctx => ctx.larguraQuadro2F/2,
          ext: 4, int: 4, categoria: 'porta' },
      ],
    },

    6: {
      '1F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'l_da_cava', label: 'L da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        // TAMPA_MAIOR_CAVA mod 06: largura igual mod 01, COMP varia, qty = qtdFrisos por face
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: F.tampa_maior_1f_largura_com_cava,
          comp: F.tampa_maior_06_comp,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
      ],
      '2F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_da_cava', label: 'Tampa da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 4, int: 4, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10.5 + 2*ctx.REF - 1,
          comp: F.tampa_maior_06_comp,
          ext: ctx => ctx.qtdFrisos, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: F.tampa_maior_06_comp,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: F.tampa_maior_06_comp,
          ext: 0, int: ctx => ctx.qtdFrisos, categoria: 'porta' },
        { id: 'tampa_menor', label: 'Tampa Menor',
          largura: F.tampa_borda_cava_largura,
          comp: F.tampa_maior_06_comp,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta', ehDaCava: true },
      ],
    },

    8: {
      '1F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'l_da_cava', label: 'L da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: F.tampa_maior_1f_largura_com_cava, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'ripas', label: 'Ripas',
          largura: ctx => 13+4+51+9+13+4,
          comp: F.cava_comp,
          ext: ctx => calcularQtdRipas(ctx),
          int: ctx => calcularQtdRipas(ctx),
          categoria: 'porta' },
      ],
      '2F': [
        { id: 'cava', label: 'Cava',
          largura: F.cava_largura, comp: F.cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_da_cava', label: 'Tampa da Cava',
          largura: F.l_da_cava_largura, comp: F.l_da_cava_comp,
          ext: 4, int: 4, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10 + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_menor', label: 'Tampa Menor',
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'ripas', label: 'Ripas',
          largura: ctx => 13+4+51+9+13+4,
          comp: F.cava_comp,
          ext: ctx => calcularQtdRipas(ctx),
          int: ctx => calcularQtdRipas(ctx),
          categoria: 'porta' },
      ],
    },

    10: {
      '1F': [
        // Mod 10: lisa, sem cava real (planilha v2 não mostra CAVA/L_DA_CAVA)
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: F.tampa_maior_1f_largura_lisa, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
      ],
      '2F': [
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => (ctx.larguraQuadro2F)/2 + 10.5 + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          // Mod 10 usa -27 (não -28)
          largura: ctx => (ctx.larguraQuadro2F - 1)/2 + 2*ctx.REF - 27 - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => (ctx.larguraQuadro2F - 1)/2 + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 0, int: 1, categoria: 'porta' },
      ],
    },

    // ===================================================================
    // MODELO 11 — Felipe (sessao 29) revisao completa vs planilha NOVA.
    // Mudancas vs versao anterior do motor:
    //   1F: ADICIONADO Cava + L da Cava (faltavam — sempre presentes na planilha)
    //   2F: ADICIONADO Cava + Tampa da Cava (faltavam)
    //   2F TBFV: CORRIGIDO bug grave (motor tinha
    //            "(espessuraParede + 2*REF - 1) + 2*REF - 1" — fórmula sem
    //            sentido, ~288mm). Planilha: "dBFV + 2*REF - 1" (~59mm)
    //   1F TBFV: motor JÁ usava espessuraParede; corrigido pra dBFV (planilha)
    // ===================================================================
    11: {
      '1F': [
        // Felipe (sessao 18): mod 11 e' Puxador Externo + Friso Vertical.
        // NAO tem CAVA nem L_DA_CAVA. Antes geravam peca fantasma.
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          // Planilha: (E3-C7-C8-1-C20*C22-C21*C22)+C15+C15
          largura: ctx => (ctx.larguraQuadro1F - ctx.dBC - ctx.tamCava - 1 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos) + 2*ctx.REF,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_friso_vertical', label: 'Tampa Borda Friso Vertical',
          // Felipe (sessao 29): planilha usa C20 (dBFV), nao C18 (espessuraParede)
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          largura: ctx => 100 + ctx.eF, comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
      ],
      '2F': [
        // Felipe (sessao 18): mod 11 NAO tem CAVA nem TAMPA_DA_CAVA.
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          // Planilha: (E2-C7*2-C8*2)/2+10.5+C15+C15-1-C20*C22-C21*C22
          largura: ctx => F.tm_base_2f(ctx) + 10.5 + 2*ctx.REF - 1 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          // Planilha: (E2-1-C7*2-C8*2)/2+C15+C15-28-C20*C22-C21*C22 (SEM -1 final)
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          // Planilha: (E2-1-C7*2-C8*2)/2+C15+C15-28-38-C20*C22-C21*C22 (SEM -1 final)
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_friso_vertical', label: 'Tampa Borda Friso Vertical',
          // Felipe (sessao 29 fix CRITICO): motor tinha "(esp+2*REF-1)+2*REF-1"
          // que dava ~288mm. Planilha NOVA: dBFV+2*REF-1 (~59mm). qty mantida
          // como qtdFrisos*2 pra consistencia com modelos 02/22 (planilha mod 11
          // tem 4 fixo, mas isso assume qtdFrisos=2 — qtdFrisos*2 e' generico).
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          largura: ctx => 100 + ctx.eF, comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta' },
      ],
    },

    15: {
      '1F': [
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: F.tampa_maior_1f_largura_com_cava, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'ripas', label: 'Ripas',
          largura: ctx => 13+4+51+9+13+4,
          comp: F.cava_comp,
          ext: ctx => calcularQtdRipas(ctx),
          int: ctx => calcularQtdRipas(ctx),
          categoria: 'porta' },
      ],
      '2F': [
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10 + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'ripas', label: 'Ripas',
          largura: ctx => 13+4+51+9+13+4,
          comp: F.cava_comp,
          ext: ctx => calcularQtdRipas(ctx),
          int: ctx => calcularQtdRipas(ctx),
          categoria: 'porta' },
      ],
    },

    // ============================================================
    // MODELO 12 — Cava + Friso Horizontal (variante simplificada do 03)
    // Vars: dBFH (C19), eF (C20)
    // Diferenca vs mod 03: NAO tem TAMPA_BORDA_CAVA. Comp da TM_CAVA tem -1 extra.
    // ============================================================
    12: {
      '1F': [
        // Felipe (sessao 18): mod 12 e' Puxador Externo + Friso Horizontal.
        // NAO tem CAVA. Pecas 'cava' e 'friso_horizontal_cava' removidas.
        // TAMPA_MAIOR_CAVA: largura igual mod 03 (com cava), comp = alturaQuadro - 2dBFH - 2eF + 2REF - 1
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: F.tampa_maior_1f_largura_com_cava,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF - 1,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_friso_horizontal', label: 'Tampa Friso Horizontal',
          largura: ctx => (ctx.larguraQuadro1F - 1) + 2*ctx.REF,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 2, int: 2, categoria: 'porta' },
        { id: 'friso_horizontal', label: 'Friso Horizontal',
          largura: ctx => ctx.larguraQuadro1F,
          comp: ctx => ctx.eF + 100,
          ext: 1, int: 1, categoria: 'porta' },
      ],
      '2F': [
        // Felipe (sessao 18): mod 12 NAO tem CAVA nem TAMPA_DA_CAVA.
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10.5 + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF - 1,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF - 1,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFH - 2*ctx.eF + 2*ctx.REF - 1,
          ext: 0, int: 1, categoria: 'porta' },
        // Friso horizontal 2F: largura = larguraQuadro2F + 50
        { id: 'friso_horizontal', label: 'Friso Horizontal',
          largura: ctx => ctx.larguraQuadro2F + 50,
          comp: ctx => ctx.eF + 100,
          ext: 1, int: 1, categoria: 'porta' },
        // 3 TAMPA_MAIOR_FRISO_VERTICAL extras (so 2F): igual TM01/02/03 mas comp = dBFH + REF
        { id: 'tm01_friso_vert', label: 'Tampa Maior 01 - Friso Vert.',
          largura: ctx => ctx.larguraQuadro2F/2 + 10.5 + 2*ctx.REF - 1,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tm02_friso_vert', label: 'Tampa Maior 02 - Friso Vert.',
          largura: ctx => ctx.larguraQuadro2F/2 + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tm03_friso_vert', label: 'Tampa Maior 03 - Friso Vert.',
          largura: ctx => ctx.larguraQuadro2F/2 + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 0, int: 1, categoria: 'porta' },
      ],
    },

    // ============================================================
    // MODELO 13 — Cava + Friso H + Friso V (variante simplificada do 04)
    // Vars: dBFH (C19), dBFV (C20), eF (C21)
    // Diferenca vs mod 04: NAO tem TAMPA_BORDA_CAVA.
    //                      Comp da TM_CAVA usa alturaQuadro (nao larguraQuadro).
    // ============================================================
    13: {
      '1F': [
        // Felipe (sessao 18): mod 13 e' Puxador Externo + Friso H + Friso V.
        // NAO tem CAVA nem L_DA_CAVA.
        // TAMPA_MAIOR_CAVA: (larguraQuadro1F - dBC - 1 - tamCava - 1) + 2REF - dBFV - eF
        // comp: alturaQuadro - dBFV - eF + REF - 1
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: ctx => F.tampa_maior_1f_largura_com_cava(ctx) - ctx.dBFV - ctx.eF,
          comp: ctx => ctx.alturaQuadro - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_friso_horizontal', label: 'Tampa Friso Horizontal',
          largura: ctx => (ctx.larguraQuadro1F - 1) + 2*ctx.REF - ctx.dBFV - ctx.eF,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_menor_canto', label: 'Tampa Menor Canto',
          largura: ctx => ctx.dBFH + 2*ctx.REF,
          comp: ctx => ctx.dBFV + ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        // TAMPA_FRISO_VERTICAL: comp usa alturaQuadro (nao larguraQuadro)
        { id: 'tampa_friso_vertical', label: 'Tampa Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFV - 2*ctx.eF,
          ext: 1, int: 1, categoria: 'porta' },
        // FRISO VERTICAL: comp = G9 (alturaQuadro) + 100
        { id: 'friso_vertical', label: 'Friso Vertical',
          largura: ctx => ctx.eF + 100,
          comp: ctx => ctx.alturaQuadro + 100,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'friso_horizontal', label: 'Friso Horizontal',
          largura: ctx => ctx.eF + 100,
          comp: ctx => ctx.larguraQuadro1F,
          ext: 1, int: 1, categoria: 'porta' },
      ],
      '2F': [
        // Felipe (sessao 18): mod 13 NAO tem CAVA nem TAMPA_DA_CAVA.
        // TAMPA_MAIOR 01/02/03 — comp = alturaQuadro - dBFV - eF + REF - 1
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10.5 + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: ctx => ctx.alturaQuadro - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: ctx => ctx.alturaQuadro - ctx.dBFV - ctx.eF + ctx.REF - 1,
          ext: 0, int: 1, categoria: 'porta' },
        // 3 TAMPA_FRISO_HORIZONTAL: largura segue padrao TM01/02/03 sem dBFV
        { id: 'tampa_friso_horizontal_01', label: 'Tampa Friso Horizontal 01',
          largura: ctx => ctx.larguraQuadro2F/2 + 10.5,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_friso_horizontal_02', label: 'Tampa Friso Horizontal 02',
          largura: ctx => ctx.larguraQuadro2F/2 - 28,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_friso_horizontal_03', label: 'Tampa Friso Horizontal 03',
          largura: ctx => ctx.larguraQuadro2F/2 - 28 - 38,
          comp: ctx => ctx.dBFH + ctx.REF,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_menor_canto', label: 'Tampa Menor Canto',
          largura: ctx => ctx.dBFH + 2*ctx.REF,
          comp: ctx => ctx.dBFV + ctx.REF,
          ext: 4, int: 4, categoria: 'porta' },
        // 3 TAMPA_FRISO_VERTICAL: comp usa alturaQuadro
        { id: 'tampa_01_friso_vertical', label: 'Tampa 01 Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFV - 2*ctx.eF,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_02_friso_vertical', label: 'Tampa 02 Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFV - 2*ctx.eF,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_03_friso_vertical', label: 'Tampa 03 Friso Vertical',
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro - 2*ctx.dBFV - 2*ctx.eF,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          largura: ctx => ctx.eF + 100,
          comp: ctx => ctx.alturaQuadro,
          ext: 2, int: 2, categoria: 'porta' },
        { id: 'friso_horizontal', label: 'Friso Horizontal',
          largura: ctx => ctx.eF + 100,
          comp: ctx => ctx.larguraQuadro2F/2,
          ext: 4, int: 4, categoria: 'porta' },
      ],
    },

    // ============================================================
    // MODELO 16 — Cava + N Frisos Horizontais (variante simplificada do 06)
    // Vars: qtdFrisos (C19), eF (C20)
    // Diferencas vs mod 06:
    //   - NAO tem TAMPA_BORDA_CAVA (1F) nem TAMPA_MENOR (2F)
    //   - TAMPA_MAIOR_CAVA 1F ocupa LARGURA INTEIRA do quadro (sem desconto de cava):
    //     largura = (larguraQuadro1F - 1) + 2*REF
    // ============================================================
    16: {
      '1F': [
        // Felipe (sessao 18): mod 16 e' Puxador Externo + N Frisos Horizontais.
        // NAO tem CAVA nem L_DA_CAVA.
        // Mod 16: TAMPA_MAIOR_CAVA NAO desconta cava na largura.
        // Comp varia com qtdFrisos (mesma fórmula do mod 06).
        // qty = qtdFrisos por face.
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          largura: ctx => (ctx.larguraQuadro1F - 1) + 2*ctx.REF,
          comp: F.tampa_maior_06_comp,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
      ],
      '2F': [
        // Felipe (sessao 18): mod 16 NAO tem CAVA nem TAMPA_DA_CAVA.
        // TAMPA_MAIOR 01/02/03 com COMP variando (frisos horizontais)
        // qty: TM01 = qtdFrisos, TM02 = qtdFrisos*2, TM03 = qtdFrisos
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          largura: ctx => F.tm_base_2f(ctx) + 10.5 + 2*ctx.REF - 1,
          comp: F.tampa_maior_06_comp,
          ext: ctx => ctx.qtdFrisos, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 1,
          comp: F.tampa_maior_06_comp,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          largura: ctx => F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - 1,
          comp: F.tampa_maior_06_comp,
          ext: 0, int: ctx => ctx.qtdFrisos, categoria: 'porta' },
      ],
    },

    // ====================================================================
    // MODELO 22 — Felipe (sessao 28): "MODELO 22 CARREGADO 1 E 2 FOLHAS"
    // Aba "MODELO 22" da planilha PRECIFICACAO_01_04_2026.xlsx
    //
    // Caracteristicas (vs Modelo 02):
    //   - Cava com 5 ribs internas: largura = tamCava + 412
    //     (formula F7 1F: (50+48+34+48+C8+48+34+48+50))
    //     = tamCava + 50+48+34+48+48+34+48+50 = tamCava + 360 + 52 = tamCava + 412
    //     Espera, deixa recalcular: 50+48+34+48+48+34+48+50 = 360. Mais o C8 (=tamCava).
    //     Total: tamCava + 360. Vou conferir abaixo.
    //   - SEM "L da Cava" (modelo 02 tem)
    //   - TAMPA_MAIOR_CAVA com -34 em vez de -1 nas margens da cava
    //     (formula 1F F9: E3-C7-34-C8-34-C20*C22-C21*C22 + C15+C15-1)
    //   - 2F tem TAMPA_MAIOR 01/02/03 e TAMPA_MENOR (modelo 02 estilo)
    //     Formulas 2F O9-O11 com base = (E2-C7*2-C8*2-34*4)/2
    22: {
      '1F': [
        { id: 'cava', label: 'Cava',
          // Formula F7: (50+48+34+48+C8+48+34+48+50) = tamCava + 360
          largura: ctx => ctx.tamCava + 50 + 48 + 34 + 48 + 48 + 34 + 48 + 50,
          comp: F.cava_comp,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        // SEM l_da_cava no modelo 22 (planilha nao tem essa peca)
        { id: 'tampa_maior_cava', label: 'Tampa Maior Cava',
          // Formula F9: (E3-C7-34-C8-34-C20*C22-C21*C22)+C15+C15-1
          largura: ctx => (ctx.larguraQuadro1F - ctx.dBC - 34 - ctx.tamCava - 34
                           - ctx.dBFV * ctx.qtdFrisos - ctx.eF * ctx.qtdFrisos)
                          + 2 * ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_cava', label: 'Tampa Borda Cava',
          // Formula F10: C7+C15*2-1-1 = mesma do modelo 02
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_borda_friso_vertical', label: 'Tampa Borda Friso Vertical',
          // Formula F11: C18+C15*2-1 (espessuraParede + 2*REF - 1) — atencao:
          // no modelo 02 a planilha usa $C$18 que e' espessuraParede; aqui
          // tambem. Mantem consistencia.
          largura: ctx => ctx.espessuraParede + 2 * ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          // Formula F12: 100+C21 = mesma do modelo 02
          largura: ctx => 100 + ctx.eF, comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
      ],
      '2F': [
        { id: 'cava', label: 'Cava',
          // Formula N7 igual F7
          largura: ctx => ctx.tamCava + 50 + 48 + 34 + 48 + 48 + 34 + 48 + 50,
          comp: F.cava_comp,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        // SEM TAMPA DA CAVA (l_da_cava) no modelo 22
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          // Formula N9: (((E2-C7*2-C8*2-34*4)))/2 + 10 + C15+C15 - 1 - C20*C22 - C21*C22
          // = base22 + 10 + 2*REF - 1 - (dBFV+eF)*qtdFrisos
          // Onde base22 = (larguraQuadro2F - dBC*2 - tamCava*2 - 34*4) / 2
          largura: ctx => {
            const base22 = (ctx.larguraQuadro2F - ctx.dBC * 2 - ctx.tamCava * 2 - 34 * 4) / 2;
            return base22 + 10 + 2 * ctx.REF - 1
                   - ctx.dBFV * ctx.qtdFrisos - ctx.eF * ctx.qtdFrisos;
          },
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          // Formula N10: base22 - 28 + C15+C15 - 1 - C20*C22 - C21*C22
          largura: ctx => {
            const base22 = (ctx.larguraQuadro2F - ctx.dBC * 2 - ctx.tamCava * 2 - 34 * 4) / 2;
            return base22 - 28 + 2 * ctx.REF - 1
                   - ctx.dBFV * ctx.qtdFrisos - ctx.eF * ctx.qtdFrisos;
          },
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          // Formula N11: base22 - 28 - 38 + C15+C15 - 1 - C20*C22 - C21*C22
          largura: ctx => {
            const base22 = (ctx.larguraQuadro2F - ctx.dBC * 2 - ctx.tamCava * 2 - 34 * 4) / 2;
            return base22 - 28 - 38 + 2 * ctx.REF - 1
                   - ctx.dBFV * ctx.qtdFrisos - ctx.eF * ctx.qtdFrisos;
          },
          comp: ctx => ctx.alturaQuadro,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_menor', label: 'Tampa Menor',
          // Formula N12: C7+C15*2-1-1 = igual TAMPA_BORDA_CAVA do 1F
          largura: F.tampa_borda_cava_largura, comp: ctx => ctx.alturaQuadro,
          ext: 2, int: 2, categoria: 'porta', ehDaCava: true },
        { id: 'tampa_borda_friso_vertical', label: 'Tampa Borda Friso Vertical',
          // Formula N13: C18+C15*2-1, qty = C22*2
          largura: ctx => ctx.espessuraParede + 2 * ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso Vertical',
          // Formula N14: 100+C21, qty = C22*2
          largura: ctx => 100 + ctx.eF, comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta' },
      ],
    },

    // ===================================================================
    // MODELO 23 — ACM (Felipe sessao 29: "Coloquei modelo 23, mas
    // somente com revestimento ACM e Configuracao da moldura PADRAO,
    // as outras irei te falar como fazer").
    //
    // Estrutura IGUAL ao Modelo 11 (peças). Layout planilha 2F: M-N-O-P
    // (cols 13-14-15-16). Fórmulas batem com Modelo 11.
    //
    // Diferencas vs Modelo 11 (apos comparacao planilha):
    //   - 1F TBFV: planilha tem "C20+(C15*2)-1" = dBFV+2*REF-1 (igual mod 11 NOVO)
    //   - 2F TBFV: planilha tem "C20+(C15*2)-1" = dBFV+2*REF-1, qty=C22*2
    //     (mod 11 planilha tem qty=4 fixo, mod 23 planilha tem qty=C22*2 — MAIS GENERICO)
    //   - 1F TM_CAVA: igual mod 11
    //   - 2F TM01-03: iguais mod 11 (com -1 dentro, sem -1 final)
    //
    // Quando outras configurações (revestimento ≠ ACM, moldura ≠ PADRAO)
    // forem definidas, Felipe vai mandar especificacoes e adicionamos
    // variantes (talvez chave 23.1, 23.2 ou modificadores no item).
    // ===================================================================
    23: {
      '1F': [
        // Felipe (sessao 18): pecas CAVA e L_DA_CAVA REMOVIDAS de vez.
        // Sessao 14 deixou com ext:0/int:0 + sempreAM por compat, mas
        // a planilha NAO tem essas pecas e Felipe confirmou: "do 10 pra
        // frente todos sao puxadores externo e nao tem nada de cava".
        { id: 'tampa_maior_cava', label: 'Tampa Maior',
          // Felipe sessao 13: planilha v3 nome e' "TAMPA_MAIOR_" (sem
          // "Cava"). Mantive id 'tampa_maior_cava' por compatibilidade
          // com codigo legado mas trocei label pra "Tampa Maior".
          // Planilha mod 23 ACM: (E3-C7-C8-1-C20*C22-C21*C22)+C15+C15
          // Planilha mod 23 AM:  (E3-C7-C8-C20*C22-C21*C22)         (sem -1, sem +2*REF)
          largura: ctx => F._ehMod23AM(ctx)
            ? (ctx.larguraQuadro1F - ctx.dBC - ctx.tamCava - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos)
            : (ctx.larguraQuadro1F - ctx.dBC - ctx.tamCava - 1 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos) + 2*ctx.REF,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_friso_vertical', label: 'Tampa Borda Friso Vertical',
          // Planilha mod 23: C20+(C15*2)-1 = dBFV+2*REF-1
          // qty = qtdFrisos. Quando qtdFrisos=0 (AM tipico), nao gera (qtd 0).
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso',
          // Felipe sessao 13: planilha v3 nome e' "FRISO" (nao "Friso Vertical")
          largura: ctx => 100 + ctx.eF, comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos, int: ctx => ctx.qtdFrisos,
          categoria: 'porta' },
        // Felipe sessao 14 (planilha "MODELO 23 - ACM" 1F R24-26):
        // MOLDURAS como pecas de chapa SOMENTE em revestimento ACM. Em
        // revestimento Aluminio Macico continuam como perfis Boiserie
        // (geradas em 31-perfis-porta-externa.js linhas 437-510).
        // Largura: 143mm (constante da planilha — espessura do perfil).
        //
        // Felipe sessao 14 PARTE 2: quando item.quantidadeMolduras > 1,
        // gerar molduras 2 e 3 com dimensoes reduzidas (2*dist12 ou
        // 2*dist12+2*dist23). Cada moldura interna fica dentro da anterior.
        // Labels "Moldura 1", "Moldura 2", "Moldura 3".
        //
        // MOLDURA 1 (base — sempre gerada quando qtdMolduras >= 1)
        { id: 'moldura_1_horizontal_1', label: 'Moldura 1 - Horizontal 1',
          largura: ctx => 143, comp: F.mold_horiz_1F,
          ext: F.mold_qty(1, 4), int: F.mold_qty(1, 4),
          categoria: 'porta' },
        { id: 'moldura_1_vertical_1', label: 'Moldura 1 - Vertical 1',
          largura: ctx => 143, comp: F.mold_vert_1,
          ext: F.mold_qty(1, 2), int: F.mold_qty(1, 2),
          categoria: 'porta' },
        { id: 'moldura_1_vertical_2', label: 'Moldura 1 - Vertical 2',
          largura: ctx => 143, comp: F.mold_vert_2,
          ext: F.mold_qty(1, 2), int: F.mold_qty(1, 2),
          categoria: 'porta' },
        // MOLDURA 2 (so' gerada quando qtdMolduras >= 2)
        // Dimensoes = Moldura 1 - 2*dist12
        { id: 'moldura_2_horizontal_1', label: 'Moldura 2 - Horizontal 1',
          largura: ctx => 143,
          comp: ctx => F.mold_horiz_1F(ctx) - F.mold_dec_2(ctx),
          ext: F.mold_qty(2, 4), int: F.mold_qty(2, 4),
          categoria: 'porta' },
        { id: 'moldura_2_vertical_1', label: 'Moldura 2 - Vertical 1',
          largura: ctx => 143,
          comp: ctx => F.mold_vert_1(ctx) - F.mold_dec_2(ctx),
          ext: F.mold_qty(2, 2), int: F.mold_qty(2, 2),
          categoria: 'porta' },
        { id: 'moldura_2_vertical_2', label: 'Moldura 2 - Vertical 2',
          largura: ctx => 143,
          comp: ctx => F.mold_vert_2(ctx) - F.mold_dec_2(ctx),
          ext: F.mold_qty(2, 2), int: F.mold_qty(2, 2),
          categoria: 'porta' },
        // MOLDURA 3 (so' gerada quando qtdMolduras >= 3)
        // Dimensoes = Moldura 1 - 2*dist12 - 2*dist23
        { id: 'moldura_3_horizontal_1', label: 'Moldura 3 - Horizontal 1',
          largura: ctx => 143,
          comp: ctx => F.mold_horiz_1F(ctx) - F.mold_dec_3(ctx),
          ext: F.mold_qty(3, 4), int: F.mold_qty(3, 4),
          categoria: 'porta' },
        { id: 'moldura_3_vertical_1', label: 'Moldura 3 - Vertical 1',
          largura: ctx => 143,
          comp: ctx => F.mold_vert_1(ctx) - F.mold_dec_3(ctx),
          ext: F.mold_qty(3, 2), int: F.mold_qty(3, 2),
          categoria: 'porta' },
        { id: 'moldura_3_vertical_2', label: 'Moldura 3 - Vertical 2',
          largura: ctx => 143,
          comp: ctx => F.mold_vert_2(ctx) - F.mold_dec_3(ctx),
          ext: F.mold_qty(3, 2), int: F.mold_qty(3, 2),
          categoria: 'porta' },
      ],
      '2F': [
        // Felipe (sessao 18): pecas CAVA e TAMPA_DA_CAVA REMOVIDAS de
        // vez. Sessao 14 deixou com ext:0/int:0 + sempreAM. Mod 23 e'
        // Puxador Externo + Friso Vertical + Molduras, nao tem cava.
        { id: 'tampa_maior_01', label: 'Tampa Maior 01',
          // Planilha mod 23 ACM: (E2-C7*2-C8*2)/2+10.5+C15+C15-1-C20*C22-C21*C22
          // Planilha mod 23 AM:  (E2-C7*2-C8*2)/2+15.5-C20*C22-C21*C22
          // Felipe (sessao 13, planilha 01/04/2026): AM usa +15.5 em vez de +10.5+2*REF-1.
          largura: ctx => F._ehMod23AM(ctx)
            ? F.tm_base_2f(ctx) + 15.5 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos
            : F.tm_base_2f(ctx) + 10.5 + 2*ctx.REF - 1 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 0, categoria: 'porta' },
        { id: 'tampa_maior_02', label: 'Tampa Maior 02',
          // Planilha mod 23 ACM: (E2-1-C7*2-C8*2)/2+C15+C15-28-C20*C22-C21*C22
          // Planilha mod 23 AM:  (E2-C7*2-C8*2)/2-27.5-C20*C22-C21*C22
          // Felipe (sessao 13, planilha 01/04/2026): AM usa tm_base_2f (sem -1) e -27.5.
          largura: ctx => F._ehMod23AM(ctx)
            ? F.tm_base_2f(ctx) - 27.5 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos
            : F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 1, int: 1, categoria: 'porta' },
        { id: 'tampa_maior_03', label: 'Tampa Maior 03',
          // Planilha mod 23 ACM: (E2-1-C7*2-C8*2)/2+C15+C15-28-38-C20*C22-C21*C22
          // Planilha mod 23 AM:  (E2-C7*2-C8*2)/2-27.5-43-C20*C22-C21*C22
          // Felipe (sessao 13, planilha 01/04/2026): AM usa tm_base_2f (sem -1), -27.5 e -43.
          largura: ctx => F._ehMod23AM(ctx)
            ? F.tm_base_2f(ctx) - 27.5 - 43 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos
            : F.tm_base_2f_menos1(ctx) + 2*ctx.REF - 28 - 38 - ctx.dBFV*ctx.qtdFrisos - ctx.eF*ctx.qtdFrisos,
          comp: ctx => ctx.alturaQuadro,
          ext: 0, int: 1, categoria: 'porta' },
        { id: 'tampa_borda_friso_vertical', label: 'Tampa Borda Friso Vertical',
          // Planilha mod 23: C20+(C15*2)-1, qty=C22*2
          // Felipe sessao 12: 'qtd=0 nao gera'. Quando qtdFrisos=0 (AM tipico).
          largura: ctx => ctx.dBFV + 2*ctx.REF - 1,
          comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta' },
        { id: 'friso_vertical', label: 'Friso',
          // Felipe sessao 13: planilha v3 Mod 23 nome e' "FRISO" (nao "Friso Vertical")
          largura: ctx => 100 + ctx.eF, comp: ctx => ctx.alturaQuadro,
          ext: ctx => ctx.qtdFrisos * 2, int: ctx => ctx.qtdFrisos * 2,
          categoria: 'porta' },
        // Felipe sessao 14 (planilha "MODELO 23 - ACM" 2F R26-30):
        // 5 MOLDURAS como pecas de chapa SOMENTE em ACM. Em AM continuam
        // como perfis Boiserie (geradas em 31-perfis-porta-externa.js).
        //
        // Felipe sessao 14 PARTE 2: replicacao Moldura 1/2/3 (qtdMolduras
        // 1, 2 ou 3). Cada moldura interna fica dentro da anterior,
        // dimensoes reduzidas em 2*dist12 (Moldura 2) ou 2*dist12+2*dist23
        // (Moldura 3).
        //
        // MOLDURA 1 (base)
        { id: 'moldura_1_horizontal_1', label: 'Moldura 1 - Horizontal 1',
          largura: ctx => 143, comp: F.mold_horiz_2F_1,
          ext: F.mold_qty(1, 2), int: F.mold_qty(1, 2),
          categoria: 'porta' },
        { id: 'moldura_1_horizontal_2', label: 'Moldura 1 - Horizontal 2',
          largura: ctx => 143, comp: F.mold_horiz_2F_2,
          ext: F.mold_qty(1, 4), int: F.mold_qty(1, 4),
          categoria: 'porta' },
        { id: 'moldura_1_horizontal_3', label: 'Moldura 1 - Horizontal 3',
          largura: ctx => 143, comp: F.mold_horiz_2F_3,
          ext: F.mold_qty(1, 2), int: F.mold_qty(1, 2),
          categoria: 'porta' },
        { id: 'moldura_1_vertical_1', label: 'Moldura 1 - Vertical 1',
          largura: ctx => 143, comp: F.mold_vert_1,
          ext: F.mold_qty(1, 4), int: F.mold_qty(1, 4),
          categoria: 'porta' },
        { id: 'moldura_1_vertical_2', label: 'Moldura 1 - Vertical 2',
          largura: ctx => 143, comp: F.mold_vert_2,
          ext: F.mold_qty(1, 4), int: F.mold_qty(1, 4),
          categoria: 'porta' },
        // MOLDURA 2 (qtdMolduras >= 2). Dimensoes = M1 - 2*dist12
        { id: 'moldura_2_horizontal_1', label: 'Moldura 2 - Horizontal 1',
          largura: ctx => 143,
          comp: ctx => F.mold_horiz_2F_1(ctx) - F.mold_dec_2(ctx),
          ext: F.mold_qty(2, 2), int: F.mold_qty(2, 2),
          categoria: 'porta' },
        { id: 'moldura_2_horizontal_2', label: 'Moldura 2 - Horizontal 2',
          largura: ctx => 143,
          comp: ctx => F.mold_horiz_2F_2(ctx) - F.mold_dec_2(ctx),
          ext: F.mold_qty(2, 4), int: F.mold_qty(2, 4),
          categoria: 'porta' },
        { id: 'moldura_2_horizontal_3', label: 'Moldura 2 - Horizontal 3',
          largura: ctx => 143,
          comp: ctx => F.mold_horiz_2F_3(ctx) - F.mold_dec_2(ctx),
          ext: F.mold_qty(2, 2), int: F.mold_qty(2, 2),
          categoria: 'porta' },
        { id: 'moldura_2_vertical_1', label: 'Moldura 2 - Vertical 1',
          largura: ctx => 143,
          comp: ctx => F.mold_vert_1(ctx) - F.mold_dec_2(ctx),
          ext: F.mold_qty(2, 4), int: F.mold_qty(2, 4),
          categoria: 'porta' },
        { id: 'moldura_2_vertical_2', label: 'Moldura 2 - Vertical 2',
          largura: ctx => 143,
          comp: ctx => F.mold_vert_2(ctx) - F.mold_dec_2(ctx),
          ext: F.mold_qty(2, 4), int: F.mold_qty(2, 4),
          categoria: 'porta' },
        // MOLDURA 3 (qtdMolduras >= 3). Dimensoes = M1 - 2*dist12 - 2*dist23
        { id: 'moldura_3_horizontal_1', label: 'Moldura 3 - Horizontal 1',
          largura: ctx => 143,
          comp: ctx => F.mold_horiz_2F_1(ctx) - F.mold_dec_3(ctx),
          ext: F.mold_qty(3, 2), int: F.mold_qty(3, 2),
          categoria: 'porta' },
        { id: 'moldura_3_horizontal_2', label: 'Moldura 3 - Horizontal 2',
          largura: ctx => 143,
          comp: ctx => F.mold_horiz_2F_2(ctx) - F.mold_dec_3(ctx),
          ext: F.mold_qty(3, 4), int: F.mold_qty(3, 4),
          categoria: 'porta' },
        { id: 'moldura_3_horizontal_3', label: 'Moldura 3 - Horizontal 3',
          largura: ctx => 143,
          comp: ctx => F.mold_horiz_2F_3(ctx) - F.mold_dec_3(ctx),
          ext: F.mold_qty(3, 2), int: F.mold_qty(3, 2),
          categoria: 'porta' },
        { id: 'moldura_3_vertical_1', label: 'Moldura 3 - Vertical 1',
          largura: ctx => 143,
          comp: ctx => F.mold_vert_1(ctx) - F.mold_dec_3(ctx),
          ext: F.mold_qty(3, 4), int: F.mold_qty(3, 4),
          categoria: 'porta' },
        { id: 'moldura_3_vertical_2', label: 'Moldura 3 - Vertical 2',
          largura: ctx => 143,
          comp: ctx => F.mold_vert_2(ctx) - F.mold_dec_3(ctx),
          ext: F.mold_qty(3, 4), int: F.mold_qty(3, 4),
          categoria: 'porta' },
      ],
    },
  };

  // ------------------------------------------------------------------
  // GERADOR PRINCIPAL
  // ------------------------------------------------------------------
  function gerarPecasChapa(item, lado) {
    if (!item || item.tipo !== 'porta_externa') return [];
    if (lado !== 'externo' && lado !== 'interno') {
      throw new Error('gerarPecasChapa: lado deve ser "externo" ou "interno"');
    }
    const quadro = calcularQuadro(item);
    if (!quadro) return [];
    if (quadro.nFolhas !== 1 && quadro.nFolhas !== 2) return [];

    const ctx = construirContexto(item, lado, quadro);

    const modeloDoLado = (lado === 'externo')
      ? Number(item.modeloExterno || item.modeloNumero) || 0
      : Number(item.modeloInterno || item.modeloNumero) || 0;

    const tabelaModelo = TABELA[modeloDoLado];
    if (!tabelaModelo) return [];

    const variant = quadro.nFolhas === 2 ? '2F' : '1F';
    const pecasModelo = tabelaModelo[variant] || [];
    if (pecasModelo.length === 0) return [];

    const universais = pecasUniversais(variant);
    const todasPecas = [...pecasModelo, ...universais];

    return materializar(todasPecas, ctx, modeloDoLado);
  }

  function materializar(pecasDef, ctx, modelo) {
    const out = [];
    const qtdItem = Math.max(1, parseInt(ctx.item?.quantidade, 10) || 1);
    const corDoLado = (ctx.lado === 'externo') ? ctx.corExt : ctx.corInt;

    // Felipe sessao 12 - Modelo 23 + Aluminio Macico:
    // Detecta o caso especial (modelo=23 E revestimento='Aluminio Macico 2mm').
    // Quando ativo:
    //   - 'Tampa' qualquer (Tampa Maior, Tampa Maior 01/02/03, Tampa Maior
    //     Cava, Tampa da Cava, Tampa Borda Friso Vertical) -> chapa de
    //     ALUMINIO MACICO (categoria propria, separa no aproveitamento)
    //   - 'Fita Acabamento' (Menor/Maior/Largura) -> ALUMINIO MACICO
    //   - 'Friso Vertical' / 'Tampa Borda Friso Vertical' continuam mas
    //     com qtd 0 quando qtdFrisos=0 (regra Felipe: 'quando tiver qtd
    //     igual a 0 deixe zero pq tem uma formula ali, se tiver friso
    //     com qtd > 1 traga tudo')
    //   - 'L da Cava' / 'Cava' continuam ACM
    //   - Acabamento Lateral, Batente, U Portal, Tampa Furo, Alisar
    //     continuam ACM
    //   - Molduras (Moldura Horizontal/Vertical) NAO sao geradas como
    //     pecas de chapa - viram perfis Boiserie em 31-perfis-porta-externa.js
    //   - Tampa Final / Tampa+REF (modelo 23 ACM) tambem nao mais geradas
    const ehMod23 = Number(modelo) === 23;
    const rev = String(ctx.item?.revestimento || '').toLowerCase();
    const ehAluminioMacico = ehMod23
      && /aluminio.*macico/.test(rev)
      && /2\s*mm/.test(rev);

    for (let _idx = 0; _idx < pecasDef.length; _idx++) {
      const def = pecasDef[_idx];
      const qtyExt = (typeof def.ext === 'function') ? def.ext(ctx) : (def.ext || 0);
      const qtyInt = (typeof def.int === 'function') ? def.int(ctx) : (def.int || 0);
      const qtyFace = (ctx.lado === 'externo') ? qtyExt : qtyInt;

      const larg = (typeof def.largura === 'function') ? def.largura(ctx) : def.largura;
      const comp = (typeof def.comp === 'function') ? def.comp(ctx) : def.comp;

      // Felipe sessao 14: 'as pecas que tem o refilado podedria ao lado me
      // dar a peca seca, sem o aumento do refilado? pelo menos nas tampas?
      // verifique nas formulas aonde tem refilado pode ser que tenha peca
      // que so tem uma ref e nao 2 ref'.
      // Solucao elegante: roda a mesma formula com ctx.REF=0 e compara.
      // Diferenca = quanto REF foi aplicado naquela dimensao (0/1/2 vezes).
      // Funciona pra QUALQUER peca, sem precisar marcar def por def.
      const ctxSemRef = Object.assign({}, ctx, { REF: 0 });
      const largSemRef = (typeof def.largura === 'function') ? def.largura(ctxSemRef) : def.largura;
      const compSemRef = (typeof def.comp === 'function') ? def.comp(ctxSemRef) : def.comp;

      // Felipe sessao 12: regra geral 'quantidade 0 deixa fora'.
      // Apenas o caso modo=Aluminio Macico de TAMPA_BORDA_FRISO_VERTICAL e FRISO
      // pode ter qtd 0 quando qtdFrisos vazio - e sao essas peças que
      // nao entram (qtd 0 = peça inexistente). Mantemos o filtro qtyFace<=0.
      if (qtyFace <= 0) continue;
      if (!larg || larg <= 0 || !comp || comp <= 0) continue;

      let corResolvida = (def.ehDaCava && ctx.corCava) ? ctx.corCava : corDoLado;
      let categoria = def.categoria || 'porta';
      // Felipe sessao 13: PRESERVA categoria original (porta/portal/etc).
      // Antes, pecas AM viravam categoria='aluminio_macico' — Felipe pediu
      // pra manter porta/portal e usar a flag materialEspecial pra rastrear.
      // Lógica de PEÇA AM:
      //   1. CAVA / L_DA_CAVA / Tampa da Cava (sempreAM=true) -> AM
      //   2. FIT_ACAB_*: SEMPRE AM no Mod 23 (ACM ou AM)
      //   3. Tampa Maior/Borda/Da: AM SO' quando porta toda e' AM (Mod23 AM)
      const lblLow = String(def.label || '').toLowerCase();
      const ehFitaAcab = /^fita\s*acabamento\b/.test(lblLow);
      // Felipe sessao 13 (planilha v3): pecas que viram AM quando a porta
      // e' AM sao especificamente Tampa Maior, Tampa Borda Friso Vertical
      // e Tampa da Cava — NAO 'Tampa de Furo' (TAP_FURO), que e' perfil
      // ACM normal mesmo no Mod 23 AM (planilha aba ALUMINIO MACICO R18
      // mat=None). Regex anterior /^tampa\b/ pegava 'Tampa de Furo'
      // erradamente.
      const labelComecaTampa = /^tampa\s+(maior|borda|da)\b/.test(lblLow);

      // Decide se ESSA peça e' AM (vai usar chapa AM, prefixo "Aluminio Macico —"):
      // Felipe sessao 14: regra anterior "ehMod23 && ehFitaAcab" colocava
      // FIT_ACAB_* como AM em Mod23 ACM tambem — bug. Planilha
      // "MODELO 23 - ACM" lista FIT_ACAB sem flag AM (tudo ACM); apenas
      // "MODELO 23 - ALUMINIO MACICO" marca FIT_ACAB como ALUMINIO MACICO.
      // Trocado pra ehAluminioMacico (Mod23 + revestimento AM 2mm).
      let ehPecaAM = false;
      if (def.sempreAM)                                          ehPecaAM = true;
      else if (ehAluminioMacico && ehFitaAcab)                   ehPecaAM = true;
      else if (ehAluminioMacico && labelComecaTampa)             ehPecaAM = true;

      if (ehPecaAM) {
        // Felipe sessao 13: peca AM usa cor da CHAPA AM (campo separado
        // corChapaAM_Ext/Int), nao a corExterna/corInterna que e' chapa ACM.
        //
        // Felipe (sessao 2026-05-10): BUGFIX - quebrava agrupamento.
        // Sintoma: 2 chapas pretas texturizadas em layouts SEPARADOS no
        // aproveitamento - uma como "Aluminio Macico — <cor completa>"
        // e outra como "Aluminio Macico" (genérico).
        //
        // Causa: quando corAM_<lado> esta vazio (ex: corAM_Int vazio mas
        // corAM_Ext preenchido, OU peca da Cava sempreAM sem cor AM
        // preenchida), o fallback 'Aluminio Macico' criava um grupo
        // FANTASMA que nunca casava com a cor real do outro lado/peca.
        //
        // Pedido Felipe: "sempre que tiver a mesma cor deve fazer
        // aproveitamento de chapas juntos" (mesmo comentario ja no
        // codigo - linha 1654).
        //
        // FIX: cascata de fallbacks pra SEMPRE pegar a cor real:
        //   1. cor AM do lado atual (corAM_Ext ou corAM_Int)
        //   2. cor AM do OUTRO lado (porta com cor AM so' num lado)
        //   3. corCava (Cava sempreAM sem cor AM preenchida)
        //   4. corExt/corInt do lado (compatibilidade com cor unica
        //      ja usada por outras pecas - PORTA TODA mesma cor)
        //   5. UNICO caso que vira 'Aluminio Macico' generico: NENHUMA
        //      cor preenchida em LUGAR NENHUM. Ainda assim e' so' 1
        //      grupo por orcamento, nao 2.
        const corAM_Lado    = ctx.lado === 'externo' ? ctx.corAM_Ext : ctx.corAM_Int;
        const corAM_OutroLado = ctx.lado === 'externo' ? ctx.corAM_Int : ctx.corAM_Ext;
        const corAlternativa = corAM_Lado
          || corAM_OutroLado
          || (def.ehDaCava ? ctx.corCava : '')
          || corDoLado
          || '';
        corResolvida = corAlternativa
          ? `Aluminio Macico — ${corAlternativa}`
          : 'Aluminio Macico';
        // categoria MANTEM def.categoria (porta/portal) — Felipe: 'mantenha
        // o que e porta e portal isso voce tirou'.
      }
      // Felipe sessao 14: REMOVIDO prefixo "ACM —" das pecas nao-AM em
      // Mod23+AM. O prefixo separava do AM (que ja tem prefixo proprio
      // "Aluminio Macico —"), mas tambem QUEBRAVA o agrupamento com pecas
      // ACM de outros itens (porta normal, fixo, revestimento) da mesma
      // cor real. Pedido Felipe: "independente do item, sempre que tiver
      // a mesma cor deve fazer aproveitamento de chapas juntos".
      // Pecas AM continuam prefixadas (chapa-mae diferente). Pecas ACM
      // ficam com cor pura -> agrupam com tudo.

      const pecaBase = {
        id: def.id,
        label: def.label,
        labelCompleto: `${def.label} — ${ctx.lado === 'externo' ? 'Externo' : 'Interno'}${corResolvida ? ` (${corResolvida})` : ''}`,
        largura: Math.round(larg * 100) / 100,
        altura:  Math.round(comp * 100) / 100,
        // Felipe sessao 14: medidas SECAS (sem REF) — pra exibir ao lado
        // da medida com refilado no Lev. Superficies. Se larguraSemRef ===
        // largura, peca nao tem REF nessa dimensao.
        larguraSemRef: Math.round(largSemRef * 100) / 100,
        alturaSemRef:  Math.round(compSemRef * 100) / 100,
        qtd:     Math.round(qtyFace) * qtdItem,
        podeRotacionar: false,
        cor:     corResolvida,
        lado:    ctx.lado,
        ehDaCava: !!def.ehDaCava,
        categoria: categoria,
        modelo,
        // Felipe sessao 13: _ordem preserva indice na lista pecasDef
        // (ordem da planilha). Usado por unificarPecas em 12-orcamento.js
        // pra preservar a sequencia exata da planilha (nao reordenar
        // por categoria que misturava AM no fim).
        _ordem: _idx,
        materialEspecial: ehPecaAM ? 'AM' : null,
        observacao: def.observacao || '',
      };

      // Felipe sessao 14: Mod 23 + AM, peca cuja largura estoura a chapa
      // (1500mm - 5mm aparar = 1490 util) precisa ser PARTIDA em 3 pedacos:
      //   2 laterais (largura = distanciaBorda1aMoldura) + 1 centro
      //   (largura = original - 2*distBorda).
      // Como cada face e' chamada separada (externo/interno), 2 laterais por
      // face viram total 4 por porta, e 2 centros (1 por face). Felipe:
      // 'pegue 1800 menos 150 menos 150 = 1500. Frente e verso, 4 vezes 150
      // de complemento mais 2 chapas de 1500 no meio'.
      const _splitOk = _splitPecaAMOversize(pecaBase, ctx.item, out);
      if (!_splitOk) {
        out.push(pecaBase);
      }
    }
    return out;
  }

  /**
   * Felipe sessao 14: divide peca AM cuja largura estoura a chapa
   * (1500mm - 2*APARAR_NEST = 1490 util) em 3 pedacos: 2 laterais + 1 centro.
   * Lateral usa item.distanciaBorda1aMoldura. Centro = larg - 2*distBorda.
   *
   * Aplica apenas em peca.materialEspecial === 'AM' E peca.largura > 1490.
   * Se nao precisar split, retorna false (caller faz push original).
   * Se split foi feito, faz push das 2 partes (lateral qtd*2 + centro qtd) e
   * retorna true.
   *
   * Sem distanciaBorda1aMoldura preenchido: nao split (caller faz push
   * inteira; motor de nesting vai sinalizar que nao cabe).
   */
  function _splitPecaAMOversize(peca, item, out) {
    // Constantes do limite. Mantidas como const local pra fix cirurgico
    // sem mexer em 34-regras.js. APARAR_NEST atual default = 5mm por borda.
    const LARGURA_CHAPA_AM = 1500;
    const APARAR_BORDA = 5;
    const LIMITE_UTIL = LARGURA_CHAPA_AM - 2 * APARAR_BORDA; // 1490
    if (peca.materialEspecial !== 'AM') return false;
    if (Number(peca.largura) <= LIMITE_UTIL) return false;
    const distBorda = Number(item && item.distanciaBorda1aMoldura) || 0;
    if (distBorda <= 0) return false;
    const larguraCentro = Number(peca.largura) - 2 * distBorda;
    if (larguraCentro <= 0) return false;
    if (larguraCentro > LIMITE_UTIL) {
      console.warn('[Chapas Mod23 AM] Peca "' + peca.label + '" largura=' +
        peca.largura + ' apos split centro=' + larguraCentro +
        ' > limite ' + LIMITE_UTIL +
        '. Aumente "Distancia da borda a 1a moldura" pra >= ' +
        Math.ceil((Number(peca.largura) - LIMITE_UTIL) / 2) + 'mm.');
    }
    const qtdOriginal = Number(peca.qtd) || 0;
    // Felipe sessao 14: lateral nao tem REF — sao apenas pedacos cortados
    // da peca original. larguraSemRef = largura. Centro herda a logica:
    // tira os 2*distBorda do larguraSemRef original tbm. Se larguraSemRef
    // === largura (peca sem REF), ambos ficam igual.
    const larguraSemRefOriginal = Number(peca.larguraSemRef) || Number(peca.largura) || 0;
    const larguraCentroSemRef = Math.max(0, larguraSemRefOriginal - 2 * distBorda);
    // Lateral: 1 peca com qtd*2 (2 laterais por face)
    out.push(Object.assign({}, peca, {
      label: peca.label + ' (Lateral)',
      labelCompleto: (peca.labelCompleto || '').replace(peca.label, peca.label + ' (Lateral)'),
      largura: distBorda,
      larguraSemRef: distBorda,
      qtd: qtdOriginal * 2,
      _splitOrigem: peca.label,
      _splitTipo: 'lateral',
    }));
    // Centro: 1 peca com qtd igual
    out.push(Object.assign({}, peca, {
      label: peca.label + ' (Centro)',
      labelCompleto: (peca.labelCompleto || '').replace(peca.label, peca.label + ' (Centro)'),
      largura: larguraCentro,
      larguraSemRef: larguraCentroSemRef,
      qtd: qtdOriginal,
      _splitOrigem: peca.label,
      _splitTipo: 'centro',
    }));
    return true;
  }

  function descreverQuadro(item) {
    const q = calcularQuadro(item);
    if (!q) return 'Sem medidas';
    const fam = q.familia === '76' ? 'PA-006F' : 'PA-007F';
    return `${q.larguraQuadro}×${q.alturaQuadro} mm (família ${fam}, ${q.nFolhas} folha${q.nFolhas > 1 ? 's' : ''})`;
  }

  return {
    calcularQuadro,
    gerarPecasChapa,
    obterFamilia,
    descreverQuadro,
    getVarsFam,
    getVarsChapas,
    VARS_FAM_DEFAULT,
    VARS_CHAPAS_DEFAULT,
    _TABELA: TABELA,
    _F: F,
    _construirContexto: construirContexto,
  };
})();

if (typeof window !== 'undefined') {
  window.ChapasPortaExterna = ChapasPortaExterna;
}
