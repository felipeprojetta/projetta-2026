/* 60-weiku-pedidos.js — PEDIDOS Weiku (funil do Bitrix24)

   Felipe sessao 42: "a que ja esta pronto sao dos pedido fechados weiku...
   essa lista que fizemos acima sao dos pedidos".

   DUAS BASES DIFERENTES, e a distincao importa:
     - FECHADOS (54-weiku-vendas.js) = reservas Weiku JA FECHADAS, com
       contrato assinado. Base de 1.205, vinda da intranet. E' prospeccao
       de quem JA COMPROU esquadria e pode comprar porta.
     - PEDIDOS (este modulo) = funil comercial do Bitrix24
       (crm/deal/kanban/category/0), 4.263 negocios em TODAS as etapas,
       da primeira conversa ate' o fechamento. E' o pipeline, nao a venda.

   Dos 4.263 pedidos, so' 134 aparecem tambem nos fechados — ou seja, a
   quase totalidade e' oportunidade que o time da Projetta ainda nao viu.

   Origem: extraido via BX.rest (crm.deal.list) em 03/08/2026. Guardado
   em v7.kv_store scope='weiku_pedidos', chaves lista_0..lista_4 (fatiado
   em 900 por chave porque o payload inteiro passa de 2,5MB).

   Este modulo e' SO' LEITURA — nao grava nada, nao sincroniza, nao
   dispara WhatsApp. Serve pra consultar, filtrar e exportar.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SCOPE = 'weiku_pedidos';
  var _dados = null;
  var _carregando = false;

  var ui = {
    busca: '', uf: '', cidade: '', etapa: '', responsavel: '',
    vmin: '', vmax: '', comTel: false, comReserva: false,
    soPerdidos: false, projetta: '', comprou: '', status: '', comValor: false,
    verOptOut: false,
    // Felipe s42: "deixe o filtro primeiro sempre o mais novo e segundo
    // filtro pelo valor igual nos fechados weiku". Ordenacao em CAMADAS,
    // mesma logica do 54-weiku-vendas: a coluna clicada vira a camada
    // principal e as demais viram desempate. Sem isso, clicar em Valor
    // perdia a ordem de data e clicar em Data embaralhava os valores
    // dentro do mesmo dia.
    camadas: [{ k: 'dtCriacao', asc: false }, { k: 'valor', asc: false }],
    ordem: 'dtCriacao', dir: 'desc', pagina: 0,
    msg: '',
  };
  var POR_PAGINA = 100;

  /* Felipe s42: "eu queria somente os perdidos weiku, pois os novos ou os
     que ainda nao perdeu representantes deveriam estar atendendo".
     Etapas de PERDA do funil — cliente que a Weiku ja' nao vai converter,
     entao a Projetta pode abordar sem atropelar o representante. */
  var ETAPAS_PERDIDAS = ['Inativo pós Orçamento','Preço Alto 1º Linha','Preço Alto 2º Linha',
    'Prazo de Entrega','Prazo de Pagamento','Problema de Crédito','Obra adiada/cancelada',
    'Limitação Técnica (Acabamento, Cor)','Alteração de Projeto','Demora no Orçamento'];

  // ═══════════════════════════════════════════════════════════════════
  // MENSAGEM PADRAO — texto revisado pra LGPD (Felipe, sessao 42)
  // ───────────────────────────────────────────────────────────────────
  // Felipe levantou o risco: "estamos pegando os dados dos clientes da
  // Weiku e enviando mensagem... o cliente nao pode achar que a Weiku
  // esta enviando dados dele pra Projetta".
  //
  // Base legal: Projetta e Weiku sao o MESMO grupo economico, entao o
  // compartilhamento pra oferta de produto correlato a quem ja demonstrou
  // interesse se apoia em LEGITIMO INTERESSE (LGPD art. 7o, IX) — nao
  // exige consentimento previo, mas EXIGE transparencia e opt-out facil.
  //
  // O texto anterior dizia "o contrato das suas esquadrias Weiku consta
  // em nosso sistema", que soa como vazamento e era o maior risco.
  // A regra que este texto segue: pode revelar que EXISTE um cadastro,
  // nunca o CONTEUDO dele.
  //
  // NUNCA incluir na mensagem, mesmo tendo o dado na tela: valor do
  // orcamento, motivo da perda, nome do representante, metragem da obra
  // ou endereco.
  // ═══════════════════════════════════════════════════════════════════
  var MSG_FABRICA = 'Ol\u00e1 {nome}, tudo bem?\n\nAqui \u00e9 da Projetta, empresa do grupo Weiku do Brasil \u2014 o mesmo grupo com quem voc\u00ea conversou recentemente sobre esquadrias de alum\u00ednio.\n\nAl\u00e9m das esquadrias, o grupo tamb\u00e9m fabrica portas de entrada pivotantes sob medida, que \u00e9 a linha da Projetta. Como seu contato est\u00e1 cadastrado aqui no grupo, aproveitei para me apresentar.\n\nPosso te enviar nosso cat\u00e1logo?\n\nSe n\u00e3o tiver interesse, \u00e9 s\u00f3 me avisar que retiramos seu contato do nosso banco de dados.';

  var _cruz = null;   // mapa reserva/telefone -> orcamento Projetta
  function cruzamento() {
    if (_cruz) return _cruz;
    try { _cruz = window.Storage.scope(SCOPE).get('cruzamento_crm') || {}; }
    catch (e) { _cruz = {}; }
    return _cruz;
  }
  /* Devolve o orcamento da Projetta desse cliente, se existir.
     Cruza por RESERVA primeiro (chave forte) e depois pelos 9 ultimos
     digitos do telefone — o 9o digito e o DDI variam entre as bases. */
  function orcProjetta(d) {
    var c = cruzamento();
    if (d.reserva && c['R' + d.reserva]) return c['R' + d.reserva];
    var t = String(d.tel || '').replace(/\D/g, '');
    if (t.length >= 10 && c['T' + t.slice(-9)]) return c['T' + t.slice(-9)];
    return null;
  }
  function getOptOut() {
    try { return window.Storage.scope(SCOPE).get('optout') || {}; } catch (e) { return {}; }
  }
  function setOptOut(id, obj) {
    var m = getOptOut();
    if (obj) m[id] = obj; else delete m[id];
    window.Storage.scope(SCOPE).set('optout', m);
  }
  function getEnvios() {
    try { return window.Storage.scope(SCOPE).get('envios') || {}; } catch (e) { return {}; }
  }
  function marcarStatus(id, patch) {
    var m = getEnvios();
    var cur = m[id] || { enviado: false, por: '', retornou: false, semRetorno: false,
                         semInteresse: false, jaComprou: false, obs: '' };
    for (var k in patch) cur[k] = patch[k];
    m[id] = cur;
    window.Storage.scope(SCOPE).set('envios', m);
    return cur;
  }
  function _userName() {
    try { var u = window.Auth && Auth.currentUser && Auth.currentUser(); return u ? (u.nome || u.usuario || '') : ''; }
    catch (e) { return ''; }
  }
  function primeiroNome(d) {
    var n = String(d.nome || d.titulo || '').trim().split(/\s+/)[0] || '';
    return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
  }
  function telLimpo(d) {
    var t = String(d.tel || '').replace(/\D/g, '');
    if (!t) return '';
    if (t.length <= 11) t = '55' + t;
    return t;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function brl(n) {
    var v = Number(n) || 0;
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function $(id) { return document.getElementById(id); }

  /* Le as 5 fatias do Supabase (via Storage, que ja' cuida de sync/cache). */
  async function carregar() {
    if (_dados) return _dados;
    var out = [];
    for (var i = 0; i < 5; i++) {
      try {
        var parte = window.Storage.scope(SCOPE).get('lista_' + i);
        if (Array.isArray(parte)) out = out.concat(parte);
      } catch (e) { /* fatia ausente nao derruba o resto */ }
    }
    _dados = out;
    try {
      var salva = window.Storage.scope(SCOPE).get('msg_padrao');
      ui.msg = (typeof salva === 'string' && salva.trim()) ? salva : MSG_FABRICA;
    } catch (e) { ui.msg = MSG_FABRICA; }
    return out;
  }

  function filtrar(lista) {
    var b = (ui.busca || '').toLowerCase().trim();
    var vmin = parseFloat(String(ui.vmin).replace(',', '.')) || 0;
    var vmax = parseFloat(String(ui.vmax).replace(',', '.')) || 0;
    return lista.filter(function (d) {
      if (b) {
        var alvo = [d.titulo, d.nome, d.sobrenome, d.email, d.tel, d.cidade,
                    d.reserva, d.ag, d.endereco].join(' ').toLowerCase();
        if (alvo.indexOf(b) < 0) return false;
      }
      if (ui.uf && d.uf !== ui.uf) return false;
      if (ui.cidade && d.cidade !== ui.cidade) return false;
      if (ui.etapa && d.etapa !== ui.etapa) return false;
      if (ui.responsavel && d.responsavel !== ui.responsavel) return false;
      var v = Number(d.valor) || 0;
      if (vmin && v < vmin) return false;
      if (vmax && v > vmax) return false;
      // Felipe s42: "deixe um botao para eliminar os sem valores".
      // No funil, 2.457 dos 4.263 cards estao com valor zerado — sao
      // negocios que nunca chegaram a ser orcados. Pra priorizar
      // abordagem, o valor da esquadria e' o melhor indicador de porte
      // da obra que existe nessa base.
      // LGPD: quem pediu pra sair nao aparece mais, a nao ser que o
      // Felipe marque "ver removidos" pra auditar.
      var _opt = getOptOut()[d.id];
      if (ui.verOptOut) { if (!_opt) return false; }
      else if (_opt) return false;
      if (ui.comValor && !(Number(d.valor) > 0)) return false;
      if (ui.comTel && !d.tel) return false;
      if (ui.comReserva && !d.reserva) return false;
      if (ui.soPerdidos && ETAPAS_PERDIDAS.indexOf(d.etapa) < 0) return false;
      // Felipe s42: filtro de 3 estados — todos / so' quem JA tem orcamento
      // na Projetta / so' quem NAO tem. Antes era checkbox e so' dava pra
      // ver o "nao tem".
      // Felipe s42: mesmo filtro de 3 estados da aba Fechados.
      // Aqui o default e' '' (mostra todos), porque no funil o "ja
      // comprou" e' marcacao manual da prospeccao e comeca tudo vazio —
      // ocultar por padrao esconderia zero linhas e so' confundiria.
      if (ui.comprou) {
        var _jc = !!(getEnvios()[d.id] || {}).jaComprou;
        if (ui.comprou === 'ocultar' && _jc) return false;
        if (ui.comprou === 'so' && !_jc) return false;
      }
      if (ui.projetta === 'sem' && orcProjetta(d)) return false;
      if (ui.projetta === 'com' && !orcProjetta(d)) return false;
      if (ui.status) {
        var s = getEnvios()[d.id] || {};
        var ok;
        switch (ui.status) {
          case 'enviado':       ok = !!s.enviado; break;
          case 'nao_enviado':   ok = !s.enviado; break;
          case 'retornou':      ok = !!s.retornou; break;
          case 'sem_retorno':   ok = !!s.semRetorno; break;
          case 'sem_interesse': ok = !!s.semInteresse; break;
          case 'ja_comprou':    ok = !!s.jaComprou; break;
          case 'aguardando':    ok = !!s.enviado && !s.retornou && !s.semRetorno
                                     && !s.semInteresse && !s.jaComprou; break;
          default: ok = true;
        }
        if (!ok) return false;
      }
      return true;
    });
  }

  function _dataOrd(s) {
    var m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? m[3] + m[2] + m[1] : '';
  }
  function ordenar(lista) {
    var camadas = (ui.camadas && ui.camadas.length)
      ? ui.camadas : [{ k: ui.ordem, asc: ui.dir === 'asc' }];
    function cmp(a, b, k, asc) {
      var x = a[k], y = b[k];
      if (k === 'dtCriacao' || k === 'dtOrcamento' || k === 'dtFechamento') {
        x = _dataOrd(x); y = _dataOrd(y);
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
      }
      if (k === 'valor' || k === 'm2') {
        return ((Number(x) || 0) - (Number(y) || 0)) * (asc ? 1 : -1);
      }
      return String(x || '').localeCompare(String(y || ''), 'pt-BR') * (asc ? 1 : -1);
    }
    return lista.slice().sort(function (a, b) {
      for (var i = 0; i < camadas.length; i++) {
        var r = cmp(a, b, camadas[i].k, camadas[i].asc);
        if (r !== 0) return r;
      }
      return 0;
    });
  }

  function opcoesDe(lista, campo) {
    var set = {};
    lista.forEach(function (d) { if (d[campo]) set[d[campo]] = (set[d[campo]] || 0) + 1; });
    return Object.keys(set).sort(function (a, b) {
      return set[b] - set[a] || a.localeCompare(b, 'pt-BR');
    }).map(function (k) { return [k, set[k]]; });
  }

  function selHTML(id, label, opts, sel, largura) {
    var o = '<option value="">' + label + '</option>' + opts.map(function (p) {
      return '<option value="' + esc(p[0]) + '"' + (sel === p[0] ? ' selected' : '') + '>'
           + esc(p[0]) + ' (' + p[1] + ')</option>';
    }).join('');
    return '<select id="' + id + '" class="wkp-sel" style="min-width:' + (largura || 150) + 'px">' + o + '</select>';
  }

  function render(container) {
    if (!_dados && !_carregando) {
      _carregando = true;
      container.innerHTML = '<div class="info-banner">Carregando pedidos...</div>';
      carregar().then(function () { _carregando = false; render(container); });
      return;
    }
    if (!_dados) return;

    injetarCSS();
    var todos = _dados;
    var filtrados = ordenar(filtrar(todos));
    var totalValor = filtrados.reduce(function (a, d) { return a + (Number(d.valor) || 0); }, 0);
    var comTel = filtrados.filter(function (d) { return !!d.tel; }).length;
    var comRes = filtrados.filter(function (d) { return !!d.reserva; }).length;

    var maxPag = Math.max(0, Math.ceil(filtrados.length / POR_PAGINA) - 1);
    if (ui.pagina > maxPag) ui.pagina = maxPag;
    var pagina = filtrados.slice(ui.pagina * POR_PAGINA, (ui.pagina + 1) * POR_PAGINA);

    var html = ''
      + '<div class="wkp-app">'
      + '  <div class="wkp-kpis">'
      +      kpi('Pedidos no filtro', filtrados.length.toLocaleString('pt-BR'), todos.length + ' no total')
      +      kpi('Valor no filtro', 'R$ ' + brl(totalValor), '')
      +      kpi('Com telefone', comTel.toLocaleString('pt-BR'), 'de ' + filtrados.length)
      +      kpi('Ja orcados Projetta', filtrados.filter(function(d){ return !!orcProjetta(d); }).length.toLocaleString('pt-BR'), 'de ' + filtrados.length + ' no filtro')
      + '  </div>'

      + '  <div class="wkp-card">'
      + '    <div class="wkp-tit">\u25c6 FILTROS</div>'
      + '    <div class="wkp-filtros">'
      + '      <input id="wkp-busca" class="wkp-inp" placeholder="\ud83d\udd0d nome, email, telefone, cidade, reserva, AG..." value="' + esc(ui.busca) + '" style="min-width:280px">'
      +        selHTML('wkp-uf', '\u2014 estado \u2014', opcoesDe(todos, 'uf'), ui.uf, 120)
      +        selHTML('wkp-cidade', '\u2014 cidade \u2014', opcoesDe(todos, 'cidade'), ui.cidade, 170)
      +        selHTML('wkp-etapa', '\u2014 etapa \u2014', opcoesDe(todos, 'etapa'), ui.etapa, 180)
      +        selHTML('wkp-resp', '\u2014 responsavel \u2014', opcoesDe(todos, 'responsavel'), ui.responsavel, 180)
      + '      <input id="wkp-vmin" class="wkp-inp" placeholder="valor min" value="' + esc(ui.vmin) + '" style="width:110px">'
      + '      <input id="wkp-vmax" class="wkp-inp" placeholder="valor max" value="' + esc(ui.vmax) + '" style="width:110px">'
      + '      <label class="wkp-chk"><input type="checkbox" id="wkp-tel"' + (ui.comTel ? ' checked' : '') + '> So com telefone</label>'
      +        chkPreset('wkp-val', ui.comValor, '\ud83d\udcb0 So com valor', 'Esconde os cards com valor zerado')
      + '      <label class="wkp-chk" title="Clientes que pediram pra sair da prospeccao (LGPD)"><input type="checkbox" id="wkp-opt"' + (ui.verOptOut ? ' checked' : '') + '> Ver removidos (' + Object.keys(getOptOut()).length + ')</label>'
      + '      <label class="wkp-chk"><input type="checkbox" id="wkp-res"' + (ui.comReserva ? ' checked' : '') + '> So com reserva</label>'
      + '    </div>'
      + '    <div class="wkp-filtros" style="margin-top:10px">'
      +        selStatus()
      +        chkPreset('wkp-perd', ui.soPerdidos, '\ud83c\udfaf So PERDIDOS na Weiku', 'Filtra as 10 etapas de perda do funil de uma vez')
      + '      <select id="wkp-comprou" class="wkp-sel" style="min-width:200px">'
      +        [['','\u2014 ja comprou \u2014'],['ocultar','Ocultar quem ja comprou'],['so','\u2713 SO os que ja compraram']]
             .map(function(o){ return '<option value="'+o[0]+'"'+(ui.comprou===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
      + '      </select>'
      + '      <select id="wkp-proj" class="wkp-sel" style="min-width:210px">'
      +        [['','\u2014 orcamento Projetta \u2014'],['com','\u2713 JA tem orcamento Projetta'],['sem','Sem orcamento na Projetta']]
             .map(function(o){ return '<option value="'+o[0]+'"'+(ui.projetta===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
      + '      </select>'
      + '    </div>'
      + '    <div class="wkp-acoes">'
      + '      <button id="wkp-limpar" class="wkp-btn">\u21ba Limpar filtros</button>'
      + '      <button id="wkp-csv" class="wkp-btn wkp-btn-p">\u2193 Exportar lista filtrada (CSV)</button>'
      + '      <button id="wkp-ordpad" class="wkp-btn" title="Volta pra ordenacao padrao: mais novo primeiro e, dentro da mesma data, maior valor primeiro.">\u21ba Ordem padrao</button>'
      + '    </div>'
      + '  </div>'

      + '  <div class="wkp-card">'
      + '    <div class="wkp-tit">\u25c6 MENSAGEM DE WHATSAPP / EMAIL</div>'
      + '    <textarea id="wkp-msg" class="wkp-msgta">' + esc(ui.msg || MSG_FABRICA) + '</textarea>'
      + '    <div class="wkp-acoes" style="margin-top:8px;align-items:center">'
      + '      <button id="wkp-msgsalvar" class="wkp-btn wkp-btn-p">\ud83d\udcbe Salvar mensagem</button>'
      + '      <button id="wkp-msgfab" class="wkp-btn">\u21ba Texto original</button>'
      + '      <span id="wkp-msgst" class="wkp-msgst"></span>'
      + '    </div>'
      + '    <div class="wkp-hint">Use <code>{nome}</code> pro primeiro nome do cliente.</div>'
      + '  </div>'

      + '  <div class="wkp-card wkp-nopad">'
      + '    <div class="wkp-thead">'
      + '      <b>' + filtrados.length.toLocaleString('pt-BR') + '</b> pedidos \u00b7 <b>R$ ' + brl(totalValor) + '</b>'
      + '      <span class="wkp-pag">'
      + '        <button id="wkp-ant" class="wkp-btn wkp-btn-s"' + (ui.pagina <= 0 ? ' disabled' : '') + '>\u2190</button>'
      + '        pagina ' + (ui.pagina + 1) + ' de ' + (maxPag + 1)
      + '        <button id="wkp-prox" class="wkp-btn wkp-btn-s"' + (ui.pagina >= maxPag ? ' disabled' : '') + '>\u2192</button>'
      + '      </span>'
      + '    </div>'
      + '    <div class="wkp-scroll"><table class="wkp-tab"><thead><tr>'
      +        th('Cliente', 'titulo') + th('Local', 'cidade')
      +        th('Obra (m\u00b2)', 'm2') + th('Etapa', 'etapa') + th('Responsavel', 'responsavel')
      +        th('Valor Weiku', 'valor') + th('Criado', 'dtCriacao') + th('Reserva / AG', 'reserva')
      + '<th>Projetta</th><th>Prospeccao</th><th>Contato</th>'
      + '    </tr></thead><tbody>'
      +        (pagina.length ? pagina.map(linha).join('')
             : '<tr><td colspan="11" style="text-align:center;padding:40px;color:#6b7280">Nenhum pedido nesse filtro.</td></tr>')
      + '    </tbody></table></div>'
      + '  </div>'
      + '</div>';

    container.innerHTML = html;
    ligar(container);
  }

  function kpi(rot, val, sub) {
    return '<div class="wkp-kpi"><div class="wkp-kpi-r">' + esc(rot) + '</div>'
         + '<div class="wkp-kpi-v">' + esc(val) + '</div>'
         + (sub ? '<div class="wkp-kpi-s">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function th(rot, campo) {
    var seta = ui.ordem === campo ? (ui.dir === 'asc' ? ' \u25b2' : ' \u25bc') : '';
    return '<th data-s="' + campo + '">' + esc(rot) + seta + '</th>';
  }
  /* ═══ MODAL DE DETALHE — Felipe s42 ═══
     "nos fechados weiku ao clicar no nome abre um campo com todos os
     dados, faca o mesmo para os perdidos". Mesma estrutura e mesmo CSS
     do abrirDetalhe() do 54-weiku-vendas, com os campos deste funil.
     Aqui vale a pena: o card do Bitrix tem 33 campos e a tabela mostra
     11, entao o modal e' o unico lugar que expoe arquiteto, urgencia,
     temperatura, motivo de perda, tipo de obra e AT. */
  function _escClose(ev) { if (ev.key === 'Escape') fecharDetalhe(); }
  function fecharDetalhe() {
    var m = document.getElementById('wkp-modal');
    if (m && m.parentNode) m.parentNode.removeChild(m);
    document.removeEventListener('keydown', _escClose);
  }
  function abrirDetalhe(id) {
    var d = (_dados || []).find(function (x) { return String(x.id) === String(id); });
    if (!d) return;
    fecharDetalhe();
    var st = getEnvios()[d.id] || {};
    var o = orcProjetta(d);
    function row(lab, val) {
      if (val == null || val === '') return '';
      return '<div class="wkp-drow"><span class="wkp-dlab">' + esc(lab) + '</span>'
           + '<span class="wkp-dval">' + val + '</span></div>';
    }
    var tel = telLimpo(d);
    var fone = d.tel
      ? esc(d.tel) + (tel ? ' <a class="wkp-mbtn" target="_blank" rel="noopener" href="https://wa.me/' + tel + '">Abrir WhatsApp</a>' : '')
      : '';
    var stTxt = (st.enviado ? ('\u2713 Enviada' + (st.por ? ' por ' + esc(st.por) : '')) : 'Nao enviada')
      + (st.retornou ? ' \u00b7 cliente retornou' : '')
      + (st.semRetorno ? ' \u00b7 sem retorno' : '')
      + (st.semInteresse ? ' \u00b7 sem interesse' : '')
      + (st.jaComprou ? ' \u00b7 ja comprou' : '');
    var perdida = ETAPAS_PERDIDAS.indexOf(d.etapa) >= 0;
    var projetta = o
      ? '<b>' + esc(o.agp || 'orcado') + '</b> \u00b7 ' + esc(o.etapa || '')
        + (Number(o.valor) ? ' \u00b7 R$ ' + brl(o.valor) : '')
      : '<span class="wkp-semorc">sem orcamento na Projetta</span>';

    var body = ''
      + row('Nome', esc(d.titulo || d.nome))
      + row('Contato', esc([d.nome, d.sobrenome].filter(Boolean).join(' ')))
      + row('Etapa no funil', (perdida ? '<span class="wkp-perd">' + esc(d.etapa) + '</span>' : esc(d.etapa)))
      + row('Responsavel', esc(d.responsavel))
      + row('Endereco da Obra', esc(d.endereco))
      + row('Cidade', esc(d.cidade) + (d.uf ? ' \u00b7 ' + esc(d.uf) : ''))
      + row('Metragem da Obra', d.m2 ? esc(d.m2) + ' m\u00b2' : '')
      + row('Tipo de Construcao', esc(d.tipoConstrucao))
      + row('Tipo de Obra', esc(d.tipoObra))
      + row('Etapa da Obra', esc(d.etapaObra))
      + row('Casa em Condominio', esc(d.condominio))
      + row('Valor do Negocio (Weiku)', Number(d.valor) ? 'R$ ' + brl(d.valor) : '')
      + row('Produtos', esc(d.produtos))
      + row('Tipo de Cliente', esc(d.tipoCliente))
      + row('Temperatura', esc(d.temperatura))
      + row('Urgencia', esc(d.urgencia))
      + row('Possui Arquiteto', esc(d.possuiArq))
      + row('Nome do Arquiteto', esc(d.arquiteto))
      + row('Cliente Internacional', esc(d.internacional))
      + row('Motivo de Perda', esc(d.motivoPerda))
      + row('Orcamento via', esc(d.orcamentoVia))
      + row('Ha Orcamentista', esc(d.haOrcamentista))
      + row('WhatsApp / Telefone', fone)
      + row('E-mail', d.email ? '<a href="mailto:' + esc(d.email) + '">' + esc(d.email) + '</a>' : '')
      + row('Data de Criacao', esc(d.dtCriacao))
      + row('Data Prevista Orcamento', esc(d.dtOrcamento))
      + row('Data de Fechamento', esc(d.dtFechamento))
      + row('N\u00ba Reserva', esc(d.reserva))
      + row('Numero AG', esc(d.ag))
      + row('Numero AT', esc(d.at))
      + row('ID no Bitrix24', esc(d.id))
      + row('Projetta', projetta)
      + row('Prospeccao', esc(stTxt));

    var ov = document.createElement('div');
    ov.id = 'wkp-modal'; ov.className = 'wkp-ovl';
    ov.innerHTML = '<div class="wkp-modal">'
      + '<div class="wkp-mhead"><b>' + esc(d.titulo || d.nome || ('Pedido ' + d.id)) + '</b>'
      +   '<button class="wkp-mclose" title="Fechar">\u2715</button></div>'
      + '<div class="wkp-mbody">' + body + '</div>'
      + '<div class="wkp-mfoot">Dados do card no Bitrix24 (funil de negocios). Campos vazios no card nao aparecem aqui.</div>'
      + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov || ev.target.closest('.wkp-mclose')) fecharDetalhe();
    });
    document.addEventListener('keydown', _escClose);
  }

  /* Felipe s42: o texto do preset continuava sumindo no fundo azul mesmo
     depois do fix de especificidade. A causa: o <style> do modulo e'
     injetado UMA vez por carregamento de pagina (_cssOk), entao a aba que
     ja' estava aberta seguia com a folha antiga em memoria — nenhum
     reload normal troca isso. Em vez de depender de novo do CSS externo,
     o preset passou a levar estilo INLINE, que ganha de qualquer folha,
     antiga ou nova, sem precisar de hard refresh. */
  function chkPreset(id, ligado, rotulo, titulo) {
    var base = 'display:flex;align-items:center;gap:6px;font-size:12.5px;'
             + 'border-radius:20px;padding:5px 12px;cursor:pointer;'
             + 'border:1px solid ' + (ligado ? '#0f2c4c' : 'var(--l,#E4E8EE)') + ';'
             + 'background:' + (ligado ? '#0f2c4c' : '#fff') + ';'
             + 'color:' + (ligado ? '#fff' : '#4a5160') + ';'
             + 'font-weight:' + (ligado ? '700' : '400') + ';';
    return '<label style="' + base + '"' + (titulo ? ' title="' + esc(titulo) + '"' : '') + '>'
      + '<input type="checkbox" id="' + id + '"' + (ligado ? ' checked' : '')
      +   ' style="accent-color:' + (ligado ? '#fff' : '#0f2c4c') + '"> '
      + rotulo + '</label>';
  }

  function selStatus() {
    var opts = [['','Todos os status'],['aguardando','Aguardando resposta'],
      ['nao_enviado','Ainda nao enviado'],['enviado','Enviado'],['retornou','Retornou'],
      ['sem_retorno','Sem retorno'],['sem_interesse','Sem interesse'],['ja_comprou','Ja comprou']];
    return '<select id="wkp-status" class="wkp-sel" style="min-width:180px">'
      + opts.map(function(o){ return '<option value="'+o[0]+'"'+(ui.status===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')
      + '</select>';
  }

  /* Coluna PROJETTA: o cruzamento que o Felipe pediu — "faca o cruzamento
     pra ver se esses tem ou nao ja orcamento conosco". */
  function cellProjetta(d) {
    var o = orcProjetta(d);
    if (!o) return '<span class="wkp-semorc">sem orcamento</span>';
    var v = Number(o.valor) || 0;
    return '<div class="wkp-comorc"><b>' + esc(o.agp || 'orcado') + '</b>'
         + '<div class="wkp-sub">' + esc(o.etapa || '') + (v ? ' \u00b7 R$ ' + brl(v) : '') + '</div></div>';
  }

  function cellStatus(d) {
    var s = getEnvios()[d.id] || {};
    function b(cls, on, lbl, lblOn) {
      return '<button class="wkp-st ' + cls + (on ? ' on' : '') + '" data-id="' + esc(d.id) + '">'
           + (on ? lblOn : lbl) + '</button>';
    }
    // mesma estrutura dos fechados: linha do Enviado + quem enviou, e os
    // demais empilhados embaixo
    return '<div class="wkp-stwrap">'
      + '<div class="wkp-stlinha">'
      +   b('env', s.enviado, 'Enviado', '\u2713 Enviado')
      +   (s.enviado && s.por ? '<span class="wkp-por">' + esc(String(s.por).split(' ')[0]) + '</span>' : '')
      + '</div>'
      + b('ret', s.retornou, 'Retornou', '\u21a9 Retornou')
      + b('srt', s.semRetorno, 'Sem retorno', '\u2205 Sem retorno')
      + b('sin', s.semInteresse, 'Sem interesse', '\u2716 Sem interesse')
      + b('cmp', s.jaComprou, 'Ja comprou', '\u2713 Ja comprou')
      + '</div>';
  }

  function cellContato(d) {
    var tel = telLimpo(d);
    var txt = encodeURIComponent(String(ui.msg || MSG_FABRICA).replace(/\{nome\}/g, primeiroNome(d)));
    var wa = tel
      ? '<a class="wkp-ico wa" target="_blank" rel="noopener" data-id="' + esc(d.id) + '" href="https://wa.me/' + tel + '?text=' + txt + '" title="WhatsApp">\u2706</a>'
      : '<span class="wkp-ico wa dis" title="sem telefone">\u2706</span>';
    var ml = (d.email && d.email.indexOf('@') > 0)
      ? '<button class="wkp-ico mail wkp-mail" data-id="' + esc(d.id) + '" title="Escrever email pra ' + esc(d.email) + '">\u2709</button>'
      : '<span class="wkp-ico mail dis" title="sem email">\u2709</span>';
    // Felipe s42 / LGPD: a mensagem promete "e so me avisar que retiramos
    // seu contato do nosso banco de dados". Sem um jeito de cumprir isso,
    // a promessa e' vazia e vira o proprio risco. Botao de opt-out, com
    // registro de data e de quem removeu.
    var rmv = '<button class="wkp-rmv" data-id="' + esc(d.id) + '" title="Cliente pediu pra sair (LGPD) — remove da lista de prospeccao">\u2715</button>';
    return '<div style="white-space:nowrap">' + wa + ' ' + ml + ' ' + rmv + '</div>'
      + (d.tel ? '<div class="wkp-sub">' + esc(d.tel) + '</div>' : '')
      + (d.email ? '<div class="wkp-sub">' + esc(String(d.email).slice(0, 28)) + '</div>' : '');
  }

  function linha(d) {
    var local = [d.cidade, d.uf].filter(Boolean).join(' \u00b7 ');
    var perdida = ETAPAS_PERDIDAS.indexOf(d.etapa) >= 0;
    return '<tr>'
      + '<td><button class="wkp-nome" data-id="' + esc(d.id) + '" title="Ver todos os dados do card">'
      +   esc(d.titulo || d.nome || '(sem nome)') + '</button>'
      +   (d.endereco ? '<div class="wkp-sub">' + esc(String(d.endereco).slice(0, 60)) + '</div>' : '')
      + '</td>'
      + '<td>' + esc(local || '\u2014') + '</td>'
      + '<td style="text-align:center">' + (d.m2 ? esc(d.m2) : '\u2014') + '</td>'
      + '<td>' + (perdida ? '<span class="wkp-perd">' + esc(d.etapa) + '</span>' : esc(d.etapa || '\u2014')) + '</td>'
      + '<td>' + esc(d.responsavel || '\u2014') + '</td>'
      + '<td style="text-align:right"><b>' + (Number(d.valor) ? 'R$ ' + brl(d.valor) : '\u2014') + '</b></td>'
      + '<td style="text-align:center">' + esc(d.dtCriacao || '\u2014') + '</td>'
      + '<td>' + (d.reserva ? 'Res ' + esc(d.reserva) : '\u2014')
      +   (d.ag ? '<div class="wkp-sub">' + esc(d.ag) + '</div>' : '') + '</td>'
      + '<td>' + cellProjetta(d) + '</td>'
      + '<td class="wkp-stcell" data-id="' + esc(d.id) + '">' + cellStatus(d) + '</td>'
      + '<td style="text-align:center">' + cellContato(d) + '</td>'
      + '</tr>';
  }

  function ligar(container) {
    function reset() { ui.pagina = 0; render(container); }
    var deb;
    var bs = $('wkp-busca');
    if (bs) bs.addEventListener('input', function () {
      clearTimeout(deb);
      deb = setTimeout(function () {
        ui.busca = bs.value; ui.pagina = 0; render(container);
        var n = $('wkp-busca'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
      }, 350);
    });
    [['wkp-uf', 'uf'], ['wkp-cidade', 'cidade'], ['wkp-etapa', 'etapa'], ['wkp-resp', 'responsavel']]
      .forEach(function (p) {
        var el = $(p[0]);
        if (el) el.addEventListener('change', function () { ui[p[1]] = el.value; reset(); });
      });
    [['wkp-vmin', 'vmin'], ['wkp-vmax', 'vmax']].forEach(function (p) {
      var el = $(p[0]);
      if (el) el.addEventListener('change', function () { ui[p[1]] = el.value; reset(); });
    });
    [['wkp-tel', 'comTel'], ['wkp-res', 'comReserva']].forEach(function (p) {
      var el = $(p[0]);
      if (el) el.addEventListener('change', function () { ui[p[1]] = el.checked; reset(); });
    });
    var op = $('wkp-ordpad');
    if (op) op.addEventListener('click', function () {
      ui.camadas = [{ k: 'dtCriacao', asc: false }, { k: 'valor', asc: false }];
      ui.ordem = 'dtCriacao'; ui.dir = 'desc'; reset();
    });
    var lp = $('wkp-limpar');
    if (lp) lp.addEventListener('click', function () {
      ui.busca = ''; ui.uf = ''; ui.cidade = ''; ui.etapa = ''; ui.responsavel = '';
      ui.vmin = ''; ui.vmax = ''; ui.comTel = false; ui.comReserva = false;
      ui.soPerdidos = false; ui.projetta = ''; ui.comprou = ''; ui.status = ''; ui.comValor = false;
      ui.camadas = [{ k: 'dtCriacao', asc: false }, { k: 'valor', asc: false }];
      ui.ordem = 'dtCriacao'; ui.dir = 'desc'; reset();
    });
    var ant = $('wkp-ant'), prox = $('wkp-prox');
    if (ant) ant.addEventListener('click', function () { if (ui.pagina > 0) { ui.pagina--; render(container); } });
    if (prox) prox.addEventListener('click', function () { ui.pagina++; render(container); });
    container.querySelectorAll('th[data-s]').forEach(function (th) {
      th.addEventListener('click', function () {
        var c = th.getAttribute('data-s');
        var asc;
        if (ui.ordem === c) { asc = !(ui.dir === 'asc'); }
        else { asc = !(c === 'valor' || c === 'm2' || c.indexOf('dt') === 0); }
        ui.ordem = c; ui.dir = asc ? 'asc' : 'desc';
        // coluna clicada vira a camada principal; as anteriores viram desempate
        var resto = (ui.camadas || []).filter(function (l) { return l.k !== c; });
        ui.camadas = [{ k: c, asc: asc }].concat(resto).slice(0, 3);
        reset();
      });
    });
    var csv = $('wkp-csv');
    if (csv) csv.addEventListener('click', function () { exportarCSV(ordenar(filtrar(_dados))); });

    // presets do Felipe s42
    var po=$('wkp-opt');
    if(po) po.addEventListener('change', function(){ ui.verOptOut=po.checked; reset(); });
    var pv=$('wkp-val');
    if(pv) pv.addEventListener('change', function(){ ui.comValor=pv.checked; reset(); });
    var pe=$('wkp-perd');
    if(pe) pe.addEventListener('change', function(){ ui.soPerdidos=pe.checked; reset(); });
    var pj=$('wkp-proj');
    if(pj) pj.addEventListener('change', function(){ ui.projetta=pj.value; reset(); });
    var pc=$('wkp-comprou');
    if(pc) pc.addEventListener('change', function(){ ui.comprou=pc.value; reset(); });
    var st=$('wkp-status');
    if(st) st.addEventListener('change', function(){ ui.status=st.value; reset(); });

    // mensagem padrao (mesma logica dos fechados: salva de verdade)
    (function(){
      var ta=$('wkp-msg'), bs=$('wkp-msgsalvar'), bf=$('wkp-msgfab'), lb=$('wkp-msgst');
      if(!ta||!bs) return;
      function diz(t,c){ if(lb){ lb.textContent=t; lb.className='wkp-msgst'+(c?' '+c:''); } }
      ta.addEventListener('input', function(){ ui.msg=ta.value; diz('alteracoes nao salvas','alt'); });
      bs.addEventListener('click', function(){
        try { window.Storage.scope(SCOPE).set('msg_padrao', ta.value); ui.msg=ta.value;
              diz('\u2713 mensagem salva','ok'); setTimeout(function(){diz('','');},2500); }
        catch(e){ diz('erro ao salvar','alt'); }
      });
      if(bf) bf.addEventListener('click', function(){
        ta.value=MSG_FABRICA; ui.msg=MSG_FABRICA;
        diz('texto original restaurado \u2014 clique em Salvar','alt'); ta.focus();
      });
    })();

    // botoes de prospeccao + WhatsApp + email (delegado: linhas sao recriadas)
    container.addEventListener('click', function(ev){
      var alvo;
      // clique no nome abre o detalhe
      var nm = ev.target.closest && ev.target.closest('.wkp-nome');
      if (nm) { abrirDetalhe(nm.getAttribute('data-id')); return; }
      function refresh(id){
        var td = container.querySelector('.wkp-stcell[data-id="'+id+'"]');
        var d = _dados.find(function(x){ return String(x.id)===String(id); });
        if (td && d) td.innerHTML = cellStatus(d);
      }
      // WhatsApp: abre o link e ja' marca como enviado
      alvo = ev.target.closest && ev.target.closest('a.wkp-ico.wa');
      if (alvo && alvo.dataset.id) {
        marcarStatus(alvo.dataset.id, { enviado:true, enviadoTs:Date.now(), por:_userName() });
        setTimeout(function(){ refresh(alvo.dataset.id); }, 100);
        return;
      }
      // Email pelo compositor interno (mailto: nao funciona sem cliente configurado)
      alvo = ev.target.closest && ev.target.closest('.wkp-mail');
      if (alvo) {
        var id = alvo.getAttribute('data-id');
        var d = _dados.find(function(x){ return String(x.id)===String(id); });
        if (!d || !d.email) { alert('Esse contato nao tem email.'); return; }
        if (!window.OutlookComposer || typeof window.OutlookComposer.open!=='function') {
          alert('Compositor de email nao carregou. Recarregue a pagina.'); return;
        }
        var corpo = String(ui.msg||MSG_FABRICA).replace(/\{nome\}/g, primeiroNome(d));
        window.OutlookComposer.open({
          to: d.email,
          subject: 'Projetta Aluminio \u2014 portas de entrada de alto padrao',
          bodyHtml: '<p>'+corpo.replace(/\n/g,'<br>')+'</p>',
          attachments: [],
          onSent: function(){ marcarStatus(id,{enviado:true,enviadoTs:Date.now(),por:_userName()}); refresh(id); }
        });
        return;
      }
      // opt-out LGPD
      alvo = ev.target.closest && ev.target.closest('.wkp-rmv');
      if (alvo) {
        var rid = alvo.getAttribute('data-id');
        var rd = _dados.find(function(x){ return String(x.id)===String(rid); });
        var nome = rd ? (rd.titulo || rd.nome || rid) : rid;
        if (!confirm('Remover ' + nome + ' da lista de prospeccao?\n\n'
          + 'Use quando o cliente pedir pra nao receber mais contato (LGPD).\n'
          + 'Fica registrado quem removeu e quando, e da pra rever depois '
          + 'marcando "ver removidos".')) return;
        setOptOut(rid, { em: new Date().toISOString(), por: _userName() || '' });
        render(container);
        return;
      }
      // botoes de status
      var mapa = [['.wkp-st.env','enviado'],['.wkp-st.ret','retornou'],['.wkp-st.srt','semRetorno'],
                  ['.wkp-st.sin','semInteresse'],['.wkp-st.cmp','jaComprou']];
      for (var i=0;i<mapa.length;i++){
        var b = ev.target.closest && ev.target.closest(mapa[i][0]);
        if (!b) continue;
        var bid = b.getAttribute('data-id');
        var campo = mapa[i][1];
        var atual = getEnvios()[bid] || {};
        var on = !atual[campo];
        var patch = {}; patch[campo] = on;
        patch[campo+'Ts'] = on ? Date.now() : null;
        if (campo==='enviado' && on) patch.por = _userName();
        // exclusividades: retornou x sem retorno; sem retorno x sem interesse
        if (campo==='retornou' && on) { patch.semRetorno=false; }
        if (campo==='semRetorno' && on) { patch.retornou=false; patch.semInteresse=false; }
        if (campo==='semInteresse' && on) { patch.semRetorno=false; }
        marcarStatus(bid, patch);
        refresh(bid);
        return;
      }
    });
  }

  function exportarCSV(lista) {
    var cols = [['titulo', 'Cliente'], ['nome', 'Nome'], ['sobrenome', 'Sobrenome'],
      ['email', 'Email'], ['tel', 'Telefone'], ['endereco', 'Endereco da Obra'],
      ['cidade', 'Cidade'], ['uf', 'UF'], ['m2', 'Metragem Obra (m2)'],
      ['responsavel', 'Responsavel'], ['etapa', 'Etapa'], ['valor', 'Valor'],
      ['dtCriacao', 'Data Criacao'], ['dtOrcamento', 'Data Prevista Orcamento'],
      ['dtFechamento', 'Data Fechamento'], ['reserva', 'Reserva'], ['ag', 'Numero AG'],
      ['at', 'Numero AT'], ['tipoConstrucao', 'Tipo de Construcao'], ['tipoObra', 'Tipo de Obra'],
      ['etapaObra', 'Etapa da Obra'], ['tipoCliente', 'Tipo de Cliente'], ['produtos', 'Produtos'],
      ['temperatura', 'Temperatura'], ['urgencia', 'Urgencia'], ['arquiteto', 'Arquiteto'],
      ['motivoPerda', 'Motivo de Perda']];
    var q = function (s) { return '"' + String(s == null ? '' : s).replace(/"/g, '""').replace(/[\r\n]+/g, ' ') + '"'; };
    var linhas = lista.map(function (d) {
      var base = cols.map(function (c) {
        var v = d[c[0]];
        if (c[0] === 'valor') return String((Number(v) || 0).toFixed(2)).replace('.', ',');
        return q(v);
      });
      // Felipe s42: cruzamento e prospeccao tambem vao pro CSV
      var o = orcProjetta(d), s = getEnvios()[d.id] || {};
      base.push(q(o ? (o.agp || 'orcado') : 'SEM ORCAMENTO'));
      base.push(q(o ? (o.etapa || '') : ''));
      base.push(o ? String((Number(o.valor)||0).toFixed(2)).replace('.', ',') : '');
      base.push(q(s.enviado ? 'Sim' : 'Nao'));
      base.push(q(s.por || ''));
      base.push(q(s.retornou ? 'Sim' : 'Nao'));
      base.push(q(s.semRetorno ? 'Sim' : 'Nao'));
      base.push(q(s.semInteresse ? 'Sim' : 'Nao'));
      base.push(q(s.jaComprou ? 'Sim' : 'Nao'));
      return base.join(';');
    });
    var head = cols.map(function (c) { return q(c[1]); })
      .concat(['Projetta AGP','Projetta Etapa','Projetta Valor','Msg Enviada','Enviada Por',
               'Retornou','Sem Retorno','Sem Interesse','Ja Comprou'].map(q));
    var csv = '\uFEFF' + head.join(';') + '\n' + linhas.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'weiku_pedidos_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  }

  var _cssOk = false;
  function injetarCSS() {
    if (_cssOk) return; _cssOk = true;
    var s = document.createElement('style');
    s.textContent = [
      '.wkp-app{--l:#E4E8EE;--t:#003144;max-width:min(2100px,98vw);margin:0 auto;padding:4px 6px 50px;font-size:14px}',
      '.wkp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}',
      '.wkp-kpi{background:#fff;border:1px solid var(--l);border-left:4px solid var(--t);border-radius:10px;padding:12px 14px}',
      '.wkp-kpi-r{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280}',
      '.wkp-kpi-v{font-size:24px;font-weight:700;color:var(--t);margin-top:3px}',
      '.wkp-kpi-s{font-size:11.5px;color:#6b7280;margin-top:2px}',
      '.wkp-card{background:#fff;border:1px solid var(--l);border-radius:12px;padding:14px 16px;margin-bottom:14px}',
      '.wkp-nopad{padding:0;overflow:hidden}',
      '.wkp-tit{font-size:12px;font-weight:700;letter-spacing:.08em;color:#c47012;margin-bottom:10px}',
      '.wkp-filtros{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.wkp-inp,.wkp-sel{padding:7px 9px;border:1px solid var(--l);border-radius:6px;font-size:12.5px;font-family:inherit;background:#fff}',
      '.wkp-inp:focus,.wkp-sel:focus{outline:none;border-color:var(--t)}',
      '.wkp-chk{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#4a5160;cursor:pointer}',
      '.wkp-acoes{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}',
      '.wkp-btn{padding:8px 14px;border:1px solid var(--l);background:#fff;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit}',
      '.wkp-btn:hover{background:#f8fafc}.wkp-btn[disabled]{opacity:.4;cursor:default}',
      '.wkp-btn-p{background:var(--t);color:#fff;border-color:var(--t);font-weight:600}',
      '.wkp-btn-s{padding:4px 10px;font-size:12px}',
      '.wkp-thead{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--l);font-size:13.5px;flex-wrap:wrap;gap:8px}',
      '.wkp-pag{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#6b7280}',
      '.wkp-scroll{overflow:auto;max-height:640px}',
      '.wkp-tab{width:100%;border-collapse:collapse;font-size:12.5px}',
      '.wkp-tab thead th{position:sticky;top:0;background:var(--t);color:#fff;padding:10px 12px;text-align:left;font-weight:600;white-space:nowrap;cursor:pointer;font-size:11.5px;letter-spacing:.04em}',
      '.wkp-tab thead th:hover{background:#0a4256}',
      '.wkp-tab td{padding:10px 12px;border-bottom:1px solid #eef1f5;vertical-align:top}',
      '.wkp-tab tbody tr:hover{background:#FFFBF5}',
      '.wkp-sub{font-size:11px;color:#6b7280;margin-top:2px}',
      '.wkp-vazio{color:#b45309;font-size:11.5px}',
      // Felipe s42: "ao clicar esse botao estao sumindo pq fundo e azul".
      // O .wkp-chk ja' definia color:#4a5160 e vencia por especificidade
      // igual + ordem, entao o texto ficava cinza-escuro sobre azul-escuro.
      // Aqui o seletor duplo .wkp-chk.wkp-preset.on garante a vitoria, e o
      // input tambem ganha filtro pra o quadradinho nao sumir.
      '.wkp-preset{border:1px solid var(--l);border-radius:20px;padding:5px 12px;background:#fff}',
      '.wkp-chk.wkp-preset.on{background:#0f2c4c;border-color:#0f2c4c;color:#fff;font-weight:700}',
      '.wkp-chk.wkp-preset.on input{accent-color:#fff}',
      '.wkp-msgta{width:100%;min-height:120px;padding:11px 13px;border:1px solid var(--l);border-radius:8px;font:inherit;line-height:1.5;resize:vertical;background:#fafbfc;box-sizing:border-box}',
      '.wkp-msgst{font-size:12.5px;font-weight:600}.wkp-msgst.ok{color:#15803d}.wkp-msgst.alt{color:#b45309}',
      '.wkp-hint{font-size:12px;color:#6b7280;margin-top:6px}',
      '.wkp-perd{background:#FEE2E2;color:#b91c1c;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap}',
      '.wkp-semorc{color:#15803d;font-size:11.5px;font-weight:600}',
      '.wkp-comorc{font-size:11.5px;color:#b45309}',
      // Felipe s42: "deixe igual nos fechados weiku mesmo tamanho mesmo
      // padrao" — CSS copiado LITERALMENTE do 54-weiku-vendas (.wkv-st),
      // so' trocando o prefixo. Mesmo raio 999px, mesmo padding 3px 9px,
      // mesma fonte 11px/600, mesmas cores de cada estado.
      '.wkp-stwrap{display:flex;flex-direction:column;gap:4px;align-items:center}',
      '.wkp-stlinha{display:flex;gap:4px;align-items:center;justify-content:center}',
      '.wkp-st{font:inherit;font-size:11px;font-weight:600;padding:3px 9px;border:1px solid var(--l);border-radius:999px;background:#fff;color:#4a5160;cursor:pointer;white-space:nowrap;line-height:1.4}',
      '.wkp-st:hover{border-color:#0f766e;color:#0f766e}',
      '.wkp-st.env.on{background:#dcfce7;border-color:#16a34a;color:#15803d}.wkp-st.env.on:hover{color:#15803d}',
      '.wkp-st.ret.on{background:#dbeafe;border-color:#2563eb;color:#1d4ed8}.wkp-st.ret.on:hover{color:#1d4ed8}',
      '.wkp-st.srt.on{background:#475569;border-color:#334155;color:#fff;font-weight:700}.wkp-st.srt.on:hover{color:#fff;background:#334155}',
      '.wkp-st.sin.on{background:#b45309;border-color:#92400e;color:#fff;font-weight:700}.wkp-st.sin.on:hover{color:#fff;background:#92400e}',
      '.wkp-st.cmp.on{background:#0f3f5f;border-color:#0f3f5f;color:#fff;font-weight:600}.wkp-st.cmp.on:hover{color:#fff}',
      '.wkp-por{font:inherit;font-size:11px;color:#4a5160;padding:2px 6px;border:1px solid var(--l);border-radius:6px;background:#fff}',
      '.wkp-ico{width:30px;height:30px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:14px;border:1px solid var(--l);background:#fff;cursor:pointer}',
      '.wkp-ico.wa{color:#25D366;border-color:#cdebd6}.wkp-ico.wa:hover{background:#25D366;color:#fff}',
      '.wkp-ico.mail{color:#c47012;border-color:#f3dcc0;font:inherit}.wkp-ico.mail:hover{background:#c47012;color:#fff}',
      '.wkp-ico.dis{opacity:.3;pointer-events:none}',
      '.wkp-rmv{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:0 3px}.wkp-rmv:hover{color:#c0392b}',
      '.wkp-nome{font:inherit;font-weight:700;color:#003144;background:none;border:none;padding:0;cursor:pointer;text-align:left}',
      '.wkp-nome:hover{color:#c47012;text-decoration:underline}',
      '.wkp-ovl{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px}',
      '.wkp-modal{background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden}',
      '.wkp-mhead{display:flex;justify-content:space-between;align-items:center;padding:15px 20px;border-bottom:1px solid var(--l);background:#003144;color:#fff}',
      '.wkp-mclose{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:0 4px}',
      '.wkp-mbody{padding:6px 20px;overflow:auto}',
      '.wkp-drow{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid #f1f5f9}',
      '.wkp-dlab{flex:0 0 165px;color:#4a5160;font-size:13px}',
      '.wkp-dval{flex:1;color:#003144;font-size:13px;font-weight:600;word-break:break-word}',
      '.wkp-mfoot{padding:11px 20px;border-top:1px solid var(--l);font-size:11px;color:#4a5160;background:#f8fafc}',
      '.wkp-mbtn{display:inline-block;background:#25D366;color:#fff;border-radius:6px;padding:2px 9px;font-size:11px;font-weight:600;text-decoration:none;margin-left:6px}.wkp-mbtn:hover{background:#1faf53}',
      '@media(max-width:900px){.wkp-kpis{grid-template-columns:repeat(2,1fr)}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  window.WeikuPedidos = { render: render };
  console.log('[weiku-pedidos] Modulo carregado (funil Bitrix24)');
})();
