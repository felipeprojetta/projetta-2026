(() => {
  if (window.__MOD_134_V2_LOADED) return;
  window.__MOD_134_V2_LOADED = true;

  // ═══════════════════════════════════════════════════════════════
  // REGRAS FIXAS:
  // 1. Stage "Fazer Orcamento" / "Qualificacao" → 0 (sem orcamento ainda)
  // 2. Cambio = o.inst_cambio (do card) || projettaCambio.get()
  // 3. Maritimo final = cif_frete_maritimo × 1.20
  // 4. Internacional: Tab = Fat = Total
  // ═══════════════════════════════════════════════════════════════

  function getCambio(o) {
    // Prioridade: cambio salvo no proprio card
    var cardCambio = parseFloat((o && o.inst_cambio) || 0);
    if (isFinite(cardCambio) && cardCambio > 0) return cardCambio;
    // Fallback: cambio digitado pelo usuario na sessao atual
    if (window.projettaCambio) {
      var c = window.projettaCambio.get();
      if (isFinite(c) && c > 0) return c;
    }
    return 0; // sem cambio = nao calcula
  }

  function ehInternacional(o) {
    if (!o) return false;
    return o.scope === 'internacional'
      || (o.inst_quem||'').toString().toUpperCase() === 'INTERNACIONAL'
      || ['CIF','FOB','EXW'].indexOf((o.inst_incoterm||'').toString().toUpperCase()) >= 0
      || !!(o.pais||'').toString().trim();
  }

  function isStagePreOrc(stageId) {
    var stages = window.gStages ? window.gStages() : [];
    var st = stages.find(function(s){return s.id === stageId;});
    if (!st) return true;
    var lbl = (st.label || '').toString().toLowerCase();
    return /fazer.*or[çc]|qualifi/i.test(lbl);
  }

  function calcCardBRL(o) {
    if (!o) return 0;
    if (isStagePreOrc(o.stage)) return 0; // ★ sem orcamento ainda

    var _vDireto = parseFloat(o.valorFaturamento) || parseFloat(o.valorTabela) || parseFloat(o.valor) || 0;
    if (_vDireto === 0) return 0;
    var _vPorta = _vDireto;

    if (!ehInternacional(o)) return _vPorta;

    var _cambio = getCambio(o);
    if (_cambio <= 0) return _vPorta; // sem cambio, so a porta

    // Instalacao (deixa logica original)
    var _vInst = parseFloat(o.inst_intl_fat) || 0;
    if (_vInst === 0) {
      var _pas = parseFloat(o.inst_passagem) || 0;
      var _ho = parseFloat(o.inst_hotel) || 0;
      var _al = parseFloat(o.inst_alim) || 0;
      var _ud = parseFloat(o.inst_udigru) || 0;
      if ((_pas + _ho + _al + _ud) > 0) {
        var _seg = parseFloat(o.inst_seguro) || 0;
        var _car = parseFloat(o.inst_carro) || 0;
        var _mo = parseFloat(o.inst_mo) || 0;
        var _pes = parseInt(o.inst_pessoas) || 3;
        var _di = parseInt(o.inst_dias) || 3;
        var _dT = _di + 4, _dH = _dT - 2;
        var _mg = parseFloat(o.inst_margem) || 10;
        var _custo = _ud + (_pas*_pes) + (_ho*_dH) + (_al*_pes*_dT) + (_seg*_pes) + (_car*_dT) + (_mo*_dT);
        _vInst = _custo / Math.max(0.01, 1 - _mg/100);
      }
    }

    var _inc = (o.inst_incoterm||'').toUpperCase();
    var _logUsd = 0;
    if (_inc === 'CIF' || _inc === 'FOB') {
      var _L = parseFloat(o.cif_caixa_l) || 0;
      var _A = parseFloat(o.cif_caixa_a) || 0;
      var _E = parseFloat(o.cif_caixa_e) || 0;
      var _tx = parseFloat(o.cif_caixa_taxa) || 100;
      _logUsd += (_L/1000)*(_A/1000)*(_E/1000) * _tx;
      _logUsd += parseFloat(o.cif_frete_terrestre) || 0;
    }
    if (_inc === 'CIF') {
      _logUsd += (parseFloat(o.cif_frete_maritimo) || 0) * 1.20;
    }

    return _vPorta + _vInst + (_logUsd * _cambio);
  }

  function calcCardTabBRL(o) {
    if (!o) return 0;
    if (isStagePreOrc(o.stage)) return 0;
    if (ehInternacional(o)) return calcCardBRL(o); // intl: Tab = Total
    return parseFloat(o.valorTabela) || 0;
  }

  function fmtBRL(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }

  function patchKPIs() {
    if (typeof window.cLoad !== 'function') return;
    var data;
    try { data = window.cLoad(); } catch(e){ return; }
    if (!Array.isArray(data)) return;

    var gStages = window.gStages || function(){ return []; };
    var stages = gStages();
    var wonIds = stages.filter(function(s){ return /gan|won/i.test(s.label||''); }).map(function(s){return s.id;});
    var lostIds = stages.filter(function(s){ return /perd|lost/i.test(s.label||''); }).map(function(s){return s.id;});

    var ativos = data.filter(function(o){ return o && !o.deleted_at && wonIds.indexOf(o.stage)<0 && lostIds.indexOf(o.stage)<0; });

    var pipe = ativos.reduce(function(s,o){ return s + calcCardBRL(o); }, 0);
    var totTab = ativos.reduce(function(s,o){ return s + calcCardTabBRL(o); }, 0);
    var totFat = ativos.reduce(function(s,o){ return s + calcCardBRL(o); }, 0);

    function setText(id, txt) {
      var el = document.getElementById(id);
      if (el && el.textContent !== txt) el.textContent = txt;
    }

    setText('ck-pipe', fmtBRL(pipe));
    setText('ck-tot-tab', fmtBRL(totTab));
    setText('ck-tot-fat', fmtBRL(totFat));

    // Subtitle do tot-tab e tot-fat: contar quantos cards REALMENTE com valor (>0)
    var ckTotTabSub = document.getElementById('ck-tot-tab-s');
    if (ckTotTabSub) {
      var n = ativos.filter(function(o){ return calcCardTabBRL(o) > 0; }).length;
      ckTotTabSub.textContent = n + ' com tabela';
    }
    var ckTotFatSub = document.getElementById('ck-tot-fat-s');
    if (ckTotFatSub) {
      var n2 = ativos.filter(function(o){ return calcCardBRL(o) > 0; }).length;
      ckTotFatSub.textContent = n2 + ' com faturamento';
    }
  }

  function patchKanbanHeaders() {
    if (typeof window.cLoad !== 'function') return;
    var data;
    try { data = window.cLoad(); } catch(e){ return; }
    if (!Array.isArray(data)) return;

    var stagesEl = document.querySelectorAll('.crm-stage');
    if (!stagesEl.length) return;

    stagesEl.forEach(function(stage){
      var stageId = stage.getAttribute('data-stage');
      if (!stageId) return;
      var cards = data.filter(function(o){ return o && o.stage === stageId && !o.deleted_at; });

      var tv = 0, tvTab = 0;
      cards.forEach(function(o){
        tv += calcCardBRL(o);
        tvTab += calcCardTabBRL(o);
      });

      var header = stage.querySelector('.crm-stage-header');
      if (!header) return;
      var vals = header.querySelectorAll('.crm-stage-val');
      vals.forEach(function(el){
        var t = (el.textContent || '').trim();
        if (/^Tab:/i.test(t)) {
          var novoTab = tvTab > 0 ? 'Tab: ' + fmtBRL(tvTab) : '';
          if (el.textContent !== novoTab) el.textContent = novoTab;
        } else if (/^Fat:/i.test(t)) {
          var novoFat = tv > 0 ? 'Fat: ' + fmtBRL(tv) : '';
          if (el.textContent !== novoFat) el.textContent = novoFat;
        }
      });
    });
  }

  function patchTudo() {
    patchKPIs();
    patchKanbanHeaders();
  }

  setInterval(patchTudo, 1500);
  setTimeout(patchTudo, 500);

  function observe() {
    var pipe = document.getElementById('crm-pipeline');
    if (!pipe) { setTimeout(observe, 500); return; }
    var pendingT = null;
    new MutationObserver(function(){
      if (pendingT) clearTimeout(pendingT);
      pendingT = setTimeout(patchTudo, 80);
    }).observe(pipe, { childList: true, subtree: true });
  }
  observe();

  if (window.addEventListener) {
    window.addEventListener('projetta:cambio-changed', function(){
      try { if (typeof window.crmRender === 'function') window.crmRender(); } catch(e){}
      setTimeout(patchTudo, 200);
    });
  }

  console.log('[mod 134 v2] consolidado — Fazer Orc=0, cambio do card, maritimo×1.2, intl Tab=Fat=Total');
})();
