/* 62-workflow-motor.js — MOTOR do Workflow (instancias reais)

   Felipe sessao 43 (04/08/2026): "abrir solicitacao cria as tarefas e
   elas andam sozinhas" + "fila real com painel individual" (Minhas
   Tarefas do Ruan e da Thays).

   ARQUITETURA (segue a regra s37: Supabase e' a fonte da verdade,
   navegador e' so' tela; scope de negocio NAO vai pro disco):
     - DEFINICAO do fluxo: v7.kv_store scope='zeev' key='flow_128'
       (nodes[], flows[]) — grafo de roteamento, ja' extraido do Zeev.
       + responsaveis_iniciais (quem responde cada tarefa) + pessoas.
     - INSTANCIAS: scope='workflow'
         key 'solicitacoes' = [ {id, numero, protocolo, dados{...},
                                 status, criadoPor, criadoEm, historico[]} ]
         key 'tarefas'      = [ {id, solicitacaoId, nodeId, nome, codTarefa,
                                 responsavelLogin, responsavelNome, status,
                                 criadoEm, concluidoEm, concluidoPor} ]
     - MAPA usuario Projetta -> pessoa Zeev: key 'mapa_usuarios'
       (login do sistema -> nome do responsavel no Zeev). Editavel na UI.

   MOTOR (Workflow.motor):
     - abrir(dados)      : cria solicitacao + 1a tarefa (T01 = Solicitante)
     - concluir(tarefaId): fecha a tarefa e ANDA o fluxo — segue os flows
       de saida do node, resolve gateways por condicao (campo do form),
       e cria as proximas tarefas com o responsavel correto.
     - Determinismo: last-write-wins; cada mutacao regrava a lista inteira
       no Storage (que ja' sincroniza pro Supabase). Sem merge.

   ESTE COMMIT (2): motor + estrutura de dados + resolvedor de rotas.
   A UI (Minhas Tarefas, abrir solicitacao, painel de execucao) fica em
   63-workflow-ui.js, no proximo commit, pra Felipe testar o motor
   isolado antes (via console: Workflow.motor.abrir({...})).

   NAO TOCA em nenhum modulo existente. So' le' 'zeev' e escreve
   'workflow'. Isolamento total.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SCOPE_DEF = 'zeev';       // definicao (so leitura)
  var SCOPE_INST = 'workflow';  // instancias (leitura/escrita)

  /* ── acesso a dados ────────────────────────────────────────────── */

  function defGet(key) {
    try { return window.Storage.scope(SCOPE_DEF).get(key) || null; }
    catch (e) { return null; }
  }
  function instGet(key, fallback) {
    try {
      var v = window.Storage.scope(SCOPE_INST).get(key);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function instSet(key, val) {
    window.Storage.scope(SCOPE_INST).set(key, val);
  }

  /* ── grafo do fluxo (a partir de flow_128) ─────────────────────── */

  var _grafo = null;
  function grafo() {
    if (_grafo) return _grafo;
    var flow = defGet('flow_128');
    if (!flow || !flow.nodes) return null;
    var porId = {}, saidas = {}, entradas = {};
    flow.nodes.forEach(function (n) { porId[n.id] = n; });
    (flow.flows || []).forEach(function (f) {
      (saidas[f.s] = saidas[f.s] || []).push(f);
      (entradas[f.t] = entradas[f.t] || []).push(f);
    });
    // start event
    var start = flow.nodes.find(function (n) { return n.t === 'startEvent'; });
    _grafo = { flow: flow, porId: porId, saidas: saidas, entradas: entradas, start: start };
    return _grafo;
  }

  // codigo Txx a partir do nome ("T44-Analise" -> "T44")
  function codDe(nome) {
    var m = (nome || '').match(/^T[\d.]+/);
    return m ? m[0] : null;
  }

  // responsavel (nome Zeev) de um node, pela tabela responsaveis_iniciais
  function respDoNode(node) {
    var tab = defGet('responsaveis_iniciais');
    if (!tab || !tab.tarefas) return null;
    // casa por id direto, senao por codigo Txx
    var achou = tab.tarefas.find(function (t) { return t.id === node.id; });
    if (!achou) {
      var cod = codDe(node.n);
      if (cod) achou = tab.tarefas.find(function (t) {
        return codDe(t.nome) === cod;
      });
    }
    if (!achou || !achou.resp || !achou.resp.length) return null;
    // ignora marcadores tipo "Manualmente"/"Solicitante" na escolha de pessoa
    var pessoa = achou.resp.find(function (r) {
      return !/^(Manualmente|Solicitante|Todas as pessoas)/i.test(r);
    });
    return { nome: pessoa || achou.resp[0], bruto: achou.resp };
  }

  // login do Projetta a partir do nome Zeev (via mapa_usuarios)
  function loginDoResponsavel(nomeZeev) {
    if (!nomeZeev) return null;
    var mapa = instGet('mapa_usuarios', {});
    // mapa: { 'thays.projetta': 'Thays Aguiar dos Santos', ... }
    var login = null;
    Object.keys(mapa).forEach(function (lg) {
      if (mapa[lg] === nomeZeev) login = lg;
    });
    return login; // pode ser null se ainda nao mapeado
  }

  /* ── resolvedor de rotas (gateways) ────────────────────────────── */

  // dado um node concluido e os dados da solicitacao, devolve a lista
  // de PROXIMOS nodes de tarefa/fim a instanciar.
  function proximosNodes(g, node, dados) {
    var saidas = g.saidas[node.id] || [];
    var alvos = [];
    saidas.forEach(function (f) {
      var destino = g.porId[f.t];
      if (!destino) return;
      // se a condicao do flow bate (ou nao ha' condicao), segue
      if (condicaoBate(f, dados)) {
        alvos = alvos.concat(expandirAteTarefa(g, destino, dados));
      }
    });
    return alvos;
  }

  // um flow so' "passa" se sua condicao (nome do flow) casar com os
  // dados da solicitacao. Ex: gateway "Origem Pedido" tem saidas
  // "Projetta Portas Exclusivas LTDA" e "Weiku do Brasil" — o flow que
  // bate com dados.origemPedido e' o escolhido. Sem condicao => passa.
  function condicaoBate(f, dados) {
    var cond = (f.n || '').trim();
    if (!cond) return true; // fluxo incondicional
    var alvo = cond.toLowerCase();
    var valores = Object.keys(dados || {}).map(function (k) {
      return String(dados[k] || '').trim().toLowerCase();
    });
    // 1) match EXATO primeiro (o correto para gateway exclusivo).
    //    Evita que "Nacional" case dentro de "Internacional".
    if (valores.some(function (v) { return v === alvo; })) return true;
    // 2) fallback tolerante SO' quando nao houve match exato em lugar
    //    nenhum: aceita conter, exigindo que a condicao seja "palavra
    //    inteira" no valor (delimitada por borda) para nao vazar prefixo.
    var reBorda = new RegExp('(^|[^a-z0-9\\u00c0-\\u017f])' +
      alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '([^a-z0-9\\u00c0-\\u017f]|$)', 'i');
    return valores.some(function (v) { return reBorda.test(v); });
  }

  // se o destino ja' e' tarefa, retorna ele; se e' gateway/evento
  // intermediario, atravessa ate' a proxima tarefa/fim (evita criar
  // "tarefa" pra gateway). Protege contra loop com visitados.
  function expandirAteTarefa(g, node, dados, visitados) {
    visitados = visitados || {};
    if (visitados[node.id]) return [];
    visitados[node.id] = true;
    if (node.t === 'userTask' || node.t === 'task' || node.t === 'endEvent') {
      return [node];
    }
    // gateway ou evento intermediario: segue as saidas que batem
    var out = [];
    (g.saidas[node.id] || []).forEach(function (f) {
      if (condicaoBate(f, dados)) {
        var d = g.porId[f.t];
        if (d) out = out.concat(expandirAteTarefa(g, d, dados, visitados));
      }
    });
    return out;
  }

  /* ── criacao de tarefas ────────────────────────────────────────── */

  function uid(pref) {
    return pref + '_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 7);
  }

  function criarTarefa(solic, node) {
    var resp = respDoNode(node);
    var nomeResp = resp ? resp.nome : null;
    // T01 e afins com "Solicitante" caem no criador da solicitacao
    var brutoTemSolic = resp && resp.bruto &&
      resp.bruto.some(function (r) { return /Solicitante/i.test(r); });
    var login = brutoTemSolic ? solic.criadoPor : loginDoResponsavel(nomeResp);
    if (brutoTemSolic && !nomeResp) nomeResp = solic.criadoPorNome || 'Solicitante';
    return {
      id: uid('tsk'),
      solicitacaoId: solic.id,
      nodeId: node.id,
      nome: node.n || node.id,
      codTarefa: codDe(node.n),
      responsavelNome: nomeResp || '(nao mapeado)',
      responsavelLogin: login || null,
      status: 'aberta',
      criadoEm: new Date().toISOString(),
      concluidoEm: null,
      concluidoPor: null
    };
  }

  /* ── API do motor ──────────────────────────────────────────────── */

  var motor = {
    // cria a solicitacao e a primeira tarefa (a partir do startEvent)
    abrir: function (dados, criadoPor, criadoPorNome) {
      var g = grafo();
      if (!g || !g.start) throw new Error('fluxo nao carregado (zeev/flow_128)');
      var solics = instGet('solicitacoes', []);
      var seq = solics.length + 1;
      var solic = {
        id: uid('sol'),
        numero: seq,
        protocolo: 'WF-' + String(seq).padStart(5, '0'),
        dados: dados || {},
        status: 'em_andamento',
        criadoPor: criadoPor || (window.Auth && Auth.currentUser() ? Auth.currentUser().username : 'desconhecido'),
        criadoPorNome: criadoPorNome || (window.Auth && Auth.currentUser() ? Auth.currentUser().name : ''),
        criadoEm: new Date().toISOString(),
        historico: []
      };
      // primeiras tarefas = expandir do startEvent
      var primeiras = expandirAteTarefa(g, g.start, solic.dados);
      var tarefas = instGet('tarefas', []);
      var novas = primeiras
        .filter(function (n) { return n.t !== 'endEvent'; })
        .map(function (n) { return criarTarefa(solic, n); });
      solic.historico.push({ em: solic.criadoEm, evento: 'aberta',
        por: solic.criadoPorNome, detalhe: novas.length + ' tarefa(s) criada(s)' });
      solics.push(solic);
      instSet('solicitacoes', solics);
      instSet('tarefas', tarefas.concat(novas));
      return { solicitacao: solic, tarefas: novas };
    },

    // conclui uma tarefa e anda o fluxo
    concluir: function (tarefaId, porLogin, patchDados) {
      var g = grafo();
      if (!g) throw new Error('fluxo nao carregado');
      var tarefas = instGet('tarefas', []);
      var t = tarefas.find(function (x) { return x.id === tarefaId; });
      if (!t) throw new Error('tarefa nao encontrada: ' + tarefaId);
      if (t.status === 'concluida') return { jaConcluida: true };
      // atualiza dados da solicitacao (se a tarefa preencheu campos)
      var solics = instGet('solicitacoes', []);
      var solic = solics.find(function (s) { return s.id === t.solicitacaoId; });
      if (solic && patchDados) {
        Object.keys(patchDados).forEach(function (k) { solic.dados[k] = patchDados[k]; });
      }
      // fecha a tarefa
      t.status = 'concluida';
      t.concluidoEm = new Date().toISOString();
      t.concluidoPor = porLogin || (window.Auth && Auth.currentUser() ? Auth.currentUser().username : null);
      // anda o fluxo a partir do node
      var node = g.porId[t.nodeId];
      var proximos = node ? proximosNodes(g, node, solic ? solic.dados : {}) : [];
      var novas = proximos
        .filter(function (n) { return n.t !== 'endEvent'; })
        .map(function (n) { return criarTarefa(solic, n); });
      var chegouFim = proximos.some(function (n) { return n.t === 'endEvent'; });
      // se nao ha' mais tarefas abertas na solicitacao e chegou num fim,
      // marca concluida
      var todas = tarefas.concat(novas);
      if (solic) {
        var abertas = todas.filter(function (x) {
          return x.solicitacaoId === solic.id && x.status === 'aberta';
        });
        if (!abertas.length && (chegouFim || !novas.length)) {
          solic.status = 'concluida';
        }
        solic.historico.push({ em: t.concluidoEm, evento: 'tarefa_concluida',
          por: t.concluidoPor, detalhe: t.nome +
            (novas.length ? (' → ' + novas.map(function (n) { return n.nome; }).join(', ')) : '') });
      }
      instSet('solicitacoes', solics);
      instSet('tarefas', todas);
      return { tarefaConcluida: t, novasTarefas: novas, chegouFim: chegouFim };
    },

    // consultas (leitura de RAM/Supabase)
    tarefasDe: function (login) {
      return instGet('tarefas', []).filter(function (t) {
        return t.status === 'aberta' && t.responsavelLogin === login;
      });
    },
    tarefasSemDono: function () {
      return instGet('tarefas', []).filter(function (t) {
        return t.status === 'aberta' && !t.responsavelLogin;
      });
    },
    solicitacoes: function () { return instGet('solicitacoes', []); },
    tarefas: function () { return instGet('tarefas', []); },
    solicitacao: function (id) {
      return instGet('solicitacoes', []).find(function (s) { return s.id === id; });
    },

    // mapa usuario Projetta -> nome Zeev (para roteamento da fila)
    getMapaUsuarios: function () { return instGet('mapa_usuarios', {}); },
    setMapaUsuario: function (login, nomeZeev) {
      var m = instGet('mapa_usuarios', {});
      if (nomeZeev) m[login] = nomeZeev; else delete m[login];
      instSet('mapa_usuarios', m);
      // re-roteia tarefas abertas cujo responsavelNome casa com esse nome
      var tarefas = instGet('tarefas', []);
      var mudou = false;
      tarefas.forEach(function (t) {
        if (t.status === 'aberta' && t.responsavelNome === nomeZeev &&
            t.responsavelLogin !== login) {
          t.responsavelLogin = login; mudou = true;
        }
      });
      if (mudou) instSet('tarefas', tarefas);
      return m;
    }
  };

  window.Workflow = window.Workflow || {};
  window.Workflow.motor = motor;
  window.Workflow._grafoDebug = grafo;
})();
