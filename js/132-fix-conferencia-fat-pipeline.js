(() => {
  if (window.__MOD_132_LOADED) return;
  window.__MOD_132_LOADED = true;

  // ═══════════════════════════════════════════════════════════════
  // BUG 1: Conferencia interna na proposta — Frete Maritimo BRL
  //        nao reflete margem 20% (USD foi patcheado pelo mod 100,
  //        BRL ficou sem margem → totals USD/BRL nao batem)
  //
  // BUG 2: Card pipeline "Fat" usa cambio fallback 5.20 quando card
  //        nao tem inst_cambio. Usa o cambio do projettaCambio.
  //        E nao inclui margem 20% no maritimo CIF.
  // ═══════════════════════════════════════════════════════════════

  function getCambio() {
    if (window.projettaCambio) return window.projettaCambio.get();
    return 5.20;
  }

  // ── BUG 2: hook em _valorRealCardBRL ──────────────────────
  function hookValorRealCard() {
    if (typeof window._valorRealCardBRL !== 'function') return false;
    if (window._valorRealCardBRL.__mod132) return true;
    var orig = window._valorRealCardBRL;

    var nova = function(o) {
      if (!o) return 0;

      // Replicar a logica de "tem revisao"
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

      var _ehIntl = o.scope === 'internacional'
        || (o.inst_quem||'').toUpperCase() === 'INTERNACIONAL'
        || ['CIF','FOB','EXW'].indexOf((o.inst_incoterm||'').toUpperCase()) >= 0
        || !!(o.pais||'').trim();

      if (!_ehIntl) return _vPorta;

      // ★ FIX bug 2: usa projettaCambio.get() em vez de o.inst_cambio || 5.20
      var _cambio = getCambio();

      // Instalacao (mesma logica original)
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

      // Logistica em USD
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
        // ★ FIX bug 2: aplicar margem 20% no maritimo (igual mod 100 faz no DOM)
        var _maritimo = parseFloat(o.cif_frete_maritimo) || 0;
        _logUsd += _maritimo * 1.20;
      }

      return _vPorta + _vInst + (_logUsd * _cambio);
    };

    nova.__mod132 = true;
    window._valorRealCardBRL = nova;
    console.log('[mod 132] _valorRealCardBRL hooked — usa projettaCambio + margem 20% maritimo');
    return true;
  }

  // ── BUG 1: patch da Conferencia interna na proposta ───────
  function patchConferencia() {
    var el = document.getElementById('prop-conferencia-rs');
    if (!el) return;

    var html = el.innerHTML;
    if (!html || html.indexOf('Frete Mar') < 0) return;

    // Marca pra evitar loop infinito (idempotencia)
    var stamp = window.projettaCambio ? window.projettaCambio.get().toFixed(4) : '5.20';
    if (el.getAttribute('data-mod132-cambio') === stamp) return;

    var cambio = getCambio();

    // Regex pra "Frete Marítimo US$ X (R$ Y)"
    var rxFM = /Frete\s+Mar[ií]timo\s+US\$\s*([\d.,]+)\s*\(R\$\s*([\d.,]+)\)/i;
    var m = html.match(rxFM);
    if (!m) {
      el.setAttribute('data-mod132-cambio', stamp);
      return;
    }

    // Parse robusto de numero (formato en-US: 3,887)
    function parseUSD(s) {
      return parseFloat(String(s).replace(/,/g, '')) || 0;
    }
    function parseBRL(s) {
      return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
    }
    function fmtUSD(n) {
      return Math.round(n).toLocaleString('en-US');
    }
    function fmtBRL(n) {
      return Math.round(n).toLocaleString('pt-BR');
    }

    var fmUsd = parseUSD(m[1]);
    var fmBrl = parseBRL(m[2]);
    if (!fmUsd) { el.setAttribute('data-mod132-cambio', stamp); return; }

    // Heuristica: se BRL = USD * cambio (sem margem), aplicar margem 20%
    // Caso BRL ja seja com margem (USD * 1.20 * cambio), nao mexer
    var brlSemMargem = fmUsd * cambio;
    var brlComMargem = fmUsd * 1.20 * cambio;

    var distSem = Math.abs(fmBrl - brlSemMargem);
    var distCom = Math.abs(fmBrl - brlComMargem);

    var novoUsd, novoBrl;
    if (distSem < distCom) {
      // BRL atualmente sem margem → aplicar margem nos dois
      novoUsd = fmUsd * 1.20;
      novoBrl = novoUsd * cambio;
    } else {
      // Ja com margem ou outro caso → so garantir consistencia BRL = USD*cambio
      novoUsd = fmUsd;
      novoBrl = fmUsd * cambio;
    }

    var novaLinhaFM = 'Frete Marítimo US$ ' + fmtUSD(novoUsd) + ' (R$ ' + fmtBRL(novoBrl) + ')';
    html = html.replace(rxFM, novaLinhaFM);

    // Recalcular TOTAL: somar USD e BRL de TODAS as linhas (Porta, Caixa, Frete Terrestre, Frete Maritimo)
    var rxItens = /([A-Za-zÀ-úçÇ ]+?)\s+US\$\s*([\d.,]+)\s*\(R\$\s*([\d.,]+)\)/g;
    var totalUsd = 0, totalBrl = 0;
    var match;
    while ((match = rxItens.exec(html)) !== null) {
      totalUsd += parseUSD(match[2]);
      totalBrl += parseBRL(match[3]);
    }

    // Substituir "Total: US$ X · R$ Y"
    var rxTotal = /Total:\s*US\$\s*[\d.,]+\s*[·•]\s*R\$\s*[\d.,]+/i;
    if (rxTotal.test(html)) {
      var novoTotal = 'Total: US$ ' + fmtUSD(totalUsd) + ' · R$ ' + fmtBRL(totalBrl);
      html = html.replace(rxTotal, novoTotal);
    }

    el.innerHTML = html;
    el.setAttribute('data-mod132-cambio', stamp);
    console.log('[mod 132] conferencia interna corrigida: USD ' + fmtUSD(totalUsd) + ' · BRL ' + fmtBRL(totalBrl));
  }

  // Reset do stamp quando populateProposta rodar (regenera innerHTML)
  function hookPopulateProposta132() {
    if (typeof window.populateProposta !== 'function') return false;
    if (window.populateProposta.__mod132) return true;
    var orig = window.populateProposta;
    window.populateProposta = function() {
      var ret = orig.apply(this, arguments);
      // Limpar stamp pra forcar re-patch
      var el = document.getElementById('prop-conferencia-rs');
      if (el) el.removeAttribute('data-mod132-cambio');
      // Re-patch em multiplos timings (depois do mod 100 aplicar margem)
      [200, 800, 1500, 2500].forEach(function(t){ setTimeout(patchConferencia, t); });
      return ret;
    };
    window.populateProposta.__mod132 = true;
    console.log('[mod 132] populateProposta hooked v132');
    return true;
  }

  // Polling pra instalar tudo
  setInterval(function(){
    hookValorRealCard();
    hookPopulateProposta132();
    patchConferencia();
  }, 1500);

  // Re-render kanban quando cambio mudar (pra Fat atualizar imediato)
  if (window.addEventListener) {
    window.addEventListener('projetta:cambio-changed', function(){
      try {
        if (typeof window.crmRender === 'function') window.crmRender();
      } catch(e){}
      // Tambem repatch conferencia
      var el = document.getElementById('prop-conferencia-rs');
      if (el) el.removeAttribute('data-mod132-cambio');
      patchConferencia();
    });
  }

  console.log('[mod 132] carregado — fix Conferencia (BRL marítimo) + Fat card (cambio + margem)');
})();
