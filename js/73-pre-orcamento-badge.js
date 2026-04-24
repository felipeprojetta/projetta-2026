/**
 * 73-pre-orcamento-badge.js v2 — Modal "Pré-Orçamentos Salvos"
 *   Substitui o badge (que dependia de _editId local do IIFE).
 *   Agora é um botão no topo que abre modal com lista completa.
 *   Clique no item → abre o pré-orçamento na aba Orçamento.
 */
(function(){
  'use strict';
  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _hdrs(){ return { apikey: ANON_KEY, Authorization: 'Bearer '+ANON_KEY }; }

  function _toast(html, cor, ms){
    var t = document.getElementById('projetta-save-toast');
    if(t) t.remove();
    t = document.createElement('div');
    t.id = 'projetta-save-toast';
    t.style.cssText = 'position:fixed;top:80px;right:20px;background:'+cor+';color:#fff;padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);max-width:460px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4500);
  }

  // Abre modal com TODOS os pré-orçamentos
  window.abrirModalPreOrcamentos = async function(){
    var bg = document.getElementById('preorc-modal-bg');
    if(!bg){
      bg = document.createElement('div');
      bg.id = 'preorc-modal-bg';
      bg.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:3000;align-items:center;justify-content:center;backdrop-filter:blur(4px);font-family:inherit';
      bg.onclick = function(e){ if(e.target === bg) bg.remove(); };
      bg.innerHTML =
        '<div style="background:#fff;border-radius:16px;width:90%;max-width:900px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.3)">'+
        '  <div style="background:#003144;color:#fff;padding:16px 22px;display:flex;justify-content:space-between;align-items:center">'+
        '    <h2 style="margin:0;font-size:16px;font-weight:800">📋 Pré-Orçamentos Salvos</h2>'+
        '    <button onclick="document.getElementById(''preorc-modal-bg'').remove()" style="background:transparent;border:none;color:#fff;font-size:22px;cursor:pointer">×</button>'+
        '  </div>'+
        '  <div style="padding:12px 22px;border-bottom:1px solid #eee;display:flex;gap:8px;align-items:center">'+
        '    <input id="preorc-search" placeholder="🔍 Buscar por cliente, AGP, reserva..." style="flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:8px;font-size:13px;font-family:inherit">'+
        '    <span id="preorc-count" style="font-size:11px;color:#888">—</span>'+
        '  </div>'+
        '  <div id="preorc-list" style="flex:1;overflow-y:auto;padding:10px 22px 22px">'+
        '    <div style="padding:40px;text-align:center;color:#888">⏳ Carregando...</div>'+
        '  </div>'+
        '</div>';
      document.body.appendChild(bg);

      // Busca em tempo real
      document.getElementById('preorc-search').oninput = function(e){
        var q = (e.target.value || '').toLowerCase();
        var cards = document.querySelectorAll('#preorc-list [data-search]');
        var shown = 0;
        cards.forEach(function(c){
          var m = c.getAttribute('data-search').toLowerCase().indexOf(q) >= 0;
          c.style.display = m ? '' : 'none';
          if(m) shown++;
        });
        document.getElementById('preorc-count').textContent = shown + ' resultado(s)';
      };
    }

    // Buscar todos pré-orçamentos
    try {
      var r = await fetch(
        SUPABASE_URL+'/rest/v1/pre_orcamentos?deleted_at=is.null&order=created_at.desc&limit=200'+
        '&select=id,cliente,num_referencia,card_id,resultado,created_at,aprovado,versao_aprovada',
        { headers: _hdrs() }
      );
      if(!r.ok) throw new Error('HTTP '+r.status);
      var lista = await r.json();

      var container = document.getElementById('preorc-list');
      if(!lista.length){
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#888">Nenhum pré-orçamento salvo ainda.<br><span style="font-size:11px">Clique em "💾 Salvar Pré-Orçamento" no topo pra criar.</span></div>';
        document.getElementById('preorc-count').textContent = '0';
        return;
      }

      var html = '';
      lista.forEach(function(po){
        var dt     = new Date(po.created_at).toLocaleString('pt-BR');
        var preco  = (po.resultado && po.resultado.preco_faturamento) || '—';
        var ref    = po.num_referencia || '—';
        var cliente= po.cliente || '(sem cliente)';
        var tagAprov = po.aprovado
          ? '<span style="background:#27ae60;color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:6px">✓ APROVADO v'+(po.versao_aprovada||'?')+'</span>'
          : '';
        var search = (cliente+' '+ref+' '+po.id+' '+preco).replace(/\s+/g,' ');
        html +=
          '<div data-search="'+search+'" style="border:2px solid #e0e0e0;border-radius:10px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#fafafa;transition:.15s" onmouseover="this.style.borderColor=''#1a5276''" onmouseout="this.style.borderColor=''#e0e0e0''">'+
          '  <div style="flex:1;min-width:0">'+
          '    <div style="font-weight:700;font-size:14px;color:#003144">'+cliente+tagAprov+'</div>'+
          '    <div style="font-size:11px;color:#555;margin-top:3px">'+ref+' · '+dt+'</div>'+
          '    <div style="font-size:11px;color:#888;margin-top:2px">ID '+po.id+'</div>'+
          '  </div>'+
          '  <div style="text-align:right">'+
          '    <div style="font-size:16px;font-weight:800;color:#27ae60">'+preco+'</div>'+
          '    <div style="display:flex;gap:6px;margin-top:6px">'+
          '      <button onclick="abrirPreOrcamento(''+po.id+'');document.getElementById(''preorc-modal-bg'').remove()" style="background:#1a5276;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">📂 Abrir</button>'+
          '      <button onclick="excluirPreOrcamento(''+po.id+'')" style="background:#fff;color:#c0392b;border:1.5px solid #c0392b;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🗑</button>'+
          '    </div>'+
          '  </div>'+
          '</div>';
      });
      container.innerHTML = html;
      document.getElementById('preorc-count').textContent = lista.length + ' pré-orçamento(s)';
    } catch(err){
      document.getElementById('preorc-list').innerHTML = '<div style="padding:40px;text-align:center;color:#c0392b">Erro: '+err.message+'</div>';
    }
  };

  // Abrir pré-orçamento (carrega dados na aba Orçamento)
  window.abrirPreOrcamento = async function(preorcId){
    if(!preorcId) return;
    _toast('⏳ <b>Carregando pré-orçamento...</b>', '#7f8c8d', 2500);
    try {
      var r = await fetch(SUPABASE_URL+'/rest/v1/pre_orcamentos?id=eq.'+encodeURIComponent(preorcId), { headers: _hdrs() });
      if(!r.ok) throw new Error('HTTP '+r.status);
      var arr = await r.json();
      if(!arr.length) throw new Error('Pré-orçamento não encontrado');
      var po = arr[0];

      // Restaurar itens
      if(Array.isArray(po.itens)){
        window._orcItens = po.itens.slice();
        window._mpItens  = po.itens.slice();
      }
      // Restaurar projeto nos inputs
      var p = po.dados_projeto || {};
      var SETP = {
        largura: p.largura, altura: p.altura, abertura: p.abertura,
        'carac-abertura': p.abertura, 'carac-modelo': p.modelo,
        'folhas-porta': p.folhas, numprojeto: p.reserva,
        'num-agp': p.agp, notas: p.notas
      };
      for(var k in SETP){
        var el = document.getElementById(k);
        if(el && SETP[k] != null && SETP[k] !== '') el.value = SETP[k];
      }
      // Restaurar cliente
      var c = po.dados_cliente || {};
      var SETC = { cliente:c.nome, contato:c.contato, telefone:c.telefone, email:c.email, cep:c.cep, cidade:c.cidade, estado:c.estado, endereco:c.endereco };
      for(var kc in SETC){
        var elc = document.getElementById(kc);
        if(elc && SETC[kc] != null && SETC[kc] !== '') elc.value = SETC[kc];
      }
      // Setar vínculo com card
      if(po.card_id) window._crmOrcCardId = po.card_id;
      // Navegar
      if(typeof switchTab === 'function') try{ switchTab('orcamento'); }catch(e){}
      setTimeout(function(){
        if(typeof orcItensRender === 'function') try{ orcItensRender(); }catch(e){}
        if(typeof calc === 'function') try{ calc(); }catch(e){}
      }, 300);

      var resumo = [];
      if(po.cliente) resumo.push(po.cliente);
      if(po.itens && po.itens.length) resumo.push(po.itens.length+' iten(s)');
      if(po.resultado && po.resultado.preco_faturamento) resumo.push(po.resultado.preco_faturamento);
      _toast('✅ <b>Pré-orçamento carregado!</b><br><span style="font-size:12px;font-weight:600">'+resumo.join(' · ')+'</span>', '#27ae60', 4500);
    } catch(err){
      _toast('❌ <b>Erro ao abrir</b><br>'+err.message, '#c0392b', 5000);
      console.error(err);
    }
  };

  // Excluir pré-orçamento
  window.excluirPreOrcamento = async function(preorcId){
    if(!confirm('Excluir este pré-orçamento? Essa ação não pode ser desfeita.')) return;
    try {
      var r = await fetch(SUPABASE_URL+'/rest/v1/pre_orcamentos?id=eq.'+encodeURIComponent(preorcId), {
        method: 'PATCH',
        headers: Object.assign({}, _hdrs(), { 'Content-Type':'application/json', Prefer:'return=minimal' }),
        body: JSON.stringify({ deleted_at: new Date().toISOString() })
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      _toast('✅ <b>Excluído</b>', '#27ae60', 2500);
      // Recarregar lista
      if(document.getElementById('preorc-modal-bg')) window.abrirModalPreOrcamentos();
    } catch(err){
      _toast('❌ <b>Erro</b>: '+err.message, '#c0392b', 4000);
    }
  };

  console.log('%c[73-pre-orcamento] v2 — modal de lista','color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
