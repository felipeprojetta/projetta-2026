/* 58-colar-reserva-intranet.js — cola o bloco da tela da intranet no lead.

   POR QUE ESTE MODULO EXISTE (Felipe, sessao 38)
   ─────────────────────────────────────────────────────────────────────
   A API /v2/api/reservas/reserva/{n} da Weiku SO' devolve reserva que
   ja tem orcamento. Reserva nova ("Reserva sem Orcamento") volta [] —
   exatamente o momento em que a Projetta precisa dos dados, porque e'
   quando o lead nasce.

   Os dados EXISTEM na intranet, mas na TELA
   (Comercial > Confirmacoes de Pedido > busca por reserva), que nao tem
   CORS liberado e nao da' pra ler por fetch do nosso dominio.

   Solucao sem depender de terceiros: Ctrl+C na tela, Ctrl+V aqui.
   Este modulo entende o texto colado e preenche o lead.

   ESCOPO — este arquivo NAO altera nada de ninguem:
     - le o texto que o usuario cola
     - escreve nos inputs [data-field] do modal do CRM ja aberto
     - dispara os eventos que o proprio CRM ja escuta ('input' pra
       sincronizar o modalState, 'change' no followup pra puxar a razao
       social, 'blur' no CEP pra o ViaCEP confirmar cidade/estado)
   Nao toca em Storage, nao salva nada, nao chama Supabase. Quem salva
   continua sendo o botao Salvar do modal.

   Expoe window.ColarReservaIntranet = { parse, abrir, fechar }
   `parse` e' pura (texto -> objeto) e testavel fora do browser.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var OVERLAY_ID = 'cri-overlay';

  // ═══════════════════════════════════════════════════════════════════
  // PARSER — texto da tela -> campos do lead
  // ═══════════════════════════════════════════════════════════════════
  /* Texto tipico (copiado da tela, ordem das linhas pode variar porque
     a tela e' em 2 colunas e cada navegador serializa diferente):

       RESULTADO DA BUSCA - RESERVA
       Nº Reserva: 148363
       CELSO E ANA CLAUDIA ZUCATELLI
       PROJETOS@LEONICEALVES.COM.BR
       BARUERI/SP
       AVENIDA OURINHOS, 514, RESIDENCIA,
       06458-240
       Data Reserva 29/07/2026
       Representante SP_BARUERI_PREVE / Reservado por SP_BARUERI_PREVE
       Status da reserva - Reserva sem Orcamento
       Reserva para -

     Por isso NADA aqui depende de posicao de linha — tudo e' por padrao.
     Campo que nao aparecer no texto volta string vazia, nunca chute. */

  var RX = {
    reserva:  /n[ºo°]?\s*reserva\s*:?\s*(\d{4,8})/i,
    email:    /[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i,
    cepForm:  /\b(\d{5})-(\d{3})\b/,
    // ATENCAO: charclass usa [ \t] e NAO \s — \s inclui \n e o regex
    // atravessava a quebra de linha, colando a linha do nome do cliente
    // dentro da cidade ("MARIA DAS DORES DE SOUZA Barueri/SP").
    cidadeUf: /^[ \t]*([A-ZÀ-Ÿ][A-ZÀ-Ÿ .'’\-]{1,60}?)[ \t]*\/[ \t]*([A-Za-z]{2})[ \t]*$/m,
    followup: /representante\s*:?\s*([A-Z0-9][A-Z0-9_\-]{2,})/i,
    data:     /data\s+reserva\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i,
    status:   /status\s+da\s+reserva\s*[-:]?\s*(.+)/i,
    telefone: /\(?\b(\d{2})\)?[\s.\-]?(9?\d{4})[\s.\-]?(\d{4})\b/,
    logra:    /^\s*(avenida|av\.?|rua|r\.|alameda|al\.?|travessa|tv\.?|rodovia|rod\.?|estrada|estr\.?|pra[cç]a|largo|vila|via|quadra|lote|servid[aã]o)\b/i,
    ruido:    /^\s*(resultado\s+da\s+busca|n[ºo°]?\s*reserva|data\s+reserva|status\s+da\s+reserva|reserva\s+para|reservado\s+por|representante|comercial|contratos|confirma[cç][oõ]es|cancelar\s+pedido|editar\s+rel|relat[oó]rios|sair\s+do\s+sistema|seja\s+bem[\s\-]?vindo)\b/i,
  };

  /**
   * Titlecase de nome proprio, com preposicoes em minuscula.
   * "CELSO E ANA CLAUDIA ZUCATELLI" -> "Celso e Ana Claudia Zucatelli"
   */
  function titlecaseNome(s) {
    var minus = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, di: 1, du: 1, la: 1, van: 1, von: 1 };
    return String(s || '')
      .toLowerCase()
      .split(/\s+/)
      .map(function (w, i) {
        if (!w) return w;
        if (i > 0 && minus[w]) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ')
      .trim();
  }

  /**
   * parse(texto) -> {
   *   numeroReserva, cliente, email, telefone, cep, cidade, estado,
   *   endereco, representante_followup, dataReserva, status,
   *   _achados: ['cliente','cep',...]   // o que veio de verdade
   * }
   * Nunca lanca. Texto que nao casa nada devolve tudo vazio.
   */
  function parse(texto) {
    var t = String(texto || '').replace(/\u00a0/g, ' ');
    var out = {
      numeroReserva: '', cliente: '', email: '', telefone: '',
      cep: '', cidade: '', estado: '', endereco: '',
      representante_followup: '', dataReserva: '', status: '',
      _achados: [],
    };
    if (!t.trim()) return out;

    var m;
    if ((m = t.match(RX.reserva)))  out.numeroReserva = m[1];
    if ((m = t.match(RX.email)))    out.email = m[0].toLowerCase();
    if ((m = t.match(RX.cepForm)))  out.cep = m[1] + '-' + m[2];
    if ((m = t.match(RX.data)))     out.dataReserva = m[1];
    if ((m = t.match(RX.status)))   out.status = m[1].trim();
    if ((m = t.match(RX.cidadeUf))) {
      out.cidade = titlecaseNome(m[1]);
      out.estado = m[2].toUpperCase();
    }
    if ((m = t.match(RX.followup))) {
      // "Representante SP_BARUERI_PREVE / Reservado por SP_BARUERI_PREVE"
      // pega so' o primeiro codigo, sem arrastar o "/ Reservado por".
      out.representante_followup = m[1].toUpperCase();
    }

    // Telefone: a tela de reserva geralmente NAO traz. Se trouxer, cuida
    // pra nao confundir com CEP (8 digitos) nem com a data.
    var semCep = t.replace(RX.cepForm, ' ').replace(/\d{2}\/\d{2}\/\d{4}/g, ' ');
    if ((m = semCep.match(RX.telefone))) {
      out.telefone = '(' + m[1] + ') ' + m[2] + '-' + m[3];
    }

    // ── Nome do cliente e endereco: por eliminacao, linha a linha ──
    // GUARDA: so' procura nome se o texto tem alguma ancora de que e'
    // mesmo a tela de reserva (numero, email, CEP ou followup). Sem isso,
    // qualquer frase colada por engano virava "cliente".
    var temAncora = !!(out.numeroReserva || out.email || out.cep || out.representante_followup);
    var linhas = t.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    for (var i = 0; temAncora && i < linhas.length; i++) {
      var L = linhas[i];
      if (RX.ruido.test(L)) continue;              // rotulo/menu da tela
      if (L.indexOf('@') >= 0) continue;           // email
      if (RX.cidadeUf.test(L)) continue;           // CIDADE/UF
      if (/^[\d\s.,\-\/()]+$/.test(L)) continue;   // so' numero/pontuacao (CEP, data)
      if (RX.logra.test(L)) {                      // endereco
        if (!out.endereco) out.endereco = L.replace(/,\s*$/, '');
        continue;
      }
      // sobrou: candidato a nome. Exige 2+ palavras com letras.
      if (!out.cliente) {
        var palavras = L.split(/\s+/).filter(function (w) { return /[A-Za-zÀ-ÿ]{2}/.test(w); });
        if (palavras.length >= 2) out.cliente = titlecaseNome(L);
      }
    }

    ['numeroReserva', 'cliente', 'email', 'telefone', 'cep', 'cidade',
     'estado', 'endereco', 'representante_followup'].forEach(function (k) {
      if (out[k]) out._achados.push(k);
    });
    return out;
  }

  // ═══════════════════════════════════════════════════════════════════
  // APLICACAO — escreve nos campos do modal do CRM que esta aberto
  // ═══════════════════════════════════════════════════════════════════

  function modalDoCrm() {
    return document.querySelector('#crm-modal-overlay');
  }

  function disparar(el, tipos) {
    tipos.forEach(function (tipo) {
      el.dispatchEvent(new Event(tipo, { bubbles: true }));
    });
  }

  /**
   * Preenche um campo [data-field] do modal.
   * sobrescrever=false (default) respeita valor que ja esta la'.
   * Devolve 'ok' | 'ocupado' | 'ausente' | 'vazio'
   */
  function preencher(campo, valor, sobrescrever, eventos) {
    var root = modalDoCrm();
    if (!root) return 'ausente';
    if (!valor) return 'vazio';
    var el = root.querySelector('[data-field="' + campo + '"]');
    // fallback: no modo "nova reserva" o numero da reserva e' #crm-search-input
    if (!el && campo === 'numeroReserva') el = root.querySelector('#crm-search-input');
    if (!el) return 'ausente';
    if (!sobrescrever && String(el.value || '').trim()) return 'ocupado';
    el.value = valor;
    disparar(el, eventos || ['input']);
    return 'ok';
  }

  /**
   * aplicar(dados, sobrescrever) -> { ok: [...], ocupados: [...], ausentes: [...] }
   * Ordem importa: o CEP vai por ULTIMO com 'blur', pra o lookup do
   * ViaCEP do proprio CRM confirmar cidade/estado por cima.
   */
  function aplicar(dados, sobrescrever) {
    var res = { ok: [], ocupados: [], ausentes: [] };
    var plano = [
      ['numeroReserva',          dados.numeroReserva,          ['input']],
      ['cliente',                dados.cliente,                ['input']],
      ['email',                  dados.email,                  ['input']],
      ['telefone',               dados.telefone,               ['input']],
      ['cidade',                 dados.cidade,                 ['input']],
      ['estado',                 dados.estado,                 ['input']],
      ['representante_followup', dados.representante_followup, ['input', 'change']],
      ['cep',                    dados.cep,                    ['input', 'blur']],
    ];
    plano.forEach(function (p) {
      var r = preencher(p[0], p[1], sobrescrever, p[2]);
      if (r === 'ok') res.ok.push(p[0]);
      else if (r === 'ocupado') res.ocupados.push(p[0]);
      else if (r === 'ausente' && p[1]) res.ausentes.push(p[0]);
    });
    return res;
  }

  // ═══════════════════════════════════════════════════════════════════
  // UI — painel proprio, por cima do modal do CRM
  // ═══════════════════════════════════════════════════════════════════

  var LABELS = {
    numeroReserva: 'Reserva', cliente: 'Cliente', email: 'Email',
    telefone: 'Telefone', cep: 'CEP', cidade: 'Cidade', estado: 'UF',
    endereco: 'Endereco', representante_followup: 'Follow Up',
  };

  function fechar() {
    var ov = document.getElementById(OVERLAY_ID);
    if (ov) ov.remove();
  }

  function abrir() {
    if (!modalDoCrm()) {
      alert('Abra o lead primeiro (Editar Lead) — e depois cole o bloco da intranet aqui.');
      return;
    }
    fechar();

    var ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);'
      + 'display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.innerHTML = ''
      + '<div style="background:#fff;border-radius:12px;max-width:660px;width:100%;'
      +      'max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);'
      +      'font-family:var(--font-body,system-ui);">'
      + '  <div style="display:flex;align-items:center;justify-content:space-between;'
      +        'padding:16px 20px;border-bottom:1px solid var(--line,#e5e7eb);">'
      + '    <strong style="font-size:15px;letter-spacing:.02em;">Colar dados da Intranet</strong>'
      + '    <button id="cri-x" style="background:none;border:none;font-size:22px;'
      +          'cursor:pointer;line-height:1;color:#64748b;">&times;</button>'
      + '  </div>'
      + '  <div style="padding:16px 20px;">'
      + '    <div style="font-size:12.5px;color:#475569;line-height:1.55;margin-bottom:10px;">'
      + '      Na intranet: <b>Comercial &gt; Confirmacoes de Pedido</b>, busca a reserva,'
      + '      seleciona o bloco do resultado e Ctrl+C. Cola aqui embaixo.'
      + '    </div>'
      + '    <textarea id="cri-txt" rows="8" placeholder="Cole aqui o bloco da tela da reserva..."'
      + '      style="width:100%;padding:10px;border:1px solid var(--line,#e5e7eb);'
      +        'border-radius:6px;font-size:12.5px;font-family:ui-monospace,monospace;'
      +        'resize:vertical;box-sizing:border-box;"></textarea>'
      + '    <div id="cri-preview" style="margin-top:12px;font-size:12.5px;"></div>'
      + '    <label style="display:flex;align-items:center;gap:7px;margin-top:12px;'
      +        'font-size:12.5px;color:#475569;cursor:pointer;">'
      + '      <input type="checkbox" id="cri-over" /> Sobrescrever campos que ja estao preenchidos'
      + '    </label>'
      + '  </div>'
      + '  <div style="display:flex;gap:8px;justify-content:flex-end;padding:14px 20px;'
      +        'border-top:1px solid var(--line,#e5e7eb);">'
      + '    <button id="cri-cancel" style="padding:8px 14px;border:1px solid var(--line,#e5e7eb);'
      +          'background:#fff;border-radius:6px;cursor:pointer;font-size:13px;">Cancelar</button>'
      + '    <button id="cri-ok" disabled style="padding:8px 16px;border:none;background:#0f2c4c;'
      +          'color:#fff;border-radius:6px;cursor:pointer;font-size:13px;opacity:.5;">'
      +          'Preencher lead</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(ov);

    var txt     = ov.querySelector('#cri-txt');
    var prev    = ov.querySelector('#cri-preview');
    var btnOk   = ov.querySelector('#cri-ok');
    var ultimo  = null;

    function repintar() {
      var d = parse(txt.value);
      ultimo = d;
      if (!d._achados.length) {
        prev.innerHTML = txt.value.trim()
          ? '<span style="color:#b45309;">Nao reconheci nenhum campo nesse texto.</span>'
          : '';
        btnOk.disabled = true;
        btnOk.style.opacity = '.5';
        return;
      }
      var linhas = d._achados.map(function (k) {
        return '<div style="display:flex;gap:8px;padding:3px 0;">'
             + '<span style="min-width:88px;color:#64748b;">' + LABELS[k] + '</span>'
             + '<b style="color:#0f172a;">' + String(d[k]).replace(/</g, '&lt;') + '</b></div>';
      }).join('');
      var faltando = Object.keys(LABELS).filter(function (k) { return !d[k]; })
                       .map(function (k) { return LABELS[k]; });
      prev.innerHTML =
          '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 12px;">'
        + '<div style="color:#15803d;font-weight:600;margin-bottom:6px;">Entendi isto:</div>'
        + linhas + '</div>'
        + (faltando.length
            ? '<div style="margin-top:8px;color:#b45309;">Nao veio no texto: ' + faltando.join(', ') + '</div>'
            : '')
        + (d.endereco
            ? '<div style="margin-top:8px;color:#64748b;">Endereco fica so' + '\'' + ' aqui de referencia — o lead nao tem campo pra ele.</div>'
            : '');
      btnOk.disabled = false;
      btnOk.style.opacity = '1';
    }

    txt.addEventListener('input', repintar);
    txt.addEventListener('paste', function () { setTimeout(repintar, 0); });

    ov.querySelector('#cri-x').addEventListener('click', fechar);
    ov.querySelector('#cri-cancel').addEventListener('click', fechar);
    ov.addEventListener('click', function (e) { if (e.target === ov) fechar(); });

    btnOk.addEventListener('click', function () {
      if (!ultimo) return;
      var sobrescrever = ov.querySelector('#cri-over').checked;
      var r = aplicar(ultimo, sobrescrever);
      fechar();
      var msg = r.ok.length
        ? 'Preenchido: ' + r.ok.map(function (k) { return LABELS[k]; }).join(', ')
        : 'Nenhum campo preenchido';
      if (r.ocupados.length) {
        msg += '\n\nJa tinham valor (nao mexi): '
             + r.ocupados.map(function (k) { return LABELS[k]; }).join(', ')
             + '\nMarque "Sobrescrever" se quiser trocar.';
      }
      msg += '\n\nConfira e clique em Salvar no lead.';
      alert(msg);
    });

    setTimeout(function () { txt.focus(); }, 50);
  }

  window.ColarReservaIntranet = {
    parse:  parse,
    aplicar: aplicar,
    abrir:  abrir,
    fechar: fechar,
  };
})();
