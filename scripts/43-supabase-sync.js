/* 43-supabase-sync.js — Sync de orcamentos com Supabase (schema v7).

   Felipe (sessao 31): "precisamos criar banco de dados para gravar os
   dados dos orcamentos la dentro e poder rever quando quisermos".

   Estrategia: localStorage PRIMEIRO (offline-first), sync pro Supabase
   em background. Na abertura, puxa do Supabase pra localStorage (se
   mais recente). No save, grava em ambos.

   Tabelas v7:
     v7.negocios  — 1 row por negocio (id, lead_id, cliente, etc.)
     v7.opcoes    — 1 row por opcao (id, negocio_id, nome, posicao)
     v7.versoes   — 1 row por versao (id, opcao_id, itens JSONB, etc.)
     v7.cadastros — 1 row por chave de cadastro (perfis_lista, etc.)
*/

var SupabaseSync = (function() {
  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var SCHEMA = 'v7';

  var _online = true;
  var _syncStatus = 'idle';  // idle | syncing | error | ok

  // ── REST helpers ──
  function headers(write) {
    var h = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Accept-Profile': SCHEMA,
      'Prefer': 'return=representation',
    };
    if (write) {
      h['Content-Type'] = 'application/json';
      h['Content-Profile'] = SCHEMA;
    }
    return h;
  }

  function restUrl(table, query) {
    return SUPABASE_URL + '/rest/v1/' + table + (query || '');
  }

  // ── CRUD genérico ──

  async function selectAll(table, queryParams) {
    try {
      var res = await fetch(restUrl(table, queryParams || ''), { headers: headers(false) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[SupabaseSync] selectAll ' + table + ' falhou:', e.message);
      _online = false;
      return null;
    }
  }

  async function upsertRow(table, row) {
    try {
      var res = await fetch(restUrl(table), {
        method: 'POST',
        headers: Object.assign(headers(true), {
          'Prefer': 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(row),
      });
      if (!res.ok) {
        var txt = await res.text();
        throw new Error('HTTP ' + res.status + ': ' + txt);
      }
      _online = true;
      return true;
    } catch (e) {
      console.warn('[SupabaseSync] upsert ' + table + ' falhou:', e.message);
      _online = false;
      return false;
    }
  }

  async function upsertRows(table, rows) {
    if (!rows || !rows.length) return true;
    try {
      var res = await fetch(restUrl(table), {
        method: 'POST',
        headers: Object.assign(headers(true), {
          'Prefer': 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(rows),
      });
      if (!res.ok) {
        var txt = await res.text();
        throw new Error('HTTP ' + res.status + ': ' + txt);
      }
      _online = true;
      return true;
    } catch (e) {
      console.warn('[SupabaseSync] upsertRows ' + table + ' falhou:', e.message);
      _online = false;
      return false;
    }
  }

  // ── Sync negócios ──

  /**
   * Salva um negocio completo (negocio + opcoes + versoes) no Supabase.
   * Chamada apos cada saveAll() local.
   */
  async function syncNegocio(negocio) {
    if (!negocio || !negocio.id) return false;
    _syncStatus = 'syncing';

    // 1. Upsert negocio
    var negRow = {
      id: negocio.id,
      lead_id: negocio.leadId || negocio.lead_id || '',
      cliente: negocio.clienteNome || negocio.cliente || '',
      obra: negocio.obra || '',
      cidade: negocio.cidade || '',
      reserva: negocio.reserva || '',
      agp: negocio.agp || '',
      representante: negocio.representante || '',
    };
    var ok1 = await upsertRow('negocios', negRow);

    // 2. Upsert opcoes + versoes
    var opcoes = negocio.opcoes || [];
    for (var oi = 0; oi < opcoes.length; oi++) {
      var op = opcoes[oi];
      if (!op.id) continue;
      var opRow = {
        id: op.id,
        negocio_id: negocio.id,
        nome: op.nome || 'Opcao ' + (oi + 1),
        posicao: oi,
      };
      await upsertRow('opcoes', opRow);

      var versoes = op.versoes || [];
      for (var vi = 0; vi < versoes.length; vi++) {
        var v = versoes[vi];
        if (!v.id) continue;
        var vRow = {
          id: v.id,
          opcao_id: op.id,
          numero: vi + 1,
          status: v.status || 'aberta',
          itens: JSON.stringify(v.itens || []),
          custo_fab: JSON.stringify(v.custoFab || {}),
          custo_inst: JSON.stringify(v.custoInst || {}),
          lev_ajustes: JSON.stringify({}),
          resultado: JSON.stringify(v.resultado || {}),
        };
        await upsertRow('versoes', vRow);
      }
    }

    _syncStatus = ok1 ? 'ok' : 'error';
    return ok1;
  }

  /**
   * Sync TODOS os negocios de uma vez (chamada no saveAll).
   */
  async function syncAll(negocios) {
    if (!Array.isArray(negocios) || !negocios.length) return;
    _syncStatus = 'syncing';
    var ok = true;
    for (var i = 0; i < negocios.length; i++) {
      var r = await syncNegocio(negocios[i]);
      if (!r) ok = false;
    }
    _syncStatus = ok ? 'ok' : 'error';
    console.log('[SupabaseSync] syncAll:', ok ? 'OK' : 'ERRO', '(' + negocios.length + ' negocios)');
    return ok;
  }

  /**
   * Sync cadastros (perfis, superficies, modelos, acessorios, etc.)
   * Salva cada chave como 1 row em v7.cadastros.
   */
  async function syncCadastro(chave, valor) {
    return upsertRow('cadastros', {
      chave: chave,
      valor: JSON.stringify(valor),
    });
  }

  /**
   * Carrega todos os negocios do Supabase (startup).
   * Retorna array de negocios no mesmo formato do localStorage ou null se offline.
   */
  async function loadFromCloud() {
    var negocios = await selectAll('negocios', '?order=created_at.asc&deleted_at=is.null');
    if (!negocios || !Array.isArray(negocios)) return null;

    // Pra cada negocio, busca opcoes e versoes
    for (var ni = 0; ni < negocios.length; ni++) {
      var n = negocios[ni];
      n.leadId = n.lead_id;
      n.clienteNome = n.cliente;

      var opcoes = await selectAll('opcoes', '?negocio_id=eq.' + encodeURIComponent(n.id) + '&order=posicao.asc');
      n.opcoes = opcoes || [];

      for (var oi = 0; oi < n.opcoes.length; oi++) {
        var op = n.opcoes[oi];
        var versoes = await selectAll('versoes', '?opcao_id=eq.' + encodeURIComponent(op.id) + '&order=numero.asc');
        op.versoes = (versoes || []).map(function(v) {
          return {
            id: v.id,
            status: v.status,
            itens: typeof v.itens === 'string' ? JSON.parse(v.itens) : (v.itens || []),
            custoFab: typeof v.custo_fab === 'string' ? JSON.parse(v.custo_fab) : (v.custo_fab || {}),
            custoInst: typeof v.custo_inst === 'string' ? JSON.parse(v.custo_inst) : (v.custo_inst || {}),
            resultado: typeof v.resultado === 'string' ? JSON.parse(v.resultado) : (v.resultado || {}),
          };
        });
      }
    }

    return negocios;
  }

  /**
   * Carrega cadastros do Supabase.
   * Retorna {chave: valor} ou null se offline.
   */
  async function loadCadastrosFromCloud() {
    var rows = await selectAll('cadastros', '');
    if (!rows || !Array.isArray(rows)) return null;
    var out = {};
    rows.forEach(function(r) {
      try {
        out[r.chave] = typeof r.valor === 'string' ? JSON.parse(r.valor) : r.valor;
      } catch (_) {
        out[r.chave] = r.valor;
      }
    });
    return out;
  }

  // Status pra UI
  function getStatus() {
    return {
      online: _online,
      status: _syncStatus,
      url: SUPABASE_URL,
      schema: SCHEMA,
    };
  }

  // Expoe globalmente
  if (typeof window !== 'undefined') {
    window.SupabaseSync = {
      syncNegocio: syncNegocio,
      syncAll: syncAll,
      syncCadastro: syncCadastro,
      loadFromCloud: loadFromCloud,
      loadCadastrosFromCloud: loadCadastrosFromCloud,
      getStatus: getStatus,
    };
  }

  return {
    syncNegocio: syncNegocio,
    syncAll: syncAll,
    syncCadastro: syncCadastro,
    loadFromCloud: loadFromCloud,
    loadCadastrosFromCloud: loadCadastrosFromCloud,
    getStatus: getStatus,
  };
})();
