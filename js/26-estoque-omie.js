/* ═══════════════════════════════════════════════════════════════════
   MODULE 26: ESTOQUE OMIE
   ─────────────────────────────────────────────────────────────────
   Consulta de estoque em tempo real via Edge Function omie-proxy
   (Supabase) → API Omie (app.omie.com.br/api/v1/estoque/consulta)
   Carrega todas as páginas, cacheia em memória e filtra client-side.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var PROXY_URL = (window._SB_URL || 'https://plmliavuwlgpwaizfeds.supabase.co') + '/functions/v1/omie-proxy';
var REG_POR_PAGINA = 50;

// Local de estoque padrão Projetta Aluminio (Estoque de Revestimentos).
// Sem esse parâmetro, a Omie retorna saldos do local default (5560440416)
// que NÃO é onde os produtos ficam. Com este ID, os saldos físicos batem
// com o que aparece no portal da Omie.
var CODIGO_LOCAL_ESTOQUE = 5528735611;

// Cache em memória (perdura durante a sessão do browser, não persiste em LS)
var _cache = {
  produtos: null,           // array com todos os produtos carregados
  dataPosicao: '',          // string DD/MM/AAAA retornada pela Omie
  carregadoEm: 0,           // timestamp ms
};

// Status helper
function setStatus(msg, isError){
  var el = document.getElementById('eomie-status');
  if(!el) return;
  el.textContent = msg || '';
  el.style.color = isError ? '#c62828' : '#666';
}

function setLoadingMsg(msg){
  var el = document.getElementById('eomie-loading-msg');
  if(el) el.textContent = msg;
}

function show(id, yes){
  var el = document.getElementById(id);
  if(el) el.style.display = yes ? '' : 'none';
}

// Chama a Edge Function omie-proxy
async function omieProxy(endpoint, call, param){
  var ANON_KEY = window._SB_KEY;
  if(!ANON_KEY){ throw new Error('Supabase anon key não disponível'); }
  var res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + ANON_KEY,
      'apikey': ANON_KEY
    },
    body: JSON.stringify({ endpoint: endpoint, call: call, param: param })
  });
  var text = await res.text();
  var data;
  try { data = JSON.parse(text); } catch(e){
    throw new Error('Resposta inválida da Omie (não JSON)');
  }
  if(!res.ok){
    var msg = (data && (data.faultstring || data.error)) || ('HTTP ' + res.status);
    throw new Error(msg);
  }
  return data;
}

// Carrega TODAS as páginas de ListarPosEstoque
async function carregarTodasPaginas(){
  var todosProdutos = [];
  var dataPosicao = '';
  var pagina = 1;
  var totalPaginas = 1;

  while(pagina <= totalPaginas){
    setLoadingMsg('Carregando página ' + pagina + (totalPaginas > 1 ? ' de ' + totalPaginas : '') + '…');
    var resp = await omieProxy('estoque/consulta', 'ListarPosEstoque', [{
      nPagina: pagina,
      nRegPorPagina: REG_POR_PAGINA,
      cExibeTodos: 'S',
      codigo_local_estoque: CODIGO_LOCAL_ESTOQUE
    }]);
    totalPaginas = resp.nTotPaginas || 1;
    dataPosicao = resp.dDataPosicao || dataPosicao;
    var lote = Array.isArray(resp.produtos) ? resp.produtos : [];
    todosProdutos = todosProdutos.concat(lote);
    pagina++;
    // Pequena pausa entre páginas para não estourar rate-limit da Omie
    if(pagina <= totalPaginas){ await new Promise(function(r){ setTimeout(r, 120); }); }
  }

  return { produtos: todosProdutos, dataPosicao: dataPosicao };
}

// Entry point: carrega (ou re-carrega com force=true) e renderiza
window.eomieCarregar = async function(force){
  var btn = document.getElementById('eomie-btn-refresh');
  if(btn){ btn.disabled = true; btn.style.opacity = '0.6'; btn.style.cursor = 'wait'; }

  // Se cache válido (< 5 min) e não forçado, usa cache
  if(!force && _cache.produtos && (Date.now() - _cache.carregadoEm) < 5*60*1000){
    aplicarCache();
    if(btn){ btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
    return;
  }

  show('eomie-empty', false);
  show('eomie-tabela-wrap', false);
  show('eomie-loading', true);
  setStatus('Conectando à Omie…');

  try {
    var t0 = Date.now();
    var res = await carregarTodasPaginas();
    _cache.produtos = res.produtos;
    _cache.dataPosicao = res.dataPosicao;
    _cache.carregadoEm = Date.now();
    var seg = ((Date.now() - t0)/1000).toFixed(1);
    setStatus(res.produtos.length + ' produtos · ' + seg + 's');
    aplicarCache();
  } catch(err){
    show('eomie-loading', false);
    show('eomie-empty', true);
    var emptyEl = document.getElementById('eomie-empty');
    if(emptyEl){
      emptyEl.innerHTML = '<div style="font-size:48px;margin-bottom:10px">⚠️</div>' +
        '<div style="font-size:14px;font-weight:600;color:#c62828;margin-bottom:6px">Erro ao carregar estoque</div>' +
        '<div style="font-size:12px;color:#666;max-width:500px;margin:0 auto">' + (err.message || String(err)) + '</div>' +
        '<button onclick="eomieCarregar(true)" style="margin-top:14px;padding:8px 16px;border-radius:8px;border:1.5px solid #c62828;background:#fff;color:#c62828;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Tentar novamente</button>';
    }
    setStatus('Erro: ' + (err.message || 'falha'), true);
  } finally {
    if(btn){ btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
  }
};

function aplicarCache(){
  show('eomie-loading', false);
  show('eomie-empty', false);
  show('eomie-tabela-wrap', true);
  var dPos = document.getElementById('eomie-data-pos');
  if(dPos) dPos.textContent = _cache.dataPosicao || '—';
  eomieFiltrar();
}

// Filtra e renderiza a tabela
window.eomieFiltrar = function(){
  if(!_cache.produtos){ return; }
  var q = (document.getElementById('eomie-search') || {value:''}).value.trim().toLowerCase();
  var soComSaldo = (document.getElementById('eomie-f-com-saldo') || {}).checked;
  var soAbaixoMin = (document.getElementById('eomie-f-abaixo-min') || {}).checked;

  var filtrados = _cache.produtos.filter(function(p){
    if(q){
      var cod = (p.cCodigo || '').toLowerCase();
      var desc = (p.cDescricao || '').toLowerCase();
      if(cod.indexOf(q) < 0 && desc.indexOf(q) < 0) return false;
    }
    var saldo = Number(p.nSaldo) || 0;
    var minimo = Number(p.estoque_minimo) || 0;
    if(soComSaldo && saldo <= 0) return false;
    if(soAbaixoMin && !(minimo > 0 && saldo < minimo)) return false;
    return true;
  });

  // Limita render a 500 linhas por vez (UX)
  var LIMITE = 500;
  var exibidos = filtrados.slice(0, LIMITE);

  var tbody = document.getElementById('eomie-tbody');
  if(!tbody) return;

  var html = '';
  for(var i=0; i<exibidos.length; i++){
    var p = exibidos[i];
    var saldo = Number(p.nSaldo) || 0;
    var minimo = Number(p.estoque_minimo) || 0;
    var status, badge;
    if(saldo <= 0){
      status = 'Sem estoque'; badge = '#c62828';
    } else if(minimo > 0 && saldo < minimo){
      status = 'Abaixo do mínimo'; badge = '#f9a825';
    } else {
      status = 'OK'; badge = '#2e7d32';
    }
    html += '<tr style="border-bottom:1px solid #f0f0f0">' +
      '<td style="padding:8px 12px;font-family:monospace;font-size:11px;color:#003144">' + escapeHtml(p.cCodigo || '') + '</td>' +
      '<td style="padding:8px 12px;color:#333">' + escapeHtml(p.cDescricao || '') + '</td>' +
      '<td style="padding:8px 12px;text-align:right;font-weight:700;color:' + (saldo > 0 ? '#2e7d32' : '#c62828') + '">' + fmtNum(saldo) + '</td>' +
      '<td style="padding:8px 12px;text-align:right;color:#666">' + (minimo > 0 ? fmtNum(minimo) : '—') + '</td>' +
      '<td style="padding:8px 12px;text-align:center;color:#666;font-size:11px">' + escapeHtml(p.cUnidade || '—') + '</td>' +
      '<td style="padding:8px 12px;text-align:center"><span style="display:inline-block;padding:3px 9px;border-radius:11px;background:' + badge + ';color:#fff;font-size:10px;font-weight:700">' + status + '</span></td>' +
      '</tr>';
  }

  if(exibidos.length === 0){
    html = '<tr><td colspan="6" style="padding:30px;text-align:center;color:#888;font-size:12px">Nenhum item encontrado com esses filtros.</td></tr>';
  } else if(filtrados.length > LIMITE){
    html += '<tr><td colspan="6" style="padding:12px;text-align:center;color:#f9a825;font-size:11px;background:#fffbf0">⚠️ Exibindo primeiros ' + LIMITE + ' resultados. Refine a busca para ver mais.</td></tr>';
  }

  tbody.innerHTML = html;
  var cv = document.getElementById('eomie-count-view');
  var ct = document.getElementById('eomie-count-total');
  if(cv) cv.textContent = exibidos.length;
  if(ct) ct.textContent = filtrados.length;
};

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  });
}
function fmtNum(n){
  return (Number(n)||0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

})();
