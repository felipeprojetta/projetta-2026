/* ============================================================================
 * js/96-cif-caixa-bloqueio.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 *
 * Conforme regras de blindagem (configuracoes.projetta_regras_blindagem_v1):
 *  - NAO modifica nenhum arquivo JS existente
 *  - NAO deleta linhas de codigo
 *  - Funciona via DOM observation + override leve
 *  - Coexiste com js/39-caixa-auto.js (nao substitui)
 *
 * COMPORTAMENTO:
 *
 *  1. Enquanto o modal CRM nao tiver itens com LARGURA + ALTURA preenchidas,
 *     os 3 campos de dimensao da caixa CIF (altura, comprimento, espessura)
 *     ficam BLOQUEADOS:
 *       - input.disabled = true
 *       - background cinza claro (#f0f0f0), texto cinza
 *       - placeholder original limpo (sem 3500/2000/200 enganando)
 *       - tooltip explicando: "Preencha medidas da porta primeiro"
 *
 *  2. Quando ALGUM item ganha largura+altura, os campos sao LIBERADOS e
 *     auto-preenchidos pela mesma formula do js/39-caixa-auto.js:
 *       - altura  = MAX(largura porta) + 350, arred 50mm pra cima
 *       - compr   = MAX(altura porta)  + 250, arred 50mm pra cima
 *       - espess  = 600 se 1 item, 0 se multiplos
 *     Background fica creme (#fffaf3) e tooltip explica a formula.
 *
 *  3. Atua apenas quando incoterm IN (CIF, FOB) E inst-quem === INTERNACIONAL.
 *     Em qualquer outro caso, NAO interfere.
 *
 *  4. Os campos 'crm-o-cif-caixa-taxa' (US$/m3), 'crm-o-cif-frete-terrestre'
 *     e 'crm-o-cif-frete-maritimo' NUNCA sao bloqueados (sao config, nao
 *     dimensao).
 *
 *  5. Polling de 700ms (robusto contra qualquer re-render do modal), opera
 *     apenas se o modal CRM estiver aberto (custo zero quando fechado).
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta96CaixaBloqueioApplied) return;
  window.__projetta96CaixaBloqueioApplied = true;
  console.log('[96-cif-caixa-bloqueio] iniciando');

  var IDS_CAIXA_DIM = ['crm-o-cif-caixa-a', 'crm-o-cif-caixa-l', 'crm-o-cif-caixa-e'];
  var TITLES_LIBERADO = {
    'crm-o-cif-caixa-a': '🔓 Auto: maior LARGURA da porta + 350, arredondado pra cima em multiplos de 50mm',
    'crm-o-cif-caixa-l': '🔓 Auto: maior ALTURA da porta + 250, arredondado pra cima em multiplos de 50mm',
    'crm-o-cif-caixa-e': '🔓 Auto: 600mm se 1 item, 0 se multiplos itens (rateio)'
  };
  var TITLE_BLOQUEADO = '🔒 Preencha medidas da porta primeiro (Largura + Altura no Item)';

  // Guarda placeholder original pra restaurar quando precisar
  var _phOriginal = {};

  function $(id){ return document.getElementById(id); }

  function modalAberto(){
    var titulos = document.querySelectorAll('h2,h3,h4,div');
    for(var i = 0; i < titulos.length; i++){
      var t = (titulos[i].textContent||'').trim();
      if(/^(Editar|Nova) Oportunidade/.test(t) && titulos[i].children.length < 3 && titulos[i].offsetParent !== null) return true;
    }
    return false;
  }

  function isInternacionalCIF(){
    var quem = $('crm-o-inst-quem');
    var inc = $('crm-o-inst-incoterm');
    if(!quem || !inc) return false;
    var q = (quem.value||'').toUpperCase();
    var i = (inc.value||'').toUpperCase();
    return q === 'INTERNACIONAL' && (i === 'CIF' || i === 'FOB');
  }

  function getItensComMedida(){
    var items = window._crmItens || [];
    return items.filter(function(it){
      if(!it) return false;
      var l = Number(it.largura) || 0;
      var a = Number(it.altura) || 0;
      return l > 0 && a > 0;
    });
  }

  function roundUp50(v){ return Math.ceil(v / 50) * 50; }

  function calcAutoCaixa(itens){
    if(!itens.length) return null;
    var maxL = 0, maxA = 0;
    itens.forEach(function(i){
      var l = Number(i.largura) || 0;
      var a = Number(i.altura)  || 0;
      if(l > maxL) maxL = l;
      if(a > maxA) maxA = a;
    });
    return {
      a: roundUp50(maxL + 350),
      l: roundUp50(maxA + 250),
      e: itens.length === 1 ? 600 : 0
    };
  }

  function snapshotPlaceholders(){
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(el && _phOriginal[id] === undefined){
        _phOriginal[id] = el.placeholder || '';
      }
    });
  }

  function bloquear(){
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = true;
      el.value = '';
      el.placeholder = '— preencha porta —';
      el.style.background = '#f0f0f0';
      el.style.color = '#aaa';
      el.style.cursor = 'not-allowed';
      el.style.borderStyle = 'dashed';
      el.title = TITLE_BLOQUEADO;
    });
  }

  function liberarECalcular(itens){
    var calc = calcAutoCaixa(itens);
    if(!calc) return;
    var dimVals = { 'crm-o-cif-caixa-a': calc.a, 'crm-o-cif-caixa-l': calc.l, 'crm-o-cif-caixa-e': calc.e };
    var changedAny = false;
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = false;
      el.placeholder = _phOriginal[id] || '';
      el.style.background = '#fffaf3';
      el.style.color = '#555';
      el.style.cursor = 'not-allowed';   // continua nao-editavel (e auto)
      el.style.borderStyle = 'dashed';
      el.readOnly = true;
      el.title = TITLES_LIBERADO[id] || '';
      var novoValor = String(dimVals[id]);
      if(el.value !== novoValor){
        el.value = novoValor;
        changedAny = true;
      }
    });
    // Disparar recalculo do total CIF se a funcao existir
    if(changedAny && typeof window.crmCifRecalc === 'function'){
      try { window.crmCifRecalc(); } catch(e){}
    }
  }

  function tick(){
    if(window._caixaCtrlOverride === true) return;  // 135 desativa polling
    if(!modalAberto()) return;
    if(!isInternacionalCIF()) return;
    snapshotPlaceholders();
    var itens = getItensComMedida();
    if(itens.length === 0) bloquear();
    else liberarECalcular(itens);
  }

  // Polling robusto (700ms — leve)
  setInterval(tick, 700);
  setTimeout(tick, 200);

  console.log('[96-cif-caixa-bloqueio] instalado');
})();
