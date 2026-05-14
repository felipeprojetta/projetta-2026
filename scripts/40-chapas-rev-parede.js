/**
 * 40-chapas-rev-parede.js
 *
 * Motor de geração de PEÇAS DE CHAPA para revestimento de parede.
 *
 * 2 modos:
 *  - MANUAL: lista de peças com largura/altura/quantidade individuais.
 *    Cada linha vira uma peça pro algoritmo de aproveitamento.
 *
 *  - AUTOMATICO: usuário informa largura_total × altura_total da parede
 *    inteira. Sistema divide em faixas que cabem na chapa-mae.
 *
 *    Tipos de divisão:
 *      - "maxima": faixas de larguraMaxima + sobra na ponta
 *        (ex: parede 10m, larguraMax 1440 → 6×1440 + 1×1360)
 *      - "igual": todas as faixas com mesma largura
 *        (ex: parede 10m, larguraMax 1440 → 7 faixas de 1428,57 cada)
 *
 *    Refilado:
 *      - "sim": larguraMaxima = larguraChapa - 2*REF (default REF=20)
 *      - "nao": larguraMaxima = larguraChapa
 *
 * Largura da chapa-mãe usada como base:
 *   Por enquanto FIXA em 1500mm (chapa padrão ACM/HPL/Wood).
 *   Pra Aluminio Maciço (chapa 1250) ou outras, o algoritmo de
 *   nesting já vai detectar peças maiores que a chapa real e avisar.
 *
 * Cor: 1 só por item (chapa tem 1 face só).
 *
 * Categoria: 'revestimento' (separada de 'porta' e 'portal').
 */
window.ChapasRevParede = (function () {
  'use strict';

  const LARGURA_CHAPA_BASE = 1500;  // mm — chapa padrão (ACM/HPL/Wood)

  /**
   * Lê a variável REF (refilado) do storage. Default 20.
   * Mesmo storage do 38-chapas-porta-externa (compartilhado).
   */
  function getREF() {
    try {
      if (window.Storage && window.Storage.scope) {
        const salvas = window.Storage.scope('cadastros').get('regras_variaveis_chapas');
        if (salvas && Number(salvas.REF) > 0) return Number(salvas.REF);
      }
    } catch (e) {
      console.warn('[ChapasRevParede] erro ler REF:', e);
    }
    return 20;
  }

  /**
   * Detector de veio (mesma regra do motor de portas).
   */
  function temVeio(cor) {
    return /wood|maple|carvalho|nogueira|imbu[ií]a|tauari|cerejeira|ipe|jatoba|veio/i.test(cor || '');
  }

  /**
   * Gera peças de chapa pro item revestimento_parede.
   *
   * @param {Object} item - item do tipo 'revestimento_parede'
   * @returns {Array} lista de peças no mesmo formato do motor de portas:
   *   [{ id, label, labelCompleto, largura, altura, qtd, podeRotacionar,
   *      cor, lado, categoria, modelo, observacao }]
   */
  function gerarPecasRevParede(item) {
    if (!item || item.tipo !== 'revestimento_parede') return [];

    const cor = String(item.cor || '').trim();
    const temVeioCor = temVeio(cor);
    const qtdItem = Math.max(1, Number(item.quantidade) || 1);

    let pecas = [];
    let multiplicarPorQtdItem = true;

    if (item.modo === 'automatico') {
      pecas = gerarPecasAutomatico(item);
      // Felipe sessao 18: no novo formato multi-parede, cada parede
      // ja' tem sua propria quantidade (item.paredes[i].quantidade) que
      // ja' foi aplicada em gerarPecasAutomatico. Nao multiplicar de
      // novo por item.quantidade pra evitar dupla contagem.
      // Fallback legado (sem item.paredes): comportamento antigo
      // (multiplica por item.quantidade = N paredes identicas).
      if (Array.isArray(item.paredes) && item.paredes.length > 0) {
        multiplicarPorQtdItem = false;
      }
    } else {
      // default = manual
      pecas = gerarPecasManual(item);
    }

    const fator = multiplicarPorQtdItem ? qtdItem : 1;
    return pecas.map((p, i) => ({
      id:             p.id || `rev_parede_${i + 1}`,
      label:          p.label,
      labelCompleto:  `${p.label}${cor ? ` (${cor})` : ''}`,
      largura:        Math.round(p.largura * 100) / 100,
      altura:         Math.round(p.altura  * 100) / 100,
      qtd:            Math.round((p.qtd || 1) * fator),
      podeRotacionar: !temVeioCor,
      cor,
      lado:           'externo',  // revestimento tem 1 face só (sem interno)
      categoria:      'revestimento',
      modelo:         0,
      ehDaCava:       false,
      observacao:     p.observacao || '',
    }));
  }

  /**
   * Modo MANUAL: gera 1 peça por linha do item.pecas[].
   */
  function gerarPecasManual(item) {
    const pecas = item.pecas || [];
    return pecas
      .filter(p => Number(p.largura) > 0 && Number(p.altura) > 0)
      .map((p, i) => ({
        id: `rev_parede_manual_${i + 1}`,
        label: `Peça ${i + 1}`,
        largura: Number(p.largura),
        altura: Number(p.altura),
        qtd: Math.max(1, Number(p.quantidade) || 1),
        observacao: 'modo manual',
      }));
  }

  /**
   * Modo AUTOMATICO: divide largura_total × altura_total em faixas.
   * Felipe sessao 18: agora aceita item.paredes[] (varias paredes,
   * cada uma com medidas/qtd/divisao proprias e calculadas
   * independentemente). Fallback pra largura_total/altura_total
   * (legado de 1 parede so').
   */
  function gerarPecasAutomatico(item) {
    // Resolve lista de paredes (1+ entradas).
    // Prioridade: item.paredes (novo formato multi-parede).
    // Fallback: { largura_total, altura_total, quantidade, divisao_largura, com_refilado } (legado).
    let paredes = Array.isArray(item.paredes) ? item.paredes.filter(p => p && (Number(p.largura_total) > 0 || Number(p.altura_total) > 0)) : [];
    if (paredes.length === 0) {
      // Legado: 1 parede so' com campos no item raiz
      paredes = [{
        largura_total: item.largura_total,
        altura_total:  item.altura_total,
        quantidade:    Math.max(1, Number(item.quantidade) || 1),
        divisao_largura: item.divisao_largura,
        com_refilado:    item.com_refilado,
      }];
    }

    const REF = getREF();
    // Felipe sessao 18 (re-cap apos esclarecimento):
    //   - 'chapas de fundo sempre vai existir independente se e lisa,
    //     ripada ou moldura'
    //   - 'as ripas tem 94 nao 60, chapa aberta em 94, a ripa dobrada
    //     fica com 60 de frente'
    //   - 'espacamento entre elas, que no caso e 30, entao 60+30=90'
    //   - 'parede 2000 de largura: 2000/90 = qtdRipas'
    //
    // FLUXO:
    //   - Chapa de fundo: SEMPRE (mesma logica do modo lisa, por parede)
    //   - Ripas (94 × H): adicionadas EM CIMA quando estilo=ripada
    //     qtdRipas = ceil(L / (60 + espac)) — distancia centro-a-centro
    //     da face VISIVEL (60mm) + espacamento (30mm default)
    const ehRipada = String(item.estilo || '').toLowerCase() === 'ripada';
    const espacRipas = parseFloat(String(item.espacamentoRipas != null ? item.espacamentoRipas : 30).replace(',', '.')) || 30;
    const out = [];
    paredes.forEach((p, paredeIdx) => {
      const L = Number(p.largura_total) || 0;
      const H = Number(p.altura_total)  || 0;
      if (!L || !H) return;
      const qtdParede = Math.max(1, Number(p.quantidade) || 1);
      const sufixoLabel = paredes.length > 1 ? ` — Parede ${paredeIdx + 1}` : '';

      // ========= CHAPA DE FUNDO (sempre, igual modo lisa) =========
      const comRefilado = (p.com_refilado != null ? p.com_refilado : 'sim') !== 'nao';
      const larguraMaxima = comRefilado
        ? (LARGURA_CHAPA_BASE - 2 * REF)
        : LARGURA_CHAPA_BASE;
      const divisao = p.divisao_largura || 'maxima';

      if (divisao === 'igual') {
        const n = Math.max(1, Math.ceil(L / larguraMaxima));
        const larguraFaixa = L / n;
        const ehFaixaUnica = n === 1 && larguraFaixa < larguraMaxima;
        out.push({
          id: `rev_parede_auto_igual_p${paredeIdx + 1}`,
          label: (ehFaixaUnica
            ? `Faixa (${larguraFaixa.toFixed(1)}×${H}mm)`
            : `Faixa (${n}×${larguraFaixa.toFixed(1)}×${H}mm)`) + sufixoLabel,
          largura: larguraFaixa,
          altura: H,
          qtd: n * qtdParede,
          observacao: `automatico — divisão igual em ${n} faixas${sufixoLabel}`,
        });
      } else {
        const nInteiras = Math.floor(L / larguraMaxima);
        const complemento = L - nInteiras * larguraMaxima;
        if (nInteiras > 0) {
          out.push({
            id: `rev_parede_auto_max_p${paredeIdx + 1}`,
            label: `Faixa (${nInteiras}×${larguraMaxima}×${H}mm)` + sufixoLabel,
            largura: larguraMaxima,
            altura: H,
            qtd: nInteiras * qtdParede,
            observacao: 'automatico — largura máxima' + sufixoLabel,
          });
        }
        if (complemento > 0.5) {
          const ehFaixaUnica = nInteiras === 0;
          out.push({
            id: (ehFaixaUnica ? `rev_parede_auto_faixa_p${paredeIdx + 1}` : `rev_parede_auto_complemento_p${paredeIdx + 1}`),
            label: (ehFaixaUnica
              ? `Faixa (${complemento.toFixed(1)}×${H}mm)`
              : `Complemento (${complemento.toFixed(1)}×${H}mm)`) + sufixoLabel,
            largura: complemento,
            altura: H,
            qtd: 1 * qtdParede,
            observacao: (ehFaixaUnica
              ? 'automatico — faixa unica (parede menor que largura maxima)'
              : 'automatico — complemento da largura') + sufixoLabel,
          });
        }
      }

      // ========= RIPAS (94 × H) — somente se estilo=ripada =========
      // Vao POR CIMA da chapa de fundo. Largura da chapa aberta = 94mm
      // (a ripa dobrada mostra 60mm de frente). qtdRipas = ceil(L/90).
      if (ehRipada) {
        const denom = 60 + espacRipas;  // 60 visivel + 30 espaco = 90
        const qtdRipas = denom > 0 ? Math.ceil(L / denom) : 0;
        if (qtdRipas > 0) {
          out.push({
            id: `rev_parede_ripa_p${paredeIdx + 1}`,
            label: `Ripa (94×${H}mm)` + sufixoLabel,
            largura: 94,
            altura: H,
            qtd: qtdRipas * qtdParede,
            observacao: `ripada — chapa aberta 94mm (60 visivel + dobras), espacamento ${espacRipas}mm` + sufixoLabel,
          });
        }
      }
    });
    return out;
  }

  return {
    gerarPecasRevParede,
    LARGURA_CHAPA_BASE,
  };
})();
