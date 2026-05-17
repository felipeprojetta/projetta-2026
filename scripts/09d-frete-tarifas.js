/**
 * scripts/09d-frete-tarifas.js — Felipe sessao 31
 *
 * Modulo central de TARIFAS DE FRETE INTERNACIONAL.
 *
 * Felipe sessao 31:
 *   'frete deve detalhar todas as taxas nao coloque tudo junto em
 *    uma unica taxa, pesquise tbm em apis, e empresas de frete quais
 *    taxas sao fixas e quais sao variaveis'.
 *   'deixei valores fixos sempre fixos (mais eu podendo editar) e o
 *    que for variaveis deixamos variavel, poderiamos ter o preco po m³
 *    do frete em si do container por regiao, america sul, norte,
 *    central, europa, africa, asia, oriente medio etc'.
 *   'caixa mantenha 100 dolares por m3'.
 *
 * Estrutura baseada em:
 *  - 4 cotacoes reais TPLProvider (Cumberland AU, Jorge PR, Peter US, A&A US)
 *  - 3 notas de debito reais TPLProvider (mesmo cenarios cobrados)
 *  - APIs/empresas: Freightos, iContainers, ExFreight, TIBA, Suaid Global
 *
 * Padrao da industria LCL: 4 grupos
 *   1. ORIGEM fixos (USD por embarque)
 *   2. ORIGEM variaveis (USD por m³)
 *   3. OCEAN FREIGHT (USD por m³ por regiao)
 *   4. CONDICIONAIS (DAP, overlength, overweight, AMS, etc.)
 *
 * TUDO EDITAVEL pelo Felipe via UI de Config (proximo commit).
 * Storage scope 'frete' no kv_store. Cache em memoria.
 */

const FreteTarifas = (() => {

  const STORAGE_SCOPE = 'frete';
  const STORAGE_KEY = 'tarifas';

  /**
   * TARIFAS PADRAO — baseadas em medias das 4 cotacoes TPLProvider 2025-2026.
   * Felipe pode sobrescrever qualquer valor via UI.
   *
   * EDITAVEL: tudo. Valores aqui sao SOMENTE FALLBACK quando o kv_store nao
   * tem nada gravado.
   */
  const DEFAULTS = {
    moeda: 'USD',
    versao: '2026-05-17',

    // -------------------------------------------------------------
    // 1. ORIGEM — fixos por embarque (USD/B/L ou USD/processo)
    // -------------------------------------------------------------
    origem_fixos: {
      origin_equipment_surcharge: { valor: 56,  label: 'Origin Equipment Surcharge', unidade: 'embarque' },
      bl_fee:                     { valor: 50,  label: 'B/L Fee',                    unidade: 'B/L' },
      verified_gross_mass:        { valor: 30,  label: 'Verified Gross Mass (VGM)',  unidade: 'embarque' },
      handling:                   { valor: 80,  label: 'Handling',                   unidade: 'embarque' },
      customs_clearance:          { valor: 110, label: 'Customs Clearance (origem)', unidade: 'embarque' },
    },

    // -------------------------------------------------------------
    // 2. ORIGEM — variaveis por m³ (USD/m³ ou USD/ton-or-m3 W/M)
    // -------------------------------------------------------------
    origem_variaveis: {
      thc_origin:    { valor: 14, label: 'Terminal Handling Charge (THC)', unidade: 'm³' },
      loading_fee:   { valor: 14, label: 'Loading Fee (TEC)',              unidade: 'm³' },
      xray_scanner:  { valor: 35, label: 'X-Ray / Scanner',                unidade: 'm³' },
    },

    // -------------------------------------------------------------
    // 3. OCEAN FREIGHT — base por m³ POR REGIAO (USD/m³)
    // Baseado nas 4 cotacoes reais TPLProvider + indices Freightos 2026.
    // Felipe edita conforme rota.
    // -------------------------------------------------------------
    ocean_freight_por_regiao: {
      america_sul:        { valor:  90, label: 'America do Sul',         exemplos: 'Buenos Aires, Montevideo, Lima' },
      america_central:    { valor: 175, label: 'America Central/Caribe', exemplos: 'Panama, Costa Rica, R. Dominicana' },
      america_norte_eua:  { valor: 140, label: 'America do Norte (EUA)', exemplos: 'Houston, NY, LA, Miami' },
      america_norte_can:  { valor: 160, label: 'America do Norte (CA)',  exemplos: 'Montreal, Toronto, Vancouver' },
      america_norte_mex:  { valor: 130, label: 'America do Norte (MX)',  exemplos: 'Veracruz, Manzanillo' },
      caribe:             { valor: 201, label: 'Caribe',                 exemplos: 'San Juan PR, Kingston, Bridgetown' },
      europa_ocidental:   { valor: 110, label: 'Europa Ocidental',       exemplos: 'Rotterdam, Hamburg, Le Havre' },
      europa_oriental:    { valor: 150, label: 'Europa Oriental',        exemplos: 'Gdansk, Constanta' },
      mediterraneo:       { valor: 130, label: 'Mediterraneo',           exemplos: 'Barcelona, Genova, Pireus' },
      reino_unido:        { valor: 120, label: 'Reino Unido/Irlanda',    exemplos: 'Felixstowe, Southampton, Dublin' },
      africa_norte:       { valor: 150, label: 'Africa do Norte',        exemplos: 'Casablanca, Alexandria' },
      africa_subsaariana: { valor: 200, label: 'Africa Subsaariana',     exemplos: 'Lagos, Mombasa, Durban' },
      africa_do_sul:      { valor: 180, label: 'Africa do Sul',          exemplos: 'Cape Town, Durban' },
      oriente_medio:      { valor: 160, label: 'Oriente Medio',          exemplos: 'Dubai, Jeddah, Doha' },
      asia_leste:         { valor: 180, label: 'Asia (Leste)',           exemplos: 'Shanghai, Hong Kong, Tokyo, Busan' },
      sudeste_asiatico:   { valor: 170, label: 'Sudeste Asiatico',       exemplos: 'Singapura, Bangkok, Ho Chi Minh' },
      asia_sul:           { valor: 175, label: 'Asia do Sul',            exemplos: 'Mumbai, Chennai, Karachi' },
      oceania:            { valor: 170, label: 'Oceania',                exemplos: 'Sydney, Melbourne, Auckland' },
    },

    // -------------------------------------------------------------
    // 4. SURCHARGES CONDICIONAIS (USD, aplicados conforme regra)
    // -------------------------------------------------------------
    condicionais: {
      ams_filing:        { valor: 50,   label: 'AMS Filing (Advance Manifest)',  aplica: 'EUA',      unidade: 'B/L' },
      ens_filing:        { valor: 50,   label: 'ENS Filing (Europe)',            aplica: 'Europa',   unidade: 'B/L' },
      cdd_filing:        { valor: 50,   label: 'CDD Filing (Europe)',            aplica: 'Europa',   unidade: 'B/L' },
      isps:              { valor: 10,   label: 'ISPS (Security)',                aplica: 'sempre',   unidade: 'B/L' },
      bunker_adjustment: { valor: 0,    label: 'BAF (Bunker Adjustment Factor)', aplica: 'opcional', unidade: 'embarque' },
      overlength:        { valor: 350,  label: 'Overlength (caixa > 5m)',        aplica: 'compr>5m', unidade: 'embarque' },
      overweight:        { valor: 350,  label: 'Overweight Surcharge',           aplica: 'manual',   unidade: 'embarque' },
      dap_charges:       { valor: 1450, label: 'DAP Charges (Liftgate + Pallet jack + Inside delivery)', aplica: 'incoterm=DAP', unidade: 'embarque' },
      war_risk:          { valor: 0,    label: 'War Risk Surcharge',             aplica: 'manual',   unidade: 'embarque' },
      peak_season:       { valor: 0,    label: 'PSS (Peak Season Surcharge)',    aplica: 'manual',   unidade: 'embarque' },
    },

    // -------------------------------------------------------------
    // 5. SEGURO MARITIMO (% sobre valor da carga)
    // Para incoterms CIF / CIP / DAP / DPU / DDP
    // -------------------------------------------------------------
    seguro: {
      percentual:  0.5,                          // 0.5% do valor da carga
      cobertura:   1.10,                         // ICC clause A: 110% (CIP/DAP+) ou ICC clause C: 110% (CIF)
      minimo_usd:  35,                           // valor minimo da apolice
      label:       'Seguro Maritimo (% sobre valor × 1.10)',
    },

    // -------------------------------------------------------------
    // 6. CAIXA DE MADEIRA FUMIGADA (USD/m³)
    // -------------------------------------------------------------
    caixa_fumigada: {
      preco_usd_m3:     100,
      label:            'Caixa de Madeira Fumigada (ISPM-15)',
      media_real_obs:   49,    // media ponderada das 4 caixas reais Starmil
      observacao:       'Preco de cotacao 100 USD/m³ (com margem). Media real observada nas 4 ultimas: ~USD 49/m³.',
    },

    // -------------------------------------------------------------
    // 7. FRETE TERRESTRE (Uberlandia -> Santos)
    // -------------------------------------------------------------
    frete_terrestre: {
      uberlandia_santos_usd: 1800,
      label: 'Frete Terrestre Uberlandia → Santos',
      observacao: 'Caminhao com a caixa fumigada de Uberlandia ao Porto de Santos.',
    },
  };

  // Cache em memoria das tarifas atuais (defaults + overrides do storage)
  let _cache = null;

  /**
   * Carrega tarifas do kv_store (scope 'frete', key 'tarifas') e mescla
   * com defaults. Valores no storage tem prioridade.
   */
  async function carregar() {
    if (_cache) return _cache;
    let saved = null;
    try {
      if (window.store && typeof window.store.get === 'function') {
        saved = await window.store.get(STORAGE_SCOPE, STORAGE_KEY);
      }
    } catch (e) { /* sem store ainda, usa defaults */ }
    _cache = mesclar(DEFAULTS, saved);
    return _cache;
  }

  /**
   * Salva tarifas modificadas no kv_store. Mescla com DEFAULTS pra
   * preservar campos que Felipe nao alterou.
   */
  async function salvar(tarifas) {
    _cache = mesclar(DEFAULTS, tarifas);
    if (window.store && typeof window.store.set === 'function') {
      await window.store.set(STORAGE_SCOPE, STORAGE_KEY, _cache);
    }
    // Avisa o resto do sistema
    try {
      document.dispatchEvent(new CustomEvent('frete:tarifas:change', { detail: _cache }));
    } catch (e) { /* node env */ }
    return _cache;
  }

  function mesclar(base, overrides) {
    if (!overrides || typeof overrides !== 'object') return JSON.parse(JSON.stringify(base));
    const r = JSON.parse(JSON.stringify(base));
    Object.keys(overrides).forEach(k => {
      if (overrides[k] && typeof overrides[k] === 'object' && !Array.isArray(overrides[k])) {
        r[k] = mesclar(r[k] || {}, overrides[k]);
      } else {
        r[k] = overrides[k];
      }
    });
    return r;
  }

  function defaults() { return JSON.parse(JSON.stringify(DEFAULTS)); }
  function regioes()  { return Object.keys(DEFAULTS.ocean_freight_por_regiao); }

  /**
   * Calcula frete LCL detalhado, retornando TODAS as taxas separadas.
   * Felipe pediu: 'detalhe todas as taxas nao coloque tudo junto'.
   *
   * Entradas:
   *   m3          - volume CBM da caixa
   *   regiao      - chave de ocean_freight_por_regiao (ex: 'oceania')
   *   opcoes      - { incoterm, comprimentoMm, pesoKg, eua, ue, dap, ... }
   *
   * Saida (objeto detalhado):
   *   {
   *     itens: [{ codigo, label, unidade, qtd, valorUnitUsd, totalUsd }],
   *     totalOrigemFixos, totalOrigemVariaveis,
   *     totalOceanFreight, totalCondicionais,
   *     totalGeralUsd,
   *     resumoPorGrupo: { origem_fixos, origem_variaveis, ocean, condicionais }
   *   }
   */
  function calcularLCL(m3, regiao, opcoes) {
    opcoes = opcoes || {};
    const t = _cache || DEFAULTS;
    const cbm = Math.max(0, Number(m3) || 0);
    const itens = [];

    // (1) Ocean Freight base por regiao
    const reg = t.ocean_freight_por_regiao[regiao] || t.ocean_freight_por_regiao.america_norte_eua;
    if (reg) {
      itens.push({
        codigo: 'ocean_freight',
        grupo: 'ocean',
        label: 'Ocean Freight LCL (' + (reg.label || regiao) + ')',
        unidade: 'USD/m³',
        qtd: cbm,
        valorUnitUsd: reg.valor,
        totalUsd: cbm * reg.valor,
      });
    }

    // (2) Origem variaveis por m³
    Object.keys(t.origem_variaveis || {}).forEach(k => {
      const it = t.origem_variaveis[k];
      itens.push({
        codigo: k, grupo: 'origem_variaveis',
        label: it.label, unidade: 'USD/' + it.unidade,
        qtd: cbm, valorUnitUsd: it.valor,
        totalUsd: cbm * it.valor,
      });
    });

    // (3) Origem fixos por embarque
    Object.keys(t.origem_fixos || {}).forEach(k => {
      const it = t.origem_fixos[k];
      itens.push({
        codigo: k, grupo: 'origem_fixos',
        label: it.label, unidade: 'USD/' + it.unidade,
        qtd: 1, valorUnitUsd: it.valor,
        totalUsd: it.valor,
      });
    });

    // (4) Condicionais conforme opcoes
    const cond = t.condicionais || {};
    if (opcoes.eua && cond.ams_filing) {
      itens.push({
        codigo: 'ams_filing', grupo: 'condicionais',
        label: cond.ams_filing.label, unidade: 'USD/B/L',
        qtd: 1, valorUnitUsd: cond.ams_filing.valor,
        totalUsd: cond.ams_filing.valor,
      });
    }
    if (opcoes.ue && cond.ens_filing) {
      itens.push({
        codigo: 'ens_filing', grupo: 'condicionais',
        label: cond.ens_filing.label, unidade: 'USD/B/L',
        qtd: 1, valorUnitUsd: cond.ens_filing.valor,
        totalUsd: cond.ens_filing.valor,
      });
    }
    if (cond.isps && cond.isps.valor > 0) {
      itens.push({
        codigo: 'isps', grupo: 'condicionais',
        label: cond.isps.label, unidade: 'USD/B/L',
        qtd: 1, valorUnitUsd: cond.isps.valor,
        totalUsd: cond.isps.valor,
      });
    }
    if (opcoes.comprimentoMm && Number(opcoes.comprimentoMm) > 5000 && cond.overlength) {
      itens.push({
        codigo: 'overlength', grupo: 'condicionais',
        label: cond.overlength.label, unidade: 'USD/embarque',
        qtd: 1, valorUnitUsd: cond.overlength.valor,
        totalUsd: cond.overlength.valor,
      });
    }
    if (opcoes.overweight && cond.overweight) {
      itens.push({
        codigo: 'overweight', grupo: 'condicionais',
        label: cond.overweight.label, unidade: 'USD/embarque',
        qtd: 1, valorUnitUsd: cond.overweight.valor,
        totalUsd: cond.overweight.valor,
      });
    }
    if ((opcoes.incoterm === 'DAP' || opcoes.dap) && cond.dap_charges) {
      itens.push({
        codigo: 'dap_charges', grupo: 'condicionais',
        label: cond.dap_charges.label, unidade: 'USD/embarque',
        qtd: 1, valorUnitUsd: cond.dap_charges.valor,
        totalUsd: cond.dap_charges.valor,
      });
    }

    // Resumo por grupo
    const resumo = { ocean: 0, origem_variaveis: 0, origem_fixos: 0, condicionais: 0 };
    itens.forEach(it => { resumo[it.grupo] = (resumo[it.grupo] || 0) + it.totalUsd; });
    const totalGeralUsd = itens.reduce((s, it) => s + it.totalUsd, 0);

    return {
      itens,
      totalOrigemFixos:     resumo.origem_fixos,
      totalOrigemVariaveis: resumo.origem_variaveis,
      totalOceanFreight:    resumo.ocean,
      totalCondicionais:    resumo.condicionais,
      totalGeralUsd,
      resumoPorGrupo:       resumo,
    };
  }

  /**
   * Calcula custo da caixa de madeira fumigada (USD).
   * Felipe: '100 dolares por m3'.
   */
  function calcularCaixa(m3) {
    const t = _cache || DEFAULTS;
    const cbm = Math.max(0, Number(m3) || 0);
    const preco = (t.caixa_fumigada && t.caixa_fumigada.preco_usd_m3) || 100;
    return cbm * preco;
  }

  /**
   * Frete terrestre Uberlandia -> Santos (USD).
   */
  function calcularFreteTerrestre() {
    const t = _cache || DEFAULTS;
    return (t.frete_terrestre && t.frete_terrestre.uberlandia_santos_usd) || 1800;
  }

  // Carrega de imediato em browser (assincrono, mas defaults ficam disponiveis)
  if (typeof window !== 'undefined') {
    carregar().catch(() => { /* ja tem fallback _cache=DEFAULTS na proxima leitura */ });
  } else {
    _cache = JSON.parse(JSON.stringify(DEFAULTS)); // node env
  }

  return {
    DEFAULTS,
    carregar, salvar, defaults, regioes,
    calcularLCL, calcularCaixa, calcularFreteTerrestre,
    _getCache: () => _cache || DEFAULTS,
  };
})();

if (typeof window !== 'undefined') window.FreteTarifas = FreteTarifas;
