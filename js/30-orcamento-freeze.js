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
  function _chaveDoFreeze(cardId, opcaoId, revNum){
    // Back-compat: se chamado com 2 args (cardId, revNum) sem opcaoId,
    // assume opt1 (formato antigo).
    if(typeof opcaoId === 'number' && typeof revNum === 'undefined'){
      revNum = opcaoId;
      opcaoId = 'opt1';
    }
    if(window.OrcamentoOpcoes && typeof window.OrcamentoOpcoes.freezeKey === 'function'){
      return window.OrcamentoOpcoes.freezeKey(cardId, opcaoId||'opt1', revNum);
    }
    return 'freeze_'+cardId+'_rev'+revNum;
  }

  // Descobre a opção ativa do card lendo projetta_crm_v1.
  // Retorna 'opt1' como fallback (cards legados / sem opções).
  function _opcaoAtivaDoCard(cardId){
    try {
      var data = JSON.parse(localStorage.getItem('projetta_crm_v1') || '[]');
      var card = data.find(function(o){ return o.id===cardId; });
      if(!card) return 'opt1';
      if(window.OrcamentoOpcoes && typeof window.OrcamentoOpcoes.migrar === 'function'){
        window.OrcamentoOpcoes.migrar(card);
        return card.opcaoAtivaId || 'opt1';
      }
      return 'opt1';
    } catch(e){ return 'opt1'; }
  }

  function _uploadFreeze(chave, pacote){
    return new Promise(function(resolve, reject){
      var _sbUrl = window._SB_URL, _sbKey = window._SB_KEY;
      if(!_sbUrl || !_sbKey) return reject(new Error('Supabase não configurado'));
      var body = { chave: chave, valor: pacote };

      // ★ Timeout de 20s via AbortController: sem isso, se o Supabase estiver
      //   com rate limit ou fora do ar, a Promise fica pendurada pra sempre
      //   e o toast "Congelando revisão completa..." nunca some.
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timeoutId = setTimeout(function(){
        if(ctrl) ctrl.abort();
        reject(new Error('Timeout 10s — Supabase não respondeu.'));
      }, 10000);

      fetch(_sbUrl+'/rest/v1/configuracoes', {
        method: 'POST',
        headers: {
          'apikey': _sbKey,
          'Authorization': 'Bearer '+_sbKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function(r){
        clearTimeout(timeoutId);
        if(r.ok){ resolve(chave); }
        else { reject(new Error('Upload HTTP '+r.status)); }
      }).catch(function(err){
        clearTimeout(timeoutId);
        if(err && err.name === 'AbortError') return; // já rejeitou via timeout
        reject(err);
      });
    });
  }

  function _downloadFreeze(chave){
    return new Promise(function(resolve, reject){
      var _sbUrl = window._SB_URL, _sbKey = window._SB_KEY;
      if(!_sbUrl || !_sbKey) return reject(new Error('Supabase não configurado'));
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timeoutId = setTimeout(function(){
        if(ctrl) ctrl.abort();
        reject(new Error('Timeout 10s — Supabase não respondeu.'));
      }, 10000);
      fetch(_sbUrl+'/rest/v1/configuracoes?chave=eq.'+encodeURIComponent(chave)+'&select=valor', {
        headers: { 'apikey':_sbKey, 'Authorization':'Bearer '+_sbKey },
        signal: ctrl ? ctrl.signal : undefined
      }).then(function(r){ return r.json(); })
        .then(function(arr){
          clearTimeout(timeoutId);
          if(!arr || !arr.length) return reject(new Error('Freeze não encontrado: '+chave));
          resolve(arr[0].valor);
        }).catch(function(err){
          clearTimeout(timeoutId);
          if(err && err.name === 'AbortError') return;
          reject(err);
        });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // duplicarFreeze: copia o pacote salvo em `chaveOrigem` para
  // `chaveDestino`. Usado ao criar uma nova Opção a partir de outra
  // (Felipe: "criar nova opção duplica a anterior como base").
  //
  // Tenta localStorage primeiro (rápido), cai em Supabase se não tem
  // local. Grava no destino em Supabase + localStorage (best-effort).
  // ═══════════════════════════════════════════════════════════════
  async function duplicarFreeze(chaveOrigem, chaveDestino, novoCardId, novoRevNum, novoOpcaoId){
    if(!chaveOrigem || !chaveDestino) throw new Error('chaves origem/destino obrigatórias');
    if(chaveOrigem === chaveDestino) throw new Error('chaves origem e destino iguais');

    // 1) Buscar pacote origem
    var pacote = null;
    try {
      var local = localStorage.getItem(chaveOrigem);
      if(local){
        pacote = JSON.parse(local);
        console.log('[Freeze] 📦 Duplicando de localStorage: '+chaveOrigem);
      }
    } catch(e){}
    if(!pacote){
      pacote = await _downloadFreeze(chaveOrigem);
      console.log('[Freeze] 📦 Duplicando de Supabase: '+chaveOrigem);
    }
    if(!pacote || pacote.version !== '1.0') throw new Error('Pacote origem inválido');

    // 2) Ajustar metadados do pacote pro destino
    pacote.cardId      = novoCardId || pacote.cardId;
    pacote.revNum      = (typeof novoRevNum === 'number') ? novoRevNum : 0;
    pacote.opcaoId     = novoOpcaoId || pacote.opcaoId || 'opt1';
    pacote.revLabel    = 'Original';
    pacote.capturadoEm = new Date().toISOString();
    pacote.duplicadoDe = chaveOrigem;

    // 3) Gravar no destino — Supabase primário
    await _uploadFreeze(chaveDestino, pacote);
    console.log('[Freeze] ☁️ Duplicado pra Supabase: '+chaveDestino);

    // 4) Backup em localStorage (best-effort, não quebra se quota)
    try { localStorage.setItem(chaveDestino, JSON.stringify(pacote)); }
    catch(e){ console.warn('[Freeze] Duplicado local falhou (quota):', e.message); }

    return { chave: chaveDestino, origem: chaveOrigem };
  }

  // ═══════════════════════════════════════════════════════════════
  // API: capturarCompleto
  // ═══════════════════════════════════════════════════════════════
  //
  // ARQUITETURA v1.1 (20/04/2026 — após diagnóstico de Supabase travando):
  // - localStorage é a STORAGE PRIMÁRIA (rápido, síncrono, sempre funciona)
  // - Supabase é BACKUP em background (sem await, não bloqueia UI)
  // - Se Supabase estiver down/rate-limitado, fluxo não trava
  // - Abrir revisão tenta localStorage primeiro → só usa Supabase se
  //   localStorage não tiver o freeze (ex: outro dispositivo)
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

    var opcaoId = _opcaoAtivaDoCard(cardId);
    var chave   = _chaveDoFreeze(cardId, opcaoId, revNum);
    pacote.opcaoId = opcaoId;

    // ═══════════════════════════════════════════════════════════════
    // ARQUITETURA v1.2 (20/04/2026 tarde — Supabase voltou saudável):
    // - Supabase é a STORAGE PRIMÁRIA (fonte da verdade, multi-device).
    // - localStorage é BACKUP opcional (acelera reabrir, sem quebrar se
    //   quota estourar).
    // Motivação: no notebook de Felipe, projetta_v3 ocupava 4.89MB do
    // localStorage (histórico antigo pré-CRM). Qualquer freeze adicional
    // estourava quota e bloqueava salvar. Agora Supabase é fonte
    // primária e localStorage só acelera — se não couber, tudo bem.
    // ═══════════════════════════════════════════════════════════════

    // ★ PRIMÁRIO: Supabase (com timeout 10s). Bloqueia até confirmar.
    var supabaseOk = false;
    try {
      await _uploadFreeze(chave, pacote);
      supabaseOk = true;
      console.log('[Freeze] ☁️ Salvo no Supabase: '+chave+' ('+Math.round(tam/1024)+' KB)');
    } catch(e){
      console.warn('[Freeze] ☁️ Supabase falhou:', e.message);
      // Se Supabase falhou, tenta localStorage como última opção
      try {
        localStorage.setItem(chave, JSON.stringify(pacote));
        console.log('[Freeze] 💾 Salvo em localStorage (fallback, Supabase caiu)');
      } catch(e2){
        if(e2.name === 'QuotaExceededError' || /quota/i.test(e2.message||'')){
          _limparFreezesOrfaos();
          try { localStorage.setItem(chave, JSON.stringify(pacote)); }
          catch(e3){
            throw new Error('Supabase indisponível e localStorage cheio. Aguarde 1 minuto e tente novamente.');
          }
        } else {
          throw new Error('Supabase falhou ('+e.message+') e localStorage deu erro ('+e2.message+').');
        }
      }
    }

    // ★ BACKUP: se Supabase OK, tenta salvar também em localStorage (melhor-esforço).
    //   Se quota estourar, NÃO propaga erro — Supabase já tem a verdade.
    if(supabaseOk){
      try {
        localStorage.setItem(chave, JSON.stringify(pacote));
        console.log('[Freeze] 💾 Backup local OK');
      } catch(e){
        // Quota estourou? limpa órfãos e tenta de novo silenciosamente
        if(e.name === 'QuotaExceededError' || /quota/i.test(e.message||'')){
          try {
            _limparFreezesOrfaos();
            localStorage.setItem(chave, JSON.stringify(pacote));
          } catch(e2){
            console.warn('[Freeze] 💾 Backup local não coube (quota cheia) — OK, Supabase tem.');
          }
        } else {
          console.warn('[Freeze] 💾 Backup local falhou (não crítico):', e.message);
        }
      }
    }

    // ★ Persistir freezeKey na revisão do card (via cSave se disponível,
    //   pra propagar pro CRM sync).
    function _aplicarFreezeKey(tentativa){
      try {
        var CK = 'projetta_crm_v1';
        var data = JSON.parse(localStorage.getItem(CK) || '[]');
        var ci = data.findIndex(function(o){ return o.id === cardId; });
        if(ci < 0) return false;
        // Garante estrutura opcoes[] e card.revisoes apontando pra ativa.
        if(window.OrcamentoOpcoes) window.OrcamentoOpcoes.migrar(data[ci]);
        if(!data[ci].revisoes || !data[ci].revisoes[revNum]) return false;
        if(data[ci].revisoes[revNum].freezeKey === chave) return true;
        data[ci].revisoes[revNum].freezeKey     = chave;
        data[ci].revisoes[revNum].freezeDate    = new Date().toISOString();
        data[ci].revisoes[revNum].freezeVersion = '1.0';
        if(typeof window.cSave === 'function'){
          try { window.cSave(data); return true; }
          catch(e){}
        }
        // Fallback direto: precisa persistir opcoes[ativa].revisoes ← card.revisoes
        if(window.OrcamentoOpcoes) window.OrcamentoOpcoes.persistir(data[ci]);
        localStorage.setItem(CK, JSON.stringify(data));
        return true;
      } catch(e){ return false; }
    }
    _aplicarFreezeKey(1);
    setTimeout(function(){ _aplicarFreezeKey(2); }, 1200);
    setTimeout(function(){ _aplicarFreezeKey(3); }, 3500);

    console.log('[Freeze] ✅ Congelado: '+chave);
    return { chave: chave, tamanho: tam };
  }

  // ═══════════════════════════════════════════════════════════════
  // Limpeza de freezes de cards que já foram deletados do CRM
  // ═══════════════════════════════════════════════════════════════
  function _limparFreezesOrfaos(){
    var crm = [];
    try { crm = JSON.parse(localStorage.getItem('projetta_crm_v1') || '[]'); } catch(e){}
    var cardIds = crm.map(function(c){ return c.id; });
    var removidos = 0;
    for(var i=localStorage.length-1; i>=0; i--){
      var k = localStorage.key(i);
      if(!/^freeze_/.test(k)) continue;
      var m = k.match(/^freeze_(.+)_rev\d+$/);
      if(!m) continue;
      if(cardIds.indexOf(m[1]) < 0){
        localStorage.removeItem(k);
        removidos++;
      }
    }
    console.log('[Freeze] 🗑 '+removidos+' freezes órfãos removidos');
    return removidos;
  }

  // ═══════════════════════════════════════════════════════════════
  // API: abrirRevisao (v1.1)
  // LocalStorage primário, Supabase fallback apenas
  // ═══════════════════════════════════════════════════════════════
  async function abrirRevisao(cardId, revNum){
    console.log('[Freeze] 📂 Abrindo card='+cardId+' rev='+revNum);
    if(typeof revNum !== 'number') revNum = 0;

    // Pegar chave do card
    var data = JSON.parse(localStorage.getItem('projetta_crm_v1') || '[]');
    var card = data.find(function(o){ return o.id === cardId; });
    if(!card) throw new Error('Card não encontrado');
    // Garante estrutura opcoes[] e card.revisoes apontando pra opção ativa.
    if(window.OrcamentoOpcoes) window.OrcamentoOpcoes.migrar(card);
    if(!card.revisoes || !card.revisoes[revNum]) throw new Error('Revisão não encontrada');
    var rev = card.revisoes[revNum];
    var chave = rev.freezeKey;
    if(!chave) throw new Error('Esta revisão não tem freeze (foi salva com sistema antigo). Refaça o orçamento e clique "Orçamento Pronto" para criar um freeze novo.');

    // ★ LOCALSTORAGE PRIMEIRO (instantâneo, sem rede)
    var pacote = null;
    try {
      var local = localStorage.getItem(chave);
      if(local){
        pacote = JSON.parse(local);
        console.log('[Freeze] 📦 Carregado do localStorage (instantâneo)');
      }
    } catch(e){ console.warn('[Freeze] localStorage parse falhou:', e); }

    // ★ Se não tinha local, tentar Supabase (backup de outro dispositivo)
    if(!pacote){
      console.log('[Freeze] ☁️ localStorage vazio, tentando Supabase...');
      pacote = await _downloadFreeze(chave);
    }

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

    // ★ 2) Restaurar INPUTS ANTES dos blocos dinâmicos (ORDEM CRÍTICA).
    //     Bug descoberto: antes eu restaurava blocos dinâmicos primeiro → ao
    //     setar selectedIndex do select ACM, as options do select ainda
    //     estavam filtradas pra outro tamanho de chapa (default 1500×7000).
    //     O selectedIndex apontava pra posição errada (ex: salvo 1500×5000
    //     R$ 1.214,24, mas options só tinham 1500×7000 R$ 1.699,94).
    //     Agora: restaurar plan-chapa/plan-chapa-larg/plan-chapa-alt/aprov-chapa*
    //     PRIMEIRO, depois refiltrar ACM options, depois criar blocos.
    _restoreInputs(pacote.inputs);

    // ★ 3) Refiltrar options do ACM com o tamanho de chapa correto.
    //     plan-chapa foi restaurado no passo 2 com valor "1500|5000" por ex.
    //     filtrarChapasACM lê plan-chapa + plan-chapa-larg/alt e repopula
    //     os selects de todos os blocos ACM com as chapas daquele tamanho.
    //     Sem isso, selectedIndex posterior aponta pra option errada.
    try {
      if(typeof window.filtrarChapasACM === 'function') window.filtrarChapasACM();
    } catch(e){ console.warn('[Freeze] filtrarChapasACM falhou:', e); }

    // 4) Restaurar blocos dinâmicos (recria DOM + aplica selectedIndex).
    //    Agora as options já estão filtradas pelo tamanho correto →
    //    selectedIndex e fallback por texto funcionam certinho.
    _restoreDynBlocks(pacote.dynBlocks);

    // 5) Restaurar HTMLs gerados das abas (tabelas, proposta, canvas)
    _restoreHTMLs(pacote.htmls);

    // 6) Aplicar handlers de show/hide baseados em inputs restaurados
    //    (toggleInstQuem mostra/esconde bloco PROJETTA/TERCEIROS/INTERNACIONAL)
    try { if(typeof window.toggleInstQuem === 'function') window.toggleInstQuem(); } catch(e){}
    try { if(typeof window.toggleFixosVisibility === 'function') window.toggleFixosVisibility(); } catch(e){}

    // 7) Restaurar displaySnap (spans formatados com R$) — POR ÚLTIMO
    if(pacote.display && typeof window._restoreSnapshotDisplay === 'function'){
      try { window._restoreSnapshotDisplay(pacote.display); }
      catch(e){ console.warn('[Freeze] _restoreSnapshotDisplay falhou:', e); }
    }

    // 8) Re-renderizar painéis multi-cor (sem recalcular bin-packing)
    try {
      if(typeof window._plnRenderColorTabs === 'function') window._plnRenderColorTabs();
      if(typeof window._plnRenderCoresPainel === 'function') window._plnRenderCoresPainel();
    } catch(e){}

    // ★ 8B) ABRIR TODOS os accordions (bodies) pra usuário ver tudo.
    //       Bug descoberto: plan-body e outros accordions ficam display:none
    //       por padrão. Ao abrir revisão, a aba Levantamento de Superfícies
    //       aparecia vazia (só o título "PLANIFICAR CHAPAS") porque o
    //       plan-body estava oculto.
    //       Solução: abrir ident-body, dim-body, carac-body, param-body,
    //       fab-body, acess-body, inst-body, plan-body — todos display:block.
    var _bodies = ['ident-body','dim-body','carac-body','param-body','fab-body','acess-body','inst-body','plan-body'];
    _bodies.forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.style.display = 'block';
    });
    // Atualizar badges dos accordions ("▲ fechar" ao invés de "▼ abrir")
    var _badges = ['ident-badge','dim-badge','carac-badge','param-badge','fab-badge','inst-badge','plan-badge'];
    _badges.forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.innerHTML = '&#9650; fechar';
    });
    // Forçar plan-result visível (tabela de resultado do planificador)
    var planResult = document.getElementById('plan-result');
    if(planResult) planResult.style.display = '';
    // Forçar os-doc visível (documento OS na aba Levantamento de Perfis)
    var osDoc = document.getElementById('os-doc');
    if(osDoc) osDoc.style.display = '';
    var osEmpty = document.getElementById('os-empty');
    if(osEmpty) osEmpty.style.display = 'none';

    // 9) Travar form em somente-leitura + banner amarelo
    _aplicarReadOnly(true, card.cliente || '—', rev.label || ('Revisão '+revNum), rev.data || pacote.capturadoEm);

    // 10) Marcar ID da revisão atual pra "Nova Revisão" saber de qual duplicar
    window._freezeOpen = { cardId: cardId, revNum: revNum };

    // ★ 11) Mostrar botão "Gerar ATP" APENAS se card está em etapa "Ganho".
    //       Felipe: "só faça botão de Gerar ATP aparecer se você clicar 2
    //       vezes em alguma versão (original ou revisão) de um card que
    //       estiver em GANHO".
    //       Detecta etapa won pela label (mesmo padrão do crmStats: /gan|won/i).
    try {
      var atpBtn = document.getElementById('btn-gerar-atp');
      if(atpBtn){
        var settings = JSON.parse(localStorage.getItem('projetta_crm_settings_v1') || '{}');
        var stages = (settings.stages || []);
        var stage = stages.find(function(s){ return s.id === card.stage; });
        var isGanho = stage && /gan|won/i.test(stage.label || '');
        atpBtn.style.display = isGanho ? '' : 'none';
        console.log('[Freeze] ATP btn: card stage="'+(stage?stage.label:'?')+'" → '+(isGanho?'VISIVEL':'oculto'));
      }
    } catch(e){ console.warn('[Freeze] erro ao condicionar ATP:', e); }

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
      // ★ Esconder botão ATP ao sair do modo freeze (Felipe: ATP só aparece
      //    com duplo-clique em revisão de card em etapa Ganho).
      var atpBtn = document.getElementById('btn-gerar-atp');
      if(atpBtn) atpBtn.style.display = 'none';
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
    novaRevisao: _novaRevisao,
    duplicar: duplicarFreeze
  };

  console.log('[OrcamentoFreeze] v1.0 carregado');
})();
