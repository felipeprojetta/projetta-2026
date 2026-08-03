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
    ordem: 'dtCriacao', dir: 'desc', pagina: 0,
  };
  var POR_PAGINA = 100;

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
      if (ui.comTel && !d.tel) return false;
      if (ui.comReserva && !d.reserva) return false;
      return true;
    });
  }

  function ordenar(lista) {
    var c = ui.ordem, dir = ui.dir === 'asc' ? 1 : -1;
    return lista.slice().sort(function (a, b) {
      var va = a[c], vb = b[c];
      if (c === 'valor' || c === 'm2') {
        return ((Number(va) || 0) - (Number(vb) || 0)) * dir;
      }
      if (c === 'dtCriacao' || c === 'dtOrcamento' || c === 'dtFechamento') {
        // dd/mm/aaaa -> aaaammdd pra comparar como texto
        var f = function (s) {
          var m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
          return m ? m[3] + m[2] + m[1] : '';
        };
        return String(f(va)).localeCompare(String(f(vb))) * dir;
      }
      return String(va || '').localeCompare(String(vb || ''), 'pt-BR') * dir;
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
      +      kpi('Com reserva', comRes.toLocaleString('pt-BR'), 'ja viraram reserva')
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
      + '      <label class="wkp-chk"><input type="checkbox" id="wkp-res"' + (ui.comReserva ? ' checked' : '') + '> So com reserva</label>'
      + '    </div>'
      + '    <div class="wkp-acoes">'
      + '      <button id="wkp-limpar" class="wkp-btn">\u21ba Limpar filtros</button>'
      + '      <button id="wkp-csv" class="wkp-btn wkp-btn-p">\u2193 Exportar lista filtrada (CSV)</button>'
      + '    </div>'
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
      +        th('Cliente', 'titulo') + th('Local', 'cidade') + th('Contato', 'tel')
      +        th('Obra (m\u00b2)', 'm2') + th('Etapa', 'etapa') + th('Responsavel', 'responsavel')
      +        th('Valor', 'valor') + th('Criado', 'dtCriacao') + th('Reserva / AG', 'reserva')
      + '    </tr></thead><tbody>'
      +        (pagina.length ? pagina.map(linha).join('')
             : '<tr><td colspan="9" style="text-align:center;padding:40px;color:#6b7280">Nenhum pedido nesse filtro.</td></tr>')
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
  function linha(d) {
    var local = [d.cidade, d.uf].filter(Boolean).join(' \u00b7 ');
    return '<tr>'
      + '<td><b>' + esc(d.titulo || d.nome || '(sem nome)') + '</b>'
      +   (d.endereco ? '<div class="wkp-sub">' + esc(String(d.endereco).slice(0, 70)) + '</div>' : '')
      + '</td>'
      + '<td>' + esc(local || '\u2014') + '</td>'
      + '<td>' + (d.tel ? esc(d.tel) : '<span class="wkp-vazio">sem telefone</span>')
      +   (d.email ? '<div class="wkp-sub">' + esc(d.email) + '</div>' : '') + '</td>'
      + '<td style="text-align:center">' + (d.m2 ? esc(d.m2) : '\u2014') + '</td>'
      + '<td>' + esc(d.etapa || '\u2014') + '</td>'
      + '<td>' + esc(d.responsavel || '\u2014') + '</td>'
      + '<td style="text-align:right"><b>' + (Number(d.valor) ? 'R$ ' + brl(d.valor) : '\u2014') + '</b></td>'
      + '<td style="text-align:center">' + esc(d.dtCriacao || '\u2014') + '</td>'
      + '<td>' + (d.reserva ? 'Res ' + esc(d.reserva) : '\u2014')
      +   (d.ag ? '<div class="wkp-sub">' + esc(d.ag) + '</div>' : '') + '</td>'
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
    var lp = $('wkp-limpar');
    if (lp) lp.addEventListener('click', function () {
      ui.busca = ''; ui.uf = ''; ui.cidade = ''; ui.etapa = ''; ui.responsavel = '';
      ui.vmin = ''; ui.vmax = ''; ui.comTel = false; ui.comReserva = false; reset();
    });
    var ant = $('wkp-ant'), prox = $('wkp-prox');
    if (ant) ant.addEventListener('click', function () { if (ui.pagina > 0) { ui.pagina--; render(container); } });
    if (prox) prox.addEventListener('click', function () { ui.pagina++; render(container); });
    container.querySelectorAll('th[data-s]').forEach(function (th) {
      th.addEventListener('click', function () {
        var c = th.getAttribute('data-s');
        if (ui.ordem === c) ui.dir = ui.dir === 'asc' ? 'desc' : 'asc';
        else { ui.ordem = c; ui.dir = (c === 'valor' || c === 'm2' || c.indexOf('dt') === 0) ? 'desc' : 'asc'; }
        reset();
      });
    });
    var csv = $('wkp-csv');
    if (csv) csv.addEventListener('click', function () { exportarCSV(ordenar(filtrar(_dados))); });
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
      return cols.map(function (c) {
        var v = d[c[0]];
        if (c[0] === 'valor') return String((Number(v) || 0).toFixed(2)).replace('.', ',');
        return q(v);
      }).join(';');
    });
    var csv = '\uFEFF' + cols.map(function (c) { return q(c[1]); }).join(';') + '\n' + linhas.join('\n');
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
      '@media(max-width:900px){.wkp-kpis{grid-template-columns:repeat(2,1fr)}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  window.WeikuPedidos = { render: render };
  console.log('[weiku-pedidos] Modulo carregado (funil Bitrix24)');
})();
