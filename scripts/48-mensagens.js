/* 48-mensagens.js — Modulo Mensagens (Cadastros).
   Felipe sessao 2026-08: 'dentro da aba mensagem deixe a mensagem padrao
   que ira para whatsapp (sendo um para cliente outra para representante)
   mensagem padrao que vai por email (sendo uma que vai para representante
   e outra para cliente)'.

   Estrutura:
     4 templates (cards):
       - whatsapp_cliente: WhatsApp pra cliente
       - whatsapp_rep:     WhatsApp pra representante
       - email_cliente:    Email pra cliente (subject + body)
       - email_rep:        Email pra representante (subject + body)

   Variaveis de substituicao disponiveis nos templates (entre chaves):
     {nome_cliente}        - nome do cliente do card CRM
     {nome_representante}  - nome do representante cadastrado no card
     {nome_usuario}        - nome do usuario logado (vai no rodape)
     {agp}                 - codigo AGP do orcamento
     {numero_reserva}      - numero da reserva Weiku
     {valor_orcamento}     - valor R$ formatado (R$ 84.628,68)
     {data_atual}          - data de hoje (DD/MM/YYYY)

   API exposta:
     Mensagens.render(container)         - renderiza UI no Cadastros
     Mensagens.getTemplates()            - retorna {wpp_cliente, ...}
     Mensagens.aplicarVariaveis(tpl, ctx) - substitui {var} por valor

   Persistencia: Storage.scope('cadastros').get('mensagens_templates')
*/

const Mensagens = (() => {
  const store = Storage.scope('cadastros');

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============================================================
  // TEMPLATES PADRAO (Felipe sessao 2026-08)
  // ============================================================
  const TEMPLATES_DEFAULT = {
    whatsapp_cliente: {
      label:    'WhatsApp · Cliente',
      icon:     '📱',
      tipo:     'whatsapp',
      destino:  'cliente',
      body:
`Olá {nome_cliente}! Tudo bem?

Aqui é {nome_usuario} da Projetta Portas Exclusivas.

A proposta comercial do seu projeto AGP {agp} está pronta!

📋 Reserva: {numero_reserva}
💰 Valor: {valor_orcamento}

Estou à disposição para esclarecer qualquer dúvida.

Atenciosamente,
{nome_usuario}`,
    },
    whatsapp_rep: {
      label:    'WhatsApp · Representante',
      icon:     '📱',
      tipo:     'whatsapp',
      destino:  'representante',
      body:
`Olá {nome_representante}!

Finalizamos o orçamento da reserva {numero_reserva}:

👤 Cliente: {nome_cliente}
🏷️ AGP: {agp}
💰 Valor: {valor_orcamento}

Pode validar antes de eu enviar pro cliente?

Att,
{nome_usuario}`,
    },
    email_cliente: {
      label:    'Email · Cliente',
      icon:     '📧',
      tipo:     'email',
      destino:  'cliente',
      subject:  'Proposta Comercial Projetta — AGP {agp}',
      body:
`Prezado(a) {nome_cliente},

É um prazer entrar em contato com você. Segue em anexo a proposta comercial referente ao seu projeto.

Dados do orçamento:
• Reserva: {numero_reserva}
• AGP: {agp}
• Valor: {valor_orcamento}
• Data: {data_atual}

Permaneço à disposição para esclarecer qualquer dúvida ou ajuste necessário.

Atenciosamente,
{nome_usuario}
Projetta Portas Exclusivas LTDA`,
    },
    email_rep: {
      label:    'Email · Representante',
      icon:     '📧',
      tipo:     'email',
      destino:  'representante',
      subject:  'Orçamento finalizado — Reserva {numero_reserva}',
      body:
`Olá {nome_representante},

Finalizamos o orçamento da reserva {numero_reserva}. Segue em anexo a proposta comercial e o painel comercial.

Resumo:
• Cliente: {nome_cliente}
• AGP: {agp}
• Valor: {valor_orcamento}
• Data: {data_atual}

Por favor valide antes de eu encaminhar diretamente ao cliente.

Atenciosamente,
{nome_usuario}
Projetta Portas Exclusivas LTDA`,
    },
  };

  // ============================================================
  // PERSISTENCIA
  // ============================================================
  function getTemplates() {
    const salvos = store.get('mensagens_templates') || {};
    const result = {};
    Object.keys(TEMPLATES_DEFAULT).forEach(id => {
      const def = TEMPLATES_DEFAULT[id];
      const sal = salvos[id] || {};
      result[id] = Object.assign({}, def);
      // Sobrescreve campos editaveis se salvos
      if (sal.body !== undefined)    result[id].body    = sal.body;
      if (sal.subject !== undefined) result[id].subject = sal.subject;
    });
    return result;
  }

  function salvarTemplates(templates) {
    // Salva apenas campos editaveis (body, subject) — label/icon/tipo fixos
    const slim = {};
    Object.keys(templates).forEach(id => {
      slim[id] = {
        body: String(templates[id].body || ''),
      };
      if (templates[id].subject !== undefined) {
        slim[id].subject = String(templates[id].subject || '');
      }
    });
    store.set('mensagens_templates', slim);
  }

  function resetar() {
    store.set('mensagens_templates', null);
  }

  // ============================================================
  // SUBSTITUICAO DE VARIAVEIS
  // ============================================================
  /**
   * Aplica variaveis num texto. Variaveis nao definidas no ctx ficam
   * vazias no resultado (sem deixar a chave literal).
   * Ex: aplicarVariaveis("Olá {nome_cliente}", {nome_cliente: 'Felipe'})
   *     → "Olá Felipe"
   */
  function aplicarVariaveis(texto, ctx) {
    ctx = ctx || {};
    return String(texto || '').replace(/\{([a-z_]+)\}/g, (m, key) => {
      const v = ctx[key];
      return (v === undefined || v === null) ? '' : String(v);
    });
  }

  // ============================================================
  // UI — RENDER
  // ============================================================
  function render(container) {
    const templates = getTemplates();

    const cardsHtml = Object.keys(templates).map(id => {
      const t = templates[id];
      const isEmail = t.tipo === 'email';
      return `
        <div class="msg-card" style="
          background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
          padding: 16px; margin-bottom: 14px;
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:15px;font-weight:700;color:#1f3658;">
              <span style="font-size:18px;">${t.icon}</span> ${escapeHtml(t.label)}
            </div>
            <span style="font-size:11px;color:#6b7280;font-style:italic;">
              destino: <b>${escapeHtml(t.destino)}</b>
            </span>
          </div>

          ${isEmail ? `
            <label style="display:block;margin-bottom:8px;">
              <span style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Assunto</span>
              <input type="text" class="msg-input-subject" data-id="${id}"
                     value="${escapeHtml(t.subject || '')}"
                     style="width:100%;padding:6px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;" />
            </label>
          ` : ''}

          <label style="display:block;">
            <span style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Mensagem</span>
            <textarea class="msg-textarea-body" data-id="${id}" rows="${isEmail ? 12 : 9}"
                      style="width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:4px;font-size:13px;font-family:'Segoe UI',sans-serif;line-height:1.5;resize:vertical;">${escapeHtml(t.body || '')}</textarea>
          </label>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="max-width:900px;">
        <div class="info-banner" style="margin-bottom:14px;">
          <span class="t-strong">📨 Mensagens Padrão:</span>
          Templates usados pelo CRM ao enviar email ou WhatsApp diretamente do card.
          Use <code>{variavel}</code> entre chaves pra inserir dados dinâmicos.
        </div>

        <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;">
          <b style="color:#1e40af;">Variáveis disponíveis:</b><br>
          <code>{nome_cliente}</code> · <code>{nome_representante}</code> · <code>{nome_usuario}</code> ·
          <code>{agp}</code> · <code>{numero_reserva}</code> · <code>{valor_orcamento}</code> · <code>{data_atual}</code>
        </div>

        ${cardsHtml}

        <div style="display:flex;gap:10px;align-items:center;margin-top:14px;">
          <button type="button" id="msg-salvar"
                  style="background:#16a34a;color:#fff;border:none;border-radius:5px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;">
            💾 Salvar Alterações
          </button>
          <button type="button" id="msg-restaurar"
                  style="background:#fff;color:#dc2626;border:1px solid #dc2626;border-radius:5px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;">
            ↺ Restaurar Padrão
          </button>
          <span id="msg-status" style="margin-left:10px;font-size:12px;color:#6b7280;"></span>
        </div>
      </div>
    `;

    // Handler: Salvar
    container.querySelector('#msg-salvar')?.addEventListener('click', () => {
      const novos = {};
      // Lê textarea bodies
      container.querySelectorAll('.msg-textarea-body').forEach(ta => {
        const id = ta.dataset.id;
        if (!novos[id]) novos[id] = {};
        novos[id].body = ta.value;
      });
      // Lê inputs de subject (email)
      container.querySelectorAll('.msg-input-subject').forEach(inp => {
        const id = inp.dataset.id;
        if (!novos[id]) novos[id] = {};
        novos[id].subject = inp.value;
      });
      try {
        salvarTemplates(novos);
        const status = container.querySelector('#msg-status');
        if (status) {
          status.textContent = '✅ Salvo!';
          status.style.color = '#16a34a';
          setTimeout(() => { status.textContent = ''; }, 4000);
        }
      } catch (err) {
        console.error('[Mensagens] erro ao salvar:', err);
        alert('Falha ao salvar: ' + (err.message || err));
      }
    });

    // Handler: Restaurar
    container.querySelector('#msg-restaurar')?.addEventListener('click', () => {
      if (!confirm('Restaurar todos os templates pros valores padrão?\n\nIsso descarta suas edições.')) return;
      resetar();
      render(container);
    });
  }

  return {
    render,
    getTemplates,
    aplicarVariaveis,
  };
})();

if (typeof window !== 'undefined') window.Mensagens = Mensagens;
