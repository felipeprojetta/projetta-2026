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
    if (!window.Storage) return false;
    var store = window.Storage.scope('crm');
    var leads = store.get('leads') || [];
    var r = String(reserva).trim();
    return leads.some(function(l) {
      return String(l.numeroReserva || '').trim() === r;
    });
  }

  // ── Proximo AGP ──
  function proximoAGP() {
    if (!window.Storage) return 'AGP000001';
    var store = window.Storage.scope('crm');
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
    if (!window.Storage) return false;
    var store = window.Storage.scope('crm');
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
      emailOrigem: emailOrigem || ''
    };

    leads.push(novo);
    store.set('leads', leads);
    return novo;
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
          var dados = await window.WeikuClient.buscar(numReserva);

          if (!dados || !dados.nome_cliente) {
            log('   ⚠ Reserva ' + numReserva + ' sem dados na Weiku');
            processados.add(email.id);
            erros++;
            continue;
          }

          var agp = proximoAGP();
          var from = (email.from && email.from.emailAddress) ? email.from.emailAddress.address : '';
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

  // ── UI do Agente (renderiza dentro da aba Email) ──
  function renderAgentUI(container) {
    var div = document.createElement('div');
    div.id = 'email-agent-section';
    div.style.cssText = 'background:#fff;border:2px solid #1a5276;border-radius:10px;padding:20px;margin:16px 0;';
    div.innerHTML = ''
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
      + '<div>'
      + '<div style="font-weight:700;font-size:16px;color:#1a5276">🤖 Agente Automatico de Reservas</div>'
      + '<div style="font-size:12px;color:#666;margin-top:2px">Escaneia inbox, identifica RESERVA no assunto, cria lead no CRM</div>'
      + '</div>'
      + '<button id="agent-scan-btn" style="background:#1a5276;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer">🔍 Escanear Inbox</button>'
      + '</div>'
      + '<div id="agent-log" style="background:#f5f7fa;border:1px solid #e0e0e0;border-radius:6px;padding:12px;font-family:monospace;font-size:12px;max-height:300px;overflow-y:auto;white-space:pre-wrap;color:#333"></div>';

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
      btn.textContent = '🔍 Escanear Inbox';
    });
  }

  // ── Inicializar ──
  carregarProcessados();

  // Expoe globalmente
  window.EmailAgent = {
    scan: scanInbox,
    renderUI: renderAgentUI
  };

  console.log('[email-agent] Agente de email carregado');
})();
