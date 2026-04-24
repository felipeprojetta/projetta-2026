/**
 * ═══════════════════════════════════════════════════════════════════════
 * 70-autosave-card.js — Autosave dos itens dentro do modal Editar Card
 * ─────────────────────────────────────────────────────────────────────
 *
 * Substitui o botão "💾 Salvar Item" por autosave automático com debounce.
 * Qualquer mudança em um campo crmit-* ou crm-o-* dispara save em 800ms.
 *
 * Usa a função legada window.crmSaveOpp() que já existe no 10-crm.js e
 * cuida de: _crmItensSaveFromDOM() → grava em localStorage + Supabase.
 *
 * Exibe toast discreto no canto superior direito:
 *   ⏳ "salvando..." (cinza) → ✓ "salvo" (verde) ou ⚠ "erro" (vermelho)
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var _debounceTimer = null;
  var _lastField = '';

  // Toast discreto no canto superior direito
  function _toast(msg, cor, ms){
    var t = document.getElementById('autosave-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'autosave-toast';
      t.style.cssText =
        'position:fixed;top:80px;right:20px;padding:8px 16px;' +
        'border-radius:8px;color:#fff;font-weight:700;font-size:12px;' +
        'z-index:99999;box-shadow:0 3px 10px rgba(0,0,0,.25);' +
        'transition:opacity .25s;font-family:inherit;pointer-events:none';
      document.body.appendChild(t);
    }
    t.style.background = cor;
    t.textContent = msg;
    t.style.opacity = '1';
    if(t._fadeTimer) clearTimeout(t._fadeTimer);
    t._fadeTimer = setTimeout(function(){
      t.style.opacity = '0';
      setTimeout(function(){ if(t && t.parentNode) t.remove(); }, 300);
    }, ms || 1800);
  }

  function _disparaSave(){
    if(_debounceTimer) clearTimeout(_debounceTimer);

    // Mostra "salvando..." imediatamente
    _toast('⏳ salvando...', '#7f8c8d', 1500);

    _debounceTimer = setTimeout(function(){
      if(typeof window.crmSaveOpp !== 'function'){
        _toast('⚠ crmSaveOpp indisponível', '#c0392b', 2500);
        console.warn('[autosave] crmSaveOpp não definida');
        return;
      }
      try {
        window.crmSaveOpp();
        _toast('✓ salvo', '#27ae60', 1600);
      } catch(e){
        _toast('⚠ erro ao salvar', '#c0392b', 3000);
        console.error('[autosave] erro:', e);
      }
    }, 800);
  }

  // Só escutar se o campo está DENTRO do modal do card CRM
  // IDs relevantes: crmit-* (campos de item), crm-o-* (campos top do card)
  function _ehCampoDoCard(el){
    if(!el || !el.id) return false;
    return /^crmit[-_]/.test(el.id) || /^crm-o-/.test(el.id);
  }

  function _onChange(e){
    if(!_ehCampoDoCard(e.target)) return;
    _lastField = e.target.id;
    _disparaSave();
  }

  // Captura change/input global (true = capture phase pra não perder)
  document.addEventListener('input',  _onChange, true);
  document.addEventListener('change', _onChange, true);

  console.log('%c[70-autosave-card] v1.0 ativo — campos crmit-* e crm-o-* agora autosalvam',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
