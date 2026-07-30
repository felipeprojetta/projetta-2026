/* ══════════════════════════════════════════════════════════════════
   MODULE: AUTO-UPDATE  (Felipe sessao 37)
   ══════════════════════════════════════════════════════════════════

   O PROBLEMA
   ----------
   Felipe: "nao vou colocar nada em f12 nao, resolva".

   Toda correcao publicada so' passa a valer depois que a PAGINA e'
   recarregada — isso e' como a web funciona, nao tem jeito. Mas fazer
   o usuario saber disso (e lembrar de dar Ctrl+Shift+R) e' problema do
   sistema, nao dele. Sintoma real: Felipe apagava um item, clicava em
   Recalcular, o item voltava — e o motivo era que a aba estava aberta
   desde ANTES do deploy, rodando o JS antigo. O banco confirmou
   (_itensRemovidos null: a funcao nova nem chegou a executar).

   A infra de cache ja' estava certa (netlify.toml + _headers: index.html
   no-store, scripts revalidando, build reescrevendo ?v= a cada deploy).
   O que faltava era alguem AVISAR a aba que ja' esta aberta.

   COMO FUNCIONA
   -------------
   1. No boot, guarda o ?v= com que ESTA pagina carregou os scripts.
   2. A cada 2 minutos (e sempre que a aba volta pro foco) baixa o
      index.html com cache-bust e le o ?v= publicado.
   3. Diferente => tem deploy novo.
   4. RECARREGA SOZINHO, mas so' quando e' SEGURO:
        - nenhum campo sendo editado (foco em input/textarea/select)
        - nenhuma janela/modal aberta
        - nada pendente na fila de gravacao offline
        - nenhum "nao salvo" sinalizado pela tela
      Se nao for seguro, tenta de novo no proximo ciclo. Nunca recarrega
      por cima de trabalho em andamento.

   Nada de banner, nada de perguntar. O sistema so' fica atualizado.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var INTERVALO_MS = 2 * 60 * 1000;   // 2 minutos
  var _versaoLocal = null;
  var _recarregando = false;
  var _falhasSeguidas = 0;

  function log() {
    var a = ['[auto-update]'].concat([].slice.call(arguments));
    console.log.apply(console, a);
  }

  /** Le o ?v= dos <script> desta pagina (o maior, que e' o do deploy). */
  function _versaoDaPagina() {
    try {
      var maior = '';
      var tags = document.querySelectorAll('script[src*="?v="]');
      for (var i = 0; i < tags.length; i++) {
        var m = String(tags[i].getAttribute('src') || '').match(/\?v=(\d+)/);
        if (m && m[1] > maior) maior = m[1];
      }
      return maior || null;
    } catch (_) { return null; }
  }

  /** Le o ?v= publicado no servidor agora. */
  async function _versaoDoServidor() {
    // cache-bust proprio: garante que a resposta nao vem de cache local.
    var url = location.pathname.replace(/[^/]*$/, '') + 'index.html?_ck=' + Date.now();
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var html = await res.text();
    var maior = '';
    var re = /\?v=(\d+)/g, m;
    while ((m = re.exec(html)) !== null) { if (m[1] > maior) maior = m[1]; }
    return maior || null;
  }

  /**
   * So' recarrega quando nao ha risco de perder o que o usuario esta
   * fazendo. Na duvida, NAO recarrega — tenta no proximo ciclo.
   */
  function _seguroRecarregar() {
    try {
      // 1. usuario digitando?
      var el = document.activeElement;
      if (el) {
        var tag = (el.tagName || '').toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
        if (el.isContentEditable) return false;
      }
      // 2. modal/janela aberta? (padroes de overlay usados no sistema)
      if (document.querySelector(
            '.crm-modal-overlay, .orc-modal, .ger-ov, [id$="-modal"], dialog[open]')) {
        // so' bloqueia se estiver realmente visivel
        var abertos = document.querySelectorAll(
          '.crm-modal-overlay, .orc-modal, .ger-ov, [id$="-modal"], dialog[open]');
        for (var i = 0; i < abertos.length; i++) {
          var st = window.getComputedStyle(abertos[i]);
          if (st && st.display !== 'none' && st.visibility !== 'hidden') return false;
        }
      }
      // 3. fila de gravacao offline com algo pendente?
      try {
        var fila = localStorage.getItem('projetta:_sync_fila_pendentes');
        if (fila) {
          var arr = JSON.parse(fila);
          if (Array.isArray(arr) && arr.length > 0) return false;
        }
      } catch (_) {}
      // 4. tela sinalizando alteracao nao salva?
      //    (banner "Voce alterou valores. Clique em Salvar pra aplicar.")
      var txt = document.body ? document.body.innerText || '' : '';
      if (/alterou valores/i.test(txt)) return false;
      if (document.querySelector('.orc-dirty, .is-dirty-warning, [data-dirty="1"]')) return false;
      // 5. algo em edicao marcado pelo proprio Orcamento
      try {
        if (window.Orcamento && window.Orcamento.UI
            && window.Orcamento.UI._editandoAlgo) return false;
      } catch (_) {}
      return true;
    } catch (e) {
      // qualquer erro na checagem: nao arrisca
      console.warn('[auto-update] checagem de seguranca falhou:', e);
      return false;
    }
  }

  async function _verificar() {
    if (_recarregando) return;
    try {
      var remota = await _versaoDoServidor();
      _falhasSeguidas = 0;
      if (!remota || !_versaoLocal) return;
      if (remota === _versaoLocal) return;
      // Deploy novo detectado.
      //
      // Felipe sessao 38: "antes esperava eu clicar para atualizar, agora
      // esta atualizando sozinho, so atualiza se eu clicar nessa mensagem".
      // Este modulo dava location.reload() direto aqui — e como ele checa a
      // cada 20s contra os 60s do 55-version-check, quase sempre ganhava a
      // corrida e a pagina recarregava ANTES do banner azul aparecer. O
      // usuario perdia o controle do momento do reload.
      //
      // Agora este modulo so' AVISA. Quem recarrega e' o clique no banner.
      // A checagem _seguroRecarregar deixou de gatear o aviso de proposito:
      // ela existia pra evitar reload no meio de uma edicao, e sem reload
      // automatico mostrar o aviso e' inofensivo — segurar o banner so'
      // atrasaria a informacao. A funcao continua exportada pra quem quiser.
      _recarregando = true;  // trava o ciclo: o aviso ja' esta na tela
      log('versao nova detectada (' + _versaoLocal + ' -> ' + remota + '). '
        + 'Mostrando aviso — recarrega somente no clique do usuario.');
      if (window.VersionCheck && typeof window.VersionCheck.mostrarBanner === 'function') {
        window.VersionCheck.mostrarBanner();
      } else {
        // 55-version-check ausente: nao inventa reload, so' registra. O
        // proprio 55 mostraria o banner no ciclo dele de 60s.
        log('VersionCheck indisponivel — nenhum banner mostrado, nenhum reload feito.');
      }
    } catch (e) {
      _falhasSeguidas++;
      // offline / servidor fora: silencia depois de algumas tentativas
      if (_falhasSeguidas <= 2) console.warn('[auto-update] verificacao falhou:', e.message);
    }
  }

  function iniciar() {
    _versaoLocal = _versaoDaPagina();
    if (!_versaoLocal) {
      log('nao achei ?v= nos scripts — auto-update desligado.');
      return;
    }
    log('build local:', _versaoLocal, '· checando a cada', (INTERVALO_MS / 60000), 'min');
    setInterval(_verificar, INTERVALO_MS);
    // checa tambem quando a aba volta pro foco (caso comum: Felipe volta
    // pro sistema depois de eu ter publicado uma correcao)
    // visibilitychange e focus disparam JUNTOS quando a aba volta —
    // sem debounce isso roda a verificacao 2x seguidas.
    var _ultimaChecagem = 0;
    function _verificarComDebounce() {
      var agora = Date.now();
      if (agora - _ultimaChecagem < 5000) return;
      _ultimaChecagem = agora;
      _verificar();
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') _verificarComDebounce();
    });
    window.addEventListener('focus', _verificarComDebounce);
    // primeira checagem 20s apos o boot (deixa o sistema carregar antes)
    setTimeout(_verificar, 20000);
  }

  window.AutoUpdate = {
    versaoLocal: function () { return _versaoLocal; },
    verificarAgora: _verificar,
    seguroRecarregar: _seguroRecarregar,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
/* ══ END MODULE: AUTO-UPDATE ══ */
