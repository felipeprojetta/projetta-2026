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
    error: null,
    // Felipe sessao 2026-05: write-through SO ativa apos carregar do
    // Supabase com sucesso. Se o load falhar, o cache local pode estar
    // desatualizado e nao pode sobrescrever o servidor.
    writeThroughEnabled: false
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

      setStatus({ initialLoadDone: true, online: true, lastSync: Date.now(), error: null,
                  writeThroughEnabled: true });

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

  // ── Supabase Storage upload (bucket modelos-portas) ──
  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var STORAGE_BUCKET = 'modelos-portas';

  function dataUrlToBlob(dataUrl) {
    var arr = dataUrl.split(',');
    var mimeMatch = arr[0].match(/:(.*?);/);
    var mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    var bstr = atob(arr[1]);
    var n = bstr.length;
    var u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  }

  async function uploadImagemParaStorage(dataUrl, modeloNumero, tipo) {
    var blob = dataUrlToBlob(dataUrl);
    var ext = blob.type === 'image/png' ? 'png' : 'jpg';
    var numero = String(modeloNumero || 0).padStart(2, '0');
    var path = 'modelo-' + numero + '-' + tipo + '-' + Date.now() + '.' + ext;
    var url = SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path;
    var resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'apikey': SUPABASE_KEY,
        'Content-Type': blob.type,
        'x-upsert': 'true'
      },
      body: blob
    });
    if (!resp.ok) {
      var txt = await resp.text();
      throw new Error('HTTP ' + resp.status + ': ' + txt.substring(0, 100));
    }
    return SUPABASE_URL + '/storage/v1/object/public/' + STORAGE_BUCKET + '/' + path;
  }

  /**
   * Detecta imagens base64 em modelos_lista e migra pro Supabase Storage.
   * Substitui o campo img_1f/img_2f pela URL publica.
   * Retorna { migradas, falhas, total }
   */
  async function migrarImagensBase64ParaStorage() {
    try {
      var store = Storage.scope('cadastros');
      var modelos = store.get('modelos_lista');
      if (!modelos || !Array.isArray(modelos)) return { migradas: 0, falhas: 0, total: 0 };

      var totalBase64 = 0;
      modelos.forEach(function(m) {
        if (m.img_1f && typeof m.img_1f === 'string' && m.img_1f.startsWith('data:image/')) totalBase64++;
        if (m.img_2f && typeof m.img_2f === 'string' && m.img_2f.startsWith('data:image/')) totalBase64++;
      });

      if (totalBase64 === 0) {
        console.log('[CadastrosAutosync] ✅ Nenhuma imagem base64 para migrar');
        return { migradas: 0, falhas: 0, total: 0 };
      }

      console.log('[CadastrosAutosync] 🖼 Detectadas ' + totalBase64 + ' imagens base64 em modelos. Iniciando upload pro Storage...');
      showToast('🖼 Migrando ' + totalBase64 + ' imagens locais para o Supabase Storage. Aguarde...', 'info');

      var migradas = 0;
      var falhas = 0;
      for (var i = 0; i < modelos.length; i++) {
        var m = modelos[i];
        // 1F
        if (m.img_1f && typeof m.img_1f === 'string' && m.img_1f.startsWith('data:image/')) {
          try {
            var url1f = await uploadImagemParaStorage(m.img_1f, m.numero, '1f');
            m.img_1f = url1f;
            migradas++;
            console.log('  ✓ Modelo ' + m.numero + ' (1F): ' + url1f.substring(url1f.lastIndexOf('/') + 1));
          } catch (e) {
            falhas++;
            console.error('  ✗ Modelo ' + m.numero + ' (1F): ' + e.message);
          }
        }
        // 2F
        if (m.img_2f && typeof m.img_2f === 'string' && m.img_2f.startsWith('data:image/')) {
          try {
            var url2f = await uploadImagemParaStorage(m.img_2f, m.numero, '2f');
            m.img_2f = url2f;
            migradas++;
            console.log('  ✓ Modelo ' + m.numero + ' (2F): ' + url2f.substring(url2f.lastIndexOf('/') + 1));
          } catch (e) {
            falhas++;
            console.error('  ✗ Modelo ' + m.numero + ' (2F): ' + e.message);
          }
        }
      }

      // Salva modelos_lista atualizado (sem base64) - vai disparar autosync
      store.set('modelos_lista', modelos);

      console.log('[CadastrosAutosync] ✅ Migracao de imagens: ' + migradas + ' OK, ' + falhas + ' falhas, total ' + totalBase64);
      if (migradas > 0) {
        showToast('✅ ' + migradas + ' imagens migradas para o Supabase Storage. Suas imagens nao se perdem mais!', 'sucesso');
      }
      if (falhas > 0) {
        showToast('⚠ ' + falhas + ' imagens falharam ao subir. Tente novamente.', 'erro');
      }
      return { migradas: migradas, falhas: falhas, total: totalBase64 };
    } catch (e) {
      console.error('[CadastrosAutosync] Erro migracao imagens:', e);
      showToast('❌ Erro migrando imagens: ' + e.message, 'erro');
      return { migradas: 0, falhas: 0, total: 0, erro: e.message };
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
    var scopeOriginal = Storage.scope;
    Storage.scope = function(scope) {
      var original = scopeOriginal.apply(Storage, arguments);
      if (scope !== 'cadastros') return original;

      // Wrap o .set() do scope cadastros
      var setOriginal = original.set;
      original.set = function(chave, valor) {
        var result = setOriginal.apply(this, arguments);

        // ── PROTECAO #1: write-through so opera apos load inicial OK ──
        // Se Supabase nao foi carregado com sucesso no boot, NAO sobrescrever
        // o servidor com dados locais (que podem estar desatualizados).
        if (!_status.writeThroughEnabled) {
          console.warn('[CadastrosAutosync] ⚠ Write bloqueado: load inicial nao concluiu.', chave);
          return result;
        }

        // ── PROTECAO #2: deteccao de perda de dados ──
        // Antes de sobrescrever, busca valor atual no Supabase. Se o valor
        // que vai subir for SIGNIFICATIVAMENTE menor (perdeu dados), bloqueia
        // e mostra alerta. Aceita ate 30% de reducao (edicao normal).
        if (_pendingSyncs[chave]) clearTimeout(_pendingSyncs[chave]);
        _pendingSyncs[chave] = setTimeout(async function() {
          delete _pendingSyncs[chave];
          _status.syncQueueLen = Object.keys(_pendingSyncs).length;

          try {
            var bytesNovo = JSON.stringify(valor || '').length;
            // Busca valor atual no Supabase pra comparar
            var atualServidor = await SupabaseSync.fetchCadastro(chave);
            var bytesServidor = atualServidor ? JSON.stringify(atualServidor).length : 0;

            // Se o que vai subir tem MENOS de 50% do tamanho atual no
            // servidor, e' suspeito (perda de dados). Bloqueia.
            if (bytesServidor > 0 && bytesNovo < bytesServidor * 0.5 && bytesServidor > 1000) {
              console.error('[CadastrosAutosync] 🛑 SYNC BLOQUEADO em "' + chave + '": ' +
                bytesNovo + ' bytes vs ' + bytesServidor + ' bytes no servidor. Perda detectada.');
              showToast('🛑 ALERTA: edicao em "' + chave + '" foi bloqueada (perda de dados detectada). ' +
                'Recarregue a pagina pra sincronizar.', 'erro');
              setStatus({ error: 'perda_detectada:' + chave });
              return;
            }

            var sucesso = await SupabaseSync.syncCadastro(chave, valor);
            if (sucesso) {
              console.log('[CadastrosAutosync] ☁ Sync OK: ' + chave + ' (' + bytesNovo + ' bytes)');
              setStatus({ lastSync: Date.now(), online: true, error: null });
            } else {
              console.warn('[CadastrosAutosync] ⚠ Sync falhou: ' + chave);
              setStatus({ online: false });
            }
          } catch (e) {
            console.error('[CadastrosAutosync] Erro no sync de ' + chave + ':', e);
            setStatus({ online: false, error: e.message });
          }
        }, 500); // debounce 500ms
        _status.syncQueueLen = Object.keys(_pendingSyncs).length;
        return result;
      };

      // Wrap o .remove() do scope cadastros tambem
      var removeOriginal = original.remove;
      if (removeOriginal) {
        original.remove = function(chave) {
          var result = removeOriginal.apply(this, arguments);
          // Tambem so' se write-through esta habilitado
          if (_status.writeThroughEnabled) {
            SupabaseSync.syncCadastro(chave, null).catch(function() {});
          }
          return result;
        };
      }

      return original;
    };
    console.log('[CadastrosAutosync] ✅ Write-through instalado (com protecoes anti-perda)');
  }

  /**
   * Mostra toast visual na tela (sem precisar de console)
   */
  function showToast(mensagem, tipo) {
    var color = tipo === 'erro' ? '#c62828' : tipo === 'sucesso' ? '#2e7d32' : '#1565c0';
    var icone = tipo === 'erro' ? '❌' : tipo === 'sucesso' ? '✅' : 'ℹ️';
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:20px;right:20px;left:20px;max-width:500px;margin:0 auto;background:#fff;border-left:4px solid ' + color + ';padding:14px 18px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:99999;font-size:14px;line-height:1.4;color:#333';
    div.innerHTML = '<div style="display:flex;gap:10px;align-items:flex-start"><span style="font-size:20px">' + icone + '</span><div style="flex:1">' + mensagem + '</div><button style="background:none;border:none;font-size:18px;cursor:pointer;color:#888;padding:0 4px" onclick="this.parentElement.parentElement.remove()">×</button></div>';
    document.body.appendChild(div);
    setTimeout(function() {
      if (div.parentElement) {
        div.style.transition = 'opacity 0.3s';
        div.style.opacity = '0';
        setTimeout(function() { if (div.parentElement) div.remove(); }, 300);
      }
    }, 6000);
  }

  /**
   * Inicializa: instala hook + carrega do Supabase + migra orfaos.
   */
  async function init() {
    if (_initialized) return;
    _initialized = true;

    instalarWriteThrough();

    // 1. Carrega do Supabase (source of truth)
    var loadOk = await carregarDoSupabase();

    if (loadOk) {
      var statusAtual = getStatus();
      // Toast visual se conseguiu carregar
      var qtdItens = 0;
      try {
        var prefix = 'projetta_cadastros_';
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.startsWith(prefix)) qtdItens++;
        }
      } catch (_) {}
      showToast('☁ Conectado ao Supabase. ' + qtdItens + ' cadastros disponiveis.', 'sucesso');
    } else {
      // Felipe sessao 2026-05: nesta situacao writeThroughEnabled=false
      // Por seguranca, nada vai pro servidor ate proxima recarga com sucesso.
      showToast('⚠ Sem conexao com o servidor. Nao edite cadastros agora — recarregue a pagina pra reconectar antes de fazer alteracoes.', 'erro');
    }

    // 2. Migrar imagens base64 → Storage PRIMEIRO (importante: antes do sync genérico)
    setTimeout(async function() {
      await migrarImagensBase64ParaStorage();
      // Depois migra cadastros restantes
      var resultado = await migrarLocalParaSupabase();
      if (resultado && resultado.migradas > 0) {
        showToast('✅ ' + resultado.migradas + ' cadastros migrados para o Supabase. Voce nao vai perder mais dados!', 'sucesso');
      }
    }, 2000);
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
    migrarImagensBase64ParaStorage: migrarImagensBase64ParaStorage,
    syncTudoAgora: syncTudoAgora,
    getStatus: getStatus,
    onStatusChange: onStatusChange
  };

  console.log('[CadastrosAutosync] Modulo carregado. Aguardando init()...');
})();
