/* ================================================================
 * 45-email-agent.js — Agente Automatico de Email → CRM
 * ================================================================
 * Le o inbox do Outlook, identifica emails com "RESERVA" no assunto,
 * extrai numero da reserva, busca dados no Weiku API, e cria lead
 * no CRM automaticamente.
 *
 * Dependencias:
 *   - 35-outlook.js (outlookListInbox, outlookGetEmail, outlookIsAuth)
 *   - 40-weiku-client.js (WeikuClient.buscar)
 *   - CRM storage (Storage.scope('crm'))
 *
 * Felipe (sessao 2026-10): "ler email, abrir o anexo que tem medidas,
 * modelo etc, se nao tiver o cliente no crm, vai pegar a reserva e ja
 * criar lead sozinho"
 * ================================================================ */
(function() {
  'use strict';

  // ── Regex para extrair numero de reserva do assunto ──
  // Exemplos: "RESERVA 146508 - Arq Julliana Wagner..."
  //           "Re: RESERVA 146508..."
  //           "Fwd: reserva 146508 porta..."
  var RESERVA_REGEX = /reserva\s*(\d{4,7})/i;

  // IDs de emails ja processados (evita duplicar)
  var processados = new Set();

  // Carrega lista de processados do localStorage
  function carregarProcessados() {
    try {
      var arr = JSON.parse(localStorage.getItem('projetta_agent_processados') || '[]');
      arr.forEach(function(id) { processados.add(id); });
    } catch (e) {}
  }
  function salvarProcessados() {
    try {
      localStorage.setItem('projetta_agent_processados', JSON.stringify(Array.from(processados)));
    } catch (e) {}
  }

  // ── Verificar se lead ja existe por numero de reserva ──
  function leadJaExiste(reserva) {
    var store;
    try { store = (typeof Storage !== 'undefined' && Storage.scope) ? Storage.scope('crm') : null; } catch(e) { return false; }
    if (!store) return false;
    var leads = store.get('leads') || [];
    var r = String(reserva).trim();
    return leads.some(function(l) {
      return String(l.numeroReserva || '').trim() === r;
    });
  }

  // ── Proximo AGP ──
  function proximoAGP() {
    var store;
    try { store = (typeof Storage !== 'undefined' && Storage.scope) ? Storage.scope('crm') : null; } catch(e) { return 'AGP000001'; }
    if (!store) return 'AGP000001';
    var leads = store.get('leads') || [];
    var max = 4645; // piso
    leads.forEach(function(l) {
      var n = parseInt(String(l.numeroAGP || '').replace(/\D/g, ''), 10);
      if (n > max) max = n;
    });
    return 'AGP' + String(max + 1).padStart(6, '0');
  }

  // ── Criar lead no CRM ──
  function criarLead(reserva, dadosWeiku, agp, emailOrigem) {
    var store;
    try { store = (typeof Storage !== 'undefined' && Storage.scope) ? Storage.scope('crm') : null; } catch(e) { return false; }
    if (!store) return false;
    var leads = store.get('leads') || [];

    var novo = {
      id: 'lead_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      cliente: dadosWeiku.nome_cliente || '',
      telefone: dadosWeiku.telefone || '',
      email: dadosWeiku.email || '',
      cep: dadosWeiku.cep || '',
      cidade: dadosWeiku.cidade || '',
      estado: dadosWeiku.estado || '',
      representante: dadosWeiku.representante || '',
      representante_followup: dadosWeiku.representante_followup || '',
      representante_contato: dadosWeiku.representante_contato || '',
      numeroReserva: String(reserva),
      numeroAGP: agp,
      valor: 0,
      etapa: 'qualificacao',
      destinoTipo: 'nacional',
      destinoPais: '',
      data: new Date().toISOString().slice(0, 10),
      origem: 'email-agente-outlook',
      emailOrigem: emailOrigem || '',
      // Campos de porta (preenchidos pelo agente via PDF/IA)
      porta_largura: '',
      porta_altura: '',
      porta_modelo: '',
      porta_cor: '',
      porta_fechadura_digital: ''
    };

    // Mescla dados extras (do PDF) se fornecidos
    if (dadosWeiku._portaInfo) {
      var pi = dadosWeiku._portaInfo;
      if (pi.largura) novo.porta_largura = pi.largura;
      if (pi.altura) novo.porta_altura = pi.altura;
      if (pi.modelo) novo.porta_modelo = pi.modelo;
      if (pi.cor) novo.porta_cor = pi.cor;
      if (pi.fechaduraDigital) novo.porta_fechadura_digital = pi.fechaduraDigital;
    }

    leads.push(novo);
    store.set('leads', leads);
    return novo;
  }

  // ── Analisar PDF com Claude API ──
  async function analisarPdfComIA(msgId, log) {
    if (!window.outlookIsAuth || !window.outlookIsAuth()) return null;
    try {
      // Busca anexos do email
      var _gc = window._outlookGraphCall || (function(){ return null; });
      // Usa a funcao interna do outlook module
      var token = localStorage.getItem('projetta_outlook_access_token');
      if (!token) return null;

      var resp = await fetch('https://graph.microsoft.com/v1.0/me/messages/' + msgId + '/attachments?$select=id,name,contentType,size', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!resp.ok) return null;
      var data = await resp.json();
      var pdfs = (data.value || []).filter(function(a) {
        return (a.contentType || '').indexOf('pdf') >= 0 || (a.name || '').toLowerCase().endsWith('.pdf');
      });
      if (!pdfs.length) { log('   📄 Sem PDF anexo neste email'); return null; }

      // Baixa o primeiro PDF
      var pdfAtt = pdfs[0];
      log('   📄 Analisando PDF: ' + pdfAtt.name + '...');
      var attResp = await fetch('https://graph.microsoft.com/v1.0/me/messages/' + msgId + '/attachments/' + pdfAtt.id, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!attResp.ok) return null;
      var attData = await attResp.json();
      if (!attData.contentBytes) return null;

      // Envia pro Claude API pra extrair dados
      log('   🤖 Enviando PDF pro Claude analisar...');
      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: attData.contentBytes }
              },
              {
                type: 'text',
                text: 'Extraia do PDF os seguintes dados da porta. Responda SOMENTE em JSON puro (sem markdown, sem explicacao):\n{"largura":"valor em mm","altura":"valor em mm","modelo":"numero do modelo","cor":"nome da cor ou codigo","fechaduraDigital":"sim ou nao"}\nSe um campo nao existir no PDF, use string vazia "".'
              }
            ]
          }]
        })
      });

      if (!aiResp.ok) {
        log('   ⚠ Claude API: ' + aiResp.status);
        return null;
      }

      var aiData = await aiResp.json();
      var text = (aiData.content && aiData.content[0] && aiData.content[0].text) || '';
      // Parse JSON
      try {
        var clean = text.replace(/```json|```/g, '').trim();
        var info = JSON.parse(clean);
        log('   ✅ PDF analisado: ' + info.largura + 'x' + info.altura + ' modelo ' + info.modelo + ' cor ' + info.cor + ' fechadura ' + info.fechaduraDigital);
        return info;
      } catch (pe) {
        log('   ⚠ Nao conseguiu parsear resposta da IA: ' + text.substring(0, 100));
        return null;
      }
    } catch (e) {
      log('   ⚠ Analise PDF falhou: ' + e.message);
      return null;
    }
  }
  }

  // ── SCANNER PRINCIPAL ──
  async function scanInbox(opts) {
    opts = opts || {};
    var log = opts.log || function() {};
    var resultados = [];

    if (!window.outlookIsAuth || !window.outlookIsAuth()) {
      log('⚠ Outlook nao conectado. Faca login primeiro.');
      return { sucesso: false, msg: 'Outlook nao conectado', resultados: [] };
    }

    log('🔍 Buscando emails com "RESERVA" no assunto...');

    try {
      // Busca emails com "reserva" no assunto (ultimos 50)
      var inbox = await window.outlookListInbox({
        top: 50,
        search: 'subject:reserva'
      });

      var emails = (inbox && inbox.emails) || [];
      log('📨 ' + emails.length + ' email(s) encontrado(s) com "reserva"');

      var novos = 0;
      var jaExistem = 0;
      var erros = 0;

      for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        var assunto = email.subject || '';

        // Ja processou este email?
        if (processados.has(email.id)) {
          continue;
        }

        // Extrair numero da reserva
        var match = assunto.match(RESERVA_REGEX);
        if (!match) {
          continue;
        }

        var numReserva = match[1];
        log('📋 Reserva ' + numReserva + ' encontrada: "' + assunto.substring(0, 60) + '..."');

        // Ja existe no CRM?
        if (leadJaExiste(numReserva)) {
          log('   ✓ Reserva ' + numReserva + ' ja existe no CRM, pulando');
          processados.add(email.id);
          jaExistem++;
          continue;
        }

        // Buscar dados na Weiku API
        try {
          if (!window.WeikuClient) {
            log('   ⚠ WeikuClient nao disponivel');
            erros++;
            continue;
          }

          log('   🔄 Buscando dados da reserva ' + numReserva + ' na Weiku...');
          var dados = await window.WeikuClient.buscarReserva(numReserva);

          if (!dados || !dados.nome_cliente) {
            log('   ⚠ Reserva ' + numReserva + ' sem dados na Weiku');
            processados.add(email.id);
            erros++;
            continue;
          }

          var agp = proximoAGP();
          var from = (email.from && email.from.emailAddress) ? email.from.emailAddress.address : '';

          // Tentar analisar PDF anexo antes de criar lead
          var portaInfo = null;
          try {
            portaInfo = await analisarPdfComIA(email.id, log);
          } catch(_){}
          if (portaInfo) {
            dados._portaInfo = portaInfo;
          }

          var novoLead = criarLead(numReserva, dados, agp, from);

          if (novoLead) {
            log('   ✅ Lead criado: ' + novoLead.cliente + ' | ' + agp + ' | Reserva ' + numReserva);
            processados.add(email.id);
            novos++;
            resultados.push({
              reserva: numReserva,
              cliente: novoLead.cliente,
              agp: agp,
              email: assunto
            });
          }
        } catch (e) {
          log('   ❌ Erro na reserva ' + numReserva + ': ' + e.message);
          erros++;
        }
      }

      salvarProcessados();

      // Re-renderizar CRM se criou leads
      if (novos > 0 && window.Events) {
        window.Events.emit('crm:reload');
      }

      var resumo = '✅ Scan completo: ' + novos + ' novo(s), ' + jaExistem + ' ja existiam, ' + erros + ' erro(s)';
      log(resumo);

      return {
        sucesso: true,
        msg: resumo,
        novos: novos,
        jaExistem: jaExistem,
        erros: erros,
        resultados: resultados
      };

    } catch (e) {
      log('❌ Erro no scan: ' + e.message);
      return { sucesso: false, msg: e.message, resultados: [] };
    }
  }

  // ── Auto-scan timer ──
  var _autoScanInterval = null;
  function startAutoScan(intervalMin) {
    stopAutoScan();
    intervalMin = intervalMin || 5;
    console.log('[email-agent] Auto-scan iniciado: a cada ' + intervalMin + ' min');
    _autoScanInterval = setInterval(function() {
      if (!window.outlookIsAuth || !window.outlookIsAuth()) return;
      scanInbox({ log: function(msg) { console.log('[auto-scan] ' + msg); } }).then(function(r) {
        if (r && r.novos > 0) {
          // Notificação visual
          _notificar(r.novos + ' novo(s) lead(s) criado(s) pelo agente!');
        }
      });
    }, intervalMin * 60 * 1000);
  }
  function stopAutoScan() {
    if (_autoScanInterval) { clearInterval(_autoScanInterval); _autoScanInterval = null; }
  }

  // ── Notificação visual ──
  function _notificar(msg) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#2e7d32;color:#fff;padding:14px 24px;border-radius:8px;font-weight:700;font-size:14px;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,0.3);animation:fadeIn 0.3s;';
    toast.textContent = '🤖 ' + msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 6000);
    // Browser notification se permitido
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Projetta — Agente de Email', { body: msg, icon: 'images/projetta-logo.png' });
    }
  }

  // ── UI do Agente (renderiza dentro da aba Email) ──
  function renderAgentUI(container) {
    var div = document.createElement('div');
    div.id = 'email-agent-section';
    div.style.cssText = 'background:#fff;border:2px solid #1a5276;border-radius:10px;padding:20px;margin:16px 0;';
    var autoAtivo = !!_autoScanInterval;
    div.innerHTML = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">'
      + '<div>'
      + '<div style="font-weight:700;font-size:16px;color:#1a5276">🤖 Agente Automatico de Reservas</div>'
      + '<div style="font-size:12px;color:#666;margin-top:2px">Escaneia inbox, identifica RESERVA no assunto, busca Weiku API, cria lead no CRM</div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<button id="agent-scan-btn" style="background:#1a5276;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer">🔍 Escanear Agora</button>'
      + '<button id="agent-auto-btn" style="background:' + (autoAtivo ? '#c62828' : '#2e7d32') + ';color:#fff;border:none;padding:10px 16px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">' + (autoAtivo ? '⏹ Parar Auto' : '▶ Auto 5min') + '</button>'
      + '</div>'
      + '</div>'
      + '<div id="agent-log" style="background:#f5f7fa;border:1px solid #e0e0e0;border-radius:6px;padding:12px;font-family:monospace;font-size:12px;max-height:300px;overflow-y:auto;white-space:pre-wrap;color:#333">'
      + (autoAtivo ? '🟢 Auto-scan ativo (a cada 5 minutos)\n' : 'Clique "Escanear Agora" ou ative o auto-scan.\n')
      + '</div>';

    // Insere no topo do container do outlook
    var outlookEl = document.getElementById('outlook-tab-content');
    if (outlookEl) {
      outlookEl.insertBefore(div, outlookEl.firstChild);
    } else {
      container.appendChild(div);
    }

    // Handler do botao
    document.getElementById('agent-scan-btn').addEventListener('click', async function() {
      var btn = this;
      var logEl = document.getElementById('agent-log');
      btn.disabled = true;
      btn.textContent = '⏳ Escaneando...';
      logEl.textContent = '';

      function log(msg) {
        logEl.textContent += msg + '\n';
        logEl.scrollTop = logEl.scrollHeight;
      }

      try {
        await scanInbox({ log: log });
      } catch (e) {
        log('❌ Erro: ' + e.message);
      }

      btn.disabled = false;
      btn.textContent = '🔍 Escanear Agora';
    });

    // Handler auto-scan
    document.getElementById('agent-auto-btn').addEventListener('click', function() {
      var btn = this;
      var logEl = document.getElementById('agent-log');
      if (_autoScanInterval) {
        stopAutoScan();
        btn.style.background = '#2e7d32';
        btn.textContent = '▶ Auto 5min';
        logEl.textContent += '⏹ Auto-scan desativado\n';
      } else {
        startAutoScan(5);
        btn.style.background = '#c62828';
        btn.textContent = '⏹ Parar Auto';
        logEl.textContent += '🟢 Auto-scan ativado (a cada 5 minutos)\n';
        // Pede permissão de notificação do browser
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    });
  }

  // ── Inicializar ──
  carregarProcessados();

  // Expoe globalmente
  window.EmailAgent = {
    scan: scanInbox,
    renderUI: renderAgentUI,
    startAutoScan: startAutoScan,
    stopAutoScan: stopAutoScan
  };

  console.log('[email-agent] Agente de email carregado');
})();
