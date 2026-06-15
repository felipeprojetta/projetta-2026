/**
 * Projetta — Envio WhatsApp via Cloud API oficial (Meta Graph API)
 * Felipe sessao 37: integracao "WhatsApp Business direto no sistema".
 *
 * Esta funcao roda NO SERVIDOR (Netlify). O token do WhatsApp NUNCA vai
 * pro navegador — fica nas variaveis de ambiente do Netlify.
 *
 * VARIAVEIS DE AMBIENTE (setar no painel Netlify > Site settings > Environment):
 *   WPP_TOKEN        -> token permanente do System User (Meta Business)
 *   WPP_PHONE_ID     -> Phone Number ID do numero WhatsApp Business
 *   WPP_SEND_SECRET  -> segredo compartilhado p/ liberar o disparo (gate)
 *   WPP_API_VERSION  -> opcional, default 'v21.0'
 *
 * COMO CHAMAR (POST JSON):
 *   Template (fora da janela de 24h — o caso de prospeccao):
 *     { "secret":"...", "to":"5511999999999",
 *       "template": { "name":"prospeccao_projetta", "language":"pt_BR",
 *                     "variables":["Joao"] } }
 *   Texto livre (SO funciona dentro de 24h apos o cliente te responder):
 *     { "secret":"...", "to":"5511999999999", "text":"Oi, tudo bem?" }
 *
 * Resposta: { ok:true, id:"wamid...", to:"55..." } ou { ok:false, error:{...} }
 *
 * Seguranca v1: gate por segredo + 1 destinatario por chamada (o ritmo/lote
 * fica no cliente, controlado). Opt-out e log de auditoria entram no commit 2.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function resp(statusCode, obj) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(obj) };
}

// Normaliza p/ E.164 sem '+': so digitos, garante DDI 55 (Brasil).
function normalizarNumero(raw) {
  let n = String(raw || '').replace(/\D/g, '');
  if (!n) return '';
  // ja veio com DDI 55 (12-13 digitos: 55 + DDD + numero)
  if (n.length >= 12 && n.slice(0, 2) === '55') return n;
  // numero local BR (10-11 digitos: DDD + numero) -> prefixa 55
  if (n.length === 10 || n.length === 11) return '55' + n;
  // qualquer outro: devolve como veio (DDI estrangeiro etc)
  return n;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return resp(204, {});
  if (event.httpMethod !== 'POST') return resp(405, { ok: false, error: 'Use POST' });

  const TOKEN = process.env.WPP_TOKEN;
  const PHONE_ID = process.env.WPP_PHONE_ID;
  const SECRET = process.env.WPP_SEND_SECRET;
  const API_VERSION = process.env.WPP_API_VERSION || 'v21.0';

  if (!TOKEN || !PHONE_ID || !SECRET) {
    return resp(500, { ok: false, error: 'Funcao nao configurada: faltam variaveis de ambiente WPP_TOKEN / WPP_PHONE_ID / WPP_SEND_SECRET no Netlify.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return resp(400, { ok: false, error: 'JSON invalido no body.' }); }

  if (body.secret !== SECRET) return resp(401, { ok: false, error: 'Segredo invalido.' });

  const to = normalizarNumero(body.to);
  if (!to || to.length < 12) {
    return resp(400, { ok: false, error: 'Numero invalido (esperado DDI+DDD+numero, ex: 5511999999999).' });
  }

  // Monta o payload conforme template (prospeccao) ou texto livre (janela 24h)
  let payload;
  if (body.template && body.template.name) {
    const vars = Array.isArray(body.template.variables) ? body.template.variables : [];
    const components = vars.length
      ? [{ type: 'body', parameters: vars.map(function (v) { return { type: 'text', text: String(v) }; }) }]
      : [];
    payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: body.template.name,
        language: { code: body.template.language || 'pt_BR' },
        components: components,
      },
    };
  } else if (body.text) {
    payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: String(body.text) },
    };
  } else {
    return resp(400, { ok: false, error: 'Informe "template" (name+language+variables) ou "text".' });
  }

  const url = 'https://graph.facebook.com/' + API_VERSION + '/' + PHONE_ID + '/messages';

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(function () { return {}; });

    if (!r.ok) {
      // Erro da Meta (template nao aprovado, numero invalido, fora de janela, etc)
      return resp(r.status, { ok: false, to: to, error: (data && data.error) || data || ('HTTP ' + r.status) });
    }
    const id = data && data.messages && data.messages[0] && data.messages[0].id;
    return resp(200, { ok: true, to: to, id: id || null, raw: data });
  } catch (e) {
    return resp(502, { ok: false, to: to, error: 'Falha ao chamar a Graph API: ' + (e && e.message) });
  }
};
