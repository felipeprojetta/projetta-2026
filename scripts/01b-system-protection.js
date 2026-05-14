/* 01b-system-protection.js — Proteção contra seeders sobrescreverem dados reais.
 *
 * INCIDENTE QUE MOTIVOU (sessao 18):
 * Um seeder do CRM (lista de leads dummy do inicio do projeto) disparou
 * sozinho quando o banco retornou null transitoriamente. Resultado:
 * sobrescreveu 100+ leads reais + quebrou ligacao com 56 negocios.
 * Felipe perdeu varios dias de trabalho. Recovery via Excel de backup.
 *
 * PROTECAO EM CAMADAS (sessao 30):
 *   Camada 1 (este arquivo): JS verifica flag global ANTES de rodar seed.
 *   Camada 2 (trigger SQL no Supabase): rejeita escritas sem updated_by.
 *   Camada 3 (pg_cron): backup horario automatico.
 *
 * COMO FUNCIONA:
 *   Flag `bootstrapped` armazenada em DUAS fontes:
 *     - window.__systemBootstrapped (memoria da sessao — protege contra
 *       falha transitoria do banco durante a sessao atual)
 *     - Storage.scope('system').get('bootstrapped') (persistente — banco)
 *
 *   Seeders verificam `SystemProtection.podeRodarSeed()` ANTES de rodar.
 *   Se QUALQUER uma das duas fontes disser que ja' foi inicializado,
 *   seeder NAO RODA — mesmo se a lista do banco vier null/vazia.
 *
 *   Auto-deteccao: na primeira vez que o sistema detecta dados reais
 *   (qualquer scope com >= 1 registro), marca como bootstrapped.
 *
 * USO MANUAL (DevTools console):
 *   SystemProtection.marcarComoInicializado()   // ativa protecao
 *   SystemProtection.estado()                   // ve estado atual
 *   SystemProtection.desligar()                 // SO em emergencia, exige confirmacao
 *
 * PRA CLIENTES NOVOS:
 *   Antes do primeiro boot, flag nao existe. Seeders rodam normalmente
 *   uma unica vez. Depois disso, a flag fica ATIVA permanentemente.
 */
const SystemProtection = (() => {
  const FLAG_KEY = 'bootstrapped';
  const SCOPE_NAME = 'system';

  // Detecta se algum scope critico tem dados reais. Usado pra
  // auto-marcar o sistema como inicializado.
  function _temDadosReais() {
    try {
      const scopes = [
        ['crm', 'leads'],
        ['kanban-producao', 'leads'],
        ['orcamentos', 'negocios'],
        ['cadastros', 'representantes_lista'],
        ['cadastros', 'modelos_lista'],
        ['cadastros', 'superficies_lista'],
        ['cadastros', 'acessorios_lista'],
        ['cadastros', 'perfis_lista'],
      ];
      for (const [scope, key] of scopes) {
        try {
          const dados = Storage.scope(scope).get(key);
          if (Array.isArray(dados) && dados.length > 0) {
            return true;
          }
        } catch (_) { /* ignora scope inacessivel */ }
      }
    } catch (_) {}
    return false;
  }

  // Le a flag das duas fontes. Memoria tem prioridade.
  function _lerFlag() {
    try {
      if (typeof window !== 'undefined' && window.__systemBootstrapped === true) {
        return true;
      }
    } catch (_) {}
    try {
      const persistido = Storage.scope(SCOPE_NAME).get(FLAG_KEY);
      if (persistido === true) {
        // sincroniza memoria
        try { window.__systemBootstrapped = true; } catch (_) {}
        return true;
      }
    } catch (_) {}
    return false;
  }

  // Marca como inicializado nas duas fontes.
  function _setarFlag() {
    try { window.__systemBootstrapped = true; } catch (_) {}
    try {
      Storage.scope(SCOPE_NAME).set(FLAG_KEY, true);
    } catch (e) {
      console.warn('[SystemProtection] Falha ao persistir flag no banco:', e);
    }
  }

  return {
    /**
     * Verifica se um seeder pode rodar.
     * Retorna FALSE se sistema ja' foi inicializado (= protege dados).
     * Retorna TRUE so' no primeiro boot de um sistema novo.
     */
    podeRodarSeed() {
      // 1. Checa flag das duas fontes
      if (_lerFlag()) return false;
      // 2. Auto-deteccao: se temos dados reais em qualquer scope,
      //    marca como inicializado AGORA e bloqueia o seed.
      if (_temDadosReais()) {
        console.log('[SystemProtection] Auto-detectados dados reais — marcando sistema como inicializado e bloqueando seeders.');
        _setarFlag();
        return false;
      }
      // 3. Sistema vazio mesmo (cliente novo) — seed pode rodar uma vez
      return true;
    },

    /**
     * Marca o sistema como inicializado. Chamado AUTOMATICAMENTE
     * apos primeira carga bem-sucedida de dados reais; pode ser
     * chamado manualmente via console pra ativar imediato.
     */
    marcarComoInicializado() {
      _setarFlag();
      console.log('[SystemProtection] Sistema marcado como inicializado. Seeders desativados permanentemente.');
      return true;
    },

    /**
     * Retorna estado atual da protecao (debug).
     */
    estado() {
      const memoria = !!(typeof window !== 'undefined' && window.__systemBootstrapped);
      let persistido = false;
      try { persistido = Storage.scope(SCOPE_NAME).get(FLAG_KEY) === true; } catch (_) {}
      const temDados = _temDadosReais();
      return {
        memoria,
        persistido,
        temDadosReais: temDados,
        protegido: memoria || persistido || temDados,
      };
    },

    /**
     * Desliga a protecao (SO em emergencia, exige confirmacao no console).
     * Util quando admin precisa reseed deliberadamente (cliente novo
     * ou setup de demonstracao).
     */
    desligar(senhaConfirmacao) {
      if (senhaConfirmacao !== 'DESLIGAR_PROTECAO_DOS_SEEDERS') {
        console.error('[SystemProtection] Para desligar, chame com a senha exata:');
        console.error("  SystemProtection.desligar('DESLIGAR_PROTECAO_DOS_SEEDERS')");
        return false;
      }
      try { window.__systemBootstrapped = false; } catch (_) {}
      try { Storage.scope(SCOPE_NAME).set(FLAG_KEY, false); } catch (_) {}
      console.warn('[SystemProtection] ⚠️  Protecao DESLIGADA. Seeders voltarao a rodar em scope vazio.');
      return true;
    },
  };
})();

if (typeof window !== 'undefined') {
  window.SystemProtection = SystemProtection;
  // Atalho pratico pro Felipe ativar imediato via console:
  window.protegerSistema = function() {
    return SystemProtection.marcarComoInicializado();
  };
}
