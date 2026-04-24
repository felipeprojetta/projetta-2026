/**
 * 74-aprovar-orcamento.js v3
 *
 * NOVO FLUXO:
 *   1. Detecta se é a 1ª aprovação → sugere "Original"
 *      ou já tem Original → sugere "Revisão N" (próxima)
 *   2. Cria registro em crm_revisoes com snapshot completo
 *   3. Marca essa como ativa (desativa as anteriores)
 *   4. Atualiza valores no card (só se for a ativa)
 *   5. Gera PDF pra download direto (via 80-pdf-download.js)
 */
(function(){
  'use strict';
  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _hdrs(){ return { apikey: ANON_KEY, Authorization: 'Bearer '+ANON_KEY, 'Content-Type':'application/json' }; }
  function _toast(html, cor, ms){
    var t = document.getElementById('projetta-save-toast'); if(t) t.remove();
    t = document.createElement('div'); t.id = 'projetta-save-toast';
    t.style.cssText = 'position:fixed;top:80px;right:20px;background:'+cor+';color:#fff;padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);max-width:480px;line-height:1.45;font-family:inherit';
    t.innerHTML = html; document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 6000);
  }
  function _parseMoeda(txt){
    if(!txt) return null;
    var s = String(txt).replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
    var n = parseFloat(s); return isNaN(n) ? null : n;
  }
  function _txt(id){ var el = document.getElementById(id); if(!el) return ''; return (el.textContent || el.innerText || '').trim(); }

  // ─── Buscar revisões existentes do card ───────────────────────────
  async function _listarRevisoes(cardId){
    var r = await fetch(SUPABASE_URL+'/rest/v1/crm_revisoes?opp_id=eq.'+encodeURIComponent(cardId)+'&deletado_em=is.null&order=rev_num.asc', {
      headers: _hdrs()
    });
    if(!r.ok) return [];
    return await r.json();
  }

  // ─── Calcular próximo rev_num e label ──────────────────────────────
  function _proximaRevisao(revs){
    // revs já existentes (array). Se vazio → Original (rev_num=1, label="Original")
    // Se tem Original → Revisão N (rev_num=N+1)
    if(!revs || revs.length === 0){
      return { rev_num: 1, label: 'Original' };
    }
    var maxNum = 0;
    revs.forEach(function(r){ if(r.rev_num > maxNum) maxNum = r.rev_num; });
    var nextNum = maxNum + 1;
    return { rev_num: nextNum, label: 'Revisão ' + (nextNum - 1) };
  }

  // ─── Capturar snapshot do estado atual ────────────────────────────
  function _capturarSnapshot(){
    function gv(id){ var el = document.getElementById(id); return el ? el.value : null; }
    function gt(id){ var el = document.getElementById(id); return el ? (el.textContent||el.innerText||'').trim() : null; }
    return {
      cliente:    gv('cli-nome') || gv('crm-o-cliente'),
      agp:        gv('num-agp') || gv('agp') || gv('proj-agp'),
      reserva:    gv('proj-reserva'),
      largura:    gv('largura'),
      altura:     gv('altura'),
      folhas:     gv('folhas-porta'),
      modelo:     gv('modelo-porta'),
      params: {
        overhead:   gv('overhead'),
        impostos:   gv('impostos'),
        com_rep:    gv('com-rep'),
        com_rt:     gv('com-rt'),
        com_gest:   gv('com-gest'),
        lucro_alvo: gv('lucro-alvo'),
        markup_desc:gv('markup-desc'),
        desconto:   gv('desconto')
      },
      resultado: {
        custo_porta: gt('m-custo-porta'),
        preco_tabela: gt('m-tab-porta') || gt('m-tab'),
        preco_fat: gt('m-fat-porta') || gt('m-fat'),
        markup: gt('m-mkp-porta')
      },
      itens: window._orcItens || [],
      data_snapshot: new Date().toISOString()
    };
  }

  async function _patchCard(cardId, dados){
    var r = await fetch(SUPABASE_URL+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId), {
      method: 'PATCH',
      headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
      body: JSON.stringify(dados)
    });
    if(!r.ok){ var t = await r.text(); throw new Error('PATCH falhou: '+r.status+' — '+t); }
  }

  // ─── Desativar outras revisões ────────────────────────────────────
  async function _desativarOutras(cardId){
    await fetch(SUPABASE_URL+'/rest/v1/crm_revisoes?opp_id=eq.'+encodeURIComponent(cardId)+'&ativa=eq.true', {
      method: 'PATCH',
      headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
      body: JSON.stringify({ ativa: false })
    });
  }

  // ─── Inserir nova revisão ─────────────────────────────────────────
  async function _inserirRevisao(cardId, revInfo, valTab, valFat, snap){
    var r = await fetch(SUPABASE_URL+'/rest/v1/crm_revisoes', {
      method: 'POST',
      headers: Object.assign({}, _hdrs(), { Prefer:'return=representation' }),
      body: JSON.stringify({
        opp_id: cardId,
        rev_num: revInfo.rev_num,
        label: revInfo.label,
        data: new Date().toISOString(),
        valor_tabela: valTab,
        valor_faturamento: valFat,
        snapshot: snap,
        ativa: true,
        created_by: 'felipe.projetta'
      })
    });
    if(!r.ok){ var t = await r.text(); throw new Error('Insert revisão falhou: '+r.status+' — '+t); }
    return await r.json();
  }

  async function _marcarPreOrcAprovado(cardId, versao){
    var r1 = await fetch(SUPABASE_URL+'/rest/v1/pre_orcamentos?card_id=eq.'+encodeURIComponent(cardId)+'&deleted_at=is.null&aprovado=eq.false&order=created_at.desc&limit=1', { headers: _hdrs() });
    if(!r1.ok) return null;
    var arr = await r1.json();
    if(!arr.length) return null;
    var po = arr[0];
    await fetch(SUPABASE_URL+'/rest/v1/pre_orcamentos?id=eq.'+encodeURIComponent(po.id), {
      method: 'PATCH',
      headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
      body: JSON.stringify({ aprovado: true, aprovado_em: new Date().toISOString(), versao_aprovada: versao })
    });
    return po.id;
  }

  // ─── Gerar arquivos: usa download direto se disponível ─────────────
  async function _gerarArquivosDownload(cardId, revInfo){
    var agpEl = document.getElementById('num-agp') || document.getElementById('agp');
    var agp = agpEl ? (agpEl.value||'').trim() : cardId;
    var cliEl = document.getElementById('cli-nome');
    var cli = cliEl ? (cliEl.value||'').trim() : '';
    var baseNome = agp + (cli ? ' - '+cli : '') + ' - ' + revInfo.label;

    var out = [];
    // Preferir download direto se a função estiver disponível
    var temDownload = typeof window.downloadProposta === 'function';
    if(temDownload){
      function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
      try { await window.downloadProposta(baseNome); out.push('✓ Proposta Comercial.pdf');
      } catch(e){ out.push('⚠ Proposta: '+e.message); console.error(e); }
      await sleep(1500);
      try { if(typeof window.downloadMargens === 'function'){ await window.downloadMargens(baseNome); out.push('✓ MR - Margens.png'); }
      } catch(e){ out.push('⚠ Margens: '+e.message); console.error(e); }
      await sleep(1500);
      try { if(typeof window.downloadMemorial === 'function'){ await window.downloadMemorial(baseNome); out.push('✓ MC - Memorial.png'); }
      } catch(e){ out.push('⚠ Memorial: '+e.message); console.error(e); }
      await sleep(1500);
      try { if(typeof window.downloadPainelRep === 'function'){ await window.downloadPainelRep(baseNome); out.push('✓ RC - Representante.png'); }
      } catch(e){ out.push('⚠ Representante: '+e.message); console.error(e); }
    } else {
      // Fallback: funções print antigas
      var fns = [
        { nome:'Proposta Comercial (PDF)', fn: window.printProposta },
        { nome:'Painel de Margens (MC)',   fn: window.printMargens },
        { nome:'Memorial/Resumo (MR)',     fn: window.printMemorialCalculo },
        { nome:'Painel Representante (RC)',fn: window.printPainelRep }
      ];
      for(var i = 0; i < fns.length; i++){
        var f = fns[i];
        if(typeof f.fn === 'function'){
          try { f.fn(); out.push('✓ '+f.nome); await new Promise(function(res){ setTimeout(res, 1200); }); }
          catch(e){ out.push('⚠ '+f.nome+' (erro)'); }
        }
      }
    }
    return out;
  }

  window.aprovarOrcamentoParaEnvio = async function(){
    var cardId = window._crmOrcCardId;
    if(!cardId){ _toast('⚠ <b>Sem card vinculado</b><br>Abra via "Fazer Orçamento" do CRM', '#c0392b', 5000); return; }

    var valTab = _parseMoeda(_txt('m-tab-porta') || _txt('m-tab'));
    var valFat = _parseMoeda(_txt('m-fat-porta') || _txt('m-fat'));
    if(valTab == null && valFat == null){
      _toast('⚠ <b>Orçamento não calculado</b><br>Preencha e calcule antes de aprovar','#c0392b',5000); return;
    }

    // Buscar revisões existentes pra calcular próxima
    _toast('⏳ Carregando revisões...', '#7f8c8d', 3000);
    var revs = await _listarRevisoes(cardId);
    var rev = _proximaRevisao(revs);

    var ok = confirm(
      '🏆 APROVAR ORÇAMENTO?\n\n' +
      'Essa aprovação será registrada como:\n' +
      '  → ' + rev.label + '  (rev_num=' + rev.rev_num + ')\n\n' +
      (revs.length > 0 ? 'Já existem ' + revs.length + ' revisão(ões) neste card.\n\n' : 'Esta é a PRIMEIRA aprovação deste card.\n\n') +
      'Valor tabela:      R$ ' + (valTab ? valTab.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—') + '\n' +
      'Valor faturamento: R$ ' + (valFat ? valFat.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—') + '\n\n' +
      'Ao confirmar:\n' +
      '  • Nova revisão criada e marcada ATIVA\n' +
      '  • Card → "📧 Orçamento Pronto"\n' +
      '  • Valores da revisão ativa vão pro pipeline\n' +
      '  • PDFs baixados (sem diálogo de impressão)\n\n' +
      'Prosseguir?'
    );
    if(!ok) return;

    _toast('⏳ <b>Aprovando '+rev.label+'...</b>', '#7f8c8d', 4000);
    try {
      var snap = _capturarSnapshot();
      // 1. Desativar outras revisões do mesmo card
      await _desativarOutras(cardId);
      // 2. Inserir nova revisão como ativa
      await _inserirRevisao(cardId, rev, valTab, valFat, snap);
      // 3. Atualizar card
      var dadosCard = { stage:'s3b', updated_at: new Date().toISOString() };
      if(valTab != null) dadosCard.valor_tabela      = valTab;
      if(valFat != null) dadosCard.valor_faturamento = valFat;
      if(valFat != null) dadosCard.valor             = valFat;
      await _patchCard(cardId, dadosCard);
      // 4. Marcar pré-orçamento (se houver) como aprovado
      await _marcarPreOrcAprovado(cardId, rev.rev_num);
      // 5. Gerar arquivos (download direto se disponível)
      _toast('📄 <b>Gerando PDFs...</b>', '#0C447C', 3000);
      var gerados = await _gerarArquivosDownload(cardId, rev);

      _toast(
        '🏆 <b>' + rev.label + ' APROVADA!</b><br>' +
        '<span style="font-size:12px;font-weight:600">' + (valFat ? 'R$ '+valFat.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '') + '</span><br>' +
        '<span style="font-size:10px;font-weight:400;opacity:.9;display:block;margin-top:6px;line-height:1.5">' +
        '✓ Revisão '+rev.rev_num+' gravada (ATIVA)<br>' +
        '✓ Card → Orçamento Pronto<br>' +
        gerados.join('<br>') + '</span>',
        '#27ae60', 10000
      );
    } catch(err){
      _toast('❌ <b>Erro</b>: '+err.message, '#c0392b', 8000);
      console.error('[aprovar v3]', err);
    }
  };

  console.log('%c[74-aprovar v3] Revisão em crm_revisoes + download direto','color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
