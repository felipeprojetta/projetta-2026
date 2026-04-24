/**
 * ═══════════════════════════════════════════════════════════════════════
 * 76-resumo-obra-fix.js — Garante que o painel "RESUMO DA OBRA" aparece
 * ─────────────────────────────────────────────────────────────────────
 *
 * O painel #resumo-obra depende de window._osGeradoUmaVez === true.
 * Essa flag não está sendo setada corretamente em todos os fluxos,
 * fazendo o painel não aparecer.
 *
 * Este script:
 *   1. Monitora se há cálculo válido (window._calcResult ou itens)
 *   2. Força _osGeradoUmaVez = true quando há dados
 *   3. Chama _updateResumoObra() pra renderizar o painel
 *
 * Hooks:
 *   - gerarCustoTotal (função de cálculo completo)
 *   - Poll periódico (redundância, 2.5s)
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  function _temCalculoValido(){
    // Há itens no orçamento?
    var itens = window._orcItens;
    if(!Array.isArray(itens) || itens.length === 0) return false;

    // Há cálculo feito? (_calcResult com custo ou preço)
    var cr = window._calcResult;
    if(cr && typeof cr === 'object'){
      if(cr.custoTotal || cr.custo_total || cr.precoTabela || cr.preco_tabela) return true;
    }

    // Fallback: se há itens E pelo menos um tem dimensões válidas
    for(var i = 0; i < itens.length; i++){
      var it = itens[i];
      if((it.largura || 0) > 0 && (it.altura || 0) > 0) return true;
    }
    return false;
  }

  function _mostrarResumo(){
    var painel = document.getElementById('resumo-obra');
    if(!painel) return;

    if(_temCalculoValido()){
      // Forçar flag + chamar update
      window._osGeradoUmaVez = true;
      if(typeof window._updateResumoObra === 'function'){
        try { window._updateResumoObra(); } catch(e){ console.warn('[resumo-obra-fix]', e); }
      } else if(typeof _updateResumoObra === 'function'){
        try { _updateResumoObra(); } catch(e){ console.warn('[resumo-obra-fix]', e); }
      }
    } else {
      // Sem cálculo → esconder
      painel.style.display = 'none';
    }
  }

  // Hook em gerarCustoTotal (monkey-patch)
  function _instalarHook(){
    if(typeof window.gerarCustoTotal !== 'function') return false;
    if(window.gerarCustoTotal._hookedByResumoFix) return true;

    var original = window.gerarCustoTotal;
    var hooked = function(){
      var r;
      try { r = original.apply(this, arguments); } catch(e){ console.error(e); throw e; }
      // Disparar em múltiplos momentos pra cobrir cálculo assíncrono
      setTimeout(_mostrarResumo, 400);
      setTimeout(_mostrarResumo, 1500);
      setTimeout(_mostrarResumo, 3000);
      return r;
    };
    hooked._hookedByResumoFix = true;
    window.gerarCustoTotal = hooked;
    console.log('[76-resumo-obra-fix] ✓ hook instalado em gerarCustoTotal');
    return true;
  }

  // Tentar instalar hook (pode demorar pro 02-orcamento_calc.js carregar)
  var attempts = 0;
  var installInterval = setInterval(function(){
    attempts++;
    if(_instalarHook() || attempts > 20){
      clearInterval(installInterval);
    }
  }, 500);

  // Poll redundante: a cada 2.5s, verificar se deveria mostrar
  setInterval(_mostrarResumo, 2500);

  console.log('%c[76-resumo-obra-fix] v1.0 ativo',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
