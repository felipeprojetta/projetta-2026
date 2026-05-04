/* ================================================================
 * 44-email-crm.js — Email → CRM automático
 * ================================================================
 * Verifica v7.email_queue no Supabase por reservas novas.
 * Para cada reserva pendente:
 *   1. Busca dados no Weiku API
 *   2. Cria lead no CRM com AGP automático
 *   3. Marca como processado
 *
 * Felipe (sessao 32): "sempre que chegar um email novo com numero
 * de reserva novo ja puxar para o crm"
 * ================================================================ */
(function() {
  'use strict';

  const SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNjI4MDksImV4cCI6MjA2MTczODgwOX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  // ── Buscar fila de emails pendentes ──
  async function buscarPendentes() {
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/email_queue?status=eq.pendente&order=created_at.asc',
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Accept-Profile': 'v7'
          }
        }
      );
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.warn('[email-crm] Erro ao buscar fila:', e);
      return [];
    }
  }

  // ── Marcar email como processado ──
  async function marcarProcessado(id, agp, status) {
    try {
      await fetch(
        SUPABASE_URL + '/rest/v1/email_queue?id=eq.' + id,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Profile': 'v7',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: status || 'processado',
            agp: agp || '',
            processed_at: new Date().toISOString()
          })
        }
      );
    } catch (e) {
      console.warn('[email-crm] Erro ao marcar processado:', e);
    }
  }

  // ── Verificar se lead com essa reserva ja existe ──
  function leadJaExiste(reserva) {
    if (!window.Storage) return false;
    var leads = window.Storage.scope('crm').get('leads') || [];
    return leads.some(function(l) {
      return String(l.numeroReserva) === String(reserva);
    });
  }

  // ── Gerar proximo AGP ──
  function proximoAGP() {
    var max = 4645; // piso Felipe
    var leads = (window.Storage && window.Storage.scope('crm').get('leads')) || [];
    leads.forEach(function(l) {
      if (!l.numeroAGP) return;
      var m = String(l.numeroAGP).match(/(\d+)/);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    });
    return 'AGP' + String(max + 1).padStart(6, '0');
  }

  // ── Criar lead no CRM a partir dos dados da Weiku ──
  function criarLeadAutomatico(reserva, dadosWeiku, agp) {
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
      origem: 'email-automatico'
    };

    leads.push(novo);
    store.set('leads', leads);
    console.log('[email-crm] Lead criado:', novo.cliente, '|', novo.numeroAGP, '| Reserva:', reserva);
    return true;
  }

  // ── Processar fila ──
  async function processarFila() {
    var pendentes = await buscarPendentes();
    if (!pendentes.length) return 0;

    console.log('[email-crm] ' + pendentes.length + ' email(s) pendente(s) na fila');
    var criados = 0;

    for (var i = 0; i < pendentes.length; i++) {
      var item = pendentes[i];
      var reserva = String(item.reserva).trim();

      // Ja existe? Pular
      if (leadJaExiste(reserva)) {
        console.log('[email-crm] Reserva ' + reserva + ' ja existe no CRM, pulando');
        await marcarProcessado(item.id, '', 'ja_existe');
        continue;
      }

      // Buscar dados na Weiku API
      try {
        if (!window.WeikuClient) {
          console.warn('[email-crm] WeikuClient nao disponivel');
          break;
        }
        var dados = await window.WeikuClient.buscarReserva(reserva);
        if (!dados || !dados.nome_cliente) {
          console.warn('[email-crm] Reserva ' + reserva + ' sem dados na Weiku');
          await marcarProcessado(item.id, '', 'erro');
          continue;
        }

        var agp = proximoAGP();
        var ok = criarLeadAutomatico(reserva, dados, agp);
        if (ok) {
          await marcarProcessado(item.id, agp, 'processado');
          criados++;
        }
      } catch (e) {
        console.warn('[email-crm] Erro ao processar reserva ' + reserva + ':', e);
        await marcarProcessado(item.id, '', 'erro');
      }
    }

    // Re-renderizar CRM se criou leads
    if (criados > 0 && window.Events) {
      window.Events.emit('crm:reload');
      console.log('[email-crm] ' + criados + ' lead(s) criado(s) automaticamente!');
    }

    return criados;
  }

  // ── Polling: DESABILITADO sessao 2026-08 (Felipe) ──
  // Robo agora roda manualmente via botao "Importar pro CRM" no modal
  // do email aberto (45-email-import.js). Funcoes publicas seguem
  // expostas em window.EmailCRM pra reuso.
  var POLL_INTERVAL = 2 * 60 * 1000; // 2 min

  function iniciarPolling() {
    // Felipe sessao 2026-08: comentado. Antes:
    //   setTimeout(function(){ processarFila(); setInterval(processarFila, POLL_INTERVAL); }, 10000);
    // Agora: nada acontece automaticamente. Manual via 45-email-import.js
    console.log('[email-crm] polling automatico DESABILITADO. Use botao Importar pro CRM no modal do email.');
  }

  // ── Expor para uso manual ──
  window.EmailCRM = {
    processarFila: processarFila,
    buscarPendentes: buscarPendentes,
    proximoAGP: proximoAGP,
    criarLeadAutomatico: criarLeadAutomatico  // exposto pro 45-email-import.js
  };

  // ── Iniciar polling quando o app carregar ──
  if (document.readyState === 'complete') {
    iniciarPolling();
  } else {
    window.addEventListener('load', iniciarPolling);
  }

  console.log('[email-crm] Modulo carregado. Polling a cada 2min.');
})();
