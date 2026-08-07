/**
 * netlify/functions/whatsapp-webhook.js — Felipe sessao 44
 *
 * Recebe os eventos do WhatsApp (Meta Cloud API em modo COEXISTENCIA) e
 * grava as mensagens no Supabase. NAO ENVIA NADA — Felipe: "so quero ter as
 * conversas dentro do sistema, para clicar e ele puxar se alguem respondeu
 * ou nao. nao quero enviar msg nenhuma".
 *
 * COEXISTENCIA: a Thays continua usando o celular normalmente. A Meta
 * espelha pra ca' o que ela manda (smb_message_echoes) e o que o cliente
 * responde (messages). Mensagem enviada pelo app nao gera cobranca.
 *
 * VARIAVEIS DE AMBIENTE (cadastrar no Netlify, marcadas como Secret):
 *   WA_VERIFY_TOKEN   - senha que voce inventa; a Meta devolve na validacao
 *   WA_APP_SECRET     - "Chave secreta do aplicativo" no painel da Meta
 *   SUPABASE_URL      - https://maqmawofimmfxeyfmcmp.supabase.co
 *   SUPABASE_SERVICE_KEY - service_role do Supabase (NUNCA no JS do site)
 *
 * SEGURANCA: toda requisicao e' verificada pela assinatura HMAC que a Meta
 * envia no header x-hub-signature-256. Sem isso, qualquer um que
 * descobrisse a URL poderia injetar conversa falsa no sistema.
 */

const crypto = require('crypto');

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const VERIFY_TOKEN  = process.env.WA_VERIFY_TOKEN;
const APP_SECRET    = process.env.WA_APP_SECRET;

/** Compara a assinatura em tempo constante (evita vazar por timing). */
function assinaturaValida(rawBody, header) {
  if (!APP_SECRET) return false;
  if (!header || typeof header !== 'string') return false;
  const esperado = 'sha256=' + crypto
    .createHmac('sha256', APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** So' digitos, sem '+', do jeito que a Meta manda. */
function soDigitos(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

/** Texto legivel de qualquer tipo de mensagem. */
function extrairTexto(msg) {
  if (!msg) return '';
  if (msg.text && msg.text.body) return msg.text.body;
  if (msg.button && msg.button.text) return msg.button.text;
  if (msg.interactive) {
    const i = msg.interactive;
    if (i.button_reply && i.button_reply.title) return i.button_reply.title;
    if (i.list_reply && i.list_reply.title) return i.list_reply.title;
  }
  // midia: guarda o rotulo do tipo pra tela nao ficar vazia
  const rotulos = { image: '[imagem]', audio: '[audio]', video: '[video]',
                    document: '[documento]', sticker: '[figurinha]',
                    location: '[localizacao]', contacts: '[contato]' };
  if (rotulos[msg.type]) {
    const legenda = (msg[msg.type] && msg[msg.type].caption) || '';
    return legenda ? rotulos[msg.type] + ' ' + legenda : rotulos[msg.type];
  }
  return '';
}

/** Grava no Supabase. ON CONFLICT DO NOTHING = webhook reenviado nao duplica. */
async function gravar(linhas) {
  if (!linhas.length) return { gravadas: 0 };
  const resp = await fetch(
    SUPABASE_URL + '/rest/v1/wa_mensagens?on_conflict=id',
    {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Content-Profile': 'v7',
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(linhas),
    }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error('Supabase ' + resp.status + ': ' + txt);
  }
  return { gravadas: linhas.length };
}

exports.handler = async (event) => {
  // ── 1. Validacao inicial da Meta (GET uma unica vez, ao cadastrar a URL)
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === VERIFY_TOKEN) {
      return { statusCode: 200, body: String(q['hub.challenge'] || '') };
    }
    return { statusCode: 403, body: 'verify token invalido' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'metodo nao permitido' };
  }

  const raw = event.body || '';

  // ── 2. So' aceita o que veio mesmo da Meta
  const sig = (event.headers || {})['x-hub-signature-256']
           || (event.headers || {})['X-Hub-Signature-256'];
  if (!assinaturaValida(raw, sig)) {
    console.warn('[wa-webhook] assinatura invalida — requisicao descartada');
    return { statusCode: 401, body: 'assinatura invalida' };
  }

  let body;
  try { body = JSON.parse(raw); }
  catch (e) { return { statusCode: 400, body: 'json invalido' }; }

  const linhas = [];
  try {
    (body.entry || []).forEach(entry => {
      (entry.changes || []).forEach(change => {
        const v = change.value || {};
        const campo = change.field || '';
        // nome do contato, quando a Meta manda
        const perfis = {};
        (v.contacts || []).forEach(c => {
          if (c && c.wa_id) perfis[soDigitos(c.wa_id)] = (c.profile && c.profile.name) || '';
        });

        // (a) mensagens que o CLIENTE mandou
        if (campo === 'messages' || v.messages) {
          (v.messages || []).forEach(m => {
            const tel = soDigitos(m.from);
            if (!tel || !m.id) return;
            linhas.push({
              id: m.id,
              telefone: tel,
              direcao: 'recebida',
              origem: 'app',
              texto: extrairTexto(m),
              tipo: m.type || 'text',
              enviada_em: new Date(Number(m.timestamp || 0) * 1000).toISOString(),
              contato_nome: perfis[tel] || null,
              raw: m,
            });
          });
        }

        // (b) ECHOES: o que a Thays mandou PELO CELULAR. E' o coracao da
        //     coexistencia — sem isso o sistema so' veria metade da conversa.
        if (campo === 'smb_message_echoes' || v.message_echoes) {
          (v.message_echoes || []).forEach(m => {
            const tel = soDigitos(m.to || m.from);
            if (!tel || !m.id) return;
            linhas.push({
              id: m.id,
              telefone: tel,
              direcao: 'enviada',
              origem: 'app',
              texto: extrairTexto(m),
              tipo: m.type || 'text',
              enviada_em: new Date(Number(m.timestamp || 0) * 1000).toISOString(),
              contato_nome: perfis[tel] || null,
              raw: m,
            });
          });
        }
      });
    });

    if (linhas.length) await gravar(linhas);
    console.log('[wa-webhook] ' + linhas.length + ' mensagem(ns) gravada(s)');
  } catch (e) {
    // Devolve 200 mesmo com erro: se responder erro, a Meta fica reenviando
    // o mesmo evento e pode suspender a inscricao do webhook. O erro fica
    // no log da Netlify pra investigar.
    console.error('[wa-webhook] erro ao processar:', e && e.message);
    return { statusCode: 200, body: 'ok (com erro registrado no log)' };
  }

  return { statusCode: 200, body: 'ok' };
};
