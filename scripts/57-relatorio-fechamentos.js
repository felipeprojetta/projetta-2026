/* ============================================================
   57 — RELATORIO DE CLIENTES FECHADOS
   ============================================================
   Felipe s37. Pedido: "pela data que colocamos que foi fechamento
   e o valor, separe por mes, so' isso. Me de dados do AGP e da
   outra aba ATP para conferirmos".

   Regra de periodo: MES CIVIL puro (01 a 31), pela DATA DE
   FECHAMENTO digitada no card (lead.fechadoEm).
   NAO usa mes fiscal (16->15) — foi justamente o criterio que
   gerava discussao ("cada hora o pessoal fala que mes e'"), e por
   isso o KPI "Fechado no Mes" foi removido do CRM.

   Traz lado a lado os dados do CRM (AGP) e da aba ATP (contrato),
   pra conferencia. CPF/RG NUNCA entram no relatorio.

   Modulo isolado: nao altera motor de calculo nem o 10-crm alem
   do botao que o chama.
   ============================================================ */
window.RelatorioFechamentos = (function () {
  'use strict';

  const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  function dataFechamento(lead) {
    if (!lead || !lead.fechadoEm) return null;
    const d = new Date(String(lead.fechadoEm) + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function ehInternacional(lead) {
    return String(lead && lead.destinoTipo || '').toLowerCase() === 'internacional';
  }

  /**
   * Valor oficial = o do DRE aprovado (mesma fonte do card do CRM).
   * Cai pro lead.valor so' quando nao ha orcamento aprovado.
   */
  function valorDe(lead) {
    // Felipe s37 (casas decimais): arredonda pra centavo na fonte —
    // DRE devolve fracao abaixo do centavo e a soma crua driftava
    // 0,08 vs a planilha (que soma linha ja arredondada).
    const cents = v => Math.round((Number(v) || 0) * 100) / 100;
    if (!lead) return 0;
    if (lead.valorCalcBackup != null && lead.valorCalcBackup !== '') {
      return cents(lead.valor);
    }
    try {
      const r = (window.Orcamento && window.Orcamento.resumoParaCardCRM)
        ? window.Orcamento.resumoParaCardCRM(lead.id) : null;
      if (r && r.hasVersaoFechada && Number(r.valor) > 0) return cents(r.valor);
    } catch (_) {}
    return cents(lead.valor);
  }

  function atpDe(lead) {
    const a = (lead && lead.atp && typeof lead.atp === 'object') ? lead.atp : {};
    return {
      numero: a.numeroAtp || '',
      nome: [a.nomeContrato, a.sobrenomeContrato].filter(Boolean).join(' '),
      assinatura: a.dataAssinaturaContrato || '',
      prazo: a.prazoEntrega || '',
      previsao: a.previsaoMedicao || '',
      cidade: [a.cidadeEntrega, a.estadoEntrega].filter(Boolean).join(' / '),
      cep: a.cepEntrega || '',
      email: a.emailContrato || a.emailNfe || '',
      reserva: a.numeroReserva || '',
    };
  }

  function lerLeads() {
    try { return (window.Storage && Storage.scope('crm').get('leads')) || []; }
    catch (_) { return []; }
  }

  /** Todos os fechados do ano, agrupados por mes civil da data de fechamento. */
  function porMes(leads, ano) {
    const meses = {};
    leads.forEach(l => {
      if (!l || l.etapa !== 'fechado') return;
      const d = dataFechamento(l);
      if (!d || d.getFullYear() !== Number(ano)) return;
      const m = d.getMonth() + 1;
      (meses[m] = meses[m] || []).push(l);
    });
    // dentro de cada mes: por data de fechamento, depois por valor
    Object.keys(meses).forEach(m => {
      meses[m].sort((a, b) => {
        const da = String(a.fechadoEm || ''), db = String(b.fechadoEm || '');
        if (da !== db) return da < db ? -1 : 1;
        return valorDe(a) - valorDe(b);
      });
    });
    return meses;
  }

  function anosDisponiveis(leads) {
    const anos = new Set();
    leads.forEach(l => {
      if (!l || l.etapa !== 'fechado') return;
      const d = dataFechamento(l);
      if (d) anos.add(d.getFullYear());
    });
    if (!anos.size) anos.add(new Date().getFullYear());
    return Array.from(anos).sort((a, b) => b - a);
  }

  function brData(iso) {
    if (!iso) return '';
    const p = String(iso).slice(0, 10).split('-');
    return p.length === 3 ? (p[2] + '/' + p[1] + '/' + p[0]) : String(iso);
  }

  function montarLinhas(leads, ano) {
    // Felipe s37 (casas decimais): toda celula NUMERICA do Excel sai em
    // CENTAVO exato. Somas de floats 2-casas carregam residuo binario
    // (32651736.269999996) e o Excel mostra as casas todas na celula.
    const c2 = v => Math.round((Number(v) || 0) * 100) / 100;
    const meses = porMes(leads, ano);
    const rows = [];
    let totalAno = 0, qtdAno = 0, nacAno = 0, intAno = 0;
    const resumo = [];

    for (let m = 1; m <= 12; m++) {
      const doMes = meses[m];
      if (!doMes || !doMes.length) continue;
      let somaMes = 0, nacMes = 0, intMes = 0;

      rows.push(['', '', '', '', '', '', '', '', '', '']);
      rows.push([MESES[m - 1].toUpperCase() + ' / ' + ano, '', '', '', '', '', '', '', '', '']);

      doMes.forEach(l => {
        const v = valorDe(l);
        const a = atpDe(l);
        somaMes += v;
        if (ehInternacional(l)) intMes += v; else nacMes += v;
        rows.push([
          brData(l.fechadoEm),                                  // Data fechamento
          l.cliente || '',                                      // Cliente
          l.numeroAGP || '',                                    // AGP (CRM)
          a.numero,                                             // ATP (aba contrato)
          l.numeroReserva || l.reserva || a.reserva || '',      // Reserva
          l.representante_followup || l.representante || '',    // Representante
          [l.cidade, l.estado].filter(Boolean).join(' / ') || a.cidade,
          ehInternacional(l) ? 'INTERNACIONAL' : 'Nacional',
          brData(a.assinatura),                                 // Assinatura contrato (ATP)
          v,                                                    // Valor
        ]);
      });

      rows.push(['', 'TOTAL ' + MESES[m - 1].toUpperCase()
                 + ' (' + doMes.length + ' clientes)', '', '', '', '',
                 'Nacional: ' + nacMes.toFixed(2),
                 intMes > 0 ? 'Internacional: ' + intMes.toFixed(2) : '', '', c2(somaMes)]);

      resumo.push({ mes: MESES[m - 1], qtd: doMes.length, nac: nacMes, int: intMes, total: somaMes });
      totalAno += somaMes; qtdAno += doMes.length; nacAno += nacMes; intAno += intMes;
    }

    rows.push(['', '', '', '', '', '', '', '', '', '']);
    rows.push(['RESUMO ' + ano, '', '', '', '', '', '', '', '', '']);
    rows.push(['Mes', 'Clientes', '', '', '', '', 'Nacional', 'Internacional', '', 'Total do mes']);
    resumo.forEach(r => {
      rows.push([r.mes, r.qtd, '', '', '', '', c2(r.nac), c2(r.int), '', c2(r.total)]);
    });
    rows.push(['TOTAL DO ANO', qtdAno, '', '', '', '', c2(nacAno), c2(intAno), '', c2(totalAno)]);

    return { rows, totalAno, qtdAno, nacAno, intAno, resumo };
  }

  function gerar(ano) {
    const leads = lerLeads();
    if (!leads.length) {
      alert('Nenhum lead carregado. Recarregue a pagina e tente de novo.');
      return;
    }
    const anoAlvo = Number(ano) || (new Date()).getFullYear();
    const r = montarLinhas(leads, anoAlvo);
    if (!r.qtdAno) { alert('Nenhum cliente fechado em ' + anoAlvo + '.'); return; }
    if (!window.Universal || !window.Universal.exportXLSX) {
      alert('Exportador nao carregado. Recarregue a pagina.');
      return;
    }
    window.Universal.exportXLSX({
      headers: ['Data fechamento', 'Cliente', 'AGP', 'ATP', 'Reserva',
                'Representante', 'Cidade / UF', 'Destino',
                'Assinatura contrato', 'Valor'],
      rows: r.rows,
      sheetName: 'Clientes Fechados ' + anoAlvo,
      fileName: 'projetta_clientes_fechados_' + anoAlvo,
    });
  }

  function abrir() {
    const leads = lerLeads();
    const anos = anosDisponiveis(leads);
    const atual = (new Date()).getFullYear();
    const sugestao = anos.indexOf(atual) >= 0 ? atual : anos[0];
    const resp = window.prompt(
      'RELATORIO DE CLIENTES FECHADOS\n\n'
      + 'Excel com os clientes fechados separados por mes, pela DATA DE\n'
      + 'FECHAMENTO do card (mes civil, dia 01 ao ultimo dia do mes).\n'
      + 'Traz AGP (CRM) e ATP (aba contrato) lado a lado pra conferencia.\n\n'
      + 'Anos com fechamento: ' + anos.join(', ') + '\n\n'
      + 'Digite o ano:', String(sugestao));
    if (resp === null) return;
    const ano = parseInt(String(resp).trim(), 10);
    if (!ano || ano < 2000 || ano > 2100) { alert('Ano invalido: ' + resp); return; }
    gerar(ano);
  }

  return { abrir, gerar, montarLinhas, porMes, anosDisponiveis, valorDe, atpDe };
})();
