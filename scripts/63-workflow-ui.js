/* 63-workflow-ui.js — UI de EXECUCAO do Workflow (espelho das 3 telas Zeev)

   Felipe s43: espelhar os 3 menus PRINCIPAIS do Zeev dentro do Projetta:
     1. INICIAR (Zeev "Iniciar aplicativos"): abre o fluxo. Mostra o form
        real da 1a etapa "Iniciar Processo de Contrato" com os 4 campos
        obrigatorios (Tipo de processo, Origem Pedido, Localizacao Pedido,
        Liberacao Imediata) + orientacoes. Botao "Enviar solicitacao" ->
        motor.abrirTrilha e o fluxo comeca (T01 -> ... -> T44).
     2. EXECUTAR (Zeev "Executar tarefas"): a FILA da pessoa logada.
        Colunas espelhadas do Zeev: # | Tarefa | Expira em | Solicitante.
        Barra "% dentro do prazo" no topo. Clique numa tarefa -> painel
        com dados + botao Concluir (anda o fluxo).
     3. ACOMPANHAR (Zeev "Acompanhar solicitacoes"): todas as solicitacoes
        com # | Solicitacao | Status | Atividade atual.

   "Ver a fila como": Projetta so' tem 3 logins hoje (felipe/thays/paula);
   Ruan/CDS/Eric nao tem usuario, entao o seletor simula quem esta olhando
   pra dar pra testar a fila de cada um. Quando criar os logins reais, o
   mapa_usuarios assume e o seletor vira so' um atalho.

   Le/escreve via Workflow.motor (scope workflow no Supabase). Nao toca
   modulo existente. Depende de 62-workflow-motor.js.
   Opcoes reais dos 4 campos extraidas ao vivo do Zeev (tela Solicitar).
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // 4 campos da abertura (T01) — opcoes reais do Zeev
  var CAMPOS_ABERTURA = [
    { key: 'tipoProcesso', label: 'Tipo de processo',
      opts: ['Aguardando Liberação', 'Cliente novo', 'Exportação', 'Instalação',
             'Liberação', 'Manutenção', 'Medição', 'Produção'] },
    { key: 'origemPedido', label: 'Origem Pedido',
      opts: ['Projetta Portas Exclusivas LTDA', 'Weiku do Brasil'] },
    { key: 'localizacaoPedido', label: 'Localização Pedido',
      opts: ['Nacional', 'Internacional'] },
    { key: 'liberacaoImediata', label: 'Liberação Imediata',
      opts: ['Não', 'Sim'] }
  ];

  var ORIENTACAO_T01 =
    'Esta tarefa consiste em: finalizar negociação respeitando tabela de ' +
    'descontos e forma de pagamento padrão. Antes de executar, verifique: ' +
    'para cliente novo por representante Weiku do Brasil, conferir se o ' +
    'representante está ativo e com contrato assinado; para cliente Projetta, ' +
    'verificar duplicidade de reserva; conferir forma de pagamento (boleto, ' +
    'Pix; cartão exige análise do financeiro; depósito em dinheiro não é aceito).';

  // pessoas do fluxo (login Projetta -> nome no Zeev)
  var PESSOAS = [
    { login: 'felipe.projetta', nome: 'Felipe (solicitante)' },
    { login: 'thays.projetta', nome: 'Thays Aguiar dos Santos', zeev: 'Thays Aguiar dos Santos' },
    { login: 'ruan.projetta', nome: 'Ruan Lucas Morigi', zeev: 'Ruan Lucas Morigi' },
    { login: 'cds.projetta', nome: 'AUXILIAR CDS', zeev: 'AUXILIAR CDS' },
    { login: 'eric.projetta', nome: 'Eric Silva', zeev: 'Eric Silva' }
  ];

  var ui = { tela: 'executar', verComo: null, formAberto: false, dados: {}, tarefaAberta: null };

  function motor() { return window.Workflow && window.Workflow.motor; }

  function garantirMapa() {
    var m = motor(); if (!m) return;
    var atual = m.getMapaUsuarios();
    PESSOAS.forEach(function (p) {
      if (p.zeev && atual[p.login] !== p.zeev) m.setMapaUsuario(p.login, p.zeev);
    });
  }

  function loginAtual() {
    if (ui.verComo) return ui.verComo;
    var s = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
    return s ? s.username : 'felipe.projetta';
  }
  function nomeDe(login) {
    var p = PESSOAS.find(function (x) { return x.login === login; });
    return p ? p.nome : login;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function dtBR(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('pt-BR'); } catch (e) { return iso; }
  }

  /* ── render raiz ───────────────────────────────────────────────── */

  function render(container) {
    injectCss();
    var m = motor();
    if (!m) {
      container.innerHTML = '<div class="info-banner">Motor do workflow nao carregou.</div>';
      return;
    }
    garantirMapa();

    var h = '<div class="wt-subabas">' +
      subaba('iniciar', 'Iniciar', 'Iniciar aplicativos') +
      subaba('executar', 'Executar tarefas', 'A fila de cada pessoa') +
      subaba('acompanhar', 'Acompanhar', 'Solicitacoes em andamento') +
      '</div>';
    h += '<div class="wt-vercomo"><label>Ver como:</label> <select id="wt-verComo">' +
      PESSOAS.map(function (p) {
        return '<option value="' + esc(p.login) + '"' +
          (p.login === loginAtual() ? ' selected' : '') + '>' + esc(p.nome) + '</option>';
      }).join('') + '</select></div>';
    h += '<div id="wt-corpo"></div>';
    container.innerHTML = h;

    container.querySelectorAll('.wt-subaba').forEach(function (b) {
      b.addEventListener('click', function () {
        ui.tela = b.getAttribute('data-t'); ui.formAberto = false; ui.tarefaAberta = null;
        render(container);
      });
    });
    container.querySelector('#wt-verComo').addEventListener('change', function (e) {
      ui.verComo = e.target.value; render(container);
    });

    renderCorpo(container);
  }

  function subaba(id, label, dica) {
    return '<button class="wt-subaba' + (ui.tela === id ? ' ativa' : '') +
      '" data-t="' + id + '" title="' + esc(dica) + '">' + esc(label) + '</button>';
  }

  function renderCorpo(container) {
    var corpo = container.querySelector('#wt-corpo');
    if (ui.tela === 'iniciar') telaIniciar(corpo, container);
    else if (ui.tela === 'acompanhar') telaAcompanhar(corpo);
    else telaExecutar(corpo, container);
  }

  /* ── TELA 1: INICIAR (espelho de "Iniciar aplicativos") ────────── */

  function telaIniciar(corpo, container) {
    var m = motor();
    var trilha = window.Storage.scope('zeev').get('trilha_teste_t44');
    if (!ui.formAberto) {
      corpo.innerHTML =
        '<div class="wt-app-card">' +
        '<div class="wt-app-nome">Processo de Contrato — Projetta 2026</div>' +
        '<div class="wt-app-desc">Fecha o pedido e inicia o fluxo completo ' +
        '(T01 Pedir dados cliente → … → T44 Análise de liberação).</div>' +
        '<button class="wt-btn wt-btn-primary" id="wt-solicitar">Solicitar →</button>' +
        '</div>';
      corpo.querySelector('#wt-solicitar').addEventListener('click', function () {
        ui.formAberto = true; ui.dados = {}; renderCorpo(container);
      });
      return;
    }
    // formulario da abertura (T01)
    var h = '<div class="wt-form">';
    h += '<div class="wt-form-titulo">Iniciar Processo de Contrato</div>';
    h += '<div class="wt-orient">' + esc(ORIENTACAO_T01) + '</div>';
    h += '<div class="wt-form-grupo">Dados da Solicitação</div>';
    CAMPOS_ABERTURA.forEach(function (c) {
      h += '<div class="wt-campo"><label>' + esc(c.label) +
        ' <b class="wt-req">*</b></label><select data-k="' + c.key + '">' +
        '<option value="">Selecione</option>' +
        c.opts.map(function (o) {
          return '<option' + (ui.dados[c.key] === o ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select></div>';
    });
    h += '<div class="wt-form-acoes">' +
      '<button class="wt-btn" id="wt-cancelar">Cancelar</button>' +
      '<button class="wt-btn wt-btn-ok" id="wt-enviar">Enviar solicitação →</button>' +
      '</div></div>';
    corpo.innerHTML = h;

    corpo.querySelectorAll('select[data-k]').forEach(function (s) {
      s.addEventListener('change', function () { ui.dados[s.getAttribute('data-k')] = s.value; });
    });
    corpo.querySelector('#wt-cancelar').addEventListener('click', function () {
      ui.formAberto = false; renderCorpo(container);
    });
    corpo.querySelector('#wt-enviar').addEventListener('click', function () {
      var faltando = CAMPOS_ABERTURA.filter(function (c) { return !ui.dados[c.key]; });
      if (faltando.length) {
        alert('Preencha: ' + faltando.map(function (c) { return c.label; }).join(', '));
        return;
      }
      try {
        var sess = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
        var r = m.abrirTrilha(ui.dados, sess ? sess.username : loginAtual(),
          sess ? sess.name : nomeDe(loginAtual()));
        ui.formAberto = false; ui.tela = 'acompanhar';
        render(container);
        setTimeout(function () {
          alert('Solicitação ' + r.solicitacao.protocolo + ' aberta! ' +
            'A tarefa "' + r.tarefa.nome + '" foi para ' + r.tarefa.responsavelNome + '.');
        }, 50);
      } catch (e) { alert('Erro ao abrir: ' + e.message); }
    });
  }

  /* ── TELA 2: EXECUTAR TAREFAS (espelho de "Executar tarefas") ──── */

  function telaExecutar(corpo, container) {
    var m = motor();
    var login = loginAtual();
    if (ui.tarefaAberta) { painelTarefa(corpo, container, ui.tarefaAberta); return; }
    var minhas = m.tarefasDe(login);
    var semDono = m.tarefasSemDono();

    var h = '';
    // barra "% dentro do prazo" (aqui todas no prazo — sem SLA real ainda)
    h += '<div class="wt-sla"><div class="wt-sla-num">100%</div>' +
      '<div class="wt-sla-bar"><div class="wt-sla-fill"></div></div>' +
      '<div class="wt-sla-lbl">tarefas dentro do prazo</div></div>';
    h += '<div class="wt-contador">' + minhas.length + ' / ' + minhas.length +
      ' tarefas pendentes de ' + esc(nomeDe(login)) + '</div>';

    if (!minhas.length) {
      h += '<div class="wt-vazio">Nenhuma tarefa na fila. Abra uma solicitação em ' +
        '"Iniciar" ou troque "Ver como".</div>';
    } else {
      h += tabelaTarefas(minhas);
    }
    if (semDono.length) {
      h += '<div class="wt-alerta-h">⚠ ' + semDono.length +
        ' tarefa(s) sem responsável mapeado (crie o login da pessoa)</div>';
      h += tabelaTarefas(semDono);
    }
    corpo.innerHTML = h;

    corpo.querySelectorAll('[data-abrir]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        ui.tarefaAberta = tr.getAttribute('data-abrir'); renderCorpo(container);
      });
    });
  }

  function tabelaTarefas(lista) {
    var m = motor();
    var h = '<table class="wt-tabela"><thead><tr>' +
      '<th>#</th><th>Tarefa</th><th>Responsável</th><th>Expira em</th><th>Solicitante</th>' +
      '</tr></thead><tbody>';
    lista.forEach(function (t, i) {
      var sol = m.solicitacao(t.solicitacaoId) || {};
      h += '<tr class="wt-linha" data-abrir="' + esc(t.id) + '">' +
        '<td>' + (i + 1) + '</td>' +
        '<td><b>' + esc(t.codTarefa || '') + '</b> ' + esc(t.nome) + '</td>' +
        '<td>' + esc(t.responsavelNome) + '</td>' +
        '<td>' + prazoTxt(t) + '</td>' +
        '<td>' + esc(sol.criadoPorNome || sol.criadoPor || '—') + '</td>' +
        '</tr>';
    });
    return h + '</tbody></table>';
  }

  // SLA ainda nao configurado por etapa -> mostra "no prazo"
  function prazoTxt() { return '<span class="wt-noprazo">no prazo</span>'; }

  /* painel de execucao de uma tarefa */
  function painelTarefa(corpo, container, tid) {
    var m = motor();
    var t = m.tarefas().find(function (x) { return x.id === tid; });
    if (!t) { ui.tarefaAberta = null; renderCorpo(container); return; }
    var sol = m.solicitacao(t.solicitacaoId) || {};
    var h = '<button class="wt-voltar" id="wt-voltar">← voltar para a fila</button>';
    h += '<div class="wt-painel">';
    h += '<div class="wt-painel-titulo">' + esc(t.codTarefa || '') + ' — ' + esc(t.nome) + '</div>';
    h += '<div class="wt-painel-meta">Solicitação <b>' + esc(sol.protocolo || '') +
      '</b> · responsável: ' + esc(t.responsavelNome) +
      ' · aberta ' + dtBR(t.criadoEm) + '</div>';
    // dados da solicitacao
    h += '<div class="wt-dados"><div class="wt-dados-h">Dados da solicitação</div>';
    var dd = sol.dados || {};
    var linhas = CAMPOS_ABERTURA.map(function (c) {
      return dd[c.key] ? ('<div><span>' + esc(c.label) + ':</span> ' + esc(dd[c.key]) + '</div>') : '';
    }).filter(Boolean).join('');
    h += (linhas || '<div class="wt-mudo">(sem dados preenchidos)</div>') + '</div>';
    h += '<button class="wt-btn wt-btn-ok wt-concluir" id="wt-concluir">Concluir tarefa ✓</button>';
    h += '</div>';
    corpo.innerHTML = h;

    corpo.querySelector('#wt-voltar').addEventListener('click', function () {
      ui.tarefaAberta = null; renderCorpo(container);
    });
    corpo.querySelector('#wt-concluir').addEventListener('click', function () {
      try {
        var r = m.concluirTrilha(t.id, loginAtual());
        ui.tarefaAberta = null; renderCorpo(container);
        if (r && r.novaTarefa) {
          setTimeout(function () {
            alert('Concluída. Próxima: "' + r.novaTarefa.nome + '" → ' + r.novaTarefa.responsavelNome);
          }, 50);
        } else if (r && r.fim) {
          setTimeout(function () { alert('Fim da trilha — solicitação concluída (chegou na T44).'); }, 50);
        }
      } catch (e) { alert('Erro: ' + e.message); }
    });
  }

  /* ── TELA 3: ACOMPANHAR (espelho de "Acompanhar solicitacoes") ─── */

  function telaAcompanhar(corpo) {
    var m = motor();
    var solics = m.solicitacoes();
    if (!solics.length) {
      corpo.innerHTML = '<div class="wt-vazio">Nenhuma solicitação ainda. ' +
        'Abra uma em "Iniciar".</div>';
      return;
    }
    var h = '<table class="wt-tabela"><thead><tr>' +
      '<th>#</th><th>Solicitação</th><th>Status</th><th>Atividade atual</th><th>Progresso</th>' +
      '</tr></thead><tbody>';
    solics.slice().reverse().forEach(function (s) {
      var ts = m.tarefas().filter(function (t) { return t.solicitacaoId === s.id; });
      var feitas = ts.filter(function (t) { return t.status === 'concluida'; }).length;
      var aberta = ts.find(function (t) { return t.status === 'aberta'; });
      var pct = Math.round((feitas / 19) * 100);
      var cor = s.status === 'concluida' ? '#16a34a' : '#2563eb';
      h += '<tr>' +
        '<td>' + esc(s.protocolo) + '</td>' +
        '<td>' + esc(s.criadoPorNome || s.criadoPor) + '<br><small class="wt-mudo">' +
          dtBR(s.criadoEm) + '</small></td>' +
        '<td><span style="color:' + cor + '">' + esc(s.status) + '</span></td>' +
        '<td>' + (aberta ? ('<b>' + esc(aberta.codTarefa) + '</b> ' + esc(aberta.nome) +
          '<br><small class="wt-mudo">com ' + esc(aberta.responsavelNome) + '</small>')
          : '<span class="wt-mudo">— concluída —</span>') + '</td>' +
        '<td><div class="wt-prog"><div class="wt-prog-bar" style="width:' + pct +
          '%;background:' + cor + '"></div></div><small class="wt-mudo">' + feitas +
          '/19</small></td>' +
        '</tr>';
    });
    corpo.innerHTML = h + '</tbody></table>';
  }

  /* ── css ───────────────────────────────────────────────────────── */

  var _css = false;
  function injectCss() {
    if (_css) return; _css = true;
    var s = document.createElement('style');
    s.textContent =
      '.wt-subabas{display:flex;gap:6px;margin-bottom:10px}' +
      '.wt-subaba{border:1px solid #ddd;background:#fff;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px}' +
      '.wt-subaba.ativa{background:#1a2b4a;color:#fff;border-color:#1a2b4a;font-weight:600}' +
      '.wt-vercomo{margin-bottom:14px;font-size:12px;color:#555}' +
      '.wt-vercomo select{padding:5px 8px;border:1px solid #ddd;border-radius:6px;margin-left:4px}' +
      '.wt-btn{border:1px solid #ccc;background:#fff;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px}' +
      '.wt-btn-primary{background:#1a2b4a;color:#fff;border-color:#1a2b4a;font-weight:600}' +
      '.wt-btn-ok{background:#16a34a;color:#fff;border-color:#16a34a}' +
      '.wt-app-card{background:#fff;border:1px solid #e3e3e8;border-radius:10px;padding:18px;max-width:520px}' +
      '.wt-app-nome{font-weight:700;font-size:15px;margin-bottom:6px}' +
      '.wt-app-desc{color:#666;font-size:13px;margin-bottom:14px}' +
      '.wt-form{background:#fff;border:1px solid #e3e3e8;border-radius:10px;padding:18px;max-width:680px}' +
      '.wt-form-titulo{font-weight:700;font-size:16px;margin-bottom:10px}' +
      '.wt-orient{background:#f7f8fa;border-left:3px solid #1a2b4a;padding:10px 12px;font-size:12.5px;color:#555;margin-bottom:16px;border-radius:0 6px 6px 0}' +
      '.wt-form-grupo{font-weight:600;font-size:13px;color:#1a2b4a;margin:10px 0 8px}' +
      '.wt-campo{display:flex;align-items:center;gap:10px;margin-bottom:10px}' +
      '.wt-campo label{width:170px;text-align:right;font-size:13px;color:#444}' +
      '.wt-campo select{flex:1;padding:7px 10px;border:1px solid #ddd;border-radius:6px}' +
      '.wt-req{color:#b91c1c}' +
      '.wt-form-acoes{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}' +
      '.wt-sla{display:flex;align-items:center;gap:10px;margin-bottom:8px}' +
      '.wt-sla-num{color:#16a34a;font-weight:700;font-size:15px}' +
      '.wt-sla-bar{flex:1;background:#eee;border-radius:6px;height:8px;overflow:hidden}' +
      '.wt-sla-fill{width:100%;height:8px;background:#16a34a}' +
      '.wt-sla-lbl{font-size:11px;color:#888}' +
      '.wt-contador{font-size:12px;color:#666;margin-bottom:12px}' +
      '.wt-tabela{width:100%;border-collapse:collapse;font-size:13px}' +
      '.wt-tabela th{text-align:left;padding:8px 10px;border-bottom:2px solid #eee;color:#888;font-size:11px;text-transform:uppercase}' +
      '.wt-tabela td{padding:10px;border-bottom:1px solid #f0f0f0;vertical-align:top}' +
      '.wt-linha{cursor:pointer}.wt-linha:hover{background:#f7f9ff}' +
      '.wt-noprazo{color:#16a34a;font-size:12px}' +
      '.wt-vazio{color:#999;font-size:13px;padding:16px 0}' +
      '.wt-alerta-h{color:#b45309;font-size:13px;margin:16px 0 8px;font-weight:600}' +
      '.wt-voltar{background:none;border:none;color:#2563eb;cursor:pointer;font-size:13px;padding:6px 0;margin-bottom:8px}' +
      '.wt-painel{background:#fff;border:1px solid #e3e3e8;border-radius:10px;padding:18px;max-width:640px}' +
      '.wt-painel-titulo{font-weight:700;font-size:15px}' +
      '.wt-painel-meta{font-size:12px;color:#777;margin:6px 0 14px}' +
      '.wt-dados{background:#f7f8fa;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px}' +
      '.wt-dados-h{font-weight:600;margin-bottom:8px}' +
      '.wt-dados div span{color:#888;display:inline-block;min-width:130px}' +
      '.wt-concluir{width:100%}' +
      '.wt-mudo{color:#999}' +
      '.wt-prog{background:#eee;border-radius:6px;height:8px;overflow:hidden;width:120px;display:inline-block;vertical-align:middle}' +
      '.wt-prog-bar{height:8px;border-radius:6px}';
    document.head.appendChild(s);
  }

  window.Workflow = window.Workflow || {};
  window.Workflow.uiTarefas = { render: render };
})();
