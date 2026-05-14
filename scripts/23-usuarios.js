/* 23-usuarios.js — Cadastros > Usuarios.
   Gerenciamento de usuarios do sistema.
   Acesso APENAS para admin (felipe.projetta). Demais veem
   "Acesso negado" e a aba eh ocultada do sub-nav. */

/* ============================================================
   Cadastros > Usuarios — gerenciamento de usuarios do sistema.
   Acesso APENAS para admin (felipe.projetta). Demais veem
   "Acesso negado" e a aba eh ocultada do sub-nav.
   ============================================================ */
const UsuariosCadastro = (() => {
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render(container) {
    // Guard: somente admin
    if (!Auth.isAdmin()) {
      container.innerHTML = `
        <div class="usr-noaccess">
          <div class="icon-big">🔒</div>
          <span class="t-strong">Acesso negado</span>
          <p>Apenas administradores podem gerenciar usuarios do sistema.</p>
        </div>
      `;
      return;
    }

    const users = Auth.listUsers();
    const session = Auth.currentUser();

    const rows = users.map(u => {
      const isYou = session && session.username === u.username;
      const tags = [];
      if (u.role === 'admin') tags.push('<span class="usr-tag usr-tag-admin">ADMIN</span>');
      if (isYou) tags.push('<span class="usr-tag usr-tag-you">VOCÊ</span>');
      const cadastro = u.fixed
        ? `<span class="usr-fixed-label">Fixo</span>`
        : escapeHtml(u.createdAt || '—');
      const deleteBtn = u.fixed
        ? '<span class="row-delete-placeholder" aria-hidden="true"></span>'
        : `<button class="row-delete" data-action="delete-user" data-username="${escapeHtml(u.username)}" title="Excluir usuario">×</button>`;
      return `
        <tr data-username="${escapeHtml(u.username)}">
          <td>
            <span class="t-strong">${escapeHtml(u.username)}</span>${tags.join('')}
          </td>
          <td>
            <!-- Felipe sessao 18: SEGURANCA - senha agora e' hash,
                 nao tem texto puro pra mostrar. Botao 👁 removido
                 (impossivel desfazer hash). Pra trocar usar 'Alterar Senha'. -->
            <span class="usr-pwd-cell">
              <span class="usr-pwd-text" style="opacity:.5;font-style:italic;">••••••</span>
            </span>
          </td>
          <td>${cadastro}</td>
          <td class="actions" onclick="event.stopPropagation();">
            <button type="button" class="usr-btn-alterar" data-action="alterar-senha" data-username="${escapeHtml(u.username)}">🔑 Alterar Senha</button>
            ${deleteBtn}
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div class="cad-add-form">
        <h4>+ Adicionar novo usuario</h4>
        <div class="cad-add-grid" style="grid-template-columns: 260px 200px auto; gap: 16px; align-items: end; max-width: fit-content;">
          <div>
            <div class="cad-param-label">Nome do usuario</div>
            <input id="usr-add-username" class="cad-input" type="text" placeholder="" autocomplete="off" />
          </div>
          <div>
            <div class="cad-param-label">Senha</div>
            <input id="usr-add-password" class="cad-input" type="text" placeholder="Senha" autocomplete="off" />
          </div>
          <button type="button" class="btn btn-primary btn-sm" id="usr-btn-add" style="height:34px;">+ Adicionar</button>
        </div>
      </div>
      <div class="cad-table-wrap">
        <table class="cad-table usr-table">
          <thead>
            <tr>
              <th style="min-width: 260px;">Usuario</th>
              <th style="min-width: 200px;" data-no-sort="1" data-no-filter="1">Senha</th>
              <th style="min-width: 160px;">Cadastrado em</th>
              <th style="min-width: 240px; width: 240px;" class="actions" data-no-sort="1" data-no-filter="1"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    bindEvents(container);
  }

  function bindEvents(container) {
    // Adicionar usuario
    const btnAdd = container.querySelector('#usr-btn-add');
    if (btnAdd) {
      btnAdd.addEventListener('click', async () => {
        const u = (container.querySelector('#usr-add-username')?.value || '').trim();
        const p = (container.querySelector('#usr-add-password')?.value || '').trim();
        if (!u || !p) { alert('Preencha o nome do usuario e a senha.'); return; }
        // Felipe sessao 18: Auth.addUser agora e' async (faz hash)
        const r = await Auth.addUser({ username: u, password: p, name: u, role: 'user' });
        if (!r.ok) { alert(r.error); return; }
        render(container);
        if (window.showSavedDialog) window.showSavedDialog('Usuario adicionado com sucesso!');
      });
    }

    // Felipe sessao 18: botao toggle senha removido (senha agora e hash,
    // nao tem texto puro pra mostrar). Handlers data-action="toggle-pwd"
    // ainda existem em alguns lugares antigos mas nao tem efeito.

    // Alterar senha (inline)
    container.querySelectorAll('[data-action="alterar-senha"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const username = btn.dataset.username;
        const tr = btn.closest('tr');
        const tdSenha = tr ? tr.children[1] : null;
        if (!tdSenha) return;
        // Felipe sessao 18: input comeca VAZIO (senha antiga e' hash,
        // nao pode ser preenchida). Usuario digita a nova senha desejada.
        tdSenha.innerHTML = `
          <span class="usr-pwd-cell">
            <input type="password" class="cad-input" data-pwd-input placeholder="Nova senha" style="width:160px;" autocomplete="new-password" />
            <button type="button" class="btn btn-primary btn-sm" data-action="save-pwd" data-username="${escapeHtml(username)}" style="height:30px;font-size:11px;padding:4px 10px;">Salvar</button>
            <button type="button" class="btn btn-sm" data-action="cancel-pwd" style="height:30px;font-size:11px;padding:4px 10px;">Cancelar</button>
          </span>
        `;
        const inp = tdSenha.querySelector('input[data-pwd-input]');
        if (inp) inp.focus();
        tdSenha.querySelector('[data-action="save-pwd"]')?.addEventListener('click', async () => {
          const newPwd = (inp?.value || '').trim();
          if (!newPwd) { alert('A nova senha nao pode ser vazia.'); return; }
          // Felipe sessao 18: Auth.changePassword agora e' async
          const r = await Auth.changePassword(username, newPwd);
          if (!r.ok) { alert(r.error); return; }
          render(container);
          if (window.showSavedDialog) window.showSavedDialog('Senha alterada com sucesso!');
        });
        tdSenha.querySelector('[data-action="cancel-pwd"]')?.addEventListener('click', () => {
          render(container);
        });
      });
    });

    // Excluir usuario
    container.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const username = btn.dataset.username;
        if (!confirm(`Excluir o usuario "${username}"?\n\nEsta acao NAO pode ser desfeita.`)) return;
        const r = Auth.removeUser(username);
        if (!r.ok) { alert(r.error); return; }
        render(container);
        if (window.showSavedDialog) window.showSavedDialog('Usuario excluido com sucesso!');
      });
    });

    // R12: sort+filtro universal por coluna (autocomplete via R14)
    const tbl = container.querySelector('.usr-table');
    if (tbl && window.Universal) window.Universal.autoEnhance(tbl, { skipCols: ['actions'] });
  }

  return { render };
})();
