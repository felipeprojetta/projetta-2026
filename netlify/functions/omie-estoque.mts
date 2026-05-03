import type { Config } from "@netlify/functions";

export default async (req: Request) => {
  const appKey = Netlify.env.get("OMIE_APP_KEY");
  const appSecret = Netlify.env.get("OMIE_APP_SECRET");

  if (!appKey || !appSecret) {
    return new Response(JSON.stringify({ error: "Credenciais Omie nao configuradas" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const action = body.action || "produtos"; // produtos | posicao | consulta
    const pagina = body.pagina || 1;
    const registros = body.registros || 50;
    const filtro = body.filtro || {};

    let endpoint = "";
    let call = "";
    let param: any = {};

    switch (action) {
      case "produtos":
        endpoint = "https://app.omie.com.br/api/v1/geral/produtos/";
        call = "ListarProdutos";
        param = {
          pagina,
          registros_por_pagina: registros,
          apenas_importado_api: "N",
          ...filtro
        };
        break;

      case "posicao":
        endpoint = "https://app.omie.com.br/api/v1/estoque/posicao/";
        call = "ListarPosEstoque";
        param = {
          nPagina: pagina,
          nRegPorPagina: registros,
          ...filtro
        };
        break;

      case "consulta":
        endpoint = "https://app.omie.com.br/api/v1/estoque/consulta/";
        call = "ListarEstoqueProduto" ;
        param = {
          nPagina: pagina,
          nRegPorPagina: registros,
          ...filtro
        };
        break;

      default:
        return new Response(JSON.stringify({ error: "action invalida: " + action }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
    }

    const omieBody = {
      call,
      app_key: appKey,
      app_secret: appSecret,
      param: [param]
    };

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(omieBody)
    });

    const data = await resp.json();

    return new Response(JSON.stringify(data), {
      status: resp.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config: Config = {
  path: "/api/omie-estoque"
};
