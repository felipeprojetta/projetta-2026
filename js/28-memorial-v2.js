/* ═══════════════════════════════════════════════════════════════════
   MODULE 28: MEMORIAL V2
   ─────────────────────────────────────────────────────────────────
   Sistema novo de salvamento/restauração de orçamentos usando
   tabela Supabase `orcamentos_salvos` (versus blob jsonb antigo).

   Grava TUDO de TODAS as abas (inputs + state globals + blocos dinâmicos).
   Ao abrir, restaura 100% do estado SEM recalcular.

   O QUE É CAPTURADO (solução definitiva - 2026-04):
   - Inputs com ID de 4 abas (orçamento, planificador, OS, OS acessórios)
   - BLOCOS DINÂMICOS (acm-blk, alu-blk, fixo-blk) com seus valores
   - GLOBALS de multi-produto e multi-cor:
       _mpItens, _PLN_COLOR_KEYS, _PLN_RES_BY_COLOR, _PLN_CHAPA_SIZE_BY_COLOR,
       _PLN_SIZE_BY_COLOR_USED, _plnResALU, PLN_RES, PLN_SD
   - CÁLCULOS globais: _chapasACM, _chapasALU, _chapasCalculadas,
       _planPesoLiqACM, _planPesoBrutoACM, _planPesoPortaACM, _simData,
       _calcResult, _osGeradoUmaVez
   - HTML das tabelas geradas (fallback visual)
   - CANVAS do planificador como dataURL (layout de corte)

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
// CAPTURAR BLOCOS DINÂMICOS (acm-blk, alu-blk, fixo-blk)
// Estes blocos são criados por addACM/addALU/addFixo e seus inputs
// têm IDs (acm-sel-N, acm-qty-N) ou classes (.fixo-larg, .fixo-alt).
// ─────────────────────────────────────────────────────────────────
function _capturarBlocosDinamicos(){
  var out = { acm: [], alu: [], fixo: [] };

  // ACM blocks
  document.querySelectorAll('#acm-list .cbl').forEach(function(blk){
    var id = blk.id.replace('acm-blk-','');
    var sel = blk.querySelector('select');
    var qty = blk.querySelector('input[type=number]');
    out.acm.push({
      id: id,
      selectedIndex: sel ? sel.selectedIndex : 0,
      selValue: sel ? sel.value : '',
      selText: sel && sel.selectedIndex >= 0 ? (sel.options[sel.selectedIndex]||{}).text : '',
      qty: qty ? qty.value : '1'
    });
  });

  // ALU blocks
  document.querySelectorAll('#alu-list .cbl').forEach(function(blk){
    var id = blk.id.replace('alu-blk-','');
    var sel = blk.querySelector('select');
    var qty = blk.querySelector('input[type=number]');
    out.alu.push({
      id: id,
      selectedIndex: sel ? sel.selectedIndex : 0,
      selValue: sel ? sel.value : '',
      selText: sel && sel.selectedIndex >= 0 ? (sel.options[sel.selectedIndex]||{}).text : '',
      qty: qty ? qty.value : '1'
    });
  });

  // Fixo blocks (inputs por CLASSE — sem ID único)
  document.querySelectorAll('#fixos-list .fixo-blk').forEach(function(blk){
    var id = blk.id.replace('fixo-blk-','');
    var _q = function(cls){var e=blk.querySelector('.'+cls);return e?e.value:'';};
    out.fixo.push({
      id: id,
      tipo: _q('fixo-tipo')||'superior',
      larg: _q('fixo-larg')||'',
      alt: _q('fixo-alt')||'',
      qty: _q('fixo-qty')||'1',
      lado: _q('fixo-lado')||'esquerdo',
      lados: _q('fixo-lados')||'1',
      estr: _q('fixo-estr')||'nao'
    });
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────
// RESTAURAR BLOCOS DINÂMICOS (antes de setar inputs)
// ─────────────────────────────────────────────────────────────────
function _restaurarBlocosDinamicos(dyn){
  if(!dyn) return;

  // Limpa blocos ACM existentes, recria via addACM com cor/qty
  if(Array.isArray(dyn.acm)){
    var acmList = document.getElementById('acm-list');
    if(acmList) acmList.innerHTML = '';
    // resetar contador global aC (declarado em 01-shared.js)
    if(typeof window.aC !== 'undefined') window.aC = 0;
    dyn.acm.forEach(function(b){
      if(typeof window.addACM === 'function'){
        window.addACM('', b.qty || '1');
        // Setar selectedIndex depois (values duplicados, usar index)
        var sel = document.getElementById('acm-sel-'+(dyn.acm.indexOf(b)+1));
        if(sel){
          if(typeof b.selectedIndex === 'number' && b.selectedIndex >= 0 && b.selectedIndex < sel.options.length){
            sel.selectedIndex = b.selectedIndex;
          } else if(b.selValue){
            sel.value = b.selValue;
          }
        }
      }
    });
  }

  // ALU idem
  if(Array.isArray(dyn.alu)){
    var aluList = document.getElementById('alu-list');
    if(aluList) aluList.innerHTML = '';
    if(typeof window.lC !== 'undefined') window.lC = 0;
    dyn.alu.forEach(function(b){
      if(typeof window.addALU === 'function'){
        window.addALU('', b.qty || '1');
        var sel = document.getElementById('alu-sel-'+(dyn.alu.indexOf(b)+1));
        if(sel){
          if(typeof b.selectedIndex === 'number' && b.selectedIndex >= 0 && b.selectedIndex < sel.options.length){
            sel.selectedIndex = b.selectedIndex;
          } else if(b.selValue){
            sel.value = b.selValue;
          }
        }
      }
    });
  }

  // Fixos
  if(Array.isArray(dyn.fixo)){
    var fixosList = document.getElementById('fixos-list');
    if(fixosList) fixosList.innerHTML = '';
    if(typeof window.fixoCount !== 'undefined') window.fixoCount = 0;
    dyn.fixo.forEach(function(fx){
      if(typeof window.addFixo === 'function'){
        window.addFixo();
        // Pegar último fixo-blk adicionado
        var blks = document.querySelectorAll('#fixos-list .fixo-blk');
        var last = blks[blks.length-1];
        if(last){
          var setCls = function(cls, v){var e=last.querySelector('.'+cls);if(e) e.value = v;};
          setCls('fixo-tipo', fx.tipo||'superior');
          setCls('fixo-larg', fx.larg||'');
          setCls('fixo-alt',  fx.alt||'');
          setCls('fixo-qty',  fx.qty||'1');
          setCls('fixo-lado', fx.lado||'esquerdo');
          setCls('fixo-lados',fx.lados||'1');
          setCls('fixo-estr', fx.estr||'nao');
          // Mostrar lado row se lateral
          if(fx.tipo === 'lateral'){
            var ladoRow = last.querySelector('.fixo-lado-row');
            if(ladoRow) ladoRow.style.display = '';
          }
        }
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// CAPTURA COMPLETA — todos os inputs + globals + HTML das abas
// ─────────────────────────────────────────────────────────────────
window.MemorialV2 = window.MemorialV2 || {};

window.MemorialV2.capturar = function(){
  var snap = {
    meta: {
      versao: 'v2.1',   // bumped: agora captura blocos dinâmicos + multi-produto + multi-cor
      salvo_em: new Date().toISOString(),
      ua: navigator.userAgent.substring(0, 120)
    },
    abas: {}
  };

  // Inputs por aba (com IDs)
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

  // ★ BLOCOS DINÂMICOS (acm-blk, alu-blk, fixo-blk)
  try { snap.dynBlocks = _capturarBlocosDinamicos(); } catch(e){ console.warn('[MemorialV2] dynBlocks falhou:', e); }

  // ★ STATE GLOBALS — multi-produto, multi-cor, cálculos
  var _state = {};
  try {
    // Multi-produto
    if(window._mpItens) _state.mpItens = JSON.parse(JSON.stringify(window._mpItens));
    // Multi-cor (planificador)
    if(window._PLN_COLOR_KEYS)       _state.plnColorKeys      = JSON.parse(JSON.stringify(window._PLN_COLOR_KEYS));
    if(window._PLN_RES_BY_COLOR)     _state.plnResByColor     = JSON.parse(JSON.stringify(window._PLN_RES_BY_COLOR));
    if(window._PLN_CHAPA_SIZE_BY_COLOR) _state.plnChapaSizeByColor = JSON.parse(JSON.stringify(window._PLN_CHAPA_SIZE_BY_COLOR));
    if(window._PLN_SIZE_BY_COLOR_USED)  _state.plnSizeByColorUsed  = JSON.parse(JSON.stringify(window._PLN_SIZE_BY_COLOR_USED));
    if(window._PLN_ACTIVE_COLOR)     _state.plnActiveColor    = window._PLN_ACTIVE_COLOR;
    // Estado planificador
    if(window.PLN_RES)               _state.plnRes            = JSON.parse(JSON.stringify(window.PLN_RES));
    if(window.PLN_SD)                _state.plnSd             = JSON.parse(JSON.stringify(window.PLN_SD));
    if(window._plnResALU)            _state.plnResALU         = JSON.parse(JSON.stringify(window._plnResALU));
    if(window._simData)              _state.simData           = JSON.parse(JSON.stringify(window._simData));
    // Valores de chapas
    _state.chapasACM         = window._chapasACM || 0;
    _state.chapasALU         = window._chapasALU || 0;
    _state.chapasCalculadas  = window._chapasCalculadas || 0;
    _state.chapaALU_SW       = window._chapaALU_SW || 0;
    _state.chapaALU_SH       = window._chapaALU_SH || 0;
    _state.planPesoLiqACM    = window._planPesoLiqACM || 0;
    _state.planPesoBrutoACM  = window._planPesoBrutoACM || 0;
    _state.planPesoPortaACM  = window._planPesoPortaACM || 0;
    _state.pesoChapasPerDoor = window._pesoChapasPerDoor ? JSON.parse(JSON.stringify(window._pesoChapasPerDoor)) : null;
    // Peças do planificador (ordem)
    if(window._plnPiecesRef && Array.isArray(window._plnPiecesRef)){
      _state.plnPiecesRef = JSON.parse(JSON.stringify(window._plnPiecesRef));
    }
    // Flag OS gerada uma vez (controla se spans mostram valores ou "—")
    _state.osGeradoUmaVez = !!window._osGeradoUmaVez;
  } catch(e){ console.warn('[MemorialV2] state serialização falhou:', e); }
  snap.state = _state;

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

  // ★ CANVAS do planificador (layout de corte) — dataURL.
  //   Sem isso, o aproveitamento aparece em branco ao restaurar.
  var planCanvas = document.getElementById('plan-canvas');
  if(planCanvas && planCanvas.toDataURL){
    try {
      var dataURL = planCanvas.toDataURL('image/png');
      // Só guarda se o canvas tem conteúdo (evita dataURL de canvas em branco)
      if(dataURL && dataURL.length > 200) snap.planCanvasDataURL = dataURL;
    } catch(e){ console.warn('[MemorialV2] plan-canvas toDataURL falhou:', e); }
  }

  // Aba Proposta (PDF preview gerado)
  var tabProp = document.getElementById('tab-proposta');
  if(tabProp && tabProp.innerHTML){
    // Só guarda se tem conteúdo gerado (não o template vazio)
    if(tabProp.innerHTML.length > 500) snap.propostaHTML = tabProp.innerHTML;
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

  // ★ 1) Restaurar BLOCOS DINÂMICOS antes dos inputs (cria DOM novo)
  //    Assim os ids acm-sel-N/acm-qty-N existem para o próximo passo.
  try { _restaurarBlocosDinamicos(dados.dynBlocks); }
  catch(e){ console.warn('[MemorialV2] _restaurarBlocosDinamicos falhou:', e); }

  // 2) Restaurar inputs de cada aba (SEM disparar eventos)
  Object.keys(dados.abas).forEach(function(abaId){
    var inputs = (dados.abas[abaId] && dados.abas[abaId].inputs) || {};
    Object.keys(inputs).forEach(function(id){
      var el = document.getElementById(id);
      if(el) _setarValor(el, inputs[id]);
    });
  });

  // ★ 3) Restaurar STATE GLOBALS (multi-produto + multi-cor + cálculos)
  if(dados.state){
    var s = dados.state;
    if(s.mpItens)                 window._mpItens                 = s.mpItens;
    if(s.plnColorKeys)            window._PLN_COLOR_KEYS          = s.plnColorKeys;
    if(s.plnResByColor)           window._PLN_RES_BY_COLOR        = s.plnResByColor;
    if(s.plnChapaSizeByColor)     window._PLN_CHAPA_SIZE_BY_COLOR = s.plnChapaSizeByColor;
    if(s.plnSizeByColorUsed)      window._PLN_SIZE_BY_COLOR_USED  = s.plnSizeByColorUsed;
    if(s.plnActiveColor)          window._PLN_ACTIVE_COLOR        = s.plnActiveColor;
    if(s.plnRes)                  window.PLN_RES                  = s.plnRes;
    if(s.plnSd)                   window.PLN_SD                   = s.plnSd;
    if(s.plnResALU)               window._plnResALU               = s.plnResALU;
    if(s.simData)                 window._simData                 = s.simData;
    if(typeof s.chapasACM === 'number')        window._chapasACM         = s.chapasACM;
    if(typeof s.chapasALU === 'number')        window._chapasALU         = s.chapasALU;
    if(typeof s.chapasCalculadas === 'number') window._chapasCalculadas  = s.chapasCalculadas;
    if(typeof s.chapaALU_SW === 'number')      window._chapaALU_SW       = s.chapaALU_SW;
    if(typeof s.chapaALU_SH === 'number')      window._chapaALU_SH       = s.chapaALU_SH;
    if(typeof s.planPesoLiqACM === 'number')   window._planPesoLiqACM    = s.planPesoLiqACM;
    if(typeof s.planPesoBrutoACM === 'number') window._planPesoBrutoACM  = s.planPesoBrutoACM;
    if(typeof s.planPesoPortaACM === 'number') window._planPesoPortaACM  = s.planPesoPortaACM;
    if(s.pesoChapasPerDoor)       window._pesoChapasPerDoor       = s.pesoChapasPerDoor;
    if(s.plnPiecesRef)            window._plnPiecesRef            = s.plnPiecesRef;
    // Flag OS gerada — IMPORTANTE: sem isso, spans mostram "—" mesmo com valores salvos
    if(typeof s.osGeradoUmaVez === 'boolean') window._osGeradoUmaVez = s.osGeradoUmaVez;
  }

  // 4) Restaurar state globals adicionais
  if(dados.calcResult) window._calcResult = dados.calcResult;
  if(dados.lastOSData) window._lastOSData = dados.lastOSData;
  if(dados.lastFixosPerfisRows) window._lastFixosPerfisRows = dados.lastFixosPerfisRows;

  // 5) Restaurar tabelas/HTML gerado (se existe)
  if(dados.osaContentHTML){
    var osaContent = document.getElementById('osa-content');
    if(osaContent) osaContent.innerHTML = dados.osaContentHTML;
  }

  // ★ 5B) Restaurar HTMLs das outras abas que estavam perdidos até então.
  //       O capturar() salva tabelas de tab-os, tab-planificador e o innerHTML
  //       inteiro de tab-proposta. Antes esses dados ficavam salvos mas nunca
  //       eram aplicados → abas apareciam vazias ao puxar memorial.
  //
  //       Para tab-os e tab-planificador: substitui as <table> existentes
  //       pelas tabelas salvas (outerHTML). A função _substituirTabelas faz
  //       isso de forma segura usando a 1ª tabela existente como ponto de
  //       ancoragem.
  function _substituirTabelas(abaId, htmlSalvo){
    try {
      var aba = document.getElementById(abaId);
      if(!aba || !htmlSalvo) return;
      // Parse HTML salvo num container temporário
      var tmp = document.createElement('div');
      tmp.innerHTML = htmlSalvo;
      var tabelasSalvas = Array.prototype.slice.call(tmp.querySelectorAll('table'));
      if(!tabelasSalvas.length) return;
      // Pega tabelas existentes na aba + o parent/ponto de ancoragem da 1ª
      var tabelasExistentes = Array.prototype.slice.call(aba.querySelectorAll('table'));
      if(tabelasExistentes.length){
        // Insere tabelas salvas antes da 1ª existente, depois remove existentes
        var primeira = tabelasExistentes[0];
        var parent = primeira.parentNode;
        tabelasSalvas.forEach(function(t){ parent.insertBefore(t, primeira); });
        tabelasExistentes.forEach(function(t){ if(t.parentNode) t.parentNode.removeChild(t); });
      } else {
        // Não tem tabelas → apenas anexa no fim da aba
        tabelasSalvas.forEach(function(t){ aba.appendChild(t); });
      }
    } catch(e){ console.warn('[MemorialV2] _substituirTabelas falhou em '+abaId+':', e); }
  }

  if(dados.osTabelasHTML) _substituirTabelas('tab-os', dados.osTabelasHTML);
  // ★ Felipe 23/04 v5: NÃO restaurar planTabelasHTML se há items NOVOS no
  //   card CRM (_orcItens). O HTML salvo é do snapshot antigo e pode conter
  //   classificações LOCAL antigas (PORTAL em vez de REVESTIMENTO) que
  //   contradizem a nova lógica de plnPieceTable. Se temos items, o
  //   planificador VAI ser re-renderizado com a classificação nova —
  //   preservar o HTML antigo só atrapalha.
  var _temItensNovos = (window._orcItens && window._orcItens.length>0) ||
                       (window._mpItens && window._mpItens.length>0);
  if(dados.planTabelasHTML && !_temItensNovos){
    _substituirTabelas('tab-planificador', dados.planTabelasHTML);
  } else if(dados.planTabelasHTML && _temItensNovos){
    try{
      console.log('%c[MemorialV2] planTabelasHTML IGNORADO — card tem items novos, planificador vai re-renderizar',
        'background:#6a1b9a;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700');
    }catch(e){}
    // Forçar re-render do planificador após pequeno delay pra DOM se estabilizar
    setTimeout(function(){
      try{
        if(typeof window.planUpd==='function') window.planUpd();
        if(typeof window.planRun==='function') window.planRun();
      }catch(e){ console.warn('[MemorialV2] planRun falhou:', e); }
    }, 200);
  }

  // tab-proposta: o capturar salva o innerHTML inteiro (só se > 500 chars).
  // ★ Felipe 23/04 v5: NÃO restaurar propostaHTML se há items NOVOS no card.
  //   O HTML salvo é do snapshot antigo — com título "PROJETTA DOOR BY WEIKU",
  //   imagem de porta, campos MODEL/OPENING/LEAVES/LOCK etc. Em rev-only,
  //   isso é tudo errado. Se temos items, a proposta DEVE ser re-gerada
  //   via populateProposta() pra refletir o tipo correto (rev/fixo/porta).
  var _temItensNovosProp = (window._orcItens && window._orcItens.length>0) ||
                           (window._mpItens && window._mpItens.length>0);
  if(dados.propostaHTML && !_temItensNovosProp){
    var tabProp = document.getElementById('tab-proposta');
    if(tabProp) tabProp.innerHTML = dados.propostaHTML;
  } else if(dados.propostaHTML && _temItensNovosProp){
    try{
      console.log('%c[MemorialV2] propostaHTML IGNORADO — card tem items novos, proposta vai re-gerar no switchTab(proposta)',
        'background:#6a1b9a;color:#fff;padding:2px 6px;border-radius:3px;font-weight:700');
    }catch(e){}
    // Forçar re-gerar proposta se função disponível (timing depois da inicialização)
    setTimeout(function(){
      try{
        if(typeof window.populateProposta==='function') window.populateProposta();
      }catch(e){ console.warn('[MemorialV2] populateProposta falhou:', e); }
    }, 400);
  }

  // ★ 5C) Aplicar toggleInstQuem pra mostrar/esconder os blocos corretos
  //       de instalação (PROJETTA × TERCEIROS × INTERNACIONAL). Sem isso,
  //       após restaurar inst-quem=TERCEIROS, os campos de km/pessoas/diaria
  //       continuam aparecendo (embora não afetem cálculo, confundem o usuário).
  try {
    if(typeof window.toggleInstQuem === 'function') window.toggleInstQuem();
  } catch(e){ console.warn('[MemorialV2] toggleInstQuem falhou:', e); }

  // 6) Restaurar painéis de resultado do orçamento (valores finais já calculados)
  //    displaySnap contém custoTotal, tabTotal, fatTotal, DRE, margens como strings formatadas.
  //    _restoreSnapshotDisplay (exposta por 03-history_save.js) popula os spans sem recalcular.
  if(dados.displaySnap && typeof window._restoreSnapshotDisplay === 'function'){
    try { window._restoreSnapshotDisplay(dados.displaySnap); }
    catch(e){ console.warn('[MemorialV2] _restoreSnapshotDisplay falhou:', e); }
  }

  // ★ 7) Restaurar CANVAS do planificador (layout de corte) como imagem
  if(dados.planCanvasDataURL){
    var planCanvas = document.getElementById('plan-canvas');
    if(planCanvas && planCanvas.getContext){
      try {
        var img = new Image();
        img.onload = function(){
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if(w > 0 && h > 0){
            planCanvas.width = w;
            planCanvas.height = h;
            planCanvas.getContext('2d').drawImage(img, 0, 0);
          }
        };
        img.src = dados.planCanvasDataURL;
      } catch(e){ console.warn('[MemorialV2] canvas restore falhou:', e); }
    }
  }

  // ★ 8) Re-renderizar painéis multi-cor (sem recalcular bin-packing)
  //    Os globals _PLN_* já foram restaurados acima, então essas funções só
  //    pintam a UI com os valores salvos.
  try {
    if(typeof window._plnRenderColorTabs === 'function') window._plnRenderColorTabs();
    if(typeof window._plnRenderCoresPainel === 'function') window._plnRenderCoresPainel();
  } catch(e){ console.warn('[MemorialV2] re-render multi-cor falhou:', e); }

  // ★ 8B) Felipe 21/04: re-rodar planificador pra recriar tabs de chapa
  //       + popular Levantamento de Superficies.
  //       Bug reportado: 'Revisão 01 abre memorial ok, mas levantamento
  //       de superficies esta zerado' e 'layout trava na chapa 1'.
  //       Causa: state._PLN_* e PLN_RES sao restaurados, mas os botoes
  //       (#plan-tabs) e as tabelas da aba Levantamento nao sao
  //       reconstruidas. _autoSelectAndRun roda bin-packing novamente
  //       com os inputs restaurados (mesmos pieces → mesmo resultado
  //       deterministico) e chama plnBuildTabs + preenche tabelas.
  //       Delay 250ms pra DOM estabilizar.
  setTimeout(function(){
    try {
      if(typeof window._autoSelectAndRun === 'function'){
        window._autoSelectAndRun();
        console.log('[MemorialV2] _autoSelectAndRun executado apos restore');
      }
    } catch(e){ console.warn('[MemorialV2] _autoSelectAndRun falhou:', e); }
  }, 250);

  // 9) Modo read-only
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

console.log('[MemorialV2] módulo carregado (v2.1 — captura completa de blocos dinâmicos + multi-produto + multi-cor + canvas)');

})();
