/* ================================================================
 * 54-weiku-vendas.js — Aba WEIKU: prospeccao de alto padrao
 * ================================================================
 * Felipe sessao 35: painel pra trabalhar a base de reservas Weiku
 * fechadas (grupo Weiku/Projetta) e prospectar clientes pra Projetta.
 *
 * Origem dos dados: reservas extraidas da intranet Weiku.
 *   - SCOPE Supabase: weiku / reservas  (array de registros)
 *   - SCOPE Supabase: weiku / optout    (mapa {numReserva:true})
 *   - CPF e RG NAO sao armazenados (minimizacao de dado sensivel).
 *   - Os dados NAO ficam no codigo (Git/Netlify sao publicos) —
 *     vivem so no Supabase autenticado e sao lidos via Storage.
 *
 * Filtro "alto padrao": exclui predios (tipo OU pavimentos>=5) e
 * por padrao abre em valor aprovado >= R$ 200 mil.
 *
 * Modulo 100% isolado (IIFE + prefixo CSS .wkv-). Nao toca em
 * nenhum outro modulo. Registrado em 99-boot.js como 'weiku'.
 * ================================================================ */
(function () {
  'use strict';

  var SCOPE = 'weiku';
  var CSS_ID = 'wkv-styles';

  // ---- estado da tela (memoria, por sessao de render) -------------
  var ui = {
    busca: '',
    vmin: null,
    vmax: null,
    pavMax: null,
    uf: '',
    rep: '',
    cidade: '',
    ano: '',
    mes: '',
    excluiPredio: false,
    soComWa: false,
    // Felipe s42: "ocultar quem ja comprou e mostrar somente os que ja
    // compraram" — virou 3 estados. 'ocultar' (default, o de sempre) |
    // '' todos | 'so' mostra SO' quem comprou, pra conferir a carteira
    // convertida. O ocultaComprou booleano da s37 continua existindo
    // derivado deste campo, pra nao quebrar nada que ja' o lia.
    comprou: 'ocultar',
    // Felipe s42: "coloque ai um filtro com orcamento projetta, pra saber
    // dos pedidos e dos fechados weiku quais ja tem orcamento projetta".
    // '' = todos | 'com' = so' quem ja' tem AGP | 'sem' = so' quem nao tem.
    projetta: '',
    // Felipe s37: "ja inicie sempre por esse filtro, primeiro data depois
    // valor" — a tela ja' abre com a ordenacao em 2 camadas pronta, em vez
    // de exigir clicar em Fechamento e dar Shift+clique em Valor toda vez.
    // Fechamento (mais recente primeiro) e, dentro de cada data, o maior
    // valor primeiro — que e' a ordem util pra decidir quem prospectar.
    sortKey: 'data',
    sortAsc: false,
    sortLayers: [{ k: 'data', asc: false }, { k: 'v', asc: false }],
    msg: 'Ol\u00e1, {nome}! Tudo bem?\n\nAqui \u00e9 a Thays, do Grupo Weiku. Vi que voc\u00ea j\u00e1 conversou com nosso time sobre esquadrias de alum\u00ednio e por isso estou entrando em contato.\n\nAl\u00e9m da Weiku, o grupo conta com a Projetta, especializada em portas de entrada pivotantes de alto padr\u00e3o, feitas sob medida.\n\nPosso te enviar nosso cat\u00e1logo?\n\nSe n\u00e3o tiver interesse, \u00e9 s\u00f3 avisar que retiro seu contato da nossa lista.'
  };

  // Felipe s38: "coloque um botao de salvar, quando eu alterar a mensagem
  // padrao". Ate agora a mensagem vivia SO' em ui.msg, na memoria da aba:
  // qualquer edicao sumia no F5 e voltava esse texto de fabrica, sem
  // aviso. Agora ela e' persistida em weiku/msg_padrao, entao vale pra
  // Felipe e Thays e sobrevive a recarregar.
  var MSG_FABRICA = ui.msg;

  function carregarMsgSalva() {
    try {
      var salva = Storage.scope(SCOPE).get('msg_padrao');
      if (typeof salva === 'string' && salva.trim()) ui.msg = salva;
    } catch (_) {}
  }
  function salvarMsgPadrao(txt) {
    Storage.scope(SCOPE).set('msg_padrao', String(txt || ''));
  }

  // ---- acesso a dados (Supabase via Storage) ----------------------
  // Felipe sessao 35: localStorage tem limite e truncava a base (>1000
  // reservas davam ~763). Agora puxamos DIRETO da nuvem (kv_store) e
  // guardamos em memoria; o cache local vira so' fallback offline.
  var _cloudReservas = null;
  function getReservas() {
    try {
      if (_cloudReservas && _cloudReservas.length) return _cloudReservas;
      if (!window.Storage) return [];
      var arr = Storage.scope(SCOPE).get('reservas', []);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  }
  function pullCloud(container) {
    try {
      if (!window.Database || !Database.SUPABASE_URL) return;
      var url = Database.SUPABASE_URL + '/rest/v1/kv_store?scope=eq.weiku&key=eq.reservas&select=valor';
      fetch(url, { headers: {
        'apikey': Database.SUPABASE_KEY,
        'Authorization': 'Bearer ' + Database.SUPABASE_KEY,
        'Accept-Profile': 'v7'
      } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (rows) {
        if (!rows || !rows[0]) return;
        var arr = rows[0].valor;
        if (Array.isArray(arr) && arr.length > (_cloudReservas ? _cloudReservas.length : -1)) {
          _cloudReservas = arr;            // fonte de verdade em memoria
          if (container) _draw(container);
        }
      }).catch(function () {});
    } catch (_) {}
  }
  function getOptout() {
    try {
      if (!window.Storage) return {};
      var m = Storage.scope(SCOPE).get('optout', {});
      return (m && typeof m === 'object') ? m : {};
    } catch (_) { return {}; }
  }
  function marcarOptout(r) {
    try {
      var m = getOptout();
      m[r] = true;
      Storage.scope(SCOPE).set('optout', m);
    } catch (_) {}
  }

  // ---- log de envios da API (Felipe sessao 38) --------------------
  // Mapa {numReserva:{ts,wamid,nome,status}} no scope weiku/envios.
  // So gravamos SUCESSOS — falhas nao entram no mapa, pra poderem ser
  // reenviadas num proximo disparo.
  function getEnvios() {
    try {
      if (!window.Storage) return {};
      var m = Storage.scope(SCOPE).get('envios', {});
      return (m && typeof m === 'object') ? m : {};
    } catch (_) { return {}; }
  }
  function marcarEnvio(r, info) {
    try {
      var m = getEnvios();
      m[r] = info;
      Storage.scope(SCOPE).set('envios', m);
    } catch (_) {}
  }

  // ---- controle manual de prospeccao (Felipe sessao 39) ----------
  // Por reserva (em weiku/envios, compartilhado na nuvem): enviado?,
  // quem enviou (Felipe/Thays), e se o cliente retornou. Compat com o
  // formato antigo da API (status:'sent' vira enviado:true).
  /**
   * Felipe s37: converte data pra chave ordenavel (aaaammdd).
   * Aceita dd/mm/aaaa, aaaa-mm-dd e Date. Vazio vai pro fim.
   */
  function _dataOrdenavel(v) {
    if (!v) return 0;
    if (v instanceof Date) {
      return v.getFullYear() * 10000 + (v.getMonth() + 1) * 100 + v.getDate();
    }
    var t = String(v).trim();
    var m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);          // dd/mm/aaaa
    if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);                  // aaaa-mm-dd
    if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
    return 0;
  }

  /**
   * Felipe s37: tem WhatsApp DE VERDADE = tem numero E ninguem marcou que
   * o numero nao existe no WhatsApp. O temWa() original so' olha se ha
   * telefone; este considera tambem a confirmacao manual de quem tentou.
   */
  function temWaReal(d) {
    if (!temWa(d)) return false;
    try {
      var st = _normSt(getEnvios()[d.r]);
      if (st && st.semWa) return false;
    } catch (_) {}
    return true;
  }

  function _normSt(e) {
    if (!e || typeof e !== 'object') return null;
    return {
      enviado: (e.enviado === true) || (e.status === 'sent'),
      por: e.por || '',
      enviadoTs: e.enviadoTs || e.ts || null,
      retornou: e.retornou === true,
      retornouTs: e.retornouTs || null,
      // Felipe s37: "coloque ali um botao tbm ja' comprou manual — pode
      // ter algum cliente antigo que nao esta no sistema que ja' comprou".
      // O vinculo com AGP so' cobre quem virou lead na Projetta; cliente
      // antigo que comprou fora do CRM ficava sendo prospectado a toa.
      jaComprou: e.jaComprou === true,
      jaComprouTs: e.jaComprouTs || null,
      // Felipe s37: "alguns numeros nao tem whatsapp, preciso informar
      // isso tbm". O sistema so' sabia se EXISTE telefone, nao se aquele
      // numero tem conta no WhatsApp — so' descobria ao tentar mandar e
      // levar o "nao esta no WhatsApp". Sem registrar, a pessoa tentava
      // de novo dias depois.
      semWa: e.semWa === true,
      semWaTs: e.semWaTs || null,
      // Felipe s44: "nao esta igual" — os Fechados tinham 5 botoes e o
      // funil 9. Estes 4 vieram da aba Pedidos pra as duas telas ficarem
      // iguais. Registro antigo simplesmente nao tem os campos e cai em
      // false, sem quebrar nada.
      demonstrouInteresse: e.demonstrouInteresse === true,
      demonstrouInteresseTs: e.demonstrouInteresseTs || null,
      jaOrcadoProjetta: e.jaOrcadoProjetta === true,
      jaOrcadoProjettaTs: e.jaOrcadoProjettaTs || null,
      // "Ja comprou" era um botao so'. Agora separa Projetta de outra
      // marca. COMPATIBILIDADE: quem ja tinha o antigo jaComprou marcado
      // aparece como "Ja comprou Projetta" ligado — era esse o sentido
      // do botao original ("ja comprou da Projetta fora do CRM").
      jaComprouProjetta: (e.jaComprouProjetta === true) || (e.jaComprou === true),
      jaComprouProjettaTs: e.jaComprouProjettaTs || e.jaComprouTs || null,
      jaComprouOutra: e.jaComprouOutra === true,
      jaComprouOutraTs: e.jaComprouOutraTs || null,
      // Felipe s38: "coloque botao sem retorno". Antes so' dava pra marcar
      // que o cliente RESPONDEU — quem nao respondeu ficava igual a quem
      // ainda nem foi contatado, e nao dava pra separar "enviei e nao
      // voltou" de "ainda nao enviei". E' exclusivo com retornou.
      semRetorno: e.semRetorno === true,
      semRetornoTs: e.semRetornoTs || null,
      // Felipe s38: cliente respondeu e RECUSOU. Fecha o quarto desfecho
      // possivel da prospeccao, que ate agora nao tinha onde ser anotado:
      //   Retornou     -> respondeu, conversa em aberto
      //   Sem retorno  -> nao respondeu
      //   Ja comprou   -> respondeu, mas resolveu com outro
      //   Sem interesse-> respondeu e nao quer   <-- este
      semInteresse: e.semInteresse === true,
      semInteresseTs: e.semInteresseTs || null,
      // Felipe s38: anotacao livre por cliente. Fica no MESMO registro do
      // status (scope weiku/envios), entao sincroniza entre Felipe e Thays
      // igual aos botoes, sem precisar de chave nova.
      obs: (typeof e.obs === 'string') ? e.obs : ''
    };
  }
  function marcarStatus(r, patch) {
    try {
      var m = getEnvios();
      var cur = _normSt(m[r]) || { enviado: false, por: '', enviadoTs: null, retornou: false, retornouTs: null, jaComprou: false, jaComprouTs: null, semWa: false, semWaTs: null, semRetorno: false, semRetornoTs: null, semInteresse: false, semInteresseTs: null, obs: '' };
      for (var k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k]; }
      m[r] = cur;
      Storage.scope(SCOPE).set('envios', m); // upsert -> Supabase (compartilhado Felipe/Thays)
    } catch (_) {}
  }
  // Default de "quem enviou": o usuario logado, se for Felipe ou Thays.
  function _currentUserName() {
    try {
      var u = (window.Auth && Auth.currentUser) ? Auth.currentUser() : null;
      var n = u ? String(u.name || u.username || '') : '';
      var low = n.toLowerCase();
      if (low.indexOf('felipe') >= 0) return 'Felipe';
      if (low.indexOf('thays') >= 0 || low.indexOf('thais') >= 0) return 'Thays';
      return '';
    } catch (_) { return ''; }
  }
  function cellStatusHTML(r, raw) {
    var s = _normSt(raw) || { enviado: false, por: '', retornou: false, semRetorno: false,
      semInteresse: false, semWa: false, demonstrouInteresse: false,
      jaOrcadoProjetta: false, jaComprouProjetta: false, jaComprouOutra: false };
    // Felipe s44: estrutura identica a da aba Pedidos (funil) — linha do
    // Enviado com o nome de quem enviou, e os 8 demais em grade 2x4.
    function b(cls, on, lbl, lblOn, titulo) {
      return '<button class="wkv-st wkv-st-' + cls + (on ? ' on' : '') + '"'
           + ' data-r="' + esc(r) + '"'
           + (titulo ? ' title="' + esc(titulo) + '"' : '') + '>'
           + (on ? lblOn : lbl) + '</button>';
    }
    var sel = s.por
      ? '<span class="wkv-por">' + esc(String(s.por).split(' ')[0]) + '</span>'
      : '';
    return '<div class="wkv-stwrap">'
      + '<div class="wkv-strow">'
      +   b('env', s.enviado, 'Enviado', '\u2713 Enviado', 'Marcar que a mensagem ja foi enviada')
      +   sel
      + '</div>'
      + '<div class="wkv-stgrid">'
      +   b('ret',  s.retornou,            'Retornou', '\u21a9 Retornou', 'Cliente respondeu, conversa em aberto')
      +   b('dem',  s.demonstrouInteresse, 'Demonstrou interesse', '\u2605 Demonstrou interesse', 'Respondeu e demonstrou interesse real na proposta')
      +   b('srt',  s.semRetorno,          'Sem retorno', '\u2205 Sem retorno', 'Mensagem enviada e o cliente nao respondeu')
      +   b('sin',  s.semInteresse,        'Sem interesse', '\u2716 Sem interesse', 'Cliente respondeu e recusou')
      +   b('swa',  s.semWa,               'Sem WhatsApp', '\u2298 Sem WhatsApp', 'O numero nao tem conta no WhatsApp')
      +   b('orc',  s.jaOrcadoProjetta,    'Ja orcado Projetta', '\u2713 Orcado Projetta', 'Ja existe orcamento da Projetta pra esse cliente')
      +   b('cmpp', s.jaComprouProjetta,   'Ja comprou Projetta', '\u2714 Comprou Projetta', 'Cliente que ja comprou da Projetta. Marcado, sai da prospeccao.')
      +   b('cmpo', s.jaComprouOutra,      'Ja comprou outra', '\u2714 Comprou outra', 'Ja comprou porta de outra marca — perdeu a janela de venda.')
      + '</div>'
      + '</div>';
  }

  function _refreshStatusCell(el, r) {
    var td = el.closest ? el.closest('.wkv-stcell') : null;
    if (td) td.innerHTML = cellStatusHTML(r, getEnvios()[r]);
  }

  // ---- vinculo manual com a Projetta (Felipe sessao 39) ----------
  // Quando o auto-match nao reconhece (cliente que ja fechou mas a
  // reserva Weiku nao bate com o AGP no CRM), o usuario cola o AGP.
  // Mapa weiku/vinculos {numReserva:{agp,etapa,cliente,res,ts,por}},
  // compartilhado na nuvem.
  function getVinculos() {
    try { if (!window.Storage) return {}; var m = Storage.scope(SCOPE).get('vinculos', {}); return (m && typeof m === 'object') ? m : {}; } catch (_) { return {}; }
  }
  function setVinculo(r, obj) { try { var m = getVinculos(); m[r] = obj; Storage.scope(SCOPE).set('vinculos', m); } catch (_) {} }
  function removerVinculo(r) { try { var m = getVinculos(); delete m[r]; Storage.scope(SCOPE).set('vinculos', m); } catch (_) {} }
  function _findByAgp(agp) {
    var dig = String(agp || '').replace(/\D/g, ''); if (!dig) return null;
    var n = parseInt(dig, 10); if (!n) return null;
    var ls = _getCrmLeads();
    for (var i = 0; i < ls.length; i++) {
      var d2 = String(ls[i].numeroAGP || '').replace(/\D/g, '');
      if (d2 && parseInt(d2, 10) === n) return ls[i];
    }
    return null;
  }
  // Auto-match primeiro; se nao houver, cai pro vinculo manual.
  function resolveProjetta(d) {
    var mp = matchProjetta(d);
    if (mp) return { tipo: 'auto', agp: mp.numeroAGP || '', res: String(mp.numeroReserva || '').replace(/\D/g, ''), etapa: mp.etapa || '', cliente: mp.cliente || mp.nome || '' };
    var v = getVinculos()[d.r];
    if (v && v.agp) return { tipo: 'manual', agp: v.agp, res: v.res || '', etapa: v.etapa || '', cliente: v.cliente || '' };
    return null;
  }
  function cellProjettaHTML(d) {
    var p = resolveProjetta(d);
    if (p && p.tipo === 'auto') {
      var meta = [];
      if (p.agp) meta.push(esc(p.agp));
      if (p.res) meta.push('Res ' + esc(p.res));
      var metaHtml = meta.length ? '<div class="wkv-loc" style="margin-top:3px;font-size:11px;color:#475569">' + meta.join(' \u00b7 ') + '</div>' : '';
      return '<span class="wkv-tag casa" title="Projetta: ' + esc(p.cliente) + (p.agp ? ' (AGP ' + esc(p.agp) + ')' : '') + ' \u2014 etapa: ' + esc(p.etapa) + '">\u2713 ' + esc(stageCurto(p.etapa)) + '</span>' + metaHtml;
    }
    if (p && p.tipo === 'manual') {
      return '<span class="wkv-tag casa" title="Vinculo manual com a Projetta">\ud83d\udd17 ' + (p.etapa ? esc(stageCurto(p.etapa)) : 'Vinculado') + '</span>'
        + '<div class="wkv-loc" style="margin-top:3px;font-size:11px;color:#475569">' + esc(p.agp) + ' <button class="wkv-vinc-edit" data-r="' + esc(d.r) + '" title="Editar / remover vinculo">\u270e</button></div>';
    }
    return '<span class="wkv-loc" style="color:#9ca3af">\u2014</span><div style="margin-top:3px"><button class="wkv-vinc-add" data-r="' + esc(d.r) + '" title="Vincular esta reserva a um AGP da Projetta">+ vincular AGP</button></div>';
  }
  // Pergunta o AGP, tenta achar no CRM (pra puxar etapa/cliente) e grava.
  // Retorna true se mudou algo (pra atualizar a celula).
  function vincularAGP(r, atual) {
    var inp = window.prompt('AGP da Projetta para esta reserva (ex.: AGP004646).\nDeixe em branco para remover o vinculo.', atual || '');
    if (inp === null) return false; // cancelou
    var agp = String(inp).trim();
    if (!agp) { removerVinculo(r); return true; }
    var lead = _findByAgp(agp);
    var obj = { agp: lead ? (lead.numeroAGP || agp) : agp, ts: Date.now(), por: _currentUserName() };
    if (lead) { obj.etapa = lead.etapa || ''; obj.cliente = lead.cliente || lead.nome || ''; obj.res = String(lead.numeroReserva || '').replace(/\D/g, ''); }
    setVinculo(r, obj);
    if (!lead) {
      try { window.alert('Vinculado a ' + obj.agp + '.\n\nObs: esse AGP nao foi encontrado no CRM agora (digitacao ou lead ainda nao sincronizado). O vinculo fica salvo do mesmo jeito.'); } catch (_) {}
    }
    return true;
  }

  // ---- detalhe do cliente (clique no nome) ------------------------
  function _resById(r) {
    var a = getReservas();
    for (var i = 0; i < a.length; i++) { if (String(a[i].r) === String(r)) return a[i]; }
    return null;
  }
  function _escClose(ev) { if (ev.key === 'Escape') fecharDetalhe(); }
  function fecharDetalhe() {
    var m = document.getElementById('wkv-modal');
    if (m && m.parentNode) m.parentNode.removeChild(m);
    document.removeEventListener('keydown', _escClose);
  }
  function abrirDetalhe(r) {
    var d = _resById(r); if (!d) return;
    fecharDetalhe();
    var st = _normSt(getEnvios()[d.r]) || { enviado: false, por: '', retornou: false };
    function row(lab, val) { return '<div class="wkv-drow"><span class="wkv-dlab">' + esc(lab) + '</span><span class="wkv-dval">' + (val == null || val === '' ? '\u2014' : val) + '</span></div>'; }
    var waBtn = temWa(d) ? ' <a class="wkv-mbtn wkv-wa-marca" target="_blank" rel="noopener" data-r="' + esc(d.r) + '" href="https://wa.me/' + esc(d.wa) + '">Abrir WhatsApp</a>' : '';
    var fone = (d.tel ? esc(d.tel) : '\u2014') + (d.wa ? ' <span class="wkv-loc">(' + esc(d.wa) + ')</span>' : '') + waBtn;
    var stTxt = (st.enviado ? ('\u2713 Enviada' + (st.por ? (' por ' + esc(st.por)) : '')) : 'N\u00e3o enviada') + ' \u00b7 ' + (st.retornou ? 'cliente retornou' : 'sem retorno');
    var body = ''
      + row('Nome', esc(tituloCase(d.nome)))
      + row('N\u00ba Reserva', esc(d.r))
      + row('Cidade', esc(d.cidade) + (d.uf ? (' \u00b7 ' + esc(d.uf)) : ''))
      + row('Tipo de constru\u00e7\u00e3o', esc(d.tipo))
      + row('N\u00ba Pavimentos', esc(d.pav))
      + row('Qtd Esquadrias', esc(d.esq))
      + row('Valor Aprovado', fmtMoeda(d.v))
      + row('Representante', esc(d.rep))
      + row('Data Or\u00e7amento', esc(d.data))
      + row('WhatsApp / Telefone', fone)
      + row('E-mail', d.email ? ('<a href="mailto:' + esc(d.email) + '">' + esc(d.email) + '</a>') : '')
      + row('Projetta', '<span class="wkv-dprojcell" data-r="' + esc(d.r) + '">' + cellProjettaHTML(d) + '</span>')
      + row('Prospec\u00e7\u00e3o', esc(stTxt));
    // Felipe s44: "nos fechados deixe campo de observacao dentro do card
    // igual na aba funil". A observacao ja existia, mas so na coluna da
    // TABELA — quem abria o card do cliente pra ver os dados nao via nem
    // conseguia anotar o que foi conversado sem fechar tudo.
    // Mesmo campo (envios[r].obs), mesmo layout do 60-weiku-pedidos.
    var obsAtual = st.obs || '';
    var obsBloco = '<div class="wkv-dobs">'
      + '<div class="wkv-dobs-lab">Observa\u00e7\u00f5es</div>'
      + '<textarea class="wkv-dobs-ta" id="wkv-obs-ta" placeholder="Anote aqui o que foi conversado, combinados, retorno do cliente...">' + esc(obsAtual) + '</textarea>'
      + '<div class="wkv-dobs-acoes">'
      +   '<button class="wkv-dobs-salvar" id="wkv-obs-salvar" data-r="' + esc(d.r) + '">Salvar observa\u00e7\u00e3o</button>'
      +   '<span class="wkv-dobs-status" id="wkv-obs-status"></span>'
      + '</div></div>';
    var ov = document.createElement('div');
    ov.id = 'wkv-modal'; ov.className = 'wkv-ovl';
    ov.innerHTML = '<div class="wkv-modal"><div class="wkv-mhead"><b>' + esc(tituloCase(d.nome) || ('Reserva ' + d.r)) + '</b><button class="wkv-mclose" title="Fechar">\u2715</button></div>'
      + '<div class="wkv-mbody">' + body + obsBloco + '</div>'
      + '<div class="wkv-mfoot">Dados conforme a planilha Weiku importada (CPF/RG e endere\u00e7o n\u00e3o s\u00e3o importados).</div></div>';
    document.body.appendChild(ov);
    // salvar observacao do card
    var btnObs = ov.querySelector('#wkv-obs-salvar');
    if (btnObs) btnObs.addEventListener('click', function () {
      var ta = ov.querySelector('#wkv-obs-ta');
      var stat = ov.querySelector('#wkv-obs-status');
      if (!ta) return;
      marcarStatus(d.r, { obs: ta.value, obsTs: Date.now(), obsPor: _currentUserName() });
      if (stat) {
        stat.textContent = '\u2713 salvo';
        stat.style.color = '#16a34a';
        setTimeout(function () { if (stat) stat.textContent = ''; }, 2500);
      }
    });
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) { fecharDetalhe(); return; }
      if (ev.target.closest('.wkv-mclose')) { fecharDetalhe(); return; }
      var vinc = ev.target.closest('.wkv-vinc-add') || ev.target.closest('.wkv-vinc-edit');
      if (vinc) {
        var cur = (getVinculos()[d.r] || {}).agp || '';
        if (vincularAGP(d.r, cur)) {
          var nd = _resById(d.r) || d;
          var cell = ov.querySelector('.wkv-dprojcell'); if (cell) cell.innerHTML = cellProjettaHTML(nd);
          var tcell = document.querySelector('.wkv-projcell[data-r="' + d.r + '"]'); if (tcell) tcell.innerHTML = cellProjettaHTML(nd);
        }
      }
    });
    document.addEventListener('keydown', _escClose);
  }

  // ---- cruzamento com CRM Projetta (Felipe sessao 35) -------------
  // Cruza cada reserva Weiku com os leads do CRM Projetta por RESERVA
  // ou por NOME (tokens — a reserva muda entre os sistemas quando o
  // cliente re-orca). Somente leitura; nao altera nada do CRM.
  var _projIdx = null;
  function _pnorm(s){ return String(s==null?'':s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
  var _PSTOP={E:1,DE:1,DA:1,DO:1,DAS:1,DOS:1,PV:1,ARQ:1,SR:1,SRA:1,CASA:1,PORTAS:1,PORTA:1,INTERNAS:1,LTDA:1,PROJETO:1,RESIDENCIAL:1,RESIDENCIA:1,EMPREENDIMENTOS:1,HOLDING:1,SA:1,ME:1,JUNIOR:1,NETO:1};
  function _ptoks(s){ return _pnorm(s).split(' ').filter(function(t){ return t.length>2 && !_PSTOP[t]; }); }
  function _psub(a,b){ for(var i=0;i<a.length;i++){ if(b.indexOf(a[i])<0) return false; } return a.length>0; }
  function _getCrmLeads(){ try{ if(!window.Storage) return []; var a=Storage.scope('crm').get('leads',[]); return Array.isArray(a)?a:[]; }catch(_){ return []; } }
  function _buildProjIdx(){
    var byRes={}, list=[];
    _getCrmLeads().forEach(function(l){
      var r=String(l.numeroReserva||'').replace(/\D/g,'');
      if(r) byRes[r]=l;
      list.push({ l:l, t:_ptoks(l.cliente||l.nome||'') });
    });
    _projIdx={ byRes:byRes, list:list };
  }
  // Felipe s43: alem do CRM, consulta o mapa da planilha ORCAMENTOS 2026
  // (scope weiku_pedidos / cruzamento_crm — chaves R<reserva> e N<nome>),
  // que inclui os orcamentos feitos FORA do sistema. So' leitura.
  var _planIdx = null;
  function _getMapaPlanilha(){
    if (_planIdx) return _planIdx;
    try { _planIdx = Storage.scope('weiku_pedidos').get('cruzamento_crm') || {}; }
    catch(_){ _planIdx = {}; }
    return _planIdx;
  }
  function matchProjetta(d){
    if(!_projIdx) _buildProjIdx();
    var r=String(d.r||'').replace(/\D/g,'');
    if(r && _projIdx.byRes[r]) return _projIdx.byRes[r];
    var wt=_ptoks(d.nome||'');
    if(wt.length>=2){
      for(var i=0;i<_projIdx.list.length;i++){
        var pt=_projIdx.list[i].t;
        if(pt.length>=2 && (_psub(pt,wt)||_psub(wt,pt))) return _projIdx.list[i].l;
      }
    }
    // fallback: mapa da planilha (orcamentos feitos fora do sistema tambem)
    var mp = _getMapaPlanilha();
    if(r && mp['R'+r]) return _planToLead(mp['R'+r]);
    var nn = _pnorm(d.nome||'');
    if(nn && nn.length>=5 && mp['N'+nn]) return _planToLead(mp['N'+nn]);
    return null;
  }
  // adapta a entrada da planilha pro formato que resolveProjetta espera ler
  // (numeroAGP, numeroReserva, etapa, cliente).
  function _planToLead(o){
    if(!o) return null;
    return {
      numeroAGP: o.agp || '',
      numeroReserva: '',
      etapa: o.etapa || 'orcado',
      cliente: '',
      _fontePlanilha: true, _sistema: o.sistema || '', _rep: o.rep || '',
      _valor: Number(o.valor)||0,
    };
  }
  function stageCurto(e){
    var m={'fazer-orcamento':'A orçar','orcamento-pronto':'Orç. pronto','orcamento-enviado':'Orç. enviado','negociacao':'Negociação','super-quente':'🔥 Super quente','fechado':'Fechado','perdido':'Perdido'};
    return m[e]||e||'\u2713';
  }

  // ---- helpers ----------------------------------------------------
  function fmtMoeda(v) {
    return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtCurto(v) {
    v = Number(v || 0);
    if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + ' mi';
    return 'R$ ' + Math.round(v / 1000) + ' mil';
  }
  function ehPredio(d) {
    var t = (d.tipo || '').toLowerCase();
    return /predio|pr\u00e9dio|edif|apart|apto|torre/.test(t) || (d.pav || 0) >= 5;
  }
  function temWa(d) { return d.wa && String(d.wa).length >= 12; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }

  // ---- filtro -----------------------------------------------------
  // Felipe sessao 35: data de fechamento (vem do campo 'data' do export —
  // Data Orcamento da reserva). Formato dd/mm/aaaa. Extrai ano e mes.
  function dataAnoMes(s) {
    var m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return { ano: '', mes: '' };
    return { ano: m[3], mes: m[2] };
  }
  function aplicarFiltro() {
    var optout = getOptout();
    var vmin = (ui.vmin == null ? 0 : ui.vmin);
    var vmax = (ui.vmax == null ? Infinity : ui.vmax);
    var pavMax = (ui.pavMax == null ? Infinity : ui.pavMax);
    var busca = (ui.busca || '').toLowerCase().trim();
    return getReservas().filter(function (d) {
      if (optout[d.r]) return false;
      if ((d.v || 0) < vmin || (d.v || 0) > vmax) return false;
      if (ui.excluiPredio && ehPredio(d)) return false;
      if ((d.pav || 0) > pavMax) return false;
      if (ui.uf && d.uf !== ui.uf) return false;
      if (ui.cidade && d.cidade !== ui.cidade) return false;
      if (ui.rep && d.rep !== ui.rep) return false;
      // Felipe s37: "So com WhatsApp" agora respeita a marcacao manual —
      // numero que a pessoa confirmou nao ter conta deixa de contar como
      // "com WhatsApp", senao ele voltava na lista todo dia.
      if (ui.soComWa && !temWaReal(d)) return false;
      // Felipe s37: cliente marcado como 'ja comprou' sai da prospeccao.
      if (ui.comprou) {
        var _st = _normSt(getEnvios()[d.reserva]);
        var _jc = !!(_st && _st.jaComprou);
        if (ui.comprou === 'ocultar' && _jc) return false;
        if (ui.comprou === 'so' && !_jc) return false;
      }
      // Felipe s42: filtro por orcamento na Projetta. Usa o mesmo
      // resolveProjetta que ja' pinta a coluna Projetta, entao cobre
      // tanto o auto-match por reserva quanto o vinculo manual de AGP.
      if (ui.projetta) {
        var _p = resolveProjetta(d);
        if (ui.projetta === 'com' && !_p) return false;
        if (ui.projetta === 'sem' && _p) return false;
      }
      // Felipe s38: "CRIE UM FILTRO PARA EU BUSCAR, ENTRE ENVIADO,
      // RETORNOU, SEM RETORNO ETC". Filtra pelo status da prospeccao.
      // Os estados NEGADOS (nao enviado / nao retornou) sao tao uteis
      // quanto os positivos: e' com eles que se monta a fila de quem
      // ainda precisa ser trabalhado.
      if (ui.status) {
        var _s = _normSt(getEnvios()[d.reserva]) || {};
        var _ok;
        switch (ui.status) {
          case 'enviado':       _ok = !!_s.enviado;      break;
          case 'nao_enviado':   _ok = !_s.enviado;       break;
          case 'retornou':      _ok = !!_s.retornou;     break;
          case 'sem_retorno':   _ok = !!_s.semRetorno;   break;
          case 'sem_interesse': _ok = !!_s.semInteresse; break;
          case 'ja_comprou':    _ok = !!_s.jaComprouProjetta; break;
          case 'comprou_outra': _ok = !!_s.jaComprouOutra;    break;
          case 'demonstrou':    _ok = !!_s.demonstrouInteresse; break;
          case 'ja_orcado':     _ok = !!_s.jaOrcadoProjetta;  break;
          case 'sem_wa':        _ok = !!_s.semWa;        break;
          // enviado ha tempo e ainda sem nenhum desfecho anotado — a
          // fila real de follow up, que era o dado mais dificil de achar
          // Felipe s44: os desfechos novos tambem tiram o cliente da fila
          // de follow up — se ja demonstrou interesse ou ja comprou de
          // outra marca, nao esta mais "aguardando resposta".
          case 'aguardando':    _ok = !!_s.enviado && !_s.retornou
                                      && !_s.semRetorno && !_s.semInteresse
                                      && !_s.demonstrouInteresse
                                      && !_s.jaComprouProjetta && !_s.jaComprouOutra; break;
          default:              _ok = true;
        }
        if (!_ok) return false;
      }
      if (ui.ano || ui.mes) {
        var dm = dataAnoMes(d.data);
        if (ui.ano && dm.ano !== ui.ano) return false;
        if (ui.mes && dm.mes !== ui.mes) return false;
      }
      // Felipe s37: busca tambem por TELEFONE e RESERVA. "ou preciso
      // pesquisar pelo nome ou pelo telefone, ai acho ele e atualizo
      // respostas" — quando o cliente responde no WhatsApp, o que se tem
      // em maos e' o numero, nao o nome. Antes so' casava nome e cidade.
      // Telefone compara so' os DIGITOS, entao acha com ou sem mascara:
      // "65984262946", "(65) 98426-2946" e "984262946" chegam no mesmo.
      if (busca) {
        var _txt = ((d.nome || '') + ' ' + (d.cidade || '') + ' '
                  + (d.email || '') + ' ' + (d.r || '')).toLowerCase();
        var _achouTexto = _txt.indexOf(busca) >= 0;
        var _achouFone = false;
        var _buscaDig = String(busca).replace(/\D/g, '');
        if (_buscaDig.length >= 4) {
          var _fones = [d.wa, d.tel, d.telefone, d.celular]
            .filter(Boolean).join(' ').replace(/\D/g, '');
          _achouFone = _fones.indexOf(_buscaDig) >= 0;
        }
        if (!_achouTexto && !_achouFone) return false;
      }
      return true;
    });
  }

  // ---- importacao de CSV (extracao da intranet Weiku) -------------
  // O CSV e lido no navegador do usuario (disco -> browser -> Supabase).
  // CPF e RG NAO sao importados. Reutilizavel a cada nova extracao.
  function parseCSVTexto(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    var rows = [], row = [], field = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else {
        if (c === '"') q = true;
        else if (c === ';') { row.push(field); field = ''; }
        else if (c === '\r') { /* skip */ }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) {
      return r.length > 1 && r.some(function (c) { return (c || '').trim(); });
    });
  }

  var _small = { de: 1, do: 1, da: 1, dos: 1, das: 1, e: 1, di: 1, del: 1 };
  function tituloCase(s) {
    if (!s) return '';
    return s.toUpperCase().toLowerCase().split(/\s+/).map(function (w, i) {
      if (i > 0 && _small[w]) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }
  function moedaNum(s) {
    if (!s) return 0;
    var n = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    var v = parseFloat(n); return isNaN(v) ? 0 : v;
  }
  function waNum(tel) {
    var d = (tel || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length >= 10 && d.length <= 11) d = '55' + d;
    return d;
  }
  function limparCSV(rows) {
    var header = rows[0].map(function (h) { return (h || '').trim(); });
    var idx = {}; header.forEach(function (h, i) { idx[h] = i; });
    function g(r, name) { var i = idx[name]; return i == null ? '' : (r[i] || '').trim(); }
    return rows.slice(1).map(function (r) {
      var cel = g(r, 'Celular'), tel = g(r, 'Telefone');
      return {
        r: g(r, 'N\u00ba Reserva'),
        nome: tituloCase(g(r, 'Nome Completo') || g(r, 'Respons\u00e1vel Legal')),
        cidade: tituloCase(g(r, 'Cidade')),
        uf: g(r, 'Estado').toUpperCase().slice(0, 2),
        tipo: g(r, 'Tipo Constru\u00e7\u00e3o').toUpperCase().toLowerCase(),
        pav: parseInt(g(r, 'N\u00ba Pavimentos').replace(/\D/g, ''), 10) || 0,
        esq: g(r, 'Qtd Esquadrias'),
        v: moedaNum(g(r, 'Valor Aprovado')),
        rep: tituloCase(g(r, 'Representante')),
        data: g(r, 'Data Or\u00e7amento'),
        wa: waNum(cel || tel),
        email: (g(r, 'E-mail Cobran\u00e7a') || g(r, 'E-mail NFe') || '').toLowerCase(),
        tel: cel || tel
        // CPF / RG: deliberadamente NAO importados
      };
    }).filter(function (x) { return x.r; });
  }
  function processarArquivo(file, container) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var rows = parseCSVTexto(e.target.result);
        if (!rows.length) { window.alert('CSV vazio ou ilegivel.'); return; }
        var regs = limparCSV(rows);
        if (!regs.length) { window.alert('Nenhum registro valido no CSV. Confira se e o arquivo certo.'); return; }
        if (!window.Storage) { window.alert('Storage indisponivel.'); return; }
        // Felipe sessao 37: 'como faremos para puxar as reservas de
        // 01/06/2026 ate hoje?' — export PARCIAL da intranet nao pode
        // apagar a base. Se ja existe base, oferece MESCLAR (novo CSV
        // adiciona/atualiza pelo numero da reserva; o que nao esta no
        // CSV permanece) ou SUBSTITUIR (comportamento antigo).
        var atuais = [];
        try { atuais = getReservas() || []; } catch (_) {}
        var regsFinal = regs;
        var modoTxt = 'importadas (base nova)';
        if (atuais.length) {
          var mesclar = window.confirm(
            'A base atual tem ' + atuais.length + ' reservas e o CSV tem ' + regs.length + '.\n\n' +
            'OK = MESCLAR (recomendado pra export parcial, ex: so junho/julho):\n' +
            '  adiciona as novas e atualiza as existentes pelo numero da reserva;\n' +
            '  o que nao esta no CSV permanece como esta.\n\n' +
            'Cancelar = escolher SUBSTITUIR a base inteira.');
          if (mesclar) {
            var byR = {};
            atuais.forEach(function (d) { if (d && d.r) byR[d.r] = d; });
            var novas = 0, atualizadas = 0;
            regs.forEach(function (d) {
              if (!d || !d.r) return;
              if (byR[d.r]) atualizadas++; else novas++;
              byR[d.r] = d; // CSV novo vence
            });
            regsFinal = Object.keys(byR).map(function (k) { return byR[k]; });
            modoTxt = 'mescladas (' + novas + ' novas, ' + atualizadas + ' atualizadas, total ' + regsFinal.length + ')';
          } else {
            if (!window.confirm('SUBSTITUIR a base inteira? (' + atuais.length + ' -> ' + regs.length + ' reservas)\n\nCPF/RG NAO serao salvos. O opt-out e mantido.')) return;
            modoTxt = 'importadas (base substituida)';
          }
        } else {
          if (!window.confirm('Importar ' + regs.length + ' reservas Weiku?\n\nCPF/RG NAO serao salvos. O opt-out e mantido.')) return;
        }
        Storage.scope(SCOPE).set('reservas', regsFinal);
        _cloudReservas = regsFinal; // mostra a base completa na hora (sem truncar no localStorage)
        window.alert(regsFinal.length + ' reservas na base — ' + modoTxt + '.\nSincronizando com o Supabase em segundo plano.');
        render(container);
      } catch (err) {
        console.error('[weiku-vendas] erro ao importar CSV', err);
        window.alert('Erro ao processar o CSV: ' + (err && err.message));
      }
    };
    reader.onerror = function () { window.alert('Nao consegui ler o arquivo.'); };
    reader.readAsText(file, 'utf-8');
  }
  function bindImport(container) {
    var btn = container.querySelector('#wkv-import-btn');
    var inp = container.querySelector('#wkv-file');
    if (!btn || !inp) return;
    btn.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      if (inp.files && inp.files[0]) processarArquivo(inp.files[0], container);
      inp.value = '';
    });
  }

  // ---- CSS (escopado .wkv-) ---------------------------------------
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.wkv-app{--wkv-tinta:#003144;--wkv-tinta2:#0a4256;--wkv-teal:#0f766e;--wkv-amb:#c47012;--wkv-amb-bg:#FFF4E6;--wkv-linha:#E4E8EE;--wkv-cinza:#6b7280;--wkv-cinza2:#4a5160;max-width:min(2100px,98vw);margin:0 auto;padding:4px 6px 50px;font-size:14px}',
      '.wkv-app .wkv-num{font-variant-numeric:tabular-nums}',
      '.wkv-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:6px 0 16px}',
      '.wkv-kpi{background:#fff;border:1px solid var(--wkv-linha);border-radius:12px;padding:14px 16px;position:relative;overflow:hidden}',
      '.wkv-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--wkv-amb)}',
      '.wkv-kpi .wkv-lab{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--wkv-cinza)}',
      '.wkv-kpi .wkv-val{font-weight:800;font-size:24px;color:var(--wkv-tinta);margin-top:5px}',
      '.wkv-kpi .wkv-val small{font-size:13px;font-weight:600;color:var(--wkv-cinza2)}',
      '.wkv-panel{background:#fff;border:1px solid var(--wkv-linha);border-radius:14px;padding:16px 18px;margin-bottom:16px}',
      '.wkv-panel h3{font-size:12px;text-transform:uppercase;letter-spacing:.7px;color:var(--wkv-tinta);margin:0 0 13px;display:flex;align-items:center;gap:8px}',
      '.wkv-panel h3:before{content:"";width:8px;height:8px;background:var(--wkv-amb);border-radius:2px;transform:rotate(45deg)}',
      '.wkv-filtros{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:13px;align-items:end}',
      '.wkv-fld label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--wkv-cinza);margin-bottom:5px;font-weight:600}',
      '.wkv-fld input,.wkv-fld select{width:100%;padding:9px 11px;border:1px solid var(--wkv-linha);border-radius:8px;font:inherit;background:#fafbfc;color:#1f2937}',
      '.wkv-fld input:focus,.wkv-fld select:focus{outline:none;border-color:var(--wkv-teal);background:#fff;box-shadow:0 0 0 3px rgba(15,118,110,.12)}',
      '.wkv-chk{display:flex;align-items:center;gap:8px;font-weight:600;color:var(--wkv-tinta);cursor:pointer;user-select:none;padding-bottom:9px}',
      '.wkv-chk input{width:17px;height:17px;accent-color:var(--wkv-amb)}',
      '.wkv-acoes{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}',
      '.wkv-btn{border:none;border-radius:8px;padding:9px 16px;font:inherit;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px}',
      '.wkv-btn-tinta{background:var(--wkv-tinta);color:#fff}.wkv-btn-tinta:hover{background:var(--wkv-tinta2)}',
      '.wkv-btn-out{background:#fff;color:var(--wkv-tinta);border:1px solid var(--wkv-linha)}.wkv-btn-out:hover{border-color:var(--wkv-teal);color:var(--wkv-teal)}',
      '.wkv-tmpl textarea{width:100%;min-height:230px;padding:11px 13px;border:1px solid var(--wkv-linha);border-radius:8px;font:inherit;line-height:1.5;resize:vertical;background:#fafbfc}',
      '.wkv-msgbar{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}',
      '.wkv-btn-salvamsg{padding:7px 16px;border:none;border-radius:6px;background:var(--wkv-tinta);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}',
      '.wkv-btn-salvamsg:hover{background:var(--wkv-tinta2)}',
      '.wkv-btn-msgfab{padding:7px 12px;border:1px solid var(--wkv-linha);border-radius:6px;background:#fff;font-size:12.5px;cursor:pointer;font-family:inherit;color:#6b7280}',
      '.wkv-msgstatus{font-size:12.5px;font-weight:600}',
      '.wkv-msgstatus.ok{color:#15803d}',
      '.wkv-msgstatus.alterada{color:#b45309}',
      '.wkv-hint{font-size:11px;color:var(--wkv-cinza);margin-top:6px}',
      '.wkv-hint code{background:var(--wkv-amb-bg);color:var(--wkv-amb);padding:1px 6px;border-radius:4px;font-weight:600}',
      '.wkv-tablewrap{background:#fff;border:1px solid var(--wkv-linha);border-radius:14px;overflow:hidden}',
      '.wkv-tbar{display:flex;justify-content:space-between;align-items:center;padding:12px 18px;border-bottom:1px solid var(--wkv-linha);background:#fbfcfd}',
      '.wkv-tbar .wkv-cnt{font-weight:700;color:var(--wkv-tinta)}.wkv-tbar .wkv-cnt b{color:var(--wkv-amb)}',
      '.wkv-scroll{overflow:auto;max-height:620px}',
      '.wkv-app table{width:100%;border-collapse:collapse}',
      '.wkv-app thead th{background:var(--wkv-tinta);color:#cfe0e8;font-size:11px;text-transform:uppercase;letter-spacing:.5px;text-align:left;padding:11px 12px;font-weight:600;cursor:pointer;white-space:nowrap;position:sticky;top:0;z-index:1}',
      '.wkv-app thead th:hover{color:#fff}',
      '.wkv-app thead th.wkv-so:after{content:" \u25be";color:var(--wkv-amb)}',
      '.wkv-app thead th.wkv-sa:after{content:" \u25b4";color:var(--wkv-amb)}',
      '.wkv-app tbody td{padding:10px 12px;border-bottom:1px solid var(--wkv-linha);vertical-align:middle}',
      '.wkv-app tbody tr:nth-child(even){background:#fafbfc}',
      '.wkv-app tbody tr:hover{background:var(--wkv-amb-bg)}',
      '.wkv-nome{font-weight:600;color:var(--wkv-tinta)}',
      '.wkv-loc{font-size:12px;color:var(--wkv-cinza2)}',
      '.wkv-tag{display:inline-block;font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;text-transform:capitalize}',
      '.wkv-tag.casa{background:#e7f5ee;color:#0f766e}.wkv-tag.predio{background:#fde8e8;color:#c0392b}.wkv-tag.outro{background:#eef0f3;color:#6b7280}',
      '.wkv-vlr{font-weight:700;color:var(--wkv-tinta);text-align:right;white-space:nowrap}',
      '.wkv-ico{width:30px;height:30px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:14px;border:1px solid var(--wkv-linha);background:#fff;cursor:pointer}',
      '.wkv-ico.wkv-mail{border:none;cursor:pointer;font:inherit}',
      '.wkv-ico.wa{color:#25D366;border-color:#cdebd6}.wkv-ico.wa:hover{background:#25D366;color:#fff}',
      '.wkv-ico.mail{color:var(--wkv-amb);border-color:#f3dcc0}.wkv-ico.mail:hover{background:var(--wkv-amb);color:#fff}',
      '.wkv-ico.dis{opacity:.3;pointer-events:none}',
      '.wkv-rmv{background:none;border:none;color:var(--wkv-cinza);cursor:pointer;font-size:13px}.wkv-rmv:hover{color:#c0392b}',
      '.wkv-stwrap{display:flex;flex-direction:column;gap:4px;align-items:center}',
      '.wkv-por{font:inherit;font-size:11px;color:#4a5160;padding:2px 7px;border:1px solid var(--wkv-linha);border-radius:6px;background:#fff;white-space:nowrap}',
      '.wkv-strow{display:flex;gap:4px;align-items:center;justify-content:center}',
      // Felipe s44: grade 2 colunas igual a aba Pedidos (funil)
      '.wkv-stgrid{display:grid;grid-template-columns:1fr 1fr;gap:4px;justify-items:stretch;width:100%}',
      '.wkv-stgrid .wkv-st{width:100%;text-align:center}',
      '.wkv-st{font:inherit;font-size:11px;font-weight:600;padding:3px 9px;border:1px solid var(--wkv-linha);border-radius:999px;background:#fff;color:var(--wkv-cinza2);cursor:pointer;white-space:nowrap;line-height:1.4}',
      '.wkv-st:hover{border-color:var(--wkv-teal);color:var(--wkv-teal)}',
      '.wkv-st-env.on{background:#dcfce7;border-color:#16a34a;color:#15803d}.wkv-st-env.on:hover{color:#15803d}',
      // Felipe s44: cores identicas as da aba Pedidos, pra mesma marcacao
      // ter a mesma cor nas duas telas
      '.wkv-st-dem.on{background:#16a34a;border-color:#15803d;color:#fff;font-weight:700}.wkv-st-dem.on:hover{color:#fff;background:#15803d}',
      '.wkv-st-swa.on{background:#64748b;border-color:#475569;color:#fff;font-weight:600}.wkv-st-swa.on:hover{color:#fff}',
      '.wkv-st-orc.on{background:#6d28d9;border-color:#5b21b6;color:#fff;font-weight:600}.wkv-st-orc.on:hover{color:#fff}',
      '.wkv-st-cmpp.on{background:#0f3f5f;border-color:#0f3f5f;color:#fff;font-weight:600}.wkv-st-cmpp.on:hover{color:#fff}',
      '.wkv-st-cmpo.on{background:#7c2d12;border-color:#7c2d12;color:#fff;font-weight:600}.wkv-st-cmpo.on:hover{color:#fff}',
      '.wkv-st-ret.on{background:#dbeafe;border-color:#2563eb;color:#1d4ed8}.wkv-st-ret.on:hover{color:#1d4ed8}',
      '.wkv-st-cmp.on{background:#0f3f5f;border-color:#0f3f5f;color:#fff;font-weight:600}.wkv-st-cmp.on:hover{color:#fff}',
      '.wkv-tbusca{margin-left:auto;padding:6px 10px;border:1px solid var(--wkv-linha);border-radius:7px;font:inherit;font-size:13px;min-width:230px}',
      '.wkv-tbar{display:flex;align-items:center;gap:12px}',
      '.wkv-btn-ordpad{padding:6px 12px;border:1px solid var(--wkv-linha);border-radius:7px;background:#fff;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}',
      '.wkv-btn-ordpad:hover{background:#f8fafc}',
      '.wkv-st-srt.on{background:#475569;border-color:#334155;color:#fff;font-weight:700}.wkv-st-srt.on:hover{color:#fff;background:#334155}',
      '.wkv-st-sin.on{background:#b45309;border-color:#92400e;color:#fff;font-weight:700}.wkv-st-sin.on:hover{color:#fff;background:#92400e}',
      '.wkv-tstatus{margin-left:8px;padding:6px 8px;border:1px solid var(--line,#e5e7eb);border-radius:6px;font-size:12.5px;font-family:inherit;background:#fff;cursor:pointer}',
      // Felipe s44: observacao dentro do card, mesmo visual do funil
      '.wkv-dobs{margin-top:14px;padding-top:14px;border-top:2px solid var(--wkv-linha)}',
      '.wkv-dobs-lab{font-weight:700;font-size:13px;color:var(--wkv-tinta);margin-bottom:6px}',
      '.wkv-dobs-ta{width:100%;min-height:80px;box-sizing:border-box;border:1px solid var(--wkv-linha);border-radius:8px;padding:10px;font:inherit;font-size:13px;resize:vertical;background:#FFFDF8}',
      '.wkv-dobs-ta:focus{outline:none;border-color:var(--wkv-amb);background:#fff}',
      '.wkv-dobs-acoes{display:flex;align-items:center;gap:10px;margin-top:8px}',
      '.wkv-dobs-salvar{background:var(--wkv-tinta);color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600}',
      '.wkv-dobs-salvar:hover{opacity:.9}',
      '.wkv-dobs-status{font-size:12px;font-weight:600}',
      '.wkv-tstatus:focus{outline:none;border-color:#0f2c4c}',
      '.wkv-st-swa{font-size:10px;line-height:1.25;white-space:normal;text-align:left}',
      '.wkv-st-swa.on{background:#fee2e2;border-color:#dc2626;color:#b91c1c;font-weight:600}.wkv-st-swa.on:hover{color:#b91c1c}',
      '.wkv-open{background:none;border:none;padding:0;font:inherit;cursor:pointer;text-align:left;color:inherit}',
      '.wkv-open:hover{color:var(--wkv-teal);text-decoration:underline}',
      '.wkv-fone{font-size:11px;color:var(--wkv-cinza2);margin-top:3px;font-variant-numeric:tabular-nums}',
      '.wkv-vinc-add,.wkv-vinc-edit{background:none;border:1px dashed var(--wkv-linha);border-radius:6px;font:inherit;font-size:11px;padding:1px 7px;cursor:pointer;color:var(--wkv-teal)}',
      '.wkv-vinc-add:hover,.wkv-vinc-edit:hover{border-color:var(--wkv-teal);background:#f0fdfa}',
      '.wkv-ovl{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px}',
      '.wkv-modal{background:#fff;border-radius:14px;max-width:540px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}',
      '.wkv-mhead{display:flex;justify-content:space-between;align-items:center;padding:15px 20px;border-bottom:1px solid var(--wkv-linha);background:var(--wkv-tinta);color:#fff}',
      '.wkv-mhead b{font-size:16px}',
      '.wkv-mclose{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:0 4px}',
      '.wkv-mbody{padding:6px 20px;overflow:auto}',
      '.wkv-drow{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid #f1f5f9}',
      '.wkv-drow:last-child{border-bottom:none}',
      '.wkv-dlab{flex:0 0 150px;color:var(--wkv-cinza2);font-size:13px}',
      '.wkv-dval{flex:1;color:var(--wkv-tinta);font-size:13px;font-weight:600;word-break:break-word}',
      '.wkv-mfoot{padding:11px 20px;border-top:1px solid var(--wkv-linha);font-size:11px;color:var(--wkv-cinza2);background:#f8fafc}',
      '.wkv-mbtn{display:inline-block;background:#25D366;color:#fff;border-radius:6px;padding:2px 9px;font-size:11px;font-weight:600;text-decoration:none;margin-left:6px}.wkv-mbtn:hover{background:#1faf53}',
      '.wkv-foot{font-size:12px;color:var(--wkv-cinza);margin-top:14px;line-height:1.6;background:#fff;border:1px dashed var(--wkv-linha);border-radius:10px;padding:13px 16px}',
      '.wkv-foot b{color:var(--wkv-amb)}',
      '.wkv-empty{text-align:center;padding:54px 20px;color:var(--wkv-cinza)}',
      '.wkv-empty .wkv-big{font-size:40px;margin-bottom:10px}',
      '.wkv-empty h3{color:var(--wkv-tinta);margin:0 0 8px;text-transform:none;letter-spacing:0;font-size:18px}',
      '@media(max-width:760px){.wkv-kpis{grid-template-columns:repeat(2,1fr)}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---- layout (uma vez) -------------------------------------------
  function layoutHTML(ufs, reps, cidades) {
    return ''
      + '<div class="wkv-app">'
      + '  <div class="wkv-kpis">'
      + '    <div class="wkv-kpi"><div class="wkv-lab">Clientes no filtro</div><div class="wkv-val wkv-num" id="wkv-k-cnt">\u2014</div></div>'
      + '    <div class="wkv-kpi"><div class="wkv-lab">Valor aprovado (soma)</div><div class="wkv-val wkv-num" id="wkv-k-soma">\u2014</div></div>'
      + '    <div class="wkv-kpi"><div class="wkv-lab">Ticket medio</div><div class="wkv-val wkv-num" id="wkv-k-med">\u2014</div></div>'
      + '    <div class="wkv-kpi"><div class="wkv-lab">Com WhatsApp</div><div class="wkv-val wkv-num" id="wkv-k-wa">\u2014</div></div>'
      + '  </div>'
      + '  <div class="wkv-panel"><h3>Filtro inteligente</h3>'
      + '    <div class="wkv-filtros">'
      + '      <div class="wkv-fld"><label>Buscar nome / cidade</label><input id="wkv-f-busca" placeholder="nome, telefone, cidade ou reserva"></div>'
      + '      <div class="wkv-fld"><label>Valor minimo (R$)</label><input id="wkv-f-vmin" type="number" value="' + (ui.vmin == null ? '' : ui.vmin) + '" step="10000" placeholder="sem minimo"></div>'
      + '      <div class="wkv-fld"><label>Valor maximo (R$)</label><input id="wkv-f-vmax" type="number" placeholder="sem limite" value="' + (ui.vmax == null ? '' : ui.vmax) + '"></div>'
      + '      <div class="wkv-fld"><label>Max. pavimentos</label><input id="wkv-f-pav" type="number" placeholder="qualquer" min="1"></div>'
      + '      <div class="wkv-fld"><label>Ano fechamento</label><select id="wkv-f-ano"><option value="">Todos</option>'
      // Felipe sessao 37: 'queria filtrar por mes e por ano' — anos gerados
      // dos DADOS reais (antes hardcoded 2025/2026; a prova de 2027+).
      +          (function () {
                   var anos = {};
                   try {
                     getReservas().forEach(function (d) {
                       var a = dataAnoMes(d.data).ano;
                       if (a) anos[a] = 1;
                     });
                   } catch (_) {}
                   var lista = Object.keys(anos).sort();
                   if (!lista.length) lista = ['2025', '2026'];
                   return lista.map(function (a) {
                     return '<option value="' + a + '"' + (ui.ano === a ? ' selected' : '') + '>' + a + '</option>';
                   }).join('');
                 })()
      +          '</select></div>'
      + '      <div class="wkv-fld"><label>Mes</label><select id="wkv-f-mes"><option value="">Todos</option>'
      +          ['01 Jan','02 Fev','03 Mar','04 Abr','05 Mai','06 Jun','07 Jul','08 Ago','09 Set','10 Out','11 Nov','12 Dez'].map(function (m) { var n = m.slice(0, 2); return '<option value="' + n + '"' + (ui.mes === n ? ' selected' : '') + '>' + m + '</option>'; }).join('')
      +          '</select></div>'
      + '      <div class="wkv-fld"><label>Estado</label><select id="wkv-f-uf"><option value="">Todos</option>' + ufs.map(function (u) { return '<option>' + esc(u) + '</option>'; }).join('') + '</select></div>'
      + '      <div class="wkv-fld"><label>Cidade</label><select id="wkv-f-cidade"><option value="">Todas</option>' + (cidades || []).map(function (c) { return '<option' + (ui.cidade === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>'
      + '      <div class="wkv-fld"><label>Representante</label><select id="wkv-f-rep"><option value="">Todos</option>' + reps.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select></div>'
      + '      <label class="wkv-chk"><input type="checkbox" id="wkv-f-npredio"' + (ui.excluiPredio ? ' checked' : '') + '> Excluir predios</label>'
      + '      <label class="wkv-chk"><input type="checkbox" id="wkv-f-comwa"' + (ui.soComWa ? ' checked' : '') + '> So com WhatsApp</label>'
      + '      <div class="wkv-fld"><label>Ja comprou</label><select id="wkv-f-comprou">'
      +        [['ocultar','Ocultar quem ja comprou'],['','Mostrar todos'],['so','\u2713 SO os que ja compraram']]
             .map(function(o){ return '<option value="'+o[0]+'"'+((ui.comprou||'')===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
      + '      </select></div>'
      + '      <div class="wkv-fld"><label>Orcamento Projetta</label><select id="wkv-f-proj">'
      +        [['','Todos'],['com','\u2713 Ja tem orcamento'],['sem','Sem orcamento']]
             .map(function(o){ return '<option value="'+o[0]+'"'+((ui.projetta||'')===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
      + '      </select></div>'
      + '    </div>'
      + '    <div class="wkv-acoes">'
      + '      <button class="wkv-btn wkv-btn-out" id="wkv-reset">\u21ba Limpar filtros</button>'
      + '      <button class="wkv-btn wkv-btn-tinta" id="wkv-export">\u2b07 Exportar lista filtrada (CSV)</button>'
      + '      <button class="wkv-btn wkv-btn-out" id="wkv-import-btn">\u2b06 Importar/atualizar base (CSV)</button>'
      + '      <input type="file" id="wkv-file" accept=".csv,text/csv" style="display:none">'
      + '    </div>'
      + '  </div>'
      + '  <div class="wkv-panel"><h3>Mensagem de WhatsApp</h3>'
      + '    <div class="wkv-tmpl"><textarea id="wkv-msg">' + esc(ui.msg) + '</textarea>'
      + '      <div class="wkv-msgbar">'
      + '        <button id="wkv-msg-salvar" class="wkv-btn-salvamsg">\ud83d\udcbe Salvar mensagem</button>'
      + '        <button id="wkv-msg-fabrica" class="wkv-btn-msgfab" title="Volta ao texto original do sistema. Nao salva sozinho — confira e clique em Salvar.">\u21ba Texto original</button>'
      + '        <span id="wkv-msg-status" class="wkv-msgstatus"></span>'
      + '      </div>'
      + '      <div class="wkv-hint">Use <code>{nome}</code> para inserir o primeiro nome do cliente automaticamente no link.</div></div>'
      + '  </div>'
      + '  <div class="wkv-tablewrap">'
      + '    <div class="wkv-tbar"><div class="wkv-cnt"><b id="wkv-t-cnt">0</b> clientes \u00b7 <span class="wkv-num" id="wkv-t-soma">R$ 0,00</span></div>'
      // Felipe s37: busca por nome AQUI, junto da tabela. Ja' existia no
      // Filtro Inteligente la' em cima, mas com placeholder "ex: Joinville"
      // — parecia so' de cidade, e com a tabela rolada pra baixo o campo
      // ficava fora da tela. Este e o de cima sao o MESMO filtro (ui.busca),
      // sincronizados nos dois sentidos.
      + '      <input id="wkv-t-busca" class="wkv-tbusca" placeholder="\ud83d\udd0d Buscar por nome ou telefone..." value="' + esc(ui.busca || '') + '">'
      // Felipe s38: filtro por status da prospeccao, ao lado da busca.
      + '      <select id="wkv-t-status" class="wkv-tstatus" title="Filtra pelo status da prospeccao">'
      + (function () {
          var opts = [
            ['',              'Todos os status'],
            ['aguardando',    'Aguardando resposta'],
            ['nao_enviado',   'Ainda nao enviado'],
            ['enviado',       'Enviado'],
            ['retornou',      'Retornou'],
            ['sem_retorno',   'Sem retorno'],
            ['sem_interesse', 'Sem interesse'],
            ['demonstrou',    'Demonstrou interesse'],
            ['ja_orcado',     'Ja orcado Projetta'],
            ['ja_comprou',    'Ja comprou Projetta'],
            ['comprou_outra', 'Ja comprou outra'],
            ['sem_wa',        'Sem WhatsApp'],
          ];
          return opts.map(function (o) {
            return '<option value="' + o[0] + '"' + ((ui.status || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('');
        })()
      + '      </select>'
      // Felipe s37: volta pra ordenacao padrao (data + valor) depois de
      // ter ordenado de outro jeito, sem precisar refazer os 2 cliques.
      + '      <button id="wkv-t-ordpad" class="wkv-btn-ordpad" title="Volta pra ordenacao padrao: Fechamento (mais recente) e, dentro da data, maior valor primeiro.">\u21ba Ordem padrao</button>'
      + '    </div>'
      + '    <div class="wkv-scroll"><table>'
      + '      <thead><tr>'
      + '        <th data-s="nome">Cliente</th><th data-s="uf">Local</th><th data-s="tipo">Tipo</th>'
      + '        <th data-s="pav" style="text-align:center">Pav.</th><th data-s="esq" style="text-align:center">Esq.</th>'
      + '        <th data-s="v" style="text-align:right">Valor aprovado</th>'
      + '        <th data-s="data" style="text-align:center">Fechamento</th>'
      + '        <th data-s="rep">Representante</th>'
      + '        <th style="text-align:center">Projetta</th>'
      + '        <th style="text-align:center">Prospec\u00e7\u00e3o</th>'
      + '        <th style="text-align:center">Contato</th>'
      + '      </tr></thead><tbody id="wkv-tb"></tbody>'
      + '    </table></div>'
      + '  </div>'
      + '  <div class="wkv-foot"><b>Dados:</b> reservas Weiku fechadas (grupo Weiku/Projetta). CPF/RG nao sao armazenados. '
      + '  <b>Opt-out:</b> ao remover (\u2715) um contato, ele fica salvo e nao aparece mais — respeite quem pedir pra nao receber.</div>'
      + '</div>';
  }

  function emptyHTML() {
    return ''
      + '<div class="wkv-app"><div class="wkv-tablewrap"><div class="wkv-empty">'
      + '  <div class="wkv-big">\ud83c\udfd7\ufe0f</div>'
      + '  <h3>Nenhuma reserva Weiku importada ainda</h3>'
      + '  <p>A base de prospeccao ainda nao foi carregada no Supabase (scope <code>weiku/reservas</code>).<br>'
      + '  Clique abaixo e selecione o CSV extraido da intranet Weiku — os clientes aparecem aqui automaticamente.</p>'
      + '  <button class="wkv-btn wkv-btn-tinta" id="wkv-import-btn" style="margin-top:10px">\u2b06 Importar CSV de reservas</button>'
      + '  <input type="file" id="wkv-file" accept=".csv,text/csv" style="display:none">'
      + '</div></div></div>';
  }

  // ---- render da tabela + KPIs ------------------------------------
  function renderTabela(container) {
    _projIdx = null; // recarrega leads do CRM a cada render
    var lista = aplicarFiltro();
    // Felipe s37: ORDENACAO EM CAMADAS. "quero fazer ali filtro por camada,
    // primeiro por data depois por valor."
    // Antes ordenava por UMA coluna so': clicar em Valor perdia a ordem de
    // data, e clicar em Data deixava os valores embaralhados dentro do
    // mesmo dia. Agora a coluna clicada e' a camada PRINCIPAL e as demais
    // entram como desempate, na ordem em que foram clicadas.
    // ui.sortLayers = [{k:'dt', asc:false}, {k:'v', asc:false}, ...]
    var camadas = (ui.sortLayers && ui.sortLayers.length)
      ? ui.sortLayers
      : [{ k: ui.sortKey, asc: ui.sortAsc }];
    function _cmp(a, b, k, asc) {
      var x = a[k], y = b[k];
      // Felipe s37: DATA nao pode ser comparada como TEXTO. O campo vem
      // em dd/mm/aaaa, entao a comparacao alfabetica ordenava pelo DIA
      // primeiro, depois mes, depois ano — por isso a lista misturava
      // 2026, 2025 e 2026 de novo (31/03/2026 vinha antes de 31/01/2025
      // porque '03' > '01'). Converte pra aaaammdd antes de comparar.
      if (k === 'data') {
        x = _dataOrdenavel(x); y = _dataOrdenavel(y);
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      }
      if (typeof x === 'string' || typeof y === 'string') {
        x = String(x == null ? '' : x).toLowerCase();
        y = String(y == null ? '' : y).toLowerCase();
      } else { x = x || 0; y = y || 0; }
      return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
    }
    lista.sort(function (a, b) {
      for (var i = 0; i < camadas.length; i++) {
        var r = _cmp(a, b, camadas[i].k, camadas[i].asc);
        if (r !== 0) return r;
      }
      return 0;
    });

    // Felipe s37: mostra a ORDEM das camadas no cabecalho (1, 2, 3) com a
    // seta de cada uma, senao nao da' pra saber o que esta ordenando o que.
    try {
      container.querySelectorAll('thead th[data-s]').forEach(function (th) {
        var kk = th.getAttribute('data-s');
        var pos = camadas.findIndex(function (c) { return c.k === kk; });
        var base = th.textContent.replace(/\s*[▲▼]\s*\d*$/, '').trim();
        th.title = 'Clique pra ordenar. SHIFT+clique adiciona uma camada '
                 + '(ex: Fechamento e depois Valor).';
        th.textContent = pos < 0 ? base
          : base + ' ' + (camadas[pos].asc ? '▲' : '▼')
                 + (camadas.length > 1 ? String(pos + 1) : '');
      });
    } catch (_) {}

    var soma = lista.reduce(function (s, d) { return s + (d.v || 0); }, 0);
    var comWa = lista.filter(temWaReal).length;
    var $ = function (id) { return container.querySelector('#' + id); };

    if ($('wkv-k-cnt')) $('wkv-k-cnt').textContent = lista.length;
    if ($('wkv-k-soma')) $('wkv-k-soma').textContent = fmtCurto(soma);
    if ($('wkv-k-med')) $('wkv-k-med').textContent = lista.length ? fmtCurto(soma / lista.length) : '\u2014';
    if ($('wkv-k-wa')) $('wkv-k-wa').innerHTML = comWa + ' <small>de ' + lista.length + '</small>';
    if ($('wkv-t-cnt')) $('wkv-t-cnt').textContent = lista.length;
    if ($('wkv-t-soma')) $('wkv-t-soma').textContent = fmtMoeda(soma);

    var msg = ui.msg;
    var envios = getEnvios();
    var rows = lista.map(function (d) {
      // Felipe s37: primeiro nome tambem padronizado, senao a mensagem
      // do WhatsApp sai 'Ola ADEMIR' gritando com o cliente.
      var primeiro = (tituloCase(d.nome) || '').split(' ')[0] || '';
      var projHTML = cellProjettaHTML(d);
      var txt = encodeURIComponent(msg.replace(/\{nome\}/g, primeiro));
      var wa = temWa(d)
        ? '<a class="wkv-ico wa" target="_blank" rel="noopener" data-r="' + esc(d.r) + '" href="https://wa.me/' + esc(d.wa) + '?text=' + txt + '" title="WhatsApp">\u2706</a>'
        : '<span class="wkv-ico wa dis">\u2706</span>';
      var ml = (d.email && d.email.indexOf('@') > 0)
        ? '<button class="wkv-ico mail wkv-mail" data-r="' + esc(d.r) + '" title="Escrever email pra ' + esc(d.email) + '">\u2709</button>'
        : '<span class="wkv-ico mail dis">\u2709</span>';
      var tag = ehPredio(d) ? '<span class="wkv-tag predio">' + esc(d.tipo || 'predio') + '</span>'
        : (/casa/.test((d.tipo || '').toLowerCase()) ? '<span class="wkv-tag casa">casa</span>'
          : '<span class="wkv-tag outro">' + esc(d.tipo || '\u2014') + '</span>');
      return '<tr>'
        + '<td><button class="wkv-open wkv-nome" data-r="' + esc(d.r) + '" title="Ver todos os dados da planilha">' + esc(tituloCase(d.nome) || '\u2014') + '</button><div class="wkv-loc">Reserva ' + esc(d.r) + '</div></td>'
        + '<td class="wkv-loc">' + esc(d.cidade || '\u2014') + (d.uf ? ' \u00b7 ' + esc(d.uf) : '') + '</td>'
        + '<td>' + tag + '</td>'
        + '<td style="text-align:center" class="wkv-num">' + (d.pav || '\u2014') + '</td>'
        + '<td style="text-align:center" class="wkv-num">' + esc(d.esq || '\u2014') + '</td>'
        + '<td class="wkv-vlr wkv-num">' + fmtMoeda(d.v) + '</td>'
        + '<td style="text-align:center" class="wkv-loc">' + esc(d.data || '\u2014') + '</td>'
        + '<td class="wkv-loc">' + esc(d.rep || '\u2014') + '</td>'
        + '<td class="wkv-projcell" data-r="' + esc(d.r) + '" style="text-align:center">' + projHTML + '</td>'
        + '<td class="wkv-stcell" data-r="' + esc(d.r) + '" style="text-align:center">' + cellStatusHTML(d.r, envios[d.r]) + '</td>'
        + '<td style="text-align:center;white-space:nowrap">' + wa + ' ' + ml
        + ' <button class="wkv-rmv" data-r="' + esc(d.r) + '" title="Remover (opt-out)">\u2715</button>'
        + (d.tel ? '<div class="wkv-fone">' + esc(d.tel) + '</div>' : '')
        + '</td>'
        // Felipe s44: a coluna de Observacoes saiu da tabela. A anotacao
        // agora vive DENTRO do card do cliente (bloco .wkv-dobs em
        // abrirDetalhe), igual a aba funil. Na tabela ela ocupava uma
        // coluna larga em todas as linhas so' pra ficar quase sempre
        // vazia. O DADO e' o mesmo (envios[r].obs) e continua no export.
        + '</tr>';
    }).join('');

    var tb = $('wkv-tb');
    if (tb) tb.innerHTML = rows || '<tr><td colspan="12" style="text-align:center;padding:40px;color:#6b7280">Nenhum cliente nesse filtro.</td></tr>';

    // indicadores de ordenacao
    container.querySelectorAll('thead th[data-s]').forEach(function (th) {
      th.classList.remove('wkv-so', 'wkv-sa');
      if (th.getAttribute('data-s') === ui.sortKey) th.classList.add(ui.sortAsc ? 'wkv-sa' : 'wkv-so');
    });
  }

  // ---- export CSV -------------------------------------------------
  function exportarCSV() {
    var lista = aplicarFiltro().sort(function (a, b) { return (b.v || 0) - (a.v || 0); });
    var envios = getEnvios();
    var cols = ['Reserva', 'Nome', 'Cidade', 'UF', 'Tipo', 'Pavimentos', 'Esquadrias', 'Valor Aprovado', 'Representante', 'Data Orcamento', 'WhatsApp', 'Email', 'Projetta AGP', 'Projetta Reserva', 'Projetta Etapa', 'Msg Enviada', 'Enviada Por', 'Cliente Retornou', 'Sem Retorno', 'Sem Interesse', 'Observacoes'];
    var linhas = lista.map(function (d) {
      var p = resolveProjetta(d);
      var pAgp = p ? p.agp : '';
      var pRes = p ? p.res : '';
      var pEt  = p ? stageCurto(p.etapa) : '';
      var st = _normSt(envios[d.r]) || { enviado: false, por: '', retornou: false };
      return [d.r, tituloCase(d.nome), d.cidade, d.uf, d.tipo, d.pav, d.esq, d.v, d.rep, d.data, d.wa, d.email, pAgp, pRes, pEt, (st.enviado ? "Sim" : "Nao"), st.por, (st.retornou ? "Sim" : "Nao"), (st.semRetorno ? "Sim" : "Nao"), (st.semInteresse ? "Sim" : "Nao"), (st.obs || "")]
        .map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
    });
    var csv = '\ufeff' + [cols.join(';')].concat(linhas).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'projetta_weiku_prospeccao.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---- bind eventos (uma vez por render) --------------------------
  function bindEventos(container) {
    var $ = function (id) { return container.querySelector('#' + id); };

    // Felipe s37: volta a ordenacao padrao (data + valor).
    (function () {
      var bo = container.querySelector('#wkv-t-ordpad');
      if (!bo) return;
      bo.addEventListener('click', function () {
        ui.sortLayers = [{ k: 'data', asc: false }, { k: 'v', asc: false }];
        ui.sortKey = 'data'; ui.sortAsc = false;
        renderTabela(container);
      });
    })();

    // Felipe s38: salvar a mensagem padrao de WhatsApp.
    (function () {
      var ta   = container.querySelector('#wkv-msg');
      var btn  = container.querySelector('#wkv-msg-salvar');
      var bfab = container.querySelector('#wkv-msg-fabrica');
      var lbl  = container.querySelector('#wkv-msg-status');
      if (!ta || !btn) return;

      function dizer(txt, cls) {
        if (!lbl) return;
        lbl.textContent = txt;
        lbl.className = 'wkv-msgstatus' + (cls ? ' ' + cls : '');
      }
      // marca "nao salva" enquanto edita, pra ninguem sair da tela achando
      // que gravou (era exatamente o que acontecia antes: editava e perdia)
      ta.addEventListener('input', function () {
        var salva = '';
        try { salva = Storage.scope(SCOPE).get('msg_padrao') || ''; } catch (_) {}
        dizer(ta.value === salva ? '' : 'alteracoes nao salvas', 'alterada');
      });

      btn.addEventListener('click', function () {
        try {
          salvarMsgPadrao(ta.value);
          ui.msg = ta.value;
          dizer('\u2713 mensagem salva', 'ok');
          setTimeout(function () { dizer('', ''); }, 2500);
        } catch (e) {
          dizer('erro ao salvar: ' + (e && e.message ? e.message : e), 'alterada');
        }
      });

      if (bfab) bfab.addEventListener('click', function () {
        ta.value = MSG_FABRICA;
        ui.msg = MSG_FABRICA;
        dizer('texto original restaurado \u2014 clique em Salvar pra valer', 'alterada');
        ta.focus();
      });
    })();

    // Felipe s44: o autosave da textarea da TABELA foi removido junto com
    // a coluna - sem elemento .wkv-obs na tela ele nunca dispararia. A
    // gravacao da observacao agora e' pelo botao "Salvar observacao" do
    // card (abrirDetalhe).

    // Felipe s38: filtro por status da prospeccao.
    (function () {
      var sel = container.querySelector('#wkv-t-status');
      if (!sel) return;
      sel.addEventListener('change', function () {
        ui.status = sel.value || '';
        renderTabela(container);
        // devolve o foco pro select, que e' recriado no render
        var novo = container.querySelector('#wkv-t-status');
        if (novo && novo !== sel) { novo.value = ui.status; novo.focus(); }
      });
    })();

    // Felipe s37: busca da tabela — digita e filtra, sem precisar subir
    // ate o Filtro Inteligente. Escreve no mesmo ui.busca.
    (function () {
      var tb = container.querySelector('#wkv-t-busca');
      if (!tb) return;
      var deb = null;
      tb.addEventListener('input', function () {
        clearTimeout(deb);
        deb = setTimeout(function () {
          ui.busca = tb.value;
          var topo = container.querySelector('#wkv-f-busca');
          if (topo) topo.value = ui.busca;
          renderTabela(container);
          var novo = container.querySelector('#wkv-t-busca');
          if (novo && novo !== tb) { novo.value = ui.busca; novo.focus(); }
        }, 250);
      });
    })();

    function pull() {
      ui.busca = $('wkv-f-busca').value;
      // Felipe s37: mantem o campo de busca da TABELA em sincronia com o
      // do Filtro Inteligente — sao o mesmo filtro, so' que em dois
      // lugares (um no topo, outro colado na tabela).
      if ($('wkv-t-busca')) $('wkv-t-busca').value = ui.busca;
      ui.vmin = $('wkv-f-vmin').value === '' ? null : parseFloat($('wkv-f-vmin').value);
      ui.vmax = $('wkv-f-vmax').value === '' ? null : parseFloat($('wkv-f-vmax').value);
      ui.pavMax = $('wkv-f-pav').value === '' ? null : parseInt($('wkv-f-pav').value, 10);
      ui.uf = $('wkv-f-uf').value;
      ui.cidade = $('wkv-f-cidade') ? $('wkv-f-cidade').value : '';
      ui.rep = $('wkv-f-rep').value;
      ui.ano = $('wkv-f-ano') ? $('wkv-f-ano').value : '';
      ui.mes = $('wkv-f-mes') ? $('wkv-f-mes').value : '';
      ui.excluiPredio = $('wkv-f-npredio').checked;
      ui.soComWa = $('wkv-f-comwa').checked;
      if ($('wkv-f-comprou')) { ui.comprou = $('wkv-f-comprou').value; ui.ocultaComprou = (ui.comprou === 'ocultar'); }
      if ($('wkv-f-proj')) ui.projetta = $('wkv-f-proj').value;
      ui.msg = $('wkv-msg').value;
      renderTabela(container);
    }

    ['wkv-f-busca', 'wkv-f-vmin', 'wkv-f-vmax', 'wkv-f-pav', 'wkv-msg'].forEach(function (id) {
      var e = $(id); if (e) e.addEventListener('input', pull);
    });
    ['wkv-f-uf', 'wkv-f-cidade', 'wkv-f-rep', 'wkv-f-ano', 'wkv-f-mes', 'wkv-f-npredio', 'wkv-f-comwa', 'wkv-f-proj', 'wkv-f-comprou'].forEach(function (id) {
      var e = $(id); if (e) e.addEventListener('change', pull);
    });

    var reset = $('wkv-reset');
    if (reset) reset.addEventListener('click', function () {
      ui.busca = ''; ui.vmin = null; ui.vmax = null; ui.pavMax = null; ui.uf = ''; ui.rep = '';
      ui.cidade = '';
      ui.ano = ''; ui.mes = '';
      ui.excluiPredio = false; ui.soComWa = false; ui.comprou = 'ocultar'; ui.ocultaComprou = true; ui.projetta = '';
      // Felipe s37: Limpar filtros tambem devolve a ordenacao padrao.
      ui.sortLayers = [{ k: 'data', asc: false }, { k: 'v', asc: false }];
      ui.sortKey = 'data'; ui.sortAsc = false;
      $('wkv-f-busca').value = ''; $('wkv-f-vmin').value = ''; $('wkv-f-vmax').value = '';
      $('wkv-f-pav').value = ''; $('wkv-f-uf').value = ''; $('wkv-f-rep').value = '';
      if ($('wkv-f-cidade')) $('wkv-f-cidade').value = '';
      if ($('wkv-f-ano')) $('wkv-f-ano').value = ''; if ($('wkv-f-mes')) $('wkv-f-mes').value = '';
      $('wkv-f-npredio').checked = false; $('wkv-f-comwa').checked = false;
      renderTabela(container);
    });

    var exp = $('wkv-export');
    if (exp) exp.addEventListener('click', exportarCSV);


    container.querySelectorAll('thead th[data-s]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-s');
        var textoAsc = (k === 'nome' || k === 'cidade' || k === 'uf' || k === 'rep');
        if (!Array.isArray(ui.sortLayers)) ui.sortLayers = [];
        // Felipe s37: CLIQUE NORMAL troca a ordenacao (comportamento antigo).
        // CLIQUE COM SHIFT ADICIONA uma camada — "primeiro por data, depois
        // por valor": clica em Fechamento, depois Shift+clique em Valor.
        if (event && event.shiftKey) {
          var ja = ui.sortLayers.findIndex(function (c) { return c.k === k; });
          if (ja >= 0) ui.sortLayers[ja].asc = !ui.sortLayers[ja].asc;
          else ui.sortLayers.push({ k: k, asc: textoAsc });
          // teto de 3 camadas: alem disso nao muda nada na pratica
          if (ui.sortLayers.length > 3) ui.sortLayers = ui.sortLayers.slice(-3);
        } else {
          if (ui.sortKey === k) ui.sortAsc = !ui.sortAsc;
          else { ui.sortKey = k; ui.sortAsc = textoAsc; }
          ui.sortLayers = [{ k: ui.sortKey, asc: ui.sortAsc }];
        }
        // mantem sortKey/sortAsc em sincronia com a 1a camada (setinha do th)
        if (ui.sortLayers.length) {
          ui.sortKey = ui.sortLayers[0].k;
          ui.sortAsc = ui.sortLayers[0].asc;
        }
        renderTabela(container);
      });
    });

    // delegacao pro botao de opt-out (tbody re-renderiza)
    var tb = $('wkv-tb');
    if (tb) tb.addEventListener('click', function (ev) {
      // abrir detalhes (clique no nome do cliente)
      var openBtn = ev.target.closest('.wkv-open');
      if (openBtn) { abrirDetalhe(openBtn.getAttribute('data-r')); return; }
      // vincular / editar AGP da Projetta (quando o auto-match nao reconheceu)
      var vincBtn = ev.target.closest('.wkv-vinc-add') || ev.target.closest('.wkv-vinc-edit');
      if (vincBtn) {
        var rv = vincBtn.getAttribute('data-r');
        var cur = (getVinculos()[rv] || {}).agp || '';
        if (vincularAGP(rv, cur)) {
          var pcell = vincBtn.closest('.wkv-projcell');
          if (pcell) pcell.innerHTML = cellProjettaHTML(_resById(rv) || { r: rv });
        }
        return;
      }
      // marcar/desmarcar "Enviado"
      // Felipe s44: clicar no WhatsApp ja' marca "Enviado" sozinho, igual
      // ja' funcionava na aba Pedidos (funil). Antes o usuario abria a
      // conversa e precisava lembrar de voltar e clicar em Enviado - na
      // pratica a marcacao ficava pra tras e o mesmo cliente era abordado
      // duas vezes.
      // So' LIGA, nunca desliga: se ja' estava enviado, reabrir a conversa
      // nao pode apagar a marcacao nem trocar quem enviou. O botao Enviado
      // continua sendo o jeito de desmarcar na mao.
      var waLink = ev.target.closest('a.wkv-ico.wa[data-r], a.wkv-wa-marca[data-r]');
      if (waLink) {
        var rw = waLink.getAttribute('data-r');
        var cw = _normSt(getEnvios()[rw]);
        if (!(cw && cw.enviado)) {
          var pw = { enviado: true, enviadoTs: Date.now() };
          if (!cw || !cw.por) { var uw = _currentUserName(); if (uw) pw.por = uw; }
          marcarStatus(rw, pw);
          // deixa o link abrir primeiro; so' entao redesenha a celula
          setTimeout(function () {
            var cel = document.querySelector('.wkv-stcell[data-r="' + rw + '"]');
            if (cel) cel.innerHTML = cellStatusHTML(rw, getEnvios()[rw]);
          }, 100);
        }
        return;
      }
      var envBtn = ev.target.closest('.wkv-st-env');
      if (envBtn) {
        var re = envBtn.getAttribute('data-r');
        var ce = _normSt(getEnvios()[re]);
        var on = !(ce && ce.enviado);
        var patch = { enviado: on, enviadoTs: on ? Date.now() : null };
        if (on && (!ce || !ce.por)) { var u = _currentUserName(); if (u) patch.por = u; }
        marcarStatus(re, patch);
        _refreshStatusCell(envBtn, re);
        return;
      }
      // marcar/desmarcar "Retornou"
      var retBtn = ev.target.closest('.wkv-st-ret');
      if (retBtn) {
        var rr = retBtn.getAttribute('data-r');
        var cr = _normSt(getEnvios()[rr]);
        var on2 = !(cr && cr.retornou);
        // ligar "Retornou" desliga "Sem retorno": os dois juntos seriam
        // um estado contraditorio.
        marcarStatus(rr, { retornou: on2, retornouTs: on2 ? Date.now() : null,
                           semRetorno: on2 ? false : (cr ? cr.semRetorno : false),
                           semRetornoTs: on2 ? null : (cr ? cr.semRetornoTs : null) });
        _refreshStatusCell(retBtn, rr);
        return;
      }
      // Felipe s38: "Sem interesse" — o cliente RESPONDEU e recusou.
      var sinBtn = ev.target.closest('.wkv-st-sin');
      if (sinBtn) {
        var ri = sinBtn.getAttribute('data-r');
        var ci = _normSt(getEnvios()[ri]);
        var on6 = !(ci && ci.semInteresse);
        // Exclusivo com "Sem retorno": pra dar negativa o cliente
        // precisou responder, entao os dois juntos se contradizem.
        // Com "Retornou" NAO e' exclusivo de proposito — retornou conta o
        // CONTATO (houve resposta) e sem interesse conta o DESFECHO
        // (a resposta foi nao). Os dois acesos e' o estado correto de quem
        // respondeu recusando.
        marcarStatus(ri, { semInteresse: on6, semInteresseTs: on6 ? Date.now() : null,
                           semRetorno: on6 ? false : (ci ? ci.semRetorno : false),
                           semRetornoTs: on6 ? null : (ci ? ci.semRetornoTs : null) });
        _refreshStatusCell(sinBtn, ri);
        return;
      }
      // Felipe s38: "Sem retorno" — enviou e o cliente nao respondeu.
      var srtBtn = ev.target.closest('.wkv-st-srt');
      if (srtBtn) {
        var rs = srtBtn.getAttribute('data-r');
        var cs = _normSt(getEnvios()[rs]);
        var on5 = !(cs && cs.semRetorno);
        // exclusivo com "Retornou", pelo mesmo motivo do bloco acima
        marcarStatus(rs, { semRetorno: on5, semRetornoTs: on5 ? Date.now() : null,
                           retornou: on5 ? false : (cs ? cs.retornou : false),
                           retornouTs: on5 ? null : (cs ? cs.retornouTs : null),
                           // quem nao respondeu nao pode ter dado negativa
                           semInteresse: on5 ? false : (cs ? cs.semInteresse : false),
                           semInteresseTs: on5 ? null : (cs ? cs.semInteresseTs : null) });
        _refreshStatusCell(srtBtn, rs);
        return;
      }
      // Felipe s44: os 4 botoes que vieram do funil (Demonstrou interesse,
      // Sem WhatsApp, Ja orcado Projetta, Ja comprou outra) + o "Ja comprou"
      // que virou "Ja comprou Projetta". Um mapa so', mesma mecanica de
      // liga/desliga com carimbo de hora — antes cada botao tinha o seu
      // bloco repetido.
      var _mapaSt = [
        ['.wkv-st-dem',  'demonstrouInteresse', 'demonstrouInteresseTs'],
        ['.wkv-st-swa',  'semWa',               'semWaTs'],
        ['.wkv-st-orc',  'jaOrcadoProjetta',    'jaOrcadoProjettaTs'],
        ['.wkv-st-cmpp', 'jaComprouProjetta',   'jaComprouProjettaTs'],
        ['.wkv-st-cmpo', 'jaComprouOutra',      'jaComprouOutraTs'],
      ];
      for (var _i = 0; _i < _mapaSt.length; _i++) {
        var _btn = ev.target.closest(_mapaSt[_i][0]);
        if (!_btn) continue;
        var _r = _btn.getAttribute('data-r');
        var _cur = _normSt(getEnvios()[_r]);
        var _campo = _mapaSt[_i][1];
        var _on = !(_cur && _cur[_campo]);
        var _patch = {};
        _patch[_campo] = _on;
        _patch[_mapaSt[_i][2]] = _on ? Date.now() : null;
        // "Ja comprou Projetta" mantem o campo antigo jaComprou em sincronia:
        // o filtro por status, o export CSV e os registros ja gravados
        // continuam usando ele. Sem isso, marcar aqui sumiria do filtro.
        if (_campo === 'jaComprouProjetta') {
          _patch.jaComprou = _on;
          _patch.jaComprouTs = _on ? Date.now() : null;
        }
        marcarStatus(_r, _patch);
        _refreshStatusCell(_btn, _r);
        return;
      }
      // Felipe s37: EMAIL pelo compositor interno. "tentei enviar email
      // mas nada aconteceu" — era um link mailto:, que depende de ter um
      // programa de email configurado no computador; sem isso o clique
      // nao faz nada. Agora abre o mesmo OutlookComposer usado pra
      // mandar a proposta, com a mensagem de prospeccao ja' preenchida.
      var mailBtn = ev.target.closest('.wkv-mail');
      if (mailBtn) {
        var rm = mailBtn.getAttribute('data-r');
        var dm = (getReservas() || []).find(function (x) { return String(x.r) === String(rm); });
        if (!dm || !dm.email) { alert('Esse contato nao tem email cadastrado.'); return; }
        if (!window.OutlookComposer || typeof window.OutlookComposer.open !== 'function') {
          alert('Compositor de email nao carregou. Recarregue a pagina.');
          return;
        }
        var primeiroM = (tituloCase(dm.nome) || '').split(' ')[0] || '';
        var corpoM = String(ui.msg || '').replace(/\{nome\}/g, primeiroM);
        window.OutlookComposer.open({
          to: dm.email,
          subject: 'Projetta Aluminio — portas de entrada de alto padrao',
          bodyHtml: '<p>' + corpoM.replace(/\n/g, '<br>') + '</p>',
          attachments: [],
          onSent: function () {
            // marca como enviado, igual ao fluxo do WhatsApp
            marcarStatus(rm, { enviado: true, enviadoTs: Date.now(),
                               por: _currentUserName() || '' });
            _refreshStatusCell(mailBtn, rm);
          }
        });
        return;
      }
      // Felipe s37: numero sem conta no WhatsApp.
      var swaBtn = ev.target.closest('.wkv-st-swa');
      if (swaBtn) {
        var rw = swaBtn.getAttribute('data-r');
        var cw = _normSt(getEnvios()[rw]);
        var on4 = !(cw && cw.semWa);
        marcarStatus(rw, { semWa: on4, semWaTs: on4 ? Date.now() : null });
        _refreshStatusCell(swaBtn, rw);
        return;
      }
      // remover (opt-out)
      var btn = ev.target.closest('.wkv-rmv');
      if (!btn) return;
      var r = btn.getAttribute('data-r');
      if (r && window.confirm('Remover este contato da prospeccao (opt-out)?')) {
        marcarOptout(r);
        renderTabela(container);
      }
    });
    // Felipe s42: handler do seletor 'quem?' removido junto com o campo.
    // Quem enviou passa a ser carimbado automaticamente pelo botao
    // Enviado, com o usuario logado.
  }

  // ---- render principal -------------------------------------------
  function _draw(container) {
    injectCSS();
    var dados = getReservas();
    if (!dados.length) { container.innerHTML = emptyHTML(); bindImport(container); return; }
    var ufs = Array.from(new Set(dados.map(function (d) { return d.uf; }).filter(Boolean))).sort();
    var reps = Array.from(new Set(dados.map(function (d) { return d.rep; }).filter(Boolean))).sort();
    var cidades = Array.from(new Set(dados.map(function (d) { return (d.cidade || '').trim(); }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    container.innerHTML = layoutHTML(ufs, reps, cidades);
    bindEventos(container);
    bindImport(container);
    renderTabela(container);
  }
  function render(container) {
    // Felipe s38: le a mensagem padrao salva ANTES de desenhar, senao a
    // tela abriria com o texto de fabrica e so' trocaria depois.
    carregarMsgSalva();
    _draw(container);
    pullCloud(container); // puxa a base completa da nuvem e redesenha quando chegar
  }

  window.WeikuVendas = { render: render };
  console.log('[weiku-vendas] Modulo carregado (prospeccao alto padrao)');
})();
