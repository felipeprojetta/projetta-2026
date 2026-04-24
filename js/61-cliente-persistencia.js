/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.cliente.persistencia — CRUD dos campos do CLIENTE em Supabase
 * ─────────────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: ler e atualizar SOMENTE os campos do cliente
 * em crm_oportunidades. Nunca toca valores, stage, itens, revisões.
 *
 * Separa automaticamente os campos entre COLUNAS diretas da tabela e
 * campos dentro do JSONB extras — e faz merge em extras (nunca sobrescreve
 * o JSONB inteiro pra não perder dados de outros contextos).
 *
 * API:
 *   PROJETTA.cliente.persistencia.ler(cardId) → Promise<{cliente, ...}|null>
 *   PROJETTA.cliente.persistencia.atualizar(cardId, dados) → Promise<true>
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.cliente = window.PROJETTA.cliente || {};

(function(ns){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  var COLUNAS = ['cliente','scope','pais','estado','cidade','cep','telefone','email','endereco'];
  var EXTRAS  = ['contato'];

  function _headers(extra){
    var h = {
      apikey:         ANON_KEY,
      Authorization:  'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };
    if(extra) for(var k in extra) h[k] = extra[k];
    return h;
  }

  function _userName(){
    try { return localStorage.getItem('projetta_user_name') || 'anon'; } catch(e) { return 'anon'; }
  }

  function _split(dados){
    var col = {}, ext = {};
    for(var k in dados){
      if(COLUNAS.indexOf(k) >= 0)      col[k] = dados[k];
      else if(EXTRAS.indexOf(k) >= 0)  ext[k] = dados[k];
      // Campos fora do schema são ignorados (proteção)
    }
    return { col: col, ext: ext };
  }

  async function _getCurrentExtras(cardId){
    var url = SUPABASE_URL + '/rest/v1/crm_oportunidades'
            + '?id=eq.' + encodeURIComponent(cardId)
            + '&select=extras&limit=1';
    var res = await fetch(url, { headers: _headers() });
    if(!res.ok) throw new Error('[cliente.persistencia] HTTP ' + res.status + ' ao ler extras');
    var arr = await res.json();
    if(!arr.length) throw new Error('[cliente.persistencia] card não encontrado: ' + cardId);
    return arr[0].extras || {};
  }

  ns.persistencia = {
    version: '1.0',
    COLUNAS: COLUNAS,
    EXTRAS:  EXTRAS,

    async ler(cardId){
      if(!cardId) throw new Error('[cliente.persistencia] cardId obrigatório');
      var cols = COLUNAS.join(',') + ',extras';
      var url  = SUPABASE_URL + '/rest/v1/crm_oportunidades'
               + '?id=eq.' + encodeURIComponent(cardId)
               + '&select=' + cols + '&limit=1';
      var res = await fetch(url, { headers: _headers() });
      if(!res.ok) throw new Error('[cliente.persistencia] HTTP ' + res.status);
      var arr = await res.json();
      if(!arr.length) return null;
      var row = arr[0];
      var out = {};
      COLUNAS.forEach(function(c){ out[c] = row[c]; });
      var extras = row.extras || {};
      EXTRAS.forEach(function(e){ out[e] = extras[e] || null; });
      return out;
    },

    async atualizar(cardId, dados){
      if(!cardId) throw new Error('[cliente.persistencia] cardId obrigatório');
      if(!dados || typeof dados !== 'object') throw new Error('[cliente.persistencia] dados obrigatórios');

      var split = _split(dados);

      // Se nada pra atualizar, evita chamada HTTP desnecessária
      if(Object.keys(split.col).length === 0 && Object.keys(split.ext).length === 0){
        console.warn('[cliente.persistencia] nenhum campo válido pra atualizar');
        return true;
      }

      var body = {};
      for(var k in split.col) body[k] = split.col[k];

      // Merge em extras (não sobrescreve JSONB inteiro)
      if(Object.keys(split.ext).length > 0){
        var current = await _getCurrentExtras(cardId);
        for(var ek in split.ext) current[ek] = split.ext[ek];
        body.extras = current;
      }

      body.updated_at = new Date().toISOString();
      body.updated_by = _userName();

      var url = SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId);
      var res = await fetch(url, {
        method:  'PATCH',
        headers: _headers({ Prefer: 'return=minimal' }),
        body:    JSON.stringify(body)
      });
      if(!res.ok){
        var txt = await res.text();
        throw new Error('[cliente.persistencia] HTTP ' + res.status + ' — ' + txt);
      }
      console.log('%c[cliente.persistencia] ✓ ' + cardId.slice(0,8) + ' atualizado (' +
                  Object.keys(dados).length + ' campos)',
                  'color:#27ae60;font-weight:500');
      return true;
    }
  };

  console.log('[PROJETTA.cliente.persistencia] v' + ns.persistencia.version + ' carregado');
})(window.PROJETTA.cliente);
