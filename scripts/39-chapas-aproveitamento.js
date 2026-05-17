/**
 * 39-chapas-aproveitamento.js
 *
 * Algoritmo de aproveitamento (nesting) de chapas-mãe.
 *
 * Felipe (sessao 2026-05): re-implementado com BLF (Bottom-Left-Fill)
 * com 3 modos (igual MaxCut):
 *   - 'normal'        — BLF puro (encaixe livre, nao guillotinavel)
 *   - 'multi_horiz'   — multiplos estagios, primeiro corte segue COMPRIMENTO
 *   - 'multi_vert'    — multiplos estagios, primeiro corte segue LARGURA
 *
 * Variaveis globais (editaveis em Cadastros > Regras > Calculo de Chapas):
 *   - KERF_NEST        = 4 mm   (largura do disco da serra)
 *   - APARAR_NEST      = 5 mm   (margem de descarte na borda)
 *   - METODO_NEST      = 'multi_horiz'  (Felipe: padrao)
 *   - DESPERDICIO_NEST = 'inferior' | 'amplie'
 *   - MAX_GIROS_NEST   = 6
 */
window.ChapasAproveitamento = (function () {
  'use strict';

  // Felipe (sessao 27 fix): defaults sincronizados com 34-regras.js
  // (KERF agora 0 default, Felipe nao quer 4mm de perda automatica).
  const DEFAULTS = {
    KERF:        4,
    APARAR:      5,
    METODO:      'multi_horiz',
    DESPERDICIO: 'inferior',
    MAX_GIROS:   6,
  };

  function getConfig() {
    try {
      const cad = window.Storage?.scope?.('cadastros');
      const v = cad?.get('regras_variaveis_chapas') || {};
      // Felipe (sessao 27 fix): usa ?? em vez de || pra aceitar 0
      // como valor valido (com ||, KERF_NEST=0 caia pro default 4).
      const numOrDefault = (val, def) => {
        const n = Number(val);
        return Number.isFinite(n) ? n : def;
      };
      return {
        KERF:        numOrDefault(v.KERF_NEST,        DEFAULTS.KERF),
        APARAR:      numOrDefault(v.APARAR_NEST,      DEFAULTS.APARAR),
        METODO:      v.METODO_NEST              || DEFAULTS.METODO,
        DESPERDICIO: v.DESPERDICIO_NEST         || DEFAULTS.DESPERDICIO,
        MAX_GIROS:   numOrDefault(v.MAX_GIROS_NEST,   DEFAULTS.MAX_GIROS),
      };
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  // Expande pecas (qtd N → N unidades, cada uma com #id sequencial)
  function expandirPecas(pecas, contadorInicial) {
    const expandidas = [];
    let contador = Number(contadorInicial) || 100;
    pecas.forEach(p => {
      const qtd = Number(p.qtd) || 1;
      for (let i = 0; i < qtd; i++) {
        contador++;
        expandidas.push({
          ref: p,
          id: contador,
          label: p.label,
          largura: Number(p.largura) || 0,
          altura: Number(p.altura) || 0,
          podeRotacionar: !!p.podeRotacionar,
          cor: p.cor,
          categoria: p.categoria,
        });
      }
    });
    return { expandidas, proxContador: contador };
  }

  // ============================================================
  // MODO multi_horiz — FFDH (First-Fit Decreasing Height)
  // Felipe (sessao 2026-05): re-implementado pra evitar chapas
  // extras desnecessarias. Cada peca tenta entrar em QUALQUER
  // chapa/fileira ja aberta antes de abrir uma nova.
  // ============================================================
  function nestingMultiHoriz(pecas, chapaLarg, chapaAlt, cfg) {
    const KERF = cfg.KERF;
    const M = cfg.APARAR;
    const dispLarg = chapaLarg - 2 * M;
    const dispAlt  = chapaAlt  - 2 * M;

    // Felipe (sessao 2026-05): NAO re-ordena aqui — usa a ordem que
    // foi passada (multi-start chama com ordens diferentes). Isso e'
    // o que permite multiplas tentativas com criterios distintos.
    const restantes = pecas.slice();

    const chapas = [];
    const naoCouberam = [];

    for (const peca of restantes) {
      if (!caberOriginalOuRotacionada(peca, dispLarg, dispAlt)) {
        naoCouberam.push(peca);
        continue;
      }
      let posicionou = false;
      // FFDH global: tenta TODAS as chapas ja abertas
      for (const chapa of chapas) {
        if (tentarPosicionarChapa(chapa, peca, dispLarg, dispAlt, KERF, M)) {
          posicionou = true;
          break;
        }
      }
      if (!posicionou) {
        // Abre nova chapa
        const nova = {
          largura: chapaLarg, altura: chapaAlt,
          pecasPosicionadas: [],
          fileiras: [],  // [{ y, alturaFileira, larguraUsada }]
          sobrasRetangulos: [],
        };
        if (tentarPosicionarChapa(nova, peca, dispLarg, dispAlt, KERF, M)) {
          chapas.push(nova);
        } else {
          // Peca cabe na chapa-mae mas nao em chapa vazia? bug
          naoCouberam.push(peca);
        }
      }
    }

    // Calcula sobras
    chapas.forEach(c => {
      c.sobrasRetangulos = calcularSobras(c, M);
    });

    return { chapas, naoCouberam };
  }

  /**
   * Tenta posicionar UMA peca em UMA chapa (em fileira existente
   * ou abrindo fileira nova). Retorna true se conseguiu.
   *
   * Felipe (sessao 2026-05): testa AMBAS orientacoes (normal e
   * rotacionada) e pega a primeira que cabe.
   */
  function tentarPosicionarChapa(chapa, peca, dispLarg, dispAlt, KERF, M) {
    const orientacoes = peca.podeRotacionar
      ? [{ larg: peca.largura, alt: peca.altura, rotada: false },
         { larg: peca.altura,  alt: peca.largura, rotada: true }]
      : [{ larg: peca.largura, alt: peca.altura, rotada: false }];

    for (const o of orientacoes) {
      // Tenta cada fileira ja aberta
      for (const f of chapa.fileiras) {
        // Cabe em altura (peca <= altura da fileira)?
        if (o.alt > f.alturaFileira + 0.01) continue;
        // Cabe em largura (largura usada + peca <= dispLarg)?
        const xFinal = f.larguraUsada + o.larg;
        if (xFinal > dispLarg + 0.01) continue;
        // CABE — posiciona
        chapa.pecasPosicionadas.push({
          peca,
          x: M + f.larguraUsada,
          y: f.y,
          larg: o.larg, alt: o.alt, rotada: o.rotada,
        });
        f.larguraUsada = xFinal + KERF;
        return true;
      }
      // Tenta abrir fileira nova
      const yProx = chapa.fileiras.length > 0
        ? chapa.fileiras[chapa.fileiras.length - 1].y +
          chapa.fileiras[chapa.fileiras.length - 1].alturaFileira + KERF
        : M;
      if (yProx + o.alt > M + dispAlt + 0.01) continue;  // estoura altura
      if (o.larg > dispLarg + 0.01) continue;             // estoura largura
      // Abre fileira
      chapa.pecasPosicionadas.push({
        peca,
        x: M, y: yProx,
        larg: o.larg, alt: o.alt, rotada: o.rotada,
      });
      chapa.fileiras.push({
        y: yProx,
        alturaFileira: o.alt,
        larguraUsada: o.larg + KERF,
      });
      return true;
    }
    return false;
  }

  // ============================================================
  // MODO multi_vert — guillotine vertical (peças em colunas)
  //
  // Felipe sessao 31: REIMPLEMENTADO. A versao anterior trocava
  // largura<->altura DAS PECAS, o que so' funciona se podeRotacionar=true.
  // Agora trata isso como ROTACAO DO SISTEMA DE COORDENADAS: chapa e
  // pecas todas giradas juntas em 90 graus. Fisicamente equivalente a
  // ver a chapa de outro angulo — nao gira fisicamente as pecas.
  // Ao fim, desgira tudo de volta pras coordenadas originais.
  //
  // Isso permite encontrar layouts onde a chapa 1500x5000 + pecas
  // grandes funcionam melhor como se fosse 5000x1500 (e' a mesma chapa,
  // mas as fileiras crescem em outro eixo). FUNCIONA mesmo com
  // pecas nao-rotacionaveis: a peca 796x2096 vista por outro angulo
  // continua sendo 796x2096 — so' o algoritmo a posiciona diferente
  // no espaco. As dimensoes FISICAS retornadas no fim sao identicas.
  // ============================================================
  function nestingMultiVert(pecas, chapaLarg, chapaAlt, cfg) {
    // Roda 90 graus o SISTEMA DE COORDENADAS:
    //   - chapa 1500x5000 vira 5000x1500
    //   - peca 796x2096 vira 2096x796
    //   - posicao (x, y) vira (y, x)
    // Isso eh apenas um TRUQUE de busca - no fim revertemos tudo.
    const pecasGiradas = pecas.map(p => ({
      ref: p.ref || p,
      id: p.id,
      label: p.label,
      // Felipe sessao 31 FIX BUG: roda dimensoes pra dentro do algoritmo,
      // mas TRATA AS PECAS ROTACIONADAS COMO 'naoRotacionaveis'. Isso
      // evita que o tentarPosicionarChapa tente girar mais uma vez (o
      // que faria a peca voltar pra orientacao original dentro do espaco
      // ja girado — efeito anulado).
      largura: p.altura,
      altura: p.largura,
      podeRotacionar: false,
      cor: p.cor,
      categoria: p.categoria,
    }));
    const r = nestingMultiHoriz(pecasGiradas, chapaAlt, chapaLarg, cfg);
    // Reverte: desgira o sistema de coordenadas. Posicoes (x',y') no
    // espaco girado voltam pra (y', x') no original. Larguras e alturas
    // tambem trocam — mas isso restaura as dimensoes ORIGINAIS da peca
    // (porque ela foi enviada com larg/alt trocadas pra simular o giro).
    r.chapas.forEach(chapa => {
      chapa.largura = chapaLarg;
      chapa.altura = chapaAlt;
      chapa.pecasPosicionadas.forEach(pp => {
        const ovX = pp.x, ovL = pp.larg, ovA = pp.alt;
        pp.x = pp.y;
        pp.y = ovX;
        pp.larg = ovA;  // dim girada (==largura original da peca)
        pp.alt = ovL;
        pp.rotada = false;  // a peca NAO foi fisicamente rotacionada
      });
      chapa.sobrasRetangulos = calcularSobras(chapa, cfg.APARAR);
    });
    r.naoCouberam = r.naoCouberam.map(p => p.ref || p);
    return r;
  }

  /**
   * Felipe sessao 31: helper — todas as pecas permitem rotacao?
   * Usado pra decidir se tentamos rotacionar pecas individualmente.
   * Note: multi_vert ROTACIONA O ESPACO (nao as pecas), entao funciona
   * mesmo quando esta retorna false.
   */
  function todasPodemRotacionar(pecas) {
    return pecas.every(p => !!p.podeRotacionar);
  }

  // ============================================================
  // MODO normal — Bottom-Left Fill com skyline
  // ============================================================
  function nestingBLF(pecas, chapaLarg, chapaAlt, cfg) {
    const KERF = cfg.KERF;
    const M = cfg.APARAR;
    const dispLarg = chapaLarg - 2 * M;
    const dispAlt  = chapaAlt  - 2 * M;

    const restantes = pecas.slice();
    restantes.sort((a, b) => (b.altura - a.altura) ||
                              (b.largura * b.altura - a.largura * a.altura));

    const chapas = [];
    const naoCouberam = [];

    while (restantes.length > 0) {
      const cabe = restantes.some(p => caberOriginalOuRotacionada(p, dispLarg, dispAlt));
      if (!cabe) {
        for (let i = restantes.length - 1; i >= 0; i--) {
          if (!caberOriginalOuRotacionada(restantes[i], dispLarg, dispAlt)) {
            naoCouberam.push(restantes[i]);
            restantes.splice(i, 1);
          }
        }
        if (!restantes.length) break;
        continue;
      }

      const chapa = {
        largura: chapaLarg, altura: chapaAlt,
        pecasPosicionadas: [],
        sobrasRetangulos: [],
      };
      const skyline = [{ x: M, w: dispLarg, y: M }];

      let mudou = true;
      while (mudou && restantes.length > 0) {
        mudou = false;
        let melhor = null;
        for (let i = 0; i < restantes.length; i++) {
          const p = restantes[i];
          const orientacoes = p.podeRotacionar
            ? [{ larg: p.largura, alt: p.altura, rotada: false },
               { larg: p.altura,  alt: p.largura, rotada: true }]
            : [{ larg: p.largura, alt: p.altura, rotada: false }];
          for (const o of orientacoes) {
            const pos = acharPosicaoBLF(skyline, o.larg, o.alt, M, dispLarg, dispAlt);
            if (!pos) continue;
            const score = pos.y * 100000 + pos.x;
            if (!melhor || score < melhor.score) {
              melhor = { idx: i, peca: p, ...o, ...pos, score };
            }
          }
        }
        if (melhor) {
          chapa.pecasPosicionadas.push({
            peca: melhor.peca,
            x: melhor.x, y: melhor.y,
            larg: melhor.larg, alt: melhor.alt,
            rotada: melhor.rotada,
          });
          // Felipe sessao 31 FIX: atualizarSkyline deve incluir KERF
          // tanto em altura (Y) quanto em largura (X), pra que pecas
          // adjacentes deixem um gap de KERF. Antes so' Y tinha kerf —
          // resultava em pecas grudadas horizontalmente (bug visivel
          // quando 2 alisares saem em x=5 e x=64.5 sem o gap de 4mm).
          atualizarSkyline(skyline,
            melhor.x, melhor.larg + KERF,
            melhor.y + melhor.alt + KERF);
          restantes.splice(melhor.idx, 1);
          mudou = true;
        }
      }
      chapa.sobrasRetangulos = calcularSobras(chapa, M);
      chapas.push(chapa);
    }
    return { chapas, naoCouberam };
  }

  function acharPosicaoBLF(skyline, larg, alt, margem, dispLarg, dispAlt) {
    let melhor = null;
    for (let i = 0; i < skyline.length; i++) {
      const seg = skyline[i];
      const x = seg.x;
      let y = seg.y;
      let larguraCoberta = 0;
      for (let j = i; j < skyline.length && larguraCoberta < larg - 0.01; j++) {
        const s = skyline[j];
        if (s.y > y) y = s.y;
        larguraCoberta += s.w;
      }
      if (larguraCoberta < larg - 0.01) continue;
      if (x + larg > margem + dispLarg + 0.01) continue;
      if (y + alt > margem + dispAlt + 0.01) continue;
      if (!melhor || y < melhor.y || (y === melhor.y && x < melhor.x)) {
        melhor = { x, y };
      }
    }
    return melhor;
  }

  function atualizarSkyline(skyline, x, larg, novaY) {
    const xFim = x + larg;
    const novos = [];
    for (let i = 0; i < skyline.length; i++) {
      const s = skyline[i];
      const sFim = s.x + s.w;
      if (sFim <= x || s.x >= xFim) {
        novos.push(s);
      } else {
        if (s.x < x) novos.push({ x: s.x, w: x - s.x, y: s.y });
        if (sFim > xFim) novos.push({ x: xFim, w: sFim - xFim, y: s.y });
      }
    }
    novos.push({ x, w: larg, y: novaY });
    novos.sort((a, b) => a.x - b.x);
    skyline.length = 0;
    for (const s of novos) {
      const last = skyline[skyline.length - 1];
      if (last && Math.abs(last.x + last.w - s.x) < 0.01 && Math.abs(last.y - s.y) < 0.01) {
        last.w += s.w;
      } else {
        skyline.push(s);
      }
    }
  }

  function caberOriginalOuRotacionada(p, larg, alt) {
    if (p.largura <= larg + 0.01 && p.altura <= alt + 0.01) return true;
    if (p.podeRotacionar && p.altura <= larg + 0.01 && p.largura <= alt + 0.01) return true;
    return false;
  }

  // Calcula retangulos de sobra (area amarela)
  function calcularSobras(chapa, margem) {
    const W = chapa.largura - 2 * margem;
    const H = chapa.altura - 2 * margem;
    const pecas = chapa.pecasPosicionadas;
    if (!pecas.length) return [{ x: margem, y: margem, w: W, h: H }];
    const yMaxOcupado = Math.max(...pecas.map(p => p.y + p.alt));
    const xMaxOcupado = Math.max(...pecas.map(p => p.x + p.larg));
    const sobras = [];
    if (yMaxOcupado < margem + H) {
      sobras.push({
        x: margem, y: yMaxOcupado,
        w: W, h: (margem + H) - yMaxOcupado,
      });
    }
    if (xMaxOcupado < margem + W) {
      sobras.push({
        x: xMaxOcupado, y: margem,
        w: (margem + W) - xMaxOcupado, h: yMaxOcupado - margem,
      });
    }
    return sobras;
  }

  /**
   * Felipe (sessao 2026-05): detector de sobras MAIS COMPLETO usando
   * Maximal Rectangles. A funcao calcularSobras (acima) so' retorna 2
   * retangulos (direita do mais largo + abaixo do mais alto) — nao
   * detecta "vaos" internos entre fileiras de pecas. Isso e' o
   * suficiente pra UI (mostrar a area amarela "sobra") mas insuficiente
   * pro SALVAGE PASS — onde precisamos achar QUALQUER espaco livre.
   *
   * Algoritmo: comeca com 1 retangulo cobrindo toda a area disponivel.
   * Pra cada peca ocupada, "corta" os retangulos livres em ate' 4
   * pedacos (top/bottom/left/right da peca). Depois remove redundancias
   * (retangulos totalmente contidos em outros).
   */
  function calcularSobrasDetalhadas(chapa, margem) {
    const W = chapa.largura - 2 * margem;
    const H = chapa.altura - 2 * margem;
    const ocupados = chapa.pecasPosicionadas.map(p => ({
      x: p.x, y: p.y, w: p.larg, h: p.alt,
    }));
    if (!ocupados.length) return [{ x: margem, y: margem, w: W, h: H }];

    // Comeca com 1 sobra cobrindo todo o disponivel
    let sobras = [{ x: margem, y: margem, w: W, h: H }];

    // Pra cada peca, divide cada sobra que intersecta com ela
    ocupados.forEach(occ => {
      const novasSobras = [];
      sobras.forEach(s => {
        // Sem interseccao? sobra inteira fica
        if (occ.x >= s.x + s.w || occ.x + occ.w <= s.x ||
            occ.y >= s.y + s.h || occ.y + occ.h <= s.y) {
          novasSobras.push(s);
          return;
        }
        // Top (acima da peca)
        if (occ.y > s.y) {
          novasSobras.push({ x: s.x, y: s.y, w: s.w, h: occ.y - s.y });
        }
        // Bottom (abaixo da peca)
        if (occ.y + occ.h < s.y + s.h) {
          novasSobras.push({
            x: s.x, y: occ.y + occ.h,
            w: s.w, h: (s.y + s.h) - (occ.y + occ.h),
          });
        }
        // Left (a esquerda da peca)
        if (occ.x > s.x) {
          novasSobras.push({ x: s.x, y: s.y, w: occ.x - s.x, h: s.h });
        }
        // Right (a direita da peca)
        if (occ.x + occ.w < s.x + s.w) {
          novasSobras.push({
            x: occ.x + occ.w, y: s.y,
            w: (s.x + s.w) - (occ.x + occ.w), h: s.h,
          });
        }
      });
      sobras = novasSobras;
    });

    // Remove redundancias: sobra totalmente contida em outra
    sobras = sobras.filter((s, i) => !sobras.some((o, j) =>
      i !== j &&
      o.x <= s.x + 0.01 && o.y <= s.y + 0.01 &&
      o.x + o.w >= s.x + s.w - 0.01 &&
      o.y + o.h >= s.y + s.h - 0.01
    ));

    // Felipe sessao 31: ordena sobras top-to-bottom, left-to-right
    // pra que o salvage POSICIONE pecas em sequencia previsivel.
    // Antes vinham em ordem indeterminada -> pecas pequenas iam pra
    // sobras espalhadas (uma em cada coluna) criando gaps. Agora a
    // primeira peca vai pra sobra mais alta+esquerda, e quando essa
    // sobra ganha a peca, a proxima sobra (recalculada apos invalidate)
    // fica imediatamente A DIREITA da peca colocada, encostando.
    sobras.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    // Filtra retangulos minusculos que nao servem pra nada (< 20mm)
    sobras = sobras.filter(s => s.w >= 20 && s.h >= 20);
    return sobras;
  }

  /**
   * Felipe (sessao 2026-05): SALVAGE PASS — corrige o "buraco" do
   * guillotine. O algoritmo multi_horiz/multi_vert usa fileiras —
   * o espaco ACIMA de pecas baixas numa fileira alta vira sobra
   * desperdicada. Felipe reclamou: "que loucura e essa, as 3 pecas
   * da segunda chapa claramente cabem na primeira" (Imagem 3) e
   * "seu aproveitamento de chapa nao esta confiavel" (Imagem 5,
   * Chapa 3 com 1 peca so de 2%).
   *
   * Solucao conservadora: apos o nesting normal, identifica chapas
   * com aproveitamento muito baixo (<= 10%) e tenta realocar suas
   * pecas nas SOBRAS (retangulos livres) das chapas anteriores.
   * Se todas as pecas couberem, descarta a chapa quase-vazia.
   *
   * Usa a funcao calcularSobras existente — atualiza sobras a cada
   * peca posicionada (re-calcula). Nao modifica posicoes ja existentes.
   */
  function salvagePass(chapas, margem, kerf) {
    if (chapas.length < 2) return chapas;

    // Felipe (sessao 2026-05): salvage AGRESSIVO. Iteração:
    // 1) Para cada chapa (de TRAS pra FRENTE), tenta mover suas pecas
    //    pra SOBRAS de chapas anteriores.
    // 2) Repete ate convergir (uma rodada sem nenhum movimento).
    // 3) Remove chapas que ficaram totalmente vazias.
    //
    // Diferente da versao anterior, NAO usa threshold de aproveitamento —
    // sempre tenta mover qualquer peca que coubeer numa sobra. O custo
    // e' maior mas o resultado e' otimo (cada peca encontra o melhor
    // encaixe possivel sem destruir o nesting principal).
    // Felipe sessao 12: 'ainda nao juntou L da cava... esses dois quadrados
    // pequenos podiam ir para chapa 01 e ia sobrar mais material'.
    //
    // BUG do salvage anterior: 'const sobras = calcularSobrasDetalhadas(chapas[j])'
    // era calculado UMA vez por (i, j) - mas dentro do mesmo (i, j), se uma
    // peca era movida pra chapas[j], as sobras nao eram recalculadas.
    // Resultado: 2a peca podia tentar usar a mesma sobra ja' ocupada pela
    // 1a, e a comparacao 'o.larg <= sobra.w' achava que ainda cabia (mas
    // ja' nao cabia mais).
    //
    // FIX: cache de sobras por chapa. Invalida o cache quando uma peca e'
    // adicionada na chapa. Proxima leitura recalcula. Garante que cada peca
    // testa contra sobras ATUAIS.
    const sobrasCache = {}; // {chapaIdx: sobras[]}
    function getSobras(j) {
      if (!sobrasCache[j]) {
        sobrasCache[j] = calcularSobrasDetalhadas(chapas[j], margem);
      }
      return sobrasCache[j];
    }
    function invalidarSobras(j) {
      delete sobrasCache[j];
    }

    let mudou = true;
    let safetyLoop = 0;
    while (mudou && safetyLoop < 5) {
      mudou = false;
      safetyLoop++;
      // Limpa cache no inicio de cada rodada (estados podem ter mudado)
      for (const k in sobrasCache) delete sobrasCache[k];
      for (let i = chapas.length - 1; i > 0; i--) {
        const c = chapas[i];
        if (!c.pecasPosicionadas.length) continue;
        // Itera copia pra poder remover do array original
        const pecasOrig = c.pecasPosicionadas.slice();
        const movidas = [];
        pecasOrig.forEach(placedPeca => {
          const peca = placedPeca.peca;
          if (!peca) return;
          // Tenta cada chapa anterior (j < i)
          for (let j = 0; j < i; j++) {
            const sobras = getSobras(j);
            if (!sobras.length) continue;
            const orientacoes = peca.podeRotacionar
              ? [{ larg: peca.largura, alt: peca.altura, rotada: false },
                 { larg: peca.altura,  alt: peca.largura, rotada: true }]
              : [{ larg: peca.largura, alt: peca.altura, rotada: false }];
            let achou = false;
            for (const o of orientacoes) {
              for (const sobra of sobras) {
                if (o.larg <= sobra.w + 0.01 && o.alt <= sobra.h + 0.01) {
                  // Cabe! Move
                  // Felipe sessao 31: 'JUNTE AS PECAS NAO QUERO PECAS
                  // SOLTAS'. Antes a peca ia pro CANTO da sobra (sobra.x,
                  // sobra.y), criando gaps quando varias pecas iam pra
                  // sobras diferentes. Fix: ancorar nas pecas existentes.
                  // Procura a peca da chapa j com:
                  //   1) mesma fileira (y aproximadamente igual ao topo)
                  //   2) altura igual ou maior
                  // Se achar, posiciona na borda direita dela (x + larg + KERF).
                  // Senao, mantém comportamento antigo (sobra.x, sobra.y).
                  let placeX = sobra.x;
                  const placeY = sobra.y;
                  let melhorAnc = null;
                  // Felipe sessao 31 FIX: KERF entre pecas adjacentes.
                  // Antes xDir = pp.x + pp.larg (sem KERF), grudava as
                  // pecas (bug 2 alisares colados sem 4mm de gap).
                  const kerfUse = Number(kerf) || 0;
                  chapas[j].pecasPosicionadas.forEach(pp => {
                    // Mesma altura de topo (y) que a sobra?
                    if (Math.abs(pp.y - sobra.y) > 1) return;
                    // Altura compativel (peca cabe no mesmo "andar")?
                    if (pp.alt < o.alt - 0.01) return;
                    // Borda direita da peca existente + KERF
                    const xDir = pp.x + pp.larg + kerfUse;
                    // Cabe nesta posicao? (xDir + o.larg <= sobra.x + sobra.w)
                    if (xDir + o.larg > sobra.x + sobra.w + 0.01) return;
                    // Borda direita esta DENTRO da sobra (com tolerancia de KERF)?
                    if (xDir < sobra.x - kerfUse - 1 || xDir > sobra.x + kerfUse + 1) return;
                    // Candidato: prefere o que ta mais a esquerda
                    if (!melhorAnc || xDir < melhorAnc.xDir) {
                      melhorAnc = { xDir, pp };
                    }
                  });
                  if (melhorAnc) placeX = melhorAnc.xDir;

                  chapas[j].pecasPosicionadas.push({
                    peca,
                    x: placeX,
                    y: placeY,
                    larg: o.larg,
                    alt: o.alt,
                    rotada: o.rotada,
                  });
                  invalidarSobras(j);  // proxima peca recalcula
                  movidas.push(placedPeca);
                  mudou = true;
                  achou = true;
                  break;
                }
              }
              if (achou) break;
            }
            if (achou) break;
          }
        });
        // Remove pecas movidas da chapa de origem
        if (movidas.length) {
          c.pecasPosicionadas = c.pecasPosicionadas.filter(
            p => !movidas.includes(p));
          invalidarSobras(i);  // chapa de origem ganhou sobras
        }
      }
      // Remove chapas vazias APOS cada iteracao completa
      for (let i = chapas.length - 1; i >= 0; i--) {
        if (!chapas[i].pecasPosicionadas.length) {
          chapas.splice(i, 1);
          mudou = true;
        }
      }
    }

    // Felipe sessao 31: SALVAGE INVERSO — move PEQUENAS das chapas
    // mais cheias pra sobras das chapas com poucas pecas grandes.
    // Caso: chapa A tem 30 alisares verticais (cheia) e chapa B tem 2
    // frontais (44%, sobra horizontal embaixo livre). Os alisares
    // horizontais e complementos da chapa A poderiam ir pras sobras
    // da chapa B SEM aumentar o numero de chapas.
    //
    // Diferente do salvage normal, NAO move pra reduzir chapas — move
    // pra DISTRIBUIR carga, equilibrando aproveitamento. So' aceita
    // movimento se:
    //   1) Chapa destino tem aprov < 70% (tem espaco real sobrando)
    //   2) Peca cabe numa sobra grande (area sobra > 5x area peca)
    //   3) Peca e' "pequena" (area < 25% area da chapa)
    //
    // Pre-requisito: rodou apos o salvage normal, entao chapas vazias
    // ja foram removidas.
    let mudouInv = true;
    let safetyInv = 0;
    while (mudouInv && safetyInv < 3) {
      mudouInv = false;
      safetyInv++;
      for (const k in sobrasCache) delete sobrasCache[k];
      const dispLarg = (chapas[0]?.largura || 0) - 2 * margem;
      const dispAlt  = (chapas[0]?.altura  || 0) - 2 * margem;
      const areaChapa = dispLarg * dispAlt;
      if (areaChapa <= 0) break;
      // Para cada chapa CHEIA (origem), tenta mover pecas pequenas pra
      // chapas POSTERIORES com sobra real.
      for (let i = 0; i < chapas.length - 1; i++) {
        const cOrig = chapas[i];
        if (!cOrig.pecasPosicionadas.length) continue;
        const areaOrig = cOrig.pecasPosicionadas.reduce((s, p) => s + p.larg * p.alt, 0);
        const aprovOrig = areaOrig / areaChapa;
        // So' move se chapa origem tiver aprov alta (>60%) — chapas
        // pouco aproveitadas nao tem pecas "sobrando" pra distribuir.
        if (aprovOrig < 0.60) continue;
        // Pega pecas candidatas (pequenas)
        const pecasCandidatas = cOrig.pecasPosicionadas
          .filter(pp => (pp.larg * pp.alt) < 0.25 * areaChapa)
          .slice();
        if (!pecasCandidatas.length) continue;
        const movidas = [];
        pecasCandidatas.forEach(placedPeca => {
          const peca = placedPeca.peca;
          if (!peca) return;
          const orientacoes = peca.podeRotacionar
            ? [{ larg: peca.largura, alt: peca.altura, rotada: false },
               { larg: peca.altura,  alt: peca.largura, rotada: true }]
            : [{ larg: peca.largura, alt: peca.altura, rotada: false }];
          // Procura chapa destino POSTERIOR com aprov <70% e sobra suficiente
          for (let j = i + 1; j < chapas.length; j++) {
            const cDest = chapas[j];
            const areaDest = cDest.pecasPosicionadas.reduce((s, p) => s + p.larg * p.alt, 0);
            const aprovDest = areaDest / areaChapa;
            if (aprovDest >= 0.70) continue;
            const sobras = getSobras(j);
            if (!sobras.length) continue;
            let achou = false;
            for (const o of orientacoes) {
              for (const sobra of sobras) {
                if (o.larg <= sobra.w + 0.01 && o.alt <= sobra.h + 0.01) {
                  // Ancora em peca adjacente (mesmo padrao do salvage normal)
                  // Felipe sessao 31 FIX: KERF entre pecas adjacentes
                  let placeX = sobra.x;
                  const placeY = sobra.y;
                  let melhorAnc = null;
                  const kerfUse2 = Number(kerf) || 0;
                  cDest.pecasPosicionadas.forEach(pp => {
                    if (Math.abs(pp.y - sobra.y) > 1) return;
                    if (pp.alt < o.alt - 0.01) return;
                    const xDir = pp.x + pp.larg + kerfUse2;
                    if (xDir + o.larg > sobra.x + sobra.w + 0.01) return;
                    if (xDir < sobra.x - kerfUse2 - 1 || xDir > sobra.x + kerfUse2 + 1) return;
                    if (!melhorAnc || xDir < melhorAnc.xDir) melhorAnc = { xDir };
                  });
                  if (melhorAnc) placeX = melhorAnc.xDir;

                  cDest.pecasPosicionadas.push({
                    peca, x: placeX, y: placeY,
                    larg: o.larg, alt: o.alt, rotada: o.rotada,
                  });
                  invalidarSobras(j);
                  movidas.push(placedPeca);
                  mudouInv = true;
                  achou = true;
                  break;
                }
              }
              if (achou) break;
            }
            if (achou) break;
          }
        });
        if (movidas.length) {
          cOrig.pecasPosicionadas = cOrig.pecasPosicionadas.filter(
            p => !movidas.includes(p));
          invalidarSobras(i);
        }
      }
    }

    // Felipe sessao 12: PASS FINAL AGRESSIVO PRA PECAS PEQUENAS.
    // Mesmo apos salvage acima, podem sobrar pecas pequenas em chapas com
    // aproveitamento bom (>50%) que poderiam ir pra sobras de chapas
    // ANTERIORES com aproveitamento ainda melhor. Print Felipe sessao 12:
    // Chapa 1 86% + Chapa 2 73% - 2 pecas 'L da C' pequenas (~50x110mm)
    // na Chapa 2 que cabem nas sobras da Chapa 1.
    //
    // Diferente do salvage acima: aqui considera TODAS as pecas (qualquer
    // chapa, incluindo Chapa 1) pra mover pra sobras de chapas anteriores.
    // So' move se a peca for pequena (area < 0.3 m² = 300.000 mm²) - pecas
    // grandes ja' foram tentadas no salvage principal. Pequenas tem mais
    // flexibilidade pra encaixar em sobras minusculas.
    for (const k in sobrasCache) delete sobrasCache[k];
    let mudouPequenas = true;
    let pequenasLoop = 0;
    while (mudouPequenas && pequenasLoop < 3) {
      mudouPequenas = false;
      pequenasLoop++;
      for (const k in sobrasCache) delete sobrasCache[k];
      for (let i = chapas.length - 1; i >= 1; i--) {
        const c = chapas[i];
        const pecasOrig = c.pecasPosicionadas.slice();
        const movidas = [];
        pecasOrig.forEach(placedPeca => {
          const peca = placedPeca.peca;
          if (!peca) return;
          const area = (Number(peca.largura) || 0) * (Number(peca.altura) || 0);
          if (area > 300000) return;  // > 0.3 m² nao e' "pequena"
          for (let j = 0; j < i; j++) {
            const sobras = getSobras(j);
            if (!sobras.length) continue;
            const orientacoes = peca.podeRotacionar
              ? [{ larg: peca.largura, alt: peca.altura, rotada: false },
                 { larg: peca.altura,  alt: peca.largura, rotada: true }]
              : [{ larg: peca.largura, alt: peca.altura, rotada: false }];
            let achou = false;
            for (const o of orientacoes) {
              for (const sobra of sobras) {
                if (o.larg <= sobra.w + 0.01 && o.alt <= sobra.h + 0.01) {
                  chapas[j].pecasPosicionadas.push({
                    peca,
                    x: sobra.x, y: sobra.y,
                    larg: o.larg, alt: o.alt,
                    rotada: o.rotada,
                  });
                  invalidarSobras(j);
                  movidas.push(placedPeca);
                  mudouPequenas = true;
                  achou = true;
                  break;
                }
              }
              if (achou) break;
            }
            if (achou) break;
          }
        });
        if (movidas.length) {
          c.pecasPosicionadas = c.pecasPosicionadas.filter(
            p => !movidas.includes(p));
          invalidarSobras(i);
        }
      }
      for (let i = chapas.length - 1; i >= 0; i--) {
        if (!chapas[i].pecasPosicionadas.length) {
          chapas.splice(i, 1);
          mudouPequenas = true;
        }
      }
    }

    // Re-calcula sobras das chapas finais
    chapas.forEach(c => {
      c.sobrasRetangulos = calcularSobras(c, margem);
    });
    return chapas;
  }

  // ============================================================
  // MODO MaxRects — algoritmo industrial usado pelo MaxCut/DeepNest.
  //
  // Felipe sessao 31: 'QUERO MELHOR ALGORITMO DE CORTE DE CHAPAS DO
  // MUNDO'. Implementacao completa do MaxRects + 5 heuristicas do
  // paper de Jukka Jylanki "A Thousand Ways to Pack the Bin" (mesmo
  // paper que MaxCut/DeepNest/SigmaNEST seguem):
  //   BSSF — Best Short Side Fit (94.06% no paper)
  //   BLSF — Best Long Side Fit
  //   BAF  — Best Area Fit
  //   BL   — Bottom-Left (Tetris)
  //   CP   — Contact Point Rule (93.35% no paper, maximiza contato)
  //
  // Felipe sessao 31: cada heuristica vence em cenarios diferentes,
  // entao a estrategia industrial e' rodar TODAS e ficar com a melhor
  // (mesmo que FitPlot.it/SigmaNEST fazem). O custo extra e' linear
  // no numero de heuristicas, paga muito barato em desperdicio.
  //
  // Diferente do multi_horiz (que abre fileiras de altura fixa) e do
  // BLF (que so' considera o skyline), o MaxRects mantem uma LISTA de
  // RETANGULOS LIVRES e, pra cada peca, testa o ENCAIXE EM TODOS eles,
  // escolhendo o que MINIMIZA o score selecionado. Quando coloca a
  // peca, divide o retangulo livre em ate 4 partes e depois LIMPA
  // retangulos cobertos por outros maiores.
  //
  // Aproveitamento esperado: 85-94% pra mix razoavel, 95%+ pra
  // padronizado (paper Jylanki).
  // ============================================================

  /**
   * Felipe sessao 31: calcula score MaxRects pra um par (peca, livre,
   * orientacao). Retorna { primary, secondary } — menor = melhor.
   *
   * @param {string} heuristica - 'BSSF' | 'BLSF' | 'BAF' | 'BL' | 'CP'
   * @param {Object} livre - { x, y, w, h }
   * @param {Object} o     - { w, h } da peca na orientacao
   * @param {Array}  colocadas - pecas ja colocadas (pra CP)
   * @param {number} chapaLarg
   * @param {number} chapaAlt
   * @return {Object} { primary, secondary } — par (menor, tiebreak)
   */
  function scoreMaxRects(heuristica, livre, o, colocadas, chapaLarg, chapaAlt) {
    const sobraW = livre.w - o.w;
    const sobraH = livre.h - o.h;
    const shortSide = Math.min(sobraW, sobraH);
    const longSide  = Math.max(sobraW, sobraH);
    switch (heuristica) {
      case 'BSSF':
        return { primary: shortSide, secondary: longSide };
      case 'BLSF':
        return { primary: longSide, secondary: shortSide };
      case 'BAF': {
        // Best Area Fit: menor sobra de area. Tiebreak por short side.
        const areaSobra = (livre.w * livre.h) - (o.w * o.h);
        return { primary: areaSobra, secondary: shortSide };
      }
      case 'BL':
        // Bottom-Left (Tetris): mais baixo (y+h), depois mais a esquerda (x)
        return { primary: livre.y + o.h, secondary: livre.x };
      case 'CP': {
        // Contact Point Rule: maximiza pontos de contato (com bordas
        // da chapa + bordas de pecas ja colocadas). Score = -contato,
        // pra que menor seja melhor (= mais contato).
        let contato = 0;
        const x1 = livre.x, x2 = livre.x + o.w;
        const y1 = livre.y, y2 = livre.y + o.h;
        // Contato com bordas da chapa
        if (x1 <= 0.5) contato += o.h;
        if (x2 >= chapaLarg - 0.5) contato += o.h;
        if (y1 <= 0.5) contato += o.w;
        if (y2 >= chapaAlt - 0.5) contato += o.w;
        // Contato com pecas ja colocadas
        for (const p of colocadas) {
          const px1 = p.x, px2 = p.x + p.larg;
          const py1 = p.y, py2 = p.y + p.alt;
          // Borda direita da peca encosta na esquerda do livre?
          if (Math.abs(px2 - x1) < 1) {
            contato += sobrePosY(y1, y2, py1, py2);
          }
          if (Math.abs(px1 - x2) < 1) {
            contato += sobrePosY(y1, y2, py1, py2);
          }
          if (Math.abs(py2 - y1) < 1) {
            contato += sobrePosX(x1, x2, px1, px2);
          }
          if (Math.abs(py1 - y2) < 1) {
            contato += sobrePosX(x1, x2, px1, px2);
          }
        }
        return { primary: -contato, secondary: shortSide };
      }
      default:
        return { primary: shortSide, secondary: longSide };
    }
  }

  /** Helper: comprimento de sobreposicao em Y entre 2 intervalos */
  function sobrePosY(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  }
  function sobrePosX(a1, a2, b1, b2) {
    return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  }

  /**
   * Felipe sessao 31: MaxRects (1 chapa) parametrizado por heuristica.
   * Coloca quantas pecas couberem. Pecas que nao caberem voltam em
   * `restantes`.
   *
   * @param {Array} pecas - pecas expandidas (cada uma 1 unidade)
   * @param {number} chapaLarg
   * @param {number} chapaAlt
   * @param {Object} cfg - {KERF, APARAR}
   * @param {string} heuristica - 'BSSF' | 'BLSF' | 'BAF' | 'BL' | 'CP'
   * @return {Object} {chapa, restantes}
   */
  function maxRectsUmaChapa(pecas, chapaLarg, chapaAlt, cfg, heuristica) {
    heuristica = heuristica || 'BSSF';
    const KERF = cfg.KERF;
    const M = cfg.APARAR;
    const dispLarg = chapaLarg - 2 * M;
    const dispAlt = chapaAlt - 2 * M;

    // Lista de retangulos livres. Comeca com a chapa inteira (descontando
    // a margem de aparar).
    const livres = [{ x: M, y: M, w: dispLarg, h: dispAlt }];
    const colocadas = [];
    const restantes = pecas.slice();

    while (restantes.length > 0) {
      // Encontra a MELHOR (peca, livre, orientacao) combinacao.
      // Score depende da heuristica. Menor = melhor.
      let melhor = null;
      for (let i = 0; i < restantes.length; i++) {
        const p = restantes[i];
        const orientacoes = p.podeRotacionar
          ? [{ w: p.largura, h: p.altura, rotada: false },
             { w: p.altura, h: p.largura, rotada: true }]
          : [{ w: p.largura, h: p.altura, rotada: false }];
        for (const o of orientacoes) {
          for (const livre of livres) {
            // Cabe?
            if (o.w > livre.w + 0.01) continue;
            if (o.h > livre.h + 0.01) continue;
            const sc = scoreMaxRects(heuristica, livre, o, colocadas, chapaLarg, chapaAlt);
            if (!melhor
                || sc.primary < melhor.primary - 0.001
                || (Math.abs(sc.primary - melhor.primary) < 0.001 && sc.secondary < melhor.secondary)) {
              melhor = {
                idx: i, p,
                x: livre.x, y: livre.y,
                w: o.w, h: o.h, rotada: o.rotada,
                primary: sc.primary, secondary: sc.secondary,
              };
            }
          }
        }
      }
      if (!melhor) break; // Nenhuma peca cabe mais

      // Coloca a peca
      colocadas.push({
        peca: melhor.p,
        x: melhor.x, y: melhor.y,
        larg: melhor.w, alt: melhor.h,
        rotada: melhor.rotada,
      });
      restantes.splice(melhor.idx, 1);

      // SPLIT: a peca foi colocada em (melhor.x, melhor.y, melhor.w +
      // KERF, melhor.h + KERF) — inclui kerf nos dois lados pra serrar.
      const cutX = melhor.x;
      const cutY = melhor.y;
      const cutW = melhor.w + KERF;
      const cutH = melhor.h + KERF;
      const novosLivres = [];
      for (const livre of livres) {
        if (!retsIntersect(livre, { x: cutX, y: cutY, w: cutW, h: cutH })) {
          novosLivres.push(livre);
          continue;
        }
        // Quebra livre em ate 4 retangulos (esquerda, direita, embaixo, em cima).
        if (cutY > livre.y) {
          novosLivres.push({
            x: livre.x, y: livre.y,
            w: livre.w, h: cutY - livre.y,
          });
        }
        const cutYFim = cutY + cutH;
        const livreYFim = livre.y + livre.h;
        if (cutYFim < livreYFim) {
          novosLivres.push({
            x: livre.x, y: cutYFim,
            w: livre.w, h: livreYFim - cutYFim,
          });
        }
        if (cutX > livre.x) {
          novosLivres.push({
            x: livre.x, y: livre.y,
            w: cutX - livre.x, h: livre.h,
          });
        }
        const cutXFim = cutX + cutW;
        const livreXFim = livre.x + livre.w;
        if (cutXFim < livreXFim) {
          novosLivres.push({
            x: cutXFim, y: livre.y,
            w: livreXFim - cutXFim, h: livre.h,
          });
        }
      }
      // CLEANUP: remove retangulos contidos em outros maiores.
      livres.length = 0;
      for (let i = 0; i < novosLivres.length; i++) {
        let contido = false;
        for (let j = 0; j < novosLivres.length; j++) {
          if (i === j) continue;
          if (retContemRet(novosLivres[j], novosLivres[i])) {
            contido = true;
            break;
          }
        }
        if (!contido && novosLivres[i].w > 0.5 && novosLivres[i].h > 0.5) {
          livres.push(novosLivres[i]);
        }
      }
    }

    const chapa = {
      largura: chapaLarg, altura: chapaAlt,
      pecasPosicionadas: colocadas,
      sobrasRetangulos: [],
    };
    chapa.sobrasRetangulos = calcularSobras(chapa, M);
    return { chapa, restantes };
  }

  /** Felipe sessao 31: dois retangulos se intersectam? */
  function retsIntersect(a, b) {
    return a.x < b.x + b.w - 0.01
        && a.x + a.w > b.x + 0.01
        && a.y < b.y + b.h - 0.01
        && a.y + a.h > b.y + 0.01;
  }

  /** Felipe sessao 31: outer contem inner? */
  function retContemRet(outer, inner) {
    return inner.x >= outer.x - 0.01
        && inner.y >= outer.y - 0.01
        && inner.x + inner.w <= outer.x + outer.w + 0.01
        && inner.y + inner.h <= outer.y + outer.h + 0.01;
  }

  /**
   * Felipe sessao 31: MaxRects multi-chapa. Roda maxRectsUmaChapa varias
   * vezes ate todas as pecas serem alocadas. Retorna no formato {chapas,
   * naoCouberam} igual aos outros motores.
   */
  function nestingMaxRects(pecas, chapaLarg, chapaAlt, cfg, heuristica) {
    const chapas = [];
    let restantes = pecas.slice();
    const naoCouberam = [];
    let limite = 500; // Safety: evita loop infinito
    while (restantes.length > 0 && limite-- > 0) {
      const { chapa, restantes: novoRest } =
        maxRectsUmaChapa(restantes, chapaLarg, chapaAlt, cfg, heuristica);
      if (chapa.pecasPosicionadas.length === 0) {
        // Nenhuma peca coube na chapa nova — todas as restantes sao maiores
        // que a chapa. Coloca em naoCouberam.
        novoRest.forEach(p => naoCouberam.push(p.ref || p));
        break;
      }
      chapas.push(chapa);
      restantes = novoRest;
    }
    return { chapas, naoCouberam };
  }

  // ============================================================
  // GENETIC ALGORITHM — Felipe sessao 31 [2/N]
  //
  // Pesquisa: DeepNest e SVGnest usam GA sobre a ordem das pecas
  // (cromossomo) + rotacoes. Fitness = -bins usados.
  //
  // Adaptacao Projetta:
  //   Cromossomo = permutacao das pecas expandidas
  //   Fitness    = MaxRects-BSSF(ordem) -> -numChapas (menos = melhor)
  //   Selecao    = Tournament (k=3)
  //   Crossover  = OX1 (Order Crossover)
  //   Mutacao    = swap de 2 pecas (rate 0.1)
  //   Elitismo   = mantem o melhor da geracao
  //   Pop=16, Gen=12 — total ~200 evals MaxRects. UI responsiva.
  //
  // Como sao pecas iguais varias vezes (10 frontais identicas), o GA
  // tende a CONVERGIR rapido — ele encontra o "padrao" canonico em
  // poucas geracoes.
  // ============================================================
  function runGA(expandidas, chapaLarg, chapaAlt, cfg, seedSolucao) {
    // Felipe sessao 31: parametros calibrados pra velocidade vs qualidade.
    // Pop=12, Gen=8 = ~100 evals MaxRects. Cada eval ~5ms pra 110 pecas
    // -> total ~500ms. Aceitavel pra orcamento (UI nao bloqueia).
    const POP = 12;
    const GENS = 8;
    const TOURNEY = 3;
    const TX_MUT = 0.25;
    const N = expandidas.length;
    if (N < 2) return null;

    // Avalia uma ordem -> resultado MaxRects-BSSF
    function fitness(ordem) {
      // ordem = array de indices em expandidas. Reconstroi a lista.
      const lista = ordem.map(i => expandidas[i]);
      return nestingMaxRects(lista, chapaLarg, chapaAlt, cfg, 'BSSF');
    }
    function fitMenor(a, b) {
      // Retorna negativo se a melhor que b
      return compararResultados(a, b);
    }

    // Pop inicial: 4 sementes deterministicas (area/altura/largura/perim)
    // + 12 permutacoes aleatorias.
    const idxs = expandidas.map((_, i) => i);
    function porChave(chave) {
      return idxs.slice().sort((a, b) => chave(expandidas[b]) - chave(expandidas[a]));
    }
    const seeds = [
      porChave(p => p.largura * p.altura),       // area DESC
      porChave(p => p.altura),                   // altura DESC
      porChave(p => p.largura),                  // largura DESC
      porChave(p => p.largura + p.altura),       // perimetro DESC
    ];
    function embaralhar(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    const populacao = [];
    seeds.forEach(s => populacao.push(s));
    while (populacao.length < POP) {
      populacao.push(embaralhar(seeds[0]));
    }
    // Avalia toda populacao
    let avaliacoes = populacao.map(ord => ({ ord, fit: fitness(ord) }));
    avaliacoes.sort((a, b) => fitMenor(a.fit, b.fit));
    let melhorGA = avaliacoes[0];

    // Se a semente externa (melhor MaxRects ja' rodado) e' melhor que
    // tudo aqui, usa ela como base inicial pra crossover.
    if (seedSolucao && fitMenor(seedSolucao, melhorGA.fit) < 0) {
      melhorGA = { ord: seeds[0], fit: seedSolucao };
    }

    function torneio() {
      let best = avaliacoes[Math.floor(Math.random() * avaliacoes.length)];
      for (let k = 1; k < TOURNEY; k++) {
        const c = avaliacoes[Math.floor(Math.random() * avaliacoes.length)];
        if (fitMenor(c.fit, best.fit) < 0) best = c;
      }
      return best.ord;
    }
    function crossoverOX1(p1, p2) {
      // Order Crossover 1: pega um segmento de p1 e completa com p2
      // mantendo a ordem.
      const n = p1.length;
      const ini = Math.floor(Math.random() * n);
      const fim = Math.floor(Math.random() * n);
      const lo = Math.min(ini, fim), hi = Math.max(ini, fim);
      const filho = new Array(n);
      const usados = new Set();
      for (let i = lo; i <= hi; i++) {
        filho[i] = p1[i];
        usados.add(p1[i]);
      }
      let k = (hi + 1) % n;
      for (let i = 0; i < n; i++) {
        const g = p2[(hi + 1 + i) % n];
        if (!usados.has(g)) {
          filho[k] = g;
          k = (k + 1) % n;
        }
      }
      return filho;
    }
    function mutar(ord) {
      const a = ord.slice();
      const i = Math.floor(Math.random() * a.length);
      const j = Math.floor(Math.random() * a.length);
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    }

    for (let g = 0; g < GENS; g++) {
      // Elitismo: mantem o melhor da geracao
      const novaPop = [melhorGA.ord];
      while (novaPop.length < POP) {
        const p1 = torneio();
        const p2 = torneio();
        let filho = crossoverOX1(p1, p2);
        if (Math.random() < TX_MUT) filho = mutar(filho);
        novaPop.push(filho);
      }
      avaliacoes = novaPop.map(ord => ({ ord, fit: fitness(ord) }));
      avaliacoes.sort((a, b) => fitMenor(a.fit, b.fit));
      if (fitMenor(avaliacoes[0].fit, melhorGA.fit) < 0) {
        melhorGA = avaliacoes[0];
      }
    }

    return melhorGA.fit;
  }

  // ============================================================
  // SIMULATED ANNEALING — Felipe sessao 31 [3/N]
  //
  // Pesquisa: paper Kirkpatrick 1983 + 'Bin-packing by simulated
  // annealing' (Coffman, Lueker). SigmaNEST e SA-FGS (paper 2023)
  // usam SA pra refinar solucoes do GA.
  //
  // Conceito: pega a melhor ordem ja' encontrada e faz pequenas
  // perturbacoes (swap de 2 pecas vizinhas). Calcula novo fitness:
  //   se melhor   -> aceita
  //   se pior     -> aceita com probabilidade e^(-delta/T)
  // T (temperatura) comeca alta e diminui exponencialmente. No fim
  // o SA so' aceita melhoras (ja' "esfriou"). Isso escapa de minimos
  // locais que o GA empacou.
  //
  // Parametros conservadores: 30 iteracoes (cada uma 1 eval MaxRects).
  // Tempo extra: ~150ms pra 110 pecas. SO' roda se ja' tem solucao
  // (GA ou MaxRects). Logo apos o GA.
  // ============================================================
  function runSA(seedSolucao, expandidasBase, chapaLarg, chapaAlt, cfg) {
    if (!seedSolucao || !seedSolucao.chapas || seedSolucao.chapas.length === 0) return null;
    const N = expandidasBase.length;
    if (N < 3) return seedSolucao;

    // Reconstrói a ordem que gerou seedSolucao. Como nao temos isso
    // direto, usa a ordem das pecas COLOCADAS pra aproximar.
    // (Cada peca em seedSolucao.chapas[].pecasPosicionadas.peca tem
    // referencia a' ref ou ela mesma — mas pode haver perdas.)
    // Solucao mais simples: pega ordem por area DESC (a mais comum
    // que gera o melhor MaxRects).
    let melhorOrd = expandidasBase.map((_, i) => i).sort((a, b) => {
      const pa = expandidasBase[a], pb = expandidasBase[b];
      return (pb.largura * pb.altura) - (pa.largura * pa.altura);
    });
    let melhorFit = seedSolucao;

    // Temperatura inicial: proporcional ao numero de chapas atual.
    // Cool rate 0.85 (rapido).
    let T = 1.0;
    const COOL = 0.88;
    const ITER = 30;

    let ordAtual = melhorOrd.slice();
    let fitAtual = melhorFit;

    for (let it = 0; it < ITER; it++) {
      // Perturba: swap de 2 pecas aleatorias (ou 3 com prob baixa)
      const nova = ordAtual.slice();
      const i = Math.floor(Math.random() * N);
      let j = Math.floor(Math.random() * N);
      while (j === i) j = Math.floor(Math.random() * N);
      [nova[i], nova[j]] = [nova[j], nova[i]];
      // Eventualmente troca um terceiro elemento (perturbacao maior)
      if (Math.random() < 0.15) {
        const k = Math.floor(Math.random() * N);
        [nova[i], nova[k]] = [nova[k], nova[i]];
      }

      // Avalia
      const novaFit = nestingMaxRects(
        nova.map(idx => expandidasBase[idx]),
        chapaLarg, chapaAlt, cfg, 'BSSF');
      const cmp = compararResultados(novaFit, fitAtual);
      if (cmp < 0) {
        // Melhor: aceita sempre
        ordAtual = nova;
        fitAtual = novaFit;
        if (compararResultados(novaFit, melhorFit) < 0) {
          melhorOrd = nova;
          melhorFit = novaFit;
        }
      } else if (cmp > 0) {
        // Pior: aceita com probabilidade e^(-delta/T)
        // delta = diferenca de chapas (1 = aumentou 1 chapa)
        const delta = (novaFit.chapas.length - fitAtual.chapas.length);
        const prob = Math.exp(-delta / T);
        if (Math.random() < prob) {
          ordAtual = nova;
          fitAtual = novaFit;
        }
      }
      T *= COOL;
    }
    return melhorFit;
  }

  // ============================================================
  // FUNCAO PRINCIPAL — MULTI-START
  // Felipe (sessao 2026-05): roda VARIAS estrategias de ordenacao
  // (8 sementes diferentes) e pega a com MELHOR aproveitamento.
  // Cada estrategia usa criterios diferentes de "qual peca colocar
  // primeiro": altura DESC, area DESC, largura DESC, e variacoes
  // com agrupamento por categoria/altura. Isso simula o que o
  // MaxCut faz na pratica — nao e' IA, e' heuristica multi-start.
  // ============================================================
  function aproveitar(pecas, chapaLarg, chapaAlt, contadorInicial) {
    if (!Array.isArray(pecas) || !pecas.length) {
      return {
        chapas: [], numChapas: 0, pecasNaoCouberam: [],
        areaUsadaTotal: 0, areaTotalTodas: 0, taxaAproveitamento: 0,
        proxContador: contadorInicial || 100,
      };
    }
    const cfg = getConfig();
    const exp = expandirPecas(pecas, contadorInicial || 100);
    const expandidas = exp.expandidas;

    // Felipe (sessao 2026-05): MULTI-START — testa 8 estrategias
    // de ordenacao e pega a com melhor aproveitamento. Pra
    // 'normal' (BLF) tambem aplica, mas se torna mais caro
    // e menos estavel — manter so 1 tentativa pra ele.
    let melhor = null;
    if (cfg.METODO === 'normal') {
      // BLF puro — 1 tentativa
      melhor = nestingBLF(expandidas, chapaLarg, chapaAlt, cfg);
    } else {
      // Multi-start pra metodos guillotine
      const estrategias = [
        // 1. Area DESC (peca grande primeiro)
        (arr) => arr.slice().sort((a, b) =>
          (b.largura * b.altura) - (a.largura * a.altura) ||
          b.altura - a.altura),
        // 2. Altura DESC, largura DESC (NFDH classico)
        (arr) => arr.slice().sort((a, b) =>
          b.altura - a.altura || b.largura - a.largura),
        // 3. Largura DESC, altura DESC
        (arr) => arr.slice().sort((a, b) =>
          b.largura - a.largura || b.altura - a.altura),
        // 4. Altura DESC, largura ASC (pecas finas primeiro na fileira)
        (arr) => arr.slice().sort((a, b) =>
          b.altura - a.altura || a.largura - b.largura),
        // 5. Agrupado por classe de altura (10% tolerancia)
        (arr) => agruparPorAltura(arr, 0.10),
        // 6. Agrupado por classe de altura (5% tolerancia, mais estrito)
        (arr) => agruparPorAltura(arr, 0.05),
        // 7. Categoria PORTAL primeiro (mais alto), depois PORTA
        (arr) => arr.slice().sort((a, b) => {
          const ca = a.categoria === 'portal' ? 0 : 1;
          const cb = b.categoria === 'portal' ? 0 : 1;
          if (ca !== cb) return ca - cb;
          return b.altura - a.altura || b.largura - a.largura;
        }),
        // 8. Perimetro DESC (peca com maior contorno primeiro)
        (arr) => arr.slice().sort((a, b) =>
          (b.largura + b.altura) - (a.largura + a.altura) ||
          (b.largura * b.altura) - (a.largura * a.altura)),
        // 9. Felipe sessao 12: agrupado por LABEL similar (prefixo).
        // 'tente juntar pecas com nomes parecidos'. Pecas Acabamento
        // ficam juntas, Tampa ficam juntas, Fita ficam juntas, etc.
        // Reduz fragmentacao em chapas de 6%/52% que aparecia.
        (arr) => agruparPorLabelSimilar(arr),
        // 10. Label similar + agrupar por altura interna (combinado)
        (arr) => {
          const porLabel = agruparPorLabelSimilar(arr);
          // Re-ordena dentro de cada bloco contiguo de mesmo prefixo
          // por altura DESC, mantendo grupos
          return porLabel; // ja' ordenado por altura dentro do grupo
        },
        // 11. Felipe sessao 31: 'sempre tem que deixar as pecas mais
        // proximas possiveis, se eu acumulo tudo esses pequenos nas
        // primeiras chapas me sobra mais nas outras, as sobras a gente
        // aproveita'. Estrategia: GRANDES primeiro (ocupam suas chapas),
        // PEQUENAS depois TODAS JUNTAS (concentram no fim das primeiras
        // chapas que ainda tem sobra, em vez de espalhar 1 por chapa).
        (arr) => concentrarPequenas(arr, 0.30),
        // 12. Variacao: pequenas = area < 50% da mediana (mais agressivo).
        (arr) => concentrarPequenas(arr, 0.50),
      ];

      // Felipe sessao 31: testa multi_horiz com cada estrategia. Testa
      // multi_vert TAMBEM, MAS so' se TODAS as pecas podem rotacionar
      // (caso contrario, multi_vert gira fisicamente as pecas — bug).
      // BLF e' opcional no fim.
      const podeVert = todasPodemRotacionar(expandidas);
      for (const estrat of estrategias) {
        try {
          const ordenadas = estrat(expandidas);
          const candH = nestingMultiHoriz(ordenadas, chapaLarg, chapaAlt, cfg);
          if (!melhor || compararResultados(candH, melhor) < 0) melhor = candH;
          if (podeVert) {
            const candV = nestingMultiVert(ordenadas, chapaLarg, chapaAlt, cfg);
            if (!melhor || compararResultados(candV, melhor) < 0) melhor = candV;
          }
        } catch (e) {
          console.warn('[Aproveitamento] estrategia falhou', e);
        }
      }
      // BLF puro como ultima tentativa (otimo pra layouts mistos)
      try {
        const candBLF = nestingBLF(expandidas, chapaLarg, chapaAlt, cfg);
        if (!melhor || compararResultados(candBLF, melhor) < 0) melhor = candBLF;
      } catch (e) { /* skip */ }
      // Felipe sessao 31: MaxRects e' o algoritmo INDUSTRIAL — mesmo
      // que MaxCut/DeepNest/SigmaNEST usam. Roda TODAS as 5 heuristicas
      // do paper Jukka Jylanki "A Thousand Ways to Pack the Bin":
      //   BSSF (best short side), BLSF (best long side), BAF (best area),
      //   BL (bottom-left), CP (contact point).
      // E TODAS as 4 ordenacoes iniciais. Total: 5 × 4 = 20 candidatos
      // MaxRects. Pega o melhor.
      const heuristicasMR = ['BSSF', 'BLSF', 'BAF', 'BL', 'CP'];
      const ordsMaxRects = [
        (arr) => arr.slice().sort((a, b) => (b.largura * b.altura) - (a.largura * a.altura)),
        (arr) => arr.slice().sort((a, b) => b.altura - a.altura || b.largura - a.largura),
        (arr) => arr.slice().sort((a, b) => Math.max(b.largura, b.altura) - Math.max(a.largura, a.altura)),
        (arr) => arr.slice().sort((a, b) => (b.largura + b.altura) - (a.largura + a.altura)),
      ];
      for (const ord of ordsMaxRects) {
        for (const h of heuristicasMR) {
          try {
            const pecasMR = ord(expandidas);
            const candMR = nestingMaxRects(pecasMR, chapaLarg, chapaAlt, cfg, h);
            if (!melhor || compararResultados(candMR, melhor) < 0) melhor = candMR;
          } catch (e) {
            console.warn('[Aproveitamento] MaxRects ' + h + ' falhou', e);
          }
        }
      }

      // Felipe sessao 31 [GA]: Genetic Algorithm sobre a ordem das pecas.
      // DeepNest/SVGnest fazem isso. Cromossomo = ordem das pecas
      // expandidas. Fitness = -numChapas (menos chapas = melhor). Pop
      // inicial = pecasMR ja ordenadas (de cima) + algumas variacoes
      // aleatorias. Crossover = OX1 (Order Crossover). Mutacao = swap.
      //
      // Felipe sessao 31: GA so' roda se vale a pena (>10 pecas E
      // potencialmente > 1 chapa). Pra problemas pequenos o MaxRects
      // ja' acerta. Pra problemas grandes o GA encontra layouts que
      // ordenacoes deterministicas nao descobririam.
      const valePenaGA = expandidas.length >= 10
        && melhor && melhor.chapas && melhor.chapas.length > 1;
      if (valePenaGA) {
        try {
          const candGA = runGA(expandidas, chapaLarg, chapaAlt, cfg, melhor);
          if (candGA && (!melhor || compararResultados(candGA, melhor) < 0)) {
            melhor = candGA;
          }
        } catch (e) {
          console.warn('[Aproveitamento] GA falhou', e);
        }
        // Felipe sessao 31 [3/N]: Simulated Annealing refinement.
        // Pega o melhor encontrado ate aqui e tenta micro-perturbacoes
        // (swap de 2 pecas) com aceitacao probabilistica de pioras.
        // Permite escapar de minimos locais do GA.
        try {
          const candSA = runSA(melhor, expandidas, chapaLarg, chapaAlt, cfg);
          if (candSA && (!melhor || compararResultados(candSA, melhor) < 0)) {
            melhor = candSA;
          }
        } catch (e) {
          console.warn('[Aproveitamento] SA falhou', e);
        }
      }
    }

    // Felipe (sessao 2026-05): SALVAGE PASS — depois de escolhida a
    // melhor estrategia, tenta realocar pecas de chapas com <10%
    // aproveitamento nas SOBRAS de chapas anteriores. Corrige o
    // bug "3 pecas pequenas viram chapa nova" (Imagem 3) e "Chapa
    // 3 com 1 peca de 2%" (Imagem 5).
    if (melhor && melhor.chapas && melhor.chapas.length > 1) {
      melhor.chapas = salvagePass(melhor.chapas, cfg.APARAR, cfg.KERF);
    }

    // Felipe (sessao 2026-06): COMPACTACAO BLF — Felipe enviou imagem
    // de Chapa 6 com 27% aproveitamento e 7 pecas finas espalhadas
    // ("pecas devem ser ao maximo junto das outras"). O guillotine
    // multi_horiz coloca pecas em fileiras horizontais e nao consegue
    // empilhar verticalmente alem de gaps. BLF (Bottom-Left-Fill)
    // posiciona pecas no canto inferior-esquerdo livre, mantendo-as
    // juntas. Pra cada chapa com aproveitamento < 40%, re-empacota
    // suas pecas usando BLF — se conseguir empacotar tudo numa chapa
    // com a mesma area, substitui o layout original.
    if (melhor && melhor.chapas) {
      melhor.chapas.forEach((c, idx) => {
        const dispLarg = chapaLarg - 2 * cfg.APARAR;
        const dispAlt  = chapaAlt  - 2 * cfg.APARAR;
        const areaTot = dispLarg * dispAlt;
        const areaUs  = c.pecasPosicionadas.reduce((s, p) => s + p.larg * p.alt, 0);
        const taxa   = areaTot > 0 ? areaUs / areaTot : 0;
        if (taxa >= 0.40) return;  // chapa ja' compacta o suficiente
        if (c.pecasPosicionadas.length < 2) return;  // 1 peca so', nao adianta

        // Pega as pecas atuais da chapa (com dimensoes ja' aplicadas)
        const pecasRepack = c.pecasPosicionadas.map(pp => ({
          label: pp.peca.label,
          largura: pp.larg,
          altura: pp.alt,
          podeRotacionar: pp.peca.podeRotacionar,
          cor: pp.peca.cor,
          categoria: pp.peca.categoria,
          ref: pp.peca,
          id: pp.peca.id,
        }));

        // Roda BLF — mais agressivo em compactar
        try {
          const repacked = nestingBLF(pecasRepack, chapaLarg, chapaAlt, cfg);
          if (repacked.chapas.length === 1 && !repacked.naoCouberam.length) {
            // Conseguiu! Substitui a chapa pelo layout BLF
            c.pecasPosicionadas = repacked.chapas[0].pecasPosicionadas;
            c.sobrasRetangulos = repacked.chapas[0].sobrasRetangulos;
          }
        } catch (e) {
          console.warn('[Aproveitamento] repack BLF falhou', e);
        }
      });
    }

    // Felipe sessao 12 + sessao 31: REPACK FINAL GLOBAL com MULTI-START
    // E LOOP. Antes rodava 1 vez com area-DESC -> ficava preso em minimos
    // locais. Agora:
    //   1) Pega TODAS chapas com aprov <60% (era 50%) — pega mais casos
    //      como chapa 6 da imagem (44%).
    //   2) Tenta 12+ estrategias diferentes de ordenacao + multi_horiz E BLF.
    //   3) Pega a com MENOS chapas (tiebreak: mais concentrado).
    //   4) Repete enquanto reduzir — uma reducao pode habilitar a proxima.
    //   5) Safety: max 5 iteracoes (evita loop infinito em casos patologicos).
    function _coletarPecasRepack(chapasRefazer) {
      const pecas = [];
      chapasRefazer.forEach(c => {
        c.pecasPosicionadas.forEach(pp => {
          pecas.push({
            label: pp.peca.label,
            largura: pp.peca.largura,  // dim ORIGINAL (nao rotacionada)
            altura: pp.peca.altura,
            podeRotacionar: pp.peca.podeRotacionar,
            cor: pp.peca.cor,
            categoria: pp.peca.categoria,
            ref: pp.peca,
            id: pp.peca.id,
          });
        });
      });
      return pecas;
    }

    function _melhorRepack(pecasRefazer) {
      // Roda multi_horiz com TODAS as estrategias do multi-start.
      // multi_vert SO' se todas as pecas podem rotacionar (caso contrario
      // ele gira fisicamente as pecas - bug).
      const podeVertRP = pecasRefazer.every(p => !!p.podeRotacionar);
      let melhorRP = null;
      const estrategiasRP = [
        (arr) => arr.slice().sort((a, b) => (b.largura * b.altura) - (a.largura * a.altura) || b.altura - a.altura),
        (arr) => arr.slice().sort((a, b) => b.altura - a.altura || b.largura - a.largura),
        (arr) => arr.slice().sort((a, b) => b.largura - a.largura || b.altura - a.altura),
        (arr) => arr.slice().sort((a, b) => b.altura - a.altura || a.largura - b.largura),
        (arr) => agruparPorAltura(arr, 0.10),
        (arr) => agruparPorAltura(arr, 0.05),
        (arr) => arr.slice().sort((a, b) => {
          const ca = a.categoria === 'portal' ? 0 : 1;
          const cb = b.categoria === 'portal' ? 0 : 1;
          if (ca !== cb) return ca - cb;
          return b.altura - a.altura || b.largura - a.largura;
        }),
        (arr) => arr.slice().sort((a, b) => (b.largura + b.altura) - (a.largura + a.altura) || (b.largura * b.altura) - (a.largura * a.altura)),
        (arr) => agruparPorLabelSimilar(arr),
        (arr) => concentrarPequenas(arr, 0.30),
        (arr) => concentrarPequenas(arr, 0.50),
      ];
      for (const estrat of estrategiasRP) {
        try {
          const ordenadas = estrat(pecasRefazer);
          const candH = nestingMultiHoriz(ordenadas, chapaLarg, chapaAlt, cfg);
          if (!melhorRP || compararResultados(candH, melhorRP) < 0) melhorRP = candH;
          if (podeVertRP) {
            const candV = nestingMultiVert(ordenadas, chapaLarg, chapaAlt, cfg);
            if (!melhorRP || compararResultados(candV, melhorRP) < 0) melhorRP = candV;
          }
        } catch (e) { /* skip */ }
      }
      // Tambem tenta BLF puro (otimo pra compactacao vertical)
      try {
        const candBLF = nestingBLF(pecasRefazer, chapaLarg, chapaAlt, cfg);
        if (!melhorRP || compararResultados(candBLF, melhorRP) < 0) melhorRP = candBLF;
      } catch (e) { /* skip */ }
      return melhorRP;
    }

    if (melhor && melhor.chapas && melhor.chapas.length >= 2) {
      const dispLarg = chapaLarg - 2 * cfg.APARAR;
      const dispAlt  = chapaAlt  - 2 * cfg.APARAR;
      const areaTot = dispLarg * dispAlt;

      let iter = 0;
      let reduziu = true;
      while (reduziu && iter < 5) {
        iter++;
        reduziu = false;

        // Identifica chapas com aproveitamento <60% (candidatas a refazer)
        const indicesRefazer = [];
        melhor.chapas.forEach((c, i) => {
          const areaUs = c.pecasPosicionadas.reduce((s, p) => s + p.larg * p.alt, 0);
          const taxa = areaTot > 0 ? areaUs / areaTot : 0;
          if (taxa < 0.60) indicesRefazer.push(i);
        });

        if (indicesRefazer.length < 2) break;

        const pecasRefazer = _coletarPecasRepack(
          indicesRefazer.map(i => melhor.chapas[i])
        );

        const refeitas = _melhorRepack(pecasRefazer);

        if (refeitas
            && refeitas.chapas.length < indicesRefazer.length
            && !refeitas.naoCouberam.length) {
          // Remove as chapas antigas
          indicesRefazer.slice().reverse().forEach(i => melhor.chapas.splice(i, 1));
          // Adiciona as novas
          refeitas.chapas.forEach(c => melhor.chapas.push(c));
          console.log('[Aproveitamento] Repack iter ' + iter + ': '
            + indicesRefazer.length + ' chapas <60% -> ' + refeitas.chapas.length + ' chapas');
          reduziu = true;
        }
      }
    }

    // Calcula areas
    const areaChapa = chapaLarg * chapaAlt;
    let areaUsadaTotal = 0;
    melhor.chapas.forEach(c => {
      const a = c.pecasPosicionadas.reduce((s, p) => s + p.larg * p.alt, 0);
      c.areaUsada = a;
      c.areaTotal = areaChapa;
      c.taxa = areaChapa > 0 ? a / areaChapa : 0;
      areaUsadaTotal += a;
    });
    const areaTotalTodas = areaChapa * melhor.chapas.length;
    const taxaAproveitamento = areaTotalTodas > 0 ? areaUsadaTotal / areaTotalTodas : 0;

    return {
      chapas: melhor.chapas,
      numChapas: melhor.chapas.length,
      pecasNaoCouberam: melhor.naoCouberam.map(p => p.ref || p),
      areaUsadaTotal,
      areaTotalTodas,
      taxaAproveitamento,
      proxContador: exp.proxContador,
      cfg,
    };
  }

  /**
   * Compara dois resultados: retorna negativo se A e' melhor que B.
   * Criterio: menos chapas > maior aproveitamento > menos pecas nao couberam.
   */
  function compararResultados(a, b) {
    // Penaliza fortemente pecas nao couberam
    const naoA = a.naoCouberam.length, naoB = b.naoCouberam.length;
    if (naoA !== naoB) return naoA - naoB;
    // Menos chapas e' melhor
    if (a.chapas.length !== b.chapas.length) return a.chapas.length - b.chapas.length;
    // Felipe sessao 31: 'sempre tem que deixar as pecas mais proximas
    // possiveis ... as sobras a gente aproveita'. Quando 2 estrategias
    // empatam em numero de chapas, prefere a que CONCENTRA mais peças
    // nas primeiras (sobra grande contigua no final em vez de retalhos
    // espalhados em todas as chapas).
    //
    // Score: soma do aproveitamento das (N-1) primeiras chapas.
    // Quanto MAIOR esse score, mais cheia ficou a parte inicial e
    // mais "limpa" ficou a ultima chapa pra sobra reutilizavel.
    const scoreA = somaAproveitamentoIniciais(a);
    const scoreB = somaAproveitamentoIniciais(b);
    if (Math.abs(scoreA - scoreB) > 0.001) return scoreB - scoreA;
    return 0;
  }

  /**
   * Felipe sessao 31: usado no tiebreak de compararResultados.
   * Soma o aproveitamento das (N-1) primeiras chapas. Se N=1, retorna
   * o aproveitamento da unica chapa. Quanto maior, mais concentrado
   * ficou — peças pequenas espalhadas em todas as chapas baixam essa
   * soma (varias chapas com pouco uso).
   */
  function somaAproveitamentoIniciais(resultado) {
    const chapas = resultado.chapas || [];
    if (!chapas.length) return 0;
    const limite = chapas.length === 1 ? 1 : chapas.length - 1;
    let soma = 0;
    for (let i = 0; i < limite; i++) {
      const c = chapas[i];
      const areaTotal = (c.dispLarg || 1) * (c.dispAlt || 1);
      const areaUsada = (c.pecasPosicionadas || []).reduce(
        (s, p) => s + (p.larg || 0) * (p.alt || 0), 0);
      soma += areaTotal > 0 ? areaUsada / areaTotal : 0;
    }
    return soma;
  }

  /**
   * Felipe sessao 31: ordena pecas pra "concentrar pequenas".
   *
   * Motivacao: a estrategia de area DESC coloca grandes primeiro e
   * deixa pequenas como aterro — pequenas espalham 1 por chapa (uma
   * em cada sobra), gerando retalhos pequenos e dificeis de reusar.
   *
   * Esta estrategia:
   *   1) Classifica pecas em GRANDES e PEQUENAS pela area mediana.
   *      Pequena = area < (mediana * thresholdMediana).
   *   2) Grupos GRANDES vem primeiro, ordenados por altura DESC
   *      (depois largura DESC) — preenchem o topo das chapas.
   *   3) Grupos PEQUENAS vem depois, todos juntos, ordenados por
   *      altura DESC + largura DESC — acumulam nas sobras das
   *      primeiras chapas em fileiras contiguas.
   *
   * Resultado: peças pequenas se empilham na 1a/2a chapa nas sobras,
   * deixando as ultimas chapas mais limpas (ou ate desnecessarias).
   *
   * @param {Array} pecas - pecas expandidas
   * @param {number} thresholdMediana - 0.30 (pequena = < 30% mediana)
   */
  function concentrarPequenas(pecas, thresholdMediana) {
    if (!pecas.length) return [];
    if (pecas.length === 1) return pecas.slice();

    // Calcula areas e mediana
    const areas = pecas.map(p => (p.largura || 0) * (p.altura || 0))
                       .sort((a, b) => a - b);
    const mediana = areas[Math.floor(areas.length / 2)] || 0;
    const corteArea = mediana * (Number(thresholdMediana) || 0.30);

    // Particiona em grandes / pequenas
    const grandes = [];
    const pequenas = [];
    pecas.forEach(p => {
      const area = (p.largura || 0) * (p.altura || 0);
      if (area >= corteArea) grandes.push(p);
      else pequenas.push(p);
    });

    // Grandes: altura DESC + largura DESC (preenchem topo)
    grandes.sort((a, b) =>
      (b.altura - a.altura) || (b.largura - a.largura));

    // Pequenas: altura DESC + largura DESC (acumulam nas sobras)
    pequenas.sort((a, b) =>
      (b.altura - a.altura) || (b.largura - a.largura));

    // Grandes primeiro, pequenas depois — todas elas em sequencia
    // pra ficarem contiguas (uma puxa a proxima na mesma sobra).
    return grandes.concat(pequenas);
  }

  /**
   * Agrupa pecas por classe de altura — pecas com altura proxima
   * (dentro de tolerancia%) ficam juntas. Dentro do grupo, ordena
   * por largura DESC. Entre grupos, classe mais alta primeiro.
   */
  function agruparPorAltura(pecas, tolerancia) {
    if (!pecas.length) return [];
    // Ordena por altura DESC
    const ordenadas = pecas.slice().sort((a, b) => b.altura - a.altura);
    // Agrupa: nova classe quando altura cai mais que tolerancia
    const grupos = [];
    let grupoAtual = [ordenadas[0]];
    let alturaRefGrupo = ordenadas[0].altura;
    for (let i = 1; i < ordenadas.length; i++) {
      const p = ordenadas[i];
      const dif = (alturaRefGrupo - p.altura) / alturaRefGrupo;
      if (dif > tolerancia) {
        grupos.push(grupoAtual);
        grupoAtual = [p];
        alturaRefGrupo = p.altura;
      } else {
        grupoAtual.push(p);
      }
    }
    grupos.push(grupoAtual);
    // Dentro de cada grupo, ordena por largura DESC
    grupos.forEach(g => g.sort((a, b) => b.largura - a.largura));
    // Concatena tudo
    return grupos.flat();
  }

  /**
   * Felipe sessao 12: 'tente juntar pecas com nomes parecidos'.
   * Agrupa pecas por PREFIXO do label (1a palavra). Pecas com mesmo
   * prefixo (ex: 'Acabamento Lateral Esquerdo', 'Acabamento Lateral
   * Direito', 'Acabamento Inferior') ficam consecutivas no array.
   * Dentro de cada grupo, ordena por altura DESC + largura DESC.
   * Entre grupos, ordena pelo grupo de maior altura primeiro (pra
   * encaixar grupos altos primeiro nas chapas).
   */
  function agruparPorLabelSimilar(pecas) {
    if (!pecas.length) return [];
    // Extrai prefixo: 1a palavra do label (ate primeiro espaco/numero/hifen)
    function prefixo(p) {
      const lbl = String(p.label || '').trim();
      // Pega ate o 1o caractere que nao seja letra/acento (espaco, digito, parenteses)
      const m = lbl.match(/^[\p{L}]+/u);
      return m ? m[0].toLowerCase() : '_outros_';
    }
    // Agrupa por prefixo
    const grupos = {};
    pecas.forEach(p => {
      const k = prefixo(p);
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(p);
    });
    // Ordena cada grupo internamente: altura DESC + largura DESC
    Object.values(grupos).forEach(g => {
      g.sort((a, b) => (b.altura - a.altura) || (b.largura - a.largura));
    });
    // Ordena os GRUPOS pela altura da maior peca de cada grupo (DESC)
    const gruposOrdenados = Object.values(grupos).sort((ga, gb) => {
      return (gb[0].altura - ga[0].altura) || (gb.length - ga.length);
    });
    return gruposOrdenados.flat();
  }

  function compararConfiguracoes(pecas, chapasMaeDisponiveis) {
    if (!Array.isArray(chapasMaeDisponiveis) || !chapasMaeDisponiveis.length) {
      return [];
    }

    // Felipe (sessao 2026-05): ordena chapas-mae por DIMENSAO crescente
    // (lado MAIOR), pra ficar consistente: 1500x5000, 1500x6000,
    // 1500x7000, 1500x8000 — independente de qual for a melhor.
    const chapasOrdenadas = chapasMaeDisponiveis.slice().sort((a, b) => {
      const maiorA = Math.max(Number(a.largura) || 0, Number(a.altura) || 0);
      const maiorB = Math.max(Number(b.largura) || 0, Number(b.altura) || 0);
      if (maiorA !== maiorB) return maiorA - maiorB;
      // Tiebreak: lado menor
      const menorA = Math.min(Number(a.largura) || 0, Number(a.altura) || 0);
      const menorB = Math.min(Number(b.largura) || 0, Number(b.altura) || 0);
      return menorA - menorB;
    });

    const resultados = chapasOrdenadas.map(chapa => {
      try {
        const r = aproveitar(pecas, chapa.largura, chapa.altura, 100);
        const precoUnit = Number(chapa.preco) || 0;
        const custoTotal = r.numChapas * precoUnit;
        return {
          chapaMae: chapa,
          numChapas: r.numChapas,
          taxaAproveitamento: r.taxaAproveitamento,
          custoTotal,
          pecasNaoCouberam: r.pecasNaoCouberam,
          chapas: r.chapas,
          areaUsadaTotal: r.areaUsadaTotal,
          areaTotalTodas: r.areaTotalTodas,
          cfg: r.cfg,
        };
      } catch (e) {
        console.warn('[Aproveitamento] erro em chapa', chapa, e);
        return {
          chapaMae: chapa, numChapas: Infinity,
          taxaAproveitamento: 0, custoTotal: Infinity,
          pecasNaoCouberam: [], chapas: [], erro: String(e),
        };
      }
    });

    // Felipe (sessao 2026-05): marca a MELHOR opcao com flag isMelhor.
    // Melhor = menor custo entre as VIAVEIS (sem pecas faltantes).
    // Se nenhuma e' viavel, melhor = a que mais aproveita.
    const viaveisIdx = resultados
      .map((r, i) => ({ r, i }))
      .filter(x => x.r.pecasNaoCouberam.length === 0);
    let melhorIdx = -1;
    if (viaveisIdx.length > 0) {
      // Tem viaveis: pega a de menor custo (ou menor numChapas se preco zero)
      const temPreco = viaveisIdx.some(x => x.r.custoTotal > 0 && isFinite(x.r.custoTotal));
      if (temPreco) {
        viaveisIdx.sort((a, b) => a.r.custoTotal - b.r.custoTotal);
      } else {
        viaveisIdx.sort((a, b) => a.r.numChapas - b.r.numChapas);
      }
      melhorIdx = viaveisIdx[0].i;
    }
    resultados.forEach((r, i) => { r.isMelhor = (i === melhorIdx); });

    return resultados;
  }

  return {
    aproveitar,
    compararConfiguracoes,
    getConfig,
    DEFAULTS,
  };
})();
