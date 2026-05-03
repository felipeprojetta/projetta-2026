/* 06-migracoes.js — migracoes one-shot rodadas no boot (antes do App.init).
   Cada migracao e' marcada com flag em localStorage pra rodar uma unica vez. */

const Migracoes = (() => {

  // v0.9.0 — apaga dados legados do antigo modulo Representantes
  // (que foi recriado do zero numa versao posterior)
  function cleanupV090() {
    try {
      if (localStorage.getItem('projetta:reps_wiped_v090')) return;
      const chavesAntigas = [
        'projetta:cadastros:representantes_lista',
        'projetta:cadastros:representantes_params',
        'projetta:cadastros:representantes_seeded',
        'projetta:cadastros:representantes_migrado_v3',
        'projetta:cadastros:representantes_migrado_v4',
      ];
      chavesAntigas.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('projetta:reps_wiped_v090', '1');
      console.log('[Migracoes] v0.9.0 — Representantes legacy removido.');
    } catch (_) {}
  }

  // v0.11.0 — apaga chaves antigas do modulo Configuracoes (Weiku mock/json/supabase)
  // O card "Integracao Weiku" da aba Configuracoes foi removido nesta versao.
  // Sera reconstruido do zero quando Supabase entrar.
  function removerConfigAntigaWeiku() {
    try {
      const FLAG = 'projetta:app:migracao_remocao_config_v1_done';
      if (localStorage.getItem(FLAG) === 'true') return;
      const aRemover = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('projetta:config:')) aRemover.push(k);
      }
      aRemover.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(FLAG, 'true');
      if (aRemover.length > 0) {
        console.log(`[Migracoes] v0.11.0 — ${aRemover.length} chaves de Config antigo removidas.`);
      }
    } catch (_) {}
  }

  function rodarTodas() {
    cleanupV090();
    removerConfigAntigaWeiku();
  }

  return { rodarTodas };
})();
