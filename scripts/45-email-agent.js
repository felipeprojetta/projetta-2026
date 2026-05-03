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
  // Regex para extrair numero de reserva do assunto
  // Exemplos: "RESERVA 146508", "orçamento - 146510", "146467 - Ana Luiza", "reserva 138599"
  var RESERVA_REGEX = /(?:reserva|orcamento|orçamento|AT0?)?\s*[-–]?\s*(\d{5,7})/i;

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
      etapa: 'fazer-orcamento',
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

  // ── Analisar PDF via Netlify Function (server-side) ──
  async function analisarPdfComIA(msgId, log) {
    if (!window.outlookIsAuth || !window.outlookIsAuth()) return null;
    try {
      var token = localStorage.getItem('projetta_outlook_access_token');
      if (!token) return null;

      // Buscar anexos PDF
      var resp = await fetch('https://graph.microsoft.com/v1.0/me/messages/' + msgId + '/attachments?$select=id,name,contentType,size', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!resp.ok) return null;
      var data = await resp.json();
      var pdfs = (data.value || []).filter(function(a) {
        return (a.contentType || '').indexOf('pdf') >= 0 || (a.name || '').toLowerCase().endsWith('.pdf');
      });
      if (!pdfs.length) { log('   📄 Sem PDF neste email'); return null; }

      // Baixar PDF
      var pdfAtt = pdfs[0];
      log('   📄 Baixando PDF: ' + pdfAtt.name + '...');
      var attResp = await fetch('https://graph.microsoft.com/v1.0/me/messages/' + msgId + '/attachments/' + pdfAtt.id, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!attResp.ok) return null;
      var attData = await attResp.json();
      if (!attData.contentBytes) return null;

      // Enviar para Netlify Function
      log('   🔍 Analisando PDF no servidor...');
      var parseResp = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: attData.contentBytes })
      });

      if (!parseResp.ok) {
        log('   ⚠ Erro no servidor: ' + parseResp.status);
        return null;
      }

      var info = await parseResp.json();
      if (info.error) {
        log('   ⚠ ' + info.error);
        return null;
      }

      if (info.largura || info.modelo || info.cor) {
        log('   ✅ PDF: ' + info.largura + '×' + info.altura + ' | Modelo ' + info.modelo + ' | Cor: ' + (info.cor || '').substring(0,30) + ' | Fechadura: ' + info.fechaduraDigital);
        return info;
      } else {
        log('   ⚠ Nao encontrou dados no PDF');
        if (info.textoCompleto) log('   📝 Texto: ' + info.textoCompleto.substring(0, 200));
        return null;
      }
    } catch (e) {
      log('   ⚠ Analise PDF falhou: ' + e.message);
      return null;
    }
  }

  // ── SCANNER: Busca e LISTA reservas (não cria leads) ──
  async function scanInbox(opts) {
    opts = opts || {};
    var log = opts.log || function() {};
    var onResults = opts.onResults || function() {};

    if (!window.outlookIsAuth || !window.outlookIsAuth()) {
      log('⚠ Outlook nao conectado. Faca login primeiro.');
      return [];
    }

    log('🔍 Buscando emails com "RESERVA" no assunto...');

    try {
      var inbox = await window.outlookListInbox({ top: 100 });
      var emails = (inbox && inbox.emails) || [];
      log('📨 ' + emails.length + ' email(s) encontrado(s)');

      var encontrados = [];
      for (var i = 0; i < emails.length; i++) {
        var email = emails[i];
        var assunto = email.subject || '';
        var match = assunto.match(RESERVA_REGEX);
        if (!match) continue;

        var numReserva = match[1];
        var jaExiste = leadJaExiste(numReserva);
        var from = (email.from && email.from.emailAddress) || {};

        encontrados.push({
          emailId: email.id,
          reserva: numReserva,
          assunto: assunto,
          remetente: from.name || from.address || '',
          data: email.receivedDateTime ? new Date(email.receivedDateTime).toLocaleDateString('pt-BR') : '',
          jaExiste: jaExiste,
          hasAttachments: email.hasAttachments
        });
      }

      // Remove duplicatas (mesmo numero reserva)
      var vistos = {};
      encontrados = encontrados.filter(function(e) {
        if (vistos[e.reserva]) return false;
        vistos[e.reserva] = true;
        return true;
      });

      log('📋 ' + encontrados.length + ' reserva(s) unica(s) encontrada(s)');
      onResults(encontrados);
      return encontrados;

    } catch (e) {
      log('❌ Erro no scan: ' + e.message);
      return [];
    }
  }

  // ── IMPORTAR: Cria leads dos selecionados ──
  async function importarSelecionados(lista, log) {
    log = log || function() {};
    var criados = 0;

    for (var i = 0; i < lista.length; i++) {
      var item = lista[i];
      log('🔄 [' + (i+1) + '/' + lista.length + '] Reserva ' + item.reserva + '...');

      try {
        if (!window.WeikuClient) {
          log('   ⚠ WeikuClient nao disponivel');
          continue;
        }

        var dados = await window.WeikuClient.buscarReserva(item.reserva);
        if (!dados || !dados.nome_cliente) {
          log('   ⚠ Sem dados na Weiku para reserva ' + item.reserva);
          continue;
        }

        // Tentar analisar PDF
        var portaInfo = null;
        if (item.hasAttachments) {
          try {
            log('   📄 Analisando PDF do email...');
            portaInfo = await analisarPdfComIA(item.emailId, log);
          } catch(_){}
        }
        if (portaInfo) dados._portaInfo = portaInfo;

        var agp = proximoAGP();
        var novoLead = criarLead(item.reserva, dados, agp, item.remetente);
        if (novoLead) {
          log('   ✅ ' + novoLead.cliente + ' | ' + agp);
          processados.add(item.emailId);
          criados++;
        }
      } catch (e) {
        log('   ❌ Erro: ' + e.message);
      }
    }

    salvarProcessados();
    if (criados > 0 && window.Events) window.Events.emit('crm:reload');
    log('\n✅ ' + criados + ' lead(s) criado(s)!');
    return criados;
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
    importar: importarSelecionados,
    renderUI: renderAgentUI,
    startAutoScan: startAutoScan,
    stopAutoScan: stopAutoScan,
    _autoAtivo: false,
    _criarLead: criarLead,
    _proximoAGP: proximoAGP,
    _analisarPdf: analisarPdfComIA,
    _leadJaExiste: leadJaExiste,
    resetProcessados: function() {
      processados.clear();
      localStorage.removeItem('projetta_agent_processados');
      console.log('[email-agent] Lista de processados resetada');
    }
  };

  // Auto-render: se a aba Email ja esta visivel, injeta o agente
  function _tentarAutoRender() {
    var el = document.getElementById('outlook-tab-content');
    if (el && !document.getElementById('email-agent-section')) {
      var container = el.parentElement || el;
      renderAgentUI(container);
    }
  }
  // Tenta agora e depois a cada 2s (caso a aba abra depois)
  setTimeout(_tentarAutoRender, 500);
  setTimeout(_tentarAutoRender, 2000);
  setTimeout(_tentarAutoRender, 5000);

  console.log('[email-agent] Agente de email carregado');
})();

// ── Limpar TODAS as tags/categorias de todos os emails ──
window.outlookLimparTodasTags = async function() {
  var token = localStorage.getItem('projetta_outlook_access_token');
  if (!token) { alert('Conecte ao Outlook primeiro'); return; }
  try {
    // Busca emails que tem categorias
    var resp = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=50&$filter=categories/any()&$select=id,subject,categories', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) throw new Error('Erro ' + resp.status);
    var data = await resp.json();
    var emails = data.value || [];
    if (!emails.length) { alert('Nenhum email com tags encontrado'); return; }
    var count = 0;
    for (var i = 0; i < emails.length; i++) {
      await fetch('https://graph.microsoft.com/v1.0/me/messages/' + emails[i].id, {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: [] })
      });
      count++;
    }
    alert(count + ' email(s) limpo(s). Atualize a lista.');
    if (typeof outlookRefreshInbox === 'function') outlookRefreshInbox();
  } catch(e) {
    alert('Erro: ' + e.message);
  }
};
