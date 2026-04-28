/* ============================================================================
 * js/135-caixa-ctrl-sem-inst.js  —  Modulo NOVO (27-abr-2026)
 *
 * Autorizado por Felipe Xavier de Lima.
 *
 * RESOLVE 2 PROBLEMAS:
 *
 * 1) CAIXA DE MADEIRA (CRM Internacional FOB/CIF):
 *    - Substitui o polling de 700ms (js/96) por 3 botoes manuais:
 *        🔄 Atualizar    — recalcula da Largura/Altura dos itens
 *        ✏️ Manual       — libera os 3 campos pra editar a mao
 *        🚫 Sem caixa    — zera tudo + suprime linha CAIXA na proposta
 *    - O polling do 96 e desabilitado por flag global window._caixaCtrlOverride
 *
 * 2) INSTALACAO 'SEM' aparecendo no Resultado da Porta + Proposta:
 *    - Quando inst-quem === 'SEM', forca:
 *        d-custo-inst, d-tab-inst, d-fat-inst → '—' (zerado visivel)
 *        m-tab-porta, m-fat-porta → reflete custoFab + porta apenas
 *        Linha de instalacao na proposta = oculta (single + multi-door)
 *    - Roda via MutationObserver no painel Resultado e hook em populateProposta
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta135Applied) return;
  window.__projetta135Applied = true;
  console.log('[135-caixa-ctrl-sem-inst] iniciando');

  // ─────────────────────────────────────────────────────────────────
  // FLAG GLOBAL: desativa polling do 96-cif-caixa-bloqueio
  // ─────────────────────────────────────────────────────────────────
  window._caixaCtrlOverride = true;
  // Estado local da caixa
  window._crmIntlSemCaixa = false; // true = "Sem caixa" foi clicado

  var IDS_CAIXA_DIM = ['crm-o-cif-caixa-a','crm-o-cif-caixa-l','crm-o-cif-caixa-e'];
  var ID_TAXA = 'crm-o-cif-caixa-taxa';
  var ID_FRETE_T = 'crm-o-cif-frete-terrestre';
  var ID_FRETE_M = 'crm-o-cif-frete-maritimo';
  var ID_BOX = 'crm-inst-cif-box';
  var ID_BTN_BAR = 'caixa-ctrl-btnbar';

  function $(id){ return document.getElementById(id); }
  function num(v){ var n=parseFloat(v); return isNaN(n)?0:n; }
  function roundUp50(v){ return Math.ceil(v/50)*50; }

  // ─────────────────────────────────────────────────────────────────
  // PARTE 1: CONTROLES DA CAIXA (botoes)
  // ─────────────────────────────────────────────────────────────────

  function getItensComMedida(){
    var items = window._crmItens || [];
    return items.filter(function(it){
      if(!it) return false;
      return num(it.largura) > 0 && num(it.altura) > 0;
    });
  }

  function calcAuto(){
    var itens = getItensComMedida();
    if(!itens.length) return null;
    var maxL = 0, maxA = 0;
    itens.forEach(function(i){
      var l = num(i.largura), a = num(i.altura);
      if(l > maxL) maxL = l;
      if(a > maxA) maxA = a;
    });
    return {
      a: roundUp50(maxL + 350),
      l: roundUp50(maxA + 250),
      e: itens.length === 1 ? 600 : 0
    };
  }

  function applyAuto(showAlert){
    var c = calcAuto();
    if(!c){
      if(showAlert) alert('Adicione largura e altura nos itens da porta primeiro.');
      return false;
    }
    window._crmIntlSemCaixa = false;
    var map = { 'crm-o-cif-caixa-a': c.a, 'crm-o-cif-caixa-l': c.l, 'crm-o-cif-caixa-e': c.e };
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = false;
      el.readOnly = true;
      el.value = String(map[id]);
      el.style.background = '#fffaf3';
      el.style.color = '#555';
      el.style.borderStyle = 'dashed';
      el.style.borderColor = '#ff9800';
      el.style.cursor = 'not-allowed';
      el.style.fontWeight = '';
      el.title = '🔓 Auto: '+(id.endsWith('-a')?'maior LARGURA + 350':id.endsWith('-l')?'maior ALTURA + 250':'600 (1 item) ou 0 (multi)')+', arred 50mm';
    });
    if(typeof window.crmCifRecalc === 'function'){ try{ window.crmCifRecalc(); }catch(e){} }
    updateBtnState('auto');
    return true;
  }

  function applyManual(){
    window._crmIntlSemCaixa = false;
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = false;
      el.readOnly = false;
      el.style.background = '#fff8ec';
      el.style.color = '#c47012';
      el.style.borderStyle = 'solid';
      el.style.borderColor = '#e67e22';
      el.style.cursor = 'text';
      el.style.fontWeight = '700';
      el.title = '✏️ Edicao manual';
    });
    var first = $(IDS_CAIXA_DIM[0]);
    if(first) try{ first.focus(); first.select(); }catch(e){}
    updateBtnState('manual');
  }

  function applySemCaixa(){
    window._crmIntlSemCaixa = true;
    IDS_CAIXA_DIM.forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.disabled = true;
      el.readOnly = true;
      el.value = '0';
      el.style.background = '#f5f5f5';
      el.style.color = '#999';
      el.style.borderStyle = 'dashed';
      el.style.borderColor = '#ccc';
      el.style.cursor = 'not-allowed';
      el.style.fontWeight = '';
      el.title = '🚫 Cliente nao quer caixa de madeira (linha suprimida na proposta)';
    });
    if(typeof window.crmCifRecalc === 'function'){ try{ window.crmCifRecalc(); }catch(e){} }
    updateBtnState('sem');
  }

  function updateBtnState(mode){
    var b1 = $('caixa-btn-auto'), b2 = $('caixa-btn-manual'), b3 = $('caixa-btn-sem');
    [b1,b2,b3].forEach(function(b){
      if(!b) return;
      b.style.fontWeight = '600';
      b.style.opacity = '0.65';
      b.style.boxShadow = 'none';
    });
    var active = mode==='auto'?b1: mode==='manual'?b2: mode==='sem'?b3: null;
    if(active){
      active.style.fontWeight = '800';
      active.style.opacity = '1';
      active.style.boxShadow = '0 2px 6px rgba(0,0,0,.18)';
    }
    var info = $('caixa-ctrl-mode-info');
    if(info){
      info.textContent = mode==='auto'? '🔄 Modo automatico (de Largura×Altura dos itens)'
                       : mode==='manual'? '✏️ Modo manual (campos editaveis)'
                       : mode==='sem'? '🚫 Sem caixa de madeira — linha suprimida na proposta'
                       : '';
      info.style.color = mode==='auto'?'#e65100': mode==='manual'?'#c47012': mode==='sem'?'#777':'#888';
    }
  }

  function injectButtonBar(){
    var box = $(ID_BOX);
    if(!box) return false;
    if($(ID_BTN_BAR)) return true; // ja injetado
    var titleEl = $('crm-cif-box-title');
    if(!titleEl) return false;
    var bar = document.createElement('div');
    bar.id = ID_BTN_BAR;
    bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px;align-items:center';
    bar.innerHTML =
      '<button type="button" id="caixa-btn-auto" '+
        'style="padding:5px 11px;border-radius:6px;border:1.5px solid #ff9800;background:#fff;color:#e65100;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit" '+
        'title="Recalcula automaticamente da Largura e Altura dos itens">🔄 Atualizar</button>'+
      '<button type="button" id="caixa-btn-manual" '+
        'style="padding:5px 11px;border-radius:6px;border:1.5px solid #e67e22;background:#fff;color:#c47012;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit" '+
        'title="Editar manualmente os 3 campos">✏️ Manual</button>'+
      '<button type="button" id="caixa-btn-sem" '+
        'style="padding:5px 11px;border-radius:6px;border:1.5px solid #999;background:#fff;color:#555;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit" '+
        'title="Cliente nao quer a caixa de madeira (sera suprimida da proposta)">🚫 Sem caixa</button>'+
      '<span id="caixa-ctrl-mode-info" style="font-size:9.5px;color:#888;margin-left:auto;font-style:italic"></span>';
    titleEl.parentNode.insertBefore(bar, titleEl.nextSibling);
    $('caixa-btn-auto').addEventListener('click', function(){ applyAuto(true); });
    $('caixa-btn-manual').addEventListener('click', applyManual);
    $('caixa-btn-sem').addEventListener('click', applySemCaixa);
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // PARTE 2: CORRIGIR INSTALACAO 'SEM' NO RESULTADO + PROPOSTA
  // ─────────────────────────────────────────────────────────────────

  function isInstQuemSEM(){
    var el = $('inst-quem');
    return !!(el && (el.value||'').toUpperCase() === 'SEM');
  }

  function fixResultadoPorta(){
    if(!isInstQuemSEM()) return;
    // Linhas do detalhamento
    [['d-custo-inst','—'],['d-tab-inst','—'],['d-fat-inst','—']].forEach(function(p){
      var el = $(p[0]);
      if(el && el.textContent !== p[1]) el.textContent = p[1];
    });
    // Custo m² inst (se houver)
    var rInst = $('r-inst');
    if(rInst && rInst.textContent !== 'R$ 0' && rInst.textContent !== '—') rInst.textContent = 'R$ 0';
  }

  function fixPropostaInst(){
    // Linha de instalacao internacional na proposta (single)
    var rowInst = $('prop-row-inst');
    if(rowInst && isInstQuemSEM()) rowInst.style.display = 'none';
    // Linha multi-door (se existir)
    var rowsMulti = document.querySelectorAll('[id^="prop-multi-row-inst"]');
    if(isInstQuemSEM()){
      Array.prototype.forEach.call(rowsMulti, function(r){ r.style.display='none'; });
    }
    // Linha CAIXA quando _crmIntlSemCaixa ativo
    if(window._crmIntlSemCaixa === true){
      var caixa1 = $('prop-row-caixa');
      if(caixa1) caixa1.style.display = 'none';
      var caixa2 = document.querySelectorAll('[id^="prop-multi-row-caixa"]');
      Array.prototype.forEach.call(caixa2, function(r){ r.style.display='none'; });
      // Bloco FOB/CIF antigo (se ainda existe)
      var fbcif = $('prop-fob-cif-block');
      if(fbcif){
        var rows = fbcif.querySelectorAll('[data-row="caixa"]');
        Array.prototype.forEach.call(rows, function(r){ r.style.display='none'; });
      }
    }
  }

  // Hook em populateProposta (apos render, aplica fix)
  function patchProposta(){
    if(typeof window.populateProposta !== 'function') return false;
    if(window.populateProposta.__semInstPatched) return true;
    var orig = window.populateProposta;
    window.populateProposta = function(){
      var r = orig.apply(this, arguments);
      try{ setTimeout(fixPropostaInst, 50); }catch(e){}
      return r;
    };
    window.populateProposta.__semInstPatched = true;
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────────

  function tick(){
    // Tenta injetar botoes (modal pode abrir/fechar)
    injectButtonBar();
    // Aplica fix no Resultado constantemente (calc() reescreve)
    fixResultadoPorta();
  }

  function init(){
    setInterval(tick, 600);
    setTimeout(tick, 200);
    // Patch da proposta com retry
    var tries = 0;
    var t = setInterval(function(){
      tries++;
      if(patchProposta() || tries >= 20) clearInterval(t);
    }, 400);
    // Listener no inst-quem (mais responsivo)
    var iq = $('inst-quem');
    if(iq && !iq.__sem135){
      iq.__sem135 = true;
      ['change','input'].forEach(function(ev){
        iq.addEventListener(ev, function(){ setTimeout(fixResultadoPorta, 50); });
      });
    }
    // Tambem reaplicar quando dropdown CRM-modal mudar
    var cq = $('crm-o-inst-quem');
    if(cq && !cq.__sem135){
      cq.__sem135 = true;
      cq.addEventListener('change', function(){ setTimeout(fixResultadoPorta, 100); });
    }
    console.log('[135-caixa-ctrl-sem-inst] instalado');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
