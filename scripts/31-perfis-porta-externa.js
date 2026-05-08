/* 31-perfis-porta-externa.js — Regras de calculo de perfis da PORTA EXTERNA.

   ESTE MODULO E' EXCLUSIVO DA PORTA EXTERNA. Nao e' usado pra porta
   interna, fixo acoplado, nem revestimento de parede. Cada um daqueles
   tem seu proprio modulo (32-, 33-, 34-).

   Origem das regras: REGRAS_PERFIS.xlsx + correcoes do Felipe.

   Variaveis fixas por familia:
     - 76×38  (PA006) — usada quando altura < 4000mm
     - 101×51 (PA007) — usada quando altura ≥ 4000mm

   Modelos especiais:
     - Cava → detectado lendo `item.modeloNome` (qualquer modelo cuja
       descricao contem "cava") em vez de lista fixa de numeros. Isso faz
       com que novos modelos cadastrados sejam pegos automaticamente.
     - Friso horizontal (apenas modelo 6)
     - Boiserie (modelo 23) — preco fixo R$150/barra
     - Ripado (8, 15, 20, 21)

     Nota: modelos 22 (Cava Premium) e 24 (Cava Horizontal) tem logica
     especifica de travessas/frisos a ser fornecida pelo Felipe — quando
     vier, serao tratados em bloco proprio sem afetar 1-9.

   Saida: gerarCortes(item) → { 'PA-XXX': [{ comp, qty, label }, ...] }
   Cada corte tem `label` descritiva (ALTURA FOLHA, TRAVESSA VERTICAL, etc)
   pra identificacao na aba Lev. Perfis.
*/

const PerfisPortaExterna = (() => {
  // ---------------------------------------------------------
  // Modelos especiais — exclusivos da porta externa
  // ---------------------------------------------------------
  // MODELOS_CAVA: mantido apenas pra retrocompatibilidade com codigo
  // legado/exposicao publica. A deteccao de cava agora usa o helper
  // `temCava(modeloNome)` que le a descricao do modelo cadastrado.
  const MODELOS_CAVA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 22, 24];
  const MODELOS_RIPADO = [8, 15, 20, 21];
  const MODELO_BOISERIE = 23;
  const MODELO_FRISO_HORIZONTAL = 6;

  // Felipe (sessao 2026-09): modelos que tem FRISO VERTICAL.
  // Lista derivada do CAMPOS_POR_MODELO em 12-orcamento.js linha ~1684:
  //   modelos com 'distanciaBordaFrisoVertical' no schema.
  // Modelo 6 NAO entra (e' friso horizontal — tratado pelo bloco ehFriso6).
  // Quando o modelo tem friso vertical, adiciona tubo de reforco
  // (PA-76X76X2.0 ou PA-101X101X2.5 conforme familia) por dentro do friso.
  // Comprimento = TRAV_VERT (altura util entre batentes).
  // Quantidade = qtdFrisos × nFolhas (Felipe sessao 2026-09).
  const MODELOS_COM_FRISO_VERTICAL = new Set([2, 4, 5, 7, 11, 13, 14, 22]);

  /**
   * Detecta se o modelo tem cava lendo a descricao cadastrada (case-insensitive).
   * Felipe: "leia modelo que tem cava contido na descricao para aplicar regra"
   * Fallback: se nome nao for fornecido, cai pra lista fixa MODELOS_CAVA.
   */
  function temCava(modeloNome, modeloNumero) {
    const nome = String(modeloNome || '').toLowerCase();
    if (nome.includes('cava')) return true;
    // fallback: usa lista fixa quando nome nao chegou (compatibilidade)
    if (!nome && modeloNumero) return MODELOS_CAVA.includes(Number(modeloNumero));
    return false;
  }

  /**
   * Felipe (sessao 2026-05): detecta se o modelo e' CAVA DUPLA (modelo 9).
   * Cava dupla obriga 4 travessas por folha em vez de 2.
   */
  function temCavaDupla(modeloNome, modeloNumero) {
    const nome = String(modeloNome || '').toLowerCase();
    // "cava dupla" no nome
    if (nome.includes('cava dupla') || nome.includes('cava-dupla')) return true;
    // Modelo 9 (canonico)
    if (Number(modeloNumero) === 9) return true;
    return false;
  }

  // ---------------------------------------------------------
  // Variaveis fixas por familia (REGRAS_PERFIS.xlsx)
  // Felipe (req: Regras e Logicas em Cadastros): variaveis sao
  // editaveis. Estes sao os valores DEFAULT (fallback). O motor le
  // o storage 'cadastros':'regras_variaveis_porta_externa' com prioridade.
  // ---------------------------------------------------------
  const VARS_FAM_DEFAULT = {
    '76':  { ESPPIV:28, TRANSPIV:8, FGLD:10, FGLE:10, FGA:10, TUBLPORTAL:38.1,  TUBLPORTA:76.2,  VEDPT:35 },
    '101': { ESPPIV:28, TRANSPIV:8, FGLD:10, FGLE:10, FGA:10, TUBLPORTAL:50.8,  TUBLPORTA:101.6, VEDPT:35 },
  };

  // Le variaveis editaveis do storage. Se chave nao existe, usa DEFAULT.
  // Cada chamada le do storage pra refletir mudancas em tempo real (Felipe
  // pode editar em Cadastros e proximo orcamento ja' usa novo valor).
  function getVarsFam() {
    try {
      if (window.Storage && Storage.scope) {
        const salvas = Storage.scope('cadastros').get('regras_variaveis_porta_externa');
        if (salvas && typeof salvas === 'object' && salvas['76'] && salvas['101']) {
          // Mescla com DEFAULT pra garantir que toda chave exista
          return {
            '76':  Object.assign({}, VARS_FAM_DEFAULT['76'],  salvas['76']),
            '101': Object.assign({}, VARS_FAM_DEFAULT['101'], salvas['101']),
          };
        }
      }
    } catch (e) {
      console.warn('[PerfisPortaExterna] falhou ler regras_variaveis_porta_externa, usando DEFAULT:', e);
    }
    return VARS_FAM_DEFAULT;
  }

  // ---------------------------------------------------------
  // Codigos por familia
  // ---------------------------------------------------------
  // Felipe (sessao 2026-05): TODOS os codigos aqui agora batem com o
  // cadastro de Perfis (Cadastros > Perfis). Substituicoes na familia 76:
  //   PA-76X76X2.5 → PA-76X76X2.0    (perfLargInt)
  //   PA-76X38X1.58 → PA-76X38X1.98  (travVert e travHor)
  //   PA-CANT-30X30X2.0 → PA-CANT-30X30X2.0  (Felipe sessao 2026-05: padronizado com hífen igual ao cadastro)
  //   PA-38X12X1.58 → PA-25X12X1.58  (travCava, perfil pequeno do cadastro)
  // ---------------------------------------------------------
  const COD_FAM = {
    '76': {
      perfAlt:    'PA-PA006F',           // PERFIL ALTURA — sufixo -6M/-7M/-8M
      altPortal:  'PA-PA006P',           // ALTURA PORTAL — sufixo -6M/-7M/-8M
      veda:       'PA-PA006V',           // VEDA PORTA
      perfLargInt:'PA-76X76X2.0',        // PERFIL LARGURA INTERNA / FRISO VERTICAL
      travVert:   'PA-76X38X1.98',       // TRAVESSA VERTICAL
      travHor:    'PA-76X38X1.98',       // TRAVESSA HORIZONTAL / FRISO HORIZONTAL / LARGURA PORTAL
      cava:       'PA-38X38X1.58',       // CAVA (tubo)
      cantCava:   'PA-CANT-30X30X2.0',   // CANTONEIRA DA CAVA
      travCava:   'PA-25X12X1.58',       // TRAVAMENTO DA CAVA
      canalEsc:   'PA-CHR908',           // TRILHO ESCOVA
      traPortal:  'PA-35X25-OLHAL',      // TRAVAMENTO DO PORTAL
    },
    '101': {
      perfAlt:    'PA-PA007F',
      altPortal:  'PA-PA007P',
      veda:       'PA-PA007V',
      perfLargInt:'PA-101X101X2.5',
      travVert:   'PA-101X51X2',
      travHor:    'PA-101X51X2',
      cava:       'PA-38X38X1.58',
      cantCava:   'PA-CANT-30X30X2.0',
      travCava:   'PA-51X12X1.58',
      canalEsc:   'PA-CHR908',
      traPortal:  'PA-35X25-OLHAL',
    },
  };

  // ---------------------------------------------------------
  // Quantidade de travessas horizontais (por altura)
  // ---------------------------------------------------------
  /** N_H = floor(altura / 1000). Multiplicar pelas folhas no caller. */
  function travessasHorizontais(altura) {
    const a = Number(altura) || 0;
    if (a <= 0) return 0;
    return Math.floor(a / 1000);
  }

  // ---------------------------------------------------------
  // Quantidade de travessas verticais (por largura + cava)
  //
  // Felipe (sessao 2026-05): regra correta:
  //   1. CAVA SIMPLES (modelos 1-8, 19, 22, 24, etc):
  //      → 2 travessas obrigatorias POR FOLHA
  //   2. CAVA DUPLA (modelo 9):
  //      → 4 travessas obrigatorias POR FOLHA
  //   3. Bonus por LARGURA TOTAL da porta:
  //      → L >  2500: +2 travessas adicionais (no total, nao por folha)
  //      → L >  1500: +1 travessa adicional   (no total, nao por folha)
  //      → L <= 1500: +0
  //   4. Multiplicar travessas obrigatorias POR FOLHA pelo n° de folhas.
  //      O bonus de largura NAO multiplica por folha (e' bonus pela
  //      largura total da porta).
  //
  //   Exemplos:
  //     - Cava simples, 1 folha, L=900:    2 × 1 + 0 = 2
  //     - Cava simples, 1 folha, L=1800:   2 × 1 + 1 = 3
  //     - Cava simples, 1 folha, L=2800:   2 × 1 + 2 = 4
  //     - Cava simples, 2 folhas, L=2200:  2 × 2 + 1 = 5
  //     - Cava dupla, 1 folha, L=900:      4 × 1 + 0 = 4
  //     - Cava dupla, 2 folhas, L=900:     4 × 2 + 0 = 8
  //     - Cava dupla, 2 folhas, L=2800:    4 × 2 + 2 = 10
  //
  //   Sem cava: por enquanto 0 (Felipe nao deu regra pra modelos
  //   sem cava; modelos com puxador/friso provavelmente nao usam
  //   travessa vertical da mesma forma — ajustar quando ele falar).
  // ---------------------------------------------------------
  function travessasVerticais(args) {
    const L          = Number(args.largura) || 0;
    const modelo     = Number(args.modeloNumero) || 0;
    const modeloNome = String(args.modeloNome || '');
    const nFolhas    = Math.max(1, Number(args.nFolhas) || 1);

    const ehCava      = temCava(modeloNome, modelo);
    const ehCavaDupla = temCavaDupla(modeloNome, modelo);

    // Travessas obrigatorias POR FOLHA da cava
    let travCavaPorFolha = 0;
    if (ehCava) {
      travCavaPorFolha = ehCavaDupla ? 4 : 2;
    }
    const travCavaTotal = travCavaPorFolha * nFolhas;

    // Bonus por LARGURA TOTAL (nao multiplica por folha)
    let travLarguraBonus = 0;
    if (L > 2500)      travLarguraBonus = 2;
    else if (L > 1500) travLarguraBonus = 1;

    const qtyTotal = travCavaTotal + travLarguraBonus;
    // qtyPerFolha mantido p/ compat — nao tem mais sentido literal
    const qtyPerFolha = travCavaPorFolha;

    return {
      travBase:           travLarguraBonus,    // bonus pela largura
      cavaTravAdd:        travCavaPorFolha,    // por folha
      qtyPerFolha,
      qtyTotal,
      // Felipe (sessao 2026-05): campos extras pra debug/explicacao
      ehCavaDupla,
      travCavaTotal,
      travLarguraBonus,
    };
  }

  // ---------------------------------------------------------
  // Boiserie (modelo 23) — placeholder, regra detalhada pendente
  // ---------------------------------------------------------
  function boiserieCusto(nBars) {
    const PRECO = (window.PerfisCore && window.PerfisCore.PRECO_BOISERIE_BARRA) || 150;
    return {
      nBars: Number(nBars) || 0,
      custoPerfil: (Number(nBars) || 0) * PRECO,
      custoPintura: 0,
    };
  }

  // ---------------------------------------------------------
  // GERA TODOS OS CORTES de uma porta_externa
  // ---------------------------------------------------------
  /**
   * Aplica as formulas da REGRAS_PERFIS.xlsx + qtds derivadas de
   * largura / altura / modelo / nFolhas pra produzir cada corte.
   * Cada corte traz uma `label` legivel (ALTURA FOLHA, TRAVESSA VERTICAL, etc)
   * que vai aparecer na tabela do Lev. Perfis.
   *
   * @param {object} item — porta_externa
   *   altura, largura, nFolhas, modeloNumero, revestimento, quantidade
   * @returns {object} cortesPorCodigo — { 'PA-XXX': [{ comp, qty, label }] }
   */
  function gerarCortes(item) {
    const A          = parseFloat(String(item.altura  || '').replace(',', '.')) || 0;
    const L          = parseFloat(String(item.largura || '').replace(',', '.')) || 0;
    const nFolhas    = Math.max(1, parseInt(item.nFolhas, 10) || 1);
    const qtdPorta   = Math.max(1, parseInt(item.quantidade, 10) || 1);
    const modelo     = parseInt(String(item.modeloNumero || '').replace(/\D/g, ''), 10) || 0;
    const modeloNome = String(item.modeloNome || '');
    const ehCava     = temCava(modeloNome, modelo);
    const ehCavaDupla = temCavaDupla(modeloNome, modelo);
    const ehFriso6   = (modelo === MODELO_FRISO_HORIZONTAL);

    // Log de diagnostico (Felipe pode ver no DevTools que esta detectando certo)
    if (window.console && modeloNome) {
      console.debug(`[PerfisPortaExterna] modelo "${modeloNome}" (n=${modelo}) → cava=${ehCava}`);
    }

    const cortes = {};
    if (A <= 0 || L <= 0) return cortes;

    const fam = (A < 4000) ? '76' : '101';
    const VARS_FAM_ATIVAS = getVarsFam();
    const v   = VARS_FAM_ATIVAS[fam];
    const cod = COD_FAM[fam];
    const ESPACM = (window.PerfisCore || {}).espessuraRevestimento
      ? window.PerfisCore.espessuraRevestimento(item.revestimento)
      : 4;

    const sufixoBarra = (window.PerfisCore || {}).sufixoBarraPorComp
      || (c => c > 7000 ? '-8M' : c > 6000 ? '-7M' : '-6M');

    // --------- Formulas dos cortes (REGRAS_PERFIS.xlsx) ---------
    const PA_F      = A - v.FGA - v.TUBLPORTAL - v.ESPPIV + v.TRANSPIV;

    // LARG_INT — Felipe:
    //   1 folha:  L - FGLD - FGLE - 171,7 - 171,5
    //   2 folhas: (L - FGLD - FGLE - 171,7 - 171,5 - 235) / 2
    //
    // Aplica em: Largura Inferior & Superior (perfLargInt), Veda Porta,
    // Canal Escova (CHR908) E Travessa/Friso Horizontal (Felipe: pra 2
    // folhas a Travessa Horizontal usa a MESMA formula da Largura Inferior
    // & Superior, nao a de 1 folha como antes). Pra 1 folha as duas
    // formulas coincidem.
    const LARG_INT_FOLHA = (nFolhas === 2)
      ? (L - v.FGLD - v.FGLE - 171.7 - 171.5 - 235) / 2
      :  L - v.FGLD - v.FGLE - 171.7 - 171.5;
    const LARG_INT_TRAV  = LARG_INT_FOLHA;

    const TRAV_VERT = A - v.FGA - v.TUBLPORTAL - v.ESPPIV - v.VEDPT * 2 - v.TUBLPORTA * 2;
    const VEDA      = LARG_INT_FOLHA + 110 + 110;
    const CANAL     = LARG_INT_FOLHA + 110 + 110 + 10;
    const CAVA_COMP = TRAV_VERT - 30;
    const ALT_PORTAL= A - v.FGA - v.TUBLPORTAL - ESPACM;
    const LAR_PORTAL= L - v.FGLD - v.FGLE;
    const TRA_PORTAL_COMP = LAR_PORTAL - 93;

    // --------- Quantidades ---------
    const qtdTH = travessasHorizontais(A);
    const tv    = travessasVerticais({ largura: L, modeloNumero: modelo, modeloNome, nFolhas, distBordaFriso: 0 });
    // Felipe sessao 12: 'PORTA DUAS FOLHAS A QUANTIDADE DE TRAVESSA
    // VERTICAL TAMBEM MULTIPLICA POR 2'. travessasVerticais() ja
    // multiplica a parte das travessas obrigatorias da Cava (4 por
    // folha) por nFolhas, mas o BONUS por largura (>2500=+2, >1500=+1)
    // NAO era multiplicado. Felipe quer multiplicar tudo: bonus inclusive.
    // Solucao: usa qtyTotal mas REMULTIPLICA o bonus pela diferenca
    // pra refletir nFolhas tambem nele.
    const qtdTV = tv.qtyTotal + tv.travLarguraBonus * (nFolhas - 1);
    const qtdTraPortal = Math.max(2, Math.floor(A / 2000) + 1);

    function add(codigo, comp, qty, label) {
      if (qty <= 0 || comp <= 0) return;
      if (!cortes[codigo]) cortes[codigo] = [];
      cortes[codigo].push({
        // Felipe: arredonda corte pra mm inteiro. Operacao manual nao tem
        // precisao decimal, e 4919.2 vs 4919 nao faz diferenca pratica.
        // Aplica APENAS no comprimento de corte. kg/m, peso, R$/kg etc
        // mantem suas casas decimais.
        comp: Math.round(comp),
        qty: qty * qtdPorta,
        label,
      });
    }

    add(cod.perfAlt + sufixoBarra(PA_F),         PA_F,            2 * nFolhas,    'Altura Folha');
    add(cod.altPortal + sufixoBarra(ALT_PORTAL), ALT_PORTAL,      2,              'Altura Portal');
    add(cod.traPortal,                            TRA_PORTAL_COMP, qtdTraPortal,   'Travessa Portal');
    add(cod.travHor,                              LAR_PORTAL,      1,              'Largura Portal');
    add(cod.veda,                                 VEDA,            2 * nFolhas,    'Veda Porta Inferior & Superior');
    add(cod.perfLargInt,                          LARG_INT_FOLHA,  2 * nFolhas,    'Largura Inferior & Superior');
    add(cod.canalEsc,                             CANAL,           2 * nFolhas,    'Canal Escova');
    add(cod.travVert,                             TRAV_VERT,       qtdTV,          'Travessa Vertical');
    // Felipe sessao 12: modelo 6 (friso horizontal) NAO duplica - o
    // 'Friso Horizontal' SUBSTITUI a 'Travessa Horizontal'. Antes
    // adicionavam os 2 (mesmo PA-76X38X1.98, mesmo comprimento, mesmo
    // qtd) - duplicacao. Felipe: 'o friso na horizontal substitui a
    // travessa vertcal' (errou: queria dizer travessa horizontal,
    // pq sao ambas horizontais e mesmas dimensoes).
    if (!ehFriso6) {
      add(cod.travHor,                            LARG_INT_TRAV,   qtdTH * nFolhas,'Travessa Horizontal');
    }

    if (ehCava) {
      // Felipe (sessao 30 — fix v2): "1F com cava: 2 unidades, 2F com
      // cava: 4 unidades, modelo 09 cava dupla: 4 fixo".
      // Regra: 2 × nFolhas (default), exceto cava dupla que e' 4 fixo.
      // Felipe corrigiu meu erro v1 anterior (eu tinha tirado o nFolhas).
      const qtdTuboCava = ehCavaDupla ? 4 : 2 * nFolhas;
      add(cod.cava,     CAVA_COMP, qtdTuboCava,        'Tubo Cava');
      add(cod.cantCava, TRAV_VERT, 4 * nFolhas,        'Cantoneira Cava');
      add(cod.travCava, 250,       qtdTH * nFolhas,    'Travamento Cava');
    }
    if (ehFriso6) {
      // Felipe sessao 12: modelo 6 = SO friso horizontal. Sem friso
      // vertical (era erro). Travessa Vertical (acima) mantem padrao.
      add(cod.travHor,     LARG_INT_TRAV, qtdTH * nFolhas, 'Friso Horizontal');
    }

    // Felipe (sessao 2026-09): tubo de reforco do FRISO VERTICAL.
    // Adicionado quando o modelo tem friso vertical (lista
    // MODELOS_COM_FRISO_VERTICAL — modelo 6 nao entra, ja' coberto
    // por ehFriso6 acima — sao mutuamente exclusivos). Por isso uso
    // o mesmo label 'Friso Vertical' (bate com ORDEM_FOLHA).
    // PA-76X76X2.0 (familia 76) ou PA-101X101X2.5 (familia 101) —
    // mesmo perfil ja' usado em 'Largura Inferior & Superior'.
    //   Comprimento: TRAV_VERT (altura util entre batentes)
    //   Quantidade : qtdFrisos × nFolhas (1 folha: qtdFrisos;
    //                2 folhas: qtdFrisos × 2)
    const qtdFrisos = Math.max(0, parseInt(item.quantidadeFrisos, 10) || 0);
    if (MODELOS_COM_FRISO_VERTICAL.has(modelo) && qtdFrisos > 0) {
      add(cod.perfLargInt, TRAV_VERT, qtdFrisos * nFolhas, 'Friso Vertical');
    }

    // Felipe (sessao 2026-05): tubo das ripas para modelos 08 e 15.
    // Perfil: PA-51X12X1.58, comprimento fixo de 500mm cada pedaco.
    // Quantidade: floor(altura/1000) pedacos por ripa × qtdRipas total.
    // Exemplo: porta 3000mm com 22 ripas → 3 × 22 = 66 pedacos de 500mm.
    if (modelo === 8 || modelo === 15) {
      const espacRipas = parseFloat(String(item.espacRipas || 30).replace(',', '.')) || 30;
      const tipoRipado = item.tipoRipado || 'total';
      // Mesma formula do motor de chapas (calcularQtdRipas)
      const denom = 60 + espacRipas;
      const numerador = (tipoRipado === 'parcial')
        ? (L - v.FGLD - v.tamCava - v.FGLE)
        : L;
      const qtdRipas = denom > 0 ? Math.ceil(numerador / denom) : 0;
      // Pedacos de tubo por ripa = floor(altura / 1000)
      const pedacosPorRipa = Math.max(1, Math.floor(A / 1000));
      const qtdTuboRipa = qtdRipas * pedacosPorRipa * nFolhas;
      if (qtdTuboRipa > 0) {
        add('PA-51X12X1.58', 500, qtdTuboRipa, 'Tubo Interno das Ripas');
      }
    }

    // ====================================================================
    // Felipe sessao 12 - MODELO 23 + ALUMINIO MACICO -> PERFIS BOISERIE
    //
    // Quando o modelo for 23 e o revestimento for "Aluminio Macico 2mm",
    // as MOLDURAS deixam de ser pecas de chapa e viram PERFIL BOISERIE
    // (PA-PERFILBOISERIE) — 1:1, mesmo comprimento, mesma quantidade.
    //
    // Formulas extraidas LITERALMENTE da planilha "MODELO 23 - ALUMINIO
    // MACICO" (aba aliminio macico, secao Boiserie):
    //
    // 1F (3 tipos):
    //   MOLDURA HORIZONTAL 1: largura = J9-C29*2, qtd 8
    //     onde J9 = TAMPA_MAIOR_CAVA antes de +2REF
    //          = larguraQuadro1F - dBC - tamCava - 1
    //            - dBFV*qtdFrisos - eF*qtdFrisos
    //   MOLDURA VERTICAL 1: largura = 1048 - C29/2 - C29, qtd 4
    //     (1048 e' constante de desenho do modelo 23)
    //   MOLDURA VERTICAL 2: largura = E4 - 3*C29 - G27, qtd 4
    //     (E4 = alturaQuadro; G27 = MOLDURA VERTICAL 1)
    //
    // 2F (5 tipos):
    //   MOLDURA HORIZONTAL 1: largura = Q9-C29*2,  qtd 4
    //   MOLDURA HORIZONTAL 2: largura = Q10-C29*2, qtd 8
    //   MOLDURA HORIZONTAL 3: largura = Q11-C29*2, qtd 4
    //   MOLDURA VERTICAL 1:   largura = 1048-C29/2-C29, qtd 8
    //   MOLDURA VERTICAL 2:   largura = E4-3*C29-MOLDURA VERTICAL 1, qtd 8
    //   onde Q9, Q10, Q11 = Tampa Maior 01/02/03 antes de +2*REF.
    //
    // C29 = distanciaBorda1aMoldura (default 150mm).
    //
    // O motor de chapas (38-chapas-porta-externa.js) NAO gera as molduras
    // como pecas de chapa quando ehAluminioMacico=true — entao nao tem
    // duplicacao. Aqui a regra fecha o ciclo.
    // ====================================================================
    const ehMod23AM = (modelo === 23)
      && /aluminio.*macico/i.test(String(item.revestimento || ''))
      && /2\s*mm/i.test(String(item.revestimento || ''));
    if (ehMod23AM) {
      const COD_BOIS = (window.PerfisCore && window.PerfisCore.COD_BOISERIE) || 'PA-PERFILBOISERIE';

      // Felipe sessao 12: usa calcularQuadro do motor de chapas pra
      // garantir consistencia (mesma fonte de verdade) - evita duplicar
      // VARS_CHAPAS aqui. ChapasPortaExterna.calcularQuadro retorna
      // { alturaQuadro, larguraQuadro1F, larguraQuadro2F, ... }
      let larguraQuadro1F = 0, larguraQuadro2F = 0, alturaQuadro = 0;
      if (window.ChapasPortaExterna && window.ChapasPortaExterna.calcularQuadro) {
        const q = window.ChapasPortaExterna.calcularQuadro(item);
        if (q) {
          larguraQuadro1F = q.larguraQuadro1F;
          larguraQuadro2F = q.larguraQuadro2F;
          alturaQuadro    = q.alturaQuadro;
        }
      }
      // Fallback se motor de chapas nao carregado: replica formulas
      // (com VARS_CHAPAS hardcoded da planilha Felipe).
      if (!larguraQuadro1F) {
        // VARS_CHAPAS atuais (38-chapas-porta-externa.js linhas 32-36):
        const PORTAL_LD = 171.5, PORTAL_LE = 171.5;
        const U_LARG_1F = 90, U_LARG_2F = 128, U_LARG_CENTRAL = 128;
        const FGLD_FGLE_loc = v.FGLD + v.FGLE;
        larguraQuadro1F = L - FGLD_FGLE_loc - PORTAL_LD - PORTAL_LE + U_LARG_1F + U_LARG_CENTRAL;
        larguraQuadro2F = L - 20            - PORTAL_LD - PORTAL_LE + U_LARG_2F + U_LARG_CENTRAL;
        alturaQuadro    = A - v.FGA - v.TUBLPORTAL - v.ESPPIV + v.TRANSPIV;
      }

      const dBC     = parseFloat(String(item.distanciaBordaCava || 0).replace(',', '.')) || 0;
      const tamCava = parseFloat(String(item.tamanhoCava || 0).replace(',', '.')) || 0;
      const dBFV    = parseFloat(String(item.distanciaBordaFrisoVertical || 0).replace(',', '.')) || 0;
      const eF      = parseFloat(String(item.espessuraFriso || 0).replace(',', '.')) || 0;
      const qtdFrisos = Math.max(0, parseInt(item.quantidadeFrisos, 10) || 0);
      const C29 = parseFloat(String(item.distanciaBorda1aMoldura || 150).replace(',', '.')) || 150;

      // J9 = TAMPA_MAIOR_CAVA largura ANTES de +2*REF
      const J9 = larguraQuadro1F - dBC - tamCava - 1 - dBFV*qtdFrisos - eF*qtdFrisos;
      // Q9, Q10, Q11 = TAMPA_MAIOR 01/02/03 largura ANTES de +2*REF
      const tm_base_2f       = (larguraQuadro2F - dBC*2 - tamCava*2) / 2;
      const tm_base_2f_menos1= (larguraQuadro2F - 1 - dBC*2 - tamCava*2) / 2;
      const Q9  = tm_base_2f       + 10.5 - 1 - dBFV*qtdFrisos - eF*qtdFrisos;
      const Q10 = tm_base_2f_menos1     - 28      - dBFV*qtdFrisos - eF*qtdFrisos;
      const Q11 = tm_base_2f_menos1     - 28 - 38 - dBFV*qtdFrisos - eF*qtdFrisos;

      // IF qtdFrisos>0 -> J9 ; senao -> J9-C29*2
      const horiz1F = (qtdFrisos > 0) ? J9 : (J9 - 2*C29);
      // VERTICAL 1: 1048 - C29/2 - C29 (constante 1048 do desenho)
      const VERT_1 = 1048 - (C29/2) - C29;
      // VERTICAL 2: alturaQuadro - 3*C29 - VERT_1
      const VERT_2 = alturaQuadro - 3*C29 - VERT_1;

      if (nFolhas === 1) {
        if (horiz1F > 0)  add(COD_BOIS, horiz1F, 8, 'Moldura Horizontal 1');
        if (VERT_1 > 0)   add(COD_BOIS, VERT_1,  4, 'Moldura Vertical 1');
        if (VERT_2 > 0)   add(COD_BOIS, VERT_2,  4, 'Moldura Vertical 2');
      } else if (nFolhas === 2) {
        const horiz1_2F = (qtdFrisos > 0) ? Q9  : (Q9  - 2*C29);
        const horiz2_2F = (qtdFrisos > 0) ? Q10 : (Q10 - 2*C29);
        const horiz3_2F = (qtdFrisos > 0) ? Q11 : (Q11 - 2*C29);
        if (horiz1_2F > 0) add(COD_BOIS, horiz1_2F, 4, 'Moldura Horizontal 1');
        if (horiz2_2F > 0) add(COD_BOIS, horiz2_2F, 8, 'Moldura Horizontal 2');
        if (horiz3_2F > 0) add(COD_BOIS, horiz3_2F, 4, 'Moldura Horizontal 3');
        if (VERT_1 > 0)    add(COD_BOIS, VERT_1,    8, 'Moldura Vertical 1');
        if (VERT_2 > 0)    add(COD_BOIS, VERT_2,    8, 'Moldura Vertical 2');
      }
    }

    return cortes;
  }

  /**
   * Identificacao curta do item pra mostrar no Lev. Perfis.
   * Ex: "Porta Externa Pivotante 1100×2100, 1 folha, modelo 02".
   */
  function descricaoItem(item) {
    const partes = ['Porta Externa'];
    if (item.sistema) partes.push(item.sistema.charAt(0).toUpperCase() + item.sistema.slice(1));
    const dim = `${item.largura || '?'}×${item.altura || '?'}mm`;
    partes.push(dim);
    if (item.nFolhas) partes.push(`${item.nFolhas} folha${item.nFolhas > 1 ? 's' : ''}`);
    if (item.modeloNumero) partes.push(`modelo ${item.modeloNumero}`);
    // Felipe (sessao 2026-06): mostra quantidade de portas no header
    // quando > 1, pra ficar visivel que esse item tem multiplas portas
    // (e que as quantidades das pecas ja' refletem a multiplicacao).
    const qtd = Math.max(1, parseInt(item.quantidade, 10) || 1);
    if (qtd > 1) partes.push(`${qtd} portas`);
    return partes.join(', ');
  }

  return {
    MODELOS_CAVA, MODELOS_RIPADO,
    MODELO_BOISERIE, MODELO_FRISO_HORIZONTAL,
    // VARS_FAM mantido como alias pra compatibilidade com codigo legado.
    // Novo nome: VARS_FAM_DEFAULT. Use _getVarsFam() pra valores ATIVOS
    // (com edicoes de Felipe em Cadastros > Regras e Logicas).
    VARS_FAM: VARS_FAM_DEFAULT,
    COD_FAM,

    temCava,
    temCavaDupla,
    travessasHorizontais,
    travessasVerticais,
    boiserieCusto,
    gerarCortes,
    descricaoItem,
    // Felipe (Regras e Logicas): exposto pra o modulo Regras montar a UI
    // editavel das variaveis. DEFAULT serve de fallback se Felipe limpar.
    _VARS_FAM_DEFAULT: VARS_FAM_DEFAULT,
    _getVarsFam: getVarsFam,
  };
})();
window.PerfisPortaExterna = PerfisPortaExterna;
