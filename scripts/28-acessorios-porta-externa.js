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
    let t = parseFloat(String(puxTam).replace(',', '.'));
    if (!t || isNaN(t)) return null;
    // Felipe sessao 18: 'nao esta indo para acessorios os puxadores'.
    // Bug: o select do form salva '1500 mm', '2000 mm' etc (em MM).
    // A funcao esperava metros (1.0, 1.5...). parseFloat('1500 mm')=1500
    // → caia em todos os if e retornava null → puxador nao era adicionado
    // aos acessorios.
    // FIX: se valor >= 100, considera que esta em mm e converte pra metros.
    // Aceita ambos os formatos (legado em metros + novo em mm).
    if (t >= 100) t = t / 1000;
    // Felipe sessao 18: 'coloque sempre a cor preta nos acessorios'.
    // Cadastro tem 3 cores por tamanho:
    //   ESC = escovado, POL = polido, PRE = preto.
    // Antes: codigos vinham sem sufixo de cor (ex: 'PA-PUX-1,5MT')
    // → caia em '(nao cadastrado)' pois cadastro so tem com sufixo
    // PRE/POL/ESC. FIX: sempre adiciona ' PRE'.
    if (t === 1.0) return 'PA-PUX-1MT PRE';
    if (t === 1.5) return 'PA-PUX-1,5MT PRE';
    if (t === 2.0) return 'PA-PUX-2MT PRE';
    if (t <= 3.0)  return 'PA-PUX-3MT PRE';
    if (t <= 4.0)  return 'PA-PUX-4MT PRE';
    if (t <= 5.0)  return 'PA-PUX-5MT PRE';
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
    // Felipe sessao 18: pergolado tambem entra (so' fita+silicone).
    const tipoOK = item.tipo === 'porta_externa'
                || item.tipo === 'revestimento_parede'
                || item.tipo === 'fixo_acoplado'
                || item.tipo === 'pergolado';
    if (!tipoOK) return [];
    opts = opts || {};
    // Felipe sessao 12: detecta marca do PROPRIO item.cilindro se nao
    // veio em opts. Antes sempre usava 'KESO' default mesmo se o usuario
    // selecionou Udinese. Agora le do item:
    //   'KESO seguranca'      -> KESO  (default)
    //   'Udinese chave comum' -> UDINESE
    var marcaDetectada = 'KESO';
    if (item && item.cilindro) {
      var cilStr = String(item.cilindro).toUpperCase();
      if (cilStr.indexOf('UDINESE') !== -1 || cilStr.indexOf('UDINE') !== -1) {
        marcaDetectada = 'UDINESE';
      }
    }
    const marcaCilindro = (opts.marcaCilindro || marcaDetectada).toUpperCase();

    // Felipe sessao 2026-08: revestimento_parede usa largura_total/altura_total
    // (nao tem item.largura/altura). Outros campos especificos de porta
    // (fechadura, sistema, modelo) sao zerados pra revestimento - so' fita+silicone
    // sera calculado.
    const L = Number(item.largura)       || Number(item.largura_total) || 0;
    const H = Number(item.altura)        || Number(item.altura_total)  || 0;
    const nFolhas = Math.max(1, Math.min(2, Number(item.nFolhas) || 1));
    const qtdPortas = Math.max(1, Number(item.quantidade) || 1);
    const sis = String(item.sistema || '').toUpperCase().trim() || 'PA006';
    // Felipe sessao 12: helper unificado pra detectar PA006/PA007.
    // Pra PORTA EXTERNA, item.sistema = 'pivotante' ou 'dobradica' (NAO PA006/PA007).
    // Logica: PA006 = altura<4000mm, PA007 = altura>=4000mm
    //   (regra dos perfis em scripts/31-perfis-porta-externa.js linha 269:
    //    fam = altura<4000 ? '76' : '101', onde 76=PA006, 101=PA007).
    // Pra FIXO_ACOPLADO, item.sistema = 'PA006' ou 'PA007' explicito - usa direto.
    // Antes: 'sis === PA006' nunca era true pra porta -> sempre caia em PA007/150.
    const ehPA006 = (sis === 'PA006') ? true
                  : (sis === 'PA007') ? false
                  : (H > 0 && H < 4000); // porta: altura<4000 = PA006
    const fechMec = item.fechaduraMecanica || '';
    const fechDig = item.fechaduraDigital || '';
    const puxTam = item.tamanhoPuxador || '';
    const modeloExt = Number(item.modeloExterno || item.modeloNumero || 0);
    // Cava: se externo OU interno tem cava, considera "tem cava"
    const modeloInt = Number(item.modeloInterno || 0);
    const temCava = isCava(modeloExt) || isCava(modeloInt);
    const ripado = isRipado(modeloExt) || isRipado(modeloInt);

    // Felipe sessao 13: folgas EDITAVEIS POR ITEM. Default global = 10mm.
    // Override: item.fglDir / item.fglEsq. Vazio = usa global.
    // Mesma logica de calcularQuadro em 38-chapas-porta-externa.js.
    // Nota: aqui mantemos default hardcoded 10 (nao busco do cadastro)
    // pra preservar comportamento atual quando item nao tem override.
    const _toNumFG = (raw, fb) => {
      if (raw === '' || raw === null || raw === undefined) return fb;
      const n = Number(String(raw).replace(',', '.'));
      return (Number.isFinite(n) && n >= 0) ? n : fb;
    };
    const FGLD = _toNumFG(item.fglDir, 10);
    const FGLE = _toNumFG(item.fglEsq, 10);

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

    // 2. ROSETA — 2 unidades por folha (frente + verso de cada folha)
    // Felipe sessao 12: porta 2 folhas precisa de 4 rosetas (2 por folha),
    // antes vinha fixo em 2. Pivo ja e' * nFolhas, fecho unha ja e' 2.
    if (pinos > 0) {
      addMaxPreco('PA-KESO ROS', 2 * nFolhas, 'Fechaduras', 'fab',
        nFolhas === 2 ? '2 por folha · frente+verso' : 'frente + verso');
    }

    // 3. CILINDRO
    // Felipe sessao 12 (refazendo regra perdida):
    //   KESO seguranca + PA006 -> PA-KESOCIL130 BLTD  (sem espaco entre BL e TD)
    //   KESO seguranca + PA007 -> PA-KESOCIL150 BL TD (com espaco entre BL e TD)
    //   UDINESE + PA006        -> PA-CIL UDINE 130 BL
    //   UDINESE + PA007        -> PA-CIL UDINE 150 BL
    // (e130 indica "usar 130mm" - serve pra PA006; PA007 usa 150mm)
    //
    // Felipe sessao 12 (FIX cilindro 150 sempre): pra PORTA EXTERNA o
    // item.sistema e' 'pivotante' ou 'dobradica' (NUNCA 'PA006'/'PA007').
    // PA006 vs PA007 vem da ALTURA (regra do scripts/31-perfis-porta-externa.js
    // linha 269: fam = altura<4000 ? '76' : '101', onde 76=PA006, 101=PA007).
    // Antes: e130 = sis === 'PA006' -> sempre FALSE pra porta -> sempre 150.
    // Agora: detecta PA006 explicito (fixo_acoplado) ou via altura (porta).
    if (pinos > 0) {
      var e130 = ehPA006;
      if (marcaCilindro === 'UDINESE') {
        add(e130 ? 'PA-CIL UDINE 130 BL' : 'PA-CIL UDINE 150 BL', 1, 'Fechaduras', 'fab',
            e130 ? 'Cilindro UDINESE 130mm (PA006)' : 'Cilindro UDINESE 150mm (PA007)');
      } else {
        add(e130 ? 'PA-KESOCIL130 BLTD' : 'PA-KESOCIL150 BL TD', 1, 'Fechaduras', 'fab',
            e130 ? 'Cilindro KESO 130mm Tedee (PA006)' : 'Cilindro KESO 150mm Tedee (PA007)');
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

    // 5. PIVO ou DOBRADICA — depende do sistema da porta
    // Felipe sessao 12: quando sistema='dobradica' (largura<1200), porta NAO
    // leva pivo. Em vez disso leva PA-DOBINOX 3.5X3 PRE:
    //   altura ≤ 2500 → 3 unidades por folha
    //   altura > 2500 → 4 unidades por folha
    if (sis === 'DOBRADICA') {
      const qtdDobByFolha = (H > 0 && H <= 2500) ? 3 : 4;
      const obsAlt = (H > 0 && H <= 2500) ? '(altura ≤ 2500)' : '(altura > 2500)';
      add('PA-DOBINOX 3.5X3 PRE', qtdDobByFolha * nFolhas, 'Dobradiças', 'fab',
          nFolhas === 2
            ? `${qtdDobByFolha} dobradiças/folha × 2 folhas ${obsAlt}`
            : `${qtdDobByFolha} dobradiças ${obsAlt}`);
    } else {
    // Felipe (sessao 2026-05-06): parafusos do pivo vao pra OBRA (não fab)
    add('PA-CHA AA PHS 4,8X50', 12 * nFolhas, 'Parafusos', 'obra', 'pivo');
    add('PA-BUCHA 06',          12 * nFolhas, 'Buchas', 'obra', 'pivo');

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
    } // fim else (pivo)

    // 7. FITA ESCOVINHA Q-LON — depende do sistema
    //    PA006 → ceil(L/1000) × 2 metros
    //    PA007 → ceil(L/1000) × 4 metros
    if (L > 0) {
      const mFita = ehPA006
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
    //    Felipe sessao 14: quando 2 folhas, dobra (cada folha tem o seu perfil
    //    de Q-LON na lateral, entao 2 folhas = 2x os metros).
    if (H > 0) {
      const mQL = Math.ceil((H / 1000) * 2 * nFolhas);
      add('PA-QL 48800', mQL, 'Vedacoes', 'fab', `Flipper Seal H×2×${nFolhas}folha${nFolhas>1?'s':''} = ${mQL}m`);
      add('PA-QL 48700', mQL, 'Vedacoes', 'fab', `H×2×${nFolhas}folha${nFolhas>1?'s':''} = ${mQL}m`);
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

    // 11. EPS CANALETA U — depende de sistema + ripado + folhas
    //     Felipe sessao 14: formula varia por nFolhas.
    //       1 folha:  ceil((H/1000)×4 + (L/1000)×3)
    //       2 folhas: ceil((H/1000)×6 + (L/1000)×3)
    //     PA006 → Mod 05 (cod PA-ISOPOR 115)  | ripado: Mod 07 (PA-ISOPOR 135)
    //     PA007 → Mod 06 (cod PA-ISOPOR 125)  | ripado: Mod 08 (PA-ISOPOR 165)
    if (L > 0 && H > 0) {
      const fatorH = (nFolhas >= 2) ? 6 : 4;
      const mIso = Math.ceil((H / 1000) * fatorH + (L / 1000) * 3);
      let codEps;
      if (ripado) {
        codEps = ehPA006 ? 'PA-ISOPOR 135' : 'PA-ISOPOR 165';
      } else {
        codEps = ehPA006 ? 'PA-ISOPOR 115' : 'PA-ISOPOR 125';
      }
      add(codEps, mIso, 'Embalagem', 'fab', `H×${fatorH} + L×3 = ${mIso}m (${nFolhas}f)`);
    }

    }  // ← fim do if (item.tipo === 'porta_externa') da FABRICACAO

    // ============================================================
    // BORRACHAS DE VIDRO no FIXO ACOPLADO LATERAL (Felipe sessao 13)
    // ============================================================
    // Felipe: 'fixo acoplado lateral com vidro deve adicionar PA-GUA411
    // e PA-GUA413 perimetro L*2 + H*2'. Sao borrachas EPDM (familia
    // borracha) cadastradas em scripts/25-acessorios.js — viram
    // ACESSORIOS aqui, nao perfis de corte.
    //
    // Aplicado SO em: fixo_acoplado + posicao=lateral + revestimento=vidro.
    // Os perfis de aluminio do mesmo caso (PA-PF-104, PA-PF-051) sao
    // tratados em 36-perfis-rev-acoplado.js (gerarCortes), nao aqui.
    if (
      item.tipo === 'fixo_acoplado'
      && String(item.posicao || '').toLowerCase() === 'lateral'
      && String(item.revestimento || '').toLowerCase() === 'vidro'
    ) {
      const fL = Number(item.largura) || 0;
      const fH = Number(item.altura)  || 0;
      const qtdItem = Math.max(1, Number(item.quantidade) || 1);
      if (fL > 0 && fH > 0) {
        // Perimetro em metros por unidade do fixo. Multiplicado pela
        // qtd de fixos do item (qtdPortas no codigo legado).
        const perimM = ((fL * 2) + (fH * 2)) / 1000;
        const totalM = perimM * qtdItem;
        // Felipe sessao 13: 'arredonde pra cima as GUA'. Borrachas EPDM
        // sao vendidas em metros inteiros. 16,70m -> 17m.
        const totalMCeil = Math.ceil(totalM);
        // Adiciona linhas direto (helper add() forca unidade='un',
        // borrachas sao 'm'). Busca preco do cadastro.
        ['PA-GUA411', 'PA-GUA413'].forEach(function(cod) {
          const acess = buscarAcessorio(cadastroAcessorios, cod);
          const precoUn = acess ? (Number(acess.preco) || 0) : 0;
          const desc = acess ? (acess.descricao || '') : '(nao cadastrado)';
          const fam  = acess ? (acess.familia || '')   : '';
          linhas.push({
            codigo: cod,
            descricao: desc,
            familia: fam,
            qtd: totalMCeil,
            unidade: 'm',
            preco_un: precoUn,
            total: precoUn * totalMCeil,
            categoria: 'Vedações',
            aplicacao: 'fab',
            observacao: `Fixo Lateral Vidro: perim ${fL}×${fH}mm × ${qtdItem} = ${totalM.toFixed(2)}m → ${totalMCeil}m (arredondado pra cima)`
              + (acess ? '' : ' · CADASTRAR EM ACESSORIOS'),
          });
        });
      }
    }

    // ============================================================
    // SWITCHGLASS — FONTE DE ACIONAMENTO (Felipe sessao 14)
    // ============================================================
    // Felipe: "QUANDO SELECIONAR VIDRO Switchglass, SEMPRE ADICIONE EM
    // ACESSORIOS FONTE DE ACIONAMENTO PARA Switchglass VALOR 750,00".
    //
    // Aplica em qualquer item com revestimento=Vidro e vidroDescricao
    // contendo 'switchglass' (case-insensitive). 1 fonte por item ×
    // quantidade (qtdPortas). Tenta buscar codigo FONTE-SWITCHGLASS
    // no cadastro; se nao tiver, usa preco padrao 750.
    {
      const vidroDescLower = String(item.vidroDescricao || '').toLowerCase();
      const ehSwitchglass = String(item.revestimento || '').toLowerCase() === 'vidro'
                          && vidroDescLower.indexOf('switchglass') !== -1;
      if (ehSwitchglass) {
        const codFonte = 'FONTE-SWITCHGLASS';
        const acessFonte = buscarAcessorio(cadastroAcessorios, codFonte);
        const precoFonte = acessFonte ? (Number(acessFonte.preco) || 750) : 750;
        const descFonte = (acessFonte && acessFonte.descricao)
          ? acessFonte.descricao
          : 'Fonte de Acionamento Switchglass';
        const famFonte = (acessFonte && acessFonte.familia) ? acessFonte.familia : 'Switchglass';
        linhas.push({
          codigo: codFonte,
          descricao: descFonte,
          familia: famFonte,
          qtd: qtdPortas,
          unidade: 'un',
          preco_un: precoFonte,
          total: precoFonte * qtdPortas,
          categoria: 'Eletrica',
          aplicacao: 'fab',
          observacao: 'Vidro Switchglass requer fonte de acionamento (1 por item)'
            + (acessFonte ? '' : ' · valor padrao R\$ 750 — CADASTRAR EM ACESSORIOS'),
        });
      }
    }

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

      // Felipe sessao 2026-05-10: HighTack FAB separado.
      // 'esse hightack da moldura fica dentro de fabricacao e nao na obra'.
      // Regras FAB que tem campo 'hightack' > 0 acumulam aqui (e nao em
      // mHIGHTACK que e' OBRA). Caso de uso: moldura Mod23 ACM/HPL precisa
      // de HighTack como reforco de colagem - colagem feita na fabrica.
      let mHIGHTACK_fab = 0;  // PA-HIGHTACK BR (fab - reforco de colagem)

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
        // Felipe (sessao 09): todo tampa de furo vai pra HIGHTACK
        // (Excel estava errado sobre PA006 ser Silicone)
        'tampa_furo_pa006',
        'tampa_furo_pa007',
        // Felipe sessao 2026-05-10: 'fixo acoplado superior ou inferior
        // e sempre colado na obra, entao substitua tampas por hightack
        // e esse sim coloque como obra, mas as molduras sao coladas na
        // fabrica'. Felipe confirmou: 'Tampas + Fitas Acabamento
        // Maior/Menor/Largura do fixo (toda a colagem do fixo vai pra
        // obra)'. As 4 regras abaixo sao usadas EXCLUSIVAMENTE no
        // caminho do fixo_acoplado (linhas 850-851/852/853 - automatica
        // + linhas 891-892/893/894 - manual). Mover pra REGRAS_OBRA faz:
        //   - O campo 'ms' (silicone 995) virar HighTack OBRA
        //   - FD19/FD12 contados, mas em mFD19_obra/mFD12_obra (instalador)
        // Porta externa usa 'tampa_generica' e nao tem fita_acab_*_fixo —
        // NAO afetada. Molduras (regra 'moldura', FAB) permanecem FAB.
        'fixo_tampa',
        'fixo_fita_acab_maior',
        'fixo_fita_acab_menor',
        'fixo_fita_acab_largura',
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
        // Felipe sessao 2026-05-10: 'quando tivermos molduras teremos
        // fita dupla face de 19 e um fita de 12 em todo comprimento de
        // cada moldura, pela quantidade'. Modelo 23 (Classica c/ Molduras)
        // gera perfis Boiserie horizontais/verticais com label começando
        // por 'Moldura Horizontal' ou 'Moldura Vertical'. Cada um precisa
        // de 1× FD19 + 1× FD12 no comprimento total (×qty).
        //
        // Felipe sessao 2026-05-10 (iter 2): 'acrescente HighTack em
        // todas as molduras que falamos anteriormente'. Adicionado campo
        // 'hightack' (independente de 'ms') que vai pro acumulador
        // mHIGHTACK sem mover a regra pra REGRAS_OBRA. Isso preserva
        // FD19/FD12 nos acumuladores FAB e adiciona HighTack alem deles.
        'moldura':              { fd19: 1, fd12: 1, ms: 0, cps: 0, hightack: 1, tamanho: 'comprimento' },
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

        // Felipe sessao 2026-05-10: campo 'hightack' adicional na regra
        // (independente de 'ms'). Permite que uma regra consuma HighTack
        // ALEM do silicone 995/HighTack vindo de 'ms'. Caso de uso:
        // moldura (Mod23 ACM/HPL) precisa de FD19+FD12 em FAB (colagem na
        // chapa) E HighTack como reforco/vedacao (Felipe pediu).
        //
        // Fallback pra REGRAS_DEFAULT[idRegra].hightack quando a regra
        // foi editada pelo user via Cadastro > Regras antes desse campo
        // existir - assim ediçoes salvas sem 'hightack' nao perdem o
        // default. (Nullish ??: zero do user ainda zera; so' undefined
        // cai pro default.)
        const rDefault = REGRAS_DEFAULT[idRegra] || {};
        const hightackMult = Number(r.hightack ?? rDefault.hightack) || 0;
        const cHTACK_extra = hightackMult * metros;

        // Felipe sessao 2026-08-03: regras OBRA acumulam em mFD19_obra,
        // mFD12_obra e mHIGHTACK (silicone PA-HIGHTACK BR).
        // FAB (todo o resto) acumula em mFD19, mFD12, mMS (silicone 995).
        const ehObra = REGRAS_OBRA.has(idRegra);
        if (ehObra) {
          mFD19_obra += cFD19;
          mFD12_obra += cFD12;
          mHIGHTACK  += cMS + cHTACK_extra;  // 'ms' (OBRA) + adicional 'hightack'
          // CPS nao se aplica em obra (so' Travessas FAB usam CPS)
        } else {
          mFD19 += cFD19;
          mFD12 += cFD12;
          mMS   += cMS;
          mCPS  += cCPS;
          // Felipe sessao 2026-05-10: cHTACK_extra de regra FAB vai pra
          // mHIGHTACK_fab (NAO mHIGHTACK que e' OBRA). Sera emitido como
          // tubo 'fab' no Lev. Acessorios.
          mHIGHTACK_fab += cHTACK_extra;
        }
        _breakdown.push({
          origem: origem || idRegra,
          regra:  idRegra,
          tipo:   'comprimento',
          metros: metros,
          aplicacao: ehObra ? 'obra' : 'fab',
          mult:   { fd19: r.fd19||0, fd12: r.fd12||0, ms: r.ms||0, cps: r.cps||0, hightack: hightackMult },
          // Felipe (sessao 09 fix): itens OBRA devem mostrar metragem
          // na coluna HIGHTACK, nao na coluna Silicone 995.
          // Felipe sessao 2026-05-10: contribuicao de 'hightack' (campo
          // adicional) tambem entra na coluna HIGHTACK independente
          // de FAB/OBRA.
          contrib: ehObra
            ? { fd19: cFD19, fd12: cFD12, ms: 0,   cps: 0,    hightack: cMS + cHTACK_extra }
            : { fd19: cFD19, fd12: cFD12, ms: cMS, cps: cCPS, hightack: cHTACK_extra       },
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
        // Felipe sessao 12: 'no revestimento parede faca cordoes =
        // round(H / 1000) arredonda pra baixo'. Antes usava round(H/800)
        // (arredondamento normal). Agora floor(H/1000) - cordoes a cada
        // 1000mm de altura, nao arredonda pra cima. Ex: H=3700 -> 3 cordoes
        // (era 5 com round(H/800)). Reduz consumo de silicone.
        const cordoes   = Math.floor(altMm / 1000);
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

        // Felipe sessao 2026-05-10: aplicarRegraFixoFitaDupla agora
        // tambem respeita REGRAS_OBRA + campo 'hightack' (mesma logica
        // de aplicarRegra). Necessario porque Felipe moveu
        // fixo_fita_acab_maior/menor pra OBRA: 'fixo acoplado superior
        // ou inferior e sempre colado na obra [...] toda a colagem do
        // fixo vai pra obra'.
        const rDefault = REGRAS_DEFAULT[idRegra] || {};
        const hightackMult = Number(r.hightack ?? rDefault.hightack) || 0;
        // hightack adicional usa perimetro (mesma medida do ms - faz
        // sentido pra fita acab que e' calculada por perimetro)
        const cHTACK_extra = hightackMult * perimM;

        const ehObra = REGRAS_OBRA.has(idRegra);
        if (ehObra) {
          mFD19_obra += cFD19;
          mFD12_obra += cFD12;
          mHIGHTACK  += cMS + cHTACK_extra;
        } else {
          mFD19 += cFD19;
          mFD12 += cFD12;
          mMS   += cMS;
          mCPS  += cCPS;
          mHIGHTACK_fab += cHTACK_extra;
        }
        _breakdown.push({
          origem: origem || idRegra,
          regra:  idRegra,
          tipo:   'fixo_fita_dupla',
          metros: perimM,
          aplicacao: ehObra ? 'obra' : 'fab',
          dim:    { L: larMm, H: altMm, qtd: qtdPecas, compM: compM, perimM: perimM },
          mult:   { fd19: r.fd19||0, fd12: r.fd12||0, ms: r.ms||0, cps: r.cps||0, hightack: hightackMult },
          contrib: ehObra
            ? { fd19: cFD19, fd12: cFD12, ms: 0,   cps: 0,    hightack: cMS + cHTACK_extra }
            : { fd19: cFD19, fd12: cFD12, ms: cMS, cps: cCPS, hightack: cHTACK_extra       },
        });
      }

      // --- 0) REVESTIMENTO DE PAREDE: pecas do motor ChapasRevParede ---
      // Felipe sessao 2026-08: 'fita dupla face 19 l x 2 + h x 2 medida de
      // cada tampa + silicone L×2 + H×2 + L×(H/800)'.
      // Cada peca do revestimento e' considerada uma "tampa".
      // Felipe sessao 12: 'nao multiplica qtdPortas, isso e um revestido
      // parede nao tem nada haver com portas'. ChapasRevParede.gerarPecasRevParede
      // ja' multiplica p.qtd por item.quantidade internamente (ver
      // 40-chapas-rev-parede.js linha 91), entao usar qtd direto. Nao
      // duplica - rev_parede nao tem conceito de 'qtdPortas'.
      if (item.tipo === 'revestimento_parede') {
        try {
          const pecasRev = (window.ChapasRevParede?.gerarPecasRevParede?.(item)) || [];
          pecasRev.forEach(p => {
            const lar = Number(p.largura) || 0;
            const alt = Number(p.altura)  || 0;
            const qtd = Number(p.qtd)     || 0;
            if (!lar || !alt || !qtd) return;
            // Felipe sessao 18: 'fita dupla face para ripa vai considerar
            // comprimento dos tubos, ai sera 2x fita dupla face de 19
            // e 1x silicone estrutural'.
            //
            // Comprimento dos tubos por ripa (vide motor 37-perfis-rev-
            // parede): 1×2000mm (base) + N×600mm onde N=floor((H-2000)/1200).
            // Edge case H<2000: 1 pedaco unico cortado em H.
            //
            // Chapa de fundo continua na regra revestimento_tampa
            // (perimetro + cordoes internos a cada 1000mm).
            const ehRipa = String(p.id || '').startsWith('rev_parede_ripa');
            if (ehRipa) {
              // Calcula comprimento total dos tubos da ripa
              let compTuboMm = 0;
              if (alt < 2000) {
                compTuboMm = alt;
              } else {
                const N = Math.floor((alt - 2000) / 1200);
                compTuboMm = 2000 + 600 * N;
              }
              const totalCompM = (compTuboMm * qtd) / 1000;
              const cFD19 = 2 * totalCompM;
              const cMS   = 1 * totalCompM;
              mFD19 += cFD19;
              mMS   += cMS;
              _breakdown.push({
                origem: `Revestimento RIPA: ${lar}×${alt}mm × ${qtd}un (tubos ${compTuboMm}mm/ripa)`,
                regra:  'rev_parede_ripa',
                tipo:   'rev_ripa',
                metros: totalCompM,
                dim:    { L: lar, H: alt, qtd, compTuboMm },
                mult:   { fd19: 2, fd12: 0, ms: 1, cps: 0 },
                contrib:{ fd19: cFD19, fd12: 0, ms: cMS, cps: 0 },
              });
              return;
            }
            // Chapa de fundo: regra normal (perimetro + cordoes internos)
            aplicarRegraRevParede('revestimento_tampa', lar, alt, qtd,
              `Revestimento: tampa ${lar}×${alt}mm × ${qtd}un`);
          });
        } catch (e) { console.warn('[FD/MS] erro ao ler pecas revestimento:', e); }
      }

      // --- 0a-pergolado) PERGOLADO: mesma regra de RIPA do rev parede.
      // Felipe sessao 18: pergolado e' so' tubo aparente, sem chapa de
      // fundo. Cada RIPA (tubo) leva:
      //   FD 19mm = 2 × altura × qtdRipas
      //   Silicone = 1 × altura × qtdRipas
      // Itera POR RIPA (nao por chapa) porque o motor de chapas agora
      // gera 2 pecas por ripa (P1 e P2 — Felipe sessao 18). Iterar pelas
      // chapas duplicaria FD/silicone. A regra fisica e' "por tubo".
      if (item.tipo === 'pergolado') {
        try {
          const tubo = window.ChapasPergolado?.getTubo?.(item.tubo);
          const espac = parseFloat(String(item.espacamentoRipas != null ? item.espacamentoRipas : 30).replace(',', '.')) || 30;
          if (tubo) {
            let paredes = Array.isArray(item.paredes)
              ? item.paredes.filter(p => p && (Number(p.largura_total) > 0 || Number(p.altura_total) > 0))
              : [];
            if (paredes.length === 0) {
              paredes = [{
                largura_total: item.largura_total,
                altura_total:  item.altura_total,
                quantidade:    Math.max(1, Number(item.quantidade) || 1),
              }];
            }
            paredes.forEach((p, paredeIdx) => {
              const L = Number(p.largura_total) || 0;
              const H = Number(p.altura_total)  || 0;
              if (!L || !H) return;
              const qtdParede = Math.max(1, Number(p.quantidade) || 1);
              const qtdRipas = window.ChapasPergolado.calcularQtdRipas(L, tubo.menor, espac);
              if (qtdRipas <= 0) return;
              const totalRipas = qtdRipas * qtdParede;
              const totalCompM = (H * totalRipas) / 1000;
              const cFD19 = 2 * totalCompM;
              const cMS   = 1 * totalCompM;
              mFD19 += cFD19;
              mMS   += cMS;
              const sufixoP = paredes.length > 1 ? ` (Parede ${paredeIdx + 1})` : '';
              _breakdown.push({
                origem: `Pergolado: ${totalRipas} ripa(s) × ${H}mm (tubo ${tubo.label})${sufixoP}`,
                regra:  'pergolado_ripa',
                tipo:   'pergolado',
                metros: totalCompM,
                dim:    { L, H, qtdRipas: totalRipas, tubo: tubo.label },
                mult:   { fd19: 2, fd12: 0, ms: 1, cps: 0 },
                contrib:{ fd19: cFD19, fd12: 0, ms: cMS, cps: 0 },
              });
            });
          }
        } catch (e) { console.warn('[FD/MS] erro ao ler pecas pergolado:', e); }
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
            const compM_alt = (alt * qtdTotal) / 1000;

            // Felipe sessao 18: Fixo Lateral LISA - Fita Acabamento.
            // Felipe: 'vai fita dupla face e high tack no comprimento da
            // peca [...] high tack e dupla face em acessorios, ja tem
            // uma logica la veja'.
            // Reusa regra 'fita_acab_largura' (porta) que ja existe e
            // ja' tem o padrao pedido:
            //   fd19: 1  (1× Fita Dupla Face 19mm)
            //   ms:   1  (vira PA-HIGHTACK BR pois 'fita_acab_largura'
            //             esta em REGRAS_OBRA - vai pra obra)
            //   tamanho: 'comprimento' (multiplica pela altura, nao perimetro)
            // Match precisa vir ANTES dos === pq label tem sufixo
            // ' - fixo lateral'. Tampa Maior - fixo lateral cai
            // automaticamente em fixo_tampa via startsWith('tampa') logo
            // abaixo, ja' com 1×FDF + 1×HT (no perimetro).
            if (lblLow === 'fita acabamento - fixo lateral')
              return aplicarRegra('fita_acab_largura', compM_alt,
                `Fixo Lateral Lisa: ${p.label} ${alt}mm × ${qtdTotal}un (${compM_alt.toFixed(2)}m)`);

            if (lblLow === 'fita acabamento maior')   return aplicarRegraFixoFitaDupla('fixo_fita_acab_maior', lar, alt, qtdTotal,   `Fixo: ${p.label} ${lar}×${alt}mm`);
            if (lblLow === 'fita acabamento menor')   return aplicarRegraFixoFitaDupla('fixo_fita_acab_menor', lar, alt, qtdTotal,   `Fixo: ${p.label} ${lar}×${alt}mm`);
            if (lblLow === 'fita acabamento largura') return aplicarRegra('fixo_fita_acab_largura', perimM,                          `Fixo: ${p.label} ${lar}×${alt}mm (perim ${perimM.toFixed(2)}m)`);
            if (lblLow.startsWith('tampa'))           return aplicarRegra('fixo_tampa', perimM,                                       `Fixo: ${p.label} ${lar}×${alt}mm (perim ${perimM.toFixed(2)}m)`);
          });
        } catch (e) { console.warn('[FD/MS] erro ao ler pecas fixo:', e); }

        // Felipe sessao 2026-05-10: PECAS MANUAIS do fixo (adicionadas
        // via linha "+ inline" no Lev. Superficies pelo usuario) tambem
        // precisam entrar no calculo de FD/Silicone. ANTES: passavam
        // direto pelo aproveitamento de chapas (12-orcamento.js) mas
        // eram ignoradas aqui no consumo de fitas.
        //
        // Sintoma reportado: 'nao calculou fita do fixo moldura vertical
        // e horizontal fixo superior'. Felipe adicionou molduras como
        // pecas manuais no Item 2 (fixo superior) mas saiam sem fita
        // no Lev. Acessorios.
        //
        // Schema da peca manual (12-orcamento.js linha 10702-10706):
        //   {label, categoria, largura, altura, qtd, cor, podeRotacionar}
        //
        // Aplicamos mesmos handlers do bloco automatico ACIMA + extra
        // pra 'moldura' (regex /^moldura\b/ que cobre 'Moldura X - ...').
        try {
          const manuaisFixo = (item.pecasManuaisExtras) || [];
          manuaisFixo.forEach(p => {
            const lar = Number(p.largura) || 0;
            const alt = Number(p.altura)  || 0;
            const qtd = Number(p.qtd)     || 0;
            if (!lar || !alt || !qtd) return;
            const lblLow = String(p.label || '').toLowerCase().trim();
            const qtdTotal = qtd * qtdPortas;
            const compM  = (alt * qtdTotal) / 1000;
            const perimM = ((lar + alt) * 2 * qtdTotal) / 1000;

            // MOLDURA (Felipe sessao 2026-05-10): caso reportado.
            // Mesma regra do bloco porta_externa (linha 870) - 1×FD19
            // + 1×FD12 no COMPRIMENTO total. Cobre 'Moldura Horizontal',
            // 'Moldura Vertical', 'Moldura 2 - Horizontal X - ...' etc.
            if (/^moldura\b/.test(lblLow))            return aplicarRegra('moldura', compM,        `Fixo MANUAL: ${p.label} ${lar}×${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
            // Fita Acabamento Maior/Menor/Largura: mesmas regras do bloco automatico
            if (lblLow === 'fita acabamento maior')   return aplicarRegraFixoFitaDupla('fixo_fita_acab_maior', lar, alt, qtdTotal, `Fixo MANUAL: ${p.label} ${lar}×${alt}mm`);
            if (lblLow === 'fita acabamento menor')   return aplicarRegraFixoFitaDupla('fixo_fita_acab_menor', lar, alt, qtdTotal, `Fixo MANUAL: ${p.label} ${lar}×${alt}mm`);
            if (lblLow === 'fita acabamento largura') return aplicarRegra('fixo_fita_acab_largura', perimM,                       `Fixo MANUAL: ${p.label} ${lar}×${alt}mm (perim ${perimM.toFixed(2)}m)`);
            // Tampa (qualquer): aplica fixo_tampa por perimetro
            if (lblLow.startsWith('tampa'))           return aplicarRegra('fixo_tampa', perimM,                                  `Fixo MANUAL: ${p.label} ${lar}×${alt}mm (perim ${perimM.toFixed(2)}m)`);
            // Outros labels (custom do user): NAO casa em nenhuma regra
            // -> nao consome fita (correto - user adicionou peca generica
            // sem identificacao tipica).
          });
        } catch (e) { console.warn('[FD/MS] erro ao ler pecas manuais fixo:', e); }
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
            if (lblLow === 'tampa de furo')        return aplicarRegra(ehPA006 ? 'tampa_furo_pa006' : 'tampa_furo_pa007', compM, `${p.label||'Tampa Furo'} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
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
            // Felipe sessao 2026-05-10: 'quando tivermos molduras
            // teremos fita dupla face de 19 e um fita de 12 em todo
            // comprimento de cada moldura, pela quantidade'.
            //
            // IMPORTANTE: este handler so' executa pra Mod23+ACM/HPL
            // (caminho do motor 38-chapas-porta-externa.js que gera
            // molduras como CHAPAS - linhas 281-345). Pra Mod23+AM
            // as molduras viram PERFIS Boiserie em
            // 31-perfis-porta-externa.js e NAO sao processadas aqui
            // (nem precisam de fita - aparafusadas, nao coladas).
            //
            // Felipe: 'somente iremos adicionar essas fitas dupla face
            // quando as molduras estiverem nas chapas de acm'.
            //
            // 1×FD19 + 1×FD12 no comprimento total da moldura
            // (compM = alt × qtd × qtdPortas / 1000).
            // Cobre todas as variantes:
            //   'Moldura Horizontal 1/2/3'
            //   'Moldura Vertical 1/2'
            //   futuro 'Moldura ...' com qtdMolduras=2 ou 3
            // O lblLow ja' esta lowercase, regex usa essa forma.
            if (/^moldura\b/.test(lblLow))            return aplicarRegra('moldura',           compM, `${p.label} ${alt}mm × ${qtd}un (${compM.toFixed(2)}m)`);
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
              // Felipe sessao 2026-05-10: NAO adicionar regra de fita
              // pra Moldura aqui (seção de PERFIS) porque este caminho
              // so' executa pra Mod23+AM (perfis Boiserie de aluminio,
              // gerados em 31-perfis-porta-externa.js linha 439+).
              // Boiserie e' aparafusado/encaixado, NAO colado - nao
              // precisa de fita.
              //
              // A regra de fita pra moldura esta na secao de PEÇAS DE
              // CHAPA acima (linha ~872), que so' executa pra Mod23+ACM/HPL
              // (motor 38-chapas-porta-externa.js linha 281+ gera as
              // molduras como chapas naqueles casos).
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

      // Felipe sessao 12: pra REVESTIMENTO_PAREDE, fita+silicone vao pra OBRA.
      // Silicone usa PA-HIGHTACK BR (nao DOWSIL 995). Plus +1 PRIMER global.
      // Felipe: 'parede leva primer, fita dupla face 19, e high tack'.
      const ehRevParede = item.tipo === 'revestimento_parede';

      // Felipe sessao 12 (rev_parede consolidado): 'revestimento de parede
      // pode juntar todos o que tiverem somente em um calculo, pois da muita
      // perca as vezes um item da 10 mts mas rolo de fita tem 20, entao some
      // tudo e um unico item revestimento de parede junte tudo em um so para
      // obter rolo de fita e de hightack'.
      // Pra rev_parede, NAO emite linhas FD19/HIGHTACK/PRIMER no item. Apenas
      // ARMAZENA metros no cache pra o caller (renderLevAcessoriosTab) ler
      // depois e gerar UM bloco consolidado no fim, somando os metros de
      // TODOS os rev_parede e calculando rolos/tubos uma vez. Reduz arred-
      // ondamento e perda de material.
      // Felipe sessao 18: 'esse problema esta no fixo acoplado lateral,
      // pois ele busca quantidade de tudo nas chapas, entao por mais
      // que tenha 2 fixos, nao multiplica por 2, ele pega tudo pela
      // quantidade de chapas e metros lineares no planificador de
      // chapas'.
      //
      // BUG: pra fixo_acoplado, os consumos mFD19/mFD12/mMS/mHIGHTACK
      // /mCPS ja' acumulam TODAS as pecas com qtdTotal = qtd × qtdPortas
      // (linha 876). Multiplicar de novo no add seria dupla contagem.
      // Sintoma reportado: 37.4m de HT (com rendimento 18m) deveria
      // dar 3 tubos (ceil(37.4/18)=3) mas saia 6 = 3×qtdPortas(2).
      // FD19 mesmo: 37.4m deveria dar 2 rolos, saia 4.
      //
      // FIX: addAbsoluto bypass o ×qtdPortas do add APENAS pro
      // fixo_acoplado. Pra porta_externa/revestimento_parede mantem
      // comportamento legado (add multiplica). As 8 conversoes finais
      // (FD19/FD12/MS/HIGHTACK/HIGHTACK_fab/HIGHTACK_obra/FD19_obra
      // /FD12_obra/CPS) usam addAbsoluto.
      const ehFixoAcoplado = item.tipo === 'fixo_acoplado';
      function addAbsoluto(codigo, qtdAbs, categoria, aplicacao, observacao) {
        if (!ehFixoAcoplado) {
          // Item nao-fixo: comportamento legado (add multiplica por qtdPortas)
          return add(codigo, qtdAbs, categoria, aplicacao, observacao);
        }
        // Fixo acoplado: qtdAbs ja' eh total absoluto, nao multiplica
        if (!codigo) return;
        const acess = buscarAcessorio(cadastroAcessorios, codigo);
        if (!acess) {
          linhas.push({
            codigo, descricao: '(nao cadastrado)', familia: '',
            qtd: qtdAbs, unidade: 'un', preco_un: 0, total: 0,
            categoria, aplicacao,
            observacao: (observacao || '') + ' · CADASTRAR EM ACESSORIOS',
          });
          return;
        }
        const precoUn = Number(acess.preco) || 0;
        linhas.push({
          codigo:    acess.codigo,
          descricao: acess.descricao || '',
          familia:   acess.familia || '',
          qtd:       qtdAbs,
          unidade:   'un',
          preco_un:  precoUn,
          total:     precoUn * qtdAbs,
          categoria, aplicacao,
          observacao: observacao || '',
        });
      }

      if (!ehRevParede) {
        if (mFD19 > 0) {
          const rolos = Math.ceil(mFD19 / FD19_POR_ROLO);
          addAbsoluto('PA-FITDF 19X20X1.0', rolos, 'Fita Dupla Face', 'fab',
              `${mFD19.toFixed(1)}m / ${FD19_POR_ROLO}m por rolo = ${rolos} rolo(s)`);
        }
        if (mFD12 > 0) {
          const rolos = Math.ceil(mFD12 / FD12_POR_ROLO);
          addAbsoluto('PA-FITDF 12X20X1.0', rolos, 'Fita Dupla Face', 'fab',
              `${mFD12.toFixed(1)}m / ${FD12_POR_ROLO}m por rolo = ${rolos} rolo(s)`);
        }
        if (mMS > 0) {
          const tubos = Math.ceil(mMS / MS_POR_TUBO);
          addAbsoluto('PA-DOWSIL 995', tubos, 'Selantes', 'fab',
              `${mMS.toFixed(1)}m / ${MS_POR_TUBO}m por tubo = ${tubos} tubo(s)`);
        }
      }
      // Para rev_parede: skip de propose. Cache abaixo guarda mFD19/mMS - o
      // caller le e consolida via window._fitaSiliconeBreakdownCache filtrado
      // por itemTipo='revestimento_parede'.

      // Felipe sessao 2026-05-10: HighTack FAB (reforco de colagem em
      // pecas que ficam na fabrica - ex: molduras Mod23 ACM coladas
      // na chapa). Pedido Felipe: 'esse hightack da moldura fica dentro
      // de fabricacao e nao na obra'. Aplicacao 'fab' = categoria FAB
      // (mesmo bloco da Fabricacao no Lev. Acessorios).
      if (mHIGHTACK_fab > 0) {
        const tubos = Math.ceil(mHIGHTACK_fab / HIGHTACK_POR_TUBO);
        addAbsoluto('PA-HIGHTACK BR', tubos, 'Selantes', 'fab',
            `${mHIGHTACK_fab.toFixed(1)}m / ${HIGHTACK_POR_TUBO}m por tubo = ${tubos} tubo(s) (fab)`);
      }

      // Felipe sessao 2026-08-03: linhas OBRA - silicone PA-HIGHTACK BR
      // (Fix All High Tack Branco) e fita dupla face vinda de Alisar/Fita Acab.
      // Aplicacao 'obra' = vai com instalador na obra (categoria diferente
      // de FAB que fica na fabrica).
      if (mFD19_obra > 0) {
        const rolos = Math.ceil(mFD19_obra / FD19_POR_ROLO);
        addAbsoluto('PA-FITDF 19X20X1.0', rolos, 'Fita Dupla Face', 'obra',
            `${mFD19_obra.toFixed(1)}m / ${FD19_POR_ROLO}m por rolo = ${rolos} rolo(s) (obra)`);
      }
      if (mFD12_obra > 0) {
        const rolos = Math.ceil(mFD12_obra / FD12_POR_ROLO);
        addAbsoluto('PA-FITDF 12X20X1.0', rolos, 'Fita Dupla Face', 'obra',
            `${mFD12_obra.toFixed(1)}m / ${FD12_POR_ROLO}m por rolo = ${rolos} rolo(s) (obra)`);
      }
      if (mHIGHTACK > 0) {
        const tubos = Math.ceil(mHIGHTACK / HIGHTACK_POR_TUBO);
        addAbsoluto('PA-HIGHTACK BR', tubos, 'Selantes', 'obra',
            `${mHIGHTACK.toFixed(1)}m / ${HIGHTACK_POR_TUBO}m por tubo = ${tubos} tubo(s) (obra)`);
      }
      // Felipe sessao 2026-08: PA-DOWSIL CPS BR (sache 591ml). So' aparece
      // nas Travessas. Mesmo rendimento do silicone estrutural (MS_POR_TUBO,
      // Felipe: 'mesmo do 995, pegue do cadastro logica').
      if (mCPS > 0) {
        const sachesCPS = Math.ceil(mCPS / MS_POR_TUBO);
        addAbsoluto('PA-DOWSIL CPS BR', sachesCPS, 'Selantes', 'fab',
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
            // Felipe sessao 2026-05-10: HighTack FAB separado
            mHIGHTACK_fab: mHIGHTACK_fab,
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
          // Felipe sessao 2026-05-10: tubos HighTack FAB separado
          tubosHIGHTACK_fab: mHIGHTACK_fab > 0 ? Math.ceil(mHIGHTACK_fab / HIGHTACK_POR_TUBO) : 0,
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
    //
    // Felipe sessao 12: 'item 4 como porta extena e veda porta, todos
    // estao como porta e trazendo veda porta, isso e uma chapa colada
    // a parede'. VEDA PORTA e' especifico de PORTA EXTERNA - a sequencia
    // de tamanhos (820/920/1020...) e' do perfil da porta. Rev_parede
    // (chapa colada na parede) e fixo_acoplado nao tem veda porta.
    if (L > 0 && item.tipo === 'porta_externa') {
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
    // Felipe sessao 12: 'FECHO UNHA FICA EM FABRICACAO'. Antes 'obra'
    // (instalacao), agora 'fab' (fabricacao na producao).
    if (nFolhas === 2) {
      if (H > 4000) {
        add('PA-FECHUNHA', 1, 'Fecho Unha', 'fab', 'H > 4000mm');
        add('PA-PUSHGO',   1, 'Fecho Unha', 'fab', 'H > 4000mm');
      } else {
        add('PA-FECHUNHA', 2, 'Fecho Unha', 'fab', 'H ≤ 4000mm');
      }
    }

    // 15. PORTAL — Bucha + Parafuso (sempre)
    if (H > 0) {
      const qtyBucha8 = Math.ceil(H / 300) * 2;  // × 2 lados
      // Felipe (sessao 2026-05-06): categoria e' Parafusos, nao Portal
      add('PA-BUCHA 08',      qtyBucha8, 'Buchas', 'obra', `ceil(H/300) × 2 lados`);
      add('PA-PAR SOB M6X65', qtyBucha8, 'Parafusos', 'obra', `ceil(H/300) × 2 lados`);
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
