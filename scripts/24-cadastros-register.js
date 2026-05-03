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
