/* ================================================================
 * 50-estoque-omie.js — Consulta Estoque via Omie API
 * ================================================================
 * Proxy: Supabase Edge Function omie-proxy
 * URL: https://plmliavuwlgpwaizfeds.supabase.co/functions/v1/omie-proxy
 * Actions: produtos, posicao, consulta
 * ================================================================ */
(function() {
  'use strict';

  var PROXY_URL = 'https://plmliavuwlgpwaizfeds.supabase.co/functions/v1/omie-proxy';

  // ── Chamada ao proxy ──
  async function omieCall(action, pagina, registros, filtro) {
    var resp = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action || 'produtos',
        pagina: pagina || 1,
        registros: registros || 50,
        filtro: filtro || {}
      })
    });
    if (!resp.ok) throw new Error('Erro ' + resp.status);
    return resp.json();
  }

  // ── Estado ──
  var state = {
    produtos: [],
    totalPaginas: 0,
    paginaAtual: 1,
    buscaTermo: '',
    carregando: false
  };

  // ── Render principal ──
  function render(container) {
    container.innerHTML = ''
      + '<div style="max-width:1200px;margin:0 auto;padding:0 12px">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">'
      +   '<input type="text" id="omie-busca" placeholder="Buscar por codigo, descricao..." value="' + (state.buscaTermo||'') + '" style="flex:1;min-width:250px;padding:10px 14px;border:1px solid #ccc;border-radius:6px;font-size:14px" />'
      +   '<button id="omie-btn-buscar" style="background:#1a5276;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-weight:700;font-size:14px;cursor:pointer">🔍 Buscar</button>'
      +   '<button id="omie-btn-todos" style="background:#2e7d32;color:#fff;border:none;padding:10px 18px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">📦 Listar Todos</button>'
      +   '<button id="omie-btn-posicao" style="background:#e65100;color:#fff;border:none;padding:10px 18px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer">📊 Posicao Estoque</button>'
      + '</div>'
      + '<div id="omie-status" style="font-size:12px;color:#888;margin-bottom:8px"></div>'
      + '<div id="omie-tabela"></div>'
      + '<div id="omie-paginacao" style="margin-top:12px;display:flex;gap:8px;justify-content:center"></div>'
      + '</div>';

    // Handlers
    document.getElementById('omie-btn-buscar').addEventListener('click', function() {
      state.buscaTermo = document.getElementById('omie-busca').value.trim();
      state.paginaAtual = 1;
      carregarProdutos();
    });
    document.getElementById('omie-busca').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { document.getElementById('omie-btn-buscar').click(); }
    });
    document.getElementById('omie-btn-todos').addEventListener('click', function() {
      state.buscaTermo = '';
      document.getElementById('omie-busca').value = '';
      state.paginaAtual = 1;
      carregarProdutos();
    });
    document.getElementById('omie-btn-posicao').addEventListener('click', function() {
      carregarPosicaoEstoque();
    });

    // Auto-carrega
    carregarProdutos();
  }

  // ── Carregar produtos ──
  async function carregarProdutos() {
    var statusEl = document.getElementById('omie-status');
    var tabelaEl = document.getElementById('omie-tabela');
    if (!tabelaEl) return;

    if (statusEl) statusEl.textContent = '⏳ Carregando produtos...';
    tabelaEl.innerHTML = '<div style="padding:20px;text-align:center;color:#888">Carregando...</div>';

    try {
      var filtro = {};
      // Omie nao aceita filtro por descricao no ListarProdutos
      // Vamos buscar todos e filtrar no client
      var data = await omieCall('produtos', state.paginaAtual, 50, filtro);

      // Debug: se Omie retornou erro
      if (data.faultstring || data.error) {
        if (statusEl) statusEl.textContent = '⚠ Omie: ' + (data.faultstring || JSON.stringify(data.error));
        tabelaEl.innerHTML = '<div style="padding:20px;color:#e65100">'
          + '<div style="font-weight:700;margin-bottom:8px">Resposta da Omie:</div>'
          + '<pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto">' + JSON.stringify(data, null, 2) + '</pre>'
          + '</div>';
        return;
      }

      state.totalPaginas = data.total_de_paginas || 0;
      var produtos = data.produto_servico_cadastro || [];

      // Filtra no client se tem termo de busca
      if (state.buscaTermo) {
        var termo = state.buscaTermo.toLowerCase();
        produtos = produtos.filter(function(p) {
          var desc = (p.descricao || '').toLowerCase();
          var cod = (p.codigo || p.codigo_produto || '').toLowerCase();
          return desc.indexOf(termo) >= 0 || cod.indexOf(termo) >= 0;
        });
      }

      state.produtos = produtos;

      if (statusEl) statusEl.textContent = 'Pagina ' + (data.pagina || 1) + ' de ' + state.totalPaginas + ' | ' + (data.total_de_registros || 0) + ' produto(s)' + (state.buscaTermo ? ' (filtrado: ' + produtos.length + ')' : '');

      if (!produtos.length) {
        tabelaEl.innerHTML = '<div style="padding:30px;text-align:center;color:#888;font-size:14px">Nenhum produto encontrado' + (state.buscaTermo ? ' para "' + state.buscaTermo + '"' : '') + '</div>';
        return;
      }

      renderTabelaProdutos(tabelaEl, produtos);
      renderPaginacao();

    } catch (e) {
      if (statusEl) statusEl.textContent = '❌ Erro: ' + e.message;
      tabelaEl.innerHTML = '<div style="padding:20px;text-align:center;color:#c62828">Erro ao carregar: ' + e.message + '</div>';
    }
  }

  // ── Carregar posição estoque ──
  async function carregarPosicaoEstoque() {
    var statusEl = document.getElementById('omie-status');
    var tabelaEl = document.getElementById('omie-tabela');
    if (!tabelaEl) return;

    if (statusEl) statusEl.textContent = '⏳ Carregando posicao de estoque...';
    tabelaEl.innerHTML = '<div style="padding:20px;text-align:center;color:#888">Carregando estoque...</div>';

    try {
      var data = await omieCall('posicao', 1, 50);
      if (statusEl) statusEl.textContent = 'Posicao de estoque carregada';

      if (data.faultstring || data.error) {
        tabelaEl.innerHTML = '<div style="padding:20px;color:#e65100">'
          + '<div style="font-weight:700;margin-bottom:8px">Resposta da Omie (posicao):</div>'
          + '<pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto">' + JSON.stringify(data, null, 2) + '</pre>'
          + '<div style="margin-top:10px;font-size:12px;color:#888">Tente "Listar Todos" para ver produtos cadastrados.</div>'
          + '</div>';
        return;
      }

      var items = data.produtos || data.produto_servico_list || [];
      if (!items.length) {
        tabelaEl.innerHTML = '<div style="padding:30px;text-align:center;color:#888">Nenhum registro de estoque encontrado.</div>';
        return;
      }

      renderTabelaEstoque(tabelaEl, items);

    } catch (e) {
      if (statusEl) statusEl.textContent = '❌ Erro: ' + e.message;
      tabelaEl.innerHTML = '<div style="padding:20px;text-align:center;color:#c62828">Erro: ' + e.message + '</div>';
    }
  }

  // ── Render tabela de produtos ──
  function renderTabelaProdutos(el, produtos) {
    var html = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
      + '<thead><tr style="background:#1a5276;color:#fff">'
      + '<th style="padding:8px;text-align:left">Codigo</th>'
      + '<th style="padding:8px;text-align:left">Descricao</th>'
      + '<th style="padding:8px;text-align:left">NCM</th>'
      + '<th style="padding:8px;text-align:left">Unidade</th>'
      + '<th style="padding:8px;text-align:right">Preco Custo</th>'
      + '<th style="padding:8px;text-align:right">Preco Venda</th>'
      + '<th style="padding:8px;text-align:center">Ativo</th>'
      + '</tr></thead><tbody>';

    produtos.forEach(function(p, i) {
      var bg = i % 2 === 0 ? '#fff' : '#f8f9fa';
      html += '<tr style="border-bottom:1px solid #eee;background:' + bg + '">'
        + '<td style="padding:6px 8px;font-weight:600;color:#1a5276">' + (p.codigo || p.codigo_produto || '') + '</td>'
        + '<td style="padding:6px 8px">' + (p.descricao || '') + '</td>'
        + '<td style="padding:6px 8px">' + (p.ncm || '') + '</td>'
        + '<td style="padding:6px 8px">' + (p.unidade || '') + '</td>'
        + '<td style="padding:6px 8px;text-align:right">' + fmtMoeda(p.valor_unitario || 0) + '</td>'
        + '<td style="padding:6px 8px;text-align:right">' + fmtMoeda(p.preco_venda || 0) + '</td>'
        + '<td style="padding:6px 8px;text-align:center">' + (p.inativo === 'S' ? '❌' : '✅') + '</td>'
        + '</tr>';
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  // ── Render tabela de estoque ──
  function renderTabelaEstoque(el, items) {
    var html = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
      + '<thead><tr style="background:#e65100;color:#fff">'
      + '<th style="padding:8px;text-align:left">Codigo</th>'
      + '<th style="padding:8px;text-align:left">Produto</th>'
      + '<th style="padding:8px;text-align:right">Fisico</th>'
      + '<th style="padding:8px;text-align:right">Reservado</th>'
      + '<th style="padding:8px;text-align:right">Disponivel</th>'
      + '<th style="padding:8px;text-align:right">CMC Unit</th>'
      + '<th style="padding:8px;text-align:center">Status</th>'
      + '</tr></thead><tbody>';

    items.forEach(function(p, i) {
      var bg = i % 2 === 0 ? '#fff' : '#f8f9fa';
      var fisico = Number(p.nSaldo || p.nEstFisico || p.saldo || 0);
      var reservado = Number(p.nReservado || p.reservado || 0);
      var disponivel = fisico - reservado;
      var status = disponivel > 0 ? '✅' : disponivel === 0 ? '⚠️' : '❌';
      html += '<tr style="border-bottom:1px solid #eee;background:' + bg + '">'
        + '<td style="padding:6px 8px;font-weight:600;color:#1a5276">' + (p.codigo || p.cCodigo || p.nCodProd || '') + '</td>'
        + '<td style="padding:6px 8px">' + (p.descricao || p.cDescricao || '') + '</td>'
        + '<td style="padding:6px 8px;text-align:right;font-weight:600">' + fisico.toFixed(0) + '</td>'
        + '<td style="padding:6px 8px;text-align:right;color:#e65100">' + reservado.toFixed(0) + '</td>'
        + '<td style="padding:6px 8px;text-align:right;font-weight:700;color:' + (disponivel > 0 ? '#2e7d32' : '#c62828') + '">' + disponivel.toFixed(0) + '</td>'
        + '<td style="padding:6px 8px;text-align:right">' + fmtMoeda(p.nCMC || p.cmc_unitario || 0) + '</td>'
        + '<td style="padding:6px 8px;text-align:center;font-size:16px">' + status + '</td>'
        + '</tr>';
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }

  // ── Paginação ──
  function renderPaginacao() {
    var el = document.getElementById('omie-paginacao');
    if (!el || state.totalPaginas <= 1) { if (el) el.innerHTML = ''; return; }
    var html = '';
    if (state.paginaAtual > 1) html += '<button class="omie-page" data-p="' + (state.paginaAtual-1) + '" style="padding:6px 12px;border:1px solid #ccc;border-radius:4px;cursor:pointer">← Anterior</button>';
    html += '<span style="padding:6px 12px;font-weight:600">Pagina ' + state.paginaAtual + ' de ' + state.totalPaginas + '</span>';
    if (state.paginaAtual < state.totalPaginas) html += '<button class="omie-page" data-p="' + (state.paginaAtual+1) + '" style="padding:6px 12px;border:1px solid #ccc;border-radius:4px;cursor:pointer">Proxima →</button>';
    el.innerHTML = html;
    el.querySelectorAll('.omie-page').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.paginaAtual = parseInt(this.dataset.p);
        carregarProdutos();
      });
    });
  }

  function fmtMoeda(v) {
    return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // ── Expoe globalmente ──
  window.EstoqueOmie = { render: render };

  console.log('[estoque-omie] Modulo carregado');
})();
