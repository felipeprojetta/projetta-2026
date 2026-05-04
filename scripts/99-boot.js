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
  ['scripts/44-email-crm.js', 'scripts/35-outlook.js', 'scripts/45-email-agent.js', 'scripts/46-cadastros-autosync.js', 'scripts/50-estoque-omie.js'].forEach(function(src) {
    var s = document.createElement('script');
    s.src = src + '?v=' + Date.now();
    document.body.appendChild(s);
  });

  // Inicializar sync automatico de cadastros (Supabase = source of truth)
  setTimeout(function() {
    if (window.CadastrosAutosync && typeof window.CadastrosAutosync.init === 'function') {
      window.CadastrosAutosync.init();
    }
  }, 800);

  // Registrar módulo Estoque Omie
  setTimeout(function() {
    if (!App.register) return;
    App.register('estoque', {
      render: function(container) {
        if (window.EstoqueOmie) {
          window.EstoqueOmie.render(container);
        } else {
          container.innerHTML = '<div class="info-banner">Modulo Estoque Omie carregando...</div>';
          setTimeout(function() {
            if (window.EstoqueOmie) window.EstoqueOmie.render(container);
          }, 1500);
        }
      }
    });
  }, 600);

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
          + '<div style="display:flex;gap:8px"><button id="agent-scan-btn" style="background:#1a5276;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer">🔍 Escanear Todos</button>'
          + '<button id="agent-scan-from-btn" style="background:#2563eb;color:#fff;border:none;padding:10px 16px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">🎯 Escolher Inicio</button>'
          + '<button id="agent-auto-btn" style="background:#2e7d32;color:#fff;border:none;padding:10px 16px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">▶ Auto 5min</button>'
          + '<button onclick="if(confirm(\'Limpar TODAS as tags de todos os emails?\')){window.outlookLimparTodasTags()}" style="background:#888;color:#fff;border:none;padding:10px 12px;border-radius:6px;font-weight:600;font-size:11px;cursor:pointer">🗑 Limpar Tags</button>'
          + '<button onclick="if(window.EmailAgent){window.EmailAgent.resetProcessados();document.getElementById(\'agent-log\').textContent=\'♻ Lista de processados resetada. Clique Escanear Agora.\'}" style="background:#e65100;color:#fff;border:none;padding:10px 12px;border-radius:6px;font-weight:600;font-size:11px;cursor:pointer">♻ Reset Scan</button></div>'
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
            var t = 0;
            while (!window.EmailAgent && t < 25) { await new Promise(function(r){setTimeout(r,200)}); t++; }
            if (!window.EmailAgent) { logEl.textContent = '❌ Script nao carregou. Ctrl+F5.'; return; }
            scanBtn.disabled = true; scanBtn.textContent = '⏳ Escaneando...';
            var logEl = document.getElementById('agent-log');
            if (logEl) logEl.textContent = '';
            function log(m) { if (logEl) { logEl.textContent += m + '\n'; logEl.scrollTop = logEl.scrollHeight; } }

            await window.EmailAgent.scan({
              log: log,
              onResults: function(lista) {
                var novos = lista.filter(function(e) { return !e.jaExiste; });
                var existentes = lista.filter(function(e) { return e.jaExiste; });
                if (novos.length === 0) {
                  log('\n✅ Todas as reservas ja existem no CRM.');
                  return;
                }
                log('\n📋 ' + novos.length + ' nova(s), ' + existentes.length + ' ja existem');
                // Mostra um a um
                var existing = document.getElementById('agent-results');
                if (existing) existing.remove();
                var div = document.createElement('div');
                div.id = 'agent-results';
                div.style.cssText = 'margin-top:14px';
                logEl.parentElement.appendChild(div);
                window._agentNovos = novos;
                window._agentIdx = 0;
                mostrarProximo();
              }
            });
            scanBtn.disabled = false; scanBtn.textContent = '🔍 Escanear Todos';
          });
        }
        // Botao "Escolher Inicio" - lista emails pra usuario escolher de onde comecar
        var scanFromBtn = document.getElementById('agent-scan-from-btn');
        if (scanFromBtn) {
          scanFromBtn.addEventListener('click', async function() {
            var t = 0;
            while (!window.EmailAgent && t < 25) { await new Promise(function(r){setTimeout(r,200)}); t++; }
            if (!window.EmailAgent || !window.outlookIsAuth || !window.outlookIsAuth()) {
              alert('Conecte ao Outlook primeiro');
              return;
            }
            scanFromBtn.disabled = true; scanFromBtn.textContent = '⏳ Carregando...';
            var logEl = document.getElementById('agent-log');
            if (logEl) logEl.textContent = '📨 Carregando lista de emails...';
            try {
              var inbox = await window.outlookListInbox({ top: 100 });
              var emails = (inbox && inbox.emails) || [];
              var existing = document.getElementById('agent-results');
              if (existing) existing.remove();
              var div = document.createElement('div');
              div.id = 'agent-results';
              div.style.cssText = 'margin-top:14px';
              div.innerHTML = '<div style="font-weight:700;font-size:14px;color:#1a5276;margin-bottom:8px">📨 Clique no email para começar o scan a partir dele:</div>'
                + '<div style="max-height:400px;overflow-y:auto;border:1px solid #ddd;border-radius:6px">'
                + emails.map(function(em, i) {
                  var from = (em.from && em.from.emailAddress) ? (em.from.emailAddress.name || em.from.emailAddress.address) : '';
                  var dt = em.receivedDateTime ? new Date(em.receivedDateTime).toLocaleDateString('pt-BR') : '';
                  return '<div class="agent-email-pick" data-idx="' + i + '" style="padding:10px 12px;border-bottom:1px solid #eee;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center" onmouseover="this.style.background=\'#e8f0fe\'" onmouseout="this.style.background=\'#fff\'">'
                    + '<div style="flex:1"><div style="font-weight:600">' + from + '</div>'
                    + '<div style="color:#555">' + (em.subject||'').substring(0,70) + '</div></div>'
                    + '<div style="font-size:11px;color:#888;white-space:nowrap;margin-left:8px">' + dt + (em.hasAttachments ? ' 📎' : '') + '</div>'
                    + '</div>';
                }).join('')
                + '</div>';
              logEl.parentElement.appendChild(div);
              // Handler de clique em cada email
              div.querySelectorAll('.agent-email-pick').forEach(function(el) {
                el.addEventListener('click', function() {
                  var startIdx = parseInt(this.dataset.idx);
                  div.remove();
                  if (logEl) logEl.textContent = '🔍 Escaneando a partir do email #' + (startIdx+1) + '...\n';
                  // Filtra emails a partir do selecionado
                  var emailsFromHere = emails.slice(startIdx);
                  var REGEX = /(?:reserva|orcamento|orçamento|AT0?)?\s*[-–]?\s*(\d{5,7})/i;
                  var encontrados = [];
                  var vistos = {};
                  emailsFromHere.forEach(function(email) {
                    var match = (email.subject||'').match(REGEX);
                    if (!match) return;
                    var num = match[1];
                    if (vistos[num]) return;
                    vistos[num] = true;
                    var jaExiste = false;
                    try { jaExiste = window.EmailAgent._leadJaExiste ? window.EmailAgent._leadJaExiste(num) : false; } catch(_){}
                    var from = (email.from && email.from.emailAddress) || {};
                    encontrados.push({
                      emailId: email.id, reserva: num, assunto: email.subject||'',
                      remetente: from.name || from.address || '',
                      data: email.receivedDateTime ? new Date(email.receivedDateTime).toLocaleDateString('pt-BR') : '',
                      jaExiste: jaExiste, hasAttachments: email.hasAttachments
                    });
                  });
                  var novos = encontrados.filter(function(e) { return !e.jaExiste; });
                  if (logEl) logEl.textContent += '📋 ' + novos.length + ' reserva(s) nova(s)\n';
                  if (!novos.length) { if (logEl) logEl.textContent += '✅ Nenhuma reserva nova a partir deste email.\n'; return; }
                  window._agentNovos = novos;
                  window._agentIdx = 0;
                  mostrarProximo();
                });
              });
            } catch(err) {
              if (logEl) logEl.textContent = '❌ ' + err.message;
            }
            scanFromBtn.disabled = false; scanFromBtn.textContent = '🎯 Escolher Inicio';
          });
        }
        // Funcao que mostra cada reserva uma por vez
        function mostrarProximo() {
          var div = document.getElementById('agent-results');
          var novos = window._agentNovos || [];
          var idx = window._agentIdx || 0;
          if (idx >= novos.length || !div) {
            if (div) div.innerHTML = '<div style="padding:20px;text-align:center;font-weight:700;color:#2e7d32;font-size:16px">✅ Revisao completa!</div>';
            return;
          }
          var e = novos[idx];
          var nextAgp = '';
          try { if (window.EmailAgent && window.EmailAgent._proximoAGP) nextAgp = window.EmailAgent._proximoAGP(); } catch(_){}
          div.innerHTML = ''
            + '<div style="background:#fff;border:2px solid #1a5276;border-radius:10px;padding:20px;margin-bottom:12px">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
            + '<div style="font-weight:700;font-size:15px;color:#1a5276">Reserva ' + (idx+1) + ' de ' + novos.length + '</div>'
            + '<div style="font-size:12px;color:#888">' + (e.data||'') + '</div></div>'
            + '<div style="background:#f5f7fa;border-radius:6px;padding:12px;margin-bottom:14px">'
            + '<div style="font-weight:700;font-size:16px;color:#003144;margin-bottom:4px">Reserva ' + e.reserva + '</div>'
            + '<div style="font-size:13px;color:#555;margin-bottom:4px">' + (e.assunto||'') + '</div>'
            + '<div style="font-size:12px;color:#888">De: ' + (e.remetente||'') + (e.hasAttachments ? ' · 📎 Tem anexo' : '') + '</div>'
            + '</div>'
            + '<div style="margin-bottom:14px">'
            + '<label style="font-weight:600;font-size:13px;color:#1a5276">Numero AGP:</label>'
            + '<div style="display:flex;gap:8px;margin-top:4px;align-items:center">'
            + '<input type="text" id="agent-agp-input" value="' + nextAgp + '" placeholder="AGP automatico" style="padding:8px 12px;border:1px solid #ccc;border-radius:4px;font-size:14px;font-weight:700;width:180px" />'
            + '<span style="font-size:11px;color:#888">Deixe o valor sugerido ou digite outro</span>'
            + '</div></div>'
            + '<div style="display:flex;gap:10px">'
            + '<button id="agent-importar-btn" style="background:#2e7d32;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer;flex:1">✅ Importar Lead</button>'
            + '<button id="agent-pular-btn" style="background:#888;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer">⏭ Pular</button>'
            + '<button id="agent-pular-todos-btn" style="background:#c62828;color:#fff;border:none;padding:10px 16px;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer">⏹ Parar</button>'
            + '</div></div>';
          // Handlers
          document.getElementById('agent-pular-btn').addEventListener('click', function() {
            window._agentIdx++;
            mostrarProximo();
          });
          document.getElementById('agent-pular-todos-btn').addEventListener('click', function() {
            window._agentIdx = novos.length;
            mostrarProximo();
          });
          document.getElementById('agent-importar-btn').addEventListener('click', async function() {
            var btn = this;
            btn.disabled = true; btn.textContent = '⏳ Importando...';
            var agpManual = document.getElementById('agent-agp-input').value.trim();
            var logEl = document.getElementById('agent-log');
            function log(m) { if (logEl) { logEl.textContent += m + '\n'; logEl.scrollTop = logEl.scrollHeight; } }
            try {
              var item = novos[idx];
              log('🔄 Reserva ' + item.reserva + '...');
              if (!window.WeikuClient) { log('⚠ WeikuClient indisponivel'); btn.textContent = '❌ Erro'; return; }
              var dados = await window.WeikuClient.buscarReserva(item.reserva);
              if (!dados || !dados.nome_cliente) { log('⚠ Sem dados Weiku'); btn.textContent = '❌ Sem dados'; return; }
              // PDF
              if (item.hasAttachments) {
                try { var pi = await window.EmailAgent._analisarPdf(item.emailId, log); if (pi) dados._portaInfo = pi; } catch(_){}
              }
              // Criar lead com AGP manual ou auto
              var lead = window.EmailAgent._criarLead(item.reserva, dados, agpManual, item.remetente);
              if (lead) {
                log('✅ ' + lead.cliente + ' | ' + lead.numeroAGP);
                // Tag no email: "Fazer Orcamento"
                try {
                  var token = localStorage.getItem('projetta_outlook_access_token');
                  if (token) {
                    await fetch('https://graph.microsoft.com/v1.0/me/messages/' + item.emailId, {
                      method: 'PATCH',
                      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ categories: ['Fazer Orcamento'] })
                    });
                    log('   🏷 Tag "Fazer Orcamento" aplicada no email');
                  }
                } catch(_){}
                if (window.Events) window.Events.emit('crm:reload');
              }
            } catch(err) { log('❌ ' + err.message); }
            window._agentIdx++;
            mostrarProximo();
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
