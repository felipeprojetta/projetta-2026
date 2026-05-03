/* 30-perfis-core.js — Helpers genericos de calculo de perfis.

   ESTE MODULO NAO TEM REGRAS DE ITEM. Aqui ficam SOMENTE funcionalidades
   que servem pra qualquer tipo de item (porta externa, interna, fixo,
   revestimento de parede, etc.):

     - Constantes de corte (KERF, END_WASTE)
     - Tamanho de barra pelo sufixo do codigo (-6M/-7M/-8M)
     - Espessura do revestimento (extracao numerica)
     - Emenda (divide cortes maiores que a barra util)
     - FFD bin packing (compartilha barras entre cortes)
     - Calculo de custo por codigo (kg bruto x R$/kg)
     - Calculo agregado (multi-codigo)

   Cada motor de item (31-porta-externa, 32-porta-interna, etc.) usa
   estes helpers mas mantem suas formulas, codigos e quantidades 100%
   isoladas. Adicionar regra a um item NAO altera os outros.
*/

const PerfisCore = (() => {
  // ---------------------------------------------------------
  // Constantes universais (Felipe)
  // ---------------------------------------------------------
  const KERF = 4;                    // mm de perda por corte (disco de serra)
  const END_WASTE = 10;              // mm de perda na ponta da barra
  const PRECO_BOISERIE_BARRA = 150;  // R$ fixo por barra (ja com pintura)
  const COD_BOISERIE = 'PA-PERFILBOISERIE';

  // ---------------------------------------------------------
  // Tamanho de barra pelo sufixo do codigo
  // ---------------------------------------------------------
  /**
   * -7M no codigo → 7000mm | -8M → 8000mm | default → 6000mm.
   */
  function tamanhoBarraPorCodigo(codigo) {
    const c = String(codigo || '').toUpperCase();
    if (/-7M\b|-7M$/.test(c)) return 7000;
    if (/-8M\b|-8M$/.test(c)) return 8000;
    return 6000;
  }

  /** Sufixo da barra pelo comprimento do corte. */
  function sufixoBarraPorComp(comp) {
    if (comp > 7000) return '-8M';
    if (comp > 6000) return '-7M';
    return '-6M';
  }

  /** Espessura do revestimento em mm, extraida da string ("ACM 4mm" → 4). */
  function espessuraRevestimento(rev) {
    const m = String(rev || '').match(/(\d+(?:[.,]\d+)?)\s*mm/i);
    return m ? parseFloat(m[1].replace(',', '.')) : 4;
  }

  // ---------------------------------------------------------
  // Emenda — divide um corte que nao cabe na barra util
  // ---------------------------------------------------------
  /**
   * Se o comprimento excede (barLen - END_WASTE), divide em pedacos
   * que cabem na barra util. Devolve { pedacos, emenda, label }.
   */
  function dividirEmEmenda(compMM, barLen) {
    const util = barLen - END_WASTE;
    if (compMM <= util) return { pedacos: [compMM], emenda: false, label: '' };

    const pedacos = [];
    const MAX_PEDACO = util;
    let restante = compMM;
    while (restante > MAX_PEDACO) {
      pedacos.push(MAX_PEDACO);
      restante -= MAX_PEDACO;
    }
    if (restante > 0) pedacos.push(restante);

    return {
      pedacos,
      emenda: true,
      label: `(emenda: ${pedacos.join('+')}mm)`,
    };
  }

  // ---------------------------------------------------------
  // FFD (First Fit Decreasing) bin packing
  // ---------------------------------------------------------
  /**
   * Empacota cortes em barras de tamanho `barLen` minimizando barras.
   * Ordena cortes do MAIOR pro menor; cada corte tenta encaixar na
   * primeira barra que ainda comporta (considera kerf entre cortes).
   * Se nao cabe em nenhuma, abre barra nova.
   *
   * Cada corte pode ser um numero (apenas comprimento) ou um objeto
   * { comp, label, itemRef } — o objeto e' preservado nos bins.
   *
   * @param {Array} cortes  — comprimentos ou objetos { comp, ... }
   * @param {number} barLen — tamanho da barra (mm)
   * @returns {object[]} bins — [{ cortes: [...], usado, sobra }]
   */
  function binPackFFD(cortes, barLen) {
    const util = barLen - END_WASTE;

    // Normaliza para sempre ter um objeto { comp, ... }
    const norm = cortes.map(c => (typeof c === 'number') ? { comp: c } : c);
    const ordenados = norm.slice().sort((a, b) => b.comp - a.comp);
    const bins = [];

    for (const c of ordenados) {
      let coloquei = false;
      for (const b of bins) {
        const adicionalKerf = b.cortes.length > 0 ? KERF : 0;
        if (b.usado + adicionalKerf + c.comp <= util) {
          b.cortes.push(c);
          b.usado += adicionalKerf + c.comp;
          coloquei = true;
          break;
        }
      }
      if (!coloquei) {
        bins.push({ cortes: [c], usado: c.comp, sobra: 0 });
      }
    }
    bins.forEach(b => { b.sobra = util - b.usado; });
    return bins;
  }

  // ---------------------------------------------------------
  // Calcula custo de UM codigo a partir de seus cortes
  // ---------------------------------------------------------
  /**
   * Multiplica qty antes de empacotar (regra: multiplicacao antes de
   * otimizar). Aplica emenda. Empacota com FFD. Devolve metricas e
   * custo por kg bruto.
   *
   * @param {object} args
   *   codigo, kgPorMetro, precoPorKg, precoKgPintura
   *   cortes — [{ comp, qty, label, itemRef? }]
   */
  function calcularPerfilCodigo(args) {
    const codigo  = String(args.codigo || '').toUpperCase();
    const kgM     = Number(args.kgPorMetro)     || 0;
    const rkg     = Number(args.precoPorKg)     || 0;
    const rkgPint = Number(args.precoKgPintura) || 0;
    const ehBoiserie = (codigo === COD_BOISERIE);
    const barLen = tamanhoBarraPorCodigo(codigo);

    // Expande qty antes de empacotar
    const cortesExpandidos = [];
    (args.cortes || []).forEach(c => {
      const compMM = Number(c.comp) || 0;
      const qty    = Math.max(1, Number(c.qty) || 1);
      const div    = dividirEmEmenda(compMM, barLen);
      for (let i = 0; i < qty; i++) {
        div.pedacos.forEach(p => {
          cortesExpandidos.push({
            comp: p,
            label: c.label || '',
            itemRef: c.itemRef || null,
            emenda: div.emenda,
          });
        });
      }
    });

    if (cortesExpandidos.length === 0) {
      return {
        codigo, barLen, nBars: 0, totUsed: 0, totBruto: 0,
        aproveitamento: 0, kgLiq: 0, kgBruto: 0,
        custoPerfil: 0, custoPintura: 0, custoTotal: 0, bins: [],
      };
    }

    const bins    = binPackFFD(cortesExpandidos, barLen);
    const nBars   = bins.length;
    const totUsed = cortesExpandidos.reduce((s, c) => s + c.comp, 0);
    const totBruto= nBars * barLen;
    const aproveitamento = totBruto > 0 ? (totUsed / totBruto) * 100 : 0;
    const kgLiq   = (totUsed  / 1000) * kgM;
    const kgBruto = (totBruto / 1000) * kgM;

    let custoPerfil, custoPintura;
    if (ehBoiserie) {
      custoPerfil  = nBars * PRECO_BOISERIE_BARRA;
      custoPintura = 0;
    } else {
      custoPerfil  = kgBruto * rkg;
      custoPintura = rkgPint > 0 ? (kgBruto * rkgPint) : 0;
    }
    const custoTotal = custoPerfil + custoPintura;

    return {
      codigo, barLen, nBars, totUsed, totBruto,
      aproveitamento, kgLiq, kgBruto,
      custoPerfil, custoPintura, custoTotal, bins,
    };
  }

  // ---------------------------------------------------------
  // Calculo agregado por codigo (varios itens compartilhando barras)
  // ---------------------------------------------------------
  /**
   * cortesPorCodigo: { 'PA-XXX': [{ comp, qty, label, itemRef? }, ...] }
   * perfisCadastro:  { 'PA-XXX': { kgPorMetro, precoPorKg, precoKgPintura } }
   *
   * Cada codigo eh calculado independentemente; o FFD compartilha
   * barras entre cortes do MESMO codigo (perfil) — nunca entre codigos
   * diferentes (e' fisicamente impossivel cortar perfil PA-101 de
   * uma barra de PA-076).
   */
  function calcularPorCodigo(cortesPorCodigo, perfisCadastro) {
    const result = {
      itens: [],
      custoPerfis:  0,
      custoPintura: 0,
      custoTotal:   0,
      kgLiqTotal:   0,
      kgBrutoTotal: 0,
    };
    for (const codigo in cortesPorCodigo) {
      const cad = (perfisCadastro && perfisCadastro[codigo]) || {};
      const r = calcularPerfilCodigo({
        codigo,
        cortes: cortesPorCodigo[codigo],
        kgPorMetro:    cad.kgPorMetro    || 0,
        precoPorKg:    cad.precoPorKg    || 0,
        precoKgPintura: cad.precoKgPintura || 0,
      });
      result.itens.push(r);
      result.custoPerfis  += r.custoPerfil;
      result.custoPintura += r.custoPintura;
      result.custoTotal   += r.custoTotal;
      result.kgLiqTotal   += r.kgLiq;
      result.kgBrutoTotal += r.kgBruto;
    }
    return result;
  }

  return {
    KERF, END_WASTE, PRECO_BOISERIE_BARRA, COD_BOISERIE,
    tamanhoBarraPorCodigo,
    sufixoBarraPorComp,
    espessuraRevestimento,
    dividirEmEmenda,
    binPackFFD,
    calcularPerfilCodigo,
    calcularPorCodigo,
  };
})();
window.PerfisCore = PerfisCore;
