/* 38b-chapas-porta-interna.js — Motor de chapas frontais da PORTA INTERNA.
 *
 * Saida esperada (igual aos outros motores de chapa):
 *   gerarPecasChapa(item, lado) → [{ descricao, largura, altura, qtd,
 *                                      cor, categoria, podeRotacionar }, ...]
 *
 * lado: 'externo' | 'interno'
 *
 * Felipe sessao 31 — Regras das chapas frontais:
 *   Chapa frontal EXTERNA (lado='externo'):
 *     L = largura_vao - fglEsq - fglDir - 25,5 - 25,5
 *     A = altura_vao  - fgSup           - 25,5 - 12
 *   Chapa frontal INTERNA (lado='interno'):
 *     L = largura_vao - fglEsq - fglDir - 37,5 - 37,5
 *     A = altura_vao  - fgSup           - 37,5 - 12
 *
 *   Folgas unificadas (fglEsq/fglDir/fgSup) com fallback 5 (igual motor de perfis).
 *
 * ESTADO ATUAL (sessao 31):
 *   [x] Chapa frontal externa (25,5)
 *   [x] Chapa frontal interna (37,5)
 *   [ ] Chapa do batente / outras pecas (TBD)
 */
const ChapasPortaInterna = (() => {
  'use strict';

  // Aceita BR ("2139,5") ou EN ("2139.5"). Fallback se parseBR nao carregou ainda.
  function _toNum(v) {
    if (typeof window !== 'undefined' && window.parseBR) return window.parseBR(v);
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v).trim().replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  // Round pra 1 casa decimal (chapas trabalham em mm com .5)
  function _round1(v) { return Math.round(v * 10) / 10; }

  /**
   * Gera as pecas de chapa da porta interna pra um lado.
   * Retorna [] quando o lado nao tem chapa OU dimensoes invalidas.
   */
  function gerarPecasChapa(item, lado) {
    if (!item || item.tipo !== 'porta_interna') return [];

    const larguraVao = _toNum(item.largura);
    const alturaVao  = _toNum(item.altura);
    if (larguraVao <= 0 || alturaVao <= 0) return [];

    const qtdPortas = Math.max(1, Number(item.quantidade) || 1);

    // Folgas unificadas (igual motor de perfis). Fallback 5.
    const fglEsq = _toNum(item.fglEsq != null && item.fglEsq !== '' ? item.fglEsq : 5);
    const fglDir = _toNum(item.fglDir != null && item.fglDir !== '' ? item.fglDir : 5);
    const fgSup  = _toNum(item.fgSup  != null && item.fgSup  !== '' ? item.fgSup  : 5);

    const pecas = [];

    if (lado === 'externo') {
      // Chapa frontal externa: recortes -25,5 -25,5 (largura) e -25,5 -12 (altura)
      const L = larguraVao - fglEsq - fglDir - 25.5 - 25.5;
      const A = alturaVao  - fgSup           - 25.5 - 12;
      if (L > 0 && A > 0) {
        pecas.push({
          descricao:      'Chapa frontal externa',
          largura:        _round1(L),
          altura:         _round1(A),
          qtd:            qtdPortas,
          cor:            String(item.corExterna || '').trim(),
          categoria:      'porta',
          podeRotacionar: true,
        });
      }
    } else if (lado === 'interno') {
      // Chapa frontal interna: recortes -37,5 -37,5 (largura) e -37,5 -12 (altura)
      const L = larguraVao - fglEsq - fglDir - 37.5 - 37.5;
      const A = alturaVao  - fgSup           - 37.5 - 12;
      if (L > 0 && A > 0) {
        pecas.push({
          descricao:      'Chapa frontal interna',
          largura:        _round1(L),
          altura:         _round1(A),
          qtd:            qtdPortas,
          cor:            String(item.corInterna || '').trim(),
          categoria:      'porta',
          podeRotacionar: true,
        });
      }
    }

    return pecas;
  }

  return { gerarPecasChapa };
})();
window.ChapasPortaInterna = ChapasPortaInterna;
