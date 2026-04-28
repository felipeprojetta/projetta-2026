/* ============================================================================
 * js/150-historico-modal.js  —  Histórico no modal CRM + badge no card kanban
 *
 * Felipe 28/04: relato — "ja esta no historico 5, e nada aparece no card,
 * nem botao de remove array tem, nao tem botao carregar"
 *
 * Causa: o banner do 145/149 fica na sub-aba Orcamento, mas Felipe nao
 * navega ate la. Ele abre o card no Kanban → modal "Editar Oportunidade"
 * e espera ver o historico/botoes la mesmo.
 *
 * SOLUCAO:
 *   A) SECAO "Historico de Orcamentos" NO MODAL CRM (Editar Oportunidade)
 *      Aparece automaticamente quando ha orcamentos salvos. Lista cada
 *      um com Carregar e Remover inline.
 *   B) BADGE "📚 N" NO CARD DO KANBAN quando ha orcamentos salvos.
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta150Applied) return;
  window.__projetta150Applied = true;

  var SB = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function toast(html, color, ms){
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:380px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 3500);
  }

  /* ───────── BANCO ───────── */
  async function lerCard(cardId){
    var r = await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras,cliente', { headers: H });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    var arr = await r.json();
    return arr[0];
  }

  async function excluirOrc(cardId, orcId){
    var card = await lerCard(cardId);
    if(!card) throw new Error('Card nao encontrado');
    var extras = card.extras || {};
    var orcs = (Array.isArray(extras.orcamentos) ? extras.orcamentos : [])
                .filter(function(o){ return o.id !== orcId; });
    extras.orcamentos = orcs;
    var top = orcs[0];
    var body = {
      extras: extras,
      valor: top ? (top.resultado._vFat || top.resultado._vTab || 0) : 0,
      valor_tabela: top ? (top.resultado._vTab || 0) : 0,
      valor_faturamento: top ? (top.resultado._vFat || 0) : 0
    };
    await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId), {
      method: 'PATCH',
      headers: Object.assign({}, H, { 'Content-Type':'application/json', Prefer:'return=minimal' }),
      body: JSON.stringify(body)
    });
    return orcs;
  }

  /* ═══════════ A) SECAO HISTORICO NO MODAL CRM ═══════════ */

  function instalarSecaoModal(){
    if($('crm-orc-historico-section')) return true;
    // Achar onde inserir: ANTES de "crm-revisoes-section" ou ANTES do crm-modal-footer
    var alvo = $('crm-revisoes-section');
    if(!alvo){
      var footer = document.querySelector('.crm-modal-footer');
      if(footer) alvo = footer;
    }
    if(!alvo) return false;

    var section = document.createElement('div');
    section.id = 'crm-orc-historico-section';
    section.style.cssText = 'display:none;margin-top:10px';
    section.innerHTML =
      '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#0C447C;margin-bottom:8px">' +
        '📚 Histórico de Orçamentos <span id="crm-orc-hist-count" style="background:#0C447C;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px;margin-left:6px">0</span>' +
      '</div>' +
      '<div id="crm-orc-hist-list" style="background:#f8f9fa;border-radius:10px;padding:10px;border:1px solid #e3e8ed;max-height:280px;overflow-y:auto"></div>';
    alvo.parentNode.insertBefore(section, alvo);
    console.log('[150] secao historico instalada no modal CRM');
    return true;
  }

  async function popularSecaoModal(cardId){
    var section = $('crm-orc-historico-section');
    var listEl = $('crm-orc-hist-list');
    var countEl = $('crm-orc-hist-count');
    if(!section || !listEl) return;

    if(!cardId){ section.style.display = 'none'; return; }

    try {
      var card = await lerCard(cardId);
      var orcs = (card && card.extras && card.extras.orcamentos) || [];
      countEl.textContent = orcs.length;

      if(orcs.length === 0){
        section.style.display = 'block';
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;font-size:12px">' +
          'Nenhum orçamento salvo neste card.<br>' +
          '<span style="font-size:11px">Vá para a aba <b>Orçamento</b>, faça os cálculos e clique em <b>💾 Salvar no card</b>.</span>' +
        '</div>';
        return;
      }

      section.style.display = 'block';
      listEl.innerHTML = orcs.map(function(o){
        var d = new Date(o.ts);
        var dStr = d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
        var qi = (o.inputs && o.inputs.itens && o.inputs.itens.length) || 1;
        return '<div style="background:#fff;border:1px solid #e3e8ed;border-radius:8px;padding:10px 12px;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">' +
            '<div style="flex:1;min-width:200px">' +
              '<div style="font-weight:800;font-size:12px;color:#0C447C">' + esc(o.label || ('V' + dStr)) + '</div>' +
              '<div style="font-size:10px;color:#888;margin-top:1px">' + dStr + ' · ' + esc(o.autor || 'anon') + ' · ' + qi + ' item(s)</div>' +
              '<div style="font-size:11px;margin-top:3px"><b>Tab:</b> ' + esc(o.resultado && o.resultado.preco_tabela || '—') +
                ' · <b>Fat:</b> <span style="color:#e67e22;font-weight:700">' + esc(o.resultado && o.resultado.preco_faturamento || '—') + '</span></div>' +
            '</div>' +
            '<div style="display:flex;gap:5px;flex-shrink:0">' +
              '<button type="button" onclick="crmOrcCarregarModal(\''+o.id+'\')" style="padding:5px 10px;border-radius:5px;border:none;background:#27ae60;color:#fff;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">📂 Carregar</button>' +
              '<button type="button" onclick="crmOrcExcluirModal(\''+o.id+'\')" style="padding:5px 9px;border-radius:5px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🗑</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch(e){
      console.warn('[150 popular]', e);
      listEl.innerHTML = '<div style="color:#c0392b;font-size:11px;padding:10px">Erro ao carregar histórico: ' + esc(e.message) + '</div>';
    }
  }

  // Wrappers para os botoes (chamam carrega/exclui do 145 mas mantem modal aberto)
  window.crmOrcCarregarModal = async function(orcId){
    if(typeof window.crmOrcCarregar === 'function'){
      await window.crmOrcCarregar(orcId);
      // Fechar modal CRM e ir pra aba Orcamento
      if(typeof window.crmCloseModal === 'function') try { window.crmCloseModal(); } catch(e){}
      if(typeof window.switchTab === 'function') try { window.switchTab('orcamento'); } catch(e){}
    } else {
      toast('❌ Funcao de carregar nao disponivel', '#c0392b');
    }
  };

  window.crmOrcExcluirModal = async function(orcId){
    if(!confirm('Excluir este orçamento do histórico?\n\nNão pode ser desfeito.')) return;
    var cardId = window._crmOrcCardId || window._snapCardId;
    if(!cardId){ toast('⚠ Sem card ativo', '#c0392b'); return; }
    try {
      var orcs = await excluirOrc(cardId, orcId);
      toast('🗑 <b>Excluído</b> · Restam ' + orcs.length + ' no histórico', '#7f8c8d', 3000);
      await popularSecaoModal(cardId);
      // Tambem atualizar badges/banners se existirem
      if(typeof window._refreshBadgesKanban === 'function') window._refreshBadgesKanban();
    } catch(e){
      toast('❌ ' + e.message, '#c0392b', 5000);
    }
  };

  // Hook em crmOpenModal para popular ao abrir
  function hookOpen(){
    var orig = window.crmOpenModal;
    if(!orig){ setTimeout(hookOpen, 200); return; }
    if(orig.__sub150Hooked) return;
    window.crmOpenModal = function(){
      var r = orig.apply(this, arguments);
      setTimeout(function(){
        instalarSecaoModal();
        var cardId = window._crmOrcCardId || window._snapCardId;
        if(cardId) popularSecaoModal(cardId);
      }, 600);
      return r;
    };
    window.crmOpenModal.__sub150Hooked = true;
    console.log('[150] hook crmOpenModal instalado');
  }

  // Hook em crmOrcSalvar para atualizar lista após salvar (caso modal esteja aberto)
  function hookSalvar(){
    var orig = window.crmOrcSalvar;
    if(!orig){ setTimeout(hookSalvar, 200); return; }
    if(orig.__sub150Hooked) return;
    window.crmOrcSalvar = async function(){
      var r = await orig.apply(this, arguments);
      setTimeout(function(){
        var cardId = window._crmOrcCardId || window._snapCardId;
        if(cardId) popularSecaoModal(cardId);
        if(typeof window._refreshBadgesKanban === 'function') window._refreshBadgesKanban();
      }, 1500);
      return r;
    };
    window.crmOrcSalvar.__sub150Hooked = true;
    console.log('[150] hook crmOrcSalvar instalado');
  }

  /* ═══════════ B) BADGE NO CARD DO KANBAN ═══════════ */

  // Cache de orcamentos por cardId pra evitar fetch duplicado
  window._orcCountCache = window._orcCountCache || {};

  async function carregarTodosOrcCounts(){
    try {
      var r = await fetch(SB + '/rest/v1/crm_oportunidades?select=id,extras', { headers: H });
      if(!r.ok) return;
      var cards = await r.json();
      var cache = {};
      cards.forEach(function(c){
        var n = (c.extras && Array.isArray(c.extras.orcamentos)) ? c.extras.orcamentos.length : 0;
        if(n > 0) cache[c.id] = n;
      });
      window._orcCountCache = cache;
      return cache;
    } catch(e){ console.warn('[150 cache]', e); return {}; }
  }

  function aplicarBadgesKanban(){
    var cache = window._orcCountCache || {};
    // Cards do kanban: procurar elementos com data-id ou onclick contendo o card id
    var cards = document.querySelectorAll('[onclick*="crmOpenModal"]');
    cards.forEach(function(card){
      var oc = card.getAttribute('onclick') || '';
      var m = oc.match(/crmOpenModal\(['"]([^'"]+)['"]/);
      if(!m) return;
      var cardId = m[1];
      var n = cache[cardId] || 0;
      // Remover badge antigo
      var badge = card.querySelector('.orc-hist-badge');
      if(badge) badge.remove();
      if(n > 0){
        badge = document.createElement('div');
        badge.className = 'orc-hist-badge';
        badge.style.cssText = 'position:absolute;top:6px;right:6px;background:#0C447C;color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;z-index:5;font-family:inherit;box-shadow:0 2px 4px rgba(0,0,0,.2)';
        badge.textContent = '📚 ' + n;
        badge.title = n + ' orçamento(s) salvo(s)';
        // Garantir que parent tem position relative
        if(getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(badge);
      }
    });
  }

  window._refreshBadgesKanban = async function(){
    await carregarTodosOrcCounts();
    aplicarBadgesKanban();
  };

  // Hook em crmRender para atualizar badges
  function hookRender(){
    var orig = window.crmRender;
    if(!orig){ setTimeout(hookRender, 200); return; }
    if(orig.__sub150Hooked) return;
    window.crmRender = function(){
      var r = orig.apply(this, arguments);
      setTimeout(aplicarBadgesKanban, 50);
      setTimeout(aplicarBadgesKanban, 500);
      return r;
    };
    window.crmRender.__sub150Hooked = true;
    console.log('[150] hook crmRender instalado');
  }

  /* ═══════════ INIT ═══════════ */
  function init(){
    hookOpen();
    hookSalvar();
    hookRender();

    // Carregar cache + aplicar badges no boot
    setTimeout(function(){
      window._refreshBadgesKanban();
    }, 1500);

    // Refresh periódico (caso outro user salve em outra máquina)
    setInterval(function(){
      window._refreshBadgesKanban();
    }, 30000);

    console.log('[150-historico-modal] iniciado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
