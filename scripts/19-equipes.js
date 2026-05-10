/* 19-equipes.js — Calendario diario por equipe.
   Persistencia: Storage.scope('equipes'). CSS prefixo .eq-*.

   ============================================================
   MODULO: EQUIPES (Calendario Diario)
   ============================================================
   Replica da aba 'PROGRAMACAO 25-26' da planilha CONTROLE DE
   LIBERACAO 2025.xlsx.

   Linhas: dias do mes corrente
   Colunas: 9 equipes (Engenharia/Eric, Quadro/Luiz, Corte 8.5,
            Corte 5.0, Colagem 1/Igor, Colagem 2/Alex,
            Colagem 3/Michael, Portal/Pedro+Jose, Instalacao)
   Celulas: multiplos jobs (cards do Kanban Producao) por dia/equipe

   Felipe (sessao 2026-05-10):
   - 'multiplos jobs por equipe/dia (mais flexivel)'
   - 'agendar manual primeiro'

   Fluxo:
   1. Felipe ve a grade do mes corrente
   2. Click numa celula vazia (dia X equipe) -> modal com select
      de jobs do Kanban Producao
   3. Adiciona job -> aparece mini-card colorido na celula
   4. Click no '×' do mini-card -> remove agendamento
   5. Card deletado no Kanban Producao -> cascade limpa agendamentos
      referentes via Events.on('kanban-producao:card-deleted')

   Storage:
   Storage.scope('equipes').agendamentos = {
     [agendamentoId]: { cardId, equipeId, dia (YYYY-MM-DD), notas }
   }

   ATP eh o link: cada mini-card mostra o ATP + cliente + cor da
   etapa atual do Kanban Producao.
   ============================================================ */
(() => {
  'use strict';

  const EQUIPES = [
    { id: 'engenharia', label: 'ENGENHARIA', responsavel: 'Eric',         icon: '📐', cor: '#0EA5E9' },
    { id: 'quadro',     label: 'QUADRO',     responsavel: 'Luiz',         icon: '🔲', cor: '#8B5CF6' },
    { id: 'corte-85',   label: 'CORTE 8.5',  responsavel: '—',            icon: '✂️', cor: '#F59E0B' },
    { id: 'corte-50',   label: 'CORTE 5.0',  responsavel: '—',            icon: '✂️', cor: '#EAB308' },
    { id: 'colagem-1',  label: 'COLAGEM 1',  responsavel: 'Igor',         icon: '🛠️', cor: '#06B6D4' },
    { id: 'colagem-2',  label: 'COLAGEM 2',  responsavel: 'Alex',         icon: '🛠️', cor: '#14B8A6' },
    { id: 'colagem-3',  label: 'COLAGEM 3',  responsavel: 'Michael',      icon: '🛠️', cor: '#10B981' },
    { id: 'portal',     label: 'PORTAL',     responsavel: 'Pedro/Jose',   icon: '🚪', cor: '#F97316' },
    { id: 'instalacao', label: 'INSTALACAO', responsavel: '—',            icon: '🔧', cor: '#EF4444' },
  ];
  const equipeById = (id) => EQUIPES.find(e => e.id === id) || EQUIPES[0];

  // Cores das 11 etapas do Kanban Producao (sincronizadas)
  const COR_ETAPA = {
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

  const store = Storage.scope('equipes');
  const state = {
    agendamentos: {},      // { [id]: { cardId, equipeId, dia, notas } }
    mesAno: '',            // 'YYYY-MM' do mes em exibicao
    modalAberto: null,     // { tipo: 'add'|'edit', equipeId, dia, agendamentoId? }
    loaded: false,
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
  function mesAnoAtualISO() {
    const h = new Date();
    return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0');
  }
  function diasNoMes(mesAno) {
    const [y, m] = mesAno.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }
  function isoDia(mesAno, dia) {
    return mesAno + '-' + String(dia).padStart(2, '0');
  }
  function diaSemana(isoDate) {
    const d = new Date(isoDate);
    return ['DOM','SEG','TER','QUA','QUI','SEX','SAB'][d.getDay()];
  }
  function ehFimDeSemana(isoDate) {
    const d = new Date(isoDate);
    const dow = d.getDay();
    return dow === 0 || dow === 6;
  }
  function hojeISO() { return new Date().toISOString().slice(0, 10); }
  function genId() {
    return 'ag_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  function navegarMes(delta) {
    const [y, m] = state.mesAno.split('-').map(Number);
    const novo = new Date(y, m - 1 + delta, 1);
    return novo.getFullYear() + '-' + String(novo.getMonth() + 1).padStart(2, '0');
  }
  function labelMesAno(mesAno) {
    const [y, m] = mesAno.split('-').map(Number);
    const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
    return meses[m - 1] + ' ' + y;
  }

  // ============================================================
  // FONTE: cards do Kanban Producao (read-only)
  // ============================================================
  function listarCardsKanban() {
    try {
      const raw = Storage.scope('kanban-producao').get('leads');
      return Array.isArray(raw) ? raw : [];
    } catch (_) { return []; }
  }
  function cardById(cardId) {
    return listarCardsKanban().find(c => c.id === cardId) || null;
  }

  // ============================================================
  // PERSISTENCIA
  // ============================================================
  function load() {
    if (state.loaded) return;
    const ag = store.get('agendamentos');
    state.agendamentos = (ag && typeof ag === 'object') ? ag : {};
    const ma = store.get('mesAno');
    state.mesAno = (typeof ma === 'string' && /^\d{4}-\d{2}$/.test(ma)) ? ma : mesAnoAtualISO();
    state.loaded = true;
  }
  function saveAgendamentos() { store.set('agendamentos', state.agendamentos); }
  function saveMesAno()       { store.set('mesAno', state.mesAno); }

  function forceReload(container) {
    state.loaded = false;
    load();
    if (container) render(container);
  }

  /**
   * Lista agendamentos do mes atual indexado por (equipeId, dia).
   * Retorna Map<"equipeId|dia", agendamento[]>.
   */
  function indexarAgendamentosDoMes() {
    const idx = new Map();
    Object.entries(state.agendamentos).forEach(([id, ag]) => {
      if (!ag || !ag.dia || !ag.dia.startsWith(state.mesAno)) return;
      const key = ag.equipeId + '|' + ag.dia;
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key).push(Object.assign({ id }, ag));
    });
    return idx;
  }

  // ============================================================
  // RENDER CABECALHO
  // ============================================================
  function renderHeader() {
    return `
      <div class="eq-header">
        <div class="eq-nav">
          <button class="eq-nav-btn" data-nav="-1" title="Mes anterior">‹</button>
          <button class="eq-nav-mes" data-nav="hoje" title="Voltar pra hoje">
            <strong>${labelMesAno(state.mesAno)}</strong>
          </button>
          <button class="eq-nav-btn" data-nav="+1" title="Mes seguinte">›</button>
        </div>
        <div class="eq-equipes-legend">
          ${EQUIPES.map(e => `
            <span class="eq-equipe-chip" style="border-color:${e.cor};background:${e.cor}15;color:${e.cor}">
              <span class="eq-equipe-chip-icon">${e.icon}</span>
              <span class="eq-equipe-chip-text">
                <strong>${escapeHtml(e.label)}</strong>
                <small>${escapeHtml(e.responsavel)}</small>
              </span>
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================
  // RENDER GRADE
  // ============================================================
  function renderGrade() {
    const totalDias = diasNoMes(state.mesAno);
    const hoje = hojeISO();
    const idx = indexarAgendamentosDoMes();

    // Header row: dia + 9 colunas equipe
    const headerEquipes = EQUIPES.map(e => `
      <th class="eq-th-equipe" style="background:${e.cor}15;border-bottom-color:${e.cor}">
        <div class="eq-th-equipe-icon">${e.icon}</div>
        <div class="eq-th-equipe-label" style="color:${e.cor}">${escapeHtml(e.label)}</div>
        <div class="eq-th-equipe-resp">${escapeHtml(e.responsavel)}</div>
      </th>
    `).join('');

    // Linhas: 1 por dia do mes
    const linhas = [];
    for (let dia = 1; dia <= totalDias; dia++) {
      const iso = isoDia(state.mesAno, dia);
      const dow = diaSemana(iso);
      const fim = ehFimDeSemana(iso);
      const ehHoje = iso === hoje;

      const cellsEquipes = EQUIPES.map(e => {
        const ags = idx.get(e.id + '|' + iso) || [];
        const cardsHtml = ags.map(ag => {
          const card = cardById(ag.cardId);
          if (!card) return ''; // card deletado no kanban — cascade ja limpa, mas defesa
          const corEtapa = COR_ETAPA[card.etapa] || '#64748B';
          return `
            <div class="eq-job-card" style="border-left-color:${corEtapa};background:${corEtapa}15" title="${escapeHtml(card.cliente)} · ATP ${escapeHtml(card.numeroAGP || '—')}">
              <button class="eq-job-del" data-action="remover" data-ag-id="${escapeHtml(ag.id)}" title="Remover">×</button>
              <div class="eq-job-cliente">${escapeHtml(card.cliente || '(sem nome)')}</div>
              <div class="eq-job-atp">${escapeHtml(card.numeroAGP || '—')}</div>
            </div>
          `;
        }).join('');

        return `
          <td class="eq-td-cell ${fim ? 'eq-cell-weekend' : ''}" data-action="adicionar" data-equipe="${escapeHtml(e.id)}" data-dia="${iso}">
            ${cardsHtml}
            <button class="eq-add-btn" data-action="adicionar" data-equipe="${escapeHtml(e.id)}" data-dia="${iso}" title="Agendar job">+</button>
          </td>
        `;
      }).join('');

      linhas.push(`
        <tr class="${ehHoje ? 'eq-row-hoje' : ''} ${fim ? 'eq-row-weekend' : ''}">
          <td class="eq-td-dia">
            <div class="eq-dia-num">${dia}</div>
            <div class="eq-dia-dow">${dow}</div>
          </td>
          ${cellsEquipes}
        </tr>
      `);
    }

    return `
      <div class="eq-grade-wrap">
        <table class="eq-grade">
          <thead>
            <tr>
              <th class="eq-th-dia">Dia</th>
              ${headerEquipes}
            </tr>
          </thead>
          <tbody>${linhas.join('')}</tbody>
        </table>
      </div>
    `;
  }

  // ============================================================
  // MODAL DE AGENDAMENTO
  // ============================================================
  function renderModal() {
    if (!state.modalAberto) return '';
    const m = state.modalAberto;
    const equipe = equipeById(m.equipeId);
    const cards = listarCardsKanban();
    if (cards.length === 0) {
      return `
        <div class="eq-modal-backdrop" data-action="fechar-modal"></div>
        <div class="eq-modal" role="dialog" aria-modal="true">
          <div class="eq-modal-header" style="border-left:6px solid ${equipe.cor}">
            <h3>${escapeHtml(equipe.label)} · ${escapeHtml(fmtData(m.dia))}</h3>
            <button class="eq-modal-close" data-action="fechar-modal">×</button>
          </div>
          <div class="eq-modal-body">
            <p style="text-align:center;color:var(--text-muted,#6b7280);padding:20px;">
              Nenhum card no Kanban Producao pra agendar.<br>
              Importe leads no Kanban Producao primeiro.
            </p>
          </div>
        </div>
      `;
    }

    const opts = cards.map(c => {
      const label = (c.cliente || '(sem nome)') + ' · ' + (c.numeroAGP || 'sem ATP') + ' · ' + (c.etapa || '');
      return `<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`;
    }).join('');

    return `
      <div class="eq-modal-backdrop" data-action="fechar-modal"></div>
      <div class="eq-modal" role="dialog" aria-modal="true">
        <div class="eq-modal-header" style="border-left:6px solid ${equipe.cor}">
          <div>
            <h3>${escapeHtml(equipe.label)}</h3>
            <p class="eq-modal-sub">${escapeHtml(equipe.responsavel)} · ${escapeHtml(fmtData(m.dia))}</p>
          </div>
          <button class="eq-modal-close" data-action="fechar-modal">×</button>
        </div>
        <div class="eq-modal-body">
          <label class="eq-modal-label">Qual job esta equipe vai fazer?</label>
          <select class="eq-modal-select" id="eq-modal-card-select">
            ${opts}
          </select>
          <label class="eq-modal-label">Observacoes (opcional)</label>
          <textarea class="eq-modal-textarea" id="eq-modal-notas" rows="3" placeholder="Ex: levar peca extra, conferir antes..."></textarea>
        </div>
        <div class="eq-modal-footer">
          <button class="eq-btn-secundario" data-action="fechar-modal">Cancelar</button>
          <button class="eq-btn-primario" data-action="salvar-modal">Agendar</button>
        </div>
      </div>
    `;
  }

  function abrirModal(equipeId, dia) {
    state.modalAberto = { tipo: 'add', equipeId, dia };
  }
  function fecharModal() {
    state.modalAberto = null;
  }

  // ============================================================
  // OPERACOES
  // ============================================================
  function criarAgendamento(equipeId, dia, cardId, notas) {
    const id = genId();
    state.agendamentos[id] = { cardId, equipeId, dia, notas: notas || '' };
    saveAgendamentos();
  }
  function removerAgendamento(agId) {
    if (state.agendamentos[agId]) {
      delete state.agendamentos[agId];
      saveAgendamentos();
    }
  }

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  function render(container) {
    load();
    container.innerHTML = `
      ${renderHeader()}
      ${renderGrade()}
      <div class="eq-modal-mount" id="eq-modal-mount">${renderModal()}</div>
    `;

    // Navegacao
    container.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.nav;
        if (v === 'hoje') {
          state.mesAno = mesAnoAtualISO();
        } else {
          state.mesAno = navegarMes(Number(v));
        }
        saveMesAno();
        render(container);
      });
    });

    // Adicionar agendamento (click na cell ou no '+')
    container.querySelectorAll('[data-action="adicionar"]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Evita conflito quando clica em mini-card dentro da cell
        if (e.target.closest('.eq-job-card')) return;
        e.stopPropagation();
        abrirModal(el.dataset.equipe, el.dataset.dia);
        render(container);
      });
    });

    // Remover agendamento
    container.querySelectorAll('[data-action="remover"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.confirm('Remover este agendamento?')) {
          removerAgendamento(btn.dataset.agId);
          render(container);
        }
      });
    });

    // Modal handlers
    const mount = container.querySelector('#eq-modal-mount');
    if (mount && state.modalAberto) {
      mount.querySelectorAll('[data-action="fechar-modal"]').forEach(b => {
        b.addEventListener('click', () => {
          fecharModal();
          render(container);
        });
      });
      const btnSalvar = mount.querySelector('[data-action="salvar-modal"]');
      if (btnSalvar) {
        btnSalvar.addEventListener('click', () => {
          const sel = mount.querySelector('#eq-modal-card-select');
          const notas = mount.querySelector('#eq-modal-notas');
          if (sel && sel.value) {
            const m = state.modalAberto;
            criarAgendamento(m.equipeId, m.dia, sel.value, notas ? notas.value : '');
            fecharModal();
            render(container);
          }
        });
      }
      // ESC fecha
      document.addEventListener('keydown', _escHandler);
    } else {
      document.removeEventListener('keydown', _escHandler);
    }
  }
  function _escHandler(e) {
    if (e.key === 'Escape') {
      fecharModal();
      const container = document.querySelector('.main-content') || document.body;
      render(container);
    }
  }

  // ============================================================
  // API PUBLICA
  // ============================================================
  const Equipes = { render, forceReload, listar: () => state.agendamentos };
  window.Equipes = Equipes;

  App.register('equipes', {
    render(container) {
      Equipes.forceReload(container);
      if (!container._realtimeSubscribedEq) {
        container._realtimeSubscribedEq = true;

        // Realtime cloud
        Events.on('db:realtime-sync', function() {
          if (window.App && window.App.state && window.App.state.currentModule !== 'equipes') return;
          if (state.modalAberto) return;
          Equipes.forceReload(container);
        });

        // Mudou Kanban Producao -> re-renderiza (cor/cliente do mini-card)
        Events.on('db:change', function(payload) {
          if (!payload) return;
          if (payload.scope !== 'kanban-producao' && payload.scope !== 'equipes') return;
          if (window.App && window.App.state && window.App.state.currentModule !== 'equipes') return;
          if (state.modalAberto) return;
          Equipes.forceReload(container);
        });

        // Cascade delete: card removido no Kanban -> limpa agendamentos
        Events.on('kanban-producao:card-deleted', function(payload) {
          if (!payload || !payload.cardId) return;
          load();
          let removidos = 0;
          Object.keys(state.agendamentos).forEach(id => {
            if (state.agendamentos[id].cardId === payload.cardId) {
              delete state.agendamentos[id];
              removidos++;
            }
          });
          if (removidos > 0) {
            saveAgendamentos();
            console.log('[Equipes] ' + removidos + ' agendamento(s) removido(s) por cascade-delete');
            if (window.App && window.App.state && window.App.state.currentModule === 'equipes') {
              render(container);
            }
          }
        });
      }
    }
  });
})();
