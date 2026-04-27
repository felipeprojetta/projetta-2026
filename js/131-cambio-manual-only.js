(() => {
  // Recarrega pra forçar substituir mod 131 antigo
  if (window.__MOD_131_V2_LOADED) return;
  window.__MOD_131_V2_LOADED = true;

  // ── 1. Bloqueia auto-fetch + força manual-only ────────────────
  function whenReady(cb, attempts) {
    attempts = attempts || 0;
    if (window.projettaCambio) return cb();
    if (attempts > 50) return;
    setTimeout(function(){ whenReady(cb, attempts+1); }, 200);
  }
  whenReady(function(){
    try {
      window.projettaCambio.refresh = async function(){
        console.log('[mod 131 v2] refresh ignorado — manual only');
      };
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
      console.log('[mod 131 v2] manual only ATIVADO — atual: ' + window.projettaCambio.get());
    } catch(e) { console.warn('[mod 131 v2]', e); }
  });

  // ── 2. CRIAR campo de input dentro do modal Editar Oportunidade ─
  function injetarCampoCambio() {
    // Evita duplicar
    if (document.getElementById('mod131-cambio-card')) return;

    // Painel CIF tem id crm-cif-box-title
    var titulo = document.getElementById('crm-cif-box-title');
    if (!titulo) return;

    // O painel CIF eh o pai (.parentNode do titulo)
    var painel = titulo.parentNode;
    if (!painel) return;

    var atual = window.projettaCambio ? window.projettaCambio.get() : 5.20;

    // Bloco do cambio — vai ANTES do titulo do painel CIF
    var bloco = document.createElement('div');
    bloco.style.cssText = 'background:#fff8dc;border:2px solid #d35400;border-radius:8px;padding:10px 12px;margin-bottom:10px';
    bloco.innerHTML =
      '<div style="font-size:11px;font-weight:700;color:#7a3e00;margin-bottom:4px">💵 CAMBIO USD/BRL — DIGITE MANUALMENTE</div>' +
      '<div style="font-size:10px;color:#7a3e00;margin-bottom:8px;font-style:italic;line-height:1.4">Esse valor vai pra Orcamento, Frete, Caixa e todos os outros lugares.</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<label style="font-size:11px;font-weight:700;color:#003144">R$</label>' +
        '<input type="number" id="mod131-cambio-card" min="0" step="0.0001" style="flex:1;max-width:140px;padding:6px 8px;border:2px solid #d35400;border-radius:6px;font-weight:700;font-size:14px;background:#fff;color:#003144" value="' + atual.toFixed(4) + '">' +
        '<span style="font-size:11px;color:#666">por US$ 1.00</span>' +
      '</div>';

    // Insere antes do titulo do painel CIF
    painel.insertBefore(bloco, titulo);

    // Hook de change
    var inp = document.getElementById('mod131-cambio-card');
    var propagar = function(){
      var v = parseFloat(String(inp.value || '').replace(',', '.'));
      if (!isFinite(v) || v <= 0) return;
      if (window.projettaCambio) {
        window.projettaCambio.set(v, 'manual');
      }
      // Atualiza inst-intl-cambio (se existir) pra re-render dos calculos do CRM
      var intl = document.getElementById('inst-intl-cambio');
      if (intl) {
        intl.value = v.toFixed(4);
        intl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Re-disparar calculo CIF (mostra "câmbio X.XX" embaixo)
      if (typeof window.crmCifRecalc === 'function') {
        try { window.crmCifRecalc(); } catch(e){}
      }
      console.log('[mod 131 v2] cambio do card propagado: ' + v);
    };
    inp.addEventListener('change', propagar);
    inp.addEventListener('blur', propagar);
    inp.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });

    console.log('[mod 131 v2] campo cambio injetado no modal CRM');
  }

  // Polling a cada 1.5s pra detectar quando modal abre
  setInterval(injetarCampoCambio, 1500);
  setTimeout(injetarCampoCambio, 500);

  // ── 3. Esconder UI de "media 30d" se existir ──
  function esconderMedia() {
    ['cambio-master-media', 'cambio-master-extra', 'cambio-master-usar-media', 'cambio-master-refresh'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
  setInterval(esconderMedia, 2000);

  console.log('[mod 131 v2] carregado — cria input cambio dentro do modal CRM');
})();
