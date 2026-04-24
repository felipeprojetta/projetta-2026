/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.projeto.persistencia — CRUD dos campos do PROJETO no Supabase
 * ─────────────────────────────────────────────────────────────────────
 * Atualiza/lê somente campos de projeto de crm_oportunidades. Nunca toca
 * em cliente, valores, itens, revisões, extras do orçamento.
 *
 * Todos os campos de projeto são COLUNAS diretas (nenhum em extras),
 * então é mais simples que o bloco cliente.
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.projeto = window.PROJETTA.projeto || {};

(function(ns){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  var COLUNAS = ['produto','modelo','largura','altura','folhas','abertura',
                 'reserva','agp','origem','prioridade','potencial',
                 'responsavel','wrep','data_contato','previsao','fechamento','notas'];

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

  function _filtrarCampos(dados){
    var out = {};
    for(var k in dados){
      if(COLUNAS.indexOf(k) >= 0){
        // Datas vazias viram null pra evitar erro de cast
        if(['data_contato','previsao','fechamento'].indexOf(k) >= 0 &&
           (dados[k] === '' || dados[k] == null)){
          out[k] = null;
        } else {
          out[k] = dados[k];
        }
      }
    }
    return out;
  }

  ns.persistencia = {
    version: '1.0',
    COLUNAS: COLUNAS,

    async ler(cardId){
      if(!cardId) throw new Error('[projeto.persistencia] cardId obrigatório');
      var url = SUPABASE_URL + '/rest/v1/crm_oportunidades'
              + '?id=eq.' + encodeURIComponent(cardId)
              + '&select=' + COLUNAS.join(',') + '&limit=1';
      var res = await fetch(url, { headers: _headers() });
      if(!res.ok) throw new Error('[projeto.persistencia] HTTP ' + res.status);
      var arr = await res.json();
      if(!arr.length) return null;
      return arr[0];
    },

    async atualizar(cardId, dados){
      if(!cardId) throw new Error('[projeto.persistencia] cardId obrigatório');
      if(!dados || typeof dados !== 'object') throw new Error('[projeto.persistencia] dados obrigatórios');

      var body = _filtrarCampos(dados);
      if(Object.keys(body).length === 0){
        console.warn('[projeto.persistencia] nenhum campo válido pra atualizar');
        return true;
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
        throw new Error('[projeto.persistencia] HTTP ' + res.status + ' — ' + txt);
      }
      console.log('%c[projeto.persistencia] ✓ ' + cardId.slice(0,8) + ' atualizado (' +
                  Object.keys(body).length + ' campos)',
                  'color:#27ae60;font-weight:500');
      return true;
    }
  };

  console.log('[PROJETTA.projeto.persistencia] v' + ns.persistencia.version + ' carregado');
})(window.PROJETTA.projeto);
