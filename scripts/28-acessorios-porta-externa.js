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
    if (!item || item.tipo !== 'porta_externa') return [];
    opts = opts || {};
    const marcaCilindro = (opts.marcaCilindro || 'KESO').toUpperCase();

    const L = Number(item.largura) || 0;
    const H = Number(item.altura)  || 0;
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
    // FABRICACAO
    // ============================================================

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

    // SELANTES FAB — DOWSIL 995 (Felipe: 65.2m / 8m por tubo = 9 tubos)
    // Formula: ceil(perimetroPorta / 8) onde perimetroPorta = (L+H)*2 / 1000
    if (L > 0 && H > 0) {
      const perimetro = ((L + H) * 2) / 1000;
      const tubos = Math.max(1, Math.ceil(perimetro / 8));
      add('PA-DOWSIL 995', tubos, 'Selantes', 'fab', `${perimetro.toFixed(1)}m ÷ 8m/tubo = ${tubos} tubo(s)`);
    }

    // FITA DUPLA FACE (Felipe PDF):
    //   3 rolos PA-FITDF 19X20X1.0 (42.6m / 20m/rolo)
    //   1 rolo PA-FITDF 12X20X1.0 (15.2m / 20m/rolo)
    if (L > 0 && H > 0) {
      const perim = ((L + H) * 2) / 1000;  // perimetro em m
      // Aproximadamente: 19mm = perim x 1.5, 12mm = perim x 0.5
      const m19 = Math.ceil(perim * 1.5);
      const m12 = Math.ceil(perim * 0.5);
      const r19 = Math.max(1, Math.ceil(m19 / 20));
      const r12 = Math.max(1, Math.ceil(m12 / 20));
      add('PA-FITDF 19X20X1.0', r19, 'Fita Dupla Face', 'fab', `${m19}m ÷ 20m/rolo = ${r19} rolo(s)`);
      add('PA-FITDF 12X20X1.0', r12, 'Fita Dupla Face', 'fab', `${m12}m ÷ 20m/rolo = ${r12} rolo(s)`);
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
    // OBRA
    // ============================================================

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
      let hightack;
      if (H <= 3000)      hightack = 2;
      else if (H <= 5000) hightack = 3;
      else                hightack = 4;
      add('PA-HIGHTACK BR', hightack, 'Selantes', 'obra', `H ≤${H<=3000?'3000':H<=5000?'5000':'>5000'}mm`);
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
