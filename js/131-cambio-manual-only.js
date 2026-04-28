/* MODULE 131: campo cambio do card (28-abr-2026 v3 - Felipe pediu remover polling)
 * Injeta input #mod131-cambio-card no modal CRM. SEM setInterval.
 * Felipe: "uma vez feito nao deve produzir nada".
 */
(function(){
  if (window.__MOD_131_5_LOADED) return;
  window.__MOD_131_5_LOADED = true;

  function sincCampos(valor) {
    var num = parseFloat(String(valor||'').replace(',', '.'));
    if (!isFinite(num) || num < 0) return;
    var str = num > 0 ? num.toFixed(4) : '';
    var meu = document.getElementById('mod131-cambio-card');
    if (meu && meu.value !== str) meu.value = str;
    var oficial = document.getElementById('crm-inst-cambio');
    if (oficial && oficial.value !== str) {
      oficial.value = str;
      try { oficial.dispatchEvent(new Event('change', {bubbles:true})); } catch(e){}
    }
    var intl = document.getElementById('inst-intl-cambio');
    if (intl && intl.value !== str) {
      intl.value = str;
      try { intl.dispatchEvent(new Event('change', {bubbles:true})); } catch(e){}
    }
    var frete = document.getElementById('frete-calc-cambio');
    if (frete && frete.value !== str) frete.value = str;
    ['calc','calcInstIntl','crmCifRecalc','crmRender','populateProposta'].forEach(function(fn){
      if (typeof window[fn] === 'function') { try { window[fn](); } catch(e){} }
    });
  }

  function injetarCampoCambio() {
    if (document.getElementById('mod131-cambio-card')) return true;
    var titulo = document.getElementById('crm-cif-box-title');
    if (!titulo) return false;
    var painel = titulo.parentNode;
    if (!painel) return false;
    var atual = '';
    var oficial = document.getElementById('crm-inst-cambio');
    if (oficial) {
      var v = parseFloat(oficial.value);
      if (isFinite(v) && v > 0) atual = v.toFixed(4);
    }
    var bloco = document.createElement('div');
    bloco.style.cssText = 'background:#fff8dc;border:2px solid #d35400;border-radius:8px;padding:10px 12px;margin-bottom:10px';
    bloco.innerHTML =
      '<div style="font-size:11px;font-weight:700;color:#7a3e00;margin-bottom:4px">CAMBIO USD/BRL DESTE CARD</div>' +
      '<div style="font-size:10px;color:#7a3e00;margin-bottom:8px;font-style:italic;line-height:1.4">Esse valor fica salvo no card. Vai pra Orcamento, I-Frete, Proposta e Pipeline.</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<label style="font-size:11px;font-weight:700;color:#003144">R$</label>' +
        '<input type="number" id="mod131-cambio-card" min="0" step="0.0001" placeholder="preencha o cambio" style="flex:1;max-width:140px;padding:6px 8px;border:2px solid #d35400;border-radius:6px;font-weight:700;font-size:14px;background:#fff;color:#003144" value="' + atual + '">' +
        '<span style="font-size:11px;color:#666">por US$ 1.00</span>' +
        '<span id="mod131-status" style="font-size:10px;color:#27ae60;font-weight:700;margin-left:8px"></span>' +
      '</div>';
    painel.insertBefore(bloco, titulo);
    var inp = document.getElementById('mod131-cambio-card');
    var status = document.getElementById('mod131-status');
    var onChange = function() {
      var v = parseFloat(String(inp.value||'').replace(',', '.'));
      if (!isFinite(v) || v < 0) return;
      sincCampos(v);
      if (status) {
        status.textContent = 'aplicado - clique Salvar Alteracao';
        setTimeout(function(){ if (status) status.textContent = ''; }, 4000);
      }
    };
    inp.addEventListener('change', onChange);
    inp.addEventListener('blur', onChange);
    inp.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });
    if (oficial) {
      oficial.addEventListener('change', function(){
        var v = parseFloat(oficial.value);
        if (isFinite(v) && v > 0 && inp.value !== v.toFixed(4)) {
          inp.value = v.toFixed(4);
        }
      });
    }
    return true;
  }

  // Felipe 28/04: REMOVIDO setInterval(injetarCampoCambio, 1500).
  // MutationObserver detecta abertura do modal CRM e injeta UMA VEZ.
  function trySetup(){
    if(injetarCampoCambio()) return;
    // Reagir a abertura do modal via MutationObserver
    var mo = new MutationObserver(function(){
      if(injetarCampoCambio()){
        try{ mo.disconnect(); }catch(e){}
      }
    });
    if(document.body) mo.observe(document.body, { childList: true, subtree: true });
    // Garantir tentativa quando modal aparecer (alguns modais reusam DOM)
    setTimeout(injetarCampoCambio, 500);
    setTimeout(injetarCampoCambio, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trySetup);
  } else { trySetup(); }

  console.log('[131-cambio v3] sem polling, so injecao via MutationObserver');
})();
