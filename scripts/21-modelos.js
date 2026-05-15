/* 21-modelos.js — Cadastros > Modelos.
   Modelos de portas pivotantes (Cava, Puxador Externo, Friso etc.)
   Cada modelo tem numero, nome, e duas imagens (1 folha e 2 folhas).
   Imagens sao salvas no Supabase Storage (bucket modelos-portas) e
   persistem entre dispositivos. Sync automatico de cadastros via
   46-cadastros-autosync.js (write-through ao v7.cadastros). */


/* ============================================================
   SUB-MODULO: MODELOS
   Modelos de portas pivotantes (Cava, Puxador Externo, Friso etc.)
   Cada modelo tem um numero, nome, e duas imagens (1 folha e 2 folhas).
   Imagens persistidas no Supabase Storage (bucket modelos-portas).
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

  // Felipe (sessao 31): modelos de PORTA INTERNA — lista separada da
  // externa, ciclo de vida independente. Por enquanto so' "Lisa" (Felipe
  // vai adicionar outros depois conforme for desenhando).
  // Storage: scope 'cadastros', key 'modelos_internos_lista'.
  const SEED_MODELOS_INT = [
    { numero: 1, nome: 'Lisa' },
  ];

  const state = {
    modelos: [],
    modelosInt: [],
    // Felipe sessao 31: sub-aba ativa em Cadastros>Modelos
    //   'externas' (default) | 'internas'
    subAba: 'externas',
  };
  let dirty = false;
  let loaded = false;
  let saveTimer;

  function newId() { return 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1000); }

  // Felipe sessao 2026-05: Quando o cache local tem modelos sem URLs mas
  // o Supabase tem, busca direto do servidor e atualiza.
  // Garantia extra: nao depende do CadastrosAutosync ter rodado direito.
  async function fetchModelosFromSupabaseDirect() {
    try {
      var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
      var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
      // Cache-buster: Safari iPhone cacheia GETs - garante versao fresca
      var url = SUPABASE_URL + '/rest/v1/cadastros?chave=eq.modelos_lista&_=' + Date.now();
      var res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Accept-Profile': 'v7',
          'Cache-Control': 'no-cache',
        }
      });
      if (!res.ok) {
        console.warn('[modelos] fetch direto: HTTP ' + res.status);
        return null;
      }
      var rows = await res.json();
      if (!rows || !rows.length) return null;
      var raw = rows[0].valor;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      console.warn('[modelos] fetch direto falhou:', e);
      return null;
    }
  }

  function load() {
    // Felipe sessao 2026-05: SEMPRE recarrega do storage exceto se ha
    // edicao em progresso (dirty=true). Isso garante que se o autosync
    // baixou novos dados do Supabase ANTES de a aba ter sido aberta,
    // a primeira renderizacao usa os dados atualizados.
    // Antes: loaded=true ficava preso e nunca relia.
    if (loaded && dirty) return;
    const lista = store.get('modelos_lista');
    // Felipe (sessao 30 - PROTECAO ANTI-SEED):
    // Antes esse if disparava se lista === null OU vazia sem flag. Em
    // sessao 18 um bug parecido no 10-crm.js sobrescreveu 100+ leads
    // reais. Agora SystemProtection.podeRodarSeed() bloqueia o seed
    // de forma global se o sistema ja' foi inicializado em qualquer
    // scope (memoria + persistido + auto-deteccao).
    const _seedPermitido = typeof SystemProtection !== 'undefined'
      ? SystemProtection.podeRodarSeed()
      : true; // fallback se SystemProtection falhar a carregar
    if (_seedPermitido && (lista === null || (Array.isArray(lista) && lista.length === 0 && !store.get('modelos_seeded')))) {
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

    // Felipe sessao 31: carrega modelos INTERNOS (lista separada)
    const listaInt = store.get('modelos_internos_lista');
    if (_seedPermitido && (listaInt === null || (Array.isArray(listaInt) && listaInt.length === 0 && !store.get('modelos_internos_seeded')))) {
      state.modelosInt = SEED_MODELOS_INT.map((m, i) => ({
        id: 'seed_modelo_int_' + String(i+1).padStart(2, '0'),
        numero: m.numero,
        nome: m.nome,
        img_1f: null,
        img_2f: null,
      }));
      store.set('modelos_internos_lista', state.modelosInt);
      store.set('modelos_internos_seeded', true);
    } else {
      state.modelosInt = listaInt || [];
    }
    loaded = true;
  }

  function save() {
    // Felipe sessao 31: salva ambas as listas (externa e interna)
    store.set('modelos_lista', state.modelos);
    store.set('modelos_internos_lista', state.modelosInt);
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

    // Felipe sessao 2026-05: SUPABASE E' A FONTE PRIMARIA, sempre.
    // localStorage apenas exibe enquanto a request termina.
    // Isso garante que mesmo se o autosync falhar ou o cache local
    // for corrompido, a aba Modelos sempre mostra a versao certa.
    if (!dirty) {
      fetchModelosFromSupabaseDirect().then(function(modelosDoServer) {
        if (!modelosDoServer || !Array.isArray(modelosDoServer) || !modelosDoServer.length) {
          console.warn('[modelos] Supabase nao retornou modelos. Mantendo cache local.');
          return;
        }
        // Compara - se diferente, atualiza UI E cache local
        var atualJson = JSON.stringify(state.modelos);
        var serverJson = JSON.stringify(modelosDoServer);
        if (atualJson !== serverJson) {
          console.log('[modelos] ✅ Atualizando da fonte Supabase. ' + modelosDoServer.length + ' modelos.');
          state.modelos = modelosDoServer;
          // Atualiza cache local pra proxima leitura ser rapida
          // (write-through vai pular pq vai detectar valor igual)
          try { store.set('modelos_lista', modelosDoServer); } catch (_) {}
          // Re-renderiza com dados certos
          renderUI(container);
        }
      }).catch(function(e) {
        console.warn('[modelos] fetch Supabase falhou:', e);
      });
    }

    renderUI(container);
  }

  function renderUI(container) {
    // Felipe sessao 31: ordena as duas listas, escolhe qual exibir
    state.modelos.sort((a, b) => a.numero - b.numero);
    state.modelosInt.sort((a, b) => a.numero - b.numero);

    const ehInterna = state.subAba === 'internas';
    const listaAtual = ehInterna ? state.modelosInt : state.modelos;
    const labelAtual = ehInterna ? 'PORTAS INTERNAS' : 'PORTAS EXTERNAS';

    container.innerHTML = `
      <div class="mod-section">
        <div class="mod-section-title">CADASTRO DE MODELOS — ${labelAtual}</div>
        <div class="mod-subtitle">Imagens das portas (1 folha / 2 folhas) sao salvas no Supabase Storage. Persistem entre dispositivos e sessoes.</div>

        <div class="mod-subaba" style="display:flex; gap:8px; margin:12px 0; border-bottom:1px solid var(--line);">
          <button class="mod-tab-btn ${!ehInterna ? 'is-active' : ''}" data-subaba="externas"
                  style="padding:8px 16px; border:none; background:${!ehInterna ? 'var(--primary)' : 'transparent'}; color:${!ehInterna ? '#fff' : 'var(--text)'}; cursor:pointer; border-radius:6px 6px 0 0; font-weight:600;">
            Externas (${state.modelos.length})
          </button>
          <button class="mod-tab-btn ${ehInterna ? 'is-active' : ''}" data-subaba="internas"
                  style="padding:8px 16px; border:none; background:${ehInterna ? 'var(--primary)' : 'transparent'}; color:${ehInterna ? '#fff' : 'var(--text)'}; cursor:pointer; border-radius:6px 6px 0 0; font-weight:600;">
            Internas (${state.modelosInt.length})
          </button>
        </div>

        <div class="mod-toolbar">
          <div class="mod-toolbar-left">
            <span class="mod-count"><strong id="mod-count">${listaAtual.length}</strong> modelos cadastrados</span>
            <span class="mod-saved-pill" id="mod-saved-pill">✓ salvo</span>
          </div>
          <div class="mod-toolbar-right">
            <button class="univ-btn-save" id="mod-btn-save">✓ Tudo salvo</button>
          </div>
        </div>

        <div class="mod-list" id="mod-list">
          ${listaAtual.map(renderCard).join('')}
        </div>

        <div class="mod-add-form">
          <h4>+ Adicionar novo modelo ${ehInterna ? '(interno)' : '(externo)'}</h4>
          <div class="mod-add-grid">
            <input id="mod-add-nome" class="cad-input" type="text" placeholder="" />
            <button class="btn btn-primary btn-sm" id="mod-btn-add" style="height:36px;">+ Adicionar Modelo</button>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
    updateSaveButton();

    // Listener cadastros:loaded - re-renderiza quando autosync trouxer
    // dados do servidor (caso usuario nao tenha visto ainda)
    if (window.Events && window.Events.on && !renderUI._listenerInstalled) {
      renderUI._listenerInstalled = true;
      window.Events.on('cadastros:loaded', function() {
        loaded = false;
        if (!dirty) render(container);
      });
    }
  }

  /* ============================================================
     UPLOAD DE IMAGEM (Supabase Storage — bucket modelos-portas)
     ============================================================
     Imagens sao enviadas pro Supabase Storage. O campo img_1f/img_2f
     guarda a URL publica. Persistem entre dispositivos e sessoes.

     Compressao: max 800px de largura, JPEG quality 0.85.
     Limite Supabase: 5MB por imagem, mime types image/png|jpeg|webp|gif.
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

  // ── Supabase Storage (bucket modelos-portas) ──
  const SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  const STORAGE_BUCKET = 'modelos-portas';

  async function uploadParaStorage(blob, modeloNumero, tipo) {
    const ext = blob.type === 'image/png' ? 'png' : 'jpg';
    const numero = String(modeloNumero || 0).padStart(2, '0');
    const path = 'modelo-' + numero + '-' + tipo + '-' + Date.now() + '.' + ext;
    const url = SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'apikey': SUPABASE_KEY,
        'Content-Type': blob.type,
        'x-upsert': 'true'
      },
      body: blob
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error('Upload falhou: ' + resp.status + ' ' + txt);
    }
    // URL pública
    return SUPABASE_URL + '/storage/v1/object/public/' + STORAGE_BUCKET + '/' + path;
  }

  function dataUrlToBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  }

  function handleUpload(modelo, tipo, container) {
    pickImageFile(function(file) {
      compressImage(file, 800, 0.85).then(async function(result) {
        const campo = tipo === '1f' ? 'img_1f' : 'img_2f';
        const dimCampo = tipo === '1f' ? 'dim_1f' : 'dim_2f';
        // Mostra preview imediato (base64) enquanto faz upload
        modelo[campo] = result.dataUrl;
        modelo[dimCampo] = result.width + 'x' + result.height;
        modelo._uploading = tipo;
        render(container);
        try {
          // Upload pro Supabase Storage
          const blob = dataUrlToBlob(result.dataUrl);
          const publicUrl = await uploadParaStorage(blob, modelo.numero, tipo);
          // Substitui base64 pela URL publica do Supabase
          modelo[campo] = publicUrl;
          delete modelo._uploading;
          console.log('[Modelos] Imagem ' + tipo + ' do modelo "' + modelo.nome + '" salva no Supabase: ' + publicUrl);
          markDirty();
          render(container);
        } catch (err) {
          delete modelo._uploading;
          render(container);
          alert('Erro ao enviar imagem para o servidor: ' + err.message + '\n\nA imagem foi salva localmente. Tente novamente quando tiver internet.');
          markDirty();
        }
      }).catch(function(err) {
        alert('Erro ao processar imagem: ' + err.message);
      });
    });
  }

  function bindEvents(container) {
    // Felipe sessao 31: helper que retorna a lista de modelos da sub-aba ativa.
    // Bind operations sempre olham aqui — uma so' UI manipula 2 listas via
    // este getter, mantendo a logica unica.
    const listaAtual = () => state.subAba === 'internas' ? state.modelosInt : state.modelos;
    const setListaAtual = (novaLista) => {
      if (state.subAba === 'internas') state.modelosInt = novaLista;
      else state.modelos = novaLista;
    };

    // Felipe sessao 31: handlers da sub-aba (Externas / Internas)
    container.querySelectorAll('button.mod-tab-btn[data-subaba]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const novaAba = btn.dataset.subaba;
        if (novaAba && novaAba !== state.subAba) {
          state.subAba = novaAba;
          render(container);
        }
      });
    });

    // Upload de imagem (1f ou 2f) — abre file picker
    container.querySelectorAll('button[data-action^="upload-"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tipo = btn.dataset.action.replace('upload-', ''); // '1f' ou '2f'
        const id = btn.dataset.id;
        const m = listaAtual().find(x => x.id === id);
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
        const m = listaAtual().find(x => x.id === id);
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
        const m = listaAtual().find(x => x.id === id);
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
        const m = listaAtual().find(x => x.id === id);
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
        const m = listaAtual().find(x => x.id === id);
        if (!m) return;
        if (!confirm(`Excluir o modelo "${m.nome}"?`)) return;
        setListaAtual(listaAtual().filter(x => x.id !== id));
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
      const lista = listaAtual();
      const proxNum = lista.length === 0 ? 1 : Math.max(...lista.map(m => Number(m.numero) || 0)) + 1;
      const novoId = newId();
      lista.push({
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

  // Felipe sessao 31: expose lista interna pra modulo orcamento usar
  // quando porta_interna for selecionada. Estrutura igual a externa.
  function listarInternas() {
    load();
    return state.modelosInt.slice();
  }

  return { render, listar, listarInternas };
})();

if (typeof window !== 'undefined') {
  window.Modelos = Modelos;

  // Felipe sessao 2026-05: listener GLOBAL cadastros:loaded.
  // Garante que mesmo se Felipe nunca tiver aberto a aba modelos, o
  // localStorage e' atualizado quando autosync trouxer dados do servidor.
  // Antes, o listener so' era instalado dentro do render, entao se o
  // usuario entrasse na aba DEPOIS do evento, perdia a sincronizacao.
  if (window.Events && window.Events.on) {
    window.Events.on('cadastros:loaded', function() {
      // Se a aba modelos esta aberta no DOM, re-renderiza
      var modelosContainer = document.querySelector('.mod-section');
      if (modelosContainer && modelosContainer.parentElement && window.Modelos) {
        try {
          window.Modelos.render(modelosContainer.parentElement);
        } catch (_) {}
      }
    });
  }
}
