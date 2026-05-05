/* 51-sync-indicator.js — Indicador visual de sync com Supabase
   ============================================================
   Felipe sessao 2026-08-02: depois que Felipe perdeu precos por sync
   inicial falhar, criamos esse indicador visual permanente no canto
   inferior direito da tela.

   Mostra status do sync com Supabase em tempo real:
   - 🟢 ONLINE: sync OK, sistema editavel
   - 🟡 PENDENTE: sync em andamento
   - 🔴 SOMENTE LEITURA: sync inicial falhou, edicoes bloqueadas
   - ⚪ OFFLINE: sem conexao

   Botao "↻ Sync" pra forcar sync manual a qualquer momento.

   Atualiza automaticamente via Database.onSyncStatusChange.
   ============================================================ */

(function() {
  'use strict';

  if (typeof window === 'undefined' || !window.Database) {
    console.warn('[SyncIndicator] Database nao disponivel');
    return;
  }

  let _el = null;     // pill principal
  let _menu = null;   // dropdown ao clicar
  let _menuVisible = false;

  function fmtTime(ts) {
    if (!ts) return 'nunca';
    var d = new Date(ts);
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    var s = String(d.getSeconds()).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function render() {
    if (!_el) {
      _el = document.createElement('div');
      _el.id = 'sync-indicator-pill';
      _el.style.cssText = [
        'position: fixed',
        'bottom: 16px',
        'right: 16px',
        'z-index: 9998',
        'padding: 8px 14px',
        'border-radius: 22px',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        'font-size: 12px',
        'font-weight: 700',
        'cursor: pointer',
        'box-shadow: 0 4px 12px rgba(0,0,0,0.15)',
        'transition: all 0.2s',
        'user-select: none',
        'display: flex',
        'align-items: center',
        'gap: 6px',
      ].join(';');
      _el.addEventListener('click', toggleMenu);
      document.body.appendChild(_el);
    }

    var status   = window.Database.getSyncStatus();
    var readOnly = window.Database.isReadOnly();

    if (readOnly) {
      // 🔴 SOMENTE LEITURA - perigoso, mostra grande e vermelho
      _el.style.background = '#dc2626';
      _el.style.color = '#fff';
      _el.style.border = '2px solid #991b1b';
      _el.innerHTML = '🔒 <span>SOMENTE LEITURA</span>';
      _el.title = 'Sistema em modo somente leitura - sync inicial com Supabase falhou.\nClique pra detalhes.';
    } else if (status.online) {
      // 🟢 OK
      _el.style.background = '#16a34a';
      _el.style.color = '#fff';
      _el.style.border = '2px solid #15803d';
      _el.innerHTML = '☁ <span>Sync OK · ' + fmtTime(status.lastSync) + '</span>';
      _el.title = 'Sistema sincronizado com a nuvem.\nUltimo sync: ' + new Date(status.lastSync).toLocaleString();
    } else {
      // ⚪ OFFLINE
      _el.style.background = '#f59e0b';
      _el.style.color = '#78350f';
      _el.style.border = '2px solid #d97706';
      _el.innerHTML = '⚠ <span>Offline</span>';
      _el.title = 'Sem conexao com Supabase.\nClique pra forcar sync.';
    }
  }

  function toggleMenu() {
    if (_menuVisible) { hideMenu(); return; }
    showMenu();
  }

  function showMenu() {
    if (!_menu) {
      _menu = document.createElement('div');
      _menu.id = 'sync-indicator-menu';
      _menu.style.cssText = [
        'position: fixed',
        'bottom: 60px',
        'right: 16px',
        'z-index: 9999',
        'background: #fff',
        'border: 1px solid #d1d5db',
        'border-radius: 12px',
        'box-shadow: 0 10px 40px rgba(0,0,0,0.15)',
        'padding: 16px',
        'min-width: 320px',
        'max-width: 400px',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        'font-size: 13px',
        'color: #1f2937',
      ].join(';');
      document.body.appendChild(_menu);
    }

    var status   = window.Database.getSyncStatus();
    var readOnly = window.Database.isReadOnly();

    var statusHtml;
    if (readOnly) {
      statusHtml = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:10px;">' +
        '<div style="font-weight:800;color:#991b1b;font-size:14px;margin-bottom:4px;">🔒 SOMENTE LEITURA</div>' +
        '<div style="font-size:12px;color:#7f1d1d;line-height:1.5;">' +
        'Sistema bloqueado pra edicao. Sync inicial com Supabase falhou.<br>' +
        '<b>Razao:</b> ' + (status.error || 'desconhecido') + '<br><br>' +
        'Suas tentativas de salvar serao bloqueadas pra proteger seus dados.' +
        '</div></div>';
    } else if (status.online) {
      statusHtml = '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:10px;">' +
        '<div style="font-weight:800;color:#15803d;font-size:14px;margin-bottom:4px;">☁ Conectado</div>' +
        '<div style="font-size:12px;color:#166534;line-height:1.5;">' +
        'Ultimo sync: <b>' + new Date(status.lastSync).toLocaleString('pt-BR') + '</b><br>' +
        'Edicoes salvas automaticamente na nuvem.' +
        '</div></div>';
    } else {
      statusHtml = '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:10px;">' +
        '<div style="font-weight:800;color:#b45309;font-size:14px;margin-bottom:4px;">⚠ Offline</div>' +
        '<div style="font-size:12px;color:#78350f;line-height:1.5;">' +
        'Sem conexao com Supabase.<br>' +
        '<b>Erro:</b> ' + (status.error || 'desconhecido') +
        '</div></div>';
    }

    _menu.innerHTML = statusHtml +
      '<button id="sync-force-btn" style="width:100%;background:#1e40af;color:#fff;border:none;padding:10px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;letter-spacing:0.3px;margin-bottom:8px;">↻ Forçar sync agora</button>' +
      '<button id="sync-reload-btn" style="width:100%;background:#fff;color:#374151;border:1px solid #d1d5db;padding:10px 14px;border-radius:8px;font-weight:600;cursor:pointer;font-size:13px;">🔄 Recarregar página</button>' +
      '<button id="sync-close-btn" style="width:100%;background:transparent;color:#6b7280;border:none;padding:6px;font-size:11px;cursor:pointer;margin-top:6px;">fechar</button>';

    _menu.querySelector('#sync-force-btn').addEventListener('click', async function() {
      var btn = _menu.querySelector('#sync-force-btn');
      btn.textContent = '↻ Sincronizando...';
      btn.disabled = true;
      try {
        var ok = await window.Database.syncFromCloud();
        if (ok) {
          btn.textContent = '✅ Sync OK';
          btn.style.background = '#16a34a';
          setTimeout(function() {
            hideMenu();
            render();
          }, 1500);
        } else {
          btn.textContent = '❌ Falhou - tente recarregar';
          btn.style.background = '#dc2626';
          btn.disabled = false;
        }
      } catch(e) {
        btn.textContent = '❌ Erro: ' + (e.message || 'desconhecido');
        btn.style.background = '#dc2626';
        btn.disabled = false;
      }
    });

    _menu.querySelector('#sync-reload-btn').addEventListener('click', function() {
      window.location.reload();
    });

    _menu.querySelector('#sync-close-btn').addEventListener('click', hideMenu);

    _menu.style.display = 'block';
    _menuVisible = true;
  }

  function hideMenu() {
    if (_menu) _menu.style.display = 'none';
    _menuVisible = false;
  }

  // Fecha menu ao clicar fora
  document.addEventListener('click', function(e) {
    if (!_menuVisible) return;
    if (e.target.closest('#sync-indicator-menu')) return;
    if (e.target.closest('#sync-indicator-pill')) return;
    hideMenu();
  });

  // Inicializa quando Database estiver pronto
  function init() {
    render();
    window.Database.onSyncStatusChange(function() { render(); });
    // Re-render a cada 30s pra atualizar texto "ha X minutos"
    setInterval(render, 30000);
  }

  // Aguarda DOM pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }
})();
