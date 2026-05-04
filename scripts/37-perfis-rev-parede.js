/* 37-perfis-rev-parede.js — Regras de calculo de perfis do
   REVESTIMENTO DE PAREDE (com estrutura).

   ESTE MODULO E' EXCLUSIVO DO REVESTIMENTO DE PAREDE.

   Regras (Felipe sessao 2026-05):
     1. Form pergunta "Tem estrutura?" sim/nao
        - sem estrutura: nao gera perfis (so chapas)
        - com estrutura: escolhe 1 dos 6 tubos abaixo
     2. Tubos disponiveis (precisam estar cadastrados):
          PA-25X12X1.58, PA-51X12X1.2, PA-51X12X1.58,
          PA-51X25X1.5, PA-51X25X2.0, PA-76X38X1.98
     3. Verticais (laterais):
          - comprimento = altura do fixo
          - quantidade = 2 (esq+dir) + 1 por emenda de chapa
     4. Horizontais bordas:
          - comprimento = largura do fixo (largura inteira)
          - quantidade = 2 (1 em cima + 1 em baixo)
     5. Travessas horizontais (intermediarias):
          - comprimento = largura - 2 x medida_maior_do_tubo
            ex: tubo 51x25 -> largura - 51 - 51
          - quantidade = primeiro digito da altura
            ex: 3489 -> 3 travessas, 4638 -> 4 travessas
     6. Barras tem 6m. Se peca > 6000mm, divide em
        N barras de 6000 + 1 completamento com a sobra.

   Saida: gerarCortes(item) -> { 'PA-XXX': [{comp, qty, label}, ...] }
*/

const PerfisRevParede = (() => {

  // Tubos validos pra estrutura (codigos exatos do cadastro)
  const TUBOS_VALIDOS = [
    'PA-25X12X1.58',
    'PA-51X12X1.2',
    'PA-51X12X1.58',
    'PA-51X25X1.5',
    'PA-51X25X2.0',
    'PA-76X38X1.98',
  ];

  // Comprimento maximo da barra (mm). Se peca > BARRA_MAX, divide.
  const BARRA_MAX = 6000;

  // ===========================================================
  // Helpers
  // ===========================================================

  // Extrai medida maior do tubo a partir do codigo.
  // Ex: PA-51X25X2.0 -> 51 (max entre 51 e 25)
  //     PA-76X38X1.98 -> 76
  //     PA-25X12X1.58 -> 25
  function medidaMaiorDoTubo(codigo) {
    const m = String(codigo || '').match(/PA-(\d+)X(\d+)X/i);
    if (!m) return 0;
    return Math.max(parseInt(m[1], 10) || 0, parseInt(m[2], 10) || 0);
  }

  // Conta n de faixas de chapa pra calcular emendas.
  // Modo automatico: replica a logica do motor de chapas.
  // Modo manual: usa pecas.length (cada peca = 1 faixa lado a lado).
  function nFaixasChapa(item) {
    if (item.modo === 'automatico') {
      const L = Number(item.largura_total) || 0;
      if (!L) return 1;
      // Le REF do storage (mesma logica do 40-chapas-rev-parede.js)
      let REF = 20;
      try {
        if (window.Storage && window.Storage.scope) {
          const r = window.Storage.scope('cadastros').get('regras_variaveis_chapas');
          if (r && Number(r.REF) > 0) REF = Number(r.REF);
        }
      } catch (_) {}
      const LARG_CHAPA_BASE = 1500;
      const comRefilado = item.com_refilado !== 'nao';
      const larguraMaxima = comRefilado ? (LARG_CHAPA_BASE - 2*REF) : LARG_CHAPA_BASE;
      const divisao = item.divisao_largura || 'maxima';
      if (divisao === 'igual') {
        return Math.max(1, Math.ceil(L / larguraMaxima));
      }
      // maxima: nInteiras + sobra (se houver)
      const nInteiras = Math.floor(L / larguraMaxima);
      const sobra = L - nInteiras * larguraMaxima;
      return nInteiras + (sobra > 0.5 ? 1 : 0);
    }
    // Modo manual: cada peca lado a lado conta como 1 faixa
    const pecas = Array.isArray(item.pecas) ? item.pecas : [];
    const validas = pecas.filter(p => Number(p.largura) > 0 && Number(p.altura) > 0);
    return Math.max(1, validas.length);
  }

  // No modo manual sem largura_total preenchida, tenta inferir
  // somando as larguras das pecas (assume lado a lado).
  function inferirDimensoes(item) {
    let L = Number(item.largura_total) || 0;
    let H = Number(item.altura_total)  || 0;
    if (item.modo === 'manual' && (!L || !H)) {
      const pecas = Array.isArray(item.pecas) ? item.pecas : [];
      const validas = pecas.filter(p => Number(p.largura) > 0 && Number(p.altura) > 0);
      if (validas.length) {
        if (!L) L = validas.reduce((s, p) => s + Number(p.largura), 0);
        if (!H) H = Math.max.apply(null, validas.map(p => Number(p.altura)));
      }
    }
    return { L, H };
  }

  // ===========================================================
  // Motor principal
  // ===========================================================
  function gerarCortes(item) {
    if (!item || item.tipo !== 'revestimento_parede') return {};
    if (item.temEstrutura !== 'sim') return {};

    const tubo = String(item.tuboEstrutura || '').trim();
    if (!tubo || !TUBOS_VALIDOS.includes(tubo)) return {};

    const { L, H } = inferirDimensoes(item);
    if (!L || !H) return {};

    const medidaMaior = medidaMaiorDoTubo(tubo);
    const emendas = Math.max(0, nFaixasChapa(item) - 1);
    const qtdTravessas = Math.floor(H / 1000);

    const cortes = {};
    cortes[tubo] = [];

    function add(comp, qty, label) {
      if (comp <= 0 || qty <= 0) return;
      // Se peca > BARRA_MAX, divide em barras de 6m + completamento
      if (comp > BARRA_MAX) {
        const nBarras = Math.floor(comp / BARRA_MAX);
        const sobra = comp - (nBarras * BARRA_MAX);
        if (nBarras > 0) {
          cortes[tubo].push({
            comp: BARRA_MAX,
            qty: nBarras * qty,
            label: label + ' (barra 6m)',
          });
        }
        if (sobra > 0.5) {
          cortes[tubo].push({
            comp: Math.round(sobra),
            qty: qty,
            label: label + ' (completamento)',
          });
        }
      } else {
        cortes[tubo].push({ comp: Math.round(comp), qty, label });
      }
    }

    // 1. VERTICAIS (laterais esq + dir + emendas)
    //    comp = altura, qty = 2 + emendas
    const qtdVerticais = 2 + emendas;
    add(H, qtdVerticais, 'Vertical (lateral)');

    // 2. HORIZONTAIS BORDAS (1 cima + 1 baixo)
    //    comp = largura inteira, qty = 2
    add(L, 2, 'Horizontal (topo/base)');

    // 3. TRAVESSAS HORIZONTAIS (intermediarias)
    //    comp = largura - 2 x medida_maior, qty = floor(altura/1000)
    if (qtdTravessas > 0 && medidaMaior > 0) {
      const compTravessa = L - 2 * medidaMaior;
      add(compTravessa, qtdTravessas, 'Travessa horizontal');
    }

    if (cortes[tubo].length === 0) return {};
    return cortes;
  }

  function descricaoItem(item) {
    const partes = ['Revestimento de Parede'];
    const L = item.largura_total || (item.pecas && item.pecas[0] && item.pecas[0].largura);
    const H = item.altura_total  || (item.pecas && item.pecas[0] && item.pecas[0].altura);
    if (L && H) partes.push(`${L}×${H}mm`);
    if (item.temEstrutura === 'sim' && item.tuboEstrutura) {
      partes.push(`Estrutura ${item.tuboEstrutura}`);
    }
    if (item.cor) partes.push(item.cor);
    const qtd = Math.max(1, parseInt(item.quantidade, 10) || 1);
    if (qtd > 1) partes.push(`${qtd} paredes`);
    return partes.join(', ');
  }

  return {
    gerarCortes,
    descricaoItem,
    TUBOS_VALIDOS,
    BARRA_MAX,
    _medidaMaiorDoTubo: medidaMaiorDoTubo,
    _nFaixasChapa: nFaixasChapa,
  };
})();
window.PerfisRevParede = PerfisRevParede;
