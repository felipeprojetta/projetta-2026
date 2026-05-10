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
  const ANTECEDENCIA_INSTALACAO = 15; // dias (Felipe: "15 dias antes do prazo final")

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
  function fmtData(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('pt-BR');
    } catch (_) { return iso; }
  }
  // Felipe (sessao 2026-05-10): formula de entrega.
  // Entrega Final = Aprovacao + prazoDias (default 90)
  // Inicio Inst.  = Entrega Final - 15 dias (default)
  function calcEntregaFinal(aprovacaoISO, prazoDias) {
    if (!aprovacaoISO) return '';
    const dias = Number(prazoDias) || PRAZO_CONTRATO_DEFAULT;
    const d = new Date(aprovacaoISO);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }
  function calcInicioInst(entregaFinalISO) {
    if (!entregaFinalISO) return '';
    const d = new Date(entregaFinalISO);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - ANTECEDENCIA_INSTALACAO);
    return d.toISOString().slice(0, 10);
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
      // Inicio Inst. = Entrega Final - 15 dias.
      const prazoDias = (delta.prazoContratoDias != null && delta.prazoContratoDias !== '')
        ? Number(delta.prazoContratoDias)
        : PRAZO_CONTRATO_DEFAULT;
      const aprovacao = delta.aprovacao || '';
      const entregaFinalCalc = calcEntregaFinal(aprovacao, prazoDias);
      const inicioInstCalc   = calcInicioInst(entregaFinalCalc);
      return {
        cardId:        card.id,
        crmLeadId:     card.crmLeadId || null,
        cliente:       card.cliente || '(sem nome)',
        atp:           card.numeroAGP || '',
        reserva:       card.numeroReserva || '',
        cidade:        card.cidade || '',
        estado:        card.estado || '',
        tipo:          card.porta_modelo || '',
        qtd:           1,
        statusId:      card.etapa || '',
        statusLabel:   LABEL_STATUS[card.etapa] || (card.etapa || '—').toUpperCase(),
        statusCor:     COR_STATUS[card.etapa] || '#64748B',
        prazoDias:     prazoDias,
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
        const hay = [t.cliente, t.atp, t.cidade, t.estado, t.tipo]
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
  function renderLinhas(trabalhos) {
    return trabalhos.map(t => {
      const local = [t.cidade, t.estado].filter(Boolean).join('/');
      const marcosCells = MARCOS.map(m => {
        const val = t.marcos[m.id] || '';
        if (m.calculado) {
          // Felipe: Entrega Final e Inicio Inst sao CALCULADOS (readonly).
          // Mostra a data formatada BR. Se nao tem aprovacao, mostra '—'.
          return `<td class="pg-td-marco pg-td-calc">
            <span class="pg-marco-calc" title="${val ? 'Calculado a partir da Aprovacao + Prazo' : 'Preencha Aprovacao pra calcular'}">
              ${val ? fmtData(val) : '<em class="pg-calc-empty">—</em>'}
            </span>
          </td>`;
        }
        return `<td class="pg-td-marco">
          <input type="date" class="pg-marco-input"
                 data-card-id="${escapeHtml(t.cardId)}"
                 data-marco="${escapeHtml(m.id)}"
                 value="${escapeHtml(val)}" />
        </td>`;
      }).join('');

      return `
        <tr data-card-id="${escapeHtml(t.cardId)}">
          <td class="pg-td-cli"><strong>${escapeHtml(t.cliente)}</strong></td>
          <td class="pg-td-atp">${escapeHtml(t.atp || '—')}</td>
          <td class="pg-td-status">
            <span class="pg-pill" style="background:${t.statusCor}20;border-color:${t.statusCor};color:${t.statusCor}">
              ${escapeHtml(t.statusLabel)}
            </span>
          </td>
          <td>${escapeHtml(local || '—')}</td>
          <td>${escapeHtml(t.tipo || '—')}</td>
          <td class="pg-td-qtd">${t.qtd}</td>
          <td class="pg-td-prazo">
            <input type="number" class="pg-prazo-input"
                   data-card-id="${escapeHtml(t.cardId)}"
                   value="${t.prazoDias}" min="1" max="365" step="1"
                   title="Prazo de contrato em dias (default 90)" />
          </td>
          ${marcosCells}
        </tr>
      `;
    }).join('');
  }

  function renderTabelaCompleta(trabalhos, titulo, classeExtra) {
    if (trabalhos.length === 0) return '';
    const colsMarco = MARCOS.map(m => `<th class="pg-th-marco${m.calculado ? ' pg-th-calc' : ''}">${escapeHtml(m.label)}${m.calculado ? ' <span class="pg-th-fx" title="Calculado: Aprovacao + Prazo (Inicio = Entrega - 15)">ƒ</span>' : ''}</th>`).join('');
    return `
      ${titulo ? `<div class="pg-secao-titulo ${classeExtra || ''}">${escapeHtml(titulo)} <span class="pg-secao-count">${trabalhos.length}</span></div>` : ''}
      <div class="pg-tabela-wrap ${classeExtra || ''}">
        <table class="pg-tabela">
          <thead>
            <tr>
              <th class="pg-th-cli">Cliente</th>
              <th>ATP</th>
              <th>Status Producao</th>
              <th>Cidade/UF</th>
              <th>Tipo</th>
              <th>Qtd</th>
              <th class="pg-th-prazo">Prazo (d)</th>
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
    // Felipe (sessao 2026-05-10): "tudo que for aguardando liberacao
    // fica separado dos demais". Bloco superior = AG. LIBERACAO MEDIDAS.
    const aguardandoLiberacao = trabalhos.filter(t => t.statusId === 'ag-liberacao-medidas');
    const emProducao          = trabalhos.filter(t => t.statusId !== 'ag-liberacao-medidas');
    return `
      ${renderTabelaCompleta(aguardandoLiberacao, 'AGUARDANDO LIBERACAO', 'pg-secao-aguardando')}
      ${renderTabelaCompleta(emProducao,          'EM PRODUCAO',          'pg-secao-producao')}
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
      }
    }
  });
})();
