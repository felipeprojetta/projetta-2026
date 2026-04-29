/**
 * 72-salvar-pre-orcamento.js v2 — IDs corretos dos valores
 *   (m-tab, m-fat, m-custo em vez dos antigos r-total-tabela etc)
 */
(function(){
  'use strict';
  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _toast(html, cor, ms){
    var t = document.getElementById('projetta-save-toast');
    if(t) t.remove();
    t = document.createElement('div');
    t.id = 'projetta-save-toast';
    t.style.cssText = 'position:fixed;top:80px;right:20px;background:'+cor+';color:#fff;padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);max-width:460px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 5000);
  }
  function _val(id){ var el = document.getElementById(id); return el ? (el.value || '') : ''; }
  function _num(id){ var v = parseFloat(_val(id)); return isNaN(v) ? null : v; }
  function _txt(id){ var el = document.getElementById(id); if(!el) return ''; return (el.textContent || el.innerText || '').trim(); }

  function _snapshot(){
    var cliente = {
      nome:     _val('cliente') || _val('card-cliente') || _val('crm-o-cliente'),
      contato:  _val('contato'), telefone: _val('telefone'), email: _val('email'),
      cep:      _val('cep') || _val('crm-o-cep'),
      cidade:   _val('cidade') || _val('crm-o-cidade-nac'),
      estado:   _val('estado') || _val('crm-o-estado'),
      pais:     _val('pais'), endereco: _val('endereco')
    };
    var projeto = {
      produto:     _val('produto'),
      modelo:      _val('carac-modelo') || _val('modelo'),
      largura:     _num('largura'), altura: _num('altura'),
      folhas:      _val('folhas-porta') || _val('folhas'),
      abertura:    _val('abertura') || _val('carac-abertura'),
      reserva:     _val('reserva') || _val('numprojeto'),
      agp:         _val('agp') || _val('num-agp'),
      origem:      _val('origem'), prioridade: _val('prioridade'),
      potencial:   _val('potencial'), responsavel: _val('responsavel'),
      wrep:        _val('wrep'), notas: _val('notas')
    };
    var itens = [];
    if(Array.isArray(window._orcItens)) itens = window._orcItens.slice();
    else if(Array.isArray(window._crmItens)) itens = window._crmItens.slice();
    else if(Array.isArray(window._mpItens)) itens = window._mpItens.slice();

    // IDs CORRETOS (descobertos no index.html)
    var resultado = {
      custo_total:          _txt('m-custo'),
      custo_m2:             _txt('m-custo-m2'),
      custo_porta:          _txt('m-custo-porta'),
      custo_porta_m2:       _txt('m-custo-porta-m2'),
      markup:               _txt('m-mkp'),
      markup_porta:         _txt('m-mkp-porta'),
      preco_tabela:         _txt('m-tab'),
      preco_tabela_m2:      _txt('m-tab-m2'),
      preco_tabela_porta:   _txt('m-tab-porta'),
      preco_tabela_porta_m2:_txt('m-tab-porta-m2'),
      preco_faturamento:    _txt('m-fat'),
      preco_fat_m2:         _txt('m-fat-m2'),
      preco_fat_porta:      _txt('m-fat-porta'),
      preco_fat_porta_m2:   _txt('m-fat-porta-m2')
    };
    var params = {
      margem:   _num('lucro-alvo'), comissao_rep: _num('com-rep'),
      comissao_rt: _num('com-rt'),  comissao_gest: _num('com-gest'),
      overhead: _num('overhead'),   impostos: _num('impostos'),
      markup:   _num('markup-desc'),desconto: _num('desconto')
    };
    return { cliente: cliente, projeto: projeto, itens: itens, resultado: resultado, params: params };
  }

  async function _inserir(snap){
    var userName = (function(){ try { return localStorage.getItem('projetta_user_name') || 'anon'; } catch(e){ return 'anon'; }})();
    var body = {
      card_id:            window._crmOrcCardId || null,
      cliente:            snap.cliente.nome || null,
      num_referencia:     snap.projeto.agp || snap.projeto.reserva || null,
      dados_cliente:      snap.cliente, dados_projeto: snap.projeto,
      itens: snap.itens, resultado: snap.resultado, params_financeiros: snap.params,
      created_by: userName
    };
    var r = await fetch(SUPABASE_URL + '/rest/v1/pre_orcamentos', {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: 'Bearer '+ANON_KEY, 'Content-Type':'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(body)
    });
    if(!r.ok){ var txt = await r.text(); throw new Error('HTTP '+r.status+' — '+txt); }
    var arr = await r.json();
    return arr[0];
  }

  window.salvarPreOrcamento = async function(){
    try {
      var snap = _snapshot();
      if(!snap.cliente.nome && !snap.projeto.agp && (!snap.itens || snap.itens.length === 0)){
        _toast('⚠ <b>Nada pra salvar</b><br><span style="font-size:11px;font-weight:400">Adicione ao menos 1 item ou preencha o cliente</span>', '#c0392b', 4000);
        return;
      }
      _toast('⏳ <b>Salvando pré-orçamento...</b>', '#7f8c8d', 2500);
      var row = await _inserir(snap);
      var resumo = [];
      if(snap.cliente.nome) resumo.push(snap.cliente.nome);
      if(snap.itens && snap.itens.length) resumo.push(snap.itens.length + ' iten(s)');
      if(snap.resultado.preco_faturamento) resumo.push(snap.resultado.preco_faturamento);
      _toast(
        '✅ <b>Pré-orçamento salvo!</b><br>'+
        '<span style="font-size:12px;font-weight:600">'+resumo.join(' · ')+'</span><br>'+
        '<span style="font-size:10px;font-weight:400;opacity:.85;display:block;margin-top:4px">ID '+row.id+' · '+new Date(row.created_at).toLocaleString('pt-BR')+'</span><br>'+
        '<span style="font-size:10px;font-weight:400;opacity:.9;display:block;margin-top:6px">💡 Veja todos em "📋 Pré-Orçamentos Salvos" no topo</span>',
        '#27ae60', 6000
      );
    } catch(err){
      _toast('❌ <b>Erro ao salvar</b><br><span style="font-size:11px;font-weight:400">'+(err.message||err)+'</span>', '#c0392b', 6000);
      console.error('[pre-orcamento]', err);
    }
  };

  console.log('%c[72-salvar-pre-orcamento] v2 — IDs corretos (m-tab, m-fat)','color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
