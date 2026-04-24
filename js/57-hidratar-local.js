/**
 * ═══════════════════════════════════════════════════════════════════════
 * 57-hidratar-local.js — Sincroniza Supabase → localStorage
 * ─────────────────────────────────────────────────────────────────────
 *
 * PROBLEMA QUE RESOLVE:
 * O CRM (10-crm.js), a lista de Clientes (renderClientesTab em 09-
 * relatorios.js) e outras telas leem de localStorage.projetta_crm_v1.
 * Se o localStorage foi limpo (ex: "Zerar" / troca de navegador /
 * modo anônimo), esses componentes renderizam vazio, MESMO COM os
 * cards intactos no banco.
 *
 * ESTE ARQUIVO:
 * No carregamento da página, verifica se o localStorage está vazio.
 * Se estiver (ou se for pedido via window.hidratarCrmLocal()), busca
 * os cards no Supabase e popula o localStorage com o formato correto.
 *
 * EXECUÇÃO:
 *   - Automático 1x ao carregar a página
 *   - Manual: chamar window.hidratarCrmLocal() a qualquer momento
 *
 * SEGURANÇA:
 *   - NÃO sobrescreve dados locais existentes (só popula se vazio)
 *   - Pra forçar, usar window.hidratarCrmLocal({ forcar: true })
 *   - Cards com deleted_at são ignorados (só ativos)
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var CK           = 'projetta_crm_v1';

  function _headers(){
    return {
      apikey:        ANON_KEY,
      Authorization: 'Bearer ' + ANON_KEY
    };
  }

  function _rowToCard(row){
    // Merge colunas normalizadas + extras (JSONB) num objeto plano
    var card = {};
    for(var k in row){
      if(k === 'extras') continue;
      card[k] = row[k];
    }
    if(row.extras && typeof row.extras === 'object'){
      for(var ek in row.extras){
        // Não sobrescrever coluna primária se já preenchida
        if(card[ek] === null || card[ek] === undefined || card[ek] === ''){
          card[ek] = row.extras[ek];
        } else if(!(ek in card)){
          card[ek] = row.extras[ek];
        }
      }
      // Campos de extras que devem sempre vir do extras
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
    // Renomear snake_case do banco pro camelCase que a UI espera
    if(row.created_at) card.createdAt = row.created_at;
    if(row.updated_at) card.updatedAt = row.updated_at;
    if(row.data_contato) card.dataContato = row.data_contato;
    if(row.valor_tabela !== undefined) card.valorTabela = parseFloat(row.valor_tabela) || 0;
    if(row.valor_faturamento !== undefined) card.valorFaturamento = parseFloat(row.valor_faturamento) || 0;
    return card;
  }

  async function _fetchCardsSupabase(){
    var url = SUPABASE_URL + '/rest/v1/crm_oportunidades'
            + '?deleted_at=is.null&select=*&order=updated_at.desc';
    var res = await fetch(url, { headers: _headers() });
    if(!res.ok){
      throw new Error('[hidratar] HTTP ' + res.status + ' ao buscar cards');
    }
    return await res.json();
  }

  window.hidratarCrmLocal = async function(opcoes){
    opcoes = opcoes || {};
    var forcar = opcoes.forcar === true;

    try {
      var atual = localStorage.getItem(CK);
      var atualArr = [];
      try { atualArr = JSON.parse(atual) || []; } catch(e) { atualArr = []; }

      if(atualArr.length > 0 && !forcar){
        if(opcoes.verbose !== false){
          console.log('[hidratar] localStorage já tem ' + atualArr.length +
                      ' cards — pulando (use hidratarCrmLocal({forcar:true}) pra sobrescrever)');
        }
        return { status: 'skipped', count: atualArr.length };
      }

      if(opcoes.verbose !== false){
        console.log('[hidratar] localStorage vazio ou forçado — sincronizando do Supabase...');
      }
      var rows = await _fetchCardsSupabase();
      var cards = rows.map(_rowToCard);

      localStorage.setItem(CK, JSON.stringify(cards));

      if(opcoes.verbose !== false){
        console.log('%c[hidratar] ✓ ' + cards.length + ' cards gravados no localStorage',
                    'color:#27ae60;font-weight:600');
      }

      // Re-renderizar UIs que leem do localStorage
      try { if(typeof window.crmRender === 'function') window.crmRender(); } catch(e){}
      try { if(typeof window.renderClientesTab === 'function') window.renderClientesTab(); } catch(e){}

      return { status: 'ok', count: cards.length };
    } catch(err){
      console.error('[hidratar] falhou:', err);
      return { status: 'erro', erro: err.message };
    }
  };

  // v3: Sync CONTINUO do Supabase (banco e fonte unica da verdade)
  //  - Inicial: ao carregar a pagina (forcado)
  //  - Quando aba volta a ser visivel (Alt-Tab, trocar de aba)
  //  - A cada 8 segundos enquanto a aba estiver visivel
  //
  // Motivo: multiplos navegadores/abas tinham localStorage divergentes.
  // Agora todos convergem automaticamente em ~8s sem acao do usuario.

  var _ultimoSync = 0;
  var SYNC_INTERVAL_MS = 8000;
  var SYNC_MIN_GAP_MS = 2500; // nao fazer 2 syncs em menos de 2.5s

  function _syncSilencioso(motivo){
    var agora = Date.now();
    if(agora - _ultimoSync < SYNC_MIN_GAP_MS) return;
    _ultimoSync = agora;
    // Pular se user esta editando modal (evita reset de campos)
    var modalAberto = document.querySelector('#crm-opp-modal.open, #modal-escolha-opcao-bg');
    if(modalAberto){ return; }
    window.hidratarCrmLocal({forcar: true, verbose: false}).catch(function(e){
      console.warn('[hidratar v3] sync ' + motivo + ' falhou:', e && e.message);
    });
  }

  function _startContinuousSync(){
    // Sync inicial
    setTimeout(function(){ _syncSilencioso('inicial'); }, 500);

    // Sync quando aba volta a ser visivel
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState === 'visible'){
        _syncSilencioso('foco-aba');
      }
    });

    // Sync quando janela ganha foco
    window.addEventListener('focus', function(){
      _syncSilencioso('focus-janela');
    });

    // Sync periodico
    setInterval(function(){
      if(document.visibilityState === 'visible'){
        _syncSilencioso('periodico');
      }
    }, SYNC_INTERVAL_MS);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _startContinuousSync);
  } else {
    _startContinuousSync();
  }

  console.log('[57-hidratar-local] v3 carregado — sync continuo (foco + ' + (SYNC_INTERVAL_MS/1000) + 's)');
})();
