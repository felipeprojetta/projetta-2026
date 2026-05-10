/* 20-instaladores.js — Cadastro de instaladores.
   Persistencia: Storage.scope('instaladores'). CSS prefixo .ins-*.

   ============================================================
   MODULO: INSTALADORES (Cadastro)
   ============================================================
   Felipe (sessao 2026-05-10):
   "cadastre os instaladores, quando em instalacao for selecionar
    equipe vai ter um filtro e vamos escolher quem vai, podem ser
    1, 2, 3, 4 ou 5 pessoas".

   Lista os instaladores cadastrados pra serem reutilizados no
   modulo Instalacao (Agenda Obras). Cada job de instalacao agora
   pode ter multiplos instaladores selecionados (multi-select).

   Storage:
   Storage.scope('instaladores').lista = [
     { id, nome, telefone, ativo }
   ]

   API publica via window.Instaladores:
   - listar()           -> [...]
   - adicionar(nome, telefone)
   - remover(id)
   - listarAtivos()     -> [...] (so ativo=true)
   ============================================================ */
(() => {
  'use strict';

  // Felipe (sessao 2026-05-10): seed inicial com os 5 nomes que
  // Felipe mandou. Ficam ativos por padrao. Felipe pode editar
  // depois (adicionar mais, desativar, etc).
  const SEED_INSTALADORES = [
    'ANDERSON CARLUS DIAS DA SILVA',
    'LUIZ CLAUDIO DE SOUZA RODRIGUES',
    'OZIAS FLAVIO DE OLIVEIRA',
    'PATRICK DE LUCAS FURTADO PINHEIRO',
    'VINICIUS DE SOUZA SANTOS',
  ];

  const store = Storage.scope('instaladores');
  const state = {
    lista: [],
    loaded: false,
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function genId() {
    return 'inst_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    if (state.loaded) return;
    const lista = store.get('lista');
    if (Array.isArray(lista)) {
      state.lista = lista;
    } else {
      // Felipe (sessao 2026-05-10): seed inicial uma vez so'.
      state.lista = SEED_INSTALADORES.map(nome => ({
        id: genId(),
        nome,
        telefone: '',
        ativo: true,
      }));
      store.set('lista', state.lista);
    }
    state.loaded = true;
  }
  function save() { store.set('lista', state.lista); }

  // ============================================================
  // API PUBLICA (chamada por outros modulos, ex: Instalacao)
  // ============================================================
  function listar() {
    load();
    return state.lista.slice();
  }
  function listarAtivos() {
    return listar().filter(i => i.ativo !== false);
  }
  function adicionar(nome, telefone) {
    load();
    const novo = {
      id: genId(),
      nome: String(nome || '').trim().toUpperCase(),
      telefone: String(telefone || '').trim(),
      ativo: true,
    };
    if (!novo.nome) return null;
    state.lista.push(novo);
    save();
    return novo;
  }
  function remover(id) {
    load();
    const i = state.lista.findIndex(x => x.id === id);
    if (i < 0) return false;
    state.lista.splice(i, 1);
    save();
    return true;
  }
  function atualizar(id, dados) {
    load();
    const inst = state.lista.find(x => x.id === id);
    if (!inst) return false;
    if (dados.nome     != null) inst.nome     = String(dados.nome).trim().toUpperCase();
    if (dados.telefone != null) inst.telefone = String(dados.telefone).trim();
    if (dados.ativo    != null) inst.ativo    = !!dados.ativo;
    save();
    return true;
  }
  function buscarPorId(id) {
    load();
    return state.lista.find(x => x.id === id) || null;
  }

  // ============================================================
  // RENDER (tela de cadastro)
  // ============================================================
  function render(container) {
    load();
    const ativos = state.lista.filter(i => i.ativo !== false);
    container.innerHTML = `
      <div class="ins-header">
        <div>
          <h2 class="ins-title">Cadastro de Instaladores</h2>
          <p class="ins-subtitle">Lista usada na selecao de equipes do modulo Instalacao.</p>
        </div>
        <div class="ins-stats">
          <span class="ins-pill">${ativos.length} ativo(s)</span>
          <span class="ins-pill">${state.lista.length} total</span>
        </div>
      </div>

      <div class="ins-form-novo">
        <input type="text" id="ins-novo-nome" placeholder="Nome do instalador" />
        <input type="text" id="ins-novo-tel" placeholder="Telefone (opcional)" />
        <button class="ins-btn-add" id="ins-btn-add">+ Adicionar</button>
      </div>

      <div class="ins-tabela-wrap">
        <table class="ins-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th class="ins-col-status">Status</th>
              <th class="ins-col-acoes">Acoes</th>
            </tr>
          </thead>
          <tbody>
            ${state.lista.length === 0
              ? `<tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af;">Nenhum instalador cadastrado.</td></tr>`
              : state.lista.map(i => `
                <tr data-id="${escapeHtml(i.id)}" class="${i.ativo === false ? 'ins-row-inativo' : ''}">
                  <td>
                    <input type="text" class="ins-input-nome" data-field="nome" data-id="${escapeHtml(i.id)}" value="${escapeHtml(i.nome)}" />
                  </td>
                  <td>
                    <input type="text" class="ins-input-tel" data-field="telefone" data-id="${escapeHtml(i.id)}" value="${escapeHtml(i.telefone || '')}" placeholder="—" />
                  </td>
                  <td class="ins-col-status">
                    <label class="ins-toggle">
                      <input type="checkbox" data-action="toggle-ativo" data-id="${escapeHtml(i.id)}" ${i.ativo !== false ? 'checked' : ''} />
                      <span>${i.ativo !== false ? 'Ativo' : 'Inativo'}</span>
                    </label>
                  </td>
                  <td class="ins-col-acoes">
                    <button class="ins-btn-remover" data-action="remover" data-id="${escapeHtml(i.id)}" title="Remover">×</button>
                  </td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Adicionar
    container.querySelector('#ins-btn-add')?.addEventListener('click', () => {
      const nomeEl = container.querySelector('#ins-novo-nome');
      const telEl  = container.querySelector('#ins-novo-tel');
      const nome = (nomeEl?.value || '').trim();
      if (!nome) {
        nomeEl?.focus();
        return;
      }
      adicionar(nome, telEl?.value || '');
      render(container);
    });
    container.querySelector('#ins-novo-nome')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') container.querySelector('#ins-btn-add')?.click();
    });

    // Editar inline
    container.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('change', () => {
        const id = el.dataset.id;
        const field = el.dataset.field;
        atualizar(id, { [field]: el.value });
      });
    });

    // Toggle ativo
    container.querySelectorAll('[data-action="toggle-ativo"]').forEach(cb => {
      cb.addEventListener('change', () => {
        atualizar(cb.dataset.id, { ativo: cb.checked });
        render(container);
      });
    });

    // Remover
    container.querySelectorAll('[data-action="remover"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const inst = buscarPorId(btn.dataset.id);
        if (!inst) return;
        if (confirm(`Remover ${inst.nome}? Essa acao nao pode ser desfeita.`)) {
          remover(btn.dataset.id);
          render(container);
        }
      });
    });
  }

  function forceReload(container) {
    state.loaded = false;
    load();
    if (container) render(container);
  }

  // API publica
  const Instaladores = {
    render, forceReload,
    listar, listarAtivos, adicionar, remover, atualizar, buscarPorId,
  };
  window.Instaladores = Instaladores;

  App.register('instaladores', {
    render(container) {
      Instaladores.forceReload(container);
    }
  });
})();
