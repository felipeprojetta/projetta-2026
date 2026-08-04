/* 61-workflow.js — WORKFLOW Projetta (espelho do fluxo Zeev 2026)

   Felipe s43 (04/08/2026): "cancelar o Zeev e ter uma replica dentro do
   nosso sistema — desenhador low-code igual a tela do Zeev, com as
   tarefas, sequencias, decisores; cada etapa leva a outra, cada etapa
   tem seu responsavel e abre a tarefa pra ele".

   ORIGEM DOS DADOS — extraidos AO VIVO do Zeev pelo conector Chrome e
   gravados em v7.kv_store scope='zeev':
     - geo_128          : { nodes[235] {id,t,n,x,y,w,h}, flows[261]
                           {id,n,s,t,wps[]}, bbox } — GEOMETRIA REAL do
                           desenho (coordenadas do BPMN DI). E' o que
                           deixa o diagrama identico ao do Zeev.
     - responsaveis_128 : { detalhes[bpmnId] = { title, assignees
                           [{uid,label,sla}], buttons, checklist,
                           escalation, requiredFiles, preCondition } }
                           108 tarefas humanas (endpoint interno
                           properties/128/activities/human/{bpmnId}).
     - usuarios_zeev    : { users[20] {id,name,username,email},
                           rules[20] {uid,type,label} }
     - form_128         : { grupos[9] com 56 campos }
     - matriz_128       : { campos, tasks, celulas } atividade x campo

   ESTE COMMIT (2) — DESENHADOR + LEITURA, AINDA SEM MOTOR:
     - Aba DIAGRAMA: renderiza o fluxo em SVG a partir das coordenadas
       reais (pan/zoom, nos clicaveis). Igual a tela do Zeev.
     - Aba ETAPAS: lista com RESPONSAVEL de cada tarefa + rotas + campos.
     - Aba DECISOES: gateways e rotas.
     - Aba EQUIPE: quantas tarefas cada pessoa responde (previa da fila).
     - Aba FORMULARIO: os 56 campos.
   O MOTOR (abrir solicitacao -> cria tarefa -> anda por gateway ->
   fila individual "Minhas Tarefas") vem no commit 3, isolado, depois
   do Felipe testar este.

   ISOLAMENTO: nenhum outro modulo tocado. Scope 'zeev' NAO vai pro
   disco (arquitetura s37). Somente leitura — nada e' gravado.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SCOPE = 'zeev';
  var ui = { visao: 'tarefas', busca: '', selId: null, zoom: null, panX: 0, panY: 0 };

  /* ── dados ─────────────────────────────────────────────────────── */

  function d(key) {
    try { return window.Storage.scope(SCOPE).get(key) || null; }
    catch (e) { return null; }
  }

  function carregar() {
    var geo = d('geo_128');
    var resp = d('responsaveis_128');
    var form = d('form_128');
    var mx = d('matriz_128');
    if (!geo || !geo.nodes) return null;

    var porId = {};
    geo.nodes.forEach(function (n) { porId[n.id] = n; });

    var saidas = {}, entradas = {};
    (geo.flows || []).forEach(function (f) {
      (saidas[f.s] = saidas[f.s] || []).push(f);
      (entradas[f.t] = entradas[f.t] || []).push(f);
    });

    var detalhes = (resp && resp.detalhes) || {};

    // campos por nome de task (matriz) — reaproveitado no detalhe
    var camposPorTaskNome = {};
    if (mx && mx.celulas) {
      var tNome = mx.tasks || {}, fNome = mx.campos || {};
      mx.celulas.forEach(function (c) {
        var nomeT = tNome[c.t]; if (!nomeT) return;
        var b = camposPorTaskNome[nomeT] =
          camposPorTaskNome[nomeT] || { vis: [], edit: [] };
        var nomeF = fNome[c.f] || ('campo ' + c.f);
        if (c.v === 'enabled') b.edit.push(nomeF); else b.vis.push(nomeF);
      });
    }

    return {
      geo: geo, form: form, mx: mx, detalhes: detalhes,
      porId: porId, saidas: saidas, entradas: entradas,
      camposPorTaskNome: camposPorTaskNome,
      tarefas: geo.nodes.filter(function (n) {
        return n.t === 'userTask' || n.t === 'task';
      }),
      gateways: geo.nodes.filter(function (n) { return /Gateway/i.test(n.t); })
    };
  }

  /* ── util ──────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function nomeNo(dados, id) {
    var n = dados.porId[id]; if (!n) return id; return n.n || ('[' + n.t + ']');
  }
  function respDe(dados, bpmnId) {
    var det = dados.detalhes[bpmnId];
    if (!det || !det.assignees || !det.assignees.length) return null;
    return det.assignees.map(function (a) { return a.label; }).join(', ');
  }
  function chaveMatriz(dados, nomeTarefa) {
    var cod = (nomeTarefa.match(/^T[\d.]+/) || [null])[0];
    if (!cod) return dados.camposPorTaskNome[nomeTarefa] ? nomeTarefa : null;
    var achada = null;
    Object.keys(dados.camposPorTaskNome).forEach(function (k) {
      if ((k.match(/^T[\d.]+/) || [null])[0] === cod) achada = k;
    });
    return achada;
  }
  function codNum(n) {
    var m = (n || '').match(/^T([\d.]+)/); return m ? parseFloat(m[1]) : 9999;
  }

  /* ── render raiz ───────────────────────────────────────────────── */

  function render(container) {
    injectCss();
    var dados = carregar();
    if (!dados) {
      container.innerHTML =
        '<div class="info-banner">Dados do fluxo Zeev ainda nao chegaram ' +
        'do Supabase (scope zeev). Aguarde o sync ou recarregue (Ctrl+Shift+R).</div>';
      return;
    }
    var comResp = dados.tarefas.filter(function (t) { return respDe(dados, t.id); }).length;
    var html = '';
    html += '<div class="wf-top">';
    html += '<div class="wf-kpis">' +
      kpi(dados.tarefas.length, 'etapas') +
      kpi(dados.gateways.length, 'decisoes') +
      kpi((dados.geo.flows || []).length, 'conexoes') +
      kpi(comResp, 'com resp.') +
      '</div>';
    html += '<div class="wf-abas">' +
      aba('tarefas', 'Tarefas') +
      aba('diagrama', 'Diagrama') + aba('etapas', 'Etapas') +
      aba('gateways', 'Decisoes') + aba('equipe', 'Equipe') +
      aba('form', 'Formulario') + '</div>';
    html += '<input type="text" class="wf-busca" id="wf-busca" ' +
      'placeholder="Buscar etapa, responsavel, decisao ou campo..." value="' +
      esc(ui.busca) + '">';
    html += '</div>';
    html += '<div class="wf-corpo" id="wf-corpo"></div>';
    html += '<div class="wf-rodape">Fluxo Zeev 128 (2026) · espelho ' +
      'somente leitura · motor de tarefas no proximo passo</div>';
    container.innerHTML = html;

    container.querySelector('#wf-busca').addEventListener('input', function (e) {
      ui.busca = e.target.value; renderCorpo(container, dados);
    });
    container.querySelectorAll('.wf-aba').forEach(function (b) {
      b.addEventListener('click', function () {
        ui.visao = b.getAttribute('data-v'); ui.selId = null;
        container.querySelectorAll('.wf-aba').forEach(function (x) {
          x.classList.toggle('ativa', x === b);
        });
        renderCorpo(container, dados);
      });
    });
    renderCorpo(container, dados);
  }

  function kpi(v, l) { return '<div class="wf-kpi"><b>' + v + '</b><span>' + l + '</span></div>'; }
  function aba(id, label) {
    return '<button class="wf-aba' + (ui.visao === id ? ' ativa' : '') +
      '" data-v="' + id + '">' + label + '</button>';
  }
  function filtro(txt) {
    if (!ui.busca) return true;
    return txt.toLowerCase().indexOf(ui.busca.toLowerCase()) >= 0;
  }

  function renderCorpo(container, dados) {
    var corpo = container.querySelector('#wf-corpo');
    var busca = container.querySelector('#wf-busca');
    // aba Tarefas = UI de execucao (motor). Esconde a busca (nao se aplica).
    if (ui.visao === 'tarefas') {
      if (busca) busca.style.display = 'none';
      if (window.Workflow && window.Workflow.uiTarefas) {
        window.Workflow.uiTarefas.render(corpo);
      } else {
        corpo.innerHTML = '<div class="info-banner">UI de tarefas carregando...</div>';
      }
      return;
    }
    if (busca) busca.style.display = '';
    if (ui.visao === 'diagrama') { renderDiagrama(corpo, dados); return; }
    if (ui.visao === 'gateways') corpo.innerHTML = htmlGateways(dados);
    else if (ui.visao === 'equipe') corpo.innerHTML = htmlEquipe(dados);
    else if (ui.visao === 'form') corpo.innerHTML = htmlForm(dados);
    else corpo.innerHTML = htmlEtapas(dados);

    corpo.querySelectorAll('[data-sel]').forEach(function (el) {
      el.addEventListener('click', function () {
        ui.selId = (ui.selId === el.getAttribute('data-sel'))
          ? null : el.getAttribute('data-sel');
        renderCorpo(container, dados);
      });
    });
  }

  /* ── DIAGRAMA (SVG, coordenadas reais) ─────────────────────────── */

  function corNo(t) {
    if (t === 'startEvent') return '#16a34a';
    if (t === 'endEvent') return '#b91c1c';
    if (/Gateway/.test(t)) return '#f59e0b';
    if (/intermediate/.test(t)) return '#0891b2';
    return '#1a2b4a'; // tarefas
  }

  function renderDiagrama(corpo, dados) {
    var bb = dados.geo.bbox;
    var pad = 40;
    var W = (bb.maxX - bb.minX) + pad * 2;
    var H = (bb.maxY - bb.minY) + pad * 2;
    var ox = pad - bb.minX, oy = pad - bb.minY;

    // arestas
    var edges = (dados.geo.flows || []).map(function (f) {
      var pts = (f.wps && f.wps.length ? f.wps : caminhoReto(dados, f))
        .map(function (p) { return (p.x + ox) + ',' + (p.y + oy); }).join(' ');
      var mid = meioAresta(f, ox, oy);
      var destaque = ui.busca && filtro(f.n || '');
      var lbl = f.n
        ? '<text x="' + mid.x + '" y="' + (mid.y - 4) + '" class="wf-edge-lbl' +
          (destaque ? ' hot' : '') + '" font-size="11" fill="' +
          (destaque ? '#b45309' : '#475569') + '">' + esc(f.n) + '</text>' : '';
      return '<polyline points="' + pts + '" class="wf-edge" fill="none" ' +
        'stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wfarrow)"/>' + lbl;
    }).join('');

    // nos
    var shapes = dados.geo.nodes.map(function (n) {
      if (n.x == null) return '';
      var x = n.x + ox, y = n.y + oy;
      var cor = corNo(n.t);
      var hit = ui.busca &&
        (filtro(n.n || '') || filtro(respDe(dados, n.id) || ''));
      var sel = ui.selId === n.id;
      var cls = 'wf-shape' + (hit ? ' hot' : '') + (sel ? ' sel' : '');
      var body;
      if (/Gateway/.test(n.t)) {
        var cx = x + n.w / 2, cy = y + n.h / 2, r = n.w / 2;
        body = '<polygon points="' + cx + ',' + y + ' ' + (x + n.w) + ',' + cy +
          ' ' + cx + ',' + (y + n.h) + ' ' + x + ',' + cy + '" ' +
          'fill="#fff7ed" stroke="' + cor + '"/>' +
          '<text x="' + cx + '" y="' + (cy + 5) + '" class="wf-gw-x" ' +
          'text-anchor="middle" font-size="16" fill="#b45309" font-weight="700">' +
          (/parallel/.test(n.t) ? '+' : /inclusive/.test(n.t) ? 'O' : '\u00d7') + '</text>';
      } else if (/Event/.test(n.t)) {
        var ex = x + n.w / 2, ey = y + n.h / 2;
        body = '<circle cx="' + ex + '" cy="' + ey + '" r="' + (n.w / 2) +
          '" fill="#fff" stroke="' + cor + '" stroke-width="' +
          (n.t === 'endEvent' ? 3 : 2) + '"/>';
      } else {
        var resp = respDe(dados, n.id);
        body = '<rect x="' + x + '" y="' + y + '" width="' + n.w + '" height="' +
          n.h + '" rx="8" fill="#fff" stroke="' + cor + '" stroke-width="1.5"/>' +
          txtQuebrado(n.n, x + n.w / 2, y + 22, n.w - 12) +
          (resp ? '<text x="' + (x + n.w / 2) + '" y="' + (y + n.h - 8) +
            '" class="wf-shape-resp" text-anchor="middle" font-size="10" ' +
            'fill="#3730a3" font-weight="600">' + esc(resp.split(',')[0]) + '</text>' : '');
      }
      return '<g class="' + cls + '" data-node="' + esc(n.id) + '">' + body + '</g>';
    }).join('');

    corpo.innerHTML =
      '<div class="wf-diag-wrap">' +
      '<div class="wf-diag-hint">Arraste pra mover · role pra rolar · clique numa etapa</div>' +
      '<div class="wf-diag-scroll" id="wf-diag-scroll">' +
      '<svg id="wf-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="wfarrow" markerWidth="8" markerHeight="8" refX="7" refY="4" ' +
      'orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 z" ' +
      'fill="#94a3b8"/></marker></defs>' +
      edges + shapes + '</svg></div>' +
      '<div class="wf-diag-painel" id="wf-diag-painel"></div>' +
      '</div>';

    var svg = corpo.querySelector('#wf-svg');
    svg.querySelectorAll('[data-node]').forEach(function (g) {
      g.addEventListener('click', function () {
        var id = g.getAttribute('data-node');
        ui.selId = id;
        corpo.querySelectorAll('.wf-shape.sel').forEach(function (x) {
          x.classList.remove('sel');
        });
        g.classList.add('sel');
        corpo.querySelector('#wf-diag-painel').innerHTML = painelNo(dados, id);
      });
    });
    if (ui.selId) {
      corpo.querySelector('#wf-diag-painel').innerHTML = painelNo(dados, ui.selId);
    }
  }

  function caminhoReto(dados, f) {
    var a = dados.porId[f.s], b = dados.porId[f.t];
    if (!a || !b) return [];
    return [{ x: a.x + a.w / 2, y: a.y + a.h / 2 },
            { x: b.x + b.w / 2, y: b.y + b.h / 2 }];
  }
  function meioAresta(f, ox, oy) {
    var w = f.wps && f.wps.length ? f.wps : [];
    if (!w.length) return { x: 0, y: 0 };
    var m = w[Math.floor(w.length / 2)];
    return { x: m.x + ox, y: m.y + oy };
  }
  function txtQuebrado(txt, cx, y, maxw) {
    txt = txt || '';
    var palavras = txt.split(/\s+/), linhas = [], atual = '';
    var porLinha = Math.max(10, Math.floor(maxw / 6));
    palavras.forEach(function (p) {
      if ((atual + ' ' + p).trim().length > porLinha) { linhas.push(atual); atual = p; }
      else atual = (atual + ' ' + p).trim();
    });
    if (atual) linhas.push(atual);
    linhas = linhas.slice(0, 3);
    return linhas.map(function (l, i) {
      return '<text x="' + cx + '" y="' + (y + i * 12) + '" class="wf-shape-txt" ' +
        'text-anchor="middle" font-size="11" fill="#0f172a">' + esc(l) + '</text>';
    }).join('');
  }

  function painelNo(dados, id) {
    var n = dados.porId[id];
    if (!n) return '';
    var h = '<div class="wf-pn-titulo">' + esc(n.n || id) + '</div>';
    h += '<div class="wf-pn-tipo">' + esc(rotuloTipo(n.t)) + '</div>';
    var det = dados.detalhes[id];
    if (det && det.assignees && det.assignees.length) {
      h += '<div class="wf-pn-sec"><b>Responsavel:</b> ' +
        det.assignees.map(function (a) {
          return esc(a.label) + (a.sla ? ' <span class="wf-mudo">(' + esc(a.sla) + 'h)</span>' : '');
        }).join(', ') + '</div>';
    }
    var ent = dados.entradas[id] || [], sai = dados.saidas[id] || [];
    h += '<div class="wf-pn-sec"><b>Vem de:</b> ' + (ent.map(function (f) {
      return esc(nomeNo(dados, f.s)) + (f.n ? ' <i>(' + esc(f.n) + ')</i>' : '');
    }).join(' · ') || '—') + '</div>';
    h += '<div class="wf-pn-sec"><b>Vai para:</b> ' + (sai.map(function (f) {
      return esc(nomeNo(dados, f.t)) + (f.n ? ' <i>(' + esc(f.n) + ')</i>' : '');
    }).join(' · ') || '—') + '</div>';
    if (det) {
      if (det.buttons && det.buttons.length)
        h += '<div class="wf-pn-sec"><b>Botoes:</b> ' +
          det.buttons.map(function (b) { return esc(b.label || b.type); }).join(', ') + '</div>';
      if (det.checklist && det.checklist.length)
        h += '<div class="wf-pn-sec"><b>Checklist:</b> ' +
          det.checklist.map(esc).join('; ') + '</div>';
      if (det.requiredFiles && det.requiredFiles.length)
        h += '<div class="wf-pn-sec"><b>Anexos obrigatorios:</b> ' +
          det.requiredFiles.map(esc).join(', ') + '</div>';
    }
    var k = chaveMatriz(dados, n.n || '');
    var b = k ? dados.camposPorTaskNome[k] : null;
    if (b && b.edit.length)
      h += '<div class="wf-pn-sec"><b>Campos editaveis:</b> ' +
        b.edit.map(esc).join(', ') + '</div>';
    return h;
  }

  function rotuloTipo(t) {
    return ({
      userTask: 'Tarefa humana', task: 'Tarefa',
      exclusiveGateway: 'Decisao (exclusiva)', parallelGateway: 'Paralelo',
      inclusiveGateway: 'Decisao (inclusiva)', startEvent: 'Inicio',
      endEvent: 'Fim', intermediateThrowEvent: 'Evento (envia)',
      intermediateCatchEvent: 'Evento (aguarda)'
    })[t] || t;
  }

  /* ── ETAPAS (lista com responsavel) ────────────────────────────── */

  function htmlEtapas(dados) {
    var lista = dados.tarefas
      .filter(function (t) { return filtro((t.n || '') + ' ' + (respDe(dados, t.id) || '')); })
      .sort(function (a, b) { return codNum(a.n) - codNum(b.n); });
    if (!lista.length) return '<div class="info-banner">Nada encontrado.</div>';
    return lista.map(function (t) {
      var aberto = ui.selId === t.id;
      var resp = respDe(dados, t.id);
      var h = '<div class="wf-card' + (aberto ? ' aberto' : '') +
        '" data-sel="' + esc(t.id) + '">' +
        '<div class="wf-card-linha"><span class="wf-card-titulo">' +
        esc(t.n || t.id) + '</span>' +
        (resp ? '<span class="wf-badge">' + esc(resp) + '</span>'
              : '<span class="wf-badge auto">automatica</span>') + '</div>';
      if (aberto) h += detalheEtapa(dados, t);
      return h + '</div>';
    }).join('');
  }

  function detalheEtapa(dados, t) {
    var h = '<div class="wf-det" onclick="event.stopPropagation()">';
    var det = dados.detalhes[t.id];
    if (det && det.assignees && det.assignees.length)
      h += '<div class="wf-det-sec"><b>Responsavel:</b> ' +
        det.assignees.map(function (a) {
          return esc(a.label) + (a.sla ? ' (' + esc(a.sla) + 'h)' : '');
        }).join(', ') +
        (det.escalation ? ' <span class="wf-mudo">· escalonamento: ' +
          esc(det.escalation) + '</span>' : '') + '</div>';
    var ent = dados.entradas[t.id] || [], sai = dados.saidas[t.id] || [];
    h += '<div class="wf-det-sec"><b>Vem de:</b> ' + (ent.map(function (f) {
      return esc(nomeNo(dados, f.s)) + (f.n ? ' <i>(' + esc(f.n) + ')</i>' : '');
    }).join(' · ') || '—') + '</div>';
    h += '<div class="wf-det-sec"><b>Vai para:</b> ' + (sai.map(function (f) {
      return esc(nomeNo(dados, f.t)) + (f.n ? ' <i>(' + esc(f.n) + ')</i>' : '');
    }).join(' · ') || '—') + '</div>';
    if (det && det.buttons && det.buttons.length)
      h += '<div class="wf-det-sec"><b>Botoes:</b> ' +
        det.buttons.map(function (b) { return esc(b.label || b.type); }).join(', ') + '</div>';
    var k = chaveMatriz(dados, t.n || '');
    var b = k ? dados.camposPorTaskNome[k] : null;
    if (b) {
      if (b.edit.length) h += '<div class="wf-det-sec"><b>Campos editaveis (' +
        b.edit.length + '):</b> ' + b.edit.map(esc).join(', ') + '</div>';
      if (b.vis.length) h += '<div class="wf-det-sec"><b>Somente leitura (' +
        b.vis.length + '):</b> <span class="wf-mudo">' + b.vis.map(esc).join(', ') + '</span></div>';
    }
    return h + '</div>';
  }

  /* ── DECISOES ──────────────────────────────────────────────────── */

  function htmlGateways(dados) {
    var lista = dados.gateways.filter(function (g) {
      var rotas = (dados.saidas[g.id] || []).map(function (f) { return f.n || ''; }).join(' ');
      return filtro((g.n || '') + ' ' + rotas);
    });
    if (!lista.length) return '<div class="info-banner">Nada encontrado.</div>';
    return lista.map(function (g) {
      var sai = dados.saidas[g.id] || [];
      return '<div class="wf-card gw"><div class="wf-card-titulo">' +
        esc(g.n || g.id) + ' <span class="wf-mudo">(' +
        esc(g.t.replace('Gateway', '')) + ')</span></div><div class="wf-det">' +
        sai.map(function (f) {
          return '<div class="wf-rota"><span class="wf-cond">' +
            esc(f.n || 'sempre') + '</span> → ' + esc(nomeNo(dados, f.t)) + '</div>';
        }).join('') + '</div></div>';
    }).join('');
  }

  /* ── EQUIPE (previa da fila por pessoa) ─────────────────────────── */

  function htmlEquipe(dados) {
    var porResp = {};
    dados.tarefas.forEach(function (t) {
      var det = dados.detalhes[t.id];
      if (!det || !det.assignees) return;
      det.assignees.forEach(function (a) {
        (porResp[a.label] = porResp[a.label] || []).push(t);
      });
    });
    var nomes = Object.keys(porResp).sort(function (x, y) {
      return porResp[y].length - porResp[x].length;
    }).filter(function (nm) { return filtro(nm); });
    if (!nomes.length) return '<div class="info-banner">Nada encontrado.</div>';
    return nomes.map(function (nm) {
      var ts = porResp[nm].sort(function (a, b) { return codNum(a.n) - codNum(b.n); });
      var aberto = ui.selId === 'eq:' + nm;
      var h = '<div class="wf-card' + (aberto ? ' aberto' : '') +
        '" data-sel="eq:' + esc(nm) + '">' +
        '<div class="wf-card-linha"><span class="wf-card-titulo">' + esc(nm) +
        '</span><span class="wf-badge">' + ts.length + ' tarefas</span></div>';
      if (aberto) h += '<div class="wf-det" onclick="event.stopPropagation()">' +
        ts.map(function (t) { return '<div class="wf-campo">' + esc(t.n) + '</div>'; }).join('') +
        '</div>';
      return h + '</div>';
    }).join('');
  }

  /* ── FORMULARIO ────────────────────────────────────────────────── */

  function htmlForm(dados) {
    if (!dados.form || !dados.form.grupos)
      return '<div class="info-banner">Formulario nao carregado.</div>';
    return dados.form.grupos.map(function (g) {
      var campos = (g.campos || []).filter(function (c) {
        return filtro((g.grupo || '') + ' ' + (c.label || ''));
      });
      if (!campos.length) return '';
      return '<div class="wf-card"><div class="wf-card-titulo">' +
        esc(g.grupo || '(sem grupo)') + '</div><div class="wf-det">' +
        campos.map(function (c) {
          return '<div class="wf-campo">' + esc(c.label) +
            (c.req ? ' <b class="wf-req">*</b>' : '') +
            ' <span class="wf-mudo">' + esc(c.tipo) + '</span>' +
            (c.opts && c.opts.length
              ? '<div class="wf-mudo wf-opts">' + c.opts.map(esc).join(' / ') + '</div>' : '') +
            '</div>';
        }).join('') + '</div></div>';
    }).join('') || '<div class="info-banner">Nada encontrado.</div>';
  }

  /* ── css ───────────────────────────────────────────────────────── */

  var _css = false;
  function injectCss() {
    if (_css) return; _css = true;
    var s = document.createElement('style');
    s.textContent =
      '.wf-top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:12px}' +
      '.wf-kpis{display:flex;gap:10px}' +
      '.wf-kpi{background:#f4f4f7;border-radius:8px;padding:6px 12px;text-align:center}' +
      '.wf-kpi b{display:block;font-size:16px}.wf-kpi span{font-size:11px;color:#666}' +
      '.wf-abas{display:flex;gap:6px;flex-wrap:wrap}' +
      '.wf-aba{border:1px solid #ddd;background:#fff;border-radius:6px;padding:6px 12px;cursor:pointer}' +
      '.wf-aba.ativa{background:#1a2b4a;color:#fff;border-color:#1a2b4a}' +
      '.wf-busca{flex:1;min-width:220px;padding:7px 10px;border:1px solid #ddd;border-radius:6px}' +
      '.wf-card{background:#fff;border:1px solid #e3e3e8;border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer}' +
      '.wf-card.aberto{border-color:#1a2b4a}.wf-card.gw{cursor:default}' +
      '.wf-card-linha{display:flex;justify-content:space-between;align-items:center;gap:8px}' +
      '.wf-card-titulo{font-weight:600;font-size:13px}' +
      '.wf-badge{background:#eef2ff;color:#3730a3;border-radius:10px;padding:2px 9px;font-size:11px;white-space:nowrap}' +
      '.wf-badge.auto{background:#f1f5f9;color:#64748b}' +
      '.wf-det{margin-top:8px;font-size:12.5px;cursor:default}' +
      '.wf-det-sec{margin-bottom:6px}.wf-mudo{color:#888}.wf-req{color:#b91c1c}' +
      '.wf-rota{padding:3px 0}' +
      '.wf-cond{background:#eef2ff;border-radius:4px;padding:1px 6px;font-size:11.5px}' +
      '.wf-campo{padding:4px 0;border-bottom:1px dashed #eee}' +
      '.wf-opts{font-size:11px;margin-top:2px}' +
      '.wf-rodape{margin-top:14px;font-size:11px;color:#999}' +
      // diagrama
      '.wf-diag-wrap{position:relative}' +
      '.wf-diag-hint{font-size:11px;color:#999;margin-bottom:6px}' +
      '.wf-diag-scroll{border:1px solid #e3e3e8;border-radius:8px;overflow:auto;max-height:70vh;background:' +
      'linear-gradient(#fafafd 1px,transparent 1px),linear-gradient(90deg,#fafafd 1px,transparent 1px);' +
      'background-size:24px 24px;background-color:#fff;cursor:grab}' +
      '.wf-diag-scroll:active{cursor:grabbing}' +
      '.wf-edge{fill:none;stroke:#94a3b8;stroke-width:1.5;marker-end:url(#wfarrow)}' +
      '.wf-edge-lbl{font:11px sans-serif;fill:#475569}' +
      '.wf-edge-lbl.hot{fill:#b45309;font-weight:700}' +
      '.wf-shape{cursor:pointer}.wf-shape:hover rect,.wf-shape:hover polygon,.wf-shape:hover circle{filter:brightness(.97)}' +
      '.wf-shape.sel rect,.wf-shape.sel polygon,.wf-shape.sel circle{stroke-width:3;filter:drop-shadow(0 0 3px #1a2b4a55)}' +
      '.wf-shape.hot rect,.wf-shape.hot polygon,.wf-shape.hot circle{stroke:#b45309;stroke-width:2.5}' +
      '.wf-shape-txt{font:11px sans-serif;fill:#0f172a;text-anchor:middle}' +
      '.wf-shape-resp{font:10px sans-serif;fill:#3730a3;text-anchor:middle;font-weight:600}' +
      '.wf-gw-x{font:16px sans-serif;fill:#b45309;text-anchor:middle;font-weight:700}' +
      '.wf-diag-painel{position:absolute;top:28px;right:12px;width:320px;max-height:66vh;overflow:auto;' +
      'background:#fff;border:1px solid #1a2b4a;border-radius:10px;padding:12px;box-shadow:0 6px 24px #0002}' +
      '.wf-diag-painel:empty{display:none}' +
      '.wf-pn-titulo{font-weight:700;font-size:13px}' +
      '.wf-pn-tipo{font-size:11px;color:#888;margin-bottom:8px}' +
      '.wf-pn-sec{font-size:12px;margin-bottom:6px;line-height:1.4}';
    document.head.appendChild(s);

    // pan por arraste (delegado, uma vez)
    document.addEventListener('mousedown', function (e) {
      var sc = e.target.closest && e.target.closest('#wf-diag-scroll');
      if (!sc || e.target.closest('[data-node]')) return;
      var sx = e.clientX, sy = e.clientY, sl = sc.scrollLeft, st = sc.scrollTop;
      function mv(ev) { sc.scrollLeft = sl - (ev.clientX - sx); sc.scrollTop = st - (ev.clientY - sy); }
      function up() { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
  }

  window.Workflow = { render: render };
})();
