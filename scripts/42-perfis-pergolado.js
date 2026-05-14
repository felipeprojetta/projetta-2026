/**
 * MOTOR DE PERFIS — PERGOLADO
 *
 * Felipe sessao 18:
 * "O perfil dessa vez ele e' inteiro, entao se eu tiver uma parede
 *  de 2×5, nos vamos ter 5 metros de comprimento no perfil, e a
 *  divisao vai ser a quantidade."
 *
 * Diferente do ripado da porta/rev parede (que tem padrao 2m + 600
 * + ar + 600 ...), no pergolado o tubo e' INTEIRO de cima a baixo,
 * com comprimento = altura da parede.
 *
 * qtdRipas = qtd de tubos (= qtd de chapas).
 */
const PerfisPergolado = (() => {

  const BARRA_MAX = 6000;  // Barra padrao de 6m

  /**
   * Gera cortes do pergolado.
   * Itera item.paredes[] e emite, pra cada parede:
   *   1× tubo (comp=H, qty=qtdRipas × qtdParede)
   *
   * Retorno: { 'PA-51X51': [{comp, qty, label}, ...] }
   * (uma chave por tubo, mas pergolado so usa 1 tubo por item — entao
   *  retorna 1 chave so).
   */
  function gerarCortes(item) {
    if (!item || item.tipo !== 'pergolado') return {};
    const tuboId = String(item.tubo || '').trim();
    if (!tuboId) return {};
    const tubo = window.ChapasPergolado?.getTubo?.(tuboId);
    if (!tubo) return {};
    const espac = parseFloat(String(item.espacamentoRipas != null ? item.espacamentoRipas : 30).replace(',', '.')) || 30;

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

    const cortes = {};
    cortes[tuboId] = [];

    paredes.forEach((p, paredeIdx) => {
      const L = Number(p.largura_total) || 0;
      const H = Number(p.altura_total)  || 0;
      if (!L || !H) return;
      const qtdParede = Math.max(1, Number(p.quantidade) || 1);
      const qtdRipas = window.ChapasPergolado?.calcularQtdRipas?.(L, tubo.menor, espac) || 0;
      if (qtdRipas <= 0) return;
      const totalQty = qtdRipas * qtdParede;
      const sufixo = paredes.length > 1 ? ` — Parede ${paredeIdx + 1}` : '';

      // Felipe: 'perfil inteiro, comprimento = altura, qtd = qtdRipas'.
      // Pra altura > 6m precisa quebrar em barras (barra padrao 6m).
      // Vou usar o helper add() do mesmo padrao do 37-perfis-rev-parede.
      if (H > BARRA_MAX) {
        const nBarras = Math.floor(H / BARRA_MAX);
        const sobra = H - (nBarras * BARRA_MAX);
        if (nBarras > 0) {
          cortes[tuboId].push({
            comp: BARRA_MAX,
            qty: nBarras * totalQty,
            label: `Tubo Pergolado (barra 6m)` + sufixo,
          });
        }
        if (sobra > 0.5) {
          cortes[tuboId].push({
            comp: Math.round(sobra),
            qty: totalQty,
            label: `Tubo Pergolado (completamento)` + sufixo,
          });
        }
      } else {
        cortes[tuboId].push({
          comp: Math.round(H),
          qty: totalQty,
          label: `Tubo Pergolado` + sufixo,
        });
      }
    });

    if (cortes[tuboId].length === 0) return {};
    return cortes;
  }

  function descricaoItem(item) {
    const tuboId = String(item.tubo || '').trim();
    const tubo = window.ChapasPergolado?.getTubo?.(tuboId);
    const partes = ['Pergolado'];
    if (tubo) partes.push(tubo.label);
    return partes.join(' · ');
  }

  return {
    gerarCortes,
    descricaoItem,
  };
})();

window.PerfisPergolado = PerfisPergolado;
