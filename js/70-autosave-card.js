/**
 * ═══════════════════════════════════════════════════════════════════════
 * 70-autosave-card.js v2 — Autosave instantâneo do modal do card
 * ─────────────────────────────────────────────────────────────────────
 *
 * Qualquer mudança em QUALQUER campo dentro do modal #crm-opp-modal
 * dispara save automático com debounce de 300ms.
 *
 * Chama window.crmSaveOpp() que já existe no 10-crm.js e cuida da
 * persistência completa (localStorage + Supabase).
 *
 * Toast discreto canto superior direito:
 *   ⏳ "salvando..." (cinza) → ✓ "salvo" (verde) ou ⚠ "erro" (vermelho)
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var DEBOUNCE_MS = 300;
  var _timer = null;

  function _toast(msg, cor, ms){
    var t = document.getElementById('autosave-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'autosave-toast';
      t.style.cssText =
        'position:fixed;top:80px;right:20px;padding:8px 16px;' +
        'border-radius:8px;color:#fff;font-weight:700;font-size:12px;' +
        'z-index:99999;box-shadow:0 3px 10px rgba(0,0,0,.25);' +
        'transition:opacity .2s;font-family:inherit;pointer-events:none';
      document.body.appendChild(t);
    }
    t.style.background = cor;
    t.textContent = msg;
    t.style.opacity = '1';
    if(t._fade) clearTimeout(t._fade);
    t._fade = setTimeout(function(){
      t.style.opacity = '0';
      setTimeout(function(){ if(t && t.parentNode) t.remove(); }, 250);
    }, ms || 1600);
  }

  function _disparaSave(){
    if(_timer) clearTimeout(_timer);
    _toast('⏳ salvando...', '#7f8c8d', 2000);
    _timer = setTimeout(function(){
      if(typeof window.crmSaveOpp !== 'function'){
        _toast('⚠ crmSaveOpp indisponível', '#c0392b', 2500);
        return;
      }
      try {
        window.crmSaveOpp();
        _toast('✓ salvo', '#27ae60', 1500);
      } catch(e){
        _toast('⚠ erro ao salvar', '#c0392b', 3000);
        console.error('[autosave]', e);
      }
    }, DEBOUNCE_MS);
  }

  // Detecta se o elemento está dentro do modal do card (#crm-opp-modal)
  function _dentroDoModalCard(el){
    if(!el) return false;
    var modal = document.getElementById('crm-opp-modal');
    if(!modal) return false;
    // Modal só faz sentido escutar se está aberto
    if(!modal.classList.contains('open')) return false;
    return modal.contains(el);
  }

  function _ehInputValido(el){
    if(!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'select' || tag === 'textarea';
  }

  function _onChange(e){
    if(!_ehInputValido(e.target)) return;
    if(!_dentroDoModalCard(e.target)) return;
    _disparaSave();
  }

  document.addEventListener('input',  _onChange, true);
  document.addEventListener('change', _onChange, true);

  console.log('%c[70-autosave-card] v2.0 ativo — TODOS os campos do modal #crm-opp-modal autosalvam (debounce ' + DEBOUNCE_MS + 'ms)',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
