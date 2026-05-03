/* ============================================================
   29-filtros.js — Cadastros > Filtros
   ============================================================
   Felipe (sessao 2026-05): central onde o usuario edita listas
   de classificacoes/categorias/fornecedores que antes estavam
   HARDCODED nos modulos. Cada modulo consumidor (Perfis,
   Acessorios, Representantes) le sua lista via API publica.

   IMPORTANTE — escopo:
     Apenas filtros sem dependencia de logica de negocio sao
     editaveis aqui. Filtros com IDs amarrados a regras de codigo
     (etapas CRM, tipos_item orcamento, categorias superficies,
     sistemas porta) PERMANECEM HARDCODED nos seus modulos —
     mexer neles quebraria fluxo do pipeline, forms, ou regras.

   Filtros gerenciados (5 listas):
     - perfis_fornecedor      → Mercado, Tecnoperfil, ...
     - perfis_tratamento      → Pintura, Natural, ...
     - acessorios_fornecedor  → 32 fornecedores hoje
     - acessorios_familia     → Buchas, Vedacoes, Veda Porta, ...
     - rep_classificacao      → Representante, Showroom, Gerente, ...
       (Felipe sessao 2026-05: usado tambem como cargo dos contatos
        individuais — antes era um filtro separado 'rep_cargo')

   Storage:
     scope 'cadastros', chave 'filtros_listas' → { [id]: [...itens] }

   API publica em window.Filtros:
     - listar(id, fallback)         → array (ordenado), com fallback
     - obterTodos()                 → snapshot completo
     - adicionar(id, item)          → push se nao existe
     - remover(id, item)            → splice
     - substituir(id, novaLista)    → set total
     - resetar(id)                  → volta pro seed
     - SCHEMA                       → metadata dos filtros
     - render(container)            → UI do cadastro
   ============================================================ */
const Filtros = (() => {
  'use strict';

  function store() { return Storage.scope('cadastros'); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ============================================================
  // SCHEMA — metadata de cada filtro gerenciado
  // ============================================================
  // 'seed' = lista padrao usada quando o usuario nunca editou
  // (ou clicou "Resetar"). Esses sao os mesmos valores que estavam
  // hardcoded nos modulos antes da centralizacao.
  const SCHEMA = Object.freeze([
    {
      id: 'perfis_fornecedor',
      grupo: 'Perfis',
      label: 'Fornecedor de Perfis',
      desc: 'Origem dos perfis de aluminio cadastrados (campo "Fornecedor" em Cadastros > Perfis).',
      seed: ['Mercado', 'Tecnoperfil'],
      caseSensitive: false,
    },
    {
      id: 'perfis_tratamento',
      grupo: 'Perfis',
      label: 'Tratamento de Perfis',
      desc: 'Acabamento aplicado nos perfis (campo "Tratamento" em Cadastros > Perfis).',
      seed: ['Pintura', 'Natural'],
      caseSensitive: false,
    },
    {
      id: 'acessorios_fornecedor',
      grupo: 'Acessorios',
      label: 'Fornecedor de Acessorios',
      desc: 'Fabricantes/distribuidores de acessorios (puxadores, fechaduras, dobradicas, etc.).',
      seed: ['ATELIER DU METAL','CDA METAIS','CENTROOESTE','CVL','DECAMP','DOORWIN','DORMAKABA','DOWSIL','ECLISSE','EMTECO','FISCHER','HANDCRAFT','HOMEX','HYDRO','INOX-PAR','INSTALE','JNF','KESO','MAHLHER','MERCADO','NEOMEC','NUKI','PORTTAL','PRIMA FERRAGENS','PROJETOAL','SCHLEGEL','SOLDAL','STYRO','UDINESE','UNIFORT','WURTH','ZAKA'],
      caseSensitive: true, // todos em CAIXA ALTA por convencao
    },
    {
      id: 'acessorios_familia',
      grupo: 'Acessorios',
      label: 'Familia de Acessorios',
      desc: 'Categorias de acessorios para filtragem na tabela (Veda Porta, Vedacoes, Cilindros, etc.).',
      seed: ['Buchas','Caixetas','Calços','Cilindros','Contra Testa','Dobradiças','Dobras','Embalagem','Esferas','Fechadura Digital','Fechadura Magnética','Fechadura Mecânica','Fechos','Fitas Adesivas','Isolante termico','Maçanetas','Mola aérea','Outros Insumos Produção&Instalação','Parafusos','Pivô','Puxadores','Roldanas','Rosetas','Selantes > Silicones > Quimicos','Spray','Trava Porta','Uso e Consumo Produção&Instalação','Veda Porta','Vedações'],
      caseSensitive: false,
    },
    {
      id: 'rep_classificacao',
      grupo: 'Representantes',
      label: 'Classificacao do Representante',
      desc: 'Categoria do representante na hierarquia comercial. Usado tambem como cargo dos contatos individuais (drawer de cada representante).',
      seed: ['Representante', 'Vendedor', 'Showroom', 'Supervisor', 'Coordenador', 'Gerente', 'Diretor', 'Gestor'],
      caseSensitive: false,
    },
  ]);

  function _porId(id) {
    return SCHEMA.find(s => s.id === id) || null;
  }

  // ============================================================
  // STORAGE
  // ============================================================
  function _loadAll() {
    return store().get('filtros_listas') || {};
  }
  function _saveAll(obj) {
    store().set('filtros_listas', obj || {});
  }

  // ============================================================
  // API PUBLICA
  // ============================================================

  /**
   * Devolve a lista atual (ordenada, sem duplicados).
   * Se NAO foi editada, retorna o seed do SCHEMA.
   * Se SCHEMA nao tem o id E fallback foi passado, retorna fallback.
   */
  function listar(id, fallback) {
    const all = _loadAll();
    if (Object.prototype.hasOwnProperty.call(all, id)) {
      const arr = Array.isArray(all[id]) ? all[id].slice() : [];
      return arr;
    }
    const meta = _porId(id);
    if (meta) return meta.seed.slice();
    return Array.isArray(fallback) ? fallback.slice() : [];
  }

  function obterTodos() {
    const out = {};
    SCHEMA.forEach(meta => {
      out[meta.id] = listar(meta.id);
    });
    return out;
  }

  function _norm(item, caseSensitive) {
    const s = String(item == null ? '' : item).trim();
    return caseSensitive ? s : s.toLowerCase();
  }
  function _existe(lista, item, caseSensitive) {
    const a = _norm(item, caseSensitive);
    return lista.some(x => _norm(x, caseSensitive) === a);
  }

  function adicionar(id, item) {
    const meta = _porId(id);
    if (!meta) return false;
    const novo = String(item || '').trim();
    if (!novo) return false;
    const all = _loadAll();
    const lista = Array.isArray(all[id]) ? all[id].slice() : meta.seed.slice();
    if (_existe(lista, novo, meta.caseSensitive)) return false;
    lista.push(novo);
    lista.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
    all[id] = lista;
    _saveAll(all);
    return true;
  }

  function remover(id, item) {
    const meta = _porId(id);
    if (!meta) return false;
    const all = _loadAll();
    const lista = Array.isArray(all[id]) ? all[id].slice() : meta.seed.slice();
    const alvo = _norm(item, meta.caseSensitive);
    const idx = lista.findIndex(x => _norm(x, meta.caseSensitive) === alvo);
    if (idx < 0) return false;
    lista.splice(idx, 1);
    all[id] = lista;
    _saveAll(all);
    return true;
  }

  function substituir(id, novaLista) {
    const meta = _porId(id);
    if (!meta) return false;
    const all = _loadAll();
    all[id] = Array.isArray(novaLista) ? novaLista.slice() : [];
    _saveAll(all);
    return true;
  }

  function resetar(id) {
    const meta = _porId(id);
    if (!meta) return false;
    const all = _loadAll();
    delete all[id];
    _saveAll(all);
    return true;
  }

  // ============================================================
  // RENDER (UI do cadastro)
  // ============================================================
  function render(container) {
    // Agrupa filtros por categoria (Perfis, Acessorios, Representantes)
    const grupos = {};
    SCHEMA.forEach(meta => {
      if (!grupos[meta.grupo]) grupos[meta.grupo] = [];
      grupos[meta.grupo].push(meta);
    });

    const blocos = Object.keys(grupos).map(nomeGrupo => {
      const filtrosDoGrupo = grupos[nomeGrupo];
      const cards = filtrosDoGrupo.map(meta => renderCardFiltro(meta)).join('');
      return `
        <div class="flt-grupo">
          <h3 class="flt-grupo-titulo">${escapeHtml(nomeGrupo)}</h3>
          <div class="flt-grupo-cards">${cards}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="flt-wrap">
        <div class="flt-intro">
          <p class="flt-intro-texto">
            <span class="t-strong">Filtros editaveis</span> — gerencie aqui as classificacoes,
            categorias e listas de fornecedores que aparecem nos demais cadastros.
            Adicionar/remover itens aqui reflete imediatamente em <span class="t-strong">Perfis</span>,
            <span class="t-strong">Acessorios</span> e <span class="t-strong">Representantes</span>.
          </p>
          <p class="flt-intro-info">
            Filtros com regras de negocio (etapas CRM, tipos de item, categorias de superficie,
            sistemas de porta) NAO aparecem aqui — sao controlados pelo codigo para preservar
            a logica de calculo.
          </p>
        </div>
        <div class="flt-toast" id="flt-toast" hidden></div>
        ${blocos}
      </div>
    `;

    // Felipe (sessao 2026-05): bind no flt-wrap (recriado a cada render)
    // em vez do container (persiste). Evita acumulo de listeners que
    // antes causava o bug de "clicar Adicionar e nada acontecer apos
    // alguns cliques" — cada handler executava N vezes em paralelo.
    const wrap = container.querySelector('.flt-wrap');
    if (wrap) bindHandlers(container, wrap);
  }

  function renderCardFiltro(meta) {
    const lista = listar(meta.id);
    const isCustomizada = Object.prototype.hasOwnProperty.call(_loadAll(), meta.id);
    const itensHtml = lista.length === 0
      ? `<li class="flt-item-empty">Lista vazia. Adicione itens abaixo.</li>`
      : lista.map(it => `
          <li class="flt-item" data-valor="${escapeHtml(it)}">
            <span class="flt-item-texto">${escapeHtml(it)}</span>
            <button type="button" class="flt-btn-del" data-acao="remover" data-id="${escapeHtml(meta.id)}" data-valor="${escapeHtml(it)}" title="Remover">×</button>
          </li>
        `).join('');

    return `
      <div class="flt-card" data-id="${escapeHtml(meta.id)}">
        <div class="flt-card-head">
          <div class="flt-card-titulo-wrap">
            <h4 class="flt-card-titulo">${escapeHtml(meta.label)}</h4>
            ${isCustomizada ? '<span class="flt-tag-custom" title="Lista foi alterada do padrao">customizada</span>' : '<span class="flt-tag-seed" title="Lista usa os valores padrao do sistema">padrao</span>'}
          </div>
          <button type="button" class="flt-btn-reset" data-acao="resetar" data-id="${escapeHtml(meta.id)}" title="Restaurar valores padrao">↺ Resetar</button>
        </div>
        <p class="flt-card-desc">${escapeHtml(meta.desc)}</p>

        <ul class="flt-itens">${itensHtml}</ul>

        <div class="flt-add">
          <input type="text" class="cad-input flt-add-input" placeholder="Adicionar novo item..." data-id="${escapeHtml(meta.id)}" />
          <button type="button" class="btn btn-primary btn-sm flt-btn-add" data-acao="adicionar" data-id="${escapeHtml(meta.id)}">+ Adicionar</button>
        </div>

        <div class="flt-card-rodape">
          <span class="flt-contagem">${lista.length} ite${lista.length === 1 ? 'm' : 'ns'}</span>
          ${meta.caseSensitive ? '<span class="flt-flag-case">case-sensitive</span>' : ''}
        </div>
      </div>
    `;
  }

  // ============================================================
  // HANDLERS
  // ============================================================
  function bindHandlers(container, wrap) {
    // Felipe (sessao 2026-05): toast inline pra feedback claro
    // (substitui o "nada acontece" silencioso do bug original).
    function flashToast(texto, tipo = 'info') {
      const toast = container.querySelector('#flt-toast');
      if (!toast) return;
      toast.textContent = texto;
      toast.className = 'flt-toast flt-toast-' + tipo;
      toast.hidden = false;
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { toast.hidden = true; }, 2500);
    }

    // Adicionar via botao — handler no WRAP (que e recriado a cada render),
    // nao no container (que persiste e acumularia listeners).
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-acao]');
      if (!btn) return;
      const acao = btn.dataset.acao;
      const id   = btn.dataset.id;
      if (!id) return;

      if (acao === 'adicionar') {
        const input = wrap.querySelector(`.flt-add-input[data-id="${id}"]`);
        if (!input) return;
        const valor = String(input.value || '').trim();
        if (!valor) {
          // Felipe (sessao 2026-05): feedback claro quando input vazio
          // — antes retornava silenciosamente ("nada acontece").
          input.classList.add('is-erro');
          input.focus();
          flashToast('Digite o nome do item antes de clicar em Adicionar', 'erro');
          setTimeout(() => input.classList.remove('is-erro'), 1500);
          return;
        }
        const ok = adicionar(id, valor);
        if (ok) {
          flashToast(`✓ "${valor}" adicionado com sucesso`, 'ok');
          input.value = '';
          render(container); // re-render a aba inteira
        } else {
          // Item ja existe — feedback claro
          input.classList.add('is-erro');
          flashToast(`"${valor}" ja existe na lista`, 'erro');
          setTimeout(() => input.classList.remove('is-erro'), 1500);
        }
      } else if (acao === 'remover') {
        const valor = btn.dataset.valor;
        if (!confirm(`Remover "${valor}" da lista? Itens ja cadastrados que usam esse valor permanecem com o valor antigo, mas nao podem mais ser selecionados.`)) return;
        remover(id, valor);
        flashToast(`"${valor}" removido`, 'ok');
        render(container);
      } else if (acao === 'resetar') {
        const meta = _porId(id);
        if (!meta) return;
        if (!confirm(`Restaurar a lista "${meta.label}" ao padrao?\n\nItens adicionados pelo usuario serao removidos. Itens removidos serao restaurados.`)) return;
        resetar(id);
        flashToast(`Lista "${meta.label}" restaurada ao padrao`, 'ok');
        render(container);
      }
    });

    // Adicionar via Enter no input
    wrap.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const input = e.target.closest('.flt-add-input');
      if (!input) return;
      e.preventDefault();
      const id = input.dataset.id;
      const valor = String(input.value || '').trim();
      if (!valor) {
        input.classList.add('is-erro');
        flashToast('Digite o nome do item antes de pressionar Enter', 'erro');
        setTimeout(() => input.classList.remove('is-erro'), 1500);
        return;
      }
      if (!id) return;
      const ok = adicionar(id, valor);
      if (ok) {
        flashToast(`✓ "${valor}" adicionado com sucesso`, 'ok');
        input.value = '';
        render(container);
      } else {
        input.classList.add('is-erro');
        flashToast(`"${valor}" ja existe na lista`, 'erro');
        setTimeout(() => input.classList.remove('is-erro'), 1500);
      }
    });
  }

  // API publica
  return {
    SCHEMA,
    listar,
    obterTodos,
    adicionar,
    remover,
    substituir,
    resetar,
    render,
  };
})();

// Expor globalmente — modulos consumidores leem via window.Filtros.listar()
window.Filtros = Filtros;
