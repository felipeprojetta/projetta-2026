/**
 * 81-fix-fluxo-nativo.js
 * 
 * Descoberto 24/04: sistema JÁ TEM fluxo nativo completo em 10-crm.js:
 *   - opp.revisoes[]     (array em extras.revisoes)
 *   - crmNovaRevisao()   (cria revisão)
 *   - crmAbrirRevisao()  (duplo-clique abre orçamento)
 *   - crmDeleteRevision() (botão X)
 *   - crmSetPipelineRev() (dropdown Valor no Pipeline)
 *   - HISTÓRICO DE REVISÕES renderizado no modal do card
 *   - printProposta, printMargens, printMemorialCalculo, printPainelRep
 *
 * Meus scripts 72/73/74/78/79 duplicavam tudo isso em tabelas paralelas.
 * Esta sessão: desliga esses scripts e reconecta os 3 botões do topo
 * ao fluxo nativo. Além disso, patcha crmDeleteRevision pra persistir no
 * Supabase (hoje só localStorage — por isso "sempre volta" quando recarrega).
 */
(function(){
  'use strict';
  
  var SUPA = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _toast(msg, cor, ms){
    var t = document.getElementById('fluxo-toast'); if(t) t.remove();
    t = document.createElement('div'); t.id='fluxo-toast';
    t.style.cssText = 'position:fixed;top:80px;right:20px;background:'+cor+';color:#fff;padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);font-family:inherit;max-width:480px;line-height:1.45';
    t.innerHTML = msg; document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4500);
  }

  // ─── 1. SALVAR PRÉ-ORÇAMENTO → chama crmNovaRevisao nativo ──────────
  // crmNovaRevisao cria/atualiza a revisão no card e salva localStorage+Supabase
  window.salvarPreOrcamento = function(){
    var cardId = window._crmOrcCardId;
    if(!cardId){
      _toast('⚠ <b>Sem card vinculado</b><br>Abra um orçamento via "Fazer Orçamento" de um card CRM', '#c0392b', 6000);
      return;
    }
    if(typeof window.crmNovaRevisao !== 'function'){
      _toast('⚠ Função nativa crmNovaRevisao indisponível', '#c0392b', 5000);
      return;
    }
    if(!confirm('💾 SALVAR COMO REVISÃO?\n\nUma nova revisão será criada no histórico do card.\nAparecerá em "HISTÓRICO DE REVISÕES" no modal do card.\n\nSe for a primeira, será "Original". Senão "Revisão N".\n\nProsseguir?')) return;
    try {
      window.crmNovaRevisao(cardId);
      _toast('✅ <b>Revisão criada!</b><br><span style="font-size:11px;font-weight:400">Abra o card no CRM para ver em "Histórico de Revisões"</span>', '#27ae60', 5000);
    } catch(e){
      _toast('❌ Erro: '+e.message, '#c0392b', 5000);
      console.error('[salvarPreOrcamento]', e);
    }
  };

  // ─── 2. PRÉ-ORÇAMENTOS SALVOS → abre card CRM no Histórico ──────────
  // Ao invés de modal separado, vai pro CRM e abre o modal do card
  window.abrirModalPreOrcamentos = function(){
    var cardId = window._crmOrcCardId;
    if(cardId && typeof window.crmOpenModal === 'function'){
      try { window.crmOpenModal(null, cardId); return; } catch(e){}
    }
    // Sem card vinculado: vai pra aba CRM
    if(typeof window.switchTab === 'function'){ window.switchTab('crm'); }
    _toast('📋 <b>Histórico de Revisões</b><br>' +
           '<span style="font-size:11px;font-weight:400">Abra qualquer card no CRM pra ver o histórico de revisões na parte inferior do modal.</span>',
           '#1a5276', 6000);
  };

  // ─── 3. APROVAR PARA ENVIO → marca revisão ativa + baixa 4 arquivos ───
  window.aprovarOrcamentoParaEnvio = async function(){
    var cardId = window._crmOrcCardId;
    if(!cardId){
      _toast('⚠ <b>Sem card vinculado</b>', '#c0392b', 5000); return;
    }
    if(!confirm('🏆 APROVAR E ENVIAR?\n\nEste orçamento será:\n  • Salvo como nova revisão\n  • Card movido para "Orçamento Pronto"\n  • Downloads gerados (1 PDF + 3 PNGs)\n\nProsseguir?')) return;
    
    _toast('⏳ <b>Aprovando...</b>', '#7f8c8d', 3000);
    
    // Primeiro: criar revisão (se já houver, ignora — usuário pode aprovar existente)
    try {
      if(typeof window.crmNovaRevisao === 'function'){
        window.crmNovaRevisao(cardId);
      }
    } catch(e){ console.warn('[aprovar] nova revisão:', e); }
    
    // Mover stage pra "Orçamento Pronto" (s3b) + PATCH Supabase
    try {
      await fetch(SUPA+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId), {
        method:'PATCH',
        headers:{ apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body: JSON.stringify({ stage:'s3b', updated_at: new Date().toISOString() })
      });
    } catch(e){ console.warn('[aprovar] stage:', e); }
    
    // Downloads (funções nativas do 12-proposta.js)
    function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
    var ok = [];
    try { if(typeof window.printProposta === 'function'){ window.printProposta(); ok.push('Proposta.pdf'); } } catch(e){}
    await sleep(2000);
    try { if(typeof window.printMargens === 'function'){ window.printMargens(); ok.push('MR - Margens.png'); } } catch(e){}
    await sleep(1500);
    try { if(typeof window.printMemorialCalculo === 'function'){ window.printMemorialCalculo(); ok.push('MC - Memorial.png'); } } catch(e){}
    await sleep(1500);
    try { if(typeof window.printPainelRep === 'function'){ window.printPainelRep(); ok.push('RC - Representante.png'); } } catch(e){}
    
    _toast('🏆 <b>Aprovado!</b><br>' +
           '<span style="font-size:11px;font-weight:400;line-height:1.6">' +
           '✓ Revisão criada<br>✓ Card → Orçamento Pronto<br>' +
           ok.map(function(x){return '✓ '+x;}).join('<br>') +
           '</span>', '#27ae60', 10000);
  };

  // ─── 4. PATCH crmDeleteRevision: PERSISTIR NO SUPABASE ──────────────
  // O nativo só salva em localStorage. Quando recarrega, Supabase tem
  // a revisão em extras.revisoes e ela "volta".
  function _patchDeleteRevision(){
    if(!window.crmDeleteRevision || window.crmDeleteRevision._supabasePatched) return false;
    var original = window.crmDeleteRevision;
    window.crmDeleteRevision = function(cardId, revIndex){
      // Chama original (faz a lógica de splice e localStorage)
      var res = original.apply(this, arguments);
      
      // Depois: persistir no Supabase lendo o estado atualizado do localStorage
      try {
        var data = JSON.parse(localStorage.getItem('projetta_crm_v1') || '[]');
        var card = data.find(function(o){ return o.id === cardId; });
        if(card){
          var extras = card.extras || {};
          extras.revisoes = card.revisoes || [];
          extras.revPipeline = card.revPipeline;
          fetch(SUPA+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId), {
            method:'PATCH',
            headers:{ apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
            body: JSON.stringify({
              extras: extras,
              valor: card.valor || null,
              valor_tabela: card.valorTabela || null,
              valor_faturamento: card.valorFaturamento || null,
              rev_pipeline: card.revPipeline !== undefined ? card.revPipeline : null,
              updated_at: new Date().toISOString()
            })
          }).then(function(r){
            if(r.ok) console.log('[crmDeleteRevision] Supabase sincronizado');
            else console.warn('[crmDeleteRevision] Supabase falhou:', r.status);
          }).catch(function(e){ console.warn('[crmDeleteRevision] erro:', e); });
        }
      } catch(e){ console.warn('[crmDeleteRevision patch]', e); }
      
      return res;
    };
    window.crmDeleteRevision._supabasePatched = true;
    console.log('[81] ✓ crmDeleteRevision patcheado (Supabase)');
    return true;
  }

  // ─── 5. PATCH crmSetPipelineRev: persistir Supabase também ───────────
  function _patchSetPipelineRev(){
    if(!window.crmSetPipelineRev || window.crmSetPipelineRev._supabasePatched) return false;
    var original = window.crmSetPipelineRev;
    window.crmSetPipelineRev = function(cardId, revIdx){
      var res = original.apply(this, arguments);
      try {
        var data = JSON.parse(localStorage.getItem('projetta_crm_v1') || '[]');
        var card = data.find(function(o){ return o.id === cardId; });
        if(card){
          fetch(SUPA+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId), {
            method:'PATCH',
            headers:{ apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json', Prefer:'return=minimal' },
            body: JSON.stringify({
              valor: card.valor || null,
              valor_tabela: card.valorTabela || null,
              valor_faturamento: card.valorFaturamento || null,
              rev_pipeline: parseInt(revIdx) || 0,
              updated_at: new Date().toISOString()
            })
          });
        }
      } catch(e){}
      return res;
    };
    window.crmSetPipelineRev._supabasePatched = true;
    console.log('[81] ✓ crmSetPipelineRev patcheado (Supabase)');
    return true;
  }

  // Tentar patchar logo + retry (as funções nativas são definidas pelo 10-crm.js)
  var attempts = 0;
  var tryPatch = setInterval(function(){
    attempts++;
    var p1 = _patchDeleteRevision();
    var p2 = _patchSetPipelineRev();
    if((p1 && p2) || attempts > 20){ clearInterval(tryPatch); }
  }, 500);

  console.log('%c[81-fix-fluxo-nativo] Redireciona botoes + patch Supabase', 'color:#003144;font-weight:700;background:#eaf2f7;padding:3px 8px;border-radius:4px');
})();
