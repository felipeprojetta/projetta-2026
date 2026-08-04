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

  // sessao atual (robusto: Auth pode nao existir em teste/boot)
  function _sess() {
    try { return window.Auth && window.Auth.currentUser ? window.Auth.currentUser() : null; }
    catch (e) { return null; }
  }

  /* ── grafo do fluxo (a partir de flow_128) ─────────────────────── */

  var _grafo = null;
  function grafo() {
    if (_grafo) return _grafo;
    // Fonte da verdade do desenho e' geo_128 (editavel pelo editor, tem
    // coords + nodes + flows). Fallback pra flow_128 (extracao original).
    var flow = defGet('geo_128') || defGet('flow_128');
    if (!flow || !flow.nodes) return null;
    var porId = {}, saidas = {}, entradas = {};
    flow.nodes.forEach(function (n) { porId[n.id] = n; });
    (flow.flows || []).forEach(function (f) {
      (saidas[f.s] = saidas[f.s] || []).push(f);
      (entradas[f.t] = entradas[f.t] || []).push(f);
    });
    // start event
    var start = flow.nodes.find(function (n) { return n.t === 'startEvent'; });
    // eventos de LINK (LSxx throw -> LCxx catch), o que liga os "blocos".
    // Aprendido na Universidade Zeev: evento de mensagem e' so' e-mail;
    // quem salta entre partes distantes do processo e' o evento de link,
    // pareado pelo NUMERO (LS10<->LC10). Monta saltoLink: idThrow -> idCatch.
    var saltoLink = {};
    var throws = {}, catches = {};
    flow.nodes.forEach(function (n) {
      var m = (n.n || '').match(/^L([SC])(\d+)/i);
      if (!m) return;
      var num = m[2];
      if (m[1].toUpperCase() === 'S') throws[num] = n.id;
      else catches[num] = n.id;
    });
    Object.keys(throws).forEach(function (num) {
      if (catches[num]) saltoLink[throws[num]] = catches[num];
    });
    _grafo = { flow: flow, porId: porId, saidas: saidas, entradas: entradas,
      start: start, saltoLink: saltoLink };
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
    // valores dos campos + o ULTIMO BOTAO DE ACAO clicado (fonte de
    // condicao do Zeev: "testar se clicou Aprovar/Rejeitar").
    var valores = Object.keys(dados || {}).map(function (k) {
      return String(dados[k] || '').trim().toLowerCase();
    });
    // 1) match EXATO primeiro (o correto para gateway exclusivo).
    //    Evita que "Nacional" case dentro de "Internacional".
    if (valores.some(function (v) { return v === alvo; })) return true;
    // 2) fallback tolerante: condicao como palavra inteira no valor.
    var reBorda = new RegExp('(^|[^a-z0-9\\u00c0-\\u017f])' +
      alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '([^a-z0-9\\u00c0-\\u017f]|$)', 'i');
    return valores.some(function (v) { return reBorda.test(v); });
  }

  // se o destino ja' e' tarefa, retorna ele; se e' gateway/evento
  // intermediario, atravessa ate' a proxima tarefa/fim. Fiel ao Zeev:
  //  - EVENTO DE LINK (LSxx throw): salta pro LCxx catch de mesmo numero
  //    e continua dali (o que liga os "blocos" do processo).
  //  - GATEWAY EXCLUSIVO: segue as saidas cuja condicao bate; se NENHUMA
  //    bater, segue o caminho DEFAULT (evita travar, como manda o Zeev).
  //  - GATEWAY PARALELO/INCLUSIVO divergente: ativa todas as saidas que
  //    batem (paralelo = todas, sem filtro).
  //  - EVENTO DE MENSAGEM (MGSxx): so' e-mail; atravessa sem criar tarefa.
  // Protege contra loop com visitados.
  function expandirAteTarefa(g, node, dados, visitados) {
    visitados = visitados || {};
    if (visitados[node.id]) return [];
    visitados[node.id] = true;
    if (node.t === 'userTask' || node.t === 'task' || node.t === 'endEvent') {
      return [node];
    }
    // salto de link: throw LSxx -> catch LCxx (continua a partir do catch)
    if (g.saltoLink[node.id]) {
      var catchNode = g.porId[g.saltoLink[node.id]];
      if (catchNode) return expandirAteTarefa(g, catchNode, dados, visitados);
    }
    var outs = (g.saidas[node.id] || []);
    var ehExclusivo = node.t === 'exclusiveGateway';
    var out = [];
    var algumBateu = false;
    outs.forEach(function (f) {
      if (condicaoBate(f, dados)) {
        algumBateu = true;
        var d = g.porId[f.t];
        if (d) out = out.concat(expandirAteTarefa(g, d, dados, visitados));
      }
    });
    // caminho DEFAULT do exclusivo: se nenhuma condicao bateu, segue o
    // fluxo marcado como padrao (ou, na falta, o primeiro sem condicao,
    // ou o primeiro de todos) — regra do Zeev pra nao travar.
    if (ehExclusivo && !algumBateu && outs.length) {
      var def = outs.find(function (f) { return f.default || f.isDefault; })
        || outs.find(function (f) { return !(f.n || '').trim(); })
        || outs[0];
      var dd = g.porId[def.t];
      if (dd) out = out.concat(expandirAteTarefa(g, dd, dados, visitados));
    }
    return out;
  }

  /* ── criacao de tarefas ────────────────────────────────────────── */

  function uid(pref) {
    return pref + '_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 7);
  }

  /* ── PRAZO / SLA por etapa ──────────────────────────────────────
     Cada etapa pode ter um prazo em horas. No Zeev o SLA fica na secao
     "Responsaveis e prazos" de cada tarefa (a maioria das etapas do
     Projetta estava sem SLA). Aqui o prazo e' CONFIGURAVEL por codigo de
     tarefa em workflow/prazos_sla (key -> horas), com um default. A partir
     do prazo, calcula-se expiraEm = criadoEm + horas. A UI usa isso pro
     "Expira em", pra marcar atrasadas e ordenar a fila. */
  var PRAZO_DEFAULT_H = 24; // 1 dia util (default sensato)

  function prazoDaTarefa(cod) {
    var tab = instGet('prazos_sla', null);
    if (tab && cod && tab[cod] != null) return Number(tab[cod]);
    if (tab && tab._default != null) return Number(tab._default);
    return PRAZO_DEFAULT_H;
  }
  function calcExpira(criadoEmISO, horas) {
    var d = new Date(criadoEmISO);
    d.setTime(d.getTime() + (horas || PRAZO_DEFAULT_H) * 3600 * 1000);
    return d.toISOString();
  }

  function criarTarefa(solic, node) {
    var resp = respDoNode(node);
    var nomeResp = resp ? resp.nome : null;
    // T01 e afins com "Solicitante" caem no criador da solicitacao
    var brutoTemSolic = resp && resp.bruto &&
      resp.bruto.some(function (r) { return /Solicitante/i.test(r); });
    var login = brutoTemSolic ? solic.criadoPor : loginDoResponsavel(nomeResp);
    if (brutoTemSolic && !nomeResp) nomeResp = solic.criadoPorNome || 'Solicitante';
    var criadoEm = new Date().toISOString();
    var cod = codDe(node.n);
    var prazoH = prazoDaTarefa(cod);
    return {
      id: uid('tsk'),
      solicitacaoId: solic.id,
      nodeId: node.id,
      nome: node.n || node.id,
      codTarefa: cod,
      responsavelNome: nomeResp || '(nao mapeado)',
      responsavelLogin: login || null,
      status: 'aberta',
      prazoHoras: prazoH,
      expiraEm: calcExpira(criadoEm, prazoH),
      criadoEm: criadoEm,
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
        criadoPor: criadoPor || (_sess() ? _sess().username : 'desconhecido'),
        criadoPorNome: criadoPorNome || (_sess() ? _sess().name : ''),
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
    concluir: function (tarefaId, porLogin, patchDados, botao) {
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
      // BOTAO DE ACAO: no Zeev o botao clicado (Aprovar/Rejeitar/Concluido/
      // custom) roteia o gateway seguinte. Injeta como valor pra
      // condicaoBate decidir a saida do gateway.
      if (solic && botao) solic.dados._ultimoBotao = botao;
      // fecha a tarefa
      t.status = 'concluida';
      t.acaoBotao = botao || null;
      t.concluidoEm = new Date().toISOString();
      t.concluidoPor = porLogin || (_sess() ? _sess().username : null);
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

    // ── SLA / prazo ────────────────────────────────────────────────
    // status do prazo de uma tarefa: {atrasada, restanteMs, restanteTxt}
    statusPrazo: function (t) {
      if (!t || !t.expiraEm) return { atrasada: false, restanteTxt: 'sem prazo' };
      var ms = new Date(t.expiraEm).getTime() - Date.now();
      var atrasada = ms < 0;
      var abs = Math.abs(ms);
      var h = Math.floor(abs / 3600000);
      var min = Math.floor((abs % 3600000) / 60000);
      var txt = (h >= 24 ? (Math.floor(h / 24) + 'd ' + (h % 24) + 'h') : (h + 'h ' + min + 'm'));
      return { atrasada: atrasada, restanteMs: ms,
        restanteTxt: (atrasada ? 'atrasada ' + txt : 'faltam ' + txt),
        expiraEm: t.expiraEm };
    },
    // fila de um login ordenada por expiracao crescente (Zeev: as que
    // expiram antes / ja expiradas primeiro)
    filaOrdenada: function (login) {
      var self = this;
      return instGet('tarefas', [])
        .filter(function (t) { return t.status === 'aberta' && t.responsavelLogin === login; })
        .sort(function (a, b) {
          return new Date(a.expiraEm || 0) - new Date(b.expiraEm || 0);
        });
    },
    // % das tarefas abertas (opcionalmente de um login) dentro do prazo
    percentualNoPrazo: function (login) {
      var abertas = instGet('tarefas', []).filter(function (t) {
        return t.status === 'aberta' && (!login || t.responsavelLogin === login);
      });
      if (!abertas.length) return 100;
      var noPrazo = abertas.filter(function (t) {
        return !t.expiraEm || new Date(t.expiraEm).getTime() >= Date.now();
      }).length;
      return Math.round((noPrazo / abertas.length) * 100);
    },
    // config de prazos (horas) por codigo de tarefa; '_default' geral
    getPrazos: function () { return instGet('prazos_sla', {}); },
    setPrazo: function (cod, horas) {
      var tab = instGet('prazos_sla', {});
      if (horas == null || horas === '') delete tab[cod];
      else tab[cod] = Number(horas);
      instSet('prazos_sla', tab);
      return tab;
    },
    // invalida o cache do grafo (chamar apos o editor salvar geo_128)
    recarregarGrafo: function () { _grafo = null; return grafo(); },

    // botoes de acao de uma tarefa (fiel ao Zeev). Sem config explicita,
    // deduz pelo tipo: se o nome/aplicativo sugere aprovacao usa
    // Aprovar/Rejeitar; senao Concluido/Nao concluido. tipo pode vir do
    // node (t.tipoTarefa) quando extraido do Zeev.
    botoesDaTarefa: function (tarefaId) {
      var t = instGet('tarefas', []).find(function (x) { return x.id === tarefaId; });
      var ehAprovacao = t && (/aprova|liber|aprovacao/i.test(t.nome || '') ||
        t.tipoTarefa === 'aprovacao');
      if (ehAprovacao) {
        return [
          { texto: 'Aprovar', acao: 'Aprovado', tipo: 'positivo', valida: true },
          { texto: 'Rejeitar', acao: 'Rejeitado', tipo: 'negativo', justifica: true }
        ];
      }
      return [
        { texto: 'Concluído', acao: 'Concluido', tipo: 'positivo', valida: true },
        { texto: 'Não concluído', acao: 'NaoConcluido', tipo: 'negativo', justifica: true }
      ];
    },

    // DEVOLVER: retorna a solicitacao a uma tarefa passada (reabre ela e
    // fecha a atual). Fiel ao Zeev ("devolver a um ponto passado").
    devolver: function (tarefaId, codDestino, porLogin, justificativa) {
      var tarefas = instGet('tarefas', []);
      var t = tarefas.find(function (x) { return x.id === tarefaId; });
      if (!t) throw new Error('tarefa nao encontrada');
      var solics = instGet('solicitacoes', []);
      var solic = solics.find(function (s) { return s.id === t.solicitacaoId; });
      // acha a ultima tarefa concluida com o codigo destino nessa solic
      var destino = tarefas.filter(function (x) {
        return x.solicitacaoId === t.solicitacaoId && x.codTarefa === codDestino;
      }).pop();
      t.status = 'concluida';
      t.concluidoEm = new Date().toISOString();
      t.concluidoPor = porLogin || (_sess() ? _sess().username : null);
      t.devolvidaPara = codDestino;
      var nova = null;
      if (destino) {
        nova = {
          id: uid('tsk'), solicitacaoId: t.solicitacaoId, nodeId: destino.nodeId,
          nome: destino.nome, codTarefa: destino.codTarefa,
          responsavelNome: destino.responsavelNome,
          responsavelLogin: destino.responsavelLogin,
          status: 'aberta', criadoEm: new Date().toISOString(),
          concluidoEm: null, concluidoPor: null, reaberta: true
        };
      }
      if (solic) {
        solic.status = 'em_andamento';
        solic.historico.push({ em: t.concluidoEm, evento: 'devolvida',
          por: t.concluidoPor, detalhe: t.nome + ' → devolvida para ' + codDestino +
            (justificativa ? (' (' + justificativa + ')') : '') });
      }
      instSet('solicitacoes', solics);
      instSet('tarefas', nova ? tarefas.concat([nova]) : tarefas);
      return { devolvida: t, reaberta: nova };
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
    },

    /* ─── MODO TRILHA (linear T01→T44 para teste) ─────────────────
       Felipe s43: o fluxo Zeev e' fragmentado em 14 blocos ligados por
       mensagens; a T44 nao sai por seta direta do T01. Para testar do
       inicio ate' a T44, roda-se a SEQUENCIA LINEAR real gravada em
       zeev/trilha_teste_t44 (T01,T02...T44, cada uma com responsavel).
       Aqui as tarefas andam 1 a 1, na ordem, sem gateway. */
    abrirTrilha: function (dados, criadoPor, criadoPorNome) {
      var trilha = defGet('trilha_teste_t44');
      if (!trilha || !trilha.etapas || !trilha.etapas.length)
        throw new Error('trilha nao carregada (zeev/trilha_teste_t44)');
      var solics = instGet('solicitacoes', []);
      var seq = solics.length + 1;
      var sess = _sess();
      var solic = {
        id: uid('sol'), numero: seq,
        protocolo: 'WF-' + String(seq).padStart(5, '0'),
        modo: 'trilha', trilhaPos: 0,
        dados: dados || {}, status: 'em_andamento',
        criadoPor: criadoPor || (sess ? sess.username : 'desconhecido'),
        criadoPorNome: criadoPorNome || (sess ? sess.name : ''),
        criadoEm: new Date().toISOString(), historico: []
      };
      var primeira = _tarefaDaEtapa(solic, trilha.etapas[0]);
      solic.historico.push({ em: solic.criadoEm, evento: 'aberta',
        por: solic.criadoPorNome, detalhe: 'trilha T01→T44 iniciada' });
      solics.push(solic);
      instSet('solicitacoes', solics);
      instSet('tarefas', instGet('tarefas', []).concat([primeira]));
      return { solicitacao: solic, tarefa: primeira };
    },
    concluirTrilha: function (tarefaId, porLogin, patchDados, botao) {
      var trilha = defGet('trilha_teste_t44');
      var tarefas = instGet('tarefas', []);
      var t = tarefas.find(function (x) { return x.id === tarefaId; });
      if (!t) throw new Error('tarefa nao encontrada');
      if (t.status === 'concluida') return { jaConcluida: true };
      var solics = instGet('solicitacoes', []);
      var solic = solics.find(function (s) { return s.id === t.solicitacaoId; });
      if (solic && patchDados) Object.keys(patchDados).forEach(function (k) {
        solic.dados[k] = patchDados[k];
      });
      t.status = 'concluida';
      t.concluidoEm = new Date().toISOString();
      t.concluidoPor = porLogin || (_sess() ? _sess().username : null);
      var nova = null;
      var pos = (solic ? solic.trilhaPos : 0) + 1;
      if (solic && trilha && pos < trilha.etapas.length) {
        solic.trilhaPos = pos;
        nova = _tarefaDaEtapa(solic, trilha.etapas[pos]);
        solic.historico.push({ em: t.concluidoEm, evento: 'tarefa_concluida',
          por: t.concluidoPor, detalhe: t.nome + ' → ' + nova.nome });
      } else if (solic) {
        solic.status = 'concluida';
        solic.historico.push({ em: t.concluidoEm, evento: 'concluida',
          por: t.concluidoPor, detalhe: t.nome + ' (fim da trilha)' });
      }
      instSet('solicitacoes', solics);
      instSet('tarefas', nova ? tarefas.concat([nova]) : tarefas);
      return { tarefaConcluida: t, novaTarefa: nova, fim: !nova };
    }
  };

  // cria uma tarefa a partir de uma etapa da trilha (cod/id/nome/resp)
  function _tarefaDaEtapa(solic, etapa) {
    var nomeResp = (etapa.resp && etapa.resp[0]) || '(nao mapeado)';
    var ehSolic = /Solicitante/i.test(nomeResp);
    var login = ehSolic ? solic.criadoPor : loginDoResponsavel(nomeResp);
    if (ehSolic) nomeResp = solic.criadoPorNome || 'Solicitante';
    var criadoEm = new Date().toISOString();
    var prazoH = prazoDaTarefa(etapa.cod);
    return {
      id: uid('tsk'), solicitacaoId: solic.id, nodeId: etapa.id,
      nome: etapa.nome, codTarefa: etapa.cod,
      responsavelNome: nomeResp, responsavelLogin: login || null,
      status: 'aberta',
      prazoHoras: prazoH, expiraEm: calcExpira(criadoEm, prazoH),
      criadoEm: criadoEm,
      concluidoEm: null, concluidoPor: null
    };
  }

  window.Workflow = window.Workflow || {};
  window.Workflow.motor = motor;
  window.Workflow._grafoDebug = grafo;
})();
