/* ============================================================================
 * js/153-pngs-completo-zerar-total.js  —  Backup completo + Zerar 100% (28-abr-2026)
 *
 * Felipe 28/04 - 2 pedidos:
 *
 * 1) BACKUP TOTAL via PNGs ao imprimir:
 *    - PNG da aba Levantamento de Perfis (com Ordem Servico + Aproveitamento + Relacao)
 *    - PNG da aba Levantamento de Acessorios (Fabricacao + Obra + Digitais)
 *    - PNG da aba Levantamento de Superficies (com canvas das chapas)
 *    - PNG separado do canvas das chapas (pixel perfeito)
 *    "memoria momentanea - se nao salvar nao perde nada"
 *
 * 2) BOTAO ZERAR deve zerar 100%:
 *    Ainda fica historico de perfis/acessorios manuais e chapas de orcamentos
 *    anteriores. Causa: 75-zerar-tudo.js limpa inputs mas NAO limpa:
 *    - tbody de tabelas dinamicas (osa-manual-tbody, osp-manual-tbody, plan-manual-table)
 *    - variaveis globais do planificador (PLN_RES, PLN_CSI, _PLN_CHAPA_SIZE_BY_COLOR)
 *    - canvas das chapas (plan-canvas)
 *    - areas de info (plan-cinfo, plan-leg, plan-auto-info)
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta153Applied) return;
  window.__projetta153Applied = true;

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

  /* ═══════════ 1) ZERAR TOTAL (sobrescreve zerarValores/zerarTudo) ═══════════ */

  function limparTBody(id){
    var el = $(id);
    if(el){ el.innerHTML = ''; return true; }
    return false;
  }

  function limparTabelaPorTabela(tableId){
    var t = $(tableId);
    if(!t) return false;
    var tbodies = t.querySelectorAll('tbody');
    tbodies.forEach(function(tb){ tb.innerHTML = ''; });
    return true;
  }

  function limparPlanificadorTotal(){
    // Variaveis globais do planificador
    try { window.PLN_RES = null; } catch(e){}
    try { window.PLN_CSI = 0; } catch(e){}
    try { window._PLN_CHAPA_SIZE_BY_COLOR = {}; } catch(e){}
    // Tentar variaveis sem window. (caso sejam declaradas com var)
    try { if(typeof PLN_RES !== 'undefined') PLN_RES = null; } catch(e){}
    try { if(typeof PLN_CSI !== 'undefined') PLN_CSI = 0; } catch(e){}

    // Canvas
    var cv = $('plan-canvas');
    if(cv){
      try {
        var ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, cv.width, cv.height);
        cv.width = 0;
        cv.height = 0;
      } catch(e){}
    }

    // Areas dinâmicas
    ['plan-cinfo','plan-leg','plan-auto-info','plan-cores-panel-list'].forEach(function(id){
      var el = $(id); if(el) el.innerHTML = '';
    });

    // Tabela de peças manuais do planificador
    limparTabelaPorTabela('plan-manual-table');

    return true;
  }

  function limparOSPerfis(){
    limparTBody('osp-manual-tbody');
    // Reset selects/inputs específicos do osp
    ['osp-manual-sel','osp-manual-corte','osp-manual-qty'].forEach(function(id){
      var el = $(id);
      if(el){
        if(el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = id.endsWith('qty') ? '1' : '';
      }
    });
    return true;
  }

  function limparOSAcess(){
    limparTBody('osa-manual-tbody');
    var totalEl = $('osa-manual-total');
    if(totalEl) totalEl.style.display = 'none';
    var emptyEl = $('osa-manual-empty');
    if(emptyEl) emptyEl.style.display = '';
    return true;
  }

  // Sobrescrever zerarTudo / zerarValores adicionando os passos extras
  function instalarZerarCompleto(){
    var origZerar = window.zerarValores || window.zerarTudo;
    if(!origZerar){ setTimeout(instalarZerarCompleto, 300); return; }
    if(origZerar.__sub153Hooked) return;

    var novoZerar = function(){
      // Chamar original (limpa inputs, displays, paineis, etc)
      var r = origZerar.apply(this, arguments);

      // Adicionar limpezas extras (depois do confirm/return do original)
      // Se usuario cancelou no confirm, _orcItens ainda esta cheio - skip
      if(window._orcItens && window._orcItens.length > 0){
        console.log('[153] zerar cancelado pelo usuario, mantendo estado');
        return r;
      }

      console.log('[153] zerando extras: planificador + OS perfis + OS acess');
      try { limparPlanificadorTotal(); } catch(e){ console.warn('[153 plan]', e); }
      try { limparOSPerfis(); } catch(e){ console.warn('[153 osp]', e); }
      try { limparOSAcess(); } catch(e){ console.warn('[153 osa]', e); }

      // Re-render
      try { if(typeof window.osPerfisRender === 'function') window.osPerfisRender(); } catch(e){}
      try { if(typeof window.osAcessRender === 'function') window.osAcessRender(); } catch(e){}
      try { if(typeof window.planRun === 'function') window.planRun(); } catch(e){}

      // Toast adicional confirmando zerar total
      setTimeout(function(){
        toast('🧹 <b>Zerado 100%</b><br><span style="font-size:11px;font-weight:400">Planificador, perfis e acessórios manuais limpos</span>', '#16a34a', 4000);
      }, 800);

      return r;
    };
    novoZerar.__sub153Hooked = true;
    window.zerarValores = novoZerar;
    window.zerarTudo = novoZerar;
    console.log('[153] zerarValores estendido');
  }

  /* ═══════════ 2) PNGs DE TODAS AS ABAS (extends crmOrcImprimir) ═══════════ */

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

  async function capturarViaClone(elOriginal, nome){
    if(!elOriginal) return false;
    var rect = elOriginal.getBoundingClientRect();
    var w = Math.max(rect.width, elOriginal.offsetWidth, 800);
    if(w < 200) w = 800;

    var clone = elOriginal.cloneNode(true);
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
      console.error('[153]', nome, e);
      return false;
    }
  }

  // Captura DIRETA do canvas (pixel perfeito do desenho)
  async function capturarCanvasDireto(canvasEl, nome){
    if(!canvasEl || !(canvasEl instanceof HTMLCanvasElement)) return false;
    if(canvasEl.width === 0 || canvasEl.height === 0) return false;
    return await new Promise(function(res){
      canvasEl.toBlob(function(blob){ res(baixarBlob(blob, nome)); }, 'image/png');
    });
  }

  async function capturarAbaSwitching(tabName, elemId, nome){
    // Salvar aba atual
    var origTab = null;
    document.querySelectorAll('.tab-panel').forEach(function(tp){
      if(tp.classList.contains('on')) origTab = tp.id;
    });

    // Switchar
    if(typeof window.switchTab === 'function'){
      try { window.switchTab(tabName); } catch(e){}
    }
    await sleep(900); // aguardar render

    // Capturar
    var el = $(elemId);
    var ok = false;
    if(el){
      ok = await capturarViaClone(el, nome);
    }

    return { ok: ok, origTab: origTab };
  }

  // Sobrescrever crmOrcImprimir adicionando os PNGs das abas
  window.crmOrcImprimir = async function(){
    var nomeBase = (val('num-agp') || val('agp') || 'orcamento') + '_' +
                   (val('numprojeto') || val('reserva') || '') + '_' +
                   clean(val('cliente') || val('crm-o-cliente'));

    toast('🖨️ <b>Iniciando backup completo...</b><br><span style="font-size:11px;font-weight:400">Gerando PNGs de todas as abas + PDF</span>', '#0C447C', 3500);

    try { await garantirLibs(); }
    catch(e){ toast('❌ Falha bibliotecas', '#c0392b', 5000); return; }

    var feitos = [];
    var falhas = [];

    // Garantir aba Orcamento ativa pra captura inicial
    if(typeof window.switchTab === 'function'){
      try { window.switchTab('orcamento'); } catch(e){}
    }
    await sleep(500);

    // Garantir painel rep inline atualizado
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
        (await capturarViaClone(elObra, nomeBase + '_01_resumo-obra.png')) ? feitos.push('Resumo Obra') : falhas.push('Resumo Obra');
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
        (await capturarViaClone(elPorta, nomeBase + '_02_resultado-porta.png')) ? feitos.push('Resultado Porta') : falhas.push('Resultado Porta');
      } else falhas.push('Resultado Porta');
    } catch(e){ falhas.push('Resultado Porta'); }
    await sleep(250);

    // 3) Painel Representante INLINE
    try {
      var elRep = $('painel-rep-inline');
      if(elRep){
        (await capturarViaClone(elRep, nomeBase + '_03_painel-representante.png')) ? feitos.push('Painel Representante') : falhas.push('Painel Representante');
      } else falhas.push('Painel Representante');
    } catch(e){ falhas.push('Painel Representante'); }
    await sleep(250);

    // 4) PNG aba Orcamento (caracteristicas + custos completos)
    try {
      var tabOrc = $('tab-orcamento');
      if(tabOrc){
        // Expandir todos os colapsaveis se possivel
        tabOrc.querySelectorAll('[id^="resumo-obra-body"], [id$="-body"]').forEach(function(b){
          if(b.style.display === 'none') b.style.display = '';
        });
        await sleep(300);
        (await capturarViaClone(tabOrc, nomeBase + '_04_orcamento-completo.png')) ? feitos.push('Orçamento') : falhas.push('Orçamento');
      }
    } catch(e){ falhas.push('Orçamento'); console.error('[153 orc]',e); }
    await sleep(300);

    // 5) PNG aba Lev. Perfis
    try {
      var r5 = await capturarAbaSwitching('os', 'tab-os', nomeBase + '_05_perfis.png');
      r5.ok ? feitos.push('Lev. Perfis') : falhas.push('Lev. Perfis');
    } catch(e){ falhas.push('Lev. Perfis'); console.error('[153 perfis]',e); }
    await sleep(400);

    // 6) PNG aba Lev. Acessorios
    try {
      var r6 = await capturarAbaSwitching('os-acess', 'tab-os-acess', nomeBase + '_06_acessorios.png');
      r6.ok ? feitos.push('Lev. Acessórios') : falhas.push('Lev. Acessórios');
    } catch(e){ falhas.push('Lev. Acessórios'); console.error('[153 aces]',e); }
    await sleep(400);

    // 7) PNG aba Lev. Superficies (canvas + lista)
    try {
      if(typeof window.switchTab === 'function'){
        try { window.switchTab('planificador'); } catch(e){}
      }
      await sleep(900);
      // Garantir que o planRun foi executado
      if(typeof window.planRun === 'function'){
        try { window.planRun(); } catch(e){}
      }
      await sleep(800);
      var tabPlan = $('tab-planificador');
      if(tabPlan){
        (await capturarViaClone(tabPlan, nomeBase + '_07_superficies.png')) ? feitos.push('Lev. Superfícies') : falhas.push('Lev. Superfícies');
      }
      // 7b) Canvas isolado pixel-perfect das chapas
      var cv = $('plan-canvas');
      if(cv && cv.width > 0 && cv.height > 0){
        (await capturarCanvasDireto(cv, nomeBase + '_07b_chapas-canvas.png')) ? feitos.push('Canvas Chapas') : falhas.push('Canvas Chapas');
      }
    } catch(e){ falhas.push('Superficies'); console.error('[153 sup]',e); }
    await sleep(400);

    // 8) PDF Proposta (pagina por pagina)
    try {
      if(typeof window.populateProposta === 'function'){
        try { window.populateProposta(); } catch(e){}
      }
      if(typeof window.switchTab === 'function'){
        try { window.switchTab('proposta'); } catch(e){}
      }
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
          } catch(e){ console.error('[153 pg' + i + ']', e); }
        }
        if(capturadas > 0){ pdf.save(nomeBase + '_08_proposta.pdf'); feitos.push('Proposta PDF'); }
        else falhas.push('Proposta PDF');
      } else falhas.push('Proposta PDF');
    } catch(e){ falhas.push('Proposta PDF'); console.error('[153 pdf]', e); }

    // Voltar pra aba Orçamento
    if(typeof window.switchTab === 'function'){
      try { window.switchTab('orcamento'); } catch(e){}
    }

    var msg = '';
    if(feitos.length) msg += '✅ <b>'+feitos.length+' arquivo(s) baixado(s):</b><br><span style="font-size:11px;font-weight:400">'+feitos.join(' · ')+'</span>';
    if(falhas.length){
      if(msg) msg += '<br><br>';
      msg += '⚠ <b>Falhas:</b> ' + falhas.join(' · ');
    }
    toast(msg, falhas.length ? '#e67e22' : '#27ae60', 9000);
    console.log('[153] resultado:', { feitos: feitos, falhas: falhas });
  };

  /* ═══════════ INIT ═══════════ */
  function init(){
    instalarZerarCompleto();
    console.log('[153-pngs-completo-zerar-total] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
