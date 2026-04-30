/* ============================================================================
 * js/154-historico-card-id-fix.js  —  Fix histórico no modal (28-abr-2026)
 *
 * Felipe 28/04: "quando reinicio sistema cards com valores ficam sem
 * historico, so aparece historico..."
 *
 * BUG: O 152 dependia de window._crmOrcCardId (setado quando Felipe
 * clica "Fazer Orçamento" no card), mas quando ele REABRE o sistema
 * e clica num card pra editar (modal Editar Oportunidade), o cardId
 * vem do parametro editId do crmOpenModal — que eu nao estava capturando.
 *
 * SOLUCAO:
 *  1) Hook em crmOpenModal(stage, editId) para capturar editId em
 *     window._crmModalEditId
 *  2) Reescrever popularHistoricoModal pra tentar nessa ordem:
 *     A. window._crmOrcCardId (orcamento ativo)
 *     B. window._crmModalEditId (modal aberto)
 *     C. Busca pelo AGP do input crm-o-agp
 *     D. Busca pelo cliente + reserva
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta154Applied) return;
  window.__projetta154Applied = true;

  var SB = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  function $(id){ return document.getElementById(id); }
  function val(id){ var e = $(id); return e ? (e.value || '') : ''; }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function toast(html, color, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:380px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 3500);
  }

  /* ═══════════ 1) HOOK crmOpenModal pra capturar editId ═══════════ */
  function hookOpenModal(){
    var orig = window.crmOpenModal;
    if(!orig){ setTimeout(hookOpenModal, 200); return; }
    if(orig.__sub154Hooked) return;
    window.crmOpenModal = function(defaultStage, editId){
      window._crmModalEditId = editId || null;
      console.log('[154] crmOpenModal capturado editId:', editId || '(novo)');
      return orig.apply(this, arguments);
    };
    window.crmOpenModal.__sub154Hooked = true;
    console.log('[154] hook crmOpenModal v3 instalado');
  }

  /* ═══════════ 2) BUSCA ROBUSTA DO CARD ID ═══════════ */
  async function descobrirCardId(){
    // A. Orçamento ativo
    if(window._crmOrcCardId) return { id: window._crmOrcCardId, fonte: 'orcamento-ativo' };
    if(window._snapCardId) return { id: window._snapCardId, fonte: 'snapshot-id' };

    // B. Modal aberto
    if(window._crmModalEditId) return { id: window._crmModalEditId, fonte: 'modal-edit-id' };

    // C. Busca por AGP no input do modal
    var agp = val('crm-o-agp') || val('num-agp') || val('agp');
    if(agp){
      try {
        var url = SB + '/rest/v1/crm_oportunidades?select=id,extras,cliente,agp&agp=eq.' + encodeURIComponent(agp);
        var r = await fetch(url, { headers: H });
        if(r.ok){
          var arr = await r.json();
          if(arr.length === 1) return { id: arr[0].id, fonte: 'busca-agp', card: arr[0] };
          if(arr.length > 1){
            // Multiplos AGPs iguais - tentar refinar com cliente
            var cli = val('crm-o-cliente');
            if(cli){
              var match = arr.find(function(c){ return (c.cliente||'').toLowerCase() === cli.toLowerCase(); });
              if(match) return { id: match.id, fonte: 'busca-agp-cliente', card: match };
            }
          }
        }
      } catch(e){ console.warn('[154 busca AGP]', e); }
    }

    // D. Busca por reserva + cliente
    var reserva = val('crm-o-reserva') || val('numprojeto') || val('reserva');
    var cliente = val('crm-o-cliente') || val('cliente');
    if(reserva && cliente){
      try {
        var url2 = SB + '/rest/v1/crm_oportunidades?select=id,extras,cliente,agp,reserva&reserva=eq.' + encodeURIComponent(reserva) + '&cliente=eq.' + encodeURIComponent(cliente);
        var r2 = await fetch(url2, { headers: H });
        if(r2.ok){
          var arr2 = await r2.json();
          if(arr2.length >= 1) return { id: arr2[0].id, fonte: 'busca-reserva-cliente', card: arr2[0] };
        }
      } catch(e){ console.warn('[154 busca reserva]', e); }
    }

    return null;
  }

  async function lerCard(cardId){
    var r = await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras,cliente,agp', { headers: H });
    if(!r.ok) return null;
    var arr = await r.json();
    return arr[0];
  }

  /* ═══════════ 3) REPOPULAR HISTORICO COM BUSCA ROBUSTA ═══════════ */
  async function popularHistoricoV3(modalEl){
    if(!modalEl){
      modalEl = document.querySelector('.crm-modal-bg.open') || document.querySelector('#crm-opp-modal.open');
    }
    if(!modalEl) return;

    // Achar onde inserir: ANTES do .crm-modal-footer
    var footer = modalEl.querySelector('.crm-modal-footer');
    if(!footer) return;

    // Remover seções existentes (do 152)
    var existing = modalEl.querySelector('#crm-orc-historico-section-v2');
    if(existing) existing.remove();

    var section = document.createElement('div');
    section.id = 'crm-orc-historico-section-v2';
    section.style.cssText = 'margin:14px 0;padding:12px;background:#f0f7ff;border:2px solid #0C447C;border-radius:10px';
    section.innerHTML =
      '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#0C447C;margin-bottom:10px">' +
        '📚 Histórico de Orçamentos <span id="hist-v3-count" style="background:#0C447C;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px;margin-left:6px">…</span>' +
      '</div>' +
      '<div id="hist-v3-list" style="max-height:300px;overflow-y:auto"><div style="text-align:center;padding:14px;color:#888;font-size:11px">⏳ Buscando histórico…</div></div>';
    footer.parentNode.insertBefore(section, footer);

    // Descobrir cardId
    var info = await descobrirCardId();
    var listEl = section.querySelector('#hist-v3-list');
    var countEl = section.querySelector('#hist-v3-count');

    if(!info){
      countEl.textContent = '0';
      listEl.innerHTML = '<div style="text-align:center;padding:14px;color:#666;font-size:12px;background:#fff;border-radius:6px">' +
        '<b>Card sem ID identificado.</b><br>' +
        '<span style="font-size:11px">Salve o card primeiro (Salvar Alterações) para iniciar histórico.</span>' +
      '</div>';
      console.warn('[154] cardId nao descoberto');
      return;
    }

    console.log('[154] cardId descoberto via:', info.fonte, '→', info.id);

    try {
      var card = info.card || (await lerCard(info.id));
      var orcs = (card && card.extras && card.extras.orcamentos) || [];
      countEl.textContent = orcs.length;

      if(orcs.length === 0){
        listEl.innerHTML = '<div style="text-align:center;padding:14px;color:#666;font-size:12px;background:#fff;border-radius:6px">' +
          '<b>Nenhum orçamento salvo neste card.</b><br>' +
          '<span style="font-size:11px">Vá para <b>Orçamento</b>, calcule e clique em <b>💾 Salvar no card</b>.</span>' +
          '<div style="font-size:10px;color:#aaa;margin-top:6px">cardId: ' + info.id.slice(0,8) + '…</div>' +
        '</div>';
        // Salvar o cardId pra uso futuro (ex: Salvar no card)
        window._crmOrcCardId = info.id;
        return;
      }

      // Salvar cardId pra "Salvar no card" funcionar
      window._crmOrcCardId = info.id;

      listEl.innerHTML = orcs.map(function(o){
        var d = new Date(o.ts);
        var dStr = d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
        var qi = (o.inputs && o.inputs.itens && o.inputs.itens.length) || 1;
        return '<div style="background:#fff;border:1px solid #d4e0ed;border-radius:8px;padding:10px 12px;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">' +
            '<div style="flex:1;min-width:180px">' +
              '<div style="font-weight:800;font-size:12px;color:#0C447C">' + esc(o.label || ('V' + dStr)) + '</div>' +
              '<div style="font-size:10px;color:#888;margin-top:1px">' + dStr + ' · ' + esc(o.autor || 'anon') + ' · ' + qi + ' item(s)</div>' +
              '<div style="font-size:11px;margin-top:3px"><b>Tab:</b> ' + esc(o.resultado && o.resultado.preco_tabela || '—') +
                ' · <b>Fat:</b> <span style="color:#e67e22;font-weight:700">' + esc(o.resultado && o.resultado.preco_faturamento || '—') + '</span></div>' +
            '</div>' +
            '<div style="display:flex;gap:5px;flex-shrink:0">' +
              '<button type="button" onclick="crmOrcCarregarV3(\''+o.id+'\')" style="padding:6px 12px;border-radius:5px;border:none;background:#27ae60;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">📂 Carregar</button>' +
              '<button type="button" onclick="crmOrcExcluirV3(\''+o.id+'\')" style="padding:6px 10px;border-radius:5px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🗑</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch(e){
      console.error('[154 popular]', e);
      listEl.innerHTML = '<div style="color:#c0392b;font-size:11px;padding:10px">Erro: ' + esc(e.message) + '</div>';
    }
  }

  // Funcoes V3
  window.crmOrcCarregarV3 = async function(orcId){
    if(typeof window.crmOrcCarregar === 'function'){
      await window.crmOrcCarregar(orcId);
      if(typeof window.crmCloseModal === 'function') try { window.crmCloseModal(); } catch(e){}
      if(typeof window.switchTab === 'function') try { window.switchTab('orcamento'); } catch(e){}
      toast('📂 <b>Orçamento carregado</b>', '#27ae60', 3500);
    } else toast('❌ Função carregar indisponível', '#c0392b');
  };

  window.crmOrcExcluirV3 = async function(orcId){
    if(!confirm('Excluir este orçamento do histórico?\n\nNão pode ser desfeito.')) return;
    var info = await descobrirCardId();
    if(!info){ toast('⚠ Sem cardId', '#c0392b'); return; }
    try {
      var card = await lerCard(info.id);
      var extras = (card && card.extras) || {};
      var orcs = (Array.isArray(extras.orcamentos) ? extras.orcamentos : []).filter(function(o){ return o.id !== orcId; });
      extras.orcamentos = orcs;
      var top = orcs[0];
      var body = {
        extras: extras,
        valor: top ? (top.resultado._vFat || top.resultado._vTab || 0) : 0,
        valor_tabela: top ? (top.resultado._vTab || 0) : 0,
        valor_faturamento: top ? (top.resultado._vFat || 0) : 0
      };
      await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(info.id), {
        method: 'PATCH',
        headers: Object.assign({}, H, { 'Content-Type':'application/json', Prefer:'return=minimal' }),
        body: JSON.stringify(body)
      });
      toast('🗑 Excluído · Restam ' + orcs.length, '#7f8c8d', 3000);
      await popularHistoricoV3();
      if(typeof window._refreshBadgesKanban === 'function') window._refreshBadgesKanban();
    } catch(e){ toast('❌ '+e.message, '#c0392b'); }
  };

  /* ═══════════ 4) MUTATION OBSERVER ROBUSTO ═══════════ */
  function instalarObserver(){
    var observer = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        if(m.type === 'attributes' && m.attributeName === 'class'){
          var el = m.target;
          if(el.classList && el.classList.contains('open')){
            // Modal abriu - aguardar render dos inputs e popular
            setTimeout(function(){ popularHistoricoV3(el); }, 700);
          }
        }
      });
    });

    // Observar TODOS os elementos com class crm-modal-bg
    function attachAll(){
      document.querySelectorAll('.crm-modal-bg').forEach(function(el){
        if(!el.__sub154Observed){
          observer.observe(el, { attributes: true, attributeFilter: ['class'] });
          el.__sub154Observed = true;
        }
      });
    }
    attachAll();
    setInterval(attachAll, 2000);

    // Observar body por novos modais
    var bodyObs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.classList && n.classList.contains('crm-modal-bg') && !n.__sub154Observed){
            observer.observe(n, { attributes: true, attributeFilter: ['class'] });
            n.__sub154Observed = true;
          }
        });
      });
    });
    bodyObs.observe(document.body, { childList: true, subtree: false });
    console.log('[154] MutationObserver V3 instalado');
  }

  function init(){
    hookOpenModal();
    setTimeout(instalarObserver, 800);
    console.log('[154-historico-card-id-fix] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
