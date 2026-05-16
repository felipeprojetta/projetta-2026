/* 35-perfis-porta-interna.js — Regras de calculo de perfis da PORTA INTERNA.

   ESTE MODULO E' EXCLUSIVO DA PORTA INTERNA. Felipe vai passar as regras
   item por item; cada perfil novo eh um commit isolado.

   Saida esperada (igual aos outros motores):
     gerarCortes(item) → { 'PA-XXX': [{ comp, qty, label }, ...] }

   ESTADO ATUAL (sessao 31):
     [x] Batente (PA-BATENTEINT)        — 2 verticais + 1 horizontal
     [ ] Click do Batente (PA-CLICKBTINT)
     [x] Folha (PA-FLHINT)              — 2 verticais + 1 horizontal superior
     [x] Click da Folha (PA-CLICKFLHINT)— 2 verticais (mesma formula vertical da folha)
     [ ] Travessas (PA-46X46X1.5)
     [ ] Alisar (PA-ALISARINT) — se aplicavel
     [ ] Vedacao (PA-VEDAINT)  — se aplicavel
*/

const PerfisPortaInterna = (() => {

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
   * Felipe sessao 31 — Regras do BATENTE (PA-BATENTEINT):
   *   - largura do batente HORIZONTAL = largura_vao - 10 (folga 5+5)
   *   - altura  do batente VERTICAL   = altura_vao  - 5
   *   - 2 verticais + 1 horizontal por porta (so' em cima)
   *   - Felipe: 'largura digitada e' o vao' (sem +10 compensado)
   *
   * Quantidade multiplica por item.quantidade (varias portas iguais).
   *
   * Retorno: { 'PA-BATENTEINT': [{comp, qty, label}, ...] }
   */
  function gerarCortes(item) {
    if (!item || item.tipo !== 'porta_interna') return {};

    const larguraVao = Number(item.largura) || 0;
    const alturaVao  = Number(item.altura)  || 0;
    if (larguraVao <= 0 || alturaVao <= 0) return {};

    const qtdPortas = Math.max(1, Number(item.quantidade) || 1);

    const cortes = {};

    // ===== BATENTE (PA-BATENTEINT) =====
    // Felipe sessao 31:
    //   '...largura do batente vai ser o vao, a largura do vao -5 -5'
    //   '...altura do batente sera altura do vao - 5'
    //   '2 verticais e 1 horizontal'
    const compBatHor = larguraVao - 10;  // 5+5 folga
    const compBatVer = alturaVao  - 5;   // 5 folga no topo
    if (compBatHor > 0) {
      _add(cortes, 'PA-BATENTEINT', compBatHor, 1 * qtdPortas, 'Batente horizontal (topo)');
    }
    if (compBatVer > 0) {
      _add(cortes, 'PA-BATENTEINT', compBatVer, 2 * qtdPortas, 'Batente vertical (lateral)');
    }

    // ===== FOLHA (PA-FLHINT) =====
    // Felipe sessao 31 (perfil folha):
    //   - largura superior (HORIZONTAL) = largura_vao - folgaLargFolha - 24,5 - 24,5
    //     → 1 unidade
    //   - altura (VERTICAL)             = altura_vao  - folgaAltFolha  - 24,5 - 10
    //     → 2 unidades
    // Folgas sao EDITAVEIS no form (default 5).
    const folgaLargFolha = Number(item.folgaLarguraFolha != null && item.folgaLarguraFolha !== '' ? item.folgaLarguraFolha : 5);
    const folgaAltFolha  = Number(item.folgaAlturaFolha   != null && item.folgaAlturaFolha   !== '' ? item.folgaAlturaFolha   : 5);
    const compFlhHor = larguraVao - folgaLargFolha - 24.5 - 24.5;
    const compFlhVer = alturaVao  - folgaAltFolha  - 24.5 - 10;
    if (compFlhHor > 0) {
      _add(cortes, 'PA-FLHINT', compFlhHor, 1 * qtdPortas, 'Folha horizontal (topo)');
    }
    if (compFlhVer > 0) {
      _add(cortes, 'PA-FLHINT', compFlhVer, 2 * qtdPortas, 'Folha vertical (lateral)');
    }

    // ===== CLICK DA FOLHA (PA-CLICKFLHINT) =====
    // Felipe sessao 31 (click folha):
    //   - altura (VERTICAL) = altura_vao - folgaAltFolha - 24,5 - 10
    //     → 2 unidades (mesma formula do vertical da folha)
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
