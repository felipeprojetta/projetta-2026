/* ============================================================================
 * js/00-pre-boot-clean.js  —  PRIMEIRO SCRIPT a rodar (28-abr-2026 v3)
 *
 * Felipe 28/04 v3: cache zumbi PERSISTENTE - cards aparecendo com valores
 * mesmo apos varios patches. Solucao agressiva: APAGAR projetta_crm_v1
 * INTEIRO antes de qualquer coisa, e reconstruir do banco.
 *
 * Garante que TODA pagina abra com estado fresco do banco. Sem chance de
 * cache antigo persistir entre sessoes.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta00Applied) return;
  window.__projetta00Applied = true;

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var CK = 'projetta_crm_v1';

  function rowToCard(row){
    var card = {};
    for(var k in row){ if(k !== 'extras') card[k] = row[k]; }
    if(row.extras && typeof row.extras === 'object'){
      for(var ek in row.extras){
        if(card[ek] == null || card[ek] === '') card[ek] = row.extras[ek];
        else if(!(ek in card)) card[ek] = row.extras[ek];
      }
      ['itens','opcoes','revisoes','inst_mo','inst_hotel','inst_alim','inst_carro',
       'inst_passagem','inst_seguro','inst_udigru','inst_cambio','inst_margem',
       'inst_aero','inst_dias','inst_pais','inst_quem','inst_porte','inst_valor',
       'inst_incoterm','inst_transp','inst_pessoas','opcaoAtivaId','parceiro_nome',
       'cif_caixa_a','cif_caixa_e','cif_caixa_l','cif_caixa_taxa',
       'cif_frete_maritimo','cif_frete_terrestre','fechamento_real',
       'inst_intl_total','cor_ext','cor_int','cor_macico','abertura',
       'contato','moldura_rev'].forEach(function(f){
        if(row.extras[f] !== undefined) card[f] = row.extras[f];
      });
    }
    if(row.created_at) card.createdAt = row.created_at;
    if(row.updated_at) card.updatedAt = row.updated_at;
    if(row.data_contato) card.dataContato = row.data_contato;
    if(row.valor_tabela !== undefined) card.valorTabela = parseFloat(row.valor_tabela) || 0;
    if(row.valor_faturamento !== undefined) card.valorFaturamento = parseFloat(row.valor_faturamento) || 0;
    return card;
  }

  function preBootSync(){
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET',
        SUPABASE_URL + '/rest/v1/crm_oportunidades?deleted_at=is.null&select=*&order=updated_at.desc',
        false);
      xhr.setRequestHeader('apikey', ANON_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + ANON_KEY);
      xhr.send();
      if(xhr.status >= 200 && xhr.status < 300){
        var rows = JSON.parse(xhr.responseText);
        var cards = rows.map(rowToCard);
        // ★ Felipe 28/04 v3: LIMPEZA AGRESSIVA antes de gravar
        // Apaga snapshot do crmDB tambem (forca re-sync no proximo cSave)
        try { sessionStorage.removeItem('_crmDB_lastSnapshot'); } catch(e){}
        // Substitui localStorage com cards limpos do banco (sem merge)
        localStorage.setItem(CK, JSON.stringify(cards));
        console.log('[00-pre-boot v3] LIMPEZA + sync OK:', cards.length, 'cards do banco -> localStorage');
        // Log de cards com valor 0 (que devem aparecer sem valores no kanban)
        var zerados = cards.filter(function(c){
          return (parseFloat(c.valorFaturamento)||0) === 0
            && (parseFloat(c.valorTabela)||0) === 0;
        });
        if(zerados.length){
          console.log('[00-pre-boot v3] cards com valor=0 (' + zerados.length + '):',
            zerados.map(function(c){ return c.cliente; }).join(', '));
        }
      } else {
        console.warn('[00-pre-boot v3] HTTP', xhr.status, '- mantendo localStorage atual');
      }
    } catch(e){
      console.warn('[00-pre-boot v3] excecao - mantendo localStorage atual:', e.message);
    }
  }

  preBootSync();
})();
