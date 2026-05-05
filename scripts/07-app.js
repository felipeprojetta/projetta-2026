/* 07-app.js — App controller.
   - moduleDefinitions: titulos, breadcrumbs de cada modulo
   - register(id, { render }): cada modulo se cadastra aqui
   - navigateTo(moduleId, tab): roteamento entre modulos/abas
   - aplicarOrdemAbas/salvarOrdemAbas: persistencia da ordem das abas (R15) */

/* ============================================================
   APP — controlador principal
   ============================================================ */
const App = (() => {
  const modules = {};

  const moduleDefinitions = {
    crm: {
      title: 'CRM',
      subtitle: '',
      breadcrumb: 'Comercial · CRM',
    },
    clientes: {
      title: 'Clientes',
      subtitle: 'Lista derivada do CRM — clientes que aparecem em pelo menos um lead.',
      breadcrumb: 'Comercial · Clientes',
    },
    orcamento: {
      title: 'Orcamento',
      subtitle: 'Motor de precificacao, propostas e levantamentos.',
      breadcrumb: 'Operacional · Orcamento',
      tabs: [
        { id: 'item',           label: '📐 Caracteristicas do Item' },
        { id: 'fab-inst',       label: '🛠 Custo de Fabricacao e Instalacao' },
        { id: 'custo',          label: '📊 DRE' },
        { id: 'proposta',       label: '📄 Proposta Comercial' },
        { id: 'lev-perfis',     label: '📏 Levantamento de Perfis' },
        { id: 'lev-acessorios', label: '🔩 Levantamento de Acessorios' },
        { id: 'lev-superficies',label: '▭ Levantamento de Superficies' },
        { id: 'relatorios',     label: '📊 Relatorios' },
      ],
    },
    cadastros: {
      title: 'Cadastros',
      subtitle: 'Tabelas-mestre que alimentam o sistema.',
      breadcrumb: 'Operacional · Cadastros',
      tabs: [
        { id: 'perfis',         label: 'Perfis' },
        { id: 'acessorios',     label: 'Acessorios' },
        { id: 'superficies',    label: 'Superficies' },
        { id: 'modelos',        label: 'Modelos' },
        { id: 'regras',         label: 'Regras e Logicas' },
        { id: 'filtros',        label: 'Filtros' },
        { id: 'representantes', label: 'Representantes' },
        { id: 'mensagens',      label: 'Mensagens' },
        { id: 'usuarios',       label: 'Usuarios' },
        { id: 'permissoes',     label: 'Permissoes' },
      ],
    },
    estoque: {
      title: 'Estoque Omie',
      subtitle: 'Consulta de saldo em tempo real via API Omie.',
      breadcrumb: 'Integracoes · Omie',
    },
    email: {
      title: 'Email',
      subtitle: 'Envio de propostas e mensagens padronizadas.',
      breadcrumb: 'Integracoes · Email',
    },
    config: {
      title: 'Configuracoes',
      subtitle: 'Informacoes do sistema e manutencao do storage local.',
      breadcrumb: 'Integracoes · Configuracoes',
    },
  };

  const state = { currentModule: null, currentTab: null };

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function bindLogin() {
    const form = $('#login-form');
    const errorBox = $('#login-error');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = $('#login-user').value.trim();
      const password = $('#login-pass').value;
      const session = Auth.login(username, password);
      if (!session) { errorBox.classList.add('is-visible'); return; }
      errorBox.classList.remove('is-visible');
      showApp();
    });
  }

  function bindLogout() {
    $('#logout-btn').addEventListener('click', () => {
      Auth.logout();
      showLogin();
    });
  }

  function bindNav() {
    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        navigateTo(btn.dataset.module);
      });
    });
  }

  /* R15: helpers de ordem persistida das abas (reordenaveis por drag).
     Cada modulo tem sua propria ordem em `Storage.scope('app')`.
     Ids salvos antes; abas novas (nao na lista persistida) vao no final. */
  const _navStore = Storage.scope('app');
  function aplicarOrdemAbas(moduleId, tabs) {
    const ordem = _navStore.get('tabsOrder:' + moduleId);
    if (!Array.isArray(ordem) || ordem.length === 0) return tabs;
    const byId = new Map(tabs.map(t => [t.id, t]));
    const out = [];
    ordem.forEach(id => { if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); } });
    byId.forEach(t => out.push(t)); // abas que nao estavam na ordem salva
    return out;
  }
  function salvarOrdemAbas(moduleId, idsOrdem) {
    _navStore.set('tabsOrder:' + moduleId, idsOrdem);
  }

  function navigateTo(moduleId, tabId = null) {
    const def = moduleDefinitions[moduleId];
    if (!def) return;
    state.currentModule = moduleId;
    state.currentTab = tabId || (def.tabs ? def.tabs[0].id : null);

    $$('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.module === moduleId));
    $('#breadcrumb').textContent = def.breadcrumb;
    $('#main-title').textContent = def.title;
    $('#main-subtitle').textContent = def.subtitle || '';

    const subNavEl = $('#sub-nav');
    if (def.tabs) {
      // Felipe sessao 2026-08-02: abas restritas a admin: Usuarios e Permissoes
      const tabsVisiveis = def.tabs.filter(t => {
        if ((t.id === 'usuarios' || t.id === 'permissoes') && !Auth.isAdmin()) return false;
        return true;
      });
      // R15: aplica ordem persistida das abas (reordenaveis por drag).
      // Ids salvos primeiro (na ordem); abas novas vao pro final.
      const tabsOrdenadas = aplicarOrdemAbas(moduleId, tabsVisiveis);
      // Felipe (do doc): tabindex="-1" tira a navegacao do tab order.
      // TAB pula direto entre os campos do form, sem entrar nas abas.
      // Mouse continua funcionando normal (click).
      subNavEl.innerHTML = tabsOrdenadas.map(t => {
        // Felipe (do doc - msg wizard): se modulo orcamento, consulta o wizard
        // pra saber se a aba esta liberada. Aba bloqueada (etapa futura ainda
        // nao concluida) ganha class is-locked — opacity baixa, cursor disabled.
        let cls = 'sub-nav-item';
        if (t.id === state.currentTab) cls += ' is-active';
        let locked = false;
        if (moduleId === 'orcamento' && window.OrcamentoWizard && typeof window.OrcamentoWizard.tabLiberada === 'function') {
          if (!window.OrcamentoWizard.tabLiberada(t.id)) {
            cls += ' is-locked';
            locked = true;
          }
        }
        const lockIcon = locked ? '🔒 ' : '';
        return `<button class="${cls}" data-tab="${t.id}" draggable="true" tabindex="-1" ${locked ? 'aria-disabled="true"' : ''}>${lockIcon}${t.label}</button>`;
      }).join('');
      subNavEl.hidden = false;
      subNavEl.querySelectorAll('.sub-nav-item').forEach(btn => {
        // Click: navega para a aba (se nao bloqueada)
        btn.addEventListener('click', () => {
          if (btn.classList.contains('is-locked')) {
            // Felipe (do doc - msg wizard): aba bloqueada — nao navega,
            // mostra o motivo via Wizard.
            if (window.OrcamentoWizard && typeof window.OrcamentoWizard.alertarBloqueio === 'function') {
              window.OrcamentoWizard.alertarBloqueio(btn.dataset.tab);
            } else {
              alert('Conclua a etapa anterior antes de avancar.');
            }
            return;
          }
          navigateTo(moduleId, btn.dataset.tab);
        });
        // R15: drag-and-drop pra reordenar
        btn.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', btn.dataset.tab);
          btn.classList.add('is-dragging');
        });
        btn.addEventListener('dragend', () => {
          btn.classList.remove('is-dragging');
          subNavEl.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
        });
        btn.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          btn.classList.add('is-drop-target');
        });
        btn.addEventListener('dragleave', () => {
          btn.classList.remove('is-drop-target');
        });
        btn.addEventListener('drop', (e) => {
          e.preventDefault();
          btn.classList.remove('is-drop-target');
          const draggedId = e.dataTransfer.getData('text/plain');
          const targetId  = btn.dataset.tab;
          if (!draggedId || draggedId === targetId) return;
          const novaOrdem = tabsOrdenadas.map(t => t.id);
          const fromIdx = novaOrdem.indexOf(draggedId);
          const toIdx   = novaOrdem.indexOf(targetId);
          if (fromIdx < 0 || toIdx < 0) return;
          novaOrdem.splice(fromIdx, 1);
          novaOrdem.splice(toIdx, 0, draggedId);
          salvarOrdemAbas(moduleId, novaOrdem);
          navigateTo(moduleId, state.currentTab);
        });
      });
    } else {
      subNavEl.hidden = true;
      subNavEl.innerHTML = '';
    }

    renderModule(moduleId, state.currentTab);
    Events.emit('navigation:change', { module: moduleId, tab: state.currentTab });
  }

  function renderModule(moduleId, tabId) {
    const container = $('#main-content');

    // Felipe sessao 2026-08-02: controle de readonly em Cadastros
    // pra users nao-admin. ADM faz tudo, USER so' visualiza por padrao.
    // Permissoes granulares (cadastros:acessorios:editar etc) podem
    // liberar tabs especificas pra user nao-admin.
    const ehCadastros = (moduleId === 'cadastros');
    // Felipe sessao 2026-08-02: usa Auth global direto (nao window.Auth).
    // window.Auth pode nao estar disponivel em alguns browsers porque
    // Auth e' declarado com 'const' no escopo top-level (nao vira
    // automaticamente window.Auth em modulos ESM/strict).
    const isAdmin     = (typeof Auth !== 'undefined') && Auth.isAdmin && Auth.isAdmin();
    const session     = (typeof Auth !== 'undefined') && Auth.currentUser ? Auth.currentUser() : null;

    // Mapa tab → permissao granular
    const TAB_PERMISSAO = {
      'acessorios':     'cadastros:acessorios:editar',
      'perfis':         'cadastros:perfis:editar',
      'superficies':    'cadastros:superficies:editar',
      'modelos':        'cadastros:modelos:editar',
      'regras':         'cadastros:regras:editar',
      'representantes': 'cadastros:representantes:editar',
      'mensagens':      'cadastros:mensagens:editar',
      'filtros':        'cadastros:filtros:editar',
    };

    let readOnlyCad = false;
    if (ehCadastros && !isAdmin) {
      // Bloqueia abas restritas pra nao-admin (Usuarios, Permissoes)
      if (tabId === 'usuarios' || tabId === 'permissoes') {
        tabId = 'acessorios';
        state.currentTab = tabId;
      }
      // Checa permissao granular pra esta tab especifica
      const permGranular = TAB_PERMISSAO[tabId];
      const podeEditarTab = permGranular && session && window.Permissoes
        && window.Permissoes.userTemPermissao
        && window.Permissoes.userTemPermissao(session.username, permGranular);
      readOnlyCad = !podeEditarTab;
    }

    if (readOnlyCad) {
      document.body.dataset.cadastrosReadonly = '1';
    } else {
      delete document.body.dataset.cadastrosReadonly;
    }

    const mod = modules[moduleId];
    if (mod && typeof mod.render === 'function') {
      try { mod.render(container, tabId); }
      catch (e) {
        console.error('[App] erro ao renderizar modulo', moduleId, e);
        container.innerHTML = renderError(moduleId, e);
      }

      // Apos render, marca a tela como cadastros-tela (pro CSS pegar)
      // e injeta banner de readonly se aplicavel.
      if (ehCadastros) {
        try {
          const inner = container.firstElementChild;
          if (inner && !inner.classList.contains('cadastros-tela')) {
            inner.classList.add('cadastros-tela');
          }
          if (readOnlyCad && !container.querySelector('.cadastros-readonly-banner')) {
            const banner = document.createElement('div');
            banner.className = 'cadastros-readonly-banner';
            banner.innerHTML = `
              <span class="ico">🔒</span>
              <div class="body">
                <strong>Modo somente leitura</strong>
                Olá ${session ? (session.name || session.username) : ''} — esta área é restrita.
                Você consegue visualizar mas só edita o que o admin liberar pra você (em Cadastros &gt; Permissões).
              </div>
            `;
            if (inner) inner.insertBefore(banner, inner.firstChild);
            else container.insertBefore(banner, container.firstChild);
          }
        } catch(_) {}
      }
      return;
    }
    container.innerHTML = renderPlaceholder(moduleId, tabId);
  }

  function renderPlaceholder(moduleId, tabId) {
    const def = moduleDefinitions[moduleId];
    const tabLabel = tabId && def.tabs ? def.tabs.find(t => t.id === tabId)?.label : null;
    return `
      <div class="info-banner">
        <span class="t-strong">Fase atual:</span> construcao da fundacao. Os modulos serao preenchidos um a um nas proximas entregas.
      </div>
      <div class="placeholder">
        <div class="icon-big">⚙️</div>
        <h3>Modulo em construcao</h3>
        <p>Esta area (<span class="t-strong">${def.title}${tabLabel ? ' — ' + tabLabel : ''}</span>)
        esta reservada e isolada. Quando for implementada, nada nas outras areas sera afetado.</p>
        <span class="tag">modulo: ${moduleId}${tabId ? ' · aba: ' + tabId : ''}</span>
      </div>
    `;
  }

  function renderError(moduleId, err) {
    return `
      <div class="placeholder" style="border-color: var(--danger);">
        <div class="icon-big">⚠️</div>
        <h3>Erro no modulo</h3>
        <p>O modulo <code>${moduleId}</code> falhou ao renderizar. Os outros modulos continuam funcionando normalmente.</p>
        <pre style="font-family: monospace; font-size: 12px; color: var(--danger); margin-top: 18px; text-align: left; overflow:auto;">${(err && err.message) || err}</pre>
      </div>
    `;
  }

  function register(moduleId, moduleObj) {
    modules[moduleId] = moduleObj;
    if (state.currentModule === moduleId) {
      renderModule(moduleId, state.currentTab);
    }
  }

  function showLogin() {
    $('#app-shell').hidden = true;
    $('#login-screen').hidden = false;
    $('#login-form').reset();
  }
  function showApp() {
    const session = Auth.currentUser();
    if (!session) { showLogin(); return; }
    $('#login-screen').hidden = true;
    $('#app-shell').hidden = false;
    $('#topbar-user-name').textContent = session.name || session.username;
    navigateTo('crm');
  }

  function init() {
    bindLogin();
    bindLogout();
    bindNav();
    if (Auth.currentUser()) showApp(); else showLogin();
  }

  return { init, register, navigateTo, state };
})();
