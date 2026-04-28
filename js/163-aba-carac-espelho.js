/* ============================================================================
 * js/163-aba-carac-espelho.js  —  v3 (28-abr-2026)
 *
 * Felipe 28/04 (Safari iOS): "modelo 23 ainda nao aparece configuracoes"
 *
 * CAUSA RAIZ v2: #card-carac-porta tem 2 filhos:
 *   1. .card-hd (cabeçalho clicável)
 *   2. #carac-body (display:none por padrão - accordion FECHADO)
 *
 * Banner e bloco eram inseridos no card mas DENTRO do body fechado
 * (ou em local invisível). Agora:
 *   - Banner inserido DENTRO de #carac-body como PRIMEIRO filho
 *   - Bloco-modelo inserido ANTES da seção "Cores da chapa"
 *   - Quando #carac-body abre, o user vê tudo
 *   - Tambem inserir bloco em #card-carac-porta como copia visivel
 *     mesmo com accordion fechado (placement defensivo)
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta163v3Applied) return;
  window.__projetta163v3Applied = true;

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
    'qtd-portas','largura','altura'
  ];

  function injetarCSS(){
    if($('css-espelho')) return;
    var style = document.createElement('style');
    style.id = 'css-espelho';
    style.innerHTML =
      '.espelho-readonly{ background:#f5f7fa !important; cursor:not-allowed !important; opacity:.92 !important; color:#003144 !important; font-weight:700 !important; pointer-events:none !important; }' +
      '.espelho-readonly:focus{ outline:none !important; box-shadow:none !important; }' +
      'select.espelho-readonly{ -webkit-appearance:none !important; appearance:none !important; }' +
      '.espelho-banner{ background:linear-gradient(135deg,#1a5276,#2874a6); color:#fff; padding:10px 14px; border-radius:8px; margin:8px 0; font-size:12px; font-weight:600; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; box-shadow:0 2px 6px rgba(0,0,0,.12) }' +
      '.espelho-banner button{ background:#fff; color:#1a5276; border:none; border-radius:6px; padding:6px 14px; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; box-shadow:0 1px 3px rgba(0,0,0,.15) }' +
      '.espelho-bloco-mod{ background:#faf5ff;border:2px solid #b87bcf;border-radius:10px;padding:12px 16px;margin:10px 0;font-family:inherit;box-shadow:0 2px 8px rgba(126,58,147,.12) }' +
      '.espelho-bloco-mod-h{ font-size:12px;font-weight:800;color:#7e3a93;text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;display:flex;align-items:center;gap:6px;border-bottom:1px solid #d4b6e8;padding-bottom:6px }' +
      '.espelho-bloco-mod-grid{ display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px }' +
      '.espelho-bloco-mod-fr{ display:flex;flex-direction:column;gap:3px }' +
      '.espelho-bloco-mod-fr label{ font-size:10px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.03em }' +
      '.espelho-bloco-mod-fr .val{ background:#fff;border:1.5px solid #d4b6e8;border-radius:6px;padding:7px 10px;font-size:13px;font-weight:700;color:#003144 }';
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

  // FIX v3: Insere banner DENTRO de #carac-body como PRIMEIRO filho
  // (visível quando o accordion estiver aberto).
  function inserirBannerCarac(){
    var body = $('carac-body'); if(!body) return;
    if(body.querySelector(':scope > .espelho-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'espelho-banner';
    banner.innerHTML =
      '<div>' +
        '<div style="font-size:13px;font-weight:800">👁 Espelho do item ativo do card</div>' +
        '<div style="font-size:10px;font-weight:500;opacity:.85;margin-top:1px">Para alterar, edite no card "Itens do Pedido" acima</div>' +
      '</div>' +
      '<button onclick="abrirCardItensPedido()">✏ Editar no card</button>';
    if(body.firstChild){
      body.insertBefore(banner, body.firstChild);
    } else {
      body.appendChild(banner);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // BLOCO ESPECIFICO POR MODELO
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
        _row('Divisão Altura', it.moldura_divisao || '—') +
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

  // FIX v3: insere bloco-modelo ANTES da seção "Cores da chapa"
  // (dentro de #carac-body, em local visível quando aberto).
  function atualizarBlocoModelo(){
    var body = $('carac-body'); if(!body) return;
    var it = getItemAtivo();
    var existing = body.querySelector('.espelho-bloco-mod');
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
      return;
    }
    var bloco = document.createElement('div');
    bloco.className = 'espelho-bloco-mod';
    bloco.innerHTML = html;

    // Procurar a seção "Cores da chapa" (todos os divs com class "sec")
    var seções = body.querySelectorAll('.sec');
    var secCores = null;
    for(var i = 0; i < seções.length; i++){
      var t = (seções[i].textContent || '').toLowerCase();
      if(t.indexOf('cores') >= 0 && t.indexOf('chapa') >= 0){
        secCores = seções[i];
        break;
      }
    }
    if(secCores){
      body.insertBefore(bloco, secCores);
    } else {
      // Fallback: adicionar no fim do body
      body.appendChild(bloco);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // BOTÃO "Editar no card"
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

  function hookSelecionar(){
    var orig = window.orcItemSelecionar;
    if(typeof orig !== 'function'){ setTimeout(hookSelecionar, 600); return; }
    if(orig.__sub163v3Hooked) return;
    window.orcItemSelecionar = function(idx){
      var r = orig.apply(this, arguments);
      setTimeout(function(){
        try {
          aplicarReadOnly();
          inserirBannerCarac();
          atualizarBlocoModelo();
        } catch(e){ console.warn('[163v3] err:', e); }
      }, 500);
      return r;
    };
    window.orcItemSelecionar.__sub163v3Hooked = true;
  }

  // INIT
  function init(){
    setTimeout(function(){
      injetarCSS();
      aplicarReadOnly();
      inserirBannerCarac();
      atualizarBlocoModelo();
      hookSelecionar();
      console.log('%c[163-v3] espelho expandido ATIVO ✓','background:#7e3a93;color:#fff;padding:4px 10px;border-radius:6px;font-weight:700');
    }, 800);

    setInterval(function(){
      try {
        aplicarReadOnly();
        if($('carac-body') && !$('carac-body').querySelector(':scope > .espelho-banner')){
          inserirBannerCarac();
        }
        atualizarBlocoModelo();
      } catch(e){}
    }, 2500);

    document.addEventListener('click', function(e){
      var t = e.target;
      if(!t) return;
      // Quando clica na aba Orçamento OU expande o accordion Características
      if((t.textContent && /Or[çc]amento/.test(t.textContent)) ||
         (t.id === 'carac-badge') ||
         (t.closest && t.closest('.card-hd.toggle'))){
        setTimeout(function(){ aplicarReadOnly(); inserirBannerCarac(); atualizarBlocoModelo(); }, 200);
        setTimeout(function(){ aplicarReadOnly(); inserirBannerCarac(); atualizarBlocoModelo(); }, 700);
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
