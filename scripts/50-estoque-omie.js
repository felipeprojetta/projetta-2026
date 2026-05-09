/* ================================================================
 * 50-estoque-omie.js — Consulta Estoque via Omie API
 * ================================================================
 * Proxy: Supabase Edge Function omie-proxy
 * URL: https://plmliavuwlgpwaizfeds.supabase.co/functions/v1/omie-proxy
 *
 * Felipe sessao 14: integracao 100% funcional. ListarPosEstoque sozinho
 * retorna fisico=0 (consulta local "padrao automatico" da OMIE que esta
 * vazio). Estoque REAL esta nos movimentos POR LOCAL (Cavalete de chapas,
 * Cavalete de perfis, Almoxarifado II, etc). A action 'estoque_real' do
 * proxy faz o trabalho: itera locais ativos, soma saldos.
 *
 * Aba tem 2 modos:
 *   1. Estoque OMIE (default): tabela com saldo real por produto
 *   2. Estoque vs. Obra: cruza com chapas usadas em uma versao do
 *      orcamento e mostra "vai sobrar X depois da obra"
 * ================================================================ */
(function() {
  'use strict';

  var PROXY_URL = 'https://plmliavuwlgpwaizfeds.supabase.co/functions/v1/omie-proxy';

  var state = {
    estoque: null,
    buscaTermo: '',
    modo: 'lista',
    obraSelecao: null,
    cruzamento: null,
  };

  async function omieCall(action, opts) {
    opts = opts || {};
    var resp = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, opts))
    });
    if (!resp.ok) throw new Error('Erro HTTP ' + resp.status);
    return resp.json();
  }

  function render(container) {
    container.innerHTML = ''
      + '<div style="max-width:1300px;margin:0 auto;padding:0 12px">'
      + '  <div class="omie-toolbar" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">'
      + '    <div style="display:flex;gap:0;border:1px solid #ccc;border-radius:6px;overflow:hidden">'
      + '      <button id="omie-tab-lista" class="omie-tab is-active" style="padding:8px 16px;border:none;background:#1a5276;color:#fff;font-weight:700;cursor:pointer;font-size:13px">📦 Estoque OMIE</button>'
      + '      <button id="omie-tab-obra" class="omie-tab" style="padding:8px 16px;border:none;background:#fff;color:#333;font-weight:700;cursor:pointer;font-size:13px;border-left:1px solid #ccc">🏗 Estoque vs. Obra</button>'
      + '    </div>'
      + '    <div style="flex:1"></div>'
      + '    <button id="omie-btn-recarregar" style="background:#2e7d32;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;cursor:pointer;font-size:12px">🔄 Recarregar do OMIE</button>'
      + '  </div>'
      + '  <div id="omie-conteudo"></div>'
      + '</div>';

    document.getElementById('omie-tab-lista').addEventListener('click', function() { setModo('lista'); });
    document.getElementById('omie-tab-obra').addEventListener('click', function() { setModo('obra'); });
    document.getElementById('omie-btn-recarregar').addEventListener('click', function() {
      carregarEstoqueReal(true);
    });

    if (!state.estoque) carregarEstoqueReal(false);
    else renderConteudo();
  }

  function setModo(modo) {
    state.modo = modo;
    var bL = document.getElementById('omie-tab-lista');
    var bO = document.getElementById('omie-tab-obra');
    if (modo === 'lista') {
      bL.classList.add('is-active'); bL.style.background = '#1a5276'; bL.style.color = '#fff';
      bO.classList.remove('is-active'); bO.style.background = '#fff'; bO.style.color = '#333';
    } else {
      bL.classList.remove('is-active'); bL.style.background = '#fff'; bL.style.color = '#333';
      bO.classList.add('is-active'); bO.style.background = '#1a5276'; bO.style.color = '#fff';
    }
    renderConteudo();
  }

  async function carregarEstoqueReal(force) {
    var el = document.getElementById('omie-conteudo');
    if (!el) return;
    el.innerHTML = ''
      + '<div style="padding:40px;text-align:center;color:#1a5276;font-size:14px">'
      + '  <div style="font-size:24px;margin-bottom:8px">⏳</div>'
      + '  <div><b>Carregando estoque real OMIE...</b></div>'
      + '  <div style="margin-top:6px;color:#888;font-size:12px">Pode demorar 10-30 segundos na primeira vez (cache 15min depois).</div>'
      + '</div>';
    try {
      var data = await omieCall('estoque_real', { force: !!force });
      if (data.error) {
        var blocked = data.blocked === true;
        el.innerHTML = ''
          + '<div style="padding:24px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;color:#856404">'
          + '  <div style="font-size:16px;font-weight:700;margin-bottom:8px">' + (blocked ? '🚫 OMIE bloqueou temporariamente' : '⚠ Erro ao carregar') + '</div>'
          + '  <div style="font-size:13px;margin-bottom:8px">' + escapeHtml(String(data.error || '')) + '</div>'
          + (data.hint ? '<div style="font-size:12px;color:#666">' + escapeHtml(data.hint) + '</div>' : '')
          + '</div>';
        return;
      }
      state.estoque = data;
      renderConteudo();
    } catch (e) {
      el.innerHTML = '<div style="padding:20px;color:#c62828;background:#ffebee;border-radius:6px"><b>❌ Erro:</b> ' + escapeHtml(e.message) + '</div>';
    }
  }

  function renderConteudo() {
    var el = document.getElementById('omie-conteudo');
    if (!el) return;
    if (state.modo === 'lista') renderListaEstoque(el);
    else renderEstoqueVsObra(el);
  }

  function renderListaEstoque(el) {
    if (!state.estoque) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#888">Carregando...</div>';
      return;
    }
    var d = state.estoque;
    var items = d.items || [];
    var termo = (state.buscaTermo || '').toLowerCase().trim();
    var filtrados = !termo ? items : items.filter(function(p) {
      return (p.cDescricao || '').toLowerCase().indexOf(termo) >= 0
          || (p.cCodigo || '').toLowerCase().indexOf(termo) >= 0;
    });

    var html = ''
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">'
      + '  <input type="text" id="omie-busca" value="' + escapeAttr(state.buscaTermo) + '" placeholder="Buscar por codigo, descricao..." style="flex:1;min-width:280px;padding:8px 12px;border:1px solid #ccc;border-radius:6px;font-size:13px" />'
      + '  <span style="font-size:12px;color:#666">'
      + '    <b>' + d.produtosComMovimento + '</b> com movimento · '
      + '    <b>' + d.locaisConsultados + '</b> locais · '
      + '    cache: <b>' + (d._cached ? '15min' : 'fresco') + '</b> · '
      + '    gerado em ' + formatarHora(d.geradoEm)
      + (termo ? ' · filtrado: <b>' + filtrados.length + '</b>' : '')
      + '  </span>'
      + '</div>';

    if (!filtrados.length) {
      html += '<div style="padding:30px;text-align:center;color:#888;font-size:14px">'
            + (termo ? 'Nenhum produto pra "' + escapeHtml(termo) + '"' : 'Nenhum produto com movimento de estoque.')
            + '</div>';
    } else {
      var comSaldo = filtrados.filter(function(p) { return Number(p.saldoTotal) > 0; }).length;
      var zerados = filtrados.length - comSaldo;
      html += '<div style="font-size:11px;color:#666;margin-bottom:6px">'
            + '<span style="color:#2e7d32">●</span> ' + comSaldo + ' com saldo · '
            + '<span style="color:#999">●</span> ' + zerados + ' zerados'
            + '</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px">'
            + '<thead><tr style="background:#1a5276;color:#fff">'
            + '<th style="padding:8px;text-align:left">Codigo</th>'
            + '<th style="padding:8px;text-align:left">Produto</th>'
            + '<th style="padding:8px;text-align:right">Saldo Total</th>'
            + '<th style="padding:8px;text-align:left">Locais</th>'
            + '<th style="padding:8px;text-align:right">Preco Unit.</th>'
            + '</tr></thead><tbody>';
      filtrados.slice(0, 500).forEach(function(p, i) {
        var bg = i % 2 === 0 ? '#fff' : '#f8f9fa';
        var saldo = Number(p.saldoTotal || 0);
        var corSaldo = saldo > 0 ? '#2e7d32' : (saldo < 0 ? '#c62828' : '#999');
        var locaisTxt = (p.porLocal || [])
          .filter(function(l) { return Number(l.saldo) !== 0; })
          .map(function(l) { return escapeHtml(l.nome) + ' (' + l.saldo + ')'; })
          .join(', ') || '<i style="color:#999">—</i>';
        html += '<tr style="border-bottom:1px solid #eee;background:' + bg + '">'
              + '<td style="padding:6px 8px;font-weight:600;color:#1a5276;font-size:11px">' + escapeHtml(p.cCodigo || '') + '</td>'
              + '<td style="padding:6px 8px">' + escapeHtml(p.cDescricao || '') + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700;color:' + corSaldo + ';font-size:14px">' + fmtNum(saldo) + '</td>'
              + '<td style="padding:6px 8px;font-size:11px;color:#555">' + locaisTxt + '</td>'
              + '<td style="padding:6px 8px;text-align:right">' + fmtMoeda(p.preco || 0) + '</td>'
              + '</tr>';
      });
      html += '</tbody></table>';
      if (filtrados.length > 500) {
        html += '<div style="padding:10px;text-align:center;color:#999;font-size:12px">Mostrando 500 de ' + filtrados.length + '. Use a busca pra refinar.</div>';
      }
    }
    el.innerHTML = html;
    var inp = document.getElementById('omie-busca');
    if (inp) {
      inp.addEventListener('input', function(e) {
        state.buscaTermo = e.target.value;
        renderListaEstoque(el);
      });
    }
  }

  function renderEstoqueVsObra(el) {
    if (!state.estoque) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:#888">Carregando estoque OMIE primeiro...</div>';
      return;
    }
    if (!window.Storage || typeof window.Storage.scope !== 'function') {
      el.innerHTML = '<div style="padding:20px;color:#c62828">Modulo Storage nao disponivel.</div>';
      return;
    }
    var negocios;
    try {
      var st = window.Storage.scope('orcamentos');
      negocios = (st && st.get('negocios')) || [];
    } catch (e) { negocios = []; }
    var negociosComOrc = negocios.filter(function(n) {
      return Array.isArray(n.opcoes) && n.opcoes.some(function(o) {
        return Array.isArray(o.versoes) && o.versoes.some(function(v) {
          return Array.isArray(v.itens) && v.itens.length > 0;
        });
      });
    });
    if (!negociosComOrc.length) {
      el.innerHTML = '<div style="padding:30px;text-align:center;color:#888">Nenhum orcamento com itens encontrado. Crie um orcamento no CRM primeiro.</div>';
      return;
    }

    var html = ''
      + '<div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:8px;padding:14px;margin-bottom:14px">'
      + '  <div style="font-weight:700;color:#0d47a1;margin-bottom:6px">Como funciona</div>'
      + '  <div style="font-size:12px;color:#1565c0">Selecione abaixo um orcamento. O sistema lista as chapas que vao ser usadas, '
      + 'cruza com o saldo atual do OMIE e mostra quanto sobra. Se faltar, aparece em vermelho com sugestao de quanto comprar.</div>'
      + '  <div style="font-size:11px;color:#1976d2;margin-top:6px">Versao 1: superficies (chapas selecionadas no Lev. Sup). Perfis e acessorios entram nas proximas versoes.</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 130px;gap:10px;align-items:end;margin-bottom:14px">'
      + '  <div><label style="display:block;font-size:11px;color:#666;margin-bottom:3px">Negocio</label>'
      + '    <select id="obra-sel-negocio" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:13px">'
      + '      <option value="">— escolha —</option>'
      + negociosComOrc.map(function(n) {
          var sel = state.obraSelecao && state.obraSelecao.negocioId === n.id ? ' selected' : '';
          var nome = (n.clienteNome || n.titulo || n.id);
          return '<option value="' + escapeAttr(n.id) + '"' + sel + '>' + escapeHtml(nome) + '</option>';
        }).join('')
      + '    </select></div>'
      + '  <div><label style="display:block;font-size:11px;color:#666;margin-bottom:3px">Opcao</label>'
      + '    <select id="obra-sel-opcao" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:13px"><option value="">—</option></select></div>'
      + '  <div><label style="display:block;font-size:11px;color:#666;margin-bottom:3px">Versao</label>'
      + '    <select id="obra-sel-versao" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:13px"><option value="">—</option></select></div>'
      + '  <button id="obra-btn-cruzar" disabled style="padding:8px 14px;background:#1a5276;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;opacity:0.5">Comparar</button>'
      + '</div>'
      + '<div id="obra-resultado"></div>';
    el.innerHTML = html;

    var selN = document.getElementById('obra-sel-negocio');
    var selO = document.getElementById('obra-sel-opcao');
    var selV = document.getElementById('obra-sel-versao');
    var btn = document.getElementById('obra-btn-cruzar');

    function popularOpcoes() {
      var nId = selN.value;
      var n = negociosComOrc.find(function(x) { return x.id === nId; });
      var opcoes = (n && n.opcoes) || [];
      selO.innerHTML = '<option value="">—</option>' + opcoes.map(function(o) {
        var totItens = (o.versoes || []).reduce(function(acc, v) { return acc + (v.itens||[]).length; }, 0);
        return '<option value="' + escapeAttr(o.letra) + '">' + escapeHtml(o.letra + ' (' + totItens + ' itens)') + '</option>';
      }).join('');
      selV.innerHTML = '<option value="">—</option>';
      atualizarBtn();
    }
    function popularVersoes() {
      var nId = selN.value;
      var oLetra = selO.value;
      var n = negociosComOrc.find(function(x) { return x.id === nId; });
      var o = n && (n.opcoes || []).find(function(x) { return x.letra === oLetra; });
      var versoes = (o && o.versoes) || [];
      selV.innerHTML = '<option value="">—</option>' + versoes.map(function(v) {
        return '<option value="' + escapeAttr(v.numero) + '">V' + escapeHtml(v.numero) + ' (' + ((v.itens||[]).length) + ' itens)</option>';
      }).join('');
      atualizarBtn();
    }
    function atualizarBtn() {
      var ok = selN.value && selO.value && selV.value;
      btn.disabled = !ok;
      btn.style.opacity = ok ? '1' : '0.5';
    }
    selN.addEventListener('change', popularOpcoes);
    selO.addEventListener('change', popularVersoes);
    selV.addEventListener('change', atualizarBtn);
    btn.addEventListener('click', function() {
      executarCruzamento(selN.value, selO.value, selV.value);
    });

    if (state.obraSelecao) {
      selN.value = state.obraSelecao.negocioId; popularOpcoes();
      selO.value = state.obraSelecao.opcaoLetra; popularVersoes();
      selV.value = state.obraSelecao.versaoNumero; atualizarBtn();
      if (state.cruzamento) renderResultadoCruzamento();
    }
  }

  function executarCruzamento(negocioId, opcaoLetra, versaoNumero) {
    var st = window.Storage.scope('orcamentos');
    var negocios = (st && st.get('negocios')) || [];
    var n = negocios.find(function(x) { return x.id === negocioId; });
    var o = n && (n.opcoes || []).find(function(x) { return x.letra === opcaoLetra; });
    var v = o && (o.versoes || []).find(function(x) { return String(x.numero) === String(versaoNumero); });
    if (!v) {
      alert('Versao nao encontrada.');
      return;
    }
    state.obraSelecao = { negocioId: negocioId, opcaoLetra: opcaoLetra, versaoNumero: versaoNumero };
    var demanda = coletarDemandaObra(v);
    var omieIdx = construirIndiceOmie(state.estoque.items || []);
    var linhas = [];
    demanda.forEach(function(d) {
      if (d.cat === 'aviso') { linhas.push(d); return; }
      var match = matchOmie(omieIdx, d);
      var saldo = match ? Number(match.saldoTotal || 0) : 0;
      var sobra = saldo - d.usar;
      linhas.push({
        cat: d.cat, descSistema: d.descricao, usar: d.usar, unidade: d.unidade,
        match: match, saldoOmie: saldo, sobra: sobra,
        status: !match ? 'sem-match' : (sobra >= 0 ? 'ok' : 'comprar')
      });
    });
    state.cruzamento = { linhas: linhas, gerado: new Date().toISOString() };
    renderResultadoCruzamento();
  }

  function coletarDemandaObra(versao) {
    var demanda = [];
    var sel = versao.chapasSelecionadas || {};
    Object.keys(sel).forEach(function(cor) {
      var c = sel[cor];
      var qtd = Number(c.numChapas || 0);
      if (qtd <= 0) return;
      demanda.push({
        cat: 'superficie',
        descricao: c.descricao || cor,
        cor: cor,
        usar: qtd,
        unidade: 'CH',
      });
    });
    if (!Object.keys(sel).length) {
      demanda.push({
        cat: 'aviso',
        descricao: 'Aba "Lev. Superficies" do orcamento nao tem chapas-mae selecionadas (duplo clique nos cards). Sem isso, nao da pra cruzar com OMIE.',
      });
    }
    // TODO: perfis e acessorios em commits proximos
    return demanda;
  }

  function construirIndiceOmie(items) {
    var idx = { porCcod: {}, porPalavraChave: {} };
    items.forEach(function(p) {
      idx.porCcod[String(p.cCodigo || '').toUpperCase()] = p;
      var d = String(p.cDescricao || '').toUpperCase();
      var mPro = d.match(/PRO\s*\d{3,}/g);
      var mDim = d.match(/\d{3,4}\s*[X×]\s*\d{3,4}/g);
      var tokens = [].concat(mPro || []).concat(mDim || [])
        .map(function(t) { return t.replace(/\s/g, ''); });
      tokens.forEach(function(t) {
        if (!idx.porPalavraChave[t]) idx.porPalavraChave[t] = [];
        idx.porPalavraChave[t].push(p);
      });
    });
    return idx;
  }

  function matchOmie(idx, demanda) {
    var d = String(demanda.descricao || '').toUpperCase();
    var mPro = d.match(/PRO\s*\d{3,}/);
    var mDim = d.match(/(\d{3,4})\s*[X×]\s*(\d{3,4})/);
    if (mPro) {
      var tokenPro = mPro[0].replace(/\s/g, '');
      var candidatos = idx.porPalavraChave[tokenPro] || [];
      if (mDim && candidatos.length > 0) {
        var dimAlvo = mDim[1] + 'X' + mDim[2];
        var dimAlvoInv = mDim[2] + 'X' + mDim[1];
        var comDim = candidatos.filter(function(c) {
          var cd = String(c.cDescricao || '').toUpperCase().replace(/\s/g, '');
          return cd.indexOf(dimAlvo) >= 0 || cd.indexOf(dimAlvoInv) >= 0;
        });
        if (comDim.length === 1) return comDim[0];
        if (comDim.length > 1) {
          return {
            cCodigo: comDim.map(function(c) { return c.cCodigo; }).join(' + '),
            cDescricao: comDim[0].cDescricao + ' (+' + (comDim.length - 1) + ' variantes mesmo PRO+dim)',
            saldoTotal: comDim.reduce(function(a, c) { return a + Number(c.saldoTotal || 0); }, 0),
            porLocal: [].concat.apply([], comDim.map(function(c) { return c.porLocal || []; })),
            preco: comDim[0].preco,
          };
        }
      }
      if (candidatos.length >= 1) {
        return {
          cCodigo: candidatos.map(function(c) { return c.cCodigo; }).join(' + '),
          cDescricao: candidatos[0].cDescricao + (candidatos.length > 1 ? ' (+' + (candidatos.length - 1) + ' variantes mesmo PRO)' : ''),
          saldoTotal: candidatos.reduce(function(a, c) { return a + Number(c.saldoTotal || 0); }, 0),
          porLocal: [].concat.apply([], candidatos.map(function(c) { return c.porLocal || []; })),
          preco: candidatos[0].preco,
        };
      }
    }
    return null;
  }

  function renderResultadoCruzamento() {
    var el = document.getElementById('obra-resultado');
    if (!el || !state.cruzamento) return;
    var linhas = state.cruzamento.linhas || [];
    if (!linhas.length) {
      el.innerHTML = '<div style="padding:30px;text-align:center;color:#888">Sem itens nesta versao.</div>';
      return;
    }
    var avisos = linhas.filter(function(l) { return l.cat === 'aviso'; });
    var efetivas = linhas.filter(function(l) { return l.cat !== 'aviso'; });
    var faltam = efetivas.filter(function(l) { return l.status === 'comprar'; });
    var semMatch = efetivas.filter(function(l) { return l.status === 'sem-match'; });
    var ok = efetivas.filter(function(l) { return l.status === 'ok'; });

    var html = '';
    if (efetivas.length) {
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">'
            + '  <div style="background:#e8f5e9;border:1px solid #81c784;border-radius:6px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#2e7d32">' + ok.length + '</div><div style="font-size:11px;color:#1b5e20">✓ tem estoque</div></div>'
            + '  <div style="background:#ffebee;border:1px solid #ef9a9a;border-radius:6px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#c62828">' + faltam.length + '</div><div style="font-size:11px;color:#b71c1c">⚠ falta — comprar</div></div>'
            + '  <div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:6px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#e65100">' + semMatch.length + '</div><div style="font-size:11px;color:#bf360c">? sem match OMIE</div></div>'
            + '  <div style="background:#e3f2fd;border:1px solid #64b5f6;border-radius:6px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#1565c0">' + efetivas.length + '</div><div style="font-size:11px;color:#0d47a1">total itens</div></div>'
            + '</div>';
    }
    if (avisos.length) {
      html += '<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:12px;margin-bottom:12px;font-size:13px;color:#5d4037">'
            + avisos.map(function(a) { return '⚠ ' + escapeHtml(a.descricao); }).join('<br>')
            + '</div>';
    }
    if (efetivas.length) {
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px">'
            + '<thead><tr style="background:#1a5276;color:#fff">'
            + '<th style="padding:8px;text-align:left">Cat</th>'
            + '<th style="padding:8px;text-align:left">Item Sistema</th>'
            + '<th style="padding:8px;text-align:left">Match OMIE</th>'
            + '<th style="padding:8px;text-align:right">Estoque Atual</th>'
            + '<th style="padding:8px;text-align:right">Vai Usar</th>'
            + '<th style="padding:8px;text-align:right">Sobra</th>'
            + '<th style="padding:8px;text-align:center">Status</th>'
            + '</tr></thead><tbody>';
      efetivas.forEach(function(l, i) {
        var bg = i % 2 === 0 ? '#fff' : '#f8f9fa';
        var status, corStatus;
        if (l.status === 'ok') { status = '✓ OK'; corStatus = '#2e7d32'; }
        else if (l.status === 'comprar') { status = '⚠ COMPRAR ' + Math.abs(l.sobra) + ' ' + l.unidade; corStatus = '#c62828'; }
        else { status = '? sem match'; corStatus = '#e65100'; }
        var matchTxt = l.match
          ? '<div style="font-size:11px;color:#1a5276;font-weight:600">' + escapeHtml(l.match.cCodigo || '') + '</div>'
            + '<div style="font-size:11px;color:#555">' + escapeHtml(l.match.cDescricao || '') + '</div>'
          : '<i style="color:#999">— nao encontrado no OMIE</i>';
        html += '<tr style="border-bottom:1px solid #eee;background:' + bg + '">'
              + '<td style="padding:6px 8px;font-weight:600">' + escapeHtml(l.cat) + '</td>'
              + '<td style="padding:6px 8px">' + escapeHtml(l.descSistema) + '</td>'
              + '<td style="padding:6px 8px">' + matchTxt + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700">' + (l.match ? fmtNum(l.saldoOmie) : '—') + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700;color:#1a5276">' + fmtNum(l.usar) + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700;color:' + (l.match && l.sobra >= 0 ? '#2e7d32' : '#c62828') + '">' + (l.match ? fmtNum(l.sobra) : '—') + '</td>'
              + '<td style="padding:6px 8px;text-align:center;color:' + corStatus + ';font-weight:700;font-size:11px">' + status + '</td>'
              + '</tr>';
      });
      html += '</tbody></table>';
    }
    el.innerHTML = html;
  }

  // ── Helpers ──
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function fmtMoeda(v) {
    return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function fmtNum(v) {
    var n = Number(v || 0);
    if (Math.abs(n) >= 100) return n.toFixed(0);
    var t = n.toFixed(2);
    return t.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }
  function formatarHora(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    } catch (_) { return '—'; }
  }

  window.EstoqueOmie = { render: render };
  console.log('[estoque-omie] Modulo carregado v14');
})();
