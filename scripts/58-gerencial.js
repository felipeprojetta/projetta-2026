/* ══════════════════════════════════════════════════════════════════
   MODULE: GERENCIAL DE FECHAMENTO  (Felipe sessao 37)
   ══════════════════════════════════════════════════════════════════

   O QUE FAZ
   ---------
   Traz a aba "CONSOLIDADO 2026" da planilha gerencial PRA DENTRO do
   sistema. Felipe importa o arquivo uma vez, o sistema guarda no
   Supabase e faz a conferencia contra o CRM sozinho — cruzando pelo
   ATP, que e' a chave real (a gerencial usa razao social de
   faturamento e o CRM o nome do cliente, entao cruzar por nome erra:
   ATP000444 "T. Marques Apoio Administrativo" = AGP004408 Bruno
   Henrique; ATP000458 "D&A Comercio de Vidros" = AGP004431 Resilience).

   POR QUE IMPORTAR EM VEZ DE LER DO SHAREPOINT
   --------------------------------------------
   A "02 - CONSOLIDADO GERAL.xlsx" nao pode ser lida por conversao de
   arquivo: o Graph tenta converter o xlsx INTEIRO (todos os anos,
   varias abas) e estoura com HTTP 406. Existe o caminho worksheet-level
   da Graph Excel API (lerAbaDoSharePoint abaixo), que le UMA aba sem
   tocar no resto — mas depende de permissao Files.Read.All com
   consentimento de admin. Enquanto isso nao existe, o fluxo oficial
   e' a IMPORTACAO do arquivo, que funciona hoje e nao depende de TI.

   CONFERENCIA — 4 BALDES
   ----------------------
     ok        ATP no CRM, etapa fechado, valor igual
     valor     ATP no CRM, etapa fechado, valor diferente
     etapa     ATP no CRM mas ainda nao esta em 'fechado'
     ausente   ATP nao existe no CRM (falta cadastrar)

   ISOLAMENTO (regra do Felipe)
   ----------------------------
     - IIFE proprio, prefixo CSS .ger-, CSS injetado pelo modulo
     - LE o CRM via Storage.scope('crm').get('leads') — leitura pura,
       NAO escreve em lead nenhum
     - Grava so' no proprio escopo Storage.scope('gerencial')
     - Nao altera 10-crm.js, 35-outlook.js nem os escopos do login
     - Botao injetado na toolbar do CRM via MutationObserver
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
  async function lerAbaDoSharePoint(nomeAba) {
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
    var bruto = await lerAbaDoSharePoint(aba);
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

  // ══════════════════════════════════════════════════════════════
  //  IMPORTACAO DO ARQUIVO  (fluxo oficial — funciona hoje)
  // ══════════════════════════════════════════════════════════════

  function _anoDe(pedidos, aba) {
    var m = String(aba || '').match(/(20\d{2})/);
    if (m) return m[1];
    return String(new Date().getFullYear());
  }

  /**
   * Importa o xlsx que o Felipe soltar. Le a PRIMEIRA aba do arquivo
   * (o recorte tem so' a CONSOLIDADO), parseia e grava no Supabase.
   */
  function importarArquivo(file, aoTerminar) {
    if (!window.Universal || !Universal.readXLSXFile) {
      alert('Leitor de planilha nao carregou. Recarregue a pagina.');
      return;
    }
    Universal.readXLSXFile(file, function (aoa, nomeArq) {
      var res = parsear(aoa);
      if (!res.pedidos.length) {
        alert('Nao encontrei pedidos nesse arquivo.\n\n'
          + (res.aviso || 'Confira se a aba tem uma coluna "ATP" e uma de "VALOR".'));
        return;
      }
      var ano = _anoDe(res.pedidos, nomeArq);
      var payload = {
        lidoEm: new Date().toISOString(),
        origem: 'importacao',
        arquivo: nomeArq,
        total: res.pedidos.reduce(function (s, p) { return s + p.valor; }, 0),
        pedidos: res.pedidos
      };
      try {
        if (window.Storage) Storage.scope('gerencial').set('consolidado_' + ano, payload);
      } catch (e) { console.warn('[gerencial] falha ao gravar:', e); }
      log('importado:', res.pedidos.length, 'pedidos de', nomeArq);
      if (res.aviso) console.warn('[gerencial] aviso:', res.aviso);
      if (typeof aoTerminar === 'function') aoTerminar(payload, res.aviso);
    });
  }

  /** Ultimo consolidado guardado (ou null). */
  function carregarSalvo(ano) {
    var a = ano || String(new Date().getFullYear());
    try { return (window.Storage && Storage.scope('gerencial').get('consolidado_' + a)) || null; }
    catch (_) { return null; }
  }

  // ══════════════════════════════════════════════════════════════
  //  CONFERENCIA POR ATP  (leitura pura do CRM)
  // ══════════════════════════════════════════════════════════════

  function _leads() {
    try { return (window.Storage && Storage.scope('crm').get('leads')) || []; }
    catch (_) { return []; }
  }
  function _c2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

  /**
   * Cruza os pedidos da gerencial com o CRM PELO ATP.
   * Retorna os 4 baldes + os leads fechados no CRM que a gerencial nao tem.
   */
  function conferir(payload) {
    var dados = payload || carregarSalvo();
    if (!dados || !dados.pedidos) return null;

    var porAtp = {};
    _leads().forEach(function (l) {
      var a = l && l.atp && l.atp.numeroAtp;
      if (a) porAtp[String(a).trim().toUpperCase()] = l;
    });

    var ok = [], valor = [], etapa = [], ausente = [];
    dados.pedidos.forEach(function (p) {
      var l = porAtp[p.atp];
      if (!l) { ausente.push({ p: p }); return; }
      var vCrm = _c2(l.valor), dif = _c2(vCrm - p.valor);
      var reg = { p: p, lead: l, vCrm: vCrm, dif: dif };
      if (l.etapa !== 'fechado') etapa.push(reg);
      else if (dif !== 0) valor.push(reg);
      else ok.push(reg);
    });

    // Fechado no CRM que a gerencial nao lista
    var naGerencial = {};
    dados.pedidos.forEach(function (p) { naGerencial[p.atp] = true; });
    var soNoCrm = _leads().filter(function (l) {
      if (!l || l.etapa !== 'fechado') return false;
      var a = l.atp && l.atp.numeroAtp;
      return !a || !naGerencial[String(a).trim().toUpperCase()];
    });

    return {
      dados: dados, ok: ok, valor: valor, etapa: etapa,
      ausente: ausente, soNoCrm: soNoCrm,
      totalGerencial: _c2(dados.total)
    };
  }

  // ══════════════════════════════════════════════════════════════
  //  PAINEL
  // ══════════════════════════════════════════════════════════════

  var CSS_ID = 'ger-css';
  function _css() {
    if (document.getElementById(CSS_ID)) return;
    var st = document.createElement('style');
    st.id = CSS_ID;
    st.textContent = [
      '.ger-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;}',
      '.ger-box{background:#fff;border-radius:10px;max-width:1180px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);}',
      '.ger-hd{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e5e7eb;}',
      '.ger-hd h3{margin:0;font-size:16px;flex:1;color:#0f172a;}',
      '.ger-x{border:none;background:none;font-size:22px;cursor:pointer;color:#64748b;line-height:1;}',
      '.ger-bd{padding:16px 18px;overflow:auto;}',
      '.ger-drop{border:2px dashed #cbd5e1;border-radius:8px;padding:22px;text-align:center;color:#475569;font-size:13px;background:#f8fafc;cursor:pointer;}',
      '.ger-drop.is-over{border-color:#3b82f6;background:#eff6ff;}',
      '.ger-kpis{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0;}',
      '.ger-kpi{flex:1;min-width:150px;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;}',
      '.ger-kpi b{display:block;font-size:20px;line-height:1.2;}',
      '.ger-kpi span{font-size:11px;color:#64748b;}',
      '.ger-k-ok b{color:#15803d;} .ger-k-val b{color:#b45309;}',
      '.ger-k-et b{color:#b91c1c;} .ger-k-aus b{color:#7c3aed;}',
      '.ger-sec{margin-top:16px;}',
      '.ger-sec h4{margin:0 0 6px;font-size:13px;color:#0f172a;}',
      '.ger-tb{width:100%;border-collapse:collapse;font-size:12px;}',
      '.ger-tb th{text-align:left;background:#f1f5f9;padding:6px 8px;font-weight:600;color:#334155;border-bottom:1px solid #e2e8f0;}',
      '.ger-tb td{padding:5px 8px;border-bottom:1px solid #f1f5f9;}',
      '.ger-tb td.num{text-align:right;font-variant-numeric:tabular-nums;}',
      '.ger-neg{color:#b91c1c;} .ger-pos{color:#15803d;}',
      '.ger-vazio{color:#64748b;font-size:12px;padding:8px 0;}',
      '.ger-bar{display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;}',
      '.ger-btn{border:1px solid #cbd5e1;background:#fff;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;}',
      '.ger-btn:hover{background:#f8fafc;}',
      '.ger-info{font-size:11px;color:#64748b;}'
    ].join('');
    document.head.appendChild(st);
  }

  function _fmt(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _tabela(titulo, linhas, colunas) {
    if (!linhas.length) return '';
    return '<div class="ger-sec"><h4>' + titulo + ' (' + linhas.length + ')</h4>'
      + '<table class="ger-tb"><thead><tr>'
      + colunas.map(function (c) { return '<th>' + c.t + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + linhas.map(function (r) {
          return '<tr>' + colunas.map(function (c) {
            return '<td' + (c.num ? ' class="num ' + (c.cls ? c.cls(r) : '') + '"' : '') + '>'
              + c.v(r) + '</td>';
          }).join('') + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function _render(box, conf) {
    var bd = box.querySelector('.ger-bd');
    if (!conf) {
      bd.innerHTML = _dropHtml() + '<p class="ger-vazio">Nenhuma gerencial importada ainda.</p>';
      _ligarDrop(box);
      return;
    }
    var d = conf.dados;
    var somaOk = conf.ok.reduce(function (s, r) { return s + r.p.valor; }, 0);
    bd.innerHTML = _dropHtml()
      + '<div class="ger-info" style="margin-top:8px;">Origem: ' + _esc(d.arquivo || '-')
      + ' &middot; importado em ' + new Date(d.lidoEm).toLocaleString('pt-BR')
      + ' &middot; <b>' + d.pedidos.length + ' pedidos</b> &middot; total R$ ' + _fmt(d.total) + '</div>'
      + '<div class="ger-kpis">'
      + '<div class="ger-kpi ger-k-ok"><b>' + conf.ok.length + '</b><span>batem exato<br>R$ ' + _fmt(somaOk) + '</span></div>'
      + '<div class="ger-kpi ger-k-val"><b>' + conf.valor.length + '</b><span>valor diferente</span></div>'
      + '<div class="ger-kpi ger-k-et"><b>' + conf.etapa.length + '</b><span>nao esta em Fechado</span></div>'
      + '<div class="ger-kpi ger-k-aus"><b>' + conf.ausente.length + '</b><span>nao existe no CRM</span></div>'
      + '</div>'
      + _tabela('⚠️ Valor diferente', conf.valor, [
          { t: 'ATP', v: function (r) { return _esc(r.p.atp); } },
          { t: 'AGP', v: function (r) { return _esc(r.lead.numeroAGP || ''); } },
          { t: 'Cliente (CRM)', v: function (r) { return _esc(r.lead.cliente || ''); } },
          { t: 'Gerencial', num: 1, v: function (r) { return _fmt(r.p.valor); } },
          { t: 'CRM', num: 1, v: function (r) { return _fmt(r.vCrm); } },
          { t: 'Dif', num: 1, cls: function (r) { return r.dif < 0 ? 'ger-neg' : 'ger-pos'; },
            v: function (r) { return _fmt(r.dif); } }
        ])
      + _tabela('🔴 Fechado na gerencial, mas nao em Fechado no CRM', conf.etapa, [
          { t: 'ATP', v: function (r) { return _esc(r.p.atp); } },
          { t: 'AGP', v: function (r) { return _esc(r.lead.numeroAGP || ''); } },
          { t: 'Cliente (CRM)', v: function (r) { return _esc(r.lead.cliente || ''); } },
          { t: 'Etapa atual', v: function (r) { return _esc(r.lead.etapa); } },
          { t: 'Gerencial', num: 1, v: function (r) { return _fmt(r.p.valor); } },
          { t: 'CRM', num: 1, v: function (r) { return _fmt(r.vCrm); } }
        ])
      + _tabela('🆕 Nao existe no CRM — cadastrar', conf.ausente, [
          { t: 'ATP', v: function (r) { return _esc(r.p.atp); } },
          { t: 'Canal', v: function (r) { return _esc(r.p.canal); } },
          { t: 'Mes', v: function (r) { return _esc(r.p.mes || ''); } },
          { t: 'Cliente (gerencial)', v: function (r) { return _esc(r.p.cliente); } },
          { t: 'Cidade/UF', v: function (r) { return _esc([r.p.cidade, r.p.uf].filter(Boolean).join(' / ')); } },
          { t: 'Valor', num: 1, v: function (r) { return _fmt(r.p.valor); } }
        ])
      + _tabela('ℹ️ Fechado no CRM mas fora da gerencial', conf.soNoCrm.map(function (l) { return { lead: l }; }), [
          { t: 'AGP', v: function (r) { return _esc(r.lead.numeroAGP || ''); } },
          { t: 'Cliente', v: function (r) { return _esc(r.lead.cliente || ''); } },
          { t: 'ATP', v: function (r) { return _esc((r.lead.atp && r.lead.atp.numeroAtp) || '(sem ATP)'); } },
          { t: 'Fechado em', v: function (r) { return _esc(r.lead.fechadoEm || ''); } },
          { t: 'Valor', num: 1, v: function (r) { return _fmt(r.lead.valor); } }
        ])
      + (conf.valor.length + conf.etapa.length + conf.ausente.length === 0
          ? '<p class="ger-vazio">✅ Gerencial e CRM batem em todos os ATPs.</p>' : '');
    _ligarDrop(box);
  }

  function _dropHtml() {
    return '<div class="ger-bar">'
      + '<button class="ger-btn" data-ger="escolher">📂 Importar planilha gerencial</button>'
      + '<button class="ger-btn" data-ger="excel">⬇️ Exportar divergencias</button>'
      + '<span class="ger-info">Arraste o arquivo aqui ou clique em Importar. Le a 1ª aba do arquivo.</span>'
      + '</div>'
      + '<div class="ger-drop" data-ger="drop">Solte aqui o recorte da aba CONSOLIDADO</div>'
      + '<input type="file" accept=".xlsx,.xls,.csv" style="display:none" data-ger="input" />';
  }

  function _ligarDrop(box) {
    var inp = box.querySelector('[data-ger="input"]');
    var drop = box.querySelector('[data-ger="drop"]');
    box.querySelector('[data-ger="escolher"]').onclick = function () { inp.click(); };
    box.querySelector('[data-ger="excel"]').onclick = function () { exportarDivergencias(); };
    inp.onchange = function () {
      if (inp.files && inp.files[0]) {
        importarArquivo(inp.files[0], function () { _render(box, conferir()); });
      }
    };
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) importarArquivo(f, function () { _render(box, conferir()); });
    });
    drop.addEventListener('click', function () { inp.click(); });
  }

  function abrir() {
    _css();
    var ov = document.createElement('div');
    ov.className = 'ger-ov';
    ov.innerHTML = '<div class="ger-box">'
      + '<div class="ger-hd"><h3>📊 Gerencial de Fechamento &times; CRM <span class="ger-info">(cruzamento pelo ATP)</span></h3>'
      + '<button class="ger-x" title="Fechar">&times;</button></div>'
      + '<div class="ger-bd"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ger-x').onclick = function () { ov.remove(); };
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    _render(ov.querySelector('.ger-box'), conferir());
  }

  /** Excel com as divergencias, pra mandar pro financeiro. */
  function exportarDivergencias() {
    var c = conferir();
    if (!c) { alert('Importe a gerencial primeiro.'); return; }
    if (!window.Universal || !Universal.exportXLSX) { alert('Exportador nao carregou.'); return; }
    var rows = [];
    c.valor.forEach(function (r) {
      rows.push(['VALOR DIFERENTE', r.p.atp, r.lead.numeroAGP || '', r.lead.cliente || '',
                 r.p.canal, r.p.mes || '', r.p.valor, r.vCrm, r.dif]);
    });
    c.etapa.forEach(function (r) {
      rows.push(['NAO ESTA FECHADO (' + r.lead.etapa + ')', r.p.atp, r.lead.numeroAGP || '',
                 r.lead.cliente || '', r.p.canal, r.p.mes || '', r.p.valor, r.vCrm, r.dif]);
    });
    c.ausente.forEach(function (r) {
      rows.push(['NAO EXISTE NO CRM', r.p.atp, '', r.p.cliente, r.p.canal, r.p.mes || '',
                 r.p.valor, '', '']);
    });
    c.soNoCrm.forEach(function (l) {
      rows.push(['SO NO CRM', (l.atp && l.atp.numeroAtp) || '', l.numeroAGP || '', l.cliente || '',
                 '', '', '', _c2(l.valor), '']);
    });
    if (!rows.length) { alert('Nenhuma divergencia — gerencial e CRM batem.'); return; }
    Universal.exportXLSX({
      headers: ['Situacao', 'ATP', 'AGP', 'Cliente', 'Canal', 'Mes', 'Valor gerencial', 'Valor CRM', 'Diferenca'],
      rows: rows,
      sheetName: 'Divergencias',
      fileName: 'projetta_gerencial_x_crm'
    });
  }

  // ─── Botao na toolbar do CRM (sem editar 10-crm.js) ───
  function _injetarBotao(escopo) {
    if (!escopo || !escopo.querySelectorAll) return;
    escopo.querySelectorAll('#crm-btn-relatorio-fechamentos:not(.ger-ok)').forEach(function (ref) {
      ref.classList.add('ger-ok');
      var b = document.createElement('button');
      b.className = 'btn btn-ghost btn-sm';
      b.id = 'ger-btn-abrir';
      b.title = 'Compara a planilha gerencial de fechamento com o CRM, cruzando pelo numero do ATP.';
      b.textContent = '📊 Gerencial x CRM';
      b.onclick = function (e) { e.preventDefault(); abrir(); };
      ref.parentNode.insertBefore(b, ref.nextSibling);
    });
  }
  try {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        [].forEach.call(m.addedNodes || [], function (n) {
          if (n.nodeType === 1) _injetarBotao(n);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
    _injetarBotao(document);
  } catch (e) { console.warn('[gerencial] observer falhou', e); }

  // ─── API publica ───
  window.Gerencial = {
    ALVO: ALVO,
    abrir: abrir,
    importarArquivo: importarArquivo,
    carregarSalvo: carregarSalvo,
    parsear: parsear,
    conferir: conferir,
    exportarDivergencias: exportarDivergencias,
    // caminho secundario: ler direto do SharePoint (precisa Files.Read.All)
    autorizar: autorizar,
    estaAutorizado: estaAutorizado,
    lerAbaDoSharePoint: lerAbaDoSharePoint,
    sincronizar: sincronizar,
    explicarErro: explicarErro
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
