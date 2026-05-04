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
    const msgSync = container.querySelector('#cfg-sync-msg');

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

