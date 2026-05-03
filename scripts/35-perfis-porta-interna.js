/* 32-perfis-porta-interna.js — Regras de calculo de perfis da PORTA INTERNA.

   ESTE MODULO E' EXCLUSIVO DA PORTA INTERNA. Nao tem regras ainda
   (Felipe vai passar item por item).

   Saida esperada (igual aos outros motores):
     gerarCortes(item) → { 'PA-XXX': [{ comp, qty, label }, ...] }
*/

const PerfisPortaInterna = (() => {
  /**
   * Stub. Quando Felipe passar as regras, implementar aqui.
   * Devolve objeto vazio = nenhum corte gerado pra esse item.
   */
  function gerarCortes(/* item */) {
    return {};
  }

  function descricaoItem(item) {
    const dim = `${item.largura || '?'}×${item.altura || '?'}mm`;
    return `Porta Interna, ${dim}`;
  }

  return { gerarCortes, descricaoItem };
})();
window.PerfisPortaInterna = PerfisPortaInterna;
