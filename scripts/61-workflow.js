/* 61-workflow.js — WORKFLOW Projetta (espelho do fluxo Zeev 2026)

   Felipe sessao 43 (04/08/2026): "Espelhar o fluxo dentro do Projetta
   (modulo de workflow proprio)".

   ORIGEM DOS DADOS — extraidos ao vivo do Zeev pelo conector Chrome
   (endpoint interno GET /api/internal/services/1.0/designer/flows/128
   + DOM do form/builder + DOM do activitiesxfield) e gravados em
   v7.kv_store scope='zeev':
     - flow_128   : { bpmn (XML), nodes[235], flows[261], lastUpdate }
     - form_128   : { grupos[9] com 56 campos (label, req, tipo, opts) }
     - matriz_128 : { campos{cod:nome}, tasks{cod:nome},
                     celulas[{f,t,v}] v='visible'|'enabled' }

   COMMIT 1 = FUNDACAO, SO' LEITURA:
     - Menu novo "Workflow" (secao Operacional)
     - Lista as etapas (userTask/task) do fluxo com busca
     - Clique na etapa -> painel com: rotas de entrada/saida (gateways
       com condicao) + campos visiveis/editaveis daquela etapa
     - Visao "Gateways" com todas as decisoes e rotas
     - NAO grava nada. Motor de instancias (solicitacoes) vem nos
       proximos commits, 1 por vez, apos Felipe testar este.

   ISOLAMENTO: nenhum outro modulo e' tocado. Dados chegam pela mesma
   via de todo o sistema (syncFromCloud -> RAM -> Storage.scope). Scope
   'zeev' NAO entra no disco (arquitetura s37: navegador e' so' tela).
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SCOPE = 'zeev';

  var ui = { visao: 'etapas', busca: '', selId: null };

  /* ── dados ─────────────────────────────────────────────────────── */

  function d(key) {
    try { return window.Storage.scope(SCOPE).get(key) || null; }
    catch (e) { return null; }
  }

  function carregar() {
    var flow = d('flow_128');
    var form = d('form_128');
    var mx = d('matriz_128');
    if (!flow || !flow.nodes) return null;

    var porId = {};
    (flow.nodes || []).forEach(function (n) { porId[n.id] = n; });

    // entradas/saidas por no'
    var saidas = {}, entradas = {};
    (flow.flows || []).forEach(function (f) {
      (saidas[f.s] = saidas[f.s] || []).push(f);
      (entradas[f.t] = entradas[f.t] || []).push(f);
    });

    // matriz: campos por codtask -> {visiveis:[nomes], editaveis:[nomes]}
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
      flow: flow, form: form, mx: mx,
      porId: porId, saidas: saidas, entradas: entradas,
      camposPorTaskNome: camposPorTaskNome,
      tarefas: (flow.nodes || []).filter(function (n) {
        return n.t === 'userTask' || n.t === 'task';
      }),
      gateways: (flow.nodes || []).filter(function (n) {
        return /Gateway/i.test(n.t);
      })
    };
  }

  /* ── util ──────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function nomeNo(dados, id) {
    var n = dados.porId[id];
    if (!n) return id;
    return n.n || ('[' + n.t + ']');
  }

  // "T57-Separar..." casa com nome truncado da matriz ("T57 - Separar ...")
  function chaveMatriz(dados, nomeTarefa) {
    var cod = (nomeTarefa.match(/^T[\d.]+/) || [null])[0];
    if (!cod) return dados.camposPorTaskNome[nomeTarefa] ? nomeTarefa : null;
    var achada = null;
    Object.keys(dados.camposPorTaskNome).forEach(function (k) {
      var kc = (k.match(/^T[\d.]+/) || [null])[0];
      if (kc === cod) achada = k;
    });
    return achada;
  }

  /* ── render ────────────────────────────────────────────────────── */

  function render(container) {
    injectCss();
    var dados = carregar();
    if (!dados) {
      container.innerHTML =
        '<div class="info-banner">Dados do fluxo Zeev ainda nao chegaram ' +
        'do Supabase (scope zeev). Aguarde o sync ou recarregue (Ctrl+Shift+R).</div>';
      return;
    }
    var html = '';
    html += '<div class="wf-top">';
    html += '<div class="wf-kpis">' +
      kpi(dados.tarefas.length, 'etapas') +
      kpi(dados.gateways.length, 'decisoes') +
      kpi((dados.flow.flows || []).length, 'conexoes') +
      kpi(dados.form ? contarCampos(dados.form) : 0, 'campos') +
      '</div>';
    html += '<div class="wf-abas">' +
      aba('etapas', 'Etapas') + aba('gateways', 'Decisoes') +
      aba('form', 'Formulario') + '</div>';
    html += '<input type="text" class="wf-busca" id="wf-busca" ' +
      'placeholder="Buscar etapa, decisao ou campo..." value="' +
      esc(ui.busca) + '">';
    html += '</div>';
    html += '<div class="wf-corpo" id="wf-corpo"></div>';
    html += '<div class="wf-rodape">Fluxo Zeev 128 (2026) · ultima ' +
      'alteracao no Zeev: ' + esc((dados.flow.lastUpdate || '').slice(0, 10)) +
      ' · espelho somente leitura</div>';
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

  function kpi(v, l) {
    return '<div class="wf-kpi"><b>' + v + '</b><span>' + l + '</span></div>';
  }
  function aba(id, label) {
    return '<button class="wf-aba' + (ui.visao === id ? ' ativa' : '') +
      '" data-v="' + id + '">' + label + '</button>';
  }
  function contarCampos(form) {
    var n = 0;
    (form.grupos || []).forEach(function (g) { n += (g.campos || []).length; });
    return n;
  }

  function renderCorpo(container, dados) {
    var corpo = container.querySelector('#wf-corpo');
    if (ui.visao === 'gateways') corpo.innerHTML = htmlGateways(dados);
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

  function filtro(txt) {
    if (!ui.busca) return true;
    return txt.toLowerCase().indexOf(ui.busca.toLowerCase()) >= 0;
  }

  function htmlEtapas(dados) {
    var lista = dados.tarefas
      .filter(function (t) { return filtro(t.n || ''); })
      .sort(function (a, b) {
        // ordena pelo codigo Txx quando existir
        var na = parseFloat(((a.n || '').match(/^T([\d.]+)/) || [0, 9999])[1]);
        var nb = parseFloat(((b.n || '').match(/^T([\d.]+)/) || [0, 9999])[1]);
        return na - nb;
      });
    if (!lista.length) return '<div class="info-banner">Nada encontrado.</div>';
    return lista.map(function (t) {
      var aberto = ui.selId === t.id;
      var h = '<div class="wf-card' + (aberto ? ' aberto' : '') +
        '" data-sel="' + esc(t.id) + '">' +
        '<div class="wf-card-titulo">' + esc(t.n || t.id) + '</div>';
      if (aberto) h += detalheEtapa(dados, t);
      return h + '</div>';
    }).join('');
  }

  function detalheEtapa(dados, t) {
    var h = '<div class="wf-det" onclick="event.stopPropagation()">';
    var ent = dados.entradas[t.id] || [], sai = dados.saidas[t.id] || [];
    h += '<div class="wf-det-sec"><b>Vem de:</b> ' + (ent.map(function (f) {
      return esc(nomeNo(dados, f.s)) + (f.n ? ' <i>(' + esc(f.n) + ')</i>' : '');
    }).join(' · ') || '—') + '</div>';
    h += '<div class="wf-det-sec"><b>Vai para:</b> ' + (sai.map(function (f) {
      return esc(nomeNo(dados, f.t)) + (f.n ? ' <i>(' + esc(f.n) + ')</i>' : '');
    }).join(' · ') || '—') + '</div>';
    var k = chaveMatriz(dados, t.n || '');
    var b = k ? dados.camposPorTaskNome[k] : null;
    if (b) {
      if (b.edit.length) h += '<div class="wf-det-sec"><b>Campos editaveis (' +
        b.edit.length + '):</b> ' + b.edit.map(esc).join(', ') + '</div>';
      if (b.vis.length) h += '<div class="wf-det-sec"><b>Somente leitura (' +
        b.vis.length + '):</b> <span class="wf-mudo">' +
        b.vis.map(esc).join(', ') + '</span></div>';
    } else {
      h += '<div class="wf-det-sec wf-mudo">Sem campos mapeados na matriz ' +
        'para esta etapa.</div>';
    }
    return h + '</div>';
  }

  function htmlGateways(dados) {
    var lista = dados.gateways.filter(function (g) {
      var rotas = (dados.saidas[g.id] || []).map(function (f) { return f.n || ''; }).join(' ');
      return filtro((g.n || '') + ' ' + rotas);
    });
    if (!lista.length) return '<div class="info-banner">Nada encontrado.</div>';
    return lista.map(function (g) {
      var sai = dados.saidas[g.id] || [];
      var h = '<div class="wf-card gw"><div class="wf-card-titulo">' +
        esc(g.n || g.id) + ' <span class="wf-mudo">(' +
        esc(g.t.replace('Gateway', '')) + ')</span></div>';
      h += '<div class="wf-det">' + sai.map(function (f) {
        return '<div class="wf-rota"><span class="wf-cond">' +
          esc(f.n || 'sempre') + '</span> → ' +
          esc(nomeNo(dados, f.t)) + '</div>';
      }).join('') + '</div></div>';
      return h;
    }).join('');
  }

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
              ? '<div class="wf-mudo wf-opts">' + c.opts.map(esc).join(' / ') + '</div>'
              : '') + '</div>';
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
      '.wf-abas{display:flex;gap:6px}' +
      '.wf-aba{border:1px solid #ddd;background:#fff;border-radius:6px;padding:6px 12px;cursor:pointer}' +
      '.wf-aba.ativa{background:#1a2b4a;color:#fff;border-color:#1a2b4a}' +
      '.wf-busca{flex:1;min-width:220px;padding:7px 10px;border:1px solid #ddd;border-radius:6px}' +
      '.wf-card{background:#fff;border:1px solid #e3e3e8;border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer}' +
      '.wf-card.aberto{border-color:#1a2b4a}' +
      '.wf-card.gw{cursor:default}' +
      '.wf-card-titulo{font-weight:600;font-size:13px}' +
      '.wf-det{margin-top:8px;font-size:12.5px;cursor:default}' +
      '.wf-det-sec{margin-bottom:6px}' +
      '.wf-mudo{color:#888}' +
      '.wf-req{color:#b91c1c}' +
      '.wf-rota{padding:3px 0}' +
      '.wf-cond{background:#eef2ff;border-radius:4px;padding:1px 6px;font-size:11.5px}' +
      '.wf-campo{padding:4px 0;border-bottom:1px dashed #eee}' +
      '.wf-opts{font-size:11px;margin-top:2px}' +
      '.wf-rodape{margin-top:14px;font-size:11px;color:#999}';
    document.head.appendChild(s);
  }

  window.Workflow = { render: render };
})();
