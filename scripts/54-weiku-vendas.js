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
    sortKey: 'v',
    sortAsc: false,
    msg: 'Ola {nome}, tudo bem? Falo em nome da Projetta Aluminio, empresa do grupo Weiku do Brasil. Como fazemos parte do mesmo grupo, o contrato das suas esquadrias Weiku consta em nosso sistema. Nosso objetivo e assegurar que os clientes do grupo conhecam tambem as portas de entrada de alto padrao fabricadas pela Projetta - sob medida, no mesmo nivel de qualidade das esquadrias. Antes de avancar, gostariamos de confirmar: o representante que conduziu seu atendimento chegou a apresentar as portas da Projetta ou elaborar algum orcamento?'
  };

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
  function _normSt(e) {
    if (!e || typeof e !== 'object') return null;
    return {
      enviado: (e.enviado === true) || (e.status === 'sent'),
      por: e.por || '',
      enviadoTs: e.enviadoTs || e.ts || null,
      retornou: e.retornou === true,
      retornouTs: e.retornouTs || null
    };
  }
  function marcarStatus(r, patch) {
    try {
      var m = getEnvios();
      var cur = _normSt(m[r]) || { enviado: false, por: '', enviadoTs: null, retornou: false, retornouTs: null };
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
    var s = _normSt(raw) || { enviado: false, por: '', retornou: false };
    var envCls = 'wkv-st wkv-st-env' + (s.enviado ? ' on' : '');
    var retCls = 'wkv-st wkv-st-ret' + (s.retornou ? ' on' : '');
    var sel = '<select class="wkv-st-por" data-r="' + esc(r) + '" title="Quem enviou a mensagem">'
      + '<option value=""' + (!s.por ? ' selected' : '') + '>quem?</option>'
      + '<option value="Felipe"' + (s.por === 'Felipe' ? ' selected' : '') + '>Felipe</option>'
      + '<option value="Thays"' + (s.por === 'Thays' ? ' selected' : '') + '>Thays</option>'
      + '</select>';
    return '<div class="wkv-stwrap">'
      + '<div class="wkv-strow">'
      + '<button class="' + envCls + '" data-r="' + esc(r) + '" title="Marcar que a mensagem ja foi enviada">' + (s.enviado ? '\u2713 Enviado' : 'Enviado') + '</button>'
      + sel
      + '</div>'
      + '<button class="' + retCls + '" data-r="' + esc(r) + '" title="Marcar que o cliente respondeu">' + (s.retornou ? '\u21a9 Retornou' : 'Retornou') + '</button>'
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
    var waBtn = temWa(d) ? ' <a class="wkv-mbtn" target="_blank" rel="noopener" href="https://wa.me/' + esc(d.wa) + '">Abrir WhatsApp</a>' : '';
    var fone = (d.tel ? esc(d.tel) : '\u2014') + (d.wa ? ' <span class="wkv-loc">(' + esc(d.wa) + ')</span>' : '') + waBtn;
    var stTxt = (st.enviado ? ('\u2713 Enviada' + (st.por ? (' por ' + esc(st.por)) : '')) : 'N\u00e3o enviada') + ' \u00b7 ' + (st.retornou ? 'cliente retornou' : 'sem retorno');
    var body = ''
      + row('Nome', esc(d.nome))
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
    var ov = document.createElement('div');
    ov.id = 'wkv-modal'; ov.className = 'wkv-ovl';
    ov.innerHTML = '<div class="wkv-modal"><div class="wkv-mhead"><b>' + esc(d.nome || ('Reserva ' + d.r)) + '</b><button class="wkv-mclose" title="Fechar">\u2715</button></div>'
      + '<div class="wkv-mbody">' + body + '</div>'
      + '<div class="wkv-mfoot">Dados conforme a planilha Weiku importada (CPF/RG e endere\u00e7o n\u00e3o s\u00e3o importados).</div></div>';
    document.body.appendChild(ov);
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
    return null;
  }
  function stageCurto(e){
    var m={'fazer-orcamento':'A orçar','orcamento-pronto':'Orç. pronto','orcamento-enviado':'Orç. enviado','negociacao':'Negociação','fechado':'Fechado','perdido':'Perdido'};
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
      if (ui.soComWa && !temWa(d)) return false;
      if (ui.ano || ui.mes) {
        var dm = dataAnoMes(d.data);
        if (ui.ano && dm.ano !== ui.ano) return false;
        if (ui.mes && dm.mes !== ui.mes) return false;
      }
      if (busca && ((d.nome || '') + ' ' + (d.cidade || '')).toLowerCase().indexOf(busca) < 0) return false;
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
      '.wkv-app{--wkv-tinta:#003144;--wkv-tinta2:#0a4256;--wkv-teal:#0f766e;--wkv-amb:#c47012;--wkv-amb-bg:#FFF4E6;--wkv-linha:#E4E8EE;--wkv-cinza:#6b7280;--wkv-cinza2:#4a5160;max-width:1320px;margin:0 auto;padding:4px 6px 50px;font-size:14px}',
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
      '.wkv-tmpl textarea{width:100%;min-height:70px;padding:11px 13px;border:1px solid var(--wkv-linha);border-radius:8px;font:inherit;resize:vertical;background:#fafbfc}',
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
      '.wkv-ico.wa{color:#25D366;border-color:#cdebd6}.wkv-ico.wa:hover{background:#25D366;color:#fff}',
      '.wkv-ico.mail{color:var(--wkv-amb);border-color:#f3dcc0}.wkv-ico.mail:hover{background:var(--wkv-amb);color:#fff}',
      '.wkv-ico.dis{opacity:.3;pointer-events:none}',
      '.wkv-rmv{background:none;border:none;color:var(--wkv-cinza);cursor:pointer;font-size:13px}.wkv-rmv:hover{color:#c0392b}',
      '.wkv-stwrap{display:flex;flex-direction:column;gap:4px;align-items:center}',
      '.wkv-strow{display:flex;gap:4px;align-items:center;justify-content:center}',
      '.wkv-st{font:inherit;font-size:11px;font-weight:600;padding:3px 9px;border:1px solid var(--wkv-linha);border-radius:999px;background:#fff;color:var(--wkv-cinza2);cursor:pointer;white-space:nowrap;line-height:1.4}',
      '.wkv-st:hover{border-color:var(--wkv-teal);color:var(--wkv-teal)}',
      '.wkv-st-env.on{background:#dcfce7;border-color:#16a34a;color:#15803d}.wkv-st-env.on:hover{color:#15803d}',
      '.wkv-st-ret.on{background:#dbeafe;border-color:#2563eb;color:#1d4ed8}.wkv-st-ret.on:hover{color:#1d4ed8}',
      '.wkv-st-por{font:inherit;font-size:11px;padding:2px 4px;border:1px solid var(--wkv-linha);border-radius:6px;background:#fff;color:var(--wkv-tinta);cursor:pointer}',
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
      + '      <div class="wkv-fld"><label>Buscar nome / cidade</label><input id="wkv-f-busca" placeholder="ex: Joinville..."></div>'
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
      + '      <div class="wkv-hint">Use <code>{nome}</code> para inserir o primeiro nome do cliente automaticamente no link.</div></div>'
      + '  </div>'
      + '  <div class="wkv-tablewrap">'
      + '    <div class="wkv-tbar"><div class="wkv-cnt"><b id="wkv-t-cnt">0</b> clientes \u00b7 <span class="wkv-num" id="wkv-t-soma">R$ 0,00</span></div></div>'
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
    var k = ui.sortKey;
    lista.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (typeof x === 'string') { x = x.toLowerCase(); y = (y || '').toLowerCase(); }
      else { x = x || 0; y = y || 0; }
      return (x < y ? -1 : x > y ? 1 : 0) * (ui.sortAsc ? 1 : -1);
    });

    var soma = lista.reduce(function (s, d) { return s + (d.v || 0); }, 0);
    var comWa = lista.filter(temWa).length;
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
      var primeiro = (d.nome || '').split(' ')[0] || '';
      var projHTML = cellProjettaHTML(d);
      var txt = encodeURIComponent(msg.replace(/\{nome\}/g, primeiro));
      var wa = temWa(d)
        ? '<a class="wkv-ico wa" target="_blank" rel="noopener" href="https://wa.me/' + esc(d.wa) + '?text=' + txt + '" title="WhatsApp">\u2706</a>'
        : '<span class="wkv-ico wa dis">\u2706</span>';
      var ml = (d.email && d.email.indexOf('@') > 0)
        ? '<a class="wkv-ico mail" href="mailto:' + esc(d.email) + '" title="' + esc(d.email) + '">\u2709</a>'
        : '<span class="wkv-ico mail dis">\u2709</span>';
      var tag = ehPredio(d) ? '<span class="wkv-tag predio">' + esc(d.tipo || 'predio') + '</span>'
        : (/casa/.test((d.tipo || '').toLowerCase()) ? '<span class="wkv-tag casa">casa</span>'
          : '<span class="wkv-tag outro">' + esc(d.tipo || '\u2014') + '</span>');
      return '<tr>'
        + '<td><button class="wkv-open wkv-nome" data-r="' + esc(d.r) + '" title="Ver todos os dados da planilha">' + esc(d.nome || '\u2014') + '</button><div class="wkv-loc">Reserva ' + esc(d.r) + '</div></td>'
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
        + '</tr>';
    }).join('');

    var tb = $('wkv-tb');
    if (tb) tb.innerHTML = rows || '<tr><td colspan="11" style="text-align:center;padding:40px;color:#6b7280">Nenhum cliente nesse filtro.</td></tr>';

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
    var cols = ['Reserva', 'Nome', 'Cidade', 'UF', 'Tipo', 'Pavimentos', 'Esquadrias', 'Valor Aprovado', 'Representante', 'Data Orcamento', 'WhatsApp', 'Email', 'Projetta AGP', 'Projetta Reserva', 'Projetta Etapa', 'Msg Enviada', 'Enviada Por', 'Cliente Retornou'];
    var linhas = lista.map(function (d) {
      var p = resolveProjetta(d);
      var pAgp = p ? p.agp : '';
      var pRes = p ? p.res : '';
      var pEt  = p ? stageCurto(p.etapa) : '';
      var st = _normSt(envios[d.r]) || { enviado: false, por: '', retornou: false };
      return [d.r, d.nome, d.cidade, d.uf, d.tipo, d.pav, d.esq, d.v, d.rep, d.data, d.wa, d.email, pAgp, pRes, pEt, (st.enviado ? 'Sim' : 'Nao'), st.por, (st.retornou ? 'Sim' : 'Nao')]
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

    function pull() {
      ui.busca = $('wkv-f-busca').value;
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
      ui.msg = $('wkv-msg').value;
      renderTabela(container);
    }

    ['wkv-f-busca', 'wkv-f-vmin', 'wkv-f-vmax', 'wkv-f-pav', 'wkv-msg'].forEach(function (id) {
      var e = $(id); if (e) e.addEventListener('input', pull);
    });
    ['wkv-f-uf', 'wkv-f-cidade', 'wkv-f-rep', 'wkv-f-ano', 'wkv-f-mes', 'wkv-f-npredio', 'wkv-f-comwa'].forEach(function (id) {
      var e = $(id); if (e) e.addEventListener('change', pull);
    });

    var reset = $('wkv-reset');
    if (reset) reset.addEventListener('click', function () {
      ui.busca = ''; ui.vmin = null; ui.vmax = null; ui.pavMax = null; ui.uf = ''; ui.rep = '';
      ui.cidade = '';
      ui.ano = ''; ui.mes = '';
      ui.excluiPredio = false; ui.soComWa = false;
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
        if (ui.sortKey === k) ui.sortAsc = !ui.sortAsc;
        else { ui.sortKey = k; ui.sortAsc = (k === 'nome' || k === 'cidade' || k === 'uf' || k === 'rep'); }
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
        marcarStatus(rr, { retornou: on2, retornouTs: on2 ? Date.now() : null });
        _refreshStatusCell(retBtn, rr);
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
    // quem enviou (Felipe/Thays) — escolher o nome ja conta como enviado
    if (tb) tb.addEventListener('change', function (ev) {
      var sel = ev.target.closest('.wkv-st-por');
      if (!sel) return;
      var r = sel.getAttribute('data-r');
      var val = sel.value;
      var cur = _normSt(getEnvios()[r]);
      var patch = { por: val };
      if (val && (!cur || !cur.enviado)) { patch.enviado = true; patch.enviadoTs = Date.now(); }
      marcarStatus(r, patch);
      _refreshStatusCell(sel, r);
    });
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
    _draw(container);
    pullCloud(container); // puxa a base completa da nuvem e redesenha quando chegar
  }

  window.WeikuVendas = { render: render };
  console.log('[weiku-vendas] Modulo carregado (prospeccao alto padrao)');
})();
