/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.posorc.revisoes — Submódulo de leitura/gestão de revisões
 * ─────────────────────────────────────────────────────────────────────
 *
 * RESPONSABILIDADE ÚNICA: ler crm_revisoes e fazer gestão (soft delete,
 * restaurar). Nunca modifica o card — isso é do submódulo pipeline.
 *
 * CONTRATO:
 *   - Leituras sempre filtram deletado_em IS NULL (exceto se pedido).
 *   - Apagar = UPDATE deletado_em = NOW(). NUNCA DELETE FROM.
 *   - Desfazer apagar = UPDATE deletado_em = NULL.
 *   - Retorna objetos Supabase padronizados.
 *
 * API PÚBLICA:
 *   PROJETTA.posorc.revisoes.listar(cardId, opcoes)
 *     → Promise<Revisao[]>
 *
 *   PROJETTA.posorc.revisoes.carregar(revId)
 *     → Promise<Revisao>  (com snapshot + memorial completos)
 *
 *   PROJETTA.posorc.revisoes.apagar(revId, motivo)
 *     → Promise<void>  (soft delete)
 *
 *   PROJETTA.posorc.revisoes.desfazerApagar(revId)
 *     → Promise<void>
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.posorc = window.PROJETTA.posorc || {};

(function(ns){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _headers(extra){
    var h = {
      'apikey':        ANON_KEY,
      'Authorization': 'Bearer ' + ANON_KEY,
      'Content-Type':  'application/json'
    };
    if(extra){ for(var k in extra) h[k] = extra[k]; }
    return h;
  }

  function _userName(){
    try { return localStorage.getItem('projetta_user_name') || 'anon'; }
    catch(e){ return 'anon'; }
  }

  ns.revisoes = {
    version: '1.0',

    /**
     * Lista revisões de um card.
     * @param {string} cardId
     * @param {object} opcoes - { incluirDeletadas?: bool }
     * @returns {Promise<Revisao[]>}
     */
    async listar(cardId, opcoes){
      if(!cardId) return [];
      opcoes = opcoes || {};
      var cols = 'id,rev_num,label,data,valor_tabela,valor_faturamento,' +
                 'pdf_cloud,crm_pronto,deletado_em,created_at,created_by';
      var url = SUPABASE_URL + '/rest/v1/crm_revisoes'
              + '?opp_id=eq.' + encodeURIComponent(cardId)
              + '&select=' + cols
              + '&order=rev_num.desc';
      if(!opcoes.incluirDeletadas){
        url += '&deletado_em=is.null';
      }
      var res = await fetch(url, { headers: _headers() });
      if(!res.ok){
        throw new Error('[posorc.revisoes] listar falhou: HTTP ' + res.status);
      }
      return await res.json();
    },

    /**
     * Carrega 1 revisão completa (com snapshot e memorial).
     * @param {string} revId
     * @returns {Promise<Revisao>}
     */
    async carregar(revId){
      if(!revId) throw new Error('[posorc.revisoes] revId obrigatório');
      var url = SUPABASE_URL + '/rest/v1/crm_revisoes'
              + '?id=eq.' + encodeURIComponent(revId)
              + '&select=*&limit=1';
      var res = await fetch(url, { headers: _headers() });
      if(!res.ok){
        throw new Error('[posorc.revisoes] carregar falhou: HTTP ' + res.status);
      }
      var arr = await res.json();
      if(!arr.length){
        throw new Error('[posorc.revisoes] revisão não encontrada: ' + revId);
      }
      return arr[0];
    },

    /**
     * Soft delete — marca deletado_em. Dado continua no banco.
     * @param {string} revId
     * @param {string} motivo (opcional)
     * @returns {Promise<void>}
     */
    async apagar(revId, motivo){
      if(!revId) throw new Error('[posorc.revisoes] revId obrigatório');
      var body = {
        deletado_em:  new Date().toISOString(),
        deletado_por: _userName()
      };
      if(motivo){
        body.observacoes = motivo;
      }
      var url = SUPABASE_URL + '/rest/v1/crm_revisoes?id=eq.' + encodeURIComponent(revId);
      var res = await fetch(url, {
        method:  'PATCH',
        headers: _headers({ 'Prefer': 'return=minimal' }),
        body:    JSON.stringify(body)
      });
      if(!res.ok){
        var txt = await res.text();
        throw new Error('[posorc.revisoes] apagar falhou: HTTP ' + res.status + ' — ' + txt);
      }
      console.log('[posorc.revisoes] ✗ rev ' + revId.slice(0,8) + ' apagada (soft)');
    },

    /**
     * Desfaz soft delete (restaura a revisão).
     * @param {string} revId
     * @returns {Promise<void>}
     */
    async desfazerApagar(revId){
      if(!revId) throw new Error('[posorc.revisoes] revId obrigatório');
      var url = SUPABASE_URL + '/rest/v1/crm_revisoes?id=eq.' + encodeURIComponent(revId);
      var res = await fetch(url, {
        method:  'PATCH',
        headers: _headers({ 'Prefer': 'return=minimal' }),
        body:    JSON.stringify({ deletado_em: null, deletado_por: null })
      });
      if(!res.ok){
        throw new Error('[posorc.revisoes] desfazerApagar falhou: HTTP ' + res.status);
      }
      console.log('[posorc.revisoes] ↶ rev ' + revId.slice(0,8) + ' restaurada');
    }
  };

  console.log('[PROJETTA.posorc.revisoes] v' + ns.revisoes.version + ' carregado');
})(window.PROJETTA.posorc);
