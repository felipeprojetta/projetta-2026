(() => {
  if (window.__MOD_129_V3_LOADED) return;
  window.__MOD_129_V3_LOADED = true;

  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var SUPA_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';

  // Versao "alvo" pra usar no PDF/proposta. Setada por reimprimir/aprovar.
  window._mod129VersaoAlvo = null;

  function setPropRev(versao) {
    var revEl = document.getElementById('prop-rev');
    if (!revEl || versao == null) return false;
    var v = String(versao);
    if (revEl.textContent !== v) {
      revEl.textContent = v;
      console.log('[mod 129 v3] prop-rev = V' + v);
    }
    return true;
  }

  async function getVersaoAtivaCard(cardId) {
    if (!cardId) return null;
    try {
      var url = SUPA_URL + '/rest/v1/versoes_aprovadas?card_id=eq.' + encodeURIComponent(cardId) + '&ativa=eq.true&order=versao.desc&limit=1&select=versao';
      var res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }});
      if (!res.ok) return null;
      var data = await res.json();
      if (data && data[0]) return data[0].versao;
    } catch(e) {}
    return null;
  }

  async function getVersaoPorId(id) {
    if (!id) return null;
    try {
      var url = SUPA_URL + '/rest/v1/versoes_aprovadas?id=eq.' + encodeURIComponent(id) + '&select=versao';
      var res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }});
      if (!res.ok) return null;
      var data = await res.json();
      if (data && data[0]) return data[0].versao;
    } catch(e) {}
    return null;
  }

  // ── HOOK 1: window.reimprimirVersao(id) — busca versao do banco
  function hookReimp() {
    if (typeof window.reimprimirVersao !== 'function') return false;
    if (window.reimprimirVersao.__mod129v3) return true;
    var orig = window.reimprimirVersao;
    window.reimprimirVersao = async function(id) {
      try {
        var ver = await getVersaoPorId(id);
        if (ver) {
          window._mod129VersaoAlvo = ver;
          console.log('[mod 129 v3] reimprimirVersao → V' + ver);
          // Tambem aplica imediatamente (caso prop-rev ja exista)
          setPropRev(ver);
          // E em multiplos timings durante a captura (5s)
          for (var i = 1; i <= 25; i++) {
            (function(v, delay){ setTimeout(function(){ setPropRev(v); }, delay); })(ver, i*200);
          }
        }
      } catch(e) { console.warn('[mod 129 v3] hookReimp:', e); }
      return orig.apply(this, arguments);
    };
    window.reimprimirVersao.__mod129v3 = true;
    console.log('[mod 129 v3] reimprimirVersao hooked');
    return true;
  }

  // ── HOOK 2: window.aprovarOrcamentoParaEnvio — busca versao ativa do banco
  function hookAprov() {
    if (typeof window.aprovarOrcamentoParaEnvio !== 'function') return false;
    if (window.aprovarOrcamentoParaEnvio.__mod129v3) return true;
    var orig = window.aprovarOrcamentoParaEnvio;
    window.aprovarOrcamentoParaEnvio = async function() {
      try {
        // Antes da aprovacao, busca proxima versao via RPC
        var cardId = window._crmOrcCardId;
        // Aplicar continuamente enquanto a aprovacao gera o PDF
        for (var i = 1; i <= 40; i++) {
          (function(delay){
            setTimeout(async function(){
              if (cardId) {
                var ver = await getVersaoAtivaCard(cardId);
                if (ver) {
                  window._mod129VersaoAlvo = ver;
                  setPropRev(ver);
                }
              }
            }, delay);
          })(i*250);
        }
      } catch(e) { console.warn('[mod 129 v3] hookAprov:', e); }
      return orig.apply(this, arguments);
    };
    window.aprovarOrcamentoParaEnvio.__mod129v3 = true;
    console.log('[mod 129 v3] aprovarOrcamentoParaEnvio hooked');
    return true;
  }

  // ── HOOK 3: window.populateProposta — depois dela rodar, aplica versao alvo
  function hookPop() {
    if (typeof window.populateProposta !== 'function') return false;
    if (window.populateProposta.__mod129v3) return true;
    var orig = window.populateProposta;
    window.populateProposta = function() {
      var ret = orig.apply(this, arguments);
      if (window._mod129VersaoAlvo) {
        setPropRev(window._mod129VersaoAlvo);
        // Reaplica mais 5x pra garantir que sobreviva a re-renders
        for (var i = 1; i <= 5; i++) {
          (function(v, delay){ setTimeout(function(){ setPropRev(v); }, delay); })(window._mod129VersaoAlvo, i*100);
        }
      }
      return ret;
    };
    window.populateProposta.__mod129v3 = true;
    console.log('[mod 129 v3] populateProposta hooked');
    return true;
  }

  // ── HOOK 4: html2canvas — antes de capturar .proposta-page, aplica versao
  function hookH2C() {
    if (typeof window.html2canvas !== 'function') return false;
    if (window.html2canvas.__mod129v3) return true;
    var orig = window.html2canvas;
    var wrapped = function(el, opts) {
      try {
        // Se esta capturando .proposta-page e tem versao alvo
        if (el && el.classList && el.classList.contains('proposta-page') && window._mod129VersaoAlvo) {
          setPropRev(window._mod129VersaoAlvo);
        }
      } catch(e) {}
      return orig.apply(this, arguments);
    };
    wrapped.__mod129v3 = true;
    // Copia outras props do html2canvas (se houver)
    for (var k in orig) { try { wrapped[k] = orig[k]; } catch(e){} }
    window.html2canvas = wrapped;
    console.log('[mod 129 v3] html2canvas hooked');
    return true;
  }

  // Tenta hooks a cada 200ms ate todos aplicados
  var attempts = 0;
  var hookT = setInterval(function() {
    attempts++;
    var a = hookReimp();
    var b = hookAprov();
    var c = hookPop();
    var d = hookH2C();
    if (a && b && c && d) {
      clearInterval(hookT);
      console.log('[mod 129 v3] TODOS os hooks instalados (em ' + (attempts*200) + 'ms)');
    } else if (attempts > 100) {
      // Para apos 20s
      clearInterval(hookT);
      console.warn('[mod 129 v3] Hooks parciais: reimp=' + a + ' aprov=' + b + ' pop=' + c + ' h2c=' + d);
    }
  }, 200);

  console.log('[mod 129 v3] carregado — hookando reimprimir/aprovar/populateProposta/html2canvas');
})();
