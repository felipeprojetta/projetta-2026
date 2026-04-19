// ═══════════════════════════════════════════════════════════════════════
// Edge Function: omie-proxy (v3)
// ─────────────────────────────────────────────────────────────────────
// Proxy seguro entre o frontend Projetta e a API Omie.
// Credenciais OMIE_APP_KEY/OMIE_APP_SECRET ficam em env vars do Supabase.
//
// v3: whitelist expandida para permitir investigar qual método retorna
// o estoque correto (ListarPosEstoque estava retornando 0 mesmo com 11
// visíveis no portal Omie).
// ═══════════════════════════════════════════════════════════════════════

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Endpoints permitidos (apenas leitura de produtos/estoque/família)
const ALLOWED_ENDPOINTS = new Set([
  "geral/produtos",
  "estoque/consulta",
  "estoque/movestoque",
  "estoque/local",
  "geral/familias",
]);

// Calls permitidas (apenas leitura; nada de gravação/exclusão)
const ALLOWED_CALLS = new Set([
  // Produtos
  "ListarProdutos",
  "ConsultarProduto",
  "PesquisarProduto",
  // Estoque - múltiplos métodos pra investigar qual retorna o saldo correto
  "ListarPosEstoque",
  "ConsultarPosEstoque",
  "ListarTotalPosEstoque",
  "ObterEstoqueProduto",
  "ConsultarProdutoEstoque",
  "ConsultarPosicaoEstoqueFisico",
  "PosicaoEstoque",
  // Locais de estoque (pra ver se há múltiplos locais)
  "ListarLocalEstoque",
  "ListarEstLocal",
  "ConsultarLocalEstoque",
  // Movimentações (pra eventualmente calcular estoque via soma)
  "ListarMovimentos",
  "ListarMovEstoque",
  // Famílias
  "ListarFamilias",
]);

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, 405);
  }

  const appKey = Deno.env.get("OMIE_APP_KEY");
  const appSecret = Deno.env.get("OMIE_APP_SECRET");
  if (!appKey || !appSecret) {
    return jsonResponse({ error: "Omie credentials not configured" }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const { endpoint, call, param } = body || {};
  if (!endpoint || typeof endpoint !== "string") {
    return jsonResponse({ error: "missing 'endpoint' (string)" }, 400);
  }
  if (!call || typeof call !== "string") {
    return jsonResponse({ error: "missing 'call' (string)" }, 400);
  }
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return jsonResponse({ error: "endpoint not allowed", endpoint }, 403);
  }
  if (!ALLOWED_CALLS.has(call)) {
    return jsonResponse({ error: "call not allowed", call }, 403);
  }

  const omiePayload = {
    call,
    app_key: appKey,
    app_secret: appSecret,
    param: Array.isArray(param) ? param : [{}],
  };

  try {
    const omieRes = await fetch(`https://app.omie.com.br/api/v1/${endpoint}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(omiePayload),
    });

    const text = await omieRes.text();
    return new Response(text, {
      status: omieRes.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "fetch failed", detail: msg }, 500);
  }
});
