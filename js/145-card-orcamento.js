/* ============================================================================
 * js/145-card-orcamento.js  —  Snapshot de Orcamento por Card (28-abr-2026)
 *
 * Felipe 28/04: orcamento e propriedade do card. Mora em
 * crm_oportunidades.extras.orcamentos[]. Cada salvar = novo snapshot.
 *
 * 3 botoes (header da aba Orcamento):
 *   - Salvar no card    (snapshot + valor_tabela + valor_faturamento)
 *   - Imprimir          (PDF + 3 PNGs, baixa todos)
 *   - Recalcular        (pergunta se sobrescreve)
 *
 * Banner azul com historico (lista, carregar, excluir).
 * Reabre card com orcamento salvo populando form fielmente.
 * NAO mexe em stage. Movimentacao 100% manual.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta145Applied) return;
  window.__projetta145Applied = true;

  var SB = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  var MAX_HIST = 20;

  function $(id){ return document.getElementById(id); }
  function val(id){ var e = $(id); return e ? (e.value || '') : ''; }
  function num(id){ return parseFloat(val(id).replace(',','.')) || 0; }
  function txt(id){ var e = $(id); return e ? (e.textContent || '').trim() : ''; }
  function parseM(s){
    if(s == null) return 0;
    var t = String(s).replace(/[R$\s\u00A0]/g,'').replace(/\./g,'').replace(',','.');
    var n = parseFloat(t); return isNaN(n) ? 0 : n;
  }
  function userName(){
    try { return (JSON.parse(localStorage.getItem('projetta_current_user')||'{}')||{}).name || 'anon'; }
    catch(e){ return 'anon'; }
  }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function toast(html, color, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:380px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 3500);
  }

  /* ───────── SNAPSHOT ───────── */
  function capturarSnapshot(label){
    var inputs = {
      cliente: {
        nome: val('cliente') || val('crm-o-cliente'),
        contato: val('contato'), telefone: val('telefone'), email: val('email'),
        cep: val('cep') || val('crm-o-cep'),
        cidade: val('cidade') || val('crm-o-cidade-nac'),
        estado: val('estado') || val('crm-o-estado'),
        pais: val('pais'), endereco: val('endereco')
      },
      projeto: {
        produto: val('produto'),
        modelo: val('carac-modelo') || val('modelo'),
        largura: num('largura'), altura: num('altura'),
        folhas: val('folhas-porta') || val('folhas'),
        abertura: val('abertura') || val('carac-abertura'),
        reserva: val('reserva') || val('numprojeto'),
        agp: val('agp') || val('num-agp'),
        cor_ext: val('cor-ext'), cor_int: val('cor-int'), cor_macico: val('cor-macico'),
        qtd_portas: num('qtd-portas') || 1
      },
      itens: Array.isArray(window._mpItens) ? JSON.parse(JSON.stringify(window._mpItens)) :
             (Array.isArray(window._orcItens) ? JSON.parse(JSON.stringify(window._orcItens)) : []),
      instalacao: {
        quem: val('inst-quem'), pais: val('inst-pais'),
        cambio: num('mod131-cambio-card') || num('inst-intl-cambio'),
        passagem: num('inst-intl-passagem'), hotel: num('inst-intl-hotel'),
        alim: num('inst-intl-alim'), carro: num('inst-intl-carro'),
        udigru: num('inst-intl-udigru'), seguro: num('inst-intl-seguro'),
        aero: num('inst-intl-aero'),
        dias: num('inst-intl-dias'), pessoas: num('inst-intl-pessoas'),
        margem: num('inst-intl-margem'), incoterm: val('inst-intl-incoterm')
      }
    };

    var resultado = {
      custo_total: txt('m-custo'), custo_m2: txt('m-custo-m2'),
      custo_porta: txt('m-custo-porta'), custo_porta_m2: txt('m-custo-porta-m2'),
      markup: txt('m-mkp'), markup_porta: txt('m-mkp-porta'),
      preco_tabela: txt('m-tab'), preco_tabela_m2: txt('m-tab-m2'),
      preco_tabela_porta: txt('m-tab-porta'), preco_tabela_porta_m2: txt('m-tab-porta-m2'),
      preco_faturamento: txt('m-fat'), preco_fat_m2: txt('m-fat-m2'),
      preco_fat_porta: txt('m-fat-porta'), preco_fat_porta_m2: txt('m-fat-porta-m2'),
      _vTab: parseM(txt('m-tab')),
      _vFat: parseM(txt('m-fat')),
      _vTabPorta: parseM(txt('m-tab-porta')),
      _vFatPorta: parseM(txt('m-fat-porta'))
    };

    var params = {
      margem: num('lucro-alvo'),
      comissao_rep: num('com-rep'), comissao_rt: num('com-rt'), comissao_gest: num('com-gest'),
      overhead: num('overhead'), impostos: num('impostos'),
      markup: num('markup-desc'), desconto: num('desconto')
    };

    var precos = {};
    ['projetta_comp_precos','projetta_perfis_kg','projetta_preco_kg',
     'projetta_custom_chapas','projetta_custom_comps','projetta_custom_perfis',
     'projetta_modelos','projetta_modelo_params'].forEach(function(k){
      try { var v = localStorage.getItem(k); if(v) precos[k] = JSON.parse(v); }
      catch(e){}
    });

    return {
      id: 'orc_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      ts: new Date().toISOString(),
      autor: userName(),
      label: label || ('V' + new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})),
      inputs: inputs, resultado: resultado, params: params, precos_snapshot: precos
    };
  }

  /* ───────── BANCO ───────── */
  async function lerCard(cardId){
    var r = await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=*', { headers: H });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    var arr = await r.json();
    return arr[0];
  }
  async function salvarSnapshotNoBanco(cardId, snapshot){
    var card = await lerCard(cardId);
    if(!card) throw new Error('Card nao encontrado');
    var extras = card.extras || {};
    var orcs = Array.isArray(extras.orcamentos) ? extras.orcamentos : [];
    orcs.unshift(snapshot);
    if(orcs.length > MAX_HIST) orcs = orcs.slice(0, MAX_HIST);
    extras.orcamentos = orcs;

    var body = {
      extras: extras,
      valor: snapshot.resultado._vFat || snapshot.resultado._vTab || 0,
      valor_tabela: snapshot.resultado._vTab || 0,
      valor_faturamento: snapshot.resultado._vFat || 0,
      updated_by: 'salvar_orc_' + userName()
    };
    var r = await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId), {
      method: 'PATCH',
      headers: Object.assign({}, H, { 'Content-Type':'application/json', Prefer:'return=minimal' }),
      body: JSON.stringify(body)
    });
    if(!r.ok){ var t = await r.text(); throw new Error('HTTP ' + r.status + ' ' + t); }
    return orcs;
  }
  async function excluirSnapshot(cardId, orcId){
    var card = await lerCard(cardId);
    if(!card) throw new Error('Card nao encontrado');
    var extras = card.extras || {};
    var orcs = (Array.isArray(extras.orcamentos) ? extras.orcamentos : []).filter(function(o){ return o.id !== orcId; });
    extras.orcamentos = orcs;
    var top = orcs[0];
    var body = {
      extras: extras,
      valor: top ? (top.resultado._vFat || top.resultado._vTab || 0) : 0,
      valor_tabela: top ? (top.resultado._vTab || 0) : 0,
      valor_faturamento: top ? (top.resultado._vFat || 0) : 0,
      updated_by: 'excluir_orc_' + userName()
    };
    await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId), {
      method: 'PATCH',
      headers: Object.assign({}, H, { 'Content-Type':'application/json', Prefer:'return=minimal' }),
      body: JSON.stringify(body)
    });
    return orcs;
  }

  /* ───────── ACOES PUBLICAS ───────── */
  window.crmOrcSalvar = async function(){
    var cardId = window._crmOrcCardId || window._snapCardId;
    if(!cardId){ toast('⚠ <b>Nenhum card aberto</b><br><span style="font-size:11px;font-weight:400">Clique num card no CRM antes</span>', '#c0392b', 5000); return; }
    var snap = capturarSnapshot();
    if(!snap.resultado._vTab && !snap.resultado._vFat){
      toast('⚠ <b>Calcule o orçamento antes</b>', '#c0392b', 4000); return;
    }
    toast('💾 <b>Salvando no card...</b>', '#7f8c8d', 2000);
    try {
      var orcs = await salvarSnapshotNoBanco(cardId, snap);
      toast('✅ <b>Orçamento salvo</b><br><span style="font-size:11px;font-weight:400">Tab '+snap.resultado.preco_tabela+' · Fat '+snap.resultado.preco_faturamento+' · Histórico '+orcs.length+'</span>', '#27ae60', 5000);
      atualizarBanner(orcs);
    } catch(e){
      toast('❌ <b>Erro</b>: '+(e.message||e), '#c0392b', 6000);
      console.error('[145 salvar]', e);
    }
  };

  window.crmOrcImprimir = async function(){
    if(!window.html2canvas){
      toast('⏳ <b>Carregando bibliotecas...</b>', '#7f8c8d', 2500);
      await new Promise(function(res, rej){
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    var clean = function(s){ return String(s||'').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').slice(0,30); };
    var nomeBase = (val('num-agp') || val('agp') || 'orcamento') + '_' +
                   (val('numprojeto') || val('reserva') || '') + '_' +
                   clean(val('cliente') || val('crm-o-cliente'));

    toast('🖨️ <b>Gerando 4 arquivos...</b>', '#0C447C', 4000);
    var feitos = [];

    // 1) PNG Resumo da Obra
    try {
      var elObra = $('resumo-obra');
      if(elObra && elObra.style.display !== 'none'){
        var c = await window.html2canvas(elObra, { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false });
        baixarCanvas(c, nomeBase + '_resumo-obra.png');
        feitos.push('Resumo Obra'); await sleep(300);
      }
    } catch(e){ console.warn('[145 obra]', e); }

    // 2) PNG Resultado Porta
    try {
      var elPorta = ($('m-tab-porta') ? $('m-tab-porta').closest('.rc') : null);
      if(elPorta){
        var c2 = await window.html2canvas(elPorta, { scale: 2, useCORS: true, backgroundColor: '#fff', logging: false });
        baixarCanvas(c2, nomeBase + '_resultado-porta.png');
        feitos.push('Resultado Porta'); await sleep(300);
      }
    } catch(e){ console.warn('[145 porta]', e); }

    // 3) PNG Painel Representante (delega)
    try {
      if(typeof window.printPainelRep === 'function'){
        window.printPainelRep();
        feitos.push('Painel Representante'); await sleep(1500);
      }
    } catch(e){ console.warn('[145 rep]', e); }

    // 4) PDF Proposta (delega - 77 intercepta)
    try {
      if(typeof window.printProposta === 'function'){
        window.printProposta();
        feitos.push('Proposta PDF'); await sleep(2000);
      }
    } catch(e){ console.warn('[145 pdf]', e); }

    toast('✅ <b>Arquivos gerados</b><br><span style="font-size:11px;font-weight:400">'+feitos.join(' · ')+'</span>', '#27ae60', 5000);
  };

  window.crmOrcRecalcular = async function(){
    var cardId = window._crmOrcCardId || window._snapCardId;
    if(!cardId){ toast('⚠ <b>Nenhum card aberto</b>', '#c0392b', 4000); return; }
    if(typeof window.calc === 'function'){ try { window.calc(); } catch(e){} }
    await sleep(500);
    if(confirm('🔄 RECALCULADO com preços atuais.\n\nSalvar como NOVO orçamento no histórico?\n\n• OK = grava novo snapshot (mantém anteriores)\n• Cancelar = só recalcula na tela')){
      var snap = capturarSnapshot('Recalculado ' + new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}));
      try {
        var orcs = await salvarSnapshotNoBanco(cardId, snap);
        toast('✅ <b>Recalculado e salvo</b><br><span style="font-size:11px;font-weight:400">Histórico: '+orcs.length+'</span>', '#27ae60', 4000);
        atualizarBanner(orcs);
      } catch(e){ toast('❌ '+(e.message||e), '#c0392b', 5000); }
    } else {
      toast('🔄 <b>Recalculado na tela</b><br><span style="font-size:11px;font-weight:400">Não foi salvo</span>', '#7f8c8d', 3500);
    }
  };

  function baixarCanvas(canvas, nome){
    var url = canvas.toDataURL('image/png');
    var a = document.createElement('a'); a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ───────── BANNER + HISTORICO ───────── */
  function atualizarBanner(orcamentos){
    var banner = $('orc-historico-banner');
    if(!banner) return;
    var n = (orcamentos||[]).length;
    if(n === 0){ banner.style.display = 'none'; return; }
    banner.style.display = 'block';
    var topo = orcamentos[0];
    banner.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<div><b>📚 ' + n + ' orçamento(s) salvo(s)</b> · Último: ' + topo.label + ' · ' + topo.resultado.preco_faturamento + '</div>' +
        '<button onclick="crmOrcVerHistorico()" style="padding:5px 12px;background:#fff;color:#0C447C;border:1.5px solid #0C447C;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">📂 Ver histórico</button>' +
      '</div>';
  }

  window.crmOrcVerHistorico = async function(){
    var cardId = window._crmOrcCardId || window._snapCardId;
    if(!cardId){ toast('⚠ Nenhum card aberto', '#c0392b'); return; }
    var card; try { card = await lerCard(cardId); } catch(e){ toast('❌ '+e.message, '#c0392b'); return; }
    var orcs = (card.extras && card.extras.orcamentos) || [];
    if(!orcs.length){ toast('Nenhum orçamento salvo ainda', '#7f8c8d'); return; }

    var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px" id="orc-hist-modal-bg" onclick="if(event.target===this)this.remove()">' +
      '<div style="background:#fff;border-radius:12px;max-width:780px;width:100%;max-height:80vh;overflow:auto;font-family:Montserrat,Arial,sans-serif">' +
        '<div style="padding:14px 18px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#0C447C,#1a5276);color:#fff">' +
          '<b style="font-size:14px">📚 Histórico de Orçamentos · ' + (card.cliente||'Card') + '</b>' +
          '<button onclick="document.getElementById(\'orc-hist-modal-bg\').remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;font-size:18px;width:28px;height:28px;border-radius:6px;cursor:pointer">×</button>' +
        '</div>' +
        '<div style="padding:14px">' +
        orcs.map(function(o){
          var d = new Date(o.ts);
          var qi = (o.inputs && o.inputs.itens && o.inputs.itens.length) || 1;
          return '<div style="border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:8px;background:#fafbfc">' +
            '<div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:8px">' +
              '<div>' +
                '<div style="font-weight:800;font-size:13px;color:#0C447C">' + (o.label || 'V' + d.toLocaleDateString('pt-BR')) + '</div>' +
                '<div style="font-size:11px;color:#666;margin-top:2px">' + d.toLocaleString('pt-BR') + ' · ' + (o.autor||'anon') + ' · ' + qi + ' item(s)</div>' +
                '<div style="font-size:12px;margin-top:4px"><b>Tabela:</b> ' + (o.resultado.preco_tabela||'—') + ' · <b>Fat:</b> <span style="color:#e67e22;font-weight:700">' + (o.resultado.preco_faturamento||'—') + '</span></div>' +
              '</div>' +
              '<div style="display:flex;gap:6px">' +
                '<button onclick="crmOrcCarregar(\''+o.id+'\')" style="padding:6px 10px;border-radius:6px;border:none;background:#27ae60;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">📂 Carregar</button>' +
                '<button onclick="crmOrcExcluir(\''+o.id+'\')" style="padding:6px 10px;border-radius:6px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🗑</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
        '</div>' +
      '</div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
  };

  window.crmOrcCarregar = async function(orcId){
    var cardId = window._crmOrcCardId || window._snapCardId;
    if(!cardId) return;
    var card = await lerCard(cardId);
    var orc = ((card.extras||{}).orcamentos||[]).find(function(o){ return o.id === orcId; });
    if(!orc){ toast('❌ Orçamento não encontrado', '#c0392b'); return; }

    function setVal(id, v){ var e = $(id); if(e && v != null) e.value = v; }
    var inp = orc.inputs || {};
    if(inp.cliente){
      setVal('cliente', inp.cliente.nome); setVal('contato', inp.cliente.contato);
      setVal('telefone', inp.cliente.telefone); setVal('email', inp.cliente.email);
      setVal('cep', inp.cliente.cep); setVal('cidade', inp.cliente.cidade);
      setVal('estado', inp.cliente.estado); setVal('pais', inp.cliente.pais);
      setVal('endereco', inp.cliente.endereco);
    }
    if(inp.projeto){
      setVal('produto', inp.projeto.produto);
      setVal('carac-modelo', inp.projeto.modelo);
      setVal('largura', inp.projeto.largura); setVal('altura', inp.projeto.altura);
      setVal('folhas-porta', inp.projeto.folhas);
      setVal('abertura', inp.projeto.abertura);
      setVal('numprojeto', inp.projeto.reserva);
      setVal('num-agp', inp.projeto.agp);
      setVal('cor-ext', inp.projeto.cor_ext); setVal('cor-int', inp.projeto.cor_int);
      setVal('cor-macico', inp.projeto.cor_macico);
      setVal('qtd-portas', inp.projeto.qtd_portas);
    }
    if(inp.itens){ window._mpItens = JSON.parse(JSON.stringify(inp.itens)); }
    if(inp.instalacao){
      setVal('inst-quem', inp.instalacao.quem);
      setVal('inst-pais', inp.instalacao.pais);
      setVal('inst-intl-cambio', inp.instalacao.cambio);
      setVal('inst-intl-passagem', inp.instalacao.passagem);
      setVal('inst-intl-hotel', inp.instalacao.hotel);
      setVal('inst-intl-alim', inp.instalacao.alim);
      setVal('inst-intl-carro', inp.instalacao.carro);
      setVal('inst-intl-udigru', inp.instalacao.udigru);
      setVal('inst-intl-seguro', inp.instalacao.seguro);
      setVal('inst-intl-aero', inp.instalacao.aero);
      setVal('inst-intl-dias', inp.instalacao.dias);
      setVal('inst-intl-pessoas', inp.instalacao.pessoas);
      setVal('inst-intl-margem', inp.instalacao.margem);
      setVal('inst-intl-incoterm', inp.instalacao.incoterm);
    }
    if(orc.params){
      setVal('lucro-alvo', orc.params.margem);
      setVal('com-rep', orc.params.comissao_rep); setVal('com-rt', orc.params.comissao_rt);
      setVal('com-gest', orc.params.comissao_gest);
      setVal('overhead', orc.params.overhead); setVal('impostos', orc.params.impostos);
      setVal('markup-desc', orc.params.markup); setVal('desconto', orc.params.desconto);
    }

    if(typeof window.calc === 'function'){ try { window.calc(); } catch(e){} }
    var modal = $('orc-hist-modal-bg'); if(modal) modal.remove();
    toast('📂 <b>Orçamento carregado</b><br><span style="font-size:11px;font-weight:400">' + orc.label + '</span>', '#27ae60', 4000);
  };

  window.crmOrcExcluir = async function(orcId){
    if(!confirm('Excluir este orçamento do histórico?\n\nNão pode ser desfeito.')) return;
    var cardId = window._crmOrcCardId || window._snapCardId;
    try {
      var orcs = await excluirSnapshot(cardId, orcId);
      toast('🗑 <b>Excluído</b> · Histórico: ' + orcs.length, '#7f8c8d', 3000);
      atualizarBanner(orcs);
      var modal = $('orc-hist-modal-bg'); if(modal) modal.remove();
      window.crmOrcVerHistorico();
    } catch(e){ toast('❌ ' + e.message, '#c0392b'); }
  };

  /* ───────── BOOT: instalar UI ───────── */
  function instalarUI(){
    if($('btn-orc-salvar')) return true;
    var btnZerar = document.querySelector('button[onclick="zerarValores()"]');
    if(!btnZerar) return false;

    var html =
      '<button class="hbtn" id="btn-orc-salvar" onclick="crmOrcSalvar()" style="color:#fff;background:#1a5276;border-color:#1a5276;font-weight:700">💾 Salvar no card</button>' +
      '<button class="hbtn" id="btn-orc-imprimir" onclick="crmOrcImprimir()" style="color:#fff;background:#0C447C;border-color:#0C447C;font-weight:700">🖨️ Imprimir</button>' +
      '<button class="hbtn" id="btn-orc-recalcular" onclick="crmOrcRecalcular()" style="color:#fff;background:#7f8c8d;border-color:#7f8c8d;font-weight:700">🔄 Recalcular</button>';
    btnZerar.insertAdjacentHTML('beforebegin', html);

    var banner = document.createElement('div');
    banner.id = 'orc-historico-banner';
    banner.style.cssText = 'display:none;margin:8px 16px;padding:10px 14px;background:linear-gradient(135deg,#e3f2fd,#fff);border:1px solid #90caf9;border-radius:8px;font-size:12px;color:#0C447C;font-family:Montserrat,Arial,sans-serif';
    var orcTab = $('tab-orcamento') || document.querySelector('[id*="tab-orcamento"]');
    if(orcTab) orcTab.insertBefore(banner, orcTab.firstChild);

    console.log('[145] UI instalada (3 botoes + banner historico)');
    return true;
  }

  function instalarHookCardOpen(){
    var orig = window.crmOpenModal;
    if(!orig){ setTimeout(instalarHookCardOpen, 200); return; }
    if(orig.__sub145Hooked) return;
    window.crmOpenModal = function(){
      var r = orig.apply(this, arguments);
      setTimeout(function(){
        var cardId = window._crmOrcCardId || window._snapCardId;
        if(!cardId) return;
        lerCard(cardId).then(function(card){
          var orcs = (card.extras && card.extras.orcamentos) || [];
          atualizarBanner(orcs);
        }).catch(function(){});
      }, 800);
      return r;
    };
    window.crmOpenModal.__sub145Hooked = true;
  }

  function init(){
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if(instalarUI() || tries > 30) clearInterval(iv);
    }, 250);
    instalarHookCardOpen();
    console.log('[145-card-orcamento] iniciado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
