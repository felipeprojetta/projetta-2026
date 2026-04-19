/* ═══════════════════════════════════════════════════════════════════
   MODULE 28: MEMORIAL V2
   ─────────────────────────────────────────────────────────────────
   Sistema novo de salvamento/restauração de orçamentos usando
   tabela Supabase `orcamentos_salvos` (versus blob jsonb antigo).

   Grava TUDO de TODAS as abas (inputs + state globals).
   Ao abrir, restaura 100% do estado SEM recalcular.

   API pública:
     window.MemorialV2.capturar()           → object com tudo
     window.MemorialV2.salvar(card, rev)    → Promise<row>
     window.MemorialV2.listarDoCard(cardId) → Promise<[rows]>
     window.MemorialV2.abrir(id, readOnly)  → Promise<void>
   ═══════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

var SB_URL = (window._SB_URL || 'https://plmliavuwlgpwaizfeds.supabase.co') + '/rest/v1/orcamentos_salvos';
function _KEY(){ return window._SB_KEY; }
function _H(){ var k = _KEY(); return { apikey:k, Authorization:'Bearer '+k, 'Content-Type':'application/json' }; }

// ─────────────────────────────────────────────────────────────────
// Lista de IDs de inputs por aba (montada pelo inventário dinâmico)
// Usado tanto na captura quanto na restauração.
// ─────────────────────────────────────────────────────────────────
var TABS_RELEVANTES = ['tab-orcamento','tab-planificador','tab-os','tab-os-acess'];

function _coletarIdsDeAba(abaId){
  var panel = document.getElementById(abaId);
  if(!panel) return [];
  var inputs = panel.querySelectorAll('input, select, textarea');
  var ids = [];
  inputs.forEach(function(el){ if(el.id) ids.push(el.id); });
  return ids;
}

// Captura valor bruto de qualquer input (radio/checkbox/select/text/etc)
function _lerValor(el){
  if(!el) return undefined;
  if(el.type === 'checkbox') return !!el.checked;
  if(el.type === 'radio')    return !!el.checked;  // guardamos por ID individual
  return el.value;
}

// Seta valor sem disparar onchange/oninput (evita recalcular)
function _setarValor(el, val){
  if(!el || val === undefined || val === null) return;
  if(el.type === 'checkbox' || el.type === 'radio'){
    el.checked = !!val;
  } else {
    el.value = val;
  }
}

// ─────────────────────────────────────────────────────────────────
// CAPTURA COMPLETA — todos os inputs + globals + HTML das abas
// ─────────────────────────────────────────────────────────────────
window.MemorialV2 = window.MemorialV2 || {};

window.MemorialV2.capturar = function(){
  var snap = {
    meta: {
      versao: 'v2.0',
      salvo_em: new Date().toISOString(),
      ua: navigator.userAgent.substring(0, 120)
    },
    abas: {}
  };

  // Inputs por aba
  TABS_RELEVANTES.forEach(function(abaId){
    var ids = _coletarIdsDeAba(abaId);
    var inputs = {};
    ids.forEach(function(id){
      var el = document.getElementById(id);
      var v = _lerValor(el);
      if(v !== undefined) inputs[id] = v;
    });
    snap.abas[abaId] = { inputs: inputs };
  });

  // Estado global do cálculo (valores finais já computados)
  try {
    if(window._calcResult){
      snap.calcResult = JSON.parse(JSON.stringify(window._calcResult));
    }
  } catch(e){ console.warn('[MemorialV2] _calcResult não serializável:', e); }

  // Dados estruturados da OS Perfis (usado por relatórios)
  try {
    if(window._lastOSData){
      snap.lastOSData = JSON.parse(JSON.stringify(window._lastOSData));
    }
  } catch(e){}

  try {
    if(window._lastFixosPerfisRows){
      snap.lastFixosPerfisRows = JSON.parse(JSON.stringify(window._lastFixosPerfisRows));
    }
  } catch(e){}

  // Planificador
  try {
    if(window.plnPecas){
      snap.plnPecas = JSON.parse(JSON.stringify(window.plnPecas));
    }
  } catch(e){}

  // HTML das tabelas geradas (fallback pra visualização em readonly)
  var osaContent = document.getElementById('osa-content');
  if(osaContent) snap.osaContentHTML = osaContent.innerHTML;

  // Display snap legacy — valores formatados dos spans da aba Orçamento
  // (custoTotal, tabTotal, fatTotal, DRE, margens, mkp, etc. como strings "R$ 1.234,56")
  // Usado por _restoreSnapshotDisplay para repopular spans sem recalcular.
  try {
    if(typeof window.captureSnapshot === 'function'){
      snap.displaySnap = window.captureSnapshot();
    }
  } catch(e){ console.warn('[MemorialV2] captureSnapshot legacy falhou:', e); }

  var tabOs = document.getElementById('tab-os');
  if(tabOs){
    // salva só o conteúdo interno das tabelas, não a aba inteira
    var tbls = tabOs.querySelectorAll('table');
    var parts = [];
    tbls.forEach(function(t){ parts.push(t.outerHTML); });
    if(parts.length) snap.osTabelasHTML = parts.join('\n');
  }

  var tabPlan = document.getElementById('tab-planificador');
  if(tabPlan){
    var tbls2 = tabPlan.querySelectorAll('table');
    var parts2 = [];
    tbls2.forEach(function(t){ parts2.push(t.outerHTML); });
    if(parts2.length) snap.planTabelasHTML = parts2.join('\n');
  }

  // Aba Proposta (PDF preview gerado)
  var tabProp = document.getElementById('tab-proposta');
  if(tabProp && tabProp.innerHTML){
    // Só guarda se tem conteúdo gerado (não o template vazio)
    if(tabProp.innerHTML.length > 500) snap.propostaHTML = tabProp.innerHTML;
  }

  // Mapa refilado (canvas do aproveitamento de chapas)
  var mapaCanvas = document.querySelector('#tab-planificador canvas');
  if(mapaCanvas){
    try { snap.mapaRefilado = mapaCanvas.toDataURL('image/png'); } catch(e){}
  }

  return snap;
};

// ─────────────────────────────────────────────────────────────────
// SALVAR no Supabase
// ─────────────────────────────────────────────────────────────────
window.MemorialV2.salvar = async function(opts){
  opts = opts || {};
  if(!opts.crmCardId) throw new Error('MemorialV2.salvar: crmCardId obrigatório');

  var dados = window.MemorialV2.capturar();

  // Campos "soltos" pra indexar/buscar rápido
  var inputsOrc = (dados.abas['tab-orcamento'] && dados.abas['tab-orcamento'].inputs) || {};
  var cliente   = inputsOrc.cliente || '';
  var largura   = parseInt(inputsOrc.largura) || null;
  var altura    = parseInt(inputsOrc.altura) || null;
  var modelo    = (function(){
    var m = document.getElementById('carac-modelo');
    if(m && m.selectedIndex >= 0) return (m.options[m.selectedIndex]||{}).text || '';
    return '';
  })();
  var valorTab = (window._calcResult && window._calcResult._tabTotal) || opts.valorTabela || 0;
  var valorFat = (window._calcResult && window._calcResult._fatTotal) || opts.valorFaturamento || 0;

  var row = {
    crm_card_id: opts.crmCardId,
    rev_num: typeof opts.revNum === 'number' ? opts.revNum : 0,
    rev_label: opts.revLabel || 'Original',
    tipo: opts.tipo || 'AGP',
    status: opts.status || 'pronto',
    cliente: cliente,
    largura: largura,
    altura: altura,
    modelo: modelo,
    valor_tabela: valorTab,
    valor_faturamento: valorFat,
    numero_atp: opts.numeroAtp || null,
    dados: dados
  };

  var res = await fetch(SB_URL, {
    method: 'POST',
    headers: Object.assign({}, _H(), { Prefer: 'return=representation' }),
    body: JSON.stringify(row)
  });
  if(!res.ok){
    var txt = await res.text();
    throw new Error('Supabase '+res.status+': '+txt.substring(0,200));
  }
  var saved = await res.json();
  return Array.isArray(saved) ? saved[0] : saved;
};

// ─────────────────────────────────────────────────────────────────
// LISTAR revisões de um card
// ─────────────────────────────────────────────────────────────────
window.MemorialV2.listarDoCard = async function(crmCardId){
  var url = SB_URL + '?crm_card_id=eq.' + encodeURIComponent(crmCardId) +
            '&select=id,rev_num,rev_label,tipo,status,cliente,largura,altura,modelo,valor_tabela,valor_faturamento,numero_atp,criado_em' +
            '&order=rev_num.asc,criado_em.asc';
  var res = await fetch(url, { headers: _H() });
  if(!res.ok) throw new Error('List '+res.status);
  return res.json();
};

window.MemorialV2.buscarPorId = async function(id){
  var url = SB_URL + '?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1';
  var res = await fetch(url, { headers: _H() });
  if(!res.ok) throw new Error('Get '+res.status);
  var rows = await res.json();
  return (rows && rows[0]) || null;
};

// ─────────────────────────────────────────────────────────────────
// RESTAURAR — popula todos os inputs + globals SEM recalcular
// ─────────────────────────────────────────────────────────────────
window.MemorialV2.restaurar = function(dados, options){
  options = options || {};
  if(!dados || !dados.abas) throw new Error('dados inválidos');

  // 1) Restaurar inputs de cada aba (SEM disparar eventos)
  Object.keys(dados.abas).forEach(function(abaId){
    var inputs = (dados.abas[abaId] && dados.abas[abaId].inputs) || {};
    Object.keys(inputs).forEach(function(id){
      var el = document.getElementById(id);
      if(el) _setarValor(el, inputs[id]);
    });
  });

  // 2) Restaurar state globals
  if(dados.calcResult) window._calcResult = dados.calcResult;
  if(dados.lastOSData) window._lastOSData = dados.lastOSData;
  if(dados.lastFixosPerfisRows) window._lastFixosPerfisRows = dados.lastFixosPerfisRows;
  if(dados.plnPecas) window.plnPecas = dados.plnPecas;

  // 3) Restaurar tabelas/HTML gerado (se existe)
  if(dados.osaContentHTML){
    var osaContent = document.getElementById('osa-content');
    if(osaContent) osaContent.innerHTML = dados.osaContentHTML;
  }

  // 4) Restaurar painéis de resultado do orçamento (valores finais já calculados)
  //    displaySnap contém custoTotal, tabTotal, fatTotal, DRE, margens como strings formatadas.
  //    _restoreSnapshotDisplay (exposta por 03-history_save.js) popula os spans sem recalcular.
  if(dados.displaySnap && typeof window._restoreSnapshotDisplay === 'function'){
    try { window._restoreSnapshotDisplay(dados.displaySnap); }
    catch(e){ console.warn('[MemorialV2] _restoreSnapshotDisplay falhou:', e); }
  }

  // 5) Modo read-only
  if(options.readOnly){
    _aplicarReadOnly(true);
  } else {
    _aplicarReadOnly(false);
  }

  return true;
};

// Desabilita TODOS os inputs das abas (e mostra banner)
function _aplicarReadOnly(on){
  TABS_RELEVANTES.forEach(function(abaId){
    var panel = document.getElementById(abaId);
    if(!panel) return;
    var inputs = panel.querySelectorAll('input, select, textarea, button');
    inputs.forEach(function(el){
      // Excluir botões de navegação/header do form — só bloqueia inputs
      if(el.tagName === 'BUTTON'){
        // bloqueia só botões "calcular/gerar/salvar" típicos; deixa nav livre
        var t = (el.textContent||'').toLowerCase();
        if(/gerar|calcular|salvar|pronto|atualizar|revisão/.test(t)){
          el.disabled = on;
          el.style.opacity = on ? '0.5' : '';
        }
      } else {
        el.disabled = on;
        if(on){ el.style.opacity = '0.85'; el.style.background = '#fff8e1'; }
        else  { el.style.opacity = ''; el.style.background = ''; }
      }
    });
  });
  // Banner
  var banner = document.getElementById('mem-v2-banner');
  if(on){
    if(!banner){
      banner = document.createElement('div');
      banner.id = 'mem-v2-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#fff3cd;border-bottom:2px solid #f39c12;color:#7f5a00;padding:10px 16px;z-index:9998;font-weight:700;font-size:13px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.08)';
      document.body.appendChild(banner);
    }
    banner.innerHTML = '🔒 MEMORIAL — Visualizando revisão salva (somente leitura) · <a href="#" onclick="MemorialV2.sairDoMemorial();return false;" style="color:#1a5276;text-decoration:underline">Sair do memorial</a>';
    document.body.style.paddingTop = '40px';
  } else {
    if(banner) banner.remove();
    document.body.style.paddingTop = '';
  }
}

window.MemorialV2.sairDoMemorial = function(){
  if(!confirm('Sair do memorial? Os dados voltarão a ficar editáveis, mas isso NÃO afeta o orçamento salvo.')) return;
  _aplicarReadOnly(false);
  // Limpa valores para um estado neutro
  if(typeof window.limparOrcamento === 'function') try{ window.limparOrcamento(); }catch(e){}
  else location.reload();
};

// ─────────────────────────────────────────────────────────────────
// ABRIR memorial por ID — puxa do banco + restaura
// ─────────────────────────────────────────────────────────────────
window.MemorialV2.abrir = async function(id, options){
  options = options || {};
  var row = await window.MemorialV2.buscarPorId(id);
  if(!row) throw new Error('Orçamento não encontrado: '+id);

  // Troca pra aba Orçamento pra o usuário ver os dados populados
  if(typeof switchTab === 'function') try{ switchTab('orcamento'); }catch(e){}

  var readOnly = options.readOnly !== false;  // default: readonly
  // Se status='travado', força readonly independente
  if(row.status === 'travado') readOnly = true;

  window.MemorialV2.restaurar(row.dados, { readOnly: readOnly });

  return row;
};

console.log('[MemorialV2] módulo carregado');

})();
