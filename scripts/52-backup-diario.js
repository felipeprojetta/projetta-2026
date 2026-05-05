/* 52-backup-diario.js — Backup diario automatico das chaves criticas
   ====================================================================
   Felipe sessao 2026-08-02: Felipe optou por backup diario (1x por dia)
   pra poder voltar atras se algo der errado.

   Como funciona:
   - 1x por dia (depois de meia-noite), faz snapshot das chaves criticas
     e salva em scope='backup_diario' com key='YYYY-MM-DD:nome_chave'.
   - Antes de salvar, conferimos via Storage.scope('backup_diario').get()
     se ja' tem o backup do dia. Se sim, pula.
   - Backups vivem 30 dias - depois disso podem ser limpos manualmente.

   Chaves criticas (snapshotadas):
     cadastros: acessorios_lista, perfis_lista, modelos_lista,
                superficies_lista, representantes_lista, regras_*

   Trigger:
     - 1x no boot (5 segundos depois)
     - 1x quando usuario clica Salvar em qualquer cadastro de preco
       (via hook em Storage.scope('cadastros').set())

   ATENCAO: como Database tem readOnly mode, esse modulo SO faz backup
   QUANDO sistema esta editavel (readOnly = false). Em readOnly, pular.
   ==================================================================== */

(function() {
  'use strict';

  if (typeof window === 'undefined' || !window.Database || !window.Storage) {
    return;
  }

  // Chaves criticas a snapshotar (scope: cadastros)
  var CHAVES_CRITICAS = [
    'acessorios_lista',
    'perfis_lista',
    'modelos_lista',
    'superficies_lista',
    'representantes_lista',
    'cores_lista',
    'markups_lista',
    'comissoes_lista',
    'regras_porta_externa',
    'regras_chapas',
    'regras_fita_silicone',
    'rendimentos_fita_silicone',
    'precificacao_porta_externa',
    'precificacao_revestimento_parede',
    'fechaduras_lista',
    'puxadores_lista',
    'vidros_lista',
  ];

  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function fazerBackupDiario() {
    // Em read-only mode, NAO escreve nada
    if (window.Database.isReadOnly && window.Database.isReadOnly()) {
      console.log('[BackupDiario] Sistema em read-only, pulando backup');
      return;
    }

    var data = hojeISO();
    var cadastros = window.Storage.scope('cadastros');
    var backup    = window.Storage.scope('backup_diario');
    var snapshotadas = 0;
    var puladas = 0;

    CHAVES_CRITICAS.forEach(function(chave) {
      var bkpKey = data + ':' + chave;
      // Se ja' tem backup desse dia pra essa chave, pula
      if (backup.get(bkpKey) !== null) {
        puladas++;
        return;
      }
      // Le valor atual e copia pro backup
      var valor = cadastros.get(chave);
      if (valor === null || (Array.isArray(valor) && valor.length === 0)) {
        return; // Nao backupa vazio
      }
      try {
        backup.set(bkpKey, valor);
        snapshotadas++;
      } catch(e) {
        // Se Storage estiver bloqueado por readOnly (caso de race), apenas loga
        console.warn('[BackupDiario] Falha ao salvar backup de "' + chave + '":', e.message);
      }
    });

    if (snapshotadas > 0) {
      console.log('[BackupDiario] ✅ Backup do dia ' + data + ' criado: ' +
                  snapshotadas + ' chaves snapshotadas (' + puladas + ' ja' + ' existiam)');
    } else if (puladas === CHAVES_CRITICAS.length) {
      console.log('[BackupDiario] Backup de hoje (' + data + ') ja existia');
    }
  }

  function limparBackupsAntigos() {
    if (window.Database.isReadOnly && window.Database.isReadOnly()) return;
    var backup = window.Storage.scope('backup_diario');
    var todos = backup.list ? backup.list() : null;
    if (!todos) {
      // Storage.list nao existe em todos os scopes - itera localStorage direto
      var todasChaves = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('projetta:backup_diario:') === 0) {
            todasChaves.push(k.replace('projetta:backup_diario:', ''));
          }
        }
      } catch(_) { return; }
      todos = {};
      todasChaves.forEach(function(k) { todos[k] = true; });
    }
    var d30atras = new Date();
    d30atras.setDate(d30atras.getDate() - 30);
    var corteISO = d30atras.getFullYear() + '-' +
                   String(d30atras.getMonth() + 1).padStart(2, '0') + '-' +
                   String(d30atras.getDate()).padStart(2, '0');
    var removidas = 0;
    Object.keys(todos).forEach(function(k) {
      var dataDoBackup = k.split(':')[0];
      if (dataDoBackup && dataDoBackup < corteISO) {
        try { backup.remove(k); removidas++; } catch(_){}
      }
    });
    if (removidas > 0) {
      console.log('[BackupDiario] 🧹 ' + removidas + ' backups com mais de 30 dias removidos');
    }
  }

  // ── Listar backups disponiveis (utilidade pro Felipe debugar) ──
  function listarBackups() {
    var todos = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('projetta:backup_diario:') === 0) {
          var key = k.replace('projetta:backup_diario:', '');
          var data = key.split(':')[0];
          var chave = key.split(':').slice(1).join(':');
          var raw = localStorage.getItem(k);
          var size = raw ? raw.length : 0;
          if (!todos[data]) todos[data] = [];
          todos[data].push({ chave: chave, bytes: size });
        }
      }
    } catch(_) {}
    return todos;
  }

  function restaurarBackup(data, chave) {
    if (!confirm('Restaurar backup de "' + chave + '" do dia ' + data + '?\n\nO valor atual sera substituido.')) return false;
    var backup = window.Storage.scope('backup_diario');
    var bkpKey = data + ':' + chave;
    var valor = backup.get(bkpKey);
    if (valor === null) {
      alert('Backup nao encontrado: ' + bkpKey);
      return false;
    }
    var cadastros = window.Storage.scope('cadastros');
    try {
      cadastros.set(chave, valor);
      alert('✅ Backup restaurado. Recarregue a pagina (F5) pra ver as alteracoes.');
      return true;
    } catch(e) {
      alert('❌ Erro ao restaurar: ' + e.message);
      return false;
    }
  }

  // Expoe globalmente
  window.BackupDiario = {
    fazerAgora: fazerBackupDiario,
    listar: listarBackups,
    restaurar: restaurarBackup,
    limparAntigos: limparBackupsAntigos,
  };

  // Auto-executa no boot (5s depois pra Database estar pronto)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        fazerBackupDiario();
        limparBackupsAntigos();
      }, 5000);
    });
  } else {
    setTimeout(function() {
      fazerBackupDiario();
      limparBackupsAntigos();
    }, 5000);
  }
})();
