/* 28-acessorios-porta-externa.js — Calcula quantidades de ACESSORIOS
   pra cada item do tipo porta_externa, baseado nas regras que o Felipe
   passou (sessao 2026-08).

   ENTRADA: item (porta_externa) + lista de acessorios cadastrados +
            opts ({ marcaCilindro: 'KESO' | 'UDINESE' })

   SAIDA:   array de linhas { codigo, descricao, qtd, unidade, preco_un,
                              total, categoria, aplicacao, observacao }

   APLICACAO:
     - 'fab'  → Fabricacao (sai da fabrica com a porta)
     - 'obra' → Obra (instalado em obra)

   FELIPE — REGRAS UNIVERSAIS:
     R10: codigo em portugues sem acento
     R20: capitalizacao Title Case na exibicao (descricao)
     R01: numeros com 2 casas decimais
     R12+R18: tabela com filtro/sort universal
*/

const AcessoriosPortaExterna = (() => {

  // Modelos com cava (sem puxador externo)
  const MODELOS_CAVA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 22, 24];
  // Modelos ripado (afeta tipo de EPS canaleta)
  const MODELOS_RIPADO = [8, 15, 20, 21];

  function isCava(n)   { return MODELOS_CAVA.includes(Number(n)); }
  function isRipado(n) { return MODELOS_RIPADO.includes(Number(n)); }

  /**
   * Mapa puxTam → codigo.
   * 1.0 / 1.5 / 2.0 → tamanho exato
   * 2.5 / 3.0 → 3MT
   * 3.5 / 4.0 → 4MT
   * 4.5 / 5.0 → 5MT
   */
  function codigoPuxador(puxTam) {
    const t = parseFloat(String(puxTam).replace(',', '.'));
    if (!t || isNaN(t)) return null;
    if (t === 1.0) return 'PA-PUX-1MT';
    if (t === 1.5) return 'PA-PUX-1,5MT';
    if (t === 2.0) return 'PA-PUX-2MT';
    if (t <= 3.0)  return 'PA-PUX-3MT';
    if (t <= 4.0)  return 'PA-PUX-4MT';
    if (t <= 5.0)  return 'PA-PUX-5MT';
    return null;
  }

  /**
   * Detecta numero de pinos da fechadura mecanica.
   * Fechadura vem como "04 PINOS", "08 PINOS", "12 PINOS", "16 PINOS",
   * "24 PINOS" (com espaco). Retorna 4, 8, 12, 16, 24 ou 0 se nao tem.
   */
  function detectarPinos(fechaduraMecanica) {
    const s = String(fechaduraMecanica || '').toUpperCase();
    if (!s) return 0;
    const m = s.match(/(\d+)\s*PINOS?/);
    return m ? parseInt(m[1], 10) : 0;
  }

  /**
   * Detecta marca da fechadura digital. Felipe (sessao 2026-08):
   * TEDEE / EMTECO / PHILIPS / NUKI / vazio.
   */
  function detectarMarcaDigital(fechaduraDigital) {
    const s = String(fechaduraDigital || '').toUpperCase();
    if (!s) return '';
    if (/TEDEE/.test(s))   return 'TEDEE';
    if (/EMTECO|BARCELONA/.test(s)) return 'EMTECO';
    if (/PHILIPS|9300/.test(s))    return 'PHILIPS';
    if (/NUKI/.test(s))    return 'NUKI';
    return '';
  }

  /**
   * Busca acessorio no cadastro pelo codigo exato. Retorna `null` se
   * nao encontrado (item da regra que ainda nao foi cadastrado).
   */
  function buscarAcessorio(cadastro, codigo) {
    if (!Array.isArray(cadastro) || !codigo) return null;
    return cadastro.find(a => a.codigo === codigo) || null;
  }

  /**
   * Busca a variante MAIS CARA por prefixo. Usado pra fechaduras KESO
   * (Felipe: "sempre escolhe a variante com MAIOR preco"). Ex: prefixo
   * 'PA-KESO04P' bate com PA-KESO04P RL BL, PA-KESO04P RT CR, etc.
   */
  function maxPrecoByPrefix(cadastro, prefixo) {
    if (!Array.isArray(cadastro)) return null;
    const candidatos = cadastro.filter(a =>
      String(a.codigo || '').startsWith(prefixo)
    );
    if (!candidatos.length) return null;
    return candidatos.reduce((max, atu) =>
      (Number(atu.preco) || 0) > (Number(max.preco) || 0) ? atu : max
    , candidatos[0]);
  }

  /**
   * Veda Porta — sequencia 820, 920, 1020, 1120, 1220, 1320, 1420...
   * Felipe (sessao 2026-08): "voce pega L − FGLD − FGLE − 171,7 − 171,5
   * +110+110, mas ele so vem em 820, 920... pega o proximo arredondado".
   *
   * Fórmula:
   *   1 folha:  LARG_INT = L - FGLD - FGLE - 171.7 - 171.5
   *   2 folhas: LARG_INT = (L - FGLD - FGLE - 171.7 - 171.5 - 235) / 2
   *   VEDA = LARG_INT + 110 + 110
   *
   * Pega proximo X20 (ex: 1680 → 1720). Sequencia: 820, 920, 1020...
   */
  function calcularVedaPorta(L, nFolhas, FGLD, FGLE) {
    const fglD = Number(FGLD) || 10;
    const fglE = Number(FGLE) || 10;
    let largInt;
    if (Number(nFolhas) === 2) {
      largInt = (L - fglD - fglE - 171.7 - 171.5 - 235) / 2;
    } else {
      largInt = L - fglD - fglE - 171.7 - 171.5;
    }
    const veda = largInt + 110 + 110;
    // Sequencia X20 (820, 920, 1020...): pega proximo MULTIPLO_DE_100 + 20
    // Ex: veda=1680 → ceil(1680/100)*100 = 1700, mas precisa terminar em 20
    // entao: se veda <= 820, retorna 820; senao ceil((veda - 20)/100)*100 + 20
    if (veda <= 820) return 820;
    const medida = Math.ceil((veda - 20) / 100) * 100 + 20;
    return medida;
  }

  /**
   * FUNCAO PRINCIPAL — recebe item porta_externa, retorna lista de
   * acessorios calculados.
   *
   * @param {object} item - item.tipo === 'porta_externa'
   * @param {Array}  cadastroAcessorios - lista de acessorios cadastrados
   * @param {object} opts - { marcaCilindro: 'KESO' (default) | 'UDINESE' }
   * @returns {Array} linhas com { codigo, descricao, qtd, unidade,
   *                                preco_un, total, categoria, aplicacao,
   *                                observacao }
   */
  function calcularAcessoriosPorItem(item, cadastroAcessorios, opts) {
    if (!item) return [];
    // Felipe sessao 2026-08: tambem aceita revestimento_parede e fixo_acoplado.
    // Pra esses tipos, so' fita+silicone e' calculado (resto - fechadura,
    // dobradica, cilindro, EPS - e' especifico de porta).
    const tipoOK = item.tipo === 'porta_externa'
                || item.tipo === 'revestimento_parede'
                || item.tipo === 'fixo_acoplado';
    if (!tipoOK) return [];
    opts = opts || {};
    const marcaCilindro = (opts.marcaCilindro || 'KESO').toUpperCase();

    // Felipe sessao 2026-08: revestimento_parede usa largura_total/altura_total
    // (nao tem item.largura/altura). Outros campos especificos de porta
    // (fechadura, sistema, modelo) sao zerados pra revestimento - so' fita+silicone
    // sera calculado.
    const L = Number(item.largura)       || Number(item.largura_total) || 0;
    const H = Number(item.altura)        || Number(item.altura_total)  || 0;
    const nFolhas = Math.max(1, Math.min(2, Number(item.nFolhas) || 1));
    const qtdPortas = Math.max(1, Number(item.quantidade) || 1);
    const sis = String(item.sistema || '').toUpperCase().trim() || 'PA006';
    const fechMec = item.fechaduraMecanica || '';
    const fechDig = item.fechaduraDigital || '';
    const puxTam = item.tamanhoPuxador || '';
    const modeloExt = Number(item.modeloExterno || item.modeloNumero || 0);
    // Cava: se externo OU interno tem cava, considera "tem cava"
    const modeloInt = Number(item.modeloInterno || 0);
    const temCava = isCava(modeloExt) || isCava(modeloInt);
    const ripado = isRipado(modeloExt) || isRipado(modeloInt);

    // FGLD/FGLE: vem das regras de perfis. Sao 10mm default.
    const FGLD = 10;
    const FGLE = 10;

    const pinos = detectarPinos(fechMec);
    const marcaDig = detectarMarcaDigital(fechDig);

    const linhas = [];

    // Helper: adiciona linha ao output. Multiplica qtd por qtdPortas
    // (Felipe: "calculo individual por item" — qtd ja e' por porta,
    // depois multiplicamos pela quantidade de portas iguais do item).
    function add(codigo, qtdUnit, categoria, aplicacao, observacao) {
      if (!codigo) return;
      const acess = buscarAcessorio(cadastroAcessorios, codigo);
      if (!acess) {
        // Acessorio da regra nao cadastrado — adiciona com aviso
        linhas.push({
          codigo,
          descricao: '(nao cadastrado)',
          familia: '',
          qtd: qtdUnit * qtdPortas,
          unidade: 'un',
          preco_un: 0,
          total: 0,
          categoria,
          aplicacao,
          observacao: (observacao || '') + ' · CADASTRAR EM ACESSORIOS',
        });
        return;
      }
      const qtdTotal = qtdUnit * qtdPortas;
      const precoUn = Number(acess.preco) || 0;
      linhas.push({
        codigo: acess.codigo,
        descricao: acess.descricao || '',
        familia: acess.familia || '',
        qtd: qtdTotal,
        unidade: 'un',
        preco_un: precoUn,
        total: precoUn * qtdTotal,
        categoria,
        aplicacao,
        observacao: observacao || '',
      });
    }

    // Helper: variante MAIS CARA por prefixo
    function addMaxPreco(prefixo, qtdUnit, categoria, aplicacao, observacao) {
      const acess = maxPrecoByPrefix(cadastroAcessorios, prefixo);
      if (acess) add(acess.codigo, qtdUnit, categoria, aplicacao, observacao);
      else add(prefixo + '*', qtdUnit, categoria, aplicacao, observacao);
    }

    // ============================================================
    // FABRICACAO (so' pra porta_externa - acessorios especificos de porta)
    // ============================================================
    if (item.tipo === 'porta_externa') {

    // 1. FECHADURA KESO (1 un, variante mais cara)
    if (pinos === 4)  addMaxPreco('PA-KESO04P', 1, 'Fechaduras', 'fab');
    if (pinos === 8)  addMaxPreco('PA-KESO08P', 1, 'Fechaduras', 'fab');
    if (pinos === 12) addMaxPreco('PA-KESO12',  1, 'Fechaduras', 'fab');
    if (pinos === 16) addMaxPreco('PA-KESO16',  1, 'Fechaduras', 'fab');
    if (pinos === 24) addMaxPreco('PA-KESO24P', 1, 'Fechaduras', 'fab');

    // 2. ROSETA — 2 unidades se tem fechadura
    if (pinos > 0) {
      addMaxPreco('PA-KESO ROS', 2, 'Fechaduras', 'fab', 'frente + verso');
    }

    // 3. CILINDRO
    if (pinos > 0) {
      const e130 = sis === 'PA006';
      if (marcaCilindro === 'UDINESE') {
        add(e130 ? 'PA-CIL UDINE 130 BL' : 'PA-CIL UDINE 150 BL', 1, 'Fechaduras', 'fab', 'Cilindro UDINESE');
      } else {
        add(e130 ? 'PA-KESOCIL130 BT BL' : 'PA-KESOCIL150 BT BL', 1, 'Fechaduras', 'fab', 'Cilindro KESO chave-botao');
      }
    }

    // 4. PUXADOR EXTERNO — pula se cava ou se puxTam vazio/CLIENTE
    if (!temCava && puxTam) {
      const puxStr = String(puxTam).toUpperCase().trim();
      const ehCliente = /CLIENTE|ENVIO/.test(puxStr);
      if (!ehCliente) {
        const codPux = codigoPuxador(puxTam);
        if (codPux) add(codPux, 1, 'Puxador', 'fab', `Puxador ${puxTam}m`);
      }
    }

    // 5. PIVO — sempre, 12 × nFolhas
    add('PA-CHA AA PHS 4,8X50', 12 * nFolhas, 'Parafusos', 'fab', 'pivo');
    add('PA-BUCHA 06',          12 * nFolhas, 'Parafusos', 'fab', 'pivo');

    // PIVO conjunto sup/inf — Felipe (sessao 2026-09): o pivo escolhido
    // depende do PESO DA FOLHA (perfis FOLHA + chapas FOLHA).
    //   peso ≤ 350 kg → PA-PIVOT 350 KG
    //   peso  > 350 kg → PA-PIVOT 600 KG
    //
    // Felipe (sessao 30): "PIVO NAO ESTA MOSTRANDO CALCULO ( DEVE FICAR
    // NA LINHA DELE SOMATORIA PESO LIQUIDO PERFIS, PESO LIQUIDO DAS
    // CHAPAS ) QUANDO SAO 2 FOLHAS OBVIO QUE SAO 2 PIVOS ESTA SENDO
    // SOMENTE 1".
    // Mudancas:
    //   1) Quantidade do pivo = nFolhas (1F=1 pivo, 2F=2 pivos)
    //   2) Observacao mostra a decomposicao: "perfis Xkg + chapas Ykg
    //      = Zkg" pra Felipe ver de onde veio o peso.
    //
    // Felipe (sessao 30, fix peso 2F): "quando for 2 folhas dividi
    // por 2 o peso". calcularPesoFolhaItem retorna o peso TOTAL do
    // item (motor de perfis + chapas geram cortes do item inteiro,
    // portanto soma as 2 folhas). Cada pivo segura UMA folha — entao
    // a decisao 350 vs 600 usa peso DE UMA FOLHA = total / nFolhas.
    const pesoTotalItem    = Number(opts.pesoFolhaTotal)  || 0;
    const pesoPerfisTotal  = Number(opts.pesoFolhaPerfis) || 0;
    const pesoChapasTotal  = Number(opts.pesoFolhaChapas) || 0;
    // Peso por folha: divide pelo numero de folhas
    const pesoFolha    = nFolhas > 0 ? pesoTotalItem   / nFolhas : pesoTotalItem;
    const pesoPerfis   = nFolhas > 0 ? pesoPerfisTotal / nFolhas : pesoPerfisTotal;
    const pesoChapas   = nFolhas > 0 ? pesoChapasTotal / nFolhas : pesoChapasTotal;
    // Decomposicao na observacao (so' se temos os componentes)
    const decomp = (pesoPerfis > 0 || pesoChapas > 0)
      ? `perfis ${pesoPerfis.toFixed(1)}kg + chapas ${pesoChapas.toFixed(1)}kg = ${pesoFolha.toFixed(1)}kg/folha`
      : `folha ${pesoFolha.toFixed(1)}kg`;
    // Sufixo de qtd quando 2F
    const qtdSuf = nFolhas === 2 ? ` × ${nFolhas} folhas` : '';

    if (pesoFolha > 350) {
      add('PA-PIVOT 600 KG', nFolhas, 'Pivo', 'fab',
          `conjunto sup/inf 600kg (${decomp} > 350kg${qtdSuf})`);
    } else if (pesoFolha > 0) {
      add('PA-PIVOT 350 KG', nFolhas, 'Pivo', 'fab',
          `conjunto sup/inf 350kg (${decomp}${qtdSuf})`);
    } else {
      // Sem peso informado: usa 350 KG (default conservador).
      add('PA-PIVOT 350 KG', nFolhas, 'Pivo', 'fab',
          `conjunto sup/inf 350kg (peso da folha nao informado${qtdSuf})`);
    }

    // 7. FITA ESCOVINHA Q-LON — depende do sistema
    //    PA006 → ceil(L/1000) × 2 metros
    //    PA007 → ceil(L/1000) × 4 metros
    if (L > 0) {
      const mFita = sis === 'PA006'
        ? Math.ceil((L / 1000) * 2)
        : Math.ceil((L / 1000) * 4);
      // Note: Felipe colocou PA-FITA VED 5X20 no item 7 mas categoria
      // FITA DUPLA FACE no PDF. Mantem as duas — sao produtos diferentes.
      // Aqui: fita escovinha = vedacao da soleira/chao.
      // (codigo PA-FITA VED 5X20 nao existe no SEED ainda — fica como
      //  CADASTRAR. Felipe pode cadastrar depois.)
      // add('PA-FITA VED 5X20', mFita, 'Vedacoes', 'fab', `${mFita}m de soleira`);
      // SUSPENSO ate codigo existir no cadastro pra evitar listas vazias
    }

    // 8. Q-LON VEDACAO — ceil(H/1000) × 2 metros (cada perfil)
    if (H > 0) {
      const mQL = Math.ceil((H / 1000) * 2);
      add('PA-QL 48800', mQL, 'Vedacoes', 'fab', `Flipper Seal H×2 = ${mQL}m`);
      add('PA-QL 48700', mQL, 'Vedacoes', 'fab', `H×2 = ${mQL}m`);
    }

    // 9. ISOLAMENTO — LA DE ROCHA
    //    m2 = L × H × 2 / 1.000.000 (arredondado pra inteiro)
    if (L > 0 && H > 0) {
      const m2Iso = Math.ceil((L / 1000) * (H / 1000) * 2);
      add('PA-LADEROCHA', m2Iso, 'Isolamento', 'fab', `L×H×2 = ${m2Iso}m²`);
    }

    // 10. EPS PLACA 50mm — embalagem (mesma m2 do isolamento)
    if (L > 0 && H > 0) {
      const m2Eps = Math.ceil((L / 1000) * (H / 1000) * 2);
      add('PA-ISOPOR PRANC 50', m2Eps, 'Embalagem', 'fab', `L×H×2 = ${m2Eps}m²`);
    }

    // 11. EPS CANALETA U — depende de sistema + ripado
    //     mIso = ceil((H/1000)×4 + (L/1000)×3)
    if (L > 0 && H > 0) {
      const mIso = Math.ceil((H / 1000) * 4 + (L / 1000) * 3);
      let codEps;
      if (ripado) {
        codEps = sis === 'PA006' ? 'PA-ISOPOR 135' : 'PA-ISOPOR 165';
      } else {
        codEps = sis === 'PA006' ? 'PA-ISOPOR 115' : 'PA-ISOPOR 125';
      }
      add(codEps, mIso, 'Embalagem', 'fab', `H×4 + L×3 = ${mIso}m`);
    }

    }  // ← fim do if (item.tipo === 'porta_externa') da FABRICACAO

    // ============================================================
    // FITA DUPLA FACE + SILICONE ESTRUTURAL 995 (Felipe sessao 2026-08)
    // ============================================================
    // Substitui o calculo aproximado anterior (perim × 1.5/0.5 chumbado)
    // pela tabela EXATA fornecida no Excel CALCULO_DE_FITA_DULPA_FACE.
    //
    // Regra: pra cada peca do Lev. Superficies E pra cada perfil do
    // motor PerfisPortaExterna, aplica multiplicador especifico conforme
    // o label da peca/perfil e o sistema (PA006 vs PA007).
    //
    // Tabela (Excel sheet "PORTA" + correcoes Felipe sessao 2026-08):
    //   PEÇA/PERFIL              F.D19    F.D12    Silicone  Tamanho
    //   Alisar Altura            1×qtd    -        1×qtd     altura da peça
    //   Alisar Largura           1×qtd    -        1×qtd     altura da peça
    //   Tampa de Furo (PA007)    2×qtd    -        1×qtd     altura da peça
    //   Tampa de Furo (PA006)    -        2×qtd    1×qtd     altura da peça
    //   PA-PA006P (Alt Portal)   2×qty    2×qty    8×qty     comp do perfil
    //   PA-PA007P (Alt Portal)   4×qty    4×qty    10×qty    comp do perfil
    //   Largura Portal           4×qty    -        5×qty     comp do perfil  ← Felipe correção 2026-08
    //   PA-PA006F/PA007F (Folha) 1×qty    -        8×qty     comp do perfil
    //   Qualquer "Tampa..."      1×qtd    -        1×qtd     perim (L×2+H×2)
    //   Tubo das Ripas           -        2×qty    -         comp do perfil  ← Felipe correção 2026-08 (era silicone)
    //
    // "Silicone" = Silicone Estrutural 995 (DowSil 995). Nome interno mMS por brevidade.
    // Conversao final: F.D total / 20m por rolo | Silicone total / 8m por tubo
    //
    // Felipe sessao 2026-08-03: 'Fita Acabamento ME/MA, fita acabamento
    // largura, e todos alisares na realidade sao itens da obra, voce
    // deve jogar em itens da obra e vamos mudar de 995 para PA-HIGHTACK BR'.
    //
    // Itens FAB (ficam na fabrica, silicone = PA-DOWSIL 995):
    //   - Cantoneira, Cava, L da Cava, Tampa Maior/Borda/Furo, qualquer
    //     Tampa, Travessa Vert/Horiz, Altura Folha/Portal, Largura Portal,
    //     Ripas
    //
    // Itens OBRA (vao pra obra com instalador, silicone = PA-HIGHTACK BR):
    //   - Alisar Altura, Alisar Largura, Fita Acab ME, Fita Acab MA,
    //     Fita Acab Largura
    if (L > 0 && H > 0) {
      // Acumuladores FAB (linha original)
      let mFD19 = 0;  // metros lineares de Fita Dupla Face 19mm (FAB)
      let mFD12 = 0;  // metros lineares de Fita Dupla Face 12mm (FAB)
      let mMS   = 0;  // metros lineares de Silicone Estrutural 995 (FAB)
      let mCPS  = 0;  // metros lineares de PA-DOWSIL CPS BR (FAB)

      // Acumuladores OBRA (Felipe sessao 2026-08-03)
      let mFD19_obra = 0;  // FD19 que vai pra obra (Alisar/Fita Acab)
      let mFD12_obra = 0;  // FD12 que vai pra obra (Alisar/Fita Acab)
      let mHIGHTACK  = 0;  // PA-HIGHTACK BR (silicone obra)

      // Felipe sessao 2026-08: 'me traga suas contas detalhadas'.
      // Acumulador de breakdown: cada chamada de aplicarRegra* registra
      // aqui sua contribuicao. Usado pelo modal debug pra mostrar
      // exatamente de onde sai cada metro de FD19/FD12/MS.
      const _breakdown = [];

      // Felipe sessao 2026-08-03: lista de regras que vao pra OBRA.
      // aplicarRegra checa essa lista e direciona pros acumuladores OBRA
      // em vez de FAB. Silicone vira PA-HIGHTACK BR.
      const REGRAS_OBRA = new Set([
        'alisar_altura',
        'alisar_largura',
        // Felipe (sessao 09): fita_acab_me removida — so usa FD 12mm, sem HIGHTACK
        'fita_acab_ma',
        'fita_acab_largura',
      ]);

      // Felipe sessao 2026-08: le multiplicadores da tabela editavel em
      // Cadastro > Regras e Logicas > Fita Dupla Face + Silicone. Se o
      // modulo Regras nao estiver disponivel (loading order, dev), usa
      // fallback chumbado com os valores padrao do Excel.
      const REGRAS_DEFAULT = {
        'alisar_altura':       { fd19: 1, fd12: 0, ms: 1, cps: 0,  tamanho: 'comprimento' },
        'alisar_largura':      { fd19: 1, fd12: 0, ms: 1, cps: 0,  tamanho: 'comprimento' },
        'tampa_furo_pa006':    { fd19: 0, fd12: 2, ms: 1, cps: 0,  tamanho: 'comprimento' },
        'tampa_furo_pa007':    { fd19: 2, fd12: 0, ms: 1, cps: 0,  tamanho: 'comprimento' },
        'altura_portal_pa006': { fd19: 1, fd12: 1, ms: 3, cps: 0,  tamanho: 'comprimento' },
        'altura_portal_pa007': { fd19: 1, fd12: 1, ms: 3, cps: 0,  tamanho: 'comprimento' },
        'largura_portal':      { fd19: 0, fd12: 2, ms: 4, cps: 0,  tamanho: 'comprimento' },
        // Felipe sessao 2026-08: travessa_vert_horiz e' UNICA regra com cps > 0.
        // Excel: 'PA-DOWSIL CPS BR | 2 X QUANTIDADE DESTE ITEM | COMPRIMENTO TUBO TRAVESSA'
        'travessa_vert_horiz': { fd19: 0, fd12: 0, ms: 2, cps: 2,  tamanho: 'comprimento' },
        // Felipe sessao 2026-08-03: 'cantoneira nao tem silicone
        // estrutural 995 na minha planilha e voce colocou na sua 2x'.
        // Excel oficial CALCULO_DE_FITA_DULPA_FACE.xlsx aba PORTA e
        // PORTAL diz pra PA-CANT-30X30X2.0:
        //   FITA DUPLA FACE 19:  1× × COMPRIMENTO Cantoneira Cava
        //   FITA DUPLA FACE 12:  (vazio - nao usa)
        //   SILICONE ESTRUTURAL: (vazio - NAO USA)
        // Antes era fd19: 2, ms: 2 (incorreto). Corrigindo.
        'cantoneira_cava':     { fd19: 1, fd12: 0, ms: 0, cps: 0,  tamanho: 'comprimento' },
        'altura_folha':        { fd19: 0, fd12: 0, ms: 3, cps: 0,  tamanho: 'comprimento' },
        'tampa_generica':      { fd19: 1, fd12: 0, ms: 1, cps: 0,  tamanho: 'perimetro'   },
        'ripas':               { fd19: 0, fd12: 2, ms: 0, cps: 0,  tamanho: 'comprimento' },
        'revestimento_tampa':  { fd19: 1, fd12: 0, ms: 1, cps: 0,  tamanho: 'rev_parede'  },
        'fixo_tampa':              { fd19: 1, fd12: 0, ms: 1, cps: 0, tamanho: 'perimetro'       },
        'fixo_fita_acab_maior':    { fd19: 2, fd12: 0, ms: 1, cps: 0, tamanho: 'fixo_fita_dupla' },
        'fixo_fita_acab_menor':    { fd19: 0, fd12: 1, ms: 1, cps: 0, tamanho: 'fixo_fita_dupla' },
        'fixo_fita_acab_largura':  { fd19: 2, fd12: 0, ms: 1, cps: 0, tamanho: 'perimetro'       },

        // Felipe sessao 2026-08-03: 4 regras faltantes pra porta_externa
        // (Excel CALCULO_DE_FITA_DULPA_FACE.xlsx aba PORTA e PORTAL).
        // Antes essas peças apareciam no Lev.Superficies mas eram ignoradas
        // pelo motor de FD/Silicone — saiam zeradas no calculo.
        //
        // Excel:
        //   fita acab ME:      0×FD19, 1×FD12, 1×Silicone (comprimento)
        //   fita acab MA:      1×FD19, 0×FD12, 1×Silicone (comprimento)
        //   fita acab Largura: 1×FD19, 0×FD12, 1×Silicone (comprimento)
        //   Cava: 2×FD19, 0×FD12, 2× silicone (× 2 se cava dupla mod 9)
        //         O motor de chapas (38-chapas-porta-externa.js) ja' gera
        //         a peca 'Cava' com qtd dobrada quando 2F (ext=2,int=2=4)
        //         e 'L da Cava' com qtd dobrada em cava dupla (ext=2,int=2=4).
        //         Por isso aqui basta `× 2` que ja' contempla todos os casos.
        'fita_acab_me':         { fd19: 0, fd12: 1, ms: 0, cps: 0, tamanho: 'comprimento' },
        'fita_acab_ma':         { fd19: 1, fd12: 0, ms: 1, cps: 0, tamanho: 'comprimento' },
        'fita_acab_largura':    { fd19: 1, fd12: 0, ms: 1, cps: 0, tamanho: 'comprimento' },
        'cava_porta':           { fd19: 2, fd12: 0, ms: 2, cps: 0, tamanho: 'comprimento' },
      };
      const REGRAS = (window.Regras && typeof window.Regras.getFitaSilicone === 'function')
        ? window.Regras.getFitaSilicone()
        : REGRAS_DEFAULT;

      // Helper: aplica multiplicadores de uma regra (id) a uma metragem em metros
      function aplicarRegra(idRegra, metros, origem) {
        const r = REGRAS[idRegra] || REGRAS_DEFAULT[idRegra];
        if (!r) return;
        const cFD19 = (Number(r.fd19) || 0) * metros;
        const cFD12 = (Number(r.fd12) || 0) * metros;
        const cMS   = (Number(r.ms)   || 0) * metros;
        const cCPS  = (Number(r.cps)  || 0) * metros;
        // Felipe sessao 2026-08-03: regras OBRA acumulam em mFD19_obra,
        // mFD12_obra e mHIGHTACK (silicone PA-HIGHTACK BR).
        // FAB (todo o resto) acumula em mFD19, mFD12, mMS (silicone 995).
        const ehObra = REGRAS_OBRA.has(idRegra);
        if (ehObra) {
          mFD19_obra += cFD19;
          mFD12_obra += cFD12;
          mHIGHTACK  += cMS;  // 'ms' da regra vira PA-HIGHTACK BR pra OBRA
          // CPS nao se aplica em obra (so' Travessas FAB usam CPS)
        } else {
          mFD19 += cFD19;
          mFD12 += cFD12;
          mMS   += cMS;
          mCPS  += cCPS;
        }
        _breakdown.push({
          origem: origem || idRegra,
          regra:  idRegra,
          tipo:   'comprimento',
          metros: metros,
          aplicacao: ehObra ? 'obra' : 'fab',
          mult:   { fd19: r.fd19||0, fd12: r.fd12||0, ms: r.ms||0, cps: r.cps||0 },
          // Felipe (sessao 09 fix): itens OBRA devem mostrar metragem
          // na coluna HIGHTACK, nao na coluna Silicone 995.
          contrib: ehObra
            ? { fd19: cFD19, fd12: cFD12, ms: 0, cps: 0, hightack: cMS }
            : { fd19: cFD19, fd12: cFD12, ms: cMS, cps: cCPS, hightack: 0 },
        });
      }

      // Felipe sessao 2026-08 (Excel atualizado): helper pra REVESTIMENTO
      // DE PAREDE. Fita usa perimetro normal (L×2 + H×2). Silicone tem
      // cordoes internos a cada 800mm vertical, ARREDONDADO:
      //   silicone = perimetro + L × Math.round(H/800)
      // Antes era H/800 direto (sem arredondar). Excel diz 'L × (H/800
      // ARREDIONDAD)' - aplicamos Math.round na divisao.
      function aplicarRegraRevParede(idRegra, larMm, altMm, qtdPecas, origem) {
        const r = REGRAS[idRegra] || REGRAS_DEFAULT[idRegra];
        if (!r) return;
        const perimM    = ((larMm + altMm) * 2 * qtdPecas) / 1000;
        const cordoes   = Math.round(altMm / 800);
        const internosM = (larMm * cordoes * qtdPecas) / 1000;
        const cFD19 = (Number(r.fd19) || 0) * perimM;
        const cFD12 = (Number(r.fd12) || 0) * perimM;
        const cMS   = (Number(r.ms)   || 0) * (perimM + internosM);
        const cCPS  = (Number(r.cps)  || 0) * (perimM + internosM);
        mFD19 += cFD19;
        mFD12 += cFD12;
        mMS   += cMS;
        mCPS  += cCPS;
        _breakdown.push({
          origem: origem || idRegra,
          regra:  idRegra,
          tipo:   'rev_parede',
          metros: perimM + internosM,  // metragem usada pro silicone
          dim:    { L: larMm, H: altMm, qtd: qtdPecas, cordoes: cordoes },
          mult:   { fd19: r.fd19||0, fd12: r.fd12||0, ms: r.ms||0, cps: r.cps||0 },
          contrib:{ fd19: cFD19, fd12: cFD12, ms: cMS, cps: cCPS },
        });
      }

      // Felipe sessao 2026-08 (Excel atualizado): helper pra FIXO ACOPLADO
      // tamanho 'fixo_fita_dupla'. Fita usa COMPRIMENTO (altura), silicone
      // usa PERIMETRO (L×2 + H×2). Necessario pra Fita Acabamento Maior e
      // Fita Acabamento Menor que tem tamanhos diferentes pra cada material.
      function aplicarRegraFixoFitaDupla(idRegra, larMm, altMm, qtdPecas, origem) {
        const r = REGRAS[idRegra] || REGRAS_DEFAULT[idRegra];
        if (!r) return;
        const compM   = (altMm * qtdPecas) / 1000;
        const perimM  = ((larMm + altMm) * 2 * qtdPecas) / 1000;
        const cFD19 = (Number(r.fd19) || 0) * compM;
        const cFD12 = (Number(r.fd12) || 0) * compM;
        const cMS   = (Number(r.ms)   || 0) * perimM;
        const cCPS  = (Number(r.cps)  || 0) * perimM;
        mFD19 += cFD19;
        mFD12 += cFD12;
        mMS   += cMS;
        mCPS  += cCPS;
        _breakdown.push({
          origem: origem || idRegra,
          regra:  idRegra,
          tipo:   'fixo_fita_dupla',
          metros: perimM,
          dim:    { L: larMm, H: altMm, qtd: qtdPecas, compM: compM, perimM: perimM },
          mult:   { fd19: r.fd19||0, fd12: r.fd12||0, ms: r.ms||0, cps: r.cps||0 },
          contrib:{ fd19: cFD19, fd12: cFD12, ms: cMS, cps: cCPS },
        });
      }

      // --- 0) REVESTIMENTO DE PAREDE: pecas do motor ChapasRevParede ---
      // Felipe sessao 2026-08: 'fita dupla face 19 l x 2 + h x 2 medida de
      // cada tampa + silicone L×2 + H×2 + L×(H/800)'.
      // Cada peca do revestimento e' considerada uma "tampa".
      if (item.tipo === 'revestimento_parede') {
        try {
          const pecasRev = (window.ChapasRevParede?.gerarPecasRevParede?.(item)) || [];
          pecasRev.forEach(p => {
            const lar = Number(p.largura) || 0;
            const alt = Number(p.altura)  || 0;
            const qtd = Number(p.qtd)     || 0;
            if (!lar || !alt || !qtd) return;
            aplicarRegraRevParede('revestimento_tampa', lar, alt, qtd * qtdPortas,
              `Revestimento: tampa ${lar}×${alt}mm × ${qtd}un`);
          });
        } catch (e) { console.warn('[FD/MS] erro ao ler pecas revestimento:', e); }
      }

      // --- 0b) FIXO ACOPLADO A PORTA: pecas do motor PerfisRevAcoplado ---
      // Felipe sessao 2026-08 (Excel atualizado):
      //   'Tampa...' (qualquer)        -> fixo_tampa (perimetro pra ambos)
      //   'Fita Acabamento Maior'      -> fixo_fita_acab_maior
      //                                   (fita=comprimento, silicone=perimetro)
      //   'Fita Acabamento Menor'      -> fixo_fita_acab_menor
      //                                   (fita=comprimento, silicone=perimetro)
      //   'Fita Acabamento Largura'    -> fixo_fita_acab_largura (perimetro p/ ambos)
      //   Outras pecas (Cava, Acabamento Lateral, etc): ignora silenciosamente.
      if (item.tipo === 'fixo_acoplado') {
        try {
          const pecasFixo = (window.PerfisRevAcoplado?.gerarPecasChapa?.(item, 'externo')) || [];
          pecasFixo.forEach(p => {
            const lar = Number(p.largura) || 0;
            const alt = Number(p.altura)  || 0;
            const qtd = Number(p.qtd)     || 0;
            if (!lar || !alt || !qtd) return;
            const lblLow = String(p.label || '').toLowerCase().trim();
            const qtdTotal = qtd * qtdPortas;
            const perimM = ((lar + alt) * 2 * qtdTotal) / 1000;

            if (lblLow === 'fita acabamento maior')   return aplicarRegraFixoFitaDupla('fixo_fita_acab_maior', lar, alt, qtdTotal,   `Fixo: ${p.label} ${lar}×${alt}mm`);
            if (lblLow === 'fita acabamento menor')   return aplicarRegraFixoFitaDupla('fixo_fita_acab_menor', lar, alt, qtdTotal,   `Fixo: ${p.label} ${lar}×${alt}mm`);
            if (lblLow === 'fita acabamento largura') return aplicarRegra('fixo_fita_acab_largura', perimM,                          `Fixo: ${p.label} ${lar}×${alt}mm (perim ${perimM.toFixed(2)}m)`);
            if (lblLow.startsWith('tampa'))           return aplicarRegra('fixo_tampa', perimM,                                       `Fixo: ${p.label} ${lar}×${alt}mm (perim ${perimM.toFixed(2)}m)`);
          });
        } catch (e) { console.warn('[FD/MS] erro ao ler pecas fixo:', e); }
      }

      // --- 1) Pecas do Levantamento de Superficies (AMBOS os lados) ---
      // Felipe sessao 2026-08-03 BUG FIX: 'qualquer item escrito tampa
      // ... tampa maior da cava tem 2 unidades e no calculo so tem 1.
      // tampa furo sao 3 unidades, so sai 2 no calculo'.
      //
      // CAUSA: gerarPecasChapa(item, 'externo') retorna so' lado externo.
      // Tampa Maior Cava tem ext=1, int=1 = total 2 unidades. Antes lia
      // so' o externo (1).
      //
      // FIX: le os 2 lados, agrupa por (label + dimensoes) e SOMA as qtds.
      // Assim FD/MS recebe a quantidade real total como aparece no
      // Levantamento de Superficies.
      //
      // So' pra porta_externa (revestimento ja' foi tratado no bloco 0)
      if (item.tipo === 'porta_externa') {
        try {
          const pecasExt = (window.ChapasPortaExterna?.gerarPecasChapa?.(item, 'externo')) || [];
          const pecasInt = (window.ChapasPortaExterna?.gerarPecasChapa?.(item, 'interno')) || [];
          // Agrupa por (label + largura + altura): peças identicas dos
          // 2 lados viram uma so', somando qtd. Lev.Superficies ja' faz
          // isso na tela.
          const mapa = new Map();
          [...pecasExt, ...pecasInt].forEach(p => {
            const lar = Number(p.largura) || 0;
            const alt = Number(p.altura)  || 0;
            const qtd = Number(p.qtd)     || 0;
            if (!lar || !alt || !qtd) return;
            const chave = `${p.label}|${lar}|${alt}`;
            if (mapa.has(chave)) {
              mapa.get(chave).qtd += qtd;
            } else {
              mapa.set(chave, { label: p.label, largura: lar, altura: alt, qtd: qtd });
            }
          });
          const pecas = Array.from(mapa.values());

          pecas.forEach(p => {
            const lar = Number(p.largura) || 0;
            const alt = Number(p.altura)  || 0;
            const qtd = Number(p.qtd)     || 0;
            if (!lar || !alt || !qtd) return;
            const lblLow = String(p.label || '').toLowerCase().trim();
            const compM  = (alt * qtd * qtdPortas) / 1000;            // comprimento (altura) em metros
            const perimM = ((lar + alt) * 2 * qtd * qtdPortas) / 1000; // perimetro em metros

            if (lblLow === 'alisar altura')        return aplicarRegra('alisar_altura',  compM, `${p.label||'Alisar Altura'} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
            if (lblLow === 'alisar largura')       return aplicarRegra('alisar_largura', compM, `${p.label||'Alisar Largura'} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
            if (lblLow === 'tampa de furo')        return aplicarRegra(sis === 'PA007' ? 'tampa_furo_pa007' : 'tampa_furo_pa006', compM, `${p.label||'Tampa Furo'} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
            // Felipe sessao 2026-08-03: regras faltantes (Excel oficial)
            if (lblLow === 'fita acabamento menor')   return aplicarRegra('fita_acab_me',      compM, `${p.label} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
            if (lblLow === 'fita acabamento maior')   return aplicarRegra('fita_acab_ma',      compM, `${p.label} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
            if (lblLow === 'fita acabamento largura') {
              // Felipe (sessao 09): comprimento = largura da porta + 100mm
              // Antes usava alt (altura da peça = H portal) — ERRADO.
              const compLarg = ((L + 100) * qtd * qtdPortas) / 1000;
              return aplicarRegra('fita_acab_largura', compLarg, `${p.label} (L+100)=${L + 100}mm × ${qtd}un (${compLarg.toFixed(2)}m)`);
            }
            // Cava: motor de chapas ja' gera qtd dobrada quando 2F ou cava dupla,
            // entao aqui aplicamos × 2 direto (Excel: 2 X POR FOLHA, ja' contemplado pelo qtd).
            if (lblLow === 'cava')                    return aplicarRegra('cava_porta',        compM, `${p.label} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
            if (lblLow === 'l da cava')               return aplicarRegra('cava_porta',        compM, `${p.label} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
            if (lblLow.startsWith('tampa'))        return aplicarRegra('tampa_generica', perimM, `${p.label} ${lar}×${alt}mm × ${qtd}un (perim ${perimM.toFixed(2)}m)`);
          });
        } catch (e) { console.warn('[FD/MS] erro ao ler pecas:', e); }

        // --- 2) Perfis do motor PerfisPortaExterna ---
        try {
          const cortes = (window.PerfisPortaExterna?.gerarCortes?.(item)) || {};
          Object.keys(cortes).forEach(codigo => {
            const lista = cortes[codigo] || [];
            const isPA007 = /^PA-PA007/.test(codigo);
            lista.forEach(corte => {
              const comp = Number(corte.comp) || 0;
              const qty  = Number(corte.qty)  || 0;
              if (!comp || !qty) return;
              const m = (comp * qty) / 1000;  // metros
              const lbl = String(corte.label || '');

              if (lbl === 'Altura Folha')              return aplicarRegra('altura_folha', m,                                              `${codigo}: Altura Folha ${comp}mm × ${qty} (${m.toFixed(2)}m)`);
              if (lbl === 'Altura Portal')             return aplicarRegra(isPA007 ? 'altura_portal_pa007' : 'altura_portal_pa006', m,    `${codigo}: Altura Portal ${comp}mm × ${qty} (${m.toFixed(2)}m)`);
              if (lbl === 'Largura Portal')            return aplicarRegra('largura_portal', m,                                            `${codigo}: Largura Portal ${comp}mm × ${qty} (${m.toFixed(2)}m)`);
              // Felipe sessao 2026-08 (Excel atualizado): NOVOS handlers de
              // Travessa Vertical / Horizontal (4×FD19, sem silicone).
              // (Handler 'Largura Inferior & Superior' foi REMOVIDO: o que
              // o Excel chamava de 'LAREGURA PORTA' era erro de digitacao
              // do PORTAL acima - nao e' o perfil interno da folha.)
              if (lbl === 'Travessa Vertical')         return aplicarRegra('travessa_vert_horiz', m, `${codigo}: Travessa Vert ${comp}mm × ${qty} (${m.toFixed(2)}m)`);
              if (lbl === 'Travessa Horizontal')       return aplicarRegra('travessa_vert_horiz', m, `${codigo}: Travessa Horiz ${comp}mm × ${qty} (${m.toFixed(2)}m)`);
              if (lbl === 'Tubo Interno das Ripas')    return aplicarRegra('ripas',                m, `${codigo}: Ripas ${comp}mm × ${qty} (${m.toFixed(2)}m)`);
              // Felipe sessao 2026-08 V5 (Excel atualizado): NOVA regra
              // 'cantoneira_cava' (so' aparece em modelo cava). Excel diz
              // 2×FD19 + 2×silicone × comprimento. Perfil cod 'PA-CANT-30X30X2.0'
              // gerado pelo motor PerfisPortaExterna com label 'Cantoneira Cava'.
              if (lbl === 'Cantoneira Cava')           return aplicarRegra('cantoneira_cava',     m, `${codigo}: Cantoneira Cava ${comp}mm × ${qty} (${m.toFixed(2)}m)`);
            });
          });
        } catch (e) { console.warn('[FD/MS] erro ao ler perfis:', e); }
      }

      // --- 3) Conversao final em rolos/tubos ---
      // Felipe sessao 2026-08: 'deixe esse valor editavel'. Le rendimentos
      // editaveis em Cadastro > Regras > Fita+Silicone. Defaults atuais:
      //   FD 19mm: 20m por rolo  ·  FD 12mm: 20m por rolo  ·  Silicone: 12m por tubo
      let RENDIMENTOS_FS;
      try {
        RENDIMENTOS_FS = (window.Regras && typeof window.Regras.getRendimentos === 'function')
          ? window.Regras.getRendimentos()
          : { fd19_rolo: 20, fd12_rolo: 20, ms_tubo: 12, hightack_tubo: 8 };
      } catch(e) {
        RENDIMENTOS_FS = { fd19_rolo: 20, fd12_rolo: 20, ms_tubo: 12, hightack_tubo: 8 };
      }
      const FD19_POR_ROLO    = Number(RENDIMENTOS_FS.fd19_rolo)     > 0 ? Number(RENDIMENTOS_FS.fd19_rolo)     : 20;
      const FD12_POR_ROLO    = Number(RENDIMENTOS_FS.fd12_rolo)     > 0 ? Number(RENDIMENTOS_FS.fd12_rolo)     : 20;
      const MS_POR_TUBO      = Number(RENDIMENTOS_FS.ms_tubo)       > 0 ? Number(RENDIMENTOS_FS.ms_tubo)       : 12;
      // Felipe sessao 2026-08-03: PA-HIGHTACK BR rende menos que 995.
      // Default 8m por tubo (vs 12m do DowSil 995). Editavel em
      // Cadastro > Regras e Logicas > Fita+Silicone.
      const HIGHTACK_POR_TUBO = Number(RENDIMENTOS_FS.hightack_tubo) > 0 ? Number(RENDIMENTOS_FS.hightack_tubo) : 8;

      if (mFD19 > 0) {
        const rolos = Math.ceil(mFD19 / FD19_POR_ROLO);
        add('PA-FITDF 19X20X1.0', rolos, 'Fita Dupla Face', 'fab',
            `${mFD19.toFixed(1)}m / ${FD19_POR_ROLO}m por rolo = ${rolos} rolo(s)`);
      }
      if (mFD12 > 0) {
        const rolos = Math.ceil(mFD12 / FD12_POR_ROLO);
        add('PA-FITDF 12X20X1.0', rolos, 'Fita Dupla Face', 'fab',
            `${mFD12.toFixed(1)}m / ${FD12_POR_ROLO}m por rolo = ${rolos} rolo(s)`);
      }
      if (mMS > 0) {
        const tubos = Math.ceil(mMS / MS_POR_TUBO);
        add('PA-DOWSIL 995', tubos, 'Selantes', 'fab',
            `${mMS.toFixed(1)}m / ${MS_POR_TUBO}m por tubo = ${tubos} tubo(s)`);
      }

      // Felipe sessao 2026-08-03: linhas OBRA - silicone PA-HIGHTACK BR
      // (Fix All High Tack Branco) e fita dupla face vinda de Alisar/Fita Acab.
      // Aplicacao 'obra' = vai com instalador na obra (categoria diferente
      // de FAB que fica na fabrica).
      if (mFD19_obra > 0) {
        const rolos = Math.ceil(mFD19_obra / FD19_POR_ROLO);
        add('PA-FITDF 19X20X1.0', rolos, 'Fita Dupla Face', 'obra',
            `${mFD19_obra.toFixed(1)}m / ${FD19_POR_ROLO}m por rolo = ${rolos} rolo(s) (obra)`);
      }
      if (mFD12_obra > 0) {
        const rolos = Math.ceil(mFD12_obra / FD12_POR_ROLO);
        add('PA-FITDF 12X20X1.0', rolos, 'Fita Dupla Face', 'obra',
            `${mFD12_obra.toFixed(1)}m / ${FD12_POR_ROLO}m por rolo = ${rolos} rolo(s) (obra)`);
      }
      if (mHIGHTACK > 0) {
        const tubos = Math.ceil(mHIGHTACK / HIGHTACK_POR_TUBO);
        add('PA-HIGHTACK BR', tubos, 'Selantes', 'obra',
            `${mHIGHTACK.toFixed(1)}m / ${HIGHTACK_POR_TUBO}m por tubo = ${tubos} tubo(s) (obra)`);
      }
      // Felipe sessao 2026-08: PA-DOWSIL CPS BR (sache 591ml). So' aparece
      // nas Travessas. Mesmo rendimento do silicone estrutural (MS_POR_TUBO,
      // Felipe: 'mesmo do 995, pegue do cadastro logica').
      if (mCPS > 0) {
        const sachesCPS = Math.ceil(mCPS / MS_POR_TUBO);
        add('PA-DOWSIL CPS BR', sachesCPS, 'Selantes', 'fab',
            `${mCPS.toFixed(1)}m / ${MS_POR_TUBO}m por sache = ${sachesCPS} sache(s)`);
      }

      // Felipe sessao 2026-08: 'me traga suas contas detalhadas'.
      // Salva o breakdown desse item no cache global indexado por id.
      // Usado pela funcao window.debugFitaSilicone(itemId) e pelo botao
      // 'Detalhar' na aba Custos do orcamento.
      // Felipe sessao 2026-08 REVISAO: itens criados por novoItemPortaExterna
      // nao tem 'id' - usa _cacheKey deterministico que o caller seta
      // (12-orcamento.js renderLevAcessoriosTab atribui antes da chamada).
      try {
        window._fitaSiliconeBreakdownCache = window._fitaSiliconeBreakdownCache || {};
        const ckey = item._cacheKey || item.id || ('item_' + Date.now());
        window._fitaSiliconeBreakdownCache[ckey] = {
          itemId:    item.id,
          cacheKey:  ckey,
          itemTipo:  item.tipo,
          itemDim:   { L: L, H: H, nFolhas: nFolhas, qtdPortas: qtdPortas },
          // Felipe sessao 2026-08-03: totais agora separam FAB e OBRA
          // pra que o modal de Detalhamento mostre PA-HIGHTACK BR.
          totais:    {
            mFD19: mFD19, mFD12: mFD12, mMS: mMS, mCPS: mCPS,
            mFD19_obra: mFD19_obra, mFD12_obra: mFD12_obra, mHIGHTACK: mHIGHTACK,
          },
          rendimentos: {
            fd19_rolo: FD19_POR_ROLO, fd12_rolo: FD12_POR_ROLO,
            ms_tubo: MS_POR_TUBO, cps_sache: MS_POR_TUBO,
            hightack_tubo: HIGHTACK_POR_TUBO,
          },
          rolosFD19:      mFD19      > 0 ? Math.ceil(mFD19      / FD19_POR_ROLO)     : 0,
          rolosFD12:      mFD12      > 0 ? Math.ceil(mFD12      / FD12_POR_ROLO)     : 0,
          tubosMS:        mMS        > 0 ? Math.ceil(mMS        / MS_POR_TUBO)       : 0,
          sachesCPS:      mCPS       > 0 ? Math.ceil(mCPS       / MS_POR_TUBO)       : 0,
          rolosFD19_obra: mFD19_obra > 0 ? Math.ceil(mFD19_obra / FD19_POR_ROLO)     : 0,
          rolosFD12_obra: mFD12_obra > 0 ? Math.ceil(mFD12_obra / FD12_POR_ROLO)     : 0,
          tubosHIGHTACK:  mHIGHTACK  > 0 ? Math.ceil(mHIGHTACK  / HIGHTACK_POR_TUBO) : 0,
          breakdown: _breakdown.slice(),
          ts:        Date.now(),
        };
      } catch(e){ /* nao crit */ }
    }

    // VEDA PORTA (Felipe sessao 2026-08): proximo na sequencia
    //   820, 920, 1020, 1120, 1220, 1320, 1420, 1520, 1620, 1720...
    //   nFolhas=1 → 2 unidades
    //   nFolhas=2 → 4 unidades
    //
    // Felipe (sessao 2026-09 — fix do "970"): a observacao mostrava
    // o tamanho do PA-PA006V/PA007V como "medida - 50", o que produz
    // valores como 970 que nao existem na sequencia. O tamanho real
    // do perfil de corte e' LARG_INT_FOLHA + 110 + 110 (formula VEDA
    // bruta, antes do snap pra X20). Agora mostra o valor correto.
    if (L > 0) {
      const medida = calcularVedaPorta(L, nFolhas, FGLD, FGLE);
      const codVeda = `PA-VED${medida}`;
      const qtdVeda = nFolhas === 2 ? 4 : 2;
      // Tamanho do corte do perfil PA-PA006V / PA-PA007V (BRUTO):
      //   1F:  L - FGLD - FGLE - 171.7 - 171.5 + 110 + 110
      //   2F: (L - FGLD - FGLE - 171.7 - 171.5 - 235)/2 + 110 + 110
      const largIntFolha = nFolhas === 2
        ? (L - FGLD - FGLE - 171.7 - 171.5 - 235) / 2
        :  L - FGLD - FGLE - 171.7 - 171.5;
      const cortePerfil = Math.round(largIntFolha + 110 + 110);
      add(codVeda, qtdVeda, 'Vedacoes', 'fab',
          `${medida}mm × ${qtdVeda} un (corte PA-${sis}V: ${cortePerfil}mm)`);
    }

    // ============================================================
    // OBRA (so' pra porta_externa)
    // ============================================================
    if (item.tipo === 'porta_externa') {

    // 14. FECHO UNHA + PUSH&GO — so 2 folhas
    if (nFolhas === 2) {
      if (H > 4000) {
        add('PA-FECHUNHA', 1, 'Fecho Unha', 'obra', 'H > 4000mm');
        add('PA-PUSHGO',   1, 'Fecho Unha', 'obra', 'H > 4000mm');
      } else {
        add('PA-FECHUNHA', 2, 'Fecho Unha', 'obra', 'H ≤ 4000mm');
      }
    }

    // 15. PORTAL — Bucha + Parafuso (sempre)
    if (H > 0) {
      const qtyBucha8 = Math.ceil(H / 300) * 2;  // × 2 lados
      add('PA-BUCHA 08',      qtyBucha8, 'Portal', 'obra', `ceil(H/300) × 2 lados`);
      add('PA-PAR SOB M6X65', qtyBucha8, 'Portal', 'obra', `ceil(H/300) × 2 lados`);
    }

    // 16. CONTRA TESTA + CAIXETA — se tem fechadura
    if (pinos > 0) {
      add('PA-KESO CRT 4P RT CR', 1 * nFolhas, 'Fechaduras', 'obra', '1 por porta');
      add('PA-KESO CXT 4P',       1 * nFolhas, 'Fechaduras', 'obra', '1 por porta');

      // Auxiliares dependem dos pinos
      const qtyAux = pinos === 4 ? 0
                   : pinos === 8 ? 1
                   : pinos === 12 ? 2
                   : pinos === 16 ? 3
                   : pinos === 24 ? 4
                   : 0;
      if (qtyAux > 0) {
        add('PA-KESO CRT AUX CR', qtyAux * nFolhas, 'Fechaduras', 'obra', `auxiliar × ${qtyAux}`);
        add('PA-KESO CXT AUX',    qtyAux * nFolhas, 'Fechaduras', 'obra', `auxiliar × ${qtyAux}`);
      }
      // Parafusos contra testa: (1 × nFolhas + qtyAux) × 4
      const parTesta = (1 * nFolhas + qtyAux) * 4;
      add('PA-CHAAA PHS 35X20', parTesta, 'Parafusos', 'obra', `(${nFolhas} + ${qtyAux}) × 4 = ${parTesta}`);
    }

    // 17. SELANTES OBRA
    add('PA-PRIMER', 1, 'Selantes', 'obra', 'sempre');
    if (H > 0) {
      const espuma = H > 4000 ? 2 : 1;
      add('PA-ESPUMA EXP GUN', espuma, 'Selantes', 'obra', `H ${H > 4000 ? '>' : '≤'} 4000mm`);
      // Felipe sessao 2026-08-03: 'tem dois PA-HIGHTACK BR em obra, um
      // com nossa formula e outro fixo H ≤>5000mm com uma quantidade
      // delete esse antigo e mantenha somente o novo com nossa formula'.
      // Regra antiga era hightack = (H<=3000?2 : H<=5000?3 : 4) tubos
      // chumbado. Foi REMOVIDA - HIGHTACK BR agora vem da formula
      // correta via mHIGHTACK acumulado pelas regras de Alisar +
      // Fita Acab (commit 79e898c, linhas 768-773).
    }

    // 18. FECHADURAS DIGITAIS — fixo por marca
    if (marcaDig === 'TEDEE') {
      add('PA-TEDEE-BRIDGE', 1, 'Fechadura Digital', 'obra', 'Tedee Bridge');
      add('PA-TEDEE-FEC-PT', 1, 'Fechadura Digital', 'obra', 'Tedee Lock PRO');
      add('PA-TEDEE-TEC-PT', 1, 'Fechadura Digital', 'obra', 'Tedee Keypad');
      add('PA-PILHATEDEEAAA', 1, 'Fechadura Digital', 'obra', 'Pilhas AAA');
    } else if (marcaDig === 'EMTECO') {
      add('PA-DIG EMTECO BAR II', 1, 'Fechadura Digital', 'obra', 'Barcelona II WiFi');
    } else if (marcaDig === 'PHILIPS') {
      // Philips: pega TODOS os PA-9300* + PA-DIG PH*
      const philips = (cadastroAcessorios || []).filter(a => {
        const c = String(a.codigo || '');
        return /^PA-9300/.test(c) || /^PA-DIG PH/.test(c);
      });
      philips.forEach(a => {
        add(a.codigo, 1, 'Fechadura Digital', 'obra', 'Philips 9300 kit');
      });
    } else if (marcaDig === 'NUKI') {
      add('PA-NUKI-BRI',    1, 'Fechadura Digital', 'obra', 'Nuki Bridge');
      add('PA-NUKI-FEC-BL', 1, 'Fechadura Digital', 'obra', 'Nuki Smartlock Preto');
      add('PA-NUKI-TEC-BL', 1, 'Fechadura Digital', 'obra', 'Nuki Keypad Preto');
      add('PA-NUKIBATERIA', 1, 'Fechadura Digital', 'obra', 'Nuki Bateria');
    }

    }  // ← fim do if (item.tipo === 'porta_externa') da OBRA

    return linhas;
  }

  // API publica
  return {
    calcularAcessoriosPorItem,
    detectarPinos,
    detectarMarcaDigital,
    codigoPuxador,
    calcularVedaPorta,
    isCava,
    isRipado,
  };
})();

if (typeof window !== 'undefined') {
  window.AcessoriosPortaExterna = AcessoriosPortaExterna;
}
