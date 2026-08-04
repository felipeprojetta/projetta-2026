/* 63-workflow-ui.js — UI de EXECUCAO do Workflow (fila individual)

   Felipe s43: "fila real com painel individual" (Ruan/Thays) + "abrir
   solicitacao cria as tarefas e elas andam sozinhas" + teste T01->T44.

   Este modulo adiciona ao menu Workflow a aba "Tarefas" (execucao), ao
   lado das visoes de leitura (Etapas/Decisoes/Formulario do 61). Aqui:
     - Botao "Abrir solicitacao (teste T01→T44)" -> motor.abrirTrilha
     - "Ver a fila como": seletor de pessoa (o Projetta so' tem 3 logins
       hoje — felipe/thays/paula — entao pra testar Ruan/CDS/Eric o
       seletor simula "quem esta olhando"). Guarda so' na sessao (RAM).
     - Fila do responsavel escolhido: cards de tarefa abertas
     - Painel da tarefa: dados da solicitacao + botao "Concluir" que
       ANDA a trilha (cria a proxima e some da fila atual).

   Le/escreve via Workflow.motor (scope workflow no Supabase). Nao toca
   modulo existente. Depende de 62-workflow-motor.js.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // pessoas do fluxo (nome Zeev -> login sugerido no Projetta).
  // Felipe: hoje so' existem felipe/thays/paula. Os demais sao "virtuais"
  // so' pra teste da fila — quando os logins reais forem criados, o
  // mapa_usuarios do motor assume e isto vira so' fallback.
  var PESSOAS_TESTE = [
    { login: 'felipe.projetta', nome: 'Felipe (solicitante)' },
    { login: 'thays.projetta', nome: 'Thays Aguiar dos Santos', zeev: 'Thays Aguiar dos Santos' },
    { login: 'ruan.projetta', nome: 'Ruan Lucas Morigi', zeev: 'Ruan Lucas Morigi' },
    { login: 'cds.projetta', nome: 'AUXILIAR CDS', zeev: 'AUXILIAR CDS' },
    { login: 'eric.projetta', nome: 'Eric Silva', zeev: 'Eric Silva' }
  ];

  var _verComo = null; // login que estou "olhando"; null = usuario logado

  function motor() { return window.Workflow && window.Workflow.motor; }

  // garante que o mapa usuario->Zeev de teste esteja aplicado (idempotente)
  function garantirMapa() {
    var m = motor(); if (!m) return;
    var atual = m.getMapaUsuarios();
    PESSOAS_TESTE.forEach(function (p) {
      if (p.zeev && atual[p.login] !== p.zeev) m.setMapaUsuario(p.login, p.zeev);
    });
  }

  function loginAtual() {
    if (_verComo) return _verComo;
    var s = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
    return s ? s.username : 'felipe.projetta';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function dtBR(iso) {
    if (!iso) return '';
    try { var d = new Date(iso); return d.toLocaleString('pt-BR'); } catch (e) { return iso; }
  }

  /* ── render principal da aba Tarefas ───────────────────────────── */

  function render(container) {
    injectCss();
    var m = motor();
    if (!m) {
      container.innerHTML = '<div class="info-banner">Motor do workflow ' +
        'nao carregou (62-workflow-motor.js).</div>';
      return;
    }
    garantirMapa();

    var login = loginAtual();
    var minhas = m.tarefasDe(login);
    var semDono = m.tarefasSemDono();
    var solics = m.solicitacoes();
    var emAndamento = solics.filter(function (s) { return s.status === 'em_andamento'; }).length;

    var h = '';
    h += '<div class="wt-top">';
    h += '<button class="wt-btn wt-btn-primary" id="wt-abrir">+ Abrir solicitacao (teste T01→T44)</button>';
    h += '<div class="wt-vercomo"><label>Ver a fila como:</label> <select id="wt-verComo">' +
      PESSOAS_TESTE.map(function (p) {
        return '<option value="' + esc(p.login) + '"' +
          (p.login === login ? ' selected' : '') + '>' + esc(p.nome) + '</option>';
      }).join('') + '</select></div>';
    h += '<div class="wt-stats">' + solics.length + ' solicitacoes · ' +
      emAndamento + ' em andamento</div>';
    h += '</div>';

    // fila do usuario escolhido
    h += '<h3 class="wt-h">Minhas Tarefas — ' + esc(nomeDe(login)) +
      ' <span class="wt-badge">' + minhas.length + '</span></h3>';
    if (!minhas.length) {
      h += '<div class="wt-vazio">Nenhuma tarefa na fila. Abra uma solicitacao ' +
        'ou troque "ver a fila como".</div>';
    } else {
      h += '<div class="wt-fila">' + minhas.map(cardTarefa).join('') + '</div>';
    }

    // tarefas sem dono (responsavel nao mapeado a um login)
    if (semDono.length) {
      h += '<h3 class="wt-h wt-h-alerta">Sem responsavel mapeado ' +
        '<span class="wt-badge">' + semDono.length + '</span></h3>';
      h += '<div class="wt-fila">' + semDono.map(cardTarefa).join('') + '</div>';
    }

    // solicitacoes em andamento (progresso)
    if (solics.length) {
      h += '<h3 class="wt-h">Solicitacoes</h3><div class="wt-sols">' +
        solics.slice().reverse().map(cardSolic).join('') + '</div>';
    }

    container.innerHTML = h;
    ligarEventos(container);
  }

  function nomeDe(login) {
    var p = PESSOAS_TESTE.find(function (x) { return x.login === login; });
    return p ? p.nome : login;
  }

  function cardTarefa(t) {
    return '<div class="wt-card" data-tid="' + esc(t.id) + '">' +
      '<div class="wt-card-cod">' + esc(t.codTarefa || '') + '</div>' +
      '<div class="wt-card-nome">' + esc(t.nome) + '</div>' +
      '<div class="wt-card-meta">resp: ' + esc(t.responsavelNome) +
      ' · aberta ' + dtBR(t.criadoEm) + '</div>' +
      '<button class="wt-btn wt-btn-ok" data-concluir="' + esc(t.id) + '">Concluir tarefa ✓</button>' +
      '</div>';
  }

  function cardSolic(s) {
    var m = motor();
    var ts = m.tarefas().filter(function (t) { return t.solicitacaoId === s.id; });
    var feitas = ts.filter(function (t) { return t.status === 'concluida'; }).length;
    var total = 19; // trilha T01→T44
    var pct = Math.round((feitas / total) * 100);
    var cor = s.status === 'concluida' ? '#16a34a' : '#2563eb';
    return '<div class="wt-sol">' +
      '<div class="wt-sol-top"><b>' + esc(s.protocolo) + '</b> · ' +
      esc(s.criadoPorNome || s.criadoPor) + ' · ' +
      '<span style="color:' + cor + '">' + esc(s.status) + '</span></div>' +
      '<div class="wt-prog"><div class="wt-prog-bar" style="width:' + pct +
      '%;background:' + cor + '"></div></div>' +
      '<div class="wt-sol-meta">' + feitas + '/' + total + ' etapas · ' +
      'ultima: ' + esc(ultimaTarefa(ts)) + '</div>' +
      '</div>';
  }

  function ultimaTarefa(ts) {
    var aberta = ts.find(function (t) { return t.status === 'aberta'; });
    if (aberta) return aberta.codTarefa + ' (' + aberta.responsavelNome + ')';
    var conc = ts.filter(function (t) { return t.status === 'concluida'; });
    return conc.length ? (conc[conc.length - 1].codTarefa + ' concluida') : '—';
  }

  /* ── eventos ───────────────────────────────────────────────────── */

  function ligarEventos(container) {
    var m = motor();
    var abrir = container.querySelector('#wt-abrir');
    if (abrir) abrir.addEventListener('click', function () {
      try {
        var sess = window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null;
        m.abrirTrilha({}, sess ? sess.username : loginAtual(), sess ? sess.name : nomeDe(loginAtual()));
        render(container);
      } catch (e) { alert('Erro ao abrir: ' + e.message); }
    });

    var verComo = container.querySelector('#wt-verComo');
    if (verComo) verComo.addEventListener('change', function () {
      _verComo = verComo.value; render(container);
    });

    container.querySelectorAll('[data-concluir]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tid = btn.getAttribute('data-concluir');
        try {
          var r = m.concluirTrilha(tid, loginAtual());
          render(container);
          if (r && r.novaTarefa) {
            // dica de pra quem foi
            console.log('[Workflow] ' + r.tarefaConcluida.codTarefa +
              ' concluida → ' + r.novaTarefa.codTarefa + ' para ' +
              r.novaTarefa.responsavelNome);
          }
        } catch (e) { alert('Erro ao concluir: ' + e.message); }
      });
    });
  }

  /* ── css ───────────────────────────────────────────────────────── */

  var _css = false;
  function injectCss() {
    if (_css) return; _css = true;
    var s = document.createElement('style');
    s.textContent =
      '.wt-top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:14px}' +
      '.wt-btn{border:1px solid #ccc;background:#fff;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px}' +
      '.wt-btn-primary{background:#1a2b4a;color:#fff;border-color:#1a2b4a;font-weight:600}' +
      '.wt-btn-ok{background:#16a34a;color:#fff;border-color:#16a34a;margin-top:8px}' +
      '.wt-vercomo label{font-size:12px;color:#555;margin-right:4px}' +
      '.wt-vercomo select{padding:6px 8px;border:1px solid #ddd;border-radius:6px}' +
      '.wt-stats{font-size:12px;color:#777;margin-left:auto}' +
      '.wt-h{font-size:14px;margin:16px 0 8px;display:flex;align-items:center;gap:8px}' +
      '.wt-h-alerta{color:#b45309}' +
      '.wt-badge{background:#eef2ff;color:#1a2b4a;border-radius:10px;padding:1px 9px;font-size:12px}' +
      '.wt-vazio{color:#999;font-size:13px;padding:10px 0}' +
      '.wt-fila{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}' +
      '.wt-card{background:#fff;border:1px solid #e3e3e8;border-radius:8px;padding:12px}' +
      '.wt-card-cod{font-size:11px;font-weight:700;color:#2563eb}' +
      '.wt-card-nome{font-weight:600;font-size:13px;margin:2px 0}' +
      '.wt-card-meta{font-size:11px;color:#888}' +
      '.wt-sols{display:flex;flex-direction:column;gap:8px}' +
      '.wt-sol{background:#fafafa;border:1px solid #eee;border-radius:8px;padding:10px 12px}' +
      '.wt-sol-top{font-size:13px;margin-bottom:6px}' +
      '.wt-prog{background:#eee;border-radius:6px;height:8px;overflow:hidden}' +
      '.wt-prog-bar{height:8px;border-radius:6px;transition:width .3s}' +
      '.wt-sol-meta{font-size:11px;color:#888;margin-top:5px}';
    document.head.appendChild(s);
  }

  window.Workflow = window.Workflow || {};
  window.Workflow.uiTarefas = { render: render };
})();
