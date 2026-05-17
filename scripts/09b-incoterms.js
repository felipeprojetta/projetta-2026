/**
 * scripts/09b-incoterms.js — Felipe sessao 31
 *
 * Modulo central de INCOTERMS 2020 (ICC oficial). Lista os 11 termos
 * + descricao curta + flags do que esta incluido no preco do vendedor.
 *
 * Fonte: ICC Incoterms 2020 Rules
 *        https://iccwbo.org/business-solutions/incoterms-rules/incoterms-2020/
 *
 * Felipe sessao 31: 'estude todos os icoterms que existem... quais
 * deixar no dropdown? Os 11 incoterms 2020'.
 *
 * Uso pelo sistema:
 *   Incoterms.LISTA       -> array com os 11
 *   Incoterms.byCodigo(c) -> objeto { codigo, nome, ... } ou null
 *   Incoterms.incluiFreteMaritimo(c) -> bool
 *   Incoterms.incluiSeguro(c)        -> bool
 *
 * Logica no orcamento (Felipe):
 *   EXW: so' valor da porta (vendedor entrega na fabrica)
 *   FOB: porta + frete terrestre + caixa (vendedor entrega no navio)
 *   CIF: porta + frete terrestre + caixa + frete maritimo + seguro
 *   DAP: como CIF mas vendedor entrega no destino (sem desembaraco)
 *   DDP: tudo + impostos no destino
 *   ... (cada incoterm define o que entra no preco final)
 */

const Incoterms = (() => {

  /**
   * Cada incoterm tem flags do que o VENDEDOR (Projetta) inclui no preco:
   *   freteTerrestre  - leva da fabrica ate o porto de origem (Santos)
   *   freteMaritimo   - porto origem -> porto destino
   *   seguroMaritimo  - cobertura no transito maritimo
   *   freteDestino    - porto destino ate local final no exterior
   *   desembaracoImp  - paga impostos/duties na importacao
   *   descarga        - vendedor descarrega no destino
   *   caixaFumigada   - SEMPRE incluida (e' parte do produto exportado)
   *
   * 'modal' indica se e' so' maritimo (FAS, FOB, CFR, CIF) ou multimodal.
   * 'recomendadoParaContainer' false nos casos onde a ICC desencoraja
   * (FAS/FOB/CFR/CIF nao sao recomendados pra container — usar FCA/CPT/CIP/CIF
   * conforme docs Incoterms 2020).
   */
  const LISTA = [
    {
      codigo: 'EXW',
      nome: 'Ex Works',
      nomePt: 'Na Origem',
      descricao: 'Vendedor entrega na fabrica. Comprador paga TUDO (incl. carregamento).',
      descricaoEn: 'Seller delivers at the factory. Buyer pays EVERYTHING (incl. loading).',
      modal: 'multimodal',
      recomendadoParaContainer: true,
      freteTerrestre: false, freteMaritimo: false, seguroMaritimo: false,
      freteDestino: false, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'FCA',
      nome: 'Free Carrier',
      nomePt: 'Livre no Transportador',
      descricao: 'Vendedor entrega ao 1o transportador escolhido pelo comprador (porto seco, depot, etc.).',
      descricaoEn: 'Seller delivers to the first carrier chosen by the buyer (dry port, depot, etc.).',
      modal: 'multimodal',
      recomendadoParaContainer: true,
      freteTerrestre: true, freteMaritimo: false, seguroMaritimo: false,
      freteDestino: false, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'FAS',
      nome: 'Free Alongside Ship',
      nomePt: 'Livre ao Lado do Navio',
      descricao: 'Vendedor entrega no costado do navio no porto de origem. Comprador embarca.',
      descricaoEn: 'Seller delivers alongside the vessel at the port of origin. Buyer loads on board.',
      modal: 'maritimo',
      recomendadoParaContainer: false,
      freteTerrestre: true, freteMaritimo: false, seguroMaritimo: false,
      freteDestino: false, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'FOB',
      nome: 'Free On Board',
      nomePt: 'Livre a Bordo',
      descricao: 'Vendedor entrega A BORDO do navio no porto de origem.',
      descricaoEn: 'Seller delivers ON BOARD the vessel at the port of origin.',
      modal: 'maritimo',
      recomendadoParaContainer: false,
      freteTerrestre: true, freteMaritimo: false, seguroMaritimo: false,
      freteDestino: false, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'CPT',
      nome: 'Carriage Paid To',
      nomePt: 'Transporte Pago Ate',
      descricao: 'Vendedor paga frete ate destino. Risco transfere no 1o transportador.',
      descricaoEn: 'Seller pays freight to destination. Risk transfers at the first carrier.',
      modal: 'multimodal',
      recomendadoParaContainer: true,
      freteTerrestre: true, freteMaritimo: true, seguroMaritimo: false,
      freteDestino: false, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'CFR',
      nome: 'Cost and Freight',
      nomePt: 'Custo e Frete',
      descricao: 'FOB + frete maritimo. Comprador assume risco a partir do navio.',
      descricaoEn: 'FOB + ocean freight. Buyer assumes risk from the vessel onward.',
      modal: 'maritimo',
      recomendadoParaContainer: false,
      freteTerrestre: true, freteMaritimo: true, seguroMaritimo: false,
      freteDestino: false, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'CIP',
      nome: 'Carriage and Insurance Paid To',
      nomePt: 'Transporte e Seguro Pagos',
      descricao: 'CPT + seguro maximo (Inst. Cargo Clause A). Multimodal.',
      descricaoEn: 'CPT + maximum insurance (Inst. Cargo Clause A). Multimodal.',
      modal: 'multimodal',
      recomendadoParaContainer: true,
      freteTerrestre: true, freteMaritimo: true, seguroMaritimo: true,
      freteDestino: false, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'CIF',
      nome: 'Cost, Insurance and Freight',
      nomePt: 'Custo, Seguro e Frete',
      descricao: 'CFR + seguro minimo (Inst. Cargo Clause C). Apenas maritimo.',
      descricaoEn: 'CFR + minimum insurance (Inst. Cargo Clause C). Ocean only.',
      modal: 'maritimo',
      recomendadoParaContainer: false,
      freteTerrestre: true, freteMaritimo: true, seguroMaritimo: true,
      freteDestino: false, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'DAP',
      nome: 'Delivered at Place',
      nomePt: 'Entregue no Local',
      descricao: 'Vendedor entrega no destino, pronto pra descarga. Comprador desembaraca.',
      descricaoEn: 'Seller delivers at the destination, ready for unloading. Buyer clears customs.',
      modal: 'multimodal',
      recomendadoParaContainer: true,
      freteTerrestre: true, freteMaritimo: true, seguroMaritimo: true,
      freteDestino: true, desembaracoImp: false, descarga: false,
    },
    {
      codigo: 'DPU',
      nome: 'Delivered at Place Unloaded',
      nomePt: 'Entregue Descarregado',
      descricao: 'DAP + vendedor descarrega no destino. (Substituiu DAT em 2020.)',
      descricaoEn: 'DAP + seller unloads at the destination. (Replaced DAT in 2020.)',
      modal: 'multimodal',
      recomendadoParaContainer: true,
      freteTerrestre: true, freteMaritimo: true, seguroMaritimo: true,
      freteDestino: true, desembaracoImp: false, descarga: true,
    },
    {
      codigo: 'DDP',
      nome: 'Delivered Duty Paid',
      nomePt: 'Entregue com Direitos Pagos',
      descricao: 'Vendedor entrega + paga impostos/duties na importacao. Maior obrigacao.',
      descricaoEn: 'Seller delivers + pays import duties/taxes. Highest seller obligation.',
      modal: 'multimodal',
      recomendadoParaContainer: true,
      freteTerrestre: true, freteMaritimo: true, seguroMaritimo: true,
      freteDestino: true, desembaracoImp: true, descarga: false,
    },
  ];

  function byCodigo(c) {
    if (!c) return null;
    return LISTA.find(it => it.codigo === String(c).toUpperCase()) || null;
  }
  function incluiFreteMaritimo(c) {
    const it = byCodigo(c);
    return it ? !!it.freteMaritimo : false;
  }
  function incluiSeguro(c) {
    const it = byCodigo(c);
    return it ? !!it.seguroMaritimo : false;
  }
  function incluiFreteTerrestre(c) {
    const it = byCodigo(c);
    return it ? !!it.freteTerrestre : false;
  }

  return { LISTA, byCodigo, incluiFreteMaritimo, incluiSeguro, incluiFreteTerrestre };
})();

if (typeof window !== 'undefined') window.Incoterms = Incoterms;
