/* 05-auth.js — Auth (sessao + lista de usuarios).
   Felipe sessao 18: SEGURANCA - senhas NUNCA mais em texto puro.
   Tudo armazenado como hash SHA-256 + salt fixo. Senha do
   admin felipe.projetta MUDADA pra valor secreto definido por Felipe.
   Failsafe removido (nao reverte mais pra '12345'). */

/* ============================================================
   AUTH — gerenciamento de sessao
   ============================================================ */
const Auth = (() => {
  const store = Storage.scope('auth');

  // Felipe sessao 18: hash de senha. SubtleCrypto (Web Crypto API)
  // e' nativo do browser, mais seguro que importar lib. Salt fixo
  // dificulta lookup em rainbow tables (alguem precisaria gerar tabela
  // especifica pra esse salt).
  const SENHA_SALT = 'projetta-v7-salt-2026';

  async function hashSenha(senhaTexto) {
    const enc = new TextEncoder();
    const data = enc.encode(String(senhaTexto || '') + SENHA_SALT);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function nowDateBR() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  }

  // Lista de usuarios padrao do sistema. felipe.projetta eh admin
  // e fixo (nao pode ser excluido).
  //
  // Felipe sessao 18: SENHA NAO E' MAIS HARDCODED.
  // O hash abaixo corresponde a senha definida por Felipe (nao
  // documentada nem em comentarios, nem em commits). Pra trocar,
  // logar e usar 'Trocar Senha' na tela de Usuarios.
  // Hash gerado com: SHA-256(senha + 'projetta-v7-salt-2026')
  function defaultUsers() {
    return [
      {
        username: 'felipe.projetta',
        passwordHash: '11f6c03b8f0046364e07d5fbda5058687f0b01ecef5c3f16360962d372fe9b45',
        name: 'Felipe', role: 'admin', fixed: true, createdAt: 'Fixo',
      },
    ];
  }

  function ensureDefaultUsers() {
    // Felipe sessao 18: MIGRACAO DE SEGURANCA criada apos o John (TI
    // Weiku) achar a senha '12345' do felipe.projetta no codigo
    // publico em segundos. Limpa qualquer copia local com senha
    // texto puro e forca aplicar a nova senha (hash) imediatamente.
    if (!store.get('migracao_seguranca_v18_done')) {
      const users = store.get('users') || [];
      const felipeIdx = users.findIndex(u => u && u.username === 'felipe.projetta');
      if (felipeIdx >= 0) {
        const felipe = users[felipeIdx];
        // Se tem password texto puro OU se hash nao bate com o novo,
        // substitui pelo defaultUsers (que ja tem o hash novo).
        if (felipe.password || felipe.passwordHash !== defaultUsers()[0].passwordHash) {
          users[felipeIdx] = defaultUsers()[0];
          store.set('users', users);
          // Forca re-login: sessao atual pode ter sido feita com senha
          // antiga, derruba ela pra exigir nova autenticacao
          store.remove('session');
        }
      }
      // Limpa password texto puro de TODOS os outros usuarios tambem
      // (eles vao ter que pedir pra Felipe resetar via 'Alterar Senha')
      let needsResave = false;
      users.forEach(u => {
        if (u && u.password) {
          delete u.password;
          needsResave = true;
        }
      });
      if (needsResave) store.set('users', users);
      store.set('migracao_seguranca_v18_done', true);
    }

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
    // Felipe sessao 18: SEGURANCA - removido o failsafe que forcava
    // 'felipe.projetta' a sempre ter senha '12345'. Agora, se Felipe
    // trocar a senha, ela PERSISTE (ele e' o admin, e' decisao dele).
    // Mantida apenas garantia minima: felipe.projetta SEMPRE existe
    // e SEMPRE e' admin (nao pode se auto-excluir do papel).
    const users = store.get('users') || [];
    const hasFelipe = users.some(u => u && u.username === 'felipe.projetta');
    if (!hasFelipe) {
      users.unshift(defaultUsers()[0]);
      store.set('users', users);
    } else {
      // Garantir apenas que felipe e' admin + fixed
      // (nao mexe na senha - se ele trocou, fica trocada)
      let changed = false;
      users.forEach(u => {
        if (u && u.username === 'felipe.projetta') {
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
    // Felipe sessao 18: login agora compara HASH em vez de senha
    // em texto puro. async pq usa SubtleCrypto.
    // Migracao automatica: se usuario antigo ainda tem 'password'
    // (texto puro do schema legado), faz a comparacao com hash do
    // texto + reescreve com hash. Permite usuarios antigos logarem
    // 1 vez sem precisar resetar.
    async login(username, password) {
      const users = store.get('users') || [];
      const u = users.find(x => x.username === username);
      if (!u) return null;
      const hashDigitado = await hashSenha(password);
      let autenticou = false;
      // Caso 1: usuario ja tem passwordHash (esquema novo)
      if (u.passwordHash && u.passwordHash === hashDigitado) {
        autenticou = true;
      }
      // Caso 2: usuario legado com password em texto - migra
      // (Felipe sessao 18 - migrar usuarios antigos sem forcar reset)
      if (!autenticou && u.password && u.password === password) {
        autenticou = true;
        // Migra: troca password texto puro por hash
        u.passwordHash = hashDigitado;
        delete u.password;
        store.set('users', users);
      }
      if (!autenticou) return null;
      const session = { username: u.username, name: u.name, role: u.role, loggedAt: Date.now() };
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
    // Felipe sessao 18: addUser agora armazena passwordHash
    // em vez de password texto puro
    async addUser(input) {
      const users = store.get('users') || [];
      const username = (input.username || '').trim();
      const password = (input.password || '').trim();
      if (!username || !password) return { ok: false, error: 'Usuario e senha sao obrigatorios.' };
      if (users.some(u => u.username === username)) return { ok: false, error: 'Ja existe um usuario com esse nome.' };
      const passwordHash = await hashSenha(password);
      users.push({
        username,
        passwordHash,
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
    // Felipe sessao 18: changePassword agora armazena hash
    async changePassword(username, newPassword) {
      const newPwd = (newPassword || '').trim();
      if (!newPwd) return { ok: false, error: 'Senha nao pode ser vazia.' };
      const users = store.get('users') || [];
      const u = users.find(x => x.username === username);
      if (!u) return { ok: false, error: 'Usuario nao encontrado.' };
      u.passwordHash = await hashSenha(newPwd);
      // Limpa password texto puro legado se existir
      if (u.password) delete u.password;
      store.set('users', users);
      return { ok: true };
    },
  };
})();

if (typeof window !== 'undefined') window.Auth = Auth;
