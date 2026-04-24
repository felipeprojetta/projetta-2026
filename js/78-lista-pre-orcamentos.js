/**
 * 78-lista-pre-orcamentos.js
 *
 * Implementa o botão "📋 Pré-Orçamentos Salvos" que não fazia nada.
 *
 * Funções criadas:
 *   - window.abrirModalPreOrcamentos() — abre modal com lista
 *   - window.carregarPreOrcamento(id) — carrega nos inputs
 *
 * Também adiciona badge verde "📋 Pré-orçado" nos cards CRM que
 * tenham pré-orçamento salvo ativo.
 */
(function(){
  'use strict';

  var SUPA_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function brl(v){
    var n = typeof v==='string' ? parseFloat(String(v).replace(/[^0-9,.-]/g,'').replace(',','.')) : v;
    if(!n || isNaN(n)) return '—';
    return 'R$ ' + n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function fmtData(iso){
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    } catch(e){ return iso; }
  }

  // ─── MODAL DE LISTAGEM ─────────────────────────────────────────────────
  window.abrirModalPreOrcamentos = async function(){
    // Remover modal anterior
    var old = document.getElementById('po-modal-bg');
    if(old) old.remove();

    var bg = document.createElement('div');
    bg.id = 'po-modal-bg';
    bg.style.cssText =
      'position:fixed;inset:0;background:rgba(0,20,35,.8);z-index:99990;' +
      'display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;' +
      'overflow-y:auto;font-family:inherit;backdrop-filter:blur(3px)';

    var box = document.createElement('div');
    box.style.cssText =
      'background:#fff;border-radius:14px;max-width:900px;width:100%;' +
      'max-height:calc(100vh - 80px);overflow:hidden;display:flex;flex-direction:column;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.5)';

    box.innerHTML =
      '<div style="background:linear-gradient(135deg,#5b2c6f,#4a1f5a);color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center">' +
        '<div><div style="font-size:16px;font-weight:800;letter-spacing:.04em">📋 PRÉ-ORÇAMENTOS SALVOS</div>' +
        '<div id="po-modal-sub" style="font-size:11px;opacity:.85;margin-top:2px">Carregando...</div></div>' +
        '<button onclick="document.getElementById(\'po-modal-bg\').remove()" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✕ Fechar</button>' +
      '</div>' +
      '<div id="po-modal-body" style="padding:20px;overflow-y:auto;flex:1">' +
        '<div style="text-align:center;padding:40px;color:#7a8794;font-size:13px">⏳ Buscando pré-orçamentos...</div>' +
      '</div>';

    bg.appendChild(box);
    document.body.appendChild(bg);

    // Clicar fora fecha
    bg.addEventListener('click', function(e){ if(e.target === bg) bg.remove(); });

    // Buscar lista no Supabase
    try {
      var r = await fetch(SUPA_URL + '/rest/v1/pre_orcamentos?deleted_at=is.null&order=created_at.desc', {
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
      });
      var lista = await r.json();
      _renderListaPO(lista);
    } catch(err){
      console.error('[po-lista]', err);
      document.getElementById('po-modal-body').innerHTML =
        '<div style="color:#c0392b;padding:20px;background:#fdf0f0;border-radius:8px">❌ Erro ao buscar pré-orçamentos: ' + err.message + '</div>';
    }
  };

  function _renderListaPO(lista){
    var body = document.getElementById('po-modal-body');
    var sub  = document.getElementById('po-modal-sub');
    if(!body || !sub) return;
    sub.textContent = (lista || []).length + ' pré-orçamento(s) salvo(s)';

    if(!Array.isArray(lista) || lista.length === 0){
      body.innerHTML =
        '<div style="text-align:center;padding:60px 20px;color:#7a8794">' +
          '<div style="font-size:48px;margin-bottom:12px">📭</div>' +
          '<div style="font-size:14px;font-weight:600">Nenhum pré-orçamento salvo ainda</div>' +
          '<div style="font-size:11px;margin-top:6px">Preencha um orçamento e clique em <b>💾 Salvar Pré-Orçamento</b></div>' +
        '</div>';
      return;
    }

    var html = '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
      '<thead><tr style="background:#f3f1ed;border-bottom:2px solid #d5d2cc">' +
        '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">Cliente</th>' +
        '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">AGP / Ref</th>' +
        '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">Data</th>' +
        '<th style="padding:10px;text-align:right;font-weight:700;color:#003144">Preço Tabela</th>' +
        '<th style="padding:10px;text-align:center;font-weight:700;color:#003144">Status</th>' +
        '<th style="padding:10px;text-align:center;font-weight:700;color:#003144">Ações</th>' +
      '</tr></thead><tbody>';

    lista.forEach(function(po){
      var dp  = po.dados_projeto || {};
      var res = po.resultado || {};
      var aprov = po.aprovado;
      html += '<tr style="border-bottom:1px solid #eae7e1">' +
        '<td style="padding:10px;font-weight:600">' + (po.cliente||'—') + '</td>' +
        '<td style="padding:10px;font-size:11px;color:#5f5e5a">' + (dp.agp || po.num_referencia || '—') + '</td>' +
        '<td style="padding:10px;font-size:11px;color:#5f5e5a">' + fmtData(po.created_at) + '</td>' +
        '<td style="padding:10px;text-align:right;font-weight:700;color:#003144">' + (res.preco_tabela || brl(res.preco_tabela)) + '</td>' +
        '<td style="padding:10px;text-align:center">' +
          (aprov ? '<span style="background:#27ae60;color:#fff;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700">✅ APROVADO</span>'
                 : '<span style="background:#e8f4ea;color:#27ae60;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700">📋 PRÉ-SALVO</span>') +
        '</td>' +
        '<td style="padding:10px;text-align:center;white-space:nowrap">' +
          '<button onclick="carregarPreOrcamento(\'' + po.id + '\')" style="padding:6px 12px;border-radius:6px;border:none;background:#1a5276;color:#fff;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px">📂 Abrir</button>' +
          '<button onclick="excluirPreOrcamento(\'' + po.id + '\',this)" style="padding:6px 10px;border-radius:6px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer">🗑</button>' +
        '</td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
  }

  // ─── CARREGAR PRÉ-ORÇAMENTO NOS INPUTS ─────────────────────────────
  window.carregarPreOrcamento = async function(id){
    try {
      var r = await fetch(SUPA_URL + '/rest/v1/pre_orcamentos?id=eq.' + encodeURIComponent(id), {
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
      });
      var arr = await r.json();
      if(!arr || !arr[0]) throw new Error('Pré-orçamento não encontrado');
      var po = arr[0];

      // Setar inputs de cliente
      var dc = po.dados_cliente || {};
      _setVal('cli-nome', dc.nome || po.cliente);
      _setVal('cli-contato', dc.contato);
      _setVal('cli-email', dc.email);
      _setVal('cli-cep', dc.cep);
      _setVal('cli-cidade', dc.cidade);
      _setVal('cli-estado', dc.estado);

      // Setar inputs de projeto
      var dp = po.dados_projeto || {};
      _setVal('proj-agp', dp.agp);
      _setVal('proj-reserva', dp.reserva);
      _setVal('proj-responsavel', dp.responsavel);
      _setVal('proj-wrep', dp.wrep);
      _setVal('proj-origem', dp.origem);
      _setVal('proj-produto', dp.produto);
      _setVal('proj-abertura', dp.abertura);
      _setVal('proj-potencial', dp.potencial);
      _setVal('proj-prioridade', dp.prioridade);
      _setVal('proj-notas', dp.notas);
      _setVal('largura', dp.largura);
      _setVal('altura', dp.altura);
      _setVal('folhas-porta', dp.folhas);
      _setVal('modelo-porta', dp.modelo);

      // Carregar itens
      if(po.itens){
        window._orcItens = Array.isArray(po.itens) ? po.itens : [];
        try { if(typeof orcItensRender === 'function') orcItensRender(); } catch(e){}
      }

      // Recalcular
      try { if(typeof calc === 'function') calc(); } catch(e){}
      try { if(typeof switchTab === 'function') switchTab('orcamento'); } catch(e){}

      var bg = document.getElementById('po-modal-bg');
      if(bg) bg.remove();

      _toast('✅ <b>Pré-orçamento carregado!</b><br>' +
             '<span style="font-size:11px;font-weight:400">' + (po.cliente||'') + ' · ' + (dp.agp||po.num_referencia||'') + '</span>',
             '#27ae60', 4000);
    } catch(err){
      console.error('[carregar-po]', err);
      alert('❌ Erro ao carregar pré-orçamento: ' + err.message);
    }
  };

  // ─── EXCLUIR (soft delete) ─────────────────────────────────────────
  window.excluirPreOrcamento = async function(id, btn){
    if(!confirm('Excluir este pré-orçamento?')) return;
    try {
      var r = await fetch(SUPA_URL + '/rest/v1/pre_orcamentos?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: {
          'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type': 'application/json', 'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ deleted_at: new Date().toISOString() })
      });
      if(!r.ok) throw new Error('HTTP ' + r.status);
      // Remover linha da lista
      var tr = btn.closest('tr');
      if(tr) tr.remove();
      _toast('🗑️ Pré-orçamento excluído','#e67e22', 2500);
    } catch(err){
      alert('❌ Erro ao excluir: ' + err.message);
    }
  };

  function _setVal(id, val){
    if(val === undefined || val === null) return;
    var el = document.getElementById(id);
    if(el){ el.value = val; try { el.dispatchEvent(new Event('change',{bubbles:true})); } catch(e){} }
  }

  function _toast(msg, cor, ms){
    var t = document.getElementById('po-toast');
    if(t) t.remove();
    t = document.createElement('div');
    t.id = 'po-toast';
    t.style.cssText =
      'position:fixed;top:80px;right:20px;background:' + cor + ';color:#fff;' +
      'padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;' +
      'z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);font-family:inherit';
    t.innerHTML = msg;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 3000);
  }

  // ─── BADGE NOS CARDS CRM ───────────────────────────────────────────
  // Cache dos card_ids com pré-orçamento ativo
  var _cardsComPO = null;

  async function _atualizarCacheCardsComPO(){
    try {
      var r = await fetch(SUPA_URL + '/rest/v1/pre_orcamentos?deleted_at=is.null&select=card_id', {
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
      });
      var arr = await r.json();
      _cardsComPO = {};
      (arr||[]).forEach(function(po){ if(po.card_id) _cardsComPO[po.card_id] = 1; });
    } catch(e){ console.warn('[po-badge cache]', e); }
  }

  function _injetarBadges(){
    if(!_cardsComPO) return;
    var cards = document.querySelectorAll('.crm-card[data-id]');
    for(var i = 0; i < cards.length; i++){
      var cid = cards[i].getAttribute('data-id');
      if(!_cardsComPO[cid]) continue;
      if(cards[i].querySelector('.crm-po-badge')) continue; // já tem
      var badge = document.createElement('div');
      badge.className = 'crm-po-badge';
      badge.style.cssText =
        'display:inline-block;background:linear-gradient(135deg,#5b2c6f,#7d3c98);' +
        'color:#fff;padding:3px 8px;border-radius:10px;font-size:9px;font-weight:700;' +
        'margin-top:4px;letter-spacing:.03em;box-shadow:0 2px 4px rgba(91,44,111,.3)';
      badge.textContent = '📋 PRÉ-ORÇAMENTO PRONTO';
      cards[i].appendChild(badge);
    }
  }

  // Atualiza cache a cada 30s, injeta badges a cada 2s
  setTimeout(_atualizarCacheCardsComPO, 2000);
  setInterval(_atualizarCacheCardsComPO, 30000);
  setInterval(_injetarBadges, 2000);

  console.log('%c[78-pre-orcamentos] Modal + carregar + badge CRM ativos',
              'color:#5b2c6f;font-weight:700;background:#f3e8f7;padding:3px 8px;border-radius:4px');
})();
