/**
 * ═══════════════════════════════════════════════════════════════════════
 * PROJETTA.posorc — Registry/fachada do pós-orçamento
 * ─────────────────────────────────────────────────────────────────────
 *
 * RESPONSABILIDADE ÚNICA: orquestrar o fluxo completo salvar→memorial→
 * pdf→pipeline numa chamada só, com tratamento de erro consistente.
 *
 * PADRÃO: mesmo do 44-item-registry.js — este arquivo é o ÚNICO que a
 * UI deve chamar. Os submódulos (50-54) são implementação interna.
 *
 * API PÚBLICA PRINCIPAL:
 *   PROJETTA.posorc.processar(cardId, opcoes)
 *     → Promise<{id, revNum, label, data, pdfUrl}>
 *
 *   opcoes = {
 *     gerarPdf:        boolean (default true)
 *     marcarPipeline:  boolean (default true)
 *     pdfAbas:         array   (default: 6 abas padrão)
 *     observacoes:     string
 *     onProgress:      function(etapa, detalhe)  // callback opcional
 *   }
 *
 * ETAPAS do processar:
 *   1) Captura snapshot do form
 *   2) Captura memorial de cálculo
 *   3) Valida que há valores > 0
 *   4) INSERT em crm_revisoes (rev imutável) — este é o commit real
 *   5) Se marcarPipeline: atualiza card
 *   6) Se gerarPdf: gera+upload+anexa pdf_cloud (em background, não-bloqueante)
 *
 * GARANTIAS:
 *   - Se etapa 4 falhar, NADA é gravado e erro é propagado.
 *   - Se etapa 4 funcionar, a revisão está SALVA. As etapas 5-6 são
 *     best-effort (falha não derruba a revisão já gravada).
 *   - Sempre retorna Promise — resolvida com sucesso ou rejeitada com
 *     Error contendo mensagem útil.
 * ═══════════════════════════════════════════════════════════════════════
 */
window.PROJETTA = window.PROJETTA || {};
window.PROJETTA.posorc = window.PROJETTA.posorc || {};

(function(ns){
  'use strict';

  var VERSION = '1.0';

  function _capturarSnapshotForm(){
    // Captura inputs, selects, textareas, checkboxes do form atual do orçamento.
    // Também captura arrays globais de estado (_orcItens, _mpItens).
    var snap = {};
    var els  = document.querySelectorAll('input[id], select[id], textarea[id]');
    for(var i = 0; i < els.length; i++){
      var el = els[i];
      if(!el.id) continue;
      if(el.type === 'checkbox' || el.type === 'radio'){
        snap[el.id] = { _type: el.type, checked: el.checked, value: el.value };
      } else {
        snap[el.id] = el.value;
      }
    }
    try {
      if(Array.isArray(window._orcItens)) snap._orcItens = JSON.parse(JSON.stringify(window._orcItens));
      if(Array.isArray(window._mpItens))  snap._mpItens  = JSON.parse(JSON.stringify(window._mpItens));
    } catch(e){ /* ignore */ }
    snap._capturado_em = new Date().toISOString();
    return snap;
  }

  function _lerValoresDoCalc(){
    var r = window._calcResult || {};
    return {
      valorTabela:      parseFloat(r._tabTotal) || 0,
      valorFaturamento: parseFloat(r._fatTotal) || 0,
      custoTotal:       parseFloat(r._custoTotal) || 0,
      markup:           parseFloat(r._markupPct) || 0
    };
  }

  function _emit(cb, etapa, detalhe){
    if(typeof cb === 'function'){
      try { cb(etapa, detalhe); } catch(e){ /* ignore */ }
    }
  }

  ns.processar = async function(cardId, opcoes){
    if(!cardId) throw new Error('[posorc.processar] cardId obrigatório');
    opcoes = opcoes || {};
    var onP = opcoes.onProgress || null;

    // 1) Pré-checagem
    _emit(onP, 'pre_checagem');
    if(!ns.salvar)   throw new Error('[posorc.processar] submódulo salvar indisponível');
    if(!ns.memorial) throw new Error('[posorc.processar] submódulo memorial indisponível');

    // 2) Captura valores + snapshot + memorial
    _emit(onP, 'captura_snapshot');
    var valores   = _lerValoresDoCalc();
    if(valores.valorTabela <= 0 && valores.valorFaturamento <= 0){
      throw new Error('[posorc.processar] valores zerados — gere o custo antes de salvar');
    }
    var snapshot  = _capturarSnapshotForm();

    _emit(onP, 'captura_memorial');
    var memorial  = ns.memorial.capturar();

    // 3) INSERT em crm_revisoes (etapa crítica — falha aqui = nada gravado)
    _emit(onP, 'salvar_revisao');
    var rev = await ns.salvar.revisao(cardId, {
      valorTabela:      valores.valorTabela,
      valorFaturamento: valores.valorFaturamento,
      snapshot:         snapshot,
      memorial:         memorial,
      observacoes:      opcoes.observacoes || null,
      crmPronto:        true
    });

    // A partir daqui, tudo é best-effort — falha não derruba a revisão
    // já salva. Retornamos o rev.id imediatamente.

    // 4) Marcar pipeline (best-effort)
    if(opcoes.marcarPipeline !== false && ns.pipeline){
      try {
        _emit(onP, 'marcar_pipeline');
        await ns.pipeline.marcar(cardId, rev.id);
      } catch(e){
        console.warn('[posorc.processar] marcarPipeline falhou (rev ' + rev.id + ' está salva):', e);
      }
    }

    // 5) Gerar + upload PDF (best-effort, fire-and-forget)
    if(opcoes.gerarPdf !== false && ns.pdf){
      (async function(){
        try {
          _emit(onP, 'gerar_pdf');
          if(!ns.pdf.temBibliotecas()){
            console.warn('[posorc.processar] html2canvas/jsPDF indisponíveis — PDF pulado');
            return;
          }
          var blob = await ns.pdf.gerar({ abas: opcoes.pdfAbas });
          _emit(onP, 'upload_pdf');
          var pdfUrl = await ns.pdf.upload(blob, cardId, rev.revNum);

          // Anexa URL na revisão (PATCH em pdf_cloud — exceção à imutabilidade
          // porque pdf_cloud é gerado assincronamente)
          await fetch('https://plmliavuwlgpwaizfeds.supabase.co/rest/v1/crm_revisoes?id=eq.' + encodeURIComponent(rev.id), {
            method: 'PATCH',
            headers: {
              'apikey':        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858',
              'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858',
              'Content-Type':  'application/json',
              'Prefer':        'return=minimal'
            },
            body: JSON.stringify({ pdf_cloud: pdfUrl })
          });
          rev.pdfUrl = pdfUrl;
          _emit(onP, 'pdf_anexado', { url: pdfUrl });
          console.log('[posorc.processar] 📄 PDF anexado em rev ' + rev.revNum);
        } catch(e){
          console.warn('[posorc.processar] gerar/upload PDF falhou (rev está salva sem PDF):', e);
          _emit(onP, 'pdf_falhou', { erro: e.message });
        }
      })();
    }

    _emit(onP, 'concluido', rev);
    return rev;
  };

  ns.version = VERSION;

  // Log consolidado de prontidão de todos os submódulos
  setTimeout(function(){
    var s = ['salvar','memorial','pdf','revisoes','pipeline'];
    var status = s.map(function(x){ return x + ':' + (ns[x] ? '✓' : '✗'); }).join(' ');
    console.log('%c[PROJETTA.posorc] v' + VERSION + ' registry — ' + status,
                'color:#0C447C;font-weight:500;background:#E6F1FB;padding:2px 6px;border-radius:3px');
  }, 100);
})(window.PROJETTA.posorc);
