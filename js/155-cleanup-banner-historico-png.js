/* ============================================================================
 * js/155-cleanup-banner-historico-png.js  —  Limpeza definitiva (28-abr-2026)
 *
 * Felipe 28/04: 3 problemas
 *
 * 1) BANNER DUPLICADO no topo da aba Orcamento
 *    "1 orcamento(s) salvo(s)" aparecendo 2x. Causa: o 145 cria banner-v1
 *    E o 149 cria banner-v2 - ambos visiveis.
 *
 * 2) HISTORICO NO MODAL CRM com bug ("Carregar abre tudo zerado")
 *    Felipe pediu: "acho melhor eliminar esse historico ainda com bug".
 *    Removendo a secao por enquanto. Badge no Kanban continua funcionando
 *    (apenas mostra contagem, nao tem botao Carregar).
 *
 * 3) PNGs DE CAPTURA com selects vazios ("- Selecione -" mesmo com valor)
 *    BUG CLASSICO do cloneNode(true) com <select>: copia os <option> mas
 *    NAO preserva o selectedIndex/value setado via JS. Solucao: ANTES de
 *    capturar, substituir cada <select> por um <span> com o texto da
 *    option selecionada.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta155Applied) return;
  window.__projetta155Applied = true;

  function $(id){ return document.getElementById(id); }
  function val(id){ var e = $(id); return e ? (e.value || '') : ''; }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function clean(s){ return String(s||'').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').slice(0,30); }

  function toast(html, color, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:420px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 3500);
  }

  /* ═══════════ 1) ESCONDER BANNERS DUPLICADOS NA ABA ORCAMENTO ═══════════ */
  function esconderBanners(){
    // Banner v1 (do 145) e v2 (do 149) — ambos no tab-orcamento
    ['orc-historico-banner','orc-historico-banner-v2'].forEach(function(id){
      var el = $(id);
      if(el && el.style.display !== 'none'){
        el.style.display = 'none';
      }
    });
  }
  // Roda repetidamente caso os banners sejam re-inseridos
  setInterval(esconderBanners, 1000);

  /* ═══════════ 2) ELIMINAR HISTORICO NO MODAL CRM ═══════════ */
  function esconderHistoricoModal(){
    document.querySelectorAll('#crm-orc-historico-section, #crm-orc-historico-section-v2').forEach(function(el){
      el.style.display = 'none';
    });
  }
  setInterval(esconderHistoricoModal, 1000);

  // Tambem desabilitar a funcao de inserir secao do 152/154 sobrescrevendo
  // popularHistoricoV3 com no-op
  setTimeout(function(){
    if(typeof window.crmOrcCarregarV2 === 'function'){
      // Substituir Carregar por mensagem informativa
      window.crmOrcCarregarV2 = function(){
        toast('⚠ Função "Carregar" temporariamente desativada<br><span style="font-size:11px;font-weight:400">Use o botão laranja "Imprimir" para gerar backup PNG completo</span>', '#e67e22', 5000);
      };
    }
    if(typeof window.crmOrcCarregarV3 === 'function'){
      window.crmOrcCarregarV3 = function(){
        toast('⚠ Função "Carregar" temporariamente desativada<br><span style="font-size:11px;font-weight:400">Use o botão laranja "Imprimir" para gerar backup PNG completo</span>', '#e67e22', 5000);
      };
    }
  }, 1500);

  /* ═══════════ 3) FIX PNGs - PRESERVAR VALOR DE SELECTS NO CLONE ═══════════ */

  // Substitui <select> por <span> com texto da option selecionada
  // Tambem trata <input> tipo radio/checkbox para mostrar estado correto
  function congelarValoresParaCaptura(rootEl){
    if(!rootEl) return;

    // SELECTS: substituir por span com texto
    rootEl.querySelectorAll('select').forEach(function(sel){
      var idx = sel.selectedIndex;
      var txt = '';
      if(idx >= 0 && sel.options[idx]){
        txt = sel.options[idx].text || sel.options[idx].value || '';
      }

      // Pegar estilos computados pra manter aparencia
      var cs = window.getComputedStyle(sel);
      var span = document.createElement('span');
      span.textContent = txt || '—';
      span.style.cssText =
        'display:inline-block;' +
        'width:' + (sel.offsetWidth - 2) + 'px;' +
        'min-height:' + (sel.offsetHeight - 2) + 'px;' +
        'box-sizing:border-box;' +
        'padding:' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft + ';' +
        'border:' + cs.border + ';' +
        'border-radius:' + cs.borderRadius + ';' +
        'background:' + cs.backgroundColor + ';' +
        'color:' + cs.color + ';' +
        'font-family:' + cs.fontFamily + ';' +
        'font-size:' + cs.fontSize + ';' +
        'font-weight:' + cs.fontWeight + ';' +
        'line-height:' + cs.lineHeight + ';' +
        'text-align:' + cs.textAlign + ';' +
        'vertical-align:middle;' +
        'overflow:hidden;' +
        'text-overflow:ellipsis;' +
        'white-space:nowrap;';
      sel.parentNode.replaceChild(span, sel);
    });

    // INPUTS: garantir que o atributo value reflete o valor atual
    // (cloneNode copia atributos mas nao a propriedade value de inputs digitados)
    rootEl.querySelectorAll('input').forEach(function(inp){
      if(inp.type === 'checkbox' || inp.type === 'radio'){
        if(inp.checked) inp.setAttribute('checked', 'checked');
        else inp.removeAttribute('checked');
      } else if(inp.type !== 'file'){
        inp.setAttribute('value', inp.value || '');
      }
    });

    // TEXTAREAS: o conteudo de textarea nao e copiado pelo cloneNode
    rootEl.querySelectorAll('textarea').forEach(function(ta){
      ta.textContent = ta.value || '';
    });
  }

  /* ═══════════ 4) REESCRITA DE crmOrcImprimir COM FIX DE SELECTS ═══════════ */

  async function carregarLib(src){
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function(){ rej(new Error('falhou ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function garantirLibs(){
    if(!window.html2canvas) await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    if(!window.jspdf) await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  }

  function baixarBlob(blob, nome){
    if(!blob || blob.size === 0) return false;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 800);
    return true;
  }

  // Captura via clone — AGORA com congelar valores ANTES do html2canvas
  async function capturarViaCloneFixed(elOriginal, nome){
    if(!elOriginal) return false;
    var rect = elOriginal.getBoundingClientRect();
    var w = Math.max(rect.width, elOriginal.offsetWidth, 800);
    if(w < 200) w = 800;

    var clone = elOriginal.cloneNode(true);

    // 🔧 CONGELAR VALORES DE SELECTS/INPUTS/TEXTAREAS
    congelarValoresParaCaptura(clone);

    clone.style.position = 'absolute';
    clone.style.top = '-99999px';
    clone.style.left = '0';
    clone.style.width = w + 'px';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.overflow = 'visible';
    clone.style.transform = 'none';
    clone.style.background = '#fff';
    clone.querySelectorAll('button').forEach(function(b){ b.style.display='none'; });
    document.body.appendChild(clone);
    await sleep(180);

    try {
      var canvas = await window.html2canvas(clone, {
        scale: 2, useCORS: true, backgroundColor: '#fff',
        logging: false, allowTaint: true, width: w, windowWidth: w
      });
      document.body.removeChild(clone);
      return await new Promise(function(res){
        canvas.toBlob(function(blob){ res(baixarBlob(blob, nome)); }, 'image/png');
      });
    } catch(e){
      try { document.body.removeChild(clone); } catch(_){}
      console.error('[155]', nome, e);
      return false;
    }
  }

  async function capturarCanvasDireto(canvasEl, nome){
    if(!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) return false;
    if(canvasEl.width === 0 || canvasEl.height === 0) return false;
    return await new Promise(function(res){
      canvasEl.toBlob(function(blob){ res(baixarBlob(blob, nome)); }, 'image/png');
    });
  }

  // Reescrever crmOrcImprimir usando capturarViaCloneFixed
  window.crmOrcImprimir = async function(){
    var nomeBase = (val('num-agp') || val('agp') || 'orcamento') + '_' +
                   (val('numprojeto') || val('reserva') || '') + '_' +
                   clean(val('cliente') || val('crm-o-cliente'));

    toast('🖨️ <b>Iniciando backup completo...</b><br><span style="font-size:11px;font-weight:400">Selects/inputs serão preservados nos PNGs</span>', '#0C447C', 3500);

    try { await garantirLibs(); }
    catch(e){ toast('❌ Falha bibliotecas', '#c0392b', 5000); return; }

    var feitos = [], falhas = [];

    if(typeof window.switchTab === 'function'){
      try { window.switchTab('orcamento'); } catch(e){}
    }
    await sleep(500);

    if(typeof window._refreshPainelRepInline === 'function'){
      try { window._refreshPainelRepInline(); } catch(e){}
    }
    await sleep(200);

    // 1) Resumo Obra
    try {
      var elObra = $('resumo-obra');
      if(elObra){
        var dispA = elObra.style.display;
        if(elObra.style.display === 'none') elObra.style.display = '';
        var bodyObra = $('resumo-obra-body');
        var dispB = bodyObra ? bodyObra.style.display : null;
        if(bodyObra && bodyObra.style.display === 'none') bodyObra.style.display = 'flex';
        await sleep(200);
        (await capturarViaCloneFixed(elObra, nomeBase + '_01_resumo-obra.png')) ? feitos.push('Resumo Obra') : falhas.push('Resumo Obra');
        if(dispA !== undefined) elObra.style.display = dispA;
        if(bodyObra && dispB !== null) bodyObra.style.display = dispB;
      } else falhas.push('Resumo Obra');
    } catch(e){ falhas.push('Resumo Obra'); }
    await sleep(250);

    // 2) Resultado Porta
    try {
      var elTabPorta = $('m-tab-porta');
      var elPorta = elTabPorta ? elTabPorta.closest('.rc') : null;
      if(elPorta){
        (await capturarViaCloneFixed(elPorta, nomeBase + '_02_resultado-porta.png')) ? feitos.push('Resultado Porta') : falhas.push('Resultado Porta');
      } else falhas.push('Resultado Porta');
    } catch(e){ falhas.push('Resultado Porta'); }
    await sleep(250);

    // 3) Painel Representante
    try {
      var elRep = $('painel-rep-inline');
      if(elRep){
        (await capturarViaCloneFixed(elRep, nomeBase + '_03_painel-representante.png')) ? feitos.push('Painel Representante') : falhas.push('Painel Representante');
      } else falhas.push('Painel Representante');
    } catch(e){ falhas.push('Painel Representante'); }
    await sleep(250);

    // 4) Aba Orcamento (com selects fixos!)
    try {
      var tabOrc = $('tab-orcamento');
      if(tabOrc){
        tabOrc.querySelectorAll('[id^="resumo-obra-body"], [id$="-body"]').forEach(function(b){
          if(b.style.display === 'none') b.style.display = '';
        });
        await sleep(300);
        (await capturarViaCloneFixed(tabOrc, nomeBase + '_04_orcamento-completo.png')) ? feitos.push('Orçamento') : falhas.push('Orçamento');
      }
    } catch(e){ falhas.push('Orçamento'); console.error('[155 orc]',e); }
    await sleep(300);

    // 5) Lev. Perfis
    try {
      if(typeof window.switchTab === 'function'){ try { window.switchTab('os'); } catch(e){} }
      await sleep(900);
      var tabOs = $('tab-os');
      if(tabOs){
        (await capturarViaCloneFixed(tabOs, nomeBase + '_05_perfis.png')) ? feitos.push('Lev. Perfis') : falhas.push('Lev. Perfis');
      }
    } catch(e){ falhas.push('Lev. Perfis'); }
    await sleep(400);

    // 6) Lev. Acessorios
    try {
      if(typeof window.switchTab === 'function'){ try { window.switchTab('os-acess'); } catch(e){} }
      await sleep(900);
      var tabAce = $('tab-os-acess');
      if(tabAce){
        (await capturarViaCloneFixed(tabAce, nomeBase + '_06_acessorios.png')) ? feitos.push('Lev. Acessórios') : falhas.push('Lev. Acessórios');
      }
    } catch(e){ falhas.push('Lev. Acessórios'); }
    await sleep(400);

    // 7) Lev. Superficies + canvas
    try {
      if(typeof window.switchTab === 'function'){ try { window.switchTab('planificador'); } catch(e){} }
      await sleep(900);
      if(typeof window.planRun === 'function'){
        try { window.planRun(); } catch(e){}
      }
      await sleep(800);
      var tabPlan = $('tab-planificador');
      if(tabPlan){
        (await capturarViaCloneFixed(tabPlan, nomeBase + '_07_superficies.png')) ? feitos.push('Lev. Superfícies') : falhas.push('Lev. Superfícies');
      }
      var cv = $('plan-canvas');
      if(cv && cv.width > 0 && cv.height > 0){
        (await capturarCanvasDireto(cv, nomeBase + '_07b_chapas-canvas.png')) ? feitos.push('Canvas Chapas') : falhas.push('Canvas Chapas');
      }
    } catch(e){ falhas.push('Lev. Superfícies'); }
    await sleep(400);

    // 8) PDF Proposta — pagina por pagina
    try {
      if(typeof window.populateProposta === 'function'){
        try { window.populateProposta(); } catch(e){}
      }
      if(typeof window.switchTab === 'function'){ try { window.switchTab('proposta'); } catch(e){} }
      await sleep(900);

      var pages = document.querySelectorAll('.proposta-page');
      if(pages.length > 0){
        var jspdfRef = window.jspdf || window.jsPDF;
        var jsPDF = jspdfRef.jsPDF || jspdfRef;
        var pdf = new jsPDF('p', 'mm', 'a4');
        var pdfW = pdf.internal.pageSize.getWidth();
        var pdfH = pdf.internal.pageSize.getHeight();
        var capturadas = 0;
        for(var i = 0; i < pages.length; i++){
          var page = pages[i];
          var rect = page.getBoundingClientRect();
          if(rect.height <= 0) continue;
          try {
            var canvasP = await window.html2canvas(page, { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false });
            var ratio = canvasP.width / canvasP.height;
            var pageRatio = pdfW / pdfH;
            var imgW, imgH, x, y;
            if(ratio > pageRatio){ imgW = pdfW; imgH = pdfW / ratio; x = 0; y = (pdfH - imgH) / 2; }
            else { imgH = pdfH; imgW = pdfH * ratio; x = (pdfW - imgW) / 2; y = 0; }
            if(capturadas > 0) pdf.addPage();
            pdf.addImage(canvasP.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, imgW, imgH);
            capturadas++;
            await sleep(150);
          } catch(e){ console.error('[155 pg' + i + ']', e); }
        }
        if(capturadas > 0){ pdf.save(nomeBase + '_08_proposta.pdf'); feitos.push('Proposta PDF'); }
        else falhas.push('Proposta PDF');
      } else falhas.push('Proposta PDF');
    } catch(e){ falhas.push('Proposta PDF'); console.error('[155 pdf]', e); }

    if(typeof window.switchTab === 'function'){ try { window.switchTab('orcamento'); } catch(e){} }

    var msg = '';
    if(feitos.length) msg += '✅ <b>'+feitos.length+' arquivo(s):</b><br><span style="font-size:11px;font-weight:400">'+feitos.join(' · ')+'</span>';
    if(falhas.length){
      if(msg) msg += '<br><br>';
      msg += '⚠ <b>Falhas:</b> ' + falhas.join(' · ');
    }
    toast(msg, falhas.length ? '#e67e22' : '#27ae60', 9000);
    console.log('[155] resultado:', { feitos: feitos, falhas: falhas });
  };

  function init(){
    esconderBanners();
    esconderHistoricoModal();
    console.log('[155-cleanup-banner-historico-png] iniciado');
    console.log('[155] crmOrcImprimir reescrito com fix de selects');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
