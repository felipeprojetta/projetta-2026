/* 02-events.js — pub/sub simples para comunicacao entre modulos.
   Use Events.emit('canal', dados) e Events.on('canal', handler). */

/* ============================================================
   EVENTS — barramento simples para comunicacao entre modulos
   Evita acoplamento direto.
   ============================================================ */
const Events = (() => {
  const listeners = {};
  return {
    on(event, fn) { (listeners[event] ||= []).push(fn); },
    off(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(f => f !== fn);
    },
    emit(event, payload) {
      (listeners[event] || []).forEach(fn => {
        try { fn(payload); } catch (e) { console.error('[Events]', event, e); }
      });
    },
  };
})();
