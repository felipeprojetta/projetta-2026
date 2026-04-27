(() => {
  if (window.__MOD_131_V5_LOADED) return;
  window.__MOD_131_V5_LOADED = true;

  function whenReady(cb, attempts) {
    attempts = attempts || 0;
    if (window.projettaCambio) return cb();
    if (attempts > 50) return;
    setTimeout(function(){ whenReady(cb, attempts+1); }, 200);
  }

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
    } catch(e){}
  });

  // Sincroniza dois campos do cambio: mod131 (visivel) <-> crm-o-inst-cambio (oculto, salvo)
  function sincCampos(valor) {
    var v = parseFloat(String(valor||'').replace(',', '.'));
    if (!isFinite(v) || v <= 0) return;

    var meu = document.getElementById('mod131-cambio-card');
    if (meu && meu.value != v.toFixed(4)) meu.value = v.toFixed(4);

    var oficial = document.getElementById('crm-o-inst-cambio');
    if (oficial && oficial.value != v.toFixed(4)) {
      oficial.value = v.toFixed(4);
      try { oficial.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
    }

    var intl = document.getElementById('inst-intl-cambio');
    if (intl && intl.value != v.toFixed(4)) {
      intl.value = v.toFixed(4);
      try { intl.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
    }

    var master = document.getElementById('cambio-master-input');
    if (master && master.value != v.toFixed(4)) master.value = v.toFixed(4);

    if (window.projettaCambio) {
      try { window.projettaCambio.set(v, 'manual'); } catch(e){}
    }

    // Recalcula tudo
    ['crmCifRecalc', 'calc', 'crmRender', 'populateProposta'].forEach(function(fn){
      if (typeof window[fn] === 'function') {
        try { window[fn](); } catch(e){}
      }
    });
  }

  function injetarCampoCambio() {
    if (document.getElementById('mod131-cambio-card')) return;
    var titulo = document.getElementById('crm-cif-box-title');
    if (!titulo) return;
    var painel = titulo.parentNode;
    if (!painel) return;

    var atual = window.projettaCambio ? window.projettaCambio.get() : 5.20;
    // Se ja tem crm-o-inst-cambio com valor, usa ele
    var oficial = document.getElementById('crm-o-inst-cambio');
    if (oficial && parseFloat(oficial.value) > 0) {
      atual = parseFloat(oficial.value);
    }

    var bloco = document.createElement('div');
    bloco.style.cssText = 'background:#fff8dc;border:2px solid #d35400;border-radius:8px;padding:10px 12px;margin-bottom:10px';
    bloco.innerHTML =
      '<div style="font-size:11px;font-weight:700;color:#7a3e00;margin-bottom:4px">💵 CAMBIO USD/BRL DESTE CARD</div>' +
      '<div style="font-size:10px;color:#7a3e00;margin-bottom:8px;font-style:italic;line-height:1.4">Esse valor fica salvo no card. Vai pra Orcamento, Frete, Proposta e Pipeline.</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<label style="font-size:11px;font-weight:700;color:#003144">R$</label>' +
        '<input type="number" id="mod131-cambio-card" min="0" step="0.0001" style="flex:1;max-width:140px;padding:6px 8px;border:2px solid #d35400;border-radius:6px;font-weight:700;font-size:14px;background:#fff;color:#003144" value="' + atual.toFixed(4) + '">' +
        '<span style="font-size:11px;color:#666">por US$ 1.00</span>' +
        '<span id="mod131-status" style="font-size:10px;color:#27ae60;font-weight:700;margin-left:8px"></span>' +
      '</div>';
    painel.insertBefore(bloco, titulo);

    var inp = document.getElementById('mod131-cambio-card');
    var status = document.getElementById('mod131-status');

    var onChange = function(){
      var v = parseFloat(String(inp.value||'').replace(',', '.'));
      if (!isFinite(v) || v <= 0) return;
      sincCampos(v);
      if (status) {
        status.textContent = '✓ aplicado · clique Salvar Alterações pra persistir';
        setTimeout(function(){ if(status) status.textContent = ''; }, 4000);
      }
    };
    inp.addEventListener('change', onChange);
    inp.addEventListener('blur', onChange);
    inp.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    });

    // Quando crm-o-inst-cambio mudar (ex: ao carregar card), refletir no nosso input
    if (oficial) {
      oficial.addEventListener('change', function(){
        var v = parseFloat(oficial.value);
        if (isFinite(v) && v > 0 && inp.value != v.toFixed(4)) {
          inp.value = v.toFixed(4);
        }
      });
    }
  }

  setInterval(injetarCampoCambio, 1500);
  setTimeout(injetarCampoCambio, 500);

  setInterval(function(){
    ['cambio-master-media', 'cambio-master-extra', 'cambio-master-usar-media', 'cambio-master-refresh'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }, 2000);

  console.log('[mod 131 v5] cambio sincroniza com crm-o-inst-cambio (salva ao clicar Salvar Alteracoes)');
})();
