/**
 * MOTOR DE CHAPAS — PERGOLADO
 *
 * Felipe sessao 18 (novo item):
 * "Pergolado vai escolher simplesmente so o tubo. Tubos disponiveis:
 *  51×51, 101×51, 38×38, 76×38 (mais a frente).
 *  Sempre pega a MENOR medida do tubo:
 *    76×38 → 38 | 76×76 → 76 | 101×51 → 51 | 38×38 → 38
 *  Faz divisao: largura / (menor + 9 + espacamento) = qtdRipas
 *  Ex: parede 2000, tubo 51×51, espac 30:
 *    51+9=60, 60+30=90, 2000/90 = 22 ripas
 *  Mesma logica do ripado (60+30=90 era pra ripa 94mm)."
 *
 * Pergolado tem CHAPA cobrindo cada tubo. Medidas placeholder agora
 * (94mm aberta, igual ripa do rev parede ripado) — Felipe vai me
 * passar as medidas definitivas mais a frente.
 *
 * NAO tem chapa de fundo (pergolado e' tubo aparente espacado).
 */
const ChapasPergolado = (() => {

  // Tubos disponiveis pro pergolado.
  // Felipe sessao 18: 'comece com esses 4, depois cadastro mais'.
  // O segundo numero do par e' a MENOR medida que vai pra divisao.
  const TUBOS = [
    { id: 'PA-51X51',      label: '51 × 51',     menor: 51 },
    { id: 'PA-101X51',     label: '101 × 51',    menor: 51 },
    { id: 'PA-38X38',      label: '38 × 38',     menor: 38 },
    { id: 'PA-76X38',      label: '76 × 38',     menor: 38 },
  ];

  function getTubo(id) {
    return TUBOS.find(t => t.id === id) || TUBOS[0];
  }

  function getREF() {
    try {
      if (window.Storage && window.Storage.scope) {
        const r = window.Storage.scope('cadastros').get('regras_variaveis_chapas');
        if (r && Number(r.REF) > 0) return Number(r.REF);
      }
    } catch (e) {}
    return 20;
  }

  /**
   * Calcula qtdRipas de uma parede do pergolado.
   * qtdRipas = ceil(L / (menor + 9 + espacamento))
   */
  function calcularQtdRipas(L, tuboMenor, espacamento) {
    const denom = tuboMenor + 9 + espacamento;
    if (denom <= 0) return 0;
    return Math.ceil(L / denom);
  }

  /**
   * Gera as pecas de chapa pro item pergolado.
   * Iguala estrutura do rev parede ripado: 1 chapa por ripa.
   * Largura da chapa: 94mm placeholder (Felipe vai redefinir).
   *
   * Suporta item.paredes[] (multi-parede). Cada parede tem:
   *   { largura_total, altura_total, quantidade }
   */
  function gerarPecasPergolado(item) {
    if (!item || item.tipo !== 'pergolado') return [];

    const cor = String(item.cor || '').trim();
    const tubo = getTubo(item.tubo);
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

    const out = [];
    paredes.forEach((p, paredeIdx) => {
      const L = Number(p.largura_total) || 0;
      const H = Number(p.altura_total)  || 0;
      if (!L || !H) return;
      const qtdParede = Math.max(1, Number(p.quantidade) || 1);
      const qtdRipas = calcularQtdRipas(L, tubo.menor, espac);
      if (qtdRipas <= 0) return;
      const sufixo = paredes.length > 1 ? ` — Parede ${paredeIdx + 1}` : '';

      // Chapa placeholder: 94 × H (medida do ripado, Felipe redefinira)
      out.push({
        id: `pergolado_chapa_p${paredeIdx + 1}`,
        label: `Chapa Pergolado (94×${H}mm)` + sufixo,
        labelCompleto: `Chapa Pergolado (94×${H}mm)${cor ? ` (${cor})` : ''}` + sufixo,
        largura: 94,
        altura:  H,
        qtd:     qtdRipas * qtdParede,
        podeRotacionar: false,  // tem veio (placeholder)
        cor,
        lado: 'externo',
        categoria: 'pergolado',
        modelo: 0,
        ehDaCava: false,
        observacao: `pergolado — tubo ${tubo.label}, espacamento ${espac}mm, ${qtdRipas} ripas/parede` + sufixo,
      });
    });
    return out;
  }

  return {
    TUBOS,
    getTubo,
    calcularQtdRipas,
    gerarPecasPergolado,
  };
})();

window.ChapasPergolado = ChapasPergolado;
