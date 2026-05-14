/* 17-instalacao.js — Modulo Instalacao (Agenda Obras).
   Persistencia: Storage.scope('instalacao'). CSS prefixo .inst-*.

   Le (read-only) os cards do Kanban Producao (que sao clones de leads
   'fechado' do CRM). Cada card vira um trabalho de instalacao aqui.

   Storage.scope('instalacao') guarda APENAS os deltas (campos proprios
   de instalacao indexados por cardId):
     instalacoes: { [cardId]: { instalador, dataInicio, dataTermino,
                                statusInstalacao, dataEntrega, confirmacao,
                                observacoes } }

   ============================================================
   MODULO: INSTALACAO (Agenda Obras)
   ============================================================
   Isolado: Storage.scope('instalacao'), CSS prefixado .inst-*.
   NAO modifica Kanban Producao nem CRM (somente leitura).

   Felipe (sessao 2026-05-10):
     'PRECISO AGORA DO MUDLO INTALACAO, AONDE VAI PUXAR TODOS DOS
      DADOS DO CARD, SE EU CLIUCLAR NESSE CLIENTE E VAI TER ISSO AI
      PRECISAMOS DE Grafico de Gantt'.
     Campos pedidos: cliente, ATP, status instalacao, status producao,
     instalador, cidade/estado, data inicio, data termino.
   ============================================================ */
(() => {
  'use strict';

  // Status de instalacao (cores das imagens da planilha CONTROLE DE LIBERACAO).
  const STATUS_INSTALACAO = [
    { id: 'ag-instalacao',     label: 'AG. INSTALACAO',     color: '#3B82F6' },
    { id: 'em-producao',       label: 'EM PRODUCAO',        color: '#D97706' },
    { id: 'ag-os',             label: 'AG. O.S',            color: '#94A3B8' },
    { id: 'ag-fazer-liberacao',label: 'AG. FAZER LIBERACAO',color: '#EAB308' },
    { id: 'finalizado',        label: 'FINALIZADO',         color: '#10B981' },
    { id: 'a-programar',       label: 'A PROGRAMAR',        color: '#FACC15' },
    { id: 'programado',        label: 'PROGRAMADO',         color: '#06B6D4' },
  ];
  const statusInstById = (id) => STATUS_INSTALACAO.find(s => s.id === id) || STATUS_INSTALACAO[0];

  // Status producao (lido do Kanban Producao - cada etapa vira status producao).
  // Mapeamento sempre reflete a etapa atual do card no Kanban Producao.

  const store = Storage.scope('instalacao');
  const state = {
    view: 'lista',             // 'lista' | 'gantt'
    ganttPeriodo: 'mes-atual', // 'semana' | 'mes-atual' | 'mes-seguinte' | 'auto'
    instalacoes: {},           // deltas por cardId
    filtros: {
      busca: '',
      instalador: '',
      statusInst: '',
      cidade: '',
      estado: '',
    },
    modalAberto: null,         // cardId em edicao
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
  /**
   * Felipe (sessao 2026-05-10 - bug Gantt): "coloquei ali que sai
   * dia 25/05 entao saiu ali no grafico gantt dia 24".
   *
   * CAUSA RAIZ: new Date('2026-05-25') eh parseado como UTC midnight.
   * Brasil eh UTC-3, entao no JS local vira 2026-05-24 21:00. Bar do
   * Gantt e tooltip mostram 24 em vez de 25.
   *
   * FIX: parseISODate quebra a string e usa new Date(y, m-1, d) -
   * construtor com 3+ argumentos cria a data em LOCAL time.
   */
  function parseISODate(iso) {
    if (!iso || typeof iso !== 'string') return new Date(NaN);
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return new Date(iso);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function fmtData(iso) {
    if (!iso) return '';
    try {
      const d = parseISODate(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('pt-BR');
    } catch (_) { return iso; }
  }
  function diasEntre(d1, d2) {
    if (!d1 || !d2) return 0;
    const a = parseISODate(d1), b = parseISODate(d2);
    if (isNaN(a) || isNaN(b)) return 0;
    return Math.round((b - a) / 86400000);
  }
  function hojeISO() {
    // Felipe (sessao 2026-05-10): hojeISO em LOCAL time pra alinhar
    // com parseISODate.
    const h = new Date();
    return h.getFullYear() + '-' +
           String(h.getMonth() + 1).padStart(2, '0') + '-' +
           String(h.getDate()).padStart(2, '0');
  }

  // ============================================================
  // FONTE: cards do Kanban Producao (read-only)
  // ============================================================
  /**
   * Le cards do Kanban Producao. Cada card eh um candidato a instalacao.
   * Retorna lista plana com campos do lead + deltas locais (campos de
   * instalacao especificos).
   */
  function listarTrabalhos() {
    let cards = [];
    try {
      const raw = Storage.scope('kanban-producao').get('leads');
      cards = Array.isArray(raw) ? raw : [];
    } catch (_) { cards = []; }

    return cards.map(card => {
      const delta = state.instalacoes[card.id] || {};
      return {
        // Identificacao
        cardId: card.id,
        crmLeadId: card.crmLeadId || null,

        // Dados do CRM/Producao (read-only)
        cliente:        card.cliente || '(sem nome)',
        telefone:       card.telefone || '',
        email:          card.email || '',
        numeroAGP:      card.numeroAGP || '',         // ATP no Excel
        numeroReserva:  card.numeroReserva || '',
        cidade:         card.cidade || '',
        estado:         card.estado || '',
        representante:  card.representante_followup || '',
        statusProducao: card.etapa || '',             // etapa do Kanban Producao
        portaModelo:    card.porta_modelo || '',
        portaLargura:   card.porta_largura || '',
        portaAltura:    card.porta_altura || '',
        portaCor:       card.porta_cor || '',

        // Deltas (campos proprios de instalacao)
        instalador:        delta.instalador || '',
        dataInicio:        delta.dataInicio || '',
        dataTermino:       delta.dataTermino || '',
        statusInstalacao:  delta.statusInstalacao || 'ag-instalacao',
        dataEntrega:       delta.dataEntrega || '',
        confirmacao:       delta.confirmacao || '',
        observacoes:       delta.observacoes || '',
      };
    });
  }

  // Label legivel do status producao (etapa do Kanban Producao)
  function labelStatusProducao(etapaId) {
    const map = {
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
    return map[etapaId] || (etapaId || '—').toUpperCase();
  }

  // ============================================================
  // PERSISTENCIA
  // ============================================================
  function load() {
    if (state.loaded) return;
    const inst = store.get('instalacoes');
    state.instalacoes = (inst && typeof inst === 'object') ? inst : {};
    const v = store.get('view');
    if (v === 'lista' || v === 'gantt') state.view = v;
    const gp = store.get('ganttPeriodo');
    if (gp === 'semana' || gp === 'mes-atual' || gp === 'mes-seguinte' || gp === 'auto') {
      state.ganttPeriodo = gp;
    }
    const f = store.get('filtros');
    if (f && typeof f === 'object') {
      Object.keys(state.filtros).forEach(k => {
        if (typeof f[k] === 'string') state.filtros[k] = f[k];
      });
    }
    state.loaded = true;
  }
  function saveInstalacoes()    { store.set('instalacoes', state.instalacoes); }
  function saveView()           { store.set('view', state.view); }
  function saveGanttPeriodo()   { store.set('ganttPeriodo', state.ganttPeriodo); }
  function saveFiltros()        { store.set('filtros', state.filtros); }

  function forceReload(container) {
    state.loaded = false;
    load();
    if (container) render(container);
  }

  function atualizarDelta(cardId, patch) {
    const atual = state.instalacoes[cardId] || {};
    state.instalacoes[cardId] = Object.assign({}, atual, patch);
    saveInstalacoes();
  }

  // ============================================================
  // FILTROS
  // ============================================================
  function aplicarFiltros(trabalhos) {
    const f = state.filtros;
    return trabalhos.filter(t => {
      if (f.busca) {
        const q = f.busca.toLowerCase();
        const hay = [t.cliente, t.numeroAGP, t.cidade, t.estado, t.instalador]
          .map(x => String(x || '').toLowerCase()).join(' ');
        if (hay.indexOf(q) === -1) return false;
      }
      if (f.instalador && t.instalador !== f.instalador) return false;
      if (f.statusInst && t.statusInstalacao !== f.statusInst) return false;
      if (f.cidade && t.cidade !== f.cidade) return false;
      if (f.estado && t.estado !== f.estado) return false;
      return true;
    });
  }

  function listarUnicos(trabalhos, campo) {
    const set = new Set();
    trabalhos.forEach(t => { if (t[campo]) set.add(t[campo]); });
    return Array.from(set).sort();
  }

  // ============================================================
  // RENDER LISTA
  // ============================================================
  function renderLista(trabalhos) {
    if (trabalhos.length === 0) {
      return `<div class="inst-empty">Nenhum trabalho de instalacao. Os trabalhos aparecem aqui automaticamente conforme cards entram no Kanban Producao.</div>`;
    }
    const rows = trabalhos.map(t => {
      const sInst = statusInstById(t.statusInstalacao);
      const local = [t.cidade, t.estado].filter(Boolean).join(' / ');
      return `
        <tr data-card-id="${escapeHtml(t.cardId)}" class="inst-row">
          <td class="inst-cli"><strong>${escapeHtml(t.cliente)}</strong></td>
          <td class="inst-atp">${escapeHtml(t.numeroAGP || '—')}</td>
          <td class="inst-status-prod">
            <span class="inst-pill inst-pill-prod">${escapeHtml(labelStatusProducao(t.statusProducao))}</span>
          </td>
          <td class="inst-status-inst">
            <span class="inst-pill" style="background:${sInst.color}20;border-color:${sInst.color};color:${sInst.color}">
              ${escapeHtml(sInst.label)}
            </span>
          </td>
          <td>${escapeHtml(t.instalador || '—')}</td>
          <td>${escapeHtml(local || '—')}</td>
          <td>${escapeHtml(fmtData(t.dataInicio) || '—')}</td>
          <td>${escapeHtml(fmtData(t.dataTermino) || '—')}</td>
        </tr>
      `;
    }).join('');
    return `
      <div class="inst-tabela-wrap">
        <table class="inst-tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>ATP</th>
              <th>Status Producao</th>
              <th>Status Instalacao</th>
              <th>Instalador</th>
              <th>Cidade / Estado</th>
              <th>Data Saida</th>
              <th>Data Termino</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ============================================================
  // RENDER GANTT
  // ============================================================
  /**
   * Calcula limites de datas (min e max) entre todos os trabalhos.
   * Se nao tem nenhuma data, usa hoje +/- 30 dias como fallback.
   */
  /**
   * Felipe (sessao 2026-05-10): opcoes de periodo do Gantt:
   *   - 'semana':       semana atual (segunda a domingo)
   *   - 'mes-atual':    1o ao ultimo dia do mes corrente (default)
   *   - 'mes-seguinte': 1o ao ultimo dia do proximo mes
   *   - 'auto':         range automatico baseado nos trabalhos (legado)
   */
  function calcularRangeGantt(trabalhos) {
    const periodo = state.ganttPeriodo || 'mes-atual';
    const h = new Date();
    let min, max;

    // Felipe (sessao 2026-05-10): usa LOCAL time pra alinhar com
    // parseISODate no resto do app. Construtor (y, m, d) cria local.
    if (periodo === 'semana') {
      // Segunda da semana atual
      const dow = h.getDay(); // 0 = dom
      const diasParaSegunda = (dow === 0) ? -6 : 1 - dow;
      min = new Date(h.getFullYear(), h.getMonth(), h.getDate() + diasParaSegunda);
      max = new Date(min.getFullYear(), min.getMonth(), min.getDate() + 6);
    } else if (periodo === 'mes-atual') {
      min = new Date(h.getFullYear(), h.getMonth(), 1);
      max = new Date(h.getFullYear(), h.getMonth() + 1, 0); // ultimo dia do mes
    } else if (periodo === 'mes-seguinte') {
      min = new Date(h.getFullYear(), h.getMonth() + 1, 1);
      max = new Date(h.getFullYear(), h.getMonth() + 2, 0);
    } else {
      // 'auto' - logica antiga baseada nos trabalhos
      const datas = [];
      trabalhos.forEach(t => {
        if (t.dataInicio)  datas.push(t.dataInicio);
        if (t.dataTermino) datas.push(t.dataTermino);
      });
      if (datas.length === 0) {
        min = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 14);
        max = new Date(h.getFullYear(), h.getMonth(), h.getDate() + 60);
      } else {
        datas.sort();
        // parseISODate evita off-by-one em string ISO
        min = parseISODate(datas[0]);
        max = parseISODate(datas[datas.length - 1]);
        min.setDate(min.getDate() - 3);
        max.setDate(max.getDate() + 7);
      }
    }
    // Format LOCAL ISO (nao UTC) - alinhado com parseISODate
    const fmtLocal = (d) => d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
    return { min: fmtLocal(min), max: fmtLocal(max) };
  }

  function renderGantt(trabalhos) {
    if (trabalhos.length === 0) {
      return `<div class="inst-empty">Nenhum trabalho com datas pra exibir no Gantt.</div>`;
    }
    // Felipe sessao 18: "coloque em cascata um em baixo do outro na
    // sequencia". Ordena os trabalhos por dataInicio ASC pra que as
    // barras apareçam em escada (linha 1 = trabalho mais cedo,
    // linha N = trabalho mais tarde). Trabalhos SEM data vao pro
    // final mantendo ordem alfabetica do cliente.
    trabalhos = trabalhos.slice().sort((a, b) => {
      const aHasDate = !!a.dataInicio;
      const bHasDate = !!b.dataInicio;
      if (aHasDate && bHasDate) {
        // Ambos tem data: ordena pela data inicio
        if (a.dataInicio < b.dataInicio) return -1;
        if (a.dataInicio > b.dataInicio) return  1;
        // Empate na inicio: usa dataTermino
        if (a.dataTermino && b.dataTermino) {
          if (a.dataTermino < b.dataTermino) return -1;
          if (a.dataTermino > b.dataTermino) return  1;
        }
        return String(a.cliente || '').localeCompare(String(b.cliente || ''));
      }
      // So um deles tem data: o que tem data vem primeiro
      if (aHasDate) return -1;
      if (bHasDate) return  1;
      // Nenhum tem data: alfabetico
      return String(a.cliente || '').localeCompare(String(b.cliente || ''));
    });

    const { min, max } = calcularRangeGantt(trabalhos);
    const totalDias = diasEntre(min, max) + 1;
    if (totalDias <= 0) {
      return `<div class="inst-empty">Datas invalidas no range do Gantt.</div>`;
    }
    // Felipe (sessao 2026-05-10): "sempre que colocar semana atual,
    // mes atual, aumente a largura pois tem espaco ai nao fica tao
    // pequeno aumente 1,5 vezes a largura".
    // 24 * 1.5 = 36px pros 3 periodos curtos. Auto fica 24 (range
    // pode ser grande, 36 estouraria).
    //
    // Felipe sessao 18 (atualizacao): "aumenta a largura esta muito
    // pequeno, aumente em duas vezes a largura ali de cada dia".
    // Dobrei: base 24 → 48, periodos curtos 36 → 72.
    const PX_DIA_BASE = 48;
    const periodosLargos = ['semana', 'mes-atual', 'mes-seguinte'];
    const PX_DIA = periodosLargos.indexOf(state.ganttPeriodo) >= 0
      ? Math.round(PX_DIA_BASE * 1.5)  // 72px
      : PX_DIA_BASE;                    // 48px (auto)
    const totalPx = totalDias * PX_DIA;
    const hoje = hojeISO();
    const offsetHoje = (hoje >= min && hoje <= max) ? diasEntre(min, hoje) * PX_DIA : -1;

    // Felipe (sessao 2026-05-10): "coloque dias de semana SEG TER QUA
    // QUI SEX SAB DOM em cima dos numeros".
    // Header dos dias agora tem 2 linhas: dow (cima) + dia (baixo).
    const DOW_LABELS = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
    const headerDias = [];
    // Felipe sessao 18: faixa vertical em cada dia de SAB/DOM.
    // Coletado durante o loop de dias - depois injetado dentro do body.
    // Largura = PX_DIA (cobre 1 dia inteiro).
    const weekendStripes = [];
    const headerMeses = [];
    // Felipe (sessao 2026-05-10): bug timezone - new Date(min) era UTC.
    // parseISODate cria em LOCAL time pra alinhar com o resto do app.
    const dInicio = parseISODate(min);
    let mesAtual = -1, mesInicioPx = 0, mesLabel = '';
    for (let i = 0; i < totalDias; i++) {
      // Incrementa dia em LOCAL time (sem usar +86400000 que pode pular
      // por causa de DST mesmo no Brasil onde nao tem DST atualmente,
      // por seguranca).
      const d = new Date(dInicio.getFullYear(), dInicio.getMonth(), dInicio.getDate() + i);
      const dia = d.getDate();
      const dow = d.getDay();
      const fimDeSemana = (dow === 0 || dow === 6);
      const dowLabel = DOW_LABELS[dow];
      headerDias.push(`<div class="inst-gantt-day ${fimDeSemana ? 'is-weekend' : ''}" style="flex:0 0 ${PX_DIA}px;width:${PX_DIA}px" title="${d.toLocaleDateString('pt-BR')}"><div class="inst-gantt-day-dow">${dowLabel}</div><div class="inst-gantt-day-num">${dia}</div></div>`);
      // Felipe sessao 18: faixa vertical preenchendo o dia inteiro
      // (atras das barras/labels do body). Mesma cor #e2e8f0 do header.
      if (fimDeSemana) {
        const leftPx = i * PX_DIA;
        weekendStripes.push(`<div class="inst-gantt-weekend-stripe" style="left:${leftPx}px;width:${PX_DIA}px"></div>`);
      }

      if (d.getMonth() !== mesAtual) {
        if (mesAtual !== -1) {
          headerMeses.push(`<div class="inst-gantt-month" style="left:${mesInicioPx}px;width:${i * PX_DIA - mesInicioPx}px">${mesLabel}</div>`);
        }
        mesAtual = d.getMonth();
        mesInicioPx = i * PX_DIA;
        mesLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
      }
    }
    headerMeses.push(`<div class="inst-gantt-month" style="left:${mesInicioPx}px;width:${totalDias * PX_DIA - mesInicioPx}px">${mesLabel}</div>`);

    // Linhas: 1 por trabalho (filtra os que NAO tem datas)
    const linhas = trabalhos.map(t => {
      const sInst = statusInstById(t.statusInstalacao);
      const local = [t.cidade, t.estado].filter(Boolean).join(' / ');
      let bar = '';
      if (t.dataInicio && t.dataTermino &&
          t.dataInicio >= min && t.dataTermino <= max &&
          t.dataInicio <= t.dataTermino) {
        const offset = diasEntre(min, t.dataInicio) * PX_DIA;
        const largura = (diasEntre(t.dataInicio, t.dataTermino) + 1) * PX_DIA - 4;
        bar = `<div class="inst-gantt-bar"
          style="left:${offset}px;width:${largura}px;background:${sInst.color};border-color:${sInst.color}"
          title="${escapeHtml(t.cliente)} — ${fmtData(t.dataInicio)} ate ${fmtData(t.dataTermino)} — ${sInst.label}"
          data-card-id="${escapeHtml(t.cardId)}">
          ${escapeHtml(t.cliente)}
        </div>`;
      }
      return `
        <div class="inst-gantt-row" data-card-id="${escapeHtml(t.cardId)}">
          <div class="inst-gantt-label">
            <strong>${escapeHtml(t.cliente)}</strong>
            <span class="inst-gantt-meta">${escapeHtml(t.numeroAGP || '')} · ${escapeHtml(local || '')}</span>
            <span class="inst-gantt-meta">${escapeHtml(t.instalador || '—')}</span>
          </div>
          <div class="inst-gantt-track" style="width:${totalPx}px;background-image:repeating-linear-gradient(to right,transparent 0,transparent ${PX_DIA-1}px,#f1f5f9 ${PX_DIA-1}px,#f1f5f9 ${PX_DIA}px)">
            ${bar}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="inst-gantt-wrap">
        <div class="inst-gantt-header-row">
          <div class="inst-gantt-label-spacer">Cliente / ATP / Cidade / Instalador</div>
          <div class="inst-gantt-header" style="width:${totalPx}px;position:relative">
            <div class="inst-gantt-months">${headerMeses.join('')}</div>
            <div class="inst-gantt-days">${headerDias.join('')}</div>
            ${offsetHoje >= 0 ? `<div class="inst-gantt-today" style="left:${offsetHoje}px" title="Hoje (${fmtData(hoje)})"></div>` : ''}
          </div>
        </div>
        <div class="inst-gantt-body" style="position:relative">
          <!-- Felipe sessao 18: 'colocar preenchida toda as colunas de
               sabado e domingo da mesma cor que ja tem em cima'. Cada
               weekend vira uma faixa vertical absoluta cobrindo o corpo
               inteiro (atras das barras/labels). z-index baixo pra
               nao tampar as barras dos leads. -->
          <div class="inst-gantt-weekends" aria-hidden="true">
            ${weekendStripes.join('')}
          </div>
          ${linhas}
        </div>
      </div>
    `;
  }

  // ============================================================
  // RENDER FILTROS
  // ============================================================
  function renderFiltros(trabalhos) {
    const instaladores = listarUnicos(trabalhos, 'instalador');
    const cidades      = listarUnicos(trabalhos, 'cidade');
    const estados      = listarUnicos(trabalhos, 'estado');
    return `
      <div class="inst-filtros">
        <input type="search" class="inst-filtro-busca" placeholder="Buscar cliente / ATP / cidade..."
               value="${escapeHtml(state.filtros.busca)}" data-filtro="busca" />
        <select data-filtro="statusInst">
          <option value="">Todos status instalacao</option>
          ${STATUS_INSTALACAO.map(s => `<option value="${s.id}" ${state.filtros.statusInst === s.id ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
        </select>
        <select data-filtro="instalador">
          <option value="">Todos instaladores</option>
          ${instaladores.map(i => `<option value="${escapeHtml(i)}" ${state.filtros.instalador === i ? 'selected' : ''}>${escapeHtml(i)}</option>`).join('')}
        </select>
        <select data-filtro="cidade">
          <option value="">Todas cidades</option>
          ${cidades.map(c => `<option value="${escapeHtml(c)}" ${state.filtros.cidade === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
        <select data-filtro="estado">
          <option value="">Todos estados</option>
          ${estados.map(e => `<option value="${escapeHtml(e)}" ${state.filtros.estado === e ? 'selected' : ''}>${escapeHtml(e)}</option>`).join('')}
        </select>
        <button class="inst-filtro-limpar" data-action="limpar-filtros">Limpar filtros</button>
      </div>
    `;
  }

  // ============================================================
  // RENDER MODAL DETALHE
  // ============================================================
  function renderModal(t) {
    if (!t) return '';
    const local = [t.cidade, t.estado].filter(Boolean).join(' / ');
    const dim = (t.portaLargura && t.portaAltura) ? `${t.portaLargura} x ${t.portaAltura} mm` : '—';
    const sInst = statusInstById(t.statusInstalacao);
    return `
      <div class="inst-modal-backdrop" data-action="fechar-modal"></div>
      <div class="inst-modal" role="dialog" aria-modal="true">
        <div class="inst-modal-header" style="border-left:6px solid ${sInst.color}">
          <div>
            <h3>${escapeHtml(t.cliente)}</h3>
            <p class="inst-modal-sub">${escapeHtml(t.numeroAGP || 'sem ATP')} · ${escapeHtml(local || '—')}</p>
          </div>
          <button class="inst-modal-close" data-action="fechar-modal" title="Fechar">×</button>
        </div>
        <div class="inst-modal-body">

          <div class="inst-modal-section">
            <h4>Dados do Cliente <span class="inst-readonly-tag">somente leitura · vem do CRM</span></h4>
            <div class="inst-grid-2">
              <div><label>Cliente</label><div class="inst-readonly">${escapeHtml(t.cliente)}</div></div>
              <div><label>ATP</label><div class="inst-readonly">${escapeHtml(t.numeroAGP || '—')}</div></div>
              <div><label>Telefone</label><div class="inst-readonly">${escapeHtml(t.telefone || '—')}</div></div>
              <div><label>Email</label><div class="inst-readonly">${escapeHtml(t.email || '—')}</div></div>
              <div><label>Cidade</label><div class="inst-readonly">${escapeHtml(t.cidade || '—')}</div></div>
              <div><label>Estado</label><div class="inst-readonly">${escapeHtml(t.estado || '—')}</div></div>
              <div><label>Reserva</label><div class="inst-readonly">${escapeHtml(t.numeroReserva || '—')}</div></div>
              <div><label>Representante</label><div class="inst-readonly">${escapeHtml(t.representante || '—')}</div></div>
            </div>
          </div>

          <div class="inst-modal-section">
            <h4>Produto <span class="inst-readonly-tag">somente leitura · vem do CRM</span></h4>
            <div class="inst-grid-2">
              <div><label>Modelo</label><div class="inst-readonly">${escapeHtml(t.portaModelo || '—')}</div></div>
              <div><label>Dimensao</label><div class="inst-readonly">${escapeHtml(dim)}</div></div>
              <div><label>Cor</label><div class="inst-readonly">${escapeHtml(t.portaCor || '—')}</div></div>
              <div><label>Status Producao</label><div class="inst-readonly">${escapeHtml(labelStatusProducao(t.statusProducao))}</div></div>
            </div>
          </div>

          <div class="inst-modal-section">
            <h4>Instalacao <span class="inst-edit-tag">editavel</span></h4>
            <div class="inst-grid-2">
              <div>
                <label for="inst-f-status">Status Instalacao</label>
                <select id="inst-f-status" data-edit="statusInstalacao">
                  ${STATUS_INSTALACAO.map(s => `<option value="${s.id}" ${t.statusInstalacao === s.id ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
                </select>
              </div>
              <div>
                <label for="inst-f-instalador">Instaladores / Equipe</label>
                <div class="inst-instaladores-multi" id="inst-instaladores-multi">
                  ${(() => {
                    // Felipe (sessao 2026-05-10): "quando em instalacao
                    // for selecionar equipe vai ter um filtro e vamos
                    // escolher quem vai, podem ser 1, 2, 3, 4 ou 5 pessoas".
                    //
                    // Multi-select: lista checkboxes dos cadastrados ativos.
                    // Salva em t.instalador como string CSV (compat retro:
                    // campo string usado em listagem/busca/Gantt).
                    const ativos = (window.Instaladores && window.Instaladores.listarAtivos)
                      ? window.Instaladores.listarAtivos()
                      : [];
                    if (ativos.length === 0) {
                      return `<div class="inst-instaladores-vazio">
                        Nenhum instalador cadastrado. Va em <strong>Instalacao -> Instaladores</strong> pra adicionar.
                      </div>`;
                    }
                    // Quem ja esta selecionado pra esse trabalho
                    const selecionadosArr = String(t.instalador || '')
                      .split(',')
                      .map(s => s.trim().toUpperCase())
                      .filter(Boolean);
                    return ativos.map(i => {
                      const nomeUp = String(i.nome).toUpperCase();
                      const checked = selecionadosArr.indexOf(nomeUp) >= 0 ? 'checked' : '';
                      return `<label class="inst-instalador-chip ${checked ? 'is-checked' : ''}">
                        <input type="checkbox" data-inst-checkbox value="${escapeHtml(nomeUp)}" ${checked} />
                        <span>${escapeHtml(i.nome)}</span>
                      </label>`;
                    }).join('');
                  })()}
                </div>
                <input type="hidden" id="inst-f-instalador" data-edit="instalador" value="${escapeHtml(t.instalador)}" />
              </div>
              <div>
                <label for="inst-f-inicio">Data Saida (dia que sai pra obra)</label>
                <input type="date" id="inst-f-inicio" data-edit="dataInicio" value="${escapeHtml(t.dataInicio)}" />
              </div>
              <div>
                <label for="inst-f-termino">Data Termino (volta pra empresa)</label>
                <input type="date" id="inst-f-termino" data-edit="dataTermino" value="${escapeHtml(t.dataTermino)}" />
              </div>
              <div>
                <label for="inst-f-entrega">Data Entrega ao Cliente</label>
                <input type="date" id="inst-f-entrega" data-edit="dataEntrega" value="${escapeHtml(t.dataEntrega)}" />
              </div>
              <div>
                <label for="inst-f-confirmacao">Confirmacao</label>
                <input type="text" id="inst-f-confirmacao" data-edit="confirmacao" value="${escapeHtml(t.confirmacao)}" placeholder="ex: OK, AG. VIDEO, LEVAR PECA" />
              </div>
            </div>
            <div style="margin-top:10px">
              <label for="inst-f-obs">Observacoes</label>
              <textarea id="inst-f-obs" data-edit="observacoes" rows="3" placeholder="Notas internas da instalacao">${escapeHtml(t.observacoes)}</textarea>
            </div>
          </div>

        </div>
        <div class="inst-modal-footer">
          <button class="inst-btn-secundario" data-action="fechar-modal">Fechar</button>
          <button class="inst-btn-primario" data-action="salvar-modal">Salvar</button>
        </div>
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

    // Felipe (sessao 2026-05-10): seletor de periodo do Gantt
    // (semana/mes atual/mes seguinte). So aparece quando view='gantt'.
    const periodos = [
      { id: 'semana',       label: 'Semana atual' },
      { id: 'mes-atual',    label: 'Mes atual' },
      { id: 'mes-seguinte', label: 'Mes seguinte' },
      { id: 'auto',         label: 'Auto (range)' },
    ];
    const seletorPeriodoHtml = state.view === 'gantt' ? `
      <div class="inst-periodo-toggle">
        ${periodos.map(p => `
          <button data-periodo="${p.id}" class="${state.ganttPeriodo === p.id ? 'is-active' : ''}">
            ${escapeHtml(p.label)}
          </button>
        `).join('')}
      </div>
    ` : '';

    container.innerHTML = `
      <div class="inst-toolbar">
        <div class="inst-view-toggle">
          <button data-view="lista" class="${state.view === 'lista' ? 'is-active' : ''}">Lista</button>
          <button data-view="gantt" class="${state.view === 'gantt' ? 'is-active' : ''}">Gantt</button>
        </div>
        ${seletorPeriodoHtml}
        <div class="inst-toolbar-info">
          <span class="inst-info-pill">${trabalhos.length} de ${todos.length} trabalhos</span>
        </div>
      </div>
      ${renderFiltros(todos)}
      <div class="inst-content">
        ${state.view === 'lista' ? renderLista(trabalhos) : renderGantt(trabalhos)}
      </div>
      <div class="inst-modal-mount" id="inst-modal-mount"></div>
    `;

    // Toggle Lista / Gantt
    container.querySelectorAll('.inst-view-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view;
        if (v === state.view) return;
        state.view = v;
        saveView();
        render(container);
      });
    });

    // Felipe: seletor de periodo do Gantt
    container.querySelectorAll('.inst-periodo-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.periodo;
        if (p === state.ganttPeriodo) return;
        state.ganttPeriodo = p;
        saveGanttPeriodo();
        render(container);
      });
    });

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
        state.filtros = { busca: '', instalador: '', statusInst: '', cidade: '', estado: '' };
        saveFiltros();
        render(container);
      });
    }

    // Click em linha da tabela ou barra do Gantt: abre modal
    container.querySelectorAll('.inst-row, .inst-gantt-row, .inst-gantt-bar').forEach(el => {
      el.addEventListener('click', (e) => {
        // Ignora se clicou em barra (que tem cardId proprio)
        const cardId = el.dataset.cardId;
        if (cardId) abrirModal(cardId, container, todos);
      });
    });
  }

  // ============================================================
  // MODAL
  // ============================================================
  function abrirModal(cardId, container, todos) {
    const t = todos.find(x => x.cardId === cardId);
    if (!t) return;
    state.modalAberto = cardId;
    const mount = container.querySelector('#inst-modal-mount');
    mount.innerHTML = renderModal(t);

    // Fechar
    mount.querySelectorAll('[data-action="fechar-modal"]').forEach(b => {
      b.addEventListener('click', () => fecharModal(container));
    });

    // Felipe (sessao 2026-05-10): multi-select de instaladores.
    // Cada checkbox marcado adiciona o nome ao hidden input #inst-f-instalador
    // (CSV separado por ", ") - preserva compat com codigo existente que
    // trata t.instalador como string simples (busca, listagem, Gantt).
    const hiddenInst = mount.querySelector('#inst-f-instalador');
    const chipsRoot  = mount.querySelector('#inst-instaladores-multi');
    if (hiddenInst && chipsRoot) {
      const sincronizarHidden = () => {
        const marcados = Array.from(chipsRoot.querySelectorAll('[data-inst-checkbox]:checked'))
          .map(cb => cb.value);
        hiddenInst.value = marcados.join(', ');
      };
      chipsRoot.querySelectorAll('[data-inst-checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
          const chip = cb.closest('.inst-instalador-chip');
          if (chip) chip.classList.toggle('is-checked', cb.checked);
          sincronizarHidden();
        });
      });
    }

    // Salvar
    const btnSalvar = mount.querySelector('[data-action="salvar-modal"]');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => {
        const patch = {};
        mount.querySelectorAll('[data-edit]').forEach(el => {
          patch[el.dataset.edit] = el.value;
        });
        atualizarDelta(cardId, patch);
        fecharModal(container);
        render(container);
      });
    }

    // ESC fecha
    document.addEventListener('keydown', _escHandler);
  }
  function fecharModal(container) {
    state.modalAberto = null;
    const mount = container.querySelector('#inst-modal-mount');
    if (mount) mount.innerHTML = '';
    document.removeEventListener('keydown', _escHandler);
  }
  function _escHandler(e) {
    if (e.key === 'Escape') {
      const mount = document.querySelector('#inst-modal-mount');
      if (mount) mount.innerHTML = '';
      state.modalAberto = null;
      document.removeEventListener('keydown', _escHandler);
    }
  }

  // ============================================================
  // API PUBLICA
  // ============================================================
  const Instalacao = {
    render,
    forceReload,
    listar: () => listarTrabalhos(),
  };
  window.Instalacao = Instalacao;

  // ============================================================
  // Registra modulo no App
  // ============================================================
  App.register('instalacao', {
    render(container) {
      Instalacao.forceReload(container);
      if (!container._realtimeSubscribedInst) {
        container._realtimeSubscribedInst = true;

        // Realtime cloud
        Events.on('db:realtime-sync', function() {
          if (window.App && window.App.state && window.App.state.currentModule !== 'instalacao') return;
          if (state.modalAberto) return; // adia ate fechar modal
          Instalacao.forceReload(container);
        });

        // Mudou Kanban Producao -> trabalho pode ter sumido/aparecido
        Events.on('db:change', function(payload) {
          if (!payload) return;
          if (payload.scope !== 'kanban-producao' && payload.scope !== 'instalacao') return;
          if (window.App && window.App.state && window.App.state.currentModule !== 'instalacao') return;
          if (state.modalAberto) return;
          Instalacao.forceReload(container);
        });

        // Felipe (sessao 2026-05-10): cascade delete - apaga delta de
        // instalacao quando Kanban Producao apaga o card. Cada modulo
        // cuida do proprio scope.
        Events.on('kanban-producao:card-deleted', function(payload) {
          if (!payload || !payload.cardId) return;
          load();
          if (state.instalacoes[payload.cardId]) {
            delete state.instalacoes[payload.cardId];
            saveInstalacoes();
            console.log('[Instalacao] delta removido por cascade-delete: ' + payload.cardId);
          }
          if (window.App && window.App.state && window.App.state.currentModule === 'instalacao') {
            render(container);
          }
        });
      }
    }
  });
})();
