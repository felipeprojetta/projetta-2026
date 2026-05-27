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
 *     L = largura_vao - fglEsq - fglDir - 38,5 - 38,5
 *     A = altura_vao  - fgSup           - 38,5 - 12
 *   Chapa frontal INTERNA (lado='interno'):
 *     L = largura_vao - fglEsq - fglDir - 26,5 - 26,5
 *     A = altura_vao  - fgSup           - 26,5 - 12
 *
 *   Folgas unificadas (fglEsq/fglDir/fgSup) com fallback 5 (igual motor de perfis).
 *
 * ESTADO ATUAL (sessao 31):
 *   [x] Chapa frontal externa (38,5)
 *   [x] Chapa frontal interna (26,5)
 *   [x] Alisar (chapa) — 59,5 x (vao+100), 2 vert + 1 hor por lado da parede
 *                        (categoria='portal', cor da face correspondente)
 *   [x] Complemento alisar — UM conjunto so' (nao espelha):
 *         2 verticais   (larguraParede-47) x altura_vao
 *         1 horizontal  (larguraParede-47) x largura_vao
 *       So' sai quando item.larguraParede > 47. Cor=corInterna.
 *
 * Felipe sessao 31: TODAS as pecas saem com podeRotacionar=false por
 * padrao. As pecas tem orientacao definida (vertical vs horizontal) e
 * rotacionar gera layouts confusos no aproveitamento. Bate o MaxCut
 * em testes (10 chapas pra 10 portas em chapa 1500x5000). Usuario
 * pode ligar rotacao caso a caso na tabela editavel do Lev. Superficies.
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

    // Felipe sessao 33: painel superior (fixo em cima da porta).
    // Quando temPainelSuperior='sim':
    //   - Gera 2 chapas extras (1 face ext + 1 face int) com as mesmas
    //     formulas da chapa frontal aplicadas em painelSupLargura/Altura
    //     (mesmos descontos -38,5 ext / -26,5 int / -12).
    //   - Aumenta a altura do alisar vertical em painelSupAltura
    //     (alisar engloba porta+painel num bloco so').
    // Largura do painel: usa painelSupLargura se preenchido; senao
    // assume == larguraVao (caso comum).
    const temPainelSup = item.temPainelSuperior === 'sim';
    const painelSupAlt = temPainelSup ? _toNum(item.painelSupAltura) : 0;
    const painelSupLargRaw = temPainelSup ? _toNum(item.painelSupLargura) : 0;
    const painelSupLarg = painelSupLargRaw > 0 ? painelSupLargRaw : larguraVao;
    const painelOk = temPainelSup && painelSupAlt > 0 && painelSupLarg > 0;

    const pecas = [];

    if (lado === 'externo') {
      // Chapa frontal externa: recortes -38,5 -38,5 (largura) e -38,5 -12 (altura)
      const L = larguraVao - fglEsq - fglDir - 38.5 - 38.5;
      const A = alturaVao  - fgSup           - 38.5 - 12;
      if (L > 0 && A > 0) {
        pecas.push({
          label:          'Chapa frontal externa',
          descricao:      'Chapa frontal externa',
          largura:        _round1(L),
          altura:         _round1(A),
          qtd:            qtdPortas,
          cor:            String(item.corExterna || '').trim(),
          categoria:      'porta',
          podeRotacionar: false,
        });
      }

      // Felipe sessao 33: chapa do PAINEL SUPERIOR externo. Como o painel
      // NAO tem perfis (sem batente/click batente), a chapa e' direto
      // largura x altura do vao do painel — sem descontos. (As folgas/
      // 38,5/12 da frontal vem dos perfis que ali nao existem.)
      if (painelOk) {
        pecas.push({
          label:          'Chapa painel superior externo',
          descricao:      'Chapa painel superior externo',
          largura:        _round1(painelSupLarg),
          altura:         _round1(painelSupAlt),
          qtd:            qtdPortas,
          cor:            String(item.corExterna || '').trim(),
          categoria:      'porta',
          podeRotacionar: false,
        });
      }

      // Felipe sessao 31: ALISAR (chapa) — 2 vert + 1 hor por lado.
      // Cada lado: 2 verticais (59,5 × A+100) + 1 horizontal (59,5 × L+100).
      // Felipe sessao 33: com painel superior, o vertical engloba
      // porta+painel — altura += painelSupAlt.
      if (alturaVao > 0) {
        const altAlisarVertExt = alturaVao + (painelOk ? painelSupAlt : 0) + 100;
        pecas.push({
          label:          'Alisar chapa exterior vertical',
          descricao:      'Alisar chapa exterior vertical',
          largura:        59.5,
          altura:         _round1(altAlisarVertExt),
          qtd:            2 * qtdPortas,
          cor:            String(item.corExterna || '').trim(),
          categoria:      'portal',
          podeRotacionar: false,
        });
      }
      if (larguraVao > 0) {
        pecas.push({
          label:          'Alisar chapa exterior horizontal',
          descricao:      'Alisar chapa exterior horizontal',
          largura:        59.5,
          altura:         _round1(larguraVao + 100),
          qtd:            1 * qtdPortas,
          cor:            String(item.corExterna || '').trim(),
          categoria:      'portal',
          podeRotacionar: false,
        });
      }
    } else if (lado === 'interno') {
      // Chapa frontal interna: recortes -26,5 -26,5 (largura) e -26,5 -12 (altura)
      const L = larguraVao - fglEsq - fglDir - 26.5 - 26.5;
      const A = alturaVao  - fgSup           - 26.5 - 12;
      if (L > 0 && A > 0) {
        pecas.push({
          label:          'Chapa frontal interna',
          descricao:      'Chapa frontal interna',
          largura:        _round1(L),
          altura:         _round1(A),
          qtd:            qtdPortas,
          cor:            String(item.corInterna || '').trim(),
          categoria:      'porta',
          podeRotacionar: false,
        });
      }

      // Felipe sessao 33: chapa do PAINEL SUPERIOR interno. Igual a
      // externa — largura x altura do vao do painel direto, sem
      // descontos (painel nao tem perfis).
      if (painelOk) {
        pecas.push({
          label:          'Chapa painel superior interno',
          descricao:      'Chapa painel superior interno',
          largura:        _round1(painelSupLarg),
          altura:         _round1(painelSupAlt),
          qtd:            qtdPortas,
          cor:            String(item.corInterna || '').trim(),
          categoria:      'porta',
          podeRotacionar: false,
        });
      }

      // Felipe sessao 31: ALISAR (chapa) — espelho do lado externo, mas
      // com cor da face interna. Felipe sessao 33: altura inclui painel.
      if (alturaVao > 0) {
        const altAlisarVertInt = alturaVao + (painelOk ? painelSupAlt : 0) + 100;
        pecas.push({
          label:          'Alisar chapa interior vertical',
          descricao:      'Alisar chapa interior vertical',
          largura:        59.5,
          altura:         _round1(altAlisarVertInt),
          qtd:            2 * qtdPortas,
          cor:            String(item.corInterna || '').trim(),
          categoria:      'portal',
          podeRotacionar: false,
        });
      }
      if (larguraVao > 0) {
        pecas.push({
          label:          'Alisar chapa interior horizontal',
          descricao:      'Alisar chapa interior horizontal',
          largura:        59.5,
          altura:         _round1(larguraVao + 100),
          qtd:            1 * qtdPortas,
          cor:            String(item.corInterna || '').trim(),
          categoria:      'portal',
          podeRotacionar: false,
        });
      }

      // Felipe sessao 31: COMPLEMENTO ALISAR — UM CONJUNTO so' por porta
      // (NAO espelha ext/int, diferente do alisar normal). 3 pecas por
      // porta: 2 verticais + 1 horizontal. Largura = espessura da parede
      // - 47mm. Outras dimensoes seguem o vao.
      //   Vertical:   (larguraParede - 47) x altura_vao    -> qtd 2
      //   Horizontal: (larguraParede - 47) x largura_vao   -> qtd 1
      // Felipe pediu cor INTERNA. Renderizado no lado='interno' pra
      // nao duplicar (pipeline ja itera externo+interno). Se a parede
      // nao tiver valor (vazio/0/<=47), as pecas nao saem.
      const larguraParede = _toNum(item.larguraParede);
      const compLarg = larguraParede - 47;
      if (compLarg > 0) {
        if (alturaVao > 0) {
          pecas.push({
            label:          'Complemento alisar vertical',
            descricao:      'Complemento alisar vertical',
            largura:        _round1(compLarg),
            altura:         _round1(alturaVao),
            qtd:            2 * qtdPortas,
            cor:            String(item.corInterna || '').trim(),
            categoria:      'portal',
            podeRotacionar: false,
          });
        }
        if (larguraVao > 0) {
          pecas.push({
            label:          'Complemento alisar horizontal',
            descricao:      'Complemento alisar horizontal',
            largura:        _round1(compLarg),
            altura:         _round1(larguraVao),
            qtd:            1 * qtdPortas,
            cor:            String(item.corInterna || '').trim(),
            categoria:      'portal',
            podeRotacionar: false,
          });
        }
      }
    }

    return pecas;
  }

  return { gerarPecasChapa };
})();
window.ChapasPortaInterna = ChapasPortaInterna;
