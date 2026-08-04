/* 64-workflow-editor.js — EDITOR do fluxo (BPMN editavel)

   Felipe s43: a aba Diagrama estava "somente leitura". Pedido: editor
   BPMN COMPLETO que salva no fluxo real e o motor passa a usar. Ordem
   priorizada pelo Felipe: (1) editar tarefa no painel [ESTE COMMIT],
   (2) context-pad inserir tarefa/gateway/desvio [ESTE COMMIT, basico],
   (3) arrastar/religar setas [proximos].

   FONTE DA VERDADE: v7.kv_store scope zeev key 'geo_128' = { nodes:[{id,
   t,n,x,y,w,h}], flows:[{s,t,n}] } — o mesmo que o diagrama do 61
   desenha e que o motor (62) agora le (com fallback flow_128). Salvar
   aqui = vale pro desenho E pro motor (que chama recarregarGrafo()).

   ESTE MODULO expoe window.WorkflowEditor com:
     - editavel: flag (liga o modo edicao no diagrama do 61)
     - painelEdicao(id): HTML do painel de edicao de um no'
     - salvarNo(id, patch): grava alteracoes de um no' no geo_128
     - inserirTarefa(depoisDeId) / inserirGateway(depoisDeId, tipo)
     - deletarNo(id) / conectar(origemId, destinoId, rotulo)
     - persistir(): grava geo_128 no Storage + recarrega o motor

   Nao toca modulo existente alem de ser chamado pelo 61 (renderDiagrama)
   quando WorkflowEditor.editavel = true.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SCOPE = 'zeev';

  function geoGet() {
    try {
      return window.Storage.scope(SCOPE).get('geo_128') ||
        window.Storage.scope(SCOPE).get('flow_128') || null;
    } catch (e) { return null; }
  }
  function geoSet(geo) {
    window.Storage.scope(SCOPE).set('geo_128', geo);
    // avisa o motor pra recarregar o grafo da proxima execucao
    if (window.Workflow && window.Workflow.motor &&
        window.Workflow.motor.recarregarGrafo) {
      try { window.Workflow.motor.recarregarGrafo(); } catch (e) {}
    }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function uid(pref) {
    return (pref || 'Node') + '_' +
      Math.random().toString(36).slice(2, 8);
  }

  // pessoas conhecidas (pra dropdown de responsavel)
  function pessoas() {
    try {
      var p = window.Storage.scope(SCOPE).get('pessoas');
      return (p && p.lista) ? p.lista.map(function (x) { return x.nome; }) : [];
    } catch (e) { return []; }
  }

  /* ── painel de edicao de um no' ────────────────────────────────── */

  function painelEdicao(id) {
    var geo = geoGet(); if (!geo) return '<div class="wf-mudo">Sem fluxo.</div>';
    var n = geo.nodes.find(function (x) { return x.id === id; });
    if (!n) return '<div class="wf-mudo">No nao encontrado.</div>';
    var ehTarefa = n.t === 'userTask' || n.t === 'task';
    var ehGw = /Gateway/.test(n.t);

    var det = detalheDoNo(id) || {};
    var listaP = pessoas();

    var h = '<div class="wfe-painel">';
    h += '<div class="wfe-p-tipo">' + esc(rotuloTipo(n.t)) + '</div>';
    // nome
    h += '<label class="wfe-l">Nome</label>' +
      '<input class="wfe-in" id="wfe-nome" value="' + esc(n.n || '') + '">';

    if (ehTarefa) {
      // responsavel
      h += '<label class="wfe-l">Responsável</label>' +
        '<input class="wfe-in" id="wfe-resp" list="wfe-pessoas" value="' +
        esc(det.responsavel || '') + '" placeholder="pessoa, função ou Solicitante">' +
        '<datalist id="wfe-pessoas">' +
        ['Solicitante'].concat(listaP).map(function (p) {
          return '<option value="' + esc(p) + '">';
        }).join('') + '</datalist>';
      // tipo aprovacao/instrucao (define botoes)
      h += '<label class="wfe-l">Tipo</label>' +
        '<select class="wfe-in" id="wfe-tipo">' +
        '<option value="instrucao"' + (det.tipoTarefa === 'aprovacao' ? '' : ' selected') +
        '>Instrução (Concluído / Não concluído)</option>' +
        '<option value="aprovacao"' + (det.tipoTarefa === 'aprovacao' ? ' selected' : '') +
        '>Aprovação (Aprovar / Rejeitar)</option></select>';
      // prazo (SLA)
      var prazo = '';
      try {
        var pr = window.Workflow.motor.getPrazos();
        var cod = (n.n || '').match(/^T[\d.]+/);
        prazo = cod && pr[cod[0]] != null ? pr[cod[0]] : '';
      } catch (e) {}
      h += '<label class="wfe-l">Prazo (horas)</label>' +
        '<input class="wfe-in" id="wfe-prazo" type="number" min="0" value="' +
        esc(prazo) + '" placeholder="ex: 8 (vazio = padrão 24h)">';
    }

    h += '<div class="wfe-acoes">' +
      '<button class="wfe-btn wfe-btn-ok" id="wfe-salvar">Salvar</button>' +
      '<button class="wfe-btn wfe-btn-del" id="wfe-del">Excluir</button>' +
      '</div>';

    // context-pad textual (inserir depois deste no')
    h += '<div class="wfe-pad"><div class="wfe-pad-h">Inserir depois desta etapa:</div>' +
      '<button class="wfe-btn" data-ins="tarefa">+ Tarefa</button> ' +
      '<button class="wfe-btn" data-ins="exclusiveGateway">+ Desvio (×)</button> ' +
      '<button class="wfe-btn" data-ins="parallelGateway">+ Paralelo (+)</button>' +
      '</div>';
    h += '</div>';
    return h;
  }

  function rotuloTipo(t) {
    if (t === 'userTask' || t === 'task') return 'Tarefa humana';
    if (t === 'exclusiveGateway') return 'Desvio exclusivo (×)';
    if (t === 'parallelGateway') return 'Gateway paralelo (+)';
    if (t === 'inclusiveGateway') return 'Gateway inclusivo';
    if (t === 'startEvent') return 'Início';
    if (t === 'endEvent') return 'Fim';
    return t;
  }

  function detalheDoNo(id) {
    try {
      var r = window.Storage.scope(SCOPE).get('responsaveis_128');
      return (r && r.detalhes && r.detalhes[id]) || {};
    } catch (e) { return {}; }
  }
  function salvarDetalheNo(id, patch) {
    var r = window.Storage.scope(SCOPE).get('responsaveis_128') || { detalhes: {} };
    r.detalhes = r.detalhes || {};
    r.detalhes[id] = Object.assign({}, r.detalhes[id] || {}, patch);
    window.Storage.scope(SCOPE).set('responsaveis_128', r);
  }

  /* ── operacoes de edicao ───────────────────────────────────────── */

  function salvarNo(id, patch) {
    var geo = geoGet(); if (!geo) return;
    var n = geo.nodes.find(function (x) { return x.id === id; });
    if (!n) return;
    if (patch.nome != null) n.n = patch.nome;
    geoSet(geo);
    // detalhes (responsavel, tipo) vao no responsaveis_128
    var det = {};
    if (patch.responsavel != null) det.responsavel = patch.responsavel;
    if (patch.tipoTarefa != null) det.tipoTarefa = patch.tipoTarefa;
    if (Object.keys(det).length) salvarDetalheNo(id, det);
    // prazo vai no motor
    if (patch.prazoHoras !== undefined && window.Workflow && window.Workflow.motor) {
      var cod = (n.n || '').match(/^T[\d.]+/);
      if (cod) window.Workflow.motor.setPrazo(cod[0], patch.prazoHoras);
    }
    // atualiza tambem responsaveis_iniciais (o motor usa isso pro roteamento)
    if (patch.responsavel != null) atualizarRespInicial(id, n.n, patch.responsavel);
  }

  function atualizarRespInicial(id, nome, responsavel) {
    var tab = window.Storage.scope(SCOPE).get('responsaveis_iniciais') || { tarefas: [] };
    tab.tarefas = tab.tarefas || [];
    var achou = tab.tarefas.find(function (t) { return t.id === id; });
    if (achou) { achou.resp = [responsavel]; achou.nome = nome; }
    else tab.tarefas.push({ id: id, nome: nome, resp: [responsavel] });
    window.Storage.scope(SCOPE).set('responsaveis_iniciais', tab);
  }

  // insere um novo no' logo depois de 'depoisDeId', reconectando as setas:
  // depoisDeId -> [saidas antigas]  vira  depoisDeId -> novo -> [saidas]
  function inserirNo(depoisDeId, tipo) {
    var geo = geoGet(); if (!geo) return null;
    var ref = geo.nodes.find(function (x) { return x.id === depoisDeId; });
    if (!ref) return null;
    var novo = {
      id: uid(tipo === 'userTask' ? 'Activity' : 'Gateway'),
      t: tipo,
      n: tipo === 'userTask' ? 'Nova tarefa' : '',
      x: (ref.x || 0) + (ref.w || 100) + 60,
      y: (ref.y || 0),
      w: /Gateway/.test(tipo) ? 50 : 100,
      h: /Gateway/.test(tipo) ? 50 : 80
    };
    geo.nodes.push(novo);
    // reconecta: as saidas de ref passam a sair do novo; ref -> novo
    (geo.flows || []).forEach(function (f) {
      if (f.s === depoisDeId) f.s = novo.id;
    });
    geo.flows.push({ s: depoisDeId, t: novo.id, n: '' });
    geoSet(geo);
    return novo.id;
  }

  function deletarNo(id) {
    var geo = geoGet(); if (!geo) return;
    var n = geo.nodes.find(function (x) { return x.id === id; });
    if (!n) return;
    if (n.t === 'startEvent') { alert('Não dá pra excluir o início.'); return; }
    // costura: liga as entradas do no' direto nas suas saidas
    var entradas = geo.flows.filter(function (f) { return f.t === id; });
    var saidas = geo.flows.filter(function (f) { return f.s === id; });
    geo.flows = geo.flows.filter(function (f) { return f.s !== id && f.t !== id; });
    entradas.forEach(function (e) {
      saidas.forEach(function (s) {
        geo.flows.push({ s: e.s, t: s.t, n: e.n || s.n || '' });
      });
    });
    geo.nodes = geo.nodes.filter(function (x) { return x.id !== id; });
    geoSet(geo);
  }

  function conectar(origemId, destinoId, rotulo) {
    var geo = geoGet(); if (!geo) return;
    geo.flows.push({ s: origemId, t: destinoId, n: rotulo || '' });
    geoSet(geo);
  }

  function moverNo(id, x, y) {
    var geo = geoGet(); if (!geo) return;
    var n = geo.nodes.find(function (x2) { return x2.id === id; });
    if (n) { n.x = x; n.y = y; geoSet(geo); }
  }

  window.WorkflowEditor = {
    editavel: false,
    painelEdicao: painelEdicao,
    salvarNo: salvarNo,
    inserirNo: inserirNo,
    deletarNo: deletarNo,
    conectar: conectar,
    moverNo: moverNo,
    _geoGet: geoGet
  };
})();
