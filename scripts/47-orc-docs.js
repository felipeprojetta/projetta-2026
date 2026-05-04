/* eslint-disable */
/*
   ===========================================================================
   47-orc-docs.js — Modulo de Documentos do Orcamento (Fase 1 UI)
   ===========================================================================

   Felipe (sessao 2026-11): Workflow de aprovacao do CRM —

   Botoes no card do CRM (apos aprovacao DRE):
     📂 Abrir Orcamento      → modal lista versoes pra escolher e carregar
     ✏️ Revisar              → modal "tem certeza?" + reabre versao atual
     ➕ Nova Versao          → cria Versao N+1
     📄 Gerar Documentos     → PDF Proposta + PNGs (Fase 2 — placeholder)

   E no DRE quando ja' aprovado, botao 📄 Gerar Documentos tambem aparece
   junto ao botao Re-aprovar.

   API publica (window.OrcDocs):
     formatNomeArquivo(lead, tipo)    → "AGP004647 - 146510 - Camila E Andre - Proposta"
     abrirVersoesModal(leadId)        → modal escolhe versao e carrega
     revisarVersaoComConfirma(leadId) → modal confirma + abre versao em edit
     criarNovaVersao(leadId)          → cria Versao N+1 e abre na aba Orcamento
     gerarDocumentos(leadId)          → Fase 2 (placeholder por enquanto)

   Persistencia: tudo via window.Orcamento (criarVersao, obterNegocioPorLeadId,
   resumoParaCardCRM). Nao mexe em Storage direto.
   ===========================================================================
*/

(function () {
  'use strict';

  // -------------------------------------------------------------------
  // Helpers de formato de nome
  // -------------------------------------------------------------------

  /**
   * Title Case com prefixos comuns mantidos: "Arq.", "Eng.", "Dr.", "Sr."
   *   "CAMILA E ANDRE"           → "Camila E Andre"
   *   "JULLIANA WAGNER PORTA..."  → "Julliana Wagner Porta..."
   *   "arq. julliana"            → "Arq. Julliana"
   */
  function titleCase(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/\b\w/g, ch => ch.toUpperCase())
      .replace(/\bArq\./gi,  'Arq.')
      .replace(/\bEng\./gi,  'Eng.')
      .replace(/\bDr\./gi,   'Dr.')
      .replace(/\bSr\./gi,   'Sr.')
      .replace(/\bSra\./gi,  'Sra.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Sanitiza pra uso seguro em nome de arquivo:
   * remove < > : " / \ | ? * e caracteres de controle.
   */
  function sanitizeFilename(str) {
    return String(str || '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Gera o numero AGP do lead. Felipe: usa o campo lead.agp se existir,
   * senao gera "AGP" + sequencial baseado em quantos leads tem AGP definido
   * + 1, em zero-padding 6 digitos. So' gera (e persiste no lead) quando o
   * lead vai pro estagio aprovado — que e' quando precisa do numero pra
   * gerar documentos.
   *
   * Felipe pode mudar a logica depois (ex: vir do Omie). API: gerarAgp(lead).
   */
  function gerarAgp(lead) {
    if (lead && lead.agp) return lead.agp;
    // Conta leads existentes com AGP setado pra continuar a sequencia
    let proximoNum = 1;
    try {
      const crmStore = (typeof Storage !== 'undefined' && Storage.scope) ? Storage.scope('crm') : null;
      const cards = crmStore ? (crmStore.get('crmCards') || crmStore.get('leads') || []) : [];
      const numerosUsados = cards
        .map(c => (c && c.agp) || '')
        .filter(s => /^AGP\d+$/i.test(s))
        .map(s => parseInt(s.replace(/^AGP/i, ''), 10))
        .filter(n => !isNaN(n));
      if (numerosUsados.length > 0) {
        proximoNum = Math.max(...numerosUsados) + 1;
      }
    } catch (_) { /* fallback 1 */ }
    return 'AGP' + String(proximoNum).padStart(6, '0');
  }

  /**
   * Garante que o lead tem AGP definido. Se nao tem, gera, persiste no
   * card e dispara sync. Retorna o AGP final (string).
   */
  function garantirAgp(lead) {
    if (!lead) return '';
    if (lead.agp) return lead.agp;
    const agp = gerarAgp(lead);
    lead.agp = agp;
    // Persiste no Storage local (CRM vai sincronizar com Supabase)
    try {
      if (typeof Storage !== 'undefined' && Storage.scope) {
        const crmStore = Storage.scope('crm');
        const chaves = ['crmCards', 'leads'];
        for (const k of chaves) {
          const arr = crmStore.get(k);
          if (Array.isArray(arr)) {
            const idx = arr.findIndex(c => c && c.id === lead.id);
            if (idx >= 0) {
              arr[idx].agp = agp;
              crmStore.set(k, arr);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[OrcDocs] Falha ao persistir AGP no Storage:', e);
    }
    return agp;
  }

  /**
   * Monta o nome de arquivo padrao:
   *   "AGP004647 - 146510 - Camila E Andre - Proposta"
   *
   * Ordem dos componentes:
   *   AGP{numero} - {numeroReserva} - {nomeCliente em Title Case} - {tipo}
   *
   * Tipos suportados:
   *   "Proposta", "Painel Comercial", "Resultado Porta",
   *   "DRE Resumida", "Resumo Da Obra"
   */
  function formatNomeArquivo(lead, tipo) {
    if (!lead) return tipo || 'arquivo';
    const agp = garantirAgp(lead);
    const reserva = (lead.numeroReserva || '').toString().trim();
    const nome = titleCase(lead.cliente || '');
    const tipoFmt = titleCase(tipo || '');
    const partes = [agp, reserva, nome, tipoFmt].filter(Boolean);
    return sanitizeFilename(partes.join(' - '));
  }

  // -------------------------------------------------------------------
  // Modal infra — utilities pra criar modais consistentes
  // -------------------------------------------------------------------

  function fecharModal(id) {
    const m = document.getElementById(id);
    if (m) m.remove();
  }

  /**
   * Cria modal generico com overlay. Retorna o elemento root.
   * Conteudo HTML interno e' fornecido pelo caller via opts.body.
   */
  function abrirModal({ id, titulo, body, larguraMax = 520 }) {
    fecharModal(id);
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'orcdocs-modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `;
    overlay.innerHTML = `
      <div class="orcdocs-modal-card" style="
        background: #fff; border-radius: 8px;
        max-width: ${larguraMax}px; width: 100%; max-height: 90vh;
        overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        display: flex; flex-direction: column;
      ">
        <div class="orcdocs-modal-header" style="
          padding: 16px 20px; border-bottom: 1px solid #e5e7eb;
          display: flex; align-items: center; justify-content: space-between;
        ">
          <h3 style="margin: 0; font-size: 16px; color: var(--azul-escuro, #1f3658); font-weight: 700;">
            ${titulo}
          </h3>
          <button class="orcdocs-modal-close" style="
            background: transparent; border: none; font-size: 22px;
            cursor: pointer; color: #6b7280; line-height: 1; padding: 4px 8px;
          ">×</button>
        </div>
        <div class="orcdocs-modal-body" style="padding: 16px 20px; flex: 1;">
          ${body}
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fecharModal(id);
    });
    overlay.querySelector('.orcdocs-modal-close')?.addEventListener('click', () => fecharModal(id));
    document.body.appendChild(overlay);
    return overlay;
  }

  // -------------------------------------------------------------------
  // 📂 Abrir Orcamento — modal lista versoes pra escolher
  // -------------------------------------------------------------------

  function abrirVersoesModal(leadId) {
    if (!window.Orcamento || typeof window.Orcamento.resumoParaCardCRM !== 'function') {
      alert('Modulo Orcamento nao carregado. Recarregue a pagina.');
      return;
    }
    const resumo = window.Orcamento.resumoParaCardCRM(leadId);
    if (!resumo || !resumo.versoes || resumo.versoes.length === 0) {
      alert('Esse lead ainda nao tem versao salva. Clique em "Montar Orcamento" pra criar a primeira.');
      return;
    }

    // Helpers de formato local
    const fmtBR = window.fmtBR || (n => Number(n || 0).toFixed(2));
    const fmtData = window.fmtData || (s => s ? new Date(s).toLocaleDateString('pt-BR') : '');

    const linhas = resumo.versoes.map((v, i) => {
      const tag = v.ehImutavelParaCard
        ? '<span style="background:#16a34a;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;">APROVADA</span>'
        : '<span style="background:#94a3b8;color:#fff;padding:2px 6px;border-radius:3px;font-size:10px;">draft</span>';
      const valor = v.valor > 0 ? `R$ ${fmtBR(v.valor)}` : '<i style="color:#94a3b8;">sem valor</i>';
      const data = v.aprovadoEm || v.criadoEm;
      return `
        <button type="button" class="orcdocs-versao-item" data-versao-id="${v.id}" style="
          width: 100%; text-align: left; background: #f9fafb; border: 1px solid #e5e7eb;
          border-radius: 6px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer;
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          transition: background 0.15s;
        " onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='#f9fafb'">
          <div>
            <div style="font-weight: 700; color: #1f3658; font-size: 14px;">
              Versão ${v.numero}
              ${tag}
            </div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
              ${data ? fmtData(data) : ''}
            </div>
          </div>
          <div style="text-align: right; font-weight: 600; color: #16a34a; font-size: 14px;">
            ${valor}
          </div>
        </button>
      `;
    }).join('');

    abrirModal({
      id: 'orcdocs-modal-versoes',
      titulo: '📂 Abrir Orçamento — escolha uma versão',
      body: `
        <p style="margin: 0 0 12px; font-size: 13px; color: #374151;">
          Clique numa versão pra carregar de volta na aba Orçamento.
        </p>
        ${linhas}
      `,
    });

    // Handler de clique nos items
    document.querySelectorAll('#orcdocs-modal-versoes .orcdocs-versao-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const versaoId = btn.dataset.versaoId;
        if (!versaoId) return;
        carregarVersaoNaAbaOrcamento(leadId, versaoId);
        fecharModal('orcdocs-modal-versoes');
      });
    });
  }

  /**
   * Carrega uma versao especifica na aba Orcamento.
   * Sinaliza pro modulo Orcamento via Storage qual lead+versao ativar.
   */
  function carregarVersaoNaAbaOrcamento(leadId, versaoId) {
    if (typeof Storage !== 'undefined' && Storage.scope) {
      Storage.scope('app').set('orcamento_lead_ativo', leadId);
      Storage.scope('app').set('orcamento_versao_ativa', versaoId);
    }
    if (typeof App !== 'undefined' && App.navigateTo) {
      App.navigateTo('orcamento', 'item');
    }
  }

  // -------------------------------------------------------------------
  // ✏️ Revisar — abre versao atual em modo edicao (sobrescreve)
  // -------------------------------------------------------------------

  /**
   * Abre modal "Tem certeza?" e, se confirmado, reabre a ultima versao
   * em modo edicao. Felipe (req): "subscrever em cima do orcamento ja' feito"
   * — entao se a versao esta' fechada/aprovada, reabre como draft.
   */
  function revisarVersaoComConfirma(leadId) {
    const negocio = window.Orcamento && window.Orcamento.obterNegocioPorLeadId
      ? window.Orcamento.obterNegocioPorLeadId(leadId) : null;
    if (!negocio) {
      alert('Esse lead ainda nao tem orcamento. Clique em "Montar Orcamento" primeiro.');
      return;
    }
    // Pega a ultima versao (mais recente, independente de status)
    const todasVersoes = [];
    (negocio.opcoes || []).forEach(o => (o.versoes || []).forEach(v => {
      todasVersoes.push({ ...v, opcaoId: o.id });
    }));
    if (todasVersoes.length === 0) {
      alert('Esse lead nao tem nenhuma versao salva ainda.');
      return;
    }
    todasVersoes.sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
    const versaoAtual = todasVersoes[0];
    const fmtBR = window.fmtBR || (n => Number(n || 0).toFixed(2));

    abrirModal({
      id: 'orcdocs-modal-revisar',
      titulo: '⚠️ Revisar versão — Atenção',
      body: `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px;
                    padding: 12px 14px; margin-bottom: 14px; font-size: 13px; color: #78350f;">
          <strong>Tem certeza?</strong><br>
          A revisão vai <strong>sobrescrever a Versão ${versaoAtual.numero}</strong>
          ${versaoAtual.aprovadoEm ? '<strong>(que está APROVADA)</strong>' : '(que está em draft)'}.
          <br><br>
          ${versaoAtual.valorAprovado ? `Valor atual: <strong>R$ ${fmtBR(versaoAtual.valorAprovado)}</strong>` : ''}
          <br>
          Se quiser preservar o histórico, use <strong>+ Nova Versão</strong> ao invés.
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" id="orcdocs-revisar-cancelar" style="
            padding: 8px 14px; background: #f3f4f6; border: 1px solid #d1d5db;
            border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;
          ">Cancelar</button>
          <button type="button" id="orcdocs-revisar-confirmar" style="
            padding: 8px 14px; background: #f59e0b; color: #fff; border: none;
            border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 700;
          ">Sim, revisar e sobrescrever</button>
        </div>
      `,
    });

    document.getElementById('orcdocs-revisar-cancelar')?.addEventListener('click', () => {
      fecharModal('orcdocs-modal-revisar');
    });
    document.getElementById('orcdocs-revisar-confirmar')?.addEventListener('click', () => {
      fecharModal('orcdocs-modal-revisar');
      carregarVersaoNaAbaOrcamento(leadId, versaoAtual.id);
    });
  }

  // -------------------------------------------------------------------
  // ➕ Nova Versao — cria Versao N+1 e abre
  // -------------------------------------------------------------------

  function criarNovaVersao(leadId) {
    if (!window.Orcamento) {
      alert('Modulo Orcamento nao carregado. Recarregue a pagina.');
      return;
    }
    const negocio = window.Orcamento.obterNegocioPorLeadId(leadId);
    if (!negocio) {
      alert('Esse lead ainda nao tem orcamento. Clique em "Montar Orcamento" primeiro.');
      return;
    }
    // Pega a ultima opcao (sempre 1 em geral)
    const opcao = (negocio.opcoes || [])[0];
    if (!opcao) {
      alert('Esse orcamento nao tem opcoes ainda. Crie uma versao em "Montar Orcamento" primeiro.');
      return;
    }
    try {
      const nova = window.Orcamento.criarVersao({ opcaoId: opcao.id });
      if (window.showSavedDialog) window.showSavedDialog(`Versão ${nova.numero} criada.`);
      // Carrega a nova versao na aba Orcamento
      carregarVersaoNaAbaOrcamento(leadId, nova.id);
    } catch (e) {
      console.error('[OrcDocs] criarNovaVersao falhou:', e);
      alert('Erro ao criar nova versao: ' + (e.message || e));
    }
  }

  // -------------------------------------------------------------------
  // 📄 Gerar Documentos — Fase 2 (placeholder por enquanto)
  // -------------------------------------------------------------------

  function gerarDocumentos(leadId) {
    // Placeholder — implementacao real na Fase 2
    const negocio = window.Orcamento && window.Orcamento.obterNegocioPorLeadId
      ? window.Orcamento.obterNegocioPorLeadId(leadId) : null;
    let lead = null;
    try {
      const crmStore = Storage.scope('crm');
      const cards = crmStore.get('crmCards') || crmStore.get('leads') || [];
      lead = cards.find(c => c && c.id === leadId);
    } catch (_) { /* sem store */ }
    if (!lead) {
      alert('Lead nao encontrado.');
      return;
    }

    const nomeBase = formatNomeArquivo(lead, '');
    const exemplos = [
      formatNomeArquivo(lead, 'Proposta')          + '.pdf',
      formatNomeArquivo(lead, 'Painel Comercial')  + '.png',
      formatNomeArquivo(lead, 'Resultado Porta')   + '.png',
      formatNomeArquivo(lead, 'DRE Resumida')      + '.png',
      formatNomeArquivo(lead, 'Resumo Da Obra')    + '.png',
    ];
    abrirModal({
      id: 'orcdocs-modal-gerar',
      titulo: '📄 Gerar Documentos',
      larguraMax: 580,
      body: `
        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px;
                    padding: 12px 14px; margin-bottom: 14px; font-size: 13px; color: #78350f;">
          <strong>⚙️ Em construção (Fase 2):</strong><br>
          Aqui vai gerar automaticamente:
        </div>
        <ul style="margin: 0 0 14px; padding-left: 24px; font-size: 13px; color: #374151;">
          ${exemplos.map(n => `<li style="margin: 4px 0;"><code style="background:#f3f4f6;padding:2px 6px;border-radius:3px;font-size:11px;">${n}</code></li>`).join('')}
        </ul>
        <div style="font-size: 12px; color: #6b7280; line-height: 1.5;">
          <strong>Próximas fases:</strong><br>
          • Fase 2: gerar PDF/PNGs de verdade e salvar no Supabase Storage<br>
          • Fase 3: integração Microsoft Graph (rascunho Outlook com anexos reais)
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
          <button type="button" id="orcdocs-gerar-fechar" style="
            padding: 8px 14px; background: #1f3658; color: #fff; border: none;
            border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;
          ">OK, entendi</button>
        </div>
      `,
    });
    document.getElementById('orcdocs-gerar-fechar')?.addEventListener('click', () => {
      fecharModal('orcdocs-modal-gerar');
    });
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------
  window.OrcDocs = {
    formatNomeArquivo,
    titleCase,
    sanitizeFilename,
    gerarAgp,
    garantirAgp,
    abrirVersoesModal,
    revisarVersaoComConfirma,
    criarNovaVersao,
    gerarDocumentos,
    carregarVersaoNaAbaOrcamento,
  };

  console.log('[OrcDocs] modulo carregado. API:', Object.keys(window.OrcDocs));
})();
