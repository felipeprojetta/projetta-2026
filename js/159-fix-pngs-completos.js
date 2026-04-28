/* ============================================================================
 * js/159-fix-pngs-completos.js  —  (28-abr-2026)
 *
 * Felipe 28/04: 3 problemas com os PNGs:
 *   1) Caracteristicas com selects vazios mesmo tendo cálculo OK
 *      (Tipo abertura, Modelo, Folhas, Fech mec, Puxador, Cor ext/int)
 *   2) Chapas - só printa Chapa 1 mas tem 4 chapas no orçamento
 *   3) Resultado da Porta corta o Lucro Líquido (DRE fica fora do PNG)
 *
 * SOLUÇÃO via 3 hooks:
 *   FIX 1: hook em capturarSecaoOrc → popular selects ANTES de capturar carac-body
 *   FIX 2: hook em capturarViaCloneFixed → quando for "Resultado Porta",
 *          envolver em wrapper junto com .rc da DRE (que tem Lucro Líquido)
 *   FIX 3: hook em capturarCanvasDireto → para plan-canvas, gerar 1 PNG por chapa
 *          via PLN_CSI=i + plnDraw(i) + capturar
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta159Applied) return;
  window.__projetta159Applied = true;

  function $(id){ return document.getElementById(id); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX 1 — Popular selects de Características antes de capturar
   * ════════════════════════════════════════════════════════════════════════ */
  function popularSelectsCaracteristicas(){
    if(!window._orcItens || !window._orcItens.length){
      console.log('[159] _orcItens vazio — nada a popular');
      return;
    }
    var it = window._orcItens[0];
    if(!it) return;
    console.log('[159] _orcItens[0]:', it);

    // Mapping: id-do-select → lista de chaves possíveis em _orcItens[0]
    var maps = {
      'carac-modelo':     ['modelo'],
      'carac-abertura':   ['abertura', 'tipo_abertura', 'tipoAbertura', 'tipo'],
      'carac-folhas':     ['folhas', 'numero_folhas', 'qtd_folhas', 'num_folhas'],
      'carac-cor-ext':    ['cor_ext', 'cor_externa', 'corExt', 'cor_chapa_ext'],
      'carac-cor-int':    ['cor_int', 'cor_interna', 'corInt', 'cor_chapa_int'],
      'carac-cor-macico': ['cor_macico', 'cor_aluminio', 'cor_macico_alu'],
      'carac-fech-mec':   ['fechadura_mecanica', 'fech_mecanica', 'fech_mec'],
      'carac-fech-dig':   ['fechadura_digital', 'fech_digital', 'fech_dig'],
      'carac-puxador':    ['puxador'],
      'carac-pux-tam':    ['pux_tam', 'puxador_tamanho', 'puxTam']
    };

    Object.keys(maps).forEach(function(id){
      var el = $(id);
      if(!el) return;
      // Se já tem valor não-vazio selecionado, não sobrescreve
      if(el.value && el.value !== '') return;
      // Tentar cada nome de campo
      var keys = maps[id];
      for(var i = 0; i < keys.length; i++){
        var v = it[keys[i]];
        if(v != null && v !== ''){
          // Verificar se a option existe (case-insensitive)
          var optMatch = null;
          var vUp = String(v).toUpperCase();
          for(var j = 0; j < el.options.length; j++){
            if(el.options[j].value === String(v) || el.options[j].value.toUpperCase() === vUp){
              optMatch = el.options[j].value;
              break;
            }
          }
          if(optMatch){
            el.value = optMatch;
            console.log('[159] popular ' + id + ' = ' + optMatch);
            return;
          }
        }
      }
    });

    // Inputs numéricos auxiliares
    try {
      var lar = $('largura');     if(lar && (!lar.value || lar.value === '0') && it.largura) lar.value = it.largura;
      var alt = $('altura');      if(alt && (!alt.value || alt.value === '0') && it.altura)  alt.value = it.altura;
      var qty = $('qtd-portas');  if(qty && (!qty.value || qty.value === '0') && it.qtd)     qty.value = it.qtd || 1;
      var fop = $('folhas-porta');if(fop && (!fop.value || fop.value === '0') && it.folhas)  fop.value = it.folhas;
    } catch(e){}
  }

  function hookCapturarSecao(){
    var orig = window.capturarSecaoOrc;
    if(typeof orig !== 'function'){ setTimeout(hookCapturarSecao, 500); return; }
    if(orig.__sub159Hooked) return;
    window.capturarSecaoOrc = async function(bodyId, label, nome){
      if(bodyId === 'carac-body'){
        try {
          popularSelectsCaracteristicas();
        } catch(e){ console.warn('[159] popular falhou:', e); }
        await sleep(180);
      }
      return await orig.call(this, bodyId, label, nome);
    };
    window.capturarSecaoOrc.__sub159Hooked = true;
    console.log('[159] capturarSecaoOrc HOOKED');
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX 2 — Painel Resultado Porta + DRE (Lucro Líquido) no mesmo PNG
   * ════════════════════════════════════════════════════════════════════════ */
  function hookCapturarViaClone(){
    var orig = window.capturarViaCloneFixed;
    if(typeof orig !== 'function'){ setTimeout(hookCapturarViaClone, 500); return; }
    if(orig.__sub159Hooked) return;

    window.capturarViaCloneFixed = async function(elOriginal, nome){
      // Detectar se é o painel "Resultado Porta"
      var isResPorta = false;
      try {
        var mtp = $('m-tab-porta');
        if(mtp && elOriginal === mtp.closest('.rc')){
          isResPorta = true;
        }
      } catch(e){}

      if(isResPorta){
        // Achar o .rc seguinte que contém .dre
        var dreRC = elOriginal.nextElementSibling;
        while(dreRC && (!dreRC.classList || !dreRC.classList.contains('rc') || !dreRC.querySelector('.dre'))){
          // Pular elementos display:none/sem .dre
          dreRC = dreRC.nextElementSibling;
        }

        if(dreRC && dreRC.querySelector('.dre')){
          console.log('[159] Capturando Resultado Porta + DRE juntos');
          var wrapper = document.createElement('div');
          wrapper.style.cssText = 'position:absolute;top:-99999px;left:0;background:#fff;padding:0;width:' +
                                  Math.max(elOriginal.offsetWidth || 0, 800) + 'px';
          var c1 = elOriginal.cloneNode(true);
          var c2 = dreRC.cloneNode(true);
          c2.style.marginTop = '8px';
          c2.style.display = 'block';
          wrapper.appendChild(c1);
          wrapper.appendChild(c2);
          document.body.appendChild(wrapper);

          // Congelar selects/inputs do wrapper se a função existe
          if(typeof window.congelarValoresParaCaptura === 'function'){
            try { window.congelarValoresParaCaptura(wrapper); } catch(e){}
          }
          // Garantir sem botões e displays corretos
          wrapper.querySelectorAll('button').forEach(function(b){ b.style.display = 'none'; });
          wrapper.querySelectorAll('.cb').forEach(function(cb){ cb.style.display = ''; });

          await sleep(200);

          try {
            var canvas = await window.html2canvas(wrapper, {
              scale: 2, useCORS: true, backgroundColor: '#fff', logging: false
            });
            var dataUrl = canvas.toDataURL('image/png');
            var link = document.createElement('a');
            link.href = dataUrl;
            link.download = nome;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            console.log('[159] PNG Resultado Porta + DRE salvo: ' + nome);
            if(wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
            return true;
          } catch(e){
            console.warn('[159] erro wrapper, fallback:', e);
            if(wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
            return await orig.call(this, elOriginal, nome);
          }
        }
      }

      return await orig.call(this, elOriginal, nome);
    };
    window.capturarViaCloneFixed.__sub159Hooked = true;
    console.log('[159] capturarViaCloneFixed HOOKED');
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FIX 3 — 1 PNG por chapa (loop em PLN_RES.numSheets)
   * ════════════════════════════════════════════════════════════════════════ */
  function hookCapturarCanvasDireto(){
    var orig = window.capturarCanvasDireto;
    if(typeof orig !== 'function'){ setTimeout(hookCapturarCanvasDireto, 500); return; }
    if(orig.__sub159Hooked) return;

    window.capturarCanvasDireto = async function(canvas, nome){
      // Se é o plan-canvas E o nome é chapas-canvas, iterar todas as chapas
      var ehChapas = canvas && canvas.id === 'plan-canvas' && /chapas-canvas/.test(nome);
      if(!ehChapas) return await orig.call(this, canvas, nome);

      // Calcular total de chapas
      var totalChapas = 0;
      try {
        if(window.PLN_RES && typeof window.PLN_RES.numSheets === 'number'){
          totalChapas = window.PLN_RES.numSheets;
        }
        // Adicionar ALU se tiver
        if(window._chapasALU > 0){
          totalChapas = (window._chapasACM || totalChapas || 0) + window._chapasALU;
        }
      } catch(e){}

      console.log('[159] total chapas detectado: ' + totalChapas);

      if(totalChapas <= 1 || typeof window.plnDraw !== 'function'){
        // Comportamento original
        return await orig.call(this, canvas, nome);
      }

      // Salvar PLN_CSI atual
      var csiOrig = window.PLN_CSI || 0;
      var basePath = nome.replace(/_07b_chapas-canvas\.png$/, '');
      var algumOK = false;

      for(var i = 0; i < totalChapas; i++){
        try {
          window.PLN_CSI = i;
          window.plnDraw(i);
          await sleep(280);

          if(canvas.width === 0 || canvas.height === 0){
            console.warn('[159] canvas vazio na chapa ' + (i+1));
            continue;
          }

          var nomeChapa = basePath + '_07b_chapa-' + (i + 1) + '-de-' + totalChapas + '.png';
          var dataUrl = canvas.toDataURL('image/png');
          var link = document.createElement('a');
          link.href = dataUrl;
          link.download = nomeChapa;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('[159] PNG chapa ' + (i+1) + '/' + totalChapas + ': ' + nomeChapa);
          algumOK = true;
          await sleep(180);
        } catch(e){
          console.warn('[159] erro chapa ' + (i+1) + ':', e);
        }
      }

      // Restaurar PLN_CSI original
      try {
        window.PLN_CSI = csiOrig;
        window.plnDraw(csiOrig);
      } catch(e){}

      return algumOK;
    };
    window.capturarCanvasDireto.__sub159Hooked = true;
    console.log('[159] capturarCanvasDireto HOOKED');
  }

  function init(){
    setTimeout(function(){
      hookCapturarSecao();
      hookCapturarViaClone();
      hookCapturarCanvasDireto();
    }, 800);
    // Re-tentativa em caso das funções aparecerem mais tarde
    setTimeout(function(){
      hookCapturarSecao();
      hookCapturarViaClone();
      hookCapturarCanvasDireto();
    }, 2500);
    console.log('[159-fix-pngs-completos] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
