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
  }
  ensureDefaultUsers();

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
    currentUser() { return store.get('session'); },
    isAdmin() {
      const s = store.get('session');
      return !!s && s.role === 'admin';
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
