/* ══════════════════════════════════════════════════════════════════
   MODULE: GERENCIAL VIA GRAPH EXCEL API  (Felipe sessao 37)
   ══════════════════════════════════════════════════════════════════

   PROBLEMA QUE RESOLVE
   --------------------
   A planilha gerencial "02 - CONSOLIDADO GERAL.xlsx" (SharePoint
   Projetta/FINANCEIRO) NAO pode ser lida por conversao de arquivo:
   o Graph tenta converter o xlsx INTEIRO em texto e estoura (HTTP 406,
   "couldn't convert this file for text extraction"). Testado 4x.

   A saida e' a Graph EXCEL API, que le UMA ABA por vez, celula a
   celula, sem tocar no resto do arquivo:

     GET /drives/{driveId}/items/{itemId}/workbook/worksheets('NOME')/usedRange

   Tamanho do arquivo vira irrelevante. E' exatamente o "abre a planilha,
   vai na aba, le" que o Felipe pediu.

   ISOLAMENTO (regra do Felipe)
   ----------------------------
   Este modulo NAO altera nenhum arquivo existente. Em especial NAO
   mexe em 35-outlook.js nem nos escopos do login atual.

   Por que isso importa: o login de hoje pede Mail.Read/Mail.Send. Se
   'Files.Read.All' fosse adicionado naquela lista e o tenant exigisse
   consentimento de admin, o login INTEIRO passaria a falhar e a
   integracao de e-mail (que funciona) quebraria junto.

   Solucao: CONSENTIMENTO INCREMENTAL. Este modulo tem seu proprio
   fluxo OAuth/PKCE, pedindo SO 'Files.Read.All', e guarda o token em
   chaves proprias. Se o admin nao liberou, falha SO esta funcao —
   o resto do sistema segue intacto.

   COMO LIGAR (uma vez, com o John / TI Weiku)
   ------------------------------------------
   No app registration 191085ef-bfc2-4839-be61-fe1025e2361f, adicionar
   a permissao DELEGADA 'Files.Read.All' (Microsoft Graph) e conceder
   consentimento de admin. Nada mais muda.

   DEPOIS DE LER
   -------------
   As linhas parseadas vao pro Supabase em
   Storage.scope('gerencial').set('consolidado_<ano>', ...), de onde
   qualquer um (inclusive o Claude, via MCP) le sem precisar de upload.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── Config do arquivo alvo (SharePoint Projetta/FINANCEIRO) ───
  var ALVO = {
    driveId: 'b!n2csAwF7vUySAn2lK-SE-rp0Pk7uNDZHgXEJvXcghs_XokiVX3wJQYe54Ii72tld',
    itemId:  '01Z4HRBTNXESKY4PRMX5BZJBO7IF2SZRB2',
    aba:     'CONSOLIDADO 2026',
    nomeArquivo: '02 - CONSOLIDADO GERAL.xlsx'
  };

  // Mesmo app do Outlook, mas pedindo SO o escopo de arquivo.
  var AZ = {
    clientId: '191085ef-bfc2-4839-be61-fe1025e2361f',
    authority: 'https://login.microsoftonline.com/9b354185-3cb6-48e1-93df-850a0810bf3a',
    redirectUri: window.location.origin,
    scopes: ['Files.Read.All', 'offline_access']
  };

  // Chaves PROPRIAS — nao colidem com as do 35-outlook.js.
  var LS_TOKEN   = 'projetta_graphfiles_access_token';
  var LS_REFRESH = 'projetta_graphfiles_refresh_token';
  var LS_EXPIRES = 'projetta_graphfiles_expires';
  var SS_VERIFIER = 'projetta_graphfiles_pkce';
  var SS_STATE    = 'projetta_graphfiles_state';
  var SS_RETORNO  = 'projetta_graphfiles_retorno';

  function log() {
    var a = ['[gerencial-graph]'].concat([].slice.call(arguments));
    console.log.apply(console, a);
  }

  // ─── PKCE ───
  function _rand(n) {
    var b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode.apply(null, b))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function _sha256b64url(s) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /* Dispara o consentimento incremental. Volta pra mesma pagina. */
  async function autorizar() {
    var verifier = _rand(64);
    var challenge = await _sha256b64url(verifier);
    var state = _rand(16);
    sessionStorage.setItem(SS_VERIFIER, verifier);
    sessionStorage.setItem(SS_STATE, state);
    // Guarda onde estava pra voltar depois do redirect.
    try { sessionStorage.setItem(SS_RETORNO, location.hash || ''); } catch (_) {}

    var url = AZ.authority + '/oauth2/v2.0/authorize?'
      + 'client_id=' + encodeURIComponent(AZ.clientId)
      + '&response_type=code'
      + '&redirect_uri=' + encodeURIComponent(AZ.redirectUri)
      + '&response_mode=query'
      + '&scope=' + encodeURIComponent(AZ.scopes.join(' '))
      + '&state=' + encodeURIComponent(state)
      + '&code_challenge=' + encodeURIComponent(challenge)
      + '&code_challenge_method=S256'
      + '&prompt=consent';
    log('redirecionando pra consentimento Files.Read.All...');
    window.location.href = url;
  }

  /* Troca o code por token. Chamado no boot quando volta o ?code=. */
  async function _trocarCodePorToken(code, verifier) {
    var body = new URLSearchParams({
      client_id: AZ.clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: AZ.redirectUri,
      code_verifier: verifier,
      scope: AZ.scopes.join(' ')
    });
    var r = await fetch(AZ.authority + '/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });
    if (!r.ok) throw new Error('Token ' + r.status + ': ' + (await r.text()));
    var t = await r.json();
    _salvar(t);
    return t.access_token;
  }

  function _salvar(t) {
    if (t.access_token)  localStorage.setItem(LS_TOKEN, t.access_token);
    if (t.refresh_token) localStorage.setItem(LS_REFRESH, t.refresh_token);
    if (t.expires_in) {
      localStorage.setItem(LS_EXPIRES, String(Date.now() + t.expires_in * 1000));
    }
  }

  async function _refresh() {
    var rt = localStorage.getItem(LS_REFRESH);
    if (!rt) throw new Error('sem refresh token');
    var body = new URLSearchParams({
      client_id: AZ.clientId,
      grant_type: 'refresh_token',
      refresh_token: rt,
      scope: AZ.scopes.join(' ')
    });
    var r = await fetch(AZ.authority + '/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });
    if (!r.ok) throw new Error('refresh falhou: ' + r.status);
    var t = await r.json();
    _salvar(t);
    return t.access_token;
  }

  /* Token valido, ou null se ainda nao autorizou. */
  async function _token() {
    var tk = localStorage.getItem(LS_TOKEN);
    var exp = parseInt(localStorage.getItem(LS_EXPIRES) || '0', 10);
    if (!tk) return null;
    if (exp - Date.now() < 2 * 60 * 1000) {
      try { tk = await _refresh(); }
      catch (e) { log('refresh falhou, precisa reautorizar', e); return null; }
    }
    return tk;
  }

  function estaAutorizado() { return !!localStorage.getItem(LS_TOKEN); }

  /* Processa o retorno do consentimento. Idempotente. */
  async function _callback() {
    var p = new URLSearchParams(location.search);
    var code = p.get('code');
    var state = p.get('state');
    var esperado = sessionStorage.getItem(SS_STATE);
    // So' trata se o state for O NOSSO — senao e' callback do Outlook.
    if (!code || !state || !esperado || state !== esperado) return;
    var verifier = sessionStorage.getItem(SS_VERIFIER);
    if (!verifier) return;
    sessionStorage.removeItem(SS_STATE);
    sessionStorage.removeItem(SS_VERIFIER);
    try {
      await _trocarCodePorToken(code, verifier);
      log('autorizado com sucesso');
      history.replaceState({}, document.title, location.pathname);
      var volta = sessionStorage.getItem(SS_RETORNO) || '';
      sessionStorage.removeItem(SS_RETORNO);
      if (volta) location.hash = volta;
    } catch (e) {
      console.error('[gerencial-graph] callback falhou', e);
      alert('Falha ao autorizar leitura de arquivos:\n' + e.message);
    }
  }

  // ─── Leitura da aba ───

  /**
   * Le a aba pedida do arquivo alvo via Graph EXCEL API (worksheet-level).
   * Retorna array de arrays (linhas x colunas) com os valores.
   */
  async function lerAba(nomeAba) {
    var aba = nomeAba || ALVO.aba;
    var tk = await _token();
    if (!tk) {
      var e = new Error('SEM_AUTORIZACAO');
      e.precisaAutorizar = true;
      throw e;
    }
    var path = 'https://graph.microsoft.com/v1.0'
      + '/drives/' + ALVO.driveId
      + '/items/' + ALVO.itemId
      + "/workbook/worksheets('" + encodeURIComponent(aba) + "')/usedRange"
      + '?$select=values,address,rowCount,columnCount';

    var r = await fetch(path, { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) {
      var txt = await r.text();
      if (r.status === 401 || r.status === 403) {
        var er = new Error('SEM_PERMISSAO');
        er.precisaAdmin = true;
        er.detalhe = txt;
        throw er;
      }
      if (r.status === 404) {
        throw new Error('Aba "' + aba + '" nao encontrada em ' + ALVO.nomeArquivo
          + '.\nConfira o nome exato da aba.');
      }
      throw new Error('Graph ' + r.status + ': ' + txt);
    }
    var j = await r.json();
    log('aba "' + aba + '" lida:', j.rowCount, 'linhas x', j.columnCount, 'colunas', j.address);
    return { valores: j.values || [], endereco: j.address, linhas: j.rowCount, colunas: j.columnCount };
  }

  // ─── Parse da gerencial ───

  var MESES = ['JANEIRO','FEVEREIRO','MARCO','MARÇO','ABRIL','MAIO','JUNHO',
               'JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];

  function _sd(s) {
    return String(s == null ? '' : s)
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().trim();
  }
  function _num(v) {
    if (typeof v === 'number') return Math.round(v * 100) / 100;
    var s = String(v == null ? '' : v).replace(/[R$\s.]/g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  /**
   * Converte a matriz crua da aba em registros de pedido fechado.
   * Detecta as colunas pelo cabecalho, entao nao quebra se a planilha
   * ganhar/perder coluna no meio.
   */
  function parsear(valores) {
    if (!valores || !valores.length) return { pedidos: [], aviso: 'aba vazia' };

    // Acha a linha de cabecalho (a que tem ATP e VALOR)
    var hdrIdx = -1, col = {};
    for (var i = 0; i < Math.min(valores.length, 30); i++) {
      var linha = valores[i].map(_sd);
      var iAtp = linha.indexOf('ATP');
      if (iAtp === -1) continue;
      hdrIdx = i;
      col.atp = iAtp;
      linha.forEach(function (c, idx) {
        if (/VALOR/.test(c))  col.valor  = idx;
        if (/STATUS/.test(c)) col.status = idx;
        if (/CIDADE/.test(c)) col.cidade = idx;
        if (/ESTADO|^UF$/.test(c)) col.uf = idx;
      });
      break;
    }
    if (hdrIdx === -1) return { pedidos: [], aviso: 'cabecalho com coluna ATP nao encontrado' };
    // cliente = coluna 0 por convencao; canal = a coluna entre ATP e STATUS
    if (col.cliente == null) col.cliente = 0;
    if (col.canal == null)   col.canal = col.atp + 1;

    var pedidos = [], mes = null, avisos = [];
    for (var r = hdrIdx; r < valores.length; r++) {
      var lin = valores[r];
      var a0 = _sd(lin[col.cliente]);
      if (MESES.indexOf(a0) !== -1) { mes = a0; continue; }
      var atp = String(lin[col.atp] == null ? '' : lin[col.atp]).trim();
      if (!/^ATP\d+/i.test(atp)) continue;   // pula subtotais e linhas vazias
      pedidos.push({
        mes: mes,
        cliente: String(lin[col.cliente] || '').trim(),
        atp: atp.toUpperCase(),
        canal: _sd(lin[col.canal]),
        status: _sd(lin[col.status]),
        cidade: String(lin[col.cidade] || '').trim(),
        uf: String(lin[col.uf] || '').trim(),
        valor: _num(lin[col.valor])
      });
    }
    // ATP duplicado e' erro de digitacao na planilha - avisa, nao esconde
    var vistos = {};
    pedidos.forEach(function (p) {
      if (vistos[p.atp]) avisos.push('ATP duplicado na planilha: ' + p.atp);
      vistos[p.atp] = true;
    });
    return { pedidos: pedidos, aviso: avisos.join(' | ') || null, colunas: col };
  }

  /**
   * Le a aba, parseia e grava no Supabase pra ficar disponivel offline
   * e pra conferencia externa. Retorna os pedidos.
   */
  async function sincronizar(nomeAba) {
    var aba = nomeAba || ALVO.aba;
    var bruto = await lerAba(aba);
    var res = parsear(bruto.valores);
    if (!res.pedidos.length) {
      throw new Error('Nenhum pedido lido da aba "' + aba + '". ' + (res.aviso || ''));
    }
    var ano = (aba.match(/(20\d{2})/) || [])[1] || String(new Date().getFullYear());
    var payload = {
      lidoEm: new Date().toISOString(),
      arquivo: ALVO.nomeArquivo,
      aba: aba,
      endereco: bruto.endereco,
      total: res.pedidos.reduce(function (s, p) { return s + p.valor; }, 0),
      pedidos: res.pedidos
    };
    try {
      if (window.Storage) Storage.scope('gerencial').set('consolidado_' + ano, payload);
    } catch (e) {
      console.warn('[gerencial-graph] falha ao gravar no storage:', e);
    }
    log('sincronizado:', res.pedidos.length, 'pedidos, total R$', payload.total.toFixed(2));
    return payload;
  }

  /* Mensagem de erro util em vez de stack trace. */
  function explicarErro(e) {
    if (e && e.precisaAutorizar) {
      return 'Ainda nao autorizado a ler arquivos do SharePoint.\n\n'
        + 'Clique de novo pra abrir o consentimento da Microsoft.';
    }
    if (e && e.precisaAdmin) {
      return 'A Microsoft recusou a leitura do arquivo (permissao insuficiente).\n\n'
        + 'Peca ao John (TI Weiku) pra adicionar a permissao DELEGADA\n'
        + '"Files.Read.All" (Microsoft Graph) no app\n'
        + '191085ef-bfc2-4839-be61-fe1025e2361f e conceder consentimento\n'
        + 'de admin. Depois disso e' + "'" + ' so' + "'" + ' clicar aqui de novo.';
    }
    return (e && e.message) ? e.message : String(e);
  }

  // ─── API publica ───
  window.GerencialGraph = {
    ALVO: ALVO,
    autorizar: autorizar,
    estaAutorizado: estaAutorizado,
    lerAba: lerAba,
    parsear: parsear,
    sincronizar: sincronizar,
    explicarErro: explicarErro,
    /* Atalho de console: GerencialGraph.testar() */
    testar: async function (aba) {
      try {
        var p = await sincronizar(aba);
        console.table(p.pedidos);
        console.log('TOTAL R$', p.total.toFixed(2), '|', p.pedidos.length, 'pedidos');
        return p;
      } catch (e) {
        if (e && e.precisaAutorizar) { await autorizar(); return; }
        alert(explicarErro(e));
        throw e;
      }
    }
  };

  // Processa retorno do consentimento no boot (so' se o state for nosso)
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(_callback, 300);
  });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_callback, 300);
  }

  log('modulo carregado. Alvo:', ALVO.nomeArquivo, '/ aba', ALVO.aba);
})();
/* ══ END MODULE: GERENCIAL VIA GRAPH ══ */
