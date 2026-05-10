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

  // Felipe (sessao 2026-05-10): "multiplos marcos por equipe (mais
  // flexivel)". Cada equipe pode mapear pra varios marcos da Producao
  // Geral. Quando o user vai INICIAR/FINALIZAR um job na cell, se
  // tiver mais de 1 marco a UI pergunta qual.
  // 'instalacao' nao mapeia - eh agendamento puro (Agenda Obras).
  const EQUIPES = [
    { id: 'engenharia', label: 'ENGENHARIA', responsavel: 'Eric',         icon: '📐', cor: '#0EA5E9', marcos: ['cadOs'] },
    { id: 'quadro',     label: 'QUADRO',     responsavel: 'Luiz',         icon: '🔲', cor: '#8B5CF6', marcos: ['quadroPorta', 'quadroFixo'] },
    { id: 'corte-85',   label: 'CORTE 8.5',  responsavel: '—',            icon: '✂️', cor: '#F59E0B', marcos: ['corteChapa'] },
    { id: 'corte-50',   label: 'CORTE 5.0',  responsavel: '—',            icon: '✂️', cor: '#EAB308', marcos: ['cut2d'] },
    { id: 'colagem-1',  label: 'COLAGEM 1',  responsavel: 'Igor',         icon: '🛠️', cor: '#06B6D4', marcos: ['colagem', 'colagemFixo'] },
    { id: 'colagem-2',  label: 'COLAGEM 2',  responsavel: 'Alex',         icon: '🛠️', cor: '#14B8A6', marcos: ['colagem', 'colagemFixo'] },
    { id: 'colagem-3',  label: 'COLAGEM 3',  responsavel: 'Michael',      icon: '🛠️', cor: '#10B981', marcos: ['colagem', 'colagemFixo'] },
    { id: 'portal',     label: 'PORTAL',     responsavel: 'Pedro/Jose',   icon: '🚪', cor: '#F97316', marcos: ['portal'] },
    { id: 'instalacao', label: 'INSTALACAO', responsavel: '—',            icon: '🔧', cor: '#EF4444', marcos: [] },
  ];

  // Felipe (sessao 2026-05-10): "ao colocar ali uma tarefa coloco que
  // comecou, na sexta depois pulo pra terca, preciso de alguma forma
  // ali informar que o corte de chapa acabou na terca ai fica verde,
  // e ja joga essa data em producao geral". Estados:
  //   'iniciado'    -> mini-card amarelo, botao verde "Finalizar"
  //   'finalizado'  -> mini-card verde, sem botoes (mostra data fim)
  // ag.marcoPG = qual marco da Producao Geral foi afetado (cadOs,
  // quadroPorta, etc). Ao finalizar, dispara evento que Producao
  // Geral escuta e seta delta[cardId][marcoPG] = dataFim.
  // Defaulto novo agendamento pra 'iniciado' (Felipe disse 'coloco
  // que comecou' - significa que ao agendar ja eh inicio).
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

  // Felipe (sessao 2026-05-10): "so deve aparecer ai os itens que
  // estiverem em producao, esse Mhamad Kamel Fayad esta aguardando
  // liberacao entao nao deve aparecer ali". ag-liberacao-medidas e
  // ag-medicao sao pre-producao. Producao real comeca em
  // ag-fazer-liberacao em diante.
  const ETAPAS_PRE_PRODUCAO = new Set(['ag-liberacao-medidas', 'ag-medicao']);

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
  /**
   * Felipe (sessao 2026-05-10 - bug 2): 'ultima imagem 17 de abril e
   * sexta feira, ali mostra quinta feira'.
   *
   * CAUSA RAIZ: new Date('2026-04-17') eh parseado como UTC midnight.
   * Brasil eh UTC-3, entao no JS local vira 2026-04-16 21:00 -> getDay()
   * retorna QUI quando deveria ser SEX.
   *
   * FIX: parseISODate quebra a string e usa o construtor (y, m, d) que
   * cria a data em local time, evitando off-by-one.
   */
  function parseISODate(iso) {
    if (!iso || typeof iso !== 'string') return new Date(NaN);
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return new Date(iso);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtData(iso) {
    if (!iso) return '';
    try {
      const d = parseISODate(iso);
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
    const d = parseISODate(isoDate);
    return ['DOM','SEG','TER','QUA','QUI','SEX','SAB'][d.getDay()];
  }
  function ehFimDeSemana(isoDate) {
    const d = parseISODate(isoDate);
    const dow = d.getDay();
    return dow === 0 || dow === 6;
  }
  function hojeISO() {
    // Felipe (sessao 2026-05-10): hojeISO em LOCAL time pra alinhar
    // com parseISODate (evitar comparacao errada perto da meia-noite).
    const h = new Date();
    return h.getFullYear() + '-' +
           String(h.getMonth() + 1).padStart(2, '0') + '-' +
           String(h.getDate()).padStart(2, '0');
  }
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
          const finalizado = ag.status === 'finalizado';

          // Felipe (sessao 2026-05-10): tarefa manual (sem cardId)
          if (!ag.cardId && ag.tarefaManual) {
            const classFin = finalizado ? 'eq-job-finalizado' : '';
            const dataFmt  = finalizado && ag.dataFim ? fmtData(ag.dataFim) : '';
            return `
              <div class="eq-job-card eq-job-manual ${classFin}" title="Tarefa manual: ${escapeHtml(ag.tarefaManual)}${finalizado ? ' (finalizada em ' + dataFmt + ')' : ''}">
                <button class="eq-job-del" data-action="remover" data-ag-id="${escapeHtml(ag.id)}" title="Remover">×</button>
                <div class="eq-job-cliente">📝 ${escapeHtml(ag.tarefaManual)}</div>
                ${finalizado
                  ? `<div class="eq-job-status-tag eq-tag-finalizado">✓ ${escapeHtml(dataFmt)}</div>`
                  : `<button class="eq-job-finalizar" data-action="finalizar" data-ag-id="${escapeHtml(ag.id)}" title="Marcar como finalizada">✓ Finalizar</button>`}
              </div>
            `;
          }
          const card = cardById(ag.cardId);
          if (!card) return ''; // card deletado no kanban — cascade ja limpa, mas defesa
          if (ETAPAS_PRE_PRODUCAO.has(card.etapa)) return ''; // pre-producao escondido
          const corEtapa = COR_ETAPA[card.etapa] || '#64748B';
          // Felipe (sessao 2026-05-10): se finalizado, fundo verde
          // sobreposto a cor da etapa pra dar feedback visual claro.
          const styleBg = finalizado
            ? `border-left-color:#10b981;background:#dcfce7`
            : `border-left-color:${corEtapa};background:${corEtapa}15`;
          const dataFmt = finalizado && ag.dataFim ? fmtData(ag.dataFim) : '';
          const marcoLabel = ag.marcoPG ? labelMarco(ag.marcoPG) : '';
          return `
            <div class="eq-job-card ${finalizado ? 'eq-job-finalizado' : ''}" style="${styleBg}" title="${escapeHtml(card.cliente)} · ATP ${escapeHtml(card.numeroAGP || '—')}${marcoLabel ? ' · ' + marcoLabel : ''}${finalizado ? ' (finalizado em ' + dataFmt + ')' : ''}">
              <button class="eq-job-del" data-action="remover" data-ag-id="${escapeHtml(ag.id)}" title="Remover">×</button>
              <div class="eq-job-cliente">${escapeHtml(card.cliente || '(sem nome)')}</div>
              <div class="eq-job-atp">${escapeHtml(card.numeroAGP || '—')}${marcoLabel ? ' · ' + escapeHtml(marcoLabel) : ''}</div>
              ${finalizado
                ? `<div class="eq-job-status-tag eq-tag-finalizado">✓ ${escapeHtml(dataFmt)}</div>`
                : `<button class="eq-job-finalizar" data-action="finalizar" data-ag-id="${escapeHtml(ag.id)}" title="Marcar como finalizado hoje">✓ Finalizar</button>`}
            </div>
          `;
        }).join('');

        return `
          <td class="eq-td-cell ${fim ? 'eq-cell-weekend' : ''}" data-action="adicionar" data-equipe="${escapeHtml(e.id)}" data-dia="${iso}">
            ${cardsHtml}
            <button class="eq-add-btn" data-action="adicionar" data-equipe="${escapeHtml(e.id)}" data-dia="${iso}" title="Agendar tarefa">+</button>
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

  // Felipe (sessao 2026-05-10): so jobs que ja sairam da pre-producao
  // aparecem no select do modal. Veja ETAPAS_PRE_PRODUCAO no topo.
  function listarCardsKanbanEmProducao() {
    return listarCardsKanban().filter(c => !ETAPAS_PRE_PRODUCAO.has(c.etapa));
  }

  // ============================================================
  // MODAL DE AGENDAMENTO
  // ============================================================
  function renderModal() {
    if (!state.modalAberto) return '';
    const m = state.modalAberto;
    const equipe = equipeById(m.equipeId);
    // Felipe (sessao 2026-05-10): so jobs EM producao no select.
    const cardsEmProducao = listarCardsKanbanEmProducao();

    // Felipe (sessao 2026-05-10): "deixe campo pra escrever tarefa manual".
    // Opcao 'manual' no topo do select - se escolhida, mostra textarea.
    const opts = `
      <option value="__manual__">📝 Tarefa manual (sem job vinculado)</option>
      ${cardsEmProducao.length > 0 ? '<option disabled>───── jobs em producao ─────</option>' : ''}
      ${cardsEmProducao.map(c => {
        const label = (c.cliente || '(sem nome)') + ' · ' + (c.numeroAGP || 'sem ATP') + ' · ' + (c.etapa || '');
        return `<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`;
      }).join('')}
    `;
    const hintCardsVazio = cardsEmProducao.length === 0
      ? `<small style="color:var(--text-muted,#6b7280);font-size:11px;">Nenhum job em producao no Kanban (jobs aguardando liberacao/medicao nao aparecem aqui).</small>`
      : '';

    // Felipe (sessao 2026-05-10): equipe com multiplos marcos PG.
    // Se equipe tem 0 marcos (instalacao) -> sem select. Se 1 -> oculto
    // mas valor sai automatico. Se 2+ -> select obrigatorio.
    const marcosEquipe = Array.isArray(equipe.marcos) ? equipe.marcos : [];
    let marcoPgHtml = '';
    if (marcosEquipe.length === 1) {
      marcoPgHtml = `<input type="hidden" id="eq-modal-marco-pg" value="${escapeHtml(marcosEquipe[0])}" />`;
    } else if (marcosEquipe.length > 1) {
      marcoPgHtml = `
        <label class="eq-modal-label">Qual etapa de producao? <span style="color:#dc2626;font-weight:400;">*</span></label>
        <select class="eq-modal-select" id="eq-modal-marco-pg">
          <option value="">— selecione —</option>
          ${marcosEquipe.map(mc => `<option value="${escapeHtml(mc)}">${escapeHtml(labelMarco(mc))}</option>`).join('')}
        </select>
      `;
    } else {
      marcoPgHtml = `<input type="hidden" id="eq-modal-marco-pg" value="" />`;
    }

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
          <label class="eq-modal-label">O que esta equipe vai fazer?</label>
          <select class="eq-modal-select" id="eq-modal-card-select">
            ${opts}
          </select>
          ${hintCardsVazio}
          <div id="eq-modal-manual-wrap" style="display:none;margin-top:10px;">
            <label class="eq-modal-label">Descricao da tarefa manual</label>
            <input type="text" class="eq-modal-select" id="eq-modal-tarefa-manual" placeholder="Ex: Manutencao da maquina, treinamento, limpeza..." />
          </div>
          ${marcoPgHtml}
          <label class="eq-modal-label">Observacoes (opcional)</label>
          <textarea class="eq-modal-textarea" id="eq-modal-notas" rows="3" placeholder="Detalhes adicionais..."></textarea>
        </div>
        <div class="eq-modal-footer">
          <button class="eq-btn-secundario" data-action="fechar-modal">Cancelar</button>
          <button class="eq-btn-primario" data-action="salvar-modal">Agendar (Iniciar)</button>
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
  function criarAgendamento(equipeId, dia, cardId, notas, tarefaManual, marcoPG) {
    const id = genId();
    // Felipe (sessao 2026-05-10): "coloco que comecou" - ao agendar,
    // o status default eh 'iniciado'. User clica '✓' depois pra
    // finalizar e disparar evento -> Producao Geral atualiza.
    state.agendamentos[id] = {
      cardId: cardId || null,
      equipeId,
      dia,
      notas: notas || '',
      tarefaManual: tarefaManual || '',
      status: 'iniciado',
      marcoPG: marcoPG || '',     // qual marco PG sera afetado ao finalizar
      dataFim: '',                // preenchido ao finalizar
    };
    saveAgendamentos();
  }
  function finalizarAgendamento(agId, dataFim) {
    const ag = state.agendamentos[agId];
    if (!ag) return;
    ag.status = 'finalizado';
    ag.dataFim = dataFim || hojeISO();
    saveAgendamentos();

    // Felipe (sessao 2026-05-10): "ja joga essa data em producao geral".
    // Dispara evento que ProducaoGeral escuta - tarefas manuais
    // (sem cardId) nao disparam (nao tem como atualizar marco PG).
    if (ag.cardId && ag.marcoPG) {
      try {
        if (window.Events && typeof Events.emit === 'function') {
          Events.emit('equipes:job-finalizado', {
            cardId: ag.cardId,
            marcoPG: ag.marcoPG,
            dataFim: ag.dataFim,
          });
          console.log('[Equipes] Job finalizado:', ag.cardId, '/', ag.marcoPG, '->', ag.dataFim);
        }
      } catch (_) {}
    }
  }
  function reiniciarAgendamento(agId) {
    const ag = state.agendamentos[agId];
    if (!ag) return;
    ag.status = 'iniciado';
    ag.dataFim = '';
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

    // Felipe (sessao 2026-05-10): "ao finalizar ja altera producao
    // geral pra dia X". Click em ✓ Finalizar.
    container.querySelectorAll('[data-action="finalizar"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const agId = btn.dataset.agId;
        const ag = state.agendamentos[agId];
        if (!ag) return;
        // Felipe: data fim default = hoje. User pode editar via prompt
        // antes de confirmar (se finalizou em outro dia).
        const sugerido = hojeISO();
        const dataInput = window.prompt(
          'Data de finalizacao (YYYY-MM-DD):\n\nDeixe vazio pra usar HOJE (' + fmtData(sugerido) + ').',
          sugerido
        );
        if (dataInput === null) return; // cancelou
        const dataFim = dataInput.trim() || sugerido;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
          alert('Data invalida. Use formato YYYY-MM-DD.');
          return;
        }
        finalizarAgendamento(agId, dataFim);
        render(container);
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
      // Felipe (sessao 2026-05-10): listener pra mostrar campo de
      // tarefa manual quando user seleciona '__manual__' no select.
      const selectCards = mount.querySelector('#eq-modal-card-select');
      const wrapManual  = mount.querySelector('#eq-modal-manual-wrap');
      if (selectCards && wrapManual) {
        const toggleManual = () => {
          wrapManual.style.display = (selectCards.value === '__manual__') ? 'block' : 'none';
        };
        selectCards.addEventListener('change', toggleManual);
        toggleManual();
      }
      const btnSalvar = mount.querySelector('[data-action="salvar-modal"]');
      if (btnSalvar) {
        btnSalvar.addEventListener('click', () => {
          const sel = mount.querySelector('#eq-modal-card-select');
          const notas = mount.querySelector('#eq-modal-notas');
          const marcoEl = mount.querySelector('#eq-modal-marco-pg');
          if (!sel || !sel.value) return;
          const m = state.modalAberto;
          const selValue = sel.value;
          // Felipe (sessao 2026-05-10): se equipe tem multiplos marcos
          // PG, exigir selecao. Tarefa manual nao precisa de marcoPG.
          const equipe = equipeById(m.equipeId);
          const marcoPG = marcoEl ? marcoEl.value : '';
          const precisaMarco = (selValue !== '__manual__')
                            && Array.isArray(equipe.marcos)
                            && equipe.marcos.length >= 2;
          if (precisaMarco && !marcoPG) {
            alert('Selecione qual etapa de producao esta equipe vai fazer.');
            if (marcoEl) marcoEl.focus();
            return;
          }
          // Felipe (sessao 2026-05-10): suporte a tarefa manual
          if (selValue === '__manual__') {
            const tarefa = mount.querySelector('#eq-modal-tarefa-manual');
            const txtTarefa = tarefa ? tarefa.value.trim() : '';
            if (!txtTarefa) {
              alert('Descreva a tarefa manual antes de salvar.');
              return;
            }
            criarAgendamento(m.equipeId, m.dia, null, notas ? notas.value : '', txtTarefa, '');
          } else {
            criarAgendamento(m.equipeId, m.dia, selValue, notas ? notas.value : '', '', marcoPG);
          }
          fecharModal();
          render(container);
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

  // Felipe (sessao 2026-05-10): nomes legiveis dos marcos da Producao
  // Geral. Sincronizado com MARCOS em scripts/18-producao-geral.js.
  const LABEL_MARCO = {
    cadOs:        'CAD.OS',
    cut2d:        'CUT2D',
    corteChapa:   'Corte Chapa',
    quadroPorta:  'Quadro Porta',
    quadroFixo:   'Quadro Fixo',
    colagem:      'Colagem',
    colagemFixo:  'Colagem Fixo',
    portal:       'Portal',
    conferencia:  'Conferencia',
    embalagem:    'Embalagem',
  };
  function labelMarco(id) { return LABEL_MARCO[id] || id; }

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
