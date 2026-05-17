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
  // ============================================================
  function nestingMultiVert(pecas, chapaLarg, chapaAlt, cfg) {
    // Roda 90 graus: troca largura<->altura
    const pecasGiradas = pecas.map(p => ({
      ref: p.ref || p,
      id: p.id,
      label: p.label,
      largura: p.altura,
      altura: p.largura,
      podeRotacionar: p.podeRotacionar,
      cor: p.cor,
      categoria: p.categoria,
    }));
    const r = nestingMultiHoriz(pecasGiradas, chapaAlt, chapaLarg, cfg);
    // Volta as posicoes
    r.chapas.forEach(chapa => {
      chapa.largura = chapaLarg;
      chapa.altura = chapaAlt;
      chapa.pecasPosicionadas.forEach(pp => {
        const ovX = pp.x, ovY = pp.y, ovL = pp.larg, ovA = pp.alt;
        pp.x = ovY;
        pp.y = ovX;
        pp.larg = ovA;
        pp.alt = ovL;
        pp.rotada = !pp.rotada;
      });
      chapa.sobrasRetangulos = calcularSobras(chapa, cfg.APARAR);
    });
    r.naoCouberam = r.naoCouberam.map(p => p.ref || p);
    return r;
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
          atualizarSkyline(skyline, melhor.x, melhor.larg, melhor.y + melhor.alt + KERF);
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
  function salvagePass(chapas, margem) {
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
                  chapas[j].pecasPosicionadas.forEach(pp => {
                    // Mesma altura de topo (y) que a sobra?
                    if (Math.abs(pp.y - sobra.y) > 1) return;
                    // Altura compativel (peca cabe no mesmo "andar")?
                    if (pp.alt < o.alt - 0.01) return;
                    // Borda direita da peca existente
                    const xDir = pp.x + pp.larg;
                    // Cabe nesta posicao? (xDir + o.larg <= sobra.x + sobra.w)
                    if (xDir + o.larg > sobra.x + sobra.w + 0.01) return;
                    // Borda direita esta DENTRO da sobra (e' uma peca
                    // adjacente a esquerda da sobra)?
                    if (xDir < sobra.x - 1 || xDir > sobra.x + 1) return;
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

      for (const estrat of estrategias) {
        try {
          const ordenadas = estrat(expandidas);
          const candidato = cfg.METODO === 'multi_vert'
            ? nestingMultiVert(ordenadas, chapaLarg, chapaAlt, cfg)
            : nestingMultiHoriz(ordenadas, chapaLarg, chapaAlt, cfg);
          // Score: numero de chapas (menor melhor), tiebreak aproveitamento
          if (!melhor || compararResultados(candidato, melhor) < 0) {
            melhor = candidato;
          }
        } catch (e) {
          console.warn('[Aproveitamento] estrategia falhou', e);
        }
      }
    }

    // Felipe (sessao 2026-05): SALVAGE PASS — depois de escolhida a
    // melhor estrategia, tenta realocar pecas de chapas com <10%
    // aproveitamento nas SOBRAS de chapas anteriores. Corrige o
    // bug "3 pecas pequenas viram chapa nova" (Imagem 3) e "Chapa
    // 3 com 1 peca de 2%" (Imagem 5).
    if (melhor && melhor.chapas && melhor.chapas.length > 1) {
      melhor.chapas = salvagePass(melhor.chapas, cfg.APARAR);
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

    // Felipe sessao 12: REPACK FINAL GLOBAL. 'melhore e muito esse seu
    // motor de calculo de chapas... ainda tem que melhorar muito esse
    // algoritmo'. Print mostrava Chapa 10 (52%) + Chapa 11 (6%) - todas
    // as pecas dessas 2 chapas (4 acabamentos + 1 portal) caberiam fácil
    // em UMA chapa só. Salvage individual nao consegue mover pecas pra
    // sobras complexas; este repack pega TODAS as pecas das chapas com
    // aproveitamento <50% E tenta refazer o nesting global delas com BLF.
    // Se reduzir o numero de chapas, substitui.
    if (melhor && melhor.chapas && melhor.chapas.length >= 2) {
      const dispLarg = chapaLarg - 2 * cfg.APARAR;
      const dispAlt  = chapaAlt  - 2 * cfg.APARAR;
      const areaTot = dispLarg * dispAlt;
      // Identifica chapas com aproveitamento <50% (candidatas a refazer)
      const indicesRefazer = [];
      melhor.chapas.forEach((c, i) => {
        const areaUs = c.pecasPosicionadas.reduce((s, p) => s + p.larg * p.alt, 0);
        const taxa = areaTot > 0 ? areaUs / areaTot : 0;
        if (taxa < 0.50) indicesRefazer.push(i);
      });

      // Se tem >=2 chapas mal aproveitadas, vale tentar combinar
      if (indicesRefazer.length >= 2) {
        // Coleta TODAS as pecas dessas chapas (preservando dimensoes
        // posicionadas - ja podem estar rotacionadas)
        const pecasParaRefazer = [];
        indicesRefazer.forEach(i => {
          melhor.chapas[i].pecasPosicionadas.forEach(pp => {
            pecasParaRefazer.push({
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

        // Tenta refazer com BLF (que e' mais agressivo em compactacao)
        try {
          // Ordena por area DESC pra BLF colocar grandes primeiro
          pecasParaRefazer.sort((a, b) =>
            (b.largura * b.altura) - (a.largura * a.altura));
          const refeitas = nestingBLF(pecasParaRefazer, chapaLarg, chapaAlt, cfg);
          // So' substitui se reduzir num. de chapas
          if (refeitas.chapas.length < indicesRefazer.length &&
              !refeitas.naoCouberam.length) {
            // Remove as chapas antigas (de tras pra frente pra preservar idx)
            indicesRefazer.slice().reverse().forEach(i => {
              melhor.chapas.splice(i, 1);
            });
            // Adiciona as novas no fim
            refeitas.chapas.forEach(c => melhor.chapas.push(c));
            console.log(`[Aproveitamento] Repack final: ${indicesRefazer.length} chapas mal-aprov. → ${refeitas.chapas.length} chapas`);
          }
        } catch (e) {
          console.warn('[Aproveitamento] repack final falhou', e);
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
