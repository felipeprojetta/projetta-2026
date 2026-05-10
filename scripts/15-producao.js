/* 15-producao.js — Modulo Producao (Kanban + Lista de Ordens de Producao).
   Persistencia: Storage.scope('producao'). CSS prefixo .prod-*.

   Etapas (ordem inicial conforme Felipe; reordenavel via drag das colunas):
     ag-producao -> ag-os -> em-producao ->
     finalizado -> ag-conferencia -> ag-embarque ->
     ag-liberacao-medidas -> colagem -> ag-embalagem ->
     ag-recalculo -> ag-fazer-liberacao ->
     ag-aprovacao-final-cliente -> ag-medicao

   ============================================================
   MODULO: PRODUCAO (Kanban + Lista)
   ============================================================
   Isolado: Storage.scope('producao'), CSS prefixado .prod-*.
   Nao chama funcoes de outros modulos. Tudo encapsulado na IIFE.

   Drag-and-drop:
     - cards entre colunas (mover OP de etapa)
     - reordenar COLUNAS arrastando o header (Felipe pediu pra
       movimentar pra um lado/outro pra colocar na sequencia certa)
   ============================================================ */
(() => {
  'use strict';

  // Etapas DEFAULT (ordem inicial). Felipe pode reordenar via drag.
  // A ordem persistida fica em Storage.scope('producao').get('etapasOrder').
  const ETAPAS_DEFAULT = [
    { id: 'ag-producao',                label: 'AG. PRODUCAO',                color: '#94A3B8' },
    { id: 'ag-os',                      label: 'AG. O.S',                     color: '#64748B' },
    { id: 'em-producao',                label: 'EM PRODUCAO',                 color: '#3B82F6' },
    { id: 'finalizado',                 label: 'FINALIZADO',                  color: '#10B981' },
    { id: 'ag-conferencia',             label: 'AG. CONFERENCIA',             color: '#0EA5E9' },
    { id: 'ag-embarque',                label: 'AG. EMBARQUE',                color: '#06B6D4' },
    { id: 'ag-liberacao-medidas',       label: 'AG. LIBERACAO DE MEDIDAS',    color: '#8B5CF6' },
    { id: 'colagem',                    label: 'COLAGEM',                     color: '#A855F7' },
    { id: 'ag-embalagem',               label: 'AG. EMBALAGEM',               color: '#D946EF' },
    { id: 'ag-recalculo',               label: 'AG. RECALCULO',               color: '#F59E0B' },
    { id: 'ag-fazer-liberacao',         label: 'AG. FAZER LIBERACAO',         color: '#EAB308' },
    { id: 'ag-aprovacao-final-cliente', label: 'AG. APROVACAO FINAL CLIENTE', color: '#F97316' },
    { id: 'ag-medicao',                 label: 'AG. MEDICAO',                 color: '#EF4444' },
  ];

  const ETAPAS_DEFAULT_IDS = ETAPAS_DEFAULT.map(e => e.id);

  // Cards SEED (placeholders). Substituidos por OPs reais quando integrarmos
  // com Orcamentos Aprovados (etapa 'orcamento-aprovado' do CRM).
  const SEED_OPS = [
    { id: 'op_demo_01', cliente: 'Cliente Exemplo 1', numeroOP: 'OP-2026-001', etapa: 'ag-producao', criadoEm: '2026-05-08' },
    { id: 'op_demo_02', cliente: 'Cliente Exemplo 2', numeroOP: 'OP-2026-002', etapa: 'em-producao', criadoEm: '2026-05-09' },
    { id: 'op_demo_03', cliente: 'Cliente Exemplo 3', numeroOP: 'OP-2026-003', etapa: 'finalizado',  criadoEm: '2026-05-09' },
  ];

  const store = Storage.scope('producao');
  const state = {
    view: 'kanban',  // 'kanban' | 'lista'
    ops: [],
    etapas: ETAPAS_DEFAULT.slice(), // ordem corrente (pode ser reordenada)
    loaded: false,
  };

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

  function load() {
    if (state.loaded) return;
    // OPs
    const opsSalvos = store.get('ops');
    state.ops = Array.isArray(opsSalvos) && opsSalvos.length > 0
      ? opsSalvos
      : SEED_OPS.slice();
    // Ordem das etapas (drag). Sempre filtra pra IDs validos do default
    // (assim, se removermos uma etapa do codigo, ordem antiga ainda funciona).
    const ordemSalva = store.get('etapasOrder');
    if (Array.isArray(ordemSalva) && ordemSalva.length > 0) {
      const byId = new Map(ETAPAS_DEFAULT.map(e => [e.id, e]));
      const out = [];
      ordemSalva.forEach(id => { if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); } });
      // etapas novas (nao na ordem salva) vao pro final
      byId.forEach(e => out.push(e));
      state.etapas = out;
    } else {
      state.etapas = ETAPAS_DEFAULT.slice();
    }
    // View persistida
    const viewSalva = store.get('view');
    if (viewSalva === 'kanban' || viewSalva === 'lista') state.view = viewSalva;
    state.loaded = true;
  }

  function saveOps() {
    store.set('ops', state.ops);
  }
  function saveEtapasOrder() {
    store.set('etapasOrder', state.etapas.map(e => e.id));
  }
  function saveView() {
    store.set('view', state.view);
  }

  function forceReload(container) {
    state.loaded = false;
    load();
    if (container) render(container);
  }

  // ============================================================
  // RENDER KANBAN
  // ============================================================
  function renderKanban() {
    const cols = state.etapas.map(et => {
      const opsCol = state.ops.filter(o => o.etapa === et.id);
      const cards = opsCol.map(o => `
        <div class="prod-card" draggable="true" data-id="${escapeHtml(o.id)}">
          <div class="prod-card-titulo">${escapeHtml(o.cliente || '(sem cliente)')}</div>
          ${o.numeroOP ? `<div class="prod-card-numero">${escapeHtml(o.numeroOP)}</div>` : ''}
          ${o.criadoEm ? `<div class="prod-card-data">📅 ${escapeHtml(fmtData(o.criadoEm))}</div>` : ''}
        </div>
      `).join('');
      return `
        <div class="prod-column" data-etapa="${escapeHtml(et.id)}">
          <div class="prod-column-header" draggable="true" data-etapa-header="${escapeHtml(et.id)}" title="Arraste o cabecalho pra reordenar">
            <span class="prod-column-dot" style="background:${escapeHtml(et.color)}"></span>
            <span class="prod-column-title">${escapeHtml(et.label)}</span>
            <span class="prod-column-count">${opsCol.length}</span>
          </div>
          <div class="prod-column-body">${cards}</div>
        </div>
      `;
    }).join('');
    return `<div class="prod-kanban">${cols}</div>`;
  }

  // ============================================================
  // RENDER LISTA
  // ============================================================
  function renderLista() {
    const linhas = state.ops.map(o => {
      const et = state.etapas.find(e => e.id === o.etapa) || { label: o.etapa, color: '#999' };
      return `
        <tr data-id="${escapeHtml(o.id)}">
          <td>${escapeHtml(o.numeroOP || '—')}</td>
          <td>${escapeHtml(o.cliente || '(sem cliente)')}</td>
          <td>
            <span class="prod-tag" style="background:${escapeHtml(et.color)}20;border-color:${escapeHtml(et.color)};color:${escapeHtml(et.color)}">
              ${escapeHtml(et.label)}
            </span>
          </td>
          <td>${escapeHtml(fmtData(o.criadoEm))}</td>
        </tr>
      `;
    }).join('');
    return `
      <div class="prod-lista-wrap">
        <table class="prod-lista">
          <thead>
            <tr>
              <th>Numero OP</th>
              <th>Cliente</th>
              <th>Etapa</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>${linhas || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhuma ordem de producao</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  function render(container) {
    load();
    container.innerHTML = `
      <div class="prod-toolbar">
        <div class="prod-view-toggle">
          <button data-view="kanban" class="${state.view === 'kanban' ? 'is-active' : ''}">Kanban</button>
          <button data-view="lista"  class="${state.view === 'lista'  ? 'is-active' : ''}">Lista</button>
        </div>
        <div class="prod-toolbar-info">
          <span class="prod-info-pill">${state.ops.length} ordens · ${state.etapas.length} etapas</span>
          <span class="prod-info-hint">💡 arraste o cabecalho da coluna pra reordenar</span>
        </div>
      </div>
      <div class="prod-content">
        ${state.view === 'kanban' ? renderKanban() : renderLista()}
      </div>
    `;

    // Toggle Kanban / Lista
    container.querySelectorAll('.prod-view-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view;
        if (v === state.view) return;
        state.view = v;
        saveView();
        render(container);
      });
    });

    // Drag-and-drop dos CARDS entre colunas
    if (state.view === 'kanban') {
      bindCardDrag(container);
      bindColumnReorder(container);
    }
  }

  function bindCardDrag(container) {
    const cards = container.querySelectorAll('.prod-card');
    const cols  = container.querySelectorAll('.prod-column');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-prod-card', card.dataset.id);
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        cols.forEach(c => c.classList.remove('is-drop-target'));
      });
    });

    cols.forEach(col => {
      col.addEventListener('dragover', (e) => {
        // So aceita card; nao colide com drag de coluna
        if (!e.dataTransfer.types.includes('application/x-prod-card')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('is-drop-target');
      });
      col.addEventListener('dragleave', () => col.classList.remove('is-drop-target'));
      col.addEventListener('drop', (e) => {
        if (!e.dataTransfer.types.includes('application/x-prod-card')) return;
        e.preventDefault();
        col.classList.remove('is-drop-target');
        const cardId = e.dataTransfer.getData('application/x-prod-card');
        const novaEtapa = col.dataset.etapa;
        if (!cardId || !novaEtapa) return;
        const op = state.ops.find(o => o.id === cardId);
        if (!op || op.etapa === novaEtapa) return;
        op.etapa = novaEtapa;
        saveOps();
        render(container);
      });
    });
  }

  function bindColumnReorder(container) {
    const headers = container.querySelectorAll('.prod-column-header');
    const cols    = container.querySelectorAll('.prod-column');

    headers.forEach(h => {
      h.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-prod-col', h.dataset.etapaHeader);
        const col = h.closest('.prod-column');
        if (col) col.classList.add('is-col-dragging');
      });
      h.addEventListener('dragend', () => {
        cols.forEach(c => c.classList.remove('is-col-dragging', 'is-col-drop-target'));
      });
    });

    cols.forEach(col => {
      col.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes('application/x-prod-col')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('is-col-drop-target');
      });
      col.addEventListener('dragleave', () => col.classList.remove('is-col-drop-target'));
      col.addEventListener('drop', (e) => {
        if (!e.dataTransfer.types.includes('application/x-prod-col')) return;
        e.preventDefault();
        col.classList.remove('is-col-drop-target');
        const fromId = e.dataTransfer.getData('application/x-prod-col');
        const toId   = col.dataset.etapa;
        if (!fromId || !toId || fromId === toId) return;
        const fromIdx = state.etapas.findIndex(et => et.id === fromId);
        const toIdx   = state.etapas.findIndex(et => et.id === toId);
        if (fromIdx < 0 || toIdx < 0) return;
        const [moved] = state.etapas.splice(fromIdx, 1);
        state.etapas.splice(toIdx, 0, moved);
        saveEtapasOrder();
        render(container);
      });
    });
  }

  // Expoe API publica (para futuras integracoes — ex: orcamento aprovado
  // criar OP nova; CRM mostrar contagem; etc).
  const Producao = {
    render,
    forceReload,
    listar: () => state.ops.slice(),
  };
  window.Producao = Producao;

  // ============================================================
  // Registra modulo Kanban Producao no App
  // ============================================================
  App.register('kanban-producao', {
    render(container) {
      Producao.forceReload(container);
      // Realtime sync (mesma estrategia do CRM/Orcamento)
      if (!container._realtimeSubscribedProd) {
        container._realtimeSubscribedProd = true;
        Events.on('db:realtime-sync', function() {
          if (window.App && window.App.state && window.App.state.currentModule !== 'kanban-producao') return;
          Producao.forceReload(container);
        });
      }
    }
  });
})();
