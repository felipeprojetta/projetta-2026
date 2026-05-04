/* ════════════════════════════════════════════════════════════════════
   45-email-import.js — Importacao MANUAL de email pro CRM
   ════════════════════════════════════════════════════════════════════

   Felipe sessao 2026-08: substitui o robo automatico (44-email-crm
   polling). Usuario abre o email no modal do Outlook, clica
   "📥 Importar pro CRM" → este modulo:

     1. Le o email completo (assunto + corpo + anexos)
     2. Extrai numero da reserva (regex no assunto/corpo)
     3. Busca dados do cliente na API Weiku (intranet)
     4. Acha o PDF anexo, baixa, le via PDF.js
     5. Faz parser de Largura/Altura/Modelo/Cor do texto do PDF
     6. Cria lead no CRM com TUDO preenchido (incluindo porta_*)

   API publica: window.EmailImport.importarDoEmail(msgId)

   Dependencias:
     - window.outlookGetEmail (35-outlook.js)
     - window._graphCall (35-outlook.js — interno, mas reusamos via fetch)
     - window.WeikuClient (40-weiku-client.js)
     - window.EmailCRM.criarLeadAutomatico (44-email-crm.js)
     - window.EmailCRM.proximoAGP (44-email-crm.js)
     - pdfjsLib (CDN, carregado pelo index.html)
   ════════════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  // ───────────────────────────────────────────────────────────────────
  // EXTRACAO DA RESERVA — regex no assunto + corpo do email
  // ───────────────────────────────────────────────────────────────────
  /**
   * Procura padrao de numero de reserva no assunto e bodyPreview/body.
   * Padroes comuns vistos nos emails da Weiku:
   *   "Reserva 146508"
   *   "RESERVA: 146508"
   *   "RESERVA - 146508"
   *   "Novo orcamento - 146510 - CLIENTE"     (forwarded email)
   *   "Fwd: Novo orcamento - 146510 - CLIENTE"
   *   "Orcamento 146510"
   * Retorna string com o numero ou '' se nao achou.
   */
  function extrairNumeroReserva(email) {
    if (!email) return '';
    var assunto = String(email.subject || '');
    var preview = String(email.bodyPreview || '');
    var corpo   = email.body && email.body.content ? String(email.body.content) : '';
    var pool    = assunto + '\n' + preview + '\n' + corpo;

    // Padrao 1: palavra "reserva" seguida de numero
    var m = pool.match(/reserva[\s:#\-\.]*?(\d{4,8})/i);
    if (m && m[1]) return m[1];

    // Padrao 2: palavra "orcamento" seguida de numero (Felipe: "Novo orcamento - 146510")
    //   Aceita orcamento|orçamento e separadores variados.
    m = pool.match(/or[cç]amento[\s:#\-\.]*?(\d{4,8})/i);
    if (m && m[1]) return m[1];

    // Padrao 3: "RES" abreviado (cuidado pra nao pegar palavras com RES no meio)
    m = pool.match(/\bRES[\s:#\-\.]*?(\d{4,8})/i);
    if (m && m[1]) return m[1];

    // Fallback robusto: pega o PRIMEIRO numero de 5-7 digitos do ASSUNTO.
    //   - Limitado ao assunto (corpo tem CEP/telefone que dariam falso positivo)
    //   - 5-7 digitos cobre reservas Weiku (geralmente 6) sem pegar ano (4),
    //     CEP brasileiro (8 com hifen), ou telefone (10-11)
    m = assunto.match(/\b(\d{5,7})\b/);
    if (m && m[1]) return m[1];

    return '';
  }

  // ───────────────────────────────────────────────────────────────────
  // ANEXOS — busca o primeiro PDF do email
  // ───────────────────────────────────────────────────────────────────
  /**
   * Lista anexos do email via Graph API (so' metadata, sem contentBytes).
   * Devolve [{id, name, contentType, size}, ...]
   */
  async function listarAnexos(msgId) {
    var token = localStorage.getItem('projetta_outlook_access_token');
    if (!token) throw new Error('Nao autenticado no Outlook');
    var url = 'https://graph.microsoft.com/v1.0/me/messages/' + encodeURIComponent(msgId)
            + '/attachments?$select=id,name,contentType,size,isInline';
    var resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!resp.ok) throw new Error('Falha ao listar anexos: HTTP ' + resp.status);
    var data = await resp.json();
    return (data.value || []).filter(function(a) { return !a.isInline; });
  }

  /**
   * Baixa o conteudo de um anexo (Graph retorna contentBytes em base64).
   * Devolve Uint8Array.
   */
  async function baixarAnexo(msgId, attId) {
    var token = localStorage.getItem('projetta_outlook_access_token');
    if (!token) throw new Error('Nao autenticado no Outlook');
    var url = 'https://graph.microsoft.com/v1.0/me/messages/' + encodeURIComponent(msgId)
            + '/attachments/' + encodeURIComponent(attId);
    var resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!resp.ok) throw new Error('Falha ao baixar anexo: HTTP ' + resp.status);
    var att = await resp.json();
    if (!att.contentBytes) throw new Error('Anexo sem contentBytes');
    var raw = atob(att.contentBytes);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  /**
   * Acha o PRIMEIRO anexo PDF do email. Retorna {id, name} ou null.
   */
  async function acharPrimeiroPDF(msgId) {
    var anexos = await listarAnexos(msgId);
    var pdf = anexos.find(function(a) {
      var ct = String(a.contentType || '').toLowerCase();
      var nm = String(a.name || '').toLowerCase();
      return ct === 'application/pdf' || nm.endsWith('.pdf');
    });
    return pdf || null;
  }

  // ───────────────────────────────────────────────────────────────────
  // PDF PARSER — extrai texto via PDF.js + regex de campos
  // ───────────────────────────────────────────────────────────────────
  /**
   * Extrai texto puro de um PDF (todas as paginas). Devolve string.
   */
  async function extrairTextoPDF(pdfBytes) {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js nao carregado. Recarregue a pagina.');
    }
    // Configura worker (CDN)
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    var loadingTask = window.pdfjsLib.getDocument({ data: pdfBytes });
    var pdf = await loadingTask.promise;
    var textoCompleto = '';
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var textoPagina = (content.items || []).map(function(it) { return it.str; }).join(' ');
      textoCompleto += textoPagina + '\n';
    }
    return textoCompleto;
  }

  /**
   * Parser dos campos da porta no texto extraido do PDF da Weiku.
   *
   * Felipe sessao 2026-08: regex GENERICO inicial. Se nao acertar
   * com o formato real do PDF, Felipe me manda exemplo e calibro.
   * Quando nao encontra um campo, deixa string vazia (nao quebra).
   */
  function parsearDadosPDF(texto) {
    if (!texto) return {};
    // Normaliza espacos multiplos pra simplificar regex
    var t = texto.replace(/\s+/g, ' ').trim();

    function matchFirst(re) {
      var m = t.match(re);
      return m && m[1] ? m[1].trim() : '';
    }

    // Largura: aceita "Largura: 1750", "Largura 1.750 mm", "Larg 1750mm"
    var largura = matchFirst(/(?:Largura|Larg)\.?\s*[:\-]?\s*(\d{2,5}(?:[.,]\d+)?)\s*(?:mm|m\b|cm)?/i);
    // Altura: idem
    var altura  = matchFirst(/Altura\.?\s*[:\-]?\s*(\d{2,5}(?:[.,]\d+)?)\s*(?:mm|m\b|cm)?/i);
    // Modelo: aceita "Modelo: 01", "Modelo 01 - Cava", "Modelo: Cava"
    var modelo  = matchFirst(/Modelo\.?\s*[:\-]?\s*([A-Za-z0-9 \-\/]+?)(?=\s{2,}|\s+(?:Cor|Pintura|Revestimento|Acabamento)\b|$)/i);
    // Cor: aceita "Cor: PRO1874", "Cor PRO1874 - Dark Grey"
    var cor     = matchFirst(/Cor\.?\s*[:\-]?\s*([A-Za-z0-9 \-\/]+?)(?=\s{2,}|\s+(?:Modelo|Pintura|Revestimento|Acabamento|Largura|Altura)\b|$)/i);

    // Limpa virgulas/pontos pra largura/altura virarem numeros pt-BR
    function _normaliza(num) {
      if (!num) return '';
      // Remove ponto de milhar, troca virgula por ponto
      var n = num.replace(/\./g, '').replace(',', '.');
      var f = parseFloat(n);
      return isNaN(f) ? '' : String(Math.round(f));
    }

    return {
      porta_largura: _normaliza(largura),
      porta_altura:  _normaliza(altura),
      porta_modelo:  modelo,
      porta_cor:     cor,
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // FLUXO PRINCIPAL — orquestra tudo
  // ───────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────
  // FLUXO PRINCIPAL — puxa tudo automatico (Weiku + PDF). AGP pode ser
  // gerado automatico (proximo da sequencia) OU informado manualmente
  // pelo usuario (caso queira sobrescrever o proximo).
  // ───────────────────────────────────────────────────────────────────
  async function importarDoEmail(msgId, agpManual) {
    var statusEl = document.getElementById('outlook-import-status');
    var btnEl    = document.getElementById('outlook-btn-importar-crm');
    function setStatus(msg, cor) {
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.style.color = cor || '#9a3412';
      }
    }
    function setBusy(busy) {
      if (btnEl) {
        btnEl.disabled = busy;
        btnEl.style.opacity = busy ? '0.6' : '1';
        btnEl.style.cursor  = busy ? 'wait' : 'pointer';
      }
    }

    try {
      setBusy(true);
      setStatus('🔄 Lendo email...', '#1565c0');

      // 1. Pega email completo
      if (!window.outlookGetEmail) throw new Error('Outlook nao carregado');
      var email = await window.outlookGetEmail(msgId);

      // 2. Extrai numero da reserva
      var reserva = extrairNumeroReserva(email);
      if (!reserva) {
        throw new Error('Nao achei numero de reserva no email. Verifique o assunto/corpo.');
      }
      setStatus('🔄 Reserva ' + reserva + ' identificada. Buscando na intranet...', '#1565c0');

      // 3. Verifica se ja existe esse lead
      var leads = (typeof Storage !== 'undefined' ? Storage.scope('crm').get('leads') : []) || [];
      var jaExiste = leads.find(function(l) { return String(l.numeroReserva) === String(reserva); });
      if (jaExiste) {
        throw new Error('Reserva ' + reserva + ' ja existe no CRM (lead "' + jaExiste.cliente + '"). Abra o card existente.');
      }

      // 4. Busca dados Weiku
      if (!window.WeikuClient) throw new Error('WeikuClient nao carregado');
      var dadosWeiku = await window.WeikuClient.buscarReserva(reserva);
      if (!dadosWeiku || !dadosWeiku.nome_cliente) {
        throw new Error('Reserva ' + reserva + ' nao encontrada na intranet Weiku.');
      }
      setStatus('🔄 Dados encontrados: ' + dadosWeiku.nome_cliente + '. Procurando PDF anexo...', '#1565c0');

      // 5. Procura PDF anexo (opcional - sem PDF cria lead so com dados Weiku)
      var dadosPDF = {};
      try {
        var pdfMeta = await acharPrimeiroPDF(msgId);
        if (pdfMeta) {
          setStatus('🔄 Lendo PDF "' + pdfMeta.name + '"...', '#1565c0');
          var pdfBytes = await baixarAnexo(msgId, pdfMeta.id);
          var texto = await extrairTextoPDF(pdfBytes);
          // Felipe sessao 2026-08: log do texto extraido pra debug do parser.
          // Se medidas vierem vazias, Felipe abre console (F12) e copia.
          console.log('[email-import] ===== TEXTO EXTRAIDO DO PDF =====');
          console.log(texto);
          console.log('[email-import] ===== FIM DO TEXTO =====');
          dadosPDF = parsearDadosPDF(texto);
          console.log('[email-import] PDF parseado:', dadosPDF);
        } else {
          console.log('[email-import] Email sem PDF anexo — lead criado sem dados da porta');
        }
      } catch (ePDF) {
        console.warn('[email-import] Falha ao ler PDF (lead sera criado sem dados da porta):', ePDF);
      }

      // 6. Cria lead com tudo combinado.
      //    Felipe sessao 2026-08: 'todo AGP vai ser manual pronto eu coloco
      //    direto no card'. Lead criado SEM AGP. Felipe edita o card depois
      //    pra colocar o AGP manualmente.
      if (!window.EmailCRM || !window.EmailCRM.criarLeadAutomatico) {
        throw new Error('EmailCRM nao carregado');
      }
      var agp = agpManual || '';  // vazio quando nao informado - Felipe completa no card
      var ok = window.EmailCRM.criarLeadAutomatico(reserva, dadosWeiku, agp);
      if (!ok) throw new Error('Falha ao criar lead no CRM');

      // 7. Anexa dados do PDF no lead recem-criado (se tiver)
      if (dadosPDF.porta_largura || dadosPDF.porta_altura || dadosPDF.porta_modelo || dadosPDF.porta_cor) {
        var leadsAtuais = Storage.scope('crm').get('leads') || [];
        var leadCriado = leadsAtuais.find(function(l) { return String(l.numeroReserva) === String(reserva); });
        if (leadCriado) {
          if (dadosPDF.porta_largura) leadCriado.porta_largura = dadosPDF.porta_largura;
          if (dadosPDF.porta_altura)  leadCriado.porta_altura  = dadosPDF.porta_altura;
          if (dadosPDF.porta_modelo)  leadCriado.porta_modelo  = dadosPDF.porta_modelo;
          if (dadosPDF.porta_cor)     leadCriado.porta_cor     = dadosPDF.porta_cor;
          Storage.scope('crm').set('leads', leadsAtuais);
        }
      }

      // 8. UI de sucesso
      var resumo = 'Lead criado: ' + dadosWeiku.nome_cliente + (agp ? ' · ' + agp : ' (lembre de preencher o AGP no card)');
      var dadosTxt = '';
      if (dadosPDF.porta_largura || dadosPDF.porta_altura) {
        dadosTxt = ' · ' + (dadosPDF.porta_largura || '?') + '×' + (dadosPDF.porta_altura || '?') + 'mm';
      }
      if (dadosPDF.porta_modelo)  dadosTxt += ' · Modelo ' + dadosPDF.porta_modelo;
      if (dadosPDF.porta_cor)     dadosTxt += ' · Cor ' + dadosPDF.porta_cor;
      setStatus('✅ ' + resumo + dadosTxt, '#16a34a');

      // Re-renderiza CRM se aberto
      if (typeof Events !== 'undefined') Events.emit('crm:reload');

    } catch (e) {
      console.error('[email-import] erro:', e);
      setStatus('❌ ' + (e.message || e), '#c0392b');
    } finally {
      setBusy(false);
    }
  }

  // ───────────────────────────────────────────────────────────────────
  // Bridge global pro botao no modal do Outlook
  // Felipe sessao 2026-08: 'todo AGP vai ser manual pronto eu coloco
  // direto no card'. Sem prompt. Importa direto - lead criado sem AGP,
  // Felipe edita o card depois pra preencher.
  // ───────────────────────────────────────────────────────────────────
  window._outlookImportarCRM = function(msgId) {
    importarDoEmail(msgId);  // sem agpManual = AGP vazio
  };

  // API publica
  window.EmailImport = {
    importarDoEmail: importarDoEmail,                    // (msgId, agpManual?)
    extrairNumeroReserva: extrairNumeroReserva,          // exposto pra debug
    parsearDadosPDF: parsearDadosPDF,                    // exposto pra debug
  };

  console.log('[email-import] modulo carregado. API:', Object.keys(window.EmailImport));
})();
