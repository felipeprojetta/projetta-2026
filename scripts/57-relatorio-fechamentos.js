/* ============================================================
   57 — RELATORIO DE FECHAMENTOS POR MES
   ============================================================
   Felipe s37. Relatorio pedido: fechamentos de cada mes, do MENOR
   pro MAIOR valor, com total por mes, separacao NACIONAL x
   INTERNACIONAL e somatorio do ano.

   Regra de periodo: MES FISCAL PROJETTA (dia 16 do mes corrente ate
   o dia 15 do mes seguinte) — o MESMO criterio do KPI "Fechado no
   Mes" do CRM. Assim o total de cada mes aqui bate exatamente com o
   card, sem ninguem precisar conferir a mao.

   Modulo isolado: nao altera nenhum motor de calculo nem o 10-crm.
   Le os leads de Storage.scope('crm').get('leads') e exporta via
   window.Universal.exportXLSX (mesmo caminho do "Relatorio por
   Coluna" que ja' existe).
   ============================================================ */
window.RelatorioFechamentos = (function () {
  'use strict';

  const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  /**
   * Mes fiscal Projetta: 16/MM ate 15/(MM+1).
   * Identico ao periodoFechamento() do 10-crm.js — replicado aqui
   * de proposito pra manter o modulo isolado (sem dependencia de
   * funcao privada de outro arquivo).
   */
  function periodoFiscal(ano, mes) {
    const ini = new Date(ano, mes - 1, 16);
    const fim = new Date(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 16);
    return { ini, fim };
  }

  function ehInternacional(lead) {
    return String(lead && lead.destinoTipo || '').toLowerCase() === 'internacional';
  }

  function valorDe(lead) {
    return Number(lead && lead.valor) || 0;
  }

  function dataFechamento(lead) {
    if (!lead || !lead.fechadoEm) return null;
    const d = new Date(String(lead.fechadoEm) + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  /** Leads fechados dentro do mes fiscal, ordenados do MENOR pro MAIOR. */
  function fechadosDoMes(leads, ano, mes) {
    const { ini, fim } = periodoFiscal(ano, mes);
    return leads
      .filter(l => l && l.etapa === 'fechado')
      .filter(l => { const d = dataFechamento(l); return d && d >= ini && d < fim; })
      .sort((a, b) => valorDe(a) - valorDe(b));
  }

  /** Anos que tem algum fechamento (pro seletor). */
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

  function linhaLead(lead) {
    return [
      lead.cliente || '',
      lead.numeroAGP || '',
      lead.numeroReserva || lead.reserva || '',
      lead.representante_followup || lead.representante || '',
      [lead.cidade, lead.estado].filter(Boolean).join(' / '),
      lead.fechadoEm || '',
      valorDe(lead),
    ];
  }

  /**
   * Monta as linhas do relatorio de um ano inteiro.
   * Retorna { rows, totalAno, totalNac, totalInt, qtd }.
   */
  function montarLinhas(leads, ano) {
    const rows = [];
    let totalAno = 0, totalNac = 0, totalInt = 0, qtdAno = 0;
    const resumoMeses = [];

    for (let m = 1; m <= 12; m++) {
      const doMes = fechadosDoMes(leads, ano, m);
      if (!doMes.length) continue;

      const nac = doMes.filter(l => !ehInternacional(l));
      const int = doMes.filter(l => ehInternacional(l));
      const somaNac = nac.reduce((a, l) => a + valorDe(l), 0);
      const somaInt = int.reduce((a, l) => a + valorDe(l), 0);
      const somaMes = somaNac + somaInt;

      const { ini, fim } = periodoFiscal(ano, m);
      const rotuloPeriodo = ini.toLocaleDateString('pt-BR') + ' a '
        + new Date(fim.getTime() - 86400000).toLocaleDateString('pt-BR');

      rows.push(['', '', '', '', '', '', '']);
      rows.push([MESES[m - 1].toUpperCase() + ' / ' + ano + '  (' + rotuloPeriodo + ')',
                 '', '', '', '', '', '']);

      if (nac.length) {
        rows.push(['  NACIONAL', '', '', '', '', '', '']);
        nac.forEach(l => rows.push(linhaLead(l)));
        rows.push(['  Subtotal NACIONAL (' + nac.length + ')', '', '', '', '', '', somaNac]);
      }
      if (int.length) {
        rows.push(['  INTERNACIONAL', '', '', '', '', '', '']);
        int.forEach(l => rows.push(linhaLead(l)));
        rows.push(['  Subtotal INTERNACIONAL (' + int.length + ')', '', '', '', '', '', somaInt]);
      }
      rows.push(['TOTAL ' + MESES[m - 1].toUpperCase() + ' (' + doMes.length + ' fechamentos)',
                 '', '', '', '', '', somaMes]);

      resumoMeses.push({ mes: MESES[m - 1], qtd: doMes.length, nac: somaNac, int: somaInt, total: somaMes });
      totalAno += somaMes; totalNac += somaNac; totalInt += somaInt; qtdAno += doMes.length;
    }

    // Resumo final do ano
    // Felipe s37: o relatorio agrupa por MES FISCAL (16->15), igual ao card
    // "Fechado no Mes". Mas o card "Fechado no Ano" soma o ANO CIVIL
    // (01/01 a 31/12). Os dois totais sao legitimos e podem diferir — um
    // fechamento de 05/01/2026, por exemplo, e' Dezembro/2025 no fiscal e
    // 2026 no civil. Mostro OS DOIS aqui pra ninguem precisar caçar
    // diferenca depois.
    const iniCivil = new Date(ano, 0, 1);
    const fimCivil = new Date(ano + 1, 0, 1);
    let totalCivil = 0, qtdCivil = 0, civilNac = 0, civilInt = 0;
    leads.forEach(l => {
      if (!l || l.etapa !== 'fechado') return;
      const d = dataFechamento(l);
      if (!d || d < iniCivil || d >= fimCivil) return;
      const v = valorDe(l);
      totalCivil += v; qtdCivil++;
      if (ehInternacional(l)) civilInt += v; else civilNac += v;
    });

    rows.push(['', '', '', '', '', '', '']);
    rows.push(['RESUMO DO ANO ' + ano, '', '', '', '', '', '']);
    rows.push(['Mes (mes fiscal: dia 16 ao dia 15 do mes seguinte)', '', '', '',
               'Nacional', 'Internacional', 'Total do mes']);
    resumoMeses.forEach(r => {
      rows.push([r.mes + ' (' + r.qtd + ')', '', '', '', r.nac, r.int, r.total]);
    });
    rows.push(['TOTAL NACIONAL', '', '', '', '', '', totalNac]);
    rows.push(['TOTAL INTERNACIONAL', '', '', '', '', '', totalInt]);
    rows.push(['TOTAL DO ANO — soma dos meses fiscais (' + qtdAno + ' fechamentos)',
               '', '', '', '', '', totalAno]);
    rows.push(['', '', '', '', '', '', '']);
    rows.push(['CONFERENCIA COM O CARD DO CRM', '', '', '', '', '', '']);
    rows.push(['TOTAL ANO CIVIL 01/01 a 31/12 (' + qtdCivil + ') — e este que aparece'
               + ' no card "Fechado no Ano"', '', '', '', civilNac, civilInt, totalCivil]);
    if (Math.abs(totalCivil - totalAno) >= 0.01) {
      rows.push(['Diferenca fiscal x civil (fechamentos entre 01 e 15 de janeiro contam'
                 + ' como dezembro do ano anterior no criterio fiscal)',
                 '', '', '', '', '', totalCivil - totalAno]);
    }

    return { rows, totalAno, totalNac, totalInt, qtd: qtdAno, resumoMeses,
             totalCivil, qtdCivil };
  }

  /** Le os leads do Storage (fonte unica — mesma do CRM). */
  function lerLeads() {
    try { return (window.Storage && Storage.scope('crm').get('leads')) || []; }
    catch (_) { return []; }
  }

  /** Gera e baixa o Excel do ano informado. */
  function gerar(ano) {
    const leads = lerLeads();
    if (!leads.length) {
      alert('Nenhum lead carregado. Recarregue a pagina e tente de novo.');
      return;
    }
    const anoAlvo = Number(ano) || (new Date()).getFullYear();
    const r = montarLinhas(leads, anoAlvo);
    if (!r.qtd) {
      alert('Nenhum fechamento encontrado em ' + anoAlvo + '.');
      return;
    }
    const headers = ['Cliente', 'AGP', 'Reserva', 'Representante',
                     'Cidade / UF', 'Data fechamento', 'Valor'];
    if (!window.Universal || !window.Universal.exportXLSX) {
      alert('Exportador nao carregado. Recarregue a pagina.');
      return;
    }
    window.Universal.exportXLSX({
      headers,
      rows: r.rows,
      sheetName: 'Fechamentos ' + anoAlvo,
      fileName: 'projetta_fechamentos_' + anoAlvo,
    });
  }

  /** Abre um seletor simples de ano e gera. */
  function abrir() {
    const leads = lerLeads();
    const anos = anosDisponiveis(leads);
    const atual = (new Date()).getFullYear();
    const sugestao = anos.indexOf(atual) >= 0 ? atual : anos[0];
    const resp = window.prompt(
      'RELATORIO DE FECHAMENTOS POR MES\n\n'
      + 'Gera um Excel com os fechamentos de cada mes (do menor pro maior valor),\n'
      + 'separados entre NACIONAL e INTERNACIONAL, com total de cada mes e do ano.\n\n'
      + 'Periodo de cada mes: dia 16 ao dia 15 do mes seguinte (mes fiscal Projetta,\n'
      + 'o mesmo criterio do card "Fechado no Mes").\n\n'
      + 'Anos com fechamento: ' + anos.join(', ') + '\n\n'
      + 'Digite o ano:', String(sugestao));
    if (resp === null) return;              // cancelou
    const ano = parseInt(String(resp).trim(), 10);
    if (!ano || ano < 2000 || ano > 2100) {
      alert('Ano invalido: ' + resp);
      return;
    }
    gerar(ano);
  }

  return { abrir, gerar, montarLinhas, fechadosDoMes, periodoFiscal, anosDisponiveis };
})();
