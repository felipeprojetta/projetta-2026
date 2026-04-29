/* ============================================================
 * MODULE 92: CAMBIO MASTER — variavel master USD->BRL
 * ============================================================
 *
 * Responsavel por manter UMA unica fonte de verdade pro cambio
 * dolar. Qualquer modulo que precisa converter BRL<->USD chama
 * window.projettaCambio.get().
 *
 * Fluxo:
 *  1. Ao carregar, busca media dos ultimos 30 dias da AwesomeAPI
 *  2. Preenche automaticamente se user nao setou override manual
 *  3. User pode editar o campo na tela de Orcamento
 *  4. Ao mudar, emite evento 'projetta:cambio-changed' pra todos
 *     os consumidores (frete calc, card CRM, proposta, etc)
 *  5. Persiste no localStorage
 *
 * API publica:
 *   window.projettaCambio.get()          - retorna valor atual
 *   window.projettaCambio.set(v, source) - set manual/auto
 *   window.projettaCambio.onChange(cb)   - registrar callback
 *   window.projettaCambio.getMedia()     - media 30d
 *   window.projettaCambio.refresh()      - re-fetch API
 */
(function(){
  'use strict';

  var DEFAULT = 5.20;
  var STORAGE_KEY = 'projetta_cambio_master_v1';
  var MEDIA_CACHE_KEY = 'cambio_usd_brl_media_v1';
  var CACHE_MS = 24*3600*1000; // 24h
  var listeners = [];

  var state = {
    valor: DEFAULT,
    source: 'default',  // default | media | manual
    media30d: null,
    ultimoFetch: 0
  };

  // Restaurar do localStorage
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if(saved && saved.valor > 0){
      state.valor = saved.valor;
      state.source = saved.source || 'manual';
    }
  } catch(e){}

  function fmt(v){ return 'R$ ' + (Number(v)||0).toFixed(4).replace('.',','); }

  function getCambio(){ return state.valor; }

  function setCambio(novoValor, source){
    novoValor = parseFloat(novoValor);
    if(!isFinite(novoValor) || novoValor <= 0){ return false; }
    var antigo = state.valor;
    state.valor = novoValor;
    state.source = source || 'manual';
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({valor: state.valor, source: state.source})); } catch(e){}

    // Atualizar UI (se existir)
    var inp = document.getElementById('cambio-master-input');
    if(inp && Math.abs((parseFloat(inp.value)||0) - novoValor) > 0.0001){
      inp.value = novoValor.toFixed(4);
    }
    var badge = document.getElementById('cambio-master-badge');
    if(badge){
      if(state.source === 'manual')      badge.textContent = 'Manual';
      else if(state.source === 'media')  badge.textContent = 'Média 30d';
      else                                badge.textContent = 'Default';
    }

    if(Math.abs(novoValor - antigo) > 0.0001){
      // Notificar listeners
      listeners.forEach(function(cb){ try { cb(novoValor, antigo); } catch(e){ console.warn('[cambio] listener:', e); } });
      // Broadcast global
      try {
        window.dispatchEvent(new CustomEvent('projetta:cambio-changed', {detail:{valor:novoValor, antigo:antigo, source:state.source}}));
      } catch(e){}
      // Tentar triggar recalc em varios lugares
      _propagarMudanca(novoValor);
    }
    return true;
  }

  function onChange(cb){ if(typeof cb === 'function') listeners.push(cb); }

  // Propagar a mudanca de cambio pros consumidores conhecidos
  function _propagarMudanca(valor){
    // 1. Calculadora de frete (se estiver aberta)
    var fcInp = document.getElementById('frete-calc-cambio');
    if(fcInp){
      fcInp.value = valor.toFixed(4);
      if(typeof window.recomputeAndRender === 'function'){ try { window.recomputeAndRender(); } catch(e){} }
    }
    // 2. Campo inst-intl-cambio (usado no card CRM)
    var intlInp = document.getElementById('inst-intl-cambio');
    if(intlInp){
      intlInp.value = valor.toFixed(4);
    }
    // 3. Re-render do CRM (se tiver cards com valor USD)
    if(typeof window.crmRender === 'function'){
      try { window.crmRender(); } catch(e){}
    }
    // 4. Recalcular DRE (se calc() disponivel)
    if(typeof window.calc === 'function'){
      try { window.calc(); } catch(e){}
    }
  }

  async function fetchMedia30d(){
    try {
      var c = JSON.parse(localStorage.getItem(MEDIA_CACHE_KEY) || 'null');
      if(c && c.ts && (Date.now() - c.ts) < CACHE_MS && c.valor){
        return { valor: c.valor, source: 'cache', n: c.n, ts: c.ts };
      }
    } catch(e){}
    try {
      var r = await fetch('https://economia.awesomeapi.com.br/json/daily/USD-BRL/30');
      if(!r.ok) throw new Error('HTTP '+r.status);
      var arr = await r.json();
      if(!Array.isArray(arr) || arr.length === 0) throw new Error('vazio');
      var vals = arr.map(function(x){ return parseFloat(x.bid); }).filter(function(v){ return !isNaN(v) && v > 0; });
      if(vals.length === 0) throw new Error('sem valores');
      var media = vals.reduce(function(a,b){ return a+b; }, 0) / vals.length;
      var atual = vals[0]; // mais recente
      var min = Math.min.apply(null, vals);
      var max = Math.max.apply(null, vals);
      try {
        localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify({ ts: Date.now(), valor: media, atual: atual, min: min, max: max, n: vals.length }));
      } catch(e){}
      console.log('[cambio-master] media 30d: R$ ' + media.toFixed(4) + ' · atual: R$ ' + atual.toFixed(4));
      return { valor: media, atual: atual, min: min, max: max, source: 'api', n: vals.length };
    } catch(e){
      console.warn('[cambio-master] fetch falhou, usando', state.valor, ':', e.message);
      return null;
    }
  }

  // Atualizar hints visuais com a media 30d
  function atualizarHintsMedia(media, extra){
    var elMedia = document.getElementById('cambio-master-media');
    if(elMedia) elMedia.textContent = fmt(media);
    if(extra){
      var elExtra = document.getElementById('cambio-master-extra');
      if(elExtra){
        elExtra.textContent = 'Min: ' + fmt(extra.min||0) + ' · Max: ' + fmt(extra.max||0) + ' · Atual: ' + fmt(extra.atual||0);
      }
    }
  }

  async function init(){
    var r = await fetchMedia30d();
    if(!r) return;
    state.media30d = r.valor;
    state.ultimoFetch = Date.now();
    atualizarHintsMedia(r.valor, r);

    // Se nunca foi setado manualmente, usa a media
    if(state.source !== 'manual'){
      setCambio(r.valor, 'media');
    }
  }

  // API publica
  window.projettaCambio = {
    get: getCambio,
    set: setCambio,
    onChange: onChange,
    getMedia: function(){ return state.media30d; },
    refresh: async function(){
      var r = await fetchMedia30d();
      if(r){
        state.media30d = r.valor;
        atualizarHintsMedia(r.valor, r);
      }
    },
    _state: state  // debug
  };

  // Wire UI quando DOM pronto
  function wireUI(){
    var inp = document.getElementById('cambio-master-input');
    if(!inp){
      // Tentar de novo em 500ms (pode ser que o HTML ainda nao renderizou)
      setTimeout(wireUI, 500);
      return;
    }
    inp.value = state.valor.toFixed(4);
    inp.addEventListener('change', function(){
      setCambio(inp.value, 'manual');
    });
    inp.addEventListener('blur', function(){
      setCambio(inp.value, 'manual');
    });
    inp.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ inp.blur(); }
    });
    var link = document.getElementById('cambio-master-usar-media');
    if(link){
      link.addEventListener('click', function(e){
        e.preventDefault();
        if(state.media30d) setCambio(state.media30d, 'media');
      });
    }
    var refreshBtn = document.getElementById('cambio-master-refresh');
    if(refreshBtn){
      refreshBtn.addEventListener('click', function(e){
        e.preventDefault();
        // Limpar cache pra forcar re-fetch
        try { localStorage.removeItem(MEDIA_CACHE_KEY); } catch(e){}
        window.projettaCambio.refresh();
      });
    }
    init();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wireUI);
  } else {
    setTimeout(wireUI, 100);
  }

  console.log('[cambio-master v1] carregado — window.projettaCambio');
})();
