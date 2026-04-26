/* ============================================================================
 * js/98-proposta-pais-destino.js  —  Modulo NOVO (26-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 * Pedido: "na proposta comercial em ingles coloque ao lado do incoterm CIF
 *          o pais de destino, esse que acabamos de setar"
 *
 * Conforme regras de blindagem:
 *  - NAO modifica js/12-proposta.js (BLINDADO)
 *  - NAO altera as funcoes _injectPropostaFobCif / _injectPropostaIncotermBox
 *  - Atua apenas no DOM via MutationObserver no elemento de saida
 *
 * COMPORTAMENTO:
 *  - O elemento #prop-fob-cif-block (e variantes) recebe innerHTML das duas
 *    funcoes da proposta internacional
 *  - Apos o render, este modulo localiza o tag de incoterm (CIF / FOB / EXW)
 *    no titulo e adiciona o pais de destino entre parenteses
 *  - Funciona em PT e EN (proposta bilingue)
 *
 *  Antes:  "🚢 CIF — SHIPPING COSTS BREAKDOWN (USD)"
 *  Depois: "🚢 CIF · UNITED STATES — SHIPPING COSTS BREAKDOWN (USD)"
 *
 *  Antes:  "CIF — Cost, Insurance & Freight"
 *  Depois: "CIF · UNITED STATES — Cost, Insurance & Freight"
 *
 * FONTES DO PAIS (ordem de prioridade):
 *  1. Input crm-o-inst-pais (se modal CRM aberto)
 *  2. window._currentOpp.extras.inst_pais (se exposto)
 *  3. localStorage projetta_crm_v1 (cruzando pelo nome do cliente em #prop-cliente)
 *
 *  Se nada for encontrado, NAO altera nada (deixa proposta como esta).
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta98PropPaisDestinoApplied) return;
  window.__projetta98PropPaisDestinoApplied = true;
  console.log('[98-prop-pais-destino] iniciando');

  var FLAG_DONE_ATTR = 'data-projetta98Applied';

  function getDestinationCountry(){
    // 1. Input do modal CRM
    try {
      var inp = document.getElementById('crm-o-inst-pais');
      if(inp && inp.value && inp.value.trim()) return inp.value.trim();
    } catch(e){}

    // 2. Variavel global expostas
    try {
      if(window._currentOpp){
        var p = window._currentOpp.extras && window._currentOpp.extras.inst_pais;
        if(p) return p;
        if(window._currentOpp.pais) return window._currentOpp.pais;
      }
      if(window._currentCard){
        var p2 = window._currentCard.extras && window._currentCard.extras.inst_pais;
        if(p2) return p2;
        if(window._currentCard.pais) return window._currentCard.pais;
      }
    } catch(e){}

    // 3. Localizar via cliente da proposta no localStorage
    try {
      var clienteEl = document.getElementById('prop-cliente');
      if(!clienteEl) return null;
      var cliente = (clienteEl.textContent||'').trim();
      if(!cliente) return null;

      var raw = localStorage.getItem('projetta_crm_v1');
      if(!raw) return null;
      var data = JSON.parse(raw);
      var lista = Array.isArray(data) ? data : (data.opps || []);

      // Busca por correspondencia de cliente
      var match = lista.find(function(c){
        if(!c || !c.cliente) return false;
        return c.cliente === cliente || cliente.indexOf(c.cliente) >= 0 || c.cliente.indexOf(cliente) >= 0;
      });
      if(match){
        var p3 = (match.extras && match.extras.inst_pais) || match.pais;
        if(p3) return p3;
      }
    } catch(e){}

    return null;
  }

  function injetarPaisNoElemento(el, country){
    if(!el || !country) return false;
    if(el.getAttribute(FLAG_DONE_ATTR) === country){
      // Ja injetado pra esse pais — nao mexer
      return false;
    }

    var html = el.innerHTML;
    if(!html) return false;

    // Se ja contem o pais entre parenteses ou apos um separador, nao re-adicionar
    var jaTemPais = html.indexOf('· ' + country) >= 0
                 || html.indexOf('(' + country + ')') >= 0
                 || html.indexOf('· ' + country.toUpperCase()) >= 0;
    if(jaTemPais){
      el.setAttribute(FLAG_DONE_ATTR, country);
      return false;
    }

    // Padroes a substituir:
    //  "🚢 CIF — ..."          -> "🚢 CIF · UNITED STATES — ..."
    //  "🚢 CIF —..."           (sem espaco apos —)
    //  "CIF — Cost, ..."       -> "CIF · UNITED STATES — Cost, ..."
    //  "CIF — Custo, ..."

    var countryUp = country.toUpperCase();
    var novoHtml = html;

    // Padrao 1: "🚢 [CIF/FOB/EXW] —"
    novoHtml = novoHtml.replace(
      /(🚢s+)(CIF|FOB|EXW)(s*[—-])/g,
      '$1$2 · ' + countryUp + '$3'
    );

    // Padrao 2: tag isolado "CIF —" / "FOB —" no inicio de uma linha,
    //  geralmente depois de tag </span> ou no titulo do bloco educacional.
    //  Cuidado: NAO substituir CIF dentro de palavra (ex: 'specifically').
    //  Usar word boundary.
    novoHtml = novoHtml.replace(
      /(>|^|s)(CIF|FOB|EXW)(s*[—-]s*(?:Cost|Custo|Free|Livre|Ex Works|Na Fabrica))/g,
      '$1$2 · ' + countryUp + '$3'
    );

    if(novoHtml !== html){
      el.innerHTML = novoHtml;
      el.setAttribute(FLAG_DONE_ATTR, country);
      console.log('[98-prop-pais-destino] pais injetado: ' + country);
      return true;
    }
    return false;
  }

  function tick(){
    var country = getDestinationCountry();
    if(!country) return;

    // Procurar TODOS elementos que recebem o conteudo do incoterm
    // Inclui prop-fob-cif-block (tabela CIF/FOB) e qualquer outro bloco
    // que tenha o titulo do incoterm.
    var seletores = ['#prop-fob-cif-block', '#prop-incoterm-box', '#prop-incoterm-block'];
    seletores.forEach(function(s){
      try {
        var el = document.querySelector(s);
        if(el) injetarPaisNoElemento(el, country);
      } catch(e){}
    });

    // Tambem busca generica: blocos que contem '🚢 CIF —' ou '🚢 FOB —' no innerHTML
    try {
      var todos = document.querySelectorAll('div, section');
      for(var i = 0; i < todos.length; i++){
        var d = todos[i];
        // Otimizacao: skip se nao for visivel ou nao tiver text relevante
        if(d.children.length > 30) continue;
        var txt = d.textContent || '';
        if(/🚢s+(CIF|FOB|EXW)s*[—-]/.test(txt) && txt.length < 5000){
          injetarPaisNoElemento(d, country);
        }
      }
    } catch(e){}
  }

  // Polling 800ms (lightweight, so atua quando proposta visivel)
  setInterval(tick, 800);
  setTimeout(tick, 200);
  setTimeout(tick, 1500);

  // MutationObserver: reage a mudancas em prop-fob-cif-block ou outros containers
  if(typeof MutationObserver !== 'undefined'){
    var mo = new MutationObserver(function(muts){
      // Se algum mutation envolve um elemento que pode ter incoterm, dispara tick
      for(var i = 0; i < muts.length; i++){
        var t = muts[i].target;
        if(t && t.id && /prop-fob-cif-block|prop-incoterm/.test(t.id)){
          // Limpar flag pra forcar re-injection (caso pais tenha mudado)
          t.removeAttribute(FLAG_DONE_ATTR);
          setTimeout(tick, 50);
          return;
        }
      }
      // Se modal CRM mudou (pais setado), redispara
      setTimeout(tick, 100);
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: false });
  }

  console.log('[98-prop-pais-destino] instalado');
})();
