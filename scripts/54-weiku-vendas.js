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
    msg: 'Ola {nome}, tudo bem? Aqui e da Projetta. Vi que voce esta com um projeto de esquadrias em andamento e nos trabalhamos com portas e solucoes em aluminio de alto padrao que combinam com o seu projeto. Posso te enviar algumas referencias?'
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
        if (!window.confirm('Importar ' + regs.length + ' reservas Weiku?\n\nCPF/RG NAO serao salvos. Isso substitui a base atual da aba WEIKU (o opt-out e mantido).')) return;
        Storage.scope(SCOPE).set('reservas', regs);
        _cloudReservas = regs; // mostra a base completa na hora (sem truncar no localStorage)
        window.alert(regs.length + ' reservas importadas com sucesso.\nSincronizando com o Supabase em segundo plano.');
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
      +          '<option value="2025"' + (ui.ano === '2025' ? ' selected' : '') + '>2025</option>'
      +          '<option value="2026"' + (ui.ano === '2026' ? ' selected' : '') + '>2026</option></select></div>'
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
    var rows = lista.map(function (d) {
      var primeiro = (d.nome || '').split(' ')[0] || '';
      var mp = matchProjetta(d);
      var projTd;
      if (mp) {
        // Felipe sessao 37: quando casa com orcamento Projetta, mostra o
        // AGP + reserva da Projetta DIRETO na coluna (antes so' no tooltip).
        var mpRes = String(mp.numeroReserva || '').replace(/\D/g, '');
        var meta = [];
        if (mp.numeroAGP) meta.push(esc(mp.numeroAGP));
        if (mpRes) meta.push('Res ' + esc(mpRes));
        var metaHtml = meta.length
          ? '<div class="wkv-loc" style="margin-top:3px;font-size:11px;color:#475569">' + meta.join(' \u00b7 ') + '</div>'
          : '';
        projTd = '<span class="wkv-tag casa" title="Projetta: ' + esc(mp.cliente || mp.nome || '') + (mp.numeroAGP ? ' (AGP ' + esc(mp.numeroAGP) + ')' : '') + ' \u2014 etapa: ' + esc(mp.etapa || '') + '">\u2713 ' + esc(stageCurto(mp.etapa)) + '</span>' + metaHtml;
      } else {
        projTd = '<span class="wkv-loc" style="color:#9ca3af">\u2014</span>';
      }
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
        + '<td><div class="wkv-nome">' + esc(d.nome || '\u2014') + '</div><div class="wkv-loc">Reserva ' + esc(d.r) + '</div></td>'
        + '<td class="wkv-loc">' + esc(d.cidade || '\u2014') + (d.uf ? ' \u00b7 ' + esc(d.uf) : '') + '</td>'
        + '<td>' + tag + '</td>'
        + '<td style="text-align:center" class="wkv-num">' + (d.pav || '\u2014') + '</td>'
        + '<td style="text-align:center" class="wkv-num">' + esc(d.esq || '\u2014') + '</td>'
        + '<td class="wkv-vlr wkv-num">' + fmtMoeda(d.v) + '</td>'
        + '<td style="text-align:center" class="wkv-loc">' + esc(d.data || '\u2014') + '</td>'
        + '<td class="wkv-loc">' + esc(d.rep || '\u2014') + '</td>'
        + '<td style="text-align:center">' + projTd + '</td>'
        + '<td style="text-align:center;white-space:nowrap">' + wa + ' ' + ml
        + ' <button class="wkv-rmv" data-r="' + esc(d.r) + '" title="Remover (opt-out)">\u2715</button></td>'
        + '</tr>';
    }).join('');

    var tb = $('wkv-tb');
    if (tb) tb.innerHTML = rows || '<tr><td colspan="10" style="text-align:center;padding:40px;color:#6b7280">Nenhum cliente nesse filtro.</td></tr>';

    // indicadores de ordenacao
    container.querySelectorAll('thead th[data-s]').forEach(function (th) {
      th.classList.remove('wkv-so', 'wkv-sa');
      if (th.getAttribute('data-s') === ui.sortKey) th.classList.add(ui.sortAsc ? 'wkv-sa' : 'wkv-so');
    });
  }

  // ---- export CSV -------------------------------------------------
  function exportarCSV() {
    var lista = aplicarFiltro().sort(function (a, b) { return (b.v || 0) - (a.v || 0); });
    var cols = ['Reserva', 'Nome', 'Cidade', 'UF', 'Tipo', 'Pavimentos', 'Esquadrias', 'Valor Aprovado', 'Representante', 'Data Orcamento', 'WhatsApp', 'Email', 'Projetta AGP', 'Projetta Reserva', 'Projetta Etapa'];
    var linhas = lista.map(function (d) {
      var mp = matchProjetta(d);
      var pAgp = mp ? (mp.numeroAGP || '') : '';
      var pRes = mp ? String(mp.numeroReserva || '').replace(/\D/g, '') : '';
      var pEt  = mp ? stageCurto(mp.etapa) : '';
      return [d.r, d.nome, d.cidade, d.uf, d.tipo, d.pav, d.esq, d.v, d.rep, d.data, d.wa, d.email, pAgp, pRes, pEt]
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
      var btn = ev.target.closest('.wkv-rmv');
      if (!btn) return;
      var r = btn.getAttribute('data-r');
      if (r && window.confirm('Remover este contato da prospeccao (opt-out)?')) {
        marcarOptout(r);
        renderTabela(container);
      }
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
