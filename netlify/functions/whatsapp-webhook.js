/**
 * Projetta — Webhook WhatsApp Cloud API (Felipe sessao 38)
 *
 * Recebe as mensagens que CHEGAM no numero oficial da Projetta e grava em
 * v7.wpp_mensagens (Supabase). Sem isso as conversas se PERDEM: a Cloud API
 * nao guarda historico, ela so empurra pro webhook na hora.
 *
 * GET  -> handshake de verificacao da Meta (hub.mode/hub.verify_token/hub.challenge)
 * POST -> eventos (mensagens recebidas + status de entrega das enviadas)
 *
 * Config na Meta (WhatsApp > Configuracao > Webhooks):
 *   Callback URL : https://projetta-2026.netlify.app/.netlify/functions/whatsapp-webhook
 *   Verify token : valor de WPP_VERIFY_TOKEN (default abaixo)
 *   Campos       : assinar "messages"
 *
 * VARIAVEIS DE AMBIENTE (Netlify, opcionais):
 *   WPP_VERIFY_TOKEN -> token do handshake (default 'projetta-webhook-2026')
 *   WPP_APP_SECRET   -> se setado, valida a assinatura X-Hub-Signature-256 (recomendado)
 *
 * Supabase: usa a anon key (publica, mesma do front) — a tabela tem RLS off
 * e grant de insert pra anon, igual ao kv_store. Nada sensivel no codigo.
 */

const crypto = require('crypto');

const VERIFY_TOKEN  = process.env.WPP_VERIFY_TOKEN || 'projetta-webhook-2026';
const APP_SECRET    = process.env.WPP_APP_SECRET || '';
const SUPABASE_URL  = 'https://maqmawofimmfxeyfmcmp.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hcW1hd29maW1tZnhleWZtY21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTUzOTEsImV4cCI6MjA5NDc5MTM5MX0.7NNp2SynjxSVSyBvbh4Jm5TFbaybYnny-HzaKUPefrc';

function sbHeaders() {
  return {
    'apikey': SUPABASE_ANON,
    'Authorization': 'Bearer ' + SUPABASE_ANON,
    'Content-Type': 'application/json',
    'Content-Profile': 'v7',
    'Accept-Profile': 'v7',
    'Prefer': 'resolution=ignore-duplicates,return=minimal',
  };
}

async function inserirMensagens(rows) {
  if (!rows.length) return true;
  const r = await fetch(SUPABASE_URL + '/rest/v1/wpp_mensagens', {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(rows),
  });
  return r.ok || r.status === 409; // 409 = duplicado (dedupe por wamid) tambem e' ok
}

async function atualizarStatus(wamid, status) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/wpp_mensagens?wamid=eq.' + encodeURIComponent(wamid), {
      method: 'PATCH',
      headers: sbHeaders(),
      body: JSON.stringify({ status: status }),
    });
  } catch (_) {}
}

// Extrai um texto legivel de qualquer tipo de mensagem recebida.
function textoDe(m) {
  if (!m) return '';
  if (m.type === 'text' && m.text) return m.text.body || '';
  if (m.type === 'button' && m.button) return m.button.text || '';
  if (m.type === 'interactive' && m.interactive) {
    const it = m.interactive;
    if (it.button_reply) return it.button_reply.title || '';
    if (it.list_reply) return it.list_reply.title || '';
  }
  if (m[m.type] && m[m.type].caption) return m[m.type].caption;
  return '[' + (m.type || 'mensagem') + ']';
}

exports.handler = async function (event) {
  // 1) Verificacao (GET): a Meta manda hub.* e espera o challenge de volta.
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === VERIFY_TOKEN) {
      return { statusCode: 200, headers: { 'Content-Type': 'text/plain' }, body: String(q['hub.challenge'] || '') };
    }
    return { statusCode: 403, body: 'forbidden' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'method not allowed' };

  // 2) (opcional) valida assinatura HMAC se WPP_APP_SECRET estiver setado.
  if (APP_SECRET) {
    const sig = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'] || '';
    const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(event.body || '', 'utf8').digest('hex');
    if (sig !== expected) return { statusCode: 401, body: 'bad signature' };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 200, body: 'ok' }; } // payload invalido: nao reprocessar

  const rows = [];
  const statusUpdates = [];
  try {
    (payload.entry || []).forEach(function (ent) {
      (ent.changes || []).forEach(function (ch) {
        const v = (ch && ch.value) || {};
        const contatos = {};
        (v.contacts || []).forEach(function (c) {
          if (c && c.wa_id) contatos[c.wa_id] = (c.profile && c.profile.name) || '';
        });
        (v.messages || []).forEach(function (m) {
          const tel = String(m.from || '').replace(/\D/g, '');
          rows.push({
            telefone: tel,
            nome: contatos[m.from] || null,
            direcao: 'in',
            tipo: m.type || 'text',
            texto: textoDe(m),
            wamid: m.id || null,
            ts: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
            raw: m,
          });
        });
        (v.statuses || []).forEach(function (st) {
          if (st && st.id && st.status) statusUpdates.push({ wamid: st.id, status: st.status });
        });
      });
    });
  } catch (e) { /* parse defensivo: nunca derruba o webhook */ }

  let okStore = true;
  try { okStore = await inserirMensagens(rows); }
  catch (e) { okStore = false; }

  // status de entrega (delivered/read/failed) das mensagens enviadas — best-effort
  for (let i = 0; i < statusUpdates.length; i++) {
    await atualizarStatus(statusUpdates[i].wamid, statusUpdates[i].status);
  }

  // Se falhou gravar mensagem RECEBIDA, devolve 500 -> a Meta REENVIA depois
  // (e o indice unico de wamid evita duplicar). Assim nao perdemos conversa.
  if (!okStore && rows.length) return { statusCode: 500, body: 'store failed' };
  return { statusCode: 200, body: 'ok' };
};
