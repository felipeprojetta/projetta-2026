/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA PERSIST V1 — Salvamento profissional de orçamentos
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Felipe perdeu orçamentos 4 vezes. Este módulo existe pra nunca mais.
 *
 * PRINCÍPIOS (não-negociáveis):
 *   1. Imutabilidade: cada salvamento = INSERT novo. Nunca UPDATE em snapshot.
 *   2. Fonte única: Supabase manda. localStorage = cache de leitura apenas.
 *   3. Card != Orçamento: valores vêm de JOIN com crm_revisoes, nunca do card.
 *   4. Confirmação síncrona: UI só diz "Salvo" depois de HTTP 200 com o id.
 *   5. Soft delete: NUNCA DELETE FROM. Sempre UPDATE deletado_em = NOW().
 *   6. Auditoria: Supabase Table Editor mostra 1 linha por salvamento.
 *
 * API pública: window.Persist
 *   - salvarOrcamento(cardId, payload) → Promise<{id, revNum, pdfUrl}>
 *   - listarRevisoes(cardId)           → Promise<Revisao[]>
 *   - carregarRevisao(revId)           → Promise<Revisao>
 *   - marcarPipeline(cardId, revId)    → Promise<void>
 *   - apagar(revId, motivo)            → Promise<void>  (soft delete)
 *   - desfazerApagar(revId)            → Promise<void>
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

(function(){
  'use strict';

  var VERSION = '1.0';
  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _headers(extra){
    var h = {
      'apikey': ANON_KEY,
      'Authorization': 'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };
    if(extra){ for(var k in extra) h[k] = extra[k]; }
    return h;
  }

  function _userName(){
    try { return localStorage.getItem('projetta_user_name') || 'anon'; } catch(e){ return 'anon'; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SALVAR — sempre INSERT novo, nunca UPDATE
  // ═══════════════════════════════════════════════════════════════════════
  async function salvarOrcamento(cardId, payload){
    if(!cardId) throw new Error('[Persist] cardId vazio');
    if(!payload || typeof payload !== 'object') throw new Error('[Persist] payload invalido');

    var vTab = parseFloat(payload.valorTabela) || 0;
    var vFat = parseFloat(payload.valorFaturamento) || 0;
    if(vTab < 0 || vFat < 0) throw new Error('[Persist] valores negativos');

    // 1) Descobrir proximo rev_num (inclui apagados no count pra manter sequencia)
    var urlMax = SUPABASE_URL + '/rest/v1/crm_revisoes'
               + '?opp_id=eq.' + encodeURIComponent(cardId)
               + '&select=rev_num&order=rev_num.desc&limit=1';
    var resMax = await fetch(urlMax, { headers: _headers() });
    if(!resMax.ok) throw new Error('[Persist] falha ao ler ultima revisao: HTTP ' + resMax.status);
    var arr = await resMax.json();
    var proxRev = (arr.length && arr[0].rev_num != null) ? (parseInt(arr[0].rev_num) + 1) : 1;

    // 2) Upload do PDF (se houver blob)
    var pdfUrl = null;
    if(payload.pdfBlob && payload.pdfBlob instanceof Blob){
      pdfUrl = await _uploadPdf(cardId, proxRev, payload.pdfBlob);
    } else if(typeof payload.pdfUrl === 'string' && payload.pdfUrl){
      pdfUrl = payload.pdfUrl;
    }

    // 3) INSERT em crm_revisoes (IMUTAVEL, representa salvamento definitivo)
    var body = {
      opp_id: cardId,
      rev_num: proxRev,
      label: payload.label || ('Revisão ' + proxRev),
      data: new Date().toISOString(),
      valor_tabela: vTab,
      valor_faturamento: vFat,
      snapshot: payload.snapshot || {},
      memorial: payload.memorial || null,
      pdf_cloud: pdfUrl,
      pdf_pages: payload.pdfPages || null,
      crm_pronto: !!payload.crmPronto,
      observacoes: payload.observacoes || null,
      created_by: _userName()
    };
    var resIns = await fetch(SUPABASE_URL + '/rest/v1/crm_revisoes', {
      method: 'POST',
      headers: _headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(body)
    });
    if(!resIns.ok){
      var txt = await resIns.text();
      throw new Error('[Persist] INSERT falhou: HTTP ' + resIns.status + ' ' + txt);
    }
    var inserida = (await resIns.json())[0];

    // 4) Marcar esta revisao como ativa no pipeline do card (atomico, separado)
    try {
      await marcarPipeline(cardId, inserida.id, { valorTabela: vTab, valorFaturamento: vFat });
    } catch(e){
      // Nao falha o salvamento se o UPDATE do card der erro — a revisao ja esta salva.
      console.warn('[Persist] revisao salva (id=' + inserida.id + ') mas marcarPipeline falhou:', e);
    }

    console.log('%c[Persist] ✓ Revisão ' + proxRev + ' salva (id=' + inserida.id.slice(0,8) + ')',
                'color:#27ae60;font-weight:500');
    return {
      id: inserida.id,
      revNum: inserida.rev_num,
      label: inserida.label,
      pdfUrl: inserida.pdf_cloud,
      data: inserida.data
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LISTAR — revisoes ativas (nao apagadas) de um card
  // ═══════════════════════════════════════════════════════════════════════
  async function listarRevisoes(cardId){
    if(!cardId) return [];
    var url = SUPABASE_URL + '/rest/v1/crm_revisoes'
            + '?opp_id=eq.' + encodeURIComponent(cardId)
            + '&deletado_em=is.null'
            + '&select=id,rev_num,label,data,valor_tabela,valor_faturamento,pdf_cloud,crm_pronto,created_at,created_by'
            + '&order=rev_num.desc';
    var res = await fetch(url, { headers: _headers() });
    if(!res.ok) throw new Error('[Persist] listarRevisoes falhou: HTTP ' + res.status);
    return await res.json();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CARREGAR — revisao completa (com snapshot/memorial) pra reabrir
  // ═══════════════════════════════════════════════════════════════════════
  async function carregarRevisao(revId){
    if(!revId) throw new Error('[Persist] revId vazio');
    var url = SUPABASE_URL + '/rest/v1/crm_revisoes'
            + '?id=eq.' + encodeURIComponent(revId)
            + '&select=*&limit=1';
    var res = await fetch(url, { headers: _headers() });
    if(!res.ok) throw new Error('[Persist] carregarRevisao falhou: HTTP ' + res.status);
    var arr = await res.json();
    if(!arr.length) throw new Error('[Persist] revisao nao encontrada: ' + revId);
    return arr[0];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MARCAR PIPELINE — qual revisao e a "valor no pipeline" do card
  // Tambem atualiza valor_tabela/valor_faturamento do card pra queries rapidas
  // ═══════════════════════════════════════════════════════════════════════
  async function marcarPipeline(cardId, revId, valores){
    if(!cardId) throw new Error('[Persist] cardId vazio');
    var body = {
      rev_pipeline_id: revId || null,
      valor_tabela: (valores && valores.valorTabela != null) ? parseFloat(valores.valorTabela) : 0,
      valor_faturamento: (valores && valores.valorFaturamento != null) ? parseFloat(valores.valorFaturamento) : 0,
      updated_at: new Date().toISOString(),
      updated_by: _userName()
    };
    // Se revId for null (desmarcar) zera os valores
    if(!revId){ body.valor_tabela = 0; body.valor_faturamento = 0; }

    var url = SUPABASE_URL + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId);
    var res = await fetch(url, {
      method: 'PATCH',
      headers: _headers({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify(body)
    });
    if(!res.ok){
      var txt = await res.text();
      throw new Error('[Persist] marcarPipeline falhou: HTTP ' + res.status + ' ' + txt);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // APAGAR — soft delete (NUNCA DELETE FROM)
  // ═══════════════════════════════════════════════════════════════════════
  async function apagar(revId, motivo){
    if(!revId) throw new Error('[Persist] revId vazio');
    var body = {
      deletado_em: new Date().toISOString(),
      deletado_por: _userName(),
      observacoes: motivo || null
    };
    var url = SUPABASE_URL + '/rest/v1/crm_revisoes?id=eq.' + encodeURIComponent(revId);
    var res = await fetch(url, {
      method: 'PATCH',
      headers: _headers({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error('[Persist] apagar falhou: HTTP ' + res.status);

    // Se essa revisao era a do pipeline, desvincula do card
    var revCompleta = await carregarRevisao(revId).catch(function(){ return null; });
    if(revCompleta){
      var urlC = SUPABASE_URL + '/rest/v1/crm_oportunidades'
               + '?rev_pipeline_id=eq.' + encodeURIComponent(revId)
               + '&select=id';
      var resC = await fetch(urlC, { headers: _headers() });
      if(resC.ok){
        var cards = await resC.json();
        for(var i=0; i<cards.length; i++){
          await marcarPipeline(cards[i].id, null, null);
        }
      }
    }
    console.log('[Persist] ✗ Revisao ' + revId.slice(0,8) + ' apagada (soft)');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DESFAZER APAGAR — restaura uma revisao soft-deleted
  // ═══════════════════════════════════════════════════════════════════════
  async function desfazerApagar(revId){
    if(!revId) throw new Error('[Persist] revId vazio');
    var body = { deletado_em: null, deletado_por: null };
    var url = SUPABASE_URL + '/rest/v1/crm_revisoes?id=eq.' + encodeURIComponent(revId);
    var res = await fetch(url, {
      method: 'PATCH',
      headers: _headers({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error('[Persist] desfazerApagar falhou: HTTP ' + res.status);
    console.log('[Persist] ↶ Revisao ' + revId.slice(0,8) + ' restaurada');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CAPTURA DE SNAPSHOT DO FORMULARIO
  // ═══════════════════════════════════════════════════════════════════════
  function capturarSnapshot(){
    var snap = {};
    // Inputs e selects de todos os campos do formulario
    var seletores = 'input[id], select[id], textarea[id]';
    var nodes = document.querySelectorAll(seletores);
    for(var i=0; i<nodes.length; i++){
      var el = nodes[i];
      if(!el.id) continue;
      if(el.type === 'checkbox' || el.type === 'radio'){
        snap[el.id] = { _type: el.type, checked: el.checked, value: el.value };
      } else {
        snap[el.id] = el.value;
      }
    }
    // Variaveis globais de estado (multi-item)
    try {
      if(Array.isArray(window._orcItens)) snap._orcItens = JSON.parse(JSON.stringify(window._orcItens));
      if(Array.isArray(window._mpItens))  snap._mpItens  = JSON.parse(JSON.stringify(window._mpItens));
    } catch(e){}
    snap._capturadoEm = new Date().toISOString();
    return snap;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RESTAURAR SNAPSHOT NO FORMULARIO
  // ═══════════════════════════════════════════════════════════════════════
  function restaurarSnapshot(snap){
    if(!snap || typeof snap !== 'object') return;
    for(var id in snap){
      if(id.charAt(0) === '_') continue; // pula metadados
      var el = document.getElementById(id);
      if(!el) continue;
      var val = snap[id];
      if(val && typeof val === 'object' && val._type){
        if(val._type === 'checkbox' || val._type === 'radio'){
          el.checked = !!val.checked;
          if(val.value !== undefined) el.value = val.value;
        }
      } else {
        el.value = val != null ? val : '';
      }
      // Disparar change pra triggers legados reagirem
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
    }
    // Restaurar arrays globais
    if(Array.isArray(snap._orcItens)) window._orcItens = JSON.parse(JSON.stringify(snap._orcItens));
    if(Array.isArray(snap._mpItens))  window._mpItens  = JSON.parse(JSON.stringify(snap._mpItens));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UPLOAD PDF → Supabase Storage (bucket "orcamentos-pdf")
  // ═══════════════════════════════════════════════════════════════════════
  async function _uploadPdf(cardId, revNum, blob){
    var path = cardId + '/rev' + revNum + '-' + Date.now() + '.pdf';
    var url = SUPABASE_URL + '/storage/v1/object/orcamentos-pdf/' + path;
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true'
      },
      body: blob
    });
    if(!res.ok){
      console.warn('[Persist] upload PDF falhou (continuando sem):', res.status);
      return null;
    }
    // URL publica
    return SUPABASE_URL + '/storage/v1/object/public/orcamentos-pdf/' + path;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // API PUBLICA
  // ═══════════════════════════════════════════════════════════════════════
  window.Persist = {
    version:          VERSION,
    salvarOrcamento:  salvarOrcamento,
    listarRevisoes:   listarRevisoes,
    carregarRevisao:  carregarRevisao,
    marcarPipeline:   marcarPipeline,
    apagar:           apagar,
    desfazerApagar:   desfazerApagar,
    capturarSnapshot: capturarSnapshot,
    restaurarSnapshot: restaurarSnapshot
  };

  console.log('%c[Persist] v' + VERSION + ' carregado — fonte unica de salvamento', 
              'color:#0C447C;font-weight:500;background:#E6F1FB;padding:2px 6px;border-radius:3px');
})();


// ═══════════════════════════════════════════════════════════════════════
// SHIM DE COMPATIBILIDADE TEMPORARIO (Felipe 24/04)
// ─────────────────────────────────────────────────────────────────────
// O 03-history_save.js foi deletado. 10 arquivos legados ainda chamam
// suas funcoes. Este shim declara todas como no-op pra nao quebrar em
// runtime. Cada chamada sera REMOVIDA do seu arquivo em commits seguintes.
// Quando a ultima for removida, este shim desce.
//
// Tambem define OrcamentoOpcoes como stub — 31-opcoes.js morreu junto.
// ═══════════════════════════════════════════════════════════════════════
(function(){
  function _noop(){}
  function _noopArr(){ return []; }
  function _noopObj(){ return {}; }
  function _noopFalse(){ return false; }

  // Funcoes de salvamento legado
  window.loadDB               = _noopArr;
  window.saveDB               = _noop;
  window.saveNew              = _noop;
  window.saveRevision         = _noop;
  window.salvarRapido         = _noop;
  window.novaRevisao          = _noop;
  window.loadRevision         = _noop;
  window.loadRevisionMemorial = _noop;

  // Captura/restore legado
  window.captureSnapshot       = _noopObj;
  window.captureFormData       = _noopObj;
  window.restoreFormData       = _noop;

  // UI de historico legado
  window.renderHistory       = _noop;
  window.updateBanner        = _noop;
  window.toggleHist          = _noop;
  window.showMemorial        = _noop;
  window._hideMemorial       = function(){
    var p = document.getElementById('memorial-panel');
    if(p) p.style.display = 'none';
  };
  window._restoreSnapshotDisplay = _noop;
  window._openSectionsAndScroll  = _noop;

  // Locks globais legados
  window._setOrcLock     = function(v){ window._orcLocked = !!v; };
  window._isSnapshotValid= _noopFalse;
  window._revClearTimers = _noop;
  window._revDelay       = function(fn, ms){ return setTimeout(fn, ms); };
  window._persistSession = _noop;
  window._restoreSession = _noopFalse;

  // Estado global legado — sempre "liberado"
  window._snapshotLock    = false;
  window._orcLocked       = false;
  window._pendingRevision = false;

  // 31-opcoes.js morreu — stub pra quem ainda chama
  // v1.4 rollback ja reduzia a 1 opcao, entao comportamento: no-op total
  window.OrcamentoOpcoes = {
    version:      '0.0-SHIM',
    migrar:       function(card){ return card; },
    ativa:        function(card){
      // Retorna objeto minimo pra getters que fazem o?.revisoes funcionarem
      return card ? { id:'opt1', revisoes: card.revisoes || [], itens: card.itens || [] } : null;
    },
    indexAtiva:   function(){ return 0; },
    sincronizar:  function(card){ return card; },
    persistir:    function(card){ return card; },
    trocar:       function(card){ return card; },
    novaOpcao:    function(){ return null; },
    removerOpcao: _noopFalse,
    freezeKey:    function(cardId, opcaoId, revNum){ return 'freeze_'+cardId+'_rev'+revNum; }
  };

  console.log('%c[Persist] shim de compat ativo (sera removido conforme consumidores migrarem)',
              'color:#888780;font-style:italic');
})();
