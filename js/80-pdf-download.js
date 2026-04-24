/**
 * 80-pdf-download.js
 *
 * Carrega html2pdf.js via CDN e expõe funções de download direto:
 *   - window.downloadProposta(baseNome)
 *   - window.downloadMargens(baseNome)
 *   - window.downloadMemorial(baseNome)
 *
 * Sem diálogo de impressão. O navegador baixa o PDF direto.
 *
 * Tática: localizar o elemento da proposta/margens/memorial no DOM
 *         (mesmos elementos que printProposta, printMargens, etc. imprimem),
 *         chamar html2pdf() pra baixar.
 */
(function(){
  'use strict';

  // ─── 1. Carregar html2pdf via CDN ─────────────────────────────────
  function _carregarHtml2Pdf(){
    if(window.html2pdf) return Promise.resolve();
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = function(){ console.log('[80-pdf] html2pdf carregado'); resolve(); };
      s.onerror = function(){ reject(new Error('Falha ao carregar html2pdf')); };
      document.head.appendChild(s);
    });
  }
  // Pre-carregar ao iniciar
  _carregarHtml2Pdf().catch(function(e){ console.warn('[80-pdf]', e); });

  // ─── 2. Localizadores de elementos ─────────────────────────────────
  // Cada tipo de PDF mora em elementos diferentes do DOM
  var LOCALIZADORES = {
    proposta: function(){
      // Proposta Comercial: card da aba "Proposta Comercial"
      return document.getElementById('proposta-body')
          || document.getElementById('proposta-container')
          || document.getElementById('tab-proposta')
          || document.querySelector('#tab-proposta .card')
          || document.querySelector('.proposta-container');
    },
    margens: function(){
      // Painel de Margens — card RESULTADO — PORTA
      return document.getElementById('result-porta')
          || document.querySelector('[class*="result"]')
          || document.getElementById('r-card')
          || document.getElementById('margens-container');
    },
    memorial: function(){
      // Resumo da obra
      return document.getElementById('resumo-obra');
    },
    painel_rep: function(){
      return document.getElementById('painel-rep')
          || document.getElementById('painel-representante');
    }
  };

  // ─── 3. Função genérica de download ────────────────────────────────
  async function _downloadElemento(tipo, baseNome, sufixo){
    await _carregarHtml2Pdf();
    if(!window.html2pdf) throw new Error('html2pdf não disponível');

    var loc = LOCALIZADORES[tipo];
    var el = loc ? loc() : null;
    if(!el){
      console.warn('[80-pdf] elemento ' + tipo + ' não encontrado no DOM');
      return false;
    }

    // Garantir visibilidade
    var estiloOriginal = el.style.display;
    if(estiloOriginal === 'none') el.style.display = '';

    var nome = (baseNome || 'projetta') + ' - ' + sufixo + '.pdf';
    try {
      await window.html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: nome,
          image: { type:'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(el)
        .save();
      return true;
    } finally {
      el.style.display = estiloOriginal;
    }
  }

  // ─── 4. API pública ────────────────────────────────────────────────
  window.downloadProposta = function(baseNome){
    return _downloadElemento('proposta', baseNome, 'Proposta Comercial');
  };
  window.downloadMargens = function(baseNome){
    return _downloadElemento('margens', baseNome, 'Margens (MC)');
  };
  window.downloadMemorial = function(baseNome){
    return _downloadElemento('memorial', baseNome, 'Memorial Resumo Obra (MR)');
  };
  window.downloadPainelRep = function(baseNome){
    return _downloadElemento('painel_rep', baseNome, 'Painel Representante (RC)');
  };

  // ─── 5. Utilidade: download genérico de qualquer elemento ───────────
  window.downloadElementoComoPDF = async function(el, filename){
    await _carregarHtml2Pdf();
    if(!el || !window.html2pdf) return;
    return window.html2pdf()
      .set({
        margin: [8,8,8,8],
        filename: filename || 'documento.pdf',
        image: { type:'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
      })
      .from(el).save();
  };

  console.log('%c[80-pdf-download] Ativo — downloadProposta/Margens/Memorial/PainelRep',
              'color:#003144;font-weight:700;background:#eaf2f7;padding:3px 8px;border-radius:4px');
})();
