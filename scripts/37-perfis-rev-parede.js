/* 34-perfis-rev-parede.js — Regras de calculo de perfis do
   REVESTIMENTO DE PAREDE.

   ESTE MODULO E' EXCLUSIVO DO REVESTIMENTO DE PAREDE. Nao tem regras
   ainda (Felipe vai passar item por item).
*/

const PerfisRevParede = (() => {
  function gerarCortes(/* item */) {
    return {};
  }

  function descricaoItem(item) {
    const dim = item.area
      ? `${item.area}m²`
      : `${item.largura || '?'}×${item.altura || '?'}mm`;
    return `Revestimento de Parede, ${dim}`;
  }

  return { gerarCortes, descricaoItem };
})();
window.PerfisRevParede = PerfisRevParede;
