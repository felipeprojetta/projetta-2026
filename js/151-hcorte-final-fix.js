/* ============================================================================
 * js/151-hcorte-final-fix.js  —  FIX DEFINITIVO h-corte (28-abr-2026)
 *
 * BUG IDENTIFICADO: 146 dispatchava input event apos setar valor.
 * Meu listener do 148 ouvia esse event e MARCAVA como manual de volta.
 * Loop infinito de "alterado manualmente".
 *
 * SOLUCAO RADICAL:
 *  - REESCREVER _recalcHCorteAuto SEM dispatchEvent
 *  - REINSTALAR listener limpo no h-corte com FLAG programatica
 *  - HOOKS de _selectChapaSimByCor e plan-acm-qty FORCAM bypass do manual
 *  - DESTRAVA AGRESSIVO no boot - se inconsistencia detectada, limpa
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta151Applied) return;
  window.__projetta151Applied = true;

  var MODELOS_RIPADOS = ['08','15','20','21'];
  function $(id){ return document.getElementById(id); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  /* ───── FORMULA ───── */
  function calcularHCorte(nChapas){
    if(!(nChapas > 0)) return { horas: 0, label: '' };
    var mSel = $('carac-modelo') || $('plan-modelo');
    var mVal = mSel ? mSel.value : '';
    var isRip = MODELOS_RIPADOS.indexOf(mVal) >= 0;

    var orcItens = window._orcItens || [];
    var hasPortaOuFixo = orcItens.some(function(it){
      return it.tipo === 'porta_pivotante' || it.tipo === 'porta_interna' || it.tipo === 'fixo';
    });
    var hasRev = orcItens.some(function(it){
      return it.tipo === 'revestimento' && (it.largura||0) > 0 && (it.altura||0) > 0;
    });
    var revTemRipado = orcItens.some(function(it){
      return it.tipo === 'revestimento' && it.rev_tipo === 'RIPADO';
    });
    var revOnly = orcItens.length > 0 && !hasPortaOuFixo && hasRev;

    var horas, label;
    if(revOnly){
      var revRipH = revTemRipado ? nChapas : 0;
      horas = nChapas + 1 + revRipH;
      label = '(auto: ' + nChapas + ' chapas +1' + (revTemRipado ? ' +' + nChapas + ' ripado' : '') + ' = ' + horas + 'h)';
    } else {
      horas = isRip ? nChapas + 2 : nChapas + 1;
      label = '(auto: ' + nChapas + ' chapas ' + (isRip ? '+2 ripado' : '+1') + ' = ' + horas + 'h)';
    }
    return { horas: horas, label: label };
  }

  function obterNumChapas(forceN){
    if(forceN > 0) return forceN;
    var n = window._chapasCalculadas || 0;
    if(n > 0) return n;
    var qEl = $('plan-acm-qty');
    if(qEl){ var q = parseInt(qEl.value) || 0; if(q > 0) return q; }
    var soma = 0;
    for(var i = 1; i <= 20; i++){
      var qe = $('acm-qty-' + i);
      if(!qe) break;
      soma += parseInt(qe.value) || 0;
    }
    return soma;
  }

  /* ═══════════ NOVA _recalcHCorteAuto SEM dispatchEvent ═══════════ */
  // bypassManual=true → ignora dataset.manual (usado quando muda chapas)
  window._recalcHCorteAuto = function(forceN, bypassManual){
    var hcEl = $('h-corte');
    if(!hcEl) return;

    if(!bypassManual && hcEl.dataset.manual === '1'){
      console.log('[151] respeitando manual=1 (bypassManual=false)');
      return;
    }

    var nChapas = obterNumChapas(forceN);
    if(!(nChapas > 0)){ console.log('[151] sem chapas, ignorando'); return; }

    var r = calcularHCorte(nChapas);
    if(r.horas <= 0) return;

    var antes = hcEl.value;
    if(String(antes) === String(r.horas) && hcEl.dataset.auto === '1' && hcEl.dataset.manual === ''){
      // Ja esta certo - so atualizar label
      var lbl0 = $('h-corte-auto'); if(lbl0) lbl0.textContent = r.label;
      return;
    }

    // FLAG programatica para listener nao confundir
    window.__hcorteSettingProgrammatic = true;
    hcEl.value = r.horas;
    hcEl.dataset.auto = '1';
    hcEl.dataset.manual = ''; // garantir que destranca
    window.__hcorteLastAuto = r.horas;
    window.__hcorteSettingProgrammatic = false;

    var lbl = $('h-corte-auto');
    if(lbl) lbl.textContent = r.label;

    // Chamar calc() pra propagar valor (sem dispatchar input)
    if(typeof window.calc === 'function'){
      try { window.calc(); } catch(e){ console.warn('[151 calc]', e); }
      // calc() do 02-orcamento pode ter setado label "(manual)" - reverter
      setTimeout(function(){
        if(lbl && hcEl.dataset.auto === '1' && hcEl.dataset.manual === ''){
          lbl.textContent = r.label;
        }
      }, 100);
    }

    console.log('[151 hcorte] ' + antes + 'h → ' + r.horas + 'h (' + nChapas + ' chapas, bypass=' + (bypassManual?'1':'0') + ')');
  };

  /* ═══════════ REINSTALAR LISTENER LIMPO ═══════════ */
  function reinstalarListener(){
    var hcEl = $('h-corte');
    if(!hcEl) return false;

    // Clonar para remover TODOS os listeners antigos
    var clone = hcEl.cloneNode(true);
    hcEl.parentNode.replaceChild(clone, hcEl);
    hcEl = clone;

    hcEl.addEventListener('input', function(){
      // Ignorar quando set programatico
      if(window.__hcorteSettingProgrammatic) return;

      // Vazio ou zero → voltar pro auto
      if(hcEl.value === '' || hcEl.value === '0' || Number(hcEl.value) === 0){
        hcEl.dataset.manual = '';
        hcEl.dataset.auto = '';
        var lbl0 = $('h-corte-auto'); if(lbl0) lbl0.textContent = '';
        setTimeout(function(){ window._recalcHCorteAuto(null, true); }, 50);
        return;
      }

      // Valor igual ao último auto = não é manual
      if(window.__hcorteLastAuto != null && Number(hcEl.value) === Number(window.__hcorteLastAuto)){
        return;
      }

      // Valor diferente = digitação manual real
      hcEl.dataset.manual = '1';
      hcEl.dataset.auto = '';
      atualizarLabelManual();
    });

    console.log('[151] listener input REINSTALADO (limpo)');
    return true;
  }

  function atualizarLabelManual(){
    var lbl = $('h-corte-auto');
    if(!lbl) return;
    lbl.innerHTML = '<span style="color:#e67e22;font-weight:600">← manual</span> <button type="button" id="btn-hcorte-voltar-auto" style="margin-left:6px;padding:2px 9px;background:#27ae60;color:#fff;border:none;border-radius:4px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">↺ Voltar pro auto</button>';
    var btn = $('btn-hcorte-voltar-auto');
    if(btn){
      btn.onclick = function(e){
        e.preventDefault(); e.stopPropagation();
        var hcEl = $('h-corte');
        if(hcEl){ hcEl.dataset.manual = ''; }
        window._recalcHCorteAuto(null, true);
      };
    }
  }

  /* ═══════════ HOOKS COM BYPASS ═══════════ */

  function hookSelectChapa(){
    var orig = window._selectChapaSimByCor;
    if(!orig){ setTimeout(hookSelectChapa, 200); return; }
    if(orig.__sub151Hooked) return;

    window._selectChapaSimByCor = function(corKey, sw, sh){
      console.log('[151] _selectChapaSimByCor → forcando bypass manual');
      // ANTES de mudar chapa, destrancar manual
      var hcEl = $('h-corte');
      if(hcEl) hcEl.dataset.manual = '';

      var r = orig.apply(this, arguments);

      // Recalcular com bypass em multiplos timing pra pegar
      setTimeout(function(){ window._recalcHCorteAuto(null, true); }, 250);
      setTimeout(function(){ window._recalcHCorteAuto(null, true); }, 700);
      setTimeout(function(){ window._recalcHCorteAuto(null, true); }, 1500);
      return r;
    };
    window._selectChapaSimByCor.__sub151Hooked = true;
    console.log('[151] hook _selectChapaSimByCor com BYPASS instalado');
  }

  function hookInputQty(){
    var qEl = $('plan-acm-qty');
    if(!qEl){ setTimeout(hookInputQty, 300); return; }
    if(qEl.dataset.sub151Hooked) return;
    qEl.dataset.sub151Hooked = '1';

    qEl.addEventListener('input', function(){
      var n = parseInt(qEl.value) || 0;
      if(n > 0){
        window._chapasCalculadas = n;
        var hcEl = $('h-corte');
        if(hcEl) hcEl.dataset.manual = ''; // destranca
        setTimeout(function(){ window._recalcHCorteAuto(n, true); }, 50);
      }
    });
    console.log('[151] hook plan-acm-qty com BYPASS instalado');
  }

  function hookPlanUpd(){
    var orig = window.planUpd;
    if(!orig){ setTimeout(hookPlanUpd, 200); return; }
    if(orig.__sub151Hooked) return;
    window.planUpd = function(){
      var r = orig.apply(this, arguments);
      setTimeout(function(){
        var hcEl = $('h-corte');
        if(hcEl && hcEl.dataset.manual !== '1'){
          window._recalcHCorteAuto(null, false);
        }
      }, 200);
      return r;
    };
    window.planUpd.__sub151Hooked = true;
    console.log('[151] hook planUpd instalado');
  }

  /* ═══════════ DESTRAVA AGRESSIVO NO BOOT ═══════════ */
  function destravarBoot(){
    var hcEl = $('h-corte');
    if(!hcEl) return;

    var v = Number(hcEl.value || 0);
    var n = obterNumChapas();

    // Se valor=0 ou vazio → destrava
    if(v === 0 || hcEl.value === ''){
      hcEl.dataset.manual = '';
      hcEl.dataset.auto = '';
      console.log('[151] BOOT: destravado (valor=0)');
    }
    // Se ha chapas e valor < 2 (impossivel para auto) → destrava
    else if(n > 0 && v < n + 1){
      var formula = calcularHCorte(n);
      // Se valor atual NAO bate com formula esperada → destrava
      if(v !== formula.horas){
        hcEl.dataset.manual = '';
        console.log('[151] BOOT: destravado (valor inconsistente: ' + v + 'h, esperado ' + formula.horas + 'h)');
      }
    }

    // Se ainda manual=1, mostrar botao de voltar
    if(hcEl.dataset.manual === '1'){
      atualizarLabelManual();
    }

    // Forcar recalculo inicial
    setTimeout(function(){
      window._recalcHCorteAuto(null, false);
    }, 600);
  }

  function init(){
    hookSelectChapa();
    hookInputQty();
    hookPlanUpd();
    setTimeout(function(){
      reinstalarListener();
      destravarBoot();
    }, 500);
    setTimeout(function(){
      window._recalcHCorteAuto(null, false);
    }, 2500);
    console.log('[151-hcorte-final-fix] iniciado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
