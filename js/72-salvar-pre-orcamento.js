/**
 * ═══════════════════════════════════════════════════════════════════════
 * 72-salvar-pre-orcamento.js — Botão "Salvar Pré-Orçamento" do topo
 * ─────────────────────────────────────────────────────────────────────
 *
 * Salva um SNAPSHOT do estado atual em pre_orcamentos (tabela nova,
 * independente de crm_oportunidades). Pode ser consultado depois pra
 * ver o que foi calculado. Quando aprovado, vira orçamento oficial.
 *
 * Captura:
 *   • Dados do cliente (nome, contato, telefone, endereço)
 *   • Dados do projeto (modelo, largura, altura, folhas, etc)
 *   • Todos os itens (_orcItens)
 *   • Resultado calculado (valores de tabela, faturamento, custos, margem)
 *   • Parâmetros financeiros vigentes
 *
 * NÃO toca no card. NÃO sobrescreve original. É só snapshot.
 * ═══════════════════════════════════════════════════════════════════════
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
    t.style.cssText =
      'position:fixed;top:80px;right:20px;background:' + cor + ';color:#fff;' +
      'padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;' +
      'z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);' +
      'max-width:460px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 5000);
  }

  function _val(id){
    var el = document.getElementById(id);
    return el ? (el.value || '') : '';
  }
  function _num(id){
    var v = parseFloat(_val(id));
    return isNaN(v) ? null : v;
  }
  function _txt(id){
    var el = document.getElementById(id);
    if(!el) return '';
    return (el.textContent || el.innerText || '').trim();
  }

  function _snapshot(){
    // Cliente
    var cliente = {
      nome:     _val('cliente') || _val('card-cliente') || _val('crm-o-cliente'),
      contato:  _val('contato'),
      telefone: _val('telefone'),
      email:    _val('email'),
      cep:      _val('cep') || _val('crm-o-cep'),
      cidade:   _val('cidade') || _val('crm-o-cidade-nac'),
      estado:   _val('estado') || _val('crm-o-estado'),
      pais:     _val('pais'),
      endereco: _val('endereco')
    };

    // Projeto
    var projeto = {
      produto:     _val('produto'),
      modelo:      _val('carac-modelo') || _val('modelo'),
      largura:     _num('largura'),
      altura:      _num('altura'),
      folhas:      _val('folhas-porta') || _val('folhas'),
      abertura:    _val('abertura') || _val('carac-abertura'),
      reserva:     _val('reserva') || _val('numprojeto'),
      agp:         _val('agp') || _val('num-agp'),
      origem:      _val('origem'),
      prioridade:  _val('prioridade'),
      potencial:   _val('potencial'),
      responsavel: _val('responsavel'),
      wrep:        _val('wrep'),
      notas:       _val('notas')
    };

    // Itens (fonte primária: window._orcItens)
    var itens = [];
    if(Array.isArray(window._orcItens)) itens = window._orcItens.slice();
    else if(Array.isArray(window._crmItens)) itens = window._crmItens.slice();
    else if(Array.isArray(window._mpItens)) itens = window._mpItens.slice();

    // Resultado (valores que aparecem no painel direito)
    var resultado = {
      custo_porta:          _txt('r-custo-total'),
      markup:               _txt('r-markup'),
      preco_tabela:         _txt('r-total-tabela'),
      preco_faturamento:    _txt('r-total-fat'),
      custo_fabricacao:     _txt('r-custo-fab'),
      custo_instalacao:     _txt('r-custo-inst'),
      tabela_so_porta:      _txt('r-tab-porta'),
      faturamento_so_porta: _txt('r-fat-porta'),
      tabela_instalacao:    _txt('r-tab-inst'),
      faturamento_instalacao:_txt('r-fat-inst'),
      margem_bruta:         _txt('r-margem-bruta'),
      margem_liquida:       _txt('r-margem-liquida'),
      custo_m2:             _txt('r-custo-m2'),
      preco_tabela_m2:      _txt('r-tab-m2'),
      preco_fat_m2:         _txt('r-fat-m2')
    };

    // Parâmetros financeiros
    var params = {
      margem:   _num('margem'),
      comissao: _num('comissao'),
      icms:     _num('icms'),
      pis:      _num('pis'),
      cofins:   _num('cofins'),
      irpj:     _num('irpj'),
      csll:     _num('csll'),
      frete:    _num('frete')
    };

    return { cliente: cliente, projeto: projeto, itens: itens,
             resultado: resultado, params: params };
  }

  async function _inserirNoBanco(snap){
    var h = {
      apikey:         ANON_KEY,
      Authorization:  'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json',
      Prefer:         'return=representation'
    };

    var userName = (function(){
      try { return localStorage.getItem('projetta_user_name') || 'anon'; }
      catch(e){ return 'anon'; }
    })();

    var body = {
      card_id:            window._crmOrcCardId || null,
      cliente:            snap.cliente.nome || null,
      num_referencia:     snap.projeto.agp || snap.projeto.reserva || null,
      dados_cliente:      snap.cliente,
      dados_projeto:      snap.projeto,
      itens:              snap.itens,
      resultado:          snap.resultado,
      params_financeiros: snap.params,
      created_by:         userName
    };

    var r = await fetch(SUPABASE_URL + '/rest/v1/pre_orcamentos', {
      method:  'POST',
      headers: h,
      body:    JSON.stringify(body)
    });
    if(!r.ok){
      var txt = await r.text();
      throw new Error('HTTP ' + r.status + ' — ' + txt);
    }
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
      var row = await _inserirNoBanco(snap);

      var resumo = [];
      if(snap.cliente.nome) resumo.push(snap.cliente.nome);
      if(snap.itens && snap.itens.length) resumo.push(snap.itens.length + ' iten(s)');
      if(snap.resultado.preco_faturamento) resumo.push(snap.resultado.preco_faturamento);

      _toast(
        '✅ <b>Pré-orçamento salvo!</b><br>' +
        '<span style="font-size:12px;font-weight:600">' + resumo.join(' · ') + '</span><br>' +
        '<span style="font-size:10px;font-weight:400;opacity:.85;display:block;margin-top:4px">' +
        'ID ' + row.id + ' · ' + new Date(row.created_at).toLocaleString('pt-BR') + '</span>',
        '#27ae60', 5000
      );
      console.log('%c[pre-orcamento] ✓ salvo:', 'color:#27ae60;font-weight:700', row);
    } catch(err){
      _toast('❌ <b>Erro ao salvar pré-orçamento</b><br><span style="font-size:11px;font-weight:400">' + (err.message || err) + '</span>', '#c0392b', 6000);
      console.error('[pre-orcamento] erro:', err);
    }
  };

  console.log('%c[72-salvar-pre-orcamento] v1.0 pronto — window.salvarPreOrcamento()',
              'color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
