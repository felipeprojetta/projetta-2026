/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA — PLACEHOLDER (Felipe 24/04)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Felipe pediu ESTACA ZERO na parte de salvamento. Este arquivo existe
 * SO pra neutralizar as chamadas legadas de outros arquivos (loadDB,
 * saveDB, OrcamentoOpcoes, etc) — tudo vira no-op, NADA salva em lugar
 * nenhum.
 *
 * Quando for reconstruir salvamento profissional do zero, este arquivo
 * ganha conteudo real. Ate la: so stubs.
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  function _noop(){}
  function _noopArr(){ return []; }
  function _noopObj(){ return {}; }
  function _noopFalse(){ return false; }

  // Funcoes de salvamento legado — todas no-op
  window.loadDB               = _noopArr;
  window.saveDB               = _noop;
  window.saveNew              = _noop;
  window.saveRevision         = _noop;
  window.salvarRapido         = _noop;
  window.novaRevisao          = _noop;
  window.loadRevision         = _noop;
  window.loadRevisionMemorial = _noop;

  // Captura/restore legado
  window.captureSnapshot  = _noopObj;
  window.captureFormData  = _noopObj;
  window.restoreFormData  = _noop;

  // UI de historico legado
  window.renderHistory           = _noop;
  window.updateBanner            = _noop;
  window.toggleHist              = _noop;
  window.showMemorial            = _noop;
  window._hideMemorial           = function(){
    var p = document.getElementById('memorial-panel');
    if(p) p.style.display = 'none';
  };
  window._restoreSnapshotDisplay = _noop;
  window._openSectionsAndScroll  = _noop;

  // Locks globais legados — sempre "liberado"
  window._setOrcLock      = function(v){ window._orcLocked = !!v; };
  window._isSnapshotValid = _noopFalse;
  window._revClearTimers  = _noop;
  window._revDelay        = function(fn, ms){ return setTimeout(fn, ms); };
  window._persistSession  = _noop;
  window._restoreSession  = _noopFalse;
  window._snapshotLock    = false;
  window._orcLocked       = false;
  window._pendingRevision = false;

  // OrcamentoOpcoes stub (31-opcoes.js morreu)
  window.OrcamentoOpcoes = {
    version:      '0.0-stub',
    migrar:       function(card){ return card; },
    ativa:        function(card){ return card ? { id:'opt1', revisoes: card.revisoes || [], itens: card.itens || [] } : null; },
    indexAtiva:   function(){ return 0; },
    sincronizar:  function(card){ return card; },
    persistir:    function(card){ return card; },
    trocar:       function(card){ return card; },
    novaOpcao:    function(){ return null; },
    removerOpcao: _noopFalse,
    freezeKey:    function(cardId, opcaoId, revNum){ return 'freeze_'+cardId+'_rev'+revNum; }
  };

  // OrcamentoFreeze tambem no-op (estava sendo usado em crmOrcamentoPronto antigo)
  window.OrcamentoFreeze = {
    capturar: function(){ return Promise.reject(new Error('OrcamentoFreeze desativado')); },
    carregar: function(){ return Promise.reject(new Error('OrcamentoFreeze desativado')); },
    listar:   function(){ return Promise.resolve([]); }
  };

  // MemorialV2 tambem no-op
  window.MemorialV2 = {
    salvar: function(){ return Promise.reject(new Error('MemorialV2 desativado')); }
  };

  // Persist fica como PLACEHOLDER vazio — nao expoe salvarOrcamento ainda
  window.Persist = {
    version: '0.0-placeholder',
    _desativado: true
  };

  console.log('%c[00-persist] PLACEHOLDER ativo — zero salvamento, estaca zero (Felipe 24/04)',
              'color:#888780;font-style:italic;background:#F1EFE8;padding:2px 6px;border-radius:3px');
})();
