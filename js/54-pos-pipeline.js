/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.posorc.pipeline — Submódulo de ligação rev↔card
 * ─────────────────────────────────────────────────────────────────────
 *
 * RESPONSABILIDADE ÚNICA: gerenciar qual revisão está ativa no pipeline
 * de um card. Atualiza crm_oportunidades.rev_pipeline_id + valores
 * agregados (valor, valor_tabela, valor_faturamento) pra queries rápidas.
 *
 * CONTRATO:
 *   - Nunca escreve em crm_revisoes. Só lê.
 *   - Só escreve em crm_oportunidades nos campos: rev_pipeline_id,
 *     valor, valor_tabela, valor_faturamento, updated_at, updated_by.
 *   - Card nunca é criado — só atualizado. Se o card não existe, erro.
 *   - Desmarcar = zerar os 3 valores + NULL em rev_pipeline_id.
 *
 * API PÚBLICA:
 *   PROJETTA.posorc.pipeline.marcar(cardId, revId)
 *     → Promise<void>
 *
 *   PROJETTA.posorc.pipeline.desmarcar(cardId)
 *     → Promise<void>
 *
 *   PROJETTA.posorc.pipeline.lerAtiva(cardId)
 *     → Promise<Revisao|null>
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

  async function _lerRev(revId){
    var url = SUPABASE_URL + '/rest/v1/crm_revisoes'
            + '?id=eq.' + encodeURIComponent(revId)
            + '&select=id,opp_id,valor_tabela,valor_faturamento&limit=1';
    var res = await fetch(url, { headers: _headers() });
    if(!res.ok) throw new Error('[posorc.pipeline] ler rev falhou: HTTP ' + res.status);
    var arr = await res.json();
    return arr.length ? arr[0] : null;
  }

  async function _patchCard(cardId, campos){
    var body = Object.assign({
      updated_at: new Date().toISOString(),
      updated_by: _userName()
    }, campos);
    var url = SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId);
    var res = await fetch(url, {
      method:  'PATCH',
      headers: _headers({ 'Prefer': 'return=minimal' }),
      body:    JSON.stringify(body)
    });
    if(!res.ok){
      var txt = await res.text();
      throw new Error('[posorc.pipeline] patch card falhou: HTTP ' + res.status + ' — ' + txt);
    }
  }

  ns.pipeline = {
    version: '1.0',

    /**
     * Marca uma revisão como ativa no pipeline do card.
     * Atualiza rev_pipeline_id + espelha valor_tabela/valor_faturamento.
     * @param {string} cardId
     * @param {string} revId
     * @returns {Promise<void>}
     */
    async marcar(cardId, revId){
      if(!cardId) throw new Error('[posorc.pipeline] cardId obrigatório');
      if(!revId)  throw new Error('[posorc.pipeline] revId obrigatório');
      var rev = await _lerRev(revId);
      if(!rev) throw new Error('[posorc.pipeline] revisão não encontrada: ' + revId);
      if(rev.opp_id !== cardId){
        throw new Error('[posorc.pipeline] revisão pertence a outro card: '
                        + rev.opp_id + ' (esperado ' + cardId + ')');
      }
      await _patchCard(cardId, {
        rev_pipeline_id:   revId,
        valor:             parseFloat(rev.valor_faturamento) || 0,
        valor_tabela:      parseFloat(rev.valor_tabela)      || 0,
        valor_faturamento: parseFloat(rev.valor_faturamento) || 0
      });
      console.log('[posorc.pipeline] ↦ rev ' + revId.slice(0,8) + ' marcada como ativa em ' + cardId.slice(0,8));
    },

    /**
     * Desmarca (pipeline volta a 0).
     * @param {string} cardId
     * @returns {Promise<void>}
     */
    async desmarcar(cardId){
      if(!cardId) throw new Error('[posorc.pipeline] cardId obrigatório');
      await _patchCard(cardId, {
        rev_pipeline_id:   null,
        valor:             0,
        valor_tabela:      0,
        valor_faturamento: 0
      });
      console.log('[posorc.pipeline] ∅ pipeline desmarcado em ' + cardId.slice(0,8));
    },

    /**
     * Lê qual revisão está ativa no pipeline (com detalhes).
     * @param {string} cardId
     * @returns {Promise<Revisao|null>}
     */
    async lerAtiva(cardId){
      if(!cardId) return null;
      var urlCard = SUPABASE_URL + '/rest/v1/crm_oportunidades'
                  + '?id=eq.' + encodeURIComponent(cardId)
                  + '&select=rev_pipeline_id&limit=1';
      var resCard = await fetch(urlCard, { headers: _headers() });
      if(!resCard.ok) return null;
      var arr = await resCard.json();
      if(!arr.length || !arr[0].rev_pipeline_id) return null;
      var revId = arr[0].rev_pipeline_id;

      var urlRev = SUPABASE_URL + '/rest/v1/crm_revisoes'
                 + '?id=eq.' + encodeURIComponent(revId)
                 + '&select=*&limit=1';
      var resRev = await fetch(urlRev, { headers: _headers() });
      if(!resRev.ok) return null;
      var arrRev = await resRev.json();
      return arrRev.length ? arrRev[0] : null;
    }
  };

  console.log('[PROJETTA.posorc.pipeline] v' + ns.pipeline.version + ' carregado');
})(window.PROJETTA.posorc);
