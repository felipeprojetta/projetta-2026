/* ================================================================
 * 47-email-thread.js — Thread de Emails no Card CRM
 * ================================================================
 * Felipe (sessao 09): "quero exatamente igual o Outlook —
 * linhas compactas com data, clico pra abrir, ultimo email
 * ja aberto, com anexos."
 *
 * Visual: lista de emails como linhas compactas (remetente +
 * preview + data + icone anexo). Click expande email completo.
 * Ultimo email ja vem expandido. Carrega detalhes sob demanda.
 *
 * DEPENDE DE:
 *   - 35-outlook.js (outlookIsAuth, outlookListInbox, outlookGetEmail,
 *     outlookReplyAll, _outlookGraphCall)
 *   - 10-crm.js (Storage para ler lead por id)
 *
 * NAO MODIFICA nenhum outro modulo.
 * ================================================================ */
(function() {
  'use strict';

  function _esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function _escA(s) { return String(s || '').replace(/'/g, '&apos;').replace(/"/g, '&quot;'); }

  function _fmtDataCurta(d) {
    if (!d) return '';
    var hoje = new Date();
    var sameDay = d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function _fmtDataLonga(d) {
    if (!d) return '';
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /* ── Abre thread para um lead ── */
  async function abrirThread(leadId) {
    var leads = [];
    try { leads = Storage.scope('crm').get('leads') || []; }
    catch (e) { console.error('[email-thread] Storage', e); return; }

    var lead = leads.find(function(l) { return l.id === leadId; });
    if (!lead || !lead.numeroReserva) {
      alert('Este lead nao tem numero de reserva pra buscar emails.');
      return;
    }
    if (!window.outlookIsAuth || !window.outlookIsAuth()) {
      alert('Conecte ao Outlook primeiro (aba Email).');
      return;
    }

    var reserva = lead.numeroReserva;

    // Criar modal
    var old = document.getElementById('email-thread-modal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.id = 'email-thread-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML =
      '<div class="etm-container">' +
        '<div class="etm-header">' +
          '<div class="etm-title">📧 Reserva ' + _esc(reserva) + ' — ' + _esc(lead.cliente || '') + '</div>' +
          '<button class="etm-close" id="etm-close">×</button>' +
        '</div>' +
        '<div class="etm-body" id="etm-body">' +
          '<div class="etm-loading">⏳ Buscando emails da reserva ' + _esc(reserva) + '...</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    modal.querySelector('#etm-close').addEventListener('click', function() { modal.remove(); });

    // Buscar emails
    try {
      var result = await window.outlookListInbox({ top: 30, search: 'reserva ' + reserva });
      var emails = (result && result.emails) || [];

      if (!emails.length) {
        document.getElementById('etm-body').innerHTML =
          '<div class="etm-empty">Nenhum email encontrado com "reserva ' + _esc(reserva) + '"</div>';
        return;
      }

      // Ordenar: mais recente primeiro
      emails.sort(function(a, b) {
        return new Date(b.receivedDateTime || 0).getTime() - new Date(a.receivedDateTime || 0).getTime();
      });

      // Renderizar lista compacta (rapido)
      _renderizarListaCompacta(emails);

      // Auto-expandir o mais recente (idx 0)
      _expandirEmail(0, emails[0].id);

    } catch (e) {
      console.error('[email-thread] Erro:', e);
      var body = document.getElementById('etm-body');
      if (body) body.innerHTML = '<div class="etm-error">❌ Erro: ' + _esc(e.message) + '</div>';
    }
  }

  /* ── Lista compacta estilo Outlook ── */
  function _renderizarListaCompacta(emails) {
    var body = document.getElementById('etm-body');
    if (!body) return;

    var html = '';

    emails.forEach(function(em, idx) {
      var from = (em.from && em.from.emailAddress) || {};
      var fromName = from.name || from.address || '?';
      var dt = em.receivedDateTime ? new Date(em.receivedDateTime) : null;
      var preview = (em.bodyPreview || '').slice(0, 160);
      var hasAtt = em.hasAttachments;
      var inicial = (fromName[0] || '?').toUpperCase();

      html += '<div class="etm-row" id="etm-row-' + idx + '">';

      // Linha compacta clicavel
      html += '<div class="etm-row-header" data-idx="' + idx + '" data-msg-id="' + _escA(em.id) + '">';
      html += '<span class="etm-avatar">' + _esc(inicial) + '</span>';
      html += '<div class="etm-row-info">';
      html += '<div class="etm-row-top">';
      html += '<span class="etm-row-nome">' + _esc(fromName) + '</span>';
      html += '<span class="etm-row-date">' + _esc(_fmtDataCurta(dt)) + '</span>';
      html += '</div>';
      html += '<div class="etm-row-preview">';
      if (hasAtt) html += '<span class="etm-att-icon">📎</span> ';
      html += _esc(preview);
      html += '</div>';
      html += '</div>';
      html += '</div>'; // header

      // Area expandida (oculta ate click)
      html += '<div class="etm-row-expanded" id="etm-expanded-' + idx + '" style="display:none"></div>';

      html += '</div>'; // row
    });

    // Reply
    var ultimoId = emails[0] ? emails[0].id : '';
    html += '<div class="etm-reply-section">';
    html += '<div class="etm-reply-titulo">✉️ Responder</div>';
    html += '<textarea id="etm-reply-text" class="etm-reply-textarea" placeholder="Digite sua resposta..."></textarea>';
    html += '<div class="etm-reply-btns">';
    html += '<button class="etm-btn etm-btn-reply" id="etm-btn-reply" data-msg="' + _escA(ultimoId) + '">📤 Responder</button>';
    html += '<button class="etm-btn etm-btn-reply-all" id="etm-btn-reply-all" data-msg="' + _escA(ultimoId) + '">📤 Responder Todos</button>';
    html += '</div>';
    html += '</div>';

    body.innerHTML = html;

    // Click handlers
    body.querySelectorAll('.etm-row-header').forEach(function(h) {
      h.addEventListener('click', function() {
        _toggleEmail(parseInt(h.dataset.idx), h.dataset.msgId);
      });
    });

    var replyBtn = document.getElementById('etm-btn-reply');
    var replyAllBtn = document.getElementById('etm-btn-reply-all');
    if (replyBtn) replyBtn.addEventListener('click', function() { _enviarReply(replyBtn.dataset.msg, false); });
    if (replyAllBtn) replyAllBtn.addEventListener('click', function() { _enviarReply(replyAllBtn.dataset.msg, true); });
  }

  /* ── Toggle email ── */
  function _toggleEmail(idx, msgId) {
    var expanded = document.getElementById('etm-expanded-' + idx);
    if (!expanded) return;

    if (expanded.style.display !== 'none') {
      expanded.style.display = 'none';
      var row = document.getElementById('etm-row-' + idx);
      if (row) row.classList.remove('is-expanded');
    } else {
      _expandirEmail(idx, msgId);
    }
  }

  /* ── Expandir email: busca corpo + anexos sob demanda ── */
  async function _expandirEmail(idx, msgId) {
    var expanded = document.getElementById('etm-expanded-' + idx);
    var row = document.getElementById('etm-row-' + idx);
    if (!expanded) return;

    expanded.style.display = '';
    if (row) row.classList.add('is-expanded');

    // Ja carregou? So mostra
    if (expanded.dataset.loaded === '1') return;

    expanded.innerHTML = '<div class="etm-loading-inline">⏳ Carregando...</div>';

    try {
      var em = await window.outlookGetEmail(msgId);
      var anexos = [];

      // SEMPRE busca anexos — corrige bug "nao pegou os anexos"
      if (window._outlookGraphCall) {
        try {
          var attResp = await window._outlookGraphCall(
            '/me/messages/' + msgId + '/attachments?$select=id,name,contentType,size,isInline'
          );
          anexos = (attResp && attResp.value) || [];
        } catch (ae) { console.warn('[email-thread] Erro anexos', ae); }
      }

      _renderizarExpandido(expanded, em, anexos, idx);
      expanded.dataset.loaded = '1';

    } catch (e) {
      expanded.innerHTML = '<div class="etm-error">❌ ' + _esc(e.message) + '</div>';
    }
  }

  /* ── Renderiza conteudo expandido de UM email ── */
  function _renderizarExpandido(container, em, anexos, idx) {
    var from = (em.from && em.from.emailAddress) || {};
    var to = (em.toRecipients || []).map(function(r) { return r.emailAddress.address; }).join(', ');
    var cc = (em.ccRecipients || []).map(function(r) { return r.emailAddress.address; }).join(', ');
    var dt = em.receivedDateTime ? new Date(em.receivedDateTime) : null;
    var conteudo = (em.body && em.body.content) || '';

    // Mostra TODOS os anexos (inclusive inline)
    var todosAnexos = anexos || [];

    var html = '';

    // Destinatarios
    html += '<div class="etm-destinatarios">';
    html += '<div><b>De:</b> ' + _esc(from.name || '') + ' &lt;' + _esc(from.address || '') + '&gt;</div>';
    html += '<div><b>Para:</b> ' + _esc(to) + '</div>';
    if (cc) html += '<div><b>Cc:</b> ' + _esc(cc) + '</div>';
    if (dt) html += '<div><b>Data:</b> ' + _esc(_fmtDataLonga(dt)) + '</div>';
    html += '</div>';

    // Conteudo
    html += '<div class="etm-conteudo">' + conteudo + '</div>';

    // Anexos
    if (todosAnexos.length > 0) {
      html += '<div class="etm-anexos">';
      html += '<div class="etm-anexos-titulo">📎 Anexos (' + todosAnexos.length + ')</div>';
      todosAnexos.forEach(function(a) {
        var sizeKB = Math.round((a.size || 0) / 1024);
        var sizeStr = sizeKB > 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';
        var ct = (a.contentType || '').toLowerCase();
        var nm = (a.name || '').toLowerCase();
        var icon = '📄';
        if (ct.indexOf('pdf') >= 0 || nm.endsWith('.pdf')) icon = '📕';
        else if (ct.indexOf('image') >= 0) icon = '🖼️';
        else if (nm.match(/\.xlsx?$/)) icon = '📊';
        else if (nm.match(/\.docx?$/)) icon = '📝';

        var previewable = ct.indexOf('image') >= 0 || ct.indexOf('pdf') >= 0 || nm.endsWith('.pdf');
        var uid = idx + '_' + (a.id || '').slice(-10);

        html += '<div class="etm-anexo-item">';
        html += '<span class="etm-anexo-icon">' + icon + '</span>';
        html += '<div class="etm-anexo-info"><div class="etm-anexo-nome">' + _esc(a.name || 'Sem nome') + '</div>';
        html += '<div class="etm-anexo-size">' + sizeStr + '</div></div>';
        html += '<div class="etm-anexo-btns">';
        if (previewable) {
          html += '<button class="etm-btn etm-btn-preview" data-msg="' + _escA(em.id) + '" data-att="' + _escA(a.id) + '" data-type="' + _escA(a.contentType || '') + '" data-uid="' + uid + '">👁 Ver</button>';
        }
        html += '<button class="etm-btn etm-btn-download" data-msg="' + _escA(em.id) + '" data-att="' + _escA(a.id) + '" data-name="' + _escA(a.name || 'anexo') + '" data-type="' + _escA(a.contentType || '') + '">⬇ Baixar</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="etm-preview-area" id="etm-pv-' + uid + '" style="display:none"></div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Listeners
    container.querySelectorAll('.etm-btn-preview').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        _previewAnexo(btn.dataset.msg, btn.dataset.att, btn.dataset.type, btn.dataset.uid, btn);
      });
    });
    container.querySelectorAll('.etm-btn-download').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        _downloadAnexo(btn.dataset.msg, btn.dataset.att, btn.dataset.name, btn.dataset.type, btn);
      });
    });
  }

  /* ── Preview inline ── */
  async function _previewAnexo(msgId, attId, type, uid, btn) {
    var el = document.getElementById('etm-pv-' + uid);
    if (!el) return;
    if (el.style.display !== 'none') { el.style.display = 'none'; btn.textContent = '👁 Ver'; return; }
    btn.textContent = '⏳...';
    try {
      var att = await window._outlookGraphCall('/me/messages/' + msgId + '/attachments/' + attId);
      if (att && att.contentBytes) {
        var ct = (type || '').toLowerCase();
        if (ct.indexOf('image') >= 0) {
          el.innerHTML = '<img src="data:' + type + ';base64,' + att.contentBytes + '" style="max-width:100%;max-height:70vh;border-radius:6px;border:1px solid #ddd;margin-top:8px" />';
        } else if (ct.indexOf('pdf') >= 0) {
          var raw = atob(att.contentBytes); var arr = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
          el.innerHTML = '<iframe src="' + URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })) + '" style="width:100%;height:70vh;border:1px solid #ddd;border-radius:6px;margin-top:8px" frameborder="0"></iframe>';
        }
        el.style.display = 'block'; btn.textContent = '👁 Esconder';
      }
    } catch (e) { btn.textContent = '❌ Erro'; }
  }

  /* ── Download ── */
  async function _downloadAnexo(msgId, attId, name, type, btn) {
    btn.textContent = '⏳...';
    try {
      var att = await window._outlookGraphCall('/me/messages/' + msgId + '/attachments/' + attId);
      if (att && att.contentBytes) {
        var raw = atob(att.contentBytes); var arr = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([arr], { type: type || 'application/octet-stream' }));
        a.download = name || 'anexo'; a.click();
        btn.textContent = '✅ OK';
        setTimeout(function() { btn.textContent = '⬇ Baixar'; }, 2000);
      }
    } catch (e) { btn.textContent = '❌ Erro'; }
  }

  /* ── Reply ── */
  async function _enviarReply(msgId, replyAll) {
    var textarea = document.getElementById('etm-reply-text');
    var btn = document.getElementById(replyAll ? 'etm-btn-reply-all' : 'etm-btn-reply');
    if (!textarea || !textarea.value.trim()) { alert('Digite uma resposta.'); return; }
    var bodyHtml = '<p>' + textarea.value.replace(/\n/g, '<br>') + '</p><br><p style="font-size:11px;color:#888">— Enviado via Projetta by Weiku</p>';
    if (btn) btn.textContent = '⏳ Enviando...';
    try {
      if (replyAll) { await window.outlookReplyAll(msgId, bodyHtml); }
      else { await window._outlookGraphCall('/me/messages/' + msgId + '/reply', { method: 'POST', body: JSON.stringify({ comment: bodyHtml }) }); }
      textarea.value = '';
      if (btn) btn.textContent = '✅ Enviado!';
      setTimeout(function() { if (btn) btn.textContent = replyAll ? '📤 Responder Todos' : '📤 Responder'; }, 2000);
    } catch (e) {
      if (btn) btn.textContent = '❌ Erro';
      alert('Erro: ' + e.message);
    }
  }

  window.EmailThread = { abrir: abrirThread };
  console.log('[email-thread] Modulo carregado.');
})();
