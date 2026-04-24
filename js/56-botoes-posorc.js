/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.posorc.botoes — Handlers dos botões do pós-orçamento
 * ─────────────────────────────────────────────────────────────────────
 *
 * Arquivo que FICA ENTRE a UI (botões no header) e o bloco estrutural
 * PROJETTA.posorc (50-55). Aqui moram as funções globais chamadas por
 * onclick="salvarPreOrcamento()" etc.
 *
 * Cada botão tem sua responsabilidade clara:
 *   salvarPreOrcamento()  → grava revisão no banco SEM mexer no card.
 *                            Uso: salvar trabalho em progresso.
 *
 * FUTURO (próximas sessões):
 *   finalizarOrcamento()  → grava + marca pipeline + gera PDF
 *   verRevisoesCard()     → modal com lista de revisões
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.posorc = window.PROJETTA.posorc || {};

(function(ns){
  'use strict';

  // ─── Helpers internos ─────────────────────────────────────────────────
  function _toast(msg, cor, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:' + cor +
      ';color:#fff;padding:12px 20px;border-radius:8px;font-size:13px;' +
      'font-weight:700;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.25);' +
      'min-width:240px;max-width:400px;font-family:Inter,system-ui,sans-serif';
    t.innerHTML = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, ms || 4000);
    return t;
  }

  function _esperarRecalculo(timeoutMs){
    // gerarCustoTotal() roda em 3 fases assíncronas com setTimeout.
    // Esperamos o tempo máximo (padrão 2s) pra garantir conclusão.
    return new Promise(function(resolve){
      setTimeout(resolve, timeoutMs || 2000);
    });
  }

  // ─── SALVAR PRÉ-ORÇAMENTO ─────────────────────────────────────────────
  // Grava revisão no Supabase. NÃO mexe no card (pipeline fica intacto).
  // NÃO gera PDF. É pra "salvar o trabalho em progresso".
  window.salvarPreOrcamento = async function(){
    var cardId = window._crmOrcCardId;
    if(!cardId){
      _toast('⚠ Abra o orçamento pelo CRM primeiro (botão "Fazer Orçamento")', '#e67e22', 5000);
      return;
    }

    // 1) Salvar item atual no array, se estiver editando
    if(typeof window._mpSalvarItemAtual === 'function' && window._mpEditingIdx >= 0){
      try { window._mpSalvarItemAtual(); } catch(e){ console.warn('[salvarPreOrc] _mpSalvarItemAtual:', e); }
    }

    // 2) Forçar recálculo pra garantir window._calcResult atualizado
    var btn = document.getElementById('btn-salvar-preorc');
    var origHTML = btn ? btn.innerHTML : '';
    if(btn){ btn.innerHTML = '⏳ Salvando...'; btn.disabled = true; }

    var toastProgress = _toast('⏳ Recalculando e salvando...', '#2980b9', 30000);

    try {
      window._osAutoMode = true;
      if(typeof window.gerarCustoTotal === 'function'){
        try { window.gerarCustoTotal(); } catch(e){ console.warn('[salvarPreOrc] gerarCustoTotal:', e); }
      }

      // 3) Aguardar as fases assíncronas de gerarCustoTotal terminarem
      await _esperarRecalculo(2500);

      window._osAutoMode = false;

      // 4) Validar que bloco posorc está disponível
      if(!ns || !ns.processar){
        throw new Error('Módulo PROJETTA.posorc.processar indisponível. Recarregue a página.');
      }

      // 5) Chamar processar com marcarPipeline=false e gerarPdf=false
      var rev = await ns.processar(cardId, {
        marcarPipeline: false,
        gerarPdf:       false,
        observacoes:    'Salvo via botão "Salvar Pré-Orçamento"',
        onProgress:     function(etapa){
          if(toastProgress) toastProgress.innerHTML = '⏳ ' + etapa.replace(/_/g,' ') + '...';
        }
      });

      if(toastProgress) toastProgress.remove();

      _toast(
        '✅ Pré-orçamento salvo<br>' +
        '<span style="font-size:11px;font-weight:500;opacity:.9">' +
          'Revisão #' + rev.revNum + ' · ' + rev.id.slice(0,8) +
        '</span>',
        '#27ae60', 5000
      );
      console.log('%c[salvarPreOrcamento] ✓ rev #' + rev.revNum + ' salva',
                  'color:#27ae60;font-weight:500');
      return rev;

    } catch(err){
      if(toastProgress) toastProgress.remove();
      _toast('❌ Falha ao salvar: ' + (err.message || err), '#c0392b', 7000);
      console.error('[salvarPreOrcamento] erro:', err);
      throw err;
    } finally {
      if(btn){ btn.innerHTML = origHTML; btn.disabled = false; }
    }
  };

  console.log('[PROJETTA.posorc.botoes] v1.0 carregado — salvarPreOrcamento disponível');
})(window.PROJETTA.posorc);
