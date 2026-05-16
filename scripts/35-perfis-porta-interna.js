/* 35-perfis-porta-interna.js — Regras de calculo de perfis da PORTA INTERNA.

   ESTE MODULO E' EXCLUSIVO DA PORTA INTERNA. Felipe vai passar as regras
   item por item; cada perfil novo eh um commit isolado.

   Saida esperada (igual aos outros motores):
     gerarCortes(item) → { 'PA-XXX': [{ comp, qty, label }, ...] }

   ESTADO ATUAL (sessao 31):
     [x] Batente (PA-BATENTEINT)        — 2 verticais + 1 horizontal
     [x] Click do Batente (PA-CLICKBTINT)— 2 verticais + 1 horizontal
     [x] Folha (PA-FLHINT)              — 2 verticais + 1 horizontal superior
     [x] Click da Folha (PA-CLICKFLHINT)— 2 verticais (mesma formula vertical da folha)
     [ ] Travessas (PA-46X46X1.5)
     [ ] Alisar (PA-ALISARINT) — se aplicavel
     [ ] Vedacao (PA-VEDAINT)  — se aplicavel
*/

const PerfisPortaInterna = (() => {

  // Aceita BR ("2139,5") ou EN ("2139.5"). Fallback se parseBR nao carregou.
  function _toNum(v) {
    if (typeof window !== 'undefined' && window.parseBR) return window.parseBR(v);
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).trim().replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  /**
   * Helper: emite cortes batendo a fronteira da barra padrao.
   * Por enquanto naive (1 corte = 1 peca); se Felipe quiser otimizacao
   * de aproveitamento de barra eu engancho depois.
   */
  function _add(cortes, codigo, comp, qty, label) {
    if (!cortes[codigo]) cortes[codigo] = [];
    cortes[codigo].push({ comp: Math.round(comp), qty: qty, label: label });
  }

  /**
   * Gera cortes da porta interna.
   *
   * Felipe sessao 31 — Folgas UNIFICADAS (igual porta externa):
   *   - fglEsq (folga lateral esquerda) — default 5
   *   - fglDir (folga lateral direita)  — default 5
   *   - fgSup  (folga superior)         — default 5
   * Convencao: peças HORIZONTAIS descontam fglEsq + fglDir.
   *            peças VERTICAIS   descontam fgSup.
   *
   * Quantidade multiplica por item.quantidade (varias portas iguais).
   */
  function gerarCortes(item) {
    if (!item || item.tipo !== 'porta_interna') return {};

    const larguraVao = _toNum(item.largura);
    const alturaVao  = _toNum(item.altura);
    if (larguraVao <= 0 || alturaVao <= 0) return {};

    const qtdPortas = Math.max(1, Number(item.quantidade) || 1);

    // Folgas unificadas. Fallback 5 quando vazio/null/undefined.
    const fglEsq = _toNum(item.fglEsq != null && item.fglEsq !== '' ? item.fglEsq : 5);
    const fglDir = _toNum(item.fglDir != null && item.fglDir !== '' ? item.fglDir : 5);
    const fgSup  = _toNum(item.fgSup  != null && item.fgSup  !== '' ? item.fgSup  : 5);

    // Reaproveitamento dos descontos de folga por orientacao
    const descontoLarg = fglEsq + fglDir;  // peças horizontais
    const descontoAlt  = fgSup;             // peças verticais

    const cortes = {};

    // ===== BATENTE (PA-BATENTEINT) =====
    //   - 1 horizontal (topo): largura - (fglEsq+fglDir)
    //   - 2 verticais (lateral): altura - fgSup
    // (Defaults 5+5+5 -> -10 e -5 = comportamento original.)
    const compBatHor = larguraVao - descontoLarg;
    const compBatVer = alturaVao  - descontoAlt;
    if (compBatHor > 0) {
      _add(cortes, 'PA-BATENTEINT', compBatHor, 1 * qtdPortas, 'Batente horizontal (topo)');
    }
    if (compBatVer > 0) {
      _add(cortes, 'PA-BATENTEINT', compBatVer, 2 * qtdPortas, 'Batente vertical (lateral)');
    }

    // ===== CLICK DO BATENTE (PA-CLICKBTINT) =====
    //   - 1 horizontal: largura - (fglEsq+fglDir) - 21,5 - 21,5
    //   - 2 verticais : altura  - fgSup           - 21,5
    const compClickBatHor = larguraVao - descontoLarg - 21.5 - 21.5;
    const compClickBatVer = alturaVao  - descontoAlt  - 21.5;
    if (compClickBatHor > 0) {
      _add(cortes, 'PA-CLICKBTINT', compClickBatHor, 1 * qtdPortas, 'Click batente horizontal (topo)');
    }
    if (compClickBatVer > 0) {
      _add(cortes, 'PA-CLICKBTINT', compClickBatVer, 2 * qtdPortas, 'Click batente vertical (lateral)');
    }

    // ===== FOLHA (PA-FLHINT) =====
    //   - 1 horizontal (topo): largura - (fglEsq+fglDir) - 24,5 - 24,5
    //   - 2 verticais (lateral): altura - fgSup - 24,5 - 10
    const compFlhHor = larguraVao - descontoLarg - 24.5 - 24.5;
    const compFlhVer = alturaVao  - descontoAlt  - 24.5 - 10;
    if (compFlhHor > 0) {
      _add(cortes, 'PA-FLHINT', compFlhHor, 1 * qtdPortas, 'Folha horizontal (topo)');
    }
    if (compFlhVer > 0) {
      _add(cortes, 'PA-FLHINT', compFlhVer, 2 * qtdPortas, 'Folha vertical (lateral)');
    }

    // ===== CLICK DA FOLHA (PA-CLICKFLHINT) =====
    //   - 2 verticais: mesma formula do vertical da folha
    if (compFlhVer > 0) {
      _add(cortes, 'PA-CLICKFLHINT', compFlhVer, 2 * qtdPortas, 'Click da folha vertical');
    }

    return cortes;
  }

  function descricaoItem(item) {
    const dim = `${item.largura || '?'}×${item.altura || '?'}mm`;
    return `Porta Interna, ${dim}`;
  }

  return { gerarCortes, descricaoItem };
})();
window.PerfisPortaInterna = PerfisPortaInterna;
