/**
 * scripts/09-cambio.js — Felipe sessao 31
 *
 * Modulo central de CAMBIO USD->BRL. Toda parte do sistema que precisa
 * converter valores entre USD e BRL passa por aqui.
 *
 * Fontes:
 *   1) PTAX (BCB) — taxa oficial de venda do dolar, ultima cotacao do dia.
 *      Endpoint publico: https://www.bcb.gov.br/api/servico/sitebcb/cotacao-dolar-diario
 *      Felipe sessao 31: permite ver historico de 30 dias na config.
 *   2) Manual — Felipe insere uma taxa que SOBRESCREVE a PTAX em todo o
 *      sistema. Salvo em Storage 'cambio/manual' = number.
 *
 * Uso pelo resto do sistema:
 *   Cambio.taxaAtual()            -> numero (BRL por USD)
 *   Cambio.brlParaUsd(valorBrl)   -> numero em USD
 *   Cambio.usdParaBrl(valorUsd)   -> numero em BRL
 *   Cambio.formatarUsd(numero)    -> string 'USD 1,234.56'
 *   Cambio.formatarBrl(numero)    -> string 'R$ 1.234,56'
 *   Cambio.fmtPar(valorBrl)       -> string 'R$ 1.234,56 / USD 234.56'
 *                                    Usado no DRE.
 *
 * O modulo emite 'cambio:change' via Events quando a taxa manual muda
 * (Configuracao). Telas que dependem (proposta, DRE) podem se inscrever
 * pra re-renderizar.
 *
 * Regra ouro: se nao tem taxa manual NEM PTAX em cache, taxa = 0 e o
 * sistema avisa pra Felipe inserir manualmente.
 */

const Cambio = (() => {

  const PREFIX_SCOPE = 'cambio';
  const KEY_MANUAL = 'manual';     // taxa BRL/USD definida manualmente
  const KEY_PTAX = 'ptax';         // ultima cotacao PTAX em cache {valor, data}
  const KEY_HISTORICO = 'historico'; // ultimos 30 dias PTAX [{data, valor}]

  function store() {
    return window.Storage ? window.Storage.scope(PREFIX_SCOPE) : null;
  }

  /**
   * Taxa atual a ser usada NO SISTEMA. Prioridade:
   *   1) manual (Felipe digitou) — SEMPRE vence se > 0
   *   2) PTAX em cache
   *   3) 0 (sistema avisa)
   */
  function taxaAtual() {
    const s = store();
    if (!s) return 0;
    const manual = Number(s.get(KEY_MANUAL, 0)) || 0;
    if (manual > 0) return manual;
    const ptax = s.get(KEY_PTAX, null);
    if (ptax && Number(ptax.valor) > 0) return Number(ptax.valor);
    return 0;
  }

  function setManual(valor) {
    const s = store();
    if (!s) return;
    const v = Number(valor) || 0;
    s.set(KEY_MANUAL, v);
    if (window.Events) window.Events.emit('cambio:change', { taxa: v });
  }

  function getManual() {
    const s = store();
    return s ? (Number(s.get(KEY_MANUAL, 0)) || 0) : 0;
  }

  function getPtax() {
    const s = store();
    return s ? s.get(KEY_PTAX, null) : null;
  }

  function getHistorico() {
    const s = store();
    return s ? (s.get(KEY_HISTORICO, []) || []) : [];
  }

  /**
   * Felipe sessao 31: calcula media simples dos primeiros N valores do
   * historico PTAX (dias mais recentes primeiro). Retorna 0 se nao tem
   * historico suficiente. Usado pra dar contexto no card de Configuracao
   * (medias de 30, 60, 90 dias) e ajudar Felipe a decidir a taxa manual.
   */
  function mediaPtax(n) {
    const hist = getHistorico();
    if (!hist.length) return 0;
    const slice = hist.slice(0, Math.min(n, hist.length));
    if (!slice.length) return 0;
    const soma = slice.reduce((s, h) => s + (Number(h.valor) || 0), 0);
    return soma / slice.length;
  }

  /**
   * Busca PTAX dos ultimos 30 dias na API do BCB. Atualiza cache local.
   * Felipe sessao 31: usa endpoint publico do BCB, retorna ASP-WS.
   * Em caso de falha (offline, CORS), mantem o cache existente.
   */
  async function atualizarPtax() {
    const s = store();
    if (!s) return { ok: false, erro: 'Storage nao disponivel' };
    try {
      // BCB API publica — cotacao do dolar dos ultimos ~90 dias uteis.
      // Endpoint: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/
      // CotacaoDolarPeriodo(...) — formato OData JSON.
      // Felipe sessao 31: busca 95 dias corridos pra ter 90+ dias uteis
      // pra calcular medias de 30/60/90 dias.
      const hoje = new Date();
      const dInicio = new Date(hoje);
      dInicio.setDate(hoje.getDate() - 100); // 100 dias corridos = ~70 uteis com folga
      function fmt(d) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return mm + '-' + dd + '-' + d.getFullYear();
      }
      const url =
        "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo" +
        "(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
        "?@dataInicial='" + fmt(dInicio) + "'" +
        "&@dataFinalCotacao='" + fmt(hoje) + "'" +
        "&$top=500&$format=json&$select=cotacaoVenda,dataHoraCotacao";
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const vals = (json.value || []).map(r => ({
        data: (r.dataHoraCotacao || '').slice(0, 10),
        valor: Number(r.cotacaoVenda) || 0,
      })).filter(r => r.valor > 0);
      if (!vals.length) throw new Error('Sem dados da PTAX');
      // Mais recente primeiro
      vals.sort((a, b) => b.data.localeCompare(a.data));
      const ultimo = vals[0];
      s.set(KEY_PTAX, ultimo);
      // Felipe sessao 31: guarda ate 90 dias pra calcular medias.
      s.set(KEY_HISTORICO, vals.slice(0, 90));
      return { ok: true, ptax: ultimo, historico: vals.slice(0, 90) };
    } catch (err) {
      return { ok: false, erro: err.message || String(err) };
    }
  }

  function brlParaUsd(valorBrl) {
    const t = taxaAtual();
    if (!t) return 0;
    return Number(valorBrl) / t;
  }

  function usdParaBrl(valorUsd) {
    const t = taxaAtual();
    if (!t) return 0;
    return Number(valorUsd) * t;
  }

  function formatarUsd(numero) {
    const n = Number(numero) || 0;
    // Formato americano: USD 1,234.56
    const parts = n.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return 'USD ' + parts.join('.');
  }

  function formatarBrl(numero) {
    const n = Number(numero) || 0;
    return 'R$ ' + n.toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  /**
   * Formato pareado pra DRE: 'R$ 1.234,56 / USD 234.56'.
   * Felipe sessao 31: 'TODOS VALORES DO DRE PRA FRENTE DEVEM APARECER EM
   * REAL E EM DOLLAR'.
   */
  function fmtPar(valorBrl) {
    const brl = formatarBrl(valorBrl);
    const t = taxaAtual();
    if (!t) return brl + ' / USD —';
    return brl + ' / ' + formatarUsd(brlParaUsd(valorBrl));
  }

  return {
    taxaAtual, setManual, getManual,
    getPtax, getHistorico, mediaPtax, atualizarPtax,
    brlParaUsd, usdParaBrl,
    formatarUsd, formatarBrl, fmtPar,
  };
})();

if (typeof window !== 'undefined') window.Cambio = Cambio;
