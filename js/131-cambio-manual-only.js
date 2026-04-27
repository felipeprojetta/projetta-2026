(() => {
  if (window.__MOD_131_V3_LOADED) return;
  window.__MOD_131_V3_LOADED = true;

  // ═══════════════════════════════════════════════════════════════
  // ESTRATEGIA: window._cambioOverride eh a fonte unica de verdade.
  // Setado pelo input do card. Quando setado, propagamos pra TODOS
  // os campos conhecidos (cambio-master-input, frete-calc-cambio,
  // inst-intl-cambio) e disparamos eventos pra forcar recalculo.
  // ═══════════════════════════════════════════════════════════════

  function whenReady(cb, attempts) {
    attempts = attempts || 0;
    if (window.projettaCambio) return cb();
    if (attempts > 50) return;
    setTimeout(function(){ whenReady(cb, attempts+1); }, 200);
  }

  // ── 1. Bloquear auto-fetch ────────────────────────────────────
  whenReady(function(){
    try {
      window.projettaCambio.refresh = async function(){};
      var origSet = window.projettaCambio.set;
      window.projettaCambio.set = function(valor, source){
        if (source && source !== 'manual') return false;
        return origSet.call(window.projettaCambio, valor, 'manual');
      };
      try {
        var raw = localStorage.getItem('projetta_cambio_master_v1');
        var s = raw ? JSON.parse(raw) : { valor: 5.20 };
        if (s && s.valor > 0) {
          s.source = 'manual';
          localStorage.setItem('projetta_cambio_master_v1', JSON.stringify(s));
        }
      } catch(e){}
      console.log('[mod 131 v3] manual only ATIVADO — atual: ' + window.projettaCambio.get());
    } catch(e){}
  });

  // ── 2. Funcao MASTER de propagacao ─────────────────────────────
  function propagarCambio(valor) {
    if (!isFinite(valor) || valor <= 0) return;

    // 2.1 Atualiza projettaCambio (que faz alguns side-effects)
    if (window.projettaCambio) {
      try { window.projettaCambio.set(valor, 'manual'); } catch(e){}
    }

    // 2.2 Atualiza TODOS os campos conhecidos com dispatchEvent
    ['cambio-master-input', 'frete-calc-cambio', 'inst-intl-cambio'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) {
        el.value = valor.toFixed(4);
        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch(e){}
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
        try { el.dispatchEvent(new Event('blur', { bubbles: true })); } catch(e){}
      }
    });

    // 2.3 Invocar funcoes de recalculo conhecidas
    ['crmCifRecalc', 'crmCifRecalcBRL', 'calc', 'crmRender', 'recomputeAndRender', 'calcAll'].forEach(function(fn){
      if (typeof window[fn] === 'function') {
        try { window[fn](); } catch(e){}
      }
    });

    console.log('[mod 131 v3] cambio propagado: ' + valor);
  }

  // ── 3. CRIAR campo dentro do modal CRM ─────────────────────────
  function injetarCampoCambio() {
    if (document.getElementById('mod131-cambio-card')) return;
    var titulo = document.getElementById('crm-cif-box-title');
    if (!titulo) return;
    var painel = titulo.parentNode;
    if (!painel) return;

    var atual = window.projettaCambio ? window.projettaCambio.get() : 5.20;

    var bloco = document.createElement('div');
    bloco.style.cssText = 'background:#fff8dc;border:2px solid #d35400;border-radius:8px;padding:10px 12px;margin-bottom:10px';
    bloco.innerHTML =
      '<div style="font-size:11px;font-weight:700;color:#7a3e00;margin-bottom:4px">💵 CAMBIO USD/BRL — DIGITE MANUALMENTE</div>' +
      '<div style="font-size:10px;color:#7a3e00;margin-bottom:8px;font-style:italic;line-height:1.4">Esse valor vai pra Orcamento, Frete, Caixa e todos os outros lugares.</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<label style="font-size:11px;font-weight:700;color:#003144">R$</label>' +
        '<input type="number" id="mod131-cambio-card" min="0" step="0.0001" style="flex:1;max-width:140px;padding:6px 8px;border:2px solid #d35400;border-radius:6px;font-weight:700;font-size:14px;background:#fff;color:#003144" value="' + atual.toFixed(4) + '">' +
        '<span style="font-size:11px;color:#666">por US$ 1.00</span>' +
        '<span id="mod131-status" style="font-size:10px;color:#27ae60;font-weight:700;margin-left:8px"></span>' +
      '</div>';
    painel.insertBefore(bloco, titulo);

    var inp = document.getElementById('mod131-cambio-card');
    var status = document.getElementById('mod131-status');

    var propagar = function(){
      var v = parseFloat(String(inp.value || '').replace(',', '.'));
      if (!isFinite(v) || v <= 0) return;
      propagarCambio(v);
      if (status) {
        status.textContent = '✓ aplicado';
        setTimeout(function(){ if(status) status.textContent = ''; }, 2000);
      }
    };
    inp.addEventListener('change', propagar);
    inp.addEventListener('blur', propagar);
    inp.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });

    console.log('[mod 131 v3] campo cambio injetado no modal');
  }

  // ── 4. Hook em crmCifRecalc — antes de rodar, sincroniza inst-intl-cambio ──
  function hookCifRecalc() {
    if (typeof window.crmCifRecalc !== 'function') return false;
    if (window.crmCifRecalc.__mod131v3) return true;
    var orig = window.crmCifRecalc;
    window.crmCifRecalc = function() {
      // Antes de calcular, garante que inst-intl-cambio reflete o valor master
      try {
        var v = window.projettaCambio ? window.projettaCambio.get() : null;
        var inputCard = document.getElementById('mod131-cambio-card');
        if (inputCard && inputCard.value) {
          var vCard = parseFloat(String(inputCard.value).replace(',', '.'));
          if (isFinite(vCard) && vCard > 0) v = vCard;
        }
        if (v) {
          var intl = document.getElementById('inst-intl-cambio');
          if (intl) intl.value = v.toFixed(4);
        }
      } catch(e){}
      return orig.apply(this, arguments);
    };
    window.crmCifRecalc.__mod131v3 = true;
    console.log('[mod 131 v3] crmCifRecalc hooked');
    return true;
  }

  // Tentar instalar hook + injetar campo periodicamente
  setInterval(function(){
    injetarCampoCambio();
    hookCifRecalc();
  }, 1500);
  setTimeout(injetarCampoCambio, 500);
  setTimeout(hookCifRecalc, 500);

  // Esconder UI de media 30d se existir
  setInterval(function(){
    ['cambio-master-media', 'cambio-master-extra', 'cambio-master-usar-media', 'cambio-master-refresh'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }, 2000);

  console.log('[mod 131 v3] carregado — propaga cambio por TODOS os campos conhecidos');
})();
