/* ============================================================================
 * js/163-aba-carac-espelho.js  —  (28-abr-2026)
 *
 * Felipe 28/04: "Opção A car e fonte única, aba e só espelho somente
 * pra não ter que ficar abrindo card pra ver as coisas"
 *
 * TRANSFORMA A ABA "Características da Porta" EM ESPELHO READ-ONLY
 * - Todos os campos viram disabled (visual acinzentado)
 * - Banner topo: "👁 Espelho do item ativo do card"
 * - Botão "✏ Editar no card" (scroll até o card Itens do Pedido)
 * - Re-aplica disabled periodicamente (defensivo)
 *
 * ARQUITETURA: Card (Itens do Pedido) = FONTE ÚNICA. Tudo aqui só reflete.
 * Para editar: usuario edita no card e salva → js/161 popula o espelho.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta163Applied) return;
  window.__projetta163Applied = true;

  function $(id){ return document.getElementById(id); }

  // Lista de TODOS os campos da aba Caracteristicas + Itens do Pedido topo
  // que devem virar read-only no espelho
  var CAMPOS_ESPELHO = [
    // Aba "Características da Porta"
    'carac-abertura','carac-modelo','carac-folhas','folhas-porta',
    'carac-cor-ext','carac-cor-int','carac-cor-macico',
    'carac-fech-mec','carac-fech-dig','carac-cilindro',
    'carac-puxador','carac-pux-tam',
    'carac-tem-alisar',
    'carac-dist-borda-cava','carac-largura-cava',
    'carac-dist-borda-friso','carac-largura-friso',
    'carac-friso-vert','carac-friso-horiz',
    'carac-ripado-total','carac-ripado-2lados',
    // Topo do orçamento (também espelha)
    'qtd-portas','largura','altura',
    // Filtro busca de cores (não permite digitar)
    'carac-cor-ext-search','carac-cor-int-search','carac-cor-macico-search'
  ];

  // CSS visual do espelho
  function injetarCSS(){
    if($('css-espelho')) return;
    var style = document.createElement('style');
    style.id = 'css-espelho';
    style.innerHTML =
      '.espelho-readonly{ background:#f5f7fa !important; cursor:not-allowed !important; opacity:.92 !important; color:#003144 !important; font-weight:700 !important; pointer-events:none !important; }' +
      '.espelho-readonly:focus{ outline:none !important; box-shadow:none !important; }' +
      'select.espelho-readonly{ -webkit-appearance:none !important; appearance:none !important; }' +
      '.espelho-banner{ background:linear-gradient(135deg,#1a5276,#2874a6); color:#fff; padding:10px 16px; border-radius:8px; margin:0 0 10px 0; font-size:12px; font-weight:600; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; box-shadow:0 2px 6px rgba(0,0,0,.12) }' +
      '.espelho-banner button{ background:#fff; color:#1a5276; border:none; border-radius:6px; padding:6px 14px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; box-shadow:0 1px 3px rgba(0,0,0,.15) }' +
      '.espelho-banner button:hover{ background:#f0f7fc }';
    document.head.appendChild(style);
  }

  // Aplicar disabled visual em todos os campos do espelho
  function aplicarReadOnly(){
    CAMPOS_ESPELHO.forEach(function(id){
      var el = $(id); if(!el) return;
      // marcar como readonly
      if(el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'){
        if(el.type === 'checkbox' || el.type === 'radio'){
          el.disabled = true;
        } else {
          el.readOnly = true;
        }
        if(!el.classList.contains('espelho-readonly')){
          el.classList.add('espelho-readonly');
        }
        // Para selects nao podem ter readonly real, usar pointer-events
        if(el.tagName === 'SELECT'){
          el.style.pointerEvents = 'none';
          el.tabIndex = -1;
        }
      }
    });
  }

  // Banner topo do card "Características da Porta"
  function inserirBannerCarac(){
    var card = $('card-carac-porta'); if(!card) return;
    if(card.querySelector('.espelho-banner')) return;

    var banner = document.createElement('div');
    banner.className = 'espelho-banner';
    banner.innerHTML =
      '<div>' +
        '<div style="font-size:12px;font-weight:700">👁 Espelho do item ativo do card</div>' +
        '<div style="font-size:10px;font-weight:500;opacity:.85;margin-top:1px">Para alterar, edite no card "Itens do Pedido" acima</div>' +
      '</div>' +
      '<button onclick="abrirCardItensPedido()">✏ Editar no card</button>';

    // Inserir como primeiro filho do card (após qualquer header existente)
    var firstChild = card.firstElementChild;
    if(firstChild) card.insertBefore(banner, firstChild.nextSibling);
    else card.appendChild(banner);
  }

  // Banner topo do bloco "Porta Principal" (largura/altura/qtd)
  function inserirBannerPortaPrincipal(){
    var lar = $('largura'); if(!lar) return;
    var bloco = lar.closest('.fieldset, .card, fieldset, section, div[class*="card"]') || lar.parentElement;
    if(!bloco) return;
    // Subir até achar um container "alto" (ex: o card Porta Principal)
    var seek = bloco;
    for(var i = 0; i < 5; i++){
      if(!seek.parentElement) break;
      var rect = seek.getBoundingClientRect();
      if(rect.width > 400) break;
      seek = seek.parentElement;
    }
    if(seek.querySelector('.espelho-banner-porta')) return;

    var banner = document.createElement('div');
    banner.className = 'espelho-banner espelho-banner-porta';
    banner.style.fontSize = '11px';
    banner.innerHTML =
      '<div>👁 <b>Largura, Altura e Qtd</b> vêm do card · Edite no card</div>' +
      '<button onclick="abrirCardItensPedido()" style="font-size:10px;padding:4px 10px">✏ Editar</button>';

    if(seek.firstElementChild){
      seek.insertBefore(banner, seek.firstElementChild);
    }
  }

  // Função global: scroll até a barra "Itens do Pedido"
  window.abrirCardItensPedido = function(){
    // Tenta scroll até #orc-itens-bar (lugar do botão verde)
    var bar = $('orc-itens-bar');
    if(bar && bar.scrollIntoView){
      bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Highlight visual temporario
      var orig = bar.style.boxShadow;
      bar.style.transition = 'box-shadow .3s';
      bar.style.boxShadow = '0 0 0 4px #ff9800, 0 0 25px rgba(255,152,0,.5)';
      setTimeout(function(){ bar.style.boxShadow = orig; }, 1800);
    } else {
      // Fallback: tenta encontrar o card kanban e clicar (abre modal)
      var card = document.querySelector('.crm-card[data-id="' + (window._crmOrcCardId||'') + '"]');
      if(card) card.click();
    }
  };

  // INIT
  function init(){
    setTimeout(function(){
      injetarCSS();
      aplicarReadOnly();
      inserirBannerCarac();
      inserirBannerPortaPrincipal();
    }, 800);

    // Reforço periódico — caso outro JS habilite o campo
    setInterval(function(){
      try {
        aplicarReadOnly();
        if(!document.querySelector('#card-carac-porta .espelho-banner')){
          inserirBannerCarac();
        }
      } catch(e){}
    }, 3000);

    // Reagir quando a aba Orçamento é aberta
    document.addEventListener('click', function(e){
      var t = e.target;
      if(t && t.textContent && /Or[çc]amento/.test(t.textContent)){
        setTimeout(aplicarReadOnly, 200);
        setTimeout(aplicarReadOnly, 600);
      }
    });

    console.log('[163-aba-carac-espelho] iniciado — card é fonte única');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
