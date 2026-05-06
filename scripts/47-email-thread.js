/* ================================================================
 * 47-email-thread.js — Thread de Emails no Card CRM
 * ================================================================
 * Felipe (sessao 09): "quer ver o ultimo email sempre, com os
 * demais em baixo e com anexo. Vejo todo historico e anexo em
 * um unico email."
 *
 * Abre um modal mostrando TODOS os emails de uma reserva:
 *   - Ultimo email (mais recente) expandido no topo
 *   - Emails mais antigos abaixo, colapsados (click pra expandir)
 *   - Anexos com preview inline (imagens) e download
 *   - Reply no final
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

  function _fmtData(d) {
    if (!d) return '';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /* ── Abre thread para um lead ── */
  async function abrirThread(leadId) {
    // Buscar lead pra pegar numero da reserva
    var leads = [];
    try {
      leads = Storage.scope('crm').get('leads') || [];
    } catch (e) { console.error('[email-thread] Storage nao disponivel', e); return; }

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
          '<div class="etm-title">📧 Emails — Reserva ' + _esc(reserva) + ' — ' + _esc(lead.cliente || '') + '</div>' +
          '<button class="etm-close" id="etm-close">×</button>' +
        '</div>' +
        '<div class="etm-body" id="etm-body">' +
          '<div class="etm-loading">⏳ Buscando emails da reserva ' + _esc(reserva) + '...</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // Fechar
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

      // Ordenar por data DESC (mais recente primeiro)
      emails.sort(function(a, b) {
        var dA = new Date(a.receivedDateTime || 0).getTime();
        var dB = new Date(b.receivedDateTime || 0).getTime();
        return dB - dA;
      });

      // Buscar corpo completo + anexos de TODOS os emails em paralelo
      document.getElementById('etm-body').innerHTML =
        '<div class="etm-loading">⏳ Carregando ' + emails.length + ' email(s) com anexos...</div>';

      var detalhes = await Promise.all(emails.map(function(em) {
        return _carregarEmailCompleto(em.id, em.hasAttachments);
      }));

      // Renderizar thread
      _renderizarThread(detalhes, reserva, lead);

    } catch (e) {
      console.error('[email-thread] Erro:', e);
      var body = document.getElementById('etm-body');
      if (body) body.innerHTML = '<div class="etm-error">❌ Erro ao buscar emails: ' + _esc(e.message) + '</div>';
    }
  }

  /* ── Carrega corpo completo + metadados de anexos ── */
  async function _carregarEmailCompleto(msgId, hasAttachments) {
    var email = await window.outlookGetEmail(msgId);
    var anexos = [];

    if (hasAttachments && window._outlookGraphCall) {
      try {
        var attResp = await window._outlookGraphCall(
          '/me/messages/' + msgId + '/attachments?$select=id,name,contentType,size,isInline'
        );
        anexos = (attResp && attResp.value) || [];
      } catch (e) {
        console.warn('[email-thread] Erro ao buscar anexos de ' + msgId, e);
      }
    }

    return { email: email, anexos: anexos };
  }

  /* ── Renderiza thread completa ── */
  function _renderizarThread(detalhes, reserva, lead) {
    var body = document.getElementById('etm-body');
    if (!body) return;

    var html = '<div class="etm-thread-count">' + detalhes.length + ' email(s) na conversa</div>';

    detalhes.forEach(function(item, idx) {
      var em = item.email;
      var anexos = item.anexos || [];
      var from = (em.from && em.from.emailAddress) || {};
      var to = (em.toRecipients || []).map(function(r) { return r.emailAddress.address; }).join(', ');
      var cc = (em.ccRecipients || []).map(function(r) { return r.emailAddress.address; }).join(', ');
      var dt = em.receivedDateTime ? new Date(em.receivedDateTime) : null;
      var conteudo = (em.body && em.body.content) || '';
      var isUltimo = idx === 0;

      // Separar anexos inline dos visiveis
      var visAnexos = anexos.filter(function(a) { return !a.isInline; });

      // Card do email
      html += '<div class="etm-email' + (isUltimo ? ' etm-email-ultimo' : '') + '" data-msg-id="' + _escA(em.id) + '">';

      // Header (clicavel pra expandir/colapsar nos emails antigos)
      html += '<div class="etm-email-header' + (isUltimo ? '' : ' etm-collapsible') + '" data-idx="' + idx + '">';
      html += '<div class="etm-email-from">';
      html += '<span class="etm-avatar">' + _esc((from.name || '?')[0]).toUpperCase() + '</span>';
      html += '<div class="etm-from-info">';
      html += '<div class="etm-from-name">' + _esc(from.name || from.address || '?') + '</div>';
      html += '<div class="etm-from-addr">' + _esc(from.address || '') + '</div>';
      html += '</div>';
      html += '</div>';
      html += '<div class="etm-email-meta">';
      if (visAnexos.length > 0) html += '<span class="etm-att-badge">📎 ' + visAnexos.length + '</span>';
      html += '<span class="etm-date">' + _esc(_fmtData(dt)) + '</span>';
      if (!isUltimo) html += '<span class="etm-expand-arrow" id="etm-arrow-' + idx + '">▶</span>';
      html += '</div>';
      html += '</div>'; // header

      // Body do email (ultimo: sempre visivel. Demais: colapsado)
      html += '<div class="etm-email-body" id="etm-body-' + idx + '" style="' + (isUltimo ? '' : 'display:none') + '">';

      // Destinatarios
      html += '<div class="etm-destinatarios">';
      html += '<div><b>Para:</b> ' + _esc(to) + '</div>';
      if (cc) html += '<div><b>Cc:</b> ' + _esc(cc) + '</div>';
      html += '</div>';

      // Conteudo do email
      html += '<div class="etm-conteudo">' + conteudo + '</div>';

      // Anexos
      if (visAnexos.length > 0) {
        html += '<div class="etm-anexos">';
        html += '<div class="etm-anexos-titulo">📎 Anexos (' + visAnexos.length + ')</div>';
        visAnexos.forEach(function(a) {
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
          var uid = em.id.slice(-8) + '_' + a.id.slice(-8);

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
          html += '</div>'; // item
          html += '<div class="etm-preview-area" id="etm-pv-' + uid + '" style="display:none"></div>';
        });
        html += '</div>'; // anexos
      }

      html += '</div>'; // body
      html += '</div>'; // email card
    });

    // Reply section
    var ultimoId = detalhes[0] && detalhes[0].email ? detalhes[0].email.id : '';
    html += '<div class="etm-reply-section">';
    html += '<div class="etm-reply-titulo">✉️ Responder</div>';
    html += '<textarea id="etm-reply-text" class="etm-reply-textarea" placeholder="Digite sua resposta..."></textarea>';
    html += '<div class="etm-reply-btns">';
    html += '<button class="etm-btn etm-btn-reply" id="etm-btn-reply" data-msg="' + _escA(ultimoId) + '">📤 Responder</button>';
    html += '<button class="etm-btn etm-btn-reply-all" id="etm-btn-reply-all" data-msg="' + _escA(ultimoId) + '">📤 Responder Todos</button>';
    html += '</div>';
    html += '</div>';

    body.innerHTML = html;

    // ── Event listeners ──

    // Expandir/colapsar emails antigos
    body.querySelectorAll('.etm-collapsible').forEach(function(h) {
      h.addEventListener('click', function() {
        var idx = h.dataset.idx;
        var b = document.getElementById('etm-body-' + idx);
        var arrow = document.getElementById('etm-arrow-' + idx);
        if (!b) return;
        if (b.style.display === 'none') {
          b.style.display = '';
          if (arrow) arrow.textContent = '▼';
        } else {
          b.style.display = 'none';
          if (arrow) arrow.textContent = '▶';
        }
      });
    });

    // Preview de anexos
    body.querySelectorAll('.etm-btn-preview').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        _previewAnexo(btn.dataset.msg, btn.dataset.att, btn.dataset.type, btn.dataset.uid, btn);
      });
    });

    // Download de anexos
    body.querySelectorAll('.etm-btn-download').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        _downloadAnexo(btn.dataset.msg, btn.dataset.att, btn.dataset.name, btn.dataset.type, btn);
      });
    });

    // Reply
    var replyBtn = document.getElementById('etm-btn-reply');
    var replyAllBtn = document.getElementById('etm-btn-reply-all');
    if (replyBtn) replyBtn.addEventListener('click', function() { _enviarReply(replyBtn.dataset.msg, false); });
    if (replyAllBtn) replyAllBtn.addEventListener('click', function() { _enviarReply(replyAllBtn.dataset.msg, true); });
  }

  /* ── Preview inline de anexo (imagem/PDF) ── */
  async function _previewAnexo(msgId, attId, type, uid, btn) {
    var el = document.getElementById('etm-pv-' + uid);
    if (!el) return;

    // Toggle
    if (el.style.display !== 'none') {
      el.style.display = 'none';
      btn.textContent = '👁 Ver';
      return;
    }

    btn.textContent = '⏳...';
    try {
      var att = await window._outlookGraphCall('/me/messages/' + msgId + '/attachments/' + attId);
      if (att && att.contentBytes) {
        var ct = (type || '').toLowerCase();
        if (ct.indexOf('image') >= 0) {
          el.innerHTML = '<img src="data:' + type + ';base64,' + att.contentBytes + '" style="max-width:100%;max-height:70vh;border-radius:6px;border:1px solid #ddd;margin-top:8px" />';
        } else if (ct.indexOf('pdf') >= 0) {
          var raw = atob(att.contentBytes);
          var arr = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
          var blobUrl = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
          el.innerHTML = '<iframe src="' + blobUrl + '" style="width:100%;height:70vh;border:1px solid #ddd;border-radius:6px;margin-top:8px" frameborder="0"></iframe>';
        }
        el.style.display = 'block';
        btn.textContent = '👁 Esconder';
      }
    } catch (e) {
      console.error('[email-thread] Preview falhou:', e);
      btn.textContent = '❌ Erro';
    }
  }

  /* ── Download de anexo ── */
  async function _downloadAnexo(msgId, attId, name, type, btn) {
    btn.textContent = '⏳...';
    try {
      var att = await window._outlookGraphCall('/me/messages/' + msgId + '/attachments/' + attId);
      if (att && att.contentBytes) {
        var raw = atob(att.contentBytes);
        var arr = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        var blob = new Blob([arr], { type: type || 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name || 'anexo'; a.click();
        URL.revokeObjectURL(url);
        btn.textContent = '✅ OK';
        setTimeout(function() { btn.textContent = '⬇ Baixar'; }, 2000);
      }
    } catch (e) {
      console.error('[email-thread] Download falhou:', e);
      btn.textContent = '❌ Erro';
    }
  }

  /* ── Enviar reply ── */
  async function _enviarReply(msgId, replyAll) {
    var textarea = document.getElementById('etm-reply-text');
    var btn = document.getElementById(replyAll ? 'etm-btn-reply-all' : 'etm-btn-reply');
    if (!textarea || !textarea.value.trim()) {
      alert('Digite uma resposta antes de enviar.');
      return;
    }
    var bodyHtml = '<p>' + textarea.value.replace(/\n/g, '<br>') + '</p>'
      + '<br><p style="font-size:11px;color:#888">— Enviado via Projetta by Weiku</p>';
    if (btn) btn.textContent = '⏳ Enviando...';
    try {
      if (replyAll) {
        await window.outlookReplyAll(msgId, bodyHtml);
      } else {
        await window._outlookGraphCall('/me/messages/' + msgId + '/reply', {
          method: 'POST',
          body: JSON.stringify({ comment: bodyHtml })
        });
      }
      textarea.value = '';
      if (btn) btn.textContent = '✅ Enviado!';
      setTimeout(function() {
        if (btn) btn.textContent = replyAll ? '📤 Responder Todos' : '📤 Responder';
      }, 2000);
    } catch (e) {
      console.error('[email-thread] Reply falhou:', e);
      if (btn) btn.textContent = '❌ Erro';
      alert('Erro ao enviar resposta: ' + e.message);
    }
  }

  // ── Expor ──
  window.EmailThread = {
    abrir: abrirThread
  };

  console.log('[email-thread] Modulo carregado.');
})();
