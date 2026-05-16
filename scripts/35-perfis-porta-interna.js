/* 35-perfis-porta-interna.js — Regras de calculo de perfis da PORTA INTERNA.

   ESTE MODULO E' EXCLUSIVO DA PORTA INTERNA. Felipe vai passar as regras
   item por item; cada perfil novo eh um commit isolado.

   Saida esperada (igual aos outros motores):
     gerarCortes(item) → { 'PA-XXX': [{ comp, qty, label }, ...] }

   ESTADO ATUAL (sessao 31):
     [x] Batente (PA-BATENTEINT)        — PORTAL: 2 verticais + 1 horizontal
     [x] Click do Batente (PA-CLICKBTINT)— PORTAL: 2 verticais + 1 horizontal
     [x] Folha (PA-FLHINT)              — FOLHA:  2 verticais + 1 horizontal superior
     [x] Click da Folha (PA-CLICKFLHINT)— FOLHA:  2 verticais + 1 horizontal
     [x] Alisar (PA-ALISARINT)          — PORTAL: 4 verticais + 2 horizontais
     [ ] Travessas (PA-46X46X1.5)
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
   *
   * Felipe sessao 31: secao opcional ('folha' default, ou 'portal').
   * Quem consome (12-orcamento.js) usa esse campo pra separar a peca
   * na tabela do Levantamento de Perfis. Batente e Click Batente fazem
   * parte do MARCO (portal), nao da folha.
   */
  function _add(cortes, codigo, comp, qty, label, secao) {
    if (!cortes[codigo]) cortes[codigo] = [];
    const peca = { comp: Math.round(comp), qty: qty, label: label };
    if (secao) peca.secao = secao;
    cortes[codigo].push(peca);
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

    // ===== BATENTE (PA-BATENTEINT) — PORTAL =====
    // Felipe sessao 31 (correcao): batente envolve o vao POR FORA, com
    // overlap de 21,5 nas pontas onde encosta nos verticais.
    //   - 1 horizontal (topo): largura_vao + 21,5 + 21,5
    //   - 2 verticais (lateral): altura_vao + 21,5 (so' overlap no topo,
    //     base toca no chao)
    // NAO usa folgas (fglEsq/fglDir/fgSup) - medida e' o vao + sobras.
    const compBatHor = larguraVao + 21.5 + 21.5;
    const compBatVer = alturaVao  + 21.5;
    if (compBatHor > 0) {
      _add(cortes, 'PA-BATENTEINT', compBatHor, 1 * qtdPortas, 'Batente horizontal (topo)', 'portal');
    }
    if (compBatVer > 0) {
      _add(cortes, 'PA-BATENTEINT', compBatVer, 2 * qtdPortas, 'Batente vertical (lateral)', 'portal');
    }

    // ===== CLICK DO BATENTE (PA-CLICKBTINT) — PORTAL =====
    //   - 1 horizontal: largura - (fglEsq+fglDir) - 21,5 - 21,5
    //   - 2 verticais : altura  - fgSup           - 21,5
    const compClickBatHor = larguraVao - descontoLarg - 21.5 - 21.5;
    const compClickBatVer = alturaVao  - descontoAlt  - 21.5;
    if (compClickBatHor > 0) {
      _add(cortes, 'PA-CLICKBTINT', compClickBatHor, 1 * qtdPortas, 'Click batente horizontal (topo)', 'portal');
    }
    if (compClickBatVer > 0) {
      _add(cortes, 'PA-CLICKBTINT', compClickBatVer, 2 * qtdPortas, 'Click batente vertical (lateral)', 'portal');
    }

    // ===== FOLHA (PA-FLHINT) — FOLHA =====
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

    // ===== CLICK DA FOLHA (PA-CLICKFLHINT) — FOLHA =====
    //   - 1 horizontal: mesma formula da folha horizontal (1 unidade)
    //   - 2 verticais: mesma formula do vertical da folha
    if (compFlhHor > 0) {
      _add(cortes, 'PA-CLICKFLHINT', compFlhHor, 1 * qtdPortas, 'Click da folha horizontal (topo)');
    }
    if (compFlhVer > 0) {
      _add(cortes, 'PA-CLICKFLHINT', compFlhVer, 2 * qtdPortas, 'Click da folha vertical');
    }

    // ===== ALISAR (PA-ALISARINT) — PORTAL =====
    // Felipe sessao 31: 'sera 4 pecas de 59.5 mm x altura do vao + 100,
    //                    sera 2 pecas de 59,5 x largura do vao +100'
    // O 59,5mm e' a LARGURA do perfil (caracteristica), nao o corte.
    // Cortes:
    //   - 4 verticais (lateral): altura_vao + 100
    //   - 2 horizontais (topo):  largura_vao + 100
    // Como nao usa folgas (medida = vao + 100), nao depende de fglEsq/fglDir/fgSup.
    const compAlisarVer = alturaVao  + 100;
    const compAlisarHor = larguraVao + 100;
    if (compAlisarVer > 0) {
      _add(cortes, 'PA-ALISARINT', compAlisarVer, 4 * qtdPortas, 'Alisar vertical (lateral)', 'portal');
    }
    if (compAlisarHor > 0) {
      _add(cortes, 'PA-ALISARINT', compAlisarHor, 2 * qtdPortas, 'Alisar horizontal (topo)', 'portal');
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
