(() => {
  if (window.__MOD_131_LOADED) return;
  window.__MOD_131_LOADED = true;

  // ── 1. Bloqueia o auto-fetch + força manual-only no projettaCambio ──
  function whenReady(cb, attempts) {
    attempts = attempts || 0;
    if (window.projettaCambio) return cb();
    if (attempts > 50) { console.warn('[mod 131] projettaCambio nao apareceu'); return; }
    setTimeout(function(){ whenReady(cb, attempts+1); }, 200);
  }

  whenReady(function(){
    try {
      // 1.1 Refresh vira no-op (nao busca media da API)
      window.projettaCambio.refresh = async function(){
        console.log('[mod 131] refresh ignorado — manual only');
      };

      // 1.2 set so aceita source='manual'
      var origSet = window.projettaCambio.set;
      window.projettaCambio.set = function(valor, source){
        if (source && source !== 'manual') {
          console.log('[mod 131] set ignorado, source=' + source);
          return false;
        }
        return origSet.call(window.projettaCambio, valor, 'manual');
      };

      // 1.3 Garante que localStorage marca como manual (assim o mod 92 nao sobrescreve com media no proximo load)
      try {
        var raw = localStorage.getItem('projetta_cambio_master_v1');
        var s = raw ? JSON.parse(raw) : { valor: 5.20 };
        if (s && s.valor > 0) {
          s.source = 'manual';
          localStorage.setItem('projetta_cambio_master_v1', JSON.stringify(s));
        }
      } catch(e){}

      console.log('[mod 131] projettaCambio bloqueado em manual-only — atual: ' + window.projettaCambio.get());
    } catch(e) {
      console.warn('[mod 131] erro:', e);
    }
  });

  // ── 2. UI: destacar o campo inst-intl-cambio no card CRM ──
  function realcarCampoCambio() {
    var inp = document.getElementById('inst-intl-cambio');
    if (!inp) return;
    if (inp.__mod131Estilizado) return;
    inp.__mod131Estilizado = true;

    // Estilo destaque
    inp.style.background = '#fff8dc';
    inp.style.border = '2px solid #d35400';
    inp.style.fontWeight = '700';
    inp.style.fontSize = '14px';
    inp.style.color = '#003144';

    // Legenda acima do campo (so adiciona uma vez)
    if (inp.parentNode && !inp.parentNode.querySelector('.mod131-legenda')) {
      var legenda = document.createElement('div');
      legenda.className = 'mod131-legenda';
      legenda.style.cssText = 'background:#fff3e0;border:1px solid #d35400;color:#7a3e00;padding:8px 10px;border-radius:6px;font-size:11px;margin-bottom:6px;line-height:1.4;font-weight:600';
      legenda.innerHTML = '⚠ <b>Cambio USD/BRL — DIGITE MANUALMENTE</b><br><span style="font-weight:400">Esse valor vai pra Orcamento, Frete, Caixa e todos os outros lugares.</span>';
      inp.parentNode.insertBefore(legenda, inp);
    }

    // Hook de change pra propagar via projettaCambio
    if (!inp.__mod131Hooked) {
      inp.__mod131Hooked = true;
      var propagar = function(){
        var v = parseFloat(String(inp.value || '').replace(',', '.'));
        if (isFinite(v) && v > 0 && window.projettaCambio) {
          window.projettaCambio.set(v, 'manual');
          console.log('[mod 131] cambio do card propagado: ' + v);
        }
      };
      inp.addEventListener('change', propagar);
      inp.addEventListener('blur', propagar);
      inp.addEventListener('keydown', function(e){
        if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      });
    }
  }

  // Polling pra pegar quando o modal abre
  setInterval(realcarCampoCambio, 1500);
  realcarCampoCambio();

  // ── 3. Esconder UI de "media 30d" se existir (esquecer media) ──
  function esconderMedia() {
    ['cambio-master-media', 'cambio-master-extra', 'cambio-master-usar-media', 'cambio-master-refresh'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        // Tambem esconder o pai se for um wrapper especifico
        var p = el.parentElement;
        if (p && (p.classList.contains('cambio-media-wrap') || p.classList.contains('cambio-extra'))) {
          p.style.display = 'none';
        }
      }
    });
  }
  setInterval(esconderMedia, 2000);

  console.log('[mod 131] carregado — manual only + UI destacada');
})();
