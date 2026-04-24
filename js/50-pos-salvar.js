/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.posorc.salvar — Submódulo de salvamento de revisão
 * ─────────────────────────────────────────────────────────────────────
 *
 * RESPONSABILIDADE ÚNICA: gravar uma revisão imutável em crm_revisoes.
 *
 * CONTRATO:
 *   - INSERT-only: cada chamada cria UM registro novo. Nunca UPDATE.
 *   - Síncrono de ponta a ponta: só resolve após HTTP 200 com o id real.
 *   - Validação estrita: cardId e valores são obrigatórios.
 *   - Zero dependência: usa só fetch + Supabase REST.
 *
 * API PÚBLICA:
 *   PROJETTA.posorc.salvar.revisao(cardId, dados)
 *     → Promise<{id, revNum, label, data, cardId}>
 *
 *   dados = {
 *     valorTabela:      number     (obrigatório, >= 0)
 *     valorFaturamento: number     (obrigatório, >= 0)
 *     snapshot:         object     (obrigatório, form completo)
 *     memorial:         object?    (opcional)
 *     pdfUrl:           string?    (opcional — pode ser anexado depois)
 *     pdfPages:         object?    (opcional — array de URLs das PNGs)
 *     observacoes:      string?    (opcional)
 *     crmPronto:        boolean?   (opcional, default true)
 *     usuario:          string?    (opcional, default 'anon')
 *   }
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

  function _validar(cardId, dados){
    if(!cardId || typeof cardId !== 'string'){
      throw new Error('[posorc.salvar] cardId obrigatório (string)');
    }
    if(!dados || typeof dados !== 'object'){
      throw new Error('[posorc.salvar] dados obrigatórios (object)');
    }
    var vt = parseFloat(dados.valorTabela);
    var vf = parseFloat(dados.valorFaturamento);
    if(isNaN(vt) || vt < 0){
      throw new Error('[posorc.salvar] valorTabela inválido: ' + dados.valorTabela);
    }
    if(isNaN(vf) || vf < 0){
      throw new Error('[posorc.salvar] valorFaturamento inválido: ' + dados.valorFaturamento);
    }
    if(!dados.snapshot || typeof dados.snapshot !== 'object'){
      throw new Error('[posorc.salvar] snapshot obrigatório (object)');
    }
  }

  async function _proximoRevNum(cardId){
    var url = SUPABASE_URL + '/rest/v1/crm_revisoes'
            + '?opp_id=eq.' + encodeURIComponent(cardId)
            + '&select=rev_num&order=rev_num.desc&limit=1';
    var res = await fetch(url, { headers: _headers() });
    if(!res.ok){
      throw new Error('[posorc.salvar] falha ao ler última revisão: HTTP ' + res.status);
    }
    var arr = await res.json();
    if(arr.length === 0) return 1;
    return parseInt(arr[0].rev_num, 10) + 1;
  }

  async function _insert(cardId, revNum, dados){
    var body = {
      opp_id:            cardId,
      rev_num:           revNum,
      label:             'Revisão ' + revNum,
      data:              new Date().toISOString(),
      valor_tabela:      parseFloat(dados.valorTabela),
      valor_faturamento: parseFloat(dados.valorFaturamento),
      snapshot:          dados.snapshot,
      memorial:          dados.memorial || null,
      pdf_cloud:         dados.pdfUrl || null,
      pdf_pages:         dados.pdfPages || null,
      crm_pronto:        dados.crmPronto !== false,
      observacoes:       dados.observacoes || null,
      created_by:        dados.usuario || 'anon'
    };
    var res = await fetch(SUPABASE_URL + '/rest/v1/crm_revisoes', {
      method:  'POST',
      headers: _headers({ 'Prefer': 'return=representation' }),
      body:    JSON.stringify(body)
    });
    if(!res.ok){
      var txt = await res.text();
      throw new Error('[posorc.salvar] INSERT falhou: HTTP ' + res.status + ' — ' + txt);
    }
    var arr = await res.json();
    if(!arr || !arr.length){
      throw new Error('[posorc.salvar] INSERT retornou resposta vazia');
    }
    return arr[0];
  }

  ns.salvar = {
    version: '1.0',

    /**
     * Grava uma nova revisão imutável em crm_revisoes.
     * @param {string} cardId - id do card em crm_oportunidades
     * @param {object} dados  - payload completo (ver contrato no topo)
     * @returns {Promise<{id, revNum, label, data, cardId}>}
     */
    async revisao(cardId, dados){
      _validar(cardId, dados);
      var revNum   = await _proximoRevNum(cardId);
      var inserida = await _insert(cardId, revNum, dados);
      console.log('%c[posorc.salvar] ✓ rev ' + revNum + ' gravada (id=' + inserida.id.slice(0,8) + ')',
                  'color:#27ae60;font-weight:500');
      return {
        id:     inserida.id,
        revNum: inserida.rev_num,
        label:  inserida.label,
        data:   inserida.data,
        cardId: inserida.opp_id
      };
    }
  };

  console.log('[PROJETTA.posorc.salvar] v' + ns.salvar.version + ' carregado');
})(window.PROJETTA.posorc);
