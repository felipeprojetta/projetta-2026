/* 03-table-tools.js — TableTools (helpers de tabela: sort, filter, paginate). */

  const TableTools = (() => {
    // Normaliza valor para uso em ordenacao (lowercase, sem acento)
    function norm(v) {
      if (v == null) return '';
      return String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Devolve lista ordenada+filtrada de items.
    function applySortFilter(items, defs, state) {
      const filtros = state.tableFilters || {};
      let out = items.filter(item => {
        for (const def of defs) {
          const ativos = filtros[def.key];
          if (!ativos || !(ativos instanceof Set) || ativos.size === 0) continue;
          const valor = def.getValue(item);
          const formatado = def.formatValue ? def.formatValue(valor) : (valor == null ? '' : String(valor));
          if (!ativos.has(formatado)) return false;
        }
        return true;
      });
      const sort = state.tableSort || {};
      if (sort.coluna && sort.dir) {
        const def = defs.find(d => d.key === sort.coluna);
        if (def) {
          out = out.slice().sort((a, b) => {
            const va = def.getValue(a);
            const vb = def.getValue(b);
            let cmp;
            if (def.type === 'number') {
              cmp = (Number(va) || 0) - (Number(vb) || 0);
            } else {
              cmp = norm(va).localeCompare(norm(vb), 'pt-BR');
            }
            return sort.dir === 'asc' ? cmp : -cmp;
          });
        }
      }
      return out;
    }

    function setaOrdenacao(def, state) {
      const s = state.tableSort || {};
      if (s.coluna !== def.key || !s.dir) return '↕';
      return s.dir === 'asc' ? '▲' : '▼';
    }

    // Lista todos os valores unicos (formatados) que aparecem na coluna
    // entre os items dados, para popular o dropdown do filtro.
    function valoresUnicos(items, def) {
      const set = new Set();
      items.forEach(item => {
        const v = def.getValue(item);
        const f = def.formatValue ? def.formatValue(v) : (v == null ? '' : String(v));
        set.add(f);
      });
      return Array.from(set).sort((a, b) => norm(a).localeCompare(norm(b), 'pt-BR'));
    }

    // Gera HTML do <th> com seta de sort e botao de filtro
    function renderHeader(def, state, todosItems) {
      const sortable = def.sortable !== false;
      const filterable = def.filterable !== false;
      const ativosSort = (state.tableSort || {}).coluna === def.key && (state.tableSort || {}).dir;
      const ativosFiltro = (state.tableFilters || {})[def.key];
      const filtroAtivo = ativosFiltro && ativosFiltro instanceof Set && ativosFiltro.size > 0;
      const cls = [
        sortable ? 'univ-th-sortable' : '',
        ativosSort ? 'is-sorted' : '',
        filtroAtivo ? 'is-filtered' : '',
        def.align === 'right' ? 'univ-th-right' : '',
      ].filter(Boolean).join(' ');
      const style = def.minWidth ? `style="min-width:${def.minWidth};"` : '';
      const arrow = sortable ? `<span class="univ-sort-arrow">${setaOrdenacao(def, state)}</span>` : '';
      const filterBtn = filterable ?
        `<button type="button" class="univ-filter-trigger" data-col="${def.key}" title="Filtrar">${filtroAtivo ? '⚑' : '▾'}</button>` : '';
      return `<th class="${cls}" data-col="${def.key}" ${style}><span class="univ-th-label" data-sort-col="${def.key}">${escapeBasic(def.label)}${arrow}</span>${filterBtn}</th>`;
    }

    function renderHeaderRow(defs, state) {
      return '<tr>' + defs.map(d => renderHeader(d, state)).join('') + '</tr>';
    }

    // Pluga handlers de click nos cabecalhos (sort) e botoes de filtro.
    // onChange e' chamado quando o estado muda — modulo deve re-renderizar.
    function attachHeaderEvents(container, defs, state, items, onChange) {
      // Sort: clica no label
      container.querySelectorAll('.univ-th-label').forEach(span => {
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          const col = span.dataset.sortCol;
          const def = defs.find(d => d.key === col);
          if (!def || def.sortable === false) return;
          const s = state.tableSort || (state.tableSort = { coluna: null, dir: null });
          if (s.coluna !== col) {
            s.coluna = col; s.dir = 'asc';
          } else if (s.dir === 'asc')      s.dir = 'desc';
          else if (s.dir === 'desc') { s.coluna = null; s.dir = null; }
          else                              s.dir = 'asc';
          onChange();
        });
      });
      // Filtro: clica no botao funil
      container.querySelectorAll('.univ-filter-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const col = btn.dataset.col;
          const def = defs.find(d => d.key === col);
          if (!def) return;
          abrirDropdownFiltro(btn, def, state, items, onChange);
        });
      });
    }

    function fecharTodosDropdowns() {
      document.querySelectorAll('.univ-filter-dropdown').forEach(el => el.remove());
    }

    function abrirDropdownFiltro(triggerBtn, def, state, items, onChange) {
      // Se ja esta aberto pra essa coluna, fecha
      const existente = document.querySelector(`.univ-filter-dropdown[data-col="${def.key}"]`);
      fecharTodosDropdowns();
      if (existente) return;

      const valores = valoresUnicos(items, def);
      if (!state.tableFilters) state.tableFilters = {};
      const ativos = state.tableFilters[def.key] instanceof Set
        ? new Set(state.tableFilters[def.key])
        : new Set(valores); // por default, todos selecionados

      const dropdown = document.createElement('div');
      dropdown.className = 'univ-filter-dropdown';
      dropdown.dataset.col = def.key;
      dropdown.innerHTML = `
        <div class="univ-filter-search-wrap">
          <input type="text" class="univ-filter-search" placeholder="Buscar valor..." />
        </div>
        <div class="univ-filter-toggle-all">
          <label><input type="checkbox" class="univ-filter-all" /> Selecionar todos</label>
        </div>
        <div class="univ-filter-list">
          ${valores.map(v => `
            <label class="univ-filter-item">
              <input type="checkbox" value="${escapeBasic(v)}" ${ativos.has(v) ? 'checked' : ''} />
              <span>${escapeBasic(v) || '<em style="color:var(--text-muted);">(vazio)</em>'}</span>
            </label>
          `).join('')}
        </div>
        <div class="univ-filter-actions">
          <button type="button" class="univ-filter-btn-cancel">Cancelar</button>
          <button type="button" class="univ-filter-btn-apply">Aplicar</button>
        </div>
      `;
      document.body.appendChild(dropdown);
      // Posiciona embaixo do botao
      const r = triggerBtn.getBoundingClientRect();
      dropdown.style.top = (r.bottom + window.scrollY + 4) + 'px';
      dropdown.style.left = Math.max(8, r.right - 280 + window.scrollX) + 'px';

      const checkAll = dropdown.querySelector('.univ-filter-all');
      const items_ = dropdown.querySelectorAll('.univ-filter-item input');
      const sync = () => {
        const total = items_.length;
        const marcados = Array.from(items_).filter(c => c.checked).length;
        checkAll.checked = (marcados === total);
        checkAll.indeterminate = (marcados > 0 && marcados < total);
      };
      sync();
      checkAll.addEventListener('change', () => {
        items_.forEach(c => c.checked = checkAll.checked);
      });
      items_.forEach(c => c.addEventListener('change', sync));

      // Busca local nos valores
      const search = dropdown.querySelector('.univ-filter-search');
      search.addEventListener('input', () => {
        const t = norm(search.value);
        dropdown.querySelectorAll('.univ-filter-item').forEach(label => {
          const v = norm(label.querySelector('input').value);
          label.style.display = (v.includes(t)) ? '' : 'none';
        });
      });

      dropdown.querySelector('.univ-filter-btn-cancel').addEventListener('click', fecharTodosDropdowns);
      dropdown.querySelector('.univ-filter-btn-apply').addEventListener('click', () => {
        const todos = items_.length;
        const marcados = Array.from(items_).filter(c => c.checked).map(c => c.value);
        if (marcados.length === todos) {
          // Tudo selecionado -> remove filtro
          delete state.tableFilters[def.key];
        } else {
          state.tableFilters[def.key] = new Set(marcados);
        }
        fecharTodosDropdowns();
        onChange();
      });

      // Fecha clicando fora
      setTimeout(() => {
        const off = (e) => {
          if (!dropdown.contains(e.target) && e.target !== triggerBtn) {
            fecharTodosDropdowns();
            document.removeEventListener('click', off, true);
          }
        };
        document.addEventListener('click', off, true);
      }, 0);
    }

    // Helper local para evitar dependencia circular com escapeHtml dos modulos.
    function escapeBasic(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Garante limpeza de dropdowns ao trocar de modulo/aba
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', fecharTodosDropdowns);
    }

    return {
      applySortFilter,
      renderHeader,
      renderHeaderRow,
      attachHeaderEvents,
      fecharTodosDropdowns,
      valoresUnicos,
    };
  })();

if (typeof window !== 'undefined') {
  window.TableTools = TableTools;
}
