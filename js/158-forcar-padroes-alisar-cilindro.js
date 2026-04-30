/* ============================================================================
 * js/158-forcar-padroes-alisar-cilindro.js  —  (28-abr-2026)
 *
 * Felipe 28/04: "force todos os card estarem flagados com alisar, para
 * inicio depois se eu quiser eu posso desmarcar e mudar faca isso tbm
 * para cilindro coloque todos keso"
 *
 * COMPORTAMENTO:
 *  - Ao carregar a pagina (start) → marca Alisar=SIM e Cilindro=KESO
 *  - Apos clicar Zerar → marca de novo (volta ao default)
 *  - Quando usuario desmarca/muda manualmente → RESPEITA (data-touched=1)
 *  - Em re-renders/syncs → mantem o que o usuario escolheu
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta158Applied) return;
  window.__projetta158Applied = true;

  function $(id){ return document.getElementById(id); }

  function forcarAlisar(forcarMesmoSeTouched){
    var el = $('carac-tem-alisar');
    if(!el) return false;
    if(!forcarMesmoSeTouched && el.dataset.userTouched === '1') return false;
    if(!el.checked){
      el.checked = true;
      console.log('[158] alisar marcado por padrao');
      return true;
    }
    return false;
  }

  function forcarCilindro(forcarMesmoSeTouched){
    var el = $('carac-cilindro');
    if(!el) return false;
    if(!forcarMesmoSeTouched && el.dataset.userTouched === '1') return false;
    // Pegar opcoes disponiveis e procurar KESO
    var temKeso = false;
    for(var i = 0; i < el.options.length; i++){
      if(el.options[i].value === 'KESO'){ temKeso = true; break; }
    }
    if(!temKeso) return false;
    if(el.value !== 'KESO'){
      el.value = 'KESO';
      console.log('[158] cilindro setado pra KESO por padrao');
      return true;
    }
    return false;
  }

  function forcarTodosPadroes(forcar){
    var mudou1 = forcarAlisar(forcar);
    var mudou2 = forcarCilindro(forcar);
    if((mudou1 || mudou2) && typeof window.calc === 'function'){
      try { window.calc(); } catch(e){}
    }
    if((mudou1 || mudou2) && typeof window._osAutoUpdate === 'function'){
      try { window._osAutoUpdate(); } catch(e){}
    }
  }

  // Marcar como "tocado" quando user interage manualmente
  function instalarMarcadoresTouched(){
    var alisar = $('carac-tem-alisar');
    if(alisar && !alisar.__sub158Marker){
      alisar.addEventListener('change', function(){
        alisar.dataset.userTouched = '1';
        console.log('[158] usuario alterou alisar manualmente → respeitar');
      });
      alisar.__sub158Marker = true;
    }
    var cil = $('carac-cilindro');
    if(cil && !cil.__sub158Marker){
      cil.addEventListener('change', function(){
        cil.dataset.userTouched = '1';
        console.log('[158] usuario alterou cilindro manualmente → respeitar');
      });
      cil.__sub158Marker = true;
    }
  }

  // Hook em zerarValores - após zerar, FORÇA padrões (com forcar=true)
  function hookZerar(){
    var orig = window.zerarValores;
    if(typeof orig !== 'function'){ setTimeout(hookZerar, 300); return; }
    if(orig.__sub158Hooked) return;
    window.zerarValores = function(){
      var r = orig.apply(this, arguments);
      setTimeout(function(){
        // Reset dataset para deixar os padroes voltarem
        var alisar = $('carac-tem-alisar');
        if(alisar){ alisar.dataset.userTouched = ''; }
        var cil = $('carac-cilindro');
        if(cil){ cil.dataset.userTouched = ''; }
        forcarTodosPadroes(true);
      }, 300);
      return r;
    };
    window.zerarValores.__sub158Hooked = true;
    window.zerarTudo = window.zerarValores; // alias
    console.log('[158] zerarValores hooked');
  }

  // Hook em crmOrcCarregar (se voltar) - quando carrega snapshot, NAO forçar
  // (respeitar o que estava salvo no card)
  // Mas se o snapshot nao tem esses campos, deixa o padrao
  function hookCarregar(){
    var orig = window.crmOrcCarregar;
    if(typeof orig === 'function' && !orig.__sub158Hooked){
      window.crmOrcCarregar = function(){
        var r = orig.apply(this, arguments);
        // Marcar como touched para nao sobrescrever
        setTimeout(function(){
          var alisar = $('carac-tem-alisar');
          if(alisar) alisar.dataset.userTouched = '1';
          var cil = $('carac-cilindro');
          if(cil && cil.value) cil.dataset.userTouched = '1';
        }, 500);
        return r;
      };
      window.crmOrcCarregar.__sub158Hooked = true;
    }
  }

  function init(){
    // Forcar inicial (sem checar touched - é o primeiro load)
    setTimeout(function(){
      forcarTodosPadroes(true);
      instalarMarcadoresTouched();
    }, 1200);

    // Reforço periódico, mas respeitando touched
    setInterval(function(){
      forcarTodosPadroes(false);
      instalarMarcadoresTouched();
    }, 3000);

    hookZerar();
    setTimeout(hookCarregar, 1500);

    console.log('[158-forcar-padroes-alisar-cilindro] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
