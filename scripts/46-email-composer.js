/* 46-email-composer.js — Modal de composicao de email pro Outlook.
 *
 * Felipe sessao 2026-08: o botao "Email" do card (10-crm.js) chamava
 * window.outlookReplyAll IMEDIATAMENTE - enviava sem revisao. Felipe
 * pediu "primeiro abrir o email para eu ler/editar, depois inserir a
 * proposta comercial, ai sim disparar".
 *
 * Este modulo expoe window.OutlookComposer.open(opts) que abre um
 * modal com:
 *   - Corpo editavel (HTML via contenteditable)
 *   - Lista de anexos (pre-anexados + input pra adicionar manualmente)
 *   - Botao Cancelar / Enviar
 *
 * Self-contained (cria seu proprio CSS/HTML inline). NAO depende de
 * outros modulos do projeto - apenas usa window.outlookReplyAll de
 * 35-outlook.js no momento do envio.
 *
 * Uso:
 *   await window.OutlookComposer.open({
 *     msgId: 'xxx',                  // ID do email original (pra reply-all)
 *     subject: 'Re: Reserva 146508', // exibicao apenas (assunto vai no replyAll)
 *     bodyHtml: '<p>...</p>',        // HTML inicial do corpo
 *     attachments: [],               // anexos pre-carregados [{name, contentType, contentBytes}]
 *     onSent: () => {...},           // callback apos envio bem-sucedido
 *     onCancel: () => {...}          // callback ao cancelar
 *   });
 */
(function() {
  'use strict';

  // CSS inline (injetado uma vez)
  var CSS_INJETADO = false;
  function injetarCSS() {
    if (CSS_INJETADO) return;
    CSS_INJETADO = true;
    var style = document.createElement('style');
    style.id = 'email-composer-style';
    style.textContent = ''
      + '.ec-overlay {'
      + '  position: fixed; inset: 0; background: rgba(0,0,0,0.5);'
      + '  z-index: 99998; display: flex; align-items: center; justify-content: center;'
      + '  padding: 20px;'
      + '}'
      + '.ec-modal {'
      + '  background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);'
      + '  width: 100%; max-width: 720px; max-height: 90vh;'
      + '  display: flex; flex-direction: column; font-family: inherit;'
      + '}'
      + '.ec-header {'
      + '  padding: 16px 20px; border-bottom: 1px solid #e5e7eb;'
      + '  display: flex; align-items: center; justify-content: space-between;'
      + '}'
      + '.ec-header h3 { margin: 0; font-size: 16px; color: #1f2937; }'
      + '.ec-close {'
      + '  background: none; border: none; font-size: 22px; cursor: pointer;'
      + '  color: #6b7280; padding: 0 4px;'
      + '}'
      + '.ec-close:hover { color: #1f2937; }'
      + '.ec-body { padding: 16px 20px; overflow-y: auto; flex: 1; }'
      + '.ec-subject { font-size: 13px; color: #6b7280; margin-bottom: 12px; }'
      + '.ec-subject b { color: #1f2937; }'
      + '.ec-editor {'
      + '  border: 1px solid #d1d5db; border-radius: 6px; padding: 12px;'
      + '  min-height: 220px; max-height: 380px; overflow-y: auto;'
      + '  font-size: 13px; line-height: 1.6; color: #1f2937;'
      + '  outline: none;'
      + '}'
      + '.ec-editor:focus { border-color: #0078d4; box-shadow: 0 0 0 2px rgba(0,120,212,0.15); }'
      + '.ec-editor p { margin: 0 0 8px; }'
      + '.ec-anexos {'
      + '  margin-top: 14px; padding: 12px; background: #f9fafb;'
      + '  border-radius: 6px; border: 1px solid #e5e7eb;'
      + '}'
      + '.ec-anexos-titulo { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px; }'
      + '.ec-anexo-item {'
      + '  display: flex; align-items: center; gap: 8px; padding: 6px 8px;'
      + '  background: #fff; border: 1px solid #e5e7eb; border-radius: 4px;'
      + '  margin-bottom: 6px; font-size: 12px;'
      + '}'
      + '.ec-anexo-nome { flex: 1; color: #1f2937; word-break: break-all; }'
      + '.ec-anexo-tam { color: #6b7280; font-size: 11px; }'
      + '.ec-anexo-rm {'
      + '  background: none; border: none; color: #dc2626; cursor: pointer;'
      + '  font-size: 14px; padding: 0 4px;'
      + '}'
      + '.ec-anexar-btn {'
      + '  display: inline-block; padding: 6px 12px; background: #fff;'
      + '  border: 1px dashed #9ca3af; border-radius: 4px; cursor: pointer;'
      + '  font-size: 12px; color: #374151;'
      + '}'
      + '.ec-anexar-btn:hover { border-color: #0078d4; color: #0078d4; }'
      + '.ec-footer {'
      + '  padding: 14px 20px; border-top: 1px solid #e5e7eb;'
      + '  display: flex; justify-content: flex-end; gap: 10px;'
      + '}'
      + '.ec-btn {'
      + '  padding: 8px 18px; border-radius: 6px; font-size: 13px; cursor: pointer;'
      + '  font-weight: 600; border: none; transition: opacity 0.15s;'
      + '}'
      + '.ec-btn:disabled { opacity: 0.6; cursor: not-allowed; }'
      + '.ec-btn-cancel { background: #fff; color: #374151; border: 1px solid #d1d5db; }'
      + '.ec-btn-cancel:hover:not(:disabled) { background: #f3f4f6; }'
      + '.ec-btn-send { background: #0078d4; color: #fff; }'
      + '.ec-btn-send:hover:not(:disabled) { background: #106ebe; }'
      + '.ec-erro {'
      + '  margin-top: 8px; padding: 8px 12px; background: #fef2f2;'
      + '  border: 1px solid #fecaca; border-radius: 4px; color: #991b1b;'
      + '  font-size: 12px;'
      + '}';
    document.head.appendChild(style);
  }

  // Formata bytes em KB/MB
  function fmtTamanho(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Le um File como base64 (pra Outlook attachment)
  function lerArquivoBase64(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() {
        // result e' "data:tipo;base64,XXXX" - tira o prefixo
        var dataUrl = reader.result;
        var idx = dataUrl.indexOf(',');
        resolve({
          name: file.name,
          contentType: file.type || 'application/octet-stream',
          contentBytes: idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl,
          tamanho: file.size,
        });
      };
      reader.onerror = function() { reject(new Error('Falha ao ler arquivo: ' + file.name)); };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Abre o modal de composicao de email.
   * Retorna Promise que resolve quando user envia ou cancela.
   */
  window.OutlookComposer = {
    open: function(opts) {
      injetarCSS();
      opts = opts || {};
      var msgId       = opts.msgId || '';
      var to          = String(opts.to || '').trim();
      var subject     = opts.subject || (msgId ? 'Responder email' : 'Novo email');
      var bodyHtml    = opts.bodyHtml || '';
      var attachments = (opts.attachments || []).slice();  // copia
      var onSent      = opts.onSent   || function() {};
      var onCancel    = opts.onCancel || function() {};

      // Felipe sessao 2026-08: 2 modos
      //   reply-all: tem msgId, sem 'to' (responde thread existente via outlookReplyAll)
      //   novo:      tem 'to', sem msgId (cria email novo via outlookSendMail)
      var modoNovo = !msgId && !!to;
      var headerTitulo = modoNovo ? '📧 Novo Email' : '📧 Responder Email';
      var paraLinha = modoNovo
        ? '<div class="ec-subject"><b>Para:</b> ' + escapeHtml(to) + '</div>'
        : '';

      // ---- Constroi modal ----
      var overlay = document.createElement('div');
      overlay.className = 'ec-overlay';
      overlay.innerHTML = ''
        + '<div class="ec-modal">'
        +   '<div class="ec-header">'
        +     '<h3>' + headerTitulo + '</h3>'
        +     '<button class="ec-close" type="button" title="Cancelar">×</button>'
        +   '</div>'
        +   '<div class="ec-body">'
        +     paraLinha
        +     '<div class="ec-subject"><b>Assunto:</b> ' + escapeHtml(subject) + '</div>'
        +     '<div class="ec-editor" contenteditable="true"></div>'
        +     '<div class="ec-anexos">'
        +       '<div class="ec-anexos-titulo">📎 Anexos</div>'
        +       '<div class="ec-anexos-lista"></div>'
        +       '<label class="ec-anexar-btn">+ Anexar arquivo<input type="file" multiple style="display:none" /></label>'
        +     '</div>'
        +     '<div class="ec-erro" style="display:none"></div>'
        +   '</div>'
        +   '<div class="ec-footer">'
        +     '<button class="ec-btn ec-btn-cancel" type="button">Cancelar</button>'
        +     '<button class="ec-btn ec-btn-send" type="button">Enviar</button>'
        +   '</div>'
        + '</div>';

      document.body.appendChild(overlay);

      var editor      = overlay.querySelector('.ec-editor');
      var anexosLista = overlay.querySelector('.ec-anexos-lista');
      var anexarInput = overlay.querySelector('input[type="file"]');
      var btnCancelar = overlay.querySelector('.ec-btn-cancel');
      var btnEnviar   = overlay.querySelector('.ec-btn-send');
      var btnFechar   = overlay.querySelector('.ec-close');
      var divErro     = overlay.querySelector('.ec-erro');

      // Define HTML inicial do editor (preserva formatacao)
      editor.innerHTML = bodyHtml;
      editor.focus();

      // ---- Renderiza lista de anexos ----
      function renderizarAnexos() {
        anexosLista.innerHTML = '';
        if (!attachments.length) {
          anexosLista.innerHTML = '<div style="font-size:11px;color:#9ca3af;font-style:italic;margin-bottom:6px;">Nenhum anexo. Clique abaixo pra anexar arquivos.</div>';
          return;
        }
        attachments.forEach(function(att, idx) {
          var item = document.createElement('div');
          item.className = 'ec-anexo-item';
          item.innerHTML = ''
            + '<span style="font-size:14px">📄</span>'
            + '<span class="ec-anexo-nome">' + escapeHtml(att.name) + '</span>'
            + '<span class="ec-anexo-tam">' + fmtTamanho(att.tamanho || 0) + '</span>'
            + '<button class="ec-anexo-rm" type="button" title="Remover">×</button>';
          item.querySelector('.ec-anexo-rm').addEventListener('click', function() {
            attachments.splice(idx, 1);
            renderizarAnexos();
          });
          anexosLista.appendChild(item);
        });
      }
      renderizarAnexos();

      // ---- Anexar arquivo ----
      anexarInput.addEventListener('change', async function() {
        var files = Array.from(anexarInput.files || []);
        for (var i = 0; i < files.length; i++) {
          try {
            var att = await lerArquivoBase64(files[i]);
            attachments.push(att);
          } catch (e) {
            mostrarErro('Falha ao ler ' + files[i].name + ': ' + e.message);
          }
        }
        anexarInput.value = '';  // permite re-anexar mesmo arquivo
        renderizarAnexos();
      });

      // ---- Mostra erro ----
      function mostrarErro(msg) {
        divErro.style.display = 'block';
        divErro.textContent = msg;
      }

      // ---- Cancelar/Fechar ----
      function fechar(callback) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (callback) callback();
      }
      btnCancelar.addEventListener('click', function() { fechar(onCancel); });
      btnFechar.addEventListener('click',   function() { fechar(onCancel); });
      // Click fora do modal nao fecha (evita perda acidental)

      // Atalhos: Esc cancela, Ctrl+Enter envia
      function onKey(e) {
        if (e.key === 'Escape') {
          fechar(onCancel);
          document.removeEventListener('keydown', onKey);
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          btnEnviar.click();
        }
      }
      document.addEventListener('keydown', onKey);

      // ---- Enviar ----
      btnEnviar.addEventListener('click', async function() {
        // Felipe sessao 2026-08: bifurca em modo novo vs reply-all
        if (modoNovo) {
          if (!window.outlookSendMail || typeof window.outlookSendMail !== 'function') {
            mostrarErro('Modulo Outlook nao carregado. Recarregue a pagina.');
            return;
          }
        } else {
          if (!window.outlookReplyAll || typeof window.outlookReplyAll !== 'function') {
            mostrarErro('Modulo Outlook nao carregado. Recarregue a pagina.');
            return;
          }
          if (!msgId) {
            mostrarErro('ID do email original ausente. Cancele e tente novamente.');
            return;
          }
        }
        var bodyAtual = editor.innerHTML.trim();
        if (!bodyAtual) {
          mostrarErro('Corpo do email vazio. Escreva algo antes de enviar.');
          return;
        }

        btnEnviar.disabled = true;
        btnCancelar.disabled = true;
        btnEnviar.textContent = '⏳ Enviando...';
        divErro.style.display = 'none';

        try {
          var attsParaEnvio = attachments.map(function(a) {
            return {
              name: a.name,
              contentType: a.contentType,
              contentBytes: a.contentBytes,
            };
          });
          if (modoNovo) {
            await window.outlookSendMail({
              to: [to],
              subject: subject,
              body: bodyAtual,
              bodyType: 'HTML',
              attachments: attsParaEnvio,
            });
          } else {
            await window.outlookReplyAll(msgId, bodyAtual, attsParaEnvio);
          }
          document.removeEventListener('keydown', onKey);
          fechar(onSent);
        } catch (e) {
          console.error('[email-composer] erro ao enviar:', e);
          mostrarErro('Falha ao enviar: ' + (e.message || e));
          btnEnviar.disabled = false;
          btnCancelar.disabled = false;
          btnEnviar.textContent = 'Enviar';
        }
      });
    },
  };

  // Helper local
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  console.log('[email-composer] modulo carregado. API: window.OutlookComposer.open({msgId, subject, bodyHtml, attachments, onSent, onCancel})');
})();
