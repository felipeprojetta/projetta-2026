(() => {
  if (window.__MOD_122_LOADED) return;
  window.__MOD_122_LOADED = true;
  const ALERT_ID = 'mod122-alerta-cep-km';

  function findQuemInstala() {
    const labels = [...document.querySelectorAll('label,div,span,p')].filter(el => /quem\s*instala/i.test(el.textContent||''));
    for (const l of labels) {
      const wrap = l.closest('div,fieldset,section') || l.parentElement;
      const sel = wrap && wrap.querySelector('select');
      if (sel) return sel;
    }
    return document.querySelector('select[name*="instala" i],select[id*="instala" i]');
  }
  function findCep() {
    return document.querySelector('input[name*="cep" i]:not([disabled]),input[id*="cep" i]:not([disabled]),input[placeholder*="cep" i]:not([disabled])');
  }
  function findKm() {
    return document.querySelector('input[name*="km" i],input[id*="km" i],input[name*="distancia" i],input[id*="distancia" i]');
  }

  function isProjetta() {
    const sel = findQuemInstala();
    if (!sel) return false;
    const v = (sel.value || '').toLowerCase();
    const txt = (sel.options && sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text || '').toLowerCase();
    return /projetta/.test(v) || /projetta/.test(txt);
  }

  function mostrarAlerta() {
    if (document.getElementById(ALERT_ID)) return;
    const ov = document.createElement('div');
    ov.id = ALERT_ID;
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:#c0392b;color:#fff;padding:32px 40px;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);max-width:600px;text-align:center;border:3px solid #fff;font-family:system-ui,sans-serif">'+
      '<div style="font-size:28px;font-weight:bold;margin-bottom:14px">⚠ CEP NÃO ENCONTROU OS KM</div>'+
      '<div style="font-size:17px;margin-bottom:22px;line-height:1.5">Como a instalação é <strong>PROJETTA</strong>, é obrigatório ter os km da obra calculados.<br><br>Corrija o CEP da obra ou preencha os km manualmente.</div>'+
      '<button id="mod122-ok-btn" style="background:#fff;color:#c0392b;border:none;padding:12px 28px;border-radius:7px;font-weight:bold;cursor:pointer;font-size:16px">Entendi, vou corrigir</button>'+
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('mod122-ok-btn').onclick = () => { ov.remove(); const c = findCep(); if (c) c.focus(); };
  }
  function esconder() { const e = document.getElementById(ALERT_ID); if (e) e.remove(); }

  let timer = null;
  function check() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!isProjetta()) { esconder(); return; }
      const cepEl = findCep();
      const kmEl = findKm();
      const cep = (cepEl && cepEl.value || '').replace(/\D/g, '');
      const km  = parseFloat(kmEl && kmEl.value || '0');
      if (cep.length === 8 && (!km || km <= 0 || isNaN(km))) mostrarAlerta();
      else esconder();
    }, 1500);
  }

  document.addEventListener('change', e => {
    const t = e.target;
    if (!t || !t.matches) return;
    if (t.matches('select') && /quem|instala/i.test((t.name||'')+(t.id||''))) check();
    if (t.matches('input') && /cep|km|distancia/i.test((t.name||'')+(t.id||''))) check();
  }, true);
  document.addEventListener('blur', e => {
    if (e.target && e.target.matches && e.target.matches('input') && /cep/i.test((e.target.name||'')+(e.target.id||''))) check();
  }, true);

  console.log('[mod 122] Alerta INSTALAÇÃO PROJETTA + CEP/km carregado');
})();
