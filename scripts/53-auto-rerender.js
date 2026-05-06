/* 53-auto-rerender.js — Auto re-render quando outro usuario muda dados
   ====================================================================
   Felipe sessao 2026-08-02: 'a cada alteracao deve salvar atualizar
   automaticamente sem ter que apertar F5'.

   Como funciona:
   - Escuta o evento 'db:change' com remote:true (vem do realtime polling)
   - Identifica o modulo atualmente ativo na UI
   - Re-renderiza esse modulo + tabs internas (sem F5)
   - Mostra toast discreto: "🔄 Atualizado (outro usuario editou)"

   Mapeamento (chave do Supabase → modulo da UI):
     cadastros/acessorios_lista     → window.Acessorios.render
     cadastros/perfis_lista         → window.Perfis.render
     cadastros/modelos_lista        → window.Modelos.render
     cadastros/superficies_lista    → window.Superficies.render
     cadastros/representantes_lista → window.Representantes.render
     cadastros/regras_*             → window.Regras.render
     cadastros/precificacao_*       → window.Precificacao.render
     negocios                       → CRM + Orcamento renderem

   Princípio: ÚLTIMA versão sempre vence. Sem perguntar, sem mesclar.
   Felipe: "base e base, o ultimo que alterou alterou proximo que entrou
            pega ultima alteracao".
   ==================================================================== */

(function() {
  'use strict';

  if (typeof window === 'undefined' || !window.Events || !window.App) {
    return;
  }

  // Mapeamento chave → módulo do App (que é FLAT, não hierárquico).
  // Felipe sessao 12 (BUG FIX): antes tabPath era ['operacional','crm']
  // mas o App nao tem hierarquia 'operacional' — tem so 'crm', 'cadastros',
  // 'orcamento'. Como 'crm' !== 'operacional' a condicao falhava SEMPRE
  // e o auto-rerender nunca disparava (existia desde sessao 2026-08-02).
  // tabPath agora: [moduleId, tabIdOuNull].
  var MAPEAMENTO = [
    { match: /^cadastros\/acessorios_lista$/,         tabPath: ['cadastros', 'acessorios'],     label: 'Acessórios' },
    { match: /^cadastros\/perfis_lista$/,             tabPath: ['cadastros', 'perfis'],         label: 'Perfis' },
    { match: /^cadastros\/modelos_lista$/,            tabPath: ['cadastros', 'modelos'],        label: 'Modelos' },
    { match: /^cadastros\/superficies_lista$/,        tabPath: ['cadastros', 'superficies'],    label: 'Superfícies' },
    { match: /^cadastros\/representantes_lista$/,     tabPath: ['cadastros', 'representantes'], label: 'Representantes' },
    { match: /^cadastros\/cores_lista$/,              tabPath: ['cadastros', 'superficies'],    label: 'Cores' },
    { match: /^cadastros\/markups_lista$/,            tabPath: ['cadastros', 'regras'],         label: 'Markups' },
    { match: /^cadastros\/comissoes_lista$/,          tabPath: ['cadastros', 'representantes'], label: 'Comissões' },
    { match: /^cadastros\/regras_/,                   tabPath: ['cadastros', 'regras'],         label: 'Regras' },
    { match: /^cadastros\/rendimentos_/,              tabPath: ['cadastros', 'regras'],         label: 'Rendimentos' },
    { match: /^cadastros\/precificacao_/,             tabPath: ['cadastros', 'regras'],         label: 'Precificação' },
    { match: /^cadastros\/fechaduras_lista$/,         tabPath: ['cadastros', 'acessorios'],     label: 'Fechaduras' },
    { match: /^cadastros\/puxadores_lista$/,          tabPath: ['cadastros', 'acessorios'],     label: 'Puxadores' },
    { match: /^cadastros\/vidros_lista$/,             tabPath: ['cadastros', 'superficies'],    label: 'Vidros' },
    { match: /^cadastros\/mensagens_templates$/,      tabPath: ['cadastros', 'mensagens'],      label: 'Mensagens' },
    { match: /^auth\/users$/,                         tabPath: ['cadastros', 'usuarios'],       label: 'Usuários' },
    { match: /^crm\/leads$/,                          tabPath: ['crm', null],                   label: 'CRM' },
    { match: /^crm\/view$/,                           tabPath: ['crm', null],                   label: 'CRM (visão)' },
    { match: /^clientes\/clientes_independentes$/,    tabPath: ['clientes', null],              label: 'Clientes' },
    { match: /^orcamentos\/negocios$/,                tabPath: ['orcamento', null],             label: 'Orçamentos' },
  ];

  // Toast helper - cria/reusa elemento no canto superior direito
  var _toastEl = null;
  var _toastTimer = null;
  function showToast(msg, kind) {
    kind = kind || 'info';
    if (!_toastEl) {
      _toastEl = document.createElement('div');
      _toastEl.id = 'auto-rerender-toast';
      _toastEl.style.cssText = [
        'position: fixed',
        'top: 16px',
        'right: 16px',
        'z-index: 10000',
        'padding: 10px 16px',
        'border-radius: 8px',
        'font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        'font-size: 13px',
        'font-weight: 600',
        'box-shadow: 0 6px 20px rgba(0,0,0,0.15)',
        'transition: opacity 0.3s, transform 0.3s',
        'pointer-events: none',
        'max-width: 360px',
      ].join(';');
      document.body.appendChild(_toastEl);
    }
    var bg = kind === 'success' ? '#16a34a'
           : kind === 'warn'    ? '#f59e0b'
           : '#1e40af';
    _toastEl.style.background = bg;
    _toastEl.style.color = '#fff';
    _toastEl.textContent = msg;
    _toastEl.style.opacity = '1';
    _toastEl.style.transform = 'translateY(0)';
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function() {
      _toastEl.style.opacity = '0';
      _toastEl.style.transform = 'translateY(-8px)';
    }, 3500);
  }

  // Detecta qual modulo/tab esta ativo agora
  function getActiveModuleAndTab() {
    try {
      var moduloAtivo = (window.App.state && window.App.state.currentModule) || null;
      var tabAtiva    = (window.App.state && window.App.state.currentTab)    || null;
      return { modulo: moduloAtivo, tab: tabAtiva };
    } catch(_) {
      return { modulo: null, tab: null };
    }
  }

  // Re-renderiza modulo ativo - chama navigateTo na mesma posicao pra
  // forcar re-render do conteudo sem mudar de aba
  function reRenderActive() {
    try {
      var atual = getActiveModuleAndTab();
      if (!atual.modulo) return false;
      // navigateTo re-renderiza o container do modulo
      window.App.navigateTo(atual.modulo, atual.tab);
      return true;
    } catch(e) {
      console.warn('[AutoRerender] Falha ao re-renderizar:', e.message);
      return false;
    }
  }

  // Encontra entry do mapeamento que casa com 'scope/key'
  function findMatch(scope, key) {
    var combo = scope + '/' + key;
    for (var i = 0; i < MAPEAMENTO.length; i++) {
      if (MAPEAMENTO[i].match.test(combo)) return MAPEAMENTO[i];
    }
    return null;
  }

  // Decisao de re-render: se a chave alterada bate com o modulo
  // ATUALMENTE ATIVO, re-renderiza. Senao, so' atualiza localStorage
  // (que ja' foi feito pelo realtime polling) e o usuario vai ver
  // quando navegar pra essa tela.
  function handleRemoteChange(payload) {
    if (!payload || !payload.remote) return; // so' processa eventos remotos

    var entry = findMatch(payload.scope, payload.key);
    if (!entry) return; // chave nao mapeada (ex: backup_diario)

    var atual = getActiveModuleAndTab();
    var [moduloEsperado, tabEsperada] = entry.tabPath;

    // Se o usuario esta NA tela que mudou, re-renderiza
    if (atual.modulo === moduloEsperado &&
        (atual.tab === tabEsperada || tabEsperada === null)) {
      console.log('[AutoRerender] 🔄 ' + entry.label + ' atualizado por outro usuario - re-renderizando');
      var ok = reRenderActive();
      if (ok) {
        showToast('🔄 ' + entry.label + ' atualizado (outro usuário editou)', 'info');
      }
    } else {
      // Usuario esta em outra tela - so' atualiza localStorage (ja' feito)
      // e mostra toast discreto pra ele saber
      console.log('[AutoRerender] ☁ ' + entry.label + ' atualizado em background (usuario nao esta vendo)');
    }
  }

  // Bulk handler: quando vem multiplas mudancas juntas (db:realtime-sync),
  // re-renderiza no max 1 vez (nao N vezes seguidas).
  var _pendingRender = null;
  function scheduleRerender() {
    if (_pendingRender) clearTimeout(_pendingRender);
    _pendingRender = setTimeout(function() {
      _pendingRender = null;
      reRenderActive();
    }, 200); // debounce 200ms
  }

  // Listeners
  Events.on('db:change', handleRemoteChange);

  // Tambem escuta o realtime sync (quando vem batch de mudancas)
  Events.on('db:realtime-sync', function(payload) {
    if (!payload || !payload.chaves) return;
    // Se ALGUMA das chaves bate com tela ativa, re-renderiza 1x
    var atual = getActiveModuleAndTab();
    var temMatch = payload.chaves.some(function(combo) {
      var parts = combo.split('/');
      var entry = findMatch(parts[0], parts[1]);
      if (!entry) return false;
      var [m, t] = entry.tabPath;
      return atual.modulo === m && (atual.tab === t || t === null);
    });
    if (temMatch) {
      scheduleRerender();
      var qtd = payload.count || payload.chaves.length;
      showToast('🔄 ' + qtd + ' alteração' + (qtd > 1 ? 'ões' : '') + ' do servidor aplicadas', 'info');
    }
  });

  // API pra debug
  window.AutoRerender = {
    reRenderActive: reRenderActive,
    getActive: getActiveModuleAndTab,
    showToast: showToast,
  };

  console.log('[AutoRerender] ✅ Listener instalado');
})();
