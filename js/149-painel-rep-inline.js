/* ============================================================================
 * js/149-painel-rep-inline.js  —  Fix definitivo (28-abr-2026)
 *
 * Felipe 28/04 - 3 problemas:
 *   1) Banner do historico nao aparece mesmo apos salvar
 *   2) Painel Representante deve ficar SEMPRE visivel junto com Resultado-Porta
 *   3) Imprimir abre tela de impressora + faltam 2 PNGs (resultado-porta=0 bytes)
 *
 * SOLUCAO:
 *   A) BLOQUEIO PERMANENTE de window.print() (nao restaura mais)
 *   B) PAINEL REPRESENTANTE INLINE - bloco visivel logo apos Resultado-Porta
 *      Atualiza em hook do calc() com mesmos dados do printPainelRep
 *   C) IMPRIMIR ROBUSTO:
 *      - Captura cada painel inline via clone off-screen (sem sticky)
 *      - Usa o painel rep INLINE em vez de gerar off-screen
 *      - Captura aba Proposta direto pra PDF
 *      - NAO chama nenhum print* legado
 *   D) BANNER HISTORICO: insere com fallbacks robustos + sempre visivel
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta149Applied) return;
  window.__projetta149Applied = true;

  function $(id){ return document.getElementById(id); }
  function val(id){ var e = $(id); return e ? (e.value || '') : ''; }
  function txt(id){ var e = $(id); return e ? (e.textContent || '').trim() : ''; }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function clean(s){ return String(s||'').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').slice(0,30); }

  function toast(html, color, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:400px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 3500);
  }

  /* ═══════════ A) BLOQUEAR window.print PERMANENTE ═══════════ */
  (function bloquearPrint(){
    var blocked = function(){ console.log('[149] window.print() bloqueado - nao abre dialogo'); };
    try {
      Object.defineProperty(window, 'print', {
        configurable: false, writable: false,
        value: blocked
      });
      console.log('[149] window.print bloqueado PERMANENTE');
    } catch(e){
      // Fallback: sobrescrever direto (alguem pode reescrever depois mas reduz risco)
      window.print = blocked;
      console.log('[149] window.print sobrescrito (fallback)');
    }
  })();

  /* ═══════════ B) PAINEL REPRESENTANTE INLINE ═══════════ */

  function montarHTMLPainelRep(){
    var cli = val('cliente') || val('crm-o-cliente') || '—';
    var agp = val('num-agp') || val('crm-o-agp') || val('agp');
    var reserva = val('numprojeto') || val('crm-o-reserva') || val('reserva');
    var L = Math.round(parseFloat(val('largura')) || 0);
    var A = Math.round(parseFloat(val('altura')) || 0);
    var modEl = $('carac-modelo') || $('plan-modelo');
    var modTxt = (modEl && modEl.selectedIndex >= 0) ? (modEl.options[modEl.selectedIndex].text || '—') : '—';
    var folTxt = (val('folhas-porta') || '1') + ' folha(s)';
    var qtdP = parseInt(val('qtd-portas')) || 1;
    var pTab = txt('m-tab-porta') || 'R$ 0';
    var pFat = txt('m-fat-porta') || 'R$ 0';
    var tm2 = txt('s-tm2');
    var fm2 = txt('s-fm2');
    var tm2p = txt('s-tm2p');
    var fm2p = txt('s-fm2p');
    var comRep = val('com-rep') || '0';
    var comRt = val('com-rt') || '0';
    var desc = val('desconto') || '0';
    var m2 = ((L/1000) * (A/1000) * qtdP).toFixed(2);
    var corExt = '';
    var ceEl = $('carac-cor-ext');
    if(ceEl && ceEl.selectedIndex >= 0) corExt = ceEl.options[ceEl.selectedIndex].text || '';

    return '' +
      '<div id="painel-rep-capture" style="background:#fff;border-radius:8px;font-family:inherit">' +
        '<div style="background:#003144;color:#fff;padding:14px 16px;border-radius:8px 8px 0 0;text-align:center">' +
          '<div style="font-size:14px;font-weight:800;letter-spacing:.06em">PROJETTA by WEIKU</div>' +
          '<div style="font-size:10px;opacity:.7;margin-top:2px">Painel Comercial — Representante</div>' +
        '</div>' +
        '<div style="padding:14px 16px">' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-bottom:12px;font-size:10.5px;color:#555;line-height:1.5">' +
            '<span>Cliente: <b style="color:#003144">'+cli+'</b></span>' +
            (agp ? '<span>AGP: <b style="color:#003144">'+agp+'</b></span>' : '') +
            (reserva ? '<span>Reserva: <b style="color:#003144">'+reserva+'</b></span>' : '') +
            '<span>Dimensão: <b style="color:#003144">'+L+'×'+A+'mm</b></span>' +
            '<span>Modelo: <b style="color:#003144">'+modTxt+'</b></span>' +
            '<span>'+folTxt+' · '+qtdP+' porta(s) · '+m2+' m²</span>' +
            (corExt ? '<span>Cor: <b style="color:#003144">'+corExt+'</b></span>' : '') +
          '</div>' +
          '<div style="display:flex;gap:10px;margin-bottom:12px">' +
            '<div style="flex:1;background:#f8f6f0;border-radius:6px;padding:10px;text-align:center">' +
              '<div style="font-size:9px;text-transform:uppercase;color:#888;font-weight:700;letter-spacing:.05em">Preço Tabela</div>' +
              '<div style="font-size:18px;font-weight:800;color:#003144;margin-top:3px">'+pTab+'</div>' +
            '</div>' +
            '<div style="flex:1;background:#f8f6f0;border-radius:6px;padding:10px;text-align:center">' +
              '<div style="font-size:9px;text-transform:uppercase;color:#888;font-weight:700;letter-spacing:.05em">Preço Faturamento</div>' +
              '<div style="font-size:18px;font-weight:800;color:#e65100;margin-top:3px">'+pFat+'</div>' +
            '</div>' +
          '</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px">' +
            '<tr><th colspan="2" style="background:#f0ede8;padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase;color:#888;letter-spacing:.04em">Valores por m²</th></tr>' +
            '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">Preço tabela/m² <b>porta+inst</b></td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#003144">'+tm2+'</td></tr>' +
            '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">Preço fat./m² <b>porta+inst</b></td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#003144">'+fm2+'</td></tr>' +
            '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee">Preço tabela/m² <b>só porta</b></td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:700;color:#003144">'+tm2p+'</td></tr>' +
            '<tr><td style="padding:5px 8px">Preço fat./m² <b>só porta</b></td><td style="padding:5px 8px;text-align:right;font-weight:700;color:#003144">'+fm2p+'</td></tr>' +
          '</table>' +
          '<div style="display:flex;gap:8px;margin-top:8px">' +
            '<div style="flex:1;background:#f0f7ff;border-radius:6px;padding:8px;text-align:center">' +
              '<div style="font-size:9px;text-transform:uppercase;color:#888;font-weight:700">Comissão Rep.</div>' +
              '<div style="font-size:15px;font-weight:800;color:#1a5276;margin-top:2px">'+comRep+'%</div>' +
            '</div>' +
            '<div style="flex:1;background:#f0f7ff;border-radius:6px;padding:8px;text-align:center">' +
              '<div style="font-size:9px;text-transform:uppercase;color:#888;font-weight:700">Comissão Arq.</div>' +
              '<div style="font-size:15px;font-weight:800;color:#1a5276;margin-top:2px">'+comRt+'%</div>' +
            '</div>' +
            '<div style="flex:1;background:#f0f7ff;border-radius:6px;padding:8px;text-align:center">' +
              '<div style="font-size:9px;text-transform:uppercase;color:#888;font-weight:700">Desconto</div>' +
              '<div style="font-size:15px;font-weight:800;color:#1a5276;margin-top:2px">'+desc+'%</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function instalarPainelRepInline(){
    if($('painel-rep-inline')) return true;
    // Achar o painel "Resultado — Porta" (.rc com m-tab-porta dentro)
    var alvo = null;
    var tabPorta = $('m-tab-porta');
    if(tabPorta) alvo = tabPorta.closest('.rc');
    if(!alvo) return false;

    var wrap = document.createElement('div');
    wrap.id = 'painel-rep-inline';
    wrap.className = 'rc';
    wrap.style.cssText = 'margin-top:12px;border-radius:8px;overflow:hidden;border:1px solid #ddd;background:#fff';
    wrap.innerHTML = montarHTMLPainelRep();
    alvo.parentNode.insertBefore(wrap, alvo.nextSibling);
    console.log('[149] painel-rep-inline instalado');
    return true;
  }

  function atualizarPainelRep(){
    var wrap = $('painel-rep-inline');
    if(!wrap) return;
    wrap.innerHTML = montarHTMLPainelRep();
  }

  // Hook em calc() para atualizar painel sempre que recalcular
  function hookCalc(){
    var orig = window.calc;
    if(!orig){ setTimeout(hookCalc, 200); return; }
    if(orig.__sub149Hooked) return;
    window.calc = function(){
      var r = orig.apply(this, arguments);
      // Atualizar painel rep apos calc
      try { atualizarPainelRep(); } catch(e){}
      return r;
    };
    window.calc.__sub149Hooked = true;
    console.log('[149] hook calc() instalado');
  }

  /* ═══════════ C) IMPRIMIR ROBUSTO (sobrescreve 145+147) ═══════════ */

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

  function baixarCanvasPNG(canvas, nome){
    return new Promise(function(res){
      canvas.toBlob(function(blob){
        if(!blob || blob.size === 0){ console.warn('[149] blob vazio:', nome); res(false); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); res(true); }, 800);
      }, 'image/png');
    });
  }

  // Captura via CLONE off-screen — funciona mesmo com position:sticky
  async function capturarViaClone(elOriginal, nome){
    if(!elOriginal){ console.warn('[149] sem elemento:', nome); return false; }
    var rect = elOriginal.getBoundingClientRect();
    var w = Math.max(rect.width, elOriginal.offsetWidth, 800);
    if(w < 200){ w = 800; }

    // Clonar e estilizar pra captura
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

    // Remover botoes do clone (limpar visual)
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
      var ok = await baixarCanvasPNG(canvas, nome);
      if(ok) console.log('[149] ✓', nome, '(' + canvas.width + 'x' + canvas.height + ')');
      return ok;
    } catch(e){
      console.error('[149]', nome, e);
      try { document.body.removeChild(clone); } catch(_){}
      return false;
    }
  }

  window.crmOrcImprimir = async function(){
    var nomeBase = (val('num-agp') || val('agp') || 'orcamento') + '_' +
                   (val('numprojeto') || val('reserva') || '') + '_' +
                   clean(val('cliente') || val('crm-o-cliente'));

    toast('🖨️ <b>Iniciando impressão...</b>', '#0C447C', 2500);

    try { await garantirLibs(); }
    catch(e){ toast('❌ Falha bibliotecas: '+e.message, '#c0392b', 5000); return; }

    var feitos = [];
    var falhas = [];

    // Atualizar painel rep antes de capturar
    atualizarPainelRep();
    instalarPainelRepInline(); // garante que existe
    await sleep(200);

    // 1) Resumo Obra (expandir se collapsed)
    try {
      var elObra = $('resumo-obra');
      if(elObra){
        var obraDisp = elObra.style.display;
        if(elObra.style.display === 'none') elObra.style.display = '';
        var obraBody = $('resumo-obra-body');
        var obraBodyDisp = obraBody ? obraBody.style.display : null;
        if(obraBody && obraBody.style.display === 'none') obraBody.style.display = 'flex';
        await sleep(250);
        var ok = await capturarViaClone(elObra, nomeBase + '_resumo-obra.png');
        ok ? feitos.push('Resumo Obra') : falhas.push('Resumo Obra');
        if(obraDisp !== undefined) elObra.style.display = obraDisp;
        if(obraBody && obraBodyDisp !== null) obraBody.style.display = obraBodyDisp;
      } else falhas.push('Resumo Obra (#resumo-obra ausente)');
    } catch(e){ falhas.push('Resumo Obra'); console.error('[149 obra]',e); }
    await sleep(300);

    // 2) Resultado Porta (via clone — resolve sticky)
    try {
      var elTabPorta = $('m-tab-porta');
      var elPorta = elTabPorta ? elTabPorta.closest('.rc') : null;
      if(elPorta){
        var ok2 = await capturarViaClone(elPorta, nomeBase + '_resultado-porta.png');
        ok2 ? feitos.push('Resultado Porta') : falhas.push('Resultado Porta');
      } else falhas.push('Resultado Porta (.rc nao encontrado)');
    } catch(e){ falhas.push('Resultado Porta'); console.error('[149 porta]',e); }
    await sleep(300);

    // 3) Painel Representante INLINE (já existe)
    try {
      var elRep = $('painel-rep-inline');
      if(elRep){
        var ok3 = await capturarViaClone(elRep, nomeBase + '_painel-representante.png');
        ok3 ? feitos.push('Painel Representante') : falhas.push('Painel Representante');
      } else falhas.push('Painel Representante (#painel-rep-inline ausente)');
    } catch(e){ falhas.push('Painel Representante'); console.error('[149 rep]',e); }
    await sleep(300);

    // 4) PDF Proposta (captura DIRETA da aba)
    try {
      if(typeof window.populateProposta === 'function'){
        try { window.populateProposta(); } catch(e){}
      }
      if(typeof window.switchTab === 'function'){
        try { window.switchTab('proposta'); } catch(e){}
      }
      await sleep(800);
      var elProp = $('tab-proposta');
      if(elProp){
        var canvasP = await window.html2canvas(elProp, {
          scale: 2, useCORS: true, backgroundColor: '#fff', logging: false
        });
        var jspdfRef = window.jspdf || window.jsPDF;
        var jsPDF = jspdfRef.jsPDF || jspdfRef;
        var pdf = new jsPDF('p', 'mm', 'a4');
        var pdfW = pdf.internal.pageSize.getWidth();
        var pdfH = pdf.internal.pageSize.getHeight();
        var imgH = (canvasP.height * pdfW) / canvasP.width;
        var imgData = canvasP.toDataURL('image/jpeg', 0.92);
        var y = 0;
        while(y < imgH){
          if(y > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, -y, pdfW, imgH);
          y += pdfH;
        }
        pdf.save(nomeBase + '_proposta.pdf');
        feitos.push('Proposta PDF');
      } else falhas.push('Proposta PDF (#tab-proposta ausente)');
      // Voltar pra aba Orcamento
      if(typeof window.switchTab === 'function'){
        try { window.switchTab('orcamento'); } catch(e){}
      }
    } catch(e){ falhas.push('Proposta PDF'); console.error('[149 pdf]',e); }

    var msg = '';
    if(feitos.length) msg += '✅ <b>'+feitos.length+' arquivo(s) baixado(s):</b><br><span style="font-size:11px;font-weight:400">'+feitos.join(' · ')+'</span>';
    if(falhas.length){
      if(msg) msg += '<br><br>';
      msg += '⚠ <b>Falhas:</b><br><span style="font-size:11px;font-weight:400">'+falhas.join(' · ')+'</span>';
    }
    toast(msg, falhas.length ? '#e67e22' : '#27ae60', 7000);
    console.log('[149] resultado:', { feitos: feitos, falhas: falhas });
  };

  /* ═══════════ D) BANNER HISTORICO ROBUSTO ═══════════ */
  // Sobrescreve atualizarBanner do 145 - SEMPRE mostra banner

  // Buscar elemento alvo com varios fallbacks
  function acharContainerBanner(){
    return $('orc-historico-banner-v2')
        || (function(){
          var t = $('tab-orcamento');
          if(t) return t;
          var byId = document.querySelector('[id*="tab-orcamento"]');
          if(byId) return byId;
          var pByLabel = document.querySelector('.tab-pane');
          return pByLabel;
        })();
  }

  function instalarBannerV2(){
    if($('orc-historico-banner-v2')) return true;
    var tabOrc = $('tab-orcamento');
    if(!tabOrc) return false;
    var banner = document.createElement('div');
    banner.id = 'orc-historico-banner-v2';
    banner.style.cssText = 'margin:8px 16px;padding:10px 14px;background:linear-gradient(135deg,#e3f2fd,#fff);border:1px solid #90caf9;border-radius:8px;font-size:12px;color:#0C447C;font-family:Montserrat,Arial,sans-serif';
    banner.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div>📚 <b>Histórico</b> · clique em "💾 Salvar no card" para começar</div></div>';
    tabOrc.insertBefore(banner, tabOrc.firstChild);
    console.log('[149] banner-v2 instalado');
    return true;
  }

  async function lerCardEAtualizarBanner(){
    var cardId = window._crmOrcCardId || window._snapCardId;
    if(!cardId) return;
    var SB = 'https://plmliavuwlgpwaizfeds.supabase.co';
    var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
    try {
      var r = await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras', {
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
      });
      if(!r.ok) return;
      var arr = await r.json();
      var orcs = (arr[0] && arr[0].extras && arr[0].extras.orcamentos) || [];
      var banner = $('orc-historico-banner-v2');
      if(!banner) return;
      if(orcs.length === 0){
        banner.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div>📚 <b>Histórico</b> · Nenhum orçamento salvo neste card. Clique em "💾 Salvar no card" para começar.</div></div>';
      } else {
        var topo = orcs[0];
        banner.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
            '<div><b>📚 ' + orcs.length + ' orçamento(s) salvo(s)</b> · Último: ' + (topo.label||'—') + ' · ' + (topo.resultado && topo.resultado.preco_faturamento || '—') + '</div>' +
            '<button onclick="crmOrcVerHistorico()" style="padding:5px 12px;background:#fff;color:#0C447C;border:1.5px solid #0C447C;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">📂 Ver histórico</button>' +
          '</div>';
      }
    } catch(e){ console.warn('[149 banner fetch]', e); }
  }

  // Hook em crmOpenModal
  function hookOpen(){
    var orig = window.crmOpenModal;
    if(!orig){ setTimeout(hookOpen, 200); return; }
    if(orig.__sub149Hooked) return;
    window.crmOpenModal = function(){
      var r = orig.apply(this, arguments);
      setTimeout(function(){
        instalarBannerV2();
        lerCardEAtualizarBanner();
      }, 600);
      return r;
    };
    window.crmOpenModal.__sub149Hooked = true;
    console.log('[149] hook crmOpenModal v2 instalado');
  }

  // Hook em crmOrcSalvar (atualizar banner após salvar)
  function hookSalvar(){
    var orig = window.crmOrcSalvar;
    if(!orig){ setTimeout(hookSalvar, 200); return; }
    if(orig.__sub149Hooked) return;
    window.crmOrcSalvar = async function(){
      var r = await orig.apply(this, arguments);
      setTimeout(function(){
        instalarBannerV2();
        lerCardEAtualizarBanner();
      }, 1500);
      return r;
    };
    window.crmOrcSalvar.__sub149Hooked = true;
    console.log('[149] hook crmOrcSalvar instalado');
  }

  /* ═══════════ INIT ═══════════ */
  function init(){
    hookCalc();
    hookOpen();
    hookSalvar();

    // Tentar instalar painel + banner repetidamente
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      var painelOk = instalarPainelRepInline();
      var bannerOk = instalarBannerV2();
      if(painelOk) atualizarPainelRep();
      if((painelOk && bannerOk) || tries > 40) clearInterval(iv);
    }, 300);

    // Atualizar banner inicial
    setTimeout(lerCardEAtualizarBanner, 1500);
    console.log('[149-painel-rep-inline] iniciado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
