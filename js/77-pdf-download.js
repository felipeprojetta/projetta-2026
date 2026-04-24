/**
 * 77-pdf-download.js — Intercepta printProposta pra fazer DOWNLOAD do PDF
 *   em vez de abrir diálogo de impressão.
 *
 * Usa html2canvas + jsPDF (carregados via CDN on-demand).
 * Nome do arquivo: AGP{n} - {reserva} - {cliente}.pdf (padrão Projetta).
 */
(function(){
  'use strict';

  // Carregar libs CDN on-demand
  function _carregarLib(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function _garantirLibs(){
    if(!window.html2canvas){
      await _carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    if(!window.jspdf){
      await _carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
  }

  function _nomePDF(){
    var cli = (document.getElementById('crm-o-cliente') || document.getElementById('cliente') || {value:''}).value || '';
    var agp = (document.getElementById('num-agp') || document.getElementById('crm-o-agp') || {value:''}).value || '';
    var res = (document.getElementById('numprojeto') || document.getElementById('crm-o-reserva') || {value:''}).value || '';
    var parts = [];
    if(agp) parts.push(agp.replace(/\s+/g,''));
    if(res) parts.push(res);
    if(cli && cli !== '—') parts.push(cli.replace(/[^\w\sÀ-ú]/g,'').replace(/\s+/g,'_').substring(0,30));
    if(!parts.length) parts.push('Proposta_' + Date.now());
    return parts.join(' - ') + '.pdf';
  }

  async function _capturarAbaProposta(){
    // Navega pra aba Proposta e captura o DOM
    if(typeof switchTab === 'function') try { switchTab('proposta'); } catch(e){}
    await new Promise(function(r){ setTimeout(r, 500); });

    // Achar o container da proposta (tenta vários IDs comuns)
    var alvo = document.getElementById('proposta-container')
            || document.getElementById('proposta-print-area')
            || document.getElementById('tab-proposta')
            || document.querySelector('.proposta-comercial')
            || document.querySelector('[data-aba="proposta"]');
    if(!alvo){
      // Fallback: pegar toda a área visível da aba
      alvo = document.body;
    }
    return alvo;
  }

  async function _gerarPDFDownload(alvo, nome){
    var { jsPDF } = window.jspdf;
    var canvas = await window.html2canvas(alvo, { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false });
    var imgData = canvas.toDataURL('image/jpeg', 0.95);
    var pdf = new jsPDF('p', 'mm', 'a4');
    var pdfW = pdf.internal.pageSize.getWidth();
    var pdfH = pdf.internal.pageSize.getHeight();
    var imgW = pdfW;
    var imgH = (canvas.height * pdfW) / canvas.width;
    var y = 0;
    // Multi-página: partir a imagem em páginas A4
    while(y < imgH){
      if(y > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -y, imgW, imgH);
      y += pdfH;
    }
    pdf.save(nome);
  }

  // Interceptar printProposta (substituir window.print por download)
  var instalado = false;
  function _instalar(){
    if(instalado) return;
    if(typeof window.printProposta !== 'function') return;
    var original = window.printProposta;
    window.printProposta = async function(){
      try {
        // Roda a original MAS NEUTRALIZA window.print()
        var origPrint = window.print;
        window.print = function(){ /* bloqueado: vamos fazer download */ };
        try { original.apply(this, arguments); } catch(e){ console.warn('[pdf-download] original:', e); }
        window.print = origPrint;

        // Aguardar DOM montar
        await new Promise(function(r){ setTimeout(r, 800); });
        await _garantirLibs();
        var alvo = await _capturarAbaProposta();
        var nome = _nomePDF();
        await _gerarPDFDownload(alvo, nome);
        console.log('%c[pdf-download] ✓ '+nome, 'color:#27ae60;font-weight:700');
      } catch(err){
        console.error('[pdf-download]', err);
        alert('Erro ao gerar PDF: ' + err.message);
      }
    };
    instalado = true;
    console.log('[77-pdf-download] ✓ printProposta interceptada');
  }

  // Tentar instalar repetidamente (depende de 12-proposta.js carregar)
  var t = 0;
  var iv = setInterval(function(){
    t++; _instalar();
    if(instalado || t > 30) clearInterval(iv);
  }, 500);

  console.log('%c[77-pdf-download] v1 aguardando printProposta','color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
