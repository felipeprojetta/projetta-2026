/* 99-boot.js — entry point. Roda quando DOM carrega.
   Felipe (sessao 31): TUDO sincronizado via Supabase.
   Ordem: syncFromCloud -> migracoes -> App.init -> syncToCloud.
   O sync BLOQUEIA o boot pra garantir dados atualizados. */

document.addEventListener('DOMContentLoaded', async () => {

  // 1. SYNC DO CLOUD (ANTES de tudo)
  // Puxa TODOS os dados do Supabase pra localStorage.
  // Assim, quando Thays abrir, ela ve os dados do Felipe.
  if (Database && Database.syncFromCloud) {
    try {
      await Database.syncFromCloud();
    } catch (e) {
      console.warn('[Boot] syncFromCloud falhou, usando dados locais:', e.message);
    }
  }

  // 2. Migracoes
  try {
    Migracoes.rodarTodas();
  } catch (e) {
    console.error('[Boot] Erro nas migracoes:', e);
  }

  // 3. App.init
  App.init();

  // 4. Seed de cadastros
  try {
    if (window.Acessorios && typeof window.Acessorios.listar === 'function') window.Acessorios.listar();
    if (window.Superficies && typeof window.Superficies.listar === 'function') window.Superficies.listar();
    if (window.Perfis && typeof window.Perfis.listar === 'function') window.Perfis.listar();
    if (window.Modelos && typeof window.Modelos.listar === 'function') window.Modelos.listar();
  } catch (e) {
    console.error('[Boot] Erro forcando seed:', e);
  }

  // 5. Exposicao global
  window.Projetta = { App, Auth, Storage, Database, Events };
  window.App = App;

  // 6. SYNC LOCAL -> CLOUD (background, nao bloqueia)
  // Envia dados locais pro Supabase (caso tenha algo que o cloud nao tem)
  if (Database && Database.syncToCloud) {
    Database.syncToCloud().catch(function(e) {
      console.warn('[Boot] syncToCloud falhou:', e.message);
    });
  }

  // 6b. REALTIME: polling a cada 10s pra sync entre usuarios
  if (Database && Database.startRealtime) {
    Database.startRealtime();
  }

  // 7. TAB navigation fix
  document.querySelectorAll('.nav-item, #logout-btn').forEach(function(el) {
    if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1');
  });

  // 8. Combobox universal + empty-mark + titlecase
  if (window.Universal && typeof window.Universal.autoAttachCombobox === 'function') {
    window.Universal.autoAttachCombobox();
    if (typeof window.Universal.autoAttachTitleCase === 'function') window.Universal.autoAttachTitleCase();
    if (typeof window.Universal.autoAttachEmptyMark === 'function') window.Universal.autoAttachEmptyMark();
    if (typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function(mutations) {
        for (var mi = 0; mi < mutations.length; mi++) {
          var m = mutations[mi];
          if (m.type === 'attributes' && m.target && m.attributeName === 'value') {
            if (window.Universal.updateEmptyMark) window.Universal.updateEmptyMark(m.target);
          }
          for (var ni = 0; ni < (m.addedNodes || []).length; ni++) {
            var node = m.addedNodes[ni];
            if (node.nodeType !== 1) continue;
            if (node.matches && node.matches('input[list]')) window.Universal.attachCombobox(node);
            if (node.querySelectorAll) node.querySelectorAll('input[list]').forEach(function(inp) { window.Universal.attachCombobox(inp); });
            if (window.Universal.attachTitleCase) {
              if (node.matches && node.matches('input[data-titlecase], textarea[data-titlecase]')) window.Universal.attachTitleCase(node);
              if (node.querySelectorAll) node.querySelectorAll('input[data-titlecase], textarea[data-titlecase]').forEach(function(inp) { window.Universal.attachTitleCase(inp); });
            }
            if (window.Universal.attachEmptyMark) {
              if (node.matches && node.matches('input, select, textarea')) window.Universal.attachEmptyMark(node);
              if (node.querySelectorAll) node.querySelectorAll('input, select, textarea').forEach(function(el) { window.Universal.attachEmptyMark(el); });
            }
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
  }

  // Carregar modulos extras dinamicamente
  ['scripts/44-email-crm.js', 'scripts/35-outlook.js', 'scripts/45-email-agent.js'].forEach(function(src) {
    var s = document.createElement('script');
    s.src = src + '?v=' + Date.now();
    document.body.appendChild(s);
  });

  // Registrar módulo Email (Outlook + Agente)
  setTimeout(function() {
    if (!App.register) return;
    App.register('email', {
      render: function(container) {
        // Agente embutido diretamente (sem depender de timing)
        var agentHtml = '<div id="email-agent-section" style="background:#fff;border:2px solid #1a5276;border-radius:10px;padding:20px;margin:0 12px 16px;">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
          + '<div><div style="font-weight:700;font-size:16px;color:#1a5276">🤖 Agente Automatico de Reservas</div>'
          + '<div style="font-size:12px;color:#666;margin-top:2px">Escaneia inbox, identifica RESERVA, busca Weiku, cria lead no CRM</div></div>'
          + '<div style="display:flex;gap:8px"><button id="agent-scan-btn" style="background:#1a5276;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer">🔍 Escanear Agora</button>'
          + '<button id="agent-auto-btn" style="background:#2e7d32;color:#fff;border:none;padding:10px 16px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">▶ Auto 5min</button></div>'
          + '</div><div id="agent-log" style="background:#f5f7fa;border:1px solid #e0e0e0;border-radius:6px;padding:12px;font-family:monospace;font-size:12px;max-height:300px;overflow-y:auto;white-space:pre-wrap;color:#333;margin-top:12px">Clique "Escanear Agora" ou ative o auto-scan.</div></div>';
        container.innerHTML = agentHtml + '<div id="outlook-tab-content" style="padding:12px;"></div>';
        if (typeof outlookRenderTab === 'function') {
          outlookRenderTab();
        }
        // Bind agent buttons
        var scanBtn = document.getElementById('agent-scan-btn');
        var autoBtn = document.getElementById('agent-auto-btn');
        if (scanBtn) {
          scanBtn.addEventListener('click', async function() {
            // Espera script carregar (max 5s)
            var tentativas = 0;
            while (!window.EmailAgent && tentativas < 25) {
              await new Promise(function(r) { setTimeout(r, 200); });
              tentativas++;
            }
            if (!window.EmailAgent) {
              var logEl2 = document.getElementById('agent-log');
              if (logEl2) logEl2.textContent = '❌ Script do agente nao carregou. Recarregue a pagina (Ctrl+F5).';
              return;
            }
            scanBtn.disabled = true; scanBtn.textContent = '⏳ Escaneando...';
            var logEl = document.getElementById('agent-log');
            if (logEl) logEl.textContent = '';
            try {
              await window.EmailAgent.scan({ log: function(m) { if (logEl) { logEl.textContent += m + '\n'; logEl.scrollTop = logEl.scrollHeight; } } });
            } catch(e) { if (logEl) logEl.textContent += '❌ ' + e.message + '\n'; }
            scanBtn.disabled = false; scanBtn.textContent = '🔍 Escanear Agora';
          });
        }
        if (autoBtn) {
          autoBtn.addEventListener('click', async function() {
            var t = 0;
            while (!window.EmailAgent && t < 25) { await new Promise(function(r){setTimeout(r,200)}); t++; }
            if (!window.EmailAgent) return;
            if (window.EmailAgent._autoAtivo) {
              window.EmailAgent.stopAutoScan();
              window.EmailAgent._autoAtivo = false;
              autoBtn.style.background = '#2e7d32'; autoBtn.textContent = '▶ Auto 5min';
            } else {
              window.EmailAgent.startAutoScan(5);
              window.EmailAgent._autoAtivo = true;
              autoBtn.style.background = '#c62828'; autoBtn.textContent = '⏹ Parar Auto';
            }
          });
        }
      }
    });
  }, 800);
});
