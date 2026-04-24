/**
 * 80-pdf-download.js v3 — USA as funções print* nativas
 *
 * As funções printMargens/printMemorialCalculo/printPainelRep JÁ fazem
 * download PNG via html2canvas (descoberto lendo 12-proposta.js).
 * Só printProposta chama window.print() — essa interceptamos e fazemos PDF.
 *
 * Nomenclatura real (descoberta no código):
 *   printMemorialCalculo → AGP - RESERVA - CLIENTE - MC.png  (Memorial)
 *   printMargens        → AGP - RESERVA - CLIENTE - MR.png  (Margens)
 *   printPainelRep      → AGP - RESERVA - CLIENTE - RC.png  (Representante)
 */
(function(){
  'use strict';

  // ─── 1. Carregar html2pdf pra Proposta ─────────────────────────────
  var _h2pPromise = null;
  function _ensureH2P(){
    if(window.html2pdf) return Promise.resolve();
    if(!_h2pPromise){
      _h2pPromise = new Promise(function(resolve, reject){
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        s.onload = resolve;
        s.onerror = function(){ reject(new Error('Falha html2pdf')); };
        document.head.appendChild(s);
      });
    }
    return _h2pPromise;
  }
  _ensureH2P().catch(function(e){ console.warn('[80]', e); });

  // html2canvas já é carregado pelo sistema (usado pelas funções print*)

  // ─── 2. PROPOSTA → PDF (via html2pdf, multi-página) ────────────────
  window.downloadProposta = async function(baseNome){
    await _ensureH2P();
    if(!window.html2pdf) throw new Error('html2pdf não disponível');

    var el = document.querySelector('#tab-proposta .proposta-page')
          || document.querySelector('.proposta-page')
          || document.getElementById('tab-proposta');
    if(!el){
      console.warn('[80-proposta] elemento não achado');
      // Fallback: chama printProposta original (pode abrir diálogo)
      if(typeof window.printProposta === 'function'){ window.printProposta(); }
      return false;
    }

    // Torna visível temporariamente se oculto
    var origDisplay = el.style.display;
    if(origDisplay === 'none') el.style.display = '';

    // Nome: AGP - RESERVA - CLIENTE - Proposta.pdf
    var nome = (baseNome || 'projetta') + ' - Proposta Comercial.pdf';

    try {
      await window.html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename: nome,
          image: { type:'jpeg', quality: 0.95 },
          html2canvas: {
            scale: 2, useCORS: true, backgroundColor: '#ffffff',
            windowWidth: 900, letterRendering: true
          },
          jsPDF: { unit:'mm', format:'a4', orientation:'portrait', compress: true },
          pagebreak: { mode: ['avoid-all','css','legacy'] }
        })
        .from(el)
        .save();
      return true;
    } catch(err){
      console.error('[80-proposta]', err);
      throw err;
    } finally {
      el.style.display = origDisplay;
    }
  };

  // ─── 3. Margens/Memorial/Rep → PNG via funções nativas ─────────────
  // Essas funções JÁ fazem download do PNG corretamente — só chamamos
  window.downloadMargens = function(baseNome){
    if(typeof window.printMargens !== 'function'){
      console.warn('[80-margens] printMargens não existe');
      return false;
    }
    // Passa override de cliente pro PDF ter o nome certo (printMargens lê window._pdfClienteOverride)
    if(baseNome) window._pdfClienteOverride = baseNome;
    try {
      window.printMargens();
      return true;
    } catch(err){
      console.error('[80-margens]', err);
      throw err;
    } finally {
      setTimeout(function(){ delete window._pdfClienteOverride; }, 3000);
    }
  };

  window.downloadMemorial = function(baseNome){
    if(typeof window.printMemorialCalculo !== 'function'){
      console.warn('[80-memorial] printMemorialCalculo não existe');
      return false;
    }
    if(baseNome) window._pdfClienteOverride = baseNome;
    try {
      window.printMemorialCalculo();
      return true;
    } catch(err){
      console.error('[80-memorial]', err);
      throw err;
    } finally {
      setTimeout(function(){ delete window._pdfClienteOverride; }, 3000);
    }
  };

  window.downloadPainelRep = function(baseNome){
    if(typeof window.printPainelRep !== 'function'){
      console.warn('[80-rep] printPainelRep não existe');
      return false;
    }
    try {
      window.printPainelRep();
      return true;
    } catch(err){
      console.error('[80-rep]', err);
      throw err;
    }
  };

  console.log('%c[80 v3] Proposta=PDF(html2pdf) · MC/MR/RC=funcoes nativas',
              'color:#003144;font-weight:700;background:#eaf2f7;padding:3px 8px;border-radius:4px');
})();
