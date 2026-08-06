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

  // ══════════════════════════════════════════════════════════════════
  // Felipe sessao 44: PBKDF2 — NIVEL 2 DE SEGURANCA
  //
  // CAUSA RAIZ do problema anterior: o esquema da sessao 18 (SHA-256 +
  // SENHA_SALT fixo) tem duas falhas que se somam:
  //   1) o salt e' FIXO e esta publicado no JS publico — da pra montar
  //      uma tabela de lookup unica que serve pra todos os usuarios;
  //   2) SHA-256 e' rapido de proposito — uma GPU testa bilhoes de
  //      chutes por segundo, entao senha curta cai em segundos.
  //
  // PBKDF2 corrige os dois: salt ALEATORIO POR USUARIO (cada senha
  // exige um ataque proprio, tabela pre-computada nao serve) e 210.000
  // iteracoes (cada chute fica ~210 mil vezes mais caro). E' nativo do
  // navegador via SubtleCrypto — nenhuma biblioteca nova, nenhuma
  // dependencia externa adicionada ao sistema.
  //
  // COMPATIBILIDADE: nada quebra. conferirSenha() aceita os 3 esquemas
  // (PBKDF2, SHA-256 legado, texto puro legado) e o login MIGRA sozinho
  // pro PBKDF2 na primeira entrada. Ninguem precisa resetar senha.
  // ══════════════════════════════════════════════════════════════════
  const PBKDF2_ITER = 210000;   // OWASP 2023 p/ PBKDF2-HMAC-SHA256
  const PBKDF2_SALT_BYTES = 16;
  const PBKDF2_HASH_BITS = 256;
  const SENHA_MIN_CHARS = 12;

  function bytesParaHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hexParaBytes(hex) {
    const s = String(hex || '');
    const out = new Uint8Array(Math.floor(s.length / 2));
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  function novoSaltHex() {
    const salt = new Uint8Array(PBKDF2_SALT_BYTES);
    crypto.getRandomValues(salt);
    return bytesParaHex(salt);
  }

  async function derivarPBKDF2(senhaTexto, saltHex, iteracoes) {
    const enc = new TextEncoder();
    const chave = await crypto.subtle.importKey(
      'raw', enc.encode(String(senhaTexto || '')), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hexParaBytes(saltHex), iterations: iteracoes, hash: 'SHA-256' },
      chave, PBKDF2_HASH_BITS
    );
    return bytesParaHex(new Uint8Array(bits));
  }

  // Formato guardado (string autodescritiva, permite subir as iteracoes
  // no futuro sem invalidar as senhas ja gravadas):
  //   pbkdf2$sha256$<iteracoes>$<saltHex>$<hashHex>
  async function gerarRegistroSenha(senhaTexto) {
    const saltHex = novoSaltHex();
    const hashHex = await derivarPBKDF2(senhaTexto, saltHex, PBKDF2_ITER);
    return ['pbkdf2', 'sha256', PBKDF2_ITER, saltHex, hashHex].join('$');
  }

  function lerRegistroSenha(registro) {
    const p = String(registro || '').split('$');
    if (p.length !== 5 || p[0] !== 'pbkdf2' || p[1] !== 'sha256') return null;
    const iter = parseInt(p[2], 10);
    if (!iter || iter < 1) return null;
    return { iter, saltHex: p[3], hashHex: p[4] };
  }

  // Comparacao em tempo constante: nao vaza, pelo tempo de resposta,
  // quantos caracteres do hash o atacante ja acertou.
  function comparaSeguro(a, b) {
    const x = String(a || ''), y = String(b || '');
    if (x.length !== y.length) return false;
    let dif = 0;
    for (let i = 0; i < x.length; i++) dif |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return dif === 0;
  }

  // Confere a senha nos 3 esquemas. Retorna { ok, migrar }.
  // migrar=true significa "autenticou por esquema antigo" — o login
  // reescreve em PBKDF2 logo em seguida.
  async function conferirSenha(u, senhaDigitada) {
    if (!u) return { ok: false, migrar: false };
    // Esquema ATUAL: PBKDF2 com salt proprio
    if (u.passwordPBKDF2) {
      const reg = lerRegistroSenha(u.passwordPBKDF2);
      if (!reg) {
        console.warn('[Auth] registro PBKDF2 corrompido para', u.username);
        return { ok: false, migrar: false };
      }
      const calc = await derivarPBKDF2(senhaDigitada, reg.saltHex, reg.iter);
      return { ok: comparaSeguro(calc, reg.hashHex), migrar: false };
    }
    // LEGADO 1 (sessao 18): SHA-256 + salt fixo
    if (u.passwordHash) {
      const h = await hashSenha(senhaDigitada);
      return { ok: comparaSeguro(h, u.passwordHash), migrar: true };
    }
    // LEGADO 2 (pre sessao 18): texto puro
    if (u.password) {
      return { ok: comparaSeguro(u.password, senhaDigitada), migrar: true };
    }
    return { ok: false, migrar: false };
  }

  // Regra de forca de senha. Usada por addUser e changePassword.
  // Nao se aplica a senhas ja existentes (ninguem fica trancado fora).
  function validarForcaSenha(senha) {
    const s = String(senha || '');
    if (s.length < SENHA_MIN_CHARS) {
      return 'A senha precisa ter pelo menos ' + SENHA_MIN_CHARS +
             ' caracteres. Senhas curtas sao descobertas por tentativa em segundos.';
    }
    return null;
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
    // Felipe sessao 44: a parte que SUBSTITUIA o felipe.projetta pelo
    // defaultUsers() foi DESATIVADA — justificativa tecnica:
    // ela comparava felipe.passwordHash com um hash hardcoded e, se
    // desse diferente, trocava o usuario inteiro e derrubava a sessao.
    // Com o esquema PBKDF2 o campo passwordHash deixa de existir, entao
    // a comparacao daria SEMPRE diferente: em todo navegador limpo a
    // senha real do Felipe seria substituida pelo hash antigo e ele
    // ficaria trancado fora do proprio sistema ate o sync do cloud
    // corrigir. A migracao ja cumpriu o papel dela — o banco foi
    // conferido em 05/08/2026 e nao ha mais senha em texto puro.
    //
    // MANTIDA a limpeza de texto puro, que e' regra permanente. Unica
    // mudanca: so' apaga o campo 'password' quando JA existe um hash no
    // usuario. Antes apagava sempre, o que deixava sem nenhuma senha
    // valida quem so' tinha texto puro. Hoje nao e' mais necessario
    // trancar ninguem: o proprio login migra o esquema antigo sozinho.
    {
      const users = store.get('users') || [];
      let needsResave = false;
      users.forEach(u => {
        if (u && u.password && (u.passwordPBKDF2 || u.passwordHash)) {
          delete u.password;
          needsResave = true;
        }
      });
      if (needsResave) store.set('users', users);
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
      // Felipe sessao 44: conferirSenha cobre os 3 esquemas (PBKDF2,
      // SHA-256 legado, texto puro legado) — ver bloco PBKDF2 no topo.
      const r = await conferirSenha(u, password);
      if (!r.ok) return null;
      // Migracao automatica e silenciosa pro esquema atual. O usuario
      // continua usando a MESMA senha; so' a forma de guardar muda.
      // Se falhar, o login segue normal (nao trancar ninguem fora).
      if (r.migrar) {
        try {
          u.passwordPBKDF2 = await gerarRegistroSenha(password);
          delete u.passwordHash;
          delete u.password;
          store.set('users', users);
          console.info('[Auth] senha de "' + username + '" migrada para PBKDF2.');
        } catch (e) {
          console.warn('[Auth] falha ao migrar senha para PBKDF2:', e);
        }
      }
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
      // Felipe sessao 44: usuario NOVO ja nasce no esquema forte.
      const erroForca = validarForcaSenha(password);
      if (erroForca) return { ok: false, error: erroForca };
      const passwordPBKDF2 = await gerarRegistroSenha(password);
      users.push({
        username,
        passwordPBKDF2,
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
      // Remove do array de usuarios
      store.set('users', users.filter(u => u.username !== username));
      // Felipe sessao 34 (Andressa demitida volta no merge): adiciona username
      // ao TOMBSTONE em auth/users_deletados. Esse tombstone bloqueia o
      // mergeProtegido_users de ressuscitar o usuario via cache stale de
      // outro browser. Sem isso, deletar so' apagava localmente e o merge
      // trazia de volta do cloud ou do cache do outro browser.
      try {
        const deletados = store.get('users_deletados') || [];
        const ja = Array.isArray(deletados) && deletados.some(t => t && t.username === username);
        if (!ja) {
          const arr = Array.isArray(deletados) ? deletados.slice() : [];
          arr.push({
            username: username,
            deletadoEm: new Date().toISOString(),
            motivo: 'removido_via_ui'
          });
          store.set('users_deletados', arr);
        }
      } catch(e) {
        console.warn('[Auth.removeUser] falha ao adicionar tombstone:', e);
      }
      return { ok: true };
    },
    // Felipe sessao 18: changePassword agora armazena hash
    async changePassword(username, newPassword) {
      const newPwd = (newPassword || '').trim();
      if (!newPwd) return { ok: false, error: 'Senha nao pode ser vazia.' };
      const users = store.get('users') || [];
      const u = users.find(x => x.username === username);
      if (!u) return { ok: false, error: 'Usuario nao encontrado.' };
      // Felipe sessao 44: toda senha trocada ja sai no esquema forte.
      const erroForca = validarForcaSenha(newPwd);
      if (erroForca) return { ok: false, error: erroForca };
      u.passwordPBKDF2 = await gerarRegistroSenha(newPwd);
      // Limpa os esquemas legados pra nao sobrar caminho fraco de login
      if (u.passwordHash) delete u.passwordHash;
      if (u.password) delete u.password;
      store.set('users', users);
      return { ok: true };
    },
  };
})();

if (typeof window !== 'undefined') window.Auth = Auth;
