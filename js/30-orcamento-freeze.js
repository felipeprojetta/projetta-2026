/* ═══════════════════════════════════════════════════════════════════════════
   ORCAMENTO FREEZE — Sistema ÚNICO de congelamento e restauração (v1.0)

   Felipe (20/04/2026): "um orçamento não pode ser perdido informações. Nem
   precisava ser essa aba de Memorial de Cálculo, era simplesmente abrir ele
   em todas as abas com seus valores."

   OBJETIVO: ao dar duplo-clique numa revisão no card CRM, o orçamento abre
   INTEIRO — aba Orçamento com valores, aba Perfis com cálculos, aba
   Planificador com chapas, aba Proposta gerada, ATP funcional — em modo
   somente-leitura com banner amarelo. Click em "Nova Revisão" destrava.

   ESTE SISTEMA SUBSTITUI: MemorialV2 (28-memorial-v2.js) e MemorialCem
   (29-memorial-cem.js). Ambos tinham problemas. Este é definitivo.

   COMO FUNCIONA:
   - capturarCompleto(cardId, revNum): coleta inputs + blocos dinâmicos +
     window._* globais + displaySnap + HTMLs das abas + canvas do plan.
     Upload único ao Supabase tabela configuracoes como 'freeze_<cardId>_rev<N>'.
   - abrirRevisao(cardId, revNum): baixa pacote, recria blocos dinâmicos,
     seta inputs com selectedIndex correto, restaura globals, repopula spans
     via _restoreSnapshotDisplay, injeta HTMLs, restaura canvas, trava form
     com banner amarelo "🔒 Clique em Nova Revisão pra editar".

   Depende de: _SB_URL, _SB_KEY, captureSnapshot, _restoreSnapshotDisplay,
   addACM/addALU/addFixo, toggleInstQuem, switchTab.
   ═══════════════════════════════════════════════════════════════════════════ */

(function(){
  'use strict';

  // ───────────────────────────────────────────────────────────────
  // Lista de globals a capturar/restaurar (só DADOS, não funções).
  // Se o valor não existir no window, pula (não gera erro).
  // ───────────────────────────────────────────────────────────────
  var GLOBALS_A_CAPTURAR = [
    // Multi-produto (itens do pedido)
    '_mpItens',
    // Planificador multi-cor
    '_PLN_COLOR_KEYS', '_PLN_RES_BY_COLOR', '_PLN_CHAPA_SIZE_BY_COLOR',
    '_PLN_SIZE_BY_COLOR_USED', '_PLN_ACTIVE_COLOR',
    // Planificador geral
    'PLN_RES', 'PLN_SD', '_plnResALU', '_simData', '_plnPiecesRef',
    // Chapas
    '_chapasACM', '_chapasALU', '_chapasCalculadas',
    '_chapaALU_SW', '_chapaALU_SH',
    // Pesos
    '_planPesoLiqACM', '_planPesoBrutoACM', '_planPesoPortaACM',
    '_pesoChapasPerDoor', '_pesoPerfisFolha',
    // Cálculo
    '_calcResult',
    // OS
    '_lastOSData', '_osGeradoUmaVez', '_osGenerated', '_osaManualOptsAll',
    // Perfis/fixos
    '_lastFixosPerfisRows', '_perfisPerDoor',
    // Instalação internacional
    '_instIntlCusto', '_instIntlFat', '_instIntlFinalizado',
    // Fabricação manual
    '_fabManual', '_fabSysValues',
    // Fechadura
    '_fechMecAuto', '_fechMecManual',
    // IA / Enchimento / Ripas
    '_iaItens', '_enchimentoDetail', '_enchimentoPeso',
    '_qPOS', '_qtdRipasTotal',
    // Cor
    '_corListaGlobal', '_corMode'
  ];

  // Abas onde estão os inputs que interessam
  var TABS_ALVO = ['tab-orcamento', 'tab-os', 'tab-os-acess', 'tab-planificador'];

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  function _esSerializable(v){
    try { JSON.stringify(v); return true; } catch(e){ return false; }
  }

  function _captureGlobals(){
    var out = {};
    GLOBALS_A_CAPTURAR.forEach(function(k){
      try {
        if(typeof window[k] !== 'undefined' && _esSerializable(window[k])){
          // Deep clone via JSON pra desacoplar da ref original
          out[k] = JSON.parse(JSON.stringify(window[k]));
        }
      } catch(e){ console.warn('[Freeze] global '+k+' não serializável'); }
    });
    return out;
  }

  function _restoreGlobals(globals){
    if(!globals) return;
    Object.keys(globals).forEach(function(k){
      try { window[k] = globals[k]; }
      catch(e){ console.warn('[Freeze] falhou restaurar '+k+':', e); }
    });
  }

  // ───────────────────────────────────────────────────────────────
  // INPUTS: captura value + selectedIndex (pra selects)
  // ───────────────────────────────────────────────────────────────
  function _captureInputs(){
    var out = {};
    TABS_ALVO.forEach(function(tabId){
      var tab = document.getElementById(tabId);
      if(!tab) return;
      var items = {};
      var els = tab.querySelectorAll('input[id], select[id], textarea[id]');
      els.forEach(function(el){
        var id = el.id;
        if(!id) return;
        var entry = {};
        if(el.tagName === 'SELECT'){
          entry.selectedIndex = el.selectedIndex;
          entry.value = el.value;
          // Guarda também o texto da option selecionada (fallback pra re-matching
          // se as options forem recarregadas e o selectedIndex mudar)
          if(el.selectedIndex >= 0 && el.options[el.selectedIndex]){
            entry.selectedText = el.options[el.selectedIndex].text;
          }
        } else if(el.type === 'checkbox' || el.type === 'radio'){
          entry.checked = el.checked;
          entry.value = el.value;
        } else {
          entry.value = el.value;
        }
        items[id] = entry;
      });
      out[tabId] = items;
    });
    return out;
  }

  function _restoreInputs(inputsSaved){
    if(!inputsSaved) return;
    Object.keys(inputsSaved).forEach(function(tabId){
      var items = inputsSaved[tabId] || {};
      Object.keys(items).forEach(function(id){
        var el = document.getElementById(id);
        if(!el) return;
        var v = items[id];
        try {
          if(el.tagName === 'SELECT'){
            // Primeiro tenta selectedIndex direto
            if(typeof v.selectedIndex === 'number' && v.selectedIndex >= 0 && v.selectedIndex < el.options.length){
              el.selectedIndex = v.selectedIndex;
              // Validar que o texto bate — se não bate, tenta re-matching por texto
              if(v.selectedText && el.options[el.selectedIndex] && el.options[el.selectedIndex].text !== v.selectedText){
                // Procurar por texto
                for(var oi=0; oi<el.options.length; oi++){
                  if(el.options[oi].text === v.selectedText){ el.selectedIndex = oi; break; }
                }
              }
            } else if(v.value){
              el.value = v.value;
            }
          } else if(el.type === 'checkbox' || el.type === 'radio'){
            el.checked = !!v.checked;
          } else {
            el.value = v.value || '';
          }
        } catch(e){ console.warn('[Freeze] restore input '+id+' falhou:', e); }
      });
    });
  }

  // ───────────────────────────────────────────────────────────────
  // BLOCOS DINÂMICOS: ACM, ALU, Fixo, (Perfil)
  // ───────────────────────────────────────────────────────────────
  function _captureDynBlocks(){
    var out = { acm: [], alu: [], fixo: [] };

    // ACM blocks
    document.querySelectorAll('#acm-list .cbl').forEach(function(blk){
      var sel = blk.querySelector('select[id^="acm-sel-"]');
      var qty = blk.querySelector('input[id^="acm-qty-"]');
      var entry = {
        selectedIndex: sel ? sel.selectedIndex : -1,
        selectedText:  sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '',
        value:         sel ? sel.value : '',
        qty:           qty ? qty.value : '1'
      };
      out.acm.push(entry);
    });

    // ALU blocks
    document.querySelectorAll('#alu-list .cbl').forEach(function(blk){
      var sel = blk.querySelector('select[id^="alu-sel-"]');
      var qty = blk.querySelector('input[id^="alu-qty-"]');
      out.alu.push({
        selectedIndex: sel ? sel.selectedIndex : -1,
        selectedText:  sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '',
        value:         sel ? sel.value : '',
        qty:           qty ? qty.value : '1'
      });
    });

    // Fixo blocks (usam classes, não IDs únicos)
    document.querySelectorAll('#fixos-list .fixo-blk').forEach(function(blk){
      var _q = function(cls){ var e = blk.querySelector('.'+cls); return e ? e.value : ''; };
      out.fixo.push({
        larg:  _q('fixo-larg'),
        alt:   _q('fixo-alt'),
        qty:   _q('fixo-qty') || '1',
        lado:  _q('fixo-lado') || 'esquerdo',
        lados: _q('fixo-lados') || '1',
        estr:  _q('fixo-estr') || 'nao'
      });
    });

    return out;
  }

  function _restoreDynBlocks(dyn){
    if(!dyn) return;

    // Limpar blocos existentes primeiro
    var acmList = document.getElementById('acm-list');
    var aluList = document.getElementById('alu-list');
    var fixoList = document.getElementById('fixos-list');
    if(acmList) acmList.innerHTML = '';
    if(aluList) aluList.innerHTML = '';
    if(fixoList) fixoList.innerHTML = '';

    // Resetar contadores internos (aC, lC) — as funções addACM/addALU usam eles
    // pra gerar IDs sequenciais. Reset não é oficial mas funciona setando zero.
    if(typeof window.aC === 'number') window.aC = 0;
    if(typeof window.lC === 'number') window.lC = 0;
    if(typeof window.fixoCount === 'number') window.fixoCount = 0;

    // Recriar ACM
    if(Array.isArray(dyn.acm) && typeof window.addACM === 'function'){
      dyn.acm.forEach(function(b){
        window.addACM();
        var last = acmList && acmList.lastElementChild;
        if(!last) return;
        var sel = last.querySelector('select[id^="acm-sel-"]');
        var qty = last.querySelector('input[id^="acm-qty-"]');
        if(sel){
          // Tenta selectedIndex direto
          if(typeof b.selectedIndex === 'number' && b.selectedIndex >= 0 && b.selectedIndex < sel.options.length){
            sel.selectedIndex = b.selectedIndex;
            // Valida por texto
            if(b.selectedText && sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text !== b.selectedText){
              for(var oi=0; oi<sel.options.length; oi++){
                if(sel.options[oi].text === b.selectedText){ sel.selectedIndex = oi; break; }
              }
            }
          } else if(b.value){
            sel.value = b.value;
          }
        }
        if(qty) qty.value = b.qty || '1';
      });
    }

    // Recriar ALU
    if(Array.isArray(dyn.alu) && typeof window.addALU === 'function'){
      dyn.alu.forEach(function(b){
        window.addALU();
        var last = aluList && aluList.lastElementChild;
        if(!last) return;
        var sel = last.querySelector('select[id^="alu-sel-"]');
        var qty = last.querySelector('input[id^="alu-qty-"]');
        if(sel){
          if(typeof b.selectedIndex === 'number' && b.selectedIndex >= 0 && b.selectedIndex < sel.options.length){
            sel.selectedIndex = b.selectedIndex;
            if(b.selectedText && sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text !== b.selectedText){
              for(var oi=0; oi<sel.options.length; oi++){
                if(sel.options[oi].text === b.selectedText){ sel.selectedIndex = oi; break; }
              }
            }
          } else if(b.value){
            sel.value = b.value;
          }
        }
        if(qty) qty.value = b.qty || '1';
      });
    }

    // Recriar Fixo
    if(Array.isArray(dyn.fixo) && typeof window.addFixo === 'function'){
      dyn.fixo.forEach(function(fx){
        window.addFixo();
        var last = fixoList && fixoList.lastElementChild;
        if(!last) return;
        var setCls = function(cls, v){ var e = last.querySelector('.'+cls); if(e) e.value = v; };
        setCls('fixo-larg',  fx.larg || '');
        setCls('fixo-alt',   fx.alt  || '');
        setCls('fixo-qty',   fx.qty  || '1');
        setCls('fixo-lado',  fx.lado || 'esquerdo');
        setCls('fixo-lados', fx.lados || '1');
        setCls('fixo-estr',  fx.estr || 'nao');
      });
    }
  }

  // ───────────────────────────────────────────────────────────────
  // HTMLs das abas + canvas
  // ───────────────────────────────────────────────────────────────
  function _captureHTMLs(){
    var out = {};
    // Aba OS: só <table> (preserva estrutura da aba mas salva conteúdo gerado)
    var tabOs = document.getElementById('tab-os');
    if(tabOs){
      var tbls = tabOs.querySelectorAll('table');
      var parts = [];
      tbls.forEach(function(t){ parts.push(t.outerHTML); });
      if(parts.length) out.osTabelas = parts.join('\n');
    }
    // Aba OSA: innerHTML do container osa-content
    var osaContent = document.getElementById('osa-content');
    if(osaContent && osaContent.innerHTML.length > 200) out.osaContent = osaContent.innerHTML;
    // Aba planificador: tabelas + (canvas vai separado)
    var tabPlan = document.getElementById('tab-planificador');
    if(tabPlan){
      var tbls2 = tabPlan.querySelectorAll('table');
      var parts2 = [];
      tbls2.forEach(function(t){ parts2.push(t.outerHTML); });
      if(parts2.length) out.planTabelas = parts2.join('\n');
    }
    // Aba Proposta: innerHTML inteiro (só se tiver conteúdo real)
    var tabProp = document.getElementById('tab-proposta');
    if(tabProp && tabProp.innerHTML.length > 500) out.propostaHTML = tabProp.innerHTML;

    // Canvas do planificador
    var pc = document.getElementById('plan-canvas');
    if(pc && pc.toDataURL){
      try {
        var d = pc.toDataURL('image/png');
        if(d && d.length > 200) out.planCanvas = d;
      } catch(e){}
    }
    return out;
  }

  function _restoreHTMLs(htmls){
    if(!htmls) return;
    // OS: substitui tabelas
    if(htmls.osTabelas) _substituirTabelas('tab-os', htmls.osTabelas);
    if(htmls.planTabelas) _substituirTabelas('tab-planificador', htmls.planTabelas);
    if(htmls.osaContent){
      var osaContent = document.getElementById('osa-content');
      if(osaContent) osaContent.innerHTML = htmls.osaContent;
    }
    if(htmls.propostaHTML){
      var tabProp = document.getElementById('tab-proposta');
      if(tabProp) tabProp.innerHTML = htmls.propostaHTML;
    }
    if(htmls.planCanvas){
      var pc = document.getElementById('plan-canvas');
      if(pc && pc.getContext){
        var img = new Image();
        img.onload = function(){
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          if(w > 0 && h > 0){
            pc.width = w; pc.height = h;
            pc.getContext('2d').drawImage(img, 0, 0);
          }
        };
        img.src = htmls.planCanvas;
      }
    }
  }

  function _substituirTabelas(abaId, htmlSalvo){
    try {
      var aba = document.getElementById(abaId);
      if(!aba || !htmlSalvo) return;
      var tmp = document.createElement('div');
      tmp.innerHTML = htmlSalvo;
      var novas = Array.prototype.slice.call(tmp.querySelectorAll('table'));
      if(!novas.length) return;
      var existentes = Array.prototype.slice.call(aba.querySelectorAll('table'));
      if(existentes.length){
        var primeira = existentes[0];
        var parent = primeira.parentNode;
        novas.forEach(function(t){ parent.insertBefore(t, primeira); });
        existentes.forEach(function(t){ if(t.parentNode) t.parentNode.removeChild(t); });
      } else {
        novas.forEach(function(t){ aba.appendChild(t); });
      }
    } catch(e){ console.warn('[Freeze] _substituirTabelas '+abaId+' falhou:', e); }
  }

  // ───────────────────────────────────────────────────────────────
  // DISPLAY SNAP (spans formatados — custoTotal, tabTotal, etc)
  // ───────────────────────────────────────────────────────────────
  function _captureDisplay(){
    try {
      if(typeof window.captureSnapshot === 'function') return window.captureSnapshot();
    } catch(e){ console.warn('[Freeze] captureSnapshot falhou:', e); }
    return null;
  }

  // ───────────────────────────────────────────────────────────────
  // SUPABASE — tabela configuracoes (chave/valor JSON)
  // ───────────────────────────────────────────────────────────────
  function _chaveDoFreeze(cardId, revNum){
    return 'freeze_'+cardId+'_rev'+revNum;
  }

  function _uploadFreeze(chave, pacote){
    return new Promise(function(resolve, reject){
      var _sbUrl = window._SB_URL, _sbKey = window._SB_KEY;
      if(!_sbUrl || !_sbKey) return reject(new Error('Supabase não configurado'));
      var body = { chave: chave, valor: pacote };
      fetch(_sbUrl+'/rest/v1/configuracoes', {
        method: 'POST',
        headers: {
          'apikey': _sbKey,
          'Authorization': 'Bearer '+_sbKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(body)
      }).then(function(r){
        if(r.ok){ resolve(chave); }
        else { reject(new Error('Upload HTTP '+r.status)); }
      }).catch(reject);
    });
  }

  function _downloadFreeze(chave){
    return new Promise(function(resolve, reject){
      var _sbUrl = window._SB_URL, _sbKey = window._SB_KEY;
      if(!_sbUrl || !_sbKey) return reject(new Error('Supabase não configurado'));
      fetch(_sbUrl+'/rest/v1/configuracoes?chave=eq.'+encodeURIComponent(chave)+'&select=valor', {
        headers: { 'apikey':_sbKey, 'Authorization':'Bearer '+_sbKey }
      }).then(function(r){ return r.json(); })
        .then(function(arr){
          if(!arr || !arr.length) return reject(new Error('Freeze não encontrado: '+chave));
          resolve(arr[0].valor);
        }).catch(reject);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // API: capturarCompleto
  // ═══════════════════════════════════════════════════════════════
  async function capturarCompleto(cardId, revNum, revLabel){
    console.log('[Freeze] 📸 Capturando card='+cardId+' rev='+revNum);
    if(!cardId) throw new Error('cardId obrigatório');
    if(typeof revNum !== 'number') revNum = 0;

    // Montar pacote
    var pacote = {
      version:      '1.0',
      cardId:       cardId,
      revNum:       revNum,
      revLabel:     revLabel || ('Rev '+revNum),
      capturadoEm:  new Date().toISOString(),
      inputs:       _captureInputs(),
      dynBlocks:    _captureDynBlocks(),
      globals:      _captureGlobals(),
      display:      _captureDisplay(),
      htmls:        _captureHTMLs()
    };

    // Log do tamanho
    var tam = 0;
    try { tam = JSON.stringify(pacote).length; } catch(e){}
    console.log('[Freeze] 📦 Pacote '+(Math.round(tam/1024))+' KB — '+
      Object.keys(pacote.inputs).length+' abas inputs, '+
      pacote.dynBlocks.acm.length+' ACM, '+pacote.dynBlocks.alu.length+' ALU, '+
      pacote.dynBlocks.fixo.length+' fixo, '+
      Object.keys(pacote.globals).length+' globals, '+
      (pacote.htmls.propostaHTML?'proposta✓ ':'')+
      (pacote.htmls.osTabelas?'os✓ ':'')+
      (pacote.htmls.planTabelas?'plan✓ ':'')+
      (pacote.htmls.planCanvas?'canvas✓':''));

    var chave = _chaveDoFreeze(cardId, revNum);
    await _uploadFreeze(chave, pacote);

    // Atualizar card com flag
    try {
      var CK = 'projetta_crm_v1';
      var data = JSON.parse(localStorage.getItem(CK) || '[]');
      var ci = data.findIndex(function(o){ return o.id === cardId; });
      if(ci >= 0 && data[ci].revisoes && data[ci].revisoes[revNum]){
        data[ci].revisoes[revNum].freezeKey = chave;
        data[ci].revisoes[revNum].freezeDate = new Date().toISOString();
        data[ci].revisoes[revNum].freezeVersion = '1.0';
        localStorage.setItem(CK, JSON.stringify(data));
      }
    } catch(e){ console.warn('[Freeze] erro atualizar card:', e); }

    console.log('[Freeze] ✅ Salvo em '+chave);
    return { chave: chave, tamanho: tam };
  }

  // ═══════════════════════════════════════════════════════════════
  // API: abrirRevisao
  // ═══════════════════════════════════════════════════════════════
  async function abrirRevisao(cardId, revNum){
    console.log('[Freeze] 📂 Abrindo card='+cardId+' rev='+revNum);
    if(typeof revNum !== 'number') revNum = 0;

    // Pegar chave do card
    var data = JSON.parse(localStorage.getItem('projetta_crm_v1') || '[]');
    var card = data.find(function(o){ return o.id === cardId; });
    if(!card) throw new Error('Card não encontrado');
    if(!card.revisoes || !card.revisoes[revNum]) throw new Error('Revisão não encontrada');
    var rev = card.revisoes[revNum];
    var chave = rev.freezeKey;
    if(!chave) throw new Error('Esta revisão não tem freeze (foi salva com sistema antigo). Refaça o orçamento e clique "Orçamento Pronto" para criar um freeze novo.');

    // Baixar
    var pacote = await _downloadFreeze(chave);
    if(!pacote || pacote.version !== '1.0') throw new Error('Freeze formato inválido');

    // Fechar modal CRM se aberto
    var crmModal = document.getElementById('crm-modal');
    if(crmModal) crmModal.style.display = 'none';

    // Ir pra aba Orçamento primeiro
    if(typeof window.switchTab === 'function') window.switchTab('orcamento');
    await _sleep(200);

    // Setar vinculação do card (pra ATP funcionar)
    window._crmOrcCardId = cardId;

    // 1) Restaurar globals PRIMEIRO (pra funções que dependem deles funcionarem)
    _restoreGlobals(pacote.globals);

    // 2) Restaurar blocos dinâmicos (recria DOM)
    _restoreDynBlocks(pacote.dynBlocks);

    // 3) Restaurar inputs (precisa dos blocos já criados)
    _restoreInputs(pacote.inputs);

    // 4) Restaurar HTMLs gerados das abas
    _restoreHTMLs(pacote.htmls);

    // 5) Aplicar handlers de show/hide baseados em inputs restaurados
    //    (toggleInstQuem mostra/esconde bloco PROJETTA/TERCEIROS/INTERNACIONAL)
    try { if(typeof window.toggleInstQuem === 'function') window.toggleInstQuem(); } catch(e){}
    try { if(typeof window.toggleFixosVisibility === 'function') window.toggleFixosVisibility(); } catch(e){}

    // 6) Restaurar displaySnap (spans formatados com R$) — POR ÚLTIMO
    if(pacote.display && typeof window._restoreSnapshotDisplay === 'function'){
      try { window._restoreSnapshotDisplay(pacote.display); }
      catch(e){ console.warn('[Freeze] _restoreSnapshotDisplay falhou:', e); }
    }

    // 7) Re-renderizar painéis multi-cor (sem recalcular bin-packing)
    try {
      if(typeof window._plnRenderColorTabs === 'function') window._plnRenderColorTabs();
      if(typeof window._plnRenderCoresPainel === 'function') window._plnRenderCoresPainel();
    } catch(e){}

    // 8) Travar form em somente-leitura + banner amarelo
    _aplicarReadOnly(true, card.cliente || '—', rev.label || ('Revisão '+revNum), rev.data || pacote.capturadoEm);

    // 9) Marcar ID da revisão atual pra "Nova Revisão" saber de qual duplicar
    window._freezeOpen = { cardId: cardId, revNum: revNum };

    console.log('[Freeze] ✅ Revisão carregada no orçamento — '+rev.label);
    return pacote;
  }

  // ═══════════════════════════════════════════════════════════════
  // READ-ONLY MODE + BANNER AMARELO
  // ═══════════════════════════════════════════════════════════════
  function _aplicarReadOnly(on, cliente, revLabel, revDate){
    var BANNER_ID = 'freeze-banner';
    var old = document.getElementById(BANNER_ID);
    if(old) old.remove();

    if(!on){
      // Destravar: reabilitar inputs
      document.querySelectorAll('[data-freeze-locked="1"]').forEach(function(el){
        el.disabled = false;
        el.style.opacity = '';
        el.removeAttribute('data-freeze-locked');
      });
      window._freezeOpen = null;
      return;
    }

    // Criar banner
    var dt = revDate ? new Date(revDate).toLocaleString('pt-BR') : '';
    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.style.cssText = 'position:sticky;top:0;z-index:1000;background:#fff3cd;border-bottom:2px solid #ffc107;color:#7a5901;padding:12px 20px;display:flex;align-items:center;gap:16px;font-size:13px;font-weight:600;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.08)';
    banner.innerHTML =
      '<span style="font-size:18px">🔒</span>'+
      '<div style="flex:1">'+
        '<div style="font-weight:800;font-size:14px;color:#6b4c00">SOMENTE LEITURA — '+_escHTML(cliente)+' — '+_escHTML(revLabel)+(dt?' <span style="font-weight:400;opacity:.75">(salvo em '+dt+')</span>':'')+'</div>'+
        '<div style="font-size:11px;margin-top:2px;opacity:.8">Para modificar, clique em <b>Nova Revisão</b> — será criada uma cópia editável.</div>'+
      '</div>'+
      '<button id="freeze-btn-nova-rev" style="background:#e67e22;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">📝 Nova Revisão</button>'+
      '<button id="freeze-btn-voltar" style="background:#003144;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">← Voltar ao CRM</button>';

    // Inserir no topo de tab-orcamento
    var tabOrc = document.getElementById('tab-orcamento');
    if(tabOrc && tabOrc.firstChild) tabOrc.insertBefore(banner, tabOrc.firstChild);
    else if(tabOrc) tabOrc.appendChild(banner);

    // Handlers
    document.getElementById('freeze-btn-nova-rev').onclick = function(){
      _novaRevisao();
    };
    document.getElementById('freeze-btn-voltar').onclick = function(){
      _voltarAoCrm();
    };

    // Travar todos inputs das abas alvo (exceto botões de navegação)
    TABS_ALVO.concat(['tab-proposta']).forEach(function(tabId){
      var tab = document.getElementById(tabId);
      if(!tab) return;
      var els = tab.querySelectorAll('input, select, textarea, button');
      els.forEach(function(el){
        // Excluir o botão "Nova Revisão" e "Voltar" do próprio banner
        if(el.id === 'freeze-btn-nova-rev' || el.id === 'freeze-btn-voltar') return;
        // Excluir botões de navegação/expansão (cabeçalhos de acordeão)
        if(el.tagName === 'BUTTON'){
          var t = (el.textContent||'').toLowerCase();
          // Só trava botões que executam ações (gerar/calcular/salvar), não os de nav
          if(!/gerar|calcular|salvar|pronto|atualizar|revisão|imprimir|exportar|pdf|atp/.test(t)) return;
        }
        if(!el.disabled){
          el.disabled = true;
          el.style.opacity = '0.75';
          el.setAttribute('data-freeze-locked', '1');
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Nova Revisão — destrava e marca que próximo "Orçamento Pronto"
  // deve criar nova revisão (não sobrescrever).
  // ═══════════════════════════════════════════════════════════════
  function _novaRevisao(){
    var open = window._freezeOpen;
    if(!open){ alert('Nenhuma revisão aberta'); return; }
    if(!confirm('Destravar pra editar? Será criada uma nova revisão ao clicar em "Orçamento Pronto" depois.')) return;

    // Destravar UI
    _aplicarReadOnly(false);
    // Marcar pendente de nova revisão
    window._pendingRevision = true;
    // Tornar id atual "aberto pra nova rev"
    window._crmOrcCardId = open.cardId;

    // Toast
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#e67e22;color:#fff;padding:12px 24px;border-radius:24px;font-size:13px;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    t.textContent = '✏️ Modo edição — clique em "Orçamento Pronto" quando terminar';
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 5000);
  }

  // ═══════════════════════════════════════════════════════════════
  // Voltar ao CRM — destrava + troca pra aba CRM
  // ═══════════════════════════════════════════════════════════════
  function _voltarAoCrm(){
    _aplicarReadOnly(false);
    if(typeof window.switchTab === 'function') window.switchTab('crm');
  }

  function _sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function _escHTML(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ═══════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════
  window.OrcamentoFreeze = {
    version: '1.0',
    capturar: capturarCompleto,
    abrir:    abrirRevisao,
    destravar: function(){ _aplicarReadOnly(false); },
    voltarAoCrm: _voltarAoCrm,
    novaRevisao: _novaRevisao
  };

  console.log('[OrcamentoFreeze] v1.0 carregado');
})();
