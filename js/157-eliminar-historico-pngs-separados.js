/* ============================================================================
 * js/157-eliminar-historico-pngs-separados.js  —  (28-abr-2026)
 *
 * Felipe 28/04: 2 pedidos
 *
 * 1) ELIMINAR TUDO sobre historico (aparece e some, nao funciona)
 *    Felipe: "se for complicado isso elimine essa parte, ai fico com
 *    historico mesmo somente pelos print das telas"
 *
 *    SOLUCAO: setInterval que esconde absolutamente tudo:
 *    - Banners (orc-historico-banner, orc-historico-banner-v2)
 *    - Secoes do modal (crm-orc-historico-section*, hist-v3-list)
 *    - Badge no Kanban (.orc-hist-badge)
 *    - Sobrescreve crmOrcVerHistorico/crmOrcCarregar/crmOrcExcluir com no-op
 *
 * 2) PNGs SEPARADOS das 5 secoes da aba Orcamento:
 *    - 04a Identificacao do projeto (#ident-body parent .card)
 *    - 04b Parametros financeiros (#param-body parent .card)
 *    - 04c Caracteristicas da porta (#carac-body parent .card)
 *    - 04d Custo de fabricacao (#fab-body parent .card)
 *    - 04e Custo de instalacao (#inst-body parent .card)
 *
 *    Para cada secao: expande body, captura .card inteiro, restaura.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta157Applied) return;
  window.__projetta157Applied = true;

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

  /* ═══════════ 1) ELIMINAR HISTORICO COMPLETAMENTE ═══════════ */
  function eliminarHistorico(){
    // Banners
    ['orc-historico-banner','orc-historico-banner-v2'].forEach(function(id){
      var el = $(id); if(el) el.style.display = 'none';
    });
    // Secoes do modal
    document.querySelectorAll(
      '#crm-orc-historico-section, #crm-orc-historico-section-v2'
    ).forEach(function(el){ el.style.display = 'none'; });
    // Badges no Kanban
    document.querySelectorAll('.orc-hist-badge').forEach(function(b){ b.remove(); });
  }
  setInterval(eliminarHistorico, 800);

  // Desabilitar funcoes de carregar/excluir/ver
  function noop(){ /* silent - nao faz nada */ }
  setTimeout(function(){
    ['crmOrcVerHistorico','crmOrcCarregar','crmOrcExcluir',
     'crmOrcCarregarV2','crmOrcExcluirV2',
     'crmOrcCarregarV3','crmOrcExcluirV3',
     'crmOrcCarregarModal','crmOrcExcluirModal',
     '_refreshBadgesKanban'
    ].forEach(function(fn){
      window[fn] = noop;
    });
  }, 1500);

  /* ═══════════ 2) PNGs SEPARADOS DAS SECOES ═══════════ */

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

  // Congelar valores de selects/inputs/textareas no clone
  function congelarValoresParaCaptura(rootEl){
    if(!rootEl) return;
    rootEl.querySelectorAll('select').forEach(function(sel){
      var idx = sel.selectedIndex;
      var txt = (idx >= 0 && sel.options[idx]) ? (sel.options[idx].text || sel.options[idx].value || '') : '';
      var cs = window.getComputedStyle(sel);
      var span = document.createElement('span');
      span.textContent = txt || '—';
      span.style.cssText =
        'display:inline-block;width:' + (sel.offsetWidth - 2) + 'px;' +
        'min-height:' + (sel.offsetHeight - 2) + 'px;box-sizing:border-box;' +
        'padding:' + cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft + ';' +
        'border:' + cs.border + ';border-radius:' + cs.borderRadius + ';' +
        'background:' + cs.backgroundColor + ';color:' + cs.color + ';' +
        'font-family:' + cs.fontFamily + ';font-size:' + cs.fontSize + ';' +
        'font-weight:' + cs.fontWeight + ';line-height:' + cs.lineHeight + ';' +
        'text-align:' + cs.textAlign + ';vertical-align:middle;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      sel.parentNode.replaceChild(span, sel);
    });
    rootEl.querySelectorAll('input').forEach(function(inp){
      if(inp.type === 'checkbox' || inp.type === 'radio'){
        if(inp.checked) inp.setAttribute('checked', 'checked');
        else inp.removeAttribute('checked');
      } else if(inp.type !== 'file'){
        inp.setAttribute('value', inp.value || '');
      }
    });
    rootEl.querySelectorAll('textarea').forEach(function(ta){
      ta.textContent = ta.value || '';
    });
  }

  async function capturarViaCloneFixed(elOriginal, nome){
    if(!elOriginal) return false;
    var rect = elOriginal.getBoundingClientRect();
    var w = Math.max(rect.width, elOriginal.offsetWidth, 800);
    if(w < 200) w = 800;

    var clone = elOriginal.cloneNode(true);
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
    // Garantir que TODOS os bodies dentro do clone estao visiveis
    clone.querySelectorAll('.cb').forEach(function(cb){ cb.style.display = ''; });
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
      console.error('[157]', nome, e);
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

  // Capturar uma secao individual (expande, captura .card parent, restaura)
  async function capturarSecaoOrc(bodyId, label, nome){
    var body = $(bodyId);
    if(!body) return false;
    var card = body.closest('.card');
    if(!card) return false;

    var dispOrig = body.style.display;
    if(body.style.display === 'none' || dispOrig === 'none') body.style.display = '';
    await sleep(200);

    var ok = await capturarViaCloneFixed(card, nome);

    // Restaurar estado original
    body.style.display = dispOrig;
    return ok;
  }

  /* ═══════════ REESCREVER crmOrcImprimir ═══════════ */
  window.crmOrcImprimir = async function(){
    var nomeBase = (val('num-agp') || val('agp') || 'orcamento') + '_' +
                   (val('numprojeto') || val('reserva') || '') + '_' +
                   clean(val('cliente') || val('crm-o-cliente'));

    toast('🖨️ <b>Backup completo</b><br><span style="font-size:11px;font-weight:400">11 PNGs separados + PDF</span>', '#0C447C', 3500);

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

    // 01) Resumo Obra
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
      }
    } catch(e){ falhas.push('Resumo Obra'); }
    await sleep(250);

    // 02) Resultado Porta
    try {
      var elTabPorta = $('m-tab-porta');
      var elPorta = elTabPorta ? elTabPorta.closest('.rc') : null;
      if(elPorta){
        (await capturarViaCloneFixed(elPorta, nomeBase + '_02_resultado-porta.png')) ? feitos.push('Resultado Porta') : falhas.push('Resultado Porta');
      }
    } catch(e){ falhas.push('Resultado Porta'); }
    await sleep(250);

    // 03) Painel Representante
    try {
      var elRep = $('painel-rep-inline');
      if(elRep){
        (await capturarViaCloneFixed(elRep, nomeBase + '_03_painel-representante.png')) ? feitos.push('Painel Representante') : falhas.push('Painel Representante');
      }
    } catch(e){ falhas.push('Painel Representante'); }
    await sleep(250);

    // 04a-e) 5 SECOES SEPARADAS DA ABA ORCAMENTO
    var secoes = [
      { body:'ident-body', nome:'04a_identificacao.png', label:'Identificação' },
      { body:'param-body', nome:'04b_parametros-financeiros.png', label:'Parâmetros Financeiros' },
      { body:'carac-body', nome:'04c_caracteristicas-porta.png', label:'Características' },
      { body:'fab-body',   nome:'04d_custo-fabricacao.png', label:'Custo Fabricação' },
      { body:'inst-body',  nome:'04e_custo-instalacao.png', label:'Custo Instalação' }
    ];
    for(var i = 0; i < secoes.length; i++){
      var s = secoes[i];
      try {
        var ok = await capturarSecaoOrc(s.body, s.label, nomeBase + '_' + s.nome);
        ok ? feitos.push(s.label) : falhas.push(s.label);
      } catch(e){ falhas.push(s.label); console.error('[157] '+s.label, e); }
      await sleep(250);
    }

    // 05) Lev. Perfis
    try {
      if(typeof window.switchTab === 'function'){ try { window.switchTab('os'); } catch(e){} }
      await sleep(900);
      var tabOs = $('tab-os');
      if(tabOs){
        (await capturarViaCloneFixed(tabOs, nomeBase + '_05_perfis.png')) ? feitos.push('Lev. Perfis') : falhas.push('Lev. Perfis');
      }
    } catch(e){ falhas.push('Lev. Perfis'); }
    await sleep(400);

    // 06) Lev. Acessorios
    try {
      if(typeof window.switchTab === 'function'){ try { window.switchTab('os-acess'); } catch(e){} }
      await sleep(900);
      var tabAce = $('tab-os-acess');
      if(tabAce){
        (await capturarViaCloneFixed(tabAce, nomeBase + '_06_acessorios.png')) ? feitos.push('Lev. Acessórios') : falhas.push('Lev. Acessórios');
      }
    } catch(e){ falhas.push('Lev. Acessórios'); }
    await sleep(400);

    // 07) Lev. Superficies + canvas
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

    // 08) PDF Proposta
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
        for(var j = 0; j < pages.length; j++){
          var page = pages[j];
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
          } catch(e){ console.error('[157 pg' + j + ']', e); }
        }
        if(capturadas > 0){ pdf.save(nomeBase + '_08_proposta.pdf'); feitos.push('Proposta PDF'); }
        else falhas.push('Proposta PDF');
      } else falhas.push('Proposta PDF');
    } catch(e){ falhas.push('Proposta PDF'); }

    if(typeof window.switchTab === 'function'){ try { window.switchTab('orcamento'); } catch(e){} }

    var msg = '';
    if(feitos.length) msg += '✅ <b>'+feitos.length+' arquivo(s):</b><br><span style="font-size:11px;font-weight:400">'+feitos.join(' · ')+'</span>';
    if(falhas.length){
      if(msg) msg += '<br><br>';
      msg += '⚠ <b>Falhas:</b> ' + falhas.join(' · ');
    }
    toast(msg, falhas.length ? '#e67e22' : '#27ae60', 9000);
    console.log('[157] resultado:', { feitos: feitos, falhas: falhas });
  };

  function init(){
    eliminarHistorico();
    console.log('[157-eliminar-historico-pngs-separados] iniciado');
    console.log('[157] crmOrcImprimir reescrito - 11 PNGs separados + PDF');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
