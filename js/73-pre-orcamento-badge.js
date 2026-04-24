/**
 * ═══════════════════════════════════════════════════════════════════════
 * 73-pre-orcamento-badge.js — Badge "Pré-orçamento salvo" no modal do card
 * ─────────────────────────────────────────────────────────────────────
 *
 * Quando o modal do card abre (#crm-opp-modal), consulta se há
 * pre_orcamento salvo pra esse card. Se sim, injeta badge verde no
 * topo do body. Duplo-clique carrega itens e navega pra aba Orçamento.
 *
 * API:
 *   window.abrirPreOrcamento(preorcId)  → carrega e navega
 *
 * ═══════════════════════════════════════════════════════════════════════
 */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _hdrs(){
    return {
      apikey:        ANON_KEY,
      Authorization: 'Bearer ' + ANON_KEY
    };
  }

  function _toast(html, cor, ms){
    var t = document.getElementById('projetta-save-toast');
    if(t) t.remove();
    t = document.createElement('div');
    t.id = 'projetta-save-toast';
    t.style.cssText =
      'position:fixed;top:80px;right:20px;background:' + cor + ';color:#fff;' +
      'padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;' +
      'z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);' +
      'max-width:440px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4000);
  }

  async function _ultimoPreOrcDoCard(cardId){
    try {
      var r = await fetch(
        SUPABASE_URL + '/rest/v1/pre_orcamentos' +
        '?card_id=eq.' + encodeURIComponent(cardId) +
        '&deleted_at=is.null' +
        '&order=created_at.desc&limit=5' +
        '&select=id,cliente,num_referencia,resultado,created_at,aprovado',
        { headers: _hdrs() }
      );
      if(!r.ok) return null;
      return await r.json();
    } catch(e){ return null; }
  }

  function _obterCardIdDoModal(){
    return window._editId
        || window._crmEditOppId
        || window._crmOrcCardId
        || (document.getElementById('modal-name') && document.getElementById('modal-name').dataset ? document.getElementById('modal-name').dataset.cardId : null);
  }

  async function _renderBadge(){
    var modal = document.getElementById('crm-opp-modal');
    if(!modal) return;

    // Container do badge (criado 1x, atualizado depois)
    var area = modal.querySelector('#preorc-badge-area');
    if(!area){
      area = document.createElement('div');
      area.id = 'preorc-badge-area';
      area.style.cssText = 'padding:0 22px';
      var body = modal.querySelector('.crm-modal-body')
              || modal.querySelector('.crm-modal');
      if(!body) return;
      // Inserir LOGO após o header
      var header = body.querySelector('.crm-modal-header');
      if(header && header.nextSibling){
        body.insertBefore(area, header.nextSibling);
      } else {
        body.insertBefore(area, body.firstChild);
      }
    }

    var cardId = _obterCardIdDoModal();
    if(!cardId){
      area.innerHTML = '';
      return;
    }

    area.innerHTML = '<div style="font-size:11px;color:#999;padding:6px 0">⏳ verificando pré-orçamentos...</div>';

    var lista = await _ultimoPreOrcDoCard(cardId);
    if(!lista || !lista.length){
      area.innerHTML = '';
      return;
    }

    var html = '';
    lista.forEach(function(po, i){
      var dt    = new Date(po.created_at).toLocaleString('pt-BR');
      var preco = (po.resultado && po.resultado.preco_faturamento) || '';
      var tag   = po.aprovado
                ? '<span style="background:#fff;color:#27ae60;padding:1px 7px;border-radius:10px;font-size:10px;margin-left:6px">✓ APROVADO</span>'
                : '';
      var label = (i === 0) ? '💾 Pré-orçamento salvo' : '💾 Pré-orçamento anterior';
      var bgCor = (i === 0) ? '#e8f8f0' : '#f5f5f5';
      var brCor = (i === 0) ? '#27ae60' : '#bbb';
      var txCor = (i === 0) ? '#27ae60' : '#555';
      html +=
        '<div ondblclick="abrirPreOrcamento(''' + po.id + ''')" ' +
        'style="background:' + bgCor + ';border:2px solid ' + brCor + ';border-radius:8px;' +
        'padding:10px 14px;cursor:pointer;user-select:none;margin:8px 0;transition:.15s" ' +
        'onmouseover="this.style.filter=''brightness(.97)''" ' +
        'onmouseout="this.style.filter=''none''" ' +
        'title="Duplo-clique para abrir o pré-orçamento">' +
        '<div style="font-weight:700;color:' + txCor + ';font-size:13px">' + label + tag + '</div>' +
        '<div style="font-size:11px;color:#555;margin-top:3px">' + dt + (preco ? ' · ' + preco : '') + '</div>' +
        '<div style="font-size:10px;color:#888;margin-top:3px">👆 Clique 2× para abrir tudo nas abas</div>' +
        '</div>';
    });
    area.innerHTML = html;
  }

  // Observa abertura do modal (classe .open adicionada)
  function _instalarObserver(){
    var modal = document.getElementById('crm-opp-modal');
    if(!modal){
      setTimeout(_instalarObserver, 500);
      return;
    }

    new MutationObserver(function(muts){
      muts.forEach(function(m){
        if(m.attributeName === 'class' && modal.classList.contains('open')){
          // Modal abriu — aguardar um tick pro cardId ser setado
          setTimeout(_renderBadge, 200);
        } else if(m.attributeName === 'class' && !modal.classList.contains('open')){
          // Modal fechou — limpar badge (pra não mostrar dados antigos na próxima abertura)
          var area = modal.querySelector('#preorc-badge-area');
          if(area) area.innerHTML = '';
        }
      });
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });

    console.log('[73-badge] MutationObserver ativo no #crm-opp-modal');
  }

  // Função pública: abre pré-orçamento, popula abas e navega
  window.abrirPreOrcamento = async function(preorcId){
    if(!preorcId) return;

    _toast('⏳ <b>Carregando pré-orçamento...</b>', '#7f8c8d', 3000);

    try {
      var r = await fetch(
        SUPABASE_URL + '/rest/v1/pre_orcamentos?id=eq.' + encodeURIComponent(preorcId),
        { headers: _hdrs() }
      );
      if(!r.ok) throw new Error('HTTP ' + r.status);
      var arr = await r.json();
      if(!arr.length) throw new Error('Pré-orçamento não encontrado');
      var po = arr[0];

      // 1) Restaurar itens em _orcItens
      if(Array.isArray(po.itens)){
        window._orcItens = po.itens.slice();
      }

      // 2) Restaurar campos de projeto (top-level do form)
      var proj = po.dados_projeto || {};
      var SET = {
        'largura': proj.largura,
        'altura': proj.altura,
        'abertura': proj.abertura,
        'carac-abertura': proj.abertura,
        'carac-modelo': proj.modelo,
        'folhas-porta': proj.folhas,
        'numprojeto': proj.reserva,
        'num-agp': proj.agp,
        'notas': proj.notas
      };
      for(var k in SET){
        var el = document.getElementById(k);
        if(el && SET[k] != null && SET[k] !== '') el.value = SET[k];
      }

      // 3) Restaurar cliente
      var cli = po.dados_cliente || {};
      var SETCLI = {
        'cliente': cli.nome,
        'contato': cli.contato,
        'telefone': cli.telefone,
        'email': cli.email,
        'cep': cli.cep,
        'cidade': cli.cidade,
        'estado': cli.estado,
        'endereco': cli.endereco
      };
      for(var kc in SETCLI){
        var elc = document.getElementById(kc);
        if(elc && SETCLI[kc] != null && SETCLI[kc] !== '') elc.value = SETCLI[kc];
      }

      // 4) Fechar modal do card (se estiver aberto)
      if(typeof crmCloseModal === 'function'){
        try { crmCloseModal(); } catch(e){}
      }

      // 5) Navegar pra aba Orçamento
      if(typeof switchTab === 'function'){
        try { switchTab('orcamento'); } catch(e){}
      }

      // 6) Re-render da lista de itens
      setTimeout(function(){
        if(typeof orcItensRender === 'function') try { orcItensRender(); } catch(e){}
        if(typeof calc === 'function') try { calc(); } catch(e){}
      }, 300);

      var resumo = [];
      if(po.cliente) resumo.push(po.cliente);
      if(po.itens && po.itens.length) resumo.push(po.itens.length + ' iten(s)');
      if(po.resultado && po.resultado.preco_faturamento) resumo.push(po.resultado.preco_faturamento);

      _toast(
        '✅ <b>Pré-orçamento carregado!</b><br>' +
        '<span style="font-size:12px;font-weight:600">' + resumo.join(' · ') + '</span><br>' +
        '<span style="font-size:10px;font-weight:400;opacity:.85;display:block;margin-top:4px">' +
        'Gerado em ' + new Date(po.created_at).toLocaleString('pt-BR') + '</span>',
        '#27ae60', 4500
      );
    } catch(err){
      _toast('❌ <b>Erro ao abrir pré-orçamento</b><br><span style="font-size:11px;font-weight:400">' + (err.message || err) + '</span>', '#c0392b', 5000);
      console.error('[abrirPreOrcamento]', err);
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _instalarObserver);
  } else {
    _instalarObserver();
  }

  console.log('%c[73-pre-orcamento-badge] v1.0 pronto',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
