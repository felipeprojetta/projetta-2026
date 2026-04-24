/**
 * 80-pdf-download.js v2 — Download direto
 *
 * Regras Felipe 24/04:
 *   - Proposta Comercial → PDF
 *   - Margens (MC)       → PNG
 *   - Memorial/Resumo (MR) → PNG
 *   - Painel Representante (RC) → PNG
 *
 * Bibliotecas: html2canvas (PNG) + html2pdf (PDF).
 * Sem diálogo de impressão. Baixa direto na pasta Downloads.
 */
(function(){
  'use strict';

  // ─── 1. Carregar bibliotecas de CDN ──────────────────────────────────
  function _loadScript(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function(){ reject(new Error('Falha: '+src)); };
      document.head.appendChild(s);
    });
  }

  var _h2cPromise = null, _h2pPromise = null;
  function _ensureH2C(){
    if(window.html2canvas) return Promise.resolve();
    if(!_h2cPromise) _h2cPromise = _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    return _h2cPromise;
  }
  function _ensureH2P(){
    if(window.html2pdf) return Promise.resolve();
    if(!_h2pPromise) _h2pPromise = _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
    return _h2pPromise;
  }

  // Pré-carregar ambas
  _ensureH2C().catch(function(e){ console.warn('[80]', e); });
  _ensureH2P().catch(function(e){ console.warn('[80]', e); });

  // ─── 2. Localizadores DOM ────────────────────────────────────────────
  var LOC = {
    proposta: function(){
      return document.querySelector('#tab-proposta .proposta-page')
          || document.querySelector('.proposta-page')
          || document.getElementById('tab-proposta');
    },
    margens: function(){
      // "Resultado — Porta" = div.rc (sticky top, margens/tabela/fat/custo)
      return document.querySelector('.rc');
    },
    memorial: function(){
      // Resumo da Obra (é o "Memorial" que Felipe chama)
      return document.getElementById('resumo-obra');
    },
    painel_rep: function(){
      return document.getElementById('painel-rep')
          || document.getElementById('painel-representante')
          || document.querySelector('.rc'); // fallback: o painel rep é gerado dinamicamente; usa o Resultado
    }
  };

  // ─── 3. Download PNG via html2canvas ─────────────────────────────────
  async function _downloadPNG(tipo, baseNome, sufixo){
    await _ensureH2C();
    if(!window.html2canvas) throw new Error('html2canvas não disponível');
    var el = LOC[tipo] ? LOC[tipo]() : null;
    if(!el){ console.warn('[80] elemento '+tipo+' não achado'); return false; }

    // Garantir visibilidade temporária
    var origDisplay = el.style.display;
    if(origDisplay === 'none') el.style.display = '';

    try {
      var canvas = await window.html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false
      });
      var dataUrl = canvas.toDataURL('image/png');
      var nome = (baseNome || 'projetta') + ' - ' + sufixo + '.png';
      var a = document.createElement('a');
      a.href = dataUrl; a.download = nome;
      document.body.appendChild(a); a.click();
      setTimeout(function(){ if(a.parentNode) a.parentNode.removeChild(a); }, 100);
      return true;
    } finally {
      el.style.display = origDisplay;
    }
  }

  // ─── 4. Download PDF via html2pdf (só proposta) ──────────────────────
  async function _downloadPDF(tipo, baseNome, sufixo){
    await _ensureH2P();
    if(!window.html2pdf) throw new Error('html2pdf não disponível');
    var el = LOC[tipo] ? LOC[tipo]() : null;
    if(!el){ console.warn('[80] elemento '+tipo+' não achado'); return false; }

    var origDisplay = el.style.display;
    if(origDisplay === 'none') el.style.display = '';
    var nome = (baseNome || 'projetta') + ' - ' + sufixo + '.pdf';

    try {
      await window.html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename: nome,
          image: { type:'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit:'mm', format:'a4', orientation:'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        })
        .from(el).save();
      return true;
    } finally {
      el.style.display = origDisplay;
    }
  }

  // ─── 5. API pública ──────────────────────────────────────────────────
  window.downloadProposta = function(baseNome){
    return _downloadPDF('proposta', baseNome, 'Proposta Comercial');
  };
  window.downloadMargens = function(baseNome){
    return _downloadPNG('margens', baseNome, 'MC - Margens');
  };
  window.downloadMemorial = function(baseNome){
    return _downloadPNG('memorial', baseNome, 'MR - Memorial');
  };
  window.downloadPainelRep = function(baseNome){
    return _downloadPNG('painel_rep', baseNome, 'RC - Representante');
  };

  console.log('%c[80 v2] Proposta=PDF · Margens/Memorial/Rep=PNG',
              'color:#003144;font-weight:700;background:#eaf2f7;padding:3px 8px;border-radius:4px');
})();
