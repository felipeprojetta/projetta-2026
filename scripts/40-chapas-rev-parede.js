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

    if (item.modo === 'automatico') {
      pecas = gerarPecasAutomatico(item);
    } else {
      // default = manual
      pecas = gerarPecasManual(item);
    }

    // Multiplica qtd pela quantidade de paredes idênticas (item.quantidade)
    return pecas.map((p, i) => ({
      id:             p.id || `rev_parede_${i + 1}`,
      label:          p.label,
      labelCompleto:  `${p.label}${cor ? ` (${cor})` : ''}`,
      largura:        Math.round(p.largura * 100) / 100,
      altura:         Math.round(p.altura  * 100) / 100,
      qtd:            Math.round((p.qtd || 1) * qtdItem),
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
   */
  function gerarPecasAutomatico(item) {
    const L = Number(item.largura_total) || 0;
    const H = Number(item.altura_total)  || 0;
    if (!L || !H) return [];

    const REF = getREF();
    const comRefilado = item.com_refilado !== 'nao';  // default sim
    const larguraMaxima = comRefilado
      ? (LARGURA_CHAPA_BASE - 2 * REF)   // 1500 - 40 = 1460
      : LARGURA_CHAPA_BASE;              // 1500

    const divisao = item.divisao_largura || 'maxima';

    if (divisao === 'igual') {
      // Divide em N faixas iguais
      const n = Math.max(1, Math.ceil(L / larguraMaxima));
      const larguraFaixa = L / n;
      // Felipe sessao 12: 'quando a chapa nao atingir limite da largura
      // da chapa nao e sobra'. Se uma faixa unica < larguraMaxima, e' so'
      // 'Faixa' (nao 'Sobra').
      const ehFaixaUnica = n === 1 && larguraFaixa < larguraMaxima;
      return [{
        id: 'rev_parede_auto_igual',
        label: ehFaixaUnica
          ? `Faixa (${larguraFaixa.toFixed(1)}×${H}mm)`
          : `Faixa (${n}×${larguraFaixa.toFixed(1)}×${H}mm)`,
        largura: larguraFaixa,
        altura: H,
        qtd: n,
        observacao: `automatico — divisão igual em ${n} faixas`,
      }];
    } else {
      // Felipe sessao 12: 'sobra e o que sobra'. Renomeado:
      //   - 'Sobra' (no codigo antigo) -> 'Complemento' quando vem de uma
      //     parede que pega varias chapas inteiras e a parte final completa.
      //     Ex: parede 2200mm em chapa 1460 -> 1× 1460 + 1× 740 (740 e'
      //     COMPLEMENTO, nao sobra).
      //   - Quando e' o UNICO pedaco (parede menor que larguraMaxima),
      //     vira so' 'Faixa' (ex: 350×3700 - faixa unica de 350mm).
      //   'Sobra' real = o que SOBRA da chapa apos cortar tudo (e' calculado
      //   no aproveitamento, nao aqui).
      const nInteiras = Math.floor(L / larguraMaxima);
      const complemento = L - nInteiras * larguraMaxima;
      const result = [];
      if (nInteiras > 0) {
        result.push({
          id: 'rev_parede_auto_max',
          label: `Faixa (${nInteiras}×${larguraMaxima}×${H}mm)`,
          largura: larguraMaxima,
          altura: H,
          qtd: nInteiras,
          observacao: 'automatico — largura máxima',
        });
      }
      if (complemento > 0.5) {  // ignora desprezível
        // Se nao tem faixa inteira antes, e' a UNICA peca (parede menor
        // que larguraMaxima) -> chama de 'Faixa'. Se ja' tem faixa(s)
        // inteira(s), e' 'Complemento' (parte final completa a parede).
        const ehFaixaUnica = nInteiras === 0;
        result.push({
          id: ehFaixaUnica ? 'rev_parede_auto_faixa' : 'rev_parede_auto_complemento',
          label: ehFaixaUnica
            ? `Faixa (${complemento.toFixed(1)}×${H}mm)`
            : `Complemento (${complemento.toFixed(1)}×${H}mm)`,
          largura: complemento,
          altura: H,
          qtd: 1,
          observacao: ehFaixaUnica
            ? 'automatico — faixa unica (parede menor que largura maxima)'
            : 'automatico — complemento da largura',
        });
      }
      return result;
    }
  }

  return {
    gerarPecasRevParede,
    LARGURA_CHAPA_BASE,
  };
})();
