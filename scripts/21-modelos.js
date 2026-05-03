/* 21-modelos.js — Cadastros > Modelos.
   Modelos de portas pivotantes (Cava, Puxador Externo, Friso etc.)
   Cada modelo tem numero, nome, e duas imagens (1 folha e 2 folhas).
   Imagens sao placeholder por enquanto — serao integradas no Supabase. */


/* ============================================================
   SUB-MODULO: MODELOS
   Modelos de portas pivotantes (Cava, Puxador Externo, Friso etc.)
   Cada modelo tem um numero, nome, e duas imagens (1 folha e 2 folhas).
   Imagens sao placeholder por enquanto — serao integradas no Supabase.
   ============================================================ */
const Modelos = (() => {
  const store = Storage.scope('cadastros');
  // Lista canonica de 24 modelos extraida do PDF de cadastro
  const SEED_MODELOS = [
    { numero: 1,  nome: 'Cava' },
    { numero: 2,  nome: 'Cava + 01 Friso Vertical' },
    { numero: 3,  nome: 'Cava + 02 Friso Horizontal' },
    { numero: 4,  nome: 'Cava + 01 Friso Vertical & 01 Friso Horizontal' },
    { numero: 5,  nome: 'Cava + 01 Friso Vertical & 02 Friso Horizontal' },
    { numero: 6,  nome: 'Cava + Friso Horizontal Variavel' },
    { numero: 7,  nome: 'Cava + Frisos Vertical Multiplo' },
    { numero: 8,  nome: 'Cava + Ripado' },
    { numero: 9,  nome: 'Cava Dupla' },
    { numero: 10, nome: 'Puxador Externo Lisa' },
    { numero: 11, nome: 'Puxador Externo + 01 Friso Vertical' },
    { numero: 12, nome: 'Puxador Externo + 01 Friso Vertical & 01 Friso Horizontal' },
    { numero: 13, nome: 'Puxador Externo + 01 Friso Vertical & 02 Friso Horizontal' },
    { numero: 14, nome: 'Puxador Externo + Frisos Vertical Multiplo' },
    { numero: 15, nome: 'Puxador Externo + Ripado' },
    { numero: 16, nome: 'Puxador Externo + Friso Horizontal Variavel' },
    { numero: 17, nome: 'Puxador Externo + Friso Horizontal Variavel Inclinado' },
    { numero: 18, nome: 'Puxador Externo + Friso Geometricos' },
    { numero: 19, nome: 'Cava + Friso Geometricos' },
    { numero: 20, nome: 'Puxador Externo + Friso Horizontal Variavel (Ripas)' },
    { numero: 21, nome: 'Friso Angular' },
    { numero: 22, nome: 'Cava Premium' },
    { numero: 23, nome: 'Classica com Molduras' },
    { numero: 24, nome: 'Cava Horizontal' },
  ];

  const state = {
    modelos: [],
  };
  let dirty = false;
  let loaded = false;
  let saveTimer;

  function newId() { return 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1000); }

  function load() {
    // Carrega do localStorage SO na primeira vez. Em re-renders
    // subsequentes, preserva o state em memoria pra nao apagar
    // mutacoes ainda nao salvas (ex: imagem recem-carregada).
    if (loaded) return;
    const lista = store.get('modelos_lista');
    if (lista === null || (Array.isArray(lista) && lista.length === 0 && !store.get('modelos_seeded'))) {
      state.modelos = SEED_MODELOS.map((m, i) => ({
        id: 'seed_modelo_' + String(i+1).padStart(2, '0'),
        numero: m.numero,
        nome: m.nome,
        img_1f: null, // base64 ou URL no Supabase
        img_2f: null,
      }));
      store.set('modelos_lista', state.modelos);
      store.set('modelos_seeded', true);
    } else {
      state.modelos = lista || [];
    }
    loaded = true;
  }

  function save() {
    store.set('modelos_lista', state.modelos);
    dirty = false;
    updateSaveButton();
    showSaved();
  }

  function showSaved() {
    const el = document.getElementById('mod-saved-pill');
    if (!el) return;
    el.classList.add('is-visible');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => el.classList.remove('is-visible'), 1500);
  }

  function markDirty() {
    dirty = true;
    updateSaveButton();
  }

  function updateSaveButton() {
    const btn = document.getElementById('mod-btn-save');
    if (!btn) return;
    if (dirty) {
      btn.classList.add('is-dirty');
      btn.textContent = '💾 Salvar Alteracoes';
    } else {
      btn.classList.remove('is-dirty');
      btn.textContent = '✓ Tudo salvo';
    }
  }

  function renderImg(modelo, tipo /* '1f' ou '2f' */) {
    const folhasLabel = tipo === '1f' ? '1 FOLHA' : '2 FOLHAS';
    const campo = tipo === '1f' ? 'img_1f' : 'img_2f';
    const img = modelo[campo];

    if (img) {
      // Estado FILLED: tem imagem carregada (base64 local ou URL futura do Supabase)
      return `
        <div class="mod-card-img mod-card-img-filled">
          <div class="mod-card-img-label">${folhasLabel}</div>
          <img src="${img}" alt="Modelo ${modelo.numero} - ${folhasLabel}" />
          <div class="mod-card-img-actions">
            <button title="Trocar imagem" data-action="upload-${tipo}" data-id="${modelo.id}">📷</button>
            <button class="danger" title="Remover imagem" data-action="remove-${tipo}" data-id="${modelo.id}">×</button>
          </div>
        </div>
      `;
    }

    // Estado EMPTY: placeholder com botao para carregar
    return `
      <div class="mod-card-img mod-card-img-empty">
        <div class="mod-card-img-label">${folhasLabel}</div>
        <div class="mod-icon-placeholder">⊞</div>
        <div>placeholder</div>
        <div class="mod-card-img-actions">
          <button title="Carregar imagem" data-action="upload-${tipo}" data-id="${modelo.id}">📷</button>
        </div>
      </div>
    `;
  }

  function renderCard(modelo) {
    return `
      <div class="mod-card" data-id="${modelo.id}">
        <input class="mod-card-num-input" type="number" min="1" data-field="numero" data-id="${modelo.id}" value="${String(modelo.numero).padStart(2, '0')}" />
        ${renderImg(modelo, '1f')}
        ${renderImg(modelo, '2f')}
        <div class="mod-card-name">
          <input type="text" data-field="nome" data-titlecase="1" value="${escapeHtml(modelo.nome)}" placeholder="" />
        </div>
        <div class="mod-card-actions">
          <button class="row-delete" data-action="delete" data-id="${modelo.id}" title="Excluir modelo">×</button>
        </div>
      </div>
    `;
  }

  function render(container) {
    load();

    // Ordena por numero
    state.modelos.sort((a, b) => a.numero - b.numero);

    container.innerHTML = `
      <div class="mod-section">
        <div class="mod-section-title">CADASTRO DE MODELOS</div>
        <div class="mod-subtitle">Edite os nomes e clique em Salvar para aplicar. As imagens (1 folha / 2 folhas) ainda sao placeholder e serao plugadas via Supabase.</div>

        <div class="mod-toolbar">
          <div class="mod-toolbar-left">
            <span class="mod-count"><strong id="mod-count">${state.modelos.length}</span> modelos cadastrados</span>
            <span class="mod-saved-pill" id="mod-saved-pill">✓ salvo</span>
          </div>
          <div class="mod-toolbar-right">
            <button class="univ-btn-save" id="mod-btn-save">✓ Tudo salvo</button>
          </div>
        </div>

        <div class="mod-list" id="mod-list">
          ${state.modelos.map(renderCard).join('')}
        </div>

        <div class="mod-add-form">
          <h4>+ Adicionar novo modelo</h4>
          <div class="mod-add-grid">
            <input id="mod-add-nome" class="cad-input" type="text" placeholder="" />
            <button class="btn btn-primary btn-sm" id="mod-btn-add" style="height:36px;">+ Adicionar Modelo</button>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
    updateSaveButton(); // sincroniza estado do botao com flag dirty (caso render seja chamado apos uma mutacao)
  }

  /* ============================================================
     UPLOAD DE IMAGEM (modo local — base64 no localStorage)
     ============================================================
     Por enquanto as imagens ficam em base64 dentro do localStorage.
     Quando migrar pro Supabase Storage, mudar pickAndCompressImage()
     pra fazer upload e salvar a URL pública no campo img_1f / img_2f.

     Compressao: max 800px de largura, JPEG quality 0.85.
     Isso evita estourar o limite de ~5MB do localStorage com 24 modelos.
     ============================================================ */
  function pickImageFile(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (file) callback(file);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let width = img.width, height = img.height;
          const origWidth = width, origHeight = height;
          if (width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve({
            dataUrl: canvas.toDataURL('image/jpeg', quality),
            width: width, height: height,
            origWidth: origWidth, origHeight: origHeight,
            origSize: file.size,
          });
        };
        img.onerror = function() { reject(new Error('Imagem invalida')); };
        img.src = reader.result;
      };
      reader.onerror = function() { reject(new Error('Falha ao ler arquivo')); };
      reader.readAsDataURL(file);
    });
  }

  function handleUpload(modelo, tipo, container) {
    pickImageFile(function(file) {
      compressImage(file, 800, 0.85).then(function(result) {
        const campo = tipo === '1f' ? 'img_1f' : 'img_2f';
        const dimCampo = tipo === '1f' ? 'dim_1f' : 'dim_2f';
        modelo[campo] = result.dataUrl;
        modelo[dimCampo] = result.width + 'x' + result.height;
        const kbBase64 = (result.dataUrl.length / 1024).toFixed(0);
        const kbOrig = (result.origSize / 1024).toFixed(0);
        console.log(
          '[Modelos] Imagem ' + tipo + ' carregada no modelo "' + modelo.nome + '":\n' +
          '  Original: ' + result.origWidth + 'x' + result.origHeight + ' (' + kbOrig + 'KB)\n' +
          '  Comprimida: ' + result.width + 'x' + result.height + ' (' + kbBase64 + 'KB base64)'
        );
        markDirty();
        render(container);
      }).catch(function(err) {
        alert('Erro ao carregar imagem: ' + err.message);
      });
    });
  }

  function bindEvents(container) {
    // Upload de imagem (1f ou 2f) — abre file picker
    container.querySelectorAll('button[data-action^="upload-"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tipo = btn.dataset.action.replace('upload-', ''); // '1f' ou '2f'
        const id = btn.dataset.id;
        const m = state.modelos.find(x => x.id === id);
        if (!m) return;
        handleUpload(m, tipo, container);
      });
    });

    // Remover imagem (1f ou 2f)
    container.querySelectorAll('button[data-action^="remove-"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tipo = btn.dataset.action.replace('remove-', '');
        const id = btn.dataset.id;
        const m = state.modelos.find(x => x.id === id);
        if (!m) return;
        const folhasLabel = tipo === '1f' ? '1 folha' : '2 folhas';
        if (!confirm('Remover a imagem de ' + folhasLabel + ' do modelo "' + m.nome + '"?')) return;
        const campo = tipo === '1f' ? 'img_1f' : 'img_2f';
        const dimCampo = tipo === '1f' ? 'dim_1f' : 'dim_2f';
        m[campo] = null;
        m[dimCampo] = null;
        markDirty();
        render(container);
      });
    });
    // Edicao do nome
    container.querySelectorAll('.mod-card input[data-field="nome"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const card = e.target.closest('.mod-card');
        const id = card?.dataset.id;
        if (!id) return;
        const m = state.modelos.find(x => x.id === id);
        if (!m) return;
        m.nome = e.target.value;
        markDirty();
      });
    });

    // Edicao do numero (catalogo): editavel pra suportar numeros nao-sequenciais.
    // Ex: se deletar o 17, o user pode renumerar o 18 → 17 manualmente.
    container.querySelectorAll('.mod-card input[data-field="numero"]').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = e.target.dataset.id;
        if (!id) return;
        const m = state.modelos.find(x => x.id === id);
        if (!m) return;
        const n = parseInt(e.target.value, 10);
        if (!isNaN(n) && n > 0) {
          m.numero = n;
          markDirty();
        }
      });
    });

    // Excluir modelo
    container.querySelectorAll('.row-delete[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const m = state.modelos.find(x => x.id === id);
        if (!m) return;
        if (!confirm(`Excluir o modelo "${m.nome}"?`)) return;
        state.modelos = state.modelos.filter(x => x.id !== id);
        markDirty();
        render(container);
      });
    });

    // Adicionar modelo
    const btnAdd = container.querySelector('#mod-btn-add');
    const inputAdd = container.querySelector('#mod-add-nome');
    const doAdd = () => {
      const nome = (inputAdd.value || '').trim();
      if (!nome) { inputAdd.focus(); return; }
      const proxNum = state.modelos.length === 0 ? 1 : Math.max(...state.modelos.map(m => Number(m.numero) || 0)) + 1;
      const novoId = newId();
      state.modelos.push({
        id: novoId,
        numero: proxNum,
        nome,
        img_1f: null,
        img_2f: null,
      });
      markDirty();
      render(container);
      // UX: limpa input, rola ate o novo card, flash visual pra confirmar criacao
      const inputDepois = container.querySelector('#mod-add-nome');
      if (inputDepois) inputDepois.value = '';
      const novoCard = container.querySelector(`.mod-card[data-id="${novoId}"]`);
      if (novoCard) {
        novoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        novoCard.classList.add('mod-card-flash');
        setTimeout(() => novoCard.classList.remove('mod-card-flash'), 1200);
      }
    };
    if (btnAdd) btnAdd.addEventListener('click', doAdd);
    if (inputAdd) inputAdd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
    });

    // Salvar
    const btnSave = container.querySelector('#mod-btn-save');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        save();
        if (typeof window.showSavedDialog === 'function') {
          window.showSavedDialog('Alteracoes em Modelos salvas com sucesso!');
        }
      });
    }
    // R12: sort+filtro universal por coluna em toda tabela
    container.querySelectorAll('table').forEach(tbl => {
      if (window.Universal) window.Universal.autoEnhance(tbl, { skipCols: ['actions'] });
    });
  }

  // Felipe (R-inegociavel): tudo puxa do cadastro. Helper exposto pra
  // garantir que o seed seja inserido mesmo se a aba nao foi aberta —
  // evita o bug em que o orcamento via `cad.get('modelos_lista')` retornar
  // [] e mostrar "Nenhuma opcao" no select de Modelo.
  function listar() {
    load();
    return state.modelos.slice();
  }

  return { render, listar };
})();

if (typeof window !== 'undefined') {
  window.Modelos = Modelos;
}
