/* 55-version-check.js — Detecta deploy novo enquanto aba esta aberta
   ====================================================================
   Felipe sessao 2026-08-02 V3: 'sistema online tem que puxar do
   servidor toda hora'.

   Como funciona:
   - A cada 60s, faz HEAD em /index.html
   - Compara o ETag/Last-Modified com o que carregou no boot
   - Se mudou: deploy novo aconteceu - mostra banner discreto pedindo
     pra recarregar
   - User clica no banner → window.location.reload(true) → puxa tudo
     novo do servidor

   Isso resolve o caso onde Felipe push novo codigo enquanto Thays
   ja' esta com a aba aberta. Antes ela continuava com versao velha
   ate' fechar. Agora o sistema avisa em ate' 1min e ela recarrega.
   ==================================================================== */

(function() {
  'use strict';

  // Pega ETag inicial
  var _etagInicial = null;
  var _checkTimer = null;
  var _bannerEl = null;

  async function pegarEtag() {
    try {
      var r = await fetch('/index.html', { method: 'HEAD', cache: 'no-store' });
      return r.headers.get('etag') || r.headers.get('last-modified') || '';
    } catch(_) {
      return null;
    }
  }

  function mostrarBannerNovaVersao() {
    if (_bannerEl) return;
    _bannerEl = document.createElement('div');
    _bannerEl.style.cssText = [
      'position: fixed',
      'top: 16px',
      'left: 50%',
      'transform: translateX(-50%)',
      'z-index: 10001',
      'background: linear-gradient(180deg, #1e40af 0%, #1e3a8a 100%)',
      'color: #fff',
      'padding: 12px 20px',
      'border-radius: 10px',
      'box-shadow: 0 8px 24px rgba(30,64,175,0.35)',
      'font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      'font-size: 13px',
      'font-weight: 600',
      'cursor: pointer',
      'display: flex',
      'align-items: center',
      'gap: 12px',
      'max-width: 92vw',
    ].join(';');
    _bannerEl.innerHTML =
      '<span style="font-size:18px;">🔄</span>' +
      '<div>' +
      '<div style="font-weight:800;letter-spacing:0.3px;">Nova versao disponivel</div>' +
      '<div style="font-size:11px;opacity:0.85;font-weight:400;">Clique aqui pra atualizar (recarrega a pagina)</div>' +
      '</div>';
    _bannerEl.addEventListener('click', function() {
      // Forca reload sem cache
      window.location.reload();
    });
    document.body.appendChild(_bannerEl);
    console.log('[VersionCheck] 🔔 Nova versao disponivel - banner mostrado');
  }

  async function checar() {
    var etagAtual = await pegarEtag();
    if (!etagAtual || !_etagInicial) return;
    if (etagAtual !== _etagInicial) {
      mostrarBannerNovaVersao();
      // Para de checar - banner ja' apareceu
      if (_checkTimer) clearInterval(_checkTimer);
    }
  }

  async function init() {
    _etagInicial = await pegarEtag();
    if (!_etagInicial) {
      console.warn('[VersionCheck] Nao consegui pegar ETag inicial - check desabilitado');
      return;
    }
    console.log('[VersionCheck] Monitorando versao do servidor (ETag inicial: ' + _etagInicial.substring(0, 30) + '...)');
    // Checa a cada 60 segundos
    _checkTimer = setInterval(checar, 60000);
    // Tambem checa quando aba volta ao foco (notebook acordou de sleep)
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') checar();
    });
    window.addEventListener('focus', checar);
  }

  // Aguarda boot terminar pra nao concorrer com sync inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 8000);
    });
  } else {
    setTimeout(init, 8000);
  }
})();
