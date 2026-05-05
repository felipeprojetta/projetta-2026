/* 24-cadastros-register.js — registra o modulo Cadastros no App.
   Routing por aba: chama Perfis.render / Modelos.render / Representantes.render /
   UsuariosCadastro.render / Acessorios.render conforme a tab selecionada.
   Demais sub-abas (superficies, fretes, mensagens, permissoes)
   sao placeholders.

   IMPORTANTE: este arquivo precisa ser carregado DEPOIS de:
     - 20-perfis.js, 21-modelos.js, 22-representantes.js, 23-usuarios.js, 25-acessorios.js
   senao as referencias quebram. */

/* ============================================================
   Registra modulo no App
   ============================================================ */
App.register('cadastros', {
  render(container, tab) {
    if (tab === 'perfis') {
      Perfis.render(container);
      return;
    }
    if (tab === 'modelos') {
      Modelos.render(container);
      return;
    }
    if (tab === 'representantes') {
      Representantes.render(container);
      return;
    }
    if (tab === 'usuarios') {
      UsuariosCadastro.render(container);
      return;
    }
    if (tab === 'acessorios') {
      Acessorios.render(container);
      return;
    }
    if (tab === 'superficies') {
      Superficies.render(container);
      return;
    }
    if (tab === 'regras') {
      if (typeof Regras !== 'undefined') {
        Regras.render(container);
      } else {
        container.innerHTML = '<div class="info-banner">Modulo Regras nao carregado.</div>';
      }
      return;
    }
    if (tab === 'precificacao') {
      if (typeof Precificacao !== 'undefined') {
        Precificacao.render(container);
      } else {
        container.innerHTML = '<div class="info-banner">Modulo Precificacao nao carregado.</div>';
      }
      return;
    }
    if (tab === 'filtros') {
      if (typeof Filtros !== 'undefined') {
        Filtros.render(container);
      } else {
        container.innerHTML = '<div class="info-banner">Modulo Filtros nao carregado.</div>';
      }
      return;
    }
    // Felipe sessao 2026-08: aba Mensagens implementada (templates de
    // WhatsApp e Email pra cliente/representante).
    if (tab === 'mensagens') {
      if (typeof Mensagens !== 'undefined') {
        Mensagens.render(container);
      } else {
        container.innerHTML = '<div class="info-banner">Modulo Mensagens nao carregado.</div>';
      }
      return;
    }
    // Felipe sessao 2026-08-02 V2: aba Permissoes com retry
    // Modulo carrega via 54-permissoes.js. Em caso de cache do browser,
    // pode tardar uns ms. Por isso, tentamos render com fallback de retry.
    if (tab === 'permissoes') {
      function tentarRender(tentativa) {
        if (typeof window.Permissoes !== 'undefined' && window.Permissoes.render) {
          window.Permissoes.render(container);
          return;
        }
        if (tentativa < 5) {
          // Retry em 200ms (ate' 5 tentativas = 1 segundo total)
          setTimeout(function() { tentarRender(tentativa + 1); }, 200);
          return;
        }
        // Falhou apos 5 tentativas - mostra mensagem util
        container.innerHTML = '<div class="info-banner" style="background:#fef2f2;border-color:#fecaca;color:#991b1b;">' +
          '<b>Modulo Permissoes nao carregou.</b><br>' +
          'Aperte <kbd style="background:#fff;padding:2px 6px;border:1px solid #ccc;border-radius:3px;">Ctrl + Shift + R</kbd> ' +
          'pra recarregar limpando cache. Se persistir, abra o F12 > Console e me mande o erro.' +
          '</div>';
      }
      tentarRender(0);
      return;
    }
    // Demais sub-abas ainda nao implementadas
    const labelMap = {
      acessorios: 'Acessorios', superficies: 'Superficies',
      fretes: 'Frete Internacional',
      mensagens: 'Mensagens', usuarios: 'Usuarios', permissoes: 'Permissoes',
    };
    const label = labelMap[tab] || tab;
    container.innerHTML = `
      <div class="info-banner">
        <span class="t-strong">Aba "${label.toLowerCase()}":</span> sera implementada em breve. O banco de dados ja esta preparado e isolado nas demais abas.
      </div>
      <div class="placeholder">
        <div class="icon-big">⚙️</div>
        <h3>Em construcao</h3>
        <p>Modulo Cadastros — aba <span class="t-strong">${tab}</span></p>
      </div>
    `;
  }
});
