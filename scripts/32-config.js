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
            <div class="cfg-card-title">Sobre o sistema</div>
          </div>
          <div class="cfg-info">
            Versao: <span class="t-strong">${versao}</span><br>
            Storage local usado: <strong id="cfg-storage-used">calculando...</span><br>
            Dados do CRM, cadastros e configuracoes ficam salvos no seu proprio navegador.
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
  }

  function bindEvents(container) {
    const btnClearCache = container.querySelector('#cfg-clear-cache');
    const msgSys = container.querySelector('#cfg-system-msg');
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

