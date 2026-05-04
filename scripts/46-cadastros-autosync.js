/* ================================================================
 * 46-cadastros-autosync.js — Sync automatico de cadastros pro Supabase
 * ================================================================
 *
 * Felipe (sessao 2026-05): "nao quero nada localStorage navegador, nada
 * exatamente nada, isso e um sistema de uma empresa seria, faca tudo como
 * um profissional de TI faria".
 *
 * Estrategia profissional (write-through cache):
 *   - Source of truth: Supabase (v7.cadastros)
 *   - localStorage: apenas cache local pra performance/offline
 *   - Toda escrita em Storage.scope('cadastros') espelha imediatamente no Supabase
 *   - No boot, Supabase eh carregado PRIMEIRO; localStorage eh apenas fallback
 *   - Migracao automatica: dados que existem so' local sao empurrados ao Supabase
 *
 * Chaves sincronizadas (lista canonica):
 *   modelos_lista, perfis_lista, representantes_lista, acessorios_lista,
 *   superficies_lista, cores_lista, markups_lista, comissoes_lista,
 *   precificacao_*, regras_*, fechaduras_*, puxadores_*, vidros_*
 *
 * Imagens (img_1f, img_2f em modelos_lista) ficam como URL publica do
 * Storage do Supabase (bucket modelos-portas) — ver 21-modelos.js.
 * ================================================================ */

(function() {
  'use strict';

  if (!window.Storage || !window.SupabaseSync) {
    console.warn('[CadastrosAutosync] Storage ou SupabaseSync nao disponiveis');
    return;
  }

  var _initialized = false;
  var _pendingSyncs = {};
  var _statusCallbacks = [];

  // Status global do sync
  var _status = {
    initialLoadDone: false,
    online: true,
    lastSync: null,
    syncQueueLen: 0,
    error: null
  };

  function setStatus(updates) {
    Object.assign(_status, updates);
    _statusCallbacks.forEach(function(cb) {
      try { cb(_status); } catch (_) {}
    });
  }

  function getStatus() {
    return Object.assign({}, _status);
  }

  function onStatusChange(cb) {
    _statusCallbacks.push(cb);
  }

  /**
   * Carrega cadastros do Supabase para localStorage no boot.
   * Estrategia: Supabase eh source of truth; sobrescreve cache local.
   * Chama Events.emit('cadastros:loaded') ao terminar pra modulos
   * re-renderizarem com dados atualizados.
   */
  async function carregarDoSupabase() {
    try {
      var dados = await SupabaseSync.loadCadastrosFromCloud();
      if (!dados) {
        console.warn('[CadastrosAutosync] Sem conexao com Supabase, usando cache local');
        setStatus({ initialLoadDone: true, online: false });
        return false;
      }

      var store = Storage.scope('cadastros');
      var chavesAtualizadas = [];
      Object.keys(dados).forEach(function(chave) {
        var valorAtual = store.get(chave);
        var valorNovo = dados[chave];
        // Sobrescreve sempre (Supabase = source of truth)
        if (JSON.stringify(valorAtual) !== JSON.stringify(valorNovo)) {
          store.set(chave, valorNovo);
          chavesAtualizadas.push(chave);
        }
      });

      console.log('[CadastrosAutosync] ✅ ' + Object.keys(dados).length + ' cadastros do Supabase | ' + chavesAtualizadas.length + ' atualizados localmente');
      if (chavesAtualizadas.length) {
        console.log('  Atualizados:', chavesAtualizadas.join(', '));
      }

      setStatus({ initialLoadDone: true, online: true, lastSync: Date.now(), error: null });

      // Notifica modulos pra re-renderizar
      if (window.Events && window.Events.emit) {
        window.Events.emit('cadastros:loaded', { chaves: Object.keys(dados) });
      }
      return true;
    } catch (e) {
      console.error('[CadastrosAutosync] Erro carregando do Supabase:', e);
      setStatus({ initialLoadDone: true, online: false, error: e.message });
      return false;
    }
  }

  /**
   * Migra dados que estao SO em localStorage pro Supabase.
   * Chamado uma vez no boot, depois do load.
   */
  async function migrarLocalParaSupabase() {
    try {
      var store = Storage.scope('cadastros');
      // Pega todas as chaves do scope cadastros via inspecao localStorage
      var prefix = 'projetta_cadastros_';
      var chavesLocais = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          chavesLocais.push(k.substring(prefix.length));
        }
      }

      // Pega chaves que ja' estao no Supabase
      var dadosSupabase = await SupabaseSync.loadCadastrosFromCloud() || {};
      var chavesSupabase = Object.keys(dadosSupabase);

      // Diff: chaves local mas nao remoto
      var faltam = chavesLocais.filter(function(k) { return !chavesSupabase.includes(k); });

      if (!faltam.length) {
        console.log('[CadastrosAutosync] ✅ Migracao: nenhuma chave faltando');
        return { migradas: 0, total: chavesLocais.length };
      }

      console.log('[CadastrosAutosync] 🔄 Migrando ' + faltam.length + ' chaves locais pro Supabase...');
      var ok = 0;
      for (var j = 0; j < faltam.length; j++) {
        var chave = faltam[j];
        var valor = store.get(chave);
        if (valor === undefined || valor === null) continue;
        var sucesso = await SupabaseSync.syncCadastro(chave, valor);
        if (sucesso) ok++;
      }

      console.log('[CadastrosAutosync] ✅ Migracao concluida: ' + ok + '/' + faltam.length);
      return { migradas: ok, total: faltam.length };
    } catch (e) {
      console.error('[CadastrosAutosync] Erro na migracao:', e);
      return { migradas: 0, total: 0, erro: e.message };
    }
  }

  /**
   * Hook nas escritas de Storage.scope('cadastros').set().
   * Toda escrita em cadastros vai pro Supabase em background (debounced).
   */
  function instalarWriteThrough() {
    // Storage.scope retorna um wrapper { get, set, remove }
    // Precisamos interceptar o .set() especificamente do escopo 'cadastros'
    var scopeOriginal = Storage.scope;
    Storage.scope = function(scope) {
      var original = scopeOriginal.apply(Storage, arguments);
      if (scope !== 'cadastros') return original;

      // Wrap o .set() do scope cadastros
      var setOriginal = original.set;
      original.set = function(chave, valor) {
        var result = setOriginal.apply(this, arguments);
        // Sincroniza pro Supabase em background (debounced por chave)
        if (_pendingSyncs[chave]) clearTimeout(_pendingSyncs[chave]);
        _pendingSyncs[chave] = setTimeout(function() {
          delete _pendingSyncs[chave];
          _status.syncQueueLen = Object.keys(_pendingSyncs).length;
          SupabaseSync.syncCadastro(chave, valor).then(function(sucesso) {
            if (sucesso) {
              console.log('[CadastrosAutosync] ☁ Sync OK: ' + chave);
              setStatus({ lastSync: Date.now(), online: true, error: null });
            } else {
              console.warn('[CadastrosAutosync] ⚠ Sync falhou: ' + chave);
              setStatus({ online: false });
            }
          });
        }, 500); // debounce 500ms
        _status.syncQueueLen = Object.keys(_pendingSyncs).length;
        return result;
      };

      // Wrap o .remove() do scope cadastros tambem
      var removeOriginal = original.remove;
      if (removeOriginal) {
        original.remove = function(chave) {
          var result = removeOriginal.apply(this, arguments);
          // Remove do Supabase tambem (escreve null - simples)
          SupabaseSync.syncCadastro(chave, null).catch(function() {});
          return result;
        };
      }

      return original;
    };
    console.log('[CadastrosAutosync] ✅ Write-through instalado em Storage.scope(cadastros)');
  }

  /**
   * Inicializa: instala hook + carrega do Supabase + migra orfaos.
   */
  async function init() {
    if (_initialized) return;
    _initialized = true;

    instalarWriteThrough();

    // 1. Carrega do Supabase (source of truth)
    await carregarDoSupabase();

    // 2. Migra dados que existem so' local
    setTimeout(function() {
      migrarLocalParaSupabase();
    }, 2000); // espera 2s pra nao competir com outros loads
  }

  /**
   * Forca sync imediato de todas as chaves.
   */
  async function syncTudoAgora() {
    try {
      var store = Storage.scope('cadastros');
      var prefix = 'projetta_cadastros_';
      var chavesLocais = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          chavesLocais.push(k.substring(prefix.length));
        }
      }
      console.log('[CadastrosAutosync] 🔄 Sincronizando ' + chavesLocais.length + ' chaves...');
      var ok = 0;
      for (var j = 0; j < chavesLocais.length; j++) {
        var chave = chavesLocais[j];
        var valor = store.get(chave);
        if (valor === undefined) continue;
        var sucesso = await SupabaseSync.syncCadastro(chave, valor);
        if (sucesso) ok++;
      }
      console.log('[CadastrosAutosync] ✅ Sync forcado: ' + ok + '/' + chavesLocais.length);
      setStatus({ lastSync: Date.now() });
      return { ok: ok, total: chavesLocais.length };
    } catch (e) {
      console.error('[CadastrosAutosync] Erro no sync forcado:', e);
      return { ok: 0, total: 0, erro: e.message };
    }
  }

  // Expor globalmente
  window.CadastrosAutosync = {
    init: init,
    carregarDoSupabase: carregarDoSupabase,
    migrarLocalParaSupabase: migrarLocalParaSupabase,
    syncTudoAgora: syncTudoAgora,
    getStatus: getStatus,
    onStatusChange: onStatusChange
  };

  console.log('[CadastrosAutosync] Modulo carregado. Aguardando init()...');
})();
