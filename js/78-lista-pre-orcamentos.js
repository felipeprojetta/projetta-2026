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

  // ─── CARREGAR PRÉ-ORÇAMENTO NOS INPUTS (v2 — IDs corretos) ─────────
  window.carregarPreOrcamento = async function(id){
    try {
      var r = await fetch(SUPA_URL + '/rest/v1/pre_orcamentos?id=eq.' + encodeURIComponent(id), {
        headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
      });
      var arr = await r.json();
      if(!arr || !arr[0]) throw new Error('Pré-orçamento não encontrado');
      var po = arr[0];

      var dc = po.dados_cliente      || {};
      var dp = po.dados_projeto      || {};
      var pf = po.params_financeiros || {};

      // ── CLIENTE ── (IDs que o 72 usa pra salvar)
      _setVal('cliente',         dc.nome || po.cliente);
      _setVal('card-cliente',    dc.nome || po.cliente);
      _setVal('crm-o-cliente',   dc.nome || po.cliente);
      _setVal('contato',         dc.contato);
      _setVal('telefone',        dc.telefone);
      _setVal('email',           dc.email);
      _setVal('cep',             dc.cep);
      _setVal('crm-o-cep',       dc.cep);
      _setVal('cidade',          dc.cidade);
      _setVal('crm-o-cidade-nac',dc.cidade);
      _setVal('estado',          dc.estado);
      _setVal('crm-o-estado',    dc.estado);
      _setVal('pais',            dc.pais);
      _setVal('endereco',        dc.endereco);

      // ── PROJETO ──
      _setVal('produto',         dp.produto);
      _setVal('carac-modelo',    dp.modelo);
      _setVal('modelo',          dp.modelo);
      _setVal('largura',         dp.largura);
      _setVal('altura',          dp.altura);
      _setVal('folhas-porta',    dp.folhas);
      _setVal('folhas',          dp.folhas);
      _setVal('abertura',        dp.abertura);
      _setVal('carac-abertura',  dp.abertura);
      _setVal('reserva',         dp.reserva);
      _setVal('numprojeto',      dp.reserva);
      _setVal('agp',             dp.agp);
      _setVal('num-agp',         dp.agp);
      _setVal('origem',          dp.origem);
      _setVal('prioridade',      dp.prioridade);
      _setVal('potencial',       dp.potencial);
      _setVal('responsavel',     dp.responsavel);
      _setVal('wrep',            dp.wrep);
      _setVal('notas',           dp.notas);

      // ── PARÂMETROS FINANCEIROS ──
      _setVal('lucro-alvo',      pf.margem);
      _setVal('com-rep',         pf.comissao_rep);
      _setVal('com-rt',           pf.comissao_rt);
      _setVal('com-gest',        pf.comissao_gest);
      _setVal('overhead',        pf.overhead);
      _setVal('impostos',        pf.impostos);
      _setVal('markup-desc',     pf.markup);
      _setVal('desconto',        pf.desconto);

      // ── ITENS DO ORÇAMENTO (a "alma" do pré-orç) ──
      if(po.itens){
        window._orcItens = Array.isArray(po.itens) ? po.itens : [];
      }

      // Vincular o card_id se o pré-orç tiver
      if(po.card_id) window._crmOrcCardId = po.card_id;

      // ── RE-RENDER E RECALCULAR ──
      try { if(typeof orcItensRender === 'function') orcItensRender(); } catch(e){ console.warn('[carregar] orcItensRender', e); }
      try { if(typeof _crmItensRender === 'function') _crmItensRender(); } catch(e){}
      try { if(typeof calc === 'function') calc(); } catch(e){ console.warn('[carregar] calc', e); }
      try { if(typeof _updateResumoObra === 'function') _updateResumoObra(); } catch(e){}
      try { if(typeof switchTab === 'function') switchTab('orcamento'); } catch(e){}

      // Segunda chamada de calc() após DOM propagar (alguns listeners dependem disso)
      setTimeout(function(){
        try { if(typeof calc === 'function') calc(); } catch(e){}
        try { if(typeof _updateResumoObra === 'function'){ window._osGeradoUmaVez = true; _updateResumoObra(); } } catch(e){}
      }, 800);

      var bg = document.getElementById('po-modal-bg');
      if(bg) bg.remove();

      _toast('✅ <b>Pré-orçamento carregado!</b><br>' +
             '<span style="font-size:11px;font-weight:400">' + (po.cliente||'') + ' · ' + (dp.agp||po.num_referencia||'') + ' · ' +
             ((po.itens||[]).length) + ' item(ns)</span>',
             '#27ae60', 5000);
    } catch(err){
      console.error('[carregar-po]', err);
      alert('❌ Erro ao carregar pré-orçamento: ' + err.message);
    }
  };
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
