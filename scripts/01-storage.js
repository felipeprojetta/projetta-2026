/* 01-storage.js — Storage (legacy adapter sincrono).
   Modulos antigos ainda usam Storage.scope(). Nao usar em codigo novo:
   prefira Database.scope() (async) que e' o padrao do sistema. */

/* ============================================================
   STORAGE (LEGACY — mantido por compatibilidade)
   ============================================================
   Modulos antigos (Auth, Cadastros) ainda usam Storage.scope().
   Storage agora e' um adapter sincrono que delega ao Database.
   IMPORTANTE: NOVOS MODULOS NAO DEVEM USAR ISTO.
   Use Database.scope() (async) em todo modulo novo.
   ============================================================ */
const Storage = (() => {
  /* Adapter sincrono: enquanto driver for 'local', podemos retornar
     direto sem await. Isso quebra a regra do async, mas mantem o
     codigo legado funcionando ate ser migrado.
     Quando driver virar 'supabase', Storage sera removido e os
     chamadores antigos serao migrados pra Database (async). */
  const PREFIX = 'projetta:';
  return {
    scope(scopeName) {
      return {
        get(k, fallback = null) {
          try {
            const raw = localStorage.getItem(PREFIX + scopeName + ':' + k);
            return raw === null ? fallback : JSON.parse(raw);
          } catch (e) { return fallback; }
        },
        set(k, value) {
          localStorage.setItem(PREFIX + scopeName + ':' + k, JSON.stringify(value));
          Events.emit('db:change', { scope: scopeName, key: k, value });
        },
        remove(k) {
          localStorage.removeItem(PREFIX + scopeName + ':' + k);
          Events.emit('db:change', { scope: scopeName, key: k, value: null });
        },
      };
    },
  };
})();
