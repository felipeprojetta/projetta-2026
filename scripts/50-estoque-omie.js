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
      // Felipe sessao 14 v12: erro sem cache stale disponivel
      if (data.error) {
        var blocked = data.blocked === true;
        var redundant = data.redundant === true;
        // Felipe sessao 14: REDUNDANT geralmente passa em 20-40s. Em vez
        // de mostrar so' erro, faz auto-retry com countdown. OMIE devolve
        // 'Aguarde N segundos' no error msg — extrai e usa.
        if (redundant) {
          var match = String(data.error || '').match(/(\d+)\s*segundos?/i);
          var espera = match ? Math.min(60, Math.max(10, parseInt(match[1], 10) + 3)) : 30;
          renderRedundantCountdown(el, espera);
          return;
        }
        var titulo = blocked ? '🚫 OMIE bloqueou temporariamente' : '⚠ Erro ao carregar';
        el.innerHTML = ''
          + '<div style="padding:24px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:8px;color:#856404">'
          + '  <div style="font-size:16px;font-weight:700;margin-bottom:8px">' + titulo + '</div>'
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

  // Felipe sessao 14: countdown visual durante auto-retry de REDUNDANT.
  // OMIE responde 'Aguarde N segundos' — esperamos N+3 e tentamos de novo
  // automaticamente. Felipe nao precisa ficar clicando em loop.
  function renderRedundantCountdown(el, segundos) {
    var fim = Date.now() + segundos * 1000;
    var cancelado = false;
    function tick() {
      if (cancelado) return;
      var rest = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
      if (rest <= 0) {
        el.innerHTML = '<div style="padding:30px;text-align:center;color:#1a5276"><div style="font-size:24px">🔄</div><b>Tentando novamente...</b></div>';
        carregarEstoqueReal(false);
        return;
      }
      el.innerHTML = ''
        + '<div style="padding:30px;text-align:center">'
        + '  <div style="font-size:42px;margin-bottom:10px;color:#e65100;font-weight:800">' + rest + 's</div>'
        + '  <div style="font-size:14px;color:#856404;font-weight:700">⏳ OMIE pediu pra aguardar — tentando de novo automaticamente</div>'
        + '  <div style="font-size:12px;color:#888;margin-top:8px">A API do OMIE limita chamadas seguidas em ~30s. Esta tela atualiza sozinha quando o tempo acabar.</div>'
        + '  <button id="omie-cancelar-retry" style="margin-top:14px;padding:6px 12px;background:#fff;border:1px solid #ccc;border-radius:6px;cursor:pointer;color:#666;font-size:11px">Cancelar</button>'
        + '</div>';
      var btn = document.getElementById('omie-cancelar-retry');
      if (btn) btn.addEventListener('click', function() {
        cancelado = true;
        el.innerHTML = '<div style="padding:20px;color:#666">Auto-retry cancelado. Clique em "Recarregar do OMIE" quando quiser tentar de novo.</div>';
      });
      setTimeout(tick, 1000);
    }
    tick();
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

    // Felipe sessao 14 v12: avisos sobre dados stale/parciais
    var avisos = '';
    if (d._stale) {
      var motivoTxt = d._staleReason === 'omie_blocked' ? 'OMIE bloqueou temporariamente'
                    : d._staleReason === 'omie_redundant' ? 'OMIE detectou consumo redundante (~30s)'
                    : 'erro ao consultar OMIE';
      avisos += '<div style="background:#fff3cd;border:1px solid #ffeaa7;border-radius:6px;padding:10px;margin-bottom:10px;color:#856404;font-size:12px">'
              + '<b>⚠ Mostrando dados em cache (desatualizados)</b> — ' + escapeHtml(motivoTxt)
              + '. Aguarde alguns segundos e clique em Recarregar pra atualizar.'
              + '</div>';
    }
    if (d.locaisComErro && d.locaisComErro.length) {
      avisos += '<div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:6px;padding:10px;margin-bottom:10px;color:#bf360c;font-size:12px">'
              + '<b>⚠ ' + d.locaisComErro.length + ' local(is) com erro:</b> '
              + d.locaisComErro.map(function(l) { return escapeHtml(l.nome); }).join(', ')
              + '. Saldos desses locais nao foram somados — clique em Recarregar pra tentar novamente.'
              + '</div>';
    }

    var html = avisos
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">'
      + '  <input type="text" id="omie-busca" value="' + escapeAttr(state.buscaTermo) + '" placeholder="Buscar por codigo, descricao..." style="flex:1;min-width:280px;padding:8px 12px;border:1px solid #ccc;border-radius:6px;font-size:13px" />'
      + '  <span style="font-size:12px;color:#666">'
      + '    <b>' + (d.produtosComSaldo || d.produtosComMovimento || 0) + '</b> com saldo · '
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
            + '<th style="padding:8px;text-align:right">Saldo</th>'
            + '<th style="padding:8px;text-align:right" title="Reservado em pedidos">Reserv.</th>'
            + '<th style="padding:8px;text-align:right" title="Saldo - Reservado">Disp.</th>'
            + '<th style="padding:8px;text-align:left">Locais</th>'
            + '<th style="padding:8px;text-align:right" title="CMC: Custo Medio Contabil">CMC</th>'
            + '</tr></thead><tbody>';
      filtrados.slice(0, 500).forEach(function(p, i) {
        var bg = i % 2 === 0 ? '#fff' : '#f8f9fa';
        var saldo = Number(p.saldoTotal || 0);
        var reservado = Number(p.reservadoTotal || 0);
        var disponivel = saldo - reservado;
        var corSaldo = saldo > 0 ? '#2e7d32' : (saldo < 0 ? '#c62828' : '#999');
        var corDisp = disponivel > 0 ? '#2e7d32' : (disponivel < 0 ? '#c62828' : '#999');
        var locaisTxt = (p.porLocal || [])
          .filter(function(l) { return Number(l.saldo) !== 0; })
          .map(function(l) { return escapeHtml(l.nome) + ' (' + l.saldo + ')'; })
          .join(', ') || '<i style="color:#999">—</i>';
        html += '<tr style="border-bottom:1px solid #eee;background:' + bg + '">'
              + '<td style="padding:6px 8px;font-weight:600;color:#1a5276;font-size:11px">' + escapeHtml(p.cCodigo || '') + '</td>'
              + '<td style="padding:6px 8px">' + escapeHtml(p.cDescricao || '') + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700;color:' + corSaldo + ';font-size:14px">' + fmtNum(saldo) + '</td>'
              + '<td style="padding:6px 8px;text-align:right;color:' + (reservado > 0 ? '#e65100' : '#999') + '">' + (reservado > 0 ? fmtNum(reservado) : '—') + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700;color:' + corDisp + '">' + fmtNum(disponivel) + '</td>'
              + '<td style="padding:6px 8px;font-size:11px;color:#555">' + locaisTxt + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-size:11px;color:#666">' + fmtMoeda(p.cmc || p.preco || 0) + '</td>'
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
      + '  <div style="font-size:12px;color:#1565c0">Selecione abaixo um orcamento. O sistema calcula a demanda completa: '
      + '<b>chapas</b> (do Lev. Sup), <b>perfis</b> (rodando o motor de cortes -> barras) e <b>acessorios</b> (rodando o motor de regras). '
      + 'Cruza com o saldo OMIE e mostra "vai sobrar X depois da obra". Se faltar, aparece em vermelho com sugestao de quanto comprar.</div>'
      + '  <div style="font-size:11px;color:#1976d2;margin-top:6px">Match em 3 niveis: '
      + '<b>codigo exato</b> (badge verde "cod") &gt; <b>vinculo manual</b> (badge azul "bind") &gt; <b>fuzzy por palavras-chave</b> (badge amarelo "fuzzy"). '
      + 'Itens sem match: clica em "Vincular" pra escolher o produto OMIE certo — fica gravado pra sempre.</div>'
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

  // ──────────────────────────────────────────────────────────────────
  // Felipe sessao 14 (continuacao): bindings manuais sistema -> OMIE.
  // Felipe vai padronizar codigos OMIE pra bater com sistema. Enquanto
  // nao termina, bindings manuais cobrem itens 'sem match'.
  // Storage: scope('cadastros') key 'omie_bindings' = { 'codigo_sistema': 'cCodigoOmie' }
  // ──────────────────────────────────────────────────────────────────
  function loadBindings() {
    try {
      var st = window.Storage && window.Storage.scope('cadastros');
      return (st && st.get('omie_bindings')) || {};
    } catch (_) { return {}; }
  }
  function saveBindings(bindings) {
    try {
      var st = window.Storage.scope('cadastros');
      st.set('omie_bindings', bindings || {});
    } catch (e) { console.warn('[estoque-omie] saveBindings:', e); }
  }
  function setBinding(codigoSistema, cCodigoOmie) {
    var b = loadBindings();
    if (!cCodigoOmie) { delete b[codigoSistema]; }
    else { b[codigoSistema] = cCodigoOmie; }
    saveBindings(b);
  }

  // ──────────────────────────────────────────────────────────────────
  // Coleta demanda da obra: superficies + perfis + acessorios.
  // Felipe sessao 14: invoca os mesmos motores que rodam no orcamento
  // (PerfisPortaExterna.gerarCortes + PerfisCore.calcularPorCodigo +
  // AcessoriosPortaExterna.calcularAcessoriosPorItem) pra somar a
  // demanda de TODOS os itens da versao.
  // ──────────────────────────────────────────────────────────────────
  function coletarDemandaObra(versao) {
    var demanda = [];
    var avisos = [];

    // 1. SUPERFICIES — usa chapasSelecionadas (Lev. Sup ja' calculou nesting)
    var sel = versao.chapasSelecionadas || {};
    Object.keys(sel).forEach(function(cor) {
      var c = sel[cor];
      var qtd = Number(c.numChapas || 0);
      if (qtd <= 0) return;
      demanda.push({
        cat: 'superficie',
        codigoSistema: cor,
        descricao: c.descricao || cor,
        usar: qtd,
        unidade: 'CH',
      });
    });
    if (!Object.keys(sel).length) {
      avisos.push('Aba "Lev. Superficies" do orcamento nao tem chapas-mae selecionadas. Sem isso, a demanda de superficies nao entra no cruzamento.');
    }

    // 2. PERFIS — pra cada item, roda gerarCortes -> calcularPorCodigo
    //    pra obter NUMERO DE BARRAS por codigo. Acumula entre itens.
    var demandaPerfis = {}; // { codigoBarra: qtdBarras }
    var demandaPerfisDesc = {}; // codigoBarra -> 'descricao + sufixo barra'
    if (window.PerfisPortaExterna && window.PerfisCore && window.Storage) {
      var cadPerfis = (window.Storage.scope('cadastros').get('perfis_lista')) || [];
      // Constroi mapa codigo->cadastro pra calcularPorCodigo
      var perfisCadastro = {};
      cadPerfis.forEach(function(p) {
        var cod = String(p.codigo || '').toUpperCase();
        if (!cod) return;
        perfisCadastro[cod] = {
          kgPorMetro: Number(p.kgPorMetro || p.kg_por_metro || 0),
          precoPorKg: Number(p.precoPorKg || p.preco_por_kg || 0),
          precoKgPintura: Number(p.precoKgPintura || 0),
          descricao: p.descricao || '',
        };
      });
      (versao.itens || []).forEach(function(item) {
        if (!item || item.tipo !== 'porta_externa') return; // V1: so' porta externa
        try {
          var cortes = window.PerfisPortaExterna.gerarCortes(item) || {};
          var resultado = window.PerfisCore.calcularPorCodigo(cortes, perfisCadastro);
          (resultado.itens || []).forEach(function(r) {
            var cod = String(r.codigo || '').toUpperCase();
            if (!cod || !r.nBars) return;
            demandaPerfis[cod] = (demandaPerfis[cod] || 0) + r.nBars;
            // Pega descricao base (sem sufixo -6M/-7M/-8M) pro cadastro
            var codBase = cod.replace(/-[678]M$/, '');
            var cad = perfisCadastro[codBase] || perfisCadastro[cod];
            if (cad && cad.descricao && !demandaPerfisDesc[cod]) {
              demandaPerfisDesc[cod] = cad.descricao;
            }
          });
        } catch (err) {
          console.warn('[estoque-omie] gerarCortes falhou no item', item.id, err);
        }
      });
    } else {
      avisos.push('Modulos de Perfis nao carregados — demanda de perfis nao calculada.');
    }
    Object.keys(demandaPerfis).forEach(function(codBarra) {
      demanda.push({
        cat: 'perfil',
        codigoSistema: codBarra,
        descricao: demandaPerfisDesc[codBarra] || codBarra,
        usar: demandaPerfis[codBarra],
        unidade: 'BR', // barras
      });
    });

    // 3. ACESSORIOS — calcularAcessoriosPorItem pra cada item, agrupa por codigo
    var demandaAcess = {};
    var demandaAcessDesc = {};
    var demandaAcessUnid = {};
    if (window.AcessoriosPortaExterna && window.Storage) {
      var cadAcess = window.Storage.scope('cadastros').get('acessorios_lista') || [];
      (versao.itens || []).forEach(function(item) {
        if (!item) return;
        try {
          var linhas = window.AcessoriosPortaExterna.calcularAcessoriosPorItem(item, cadAcess) || [];
          linhas.forEach(function(l) {
            var cod = String(l.codigo || '').toUpperCase();
            if (!cod) return;
            // Felipe: acessorios cuja qtd e' por METRO (fita/silicone)
            // ja vem somado em metros — manter unidade.
            demandaAcess[cod] = (demandaAcess[cod] || 0) + Number(l.qtd || 0);
            if (!demandaAcessDesc[cod]) demandaAcessDesc[cod] = l.descricao || cod;
            if (!demandaAcessUnid[cod]) demandaAcessUnid[cod] = l.unidade || 'un';
          });
        } catch (err) {
          console.warn('[estoque-omie] calcularAcessoriosPorItem falhou no item', item.id, err);
        }
      });
    } else {
      avisos.push('Modulos de Acessorios nao carregados — demanda de acessorios nao calculada.');
    }
    Object.keys(demandaAcess).forEach(function(cod) {
      var qtd = demandaAcess[cod];
      if (!(qtd > 0)) return;
      demanda.push({
        cat: 'acessorio',
        codigoSistema: cod,
        descricao: demandaAcessDesc[cod] || cod,
        usar: qtd,
        unidade: demandaAcessUnid[cod] || 'un',
      });
    });

    avisos.forEach(function(msg) { demanda.unshift({ cat: 'aviso', descricao: msg }); });
    return demanda;
  }

  // ──────────────────────────────────────────────────────────────────
  // Indice OMIE: por cCodigo (chave primaria) + por palavras-chave (fuzzy)
  // ──────────────────────────────────────────────────────────────────
  function construirIndiceOmie(items) {
    var idx = { porCcod: {}, porPalavraChave: {} };
    items.forEach(function(p) {
      var cc = String(p.cCodigo || '').toUpperCase();
      if (cc) idx.porCcod[cc] = p;
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

  // ──────────────────────────────────────────────────────────────────
  // Match com 3 camadas (em ordem de prioridade):
  //   1. CODIGO EXATO  (Felipe: 'depois vou mudar codigos OMIE iguais aqui')
  //   2. BINDING MANUAL  (Felipe ajusta uma vez, fica gravado)
  //   3. FUZZY  (PRO + dim — fallback pra hoje)
  // Retorna { match, fonte: 'codigo'|'binding'|'fuzzy' }
  // ──────────────────────────────────────────────────────────────────
  function matchOmie(idx, demanda, bindings) {
    var codSis = String(demanda.codigoSistema || '').toUpperCase();
    // 1. Codigo exato
    if (codSis && idx.porCcod[codSis]) {
      return { match: idx.porCcod[codSis], fonte: 'codigo' };
    }
    // 1b. Tenta sem sufixo de barra (ex: PA-76X38X1.98-6M -> PA-76X38X1.98)
    var codSisBase = codSis.replace(/-[678]M$/, '');
    if (codSisBase !== codSis && idx.porCcod[codSisBase]) {
      return { match: idx.porCcod[codSisBase], fonte: 'codigo' };
    }
    // 2. Binding manual
    if (bindings && bindings[codSis]) {
      var alvo = String(bindings[codSis]).toUpperCase();
      if (idx.porCcod[alvo]) {
        return { match: idx.porCcod[alvo], fonte: 'binding' };
      }
    }
    // 3. Fuzzy (so' faz sentido pra superficies — descricao tem PRO)
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
        if (comDim.length === 1) return { match: comDim[0], fonte: 'fuzzy' };
        if (comDim.length > 1) {
          return {
            match: {
              cCodigo: comDim.map(function(c) { return c.cCodigo; }).join(' + '),
              cDescricao: comDim[0].cDescricao + ' (+' + (comDim.length - 1) + ' variantes mesmo PRO+dim)',
              saldoTotal: comDim.reduce(function(a, c) { return a + Number(c.saldoTotal || 0); }, 0),
              porLocal: [].concat.apply([], comDim.map(function(c) { return c.porLocal || []; })),
              preco: comDim[0].preco,
              _agregado: true,
            },
            fonte: 'fuzzy',
          };
        }
      }
      if (candidatos.length >= 1) {
        return {
          match: {
            cCodigo: candidatos.map(function(c) { return c.cCodigo; }).join(' + '),
            cDescricao: candidatos[0].cDescricao + (candidatos.length > 1 ? ' (+' + (candidatos.length - 1) + ' variantes mesmo PRO)' : ''),
            saldoTotal: candidatos.reduce(function(a, c) { return a + Number(c.saldoTotal || 0); }, 0),
            porLocal: [].concat.apply([], candidatos.map(function(c) { return c.porLocal || []; })),
            preco: candidatos[0].preco,
            _agregado: true,
          },
          fonte: 'fuzzy',
        };
      }
    }
    return { match: null, fonte: null };
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
    // Mostra loading antes de calcular (motor de perfis demora)
    var elRes = document.getElementById('obra-resultado');
    if (elRes) {
      elRes.innerHTML = '<div style="padding:30px;text-align:center;color:#1a5276"><div style="font-size:24px">⏳</div><b>Calculando demanda — rodando motores de perfis e acessorios...</b></div>';
    }
    // Pequeno delay pra UI atualizar antes do calculo sincrono pesado
    setTimeout(function() {
      var demanda = coletarDemandaObra(v);
      var omieIdx = construirIndiceOmie(state.estoque.items || []);
      var bindings = loadBindings();
      var linhas = [];
      demanda.forEach(function(d) {
        if (d.cat === 'aviso') { linhas.push(d); return; }
        var m = matchOmie(omieIdx, d, bindings);
        var match = m.match;
        var saldo = match ? Number(match.saldoTotal || 0) : 0;
        var sobra = saldo - d.usar;
        linhas.push({
          cat: d.cat, codigoSistema: d.codigoSistema, descSistema: d.descricao,
          usar: d.usar, unidade: d.unidade,
          match: match, fonte: m.fonte, saldoOmie: saldo, sobra: sobra,
          status: !match ? 'sem-match' : (sobra >= 0 ? 'ok' : 'comprar')
        });
      });
      state.cruzamento = { linhas: linhas, gerado: new Date().toISOString() };
      renderResultadoCruzamento();
    }, 50);
  }

  // ──────────────────────────────────────────────────────────────────
  // Render do resultado: cards + tabela com botao 'Vincular' nos sem-match
  // ──────────────────────────────────────────────────────────────────
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
    var contPorCat = { superficie: 0, perfil: 0, acessorio: 0 };
    efetivas.forEach(function(l) { contPorCat[l.cat] = (contPorCat[l.cat] || 0) + 1; });

    var html = '';
    if (efetivas.length) {
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">'
            + '  <div style="background:#e8f5e9;border:1px solid #81c784;border-radius:6px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#2e7d32">' + ok.length + '</div><div style="font-size:11px;color:#1b5e20">✓ tem estoque</div></div>'
            + '  <div style="background:#ffebee;border:1px solid #ef9a9a;border-radius:6px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#c62828">' + faltam.length + '</div><div style="font-size:11px;color:#b71c1c">⚠ falta — comprar</div></div>'
            + '  <div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:6px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#e65100">' + semMatch.length + '</div><div style="font-size:11px;color:#bf360c">? sem match — vincular</div></div>'
            + '  <div style="background:#e3f2fd;border:1px solid #64b5f6;border-radius:6px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;color:#1565c0">' + efetivas.length + '</div><div style="font-size:11px;color:#0d47a1">total ('
            + (contPorCat.superficie || 0) + ' chapas · '
            + (contPorCat.perfil || 0) + ' perfis · '
            + (contPorCat.acessorio || 0) + ' acess.)</div></div>'
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
            + '<th style="padding:8px;text-align:right">Estoque</th>'
            + '<th style="padding:8px;text-align:right">Vai Usar</th>'
            + '<th style="padding:8px;text-align:right">Sobra</th>'
            + '<th style="padding:8px;text-align:center">Status</th>'
            + '<th style="padding:8px;text-align:center">Acao</th>'
            + '</tr></thead><tbody>';
      // Ordena: sem-match -> comprar -> ok (Felipe ve' o que precisa de atencao primeiro)
      var ordenadas = efetivas.slice().sort(function(a, b) {
        var p = { 'sem-match': 0, 'comprar': 1, 'ok': 2 };
        return (p[a.status] - p[b.status]) || a.cat.localeCompare(b.cat);
      });
      ordenadas.forEach(function(l, i) {
        var bg = i % 2 === 0 ? '#fff' : '#f8f9fa';
        var status, corStatus;
        if (l.status === 'ok') { status = '✓ OK'; corStatus = '#2e7d32'; }
        else if (l.status === 'comprar') { status = '⚠ COMPRAR ' + Math.abs(l.sobra) + ' ' + l.unidade; corStatus = '#c62828'; }
        else { status = '? sem match'; corStatus = '#e65100'; }
        var fonteBadge = '';
        if (l.fonte === 'codigo') fonteBadge = '<span title="Match por codigo exato" style="background:#dcfce7;color:#166534;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px;font-weight:600">cod</span>';
        else if (l.fonte === 'binding') fonteBadge = '<span title="Match por binding manual" style="background:#dbeafe;color:#1e40af;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px;font-weight:600">bind</span>';
        else if (l.fonte === 'fuzzy') fonteBadge = '<span title="Match por palavras-chave (fuzzy)" style="background:#fef3c7;color:#92400e;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px;font-weight:600">fuzzy</span>';
        var matchTxt = l.match
          ? '<div style="font-size:11px;color:#1a5276;font-weight:600">' + escapeHtml(l.match.cCodigo || '') + fonteBadge + '</div>'
            + '<div style="font-size:11px;color:#555">' + escapeHtml(l.match.cDescricao || '') + '</div>'
          : '<i style="color:#999">— nao encontrado no OMIE</i>';
        // Botao vincular: aparece em sem-match, e em fuzzy/binding (Felipe pode trocar)
        var btnAcao = '';
        if (l.codigoSistema) {
          var btnLabel = l.fonte === 'binding' ? '✏ Trocar' : (l.match ? '🔗 Vincular' : '🔗 Vincular');
          btnAcao = '<button class="omie-btn-vincular" data-cod-sistema="' + escapeAttr(l.codigoSistema) + '" '
                  + 'style="font-size:11px;padding:4px 8px;background:#1a5276;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600">'
                  + btnLabel + '</button>';
        }
        html += '<tr style="border-bottom:1px solid #eee;background:' + bg + '">'
              + '<td style="padding:6px 8px;font-weight:600">' + escapeHtml(l.cat) + '</td>'
              + '<td style="padding:6px 8px"><div style="font-size:10px;color:#666">' + escapeHtml(l.codigoSistema || '') + '</div>'
              + '<div>' + escapeHtml(l.descSistema) + '</div></td>'
              + '<td style="padding:6px 8px">' + matchTxt + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700">' + (l.match ? fmtNum(l.saldoOmie) : '—') + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700;color:#1a5276">' + fmtNum(l.usar) + ' ' + escapeHtml(l.unidade) + '</td>'
              + '<td style="padding:6px 8px;text-align:right;font-weight:700;color:' + (l.match && l.sobra >= 0 ? '#2e7d32' : '#c62828') + '">' + (l.match ? fmtNum(l.sobra) : '—') + '</td>'
              + '<td style="padding:6px 8px;text-align:center;color:' + corStatus + ';font-weight:700;font-size:11px">' + status + '</td>'
              + '<td style="padding:6px 8px;text-align:center">' + btnAcao + '</td>'
              + '</tr>';
      });
      html += '</tbody></table>';
    }
    el.innerHTML = html;

    // Listener pros botoes Vincular
    el.querySelectorAll('.omie-btn-vincular').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var codSis = e.currentTarget.getAttribute('data-cod-sistema');
        abrirModalVinculo(codSis);
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Modal de vinculo manual: Felipe escolhe um produto OMIE da lista
  // pra vincular ao codigo do sistema. Persistido em omie_bindings.
  // ──────────────────────────────────────────────────────────────────
  function abrirModalVinculo(codSistema) {
    if (!state.estoque) return;
    var items = state.estoque.items || [];
    var bindings = loadBindings();
    var linha = (state.cruzamento && state.cruzamento.linhas || []).find(function(l) { return l.codigoSistema === codSistema; });
    var descSis = linha ? linha.descSistema : codSistema;
    var bindingAtual = bindings[String(codSistema).toUpperCase()] || '';

    var overlay = document.createElement('div');
    overlay.id = 'omie-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = ''
      + '<div style="background:#fff;border-radius:10px;max-width:850px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,0.4)">'
      + '  <div style="padding:16px 20px;border-bottom:1px solid #ddd;display:flex;align-items:center;gap:14px">'
      + '    <div style="flex:1">'
      + '      <div style="font-weight:700;color:#1a5276;font-size:15px">Vincular ao OMIE</div>'
      + '      <div style="font-size:12px;color:#666;margin-top:2px"><b>' + escapeHtml(codSistema) + '</b> — ' + escapeHtml(descSis) + '</div>'
      + '    </div>'
      + '    <button id="omie-modal-fechar" style="background:none;border:none;font-size:24px;cursor:pointer;color:#666">×</button>'
      + '  </div>'
      + '  <div style="padding:14px 20px;border-bottom:1px solid #eee">'
      + '    <input type="text" id="omie-modal-busca" placeholder="Buscar codigo ou descricao OMIE..." autofocus '
      + '      style="width:100%;padding:9px 12px;border:1px solid #ccc;border-radius:6px;font-size:13px" />'
      + '    ' + (bindingAtual ? '<div style="font-size:11px;color:#0d47a1;margin-top:6px">Binding atual: <b>' + escapeHtml(bindingAtual) + '</b> · '
      + '<a href="#" id="omie-modal-remover" style="color:#c62828">remover</a></div>' : '')
      + '  </div>'
      + '  <div id="omie-modal-lista" style="flex:1;overflow-y:auto;padding:0 12px 12px"></div>'
      + '</div>';
    document.body.appendChild(overlay);

    function fechar() {
      var o = document.getElementById('omie-modal-overlay');
      if (o) o.remove();
    }
    document.getElementById('omie-modal-fechar').addEventListener('click', fechar);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) fechar(); });

    var rem = document.getElementById('omie-modal-remover');
    if (rem) rem.addEventListener('click', function(e) {
      e.preventDefault();
      setBinding(String(codSistema).toUpperCase(), '');
      fechar();
      executarCruzamento(state.obraSelecao.negocioId, state.obraSelecao.opcaoLetra, state.obraSelecao.versaoNumero);
    });

    var lista = document.getElementById('omie-modal-lista');
    var inp = document.getElementById('omie-modal-busca');

    // Sugere termos a partir do codigo/descricao do sistema
    var termoInicial = '';
    var codBase = String(codSistema).replace(/-[678]M$/, '').replace(/[^A-Z0-9]/gi, '');
    if (codBase.length >= 4) termoInicial = codBase.substring(0, Math.min(8, codBase.length));
    var mPro = String(descSis).match(/PRO\s*\d+/i);
    if (mPro) termoInicial = mPro[0].replace(/\s/g, '');
    inp.value = termoInicial;

    function renderLista() {
      var t = (inp.value || '').toLowerCase().trim();
      var filtrados = !t ? items.slice(0, 100) : items.filter(function(p) {
        return (p.cCodigo || '').toLowerCase().indexOf(t) >= 0
            || (p.cDescricao || '').toLowerCase().indexOf(t) >= 0;
      }).slice(0, 200);
      if (!filtrados.length) {
        lista.innerHTML = '<div style="padding:30px;text-align:center;color:#888">Nenhum produto encontrado pra "' + escapeHtml(t) + '"</div>';
        return;
      }
      var h = '<table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>';
      filtrados.forEach(function(p, i) {
        var saldo = Number(p.saldoTotal || 0);
        var corS = saldo > 0 ? '#2e7d32' : '#999';
        h += '<tr class="omie-modal-row" data-ccod="' + escapeAttr(p.cCodigo) + '" '
           + 'style="cursor:pointer;border-bottom:1px solid #eee;background:' + (i % 2 === 0 ? '#fff' : '#f9f9f9') + '">'
           + '<td style="padding:8px;font-weight:600;color:#1a5276;font-size:11px;width:140px">' + escapeHtml(p.cCodigo) + '</td>'
           + '<td style="padding:8px">' + escapeHtml(p.cDescricao) + '</td>'
           + '<td style="padding:8px;text-align:right;font-weight:700;color:' + corS + ';width:80px">' + fmtNum(saldo) + '</td>'
           + '</tr>';
      });
      h += '</tbody></table>';
      if (items.length > filtrados.length && !t) {
        h += '<div style="padding:8px;text-align:center;color:#999;font-size:11px">Digite pra refinar (' + items.length + ' produtos OMIE no total)</div>';
      }
      lista.innerHTML = h;
      lista.querySelectorAll('.omie-modal-row').forEach(function(row) {
        row.addEventListener('mouseenter', function() { row.style.background = '#e3f2fd'; });
        row.addEventListener('mouseleave', function() {
          var idx = Array.prototype.indexOf.call(row.parentNode.children, row);
          row.style.background = idx % 2 === 0 ? '#fff' : '#f9f9f9';
        });
        row.addEventListener('click', function() {
          var ccod = row.getAttribute('data-ccod');
          setBinding(String(codSistema).toUpperCase(), ccod);
          fechar();
          executarCruzamento(state.obraSelecao.negocioId, state.obraSelecao.opcaoLetra, state.obraSelecao.versaoNumero);
        });
      });
    }
    inp.addEventListener('input', renderLista);
    renderLista();
    setTimeout(function() { inp.focus(); inp.select(); }, 50);
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
  console.log('[estoque-omie] Modulo carregado v16 (ListarPosEstoque por local + Reservado/Disp/CMC)');
})();
