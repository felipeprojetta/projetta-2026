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
     [x] Alisar (PA-ALISARINT) PERFIL   — PORTAL: 2 verticais + 1 horizontal
                                          (NAO confundir com 'alisar chapa'
                                          do 38b — sao coisas diferentes)
     [x] Travessas (PA-46X46X1.5)       — FOLHA:  2 ou 3 unidades por altura
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

    // Felipe sessao 33: painel superior — usado SO no alisar vertical
    // (perfil PA-ALISARINT) pra englobar porta+painel num bloco so'.
    // Outros perfis (batente, click batente, folha, click folha,
    // travessa) NAO mudam — o painel nao tem perfis proprios.
    const temPainelSup = item.temPainelSuperior === 'sim';
    const painelSupAlt = temPainelSup ? _toNum(item.painelSupAltura) : 0;
    const painelOk = temPainelSup && painelSupAlt > 0;

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
    //   - 1 horizontal: largura - (fglEsq+fglDir) - 11 - 11
    //   - 2 verticais : altura  - fgSup           - 11
    const compClickBatHor = larguraVao - descontoLarg - 11 - 11;
    const compClickBatVer = alturaVao  - descontoAlt  - 11;
    if (compClickBatHor > 0) {
      _add(cortes, 'PA-CLICKBTINT', compClickBatHor, 1 * qtdPortas, 'Click batente horizontal (topo)', 'portal');
    }
    if (compClickBatVer > 0) {
      _add(cortes, 'PA-CLICKBTINT', compClickBatVer, 2 * qtdPortas, 'Click batente vertical (lateral)', 'portal');
    }

    // ===== FOLHA (PA-FLHINT) — FOLHA =====
    //   - 1 horizontal (topo): largura - (fglEsq+fglDir) - 26 - 26
    //   - 2 verticais (lateral): altura - fgSup - 26 - 10
    const compFlhHor = larguraVao - descontoLarg - 26 - 26;
    const compFlhVer = alturaVao  - descontoAlt  - 26 - 10;
    if (compFlhHor > 0) {
      _add(cortes, 'PA-FLHINT', compFlhHor, 1 * qtdPortas, 'Folha horizontal (topo)');
    }
    if (compFlhVer > 0) {
      _add(cortes, 'PA-FLHINT', compFlhVer, 2 * qtdPortas, 'Folha vertical (lateral)');
    }

    // ===== CLICK DA FOLHA (PA-CLICKFLHINT) — FOLHA =====
    // Felipe sessao 31 (correcao): 'nao e -26 e 24,5 para clickflhint'.
    // Click folha tem recortes proprios (24,5), DIFERENTES da folha (26).
    //   - 1 horizontal (topo):    largura - (fglEsq+fglDir) - 24,5 - 24,5
    //   - 2 verticais (lateral):  altura  - fgSup           - 24,5 - 10
    const compClickFlhHor = larguraVao - descontoLarg - 24.5 - 24.5;
    const compClickFlhVer = alturaVao  - descontoAlt  - 24.5 - 10;
    if (compClickFlhHor > 0) {
      _add(cortes, 'PA-CLICKFLHINT', compClickFlhHor, 1 * qtdPortas, 'Click da folha horizontal (topo)');
    }
    if (compClickFlhVer > 0) {
      _add(cortes, 'PA-CLICKFLHINT', compClickFlhVer, 2 * qtdPortas, 'Click da folha vertical');
    }

    // ===== TRAVESSAS VERTICAIS (PA-46X46X1.5) — FOLHA =====
    // Felipe sessao 31: 'coloquye agora as travessas verticais e o tubo 46x46
    // medida largura vao - folga direita - folga esquerda - 108,5 - 108,5.
    // teremos 2 travessas para altura ate 2.2 mts acima disso considere 3
    // travessas'.
    //   - comp = largura_vao - fglEsq - fglDir - 108,5 - 108,5
    //   - qtd  = 2 se altura_vao <= 2200mm; 3 se > 2200mm
    const compTrav = larguraVao - descontoLarg - 108.5 - 108.5;
    const qtdTrav  = alturaVao > 2200 ? 3 : 2;
    if (compTrav > 0) {
      _add(cortes, 'PA-46X46X1.5', compTrav, qtdTrav * qtdPortas, 'Travessa vertical');
    }

    // ===== ALISAR (PA-ALISARINT) — PORTAL (perfil de aluminio) =====
    // Felipe sessao 31: 'fomula e laruga +33,5 +33,5 para perfil uma peca e
    // altura + 33,5 2 pecas esse sim fica em perfis'.
    //   - 1 horizontal (topo):  largura_vao + 33,5 + 33,5
    //   - 2 verticais (lateral): altura_vao  + 33,5
    // NAO usa folgas (medida = vao + sobras). Perfil envolve o vao externamente.
    // (Nao confundir com o 'alisar chapa' do 38b-chapas-porta-interna.js, que
    // sao 4 tiras 59,5 x (vao+100) entrando como chapas decorativas externas.)
    // Felipe sessao 33: com painel superior, o vertical engloba porta+painel
    // num bloco so' (igual ja' faz na chapa) — altura += painelSupAlt.
    const compAlisarHor = larguraVao + 33.5 + 33.5;
    const compAlisarVer = alturaVao + (painelOk ? painelSupAlt : 0) + 33.5;
    if (compAlisarHor > 0) {
      _add(cortes, 'PA-ALISARINT', compAlisarHor, 1 * qtdPortas, 'Alisar horizontal (topo)', 'portal');
    }
    if (compAlisarVer > 0) {
      _add(cortes, 'PA-ALISARINT', compAlisarVer, 2 * qtdPortas, 'Alisar vertical (lateral)', 'portal');
    }

    // ===== BOISERIE (PA-PERFILBOISERIE) — MODELO 23 "Classica com Molduras" =====
    // Felipe (sessao atual): mesma logica/configuracao do modelo 23 da PORTA
    // EXTERNA (31-perfis-porta-externa.js, bloco ehMod23AM ~660-737). O que MUDA:
    // as medidas saem da TAMPA da porta interna (chapa frontal do 38b), e o
    // boiserie vai nas 2 FACES (externa e interna), que tem medidas DIFERENTES:
    //   tampa externa: L = vao - folgas - 38,5 - 38,5 ; A = vao - fgSup - 38,5 - 12
    //   tampa interna: L = vao - folgas - 26,5 - 26,5 ; A = vao - fgSup - 26,5 - 12
    // (mesmos descontos do 38b-chapas-porta-interna.js — fonte da verdade da tampa)
    //
    // Qtd de boiseries (bandas) = quantidadeMolduras (1 ou 2). Cada banda = 2
    // horizontais + 2 verticais por face. Inset da borda = distanciaBorda1aMoldura
    // (C29, default 150). Para 2 bandas usa a mesma divisao da externa
    // (banda topo ~1048; banda baixo o resto) — constante 1048 herdada do
    // desenho do modelo 23. Mantem toda a estrutura normal da porta interna.
    if (Number(item.modeloNumero) === 23) {
      const COD_BOIS = (item.perfilMoldura
        || (window.PerfisCore && window.PerfisCore.COD_BOISERIE)
        || 'PA-PERFILBOISERIE');
      const C29 = _toNum(item.distanciaBorda1aMoldura) || 150;
      // Felipe (sessao atual): "Padrao" (ou vazio) = layout classico de 2
      // molduras/bandas, IGUAL a porta externa modelo 23 (4 horizontais + 4
      // verticais por face). Antes o codigo so olhava quantidadeMolduras, que
      // vinha vazia -> caia em 1 banda (2+2) -> qtd errada. So 'Divisoes Iguais'
      // / 'Personalizado' usam a quantidade de molduras escolhida no form.
      const tipoMold = String(item.tipoMoldura || '').trim();
      const ehPadrao = (tipoMold === 'Padrao' || tipoMold === '');
      const qtdBois = ehPadrao ? 2 : Math.max(1, parseInt(item.quantidadeMolduras, 10) || 1);
      // Felipe sessao atual: config "Divisoes Iguais" — N molduras de ALTURA
      // igual. Altura util da face = tampaA - (N+1)*C29 (2 bordas + (N-1) vaos
      // internos, todos = C29), dividida por N. So' muda a VERTICAL (qtd 2N e
      // medida igual); horizontal mantem comprimento (tampaL-2*C29), muda qtd.
      const ehDivIguais = (tipoMold === 'Divisoes Iguais');
      const nDiv = Math.max(1, parseInt(item.numDivisoesIguais, 10) || 0);

      const gerarBoiserieFace = (tampaL, tampaA, faceLabel) => {
        if (tampaL <= 0 || tampaA <= 0) return;
        const horiz = tampaL - 2 * C29;
        if (ehDivIguais) {
          if (nDiv < 1) return; // sem N escolhido ainda, nao gera boiserie
          const vertIgual = (tampaA - (nDiv + 1) * C29) / nDiv;
          if (horiz     > 0) _add(cortes, COD_BOIS, horiz,     2 * nDiv * qtdPortas, `Boiserie Horizontal (${faceLabel})`, 'folha');
          if (vertIgual > 0) _add(cortes, COD_BOIS, vertIgual, 2 * nDiv * qtdPortas, `Boiserie Vertical (${faceLabel})`, 'folha');
          return;
        }
        if (qtdBois >= 2) {
          // 2 bandas — igual modelo 23 externa (VERT_1 topo / VERT_2 resto)
          const VERT_1 = 1048 - (C29 / 2) - C29;
          const VERT_2 = tampaA - 3 * C29 - VERT_1;
          if (horiz  > 0) _add(cortes, COD_BOIS, horiz,  4 * qtdPortas, `Boiserie Horizontal (${faceLabel})`, 'folha');
          if (VERT_1 > 0) _add(cortes, COD_BOIS, VERT_1, 2 * qtdPortas, `Boiserie Vertical 1 (${faceLabel})`, 'folha');
          if (VERT_2 > 0) _add(cortes, COD_BOIS, VERT_2, 2 * qtdPortas, `Boiserie Vertical 2 (${faceLabel})`, 'folha');
        } else {
          // 1 banda — 1 quadro unico
          const vert = tampaA - 2 * C29;
          if (horiz > 0) _add(cortes, COD_BOIS, horiz, 2 * qtdPortas, `Boiserie Horizontal (${faceLabel})`, 'folha');
          if (vert  > 0) _add(cortes, COD_BOIS, vert,  2 * qtdPortas, `Boiserie Vertical (${faceLabel})`, 'folha');
        }
      };

      // Face EXTERNA da porta interna (tampa -77 / -50,5)
      gerarBoiserieFace(larguraVao - descontoLarg - 38.5 - 38.5, alturaVao - fgSup - 38.5 - 12, 'face externa');
      // Face INTERNA da porta interna (tampa -53 / -38,5)
      gerarBoiserieFace(larguraVao - descontoLarg - 26.5 - 26.5, alturaVao - fgSup - 26.5 - 12, 'face interna');
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
