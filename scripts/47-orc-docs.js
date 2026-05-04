/* eslint-disable */
/*
   ===========================================================================
   47-orc-docs.js — Modulo de Documentos do Orcamento
   ===========================================================================

   Felipe (sessao 2026-11):
     - Workflow de aprovacao do CRM com 4 botoes verticais minimalistas
     - AGP coletado do proprio card (nao gera automatico)
     - Geracao real de PDF Proposta + 4 PNGs (Painel Comercial, Resultado
       Porta, DRE Resumida, Resumo da Obra)
     - Email Outlook (Fase 3 — Microsoft Graph, futuro)

   API publica (window.OrcDocs):
     formatNomeArquivo(lead, tipo)    → "AGP004647 - 146510 - Camila E Andre - Proposta"
     abrirVersoesModal(leadId)        → modal escolhe versao e carrega
     revisarVersaoComConfirma(leadId) → modal confirma + abre versao em edit
     criarNovaVersao(leadId)          → cria Versao N+1 e abre na aba
     gerarDocumentos(leadId)          → gera PDF + 4 PNGs e baixa todos
   ===========================================================================
*/

(function () {
  'use strict';

  // -------------------------------------------------------------------
  // Helpers de formato de nome
  // -------------------------------------------------------------------

  function titleCase(str) {
    if (!str) return '';
    const SIGLAS = ['DRE', 'ACM', 'PA', 'PI', 'RT', 'NF', 'CNPJ', 'CPF', 'KESO',
                    'PNG', 'PDF', 'XLSX', 'CRM', 'OCR', 'AGP', 'SAP'];
    let out = String(str)
      .toLowerCase()
      .replace(/\b\w/g, ch => ch.toUpperCase())
      .replace(/\bArq\./gi,  'Arq.')
      .replace(/\bEng\./gi,  'Eng.')
      .replace(/\bDr\./gi,   'Dr.')
      .replace(/\bSr\./gi,   'Sr.')
      .replace(/\bSra\./gi,  'Sra.')
      .replace(/\s+/g, ' ')
      .trim();
    SIGLAS.forEach(sigla => {
      const re = new RegExp('\\b' + sigla + '\\b', 'gi');
      out = out.replace(re, sigla);
    });
    return out;
  }

  function sanitizeFilename(str) {
    return String(str || '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Felipe: AGP vem do card (lead.numeroAGP). Nao gera automatico. */
  function obterAgp(lead) {
    if (!lead) return '';
    return String(lead.numeroAGP || '').trim();
  }

  function formatNomeArquivo(lead, tipo) {
    if (!lead) return tipo || 'arquivo';
    const agp = obterAgp(lead);
    const reserva = (lead.numeroReserva || '').toString().trim();
    const nome = titleCase(lead.cliente || '');
    const tipoFmt = titleCase(tipo || '');
    const partes = [agp, reserva, nome, tipoFmt].filter(Boolean);
    return sanitizeFilename(partes.join(' - '));
  }

  // -------------------------------------------------------------------
  // Modal infra
  // -------------------------------------------------------------------

  function fecharModal(id) {
    const m = document.getElementById(id);
    if (m) m.remove();
  }

  function abrirModal({ id, titulo, body, larguraMax = 520 }) {
    fecharModal(id);
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 16px;
    `;
    overlay.innerHTML = `
      <div style="
        background: #fff; border-radius: 8px;
        max-width: ${larguraMax}px; width: 100%; max-height: 90vh;
        overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        display: flex; flex-direction: column;
      ">
        <div style="
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
        <div style="padding: 16px 20px; flex: 1;">
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

  function toast(msg, tipo = 'info') {
    const cores = {
      info:    { bg: '#dbeafe', fg: '#1e3a8a', border: '#93c5fd' },
      sucesso: { bg: '#dcfce7', fg: '#14532d', border: '#86efac' },
      erro:    { bg: '#fee2e2', fg: '#7f1d1d', border: '#fca5a5' },
      aviso:   { bg: '#fef3c7', fg: '#78350f', border: '#fcd34d' },
    };
    const c = cores[tipo] || cores.info;
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 16px; right: 16px;
      background: ${c.bg}; color: ${c.fg}; border: 1px solid ${c.border};
      padding: 12px 16px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000; font-size: 13px; font-weight: 600; max-width: 320px;
      animation: orcdocs-slide-in 0.25s ease-out;
    `;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // -------------------------------------------------------------------
  // 📂 Abrir Orcamento
  // -------------------------------------------------------------------

  function abrirVersoesModal(leadId) {
    if (!window.Orcamento || typeof window.Orcamento.resumoParaCardCRM !== 'function') {
      alert('Modulo Orcamento nao carregado. Recarregue a pagina.');
      return;
    }
    const resumo = window.Orcamento.resumoParaCardCRM(leadId);
    if (!resumo || !resumo.versoes || resumo.versoes.length === 0) {
      alert('Esse lead ainda nao tem versao salva.\nUse "+ Nova Versao" pra criar a primeira.');
      return;
    }

    const fmtBR = window.fmtBR || (n => Number(n || 0).toFixed(2));
    const fmtData = window.fmtData || (s => s ? new Date(s).toLocaleDateString('pt-BR') : '');

    const linhas = resumo.versoes.map((v) => {
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
              Versão ${v.numero} ${tag}
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

    document.querySelectorAll('#orcdocs-modal-versoes .orcdocs-versao-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const versaoId = btn.dataset.versaoId;
        if (!versaoId) return;
        carregarVersaoNaAbaOrcamento(leadId, versaoId);
        fecharModal('orcdocs-modal-versoes');
      });
    });
  }

  function carregarVersaoNaAbaOrcamento(leadId, versaoId) {
    if (typeof Storage !== 'undefined' && Storage.scope) {
      Storage.scope('app').set('orcamento_lead_ativo', leadId);
      if (versaoId) Storage.scope('app').set('orcamento_versao_ativa', versaoId);
    }
    if (typeof App !== 'undefined' && App.navigateTo) {
      App.navigateTo('orcamento', 'item');
    }
  }

  // -------------------------------------------------------------------
  // ✏️ Revisar
  // -------------------------------------------------------------------

  function revisarVersaoComConfirma(leadId) {
    const negocio = window.Orcamento && window.Orcamento.obterNegocioPorLeadId
      ? window.Orcamento.obterNegocioPorLeadId(leadId) : null;
    if (!negocio) {
      alert('Esse lead ainda nao tem orcamento. Clique em "Montar Orcamento" primeiro.');
      return;
    }
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
      // Felipe sessao 2026-08: "apos aprovar v1 nao pode alterar mais nada,
      // somente se eu apertar botao revisar". Ao confirmar Revisar,
      // DESTRAVA a versao removendo flags de aprovacao. lead.valor no card
      // permanece intacto ate o usuario reaprovar.
      try {
        if (window.Orcamento && typeof window.Orcamento.destravarVersao === 'function') {
          window.Orcamento.destravarVersao(versaoAtual.id);
        }
      } catch (e) {
        console.warn('[OrcDocs] destravarVersao falhou:', e);
      }
      carregarVersaoNaAbaOrcamento(leadId, versaoAtual.id);
    });
  }

  // -------------------------------------------------------------------
  // ➕ Nova Versao
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
    const opcao = (negocio.opcoes || [])[0];
    if (!opcao) {
      alert('Esse orcamento nao tem opcoes ainda. Crie uma versao em "Montar Orcamento" primeiro.');
      return;
    }
    // Felipe sessao 2026-08: pega a ultima versao como BASE pro modo
    // 'reset-calculos' (mantem caracteristicas da porta, zera calculos).
    const ultimaVersao = (opcao.versoes || []).slice(-1)[0];
    if (!ultimaVersao) {
      alert('Esse orcamento nao tem nenhuma versao ainda.');
      return;
    }
    try {
      // Felipe sessao 2026-08: usa modo 'reset-calculos' em vez de criarVersao
      // direto. Mantem aba Caracteristicas da Porta intacta (largura, altura,
      // modelo, cor, alisar, revestimento, etc) e zera DRE/calculos/custos/
      // aprovacao. Versao anterior fica fechada como historico.
      const nova = window.Orcamento.criarNovaVersao(ultimaVersao.id, 'reset-calculos');
      toast(`Versão ${nova.numero} criada — caracteristicas mantidas, calculos zerados.`, 'sucesso');
      carregarVersaoNaAbaOrcamento(leadId, nova.id);
    } catch (e) {
      console.error('[OrcDocs] criarNovaVersao falhou:', e);
      alert('Erro ao criar nova versao: ' + (e.message || e));
    }
  }

  // -------------------------------------------------------------------
  // 📄 Gerar Documentos — Fase 2 (geracao real)
  // -------------------------------------------------------------------

  function obterLead(leadId) {
    try {
      const crmStore = Storage.scope('crm');
      const cards = crmStore.get('crmCards') || crmStore.get('leads') || [];
      return cards.find(c => c && c.id === leadId);
    } catch (_) {
      return null;
    }
  }

  function obterVersaoMaisRelevante(leadId) {
    const resumo = window.Orcamento && window.Orcamento.resumoParaCardCRM
      ? window.Orcamento.resumoParaCardCRM(leadId) : null;
    if (!resumo || !resumo.versoes || resumo.versoes.length === 0) return null;
    return resumo.versoes[0];
  }

  function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function gerarDocumentos(leadId) {
    const lead = obterLead(leadId);
    if (!lead) {
      alert('Lead nao encontrado.');
      return;
    }

    if (!obterAgp(lead)) {
      alert(
        '⚠️ Campo AGP esta vazio neste card.\n\n' +
        'Preencha o numero AGP no card antes de gerar os documentos.\n' +
        '(Ex: AGP004647)'
      );
      return;
    }

    const versaoResumo = obterVersaoMaisRelevante(leadId);
    if (!versaoResumo) {
      alert('Esse lead nao tem versao salva. Cria uma versao no Orcamento primeiro.');
      return;
    }
    const versaoId = versaoResumo.id;

    if (!window.Orcamento ||
        typeof window.Orcamento.gerarRelatorioPNGBlob !== 'function' ||
        typeof window.Orcamento.gerarPropostaPDFBlob !== 'function') {
      alert('API do Orcamento incompleta.\nFaltam: gerarRelatorioPNGBlob / gerarPropostaPDFBlob.\nRecarregue a pagina.');
      return;
    }

    abrirModal({
      id: 'orcdocs-modal-gerando',
      titulo: '📄 Gerando documentos...',
      larguraMax: 480,
      body: `
        <div id="orcdocs-progresso" style="font-size: 13px; color: #374151; line-height: 1.8;">
          <div data-step="prep">⏳ Preparando dados da Versão ${versaoResumo.numero}...</div>
          <div data-step="comercial" style="opacity:0.4;">⌛ Painel Comercial</div>
          <div data-step="resultado-porta" style="opacity:0.4;">⌛ Resultado por Porta</div>
          <div data-step="dre" style="opacity:0.4;">⌛ DRE Resumida</div>
          <div data-step="obra" style="opacity:0.4;">⌛ Resumo da Obra</div>
          <div data-step="proposta" style="opacity:0.4;">⌛ PDF Proposta Comercial</div>
        </div>
        <div style="margin-top: 14px; font-size: 11px; color: #6b7280;">
          Os arquivos serão baixados automaticamente. Pode demorar até 30 segundos.
        </div>
      `,
    });
    const setStep = (key, status) => {
      const el = document.querySelector(`#orcdocs-progresso [data-step="${key}"]`);
      if (!el) return;
      el.style.opacity = '1';
      const map = { ok: '✅', erro: '❌', loading: '⏳' };
      el.innerHTML = el.innerHTML.replace(/^[⏳⌛✅❌]\s*/, (map[status] || '⏳') + ' ');
    };

    const arquivosGerados = [];
    const erros = [];

    const subAbas = [
      { key: 'comercial',       tipo: 'Painel Comercial' },
      { key: 'resultado-porta', tipo: 'Resultado Porta'  },
      { key: 'dre',             tipo: 'DRE Resumida'     },
      { key: 'obra',            tipo: 'Resumo Da Obra'   },
    ];
    setStep('prep', 'ok');
    for (const { key, tipo } of subAbas) {
      setStep(key, 'loading');
      try {
        const blob = await window.Orcamento.gerarRelatorioPNGBlob(versaoId, key);
        if (!blob) throw new Error('blob vazio');
        const nome = formatNomeArquivo(lead, tipo) + '.png';
        baixarBlob(blob, nome);
        arquivosGerados.push(nome);
        setStep(key, 'ok');
      } catch (e) {
        console.error(`[OrcDocs] erro PNG ${key}:`, e);
        erros.push(`${tipo}: ${e.message || e}`);
        setStep(key, 'erro');
      }
      await new Promise(r => setTimeout(r, 400));
    }

    setStep('proposta', 'loading');
    try {
      const blob = await window.Orcamento.gerarPropostaPDFBlob(versaoId);
      if (!blob) throw new Error('blob vazio');
      const nome = formatNomeArquivo(lead, 'Proposta') + '.pdf';
      baixarBlob(blob, nome);
      arquivosGerados.push(nome);
      setStep('proposta', 'ok');
    } catch (e) {
      console.error('[OrcDocs] erro Proposta:', e);
      erros.push(`Proposta: ${e.message || e}`);
      setStep('proposta', 'erro');
    }

    setTimeout(() => {
      fecharModal('orcdocs-modal-gerando');
      if (erros.length === 0) {
        toast(`${arquivosGerados.length} documentos gerados!`, 'sucesso');
      } else if (arquivosGerados.length > 0) {
        toast(`${arquivosGerados.length} ok, ${erros.length} falharam.`, 'aviso');
        console.warn('Erros:', erros);
      } else {
        alert('Nao foi possivel gerar nenhum documento:\n\n' + erros.join('\n'));
      }
    }, 800);
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------
  window.OrcDocs = {
    formatNomeArquivo,
    titleCase,
    sanitizeFilename,
    obterAgp,
    abrirVersoesModal,
    revisarVersaoComConfirma,
    criarNovaVersao,
    gerarDocumentos,
    carregarVersaoNaAbaOrcamento,
    toast,
  };

  const style = document.createElement('style');
  style.textContent = `
    @keyframes orcdocs-slide-in {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  console.log('[OrcDocs] modulo carregado. API:', Object.keys(window.OrcDocs));
})();
