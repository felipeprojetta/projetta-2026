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
    // Felipe sessao 2026-08: debug detalhado pra distinguir PDF imagem
    // (0 items de texto) de PDF texto vetorial (N items).
    var textoCompleto = '';
    var totalItems = 0;
    var amostraItems = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var content = await page.getTextContent();
      var items = content.items || [];
      totalItems += items.length;
      // Guarda amostra dos primeiros 5 items pra debug
      if (amostraItems.length < 5) {
        items.slice(0, 5 - amostraItems.length).forEach(function(it) {
          amostraItems.push({ str: it.str, page: p });
        });
      }
      var textoPagina = items.map(function(it) { return it.str; }).join(' ');
      textoCompleto += textoPagina + '\n';
    }
    console.log('[email-import] PDF lido: ' + pdf.numPages + ' pagina(s), ' +
                totalItems + ' items de texto.');
    if (totalItems === 0) {
      console.warn('[email-import] ⚠️ PDF NAO TEM TEXTO EXTRAIVEL — provavelmente ' +
                   'e uma IMAGEM (scan). PDF.js nao le imagens. Solucao: OCR.');
    } else if (totalItems < 5) {
      console.warn('[email-import] ⚠️ PDF tem POUCOS items (' + totalItems +
                   '). Pode ser parcialmente imagem. Amostra:', amostraItems);
    }
    return {
      texto: textoCompleto,
      numPages: pdf.numPages,
      totalItems: totalItems,
    };
  }

  /**
   * Parser dos campos da porta no texto extraido do PDF da Weiku.
   *
   * Felipe sessao 2026-08: calibrado com formato REAL do "Checklist 2026".
   * Campos do PDF:
   *   COR PORTA: PRO-1874 DARK GRAY JLR METALLIC
   *   MODELO: 01
   *   FECHADURA DIGITAL: NÃO SE APLICA
   *   LARGURA X ALTURA: 1720 X 3540
   *   FIXO: NÃO SE APLICA
   *   VIDRO: NÃO SE APLICA
   *
   * Estrategia: cada campo captura ate a proxima label conhecida do PDF
   * (lookahead). Robusto a ordem variavel das linhas.
   */
  function parsearDadosPDF(texto) {
    if (!texto) return {};
    // Normaliza espacos multiplos pra simplificar regex
    var t = texto.replace(/\s+/g, ' ').trim();

    // Lookahead com TODAS as labels conhecidas do checklist Weiku.
    // Cada label inclui seu proprio \s*: pra garantir que so' para em
    // labels reais. LARGURA tem variante 'LARGURA X ALTURA:'.
    var STOP = '(?=\\s+(?:DATA\\s*:|REPRESENTANTE\\s*:|N[º°]?\\s*DE\\s*RESERVA\\s*:|CLIENTE\\s*:|MARKUP\\s*:|COR\\s+PORTA\\s*:|R\\.T\\s*:|RT\\s*:|MODELO\\s*:|FECHADURA\\s+DIGITAL\\s*:|LARGURA(?:\\s+X\\s+ALTURA)?\\s*:|ALTURA\\s*:|FIXO\\s*:|VIDRO\\s*:|OBSERVA[CÇ][AÃ]O)|$)';

    function matchFirst(re) {
      var m = t.match(re);
      return m && m[1] ? m[1].trim() : '';
    }

    // LARGURA X ALTURA: 1720 X 3540
    var largura = '', altura = '';
    var dim = t.match(/LARGURA\s*X\s*ALTURA\s*:?\s*(\d{2,5})\s*[Xx×]\s*(\d{2,5})/i);
    if (dim) {
      largura = dim[1];
      altura  = dim[2];
    } else {
      // Fallback: campos separados (formato antigo, caso mude)
      largura = matchFirst(/Largura\s*\(?mm\)?\s*:?\s*(\d{2,5})/i);
      altura  = matchFirst(/Altura\s*\(?mm\)?\s*:?\s*(\d{2,5})/i);
    }

    // MODELO: 01
    var modelo = matchFirst(new RegExp('MODELO\\s*:\\s*([^]+?)' + STOP, 'i'));

    // COR PORTA: PRO-1874 DARK GRAY JLR METALLIC
    var cor = matchFirst(new RegExp('COR\\s+PORTA\\s*:\\s*([^]+?)' + STOP, 'i'));

    // FECHADURA DIGITAL: NÃO SE APLICA  /  PA-DIG-XXX  /  Sim
    var fechDigRaw = matchFirst(new RegExp('FECHADURA\\s+DIGITAL\\s*:\\s*([^]+?)' + STOP, 'i'));
    var fechDig = '';
    if (fechDigRaw) {
      var fechLower = fechDigRaw.toLowerCase().replace(/\s+/g, ' ').trim();
      if (fechLower.indexOf('nao se aplica') >= 0 ||
          fechLower.indexOf('não se aplica') >= 0 ||
          fechLower === 'nao' || fechLower === 'não' ||
          fechLower === 'no'  || fechLower === 'n/a') {
        fechDig = 'nao';
      } else if (fechLower === 'sim' || fechLower === 'yes' || fechLower === 's') {
        fechDig = 'sim';
      } else {
        fechDig = fechDigRaw;  // mantém valor original (provavelmente codigo)
      }
    }

    return {
      porta_largura: largura,
      porta_altura:  altura,
      porta_modelo:  modelo,
      porta_cor:     cor,
      porta_fechadura_digital: fechDig,
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // FLUXO PRINCIPAL — orquestra tudo
  // ───────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────
  // CEP → cidade/estado via ViaCEP (mesma API que o CRM ja usa)
  // ───────────────────────────────────────────────────────────────────
  /**
   * Felipe sessao 2026-08: API Weiku retorna so CEP, nao cidade/estado.
   * Faz lookup no ViaCEP pra completar antes de criar lead.
   * Tolerante a falha (rede off, CEP invalido) - retorna {} e segue.
   */
  async function buscarCidadeEstadoPorCEP(cep) {
    var limpo = String(cep || '').replace(/\D/g, '');
    if (limpo.length !== 8) return {};
    try {
      var res = await fetch('https://viacep.com.br/ws/' + limpo + '/json/');
      if (!res.ok) return {};
      var data = await res.json();
      if (data.erro) return {};
      return { cidade: data.localidade || '', estado: data.uf || '' };
    } catch (e) {
      console.warn('[email-import] ViaCEP falhou:', e);
      return {};
    }
  }

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

      // 4.1 Felipe sessao 2026-08: Weiku retorna so CEP. Faz lookup
      //     ViaCEP pra completar cidade/estado antes de criar lead.
      if (dadosWeiku.cep) {
        setStatus('🔄 Buscando cidade/estado pelo CEP ' + dadosWeiku.cep + '...', '#1565c0');
        var cepInfo = await buscarCidadeEstadoPorCEP(dadosWeiku.cep);
        if (cepInfo.cidade) dadosWeiku.cidade = cepInfo.cidade;
        if (cepInfo.estado) dadosWeiku.estado = cepInfo.estado;
      }
      setStatus('🔄 Dados encontrados: ' + dadosWeiku.nome_cliente +
                (dadosWeiku.cidade ? ' (' + dadosWeiku.cidade + '/' + (dadosWeiku.estado||'') + ')' : '') +
                '. Procurando PDF anexo...', '#1565c0');

      // 5. Procura PDF anexo (opcional - sem PDF cria lead so com dados Weiku)
      var dadosPDF = {};
      var textoPDFGuardado = '';   // Felipe sessao 2026-08: pra mostrar pro Felipe se parser falhar
      var nomePDFGuardado  = '';
      var pdfMetaInfo      = { numPages: 0, totalItems: 0 };
      try {
        var pdfMeta = await acharPrimeiroPDF(msgId);
        if (pdfMeta) {
          nomePDFGuardado = pdfMeta.name || 'anexo.pdf';
          setStatus('🔄 Lendo PDF "' + nomePDFGuardado + '"...', '#1565c0');
          var pdfBytes = await baixarAnexo(msgId, pdfMeta.id);
          var resultado = await extrairTextoPDF(pdfBytes);
          var texto = resultado.texto || '';
          pdfMetaInfo.numPages   = resultado.numPages   || 0;
          pdfMetaInfo.totalItems = resultado.totalItems || 0;
          textoPDFGuardado = texto;
          // Felipe sessao 2026-08: log do texto extraido pra debug do parser.
          // Tambem fica acessivel via window._ultimoTextoPDF
          console.log('[email-import] ===== TEXTO EXTRAIDO DO PDF =====');
          console.log(texto);
          console.log('[email-import] ===== FIM DO TEXTO =====');
          window._ultimoTextoPDF = texto;
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
      if (dadosPDF.porta_largura || dadosPDF.porta_altura || dadosPDF.porta_modelo
          || dadosPDF.porta_cor || dadosPDF.porta_fechadura_digital) {
        var leadsAtuais = Storage.scope('crm').get('leads') || [];
        var leadCriado = leadsAtuais.find(function(l) { return String(l.numeroReserva) === String(reserva); });
        if (leadCriado) {
          if (dadosPDF.porta_largura) leadCriado.porta_largura = dadosPDF.porta_largura;
          if (dadosPDF.porta_altura)  leadCriado.porta_altura  = dadosPDF.porta_altura;
          if (dadosPDF.porta_modelo)  leadCriado.porta_modelo  = dadosPDF.porta_modelo;
          if (dadosPDF.porta_cor)     leadCriado.porta_cor     = dadosPDF.porta_cor;
          if (dadosPDF.porta_fechadura_digital) leadCriado.porta_fechadura_digital = dadosPDF.porta_fechadura_digital;
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
      // Felipe sessao 2026-08: aviso quando PDF e' imagem
      if (textoPDFGuardado !== undefined && pdfMetaInfo.totalItems === 0 && nomePDFGuardado) {
        dadosTxt += ' · ⚠️ PDF e imagem (sem texto). Preencha porta no card.';
      } else if (pdfMetaInfo.totalItems > 0 && !dadosPDF.porta_largura && !dadosPDF.porta_modelo) {
        dadosTxt += ' · ⚠️ PDF tem texto (' + pdfMetaInfo.totalItems + ' items) mas parser nao achou campos.';
      }
      setStatus('✅ ' + resumo + dadosTxt, '#16a34a');

      // Felipe sessao 2026-08: SEMPRE mostra botao "Copiar texto do PDF"
      // quando havia PDF anexo. Ajuda debug do parser - Felipe copia
      // texto e cola pro Claude calibrar o regex.
      if (textoPDFGuardado && statusEl) {
        var botaoCopiar = document.createElement('button');
        botaoCopiar.textContent = '📋 Copiar texto do PDF';
        botaoCopiar.style.cssText =
          'margin-left:10px;padding:4px 10px;background:#1f3658;color:#fff;' +
          'border:none;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer';
        botaoCopiar.onclick = function() {
          var conteudo = '=== ' + nomePDFGuardado + ' ===\n' +
                         '=== PARSED: ' + JSON.stringify(dadosPDF) + ' ===\n' +
                         textoPDFGuardado;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(conteudo).then(function() {
              botaoCopiar.textContent = '✅ Copiado! Cole no chat';
              setTimeout(function() {
                botaoCopiar.textContent = '📋 Copiar texto do PDF';
              }, 3000);
            });
          } else {
            // Fallback: textarea + select
            var ta = document.createElement('textarea');
            ta.value = conteudo;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(ta);
            botaoCopiar.textContent = '✅ Copiado!';
          }
        };
        statusEl.appendChild(botaoCopiar);
      }

      // Re-renderiza CRM se aberto (handler faz loaded=false; load())
      if (typeof Events !== 'undefined') Events.emit('crm:reload');

      // Felipe sessao 2026-08: 'apertar importar e ja aparecer no crm'.
      // Auto-navega pra CRM apos 4s (tempo de Felipe ler o status verde
      // E clicar 'Copiar texto do PDF' se quiser mandar pro debug).
      setTimeout(function() {
        if (typeof App !== 'undefined' && App.navigateTo) {
          App.navigateTo('crm');
        }
      }, 4000);

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
