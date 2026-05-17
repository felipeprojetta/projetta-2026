/**
 * scripts/09c-containers.js — Felipe sessao 31
 *
 * Modulo central de CONTAINERS ISO (ISO 668). Medidas oficiais
 * (variam ate ~10mm entre fabricantes; estes sao os valores mais
 * conservadores publicados por Hapag-Lloyd, Maersk, SeaCube e ICC).
 *
 * Felipe sessao 31: 'estudo todos os tamanhos de container que existem
 * suas medidas externas mas principalmente sua medidas internas e
 * medida da PORTA, pois e o espaco maximo que temos para entrar com
 * nossas caixas, geralmente container de 40 HC pois tem maior altura
 * livre da porta do container'.
 *
 * CRITICO: a PORTA do container e' o limite REAL pra entrada da caixa.
 * Caixa que cabe internamente mas nao passa pela porta = nao usa.
 *
 * Aplicado as caixas Projetta:
 *   - Caixa max 2550 mm altura -> cabe na porta 40 HC (2580) mas NAO no
 *     40 DV (2280). Por isso Felipe usa 40 HC como padrao.
 *
 * Uso pelo sistema:
 *   Containers.LISTA              -> array com os 5 tipos comuns
 *   Containers.byCodigo(c)        -> objeto ou null
 *   Containers.cabe(caixa, cont)  -> bool (verifica porta)
 *   Containers.quantasCabem(...)  -> quantas caixas cabem no FCL
 */

const Containers = (() => {

  /**
   * Cada container tem:
   *   ext / int / porta = { compr, larg, alt } em mm
   *   volumeM3          = volume interno em m³
   *   pesoMaxKg         = capacidade max de carga (payload)
   *   taraKg            = peso do container vazio
   *   recomendado       = boolean, default true pra escolha do Felipe
   */
  const LISTA = [
    {
      codigo: '20DV',
      nome: '20\' Standard (Dry Van)',
      ext:   { compr: 6058, larg: 2438, alt: 2591 },
      int:   { compr: 5898, larg: 2352, alt: 2393 },
      porta: { larg: 2343, alt: 2280 },
      volumeM3: 33.2,
      pesoMaxKg: 21700,
      taraKg: 2300,
      recomendado: true,
    },
    {
      codigo: '20HC',
      nome: '20\' High Cube',
      ext:   { compr: 6058, larg: 2438, alt: 2896 },
      int:   { compr: 5898, larg: 2352, alt: 2698 },
      porta: { larg: 2343, alt: 2585 },
      volumeM3: 37.4,
      pesoMaxKg: 21600,
      taraKg: 2400,
      recomendado: false, // raro, mercado pouco usa
    },
    {
      codigo: '40DV',
      nome: '40\' Standard (Dry Van)',
      ext:   { compr: 12192, larg: 2438, alt: 2591 },
      int:   { compr: 12032, larg: 2352, alt: 2393 },
      porta: { larg: 2343, alt: 2280 },
      volumeM3: 67.7,
      pesoMaxKg: 26700,
      taraKg: 3700,
      recomendado: true,
    },
    {
      codigo: '40HC',
      nome: '40\' High Cube ⭐',
      ext:   { compr: 12192, larg: 2438, alt: 2896 },
      int:   { compr: 12032, larg: 2352, alt: 2698 },
      porta: { larg: 2343, alt: 2585 },
      volumeM3: 76.4,
      pesoMaxKg: 26500,
      taraKg: 3900,
      recomendado: true,
    },
    {
      codigo: '45HC',
      nome: '45\' High Cube',
      ext:   { compr: 13716, larg: 2438, alt: 2896 },
      int:   { compr: 13556, larg: 2352, alt: 2698 },
      porta: { larg: 2343, alt: 2585 },
      volumeM3: 86.1,
      pesoMaxKg: 27700,
      taraKg: 4900,
      recomendado: false, // menos comum
    },
  ];

  function byCodigo(c) {
    if (!c) return null;
    return LISTA.find(it => it.codigo === String(c).toUpperCase()) || null;
  }

  /**
   * Verifica se uma caixa (A x E x C em mm) cabe na PORTA do container.
   * Considera 2 orientacoes: como esta ou tombada (largura<->altura).
   * Comprimento da caixa nao matera pra porta (caixa passa em pe).
   */
  function cabeNaPorta(caixaA, caixaE, caixaC, container) {
    const c = typeof container === 'string' ? byCodigo(container) : container;
    if (!c) return false;
    const a = Number(caixaA) || 0;
    const e = Number(caixaE) || 0;
    // Orienta caixa pra altura ser a MAIOR (em pe) e largura a menor das 2 restantes
    // A altura entra na altura da porta. A espessura entra na largura.
    const op1 = a <= c.porta.alt + 0.5 && e <= c.porta.larg + 0.5;
    const op2 = e <= c.porta.alt + 0.5 && a <= c.porta.larg + 0.5;
    return op1 || op2;
  }

  /**
   * Estima quantas caixas (em pe) cabem dentro do container,
   * considerando volume bruto. Heuristico simples (nao roda nesting),
   * util pra escolha LCL vs FCL na fase de proposta.
   */
  function quantasCabemEstimativa(caixaA, caixaE, caixaC, container) {
    const c = typeof container === 'string' ? byCodigo(container) : container;
    if (!c) return 0;
    const a = Number(caixaA) || 0;
    const e = Number(caixaE) || 0;
    const co = Number(caixaC) || 0;
    if (!a || !e || !co) return 0;
    if (!cabeNaPorta(caixaA, caixaE, caixaC, c)) return 0;
    // Tentativa grid simples: assume caixa em pe, altura=a, base=e×co.
    // Cabem floor(int.compr/co) × floor(int.larg/e) lado a lado.
    // Altura: floor(int.alt/a) empilhadas (cuidado: caixa pode nao empilhar
    // mas pra estimativa numerica nao importa).
    const qC = Math.floor(c.int.compr / co);
    const qL = Math.floor(c.int.larg  / e);
    const qA = Math.floor(c.int.alt   / a);
    return Math.max(0, qC * qL * qA);
  }

  return { LISTA, byCodigo, cabeNaPorta, quantasCabemEstimativa };
})();

if (typeof window !== 'undefined') window.Containers = Containers;
