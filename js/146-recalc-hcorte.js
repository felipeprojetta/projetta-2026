/* ============================================================================
 * js/146-recalc-hcorte.js  —  Recalculo automatico de h-corte (28-abr-2026)
 *
 * Felipe 28/04: bug detectado — quando troca de chapa via simulacao
 * (ex: 1500x5000 → 1500x7000), o numero de chapas atualiza (5 → 3) mas
 * o h-corte (horas usinagem) NAO recalcula. Felipe espera 3+1=4h, mas
 * fica em 6h (que era 5+1).
 *
 * REGRA DA USINAGEM:
 *   - Modelo NORMAL:    h-corte = nChapas + 1
 *   - Modelo RIPADO:    h-corte = nChapas + 2  (modelos 08, 15, 20, 21)
 *   - Rev-only normal:  h-corte = nChapas + 1
 *   - Rev-only ripado:  h-corte = nChapas + 1 + nChapas  (1h por chapa ripada)
 *
 * Esse modulo cria window._recalcHCorteAuto() e hooka em:
 *   1) _selectChapaSimByCor (troca de chapa via simulacao)
 *   2) planUpd (apos cada recalculo do planificador)
 *   3) plan-acm-qty input (Felipe edita manualmente o numero de chapas)
 *
 * RESPEITA modo manual: se hCorteEl.dataset.manual==='1', nao sobrescreve.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta146Applied) return;
  window.__projetta146Applied = true;

  var MODELOS_RIPADOS = ['08','15','20','21'];

  function $(id){ return document.getElementById(id); }

  /* ───────── Calculo da fórmula ───────── */
  function calcularHCorte(nChapas){
    if(!(nChapas > 0)) return { horas: 0, label: '' };

    // Detectar modelo ripado (porta)
    var mSel = $('carac-modelo') || $('plan-modelo');
    var mVal = mSel ? mSel.value : '';
    var isRip = MODELOS_RIPADOS.indexOf(mVal) >= 0;

    // Detectar rev-only com ripado
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
      // Rev-only: nChapas + 1 + (nChapas se ripado)
      var revRipH = revTemRipado ? nChapas : 0;
      horas = nChapas + 1 + revRipH;
      label = '(auto: ' + nChapas + ' chapas +1' + (revTemRipado ? ' +' + nChapas + ' ripado' : '') + ' = ' + horas + 'h)';
    } else {
      horas = isRip ? nChapas + 2 : nChapas + 1;
      label = '(auto: ' + nChapas + ' chapas ' + (isRip ? '+2 ripado' : '+1') + ' = ' + horas + 'h)';
    }
    return { horas: horas, label: label };
  }

  /* ───────── Funcao principal: recalcular ───────── */
  window._recalcHCorteAuto = function(forceNChapas){
    var hCorteEl = $('h-corte');
    if(!hCorteEl) return;

    // Respeitar modo manual: se Felipe digitou valor (dataset.manual='1'), nao sobrescrever
    if(hCorteEl.dataset.manual === '1') return;

    // Obter numero de chapas: prioriza forceNChapas, senao window._chapasCalculadas, senao plan-acm-qty
    var nChapas = forceNChapas;
    if(!(nChapas > 0)) nChapas = window._chapasCalculadas || 0;
    if(!(nChapas > 0)){
      var qEl = $('plan-acm-qty');
      if(qEl) nChapas = parseInt(qEl.value) || 0;
    }
    if(!(nChapas > 0)){
      // Soma acm-qty-N (planificador antigo)
      for(var i = 1; i <= 20; i++){
        var qe = $('acm-qty-' + i);
        if(!qe) break;
        nChapas += parseInt(qe.value) || 0;
      }
    }
    if(!(nChapas > 0)) return; // sem chapas, sem mexer

    var r = calcularHCorte(nChapas);
    if(r.horas <= 0) return;

    var antes = hCorteEl.value;
    if(String(antes) === String(r.horas)) return; // ja esta certo

    hCorteEl.value = r.horas;
    hCorteEl.dataset.auto = '1';
    var lbl = $('h-corte-auto');
    if(lbl) lbl.textContent = r.label;

    // Disparar evento input para outros listeners
    try { hCorteEl.dispatchEvent(new Event('input', { bubbles: true })); } catch(e){}

    // Recalcular custo total (calc())
    if(typeof window.calc === 'function'){
      try { window.calc(); } catch(e){ console.warn('[146 calc]', e); }
    }

    console.log('[146 hcorte] ' + antes + 'h → ' + r.horas + 'h (' + nChapas + ' chapas)');
  };

  /* ───────── HOOKS ───────── */

  // Hook 1: _selectChapaSimByCor — usuario clicou em outro card de chapa
  function hookSelectChapa(){
    var orig = window._selectChapaSimByCor;
    if(!orig){ setTimeout(hookSelectChapa, 200); return; }
    if(orig.__hcorteHooked) return;
    window._selectChapaSimByCor = function(corKey, sw, sh){
      var r = orig.apply(this, arguments);
      // Aguardar 200ms apos planRun para nChapas atualizar
      setTimeout(function(){ window._recalcHCorteAuto(); }, 200);
      // Reforço apos 600ms (caso planRun tenha demorado)
      setTimeout(function(){ window._recalcHCorteAuto(); }, 600);
      return r;
    };
    window._selectChapaSimByCor.__hcorteHooked = true;
    console.log('[146 hcorte] hook _selectChapaSimByCor instalado');
  }

  // Hook 2: planUpd — apos cada recalculo do planificador
  function hookPlanUpd(){
    var orig = window.planUpd;
    if(!orig){ setTimeout(hookPlanUpd, 200); return; }
    if(orig.__hcorteHooked) return;
    window.planUpd = function(){
      var r = orig.apply(this, arguments);
      setTimeout(function(){ window._recalcHCorteAuto(); }, 100);
      return r;
    };
    window.planUpd.__hcorteHooked = true;
    console.log('[146 hcorte] hook planUpd instalado');
  }

  // Hook 3: input plan-acm-qty (Felipe edita manualmente o numero de chapas)
  function hookInputQty(){
    var qEl = $('plan-acm-qty');
    if(!qEl){ setTimeout(hookInputQty, 300); return; }
    if(qEl.dataset.hcorteHooked) return;
    qEl.dataset.hcorteHooked = '1';
    qEl.addEventListener('input', function(){
      var n = parseInt(qEl.value) || 0;
      if(n > 0){
        window._chapasCalculadas = n; // sincronizar global
        setTimeout(function(){ window._recalcHCorteAuto(n); }, 50);
      }
    });
    console.log('[146 hcorte] hook input plan-acm-qty instalado');
  }

  // Hook 4: input h-corte (se Felipe digitar manual, marcar como manual)
  function hookHCorteManual(){
    var hcEl = $('h-corte');
    if(!hcEl){ setTimeout(hookHCorteManual, 300); return; }
    if(hcEl.dataset.hcorteHooked) return;
    hcEl.dataset.hcorteHooked = '1';
    hcEl.addEventListener('input', function(){
      // So marca como manual se o usuario realmente digitou (nao foi auto)
      if(hcEl.dataset.auto !== '1'){
        hcEl.dataset.manual = '1';
        var lbl = $('h-corte-auto');
        if(lbl) lbl.textContent = '(manual)';
      }
      // Limpar flag auto pra proxima vez
      hcEl.dataset.auto = '';
    });
    // Botao "Voltar pra auto"? Por enquanto, limpar campo zera o manual
    hcEl.addEventListener('change', function(){
      if(hcEl.value === '' || hcEl.value === '0'){
        hcEl.dataset.manual = '';
        window._recalcHCorteAuto();
      }
    });
    console.log('[146 hcorte] hook h-corte manual flag instalado');
  }

  function init(){
    hookSelectChapa();
    hookPlanUpd();
    hookInputQty();
    hookHCorteManual();
    // Recalculo inicial apos boot
    setTimeout(function(){ window._recalcHCorteAuto(); }, 1500);
    console.log('[146-recalc-hcorte] iniciado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
