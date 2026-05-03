/* 04-universal.js — Universal helpers (autoEnhance, drag de abas).
   Implementa R12 (sort), R14 (filter+autocomplete), R15 (drag tabs). */

  /* ================================================================
   *  Universal.autoEnhance — aplica R12 (sort+filtro por coluna) em
   *  QUALQUER <table> existente, sem precisar redefinir colunas.
   *  Trabalha direto no DOM:
   *    - Click no <th> -> ordena asc/desc/nada (cicla)
   *    - Linha de filtros adicional abaixo do <thead> com input em
   *      cada coluna (filtra por texto contido — case insensitive)
   *  Como usar nos modulos:
   *    Universal.autoEnhance(container.querySelector('.cad-table'),
   *                         { skipCols: ['actions'] });
   * ================================================================ */
  const Universal = (() => {
    function normaliza(s) {
      return String(s == null ? '' : s).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    // Extrai um valor "ordenavel" da celula: tenta data-sort, senao usa
    // texto puro. Numeros sao detectados pra sort numerico.
    function valorCelula(td) {
      if (!td) return '';
      if (td.dataset && td.dataset.sort != null) return td.dataset.sort;
      // input/select dentro da celula? pega o value
      const inp = td.querySelector('input,select,textarea');
      if (inp) return inp.value || '';
      return td.textContent.trim();
    }
    function isNumerico(s) {
      if (s === '' || s == null) return false;
      // aceita "1.234,56" / "6,00%" / "1234"
      const limpo = String(s).replace(/[%R$\s]/g, '').replace(/\./g, '').replace(',', '.');
      return !isNaN(Number(limpo));
    }
    function paraNumero(s) {
      const limpo = String(s).replace(/[%R$\s]/g, '').replace(/\./g, '').replace(',', '.');
      return Number(limpo) || 0;
    }
    function compararValores(a, b) {
      if (isNumerico(a) && isNumerico(b)) return paraNumero(a) - paraNumero(b);
      return normaliza(a).localeCompare(normaliza(b), 'pt-BR');
    }

    // Estado da ordenacao guardado por tabela (via Map)
    const sortStateByTable = new WeakMap();

    // Linhas com <td colspan> sao cabecalhos de grupo / subtotal e nao
    // devem ser reordenadas nem filtradas. Helper:
    function ehLinhaEspecial(tr) {
      if (!tr || !tr.cells) return false;
      for (let i = 0; i < tr.cells.length; i++) {
        const cs = parseInt(tr.cells[i].getAttribute('colspan') || '1', 10);
        if (cs > 1) return true;
      }
      return false;
    }

    function ordenar(table, colIdx, dir) {
      const tbody = table.tBodies[0];
      if (!tbody) return;
      const rows = Array.from(tbody.rows);
      if (dir === null) {
        // restaura ordem original (re-render do modulo cuida; aqui so' nao mexe)
        return;
      }
      // Apenas linhas de dados sao reordenadas; cabecalhos de grupo /
      // subtotal (com colspan) ficam fixos onde estao.
      const dataRows = rows.filter(r => !ehLinhaEspecial(r));
      dataRows.sort((a, b) => {
        const va = valorCelula(a.cells[colIdx]);
        const vb = valorCelula(b.cells[colIdx]);
        const cmp = compararValores(va, vb);
        return dir === 'asc' ? cmp : -cmp;
      });
      // Re-anexa apenas as linhas de dados em ordem (linhas especiais
      // nao sao mexidas — quando o modulo re-renderiza, a ordem original
      // volta com os grupos no lugar certo).
      dataRows.forEach(r => tbody.appendChild(r));
    }

    function aplicarFiltros(table) {
      const tbody = table.tBodies[0];
      if (!tbody) return;
      const filterRow = table.querySelector('tr.univ-filter-row');
      if (!filterRow) return;
      const inputs = Array.from(filterRow.querySelectorAll('input.univ-col-filter'));
      Array.from(tbody.rows).forEach(tr => {
        // Linhas especiais (grupo / subtotal) nao sao filtradas — elas
        // sempre aparecem mesmo quando ha filtro ativo
        if (ehLinhaEspecial(tr)) { tr.style.display = ''; return; }
        let visivel = true;
        inputs.forEach((inp, idx) => {
          const termo = normaliza(inp.value);
          if (!termo) return;
          const td = tr.cells[idx];
          const valor = normaliza(valorCelula(td));
          if (!valor.includes(termo)) visivel = false;
        });
        tr.style.display = visivel ? '' : 'none';
      });
    }

    // Aplica sort+filtro DOM em uma tabela. Idempotente: se ja foi
    // aplicado nessa tabela, refaz a configuracao do zero.
    function autoEnhance(table, opts) {
      if (!table || !table.tHead) return;
      const cfg = opts || {};
      const skipCols = new Set(cfg.skipCols || []); // por classe do <th>
      // Limpa enhance anterior pra ser idempotente
      table.querySelectorAll('tr.univ-filter-row').forEach(r => r.remove());
      sortStateByTable.set(table, { col: null, dir: null });

      const headerRow = table.tHead.rows[0];
      if (!headerRow) return;
      const ths = Array.from(headerRow.cells);

      // 1) Cabecalhos clicaveis para sort
      ths.forEach((th, idx) => {
        // Pula colunas marcadas pra skip (ex: actions, checkbox)
        const skip = Array.from(th.classList).some(c => skipCols.has(c))
                  || th.dataset.noSort === '1';
        if (skip) return;
        if (!th.classList.contains('univ-th-enhanced')) {
          th.classList.add('univ-th-enhanced');
          // Adiciona seta visual
          const arrow = document.createElement('span');
          arrow.className = 'univ-th-arrow';
          arrow.textContent = '↕';
          th.appendChild(arrow);
        }
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          const st = sortStateByTable.get(table) || { col: null, dir: null };
          if (st.col !== idx) { st.col = idx; st.dir = 'asc'; }
          else if (st.dir === 'asc')      st.dir = 'desc';
          else if (st.dir === 'desc')     { st.col = null; st.dir = null; }
          else                             st.dir = 'asc';
          sortStateByTable.set(table, st);
          // Atualiza setas
          ths.forEach((other, i) => {
            const a = other.querySelector('.univ-th-arrow');
            if (!a) return;
            if (i === st.col) a.textContent = st.dir === 'asc' ? '▲' : (st.dir === 'desc' ? '▼' : '↕');
            else a.textContent = '↕';
            other.classList.toggle('is-sorted', i === st.col && !!st.dir);
          });
          if (st.dir) ordenar(table, idx, st.dir);
          // Se voltou pra "sem ordem", deixa como ficou (modulo re-renderiza
          // se quiser ordem original)
        });
      });

      // 2) Linha de filtros abaixo do thead (R12 + R14: autocomplete).
      //    R14: cada filtro de coluna eh um combobox — focar mostra
      //    os valores distintos da coluna; digitar filtra a lista;
      //    clicar num item preenche e aplica.
      const filterRow = document.createElement('tr');
      filterRow.className = 'univ-filter-row';
      ths.forEach((th, idx) => {
        const td = document.createElement('th');
        td.className = 'univ-filter-cell';
        const skip = Array.from(th.classList).some(c => skipCols.has(c))
                  || th.dataset.noFilter === '1';
        if (!skip) {
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.placeholder = 'Filtrar...';
          // Felipe (sessao 2026-06): size=1 forca o navegador a NAO usar
          // o default size=20 chars (~170px) que faz a coluna inteira ficar
          // gigante. Com size=1 + width:100% do CSS, a coluna e' dimensionada
          // pelo conteudo (header + celulas), nao pelo input.
          inp.size = 1;
          inp.className = 'univ-col-filter';
          inp.autocomplete = 'off';
          inp.addEventListener('input', () => {
            aplicarFiltros(table);
            renderPopup(inp.value);
          });
          td.appendChild(inp);

          // Popup de autocomplete (R14)
          const popup = document.createElement('div');
          popup.className = 'univ-filter-popup';
          popup.hidden = true;
          td.appendChild(popup);

          function getDistinctValues() {
            const tbody2 = table.tBodies[0];
            if (!tbody2) return [];
            const seen = new Set();
            Array.from(tbody2.rows).forEach(tr => {
              if (ehLinhaEspecial(tr)) return;  // pula grupos / subtotais
              const c = tr.cells[idx];
              if (!c) return;
              const v = valorCelula(c);
              const s = (v == null ? '' : String(v)).trim();
              if (s) seen.add(s);
            });
            return Array.from(seen).sort((a, b) => normaliza(a).localeCompare(normaliza(b), 'pt-BR'));
          }

          function renderPopup(filterText) {
            const all = getDistinctValues();
            const norm = normaliza(filterText || '');
            const filtered = norm ? all.filter(v => normaliza(v).includes(norm)) : all;
            popup.innerHTML = '';
            if (filtered.length === 0) {
              const empty = document.createElement('div');
              empty.className = 'univ-filter-popup-empty';
              empty.textContent = 'Sem valores';
              popup.appendChild(empty);
            } else {
              filtered.forEach(v => {
                const item = document.createElement('div');
                item.className = 'univ-filter-popup-item';
                item.textContent = v;
                // mousedown (nao click) pra disparar antes do blur do input
                item.addEventListener('mousedown', (e) => {
                  e.preventDefault();
                  inp.value = v;
                  aplicarFiltros(table);
                  popup.hidden = true;
                });
                popup.appendChild(item);
              });
            }
            popup.hidden = false;
          }

          inp.addEventListener('focus', () => renderPopup(inp.value));
          inp.addEventListener('blur', () => {
            // delay pra clique no item registrar antes do hide
            setTimeout(() => { popup.hidden = true; }, 150);
          });
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { popup.hidden = true; inp.blur(); }
          });
        }
        filterRow.appendChild(td);
      });
      table.tHead.appendChild(filterRow);
    }

    /* ============================================================
       R16 — IMPORT/EXPORT XLSX UNIVERSAL
       ============================================================
       Toda tabela do sistema (Perfis, Representantes, CRM, etc.) deve
       ter Importar/Exportar planilha. Estes helpers centralizam a
       leitura/escrita de XLSX usando a SheetJS embutida no index.html.

       Uso:
         Universal.exportXLSX({
           headers: ['Codigo', 'Nome'],
           rows:    [['001','Joao'], ['002','Maria']],
           sheetName: 'Perfis',
           fileName:  'perfis_projetta',   // recebe _YYYY-MM-DD.xlsx no fim
         });

         Universal.readXLSXFile(file, (aoa, fileName) => {
           // aoa = array de arrays (linha 0 = headers).
           // Cabe ao modulo decidir como mapear pra suas entidades.
         });

         Universal.parseHeaders(headerRow, mapa)
           // utilitario: normaliza headers (remove acento, lowercase)
           // e devolve { campo: indiceDaColuna } para uso em loops.
       ============================================================ */
    function exportXLSX(opts) {
      if (typeof XLSX === 'undefined') {
        alert('Biblioteca de planilha (SheetJS) nao carregou. Recarregue a pagina.');
        return false;
      }
      const headers  = opts.headers  || [];
      const rows     = opts.rows     || [];
      const sheetName = (opts.sheetName || 'Dados').slice(0, 31); // limite Excel
      const fileBase = opts.fileName || 'export';
      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // Largura de coluna automatica baseada no header
      ws['!cols'] = headers.map(h => ({ wch: Math.max(10, String(h).length + 4) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const today = new Date().toISOString().slice(0,10);
      XLSX.writeFile(wb, `${fileBase}_${today}.xlsx`);
      return true;
    }

    /**
     * Felipe (sessao 26 fix): export avancado que aceita FORMULAS e
     * formatos por celula. Ideal pra planilhas que o usuario vai
     * EDITAR e re-importar (precos brutos, impostos calculados).
     *
     * Formato:
     *   exportXLSXAvancado({
     *     headers: ['Codigo', 'Preco', ...],
     *     rows: [
     *       [
     *         'PA-001',
     *         { f: 'L2', t: 'n', z: '"R$ "#,##0.00' },  // celula com formula
     *         { v: 0.04, t: 'n', z: '0.00%' },            // celula com formato %
     *         123.45,                                       // celula simples (auto)
     *       ],
     *     ],
     *     colWidths: [12, 15, ...],   // largura por coluna (opcional)
     *     sheetName: 'Dados',
     *     fileName: 'export',
     *   })
     *
     * Cada celula em rows pode ser:
     *   - primitivo (string, number, bool) -> celula simples
     *   - { f: 'formula' } -> celula com formula (sem '=')
     *   - { v: valor, t: 'n'|'s'|'b', z: 'formato' } -> celula com formato
     *   - { f: 'formula', t: 'n', z: 'formato' } -> formula com formato
     */
    function exportXLSXAvancado(opts) {
      if (typeof XLSX === 'undefined') {
        alert('Biblioteca de planilha (SheetJS) nao carregou. Recarregue a pagina.');
        return false;
      }
      const headers   = opts.headers   || [];
      const rows      = opts.rows      || [];
      const colWidths = opts.colWidths || [];
      const sheetName = (opts.sheetName || 'Dados').slice(0, 31);
      const fileBase  = opts.fileName  || 'export';

      // Cria worksheet vazio e escreve celula por celula
      const ws = {};
      const numCols = Math.max(headers.length, ...rows.map(r => r.length));
      const numRows = rows.length + 1; // +1 pra header

      // Headers (linha 1)
      headers.forEach((h, c) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        ws[addr] = { v: h, t: 's' };
      });

      // Linhas de dados
      rows.forEach((row, r) => {
        row.forEach((cell, c) => {
          const addr = XLSX.utils.encode_cell({ r: r + 1, c });
          if (cell === null || cell === undefined || cell === '') {
            // celula vazia — nao escreve nada
            return;
          }
          if (typeof cell === 'object' && (cell.f !== undefined || cell.v !== undefined)) {
            // celula objeto: pode ter f (formula), v (valor), t (tipo), z (formato)
            const out = {};
            if (cell.f !== undefined) out.f = cell.f;
            if (cell.v !== undefined) out.v = cell.v;
            // tipo padrao baseado no valor
            if (cell.t) out.t = cell.t;
            else if (typeof cell.v === 'number') out.t = 'n';
            else if (typeof cell.v === 'boolean') out.t = 'b';
            else out.t = 's';
            if (cell.z) out.z = cell.z;
            // formula sem valor: precisa setar tipo e valor placeholder pra Excel calcular
            if (cell.f && cell.v === undefined) { out.t = out.t || 'n'; out.v = 0; }
            ws[addr] = out;
          } else {
            // primitivo
            const t = (typeof cell === 'number') ? 'n' : (typeof cell === 'boolean') ? 'b' : 's';
            ws[addr] = { v: cell, t };
          }
        });
      });

      // Range
      ws['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: numRows - 1, c: numCols - 1 },
      });

      // Larguras de coluna
      if (colWidths.length > 0) {
        ws['!cols'] = colWidths.map(w => ({ wch: w }));
      } else {
        ws['!cols'] = headers.map(h => ({ wch: Math.max(10, String(h || '').length + 4) }));
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const today = new Date().toISOString().slice(0,10);
      XLSX.writeFile(wb, `${fileBase}_${today}.xlsx`);
      return true;
    }

    function readXLSXFile(file, callback) {
      if (typeof XLSX === 'undefined') {
        alert('Biblioteca de planilha (SheetJS) nao carregou. Recarregue a pagina.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          callback(aoa, file.name);
        } catch (err) {
          console.error('[Universal.readXLSXFile]', err);
          alert('Nao foi possivel ler o arquivo. Verifique se eh um XLSX ou CSV valido.\n\nDetalhe: ' + err.message);
        }
      };
      reader.onerror = () => alert('Falha ao ler o arquivo.');
      reader.readAsArrayBuffer(file);
    }

    // Normaliza string de header: remove acento, trim, lowercase.
    // Aceita "Código", "CODIGO", "codigo" como o mesmo header.
    function normHeader(s) {
      return String(s || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Recebe aoa[0] (linha de headers) e um mapa { campo: 'header esperado normalizado' }
    // Retorna { campo: indice } para o modulo usar em loops sobre aoa[1..]
    // Ex: parseHeaders(['CODIGO','Razão Social'], { codigo:'codigo', razao:'razao social' })
    //     => { codigo: 0, razao: 1 }
    function parseHeaders(headerRow, mapa) {
      const headers = (headerRow || []).map(normHeader);
      const out = {};
      Object.keys(mapa).forEach(campo => {
        out[campo] = headers.indexOf(normHeader(mapa[campo]));
      });
      return out;
    }

    // R20: capitalizacao "Primeira letra de cada palavra maiuscula".
    // Aplica em qualquer texto visivel — normaliza CAIXA ALTA de planilhas etc.
    // Preserva codigos/SKUs (so transforma se for texto de prosa).
    function titleCase(s) {
      if (s == null) return '';
      const str = String(s);
      if (!str.trim()) return str;
      return str.toLowerCase().replace(
        /(^|[\s\-\/(.,;:])([\p{L}])/gu,
        (_, sep, ch) => sep + ch.toUpperCase()
      );
    }

    // ============================================================
    // COMBOBOX UNIVERSAL — substitui <input list="..."> nativo.
    // Datalist HTML5 nao abre opcoes ao clicar na seta (so depois
    // que o usuario digita algo). Felipe quer ver as opcoes IMEDIATAMENTE
    // ao clicar. Esta implementacao:
    //   - Mantem o <input> original (preserva data-field, value, etc.)
    //   - Remove o atributo "list" (desativa datalist nativo)
    //   - Cria um botao seta + dropdown <ul> posicionado absolute
    //   - Mostra TODAS as opcoes ao focar/clicar
    //   - Filtra ao digitar (case-insensitive, contains)
    //   - Fecha ao perder foco / Esc / clicar fora
    //   - Title Case no texto exibido (R20)
    //   - Dispara evento 'input' e 'change' ao selecionar (compatibilidade)
    // ============================================================
    function attachCombobox(input, options) {
      if (!input || input.dataset.cmbxApplied === '1') return;
      input.dataset.cmbxApplied = '1';

      const opts = Array.isArray(options) ? options.slice() : [];
      // Resolve datalist alvo se nao passou options explicitas
      if (!options) {
        const listId = input.getAttribute('list');
        if (listId) {
          const dl = document.getElementById(listId);
          if (dl) {
            dl.querySelectorAll('option').forEach(o => {
              const val = o.getAttribute('value') || o.textContent || '';
              if (val) opts.push(val);
            });
          }
          input.removeAttribute('list');  // desativa nativo
        }
      }

      // Wrapper relativo
      const wrap = document.createElement('span');
      wrap.className = 'cmbx-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      input.classList.add('cmbx-input');

      // Botao seta
      const arrow = document.createElement('button');
      arrow.type = 'button';
      arrow.className = 'cmbx-arrow';
      arrow.tabIndex = -1;
      arrow.setAttribute('aria-label', 'Abrir lista');
      arrow.innerHTML = '<svg viewBox="0 0 12 8" width="10" height="7" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 1.5L6 6.5L11 1.5"/></svg>';
      wrap.appendChild(arrow);

      // Dropdown
      const dd = document.createElement('div');
      dd.className = 'cmbx-dd';
      dd.setAttribute('role', 'listbox');
      wrap.appendChild(dd);

      let isOpen = false;
      let highlight = -1;
      let filtered = opts.slice();
      let userTyped = false;  // true quando user digitou apos abrir; false em fresh open

      function render(filterText) {
        const q = (filterText || '').trim().toLowerCase();
        filtered = q
          ? opts.filter(o => o.toLowerCase().includes(q))
          : opts.slice();
        if (!filtered.length) {
          dd.innerHTML = '<div class="cmbx-empty">Nenhuma opcao</div>';
          return;
        }
        // Title Case na exibicao (preserva o valor original ao salvar)
        dd.innerHTML = filtered.map((o, i) => {
          const display = titleCase(o);
          return `<div class="cmbx-opt${i === highlight ? ' cmbx-opt-hi' : ''}" role="option" data-i="${i}" title="${escapeAttr(o)}">${escapeHtml(display)}</div>`;
        }).join('');
      }
      function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      }
      function escapeAttr(s) { return escapeHtml(s); }

      // Felipe pediu: ao clicar na seta/focar, mostrar TODAS as opcoes,
      // mesmo que o input ja tenha valor preenchido. So filtra quando user
      // digita algo apos a abertura.
      function open() {
        if (isOpen) return;
        isOpen = true;
        wrap.classList.add('cmbx-open');
        highlight = -1;
        userTyped = false;
        render('');  // sem filtro = lista completa
      }
      function close() {
        if (!isOpen) return;
        isOpen = false;
        wrap.classList.remove('cmbx-open');
        userTyped = false;
      }
      function selectByIndex(i) {
        if (i < 0 || i >= filtered.length) return;
        const val = filtered[i];
        input.value = val;
        // dispara eventos para integrar com handlers existentes
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close();
        input.focus();
      }

      // Eventos
      input.addEventListener('focus', open);
      input.addEventListener('click', open);
      arrow.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();  // nao deixa fechar overlay/modal de fora
        if (isOpen) close(); else { input.focus(); open(); }
      });
      arrow.addEventListener('click', e => { e.stopPropagation(); });
      // Quando o user digita, ai sim filtra. Marca userTyped pra
      // o teclado de navegacao usar o filtro atual.
      input.addEventListener('input', () => {
        userTyped = true;
        highlight = -1;
        if (!isOpen) {
          isOpen = true;
          wrap.classList.add('cmbx-open');
        }
        render(input.value);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!isOpen) { open(); return; }
          highlight = Math.min(filtered.length - 1, highlight + 1);
          render(userTyped ? input.value : '');
          scrollIntoView();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!isOpen) return;
          highlight = Math.max(0, highlight - 1);
          render(userTyped ? input.value : '');
          scrollIntoView();
        } else if (e.key === 'Enter') {
          if (isOpen && highlight >= 0) {
            e.preventDefault();
            selectByIndex(highlight);
          }
        } else if (e.key === 'Escape') {
          if (isOpen) { e.preventDefault(); close(); }
        } else if (e.key === 'Tab') {
          close();
        }
      });
      dd.addEventListener('mousedown', e => {
        const opt = e.target.closest('.cmbx-opt');
        if (!opt) return;
        e.preventDefault();
        e.stopPropagation();  // nao deixa fechar overlay/modal de fora
        const i = parseInt(opt.dataset.i, 10);
        selectByIndex(i);
      });
      dd.addEventListener('click', e => { e.stopPropagation(); });
      // fecha ao clicar fora
      document.addEventListener('mousedown', e => {
        if (!wrap.contains(e.target)) close();
      });
      input.addEventListener('blur', () => {
        // delay para permitir click em opt
        setTimeout(close, 150);
      });

      function scrollIntoView() {
        const hi = dd.querySelector('.cmbx-opt-hi');
        if (hi && hi.scrollIntoView) hi.scrollIntoView({ block: 'nearest' });
      }
    }

    // Auto-aplica em todos os <input list="..."> do documento.
    // Pode ser chamado multiplas vezes (idempotente via dataset).
    function autoAttachCombobox(root) {
      const scope = root || document;
      const inputs = scope.querySelectorAll('input[list]');
      inputs.forEach(inp => attachCombobox(inp));
    }

    // ============================================================
    // TITLE CASE AUTOMATICO — Felipe pediu: ao digitar OU colar
    // texto em CAIXA ALTA, transformar em "Primeira Maiuscula"
    // automaticamente. APLICA APENAS em campos marcados com
    // data-titlecase="1" (whitelist explicita).
    // Aplica no `blur` (ao perder foco) para nao atrapalhar a
    // digitacao do usuario, e tambem no `paste` (com delay) caso
    // o user cole texto em maiuscula.
    // ============================================================
    function attachTitleCase(input) {
      if (!input || input.dataset.tcApplied === '1') return;
      input.dataset.tcApplied = '1';
      const aplicar = () => {
        const v = input.value;
        if (!v || !v.trim()) return;
        const tc = titleCase(v);
        if (tc !== v) {
          input.value = tc;
          // Felipe (do doc - msg "title case nao persiste"): apos mudar
          // o valor do input, dispara eventos 'input' e 'change' pra que
          // qualquer handler reativo (modalState, state interno, etc) leia
          // o valor JA' formatado em Title Case. Sem isso, o handler
          // 'change' que ja rodou antes do blur fica com o valor cru
          // (minusculo) e o save grava errado.
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      input.addEventListener('blur', aplicar);
      input.addEventListener('paste', () => setTimeout(aplicar, 0));
    }
    function autoAttachTitleCase(root) {
      const scope = root || document;
      scope.querySelectorAll('input[data-titlecase], textarea[data-titlecase]')
        .forEach(inp => attachTitleCase(inp));
    }

    // ============================================================
    // Felipe (do doc - msg "campos preenchidos em laranja"):
    // Marca CAMPOS VAZIOS com laranja transparente em TODO o sistema
    // (CRM, Cadastros, Orcamento, qualquer formulario). Quando o usuario
    // digita algo, volta ao fundo normal. Ajuda a ver o que falta
    // preencher num form complexo. Aplicado via classe CSS `field-empty`.
    //
    // Excecoes (NAO marca):
    // - inputs/buttons que nao tem valor (checkbox, radio, button, submit, hidden)
    // - inputs com data-no-empty-marker (opt-out manual)
    // - inputs disabled/readonly (nao sao "preenchimento" do usuario)
    // ============================================================
    function isFieldEmpty(el) {
      if (!el) return false;
      const v = el.value;
      return v === '' || v === null || v === undefined;
    }
    function shouldMarkEmpty(el) {
      if (!el || !el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return false;
      if (tag === 'input') {
        const t = (el.type || '').toLowerCase();
        if (['checkbox', 'radio', 'button', 'submit', 'reset', 'hidden', 'file', 'range', 'color'].includes(t)) return false;
      }
      if (el.disabled || el.readOnly) return false;
      if (el.dataset.noEmptyMarker === '1' || el.dataset.noEmptyMarker === 'true') return false;
      return true;
    }
    function updateEmptyMark(el) {
      if (!shouldMarkEmpty(el)) {
        el.classList.remove('field-empty');
        return;
      }
      if (isFieldEmpty(el)) el.classList.add('field-empty');
      else el.classList.remove('field-empty');
    }
    function attachEmptyMark(el) {
      if (!shouldMarkEmpty(el)) return;
      if (el.dataset.emptyMarker === '1') {
        // ja anexado — so atualiza estado atual
        updateEmptyMark(el);
        return;
      }
      el.dataset.emptyMarker = '1';
      updateEmptyMark(el);
      el.addEventListener('input',  () => updateEmptyMark(el));
      el.addEventListener('change', () => updateEmptyMark(el));
      el.addEventListener('blur',   () => updateEmptyMark(el));
    }
    function autoAttachEmptyMark(root) {
      const scope = root || document;
      scope.querySelectorAll('input, select, textarea').forEach(el => attachEmptyMark(el));
    }

    return { autoEnhance, exportXLSX, exportXLSXAvancado, readXLSXFile, normHeader, parseHeaders, titleCase, attachCombobox, autoAttachCombobox, attachTitleCase, autoAttachTitleCase, attachEmptyMark, autoAttachEmptyMark, updateEmptyMark };
  })();

if (typeof window !== 'undefined') {
  window.Universal = Universal;
}
