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

  // Felipe sessao 12: detecta se ha modal/dialog aberto. Se houver, o
  // re-render do modulo (que troca o DOM do container) FECHA o modal -
  // foi exatamente o problema que Felipe relatou: "card esta fechando
  // sozinho". A fix `feb9e28` fez o auto-rerender funcionar pela 1a
  // vez desde sessao 2026-08, expondo este efeito colateral.
  function temModalAberto() {
    try {
      // CRM modal (Editar/Criar Lead)
      var crmMount = document.querySelector('#crm-modal-mount');
      if (crmMount && crmMount.children && crmMount.children.length > 0) return true;
      // Modal Abrir Orcamento (47-orc-docs.js)
      var orcDocs = document.querySelector('.orcdocs-modal-overlay');
      if (orcDocs && orcDocs.offsetParent !== null) return true;
      // Generic ARIA dialog visivel
      var dialogs = document.querySelectorAll('[role="dialog"]');
      for (var i = 0; i < dialogs.length; i++) {
        if (dialogs[i].offsetParent !== null) return true;
      }
    } catch(_) {}
    return false;
  }

  // Re-render adiado: agenda verificacao a cada 500ms ate o modal
  // fechar, entao aplica. Sem leak — para o interval quando aplica.
  var _pendingRemoteRender = false;
  var _modalWatcher = null;
  function aguardarModalFechar() {
    if (_modalWatcher) return;
    _modalWatcher = setInterval(function() {
      if (!_pendingRemoteRender) {
        clearInterval(_modalWatcher);
        _modalWatcher = null;
        return;
      }
      if (!temModalAberto()) {
        _pendingRemoteRender = false;
        clearInterval(_modalWatcher);
        _modalWatcher = null;
        console.log('[AutoRerender] ▶ Modal fechado — aplicando re-render adiado');
        var ok = reRenderActive();
        if (ok) showToast('🔄 Atualizado (mudanças aplicadas)', 'info');
      }
    }, 500);
  }

  // Encontra entry do mapeamento que casa com 'scope/key'
  function findMatch(scope, key) {
    var combo = scope + '/' + key;
    for (var i = 0; i < MAPEAMENTO.length; i++) {
      if (MAPEAMENTO[i].match.test(combo)) return MAPEAMENTO[i];
    }
    return null;
  }

  // Felipe sessao 13: cadastros que AFETAM o calculo do orcamento.
  // Quando QUALQUER um desses muda (ex: alguem importa planilha de
  // acessorios em outra aba), o orcamento ABERTO precisa recalcular —
  // senao ficaria com preco STALE em relacao ao cadastro atual.
  // Felipe: "no calculo se deve pegar valores que estao na aba de
  //          cadastro, como que em cadastro esta um valor e voce puxa
  //          outro quando esta calculando isso nao existe".
  var CADASTROS_QUE_AFETAM_ORCAMENTO = [
    /^cadastros\/acessorios_lista$/,
    /^cadastros\/perfis_lista$/,
    /^cadastros\/superficies_lista$/,
    /^cadastros\/modelos_lista$/,
    /^cadastros\/regras_/,
    /^cadastros\/rendimentos_/,
    /^cadastros\/precificacao_/,
    /^cadastros\/markups_lista$/,
  ];
  function afetaOrcamento(scope, key) {
    var combo = scope + '/' + key;
    return CADASTROS_QUE_AFETAM_ORCAMENTO.some(function(rx) { return rx.test(combo); });
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

    // Felipe sessao 13: se cadastro que AFETA orcamento mudou E o user
    // esta no orcamento agora, re-renderiza pra recalcular com os
    // novos precos do cadastro.
    if (atual.modulo === 'orcamento' && afetaOrcamento(payload.scope, payload.key)) {
      if (temModalAberto()) {
        _pendingRemoteRender = true;
        aguardarModalFechar();
        showToast('ℹ ' + entry.label + ' atualizado — feche o card pra atualizar', 'warn');
        return;
      }
      console.log('[AutoRerender] 🔄 ' + entry.label + ' mudou — recalculando orcamento aberto');
      var okOrc = reRenderActive();
      if (okOrc) showToast('🔄 Orçamento recalculado (' + entry.label + ' atualizado)', 'info');
      return;
    }

    // Se o usuario esta NA tela que mudou, re-renderiza
    if (atual.modulo === moduloEsperado &&
        (atual.tab === tabEsperada || tabEsperada === null)) {

      // Felipe sessao 12: NAO re-renderiza enquanto modal/card aberto
      // (fecharia o card que o usuario esta editando). Adia ate fechar.
      if (temModalAberto()) {
        _pendingRemoteRender = true;
        aguardarModalFechar();
        console.log('[AutoRerender] ⏸ ' + entry.label + ' atualizado mas modal aberto - postergando');
        showToast('ℹ ' + entry.label + ' atualizado — feche o card pra atualizar', 'warn');
        return;
      }

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
  // Felipe sessao 12: respeita modal aberto (mesma logica do single).
  var _pendingRender = null;
  function scheduleRerender() {
    if (_pendingRender) clearTimeout(_pendingRender);
    _pendingRender = setTimeout(function() {
      _pendingRender = null;
      if (temModalAberto()) {
        _pendingRemoteRender = true;
        aguardarModalFechar();
        return;
      }
      reRenderActive();
    }, 200); // debounce 200ms
  }

  // Listeners
  Events.on('db:change', handleRemoteChange);

  // Tambem escuta o realtime sync (quando vem batch de mudancas)
  Events.on('db:realtime-sync', function(payload) {
    if (!payload || !payload.chaves) return;
    var atual = getActiveModuleAndTab();
    // Felipe sessao 13: se user no orcamento E veio mudanca em cadastro
    // que afeta calculo, re-renderiza orcamento.
    if (atual.modulo === 'orcamento') {
      var afetou = payload.chaves.some(function(combo) {
        var parts = combo.split('/');
        return afetaOrcamento(parts[0], parts[1]);
      });
      if (afetou) {
        scheduleRerender();
        showToast('🔄 Cadastro atualizado — recalculando orçamento', 'info');
        return;
      }
    }
    // Se ALGUMA das chaves bate com tela ativa, re-renderiza 1x
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
