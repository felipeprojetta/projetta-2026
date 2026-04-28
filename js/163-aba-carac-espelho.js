/* ============================================================================
 * js/163-aba-carac-espelho.js  —  v2 (28-abr-2026)
 *
 * Felipe 28/04: aba Caracteristicas vira ESPELHO READ-ONLY do card.
 * v2: ESPELHO COMPLETO com configurações específicas por modelo
 *  - Modelo 23 (Clássica): Revestimento, Divisão Altura, Tipo Moldura, Distâncias
 *  - Modelo 06/16 (Frisos H Variável): Quantidade Frisos, Espessura
 *  - Modelo 02 (Friso Vertical): Quantidade Verticais
 *  - Re-aplica readonly defensivamente
 *  - Sincroniza valores ao trocar item ativo
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta163v2Applied) return;
  window.__projetta163v2Applied = true;

  function $(id){ return document.getElementById(id); }

  var CAMPOS_ESPELHO_PADRAO = [
    'carac-abertura','carac-modelo','carac-folhas','folhas-porta',
    'carac-cor-ext','carac-cor-int','carac-cor-macico',
    'carac-fech-mec','carac-fech-dig','carac-cilindro',
    'carac-puxador','carac-pux-tam',
    'carac-tem-alisar',
    'carac-dist-borda-cava','carac-largura-cava',
    'carac-dist-borda-friso','carac-largura-friso',
    'carac-friso-vert','carac-friso-horiz',
    'carac-ripado-total','carac-ripado-2lados',
    'qtd-portas','largura','altura',
    'carac-cor-ext-search','carac-cor-int-search','carac-cor-macico-search'
  ];

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
      '.espelho-banner button:hover{ background:#f0f7fc }' +
      '.espelho-bloco-mod{ background:#fff;border:1.5px solid #e1c4f0;border-radius:8px;padding:10px 14px;margin:8px 0;font-family:inherit }' +
      '.espelho-bloco-mod-h{ font-size:11px;font-weight:700;color:#7e3a93;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;display:flex;align-items:center;gap:6px }' +
      '.espelho-bloco-mod-grid{ display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px }' +
      '.espelho-bloco-mod-fr{ display:flex;flex-direction:column;gap:2px }' +
      '.espelho-bloco-mod-fr label{ font-size:10px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:.03em }' +
      '.espelho-bloco-mod-fr .val{ background:#f5f0fa;border:1px solid #d4b6e8;border-radius:6px;padding:6px 10px;font-size:13px;font-weight:700;color:#003144;font-family:inherit }';
    document.head.appendChild(style);
  }

  function aplicarReadOnly(){
    CAMPOS_ESPELHO_PADRAO.forEach(function(id){
      var el = $(id); if(!el) return;
      if(el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'){
        if(el.type === 'checkbox' || el.type === 'radio'){
          el.disabled = true;
        } else {
          el.readOnly = true;
        }
        if(!el.classList.contains('espelho-readonly')){
          el.classList.add('espelho-readonly');
        }
        if(el.tagName === 'SELECT'){
          el.style.pointerEvents = 'none';
          el.tabIndex = -1;
        }
      }
    });
  }

  function inserirBannerCarac(){
    var card = $('card-carac-porta'); if(!card) return;
    if(card.querySelector('.espelho-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'espelho-banner';
    banner.innerHTML =
      '<div>' +
        '<div style="font-size:12px;font-weight:700">👁 Espelho do item ativo do card</div>' +
        '<div style="font-size:10px;font-weight:500;opacity:.85;margin-top:1px">Edite no card "Itens do Pedido" acima</div>' +
      '</div>' +
      '<button onclick="abrirCardItensPedido()">✏ Editar no card</button>';
    var firstChild = card.firstElementChild;
    if(firstChild) card.insertBefore(banner, firstChild.nextSibling);
    else card.appendChild(banner);
  }

  // ════════════════════════════════════════════════════════════════════════
  // BLOCO ESPECÍFICO POR MODELO — Configurações que NÃO existem na aba
  // Características padrão (só no card)
  // ════════════════════════════════════════════════════════════════════════

  function getItemAtivo(){
    var idx = window._orcItemAtual;
    if(idx == null || idx < 0) return null;
    return (window._orcItens || [])[idx] || null;
  }

  function _row(label, val){
    return '<div class="espelho-bloco-mod-fr"><label>'+label+'</label><div class="val">'+(val == null || val === '' ? '—' : val)+'</div></div>';
  }

  function buildBlocoModelo23(it){
    var rev = it.moldura_rev || '';
    var revLabel = rev === 'MACICO' ? '🪵 Maciço 2.5mm (Boiserie - perfil alumínio)' :
                   rev === 'ACM' ? '◾ ACM 4mm (na chapa)' : (rev || '—');
    return '<div class="espelho-bloco-mod-h">🏛️ Configuração de Moldura (Modelo 23)</div>' +
      '<div class="espelho-bloco-mod-grid">' +
        _row('Revestimento', revLabel) +
        _row('Divisão Altura', it.moldura_divisao || it.moldura_alt_qty || '—') +
        _row('Qtd Molduras Largura', it.moldura_larg_qty || '—') +
        _row('Qtd Molduras Altura', it.moldura_alt_qty || '—') +
        _row('Tipo Moldura', it.moldura_tipo || '—') +
        _row('Dist. 1ª (mm)', it.moldura_dis1 || '—') +
        _row('Dist. 2ª (mm)', it.moldura_dis2 || '—') +
        _row('Dist. 3ª (mm)', it.moldura_dis3 || '—') +
      '</div>';
  }

  function buildBlocoModelo06_16(it){
    return '<div class="espelho-bloco-mod-h">📏 Configuração do Friso Horizontal (Modelo '+it.modelo+')</div>' +
      '<div class="espelho-bloco-mod-grid">' +
        _row('Quantidade Frisos', it.friso_h_qty || '—') +
        _row('Espessura Friso (mm)', it.friso_h_esp != null ? it.friso_h_esp : '—') +
        _row('Sentido das Tampas', it.tampa_orient === 'horizontal' ? '↔ Deitada' : '↕ Em pé (padrão)') +
      '</div>';
  }

  function buildBlocoModelo02(it){
    return '<div class="espelho-bloco-mod-h">📏 Configuração do Friso Vertical (Modelo 02)</div>' +
      '<div class="espelho-bloco-mod-grid">' +
        _row('Qtd Frisos Verticais', it.friso_v_qty || '—') +
        _row('Dist. Borda (mm)', it.dist_borda_friso || '—') +
        _row('Largura Friso (mm)', it.largura_friso || '—') +
      '</div>';
  }

  function atualizarBlocoModelo(){
    var card = $('card-carac-porta'); if(!card) return;
    var it = getItemAtivo();
    var existing = card.querySelector('.espelho-bloco-mod');
    if(!it || it.tipo !== 'porta_pivotante' || !it.modelo){
      if(existing) existing.remove();
      return;
    }
    var html = '';
    if(it.modelo === '23') html = buildBlocoModelo23(it);
    else if(it.modelo === '06' || it.modelo === '16') html = buildBlocoModelo06_16(it);
    else if(it.modelo === '02') html = buildBlocoModelo02(it);
    if(!html){
      if(existing) existing.remove();
      return;
    }
    if(existing){
      existing.innerHTML = html;
    } else {
      var bloco = document.createElement('div');
      bloco.className = 'espelho-bloco-mod';
      bloco.innerHTML = html;
      // Inserir antes da seção FASE DO PROJETO se existir, senão no fim do card
      var fase = card.querySelector('[id*="fase"]');
      if(fase && fase.parentElement === card){
        card.insertBefore(bloco, fase);
      } else {
        card.appendChild(bloco);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // BOTÃO "Editar no card" — scroll até barra Itens do Pedido
  // ════════════════════════════════════════════════════════════════════════

  window.abrirCardItensPedido = function(){
    var bar = $('orc-itens-bar');
    if(bar && bar.scrollIntoView){
      bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var orig = bar.style.boxShadow;
      bar.style.transition = 'box-shadow .3s';
      bar.style.boxShadow = '0 0 0 4px #ff9800, 0 0 25px rgba(255,152,0,.5)';
      setTimeout(function(){ bar.style.boxShadow = orig; }, 1800);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // HOOK em orcItemSelecionar — atualiza bloco ao mudar item
  // ════════════════════════════════════════════════════════════════════════

  function hookSelecionar(){
    var orig = window.orcItemSelecionar;
    if(typeof orig !== 'function'){ setTimeout(hookSelecionar, 600); return; }
    if(orig.__sub163v2Hooked) return;
    window.orcItemSelecionar = function(idx){
      var r = orig.apply(this, arguments);
      setTimeout(function(){
        try {
          aplicarReadOnly();
          atualizarBlocoModelo();
        } catch(e){}
      }, 500);
      return r;
    };
    window.orcItemSelecionar.__sub163v2Hooked = true;
  }

  // INIT
  function init(){
    setTimeout(function(){
      injetarCSS();
      aplicarReadOnly();
      inserirBannerCarac();
      atualizarBlocoModelo();
      hookSelecionar();
    }, 800);

    setInterval(function(){
      try {
        aplicarReadOnly();
        if(!document.querySelector('#card-carac-porta .espelho-banner')){
          inserirBannerCarac();
        }
        atualizarBlocoModelo();
      } catch(e){}
    }, 2500);

    document.addEventListener('click', function(e){
      var t = e.target;
      if(t && t.textContent && /Or[çc]amento/.test(t.textContent)){
        setTimeout(function(){ aplicarReadOnly(); atualizarBlocoModelo(); }, 200);
        setTimeout(function(){ aplicarReadOnly(); atualizarBlocoModelo(); }, 600);
      }
    });

    console.log('[163-aba-carac-espelho v2] iniciado — espelho expandido');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
