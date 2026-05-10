/* 18-producao-geral.js — Tabela master de producao, ligada por ATP.
   Persistencia: Storage.scope('producao-geral'). CSS prefixo .pg-*.

   ============================================================
   MODULO: PRODUCAO GERAL
   ============================================================
   Visao MASTER de tudo que esta em producao. Le os cards do
   Kanban Producao (read-only) e adiciona deltas proprios:
   datas dos marcos de producao por ATP/cardId.

   Linkado por ATP: status producao vem DIRETO da etapa do Kanban
   Producao. Mover card no Kanban => atualiza status aqui (e em
   Agenda Obras).

   Felipe (sessao 2026-05-10):
     'TEMOS TBM UMA PRODUCAO GERAL AONDE VEMOS TUDO DE UMA FORMA
      GLOBAL, IMPORTA E SER TUDO LINKADO SE EU MUDAR KABAN DE LOCAL
      ALTERA NESSA PRODUCAO GERAL STATUS PRODUCAO'.

   Baseado na planilha PRODUCAO_GERAL.xlsx fornecida pelo Felipe:
   colunas Cliente, ATP, Cidade, Estado, Tipo, Qtd, Status,
   Medicao, Liberacao, Aprovacao, Marcos (CAD.OS, CUT2D, Corte
   Chapa, Quadro Porta, Colagem, Portal, Quadro Fixo, Colagem
   Quadro Fixo, Conferencia, Embalagem), Inicio Instalacao,
   Entrega Final.
   ============================================================ */
(() => {
  'use strict';

  const store = Storage.scope('producao-geral');
  const state = {
    deltas: {},            // marcos por cardId: { [cardId]: { cadOs, cut2d, corte, quadroPorta, colagem, portal, quadroFixo, colagemFixo, conferencia, embalagem, inicioInst, entregaFinal, ... } }
    filtros: { busca: '', status: '', estado: '', tipo: '' },
    loaded: false,
  };

  // Marcos de producao (chave + label + ordem).
  // 'calculado:true' significa que NAO eh editavel — vem de formula
  // baseada em Aprovacao + Prazo Contrato (Felipe sessao 2026-05-10).
  const MARCOS = [
    { id: 'medicao',       label: 'Medicao' },
    { id: 'liberacao',     label: 'Liberacao' },
    { id: 'aprovacao',     label: 'Aprovacao' },
    { id: 'cadOs',         label: 'CAD.OS' },
    { id: 'cut2d',         label: 'CUT2D' },
    { id: 'corteChapa',    label: 'Corte Chapa' },
    { id: 'quadroPorta',   label: 'Quadro Porta' },
    { id: 'colagem',       label: 'Colagem' },
    { id: 'portal',        label: 'Portal' },
    { id: 'quadroFixo',    label: 'Quadro Fixo' },
    { id: 'colagemFixo',   label: 'Colagem Fixo' },
    { id: 'conferencia',   label: 'Conferencia' },
    { id: 'embalagem',     label: 'Embalagem' },
    { id: 'inicioInst',    label: 'Inicio Inst.',  calculado: true },
    { id: 'entregaFinal',  label: 'Entrega Final', calculado: true },
  ];
  const PRAZO_CONTRATO_DEFAULT = 90;  // dias (Felipe: "geralmente 90 dias")
  // Felipe (sessao 2026-05-10): "inicio da instalacao se for instalacao
  // projetta 7 dias antes, e se for weiku 20 dias antes". Antes era
  // valor unico (15 dias) - agora depende de quemInstala.
  const ANTECEDENCIA_INST_PROJETTA = 7;
  const ANTECEDENCIA_INST_WEIKU    = 20;
  const QUEM_INSTALA_DEFAULT       = 'projetta';

  // Mapa etapa Kanban Producao -> label legivel
  const LABEL_STATUS = {
    'ag-liberacao-medidas':       'AG. LIBERACAO MEDIDAS',
    'ag-medicao':                 'AG. MEDICAO',
    'ag-fazer-liberacao':         'AG. FAZER LIBERACAO',
    'ag-aprovacao-final-cliente': 'AG. APROVACAO FINAL',
    'ag-os':                      'AG. O.S',
    'ag-producao':                'AG. PRODUCAO',
    'em-producao':                'EM PRODUCAO',
    'ag-conferencia':             'AG. CONFERENCIA',
    'ag-embalagem':               'AG. EMBALAGEM',
    'ag-embarque':                'AG. EMBARQUE',
    'finalizado':                 'FINALIZADO',
  };
  // Cor por status (tom mais suave que o card)
  const COR_STATUS = {
    'ag-liberacao-medidas':       '#8B5CF6',
    'ag-medicao':                 '#EF4444',
    'ag-fazer-liberacao':         '#EAB308',
    'ag-aprovacao-final-cliente': '#F97316',
    'ag-os':                      '#64748B',
    'ag-producao':                '#94A3B8',
    'em-producao':                '#3B82F6',
    'ag-conferencia':             '#0EA5E9',
    'ag-embalagem':               '#D946EF',
    'ag-embarque':                '#06B6D4',
    'finalizado':                 '#10B981',
  };

  // ============================================================
  // HELPERS
  // ============================================================
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /**
   * Felipe (sessao 2026-05-10 - bug 3): "clico dia 10/04 quando dou ok
   * aparece no 09/04".
   *
   * CAUSA RAIZ: new Date('2026-04-10') eh parseado como UTC midnight.
   * Brasil eh UTC-3, entao no JS local vira 2026-04-09 21:00 -> ao
   * formatar com toLocaleDateString('pt-BR') aparece 09/04/2026.
   *
   * FIX: parseISODate quebra a string e usa o construtor (y, m, d)
   * que cria a data em LOCAL time, evitando off-by-one.
   * E toISOString() (que usa UTC) eh trocado por fmtISODateLocal().
   */
  function parseISODate(iso) {
    if (!iso || typeof iso !== 'string') return new Date(NaN);
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return new Date(iso);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function fmtISODateLocal(d) {
    if (!d || isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  function fmtData(iso) {
    if (!iso) return '';
    try {
      const d = parseISODate(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('pt-BR');
    } catch (_) { return iso; }
  }
  // Felipe (sessao 2026-05-10): formula de entrega.
  // Entrega Final = Aprovacao + prazoDias (default 90)
  // Inicio Inst.  = Entrega Final - 7 (Projetta) ou 20 (Weiku)
  function calcEntregaFinal(aprovacaoISO, prazoDias) {
    if (!aprovacaoISO) return '';
    const dias = Number(prazoDias) || PRAZO_CONTRATO_DEFAULT;
    const d = parseISODate(aprovacaoISO);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + dias);
    return fmtISODateLocal(d);
  }
  function calcInicioInst(entregaFinalISO, quemInstala) {
    if (!entregaFinalISO) return '';
    const d = parseISODate(entregaFinalISO);
    if (isNaN(d.getTime())) return '';
    const dias = (quemInstala === 'weiku')
      ? ANTECEDENCIA_INST_WEIKU
      : ANTECEDENCIA_INST_PROJETTA;
    d.setDate(d.getDate() - dias);
    return fmtISODateLocal(d);
  }

  // ============================================================
  // FONTE: Kanban Producao (read-only)
  // ============================================================
  function listarTrabalhos() {
    let cards = [];
    try {
      const raw = Storage.scope('kanban-producao').get('leads');
      cards = Array.isArray(raw) ? raw : [];
    } catch (_) { cards = []; }
    return cards.map(card => {
      const delta = state.deltas[card.id] || {};
      // Felipe (sessao 2026-05-10): prazo contrato default 90 dias,
      // editavel por trabalho. Entrega Final = aprovacao + prazo.
      // Inicio Inst. = Entrega Final - antecedencia (Projetta=7, Weiku=20).
      const prazoDias = (delta.prazoContratoDias != null && delta.prazoContratoDias !== '')
        ? Number(delta.prazoContratoDias)
        : PRAZO_CONTRATO_DEFAULT;
      const quemInstala = (delta.quemInstala === 'weiku' || delta.quemInstala === 'projetta')
        ? delta.quemInstala
        : QUEM_INSTALA_DEFAULT;
      const aprovacao = delta.aprovacao || '';
      const entregaFinalCalc = calcEntregaFinal(aprovacao, prazoDias);
      const inicioInstCalc   = calcInicioInst(entregaFinalCalc, quemInstala);
      // Felipe (sessao 2026-05-10): "campo de ATP ainda esta vazio,
      // nao traga numero de AGP somente o ATP". A aba ATP do CRM/Kanban
      // tem o numero do contrato em card.atp.numeroAtp. AGP eh do orcamento
      // (separado). Buscar ATP dessa aba e cair pra '—' se nao preenchido
      // - NUNCA misturar com numeroAGP.
      const atpContrato = (card.atp && card.atp.numeroAtp) ? String(card.atp.numeroAtp).trim() : '';
      return {
        cardId:        card.id,
        crmLeadId:     card.crmLeadId || null,
        cliente:       card.cliente || '(sem nome)',
        atp:           atpContrato,
        agp:           card.numeroAGP || '',  // tambem disponivel em busca
        reserva:       card.numeroReserva || '',
        cidade:        card.cidade || '',
        estado:        card.estado || '',
        tipo:          card.porta_modelo || '',
        qtd:           1,
        statusId:      card.etapa || '',
        statusLabel:   LABEL_STATUS[card.etapa] || (card.etapa || '—').toUpperCase(),
        statusCor:     COR_STATUS[card.etapa] || '#64748B',
        prazoDias:     prazoDias,
        quemInstala:   quemInstala,
        // Deltas (marcos editaveis + calculados readonly)
        marcos: {
          medicao:       delta.medicao       || '',
          liberacao:     delta.liberacao     || '',
          aprovacao:     aprovacao,
          cadOs:         delta.cadOs         || '',
          cut2d:         delta.cut2d         || '',
          corteChapa:    delta.corteChapa    || '',
          quadroPorta:   delta.quadroPorta   || '',
          colagem:       delta.colagem       || '',
          portal:        delta.portal        || '',
          quadroFixo:    delta.quadroFixo    || '',
          colagemFixo:   delta.colagemFixo   || '',
          conferencia:   delta.conferencia   || '',
          embalagem:     delta.embalagem     || '',
          inicioInst:    inicioInstCalc,    // calculado
          entregaFinal:  entregaFinalCalc,  // calculado
        },
        observacoes: delta.observacoes || '',
      };
    });
  }

  // ============================================================
  // PERSISTENCIA
  // ============================================================
  function load() {
    if (state.loaded) return;
    const d = store.get('deltas');
    state.deltas = (d && typeof d === 'object') ? d : {};
    const f = store.get('filtros');
    if (f && typeof f === 'object') {
      Object.keys(state.filtros).forEach(k => {
        if (typeof f[k] === 'string') state.filtros[k] = f[k];
      });
    }
    state.loaded = true;
  }
  function saveDeltas()  { store.set('deltas', state.deltas); }
  function saveFiltros() { store.set('filtros', state.filtros); }

  function forceReload(container) {
    state.loaded = false;
    load();
    if (container) render(container);
  }

  function atualizarMarco(cardId, marcoId, valor) {
    const atual = state.deltas[cardId] || {};
    atual[marcoId] = valor;
    state.deltas[cardId] = atual;
    saveDeltas();
  }

  // ============================================================
  // FILTROS
  // ============================================================
  function aplicarFiltros(trabalhos) {
    const f = state.filtros;
    return trabalhos.filter(t => {
      if (f.busca) {
        const q = f.busca.toLowerCase();
        const hay = [t.cliente, t.atp, t.agp, t.cidade, t.estado, t.tipo]
          .map(x => String(x || '').toLowerCase()).join(' ');
        if (hay.indexOf(q) === -1) return false;
      }
      if (f.status && t.statusId !== f.status) return false;
      if (f.estado && t.estado !== f.estado) return false;
      if (f.tipo && t.tipo !== f.tipo) return false;
      return true;
    });
  }

  function listarUnicos(trabalhos, campo) {
    const set = new Set();
    trabalhos.forEach(t => { if (t[campo]) set.add(t[campo]); });
    return Array.from(set).sort();
  }

  // ============================================================
  // RENDER FILTROS
  // ============================================================
  function renderFiltros(todos) {
    const estados = listarUnicos(todos, 'estado');
    const tipos   = listarUnicos(todos, 'tipo');
    const statusList = Object.keys(LABEL_STATUS);
    return `
      <div class="pg-filtros">
        <input type="search" class="pg-filtro-busca" placeholder="Buscar cliente / ATP / cidade..."
               value="${escapeHtml(state.filtros.busca)}" data-filtro="busca" />
        <select data-filtro="status">
          <option value="">Todos status</option>
          ${statusList.map(id => `<option value="${id}" ${state.filtros.status === id ? 'selected' : ''}>${escapeHtml(LABEL_STATUS[id])}</option>`).join('')}
        </select>
        <select data-filtro="estado">
          <option value="">Todos estados</option>
          ${estados.map(e => `<option value="${escapeHtml(e)}" ${state.filtros.estado === e ? 'selected' : ''}>${escapeHtml(e)}</option>`).join('')}
        </select>
        <select data-filtro="tipo">
          <option value="">Todos tipos</option>
          ${tipos.map(t => `<option value="${escapeHtml(t)}" ${state.filtros.tipo === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
        </select>
        <button class="pg-filtro-limpar" data-action="limpar-filtros">Limpar filtros</button>
      </div>
    `;
  }

  // ============================================================
  // RENDER TABELA
  // ============================================================
  /**
   * Felipe (sessao 2026-05-10): "deixar status na coluna, ag, iniciado.
   * e depois colocar data termino de cad.os pra frente".
   *
   * Marcos MEDICAO, LIBERACAO, APROVACAO: input date simples (datas
   * que vem do cliente/comercial).
   *
   * Marcos CAD.OS pra frente (cadOs, cut2d, corteChapa, quadroPorta,
   * colagem, portal, quadroFixo, colagemFixo, conferencia, embalagem):
   * 3 estados ciclicos guardados em delta[m.id]:
   *   ''             -> botao "AG" (cinza)
   *   'iniciado'     -> input date inline + label "INICIADO" (amarelo)
   *   'YYYY-MM-DD'   -> botao com data formatada (verde, FINALIZADO)
   * Click cycling:
   *   AG       -> click          -> INICIADO
   *   INICIADO -> preenche data  -> FINALIZADO (data termino)
   *   FINAL    -> click+confirm  -> AG (resetar)
   */
  const MARCOS_DATA_SIMPLES = new Set(['medicao', 'liberacao', 'aprovacao']);

  function renderMarcoCell(t, m) {
    const val = t.marcos[m.id] || '';
    const cardId = escapeHtml(t.cardId);
    const marcoId = escapeHtml(m.id);

    if (m.calculado) {
      return `<td class="pg-td-marco pg-td-calc">
        <span class="pg-marco-calc" title="${val ? 'Calculado: Aprovacao + Prazo' : 'Preencha Aprovacao pra calcular'}">
          ${val ? fmtData(val) : '<em class="pg-calc-empty">—</em>'}
        </span>
      </td>`;
    }

    if (MARCOS_DATA_SIMPLES.has(m.id)) {
      // Felipe (sessao 2026-05-10): "deixe essa coluna tbm de forma
      // diferente assim como estao as primeiras outra cor".
      // Marcos comerciais (medicao, liberacao, aprovacao) ganham
      // classe pg-td-comercial — fundo verde-agua, distinto dos
      // marcos de producao (amarelo) e calculados (laranja).
      return `<td class="pg-td-marco pg-td-comercial">
        <input type="date" class="pg-marco-input"
               data-card-id="${cardId}" data-marco="${marcoId}"
               value="${escapeHtml(val)}" />
      </td>`;
    }

    // Marcos de producao (cad.os pra frente): 3 estados
    if (val === '') {
      return `<td class="pg-td-marco">
        <button class="pg-marco-btn pg-marco-ag"
                data-card-id="${cardId}" data-marco="${marcoId}" data-action="iniciar"
                title="Click pra marcar como INICIADO">AG</button>
      </td>`;
    }
    if (val === 'iniciado') {
      return `<td class="pg-td-marco">
        <div class="pg-marco-iniciado-wrap">
          <span class="pg-marco-iniciado-tag">INICIADO</span>
          <input type="date" class="pg-marco-data-termino"
                 data-card-id="${cardId}" data-marco="${marcoId}"
                 title="Preencha a data de termino" />
          <button class="pg-marco-cancel" data-card-id="${cardId}" data-marco="${marcoId}" data-action="cancelar"
                  title="Voltar pra AG">×</button>
        </div>
      </td>`;
    }
    // Tem data: FINALIZADO
    return `<td class="pg-td-marco">
      <button class="pg-marco-btn pg-marco-finalizado"
              data-card-id="${cardId}" data-marco="${marcoId}" data-action="resetar"
              title="Click pra resetar este marco (vai voltar pra AG)">${escapeHtml(fmtData(val))}</button>
    </td>`;
  }

  function renderLinhas(trabalhos) {
    return trabalhos.map(t => {
      const local = [t.cidade, t.estado].filter(Boolean).join('/');
      const marcosCells = MARCOS.map(m => renderMarcoCell(t, m)).join('');

      return `
        <tr data-card-id="${escapeHtml(t.cardId)}">
          <td class="pg-td-cli"><strong>${escapeHtml(t.cliente)}</strong></td>
          <td class="pg-td-atp">${escapeHtml(t.atp || '—')}</td>
          <td class="pg-td-status">
            <span class="pg-pill" style="background:${t.statusCor}20;border-color:${t.statusCor};color:${t.statusCor}">
              ${escapeHtml(t.statusLabel)}
            </span>
          </td>
          <td class="pg-td-cidade">${escapeHtml(local || '—')}</td>
          <td class="pg-td-tipo">${escapeHtml(t.tipo || '—')}</td>
          <td class="pg-td-qtd">${t.qtd}</td>
          <td class="pg-td-prazo">
            <input type="number" class="pg-prazo-input"
                   data-card-id="${escapeHtml(t.cardId)}"
                   value="${t.prazoDias}" min="1" max="365" step="1"
                   title="Prazo de contrato em dias (default 90)" />
          </td>
          <td class="pg-td-quem-instala">
            <select class="pg-quem-instala-select pg-quem-instala-${escapeHtml(t.quemInstala)}"
                    data-card-id="${escapeHtml(t.cardId)}"
                    title="Projetta: inicio = entrega - 7 dias. Weiku: entrega - 20 dias.">
              <option value="projetta" ${t.quemInstala === 'projetta' ? 'selected' : ''}>Projetta (-7d)</option>
              <option value="weiku"    ${t.quemInstala === 'weiku'    ? 'selected' : ''}>Weiku (-20d)</option>
            </select>
          </td>
          ${marcosCells}
        </tr>
      `;
    }).join('');
  }

  // Felipe (sessao 2026-05-10): "todas colunas alinhadas, nao faca isso
  // de desalinhar pq uma palavra eh maior que a outra". Larguras fixas
  // explicitas em <colgroup> garantem que as 2 tabelas (Aguardando
  // Liberacao + Em Producao) ficam identicamente alinhadas, mesmo que
  // os pills de status tenham tamanhos diferentes.
  const COL_WIDTHS = {
    cliente:     220,
    atp:         100,
    status:      220,
    cidade:      140,
    tipo:        100,
    qtd:          60,
    prazo:        90,
    quemInstala: 130,  // Felipe (sessao 2026-05-10): coluna nova
    marco:       120,  // todos os marcos tem mesma largura
  };

  function renderColgroup() {
    let cols = `
      <col style="width:${COL_WIDTHS.cliente}px">
      <col style="width:${COL_WIDTHS.atp}px">
      <col style="width:${COL_WIDTHS.status}px">
      <col style="width:${COL_WIDTHS.cidade}px">
      <col style="width:${COL_WIDTHS.tipo}px">
      <col style="width:${COL_WIDTHS.qtd}px">
      <col style="width:${COL_WIDTHS.prazo}px">
      <col style="width:${COL_WIDTHS.quemInstala}px">
    `;
    MARCOS.forEach(() => {
      cols += `<col style="width:${COL_WIDTHS.marco}px">`;
    });
    return `<colgroup>${cols}</colgroup>`;
  }

  function renderTabelaCompleta(trabalhos, titulo, classeExtra) {
    if (trabalhos.length === 0) return '';
    const colsMarco = MARCOS.map(m => {
      // Felipe (sessao 2026-05-10): 3 grupos de cor de header:
      //   - comercial (medicao/liberacao/aprovacao): pg-th-comercial (verde)
      //   - producao  (cad.os ate embalagem):        pg-th-marco (amarelo)
      //   - calculado (inicio inst, entrega final):  pg-th-calc (laranja)
      let classes = 'pg-th-marco';
      if (MARCOS_DATA_SIMPLES.has(m.id)) classes += ' pg-th-comercial';
      if (m.calculado)                   classes += ' pg-th-calc';
      const fxBadge = m.calculado
        ? ' <span class="pg-th-fx" title="Calculado: Aprovacao + Prazo (Inicio = Entrega - 15)">ƒ</span>'
        : '';
      return `<th class="${classes}">${escapeHtml(m.label)}${fxBadge}</th>`;
    }).join('');
    return `
      ${titulo ? `<div class="pg-secao-titulo ${classeExtra || ''}">${escapeHtml(titulo)} <span class="pg-secao-count">${trabalhos.length}</span></div>` : ''}
      <div class="pg-tabela-wrap ${classeExtra || ''}">
        <table class="pg-tabela">
          ${renderColgroup()}
          <thead>
            <tr>
              <th class="pg-th-cli">Cliente</th>
              <th>ATP</th>
              <th>Status Producao</th>
              <th>Cidade/UF</th>
              <th>Tipo</th>
              <th>Qtd</th>
              <th class="pg-th-prazo">Prazo (d)</th>
              <th class="pg-th-quem-instala">Quem Instala</th>
              ${colsMarco}
            </tr>
          </thead>
          <tbody>${renderLinhas(trabalhos)}</tbody>
        </table>
      </div>
    `;
  }

  function renderTabela(trabalhos) {
    if (trabalhos.length === 0) {
      return `<div class="pg-empty">Nenhum trabalho. Cards aparecem aqui automaticamente do Kanban Producao.</div>`;
    }
    // Felipe (sessao 2026-05-10): "deixe em producao em cima, aguardando
    // liberacao em baixo". Ordem invertida nesta entrega.
    const aguardandoLiberacao = trabalhos.filter(t => t.statusId === 'ag-liberacao-medidas');
    const emProducao          = trabalhos.filter(t => t.statusId !== 'ag-liberacao-medidas');
    // Felipe (sessao 2026-05-10): "ainda continua desalinhando as
    // colunas, mantenha todas alinhadas". Wrap UNICO compartilhado pelas
    // 2 tabelas - 1 scroll horizontal compartilhado garante que o
    // alinhamento visual se mantem mesmo com pills de tamanhos diferentes.
    return `
      <div class="pg-secoes-wrap">
        ${renderTabelaCompleta(emProducao,          'EM PRODUCAO',          'pg-secao-producao')}
        ${renderTabelaCompleta(aguardandoLiberacao, 'AGUARDANDO LIBERACAO', 'pg-secao-aguardando')}
      </div>
    `;
  }

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  function render(container) {
    load();
    const todos = listarTrabalhos();
    const trabalhos = aplicarFiltros(todos);

    container.innerHTML = `
      <div class="pg-toolbar">
        <div class="pg-info">
          <span class="pg-info-pill">${trabalhos.length} de ${todos.length} jobs</span>
          <span class="pg-info-hint">💡 status producao reflete a etapa do Kanban Producao automaticamente</span>
        </div>
      </div>
      ${renderFiltros(todos)}
      <div class="pg-content">
        ${renderTabela(trabalhos)}
      </div>
    `;

    // Filtros
    container.querySelectorAll('[data-filtro]').forEach(el => {
      const evt = el.tagName === 'INPUT' ? 'input' : 'change';
      el.addEventListener(evt, () => {
        state.filtros[el.dataset.filtro] = el.value;
        saveFiltros();
        render(container);
      });
    });
    const btnLimpar = container.querySelector('[data-action="limpar-filtros"]');
    if (btnLimpar) {
      btnLimpar.addEventListener('click', () => {
        state.filtros = { busca: '', status: '', estado: '', tipo: '' };
        saveFiltros();
        render(container);
      });
    }

    // Inputs de marcos: salva on change
    container.querySelectorAll('.pg-marco-input').forEach(input => {
      input.addEventListener('change', () => {
        atualizarMarco(input.dataset.cardId, input.dataset.marco, input.value);
        // Felipe: se o marco eh aprovacao, re-renderiza pra recalcular
        // Entrega Final + Inicio Inst (que dependem dele).
        if (input.dataset.marco === 'aprovacao') render(container);
      });
    });

    // Felipe (sessao 2026-05-10): 3 estados nos marcos de cad.os pra frente.
    // INICIAR (AG -> INICIADO)
    container.querySelectorAll('[data-action="iniciar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        atualizarMarco(btn.dataset.cardId, btn.dataset.marco, 'iniciado');
        render(container);
      });
    });

    // CANCELAR (INICIADO -> AG)
    container.querySelectorAll('[data-action="cancelar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        atualizarMarco(btn.dataset.cardId, btn.dataset.marco, '');
        render(container);
      });
    });

    // RESETAR (FINALIZADO -> AG, com confirm)
    container.querySelectorAll('[data-action="resetar"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.confirm('Resetar este marco?\n\nVai voltar para AG (sem data).')) {
          atualizarMarco(btn.dataset.cardId, btn.dataset.marco, '');
          render(container);
        }
      });
    });

    // INICIADO -> preenche data termino -> FINALIZADO
    container.querySelectorAll('.pg-marco-data-termino').forEach(input => {
      input.addEventListener('change', () => {
        if (!input.value) return; // ignora limpar
        atualizarMarco(input.dataset.cardId, input.dataset.marco, input.value);
        render(container);
      });
    });

    // Felipe (sessao 2026-05-10): input de prazo (default 90, editavel).
    // Mudou prazo -> recalcula entrega/inicio -> re-renderiza linha.
    container.querySelectorAll('.pg-prazo-input').forEach(input => {
      input.addEventListener('change', () => {
        const cardId = input.dataset.cardId;
        const dias = Math.max(1, Math.min(365, parseInt(input.value, 10) || PRAZO_CONTRATO_DEFAULT));
        const atual = state.deltas[cardId] || {};
        atual.prazoContratoDias = dias;
        state.deltas[cardId] = atual;
        saveDeltas();
        render(container);
      });
    });

    // Felipe (sessao 2026-05-10): select Quem Instala.
    // Projetta -> Inicio Inst = Entrega - 7 dias
    // Weiku    -> Inicio Inst = Entrega - 20 dias
    // Mudou -> recalcula Inicio Inst -> re-renderiza.
    container.querySelectorAll('.pg-quem-instala-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const cardId = sel.dataset.cardId;
        const valor = (sel.value === 'weiku' || sel.value === 'projetta') ? sel.value : QUEM_INSTALA_DEFAULT;
        const atual = state.deltas[cardId] || {};
        atual.quemInstala = valor;
        state.deltas[cardId] = atual;
        saveDeltas();
        render(container);
      });
    });
  }

  // ============================================================
  // API PUBLICA
  // ============================================================
  const ProducaoGeral = { render, forceReload, listar: listarTrabalhos };
  window.ProducaoGeral = ProducaoGeral;

  App.register('producao-geral', {
    render(container) {
      ProducaoGeral.forceReload(container);
      if (!container._realtimeSubscribedPG) {
        container._realtimeSubscribedPG = true;
        Events.on('db:realtime-sync', function() {
          if (window.App && window.App.state && window.App.state.currentModule !== 'producao-geral') return;
          ProducaoGeral.forceReload(container);
        });
        Events.on('db:change', function(payload) {
          if (!payload) return;
          if (payload.scope !== 'kanban-producao' && payload.scope !== 'producao-geral') return;
          if (window.App && window.App.state && window.App.state.currentModule !== 'producao-geral') return;
          ProducaoGeral.forceReload(container);
        });
        // Felipe (sessao 2026-05-10): cascade delete - quando Kanban
        // Producao deleta um card, limpa nossos deltas pra esse cardId
        // (evita lixo no storage). Cada modulo cuida do proprio scope.
        Events.on('kanban-producao:card-deleted', function(payload) {
          if (!payload || !payload.cardId) return;
          load();
          if (state.deltas[payload.cardId]) {
            delete state.deltas[payload.cardId];
            saveDeltas();
            console.log('[ProducaoGeral] delta removido por cascade-delete: ' + payload.cardId);
          }
          if (window.App && window.App.state && window.App.state.currentModule === 'producao-geral') {
            render(container);
          }
        });

        // Felipe (sessao 2026-05-10): "ao finalizar [no Equipes] ja
        // joga essa data em producao geral". Equipes emite evento
        // 'equipes:job-finalizado' { cardId, marcoPG, dataFim }.
        // PG aplica via atualizarMarco() - mesma funcao usada pelo
        // proprio click do user. Persistido em state.deltas.
        Events.on('equipes:job-finalizado', function(payload) {
          if (!payload || !payload.cardId || !payload.marcoPG || !payload.dataFim) return;
          load();
          atualizarMarco(payload.cardId, payload.marcoPG, payload.dataFim);
          console.log('[ProducaoGeral] marco', payload.marcoPG, '=', payload.dataFim,
                      'via Equipes (cardId:', payload.cardId, ')');
          if (window.App && window.App.state && window.App.state.currentModule === 'producao-geral') {
            render(container);
          }
        });
      }
    }
  });
})();
