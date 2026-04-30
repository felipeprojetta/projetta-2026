/* ============================================================================
 * js/148-hcorte-auto-fix.js  —  Fix definitivo h-corte (28-abr-2026)
 *
 * Felipe 28/04: bug persistente. Sistema mostra "(manual)" e nao recalcula
 * mesmo quando muda chapas. Causa: dataset.manual='1' fica setado e nunca
 * volta pro auto. Felipe nao consegue destravar.
 *
 * SOLUCAO:
 *   1) RESET AUTOMATICO de dataset.manual quando muda chapas
 *      (via _selectChapaSimByCor, plan-acm-qty, planUpd)
 *   2) Botao "↺ Auto" visivel ao lado do label "(manual)" pra destravar
 *      manualmente a qualquer momento
 *   3) Heuristica de boot: se valor=0 ou vazio, limpa manual (claramente
 *      nao foi alterado manualmente)
 *
 * Sobrescreve hooks do 146 com versao mais inteligente.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta148Applied) return;
  window.__projetta148Applied = true;

  function $(id){ return document.getElementById(id); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  function destrancarManual(motivo){
    var hcEl = $('h-corte');
    if(!hcEl) return;
    if(hcEl.dataset.manual === '1'){
      hcEl.dataset.manual = '';
      console.log('[148] manual destrancado (' + motivo + ')');
    }
    // Forcar recalculo agora
    if(typeof window._recalcHCorteAuto === 'function'){
      setTimeout(function(){ window._recalcHCorteAuto(); }, 100);
    }
  }

  /* ───── Hook 1: _selectChapaSimByCor — troca chapa via simulacao ───── */
  function hookSelectChapa(){
    var orig = window._selectChapaSimByCor;
    if(!orig){ setTimeout(hookSelectChapa, 200); return; }
    if(orig.__sub148Hooked) return;
    window._selectChapaSimByCor = function(corKey, sw, sh){
      destrancarManual('troca chapa simulacao'); // ← reset ANTES de mudar
      var r = orig.apply(this, arguments);
      // Recalcular reforço apos planRun
      setTimeout(function(){
        if(typeof window._recalcHCorteAuto === 'function') window._recalcHCorteAuto();
      }, 400);
      setTimeout(function(){
        if(typeof window._recalcHCorteAuto === 'function') window._recalcHCorteAuto();
      }, 1000);
      return r;
    };
    window._selectChapaSimByCor.__sub148Hooked = true;
    console.log('[148] hook _selectChapaSimByCor instalado');
  }

  /* ───── Hook 2: plan-acm-qty (Felipe edita qtd manualmente) ───── */
  function hookInputQty(){
    var qEl = $('plan-acm-qty');
    if(!qEl){ setTimeout(hookInputQty, 300); return; }
    if(qEl.dataset.sub148Hooked) return;
    qEl.dataset.sub148Hooked = '1';
    qEl.addEventListener('input', function(){
      var n = parseInt(qEl.value) || 0;
      if(n > 0){
        window._chapasCalculadas = n;
        destrancarManual('mudou qtd chapas para ' + n);
      }
    });
    console.log('[148] hook input plan-acm-qty instalado');
  }

  /* ───── Hook 3: input h-corte — distinguir digitacao real de auto ───── */
  function hookHCorteInput(){
    var hcEl = $('h-corte');
    if(!hcEl){ setTimeout(hookHCorteInput, 300); return; }

    // Remover listeners antigos do 146 (se existir) e reinstalar limpo
    var clone = hcEl.cloneNode(true);
    hcEl.parentNode.replaceChild(clone, hcEl);
    hcEl = clone;

    // Track ultimo valor auto setado pra comparar com digitacao
    if(window.__hcorteLastAuto === undefined) window.__hcorteLastAuto = null;

    hcEl.addEventListener('input', function(){
      // Se o valor digitado é EXATAMENTE o ultimo auto, nao e manual
      if(window.__hcorteLastAuto !== null && Number(hcEl.value) === Number(window.__hcorteLastAuto)){
        return;
      }
      // Se valor vazio ou 0, voltar pro auto
      if(hcEl.value === '' || hcEl.value === '0' || Number(hcEl.value) === 0){
        hcEl.dataset.manual = '';
        hcEl.dataset.auto = '';
        atualizarLabel();
        if(typeof window._recalcHCorteAuto === 'function'){
          setTimeout(function(){ window._recalcHCorteAuto(); }, 50);
        }
        return;
      }
      // Caso contrario, marcar como manual
      hcEl.dataset.manual = '1';
      hcEl.dataset.auto = '';
      atualizarLabel();
    });
    console.log('[148] hook h-corte input REINSTALADO (limpo)');
  }

  /* ───── Atualizar label visual com botao Reset ───── */
  function atualizarLabel(){
    var hcEl = $('h-corte');
    var lbl = $('h-corte-auto');
    if(!hcEl || !lbl) return;

    if(hcEl.dataset.manual === '1'){
      lbl.innerHTML = '<span style="color:#e67e22;font-weight:600">← alterado manualmente</span> <button type="button" id="btn-hcorte-auto" style="margin-left:6px;padding:2px 8px;background:#27ae60;color:#fff;border:none;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">↺ Auto</button>';
      var btn = $('btn-hcorte-auto');
      if(btn){
        btn.onclick = function(e){
          e.preventDefault(); e.stopPropagation();
          destrancarManual('botao Auto clicado');
        };
      }
    }
  }

  /* ───── Patch _recalcHCorteAuto — interceptar para gravar ultimo auto ───── */
  function patchRecalc(){
    var orig = window._recalcHCorteAuto;
    if(!orig){ setTimeout(patchRecalc, 200); return; }
    if(orig.__sub148Patched) return;

    window._recalcHCorteAuto = function(forceN){
      var hcEl = $('h-corte');
      var antesValor = hcEl ? hcEl.value : null;
      orig.apply(this, arguments);
      // Apos recalcular, guardar o valor que foi setado como auto
      if(hcEl && hcEl.dataset.auto === '1'){
        window.__hcorteLastAuto = hcEl.value;
      }
    };
    window._recalcHCorteAuto.__sub148Patched = true;
    console.log('[148] _recalcHCorteAuto patcheada');
  }

  /* ───── Heuristica de boot: limpar manual se valor e 0/vazio ───── */
  function limparManualBoot(){
    var hcEl = $('h-corte');
    if(!hcEl) return;
    if(hcEl.dataset.manual === '1'){
      var v = Number(hcEl.value || 0);
      if(v === 0 || hcEl.value === ''){
        hcEl.dataset.manual = '';
        var lbl = $('h-corte-auto');
        if(lbl) lbl.textContent = '';
        console.log('[148] manual destrancado no boot (valor=0)');
      } else {
        // Manual ativo com valor real - mostrar botao reset
        atualizarLabel();
      }
    }
  }

  /* ───── Hook 4: planUpd reforço ───── */
  function hookPlanUpd(){
    var orig = window.planUpd;
    if(!orig){ setTimeout(hookPlanUpd, 200); return; }
    if(orig.__sub148Hooked) return;
    window.planUpd = function(){
      var r = orig.apply(this, arguments);
      // Apos planUpd, se manual nao esta marcado, recalcular
      setTimeout(function(){
        var hcEl = $('h-corte');
        if(hcEl && hcEl.dataset.manual !== '1' && typeof window._recalcHCorteAuto === 'function'){
          window._recalcHCorteAuto();
        }
      }, 200);
      return r;
    };
    window.planUpd.__sub148Hooked = true;
    console.log('[148] hook planUpd instalado');
  }

  function init(){
    patchRecalc();
    hookSelectChapa();
    hookPlanUpd();
    setTimeout(function(){
      hookInputQty();
      hookHCorteInput();
      limparManualBoot();
    }, 500);
    // Recalculo de bootstrap
    setTimeout(function(){
      if(typeof window._recalcHCorteAuto === 'function') window._recalcHCorteAuto();
    }, 2000);
    console.log('[148-hcorte-auto-fix] iniciado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
