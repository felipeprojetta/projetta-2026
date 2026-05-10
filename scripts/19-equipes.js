/* 19-equipes.js — Calendario diario por equipe.
   Persistencia: Storage.scope('equipes'). CSS prefixo .eq-*.

   ============================================================
   MODULO: EQUIPES (Calendario Diario)
   ============================================================
   Replica da aba 'PROGRAMAÇÃO 25-26' da planilha CONTROLE DE
   LIBERACAO 2025.xlsx. Mostra o que cada equipe esta fazendo
   em cada dia (Eric, Luiz, Igor, Alex, Michael, Pedro/Jose,
   Instalacao).

   STATUS: PLACEHOLDER (esqueleto preparado, implementacao na
   proxima entrega). Felipe pediu junto de outros modulos.
   ============================================================ */
(() => {
  'use strict';

  const EQUIPES = [
    { id: 'engenharia', label: 'ENGENHARIA',     responsavel: 'Eric',         icon: '📐' },
    { id: 'quadro',     label: 'QUADRO',         responsavel: 'Luiz',         icon: '🔲' },
    { id: 'corte-85',   label: 'CORTE 8.5',      responsavel: '—',            icon: '✂️' },
    { id: 'corte-50',   label: 'CORTE 5.0',      responsavel: '—',            icon: '✂️' },
    { id: 'colagem-1',  label: 'COLAGEM 1',      responsavel: 'Igor',         icon: '🛠️' },
    { id: 'colagem-2',  label: 'COLAGEM 2',      responsavel: 'Alex',         icon: '🛠️' },
    { id: 'colagem-3',  label: 'COLAGEM 3',      responsavel: 'Michael',      icon: '🛠️' },
    { id: 'portal',     label: 'PORTAL',         responsavel: 'Pedro / Jose', icon: '🚪' },
    { id: 'instalacao', label: 'INSTALACAO',     responsavel: '—',            icon: '🔧' },
  ];

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(container) {
    container.innerHTML = `
      <div class="eq-toolbar">
        <div class="eq-info-pill">9 equipes · calendario diario</div>
        <div class="eq-info-hint">📌 Esqueleto pronto · implementacao completa na proxima entrega</div>
      </div>
      <div class="eq-equipes-grid">
        ${EQUIPES.map(e => `
          <div class="eq-card">
            <div class="eq-card-icon">${e.icon}</div>
            <div class="eq-card-label">${escapeHtml(e.label)}</div>
            <div class="eq-card-resp">${escapeHtml(e.responsavel)}</div>
          </div>
        `).join('')}
      </div>
      <div class="eq-placeholder">
        <h3>Calendario Diario por Equipe</h3>
        <p>
          Esta tela vai replicar a aba <strong>PROGRAMACAO 25-26</strong> da
          sua planilha — calendario com 1 linha por dia e 1 coluna por equipe.
          Cada celula mostra qual cliente/ATP aquela equipe esta fazendo
          naquele dia.
        </p>
        <p>
          <strong>Linkado por ATP:</strong> os jobs aparecem aqui automaticamente
          conforme entram no Kanban Producao. Voce arrasta o job pra equipe/dia
          correspondente. O status producao reflete a etapa do Kanban.
        </p>
        <ul>
          <li>Eixo X (linhas): dias do calendario</li>
          <li>Eixo Y (colunas): 9 equipes (acima)</li>
          <li>Celulas: clientes/ATPs (drag-and-drop pra reagendar)</li>
          <li>Filtros: mes, equipe, ATP especifico</li>
          <li>Realtime sync com Kanban Producao + Producao Geral + Agenda Obras</li>
        </ul>
      </div>
    `;
  }

  function forceReload(container) { render(container); }

  const Equipes = { render, forceReload };
  window.Equipes = Equipes;

  App.register('equipes', {
    render(container) { Equipes.forceReload(container); }
  });
})();
