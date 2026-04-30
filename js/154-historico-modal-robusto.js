/* ============================================================================
 * js/154-historico-modal-robusto.js  —  Historico SEMPRE visivel (28-abr-2026)
 *
 * Felipe 28/04: "quando reinicio sistema cards com valores ficam sem
 * historico, so aparece historico [de revisoes antigo]"
 *
 * CAUSA RAIZ:
 *   O cardId fica em _editId (var local do 10-crm.js) - nao exposto.
 *   window._crmOrcCardId so e setado quando vai pra aba Orcamento.
 *   Ao abrir modal direto pelo Kanban, _crmOrcCardId pode estar null
 *   ou stale, e a secao do 152 nao popula.
 *
 * SOLUCAO:
 *   1) Hook em crmOpenModal CAPTURA editId em arguments[1] e armazena
 *      em window._crmModalEditId
 *   2) Fallback robusto: AGP do form -> busca no banco -> cardId
 *   3) SEMPRE mostra secao "Historico de Orcamentos" no modal,
 *      mesmo que vazio (mensagem clara)
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
    t.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#0C447C')+';color:#fff;padding:12px 18px;border-radius:8px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:Montserrat,Arial,sans-serif;max-width:400px';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, ms || 3500);
  }

  /* ═══════════ Captura do cardId ═══════════ */

  function hookCrmOpenModal(){
    var orig = window.crmOpenModal;
    if(!orig){ setTimeout(hookCrmOpenModal, 200); return; }
    if(orig.__sub154Hooked) return;
    window.crmOpenModal = function(defaultStage, editId){
      // Capturar editId ANTES de executar a função original
      window._crmModalEditId = editId || null;
      window._crmModalOpenedAt = Date.now();
      console.log('[154] modal abrindo, editId =', editId);
      return orig.apply(this, arguments);
    };
    window.crmOpenModal.__sub154Hooked = true;
    console.log('[154] hook crmOpenModal capturando editId');
  }

  // Fallback: tentar várias formas de descobrir cardId
  async function descobrirCardId(){
    // 1) Direto do hook
    if(window._crmModalEditId) return window._crmModalEditId;

    // 2) window._crmOrcCardId (legado)
    if(window._crmOrcCardId) return window._crmOrcCardId;

    // 3) Buscar por AGP no banco
    var agp = val('crm-o-agp');
    if(agp){
      try {
        var r = await fetch(SB + '/rest/v1/crm_oportunidades?agp=eq.' + encodeURIComponent(agp) + '&select=id&deleted_at=is.null', { headers: H });
        if(r.ok){
          var arr = await r.json();
          if(arr.length === 1){
            console.log('[154] cardId via AGP=' + agp + ':', arr[0].id);
            return arr[0].id;
          }
        }
      } catch(e){ console.warn('[154 fetch AGP]', e); }
    }

    // 4) Buscar por cliente + reserva
    var cli = val('crm-o-cliente');
    var res = val('crm-o-reserva');
    if(cli && res){
      try {
        var r2 = await fetch(SB + '/rest/v1/crm_oportunidades?cliente=eq.' + encodeURIComponent(cli) + '&reserva=eq.' + encodeURIComponent(res) + '&select=id&deleted_at=is.null', { headers: H });
        if(r2.ok){
          var arr2 = await r2.json();
          if(arr2.length >= 1){
            console.log('[154] cardId via cli+reserva:', arr2[0].id);
            return arr2[0].id;
          }
        }
      } catch(e){ console.warn('[154 fetch cli]', e); }
    }

    return null;
  }

  /* ═══════════ Buscar dados do card ═══════════ */

  async function lerCard(cardId){
    var r = await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId) + '&select=extras,cliente,agp,valor,valor_tabela,valor_faturamento', { headers: H });
    if(!r.ok) return null;
    var arr = await r.json();
    return arr[0];
  }

  /* ═══════════ Renderizar secao no modal ═══════════ */

  function buildSecao(){
    var section = document.createElement('div');
    section.id = 'crm-orc-historico-v3';
    section.style.cssText = 'margin:14px 0;padding:14px;background:linear-gradient(135deg,#f0f7ff,#fff);border:2px solid #0C447C;border-radius:10px;font-family:Montserrat,Arial,sans-serif';
    section.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px">' +
        '<div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#0C447C">' +
          '📚 Histórico de Orçamentos <span id="orc-h3-count" style="background:#0C447C;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px;margin-left:6px">0</span>' +
        '</div>' +
        '<button type="button" id="orc-h3-refresh" style="padding:4px 10px;border-radius:5px;border:1px solid #0C447C;background:#fff;color:#0C447C;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">↻ Atualizar</button>' +
      '</div>' +
      '<div id="orc-h3-list"></div>';
    return section;
  }

  async function popularSecao(modalEl){
    // Inserir/garantir seção existe
    var existing = modalEl.querySelector('#crm-orc-historico-v3');
    if(existing) existing.remove();
    // Tambem remover versoes antigas (v1 e v2 do 150/152) pra nao duplicar
    modalEl.querySelectorAll('#crm-orc-historico-section, #crm-orc-historico-section-v2').forEach(function(el){ el.remove(); });

    var footer = modalEl.querySelector('.crm-modal-footer');
    if(!footer){ console.warn('[154] sem footer no modal'); return; }

    var section = buildSecao();
    footer.parentNode.insertBefore(section, footer);

    var listEl = section.querySelector('#orc-h3-list');
    var countEl = section.querySelector('#orc-h3-count');

    // Botão refresh
    var refreshBtn = section.querySelector('#orc-h3-refresh');
    if(refreshBtn){
      refreshBtn.onclick = function(e){
        e.preventDefault();
        popularSecao(modalEl);
      };
    }

    // Estado inicial: carregando
    listEl.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:#888">⏳ Carregando histórico...</div>';

    // Descobrir cardId
    var cardId = await descobrirCardId();
    if(!cardId){
      listEl.innerHTML = '<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;color:#856404;font-size:12px">' +
        '<b>⚠ Card não identificado.</b><br>' +
        '<span style="font-size:11px">Salve o card primeiro (botão verde "💾 Salvar Alterações" abaixo) para começar a ter histórico de orçamentos versionados.</span>' +
      '</div>';
      countEl.textContent = '?';
      return;
    }

    // Buscar dados
    try {
      var card = await lerCard(cardId);
      if(!card){
        listEl.innerHTML = '<div style="color:#c0392b;font-size:11px;padding:10px">Card não encontrado no banco.</div>';
        return;
      }

      var orcs = (card.extras && Array.isArray(card.extras.orcamentos)) ? card.extras.orcamentos : [];
      countEl.textContent = orcs.length;

      if(orcs.length === 0){
        var temValor = (card.valor_faturamento > 0 || card.valor_tabela > 0 || card.valor > 0);
        listEl.innerHTML = '<div style="background:#fff;border:1px solid #d4e0ed;border-radius:8px;padding:14px;text-align:center">' +
          '<div style="font-size:13px;color:#0C447C;font-weight:700;margin-bottom:6px">Nenhum orçamento versionado ainda</div>' +
          (temValor ?
            '<div style="font-size:11px;color:#e67e22;margin-bottom:8px">⚠ Este card tem valor (Tab: R$ ' + (card.valor_tabela||0).toFixed(2).replace('.',',') + ' · Fat: R$ ' + (card.valor_faturamento||0).toFixed(2).replace('.',',') + ') mas sem snapshot salvo.</div>' :
            '') +
          '<div style="font-size:11px;color:#666">Para versionar:</div>' +
          '<div style="font-size:11px;color:#666;margin-top:4px">1. Click em <b style="color:#e67e22">📐 Fazer Orçamento</b></div>' +
          '<div style="font-size:11px;color:#666">2. Faça os cálculos</div>' +
          '<div style="font-size:11px;color:#666">3. Click em <b style="color:#0C447C">💾 Salvar no card</b> (header roxo)</div>' +
        '</div>';
        return;
      }

      // Renderizar lista
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
      console.error('[154]', e);
      listEl.innerHTML = '<div style="color:#c0392b;font-size:11px;padding:10px">Erro: ' + esc(e.message) + '</div>';
    }
  }

  /* ═══════════ Acoes ═══════════ */

  window.crmOrcCarregarV3 = async function(orcId){
    if(typeof window.crmOrcCarregar === 'function'){
      // Setar cardId antes de carregar
      window._crmOrcCardId = window._crmModalEditId || window._crmOrcCardId;
      await window.crmOrcCarregar(orcId);
      if(typeof window.crmCloseModal === 'function') try { window.crmCloseModal(); } catch(e){}
      if(typeof window.switchTab === 'function') try { window.switchTab('orcamento'); } catch(e){}
      toast('📂 <b>Orçamento carregado</b>', '#27ae60', 3500);
    } else toast('❌ Função carregar indisponível', '#c0392b');
  };

  window.crmOrcExcluirV3 = async function(orcId){
    if(!confirm('Excluir este orçamento do histórico?\n\nNão pode ser desfeito.')) return;
    var cardId = await descobrirCardId();
    if(!cardId){ toast('⚠ Sem cardId', '#c0392b'); return; }
    try {
      var card = await lerCard(cardId);
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
      await fetch(SB + '/rest/v1/crm_oportunidades?id=eq.' + encodeURIComponent(cardId), {
        method: 'PATCH',
        headers: Object.assign({}, H, { 'Content-Type':'application/json', Prefer:'return=minimal' }),
        body: JSON.stringify(body)
      });
      toast('🗑 Excluído · Restam ' + orcs.length, '#7f8c8d', 3000);
      var modal = document.querySelector('.crm-modal-bg.open');
      if(modal) await popularSecao(modal);
      if(typeof window._refreshBadgesKanban === 'function') window._refreshBadgesKanban();
    } catch(e){ toast('❌ '+e.message, '#c0392b'); }
  };

  /* ═══════════ MutationObserver ═══════════ */

  function instalarObserver(){
    var observer = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        if(m.type === 'attributes' && m.attributeName === 'class'){
          var el = m.target;
          if(el.classList && el.classList.contains('crm-modal-bg') && el.classList.contains('open')){
            // Verificar se é o modal "Editar Oportunidade" (tem footer + del-btn)
            if(el.querySelector('.crm-modal-footer') && el.querySelector('#crm-del-btn')){
              setTimeout(function(){ popularSecao(el); }, 600);
            }
          }
        }
      });
    });
    document.querySelectorAll('.crm-modal-bg').forEach(function(el){
      observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    var bodyObs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.classList && n.classList.contains('crm-modal-bg')){
            observer.observe(n, { attributes: true, attributeFilter: ['class'] });
          }
        });
      });
    });
    bodyObs.observe(document.body, { childList: true, subtree: false });
    console.log('[154] observer instalado');
  }

  /* ═══════════ Hook salvar para refresh ═══════════ */
  function hookSalvar(){
    var orig = window.crmOrcSalvar;
    if(!orig){ setTimeout(hookSalvar, 200); return; }
    if(orig.__sub154Hooked) return;
    window.crmOrcSalvar = async function(){
      var r = await orig.apply(this, arguments);
      // Se modal aberto, repopular
      setTimeout(function(){
        var modal = document.querySelector('.crm-modal-bg.open');
        if(modal && modal.querySelector('#crm-del-btn')){
          popularSecao(modal);
        }
        if(typeof window._refreshBadgesKanban === 'function') window._refreshBadgesKanban();
      }, 1500);
      return r;
    };
    window.crmOrcSalvar.__sub154Hooked = true;
    console.log('[154] hook crmOrcSalvar instalado');
  }

  /* ═══════════ INIT ═══════════ */
  function init(){
    hookCrmOpenModal();
    hookSalvar();
    setTimeout(instalarObserver, 800);
    console.log('[154-historico-modal-robusto] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
