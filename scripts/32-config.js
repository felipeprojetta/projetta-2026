/* 32-config.js — Modulo Configuracoes.
   Tela informativa do sistema:
     - card ViaCEP: info sobre a API publica usada pra resolver CEP
     - card Sobre o sistema: versao, uso de storage, botao de limpeza
   A integracao Weiku (mock/JSON/Supabase) costumava ficar aqui mas
   foi removida — sera reconstruida do zero direto via Supabase. */

/* ============================================================
   MODULO: CONFIGURACOES
   ============================================================
   Tela informativa do sistema. Atualmente mostra:
     - card ViaCEP    : info sobre a API publica usada pra resolver CEP
     - card Sobre o sistema : versao, uso de storage, botao de limpeza

   A integracao Weiku (mock/JSON/Supabase) costumava ficar aqui mas
   foi removida — sera reconstruida do zero direto via Supabase.
   ============================================================ */
const Config = (() => {

  function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    return (b/(1024*1024)).toFixed(2) + ' MB';
  }

  function showMsg(el, type, text) {
    if (!el) return;
    el.className = 'cfg-msg is-visible is-' + type;
    el.textContent = text;
  }

  function updateStorageUsage(container) {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('projetta:')) {
          total += (localStorage.getItem(key) || '').length;
        }
      }
      const el = container.querySelector('#cfg-storage-used');
      if (el) el.textContent = fmtBytes(total) + ' (limite ~5MB)';
    } catch (_) {}
  }

  function render(container) {
    // Pega versao mostrada no rodape
    const versaoEl = document.getElementById('build-hash');
    const versao = versaoEl ? versaoEl.textContent.trim() : 'core ?';

    container.innerHTML = `
      <div class="cfg-grid">

        <div class="cfg-card">
          <div class="cfg-card-header">
            <div class="cfg-card-title">💵 Cambio USD - BRL</div>
            <span class="cfg-status-pill ativo" id="cfg-cambio-pill">—</span>
          </div>
          <div class="cfg-info" id="cfg-cambio-info">
            Taxa usada em <strong>todo o sistema</strong> quando o destino e' Internacional
            (proposta comercial, DRE, frete maritimo).
            A PTAX (BCB) e' baixada automaticamente, mas voce pode inserir uma taxa manual
            que vai <strong>sobrescrever</strong> a oficial em todos os calculos.
          </div>
          <div class="cfg-form-row" style="margin-top:12px; display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:180px;">
              <label class="cfg-label">Taxa manual (BRL/USD)</label>
              <input type="number" step="0.0001" min="0" id="cfg-cambio-manual"
                     placeholder="ex.: 5.4200" style="width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:6px;" />
            </div>
            <button class="cfg-btn cfg-btn-primary" id="cfg-cambio-salvar">Salvar taxa</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-cambio-limpar">Usar PTAX</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-cambio-atualizar">⟳ Atualizar PTAX</button>
          </div>
          <div id="cfg-cambio-hist" style="margin-top:12px;"></div>
          <div class="cfg-msg" id="cfg-cambio-msg"></div>
        </div>

        <div class="cfg-card">
          <div class="cfg-card-header">
            <div class="cfg-card-title">ViaCEP</div>
            <span class="cfg-status-pill ativo">✓ Ativo</span>
          </div>
          <div class="cfg-info">
            API publica brasileira (<span class="t-strong">viacep.com.br</span>), sem chave nem configuracao.
            Usado pra preencher cidade e estado automaticamente quando voce digita um CEP no modal.
          </div>
        </div>

        <div class="cfg-card">
          <div class="cfg-card-header">
            <div class="cfg-card-title">☁ Sincronizacao com servidor</div>
          </div>
          <div class="cfg-info" id="cfg-sync-info">
            Verificando...
          </div>
          <div class="cfg-btn-row">
            <button class="cfg-btn cfg-btn-secondary" id="cfg-sync-now">🔄 Sincronizar agora</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-sync-test">🧪 Testar conexao</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-migrar-imgs">🖼 Migrar imagens p/ Storage</button>
          </div>
          <div class="cfg-msg" id="cfg-sync-msg"></div>
        </div>

        <div class="cfg-card">
          <div class="cfg-card-header">
            <div class="cfg-card-title">Sobre o sistema</div>
          </div>
          <div class="cfg-info">
            Versao: <span class="t-strong">${versao}</span><br>
            Cache local: <strong id="cfg-storage-used">calculando...</strong><br>
            Source of truth: <strong>Supabase</strong> (todos cadastros, orcamentos e imagens).<br>
            O cache local e' apenas para performance — pode ser limpo a qualquer momento.
          </div>
          <div class="cfg-btn-row">
            <button class="cfg-btn cfg-btn-secondary" id="cfg-clear-cache">🗑 Limpar cache local</button>
          </div>
          <div class="cfg-msg" id="cfg-system-msg"></div>
        </div>

      </div>
    `;
    bindEvents(container);
    updateStorageUsage(container);
    updateSyncStatus(container);
    updateCambioCard(container);
  }

  /**
   * Felipe sessao 31: atualiza o card de cambio com PTAX em cache,
   * historico dos ultimos 30 dias e taxa manual atual.
   */
  function updateCambioCard(container) {
    if (!window.Cambio) return;
    const inpManual = container.querySelector('#cfg-cambio-manual');
    const pill = container.querySelector('#cfg-cambio-pill');
    const histDiv = container.querySelector('#cfg-cambio-hist');
    if (!inpManual || !pill || !histDiv) return;

    const manual = window.Cambio.getManual();
    const ptax = window.Cambio.getPtax();
    const hist = window.Cambio.getHistorico();

    inpManual.value = manual > 0 ? manual.toFixed(4) : '';

    if (manual > 0) {
      pill.textContent = 'Manual: R$ ' + manual.toFixed(4);
      pill.className = 'cfg-status-pill ativo';
    } else if (ptax && ptax.valor) {
      pill.textContent = 'PTAX: R$ ' + Number(ptax.valor).toFixed(4) + ' (' + (ptax.data || '?') + ')';
      pill.className = 'cfg-status-pill ativo';
    } else {
      pill.textContent = '⚠ Sem taxa';
      pill.className = 'cfg-status-pill inativo';
    }

    if (hist && hist.length) {
      const linhas = hist.slice(0, 30).map(h => {
        const d = (h.data || '').split('-').reverse().join('/');
        return '<tr><td style="padding:3px 8px;">' + d + '</td><td style="padding:3px 8px; text-align:right; font-variant-numeric:tabular-nums;">R$ ' + Number(h.valor).toFixed(4) + '</td></tr>';
      }).join('');
      histDiv.innerHTML =
        '<div style="font-size:12px; color:#666; margin-bottom:4px;">Historico PTAX (ultimos 30 dias uteis):</div>' +
        '<div style="max-height:180px; overflow:auto; border:1px solid #eee; border-radius:6px;">' +
        '<table style="width:100%; font-size:12px; border-collapse:collapse;"><tbody>' + linhas + '</tbody></table>' +
        '</div>';
    } else {
      histDiv.innerHTML =
        '<div style="font-size:12px; color:#999;">Historico PTAX nao baixado ainda. Clique em "Atualizar PTAX".</div>';
    }
  }

  function updateSyncStatus(container) {
    const info = container.querySelector('#cfg-sync-info');
    if (!info) return;
    if (!window.CadastrosAutosync) {
      info.innerHTML = '<span style="color:#c62828">⚠ Modulo de sync nao carregado. Recarregue a pagina.</span>';
      return;
    }
    function fmtTimestamp(ts) {
      if (!ts) return 'nunca';
      const d = new Date(ts);
      return d.toLocaleTimeString('pt-BR') + ' (' + d.toLocaleDateString('pt-BR') + ')';
    }
    function refresh() {
      const s = window.CadastrosAutosync.getStatus();
      const onlineIcon = s.online ? '🟢' : '🔴';
      const onlineLabel = s.online ? 'Online (conectado ao Supabase)' : 'Offline (sem conexao)';
      const loadIcon = s.initialLoadDone ? '✓' : '⏳';
      const loadLabel = s.initialLoadDone ? 'Carga inicial concluida' : 'Carregando dados do servidor...';
      info.innerHTML = ''
        + '<div style="margin-bottom:6px">' + onlineIcon + ' <strong>' + onlineLabel + '</strong></div>'
        + '<div style="margin-bottom:6px">' + loadIcon + ' ' + loadLabel + '</div>'
        + '<div style="margin-bottom:6px">📤 Itens na fila: <strong>' + (s.syncQueueLen || 0) + '</strong></div>'
        + '<div style="margin-bottom:6px">🕒 Ultimo sync: <strong>' + fmtTimestamp(s.lastSync) + '</strong></div>'
        + (s.error ? '<div style="color:#c62828;margin-top:6px">⚠ ' + s.error + '</div>' : '');
    }
    refresh();
    if (window.CadastrosAutosync.onStatusChange) {
      window.CadastrosAutosync.onStatusChange(refresh);
    }
    // Atualiza a cada 3s
    if (!container._syncInterval) {
      container._syncInterval = setInterval(refresh, 3000);
    }
  }

  function bindEvents(container) {
    const btnClearCache = container.querySelector('#cfg-clear-cache');
    const msgSys = container.querySelector('#cfg-system-msg');
    const btnSyncNow = container.querySelector('#cfg-sync-now');
    const btnSyncTest = container.querySelector('#cfg-sync-test');
    const btnMigrarImgs = container.querySelector('#cfg-migrar-imgs');
    const msgSync = container.querySelector('#cfg-sync-msg');

    // Felipe sessao 31: card de cambio
    const inpCambio = container.querySelector('#cfg-cambio-manual');
    const btnSalvar = container.querySelector('#cfg-cambio-salvar');
    const btnLimpar = container.querySelector('#cfg-cambio-limpar');
    const btnAtualizar = container.querySelector('#cfg-cambio-atualizar');
    const msgCambio = container.querySelector('#cfg-cambio-msg');

    if (btnSalvar && inpCambio) {
      btnSalvar.addEventListener('click', () => {
        if (!window.Cambio) return;
        const v = Number(inpCambio.value) || 0;
        if (v <= 0) {
          showMsg(msgCambio, 'error', '✗ Informe um valor maior que zero');
          return;
        }
        window.Cambio.setManual(v);
        showMsg(msgCambio, 'ok', '✓ Taxa manual salva: R$ ' + v.toFixed(4) + ' / USD. Vai ser usada em todo o sistema.');
        updateCambioCard(container);
      });
    }

    if (btnLimpar) {
      btnLimpar.addEventListener('click', () => {
        if (!window.Cambio) return;
        window.Cambio.setManual(0);
        if (inpCambio) inpCambio.value = '';
        showMsg(msgCambio, 'ok', '✓ Taxa manual removida. Sistema vai usar PTAX (BCB).');
        updateCambioCard(container);
      });
    }

    if (btnAtualizar) {
      btnAtualizar.addEventListener('click', async () => {
        if (!window.Cambio) return;
        btnAtualizar.disabled = true;
        btnAtualizar.textContent = '⏳ Baixando...';
        showMsg(msgCambio, 'info', 'Baixando cotacao PTAX dos ultimos 30 dias do BCB...');
        const r = await window.Cambio.atualizarPtax();
        btnAtualizar.disabled = false;
        btnAtualizar.textContent = '⟳ Atualizar PTAX';
        if (r.ok) {
          showMsg(msgCambio, 'ok',
            '✓ PTAX atualizada: R$ ' + Number(r.ptax.valor).toFixed(4) +
            ' (' + (r.ptax.data || '?') + ') — ' + r.historico.length + ' dias no historico');
        } else {
          showMsg(msgCambio, 'error', '✗ Falhou: ' + (r.erro || 'erro desconhecido'));
        }
        updateCambioCard(container);
      });
    }

    if (btnMigrarImgs) {
      btnMigrarImgs.addEventListener('click', async () => {
        if (!window.CadastrosAutosync || !window.CadastrosAutosync.migrarImagensBase64ParaStorage) {
          showMsg(msgSync, 'error', '✗ Funcao de migracao nao disponivel');
          return;
        }
        btnMigrarImgs.disabled = true;
        btnMigrarImgs.textContent = '⏳ Migrando...';
        showMsg(msgSync, 'info', 'Verificando imagens em base64 e enviando para o Storage...');
        try {
          const result = await window.CadastrosAutosync.migrarImagensBase64ParaStorage();
          if (result.erro) {
            showMsg(msgSync, 'error', '✗ Erro: ' + result.erro);
          } else if (result.total === 0) {
            showMsg(msgSync, 'ok', '✓ Nenhuma imagem em base64 encontrada. Tudo ja esta no Storage!');
          } else {
            showMsg(msgSync, 'ok', '✓ ' + result.migradas + ' de ' + result.total + ' imagens migradas para o Storage' + (result.falhas > 0 ? ' (' + result.falhas + ' falharam)' : ''));
          }
        } catch (err) {
          showMsg(msgSync, 'error', '✗ ' + err.message);
        }
        btnMigrarImgs.disabled = false;
        btnMigrarImgs.textContent = '🖼 Migrar imagens p/ Storage';
        updateSyncStatus(container);
      });
    }

    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', async () => {
        if (!window.CadastrosAutosync) {
          showMsg(msgSync, 'error', '✗ Modulo de sync nao disponivel');
          return;
        }
        btnSyncNow.disabled = true;
        btnSyncNow.textContent = '⏳ Sincronizando...';
        showMsg(msgSync, 'info', 'Enviando todos cadastros locais para o Supabase...');
        try {
          const result = await window.CadastrosAutosync.syncTudoAgora();
          if (result.erro) {
            showMsg(msgSync, 'error', '✗ Erro: ' + result.erro);
          } else {
            showMsg(msgSync, 'ok', '✓ ' + result.ok + ' de ' + result.total + ' cadastros sincronizados');
          }
        } catch (err) {
          showMsg(msgSync, 'error', '✗ ' + err.message);
        }
        btnSyncNow.disabled = false;
        btnSyncNow.textContent = '🔄 Sincronizar agora';
        updateSyncStatus(container);
      });
    }

    if (btnSyncTest) {
      btnSyncTest.addEventListener('click', async () => {
        btnSyncTest.disabled = true;
        btnSyncTest.textContent = '⏳ Testando...';
        showMsg(msgSync, 'info', 'Conectando ao Supabase...');
        try {
          const resp = await fetch('https://plmliavuwlgpwaizfeds.supabase.co/rest/v1/cadastros?limit=1&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858', {
            headers: { 'Accept-Profile': 'v7' }
          });
          if (resp.ok) {
            // Conta total de cadastros no Supabase
            const respCount = await fetch('https://plmliavuwlgpwaizfeds.supabase.co/rest/v1/cadastros?select=chave&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858', {
              headers: { 'Accept-Profile': 'v7' }
            });
            const arr = await respCount.json();
            const chaves = Array.isArray(arr) ? arr.map(r => r.chave).join(', ') : '';
            showMsg(msgSync, 'ok', '✓ Conexao OK. ' + (Array.isArray(arr) ? arr.length : 0) + ' cadastros no servidor: ' + chaves);
          } else {
            showMsg(msgSync, 'error', '✗ Erro HTTP ' + resp.status);
          }
        } catch (err) {
          showMsg(msgSync, 'error', '✗ Sem conexao: ' + err.message);
        }
        btnSyncTest.disabled = false;
        btnSyncTest.textContent = '🧪 Testar conexao';
      });
    }

    if (btnClearCache) {
      btnClearCache.addEventListener('click', () => {
        if (!confirm('Limpar TODOS os dados locais (CRM, cadastros, modelos, sessao)?\n\nEsta acao NAO pode ser desfeita. Voce sera deslogado.')) return;
        try {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('projetta:')) keys.push(k);
          }
          keys.forEach(k => localStorage.removeItem(k));
          showMsg(msgSys, 'ok', `✓ ${keys.length} chaves removidas. Recarregue a pagina pra ver mudancas.`);
        } catch (err) {
          showMsg(msgSys, 'error', '✗ ' + err.message);
        }
      });
    }
  }

  return { render };
})();

App.register('config', {
  render(container) {
    Config.render(container);
  }
});

