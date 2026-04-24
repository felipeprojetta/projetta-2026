/**
 * 74-aprovar-orcamento.js v2 — IDs corretos (m-tab, m-fat)
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

  function _calcProximaVersao(agp){
    if(!agp || typeof agp !== 'string') return { base:null, versao:1, proximo:null };
    var m = agp.match(/^(.+?)-(\d+)$/);
    var base, va;
    if(m){ base = m[1]; va = parseInt(m[2],10) || 0; } else { base = agp; va = 0; }
    var px = va + 1;
    return { base: base, versao: px, proximo: base+'-'+px };
  }

  async function _patchCard(cardId, dados){
    var r = await fetch(SUPABASE_URL+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId), {
      method: 'PATCH',
      headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
      body: JSON.stringify(dados)
    });
    if(!r.ok){ var t = await r.text(); throw new Error('PATCH falhou: '+r.status+' — '+t); }
  }
  async function _marcarAprovado(cardId, versao){
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

  async function _gerarArquivos(){
    var fns = [
      { nome:'Proposta Comercial (PDF)', fn: window.printProposta },
      { nome:'Painel de Margens (MC)',   fn: window.printMargens },
      { nome:'Memorial/Resumo (MR)',     fn: window.printMemorialCalculo },
      { nome:'Painel Representante (RC)',fn: window.printPainelRep }
    ];
    var out = [];
    for(var i = 0; i < fns.length; i++){
      var f = fns[i];
      if(typeof f.fn === 'function'){
        try { f.fn(); out.push('✓ '+f.nome); await new Promise(function(res){ setTimeout(res, 1200); }); }
        catch(e){ out.push('⚠ '+f.nome+' (erro)'); }
      } else out.push('— '+f.nome+' (função ausente)');
    }
    return out;
  }

  window.aprovarOrcamentoParaEnvio = async function(){
    var cardId = window._crmOrcCardId;
    if(!cardId){ _toast('⚠ <b>Sem card vinculado</b><br>Abra via "Fazer Orçamento" do CRM', '#c0392b', 5000); return; }
    var agpEl = document.getElementById('num-agp') || document.getElementById('agp');
    var agpAtual = agpEl ? (agpEl.value || '').trim() : '';
    if(!agpAtual){ _toast('⚠ <b>AGP não preenchido</b>', '#c0392b', 5000); return; }

    var v = _calcProximaVersao(agpAtual);
    var valTabela = _parseMoeda(_txt('m-tab'));
    var valFat    = _parseMoeda(_txt('m-fat'));

    var ok = confirm(
      '🏆 APROVAR ORÇAMENTO PARA ENVIO?\n\n'+
      'AGP atual:         '+agpAtual+'\n'+
      'Novo AGP:          '+v.proximo+'  (versão '+v.versao+')\n'+
      'Valor tabela:      R$ '+(valTabela ? valTabela.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '(não calculado)')+'\n'+
      'Valor faturamento: R$ '+(valFat ? valFat.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '(não calculado)')+'\n\n'+
      'Ao confirmar:\n'+
      '  • Card → "📧 Orçamento Pronto"\n'+
      '  • Valores serão gravados no card\n'+
      '  • AGP mudará pra '+v.proximo+'\n'+
      '  • PDF + 3 PNGs gerados\n\n'+
      'Prosseguir?'
    );
    if(!ok) return;
    _toast('⏳ <b>Aprovando orçamento...</b>', '#7f8c8d', 4000);
    try {
      var dados = { stage:'s3b', agp:v.proximo, updated_at: new Date().toISOString() };
      if(valTabela != null) dados.valor_tabela      = valTabela;
      if(valFat    != null) dados.valor_faturamento = valFat;
      if(valFat    != null) dados.valor             = valFat;
      await _patchCard(cardId, dados);
      var preorcId = await _marcarAprovado(cardId, v.versao);
      if(agpEl) agpEl.value = v.proximo;
      _toast('📄 <b>Gerando arquivos...</b>', '#0C447C', 4000);
      var gerados = await _gerarArquivos();
      _toast(
        '🏆 <b>Orçamento APROVADO!</b><br>'+
        '<span style="font-size:12px;font-weight:600">AGP '+v.proximo+(valFat ? ' · R$ '+valFat.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '')+'</span><br>'+
        '<span style="font-size:10px;font-weight:400;opacity:.9;display:block;margin-top:6px;line-height:1.5">'+
        '✓ Card → Orçamento Pronto<br>'+
        '✓ Valores gravados<br>'+
        (preorcId ? '✓ Pré-orçamento aprovado v'+v.versao+'<br>' : '')+
        gerados.join('<br>')+'</span>',
        '#27ae60', 10000
      );
    } catch(err){
      _toast('❌ <b>Erro</b>: '+err.message, '#c0392b', 8000);
      console.error('[aprovar]', err);
    }
  };
  console.log('%c[74-aprovar] v2 — IDs corretos','color:#0C447C;font-weight:600;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
