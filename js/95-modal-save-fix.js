/* ===========================================================================
 * js/95-modal-save-fix.js  —  Modulo NOVO (24-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 *
 * Conforme regras de blindagem (configuracoes.projetta_regras_blindagem_v1):
 *  - NAO modifica nenhum arquivo JS existente
 *  - NAO deleta linhas de codigo
 *  - Funciona via override em window.<funcao> e injecao no DOM
 *
 * Resolve 2 problemas no modal "Editar Oportunidade":
 *
 *   FIX B — Item deletado nao persistia
 *     crmItemRemove() so removia de _crmItens em memoria. O sync de 8s
 *     do 57-hidratar-local re-puxava o item do banco -> "item volta".
 *     Solucao: depois do remove, chamar _crmItensSaveFromDOM + crmSaveOpp.
 *
 *   FEATURE A — Botao "Salvar" no rodape do modal
 *     Garante save explicito antes de fechar (alem do autosave).
 *     Mostra feedback visual ao salvar.
 * ========================================================================= */
(function(){
  'use strict';
  if(window.__projetta95ModalSaveFixApplied) return;
  window.__projetta95ModalSaveFixApplied = true;
  console.log('[95-modal-save-fix] iniciando');

  // ===== FIX B: persistir delete de item no banco =====
  function patchItemRemove(){
    if(!window.crmItemRemove) return setTimeout(patchItemRemove, 500);
    if(window.crmItemRemove.__projettaPatched95) return;

    var orig = window.crmItemRemove;
    var wrapped = function(){
      var antes = (window._crmItens && window._crmItens.length) || 0;
      var ret = orig.apply(this, arguments);
      var depois = (window._crmItens && window._crmItens.length) || 0;
      if(depois < antes){
        setTimeout(function(){
          try {
            if(typeof window._crmItensSaveFromDOM === 'function'){
              window._crmItensSaveFromDOM();
            }
            if(typeof window.crmSaveOpp === 'function'){
              window.crmSaveOpp();
              console.log('[95-modal-save-fix] item removido + crmSaveOpp disparado');
            }
          } catch(e){
            console.warn('[95-modal-save-fix] erro ao persistir delete:', e);
          }
        }, 150);
      }
      return ret;
    };
    wrapped.__projettaPatched95 = true;
    window.crmItemRemove = wrapped;
    console.log('[95-modal-save-fix] crmItemRemove patched');
  }
  patchItemRemove();

  // ===== FEATURE A: botao "Salvar Alteracoes" no rodape do modal =====
  var BTN_ID = 'projetta-modal-save-btn-95';

  function disparoSalvar(btn){
    var msgOriginal = btn.textContent;
    var bgOriginal = btn.style.background;
    try {
      if(typeof window._crmItensSaveFromDOM === 'function'){
        window._crmItensSaveFromDOM();
      }
      var promiseOuResultado;
      if(typeof window.crmSaveOpp === 'function'){
        promiseOuResultado = window.crmSaveOpp();
      }
      btn.textContent = '✓ Salvo!';
      btn.style.background = '#1e8449';
      btn.disabled = true;
      setTimeout(function(){
        btn.textContent = msgOriginal;
        btn.style.background = bgOriginal;
        btn.disabled = false;
      }, 1800);
    } catch(err){
      console.error('[95-modal-save-fix] erro ao salvar:', err);
      btn.textContent = '⚠ Erro ao salvar';
      btn.style.background = '#c0392b';
      setTimeout(function(){
        btn.textContent = msgOriginal;
        btn.style.background = bgOriginal;
      }, 2500);
    }
  }

  function injetarBotaoSalvar(){
    // Procurar modal de "Editar Oportunidade" aberto
    var titulos = Array.from(document.querySelectorAll('h2,h3,h4,div'));
    var titulo = titulos.find(function(e){
      var t = (e.textContent||'').trim();
      return /^Editar Oportunidade/.test(t) && e.children.length < 3 && e.offsetParent !== null;
    });
    if(!titulo) return;

    // Subir ate achar o container do modal
    var modal = titulo;
    for(var i = 0; i < 8; i++){
      if(!modal.parentElement) break;
      modal = modal.parentElement;
      // Modal grande tem altura significativa
      if(modal.getBoundingClientRect().height > 400) break;
    }

    // Verificar se ja injetamos
    if(modal.querySelector('#' + BTN_ID)) return;

    // Achar o botao "Fechar" pra inserir o "Salvar" ao lado
    var btnFechar = Array.from(modal.querySelectorAll('button')).find(function(b){
      return (b.textContent||'').trim() === 'Fechar';
    });
    if(!btnFechar || !btnFechar.parentElement) return;

    var btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.textContent = '💾 Salvar Alterações';
    btn.style.cssText = [
      'background:#27ae60',
      'color:#fff',
      'border:none',
      'padding:8px 16px',
      'border-radius:6px',
      'font-weight:700',
      'font-size:13px',
      'cursor:pointer',
      'margin-right:8px',
      'font-family:inherit',
      'box-shadow:0 2px 4px rgba(39,174,96,.25)',
      'transition:transform .1s'
    ].join(';');
    btn.addEventListener('mouseenter', function(){ btn.style.transform = 'scale(1.03)'; });
    btn.addEventListener('mouseleave', function(){ btn.style.transform = 'scale(1)'; });
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      disparoSalvar(btn);
    });

    btnFechar.parentElement.insertBefore(btn, btnFechar);
    console.log('[95-modal-save-fix] botao Salvar injetado no modal');
  }

  // Observar mudancas no DOM pra injetar quando modal abrir
  if(typeof MutationObserver !== 'undefined'){
    new MutationObserver(injetarBotaoSalvar).observe(document.body, {childList:true, subtree:true});
  }
  // Tentar a cada segundo tambem (resiliente a re-render)
  setInterval(injetarBotaoSalvar, 1000);
  injetarBotaoSalvar();

  console.log('[95-modal-save-fix] instalado');
})();
