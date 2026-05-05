/* 05-auth.js — Auth (sessao + lista de usuarios).
   Usuarios fixos por enquanto (felipe.projetta admin, thays + andressa user).
   Quando Supabase entrar, substituido por Supabase Auth. */

/* ============================================================
   AUTH — gerenciamento de sessao
   ============================================================ */
const Auth = (() => {
  const store = Storage.scope('auth');

  function nowDateBR() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  // Lista de usuarios padrao do sistema. felipe.projetta eh admin
  // e fixo (nao pode ser excluido).
  function defaultUsers() {
    return [
      { username: 'felipe.projetta',   password: '12345', name: 'Felipe',   role: 'admin', fixed: true,  createdAt: 'Fixo' },
      { username: 'thays.projetta',    password: '12345', name: 'Thays',    role: 'user',  fixed: false, createdAt: nowDateBR() },
      { username: 'andressa.projetta', password: '12345', name: 'Andressa', role: 'user',  fixed: false, createdAt: nowDateBR() },
    ];
  }

  function ensureDefaultUsers() {
    // Migracao 1x: substitui o admin/admin antigo (ou lista vazia)
    // pela lista real de usuarios do sistema.
    if (!store.get('migracao_usuarios_v1_done')) {
      const users = store.get('users') || [];
      const onlyOldAdmin = users.length === 1 && users[0] && users[0].username === 'admin';
      if (users.length === 0 || onlyOldAdmin) {
        store.set('users', defaultUsers());
        // Forca re-login pra que a sessao reflita o novo usuario
        store.remove('session');
      }
      store.set('migracao_usuarios_v1_done', true);
    }
    // Failsafe: se ainda nao houver lista, semeia
    if (!store.get('users')) {
      store.set('users', defaultUsers());
    }
    // Failsafe v2: garante que felipe.projetta sempre exista (ele eh o admin fixo)
    const users = store.get('users') || [];
    const hasFelipe = users.some(u => u && u.username === 'felipe.projetta');
    if (!hasFelipe) {
      users.unshift({ username: 'felipe.projetta', password: '12345', name: 'Felipe', role: 'admin', fixed: true, createdAt: 'Fixo' });
      store.set('users', users);
    } else {
      // Garantir que felipe sempre tenha senha 12345 e role admin (caso tenha sido alterado por engano)
      let changed = false;
      users.forEach(u => {
        if (u && u.username === 'felipe.projetta') {
          if (u.password !== '12345') { u.password = '12345'; changed = true; }
          if (u.role !== 'admin') { u.role = 'admin'; changed = true; }
          if (!u.fixed) { u.fixed = true; changed = true; }
        }
      });
      if (changed) store.set('users', users);
    }

    // ────────────────────────────────────────────────────────────────────
    // Felipe sessao 2026-08-02 V2: AUTO-CORRECAO DE SESSAO
    // Se a sessao ativa esta com role desatualizado (ex: foi salva antes
    // da migracao), corrige aqui SEM forcar re-login. O usuario nao
    // precisa fazer nada.
    // ────────────────────────────────────────────────────────────────────
    const session = store.get('session');
    if (session && session.username) {
      const finalUsers = store.get('users') || [];
      const u = finalUsers.find(x => x && x.username === session.username);
      if (u && u.role && session.role !== u.role) {
        console.log('[Auth] Auto-corrigindo sessao: role ' + session.role + ' -> ' + u.role);
        session.role = u.role;
        // Tambem atualiza name caso tenha mudado
        if (u.name && session.name !== u.name) session.name = u.name;
        store.set('session', session);
      }
    }
  }
  ensureDefaultUsers();

  // Felipe sessao 2026-08-02 V2: helper que auto-corrige a sessao
  // em tempo real. Chamado por currentUser() e isAdmin() pra garantir
  // que mesmo apos syncFromCloud trazer sessao velha do Supabase, o
  // role e' atualizado conforme a lista de users (que sempre tem o
  // role correto).
  function autoFixSession() {
    try {
      const s = store.get('session');
      if (!s || !s.username) return s;
      const users = store.get('users') || [];
      const u = users.find(x => x && x.username === s.username);
      if (u && u.role && s.role !== u.role) {
        s.role = u.role;
        if (u.name && s.name !== u.name) s.name = u.name;
        store.set('session', s);
      }
      return s;
    } catch(_) { return null; }
  }

  return {
    login(username, password) {
      const users = store.get('users') || [];
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) return null;
      const session = { username: user.username, name: user.name, role: user.role, loggedAt: Date.now() };
      store.set('session', session);
      return session;
    },
    logout() { store.remove('session'); },
    currentUser() {
      // Felipe sessao 2026-08-02 V2: auto-corrige antes de retornar
      return autoFixSession() || store.get('session');
    },
    isAdmin() {
      // Felipe sessao 2026-08-02 V2: auto-corrige antes de checar
      const s = autoFixSession() || store.get('session');
      if (!s) return false;
      if (s.role === 'admin') return true;
      // Fallback ainda mais defensivo: confere lista direto
      try {
        const users = store.get('users') || [];
        const u = users.find(x => x && x.username === s.username);
        if (u && u.role === 'admin') {
          s.role = 'admin';
          store.set('session', s);
          return true;
        }
      } catch(_) {}
      return false;
    },

    // ────────────────────────────────────────────────────────────────────
    // Felipe sessao 2026-08-02: sistema central de permissoes.
    // Auth.can('acao') retorna true/false.
    //
    // Acoes:
    //   'cadastros:editar'  - editar cadastros (Acessorios, Perfis, Modelos,
    //                         Superficies, Regras, Representantes, Mensagens).
    //                         SO ADMIN.
    //   'crm:tudo'          - editar leads no CRM. ADM e USER.
    //   'orcamento:tudo'    - editar orcamentos, versoes, DRE. ADM e USER.
    //   'usuarios:gerenciar'- abrir aba Usuarios e Permissoes. SO ADMIN.
    //   'config:editar'     - editar Configuracoes. SO ADMIN.
    //
    // Felipe: 'unica coisa que fazem e o crm e orcamentos, gerar orcamentos'
    // ────────────────────────────────────────────────────────────────────
    can(acao) {
      const s = store.get('session');
      if (!s) return false;
      // Felipe sessao 2026-08-02 V2: usa isAdmin() defensivo em vez
      // de checar s.role direto. Garante auto-correcao da sessao.
      const isAdm = this.isAdmin();
      switch (acao) {
        case 'cadastros:editar':
        case 'usuarios:gerenciar':
        case 'config:editar':
          return isAdm;
        case 'crm:tudo':
        case 'orcamento:tudo':
        case 'cadastros:visualizar':
        case 'estoque:visualizar':
        case 'email:usar':
          return true; // qualquer logado
        default:
          return isAdm; // unknown action -> admin only
      }
    },
    listUsers() {
      // Retorna copia pra evitar mutacao acidental
      return (store.get('users') || []).map(u => ({ ...u }));
    },
    addUser(input) {
      const users = store.get('users') || [];
      const username = (input.username || '').trim();
      const password = (input.password || '').trim();
      if (!username || !password) return { ok: false, error: 'Usuario e senha sao obrigatorios.' };
      if (users.some(u => u.username === username)) return { ok: false, error: 'Ja existe um usuario com esse nome.' };
      users.push({
        username, password,
        name: input.name || username,
        role: input.role === 'admin' ? 'admin' : 'user',
        fixed: false,
        createdAt: nowDateBR(),
      });
      store.set('users', users);
      return { ok: true };
    },
    removeUser(username) {
      const users = store.get('users') || [];
      const target = users.find(u => u.username === username);
      if (!target) return { ok: false, error: 'Usuario nao encontrado.' };
      if (target.fixed) return { ok: false, error: 'Usuario fixo nao pode ser removido.' };
      store.set('users', users.filter(u => u.username !== username));
      return { ok: true };
    },
    changePassword(username, newPassword) {
      const newPwd = (newPassword || '').trim();
      if (!newPwd) return { ok: false, error: 'Senha nao pode ser vazia.' };
      const users = store.get('users') || [];
      const u = users.find(x => x.username === username);
      if (!u) return { ok: false, error: 'Usuario nao encontrado.' };
      u.password = newPwd;
      store.set('users', users);
      return { ok: true };
    },
  };
})();

if (typeof window !== 'undefined') window.Auth = Auth;
