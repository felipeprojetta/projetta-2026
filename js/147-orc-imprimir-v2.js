/* ============================================================================
 * js/147-orc-imprimir-v2.js  —  Imprimir robusto (28-abr-2026)
 *
 * Felipe 28/04: relatos do bug:
 *   1) Imprimir abre dialogo do navegador (window.print) em vez de baixar
 *   2) So o RC.png e baixado - Resumo Obra e Resultado Porta nao baixam
 *
 * SOBRESCREVE window.crmOrcImprimir do 145 com uma versao robusta:
 *   - Bloqueia window.print() durante toda a operacao
 *   - Expande #resumo-obra se collapsed antes de capturar
 *   - Captura aba Proposta DIRETAMENTE (html2canvas + jsPDF) sem chamar
 *     printProposta (que dispara window.print)
 *   - Logs verbosos no console pra debug
 *   - Tudo sequencial com awaits adequados
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta147Applied) return;
  window.__projetta147Applied = true;

  function $(id){ return document.getElementById(id); }
  function val(id){ var e = $(id); return e ? (e.value || '') : ''; }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function clean(s){ return String(s||'').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').slice(0,30); }

  function toast(html, color, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:400px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 3500);
  }

  async function carregarLib(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function(){ rej(new Error('falhou ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function garantirLibs(){
    if(!window.html2canvas){
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
    if(!window.jspdf){
      await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
  }

  function baixarCanvasPNG(canvas, nome){
    return new Promise(function(res){
      canvas.toBlob(function(blob){
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); res(); }, 600);
      }, 'image/png');
    });
  }

  async function capturarElemento(el, nome){
    if(!el){ console.warn('[147]', nome, 'elemento nao encontrado'); return false; }
    var rect = el.getBoundingClientRect();
    if(rect.width <= 0 || rect.height <= 0){
      console.warn('[147]', nome, 'sem dimensoes:', rect);
      return false;
    }
    try {
      var canvas = await window.html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#fff',
        logging: false, allowTaint: true,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight
      });
      await baixarCanvasPNG(canvas, nome);
      console.log('[147] ✓', nome);
      return true;
    } catch(e){
      console.error('[147]', nome, 'erro:', e);
      return false;
    }
  }

  // ============= IMPRIMIR (sobrescreve 145) =============
  window.crmOrcImprimir = async function(){
    var nomeBase = (val('num-agp') || val('agp') || 'orcamento') + '_' +
                   (val('numprojeto') || val('reserva') || '') + '_' +
                   clean(val('cliente') || val('crm-o-cliente'));

    toast('🖨️ <b>Iniciando impressão...</b><br><span style="font-size:11px;font-weight:400">Carregando bibliotecas</span>', '#0C447C', 3000);

    // 0) Bloquear window.print durante TODA a operacao
    var origPrint = window.print;
    window.print = function(){ console.log('[147] window.print bloqueado'); };

    try {
      await garantirLibs();
    } catch(e){
      window.print = origPrint;
      toast('❌ <b>Falha ao carregar bibliotecas</b>', '#c0392b', 5000);
      return;
    }

    var feitos = [];
    var falhas = [];

    // ============= 1) PNG Resumo da Obra =============
    try {
      var elObra = $('resumo-obra');
      if(elObra){
        // Garantir visivel - expandir body se collapsed
        var displayAntes = elObra.style.display;
        if(elObra.style.display === 'none') elObra.style.display = '';
        var bodyObra = $('resumo-obra-body');
        var bodyDisplayAntes = bodyObra ? bodyObra.style.display : null;
        if(bodyObra && bodyObra.style.display === 'none') bodyObra.style.display = 'flex';
        await sleep(300);

        var ok = await capturarElemento(elObra, nomeBase + '_resumo-obra.png');
        ok ? feitos.push('Resumo Obra') : falhas.push('Resumo Obra');

        // Restaurar estado
        if(displayAntes !== undefined) elObra.style.display = displayAntes;
        if(bodyObra && bodyDisplayAntes !== null) bodyObra.style.display = bodyDisplayAntes;
        await sleep(300);
      } else {
        falhas.push('Resumo Obra (#resumo-obra nao existe)');
      }
    } catch(e){ console.error('[147 obra]', e); falhas.push('Resumo Obra (' + e.message + ')'); }

    // ============= 2) PNG Resultado Porta =============
    try {
      var elTabPorta = $('m-tab-porta');
      var elPorta = elTabPorta ? elTabPorta.closest('.rc') : null;
      if(!elPorta){
        // Fallback: procurar diretamente pelo titulo
        document.querySelectorAll('.rc').forEach(function(rc){
          if(!elPorta && rc.textContent.indexOf('Resultado — Porta') >= 0) elPorta = rc;
        });
      }
      if(elPorta){
        // Forçar position relative pra captura (caso tenha sticky)
        var posAntes = elPorta.style.position;
        elPorta.style.position = 'relative';
        await sleep(200);
        var ok2 = await capturarElemento(elPorta, nomeBase + '_resultado-porta.png');
        elPorta.style.position = posAntes;
        ok2 ? feitos.push('Resultado Porta') : falhas.push('Resultado Porta');
        await sleep(300);
      } else {
        falhas.push('Resultado Porta (.rc nao encontrado)');
      }
    } catch(e){ console.error('[147 porta]', e); falhas.push('Resultado Porta (' + e.message + ')'); }

    // ============= 3) PNG Painel Representante (delega) =============
    try {
      if(typeof window.printPainelRep === 'function'){
        window.printPainelRep();
        feitos.push('Painel Representante');
        await sleep(2000); // tempo pra html2canvas + download
      } else {
        falhas.push('Painel Representante (funcao nao existe)');
      }
    } catch(e){ console.error('[147 rep]', e); falhas.push('Painel Representante'); }

    // ============= 4) PDF Proposta (captura direta, sem printProposta) =============
    try {
      // Garantir que populateProposta foi chamada
      if(typeof window.populateProposta === 'function'){
        try { window.populateProposta(); } catch(e){}
      }
      // Ir pra aba Proposta
      if(typeof window.switchTab === 'function'){
        try { window.switchTab('proposta'); } catch(e){}
      }
      await sleep(800); // aguardar render

      var elProposta = $('tab-proposta')
                    || document.querySelector('[id*="proposta"]:not([id*="comer"])');
      if(elProposta){
        var canvasP = await window.html2canvas(elProposta, {
          scale: 2, useCORS: true, backgroundColor: '#fff', logging: false
        });
        // Gerar PDF multi-pagina
        var jspdfRef = window.jspdf || window.jsPDF;
        var jsPDF = jspdfRef.jsPDF || jspdfRef;
        var pdf = new jsPDF('p', 'mm', 'a4');
        var pdfW = pdf.internal.pageSize.getWidth();
        var pdfH = pdf.internal.pageSize.getHeight();
        var imgW = pdfW;
        var imgH = (canvasP.height * pdfW) / canvasP.width;
        var imgData = canvasP.toDataURL('image/jpeg', 0.92);
        var y = 0;
        while(y < imgH){
          if(y > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, -y, imgW, imgH);
          y += pdfH;
        }
        pdf.save(nomeBase + '_proposta.pdf');
        feitos.push('Proposta PDF');
        await sleep(500);
      } else {
        falhas.push('Proposta (#tab-proposta nao encontrado)');
      }

      // Voltar pra aba Orcamento
      if(typeof window.switchTab === 'function'){
        try { window.switchTab('orcamento'); } catch(e){}
      }
    } catch(e){ console.error('[147 pdf]', e); falhas.push('Proposta PDF (' + e.message + ')'); }

    // 5) Restaurar window.print
    window.print = origPrint;

    // Toast final
    var msg = '';
    if(feitos.length) msg += '✅ <b>' + feitos.length + ' arquivo(s) baixado(s):</b><br><span style="font-size:11px;font-weight:400">' + feitos.join(' · ') + '</span>';
    if(falhas.length){
      if(msg) msg += '<br><br>';
      msg += '⚠ <b>Falhas:</b><br><span style="font-size:11px;font-weight:400">' + falhas.join(' · ') + '</span>';
    }
    toast(msg, falhas.length ? '#e67e22' : '#27ae60', 7000);
    console.log('[147] resultado:', { feitos: feitos, falhas: falhas });
  };

  console.log('[147-imprimir-v2] crmOrcImprimir sobrescrita');
})();
