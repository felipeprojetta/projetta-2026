/* ============================================================================
 * js/152-fix-final.js  —  Fix final (28-abr-2026)
 *
 * Felipe 28/04: 3 problemas restantes
 *   1) Historico nao aparece no modal CRM (Editar Oportunidade)
 *      → Usar MutationObserver pra detectar modal abrindo (mais robusto
 *        que hook em crmOpenModal)
 *   2) RC duplicado (printPainelRep legado gera junto com painel-rep-inline)
 *      → Remover chamada legada do crmOrcImprimir
 *   3) PDF da Proposta desconfigurado
 *      → Capturar cada .proposta-page individualmente e montar PDF
 *        com 1 imagem por pagina A4 (preserva layout original)
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta152Applied) return;
  window.__projetta152Applied = true;

  var SB = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  function $(id){ return document.getElementById(id); }
  function val(id){ var e = $(id); return e ? (e.value || '') : ''; }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function clean(s){ return String(s||'').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').slice(0,30); }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function toast(html, color, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:400px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 3500);
  }

  /* ═══════════ 1) HISTORICO NO MODAL via MutationObserver ═══════════ */

  async function lerCard(cardId){
    var r = await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras,cliente', { headers: H });
    if(!r.ok) return null;
    var arr = await r.json();
    return arr[0];
  }

  function buildSecaoHistorico(){
    var section = document.createElement('div');
    section.id = 'crm-orc-historico-section-v2';
    section.style.cssText = 'margin:14px 0;padding:12px;background:#f0f7ff;border:2px solid #0C447C;border-radius:10px';
    section.innerHTML =
      '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#0C447C;margin-bottom:10px">' +
        '📚 Histórico de Orçamentos <span id="hist-v2-count" style="background:#0C447C;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px;margin-left:6px">0</span>' +
      '</div>' +
      '<div id="hist-v2-list" style="max-height:300px;overflow-y:auto"></div>';
    return section;
  }

  async function popularHistoricoModal(modalEl){
    var cardId = window._crmOrcCardId || window._snapCardId;
    if(!cardId){ console.log('[152] sem cardId pra popular historico'); return; }

    // Achar onde inserir: ANTES do "crm-modal-footer" dentro do modal
    var footer = modalEl.querySelector('.crm-modal-footer');
    if(!footer){
      // Fallback: buscar último child antes de qualquer .crm-modal-footer
      footer = modalEl.querySelector('[class*="footer"]');
    }
    if(!footer){
      console.log('[152] footer nao encontrado, abortando');
      return;
    }

    // Remover seção existente se houver (pra repopular limpo)
    var existing = modalEl.querySelector('#crm-orc-historico-section-v2');
    if(existing) existing.remove();

    var section = buildSecaoHistorico();
    footer.parentNode.insertBefore(section, footer);
    console.log('[152] secao inserida no modal');

    // Buscar dados do card
    try {
      var card = await lerCard(cardId);
      var orcs = (card && card.extras && card.extras.orcamentos) || [];
      var countEl = section.querySelector('#hist-v2-count');
      var listEl = section.querySelector('#hist-v2-list');
      if(countEl) countEl.textContent = orcs.length;

      if(orcs.length === 0){
        listEl.innerHTML = '<div style="text-align:center;padding:14px;color:#666;font-size:12px;background:#fff;border-radius:6px">' +
          '<b>Nenhum orçamento salvo neste card.</b><br>' +
          '<span style="font-size:11px">Vá para <b>Orçamento</b>, faça os cálculos e clique em <b>💾 Salvar no card</b>.</span>' +
        '</div>';
        return;
      }

      listEl.innerHTML = orcs.map(function(o){
        var d = new Date(o.ts);
        var dStr = d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
        var qi = (o.inputs && o.inputs.itens && o.inputs.itens.length) || 1;
        return '<div style="background:#fff;border:1px solid #d4e0ed;border-radius:8px;padding:10px 12px;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">' +
            '<div style="flex:1;min-width:180px">' +
              '<div style="font-weight:800;font-size:12px;color:#0C447C">' + esc(o.label || ('V' + dStr)) + '</div>' +
              '<div style="font-size:10px;color:#888;margin-top:1px">' + dStr + ' · ' + esc(o.autor || 'anon') + ' · ' + qi + ' item(s)</div>' +
              '<div style="font-size:11px;margin-top:3px"><b>Tab:</b> ' + esc(o.resultado && o.resultado.preco_tabela || '—') +
                ' · <b>Fat:</b> <span style="color:#e67e22;font-weight:700">' + esc(o.resultado && o.resultado.preco_faturamento || '—') + '</span></div>' +
            '</div>' +
            '<div style="display:flex;gap:5px;flex-shrink:0">' +
              '<button type="button" onclick="crmOrcCarregarV2(\''+o.id+'\')" style="padding:6px 12px;border-radius:5px;border:none;background:#27ae60;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">📂 Carregar</button>' +
              '<button type="button" onclick="crmOrcExcluirV2(\''+o.id+'\')" style="padding:6px 10px;border-radius:5px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🗑</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch(e){
      console.warn('[152 popular]', e);
      var listErr = section.querySelector('#hist-v2-list');
      if(listErr) listErr.innerHTML = '<div style="color:#c0392b;font-size:11px;padding:10px">Erro: ' + esc(e.message) + '</div>';
    }
  }

  // Funcoes globais (V2 pra nao colidir com 145/150)
  window.crmOrcCarregarV2 = async function(orcId){
    if(typeof window.crmOrcCarregar === 'function'){
      await window.crmOrcCarregar(orcId);
      if(typeof window.crmCloseModal === 'function') try { window.crmCloseModal(); } catch(e){}
      if(typeof window.switchTab === 'function') try { window.switchTab('orcamento'); } catch(e){}
      toast('📂 <b>Orçamento carregado</b>', '#27ae60', 3500);
    } else toast('❌ Função carregar indisponível', '#c0392b');
  };

  window.crmOrcExcluirV2 = async function(orcId){
    if(!confirm('Excluir este orçamento do histórico?\n\nNão pode ser desfeito.')) return;
    var cardId = window._crmOrcCardId || window._snapCardId;
    if(!cardId){ toast('⚠ Sem card', '#c0392b'); return; }
    try {
      var card = await lerCard(cardId);
      var extras = (card && card.extras) || {};
      var orcs = (Array.isArray(extras.orcamentos) ? extras.orcamentos : []).filter(function(o){ return o.id !== orcId; });
      extras.orcamentos = orcs;
      var top = orcs[0];
      var body = {
        extras: extras,
        valor: top ? (top.resultado._vFat || top.resultado._vTab || 0) : 0,
        valor_tabela: top ? (top.resultado._vTab || 0) : 0,
        valor_faturamento: top ? (top.resultado._vFat || 0) : 0
      };
      await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId), {
        method: 'PATCH',
        headers: Object.assign({}, H, { 'Content-Type':'application/json', Prefer:'return=minimal' }),
        body: JSON.stringify(body)
      });
      toast('🗑 Excluído · Restam ' + orcs.length, '#7f8c8d', 3000);
      // Repopular
      var modal = document.querySelector('.crm-modal-bg.open');
      if(modal) await popularHistoricoModal(modal);
      if(typeof window._refreshBadgesKanban === 'function') window._refreshBadgesKanban();
    } catch(e){ toast('❌ '+e.message, '#c0392b'); }
  };

  // MutationObserver: detectar quando modal abre (.crm-modal-bg recebe class 'open')
  function instalarObserver(){
    var observer = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        if(m.type === 'attributes' && m.attributeName === 'class'){
          var el = m.target;
          if(el.classList && el.classList.contains('crm-modal-bg') && el.classList.contains('open')){
            // Modal abriu - aguardar 500ms e popular
            setTimeout(function(){ popularHistoricoModal(el); }, 500);
          }
        }
      });
    });
    // Observar todos os .crm-modal-bg (ja existem) por mudanças de class
    document.querySelectorAll('.crm-modal-bg').forEach(function(el){
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    // Tambem observar body por NOVOS modais inseridos
    var bodyObs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.classList && n.classList.contains('crm-modal-bg')){
            observer.observe(n, { attributes: true, attributeFilter: ['class'] });
          }
        });
      });
    });
    bodyObs.observe(document.body, { childList: true, subtree: false });
    console.log('[152] MutationObserver instalado em .crm-modal-bg');
  }

  /* ═══════════ 2 + 3) IMPRIMIR FINAL — sem RC duplicado + PDF correto ═══════════ */

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
    await sleep(150);

    try {
      var canvas = await window.html2canvas(clone, {
        scale: 2, useCORS: true, backgroundColor: '#fff',
        logging: false, allowTaint: true,
        width: w, windowWidth: w
      });
      document.body.removeChild(clone);
      return await new Promise(function(res){
        canvas.toBlob(function(blob){
          res(baixarBlob(blob, nome));
        }, 'image/png');
      });
    } catch(e){
      try { document.body.removeChild(clone); } catch(_){}
      console.error('[152]', nome, e);
      return false;
    }
  }

  // PDF da Proposta: capturar cada .proposta-page individualmente
  async function gerarPDFProposta(nomeBase){
    if(typeof window.populateProposta === 'function'){
      try { window.populateProposta(); } catch(e){}
    }
    if(typeof window.switchTab === 'function'){
      try { window.switchTab('proposta'); } catch(e){}
    }
    await sleep(900); // aguardar render

    var pages = document.querySelectorAll('.proposta-page');
    if(pages.length === 0){ console.warn('[152] nenhuma .proposta-page'); return false; }
    console.log('[152] capturando ' + pages.length + ' paginas da proposta');

    var jspdfRef = window.jspdf || window.jsPDF;
    var jsPDF = jspdfRef.jsPDF || jspdfRef;
    var pdf = new jsPDF('p', 'mm', 'a4');
    var pdfW = pdf.internal.pageSize.getWidth();
    var pdfH = pdf.internal.pageSize.getHeight();

    var capturadas = 0;
    for(var i = 0; i < pages.length; i++){
      var page = pages[i];
      // Skip se invisivel
      var rect = page.getBoundingClientRect();
      if(rect.height <= 0){ console.log('[152] pagina', i, 'invisivel, skip'); continue; }

      try {
        var canvas = await window.html2canvas(page, {
          scale: 2, useCORS: true, backgroundColor: '#fff',
          logging: false, allowTaint: true
        });
        // Calcular dimensao mantendo aspect ratio na pagina A4
        var ratio = canvas.width / canvas.height;
        var pageRatio = pdfW / pdfH;
        var imgW, imgH, x, y;
        if(ratio > pageRatio){
          // Imagem mais larga - fit width
          imgW = pdfW; imgH = pdfW / ratio;
          x = 0; y = (pdfH - imgH) / 2;
        } else {
          // Imagem mais alta - fit height
          imgH = pdfH; imgW = pdfH * ratio;
          x = (pdfW - imgW) / 2; y = 0;
        }
        if(capturadas > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, imgW, imgH);
        capturadas++;
        console.log('[152] pagina', i+1, 'capturada (' + canvas.width + 'x' + canvas.height + ')');
        await sleep(150);
      } catch(e){ console.error('[152] pg' + i, e); }
    }

    if(capturadas === 0) return false;
    pdf.save(nomeBase + '_proposta.pdf');
    return true;
  }

  // Sobrescrever crmOrcImprimir SEM chamar printPainelRep (elimina duplicata)
  window.crmOrcImprimir = async function(){
    var nomeBase = (val('num-agp') || val('agp') || 'orcamento') + '_' +
                   (val('numprojeto') || val('reserva') || '') + '_' +
                   clean(val('cliente') || val('crm-o-cliente'));

    toast('🖨️ <b>Iniciando impressão...</b>', '#0C447C', 2500);

    try { await garantirLibs(); }
    catch(e){ toast('❌ Falha bibliotecas', '#c0392b', 5000); return; }

    var feitos = [];
    var falhas = [];

    // Garantir painel rep inline (do 149)
    if(typeof window._refreshPainelRepInline === 'function'){
      try { window._refreshPainelRepInline(); } catch(e){}
    }
    await sleep(250);

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
        (await capturarViaClone(elObra, nomeBase + '_resumo-obra.png')) ? feitos.push('Resumo Obra') : falhas.push('Resumo Obra');
        if(dispA !== undefined) elObra.style.display = dispA;
        if(bodyObra && dispB !== null) bodyObra.style.display = dispB;
      } else falhas.push('Resumo Obra (ausente)');
    } catch(e){ falhas.push('Resumo Obra'); }
    await sleep(250);

    // 2) Resultado Porta
    try {
      var elTabPorta = $('m-tab-porta');
      var elPorta = elTabPorta ? elTabPorta.closest('.rc') : null;
      if(elPorta){
        (await capturarViaClone(elPorta, nomeBase + '_resultado-porta.png')) ? feitos.push('Resultado Porta') : falhas.push('Resultado Porta');
      } else falhas.push('Resultado Porta');
    } catch(e){ falhas.push('Resultado Porta'); }
    await sleep(250);

    // 3) Painel Representante INLINE (sem RC duplicado!)
    try {
      var elRep = $('painel-rep-inline');
      if(elRep){
        (await capturarViaClone(elRep, nomeBase + '_painel-representante.png')) ? feitos.push('Painel Representante') : falhas.push('Painel Representante');
      } else falhas.push('Painel Representante (#painel-rep-inline ausente)');
    } catch(e){ falhas.push('Painel Representante'); }
    await sleep(250);

    // 4) PDF Proposta — pagina por pagina
    try {
      var ok = await gerarPDFProposta(nomeBase);
      ok ? feitos.push('Proposta PDF') : falhas.push('Proposta PDF');
      if(typeof window.switchTab === 'function'){
        try { window.switchTab('orcamento'); } catch(e){}
      }
    } catch(e){ falhas.push('Proposta PDF'); console.error('[152 pdf]', e); }

    var msg = '';
    if(feitos.length) msg += '✅ <b>'+feitos.length+' arquivo(s):</b><br><span style="font-size:11px;font-weight:400">'+feitos.join(' · ')+'</span>';
    if(falhas.length){
      if(msg) msg += '<br><br>';
      msg += '⚠ <b>Falhas:</b> ' + falhas.join(' · ');
    }
    toast(msg, falhas.length ? '#e67e22' : '#27ae60', 7000);
    console.log('[152] resultado:', { feitos: feitos, falhas: falhas });
  };

  /* ═══════════ INIT ═══════════ */
  function init(){
    // Aguardar DOM e instalar observer
    setTimeout(instalarObserver, 800);
    console.log('[152-fix-final] iniciado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
