/* ================================================================
 * 55-whatsapp-inbox.js — Aba WhatsApp: caixa de entrada (inbox)
 * ================================================================
 * Felipe sessao 38: ler e RESPONDER as conversas do numero oficial
 * DENTRO do sistema. O numero virou API-only (nao roda mais no app),
 * entao as conversas so existem aqui.
 *
 * Fonte: v7.wpp_mensagens (gravada pelo webhook netlify/functions/
 * whatsapp-webhook.js para INBOUND e por whatsapp-send.js para OUTBOUND).
 * Enviar: netlify/functions/whatsapp-send.js (texto livre).
 *
 * Regra da Meta: TEXTO LIVRE so dentro de 24h apos a ULTIMA mensagem do
 * cliente. Fora disso, so com template aprovado. O inbox detecta a janela
 * e avisa.
 *
 * Modulo 100% isolado (IIFE + prefixo .wai-). Registrado em 99-boot.js.
 * ================================================================ */
(function () {
  'use strict';

  var SCOPE_TABLE = 'wpp_mensagens';
  var CSS_ID = 'wai-styles';
  var WPP_FN = '/.netlify/functions/whatsapp-send';
  var WPP_SECRET = 'projetta-zap-2026-x9k2'; // gate v1 (mesmo segredo do disparo)
  var JANELA_MS = 24 * 60 * 60 * 1000;
  var POLL_MS = 12000;

  var st = {
    sel: null,        // telefone selecionado
    convs: [],        // conversas agrupadas
    porTel: {},       // tel -> conversa
    draft: '',        // rascunho da resposta (preserva entre re-renders)
    enviando: false,
    sig: '',          // assinatura dos dados (detecta mudanca no poll)
    timer: null,
    container: null
  };

  // ---- helpers ----------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function fmtTel(t) {
    var n = digits(t);
    if (n.length >= 12 && n.slice(0, 2) === '55') {
      var ddd = n.slice(2, 4), resto = n.slice(4);
      if (resto.length >= 8) return '+55 ' + ddd + ' ' + resto.slice(0, resto.length - 4) + '-' + resto.slice(-4);
    }
    return '+' + n;
  }
  function fmtHora(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var hoje = new Date();
    var mesmoDia = d.toDateString() === hoje.toDateString();
    if (mesmoDia) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function primeiroNome(c) {
    if (c.nome) return c.nome.split(' ')[0];
    return fmtTel(c.tel);
  }

  function sbHeaders() {
    return {
      'apikey': Database.SUPABASE_KEY,
      'Authorization': 'Bearer ' + Database.SUPABASE_KEY,
      'Accept-Profile': 'v7'
    };
  }

  // ---- carga + agrupamento ---------------------------------------
  function carregar(cb) {
    if (!window.Database || !Database.SUPABASE_URL) { cb && cb(false); return; }
    var url = Database.SUPABASE_URL + '/rest/v1/' + SCOPE_TABLE
      + '?select=telefone,nome,direcao,tipo,texto,wamid,ts,status,lead_id&order=ts.asc&limit=4000';
    fetch(url, { headers: sbHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        agrupar(Array.isArray(rows) ? rows : []);
        cb && cb(true);
      })
      .catch(function () { cb && cb(false); });
  }

  function agrupar(rows) {
    var map = {};
    rows.forEach(function (m) {
      var tel = digits(m.telefone);
      if (!tel) return;
      if (!map[tel]) map[tel] = { tel: tel, nome: '', msgs: [], lastTs: 0, lastInTs: 0 };
      var c = map[tel];
      c.msgs.push(m);
      var t = m.ts ? new Date(m.ts).getTime() : 0;
      if (t > c.lastTs) c.lastTs = t;
      if (m.direcao === 'in') {
        if (t > c.lastInTs) c.lastInTs = t;
        if (m.nome) c.nome = m.nome; // nome do perfil so vem em inbound
      } else if (!c.nome && m.nome) {
        c.nome = m.nome; // fallback: nome passado no disparo
      }
    });
    var arr = Object.keys(map).map(function (k) { return map[k]; });
    arr.sort(function (a, b) { return b.lastTs - a.lastTs; });
    st.convs = arr;
    st.porTel = map;
    st.sig = arr.map(function (c) { return c.tel + ':' + c.msgs.length + ':' + c.lastTs; }).join('|');
    if (st.sel && !map[st.sel] && arr.length) st.sel = arr[0].tel;
  }

  function janelaAberta(c) {
    return c && c.lastInTs && (Date.now() - c.lastInTs < JANELA_MS);
  }

  // ---- CSS --------------------------------------------------------
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.wai-app{--wai-tinta:#003144;--wai-teal:#0f766e;--wai-zap:#25D366;--wai-linha:#E4E8EE;--wai-cinza:#6b7280;max-width:1320px;margin:0 auto;padding:4px 6px 40px;font-size:14px}',
      '.wai-wrap{display:grid;grid-template-columns:340px 1fr;gap:0;border:1px solid var(--wai-linha);border-radius:14px;overflow:hidden;background:#fff;height:640px}',
      '.wai-list{border-right:1px solid var(--wai-linha);overflow-y:auto;background:#fbfcfd}',
      '.wai-lhead{padding:13px 16px;font-weight:800;color:var(--wai-tinta);border-bottom:1px solid var(--wai-linha);position:sticky;top:0;background:#fff;z-index:1}',
      '.wai-lhead small{display:block;font-weight:500;color:var(--wai-cinza);font-size:11px;margin-top:2px}',
      '.wai-conv{padding:11px 16px;border-bottom:1px solid var(--wai-linha);cursor:pointer;display:flex;gap:10px;align-items:center}',
      '.wai-conv:hover{background:#f1f5f9}.wai-conv.sel{background:#e7f5ee}',
      '.wai-av{width:38px;height:38px;border-radius:50%;background:var(--wai-tinta);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}',
      '.wai-cinfo{min-width:0;flex:1}',
      '.wai-cnome{font-weight:700;color:var(--wai-tinta);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.wai-cprev{font-size:12px;color:var(--wai-cinza);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}',
      '.wai-ctime{font-size:10px;color:var(--wai-cinza);flex-shrink:0;align-self:flex-start}',
      '.wai-main{display:flex;flex-direction:column;min-width:0}',
      '.wai-mhead{padding:12px 18px;border-bottom:1px solid var(--wai-linha);font-weight:700;color:var(--wai-tinta);display:flex;justify-content:space-between;align-items:center;gap:10px}',
      '.wai-mhead small{font-weight:500;color:var(--wai-cinza);font-size:12px}',
      '.wai-thread{flex:1;overflow-y:auto;padding:18px;background:#f5f6f8;display:flex;flex-direction:column;gap:8px}',
      '.wai-b{max-width:72%;padding:8px 12px;border-radius:12px;font-size:13.5px;line-height:1.4;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 1px rgba(0,0,0,.05)}',
      '.wai-b .wai-bt{display:block;font-size:10px;color:#64748b;margin-top:4px;text-align:right}',
      '.wai-in{align-self:flex-start;background:#fff;border:1px solid var(--wai-linha)}',
      '.wai-out{align-self:flex-end;background:#dcf8c6}',
      '.wai-reply{border-top:1px solid var(--wai-linha);padding:12px 14px;background:#fff}',
      '.wai-reply textarea{width:100%;min-height:44px;max-height:120px;padding:10px 12px;border:1px solid var(--wai-linha);border-radius:10px;font:inherit;resize:vertical;background:#fafbfc}',
      '.wai-reply textarea:focus{outline:none;border-color:var(--wai-teal);background:#fff}',
      '.wai-rbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px}',
      '.wai-send{border:none;border-radius:9px;padding:9px 20px;font:inherit;font-weight:700;cursor:pointer;background:var(--wai-zap);color:#fff}',
      '.wai-send:hover{background:#1faf53}.wai-send:disabled{background:#cbd5e1;cursor:not-allowed}',
      '.wai-warn{font-size:12px;color:#9a3412;background:#FFF4E6;border:1px solid #fed7aa;border-radius:8px;padding:6px 10px}',
      '.wai-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--wai-cinza);text-align:center;padding:30px}',
      '.wai-big{text-align:center;padding:60px 20px;color:var(--wai-cinza)}',
      '.wai-big .e{font-size:42px}',
      '@media(max-width:760px){.wai-wrap{grid-template-columns:1fr;height:auto}.wai-list{max-height:240px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---- render -----------------------------------------------------
  function render(container) {
    st.container = container;
    injectCSS();
    if (!window.Database || !Database.SUPABASE_URL) {
      container.innerHTML = '<div class="wai-app"><div class="wai-big"><div class="e">\uD83D\uDCAC</div><h3>WhatsApp</h3><p>Banco indispon\u00edvel no momento.</p></div></div>';
      return;
    }
    container.innerHTML = '<div class="wai-app"><div class="wai-big"><div class="e">\u23F3</div><p>Carregando conversas\u2026</p></div></div>';
    carregar(function () {
      desenhar();
      iniciarPoll();
    });
  }

  function desenhar() {
    var c = st.container;
    if (!c) return;
    if (!st.convs.length) {
      c.innerHTML = '<div class="wai-app"><div class="wai-big"><div class="e">\uD83D\uDCED</div>'
        + '<h3>Nenhuma conversa ainda</h3>'
        + '<p>As mensagens aparecem aqui assim que algu\u00e9m responder o n\u00famero da Projetta.<br>'
        + '(o webhook precisa estar inscrito na Meta — e os disparos come\u00e7am a gerar respostas)</p></div></div>';
      return;
    }
    if (!st.sel) st.sel = st.convs[0].tel;
    c.innerHTML = '<div class="wai-app"><div class="wai-wrap">'
      + '<div class="wai-list" id="wai-list">' + listaHTML() + '</div>'
      + '<div class="wai-main" id="wai-main">' + mainHTML() + '</div>'
      + '</div></div>';
    bind();
    rolarFim();
  }

  function listaHTML() {
    var head = '<div class="wai-lhead">Conversas <small>' + st.convs.length + ' contato(s) \u00b7 n\u00famero oficial</small></div>';
    var itens = st.convs.map(function (c) {
      var ult = c.msgs[c.msgs.length - 1] || {};
      var prev = (ult.direcao === 'out' ? 'Voc\u00ea: ' : '') + (ult.texto || '');
      var ini = (primeiroNome(c)[0] || '?').toUpperCase();
      return '<div class="wai-conv' + (c.tel === st.sel ? ' sel' : '') + '" data-tel="' + esc(c.tel) + '">'
        + '<div class="wai-av">' + esc(ini) + '</div>'
        + '<div class="wai-cinfo"><div class="wai-cnome">' + esc(c.nome || fmtTel(c.tel)) + '</div>'
        + '<div class="wai-cprev">' + esc(prev) + '</div></div>'
        + '<div class="wai-ctime">' + esc(fmtHora(c.lastTs)) + '</div>'
        + '</div>';
    }).join('');
    return head + itens;
  }

  function mainHTML() {
    var c = st.porTel[st.sel];
    if (!c) return '<div class="wai-empty">Selecione uma conversa.</div>';
    var bolhas = c.msgs.map(function (m) {
      var cls = m.direcao === 'out' ? 'wai-out' : 'wai-in';
      return '<div class="wai-b ' + cls + '">' + esc(m.texto || '')
        + '<span class="wai-bt">' + esc(fmtHora(m.ts ? new Date(m.ts).getTime() : 0)) + (m.direcao === 'out' && m.status ? ' \u00b7 ' + esc(m.status) : '') + '</span></div>';
    }).join('');
    var aberta = janelaAberta(c);
    var aviso = aberta ? ''
      : '<div class="wai-warn">\u26a0\ufe0f Fora da janela de 24h. Texto livre pode ser recusado pela Meta — nesse caso, use um template aprovado.</div>';
    return '<div class="wai-mhead"><div>' + esc(c.nome || fmtTel(c.tel)) + ' <small>' + esc(fmtTel(c.tel)) + '</small></div>'
      + '<small>' + (aberta ? '\uD83D\uDFE2 janela aberta' : '\uD83D\uDD34 janela 24h fechada') + '</small></div>'
      + '<div class="wai-thread" id="wai-thread">' + bolhas + '</div>'
      + '<div class="wai-reply">'
      + (aviso ? aviso + '<div style="height:8px"></div>' : '')
      + '<textarea id="wai-msg" placeholder="Escreva uma resposta\u2026">' + esc(st.draft) + '</textarea>'
      + '<div class="wai-rbar"><small style="color:#6b7280">Enter envia \u00b7 Shift+Enter quebra linha</small>'
      + '<button class="wai-send" id="wai-send"' + (st.enviando ? ' disabled' : '') + '>' + (st.enviando ? 'Enviando\u2026' : 'Enviar') + '</button></div>'
      + '</div>';
  }

  function rolarFim() {
    var t = st.container && st.container.querySelector('#wai-thread');
    if (t) t.scrollTop = t.scrollHeight;
  }

  function bind() {
    var c = st.container;
    var lista = c.querySelector('#wai-list');
    if (lista) lista.addEventListener('click', function (ev) {
      var item = ev.target.closest('.wai-conv');
      if (!item) return;
      st.sel = item.getAttribute('data-tel');
      st.draft = '';
      desenhar();
    });
    var ta = c.querySelector('#wai-msg');
    if (ta) {
      ta.addEventListener('input', function () { st.draft = ta.value; });
      ta.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); enviar(); }
      });
      ta.focus();
    }
    var btn = c.querySelector('#wai-send');
    if (btn) btn.addEventListener('click', enviar);
  }

  // ---- enviar resposta -------------------------------------------
  function enviar() {
    if (st.enviando) return;
    var c = st.porTel[st.sel];
    if (!c) return;
    var txt = (st.draft || '').trim();
    if (!txt) return;
    st.enviando = true;
    var btn = st.container.querySelector('#wai-send');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando\u2026'; }

    fetch(WPP_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: WPP_SECRET, to: c.tel, text: txt, log: { nome: c.nome || '' } })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        st.enviando = false;
        if (res.status === 200 && res.j && res.j.ok) {
          // otimista: adiciona localmente; o poll confirma do banco
          c.msgs.push({ telefone: c.tel, direcao: 'out', tipo: 'text', texto: txt, ts: new Date().toISOString(), status: 'sent', wamid: res.j.id || null });
          c.lastTs = Date.now();
          st.draft = '';
          desenhar();
        } else {
          var er = (res.j && res.j.error) ? (typeof res.j.error === 'string' ? res.j.error : (res.j.error.message || JSON.stringify(res.j.error))) : ('HTTP ' + res.status);
          desenhar();
          window.alert('N\u00e3o consegui enviar:\n\n' + er + (res.status !== 200 ? '\n\n(Se for fora da janela de 24h, s\u00f3 d\u00e1 com template aprovado.)' : ''));
        }
      })
      .catch(function (e) {
        st.enviando = false; desenhar();
        window.alert('Falha de rede ao enviar: ' + (e && e.message));
      });
  }

  // ---- polling ----------------------------------------------------
  function iniciarPoll() {
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(function () {
      // so atualiza se a aba ainda estiver montada no DOM
      if (!st.container || !document.body.contains(st.container)) { clearInterval(st.timer); st.timer = null; return; }
      var antes = st.sig;
      carregar(function () {
        if (st.sig !== antes) {
          // preserva rascunho atual antes de redesenhar
          var ta = st.container.querySelector('#wai-msg');
          if (ta) st.draft = ta.value;
          desenhar();
        }
      });
    }, POLL_MS);
  }

  window.WhatsAppInbox = { render: render };
  console.log('[whatsapp-inbox] Modulo carregado');
})();
