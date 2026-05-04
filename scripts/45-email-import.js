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
    // Felipe sessao 2026-08: o PDF da Weiku tem labels como texto
    // vetorial mas VALORES como annotations/form fields (camadas
    // separadas). getTextContent() pega so' os labels. Precisamos
    // tambem getAnnotations() pra pegar os valores preenchidos.
    var textoCompleto = '';
    var totalItems = 0;
    var totalAnnotations = 0;
    var camposFormulario = {}; // mapa fieldName -> fieldValue
    var annotationsTextos = [];

    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);

      // 1. Texto vetorial (camada normal — labels)
      var content = await page.getTextContent();
      var items = content.items || [];
      totalItems += items.length;
      var textoPagina = items.map(function(it) { return it.str; }).join(' ');
      textoCompleto += textoPagina + '\n';

      // 2. Annotations e form fields (camada onde estao os VALORES)
      try {
        var annotations = await page.getAnnotations();
        annotations.forEach(function(ann) {
          // Form field preenchido (Tx, Btn, Ch, Sig)
          if (ann.fieldValue !== undefined && ann.fieldValue !== null && ann.fieldValue !== '') {
            totalAnnotations++;
            var fName = ann.fieldName || ann.alternativeText || '';
            var fVal  = ann.fieldValue;
            if (fName) camposFormulario[fName] = fVal;
            annotationsTextos.push((fName ? fName + ': ' : '') + fVal);
          }
          // FreeText annotation (contents = texto livre adicionado por cima)
          if (ann.contents && ann.contents.trim()) {
            totalAnnotations++;
            annotationsTextos.push(ann.contents.trim());
          }
        });
      } catch (eAnn) {
        console.warn('[email-import] getAnnotations falhou:', eAnn);
      }
    }

    // Texto final = labels + (separador) + valores das annotations
    var textoFinal = textoCompleto;
    if (annotationsTextos.length > 0) {
      textoFinal += '\n' + annotationsTextos.join(' ') + '\n';
    }

    console.log('[email-import] PDF lido: ' + pdf.numPages + ' pagina(s), ' +
                totalItems + ' items texto, ' + totalAnnotations + ' annotations.');
    if (Object.keys(camposFormulario).length > 0) {
      console.log('[email-import] Form fields encontrados:', camposFormulario);
    }
    if (totalItems === 0 && totalAnnotations === 0) {
      console.warn('[email-import] ⚠️ PDF NAO TEM TEXTO NEM ANNOTATIONS — ' +
                   'provavelmente e IMAGEM (scan). Solucao: OCR.');
    }

    return {
      texto: textoFinal,
      numPages: pdf.numPages,
      totalItems: totalItems,
      totalAnnotations: totalAnnotations,
      camposFormulario: camposFormulario,
    };
  }

  /**
   * Felipe sessao 2026-08: mapeamento de fieldName (form field do PDF Weiku)
   * pra campo do lead.
   *
   * Os PDFs Weiku usam nomes GENERICOS pros campos: Texto1, Texto2, Texto6,
   * Dropdown12, Dropdown15, etc. Mapeamento abaixo baseado em PDF real
   * fornecido pelo Felipe (Console F12 mostrou os fieldName/fieldValue):
   *   Texto1     = DATA              (ex: 02/05/2026)
   *   Texto2     = N° DE RESERVA     (ex: 146510)
   *   Texto6     = LARGURA X ALTURA  (ex: '1300x2600' ou '1300 X 2600')
   *   Texto7     = OBSERVACOES       (texto livre)
   *   Texto13    = REPRESENTANTE
   *   Texto14    = CLIENTE
   *   Dropdown12 = MODELO            (ex: 14)
   *   Dropdown15 = COR PORTA         (ex: PRO0157T - PRETO WEATHERXL BB LDPE)
   *   Dropdown16 = R.T
   *   Dropdown17 = MARKUP
   *   Dropdown18 = FECHADURA DIGITAL
   *   Dropdown19 = FIXO
   *   Dropdown20 = VIDRO
   *
   * Tambem aceita nomes semanticos (LARGURA, MODELO, COR_PORTA, etc) caso
   * Weiku renomeie no futuro - prioridade alta antes do fallback por numero.
   */
  function parsearCamposFormulario(camposFormulario) {
    if (!camposFormulario || Object.keys(camposFormulario).length === 0) return {};
    // Normaliza chaves: lowercase + sem acentos + sem espacos/underscores
    var normalizado = {};
    Object.keys(camposFormulario).forEach(function(k) {
      var kn = String(k).toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s_\-\.]+/g, '');
      normalizado[kn] = camposFormulario[k];
    });

    function pegar() {
      // Aceita varios nomes possiveis (ordem = prioridade)
      for (var i = 0; i < arguments.length; i++) {
        var k = String(arguments[i]).toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[\s_\-\.]+/g, '');
        if (normalizado[k] !== undefined && normalizado[k] !== null && normalizado[k] !== '') {
          return String(normalizado[k]).trim();
        }
      }
      return '';
    }

    // LARGURA X ALTURA: pode estar em campo unico (Texto6) ou separado.
    // Aceita formatos: '1300x2600', '1300 X 2600', '1300X2600 mm'
    var larguraAltura = pegar(
      'LARGURA X ALTURA', 'LARGURAXALTURA', 'DIMENSAO', 'DIMENSOES',
      'Texto6'  // mapeamento Weiku conhecido
    );
    var largura = '', altura = '';
    if (larguraAltura) {
      var dim = String(larguraAltura).match(/(\d{2,5})\s*[Xx×]\s*(\d{2,5})/);
      if (dim) { largura = dim[1]; altura = dim[2]; }
    }
    if (!largura) largura = pegar('LARGURA', 'LARG');
    if (!altura)  altura  = pegar('ALTURA', 'ALT');

    var modelo = pegar(
      'MODELO', 'MODELO_PORTA', 'MODELOPORTA',
      'Dropdown12'  // mapeamento Weiku conhecido
    );
    var cor = pegar(
      'COR PORTA', 'CORPORTA', 'COR', 'COR_PORTA',
      'Dropdown15'  // mapeamento Weiku conhecido
    );
    var fechDigRaw = pegar(
      'FECHADURA DIGITAL', 'FECHADURADIGITAL', 'FECHADURA',
      'Dropdown18'  // mapeamento Weiku conhecido
    );

    var fechDig = '';
    if (fechDigRaw) {
      var fechLower = String(fechDigRaw).toLowerCase().replace(/\s+/g, ' ').trim();
      if (fechLower.indexOf('nao se aplica') >= 0 ||
          fechLower.indexOf('não se aplica') >= 0 ||
          fechLower === 'nao' || fechLower === 'não' ||
          fechLower === 'no'  || fechLower === 'n/a') {
        fechDig = 'nao';
      } else if (fechLower === 'sim' || fechLower === 'yes' || fechLower === 's') {
        fechDig = 'sim';
      } else {
        fechDig = String(fechDigRaw).trim();
      }
    }

    var resultado = {};
    if (largura) resultado.porta_largura = largura;
    if (altura)  resultado.porta_altura  = altura;
    if (modelo)  resultado.porta_modelo  = String(modelo).trim();
    if (cor)     resultado.porta_cor     = String(cor).trim();
    if (fechDig) resultado.porta_fechadura_digital = fechDig;
    return resultado;
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

      // 3. Verifica se ja existe esse lead.
      //    Felipe sessao 2026-08: se ja existe, pergunta se quer atualizar
      //    campos da porta (util pra completar leads importados antes do
      //    fix de annotations).
      var leads = (typeof Storage !== 'undefined' ? Storage.scope('crm').get('leads') : []) || [];
      var leadExistente = leads.find(function(l) { return String(l.numeroReserva) === String(reserva); });
      var modoAtualizar = false;
      if (leadExistente) {
        var ok = confirm(
          'Reserva ' + reserva + ' ja existe no CRM (lead "' + leadExistente.cliente + '").\n\n' +
          'Atualizar os campos da porta (largura, altura, modelo, cor, fechadura) ' +
          'com os dados deste email/PDF?\n\n' +
          'Os outros campos (cliente, telefone, AGP, etapa) NAO serao tocados.\n\n' +
          'OK = atualizar / Cancelar = nao fazer nada'
        );
        if (!ok) {
          setBusy(false);
          setStatus('Cancelado pelo usuario.', '#9a3412');
          return;
        }
        modoAtualizar = true;
      }

      // 4. Busca dados Weiku
      if (!window.WeikuClient) throw new Error('WeikuClient nao carregado');
      var dadosWeiku = await window.WeikuClient.buscarReserva(reserva);
      if (!dadosWeiku || !dadosWeiku.nome_cliente) {
        throw new Error('Reserva ' + reserva + ' nao encontrada na intranet Weiku.');
      }

      // 4.1 Felipe sessao 2026-08: Weiku retorna so CEP. Faz lookup
      //     ViaCEP pra completar cidade/estado antes de criar lead.
      //     No modo atualizar, pula (lead ja tem cidade/estado).
      if (!modoAtualizar && dadosWeiku.cep) {
        setStatus('🔄 Buscando cidade/estado pelo CEP ' + dadosWeiku.cep + '...', '#1565c0');
        var cepInfo = await buscarCidadeEstadoPorCEP(dadosWeiku.cep);
        if (cepInfo.cidade) dadosWeiku.cidade = cepInfo.cidade;
        if (cepInfo.estado) dadosWeiku.estado = cepInfo.estado;
      }
      setStatus('🔄 ' + (modoAtualizar ? 'Atualizando ' : 'Dados encontrados: ') + dadosWeiku.nome_cliente +
                (dadosWeiku.cidade && !modoAtualizar ? ' (' + dadosWeiku.cidade + '/' + (dadosWeiku.estado||'') + ')' : '') +
                '. Procurando PDF anexo...', '#1565c0');

      // 5. Procura PDF anexo (opcional - sem PDF cria lead so com dados Weiku)
      var dadosPDF = {};
      var textoPDFGuardado = '';   // Felipe sessao 2026-08: pra mostrar pro Felipe se parser falhar
      var nomePDFGuardado  = '';
      var pdfMetaInfo      = { numPages: 0, totalItems: 0, totalAnnotations: 0 };
      try {
        var pdfMeta = await acharPrimeiroPDF(msgId);
        if (pdfMeta) {
          nomePDFGuardado = pdfMeta.name || 'anexo.pdf';
          setStatus('🔄 Lendo PDF "' + nomePDFGuardado + '"...', '#1565c0');
          var pdfBytes = await baixarAnexo(msgId, pdfMeta.id);
          var resultado = await extrairTextoPDF(pdfBytes);
          var texto = resultado.texto || '';
          pdfMetaInfo.numPages         = resultado.numPages         || 0;
          pdfMetaInfo.totalItems       = resultado.totalItems       || 0;
          pdfMetaInfo.totalAnnotations = resultado.totalAnnotations || 0;
          textoPDFGuardado = texto;
          // Felipe sessao 2026-08: log do texto extraido pra debug do parser.
          console.log('[email-import] ===== TEXTO EXTRAIDO DO PDF =====');
          console.log(texto);
          console.log('[email-import] ===== FIM DO TEXTO =====');
          window._ultimoTextoPDF = texto;
          window._ultimosCamposFormulario = resultado.camposFormulario;

          // Estrategia 1: tenta extrair direto dos form fields (mais confiavel)
          var dadosFromFields = parsearCamposFormulario(resultado.camposFormulario || {});
          // Estrategia 2: regex no texto consolidado (fallback)
          var dadosFromRegex  = parsearDadosPDF(texto);
          // Combina: form fields tem prioridade, regex preenche o que faltou
          dadosPDF = Object.assign({}, dadosFromRegex, dadosFromFields);
          console.log('[email-import] PDF parseado (fields):', dadosFromFields);
          console.log('[email-import] PDF parseado (regex) :', dadosFromRegex);
          console.log('[email-import] PDF parseado (final) :', dadosPDF);
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
      // Felipe sessao 2026-08: no modoAtualizar nao cria lead novo - usa o
      // existente que detectamos no passo 3.
      if (!modoAtualizar) {
        var ok = window.EmailCRM.criarLeadAutomatico(reserva, dadosWeiku, agp);
        if (!ok) throw new Error('Falha ao criar lead no CRM');
      }

      // 7. Atualiza/anexa dados do PDF no lead (recem-criado ou existente)
      if (dadosPDF.porta_largura || dadosPDF.porta_altura || dadosPDF.porta_modelo
          || dadosPDF.porta_cor || dadosPDF.porta_fechadura_digital) {
        var leadsAtuais = Storage.scope('crm').get('leads') || [];
        var leadAlvo = leadsAtuais.find(function(l) { return String(l.numeroReserva) === String(reserva); });
        if (leadAlvo) {
          if (dadosPDF.porta_largura) leadAlvo.porta_largura = dadosPDF.porta_largura;
          if (dadosPDF.porta_altura)  leadAlvo.porta_altura  = dadosPDF.porta_altura;
          if (dadosPDF.porta_modelo)  leadAlvo.porta_modelo  = dadosPDF.porta_modelo;
          if (dadosPDF.porta_cor)     leadAlvo.porta_cor     = dadosPDF.porta_cor;
          if (dadosPDF.porta_fechadura_digital) leadAlvo.porta_fechadura_digital = dadosPDF.porta_fechadura_digital;
          Storage.scope('crm').set('leads', leadsAtuais);
        }
      }

      // 8. UI de sucesso
      var verbo = modoAtualizar ? 'Lead atualizado: ' : 'Lead criado: ';
      var resumo = verbo + dadosWeiku.nome_cliente + (agp ? ' · ' + agp : (modoAtualizar ? '' : ' (lembre de preencher o AGP no card)'));
      var dadosTxt = '';
      if (dadosPDF.porta_largura || dadosPDF.porta_altura) {
        dadosTxt = ' · ' + (dadosPDF.porta_largura || '?') + '×' + (dadosPDF.porta_altura || '?') + 'mm';
      }
      if (dadosPDF.porta_modelo)  dadosTxt += ' · Modelo ' + dadosPDF.porta_modelo;
      if (dadosPDF.porta_cor)     dadosTxt += ' · Cor ' + dadosPDF.porta_cor;
      // Felipe sessao 2026-08: aviso correto considera annotations tambem
      if (textoPDFGuardado !== undefined && nomePDFGuardado) {
        var temNada    = (pdfMetaInfo.totalItems === 0 && pdfMetaInfo.totalAnnotations === 0);
        var temAnotacoes = (pdfMetaInfo.totalAnnotations > 0);
        var algumCampo  = !!(dadosPDF.porta_largura || dadosPDF.porta_altura ||
                             dadosPDF.porta_modelo || dadosPDF.porta_cor);
        if (temNada) {
          dadosTxt += ' · ⚠️ PDF nao tem texto NEM annotations (imagem). Preencha porta no card.';
        } else if (temAnotacoes && !algumCampo) {
          dadosTxt += ' · ⚠️ PDF tem ' + pdfMetaInfo.totalAnnotations + ' annotations mas parser nao reconheceu os campos. Use 📋 Copiar.';
        } else if (!temAnotacoes && pdfMetaInfo.totalItems > 0 && !algumCampo) {
          dadosTxt += ' · ⚠️ PDF tem texto (' + pdfMetaInfo.totalItems + ' items) mas parser nao achou campos.';
        }
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
      // Antes de navegar, chama Crm.forceReload diretamente pra garantir
      // re-leitura do storage (defesa-em-profundidade caso o evento
      // crm:reload nao tenha disparado por algum motivo).
      setTimeout(function() {
        try {
          if (window.Crm && typeof window.Crm.forceReload === 'function') {
            window.Crm.forceReload(null);
          }
        } catch (eFR) {
          console.warn('[email-import] Crm.forceReload falhou:', eFR);
        }
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
