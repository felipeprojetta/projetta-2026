(() => {
  if (window.__MOD_134_LOADED) return;
  window.__MOD_134_LOADED = true;

  // ═══════════════════════════════════════════════════════════════
  // PATCH AGRESSIVO: recalcula KPIs do topo + headers do kanban
  // localmente, sem depender de window._valorRealCardBRL hook
  // (a funcao real eh local dentro do IIFE do 10-crm.js).
  //
  // Logica corrigida:
  //   - Cambio = projettaCambio.get() (manual)
  //   - Maritimo CIF: aplicar margem 20%
  //   - Internacional: Tab = Fat = Total
  // ═══════════════════════════════════════════════════════════════

  function getCambio() {
    if (window.projettaCambio) return window.projettaCambio.get();
    return 5.20;
  }

  function ehInternacional(o) {
    if (!o) return false;
    return o.scope === 'internacional'
      || (o.inst_quem||'').toString().toUpperCase() === 'INTERNACIONAL'
      || ['CIF','FOB','EXW'].indexOf((o.inst_incoterm||'').toString().toUpperCase()) >= 0
      || !!(o.pais||'').toString().trim();
  }

  // Replica logica de _valorRealCardBRL com cambio do projettaCambio + margem 20%
  function calcCardBRL(o) {
    if (!o) return 0;
    var _temRev = false;
    if (o.revisoes && o.revisoes.length > 0) _temRev = true;
    if (!_temRev && o.opcoes) {
      for (var i = 0; i < o.opcoes.length; i++) {
        if (o.opcoes[i] && o.opcoes[i].revisoes && o.opcoes[i].revisoes.length > 0) {
          _temRev = true; break;
        }
      }
    }
    var _vDireto = parseFloat(o.valorFaturamento) || parseFloat(o.valorTabela) || parseFloat(o.valor) || 0;
    if (!_temRev && _vDireto === 0) return 0;
    var _vPorta = _vDireto;

    if (!ehInternacional(o)) return _vPorta;

    var _cambio = getCambio();

    // Instalacao
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
      _logUsd += (parseFloat(o.cif_frete_maritimo) || 0) * 1.20; // margem 20%
    }

    return _vPorta + _vInst + (_logUsd * _cambio);
  }

  function calcCardTabBRL(o) {
    if (!o) return 0;
    if (ehInternacional(o)) {
      // Internacional: Tab = Fat = Total
      return calcCardBRL(o);
    }
    return parseFloat(o.valorTabela) || 0;
  }

  function fmtBRL(n) { return 'R$ ' + Math.round(n).toLocaleString('pt-BR'); }

  // ── PATCH dos KPIs do topo ─────────────────────────────────────
  function patchKPIs() {
    if (typeof window.cLoad !== 'function') return;
    var data;
    try { data = window.cLoad(); } catch(e){ return; }
    if (!Array.isArray(data)) return;

    // Determinar stages won/lost (replica logica do updateKPIs)
    var gStages = window.gStages || function(){ return []; };
    var stages = gStages();
    var wonIds = stages.filter(function(s){ return /gan|won/i.test(s.label||''); }).map(function(s){return s.id;});
    var lostIds = stages.filter(function(s){ return /perd|lost/i.test(s.label||''); }).map(function(s){return s.id;});

    var ativos = data.filter(function(o){ return o && !o.deleted_at && wonIds.indexOf(o.stage)<0 && lostIds.indexOf(o.stage)<0; });

    var pipe = ativos.reduce(function(s,o){ return s + calcCardBRL(o); }, 0);
    var totTab = ativos.reduce(function(s,o){ return s + calcCardTabBRL(o); }, 0);
    var totFat = ativos.reduce(function(s,o){ return s + calcCardBRL(o); }, 0);

    var ckPipe = document.getElementById('ck-pipe');
    if (ckPipe && ckPipe.textContent !== fmtBRL(pipe)) ckPipe.textContent = fmtBRL(pipe);
    var ckTotTab = document.getElementById('ck-tot-tab');
    if (ckTotTab && ckTotTab.textContent !== fmtBRL(totTab)) ckTotTab.textContent = fmtBRL(totTab);
    var ckTotFat = document.getElementById('ck-tot-fat');
    if (ckTotFat && ckTotFat.textContent !== fmtBRL(totFat)) ckTotFat.textContent = fmtBRL(totFat);
  }

  // ── PATCH dos headers das colunas do kanban ────────────────────
  function patchKanbanHeaders() {
    if (typeof window.cLoad !== 'function') return;
    var data;
    try { data = window.cLoad(); } catch(e){ return; }
    if (!Array.isArray(data)) return;

    var stages = document.querySelectorAll('.crm-stage');
    if (!stages.length) return;

    stages.forEach(function(stage){
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

  // Polling continuo
  setInterval(patchTudo, 1500);
  setTimeout(patchTudo, 500);
  setTimeout(patchTudo, 2000);

  // MutationObserver no pipeline
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

  // Re-render quando cambio mudar
  if (window.addEventListener) {
    window.addEventListener('projetta:cambio-changed', function(){
      try { if (typeof window.crmRender === 'function') window.crmRender(); } catch(e){}
      setTimeout(patchTudo, 200);
    });
  }

  console.log('[mod 134] carregado — recalcula KPIs + headers (cambio manual + margem 20% + Tab=Fat intl)');
})();
