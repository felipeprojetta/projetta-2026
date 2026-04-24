/**
 * 79-revisoes-card.js
 *
 * Dentro do modal do card CRM, injeta uma seção mostrando as revisões
 * salvas em crm_revisoes. Permite:
 *   - Ver todas (Original, Revisão 1, 2, 3...)
 *   - Marcar qualquer uma como ATIVA (vai pro pipeline)
 *   - Deletar qualquer uma
 */
(function(){
  'use strict';

  var SUPA = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _hdrs(){ return { apikey: KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json' }; }
  function _brl(v){
    if(v == null || v === '') return '—';
    var n = typeof v==='string' ? parseFloat(v) : v;
    if(isNaN(n)) return '—';
    return 'R$ ' + n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function _fmtData(iso){
    try { var d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
    catch(e){ return iso; }
  }
  function _toast(msg, cor){
    var t = document.getElementById('rev-toast'); if(t) t.remove();
    t = document.createElement('div'); t.id='rev-toast';
    t.style.cssText='position:fixed;top:80px;right:20px;background:'+cor+';color:#fff;padding:12px 18px;border-radius:10px;font-size:12px;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);font-family:inherit';
    t.innerHTML=msg; document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, 3000);
  }

  async function _listarRevs(cardId){
    var r = await fetch(SUPA+'/rest/v1/crm_revisoes?opp_id=eq.'+encodeURIComponent(cardId)+'&deletado_em=is.null&order=rev_num.asc', {
      headers: _hdrs()
    });
    if(!r.ok) return [];
    return await r.json();
  }

  // ─── Marcar revisão como ativa (atualiza valores do card) ────────────
  window.marcarRevisaoAtiva = async function(cardId, revId, valTab, valFat){
    if(!confirm('Marcar esta revisão como ATIVA?\n\nOs valores desta revisão passarão a ser os valores oficiais do card no pipeline.')) return;
    try {
      // Desativar outras
      await fetch(SUPA+'/rest/v1/crm_revisoes?opp_id=eq.'+encodeURIComponent(cardId)+'&ativa=eq.true', {
        method:'PATCH', headers:Object.assign({},_hdrs(),{Prefer:'return=minimal'}),
        body: JSON.stringify({ ativa: false })
      });
      // Ativar essa
      await fetch(SUPA+'/rest/v1/crm_revisoes?id=eq.'+encodeURIComponent(revId), {
        method:'PATCH', headers:Object.assign({},_hdrs(),{Prefer:'return=minimal'}),
        body: JSON.stringify({ ativa: true })
      });
      // Atualizar card com valores dessa revisão
      var dados = { updated_at: new Date().toISOString() };
      if(valTab != null) dados.valor_tabela = valTab;
      if(valFat != null){ dados.valor_faturamento = valFat; dados.valor = valFat; }
      await fetch(SUPA+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId), {
        method:'PATCH', headers:Object.assign({},_hdrs(),{Prefer:'return=minimal'}),
        body: JSON.stringify(dados)
      });
      _toast('⭐ Revisão ativada!','#27ae60');
      // Re-renderizar seção
      setTimeout(function(){ _renderSecaoRevisoes(cardId); }, 300);
    } catch(err){
      _toast('❌ Erro: '+err.message,'#c0392b');
    }
  };

  // ─── Deletar revisão (soft delete) ──────────────────────────────────
  window.deletarRevisao = async function(cardId, revId, label){
    if(!confirm('Excluir '+label+'?\n\nEsta ação pode ser revertida via banco.')) return;
    try {
      await fetch(SUPA+'/rest/v1/crm_revisoes?id=eq.'+encodeURIComponent(revId), {
        method:'PATCH', headers:Object.assign({},_hdrs(),{Prefer:'return=minimal'}),
        body: JSON.stringify({ deletado_em: new Date().toISOString(), deletado_por: 'felipe.projetta', ativa: false })
      });
      _toast('🗑 '+label+' excluída','#e67e22');
      setTimeout(function(){ _renderSecaoRevisoes(cardId); }, 300);
    } catch(err){
      _toast('❌ Erro: '+err.message,'#c0392b');
    }
  };

  // ─── Renderizar seção ────────────────────────────────────────────────
  async function _renderSecaoRevisoes(cardId){
    var containerId = 'rev-section-render';
    var cont = document.getElementById(containerId);
    if(!cont) return;

    cont.innerHTML = '<div style="padding:12px;color:#7a8794;font-size:11px">⏳ Carregando revisões...</div>';
    var revs = await _listarRevs(cardId);

    if(!revs.length){
      cont.innerHTML =
        '<div style="padding:14px;text-align:center;color:#7a8794;font-size:12px;background:#fafafa;border-radius:8px">' +
          '📭 Nenhuma revisão aprovada ainda.<br>' +
          '<span style="font-size:10px">Clique em <b>🏆 Aprovar para Envio</b> no cabeçalho pra criar a Original.</span>' +
        '</div>';
      return;
    }

    var html = '<div style="display:flex;flex-direction:column;gap:6px">';
    revs.forEach(function(rev){
      var isAtiva = !!rev.ativa;
      var cor = isAtiva ? '#27ae60' : '#95a5a6';
      var bg  = isAtiva ? '#e8f8eb' : '#f5f5f5';
      var borda = isAtiva ? '2px solid #27ae60' : '1px solid #d5d2cc';
      html +=
        '<div style="border:'+borda+';background:'+bg+';border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">' +
              '<span style="font-size:12px;font-weight:800;color:#003144">' + (rev.label || 'Revisão '+rev.rev_num) + '</span>' +
              (isAtiva ? '<span style="background:#27ae60;color:#fff;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700">⭐ ATIVA NO PIPELINE</span>' : '') +
            '</div>' +
            '<div style="font-size:10px;color:#5f5e5a">' + _fmtData(rev.data || rev.created_at) + '</div>' +
            '<div style="font-size:11px;color:#003144;margin-top:4px">' +
              '<b>Tabela:</b> ' + _brl(rev.valor_tabela) + ' · <b>Fat:</b> ' + _brl(rev.valor_faturamento) +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0">' +
            (isAtiva ? '' :
              '<button onclick="marcarRevisaoAtiva(\''+cardId+'\',\''+rev.id+'\','+(rev.valor_tabela||'null')+','+(rev.valor_faturamento||'null')+')" title="Marcar como ativa" style="padding:6px 10px;border-radius:6px;border:1px solid #27ae60;background:#fff;color:#27ae60;font-size:11px;font-weight:700;cursor:pointer">⭐</button>'
            ) +
            '<button onclick="deletarRevisao(\''+cardId+'\',\''+rev.id+'\',\''+(rev.label||'Revisão '+rev.rev_num)+'\')" title="Excluir" style="padding:6px 10px;border-radius:6px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer">🗑</button>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    cont.innerHTML = html;
  }

  // ─── Injetar seção no modal do card ──────────────────────────────────
  function _injetarSecaoNoModal(){
    var modal = document.getElementById('crm-opp-modal');
    if(!modal || modal.style.display === 'none') return;
    // Já tem?
    if(document.getElementById('rev-section-render')) return;

    var body = modal.querySelector('.crm-modal-body');
    if(!body) return;

    // Descobrir cardId — tenta via _editingCardId global, window.currentId, etc
    var cardId = window._editingCardId || window.currentId || window._crmOrcCardId;
    if(!cardId){
      // Tenta ler do título/sub do modal
      var sub = document.getElementById('crm-modal-sub');
      if(sub) cardId = sub.dataset.cardId;
    }
    if(!cardId) return;

    // Criar seção logo acima do botão Salvar
    var sec = document.createElement('div');
    sec.style.cssText = 'margin-top:14px;padding-top:10px;border-top:2px solid #0C447C';
    sec.innerHTML =
      '<div style="font-size:12px;font-weight:800;color:#0C447C;margin-bottom:8px;letter-spacing:.03em">' +
        '📑 REVISÕES APROVADAS' +
      '</div>' +
      '<div id="rev-section-render"></div>';
    body.appendChild(sec);
    _renderSecaoRevisoes(cardId);
  }

  // Poll pra injetar quando modal abre
  setInterval(_injetarSecaoNoModal, 800);

  console.log('%c[79-revisoes-card] Ativo','color:#0C447C;font-weight:700;background:#E6F1FB;padding:3px 8px;border-radius:4px');
})();
