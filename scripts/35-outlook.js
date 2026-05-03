/* ══════════════════════════════════════════════════════════════════════════
   MODULE: OUTLOOK INTEGRATION (Microsoft Graph API)
   ═══════════════════════════════════════════════════════════════════════════

   Felipe 21/04/2026: integracao com Outlook via Graph API.
   Conta: vendas01@projettaaluminio.com (tenant Weiku do Brasil).

   ARQUITETURA:
   - Azure App Registration (SPA / PKCE, sem client secret)
   - OAuth 2.0 Authorization Code Flow com PKCE (via MSAL.js)
   - Token refresh automatico (scope offline_access)
   - localStorage pra persistir tokens entre sessoes

   PERMISSOES GRAPH (delegadas):
   - Mail.Read       → listar inbox
   - Mail.ReadWrite  → criar rascunhos, responder
   - Mail.Send       → enviar emails
   - offline_access  → refresh tokens
   - User.Read       → dados do usuario logado

   INTERFACE:
   - window.outlookLogin()    → inicia fluxo OAuth
   - window.outlookLogout()   → limpa tokens
   - window.outlookIsAuth()   → true/false
   - window.outlookListInbox(opts) → promise<Array<email>>
   - window.outlookSendMail(params) → promise
   - window.outlookReplyAll(msgId, body, attachments) → promise

   UI:
   - Aba "📧 Email" com lista de emails + busca
   - Botao "📧 Enviar por Email" nos orcamentos (fase 2)
   ══════════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  // ═══ CONFIG AZURE APP REGISTRATION ═══
  var AZURE_CONFIG = {
    clientId: '191085ef-bfc2-4839-be61-fe1025e2361f',
    tenantId: '9b354185-3cb6-48e1-93df-850a0810bf3a',
    authority: 'https://login.microsoftonline.com/9b354185-3cb6-48e1-93df-850a0810bf3a',
    redirectUri: window.location.origin,  // https://projetta-2026.netlify.app ou localhost
    scopes: [
      'User.Read',
      'Mail.Read',
      'Mail.ReadWrite',
      'Mail.Send',
      'offline_access'
    ]
  };

  // ═══ STORAGE KEYS ═══
  var LS_TOKEN       = 'projetta_outlook_access_token';
  var LS_REFRESH     = 'projetta_outlook_refresh_token';
  var LS_EXPIRES     = 'projetta_outlook_expires_at';   // unix ms
  var LS_USER        = 'projetta_outlook_user';
  var LS_PKCE_VERIFIER = 'projetta_outlook_pkce_verifier';
  var LS_STATE       = 'projetta_outlook_oauth_state';

  // ═══ HELPERS ═══

  function _log(msg, obj){
    console.log('[outlook]', msg, obj||'');
  }
  function _err(msg, obj){
    console.error('[outlook] ERRO:', msg, obj||'');
  }

  /* Gera string aleatoria base64-url-safe (PKCE verifier). */
  function _randomBase64url(len){
    var bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    var b = '';
    for(var i=0; i<bytes.length; i++) b += String.fromCharCode(bytes[i]);
    return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  /* SHA-256 em base64-url-safe (PKCE challenge). */
  function _sha256b64url(str){
    var bytes = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', bytes).then(function(buf){
      var arr = new Uint8Array(buf);
      var b = '';
      for(var i=0; i<arr.length; i++) b += String.fromCharCode(arr[i]);
      return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    });
  }

  // ═══ AUTENTICACAO ═══

  /* Verifica se temos token valido em localStorage. */
  window.outlookIsAuth = function(){
    var token = localStorage.getItem(LS_TOKEN);
    var expires = parseInt(localStorage.getItem(LS_EXPIRES)||'0');
    if(!token) return false;
    // Renova se falta menos de 2 min pra expirar (faz no proximo call)
    return expires > Date.now();
  };

  /* Inicia OAuth flow: redireciona pra login Microsoft. */
  window.outlookLogin = async function(){
    try {
      // Gerar PKCE verifier + challenge
      var verifier = _randomBase64url(64);
      var challenge = await _sha256b64url(verifier);
      var state = _randomBase64url(16);

      // Salvar pra usar no callback
      localStorage.setItem(LS_PKCE_VERIFIER, verifier);
      localStorage.setItem(LS_STATE, state);

      // Construir URL de autorizacao
      var authUrl = AZURE_CONFIG.authority + '/oauth2/v2.0/authorize?'
        + 'client_id=' + encodeURIComponent(AZURE_CONFIG.clientId)
        + '&response_type=code'
        + '&redirect_uri=' + encodeURIComponent(AZURE_CONFIG.redirectUri)
        + '&response_mode=query'
        + '&scope=' + encodeURIComponent(AZURE_CONFIG.scopes.join(' '))
        + '&state=' + encodeURIComponent(state)
        + '&code_challenge=' + encodeURIComponent(challenge)
        + '&code_challenge_method=S256'
        + '&prompt=select_account';

      _log('Redirecionando pra login Microsoft...');
      window.location.href = authUrl;
    } catch(e){
      _err('outlookLogin failed', e);
      alert('Erro ao iniciar login: ' + e.message);
    }
  };

  /* Processa callback do OAuth (chamado no load se houver ?code= na URL). */
  async function _handleAuthCallback(){
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code');
    var state = params.get('state');
    var error = params.get('error');
    var errorDesc = params.get('error_description');

    if(error){
      _err('OAuth error: ' + error, errorDesc);
      alert('Erro de autenticacao Microsoft:\n' + (errorDesc||error));
      // Limpar URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if(!code) return; // Nao e callback

    // Validar state
    var savedState = localStorage.getItem(LS_STATE);
    if(state !== savedState){
      _err('State mismatch', {received: state, saved: savedState});
      alert('Erro de seguranca: state mismatch. Tente fazer login novamente.');
      return;
    }

    var verifier = localStorage.getItem(LS_PKCE_VERIFIER);
    if(!verifier){
      _err('PKCE verifier ausente');
      alert('Erro: PKCE verifier perdido. Tente novamente.');
      return;
    }

    try {
      _log('Trocando code por tokens...');
      var resp = await fetch(AZURE_CONFIG.authority + '/oauth2/v2.0/token', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          client_id: AZURE_CONFIG.clientId,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: AZURE_CONFIG.redirectUri,
          code_verifier: verifier,
          scope: AZURE_CONFIG.scopes.join(' ')
        }).toString()
      });

      if(!resp.ok){
        var errTxt = await resp.text();
        throw new Error('Token exchange failed: ' + resp.status + ' - ' + errTxt);
      }

      var tok = await resp.json();
      _saveTokens(tok);

      // Limpar estado temporario
      localStorage.removeItem(LS_PKCE_VERIFIER);
      localStorage.removeItem(LS_STATE);

      // Limpar URL (remover ?code=...)
      window.history.replaceState({}, document.title, window.location.pathname);

      // Buscar dados do usuario
      await _fetchUserInfo();

      _log('Login OK!');

      // Re-render tab email se estiver aberta
      if(document.getElementById('outlook-tab-content') &&
         document.getElementById('outlook-tab-content').offsetParent){
        outlookRenderTab();
      }

      // Avisar
      setTimeout(function(){
        alert('✅ Login Microsoft efetuado com sucesso!\nVoce pode acessar a aba 📧 Email agora.');
      }, 300);
    } catch(e){
      _err('handleAuthCallback', e);
      alert('Erro ao completar login: ' + e.message);
    }
  }

  /* Salva tokens no localStorage. */
  function _saveTokens(tokResponse){
    localStorage.setItem(LS_TOKEN, tokResponse.access_token);
    if(tokResponse.refresh_token){
      localStorage.setItem(LS_REFRESH, tokResponse.refresh_token);
    }
    var expMs = Date.now() + ((tokResponse.expires_in || 3600) * 1000);
    localStorage.setItem(LS_EXPIRES, String(expMs));
  }

  /* Troca refresh_token por novo access_token. */
  async function _refreshToken(){
    var refresh = localStorage.getItem(LS_REFRESH);
    if(!refresh) throw new Error('sem refresh_token');

    var resp = await fetch(AZURE_CONFIG.authority + '/oauth2/v2.0/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: AZURE_CONFIG.clientId,
        grant_type: 'refresh_token',
        refresh_token: refresh,
        scope: AZURE_CONFIG.scopes.join(' ')
      }).toString()
    });

    if(!resp.ok){
      var errTxt = await resp.text();
      throw new Error('Refresh failed: ' + resp.status + ' - ' + errTxt);
    }

    var tok = await resp.json();
    _saveTokens(tok);
    _log('Token refreshed');
    return tok.access_token;
  }

  /* Garante token valido (refresh se expirou). Retorna access_token. */
  async function _getValidToken(){
    var token = localStorage.getItem(LS_TOKEN);
    var expires = parseInt(localStorage.getItem(LS_EXPIRES)||'0');

    if(!token){
      throw new Error('Nao autenticado — clique Entrar');
    }

    // Renovar se falta menos de 2 min
    if(expires - Date.now() < 2 * 60 * 1000){
      try {
        token = await _refreshToken();
      } catch(e){
        _err('refresh token failed, need re-login', e);
        // Limpar tudo
        window.outlookLogout();
        throw new Error('Sessao expirada, faca login novamente');
      }
    }
    return token;
  }

  /* Logout: limpa todos tokens. */
  window.outlookLogout = function(){
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_REFRESH);
    localStorage.removeItem(LS_EXPIRES);
    localStorage.removeItem(LS_USER);
    _log('Logout OK');
    if(typeof outlookRenderTab === 'function') outlookRenderTab();
  };

  /* Chama Graph API com token automatico. */
  async function _graphCall(path, opts){
    opts = opts || {};
    var token = await _getValidToken();
    var resp = await fetch('https://graph.microsoft.com/v1.0' + path, {
      method: opts.method || 'GET',
      headers: Object.assign({
        'Authorization': 'Bearer ' + token,
        'Content-Type': opts.contentType || 'application/json'
      }, opts.headers || {}),
      body: opts.body
    });
    if(!resp.ok){
      var txt = await resp.text();
      throw new Error('Graph ' + resp.status + ' ' + path + ': ' + txt);
    }
    // Alguns endpoints (sendMail) retornam 202 sem body
    if(resp.status === 202 || resp.status === 204) return null;
    return await resp.json();
  }

  /* Busca dados do usuario logado. */
  async function _fetchUserInfo(){
    try {
      var me = await _graphCall('/me');
      localStorage.setItem(LS_USER, JSON.stringify({
        displayName: me.displayName,
        email: me.mail || me.userPrincipalName,
        id: me.id
      }));
      return me;
    } catch(e){
      _err('fetchUserInfo', e);
    }
  }

  /* Retorna usuario salvo. */
  window.outlookGetUser = function(){
    try {
      var s = localStorage.getItem(LS_USER);
      return s ? JSON.parse(s) : null;
    } catch(e){ return null; }
  };

  // ═══ API DE EMAILS ═══

  /* Lista emails da inbox.
     opts = {top: 50, search: 'texto', skip: 0}
     Retorna {emails: [...], nextLink: 'url ou null'} */
  window.outlookListInbox = async function(opts){
    opts = opts || {};
    var top = opts.top || 50;
    var path = "/me/mailFolders/inbox/messages?$top=" + top
      + "&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead,conversationId,categories"
      + "&$orderby=receivedDateTime desc";

    if(opts.search){
      // Graph API search (busca em todos campos)
      path = "/me/messages?$search=" + encodeURIComponent('"' + opts.search + '"')
        + "&$top=" + top
        + "&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead,conversationId,categories";
    }

    if(opts.skip) path += '&$skip=' + opts.skip;

    var result = await _graphCall(path);
    return {
      emails: result.value || [],
      nextLink: result['@odata.nextLink'] || null
    };
  };

  /* Busca emails por keyword (assunto, corpo, remetente).
     Usado pra achar thread de uma reserva. */
  window.outlookSearch = async function(keyword, top){
    return await window.outlookListInbox({search: keyword, top: top || 25});
  };

  /* Pega corpo completo de um email pelo id. */
  window.outlookGetEmail = async function(msgId){
    return await _graphCall('/me/messages/' + encodeURIComponent(msgId)
      + '?$select=id,subject,from,toRecipients,ccRecipients,bccRecipients,receivedDateTime,body,hasAttachments,conversationId,categories');
  };

  /* Envia email novo.
     params = {to: ['a@b'], cc: [...], subject: 'x', body: 'html', attachments: [{name, contentBytes, contentType}]} */
  window.outlookSendMail = async function(params){
    var msg = {
      message: {
        subject: params.subject || '(sem assunto)',
        body: {
          contentType: params.bodyType || 'HTML',
          content: params.body || ''
        },
        toRecipients: (params.to || []).map(function(e){
          return {emailAddress: {address: e}};
        }),
        ccRecipients: (params.cc || []).map(function(e){
          return {emailAddress: {address: e}};
        })
      },
      saveToSentItems: true
    };

    if(params.attachments && params.attachments.length){
      msg.message.attachments = params.attachments.map(function(a){
        return {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.name,
          contentType: a.contentType || 'application/octet-stream',
          contentBytes: a.contentBytes  // base64 sem prefix
        };
      });
    }

    return await _graphCall('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify(msg)
    });
  };

  /* Responde a TODOS de um thread existente.
     msgId: id da mensagem no thread
     body: html do reply
     attachments: [{name, contentBytes, contentType}] */
  window.outlookReplyAll = async function(msgId, body, attachments){
    var payload = {
      message: {
        body: {
          contentType: 'HTML',
          content: body
        }
      }
    };

    if(attachments && attachments.length){
      payload.message.attachments = attachments.map(function(a){
        return {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.name,
          contentType: a.contentType || 'application/octet-stream',
          contentBytes: a.contentBytes
        };
      });
    }

    return await _graphCall('/me/messages/' + encodeURIComponent(msgId) + '/replyAll', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  };

  // ═══ UI: ABA EMAIL ═══

  /* Renderiza conteudo da aba. Chamado quando aba vira ativa ou
     quando estado de auth muda. */
  window.outlookRenderTab = function(){
    var el = document.getElementById('outlook-tab-content');
    if(!el) return;

    if(!window.outlookIsAuth()){
      el.innerHTML = ''
        + '<div style="max-width:520px;margin:60px auto;padding:30px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.04);text-align:center">'
        +   '<div style="font-size:48px;margin-bottom:16px">📧</div>'
        +   '<h3 style="margin:0 0 8px;color:#003144">Conectar ao Outlook</h3>'
        +   '<p style="margin:8px 0 22px;color:#666;font-size:13px;line-height:1.5">'
        +     'Clique abaixo para entrar com sua conta Microsoft<br>'
        +     '<b>vendas01@projettaaluminio.com</b><br>'
        +     'e ter acesso aos seus emails dentro do sistema.'
        +   '</p>'
        +   '<button onclick="outlookLogin()" style="background:#0078d4;color:#fff;border:none;padding:12px 28px;border-radius:6px;font-weight:700;cursor:pointer;font-size:14px">'
        +     '🔐 Entrar com Microsoft'
        +   '</button>'
        +   '<div style="margin-top:20px;font-size:11px;color:#888">'
        +     'Você será redirecionado para login.microsoftonline.com<br>'
        +     'Permissoes: ler emails, enviar emails'
        +   '</div>'
        + '</div>';
      return;
    }

    // Autenticado — mostrar inbox
    var user = window.outlookGetUser() || {};
    el.innerHTML = ''
      + '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'
      +   '<div style="display:flex;align-items:center;gap:12px">'
      +     '<div style="width:36px;height:36px;background:#0078d4;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800">📧</div>'
      +     '<div>'
      +       '<div style="font-weight:700;color:#003144">' + (user.displayName || 'Usuario') + '</div>'
      +       '<div style="font-size:11px;color:#666">' + (user.email || '') + '</div>'
      +     '</div>'
      +   '</div>'
      +   '<div style="display:flex;gap:8px">'
      +     '<button onclick="outlookRefreshInbox()" style="background:#1a5276;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px">🔄 Atualizar</button>'
      +     '<button onclick="if(confirm(\'Sair da conta Microsoft?\'))outlookLogout()" style="background:#fff;color:#c0392b;border:1px solid #c0392b;padding:8px 14px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px">Sair</button>'
      +   '</div>'
      + '</div>'

      + '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-bottom:14px">'
      +   '<div style="display:flex;gap:10px;align-items:center">'
      +     '<input type="text" id="outlook-search" placeholder="Buscar por reserva, cliente, assunto..." '
      +            'style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:13px" '
      +            'onkeypress="if(event.key===\'Enter\')outlookDoSearch()">'
      +     '<button onclick="outlookDoSearch()" style="background:#27ae60;color:#fff;border:none;padding:10px 18px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">🔍 Buscar</button>'
      +     '<button onclick="document.getElementById(\'outlook-search\').value=\'\';outlookRefreshInbox()" style="background:none;color:#888;border:1px solid #ddd;padding:10px 14px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px">Limpar</button>'
      +   '</div>'
      + '</div>'

      + '<div id="outlook-inbox-list" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;min-height:400px">'
      +   '<div style="padding:40px;text-align:center;color:#666">⏳ Carregando emails...</div>'
      + '</div>';

    // Carregar inbox
    outlookRefreshInbox();
  };

  /* Busca e renderiza lista da inbox. */
  window.outlookRefreshInbox = async function(){
    var list = document.getElementById('outlook-inbox-list');
    if(!list) return;
    list.innerHTML = '<div style="padding:40px;text-align:center;color:#666">⏳ Carregando emails...</div>';

    try {
      var result = await window.outlookListInbox({top: 50});
      _renderEmailList(result.emails);
    } catch(e){
      _err('refreshInbox', e);
      list.innerHTML = '<div style="padding:40px;text-align:center;color:#c0392b">❌ Erro ao carregar:<br>'+e.message+'</div>';
    }
  };

  /* Executa busca usando o campo da toolbar. */
  window.outlookDoSearch = async function(){
    var q = (document.getElementById('outlook-search')||{}).value||'';
    q = q.trim();
    var list = document.getElementById('outlook-inbox-list');
    if(!list) return;

    if(!q){
      outlookRefreshInbox();
      return;
    }
    list.innerHTML = '<div style="padding:40px;text-align:center;color:#666">🔍 Buscando "'+_escHtml(q)+'"...</div>';

    try {
      var result = await window.outlookSearch(q, 50);
      _renderEmailList(result.emails, q);
    } catch(e){
      _err('doSearch', e);
      list.innerHTML = '<div style="padding:40px;text-align:center;color:#c0392b">❌ Erro na busca:<br>'+e.message+'</div>';
    }
  };

  /* Renderiza array de emails como lista. */
  function _renderEmailList(emails, searchTerm){
    var list = document.getElementById('outlook-inbox-list');
    if(!list) return;

    if(!emails || !emails.length){
      list.innerHTML = '<div style="padding:40px;text-align:center;color:#666">'
        + (searchTerm ? 'Nenhum email encontrado para "'+_escHtml(searchTerm)+'"' : 'Caixa de entrada vazia')
        + '</div>';
      return;
    }

    var header = searchTerm
      ? '<div style="padding:10px 14px;background:#e8f5e9;color:#1e8449;font-size:12px;font-weight:700;border-bottom:1px solid #e5e7eb">🔍 '+emails.length+' resultado(s) para "'+_escHtml(searchTerm)+'"</div>'
      : '<div style="padding:10px 14px;color:#666;font-size:12px;font-weight:600;border-bottom:1px solid #e5e7eb">📥 '+emails.length+' emails recentes</div>';

    var rows = emails.map(function(m){
      var fromName = (m.from && m.from.emailAddress && m.from.emailAddress.name) || '';
      var fromAddr = (m.from && m.from.emailAddress && m.from.emailAddress.address) || '';
      var unread = !m.isRead;
      var attach = m.hasAttachments;
      var dt = m.receivedDateTime ? new Date(m.receivedDateTime) : null;
      var dtStr = dt ? _formatDate(dt) : '';
      var subject = m.subject || '(sem assunto)';
      var preview = (m.bodyPreview||'').slice(0,110);
      // Badges de categorias
      var flagColors = {'Respondido':'#2e7d32','Pendente':'#e65100','Orcamento Pronto':'#1565c0','Urgente':'#c62828','Aguardando Cliente':'#7b1fa2'};
      var catBadges = (m.categories||[]).map(function(c){
        var cor = flagColors[c] || '#666';
        return '<span style="background:'+cor+';color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600">'+_escHtml(c)+'</span>';
      }).join(' ');

      return ''
        + '<div style="padding:12px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background .15s;background:'+(unread?'#f0f7ff':'#fff')+'" '
        +      'onclick="outlookOpenEmail(\''+_escAttr(m.id)+'\')" '
        +      'onmouseover="this.style.background=\'#f5f5f5\'" '
        +      'onmouseout="this.style.background=\''+(unread?'#f0f7ff':'#fff')+'\'">'
        +   '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">'
        +     (unread ? '<span style="width:8px;height:8px;background:#0078d4;border-radius:50%;display:inline-block"></span>' : '<span style="width:8px;display:inline-block"></span>')
        +     '<div style="font-weight:'+(unread?'800':'600')+';color:#003144;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_escHtml(fromName||fromAddr)+'</div>'
        +     (attach ? '<span style="color:#888" title="Tem anexo">📎</span>' : '')
        +     (catBadges ? '<span style="display:flex;gap:3px">'+catBadges+'</span>' : '')
        +     '<span style="font-size:11px;color:#888;white-space:nowrap">'+dtStr+'</span>'
        +   '</div>'
        +   '<div style="font-weight:'+(unread?'700':'500')+';color:#1a5276;margin-left:18px;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_escHtml(subject)+'</div>'
        +   '<div style="color:#777;font-size:11px;margin-left:18px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_escHtml(preview)+'</div>'
        + '</div>';
    }).join('');

    list.innerHTML = header + rows;
  }

  /* Abre email completo num modal. */
  window.outlookOpenEmail = async function(msgId){
    var existing = document.getElementById('outlook-email-modal');
    if(existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'outlook-email-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = '<div style="background:#fff;border-radius:12px;max-width:95vw;width:100%;max-height:95vh;overflow:auto;padding:24px;position:relative">'
      + '<button onclick="document.getElementById(\'outlook-email-modal\').remove()" style="position:absolute;top:14px;right:14px;background:none;border:none;font-size:22px;cursor:pointer;color:#666">✕</button>'
      + '<div id="outlook-email-body" style="padding-top:8px"><div style="text-align:center;color:#666;padding:40px">⏳ Carregando...</div></div>'
      + '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){
      if(e.target === modal) modal.remove();
    });

    try {
      var m = await window.outlookGetEmail(msgId);
      var from = (m.from && m.from.emailAddress) || {};
      var to = (m.toRecipients||[]).map(function(r){return r.emailAddress.address;}).join(', ');
      var cc = (m.ccRecipients||[]).map(function(r){return r.emailAddress.address;}).join(', ');
      var dt = m.receivedDateTime ? new Date(m.receivedDateTime) : null;
      var body = (m.body && m.body.content) || '';

      // Buscar anexos se email tem attachments
      var attachHtml = '';
      if(m.hasAttachments){
        try {
          // Busca so metadados (sem contentBytes — evita timeout em anexos grandes)
          var attachResp = await _graphCall('/me/messages/' + msgId + '/attachments?$select=id,name,contentType,size,isInline');
          var attachments = (attachResp && attachResp.value) || [];
          var visibleAtt = attachments.filter(function(a){ return !a.isInline; });
          if(visibleAtt.length > 0){
            // Registra funcao global de download
            window._outlookDownloadAtt = async function(attMsgId, attId, attName, attType){
              try {
                var btn = document.getElementById('dl-' + attId);
                if(btn) btn.textContent = '⏳ Baixando...';
                var att = await _graphCall('/me/messages/' + attMsgId + '/attachments/' + attId);
                if(att && att.contentBytes){
                  var raw = atob(att.contentBytes);
                  var arr = new Uint8Array(raw.length);
                  for(var i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
                  var blob = new Blob([arr], {type: attType || 'application/octet-stream'});
                  var url = URL.createObjectURL(blob);
                  var a = document.createElement('a');
                  a.href = url; a.download = attName || 'anexo'; a.click();
                  URL.revokeObjectURL(url);
                  if(btn) btn.textContent = '✅ Baixado';
                } else {
                  if(btn) btn.textContent = '❌ Sem conteudo';
                }
              } catch(e){
                console.error('Download att failed:', e);
                var btn2 = document.getElementById('dl-' + attId);
                if(btn2) btn2.textContent = '❌ Erro';
              }
            };
            // Funcao de preview inline (imagens e PDFs)
            window._outlookPreviewAtt = async function(attMsgId, attId, attName, attType){
              var previewEl = document.getElementById('preview-' + attId);
              var btn = document.getElementById('pv-' + attId);
              if(!previewEl) return;
              // Toggle: se ja visivel, esconde
              if(previewEl.style.display !== 'none'){
                previewEl.style.display = 'none';
                if(btn) btn.textContent = '👁 Visualizar';
                return;
              }
              if(btn) btn.textContent = '⏳ Carregando...';
              try {
                var att = await _graphCall('/me/messages/' + attMsgId + '/attachments/' + attId);
                if(att && att.contentBytes){
                  var ct = (attType||'').toLowerCase();
                  if(ct.indexOf('image') >= 0){
                    // Imagem: mostra inline
                    previewEl.innerHTML = '<img src="data:' + attType + ';base64,' + att.contentBytes + '" style="max-width:100%;max-height:80vh;border-radius:6px;border:1px solid #ddd;" />';
                  } else if(ct.indexOf('pdf') >= 0){
                    // PDF: mostra em iframe
                    var blobUrl = URL.createObjectURL(new Blob([Uint8Array.from(atob(att.contentBytes).split('').map(function(c){return c.charCodeAt(0)}))], {type:'application/pdf'}));
                    previewEl.innerHTML = '<iframe src="' + blobUrl + '" style="width:100%;height:85vh;border:1px solid #ddd;border-radius:6px;" frameborder="0"></iframe>';
                  }
                  previewEl.style.display = 'block';
                  if(btn) btn.textContent = '👁 Esconder';
                } else {
                  if(btn) btn.textContent = '❌ Sem conteudo';
                }
              } catch(e){
                console.error('Preview att failed:', e);
                if(btn) btn.textContent = '❌ Erro';
              }
            };
            var attachItems = visibleAtt.map(function(a){
              var sizeKB = Math.round((a.size||0) / 1024);
              var sizeStr = sizeKB > 1024 ? (sizeKB/1024).toFixed(1) + ' MB' : sizeKB + ' KB';
              var icon = '📄';
              var ct = (a.contentType||'').toLowerCase();
              var nm = (a.name||'').toLowerCase();
              if(ct.indexOf('pdf')>=0 || nm.endsWith('.pdf')) icon = '📕';
              else if(ct.indexOf('image')>=0) icon = '🖼️';
              else if(nm.match(/\.xlsx?$/)) icon = '📊';
              else if(nm.match(/\.docx?$/)) icon = '📝';
              // Botao Visualizar para imagens e PDFs
              var previewable = ct.indexOf('image')>=0 || ct.indexOf('pdf')>=0 || nm.endsWith('.pdf');
              var previewBtn = previewable
                ? '<button id="pv-' + a.id + '" onclick="window._outlookPreviewAtt(\'' + _escAttr(msgId) + '\',\'' + _escAttr(a.id) + '\',\'' + _escAttr(a.name||'anexo') + '\',\'' + _escAttr(a.contentType||'') + '\')" '
                + 'style="background:#e65100;color:#fff;border:none;padding:6px 14px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">👁 Visualizar</button>'
                : '';
              return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0f0f0">'
                + '<span style="font-size:22px">' + icon + '</span>'
                + '<div style="flex:1"><div style="font-weight:600;font-size:13px">' + _escHtml(a.name||'Sem nome') + '</div>'
                + '<div style="font-size:11px;color:#888">' + sizeStr + '</div></div>'
                + '<div style="display:flex;gap:6px">'
                + previewBtn
                + '<button id="dl-' + a.id + '" onclick="window._outlookDownloadAtt(\'' + _escAttr(msgId) + '\',\'' + _escAttr(a.id) + '\',\'' + _escAttr(a.name||'anexo') + '\',\'' + _escAttr(a.contentType||'') + '\')" '
                + 'style="background:#1a5276;color:#fff;border:none;padding:6px 14px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">⬇ Baixar</button>'
                + '</div>'
                + '</div>'
                + '<div id="preview-' + a.id + '" style="display:none;margin:8px 0;"></div>';
            });
            attachHtml = '<div style="border-top:2px solid #1a5276;margin-top:16px;padding-top:14px">'
              + '<div style="font-weight:700;font-size:14px;color:#1a5276;margin-bottom:10px">📎 Anexos (' + visibleAtt.length + ')</div>'
              + attachItems.join('')
              + '</div>';
          }
        } catch(ae){
          _err('fetch attachments', ae);
          attachHtml = '<div style="color:#c0392b;font-size:12px;margin-top:10px">⚠ Nao foi possivel carregar os anexos: ' + _escHtml(ae.message) + '</div>';
        }
      }

      // Categorias/flags do email
      var cats = m.categories || [];
      var FLAGS = ['Respondido', 'Pendente', 'Orcamento Pronto', 'Urgente', 'Aguardando Cliente'];
      var flagColors = {'Respondido':'#2e7d32','Pendente':'#e65100','Orcamento Pronto':'#1565c0','Urgente':'#c62828','Aguardando Cliente':'#7b1fa2'};
      var flagsHtml = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">'
        + FLAGS.map(function(f){
          var ativo = cats.indexOf(f) >= 0;
          var cor = flagColors[f] || '#666';
          return '<button onclick="window._outlookToggleFlag(\'' + _escAttr(msgId) + '\',\'' + _escAttr(f) + '\',this)" '
            + 'style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid ' + cor + ';'
            + (ativo ? 'background:' + cor + ';color:#fff' : 'background:#fff;color:' + cor) + '">'
            + f + '</button>';
        }).join('')
        + '</div>';

      document.getElementById('outlook-email-body').innerHTML = ''
        + '<h3 style="margin:0 0 14px;color:#003144;font-size:17px">'+_escHtml(m.subject||'(sem assunto)')+'</h3>'
        + flagsHtml
        + '<div style="background:#f5f5f5;padding:10px 12px;border-radius:6px;font-size:12px;margin-bottom:14px">'
        +   '<div><b>De:</b> '+_escHtml(from.name||'')+' &lt;'+_escHtml(from.address||'')+'&gt;</div>'
        +   '<div><b>Para:</b> '+_escHtml(to)+'</div>'
        +   (cc ? '<div><b>Cc:</b> '+_escHtml(cc)+'</div>' : '')
        +   (dt ? '<div><b>Data:</b> '+dt.toLocaleString('pt-BR')+'</div>' : '')
        + '</div>'
        + '<div style="border-top:1px solid #e5e7eb;padding-top:14px">' + body + '</div>'
        + attachHtml
        + '<div style="border-top:2px solid #1a5276;margin-top:20px;padding-top:16px">'
        +   '<div style="font-weight:700;font-size:14px;color:#1a5276;margin-bottom:8px">✉️ Responder</div>'
        +   '<textarea id="outlook-reply-text" placeholder="Digite sua resposta..." style="width:100%;min-height:120px;padding:10px;border:1px solid #ccc;border-radius:6px;font-size:13px;font-family:inherit;resize:vertical"></textarea>'
        +   '<div style="display:flex;gap:8px;margin-top:8px">'
        +     '<button id="outlook-reply-btn" onclick="window._outlookSendReply(\'' + _escAttr(msgId) + '\')" style="background:#1a5276;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">📤 Enviar Resposta</button>'
        +     '<button id="outlook-reply-all-btn" onclick="window._outlookSendReply(\'' + _escAttr(msgId) + '\',true)" style="background:#2e7d32;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">📤 Responder Todos</button>'
        +   '</div>'
        + '</div>';
    } catch(e){
      _err('openEmail', e);
      document.getElementById('outlook-email-body').innerHTML = '<div style="color:#c0392b;padding:40px;text-align:center">Erro: '+e.message+'</div>';
    }
  };

  // ═══ FLAGS / CATEGORIAS ═══

  window._outlookToggleFlag = async function(msgId, flag, btnEl){
    try {
      if(btnEl) btnEl.textContent = '⏳';
      // Le categorias atuais
      var msg = await _graphCall('/me/messages/' + msgId + '?$select=categories');
      var cats = (msg && msg.categories) || [];
      var idx = cats.indexOf(flag);
      if(idx >= 0) cats.splice(idx, 1); else cats.push(flag);
      // Atualiza no servidor
      await _graphCall('/me/messages/' + msgId, {
        method: 'PATCH',
        body: JSON.stringify({ categories: cats })
      });
      // Atualiza visual do botao
      if(btnEl){
        var flagColors = {'Respondido':'#2e7d32','Pendente':'#e65100','Orcamento Pronto':'#1565c0','Urgente':'#c62828','Aguardando Cliente':'#7b1fa2'};
        var cor = flagColors[flag] || '#666';
        var ativo = cats.indexOf(flag) >= 0;
        btnEl.style.background = ativo ? cor : '#fff';
        btnEl.style.color = ativo ? '#fff' : cor;
        btnEl.textContent = flag;
      }
    } catch(e){
      _err('toggleFlag', e);
      if(btnEl) btnEl.textContent = '❌ ' + flag;
    }
  };

  // ═══ RESPONDER EMAIL ═══

  window._outlookSendReply = async function(msgId, replyAll){
    var textarea = document.getElementById('outlook-reply-text');
    var btn = document.getElementById(replyAll ? 'outlook-reply-all-btn' : 'outlook-reply-btn');
    if(!textarea || !textarea.value.trim()){
      alert('Digite uma resposta antes de enviar.');
      return;
    }
    var bodyHtml = '<p>' + textarea.value.replace(/\n/g, '<br>') + '</p>'
      + '<br><p style="font-size:11px;color:#888">— Enviado via Projetta by Weiku</p>';
    if(btn) btn.textContent = '⏳ Enviando...';
    try {
      if(replyAll){
        await window.outlookReplyAll(msgId, bodyHtml);
      } else {
        // Reply simples (so pro remetente)
        await _graphCall('/me/messages/' + msgId + '/reply', {
          method: 'POST',
          body: JSON.stringify({ comment: bodyHtml })
        });
      }
      textarea.value = '';
      if(btn) btn.textContent = '✅ Enviado!';
      setTimeout(function(){ if(btn) btn.textContent = replyAll ? '📤 Responder Todos' : '📤 Enviar Resposta'; }, 2000);
      // Auto-marca como Respondido
      window._outlookToggleFlag(msgId, 'Respondido', null);
    } catch(e){
      _err('sendReply', e);
      if(btn) btn.textContent = '❌ Erro';
      alert('Erro ao enviar resposta: ' + e.message);
    }
  };

  // ═══ UTILS ═══

  function _escHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _escAttr(s){
    return String(s||'').replace(/'/g,'&apos;').replace(/"/g,'&quot;');
  }

  function _formatDate(d){
    var hoje = new Date();
    var sameDay = d.getDate()===hoje.getDate() && d.getMonth()===hoje.getMonth() && d.getFullYear()===hoje.getFullYear();
    if(sameDay){
      return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    }
    var anoAtual = hoje.getFullYear();
    if(d.getFullYear() === anoAtual){
      return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    }
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});
  }

  // ═══ INIT ═══

  // Processar callback se voltamos de autorizacao
  document.addEventListener('DOMContentLoaded', function(){
    // Delay pra outras inits rodarem
    setTimeout(_handleAuthCallback, 500);
  });

  // Tambem tenta processar imediatamente caso DOMContentLoaded ja disparou
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(_handleAuthCallback, 500);
  }

  _log('Outlook module v1.0 loaded. Client ID:', AZURE_CONFIG.clientId);

})();
/* ══ END MODULE: OUTLOOK ══ */
