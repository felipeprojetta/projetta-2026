/**
 * 78-lista-pre-orcamentos.js v4 — BLINDADO
 */
(function(){
  'use strict';

  var SUPA = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _hdrs(){ return { apikey: KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json' }; }
  function _fmtData(iso){ try { var d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(e){ return iso; } }
  function _setVal(id, val){
    if(val === undefined || val === null || val === '') return;
    var el = document.getElementById(id);
    if(el){
      el.value = val;
      try { el.dispatchEvent(new Event('input',{bubbles:true})); } catch(e){}
      try { el.dispatchEvent(new Event('change',{bubbles:true})); } catch(e){}
    }
  }
  function _toast(msg, cor, ms){
    var t = document.getElementById('po-toast'); if(t) t.remove();
    t = document.createElement('div'); t.id='po-toast';
    t.style.cssText='position:fixed;top:80px;right:20px;background:'+cor+';color:#fff;padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);font-family:inherit;max-width:460px';
    t.innerHTML=msg; document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 3500);
  }

  // ─── MODAL ─────────────────────────────────────────────────────────────
  window.abrirModalPreOrcamentos = async function(){
    var old = document.getElementById('po-modal-bg'); if(old) old.remove();
    var bg = document.createElement('div');
    bg.id = 'po-modal-bg';
    bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,20,35,.8);z-index:99990;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;font-family:inherit;backdrop-filter:blur(3px)';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:14px;max-width:900px;width:100%;max-height:calc(100vh - 80px);overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5)';
    box.innerHTML =
      '<div style="background:linear-gradient(135deg,#5b2c6f,#4a1f5a);color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center">' +
        '<div><div style="font-size:16px;font-weight:800;letter-spacing:.04em">📋 PRÉ-ORÇAMENTOS SALVOS</div>' +
        '<div id="po-modal-sub" style="font-size:11px;opacity:.85;margin-top:2px">Carregando...</div></div>' +
        '<button onclick="document.getElementById(\'po-modal-bg\').remove()" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✕ Fechar</button>' +
      '</div>' +
      '<div id="po-modal-body" style="padding:20px;overflow-y:auto;flex:1">' +
        '<div style="text-align:center;padding:40px;color:#7a8794;font-size:13px">⏳ Buscando...</div>' +
      '</div>';

    bg.appendChild(box); document.body.appendChild(bg);
    bg.addEventListener('click', function(e){ if(e.target === bg) bg.remove(); });

    try {
      var r = await fetch(SUPA + '/rest/v1/pre_orcamentos?deleted_at=is.null&order=created_at.desc', { headers: _hdrs() });
      var lista = await r.json();
      _renderLista(lista);
    } catch(err){
      document.getElementById('po-modal-body').innerHTML = '<div style="color:#c0392b;padding:20px;background:#fdf0f0;border-radius:8px">❌ Erro: ' + err.message + '</div>';
    }
  };

  function _renderLista(lista){
    var body = document.getElementById('po-modal-body');
    var sub  = document.getElementById('po-modal-sub');
    if(!body || !sub) return;
    sub.textContent = (lista||[]).length + ' pré-orçamento(s) salvo(s)';
    if(!Array.isArray(lista) || lista.length === 0){
      body.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#7a8794"><div style="font-size:48px;margin-bottom:12px">📭</div><div style="font-size:14px;font-weight:600">Nenhum pré-orçamento salvo ainda</div><div style="font-size:11px;margin-top:6px">Preencha um orçamento e clique em <b>💾 Salvar Pré-Orçamento</b></div></div>';
      return;
    }
    var html = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f3f1ed;border-bottom:2px solid #d5d2cc">' +
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
      var preco = res.preco_tabela || res.preco_tabela_porta || '—';
      html += '<tr style="border-bottom:1px solid #eae7e1">' +
        '<td style="padding:10px;font-weight:600">' + (po.cliente||'—') + '</td>' +
        '<td style="padding:10px;font-size:11px;color:#5f5e5a">' + (dp.agp || po.num_referencia || '—') + '</td>' +
        '<td style="padding:10px;font-size:11px;color:#5f5e5a">' + _fmtData(po.created_at) + '</td>' +
        '<td style="padding:10px;text-align:right;font-weight:700;color:#003144">' + preco + '</td>' +
        '<td style="padding:10px;text-align:center">' +
          (po.aprovado ? '<span style="background:#27ae60;color:#fff;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700">✅ APROVADO</span>' : '<span style="background:#e8f4ea;color:#27ae60;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700">📋 PRÉ-SALVO</span>') +
        '</td>' +
        '<td style="padding:10px;text-align:center;white-space:nowrap">' +
          '<button onclick="carregarPreOrcamento(\'' + po.id + '\')" style="padding:6px 12px;border-radius:6px;border:none;background:#1a5276;color:#fff;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px">📂 Abrir</button>' +
          '<button onclick="excluirPreOrcamento(\'' + po.id + '\',this)" style="padding:6px 10px;border-radius:6px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer">🗑</button>' +
        '</td></tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
  }

  // ─── CARREGAR BLINDADO ───────────────────────────────────────────────
  window.carregarPreOrcamento = async function(id){
    try {
      var r = await fetch(SUPA + '/rest/v1/pre_orcamentos?id=eq.' + encodeURIComponent(id), { headers: _hdrs() });
      var arr = await r.json();
      if(!arr || !arr[0]) throw new Error('Pré-orçamento não encontrado');
      var po = arr[0];
      var dc = po.dados_cliente      || {};
      var dp = po.dados_projeto      || {};
      var pf = po.params_financeiros || {};

      // ═══════════════════════════════════════════════════════════════════
      // FASE 1: BLINDAGEM — fechar modais, resetar estado, deligar vínculos
      // ═══════════════════════════════════════════════════════════════════
      window._loadingPreOrcamento = true; // flag pra autosave/hidratar ignorarem
      
      // Fechar modal CRM se aberto (evita ele puxar itens de outro card)
      var crmModal = document.getElementById('crm-opp-modal');
      if(crmModal) crmModal.style.display = 'none';
      
      // Fechar modal de pré-orçamentos
      var poModal = document.getElementById('po-modal-bg');
      if(poModal) poModal.remove();

      // Reset total pra remover vínculos de OUTRO card que estava aberto
      window._orcItens      = [];
      window._mpItens       = [];
      window._crmItens      = [];
      window._orcItemAtual  = -1;
      window._mpEditingIdx  = -1;
      window._crmOrcCardId  = null;
      window._crmScope      = null;
      window._editingCardId = null;
      try { if(typeof orcItensRender === 'function') orcItensRender(); } catch(e){}

      // Ir pra aba Orçamento
      try { if(typeof switchTab === 'function') switchTab('orcamento'); } catch(e){}

      // Esperar 200ms pra DOM estabilizar
      await new Promise(function(res){ setTimeout(res, 200); });

      // ═══════════════════════════════════════════════════════════════════
      // FASE 2: CARREGAR DADOS
      // ═══════════════════════════════════════════════════════════════════
      
      // Cliente
      _setVal('cliente',          dc.nome || po.cliente);
      _setVal('card-cliente',     dc.nome || po.cliente);
      _setVal('crm-o-cliente',    dc.nome || po.cliente);
      _setVal('contato',          dc.contato);
      _setVal('telefone',         dc.telefone);
      _setVal('email',            dc.email);
      _setVal('cep',              dc.cep);
      _setVal('crm-o-cep',        dc.cep);
      _setVal('cidade',           dc.cidade);
      _setVal('crm-o-cidade-nac', dc.cidade);
      _setVal('estado',           dc.estado);
      _setVal('crm-o-estado',     dc.estado);
      _setVal('pais',             dc.pais);
      _setVal('endereco',         dc.endereco);
      // Projeto
      _setVal('produto',        dp.produto);
      _setVal('carac-modelo',   dp.modelo);
      _setVal('modelo',         dp.modelo);
      _setVal('largura',        dp.largura);
      _setVal('altura',         dp.altura);
      _setVal('folhas-porta',   dp.folhas);
      _setVal('folhas',         dp.folhas);
      _setVal('abertura',       dp.abertura);
      _setVal('carac-abertura', dp.abertura);
      _setVal('reserva',        dp.reserva);
      _setVal('numprojeto',     dp.reserva);
      _setVal('agp',            dp.agp);
      _setVal('num-agp',        dp.agp);
      _setVal('origem',         dp.origem);
      _setVal('prioridade',     dp.prioridade);
      _setVal('potencial',      dp.potencial);
      _setVal('responsavel',    dp.responsavel);
      _setVal('wrep',           dp.wrep);
      _setVal('notas',          dp.notas);
      // Params financeiros
      _setVal('lucro-alvo', pf.margem);
      _setVal('com-rep',    pf.comissao_rep);
      _setVal('com-rt',     pf.comissao_rt);
      _setVal('com-gest',   pf.comissao_gest);
      _setVal('overhead',   pf.overhead);
      _setVal('impostos',   pf.impostos);
      _setVal('markup-desc',pf.markup);
      _setVal('desconto',   pf.desconto);

      // ═══════════════════════════════════════════════════════════════════
      // FASE 3: ITENS (deep clone pra guard restaurar)
      // ═══════════════════════════════════════════════════════════════════
      var itensOriginais = JSON.parse(JSON.stringify(po.itens || []));
      window._orcItens = JSON.parse(JSON.stringify(itensOriginais));

      // Re-render + calcular
      try { if(typeof orcItensRender === 'function') orcItensRender(); } catch(e){ console.warn('[po] orcItensRender', e); }
      try { if(typeof calc === 'function') calc(); } catch(e){ console.warn('[po] calc', e); }

      // ═══════════════════════════════════════════════════════════════════
      // FASE 4: GUARD — se algum script sobrescrever _orcItens nos próximos
      //                 5 segundos, restaura fiel aos dados do pré-orç
      // ═══════════════════════════════════════════════════════════════════
      var sigOriginal = JSON.stringify(itensOriginais);
      var guardCount = 0;
      var guardInterval = setInterval(function(){
        guardCount++;
        var sigAtual = JSON.stringify(window._orcItens || []);
        if(sigAtual !== sigOriginal){
          console.warn('[po-guard] _orcItens sobrescrito (tentativa '+guardCount+'), restaurando…');
          window._orcItens = JSON.parse(JSON.stringify(itensOriginais));
          try { if(typeof orcItensRender === 'function') orcItensRender(); } catch(e){}
          try { if(typeof calc === 'function') calc(); } catch(e){}
        }
        if(guardCount >= 25){ // 25 * 200ms = 5s
          clearInterval(guardInterval);
          window._loadingPreOrcamento = false;
          // Só NO FINAL vincular o card_id (depois do guard)
          if(po.card_id) window._crmOrcCardId = po.card_id;
          // Forçar Resumo da Obra aparecer
          try {
            window._osGeradoUmaVez = true;
            if(typeof _updateResumoObra === 'function') _updateResumoObra();
            if(typeof calc === 'function') calc();
          } catch(e){}
          console.log('[po-guard] encerrado. itens estáveis.');
        }
      }, 200);

      _toast('✅ <b>Pré-orçamento carregado!</b><br>' +
             '<span style="font-size:11px;font-weight:400">' + (po.cliente||'') + ' · ' + (dp.agp||po.num_referencia||'') +
             ' · ' + itensOriginais.length + ' item(ns)</span>' +
             '<br><span style="font-size:10px;opacity:.85">🔒 Blindagem de 5s ativa contra sobrescrita</span>',
             '#27ae60', 6000);
    } catch(err){
      console.error('[po-carregar]', err);
      window._loadingPreOrcamento = false;
      alert('❌ Erro: ' + err.message);
    }
  };

  // ─── EXCLUIR ─────────────────────────────────────────────────────────
  window.excluirPreOrcamento = async function(id, btn){
    if(!confirm('Excluir este pré-orçamento?')) return;
    try {
      var r = await fetch(SUPA + '/rest/v1/pre_orcamentos?id=eq.' + encodeURIComponent(id), {
        method:'PATCH',
        headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
        body: JSON.stringify({ deleted_at: new Date().toISOString() })
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      var tr = btn.closest('tr'); if(tr) tr.remove();
      _toast('🗑️ Pré-orçamento excluído','#e67e22', 2500);
    } catch(err){
      alert('❌ Erro: ' + err.message);
    }
  };

  // ─── BADGES CRM ──────────────────────────────────────────────────────
  var _cardsComPO = null;
  async function _atualizarCache(){
    try {
      var r = await fetch(SUPA + '/rest/v1/pre_orcamentos?deleted_at=is.null&select=card_id', { headers: _hdrs() });
      var arr = await r.json();
      _cardsComPO = {};
      (arr||[]).forEach(function(po){ if(po.card_id) _cardsComPO[po.card_id] = 1; });
    } catch(e){}
  }
  function _injBadges(){
    if(!_cardsComPO) return;
    var cards = document.querySelectorAll('.crm-card[data-id]');
    for(var i = 0; i < cards.length; i++){
      var cid = cards[i].getAttribute('data-id');
      if(!_cardsComPO[cid]) continue;
      if(cards[i].querySelector('.crm-po-badge')) continue;
      var badge = document.createElement('div');
      badge.className = 'crm-po-badge';
      badge.style.cssText = 'display:inline-block;background:linear-gradient(135deg,#5b2c6f,#7d3c98);color:#fff;padding:3px 8px;border-radius:10px;font-size:9px;font-weight:700;margin-top:4px;letter-spacing:.03em;box-shadow:0 2px 4px rgba(91,44,111,.3)';
      badge.textContent = '📋 PRÉ-ORÇAMENTO PRONTO';
      cards[i].appendChild(badge);
    }
  }
  setTimeout(_atualizarCache, 2000);
  setInterval(_atualizarCache, 30000);
  setInterval(_injBadges, 2000);

  console.log('%c[78 v4] BLINDADO contra sobrescrita','color:#5b2c6f;font-weight:700;background:#f3e8f7;padding:3px 8px;border-radius:4px');
})();
