/* ============================================================================
 * 99-cambio-master.js — Camera USD->BRL MASTER (v1)
 *
 * Sincroniza todos os campos de cambio do sistema. Busca media dos ultimos
 * 30 dias da AwesomeAPI, preenche automaticamente, e mantém TODOS os campos
 * em sync (porta, frete internacional, proposta).
 *
 * Campos sincronizados:
 *   - #inst-intl-cambio        (aba Orçamento — campo principal da porta)
 *   - #frete-calc-cambio       (modal calculadora de frete)
 *
 * Eventos:
 *   - Ao mudar qualquer um dos campos, atualiza o outro + dispara change+input
 *   - Dispara window.calc() pra recalcular a porta
 *   - Dispara recomputeAndRender() da calculadora (se aberta)
 *
 * Cache: 24h no localStorage 'cambio_usd_brl_media_v1' (mesma chave do 37-frete-calc)
 * ========================================================================= */
(function(){
'use strict';

var STORAGE_KEY = 'cambio_usd_brl_media_v1';
var CACHE_MS = 24*3600*1000;
var IDS = ['inst-intl-cambio', 'frete-calc-cambio'];

// Valor atual aplicado globalmente (pra lookups rapidos)
window._CAMBIO_USD_BRL_MASTER = 5.20;

async function _fetchMedia30d(){
  try {
    var c = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), valor: media, n: vals.length }));
    return { valor: media, source: 'api', n: vals.length, ts: Date.now() };
  } catch(e){
    console.warn('[cambio-master] fetch falhou:', e.message);
    return { valor: 5.20, source: 'fallback' };
  }
}

// Disparar recalculos onde quer que estejam
function _triggerRecalc(){
  try { if(typeof window.calc === 'function') window.calc(); } catch(e){}
  try { if(typeof window.recomputeAndRender === 'function') window.recomputeAndRender(); } catch(e){}
}

// Setar valor em todos os campos (sem disparar loop)
var _applying = false;
function _setAllCampos(valor, fonte){
  if(_applying) return;
  _applying = true;
  try {
    var valorStr = (typeof valor === 'number') ? valor.toFixed(4) : String(valor);
    var valorNum = parseFloat(valorStr) || 0;
    window._CAMBIO_USD_BRL_MASTER = valorNum;
    IDS.forEach(function(id){
      if(id === fonte) return; // nao reescrever o campo que originou
      var el = document.getElementById(id);
      if(el && Math.abs(parseFloat(el.value || 0) - valorNum) > 0.0001){
        el.value = valorStr;
      }
    });
  } finally {
    _applying = false;
  }
  _triggerRecalc();
}

// Escutar mudanças em qualquer campo (input, change, blur)
function _wireCampo(id){
  var el = document.getElementById(id);
  if(!el || el.__cambioMasterWired) return;
  el.__cambioMasterWired = true;
  ['input','change','blur'].forEach(function(evt){
    el.addEventListener(evt, function(){
      var v = parseFloat(el.value);
      if(!isNaN(v) && v > 0 && v < 100){
        _setAllCampos(v, id);
      }
    });
  });
}

// Widget de info abaixo do campo principal (#inst-intl-cambio)
function _atualizarInfoHint(media){
  var info = document.getElementById('inst-intl-cambio-info');
  if(!info) return;
  var data = media.ts ? new Date(media.ts).toLocaleDateString('pt-BR') : '';
  var src = media.source === 'api' ? '(cotacao hoje via AwesomeAPI)' :
            media.source === 'cache' ? '(cache 24h · ' + data + ')' : '(fallback)';
  info.innerHTML = '💵 Media 30 dias: <b>R$ ' + media.valor.toFixed(4) + '</b> ' + src +
                   ' &middot; <a href="#" id="cambio-master-usar-media" ' +
                   'style="color:#0C447C;text-decoration:underline;font-weight:600">Usar media</a>';
  var link = document.getElementById('cambio-master-usar-media');
  if(link){
    link.onclick = function(e){
      e.preventDefault();
      _setAllCampos(media.valor, null); // null = atualiza todos
    };
  }
}

// Inicializar
async function _init(){
  // Esperar o DOM estar pronto e os campos existirem
  var tries = 0;
  while(tries < 60){
    if(document.getElementById('inst-intl-cambio')) break;
    await new Promise(function(r){ setTimeout(r, 200); });
    tries++;
  }

  // Escutar os campos
  IDS.forEach(_wireCampo);

  // Buscar media e aplicar se campo ainda esta no default
  var media = await _fetchMedia30d();
  if(media && media.valor > 0){
    // Se nenhum campo foi editado (todos no default 5.20 ou zerados), usa a media
    var el = document.getElementById('inst-intl-cambio');
    var valorAtual = el ? parseFloat(el.value) : 0;
    if(valorAtual === 5.20 || valorAtual === 5 || valorAtual === 0 || isNaN(valorAtual)){
      _setAllCampos(media.valor, null);
    } else {
      // Campo ja tem valor diferente — so atualiza a variavel master
      window._CAMBIO_USD_BRL_MASTER = valorAtual;
    }
    _atualizarInfoHint(media);
  }

  // Re-wire periodicamente caso o campo seja recriado (ex: ao carregar snapshot)
  setInterval(function(){
    IDS.forEach(_wireCampo);
  }, 3000);

  console.log('[99-cambio-master v1] ativo — campos sync: ' + IDS.join(', '));
}

// Expor funcao pra forcar refresh
window.cambioMasterRefresh = async function(){
  var media = await _fetchMedia30d();
  if(media && media.valor > 0){
    _setAllCampos(media.valor, null);
    _atualizarInfoHint(media);
  }
  return media;
};

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _init);
} else {
  _init();
}

})();
