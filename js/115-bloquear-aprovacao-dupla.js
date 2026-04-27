/* ============================================================================
 * js/115-bloquear-aprovacao-dupla.js  —  v2 NOOP (27-abr-2026)
 * DESATIVADO conforme pedido de Felipe.
 * Lock 3s estava bloqueando POSTs legitimos do fluxo natural do app
 * (que dispara correção de nome via mod 116-corrigir-nome-trocado-aprovacao).
 * Defesa contra duplicacao agora eh apenas via mod 116-aprovar-so-marcada-estrela
 * (filtra por estrela ⭐).
 * ========================================================================== */
(function(){
  if(window.__projetta115BloqAprovDuplaApplied) return;
  window.__projetta115BloqAprovDuplaApplied = "v2-noop";
  console.log("[115] DESATIVADO (noop) — sem bloqueio, sem alerta");
})();