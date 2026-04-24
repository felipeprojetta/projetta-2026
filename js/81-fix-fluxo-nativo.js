/**
 * 81-fix-fluxo-nativo.js v25 — remove CSS custom + fix valores camelCase
 * Definição Felipe 24/04 (12a sessão)
 *
 * Tabelas:
 *   pre_orcamentos        — rascunho editável (upsert por chave)
 *   versoes_aprovadas     — versões congeladas imutáveis
 *
 * Botões:
 *   💾 Salvar Pré-Orçamento  → upsert em pre_orcamentos (sobrescreve sempre)
 *   📋 Pré-Orçamentos Salvos → modal com rascunhos + histórico versões
 *   🏆 Aprovar para Envio    → INSERT em versoes_aprovadas + downloads
 *
 * Ao abrir um pré-orçamento:
 *   - TUDO entra em MODO VISUALIZAÇÃO (read-only) — nada pode ser editado
 *   - Valores voltam FIÉIS (nenhum recálculo automático)
 *   - Layout das chapas é redesenhado (planUpd) — só visual, não afeta preços
 *   - Barra no topo com [✏️ Editar] — libera edição
 *   - Após editar, aparece [🔄 Recalcular] + [💾 Salvar] pra sobrescrever
 *
 * Fix v7:
 *   - Reordenado: paineis_html ANTES de inputs_raw (HTML recria inputs;
 *     o value precisa ser aplicado DEPOIS do innerHTML substituir a aba)
 *   - Componentes aparecem fiéis na 1ª abertura (não mais zerados)
 *   - Desenho das chapas redesenhado ao abrir (planUpd com setTimeout)
 *   - Modo read-only: disabled em inputs/selects/textareas + overlay clique
 *   - Função ativarEdicaoSnapshot libera edição e troca botões da barra
 *
 * Downloads (após Aprovar):
 *   - 1 PDF (Proposta) via html2pdf
 *   - 3 PNG (MC, MR, RC) via html2canvas + <a download>
 *   - Sem diálogo de impressão
 */
(function(){
  'use strict';

  var SUPA = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';

  function _hdrs(){ return { apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json' }; }
  function _v(id){ var el=document.getElementById(id); return el ? el.value : ''; }
  function _t(id){ var el=document.getElementById(id); return el ? (el.textContent||el.innerText||'').trim() : ''; }
  function _setVal(id, val){
    if(val === undefined || val === null || val === '') return;
    var el = document.getElementById(id);
    if(el){
      el.value = val;
      try { el.dispatchEvent(new Event('input',{bubbles:true})); } catch(e){}
      try { el.dispatchEvent(new Event('change',{bubbles:true})); } catch(e){}
    }
  }
  function _fmtData(iso){
    try { var d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); } catch(e){ return iso||'—'; }
  }
  function _parseMoeda(txt){
    if(!txt) return null;
    var s = String(txt).replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.');
    var n = parseFloat(s); return isNaN(n) ? null : n;
  }
  function _toast(msg, cor, ms){
    var t = document.getElementById('fluxo-toast'); if(t) t.remove();
    t = document.createElement('div'); t.id='fluxo-toast';
    t.style.cssText='position:fixed;top:80px;right:20px;background:'+cor+';color:#fff;padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);font-family:inherit;max-width:480px;line-height:1.45';
    t.innerHTML = msg; document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4500);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHAVE DE IDENTIFICAÇÃO — cliente + agp (ou só cliente)
  // ═══════════════════════════════════════════════════════════════════
  function _gerarChave(){
    // v15: se houver snapshot carregado, usar a chave FIEL (nao recalcular).
    // Assim reabrir via lista nao muda a chave -> aprovacoes viram versoes
    // sequenciais da mesma chave, nao V1 duplicadas.
    if(window._snapKey) return window._snapKey;

    var cliente = (_v('cliente') || _v('crm-o-cliente') || '').trim().toUpperCase();
    var agp     = (_v('agp') || _v('num-agp') || '').trim().toUpperCase();
    var cardId  = window._crmOrcCardId || window._snapCardId || '';
    if(cardId) return 'card_' + cardId;
    if(agp && cliente) return 'agp_' + agp + '__' + cliente.replace(/\s+/g,'_');
    if(cliente) return 'cli_' + cliente.replace(/\s+/g,'_');
    return '';
  }

  // ═══════════════════════════════════════════════════════════════════
  // CAPTURA DE SNAPSHOT — tudo que tá na tela
  // ═══════════════════════════════════════════════════════════════════
  function _capturarSnapshot(){
    return {
      dados_cliente: {
        nome:     _v('cliente') || _v('crm-o-cliente'),
        contato:  _v('contato') || _v('crm-o-contato'),
        telefone: _v('telefone'),
        email:    _v('email') || _v('crm-o-email'),
        cep:      _v('cep-cliente') || _v('cep') || _v('crm-o-cep'),
        cidade:   _t('cep-cidade') || _v('cidade') || _v('crm-o-cidade-nac'),
        estado:   _v('estado') || _v('crm-o-estado'),
        pais:     _v('pais'),
        endereco: _v('endereco')
      },
      dados_projeto: {
        produto:     _v('produto'),
        modelo:      _v('carac-modelo') || _v('modelo'),
        largura:     _v('largura'),
        altura:      _v('altura'),
        folhas:      _v('folhas-porta') || _v('folhas'),
        abertura:    _v('abertura') || _v('carac-abertura'),
        reserva:     _v('reserva') || _v('numprojeto'),
        agp:         _v('agp') || _v('num-agp'),
        origem:      _v('origem'),
        prioridade:  _v('prioridade'),
        potencial:   _v('potencial'),
        responsavel: _v('responsavel'),
        wrep:        _v('wrep'),
        notas:       _v('notas')
      },
      params_financeiros: {
        margem:        _v('lucro-alvo'),
        comissao_rep:  _v('com-rep'),
        comissao_rt:   _v('com-rt'),
        comissao_gest: _v('com-gest'),
        overhead:      _v('overhead'),
        impostos:      _v('impostos'),
        markup:        _v('markup-desc'),
        desconto:      _v('desconto')
      },
      itens: JSON.parse(JSON.stringify(window._orcItens || [])),
      resultado: {
        custo_porta:   _t('m-custo-porta'),
        preco_tabela:  _t('m-tab-porta') || _t('m-tab'),
        preco_fat:     _t('m-fat-porta') || _t('m-fat'),
        markup:        _t('m-mkp-porta')
      },
      // CAPTURA TOTAL DE INPUTS — todo elemento com ID
      inputs_raw: (function(){
        var map = {};
        var els = document.querySelectorAll('input, select, textarea');
        for(var i = 0; i < els.length; i++){
          var el = els[i];
          if(!el.id) continue;
          if(el.type === 'file' || el.type === 'button' || el.type === 'submit') continue;
          if(el.type === 'checkbox' || el.type === 'radio') map[el.id] = el.checked;
          else map[el.id] = el.value;
        }
        return map;
      })(),
      // CAPTURA HTML COMPLETO DE CADA ABA + painéis importantes
      paineis_html: (function(){
        var h = {};
        // Abas inteiras — ao mudar pra elas, precisa ter HTML fiel
        var abas = ['tab-orcamento','tab-proposta','tab-planificador','tab-os','tab-os-acess'];
        abas.forEach(function(id){
          var el = document.getElementById(id);
          if(el) h['__aba__'+id] = el.innerHTML;
        });
        // Painéis individuais (redundância — muitos estão DENTRO das abas acima, mas ter aqui ajuda)
        var ids = ['resumo-obra','fab-body','ins-body','plan-auto-info',
                   'fab-acm-resumo','fab-alu-resumo','fab-acm-tbody','fab-alu-tbody',
                   'acm-list','alu-list','mp-list','cep-info','atp-endereco',
                   'm-custo-porta','m-mkp-porta','m-tab-porta','m-fat-porta','m-tab','m-fat',
                   'd-custo-fab','d-custo-inst','d-tab-sp','d-fat-sp','d-tab-inst','d-fat-inst',
                   's-cm2','s-tm2','s-fm2','s-tm2p','s-fm2p',
                   'pct-mb-porta','pct-ml-porta'];
        ids.forEach(function(id){
          var el = document.getElementById(id);
          if(el) h[id] = el.innerHTML;
        });
        ['bar-mb-porta','bar-ml-porta'].forEach(function(id){
          var el = document.getElementById(id);
          if(el) h['_style_width_'+id] = el.style.width;
        });
        return h;
      })(),
      // VARIÁVEIS GLOBAIS relevantes
      globais: (function(){
        var g = {};
        try {
          if(window._calcResult) g._calcResult = JSON.parse(JSON.stringify(window._calcResult));
        } catch(e){}
        try {
          if(window._mpItens) g._mpItens = JSON.parse(JSON.stringify(window._mpItens));
        } catch(e){}
        try {
          if(window._osGeradoUmaVez !== undefined) g._osGeradoUmaVez = window._osGeradoUmaVez;
        } catch(e){}
        // PLANIFICADOR (v8): salvar resultado calculado pra redesenhar layout
        try {
          if(window.PLN_RES) g.PLN_RES = JSON.parse(JSON.stringify(window.PLN_RES));
        } catch(e){}
        try {
          if(window.PLN_SD) g.PLN_SD = JSON.parse(JSON.stringify(window.PLN_SD));
        } catch(e){}
        try {
          if(window.PLN_CSI !== undefined) g.PLN_CSI = window.PLN_CSI;
        } catch(e){}
        try {
          if(window._PLN_RES_BY_COLOR) g._PLN_RES_BY_COLOR = JSON.parse(JSON.stringify(window._PLN_RES_BY_COLOR));
        } catch(e){}
        return g;
      })(),
      // Preços snapshot — congelados naquele momento
      precos_snapshot: (function(){
        try {
          return {
            pf_kg_weiku:       _v('pf-kg-weiku'),
            pf_kg_mercado:     _v('pf-kg-mercado'),
            pf_kg_tecnoperfil: _v('pf-kg-tecnoperfil'),
            pf_ded_weiku:      _v('pf-ded-weiku'),
            pf_ded_mercado:    _v('pf-ded-mercado'),
            pf_ded_pintura:    _v('pf-ded-pintura'),
            pf_preco_pintura:  _v('pf-preco-pintura'),
            pf_barra_m:        _v('pf-barra-m')
          };
        } catch(e){ return {}; }
      })()
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // v12: DEFAULTS FINANCEIROS DA EMPRESA — capturados 1 vez no init
  // ═══════════════════════════════════════════════════════════════════
  var FIN_IDS = ['overhead','impostos','com-rep','com-rt','com-gest',
                 'lucro-alvo','markup-desc','desconto'];

  function _captureFinDefaults(){
    // Só captura 1x — depois da primeira vez, window._FIN_DEFAULTS é imutável
    if(window._FIN_DEFAULTS) return;
    var d = {}, hasAny = false;
    FIN_IDS.forEach(function(id){
      var el = document.getElementById(id);
      if(el && el.value !== '' && el.value !== undefined && el.value !== null){
        d[id] = el.value;
        hasAny = true;
      }
    });
    if(hasAny){
      window._FIN_DEFAULTS = d;
      console.log('%c[81 v12] defaults financeiros capturados', 'color:#1a5276', d);
    }
  }

  function _restoreFinDefaults(){
    if(!window._FIN_DEFAULTS) return false;
    Object.keys(window._FIN_DEFAULTS).forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      el.value = window._FIN_DEFAULTS[id];
      try { el.dispatchEvent(new Event('input',{bubbles:true})); } catch(e){}
      try { el.dispatchEvent(new Event('change',{bubbles:true})); } catch(e){}
    });
    return true;
  }

  // Tentar capturar em vários momentos (depende de quando o HTML finaliza)
  [1000, 2500, 5000].forEach(function(ms){
    setTimeout(_captureFinDefaults, ms);
  });

    // ═══════════════════════════════════════════════════════════════════
  // 1. 💾 SALVAR PRÉ-ORÇAMENTO — UPSERT no rascunho (sobrescreve sempre)
  // ═══════════════════════════════════════════════════════════════════
  window.salvarPreOrcamento = async function(){
    var chave = _gerarChave();
    if(!chave){
      _toast('⚠ <b>Preencha o cliente</b><br><span style="font-size:11px;font-weight:400">Precisa de cliente ou AGP pra gerar identificação.</span>', '#c0392b', 5000);
      return;
    }

    var snap = _capturarSnapshot();
    var qtdItens = snap.itens.length;
    if(qtdItens === 0){
      _toast('⚠ <b>Orçamento vazio</b><br>Adicione pelo menos 1 item.', '#c0392b', 4000);
      return;
    }

    try {
      // Primeiro buscar se já existe rascunho com essa chave
      var r = await fetch(SUPA+'/rest/v1/pre_orcamentos?chave=eq.'+encodeURIComponent(chave)+'&deleted_at=is.null', { headers: _hdrs() });
      var existentes = await r.json();
      var existente = existentes && existentes[0];

      var payload = {
        chave:              chave,
        card_id:            window._crmOrcCardId || null,
        cliente:            snap.dados_cliente.nome || '(sem cliente)',
        agp:                snap.dados_projeto.agp || null,
        num_referencia:     snap.dados_projeto.agp || null,
        reserva:            snap.dados_projeto.reserva || null,
        dados_cliente:      snap.dados_cliente,
        dados_projeto:      snap.dados_projeto,
        params_financeiros: snap.params_financeiros,
        itens:              snap.itens,
        resultado:          snap.resultado,
        precos_snapshot:    snap.precos_snapshot,
        inputs_raw:         snap.inputs_raw || {},
        paineis_html:       snap.paineis_html || {},
        globais:            snap.globais || {},
        updated_at:         new Date().toISOString(),
        created_by:         'felipe.projetta'
      };

      var res;
      if(existente){
        // UPDATE
        res = await fetch(SUPA+'/rest/v1/pre_orcamentos?id=eq.'+encodeURIComponent(existente.id), {
          method:'PATCH',
          headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
          body: JSON.stringify(payload)
        });
      } else {
        // INSERT
        payload.id = 'po_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
        res = await fetch(SUPA+'/rest/v1/pre_orcamentos', {
          method:'POST',
          headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
          body: JSON.stringify(payload)
        });
      }
      if(!res.ok){ var txt = await res.text(); throw new Error('HTTP '+res.status+': '+txt); }

      var acao = existente ? 'atualizado' : 'salvo';
      // v24: Auto-move + sync forcado APOS salvar pre-orcamento
      // Garante 3 coisas:
      //   1. Se stage=s3, move pra s3b (PATCH Supabase)
      //   2. Sempre sincroniza localStorage <- Supabase (mesmo sem PATCH)
      //   3. Sempre chama crmRender pra atualizar kanban visual
      // Assim o kanban do user sempre reflete o estado real do Supabase,
      // independente de ter havido PATCH nesse salvar ou ja estar movido.
      var _cidAtual = window._crmOrcCardId || window._snapCardId || payload.card_id || null;
      var _movidoStage = false;
      var _stageFinal = null;
      console.log('[auto-move v24] tentativa', {
        cardId: _cidAtual,
        fonte: window._crmOrcCardId ? '_crmOrcCardId'
             : window._snapCardId ? '_snapCardId'
             : payload.card_id ? 'payload.card_id'
             : 'nenhum'
      });
      if(_cidAtual){
        try {
          var _curStage = await _getCardStage(_cidAtual);
          console.log('[auto-move v24] stage atual do card no Supabase:', _curStage);
          _stageFinal = _curStage;
          if(_curStage === 's3'){
            // Fazer PATCH s3 -> s3b
            var _okMove = await _moverCardStage(_cidAtual, 's3b');
            console.log('[auto-move v24] PATCH s3->s3b:', _okMove);
            if(_okMove){
              _movidoStage = true;
              _stageFinal = 's3b';
            }
          } else {
            console.log('[auto-move v24] stage ('+_curStage+') ja esta em frente, nao precisa mover — mas vou sincronizar localStorage mesmo assim');
          }
          // v24 FIX CRITICO: sempre sincronizar localStorage com Supabase
          // (independente de ter PATCH ou nao). Resolve desync cronico.
          await _syncCardFromCloudParaLocal(_cidAtual);
          console.log('[auto-move v24] localStorage sincronizado com Supabase (stage='+_stageFinal+')');
          // Atualizar kanban visual
          try { if(typeof window.crmRender === 'function') window.crmRender(); } catch(e){}
        } catch(e){ console.warn('[auto-move v24] erro', e); }
      } else {
        console.warn('[auto-move v24] NAO move — rascunho nao tem card vinculado (abriu direto, sem passar pelo CRM)');
      }
      _toast('💾 <b>Pré-orçamento ' + acao + '!</b><br>' +
             '<span style="font-size:11px;font-weight:400">' + payload.cliente + (payload.agp ? ' · '+payload.agp : '') +
             ' · ' + qtdItens + ' item(ns)</span>' +
             (_movidoStage ? '<br><span style="font-size:10px;opacity:.85">📧 Card movido para <b>Orçamento Pronto</b></span>' : ''),
             '#1a5276', 4500);
      if(window._modoFielAtivo){
        setTimeout(function(){ try { window.fecharSnapshot(); } catch(e){} }, 800);
      }
    } catch(err){
      console.error('[salvarPreOrcamento]', err);
      _toast('❌ <b>Erro ao salvar</b><br><span style="font-size:11px;font-weight:400">'+err.message+'</span>', '#c0392b', 6000);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 2. 📋 PRÉ-ORÇAMENTOS SALVOS — modal com rascunhos + versões
  // ═══════════════════════════════════════════════════════════════════
  window.abrirModalPreOrcamentos = async function(){
    var old = document.getElementById('po-modal-bg'); if(old) old.remove();
    var bg = document.createElement('div');
    bg.id='po-modal-bg';
    bg.style.cssText='position:fixed;inset:0;background:rgba(0,20,35,.8);z-index:99990;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto;font-family:inherit;backdrop-filter:blur(3px)';
    var box = document.createElement('div');
    box.style.cssText='background:#fff;border-radius:14px;max-width:1100px;width:100%;max-height:calc(100vh - 80px);overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5)';
    box.innerHTML =
      '<div style="background:linear-gradient(135deg,#5b2c6f,#4a1f5a);color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center">' +
        '<div><div style="font-size:16px;font-weight:800;letter-spacing:.04em">📋 PRÉ-ORÇAMENTOS E VERSÕES</div>' +
        '<div id="po-modal-sub" style="font-size:11px;opacity:.85;margin-top:2px">Carregando...</div></div>' +
        '<button onclick="document.getElementById(\'po-modal-bg\').remove()" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✕ Fechar</button>' +
      '</div>' +
      '<div id="po-modal-body" style="padding:20px;overflow-y:auto;flex:1"><div style="text-align:center;padding:40px;color:#7a8794;font-size:13px">⏳ Buscando...</div></div>';
    bg.appendChild(box); document.body.appendChild(bg);
    bg.addEventListener('click', function(e){ if(e.target===bg) bg.remove(); });

    try {
      var r1 = await fetch(SUPA+'/rest/v1/pre_orcamentos?deleted_at=is.null&order=updated_at.desc', { headers: _hdrs() });
      var rascunhos = await r1.json();
      var r2 = await fetch(SUPA+'/rest/v1/versoes_aprovadas?order=aprovado_em.desc', { headers: _hdrs() });
      var versoes = await r2.json();
      _renderListaCombinada(rascunhos, versoes);
    } catch(err){
      document.getElementById('po-modal-body').innerHTML = '<div style="color:#c0392b;padding:20px;background:#fdf0f0;border-radius:8px">❌ Erro: ' + err.message + '</div>';
    }
  };

  function _renderListaCombinada(rascunhos, versoes){
    var body = document.getElementById('po-modal-body');
    var sub  = document.getElementById('po-modal-sub');
    if(!body || !sub) return;
    sub.textContent = (rascunhos||[]).length + ' rascunho(s) · ' + (versoes||[]).length + ' versão(ões) aprovada(s)';

    // Agrupar versões por chave
    var versoesPorChave = {};
    (versoes||[]).forEach(function(v){
      if(!versoesPorChave[v.chave]) versoesPorChave[v.chave] = [];
      versoesPorChave[v.chave].push(v);
    });

    if((!rascunhos || rascunhos.length===0) && (!versoes || versoes.length===0)){
      body.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#7a8794"><div style="font-size:48px;margin-bottom:12px">📭</div><div style="font-size:14px;font-weight:600">Nenhum pré-orçamento ainda</div><div style="font-size:11px;margin-top:6px">Preencha um orçamento e clique em <b>💾 Salvar Pré-Orçamento</b></div></div>';
      return;
    }

    var html = '';

    // ══ RASCUNHOS (editáveis) ══
    if(rascunhos && rascunhos.length > 0){
      html += '<div style="margin-bottom:20px">' +
        '<div style="font-size:13px;font-weight:800;color:#1a5276;margin-bottom:8px;letter-spacing:.04em">💾 RASCUNHOS EDITÁVEIS (' + rascunhos.length + ')</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead><tr style="background:#eaf2f7;border-bottom:2px solid #c4d8e3">' +
          '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">Cliente</th>' +
          '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">AGP</th>' +
          '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">Atualizado</th>' +
          '<th style="padding:10px;text-align:right;font-weight:700;color:#003144">Tabela</th>' +
          '<th style="padding:10px;text-align:right;font-weight:700;color:#003144">Faturamento</th>' +
          '<th style="padding:10px;text-align:center;font-weight:700;color:#003144">Itens</th>' +
          '<th style="padding:10px;text-align:center;font-weight:700;color:#003144">Versões</th>' +
          '<th style="padding:10px;text-align:center;font-weight:700;color:#003144">Ações</th>' +
        '</tr></thead><tbody>';
      rascunhos.forEach(function(po){
        var dp  = po.dados_projeto || {};
        var res = po.resultado || {};
        var qtd = Array.isArray(po.itens) ? po.itens.length : 0;
        var qtdV = (versoesPorChave[po.chave] || []).length;
        html += '<tr style="border-bottom:1px solid #eae7e1">' +
          '<td style="padding:10px;font-weight:600">' + (po.cliente||'—') + '</td>' +
          '<td style="padding:10px;font-size:11px;color:#5f5e5a">' + (po.agp || '—') + '</td>' +
          '<td style="padding:10px;font-size:11px;color:#5f5e5a">' + _fmtData(po.updated_at) + '</td>' +
          '<td style="padding:10px;text-align:right;font-weight:700;color:#003144">' + (res.preco_tabela || '—') + '</td>' +
          '<td style="padding:10px;text-align:right;font-weight:800;color:#e67e22">' + (res.preco_fat || '—') + '</td>' +
          '<td style="padding:10px;text-align:center;font-size:11px;color:#5f5e5a">' + qtd + '</td>' +
          '<td style="padding:10px;text-align:center;font-size:11px">' + (qtdV > 0 ? '<span style="background:#27ae60;color:#fff;padding:2px 7px;border-radius:10px;font-weight:700">' + qtdV + '</span>' : '—') + '</td>' +
          '<td style="padding:10px;text-align:center;white-space:nowrap">' +
            '<button onclick="carregarPreOrcamento(\''+ po.id +'\')" style="padding:6px 12px;border-radius:6px;border:none;background:#1a5276;color:#fff;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px">📂 Abrir</button>' +
            '<button onclick="excluirPreOrcamento(\''+ po.id +'\',this)" style="padding:6px 10px;border-radius:6px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer">🗑</button>' +
          '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    // ══ VERSÕES APROVADAS (imutáveis) ══
    if(versoes && versoes.length > 0){
      html += '<div>' +
        '<div style="font-size:13px;font-weight:800;color:#27ae60;margin-bottom:8px;letter-spacing:.04em">🏆 VERSÕES APROVADAS (' + versoes.length + ') — CONGELADAS</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
        '<thead><tr style="background:#eaf7ec;border-bottom:2px solid #a7dcb0">' +
          '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">Cliente</th>' +
          '<th style="padding:10px;text-align:center;font-weight:700;color:#003144">Versão</th>' +
          '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">AGP</th>' +
          '<th style="padding:10px;text-align:left;font-weight:700;color:#003144">Aprovado em</th>' +
          '<th style="padding:10px;text-align:right;font-weight:700;color:#003144">Tabela</th>' +
          '<th style="padding:10px;text-align:right;font-weight:700;color:#003144">Faturamento</th>' +
          '<th style="padding:10px;text-align:center;font-weight:700;color:#003144">Status</th>' +
          '<th style="padding:10px;text-align:center;font-weight:700;color:#003144">Ações</th>' +
        '</tr></thead><tbody>';
      versoes.forEach(function(v){
        html += '<tr style="border-bottom:1px solid #e0ece3' + (v.ativa ? ';background:rgba(39,174,96,.05)' : '') + '">' +
          '<td style="padding:10px;font-weight:600">' + v.cliente + '</td>' +
          '<td style="padding:10px;text-align:center;font-weight:800;color:#27ae60;font-size:13px">V' + v.versao + (v.ativa ? ' ⭐' : '') + '</td>' +
          '<td style="padding:10px;font-size:11px;color:#5f5e5a">' + (v.agp || '—') + '</td>' +
          '<td style="padding:10px;font-size:11px;color:#5f5e5a">' + _fmtData(v.aprovado_em) + '</td>' +
          '<td style="padding:10px;text-align:right;font-weight:700;color:#003144">R$ ' + (v.valor_tabela ? Number(v.valor_tabela).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—') + '</td>' +
          '<td style="padding:10px;text-align:right;font-weight:800;color:#e67e22">R$ ' + (v.valor_faturamento ? Number(v.valor_faturamento).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—') + '</td>' +
          '<td style="padding:10px;text-align:center">' +
            (v.ativa ? '<span style="background:#27ae60;color:#fff;padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700">ATIVA</span>' : '<button onclick="ativarVersao(\''+v.id+'\',\''+v.chave+'\')" style="padding:3px 8px;border-radius:10px;border:1px solid #27ae60;background:#fff;color:#27ae60;font-size:10px;font-weight:700;cursor:pointer">Ativar</button>') +
          '</td>' +
          '<td style="padding:10px;text-align:center;white-space:nowrap">' +
            '<button onclick="carregarVersao(\''+v.id+'\')" style="padding:6px 10px;border-radius:6px;border:none;background:#27ae60;color:#fff;font-size:11px;font-weight:700;cursor:pointer;margin-right:3px" title="Ver valores congelados desta versao">📂 Ver</button>' +
            '<button onclick="reimprimirVersao(\''+v.id+'\')" style="padding:6px 10px;border-radius:6px;border:none;background:#0C447C;color:#fff;font-size:11px;font-weight:700;cursor:pointer;margin-right:3px" title="Baixa PDF + PNGs novamente sem criar nova versao">🖨️ Reimprimir</button>' +
            '<button onclick="excluirVersao(\''+v.id+'\',\''+v.versao+'\',\''+(v.cliente||'').replace(/\'/g,"\\\'")+'\',this)" style="padding:6px 8px;border-radius:6px;border:1px solid #e74c3c;background:#fff;color:#e74c3c;font-size:11px;font-weight:700;cursor:pointer" title="Excluir versao">🗑</button>' +
          '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. 📂 CARREGAR RASCUNHO — volta fiel, sem recalcular
  // ═══════════════════════════════════════════════════════════════════
  window.carregarPreOrcamento = async function(id){
    try {
      var r = await fetch(SUPA+'/rest/v1/pre_orcamentos?id=eq.'+encodeURIComponent(id), { headers: _hdrs() });
      var arr = await r.json();
      if(!arr || !arr[0]) throw new Error('Pré-orçamento não encontrado');
      await _aplicarSnapshot(arr[0], false); // false = é rascunho, editável
      _mostrarBarraRecalcular(arr[0], false);
    } catch(err){
      console.error('[carregar]', err);
      alert('❌ Erro: ' + err.message);
    }
  };

  window.carregarVersao = async function(id){
    try {
      var r = await fetch(SUPA+'/rest/v1/versoes_aprovadas?id=eq.'+encodeURIComponent(id), { headers: _hdrs() });
      var arr = await r.json();
      if(!arr || !arr[0]) throw new Error('Versão não encontrada');
      await _aplicarSnapshot(arr[0], true); // true = versão congelada
      _mostrarBarraRecalcular(arr[0], true);
    } catch(err){
      console.error('[carregar-versao]', err);
      alert('❌ Erro: ' + err.message);
    }
  };

  async function _aplicarSnapshot(snap, isVersaoCongelada){
    var dc = snap.dados_cliente || {};
    var dp = snap.dados_projeto || {};
    var pf = snap.params_financeiros || {};
    var res = snap.resultado || {};

    // Fechar modais
    var poModal = document.getElementById('po-modal-bg'); if(poModal) poModal.remove();
    var crmModal = document.getElementById('crm-opp-modal'); if(crmModal) crmModal.style.display='none';

    // Desativar modo fiel anterior (se houver) enquanto restauramos
    window._modoFielAtivo = false;
    window._snapshotFielCarregado = null;
    _setReadOnlyGlobal(false);

    // Reset itens
    window._orcItens = [];
    try { if(typeof orcItensRender==='function') orcItensRender(); } catch(e){}

    try { if(typeof switchTab==='function') switchTab('orcamento'); } catch(e){}
    await new Promise(function(r){ setTimeout(r, 250); });

    // ═══════════════════════════════════════════════════════════════════
    // ORDEM CORRETA (v7):
    // 1º  Cliente/Projeto/Params via _setVal (com dispatchEvent pra disparos auxiliares)
    // 2º  _orcItens e globais
    // 3º  paineis_html — ISSO RECRIA OS INPUTS DA ABA (innerHTML)
    // 4º  inputs_raw — ISSO REAPLICA OS VALUES DEPOIS DO innerHTML
    // 5º  Displays de resultado (spans)
    // 6º  orcItensRender + planUpd (redesenha layout das chapas)
    // 7º  Ativar modo fiel + read-only + hook switchTab
    // ═══════════════════════════════════════════════════════════════════

    // 1º — Cliente
    _setVal('cliente', dc.nome); _setVal('crm-o-cliente', dc.nome);
    _setVal('contato', dc.contato); _setVal('crm-o-contato', dc.contato);
    _setVal('telefone', dc.telefone);
    _setVal('email', dc.email); _setVal('crm-o-email', dc.email);
    _setVal('cep-cliente', dc.cep); _setVal('cep', dc.cep); _setVal('crm-o-cep', dc.cep);
    _setVal('cidade', dc.cidade); _setVal('crm-o-cidade-nac', dc.cidade);
    var cepCidEl = document.getElementById('cep-cidade');
    if(cepCidEl && dc.cidade) cepCidEl.textContent = dc.cidade + (dc.estado ? ' - '+dc.estado : '');
    _setVal('estado', dc.estado); _setVal('crm-o-estado', dc.estado);
    _setVal('pais', dc.pais);
    _setVal('endereco', dc.endereco);
    // Projeto
    _setVal('produto', dp.produto);
    _setVal('carac-modelo', dp.modelo); _setVal('modelo', dp.modelo);
    _setVal('largura', dp.largura);
    _setVal('altura', dp.altura);
    _setVal('folhas-porta', dp.folhas); _setVal('folhas', dp.folhas);
    _setVal('abertura', dp.abertura); _setVal('carac-abertura', dp.abertura);
    _setVal('reserva', dp.reserva); _setVal('numprojeto', dp.reserva);
    _setVal('agp', dp.agp); _setVal('num-agp', dp.agp);
    _setVal('origem', dp.origem);
    _setVal('prioridade', dp.prioridade);
    _setVal('potencial', dp.potencial);
    _setVal('responsavel', dp.responsavel);
    _setVal('wrep', dp.wrep);
    _setVal('notas', dp.notas);
    // Params
    _setVal('lucro-alvo', pf.margem);
    _setVal('com-rep', pf.comissao_rep);
    _setVal('com-rt', pf.comissao_rt);
    _setVal('com-gest', pf.comissao_gest);
    _setVal('overhead', pf.overhead);
    _setVal('impostos', pf.impostos);
    _setVal('markup-desc', pf.markup);
    _setVal('desconto', pf.desconto);

    // 2º — Itens + Globais
    window._orcItens = JSON.parse(JSON.stringify(snap.itens || []));
    if(snap.globais){
      try {
        if(snap.globais._calcResult) window._calcResult = JSON.parse(JSON.stringify(snap.globais._calcResult));
        if(snap.globais._mpItens) window._mpItens = JSON.parse(JSON.stringify(snap.globais._mpItens));
        if(snap.globais._osGeradoUmaVez !== undefined) window._osGeradoUmaVez = snap.globais._osGeradoUmaVez;
        // PLANIFICADOR (v8)
        if(snap.globais.PLN_RES) window.PLN_RES = JSON.parse(JSON.stringify(snap.globais.PLN_RES));
        if(snap.globais.PLN_SD)  window.PLN_SD  = JSON.parse(JSON.stringify(snap.globais.PLN_SD));
        if(snap.globais.PLN_CSI !== undefined) window.PLN_CSI = snap.globais.PLN_CSI;
        if(snap.globais._PLN_RES_BY_COLOR) window._PLN_RES_BY_COLOR = JSON.parse(JSON.stringify(snap.globais._PLN_RES_BY_COLOR));
      } catch(e){ console.warn('[snap globais]', e); }
    }

    // 3º — RESTAURAR innerHTML de ABAS INTEIRAS E PAINÉIS (recria inputs com values antigos do HTML)
    if(snap.paineis_html){
      Object.keys(snap.paineis_html).forEach(function(k){
        if(k.indexOf('__aba__') === 0){
          var tabId = k.replace('__aba__','');
          var tab = document.getElementById(tabId);
          if(tab) tab.innerHTML = snap.paineis_html[k];
        }
      });
      Object.keys(snap.paineis_html).forEach(function(k){
        if(k.indexOf('__aba__') === 0) return;
        if(k.indexOf('_style_width_') === 0){
          var id = k.replace('_style_width_','');
          var el = document.getElementById(id);
          if(el) el.style.width = snap.paineis_html[k];
          return;
        }
        var el = document.getElementById(k);
        if(el) el.innerHTML = snap.paineis_html[k];
      });
    }

    // 4º — REAPLICAR inputs_raw DEPOIS do innerHTML (senão os values se perdem)
    //      Essa é a correção-chave do v7: antes ficava zerado até trocar de aba
    if(snap.inputs_raw){
      Object.keys(snap.inputs_raw).forEach(function(id){
        var el = document.getElementById(id);
        if(!el) return;
        var v = snap.inputs_raw[id];
        if(el.type === 'checkbox' || el.type === 'radio'){
          el.checked = !!v;
        } else {
          if(v !== null && v !== undefined) el.value = v;
        }
      });
    }

    // 5º — Displays de resultado (spans de preço/markup)
    var setDisplay = function(id, val){ var el = document.getElementById(id); if(el && val) el.textContent = val; };
    setDisplay('m-custo-porta', res.custo_porta);
    setDisplay('m-tab-porta',   res.preco_tabela);
    setDisplay('m-tab',         res.preco_tabela);
    setDisplay('m-fat-porta',   res.preco_fat);
    setDisplay('m-fat',         res.preco_fat);
    setDisplay('m-mkp-porta',   res.markup);

    // 6º — Re-render itens + re-desenho do planificador (layout das chapas)
    try { if(typeof orcItensRender==='function') orcItensRender(); } catch(e){}

    // Redesenho do planificador (v8 — só visual, não mexe em preço do orçamento)
    // Se temos PLN_RES no snapshot, usa direto (desenha sem recalcular layout).
    // Caso contrário, chama planUpd() pra recalcular do zero.
    // v11: capturar PLN_RES do snapshot numa closure pra resistir a sobrescritas
    // Debounces do _autoSelectAndRun (disparados por dispatchEvent input nos
    // _setVal) podem sobrescrever window.PLN_RES antes do último redraw.
    var _snapPlnRes = snap.globais && snap.globais.PLN_RES ? JSON.parse(JSON.stringify(snap.globais.PLN_RES)) : null;
    var _snapPlnSd  = snap.globais && snap.globais.PLN_SD  ? JSON.parse(JSON.stringify(snap.globais.PLN_SD))  : null;
    var _snapPlnCsi = (snap.globais && snap.globais.PLN_CSI !== undefined) ? snap.globais.PLN_CSI : 0;
    var _snapPlnByColor = snap.globais && snap.globais._PLN_RES_BY_COLOR ? JSON.parse(JSON.stringify(snap.globais._PLN_RES_BY_COLOR)) : null;
    window._snapFielPlan = { PLN_RES: _snapPlnRes, PLN_SD: _snapPlnSd, PLN_CSI: _snapPlnCsi, _BY_COLOR: _snapPlnByColor };

    var _plnRedraw = function(){
      try {
        if(_snapPlnRes && _snapPlnRes.placed && _snapPlnRes.placed.length > 0 &&
           typeof plnBuildTabs === 'function' && typeof plnDraw === 'function'){
          // Rota fiel (v11): forçar PLN_RES do snapshot ANTES de cada render.
          // Vence debounces que possam ter sobrescrito no meio do caminho.
          window.PLN_RES = JSON.parse(JSON.stringify(_snapPlnRes));
          if(_snapPlnSd) window.PLN_SD = JSON.parse(JSON.stringify(_snapPlnSd));
          window.PLN_CSI = _snapPlnCsi;
          if(_snapPlnByColor) window._PLN_RES_BY_COLOR = JSON.parse(JSON.stringify(_snapPlnByColor));
          try { plnBuildTabs(); } catch(e){}
          try { if(typeof _plnRenderColorTabs === 'function') _plnRenderColorTabs(); } catch(e){}
          try { if(typeof _plnRenderCoresPainel === 'function') _plnRenderCoresPainel(); } catch(e){}
          try { plnDraw(_snapPlnCsi); } catch(e){}
        } else {
          // Fallback: snapshots antigos sem PLN_RES
          try { if(typeof planUpd === 'function') planUpd(); } catch(e){}
          try { if(typeof _autoSelectAndRun === 'function') _autoSelectAndRun(); } catch(e){}
        }
      } catch(e){ /* silenciar */ }
    };
    // Delays cobrindo antes/durante/depois do debounce de 800ms
    [300, 900, 1500, 3000].forEach(function(ms){ setTimeout(_plnRedraw, ms); });

    // 7º — Ativar MODO FIEL + snapshot ref
    window._modoFielAtivo = true;
    window._snapshotFielCarregado = snap;

    // Hook no switchTab (só instala 1x) — restaura HTML ao trocar abas no modo fiel
    if(!window.switchTab._fielHookInstalled){
      var origSwitchTab = window.switchTab;
      window.switchTab = function(tabName){
        var res = origSwitchTab.apply(this, arguments);
        if(window._modoFielAtivo && window._snapshotFielCarregado){
          var s = window._snapshotFielCarregado;
          var tabId = 'tab-' + tabName;
          var html = s.paineis_html && s.paineis_html['__aba__'+tabId];
          if(html){
            [50, 300, 800, 1500].forEach(function(ms){
              setTimeout(function(){
                if(!window._modoFielAtivo) return;
                var el = document.getElementById(tabId);
                if(el) el.innerHTML = html;
                // Reaplica inputs_raw (innerHTML resetou)
                if(s.inputs_raw){
                  Object.keys(s.inputs_raw).forEach(function(id){
                    var ipt = document.getElementById(id);
                    if(!ipt) return;
                    var v = s.inputs_raw[id];
                    if(ipt.type === 'checkbox' || ipt.type === 'radio') ipt.checked = !!v;
                    else if(v !== null && v !== undefined) ipt.value = v;
                  });
                }
                // Re-aplicar read-only (se ainda ativo)
                if(window._modoLeituraAtivo) _setReadOnlyGlobal(true);
                // Re-desenhar planificador se caiu nessa aba (v11)
                // Usa a ref do snapshot guardada em window._snapFielPlan pra
                // resistir a sobrescritas de debounce.
                if(tabName === 'planificador'){
                  try {
                    var sfp = window._snapFielPlan;
                    if(sfp && sfp.PLN_RES && sfp.PLN_RES.placed && sfp.PLN_RES.placed.length > 0 &&
                       typeof plnBuildTabs === 'function' && typeof plnDraw === 'function'){
                      window.PLN_RES = JSON.parse(JSON.stringify(sfp.PLN_RES));
                      if(sfp.PLN_SD) window.PLN_SD = JSON.parse(JSON.stringify(sfp.PLN_SD));
                      window.PLN_CSI = sfp.PLN_CSI || 0;
                      if(sfp._BY_COLOR) window._PLN_RES_BY_COLOR = JSON.parse(JSON.stringify(sfp._BY_COLOR));
                      plnBuildTabs();
                      try { if(typeof _plnRenderColorTabs === 'function') _plnRenderColorTabs(); } catch(e){}
                      try { if(typeof _plnRenderCoresPainel === 'function') _plnRenderCoresPainel(); } catch(e){}
                      plnDraw(sfp.PLN_CSI || 0);
                    } else {
                      // Snapshot antigo: _autoSelectAndRun() gera o layout
                      try { if(typeof planUpd === 'function') planUpd(); } catch(e){}
                      try { if(typeof _autoSelectAndRun === 'function') _autoSelectAndRun(); } catch(e){}
                    }
                  } catch(e){}
                }
              }, ms);
            });
          }
        }
        return res;
      };
      window.switchTab._fielHookInstalled = true;
    }

    // Vincular card só se for rascunho
    if(!isVersaoCongelada && snap.card_id){
      window._crmOrcCardId = snap.card_id;
    } else {
      window._crmOrcCardId = null;
    }

    // Flag: orçamento carregado
    window._snapshotCarregado = {
      id: snap.id,
      chave: snap.chave,
      versao: snap.versao,
      isVersao: isVersaoCongelada
    };
    // v15: guardar chave fiel e card_id pra garantir que Aprovar use os
    // valores corretos mesmo quando _crmOrcCardId nao esta setado
    window._snapKey = snap.chave || null;
    window._snapCardId = snap.card_id || null;

    // 8º — ATIVAR MODO LEITURA (read-only) em todos os inputs das abas operacionais
    //      Usuário precisa clicar "✏️ Editar" pra habilitar edição
    _setReadOnlyGlobal(true);

    _toast('👁️ <b>' + (isVersaoCongelada ? 'Versão ' + snap.versao + ' carregada (CONGELADA)' : 'Rascunho carregado') + '</b><br>' +
           '<span style="font-size:11px;font-weight:400">' + (snap.cliente||'') + ' · ' + (dp.agp||'') + ' · ' + (snap.itens||[]).length + ' item(ns)</span><br>' +
           '<span style="font-size:10px;opacity:.85">Modo VISUALIZAÇÃO — clique <b>✏️ Editar</b> no topo pra modificar.</span>',
           isVersaoCongelada ? '#27ae60' : '#1a5276', 7000);
  }

  // ═══════════════════════════════════════════════════════════════════
  // READ-ONLY GLOBAL — desabilita/habilita todos inputs das abas operacionais
  // ═══════════════════════════════════════════════════════════════════
  function _setReadOnlyGlobal(on){
    window._modoLeituraAtivo = !!on;
    var TABS = ['tab-orcamento','tab-proposta','tab-planificador','tab-os','tab-os-acess','tab-levantamento-perfis','tab-levantamento-acess'];
    // v8: NÃO trava buttons (botões de navegação/zerar/salvar precisam funcionar sempre)
    //     Trava só inputs/selects/textareas pra impedir edição de dados do snapshot.
    TABS.forEach(function(tabId){
      var tab = document.getElementById(tabId);
      if(!tab) return;
      if(on){
        tab.setAttribute('data-readonly-snapshot','1');
        var els = tab.querySelectorAll('input, select, textarea');
        for(var i=0; i<els.length; i++){
          var el = els[i];
          if(!el.hasAttribute('data-ro-orig')){
            el.setAttribute('data-ro-orig', el.disabled ? '1' : '0');
          }
          el.disabled = true;
          el.style.cursor = 'not-allowed';
        }
      } else {
        tab.removeAttribute('data-readonly-snapshot');
        var els2 = tab.querySelectorAll('input, select, textarea');
        for(var j=0; j<els2.length; j++){
          var el2 = els2[j];
          var orig = el2.getAttribute('data-ro-orig');
          if(orig !== null){
            el2.disabled = (orig === '1');
            el2.removeAttribute('data-ro-orig');
          } else {
            el2.disabled = false;
          }
          el2.style.cursor = '';
        }
      }
    });
    var styleId = 'ro-snap-style';
    var st = document.getElementById(styleId);
    if(on){
      if(!st){
        st = document.createElement('style'); st.id = styleId;
        st.textContent = '[data-readonly-snapshot="1"] input:disabled,[data-readonly-snapshot="1"] select:disabled,[data-readonly-snapshot="1"] textarea:disabled{background:#f5f2eb !important;color:#5f5e5a !important;opacity:.85;cursor:not-allowed !important}';
        document.head.appendChild(st);
      }
    } else {
      if(st) st.remove();
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. BARRA DE SNAPSHOT — Modo Visualização → Editar → Recalcular/Salvar
  // ═══════════════════════════════════════════════════════════════════
  function _mostrarBarraRecalcular(snap, isVersao){
    var old = document.getElementById('snapshot-bar'); if(old) old.remove();
    var bar = document.createElement('div');
    bar.id = 'snapshot-bar';
    bar.dataset.isVersao = isVersao ? '1' : '0';
    // v9: FIXED no topo do viewport, fora das tabs — não some ao trocar de aba
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9995;background:' + (isVersao?'#d5efdc':'#d6e9f2') + ';border-bottom:3px solid ' + (isVersao?'#27ae60':'#1a5276') + ';padding:9px 20px;display:flex;justify-content:space-between;align-items:center;font-family:inherit;box-shadow:0 3px 12px rgba(0,0,0,.2);gap:12px;flex-wrap:wrap';
    _renderBarraConteudo(bar, snap, isVersao, false);
    document.body.appendChild(bar);
    // Empurrar conteúdo pra baixo pra barra não sobrepor o header
    requestAnimationFrame(function(){
      var h = bar.offsetHeight || 48;
      document.body.style.paddingTop = (h + 4) + 'px';
      document.body.setAttribute('data-snap-padding','1');
    });
  }

  function _renderBarraConteudo(bar, snap, isVersao, emEdicao){
    var info, botoes;
    if(emEdicao){
      info = '✏️ <b>MODO EDIÇÃO</b> — ' + (snap.cliente||'') + ' · ' +
             (isVersao ? 'Versão ' + snap.versao : 'Rascunho') +
             '<span style="margin-left:10px;padding:2px 8px;background:#e67e22;color:#fff;border-radius:10px;font-size:10px;font-weight:700">EDITANDO</span>';
      botoes =
        '<button onclick="recalcularComPrecosAtuais()" style="padding:7px 14px;border-radius:6px;border:none;background:#e67e22;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">🔄 Recalcular</button>' +
        '<button onclick="salvarPreOrcamento()" style="padding:7px 14px;border-radius:6px;border:none;background:#1a5276;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">💾 Salvar (sobrescreve)</button>' +
        '<button onclick="fecharSnapshot()" style="padding:7px 14px;border-radius:6px;border:2px solid #c0392b;background:#c0392b;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">✕ SAIR</button>';
    } else {
      info = '👁️ <b>MODO VISUALIZAÇÃO</b> — ' +
             (isVersao
               ? '🏆 Versão ' + snap.versao + ' CONGELADA · ' + (snap.cliente||'') + ' · ' + _fmtData(snap.aprovado_em)
               : '💾 Rascunho · ' + (snap.cliente||'') + ' · salvo em ' + _fmtData(snap.updated_at));
      botoes =
        (isVersao
          ? '<span style="font-size:10px;color:#196f3d;padding:5px 10px;background:rgba(39,174,96,.15);border-radius:6px">🔒 Imutável — criar nova versão se quiser editar</span>'
          : '<button onclick="ativarEdicaoSnapshot()" style="padding:7px 14px;border-radius:6px;border:none;background:#e67e22;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">✏️ Revisar / Editar</button>') +
        '<button onclick="fecharSnapshot()" style="padding:7px 14px;border-radius:6px;border:2px solid #c0392b;background:#c0392b;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">✕ SAIR da revisão</button>';
    }
    bar.innerHTML =
      '<div style="font-size:12px;color:#003144;flex:1;min-width:280px">' + info + '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + botoes + '</div>';
  }

  // ═══════════════════════════════════════════════════════════════════
  // ATIVAR EDIÇÃO — libera inputs, troca botões da barra
  // ═══════════════════════════════════════════════════════════════════
  window.ativarEdicaoSnapshot = function(){
    var bar = document.getElementById('snapshot-bar');
    var snap = window._snapshotFielCarregado;
    if(!bar || !snap){
      _toast('⚠ Nenhum snapshot ativo','#c0392b',3000); return;
    }
    var isVersao = bar.dataset.isVersao === '1';
    if(isVersao){
      _toast('🔒 <b>Versão congelada</b><br><span style="font-size:11px">Versões aprovadas são imutáveis. Pra editar, volte pra Pré-Orçamentos Salvos e abra o rascunho.</span>','#c0392b',6000);
      return;
    }
    if(!confirm('✏️ ATIVAR MODO EDIÇÃO?\n\nVai liberar todos os campos do orçamento.\n\nDepois de editar, clique em 🔄 Recalcular pra atualizar os valores.\nQuando salvar, o rascunho ATUAL será SOBRESCRITO.\n\nProsseguir?')) return;
    _setReadOnlyGlobal(false);
    _renderBarraConteudo(bar, snap, isVersao, true /* em edição */);
    bar.style.background = '#fff3e0';
    bar.style.borderBottomColor = '#e67e22';
    // v9: re-calcular padding (conteúdo da barra pode ter mudado de altura)
    requestAnimationFrame(function(){
      var h = bar.offsetHeight || 48;
      document.body.style.paddingTop = (h + 4) + 'px';
    });
    _toast('✏️ <b>Modo Edição ativado</b><br><span style="font-size:11px">Edite os campos necessários e clique em 🔄 Recalcular.</span>','#e67e22',5000);
  };

  window.recalcularComPrecosAtuais = function(){
    if(!confirm('🔄 RECALCULAR?\n\nVai recalcular TUDO usando os dados atualmente preenchidos e preços atuais do cadastro.\n\nProsseguir?')) return;
    try {
      // Desativar modo fiel (senão switchTab restaura HTML antigo)
      window._modoFielAtivo = false;
      window._snapshotFielCarregado = null;
      // Recalcular
      if(typeof window.gerarCustoTotal === 'function') window.gerarCustoTotal();
      else if(typeof window.calc === 'function') window.calc();
      // Redesenhar planificador também
      setTimeout(function(){
        try { if(typeof planUpd === 'function') planUpd(); } catch(e){}
      }, 300);
      _toast('🔄 <b>Recalculado!</b><br><span style="font-size:11px;font-weight:400">Agora clique em 💾 Salvar pra sobrescrever o rascunho.</span>','#e67e22',5500);
    } catch(e){
      _toast('❌ Erro ao recalcular: ' + e.message, '#c0392b', 5000);
    }
  };

  window.fecharSnapshot = function(){
    var bar = document.getElementById('snapshot-bar'); if(bar) bar.remove();
    // v9: restaurar padding do body
    if(document.body.getAttribute('data-snap-padding')){
      document.body.style.paddingTop = '';
      document.body.removeAttribute('data-snap-padding');
    }
    window._snapshotCarregado = null;
    window._modoFielAtivo = false;
    window._snapshotFielCarregado = null;
    window._snapFielPlan = null;
    window._snapKey = null; // v15
    window._snapCardId = null; // v15
    _setReadOnlyGlobal(false);

    // v13: ao SAIR da revisão, já zera tudo pra iniciar orçamento do zero.
    // O hook de zerarTudo (instalado abaixo) checa _modoFielAtivo e evita loop
    // (já está false a essa altura). Suprimimos o confirm do zerarTudo pra ser atômico.
    if(typeof window.zerarTudo === 'function'){
      var _origConfirm = window.confirm;
      window.confirm = function(){ return true; };
      try { window.zerarTudo(); }
      catch(e){ console.warn('[fecharSnapshot -> zerarTudo]', e); }
      window.confirm = _origConfirm;
    }

    // v12: restaurar defaults financeiros (zerarTudo os protege, então restore roda por cima)
    _restoreFinDefaults();

    _toast('🚪 <b>Revisão encerrada</b><br><span style="font-size:11px;font-weight:400;opacity:.85">Sistema zerado — pronto pra novo orçamento</span>','#7f8c8d', 3500);
  };

  // ═══════════════════════════════════════════════════════════════════
  // 5. ATIVAR VERSÃO — escolher qual vai pro pipeline
  // ═══════════════════════════════════════════════════════════════════
  window.ativarVersao = async function(id, chave){
    if(!confirm('Ativar esta versão no pipeline?\n\nOs valores dela passarão a ser os oficiais do card.')) return;
    try {
      // Desativar outras da mesma chave
      await fetch(SUPA+'/rest/v1/versoes_aprovadas?chave=eq.'+encodeURIComponent(chave)+'&ativa=eq.true', {
        method:'PATCH',
        headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
        body: JSON.stringify({ ativa: false })
      });
      // Ativar essa
      await fetch(SUPA+'/rest/v1/versoes_aprovadas?id=eq.'+encodeURIComponent(id), {
        method:'PATCH',
        headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
        body: JSON.stringify({ ativa: true })
      });
      // Buscar essa versão pra atualizar card
      var r = await fetch(SUPA+'/rest/v1/versoes_aprovadas?id=eq.'+encodeURIComponent(id), { headers: _hdrs() });
      var arr = await r.json();
      var v = arr[0];
      if(v && v.card_id){
        await fetch(SUPA+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(v.card_id), {
          method:'PATCH',
          headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
          body: JSON.stringify({
            valor: v.valor_faturamento || v.valor_tabela,
            valor_tabela: v.valor_tabela,
            valor_faturamento: v.valor_faturamento,
            updated_at: new Date().toISOString()
          })
        });
      }
      _toast('⭐ <b>Versão ' + v.versao + ' ativada</b><br><span style="font-size:11px;font-weight:400">Valores do card atualizados</span>', '#27ae60', 4000);
      // Recarregar modal
      setTimeout(function(){ window.abrirModalPreOrcamentos(); }, 500);
    } catch(err){
      alert('❌ Erro: ' + err.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 6. EXCLUIR RASCUNHO
  // ═══════════════════════════════════════════════════════════════════
  window.excluirPreOrcamento = async function(id, btn){
    if(!confirm('Excluir este rascunho?\n\nAs VERSÕES APROVADAS deste cliente NÃO serão afetadas — só o rascunho editável.')) return;
    try {
      var r = await fetch(SUPA+'/rest/v1/pre_orcamentos?id=eq.'+encodeURIComponent(id), {
        method:'PATCH',
        headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
        body: JSON.stringify({ deleted_at: new Date().toISOString() })
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      var tr = btn.closest('tr'); if(tr) tr.remove();
      _toast('🗑️ Rascunho excluído','#e67e22', 2500);
    } catch(err){
      alert('❌ Erro: '+err.message);
    }
  };

  // v15: excluir versao aprovada (DELETE real — RLS off + trigger so bloqueia UPDATE)
  window.excluirVersao = async function(id, versao, cliente, btn){
    if(!confirm('⚠ EXCLUIR VERSÃO ' + versao + ' de ' + (cliente||'cliente') + '?\n\n' +
                'Esta ação é PERMANENTE. A versão aprovada será removida do histórico.\n' +
                'O rascunho e outras versões não serão afetados.\n\n' +
                'Continuar?')) return;
    try {
      var r = await fetch(SUPA+'/rest/v1/versoes_aprovadas?id=eq.'+encodeURIComponent(id), {
        method:'DELETE',
        headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' })
      });
      if(!r.ok){
        var t = await r.text();
        throw new Error('HTTP '+r.status+': '+t);
      }
      var tr = btn.closest('tr'); if(tr) tr.remove();
      _toast('🗑️ Versão ' + versao + ' excluída','#e67e22', 2500);
      // Recarregar modal pra atualizar contadores
      setTimeout(function(){ try { window.abrirModalPreOrcamentos(); } catch(e){} }, 800);
    } catch(err){
      console.error('[excluirVersao]', err);
      alert('❌ Erro ao excluir versão: '+err.message);
    }
  };

  // v16: REIMPRIMIR versao aprovada — baixa PDF + PNGs sem criar nova versao
  // Fluxo: busca versao -> aplica snapshot congelado -> aguarda render ->
  // _gerarDownloadsDiretos. Pula INSERT em versoes_aprovadas e PATCH no card.
  window.reimprimirVersao = async function(id){
    try {
      var r = await fetch(SUPA+'/rest/v1/versoes_aprovadas?id=eq.'+encodeURIComponent(id), { headers: _hdrs() });
      var arr = await r.json();
      var v = arr && arr[0];
      if(!v){ alert('❌ Versão não encontrada'); return; }

      var vTab = v.valor_tabela ? 'R$ '+Number(v.valor_tabela).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—';
      var vFat = v.valor_faturamento ? 'R$ '+Number(v.valor_faturamento).toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—';

      if(!confirm('🖨️ REIMPRIMIR VERSÃO ' + v.versao + '?\n\n' +
                  '• Baixa novamente 1 PDF + 3 PNGs\n' +
                  '• NÃO cria nova versão\n' +
                  '• NÃO altera o card CRM\n\n' +
                  'Cliente: ' + (v.cliente||'—') + '\n' +
                  'AGP: ' + (v.agp||'—') + '\n' +
                  'Tabela: ' + vTab + '\n' +
                  'Faturamento: ' + vFat + '\n\n' +
                  'Prosseguir?')) return;

      // Fecha modal pra o usuario ver a tela com os dados
      var poModal = document.getElementById('po-modal-bg'); if(poModal) poModal.remove();

      _toast('⏳ <b>Carregando V' + v.versao + '...</b><br><span style="font-size:11px;font-weight:400">Aguarde a renderização antes do download</span>', '#7f8c8d', 3500);

      // Aplicar snapshot congelado — popula todos os campos pra captura
      await _aplicarSnapshot(v, true);
      _mostrarBarraRecalcular(v, true);

      // Aguardar DOM renderizar valores
      await new Promise(function(r){ setTimeout(r, 2200); });

      // Nome base identico ao do Aprovar — assim sobrescreve/substitui arquivos apagados
      var nomeBase = (v.agp || (v.dados_projeto && v.dados_projeto.agp) || 'orcamento') + ' - ' +
                     (v.reserva || (v.dados_projeto && v.dados_projeto.reserva) || '') + ' - ' +
                     (v.cliente || '').replace(/[^\w\s-]/g,'') + ' - V' + v.versao;

      _toast('📥 <b>Baixando arquivos...</b>', '#0C447C', 4000);
      var ok = await _gerarDownloadsDiretos(nomeBase);

      _toast('🖨️ <b>V' + v.versao + ' reimpressa!</b><br>' +
             '<span style="font-size:11px;font-weight:400;line-height:1.6">' +
             (ok.length ? ok.map(function(x){return '✓ '+x;}).join('<br>') : 'Nenhum arquivo gerado — verifique console') +
             '<br><i style="opacity:.7">Nenhuma nova versão foi criada.</i></span>',
             '#27ae60', 12000);
    } catch(err){
      console.error('[reimprimirVersao]', err);
      alert('❌ Erro na reimpressão: ' + err.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 7. 🏆 APROVAR PARA ENVIO — cria Versão N congelada + downloads
  // ═══════════════════════════════════════════════════════════════════
  window.aprovarOrcamentoParaEnvio = async function(){
    var chave = _gerarChave();
    if(!chave){
      _toast('⚠ <b>Preencha o cliente antes de aprovar</b>', '#c0392b', 5000);
      return;
    }
    var snap = _capturarSnapshot();
    if((snap.itens||[]).length === 0){
      _toast('⚠ <b>Orçamento vazio</b>', '#c0392b', 4000); return;
    }

    var valTab = _parseMoeda(snap.resultado.preco_tabela);
    var valFat = _parseMoeda(snap.resultado.preco_fat);
    if(valTab == null && valFat == null){
      _toast('⚠ <b>Calcule o orçamento antes</b>', '#c0392b', 5000); return;
    }

    // Buscar próxima versão
    try {
      var r = await fetch(SUPA+'/rest/v1/rpc/proxima_versao', {
        method:'POST',
        headers: _hdrs(),
        body: JSON.stringify({ p_chave: chave })
      });
      var proxV = await r.json();
      
      if(!confirm('🏆 APROVAR COMO VERSÃO ' + proxV + '?\n\n' +
        '• Será criada uma versão CONGELADA (imutável)\n' +
        '• Valores do card atualizados\n' +
        '• Card movido pra "Orçamento Pronto"\n' +
        '• 1 PDF + 3 PNGs baixados\n\n' +
        'Cliente: ' + (snap.dados_cliente.nome||'—') + '\n' +
        'AGP: ' + (snap.dados_projeto.agp||'—') + '\n' +
        'Tabela: R$ ' + (valTab ? valTab.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—') + '\n' +
        'Faturamento: R$ ' + (valFat ? valFat.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—') + '\n\n' +
        'Prosseguir?')) return;

      _toast('⏳ <b>Aprovando Versão ' + proxV + '...</b>', '#7f8c8d', 4000);

      // 1. INSERT em versoes_aprovadas (imutável)
      //    v20: paineis_html REMOVIDO — eram ~3MB por linha, causava
      //    statement_timeout (57014) em INSERT. Resultado visual é o mesmo
      //    porque _aplicarSnapshot chama calc() que reconstrói os painéis
      //    a partir de inputs_raw.
      var payload = {
        id: 'va_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
        chave: chave,
        versao: proxV,
        card_id: window._crmOrcCardId || window._snapCardId || null,
        cliente: snap.dados_cliente.nome || '(sem cliente)',
        agp: snap.dados_projeto.agp || null,
        reserva: snap.dados_projeto.reserva || null,
        dados_cliente: snap.dados_cliente,
        dados_projeto: snap.dados_projeto,
        params_financeiros: snap.params_financeiros,
        itens: snap.itens,
        resultado: snap.resultado,
        precos_snapshot: snap.precos_snapshot,
        inputs_raw: snap.inputs_raw || {},
        globais: snap.globais || {},
        valor_tabela: valTab,
        valor_faturamento: valFat,
        aprovado_por: 'felipe.projetta',
        ativa: true
      };

      // v20: log do tamanho pra diagnóstico
      try {
        var _bdy = JSON.stringify(payload);
        console.log('[aprovar v20] payload size: ' + (_bdy.length/1024).toFixed(1) + ' KB (antes 3000+ KB com paineis_html)');
      } catch(e){}

      // Desativar versões anteriores da mesma chave
      await fetch(SUPA+'/rest/v1/versoes_aprovadas?chave=eq.'+encodeURIComponent(chave)+'&ativa=eq.true', {
        method:'PATCH',
        headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
        body: JSON.stringify({ ativa: false })
      });

      var rIns = await fetch(SUPA+'/rest/v1/versoes_aprovadas', {
        method:'POST',
        headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
        body: JSON.stringify(payload)
      });
      if(!rIns.ok){
        var t = await rIns.text();
        // Se ainda timeout, sugerir refresh da pagina pro user
        if(rIns.status === 500 && t.indexOf('57014') >= 0){
          throw new Error('Timeout do Supabase. Tente novamente em alguns segundos.');
        }
        throw new Error('Insert versão: '+rIns.status+' '+t);
      }

      // 2. Atualizar card CRM (v19: stage -> Orcamento Revisado, com valores)
      //    User arrasta manual do Revisado para Proposta Enviada apos mandar whatsapp.
      var _cardIdToPatch = window._crmOrcCardId || window._snapCardId || null;
      if(_cardIdToPatch){
        try {
          var _stageRevisado = _getStageIdRevisado();
          var _okAprov = await _moverCardStage(_cardIdToPatch, _stageRevisado, {
            valor: valFat || valTab,
            valor_tabela: valTab,
            valor_faturamento: valFat
          });
          if(!_okAprov) console.warn('[aprov card patch] PATCH falhou');
          if(!payload.card_id) payload.card_id = _cardIdToPatch;
        } catch(cerr){ console.warn('[aprov card patch]', cerr); }
      }

      // 3. Downloads diretos
      _toast('📥 <b>Baixando arquivos...</b>', '#0C447C', 4000);
      var nomeBase = (snap.dados_projeto.agp || 'orcamento') + ' - ' +
                     (snap.dados_projeto.reserva || '') + ' - ' +
                     (snap.dados_cliente.nome || '').replace(/[^\w\s-]/g,'') + ' - V' + proxV;
      var ok = await _gerarDownloadsDiretos(nomeBase);

      _toast('🏆 <b>Versão ' + proxV + ' APROVADA!</b><br>' +
             '<span style="font-size:11px;font-weight:400;line-height:1.6">' +
             '✓ Congelada em versoes_aprovadas<br>' +
             (window._crmOrcCardId ? '✓ Card → Orçamento Pronto<br>' : '') +
             ok.map(function(x){return '✓ '+x;}).join('<br>') +
             '</span>', '#27ae60', 12000);
    } catch(err){
      console.error('[aprovar]', err);
      _toast('❌ <b>Erro:</b> ' + err.message, '#c0392b', 6000);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // 8. DOWNLOADS DIRETOS — SEM diálogo de impressão
  // ═══════════════════════════════════════════════════════════════════
  function _loadScript(src){
    return new Promise(function(resolve, reject){
      if(document.querySelector('script[src="'+src+'"]')){ resolve(); return; }
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = function(){ reject(new Error('load fail '+src)); };
      document.head.appendChild(s);
    });
  }

  async function _gerarDownloadsDiretos(nomeBase){
    var out = [];
    // Carregar libs
    try { await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'); } catch(e){}
    try { await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'); } catch(e){}

    function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

    // 1. PROPOSTA → PDF MULTI-PÁGINA (v14)
    //    Itera cada .proposta-page, captura com html2canvas, compila
    //    em PDF multi-página via jsPDF. Replica o padrão do fluxo
    //    nativo _exportPropostaToCard (js/12-proposta.js).
    try {
      // 1.1 Popular conteúdo da proposta (caso não esteja populado)
      if(typeof populateProposta === 'function'){
        try { populateProposta(); } catch(e){ console.warn('[populateProposta]', e); }
      }
      await sleep(400);

      // 1.2 Tornar aba visível off-screen pra html2canvas conseguir renderizar
      var propostaTab = document.getElementById('tab-proposta');
      var origStyle = propostaTab ? propostaTab.getAttribute('style') : '';
      if(propostaTab){
        propostaTab.style.display       = 'block';
        propostaTab.style.position      = 'absolute';
        propostaTab.style.left          = '-9999px';
        propostaTab.style.top           = '0';
        propostaTab.style.opacity       = '1';
        propostaTab.style.pointerEvents = 'none';
        propostaTab.style.visibility    = 'visible';
        propostaTab.style.width         = '210mm';
      }

      // Forçar reflow e aguardar layout estabilizar
      if(propostaTab) void propostaTab.offsetHeight;
      await sleep(600);

      var pages = document.querySelectorAll('.proposta-page');
      if(pages.length && window.html2canvas){
        // 1.3 Capturar cada página sequencialmente
        var capturas = [];
        for(var pi = 0; pi < pages.length; pi++){
          try {
            var canvas = await window.html2canvas(pages[pi], {
              scale: 1.6,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
            });
            capturas.push({
              dataUrl: canvas.toDataURL('image/jpeg', 0.88),
              w: canvas.width,
              h: canvas.height
            });
            await sleep(120);
          } catch(capErr){
            console.warn('[captura pg '+pi+']', capErr);
          }
        }

        // 1.4 Restaurar estilo original da aba
        if(propostaTab) propostaTab.setAttribute('style', origStyle || 'display:none');

        // 1.5 Compilar PDF multi-página via jsPDF
        if(capturas.length){
          var _jsPDF = (window.jspdf && window.jspdf.jsPDF)
                    || (window.html2pdf && window.html2pdf().getPdf && null) // fallback indireto
                    || window.jsPDF;
          if(_jsPDF){
            var pdf = new _jsPDF({ unit:'mm', format:'a4', orientation:'portrait', compress: true });
            var PW = 210, PH = 297; // A4 mm
            for(var ci = 0; ci < capturas.length; ci++){
              var cap = capturas[ci];
              if(ci > 0) pdf.addPage();
              // Fit proporcional mantendo aspect ratio, centralizado
              var wRatio = PW / cap.w;
              var hRatio = PH / cap.h;
              var ratio  = Math.min(wRatio, hRatio);
              var drawW  = cap.w * ratio;
              var drawH  = cap.h * ratio;
              var offX   = (PW - drawW) / 2;
              var offY   = (PH - drawH) / 2;
              pdf.addImage(cap.dataUrl, 'JPEG', offX, offY, drawW, drawH);
            }
            pdf.save(nomeBase + ' - Proposta Comercial.pdf');
            out.push('Proposta.pdf (' + capturas.length + ' pág.)');
          } else {
            // Fallback: se jsPDF não estiver disponível, tenta html2pdf com a aba INTEIRA
            // (melhor que só capa). pagebreak no CSS das .proposta-page cuida do resto.
            if(propostaTab && window.html2pdf){
              propostaTab.style.display = 'block';
              propostaTab.style.position = 'absolute';
              propostaTab.style.left = '-9999px';
              await window.html2pdf()
                .set({
                  margin: 0,
                  filename: nomeBase + ' - Proposta Comercial.pdf',
                  image: { type:'jpeg', quality: 0.9 },
                  html2canvas: { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' },
                  jsPDF: { unit:'mm', format:'a4', orientation:'portrait', compress: true },
                  pagebreak: { mode: ['css','legacy'], before: '.proposta-page' }
                }).from(propostaTab).save();
              propostaTab.setAttribute('style', origStyle || 'display:none');
              out.push('Proposta.pdf (fallback)');
            }
          }
        }
      } else if(propostaTab){
        // Nenhuma .proposta-page encontrada — restaura mesmo assim
        propostaTab.setAttribute('style', origStyle || 'display:none');
      }
    } catch(e){ console.warn('[proposta v14]', e); }
    await sleep(1000);

    // 2. PNG MC — Margens + DRE (v15: clona Resultado Porta + DRE num wrapper)
    try {
      if(window.html2canvas){
        var rcs = document.querySelectorAll('.rc');
        var mcElems = [];
        for(var ri = 0; ri < rcs.length; ri++){
          var rcEl = rcs[ri];
          if(rcEl.id === 'resultado-intl-total') continue; // pular internacional
          // Pega Resultado Porta (tem m-custo-porta dentro) e DRE (tem .dre)
          if(rcEl.querySelector('#m-custo-porta') || rcEl.querySelector('.dre')){
            mcElems.push(rcEl);
          }
        }
        if(mcElems.length){
          var wrap = document.createElement('div');
          wrap.style.cssText = 'position:absolute;left:-9999px;top:0;width:420px;background:#fff;padding:12px;font-family:inherit';
          mcElems.forEach(function(el){
            var c = el.cloneNode(true);
            c.style.marginBottom = '12px';
            c.style.position = 'static';
            c.style.top = 'auto';
            wrap.appendChild(c);
          });
          document.body.appendChild(wrap);
          await sleep(200);
          var cv = await window.html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
          document.body.removeChild(wrap);
          var a1 = document.createElement('a');
          a1.href = cv.toDataURL('image/png');
          a1.download = nomeBase + ' - MC - Margens + DRE.png';
          document.body.appendChild(a1); a1.click();
          setTimeout(function(){ if(a1.parentNode) a1.parentNode.removeChild(a1); }, 100);
          out.push('MC.png');
        }
      }
    } catch(e){ console.warn('[MC v15]', e); }
    await sleep(600);

    // 3. PNG MR — Memorial / Resumo da obra (selector unico, inalterado)
    try {
      var elMR = document.getElementById('resumo-obra');
      if(elMR && window.html2canvas){
        var cvMR = await window.html2canvas(elMR, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
        var a2 = document.createElement('a');
        a2.href = cvMR.toDataURL('image/png');
        a2.download = nomeBase + ' - MR - Memorial.png';
        document.body.appendChild(a2); a2.click();
        setTimeout(function(){ if(a2.parentNode) a2.parentNode.removeChild(a2); }, 100);
        out.push('MR.png');
      }
    } catch(e){ console.warn('[MR v15]', e); }
    await sleep(600);

    // 4. PNG RC — Painel Representante (v15: usa printPainelRep nativo)
    //    Essa funcao em 12-proposta.js ja gera o PNG com layout proprio
    //    (card purpura com comissoes, valores por m2, etc) e faz download automatico.
    try {
      if(typeof window.printPainelRep === 'function'){
        window.printPainelRep();
        out.push('RC.png (via painel-rep)');
        await sleep(1200); // aguarda geracao async do PNG dele
      }
    } catch(e){ console.warn('[RC v15]', e); }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════
  // v17: PIPELINE CRM — garantir stage Orcamento Revisado + transicoes
  // ═══════════════════════════════════════════════════════════════════
  // Fluxo: s3 (Fazer Orcamento) --salvar--> s3b (Orcamento Pronto)
  //        s3b --drag manual--> s3c (Orcamento Revisado)
  //        s3c --aprovar p/ envio--> s4 (Proposta Enviada)

  // v25: CSS customizado do kanban REMOVIDO — volta ao comportamento nativo
  //   (wrap max-width:1520px + scroll horizontal no pipeline quando nao cabe).
  //   Felipe pediu o padrao de volta. Limpeza defensiva pra remover CSS
  //   que pode ter ficado de versoes anteriores.
  (function _limparCSSAntigoKanban(){
    try {
      ['v19-kanban-css','v20-kanban-css','v21-kanban-css','v22-kanban-css',
       'v23-kanban-css','v23-simple','v25-live-test'].forEach(function(id){
        var old = document.getElementById(id); if(old) old.remove();
      });
      // Remover class do body se existir (usada em versoes que escapavam do .wrap)
      document.body.classList.remove('crm-active');
    } catch(e){}
  })();
  // Re-executar periodicamente (caso algo antigo injete de volta)
  [500, 2000, 5000].forEach(function(ms){
    setTimeout(function(){
      try {
        ['v19-kanban-css','v20-kanban-css','v21-kanban-css','v22-kanban-css',
         'v23-kanban-css','v23-simple','v25-live-test'].forEach(function(id){
          var old = document.getElementById(id); if(old) old.remove();
        });
        document.body.classList.remove('crm-active');
      } catch(e){}
    }, ms);
  });

  function _garantirStageRevisado(){
    try {
      var raw = localStorage.getItem('projetta_crm_settings_v1');
      if(!raw) return false;
      var s = JSON.parse(raw) || {};
      var stages = s.stages || [];
      if(!stages.length) return false;
      // Se ja existe s3c ou algum stage com label 'Revisado', skip
      if(stages.find(function(x){return x.id==='s3c' || /revis/i.test(x.label||'');})){
        return false;
      }
      // Inserir APOS s3b, ou antes de s4
      var idxProntoB = stages.findIndex(function(x){return x.id==='s3b';});
      var idxEnviada = stages.findIndex(function(x){return x.id==='s4';});
      var insertPos = (idxProntoB >= 0) ? (idxProntoB + 1)
                   : (idxEnviada >= 0) ? idxEnviada
                   : stages.length;
      stages.splice(insertPos, 0, {
        id: 's3c',
        label: 'Orçamento Revisado',
        color: '#8e44ad',
        icon: '✏️'
      });
      s.stages = stages;
      localStorage.setItem('projetta_crm_settings_v1', JSON.stringify(s));
      console.log('%c[81 v17] stage s3c (Orçamento Revisado) adicionado ao pipeline', 'color:#8e44ad;font-weight:700');
      // Re-render kanban se ja disponivel
      try { if(typeof window.crmRender === 'function') window.crmRender(); } catch(e){}
      return true;
    } catch(err){
      console.warn('[garantirStageRevisado]', err);
      return false;
    }
  }
  // Tentar instalar em varios momentos (depende de quando o settings carrega)
  [800, 2500, 5500].forEach(function(ms){ setTimeout(_garantirStageRevisado, ms); });

  // v18/v25: Sync 1 card do Supabase para o localStorage (insert OR update).
  // v25 FIX CRITICO: salva ambos formatos de campos (camelCase E snake_case)
  // porque crmSaveOpp do 10-crm.js preserva valorTabela/valorFaturamento
  // (camelCase). Antes so salvavamos snake_case e os valores sumiam quando
  // qualquer chamada de crmSaveOpp acontecia (modal aberto/fechado/etc).
  async function _syncCardFromCloudParaLocal(cardId){
    if(!cardId) return false;
    try {
      var r = await fetch(SUPA+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId)+'&select=*', { headers: _hdrs() });
      if(!r.ok) return false;
      var arr = await r.json();
      var row = arr && arr[0];
      if(!row) return false;

      // Normalizar shape pra formato que o CRM usa internamente
      var card = {};
      Object.keys(row).forEach(function(k){ card[k] = row[k]; });

      // v25: mapear snake_case -> camelCase pra compatibilidade com crmSaveOpp
      //   O legacy (10-crm.js) preserva esses nomes em Object.assign/cSave.
      //   Se nao existem no localStorage, sao setados como undefined e
      //   acabam apagando os valores. Agora salvamos ambos.
      if(row.valor_tabela != null) card.valorTabela = Number(row.valor_tabela);
      if(row.valor_faturamento != null) card.valorFaturamento = Number(row.valor_faturamento);
      if(row.data_criacao && !card.dataCriacao) card.dataCriacao = row.data_criacao;
      if(row.updated_at && !card.updatedAt) card.updatedAt = row.updated_at;
      // Campo valor (pipeline KPI) — garantir que esta definido
      if(card.valor == null && (row.valor_faturamento != null || row.valor_tabela != null)){
        card.valor = Number(row.valor_faturamento || row.valor_tabela || 0);
      }

      var raw = localStorage.getItem('projetta_crm_v1');
      var local = raw ? JSON.parse(raw) : [];
      var ci = local.findIndex(function(c){ return c && c.id === cardId; });
      if(ci >= 0){
        // Preservar campos locais grandes (anexos) + merge do resto vindo do cloud
        var localAnx = local[ci].anexos;
        local[ci] = Object.assign({}, local[ci], card);
        if(localAnx && localAnx.length && (!card.anexos || !card.anexos.length)){
          local[ci].anexos = localAnx;
        }
      } else {
        local.push(card);
      }
      localStorage.setItem('projetta_crm_v1', JSON.stringify(local));
      // Resetar snapshot do crmDB pra evitar re-envio como "mudanca local"
      try { sessionStorage.removeItem('_crmDB_lastSnapshot'); } catch(e){}
      return true;
    } catch(err){
      console.warn('[syncCardFromCloud v25]', err);
      return false;
    }
  }

  // Mover card entre stages via PATCH no Supabase + sync localStorage
  async function _moverCardStage(cardId, novoStage, extraFields){
    if(!cardId || !novoStage) return false;
    try {
      var body = Object.assign({
        stage: novoStage,
        updated_at: new Date().toISOString()
      }, extraFields || {});
      var r = await fetch(SUPA+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId), {
        method:'PATCH',
        headers: Object.assign({}, _hdrs(), { Prefer:'return=minimal' }),
        body: JSON.stringify(body)
      });
      if(!r.ok){ console.warn('[moverCard]', r.status, await r.text()); return false; }

      // v18: sync forte localStorage <- cloud (cobre cards orfaos que nao
      // estavam no localStorage — antes a transicao nao aparecia no kanban)
      await _syncCardFromCloudParaLocal(cardId);

      try { if(typeof window.crmRender === 'function') window.crmRender(); } catch(e){}
      return true;
    } catch(err){
      console.warn('[moverCard]', err);
      return false;
    }
  }

  // v19: achar ID do stage "Orcamento Revisado" dinamicamente.
  // Felipe criou com id custom (s1777050576466). Outros users podem ter IDs
  // diferentes. Busca pelo label ou pelo id convencional 's3c'.
  function _getStageIdRevisado(){
    try {
      var raw = localStorage.getItem('projetta_crm_settings_v1');
      if(!raw) return 's3c'; // fallback
      var s = JSON.parse(raw) || {};
      var stages = s.stages || [];
      // Prioridade: id === 's3c'
      var match = stages.find(function(x){ return x.id === 's3c'; });
      if(match) return match.id;
      // Senao: primeiro stage com 'revis' no label
      match = stages.find(function(x){ return /revis/i.test(x.label || ''); });
      if(match) return match.id;
      return 's3c';
    } catch(e){ return 's3c'; }
  }

  // Buscar stage atual de um card
  async function _getCardStage(cardId){
    if(!cardId) return null;
    try {
      var r = await fetch(SUPA+'/rest/v1/crm_oportunidades?id=eq.'+encodeURIComponent(cardId)+'&select=stage', { headers: _hdrs() });
      var arr = await r.json();
      return arr && arr[0] ? arr[0].stage : null;
    } catch(e){ return null; }
  }

  // v8: Hook em zerarTudo pra auto-fechar snapshot. Evita ficar preso em modo fiel
  //     quando user zera pra começar novo orçamento.
  function _installZerarHook(){
    if(typeof window.zerarTudo === 'function' && !window.zerarTudo._snapHook){
      var orig = window.zerarTudo;
      window.zerarTudo = function(){
        if(window._modoFielAtivo){
          try { window.fecharSnapshot(); } catch(e){}
        }
        return orig.apply(this, arguments);
      };
      window.zerarTudo._snapHook = true;
      return true;
    }
    return false;
  }
  // Tentar instalar agora; se zerarTudo ainda não foi definido, tenta em intervalos
  if(!_installZerarHook()){
    var tries = 0;
    var iv = setInterval(function(){
      if(_installZerarHook() || ++tries > 20) clearInterval(iv);
    }, 500);
  }

  // v8: Tecla ESC como escape rápido do modo fiel
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && window._modoFielAtivo && !document.querySelector('#po-modal-bg, .modal-open, dialog[open]')){
      if(confirm('Sair do modo revisão?')){
        try { window.fecharSnapshot(); } catch(err){}
      }
    }
  });

  console.log('%c[81 v25] remove CSS custom + fix valores camelCase — pre_orcamentos (upsert) + versoes_aprovadas (imutável)', 'color:#003144;font-weight:700;background:#eaf2f7;padding:3px 8px;border-radius:4px');
})();
