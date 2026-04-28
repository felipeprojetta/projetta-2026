/* ============================================================================
 * js/162-orcamento-save-load.js  —  v1 (28-abr-2026)
 *
 * Felipe 28/04: "preciso de uma forma profissional de salvar esses orçamentos
 * dentro do proprio sistema e abrir eles com os dados orcados quando eu quiser
 * preciso abrir fechar visualizar os dados sem ficar recalculando toda vez"
 *
 * SISTEMA COMPLETO de salvar/abrir orçamentos em rascunhos_orcamento.
 *
 * COMPONENTES:
 *  1. CAPTURA SNAPSHOT — coleta TUDO do estado atual:
 *     - Todos os campos do DOM (carac-*, plan-*, qtd-portas, largura, altura)
 *     - _crmItens, _orcItens, _orcItemAtual
 *     - Planificador: peças, layout calculado, chapa, aproveitamento
 *     - Resultado: DRE, valor tabela, faturamento, custo, lucro
 *     - PNGs (se já gerados pelo js/159)
 *
 *  2. SALVAR — POST/PATCH em rascunhos_orcamento (versionamento por qtd_versoes)
 *
 *  3. LISTAR — Modal "📂 Meus Orçamentos" com busca e ações
 *
 *  4. ABRIR — Carrega snapshot completo e aplica no DOM
 *
 *  5. MODO VIEW — Suprime calc(), _osAutoUpdate(), planUpd() pra não recalcular
 *     Banner topo "📂 Visualizando..." com botão [✏ Editar]
 * ========================================================================== */
(function(){
  'use strict';
  if(window.__projetta162Applied) return;
  window.__projetta162Applied = true;

  var SUPABASE_URL = 'https://plmliavuwlgpwaizfeds.supabase.co';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858';
  var TABLE = 'rascunhos_orcamento';

  // ════════════════════════════════════════════════════════════════════════
  // STATE GLOBAL
  // ════════════════════════════════════════════════════════════════════════
  window._orcViewMode = window._orcViewMode || false;
  window._orcLoadedId = window._orcLoadedId || null;
  window._orcLoadedSnapshot = window._orcLoadedSnapshot || null;

  function $(id){ return document.getElementById(id); }
  function _v(id){ var e = $(id); return e ? e.value : ''; }
  function _num(v){ var n = parseFloat(String(v||'').replace(/\./g,'').replace(',','.')); return isNaN(n) ? 0 : n; }

  function toast(html, cor, ms){
    var t = $('orc-save-toast'); if(t) t.remove();
    t = document.createElement('div');
    t.id = 'orc-save-toast';
    t.style.cssText = 'position:fixed;top:80px;right:20px;background:'+cor+';color:#fff;padding:14px 22px;border-radius:10px;font-size:13px;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.3);max-width:480px;line-height:1.45;font-family:inherit';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.remove(); }, ms || 4500);
  }

  function fetchSupa(method, path, body){
    var h = {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };
    if(method === 'POST' || method === 'PATCH') h['Prefer'] = 'return=representation';
    return fetch(SUPABASE_URL + '/rest/v1/' + path, {
      method: method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error(method + ' ' + r.status + ' ' + t); });
      if(r.status === 204) return null;
      return r.text().then(function(t){ return t ? JSON.parse(t) : null; });
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. CAPTURA SNAPSHOT
  // ════════════════════════════════════════════════════════════════════════

  // Lista exaustiva dos campos do DOM que afetam o orçamento
  var CAMPOS_TEXTO = [
    'qtd-portas','largura','altura',
    'carac-abertura','carac-modelo','carac-folhas','folhas-porta',
    'carac-cor-ext','carac-cor-int','carac-cor-macico',
    'carac-fech-mec','carac-fech-dig','carac-cilindro',
    'carac-puxador','carac-pux-tam',
    'carac-dist-borda-cava','carac-largura-cava',
    'carac-dist-borda-friso','carac-largura-friso',
    'carac-friso-vert','carac-friso-horiz',
    'carac-ripado-total','carac-ripado-2lados',
    // Planificador
    'plan-modelo','plan-chapa','plan-largura','plan-altura',
    'plan-friso-h-qty','plan-friso-h-esp','plan-friso-v-qty',
    'plan-moldura-rev','plan-moldura-larg-qty','plan-moldura-alt-qty',
    'plan-moldura-tipo','plan-moldura-dis1','plan-moldura-dis2','plan-moldura-dis3',
    'plan-moldura-divisao','plan-refilado','plan-tampa-orient'
  ];
  var CAMPOS_CHECKBOX = ['carac-tem-alisar'];

  function capturarCampos(){
    var out = {};
    CAMPOS_TEXTO.forEach(function(id){
      var el = $(id);
      if(el && el.value !== undefined && el.value !== '') out[id] = el.value;
    });
    CAMPOS_CHECKBOX.forEach(function(id){
      var el = $(id);
      if(el) out[id] = !!el.checked;
    });
    return out;
  }

  function _safeClone(obj){
    if(!obj) return null;
    try { return JSON.parse(JSON.stringify(obj)); }
    catch(e){ console.warn('[162-clone] falhou (circular?):', e.message); return null; }
  }
  function capturarPlanificador(){
    try {
      return {
        pieces: _safeClone(window._plnPieces),
        lastResult: _safeClone(window._plnLastResult),
        cor: _v('plan-chapa'),
        largura: _v('plan-largura'),
        altura: _v('plan-altura')
      };
    } catch(e){
      console.warn('[162-pln] erro:', e);
      return { erro: e.message };
    }
  }

  function capturarResultado(){
    function _readNum(sel){
      try {
        var el = document.querySelector(sel);
        if(!el) return 0;
        var txt = (el.textContent || el.innerText || '').toString();
        return _num(txt.replace(/[^\d,.\-]/g,''));
      } catch(e){ return 0; }
    }
    function _readHtml(sel){
      try {
        var el = document.querySelector(sel);
        return el ? (el.innerHTML || '') : '';
      } catch(e){ return ''; }
    }
    try {
      return {
        sub_fab:        _readNum('.r-fab'),
        sub_inst:       _readNum('.r-inst'),
        valor_tabela:   _readNum('.r-tab') || _readNum('#r-tab') || _readNum('.dr-tab'),
        faturamento:    _readNum('.d-fat') || _readNum('.dre .d-fat'),
        custo_total:    _readNum('.d-custo'),
        lucro_liquido:  _readNum('.dr.ll') || _readNum('.d-ll'),
        capturado_html: { rPorta: _readHtml('.r-porta'), dre: _readHtml('.dre') }
      };
    } catch(e){
      console.warn('[162-res] erro:', e);
      return { erro: e.message, capturado_html: { rPorta: '', dre: '' } };
    }
  }

  function _readClienteFromDOM(){
    // 1) #orc-itens-cli (lugar oficial - "Itens do Pedido — <span id=orc-itens-cli>Cliente</span>")
    var el = $('orc-itens-cli');
    if(el){
      var t = (el.textContent || '').trim();
      if(t && t !== 'Cliente') return t;
    }
    // 2) Texto completo do header (extrair regex)
    var header = document.querySelector('.orc-itens-bar-title');
    if(header){
      var txt = (header.textContent || '').trim();
      // Pattern: "Itens do Pedido — Eduardo E Giovana Pires - Pv · Reserva 141185 · AGP004519"
      var m = txt.match(/Itens do Pedido\s*[—–-]\s*(.+?)(?:\s*[·•]\s*Reserva|\s*$)/);
      if(m && m[1]) return m[1].trim();
    }
    // 3) Card do CRM (window state)
    if(window._crmOrcCliente) return window._crmOrcCliente;
    return '';
  }
  function _readAgpReservaFromDOM(){
    var out = { agp: '', reserva: '' };
    var header = document.querySelector('.orc-itens-bar-title');
    if(header){
      var txt = (header.textContent || '').trim();
      var ma = txt.match(/AGP(\d+)/i);  if(ma) out.agp = 'AGP' + ma[1];
      var mr = txt.match(/Reserva\s*(\d+)/i); if(mr) out.reserva = mr[1];
    }
    return out;
  }
  function capturarSnapshot(){
    var clienteNome = _readClienteFromDOM();
    if(!clienteNome) clienteNome = 'Sem cliente';
    var ar = _readAgpReservaFromDOM();

    return {
      capturado_em: new Date().toISOString(),
      cliente: clienteNome,
      card_id: window._crmOrcCardId || null,
      agp: ar.agp || window._crmOrcAgp || _v('crm-o-agp') || '',
      reserva: ar.reserva || window._crmOrcReserva || _v('crm-o-reserva') || '',


      campos: capturarCampos(),
      crmItens: window._crmItens ? JSON.parse(JSON.stringify(window._crmItens)) : [],
      orcItens: window._orcItens ? JSON.parse(JSON.stringify(window._orcItens)) : [],
      orcItemAtual: window._orcItemAtual,
      planificador: capturarPlanificador(),
      resultado: capturarResultado(),
      pngs: window._snapshotPngs || null
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. SALVAR
  // ════════════════════════════════════════════════════════════════════════

  async function orcSalvarOrcamento(){
    console.log('%c[162] orcSalvarOrcamento INICIADO', 'background:#27ae60;color:#fff;padding:3px 8px;border-radius:4px;font-weight:700');
    try {
      if(typeof window._crmItensSaveFromDOM === 'function'){
        try { window._crmItensSaveFromDOM(); } catch(e){ console.warn('[162] saveFromDOM falhou:', e); }
      }

      var snap;
      try { snap = capturarSnapshot(); }
      catch(e){
        console.error('[162-snap] erro fatal capturando snapshot:', e);
        toast('❌ <b>Erro capturando dados:</b><br><span style="font-size:11px;font-weight:400">' + e.message + '</span>', '#c0392b', 8000);
        return;
      }
      console.log('[162] snapshot:', snap);
      if(!snap.cliente || snap.cliente === 'Sem cliente'){
        toast('⚠ <b>Cliente não identificado</b><br><span style="font-weight:400;font-size:11px">Abra um card do CRM antes de salvar</span>', '#c0392b', 5000);
        return;
      }

      // Determinar id e versão (procura registro existente pelo card_id)
      var id, versao;
      if(snap.card_id){
        var existing = await fetchSupa('GET', TABLE + '?card_id=eq.' + encodeURIComponent(snap.card_id) + '&deleted_at=is.null&select=id,qtd_versoes&order=updated_at.desc&limit=1');
        if(existing && existing.length > 0){
          id = existing[0].id;
          versao = (existing[0].qtd_versoes || 0) + 1;
        } else {
          id = 'orc_' + (snap.agp || ('card_' + snap.card_id.slice(0,8))) + '_' + Date.now();
          versao = 1;
        }
      } else {
        id = 'orc_' + (snap.agp || 'sem_agp') + '_' + Date.now();
        versao = 1;
      }

      var payload = {
        id: id,
        card_id: snap.card_id,
        cliente: snap.cliente,
        agp: snap.agp || null,
        reserva: snap.reserva || null,
        dados_cliente: { capturado_em: snap.capturado_em },
        dados_projeto: snap.campos,
        params_financeiros: snap.resultado.dre || {},
        itens: snap.orcItens,
        resultado: {
          valores: {
            sub_fab: snap.resultado.sub_fab,
            sub_inst: snap.resultado.sub_inst,
            valor_tabela: snap.resultado.valor_tabela,
            faturamento: snap.resultado.faturamento,
            custo_total: snap.resultado.custo_total,
            lucro_liquido: snap.resultado.lucro_liquido
          },
          html_visual: snap.resultado.capturado_html,
          planificador: snap.planificador,
          crmItens: snap.crmItens,
          orcItemAtual: snap.orcItemAtual
        },
        valor_tabela: snap.resultado.valor_tabela || null,
        valor_faturamento: snap.resultado.faturamento || null,
        custo_total: snap.resultado.custo_total || null,
        qtd_itens: snap.orcItens.length,
        qtd_versoes: versao,
        status: 'salvo',
        updated_at: new Date().toISOString(),
        updated_by: 'felipe'
      };

      // UPSERT — POST com on_conflict resolve INSERT ou UPDATE atomicamente
      payload.created_at = payload.created_at || new Date().toISOString();
      payload.created_by = payload.created_by || 'felipe';
      var upsertHeaders = {
        apikey: ANON_KEY,
        Authorization: 'Bearer ' + ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      };
      var upsertUrl = SUPABASE_URL + '/rest/v1/' + TABLE;
      // Se tem card_id usa on_conflict=card_id, senao usa id (PK)
      if(snap.card_id){
        upsertUrl += '?on_conflict=card_id';
      } else {
        upsertUrl += '?on_conflict=id';
      }
      var upRes = await fetch(upsertUrl, {
        method: 'POST',
        headers: upsertHeaders,
        body: JSON.stringify(payload)
      });
      if(!upRes.ok){
        var errTxt = await upRes.text();
        throw new Error('UPSERT ' + upRes.status + ': ' + errTxt);
      }

      window._orcLoadedId = id;
      window._orcLoadedSnapshot = payload;

      var resumo = (snap.orcItens.length) + ' item' + (snap.orcItens.length>1?'s':'')
        + (snap.resultado.valor_tabela ? ' · Tabela R$ ' + Math.round(snap.resultado.valor_tabela).toLocaleString('pt-BR') : '');
      toast(
        '✅ <b>Orçamento salvo no Supabase!</b><br>' +
        '<span style="font-size:12px;font-weight:600">' + (snap.agp || id.slice(0,20)) + ' · v' + versao + '</span><br>' +
        '<span style="font-size:11px;font-weight:400;opacity:.95">' + resumo + '</span>',
        '#27ae60', 6000
      );
    } catch(err){
      console.error('[162-save] erro fatal:', err, err && err.stack);
      toast('❌ <b>Erro ao salvar:</b><br><span style="font-size:11px;font-weight:400">' + (err.message || err) + '</span><br><span style="font-size:10px;font-weight:400;opacity:.85">Detalhes no console (F12)</span>', '#c0392b', 10000);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. LISTAR + ABRIR
  // ════════════════════════════════════════════════════════════════════════

  async function orcListarOrcamentos(){
    try {
      return await fetchSupa('GET',
        TABLE + '?deleted_at=is.null&order=updated_at.desc&select=id,card_id,cliente,agp,reserva,valor_tabela,custo_total,qtd_itens,qtd_versoes,status,updated_at&limit=200');
    } catch(err){
      toast('❌ Erro ao listar: ' + err.message, '#c0392b');
      return [];
    }
  }

  async function abrirModalListaOrcamentos(){
    var orcs = await orcListarOrcamentos();
    var existing = $('orc-list-modal'); if(existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'orc-list-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,17,28,.65);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit';

    var rows = orcs.map(function(o){
      var data = o.updated_at ? new Date(o.updated_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-';
      var vt = o.valor_tabela ? 'R$ '+Math.round(o.valor_tabela).toLocaleString('pt-BR') : '-';
      var ag = o.agp || '<span style="color:#999">sem AGP</span>';
      return '<tr style="border-bottom:1px solid #eee">' +
        '<td style="padding:8px 10px;font-weight:600;color:#003144">'+ag+'</td>' +
        '<td style="padding:8px 10px">'+(o.cliente||'-')+'</td>' +
        '<td style="padding:8px 10px;text-align:center">'+(o.qtd_itens||0)+'</td>' +
        '<td style="padding:8px 10px;text-align:right;color:#27ae60;font-weight:700">'+vt+'</td>' +
        '<td style="padding:8px 10px;text-align:center;font-size:10px;color:#888">v'+(o.qtd_versoes||1)+'</td>' +
        '<td style="padding:8px 10px;font-size:11px;color:#666">'+data+'</td>' +
        '<td style="padding:8px 10px;text-align:right">' +
          '<button onclick="orcAbrirOrcamento(\''+o.id+'\')" style="padding:5px 12px;background:#003144;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;margin-right:4px">🔍 Abrir</button>' +
          '<button onclick="orcExcluirOrcamento(\''+o.id+'\')" style="padding:5px 8px;background:#c0392b;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer">🗑</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    modal.innerHTML =
      '<div style="background:#fff;border-radius:12px;width:100%;max-width:1100px;max-height:85vh;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4);display:flex;flex-direction:column">' +
        '<div style="background:linear-gradient(135deg,#003144,#00526b);color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:16px;font-weight:800">📂 Meus Orçamentos</div><div style="font-size:11px;font-weight:400;opacity:.85">'+orcs.length+' salvos</div></div>' +
          '<button onclick="document.getElementById(\'orc-list-modal\').remove()" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:14px">✕</button>' +
        '</div>' +
        '<div style="overflow:auto;flex:1">' +
          (orcs.length === 0 ?
            '<div style="padding:40px;text-align:center;color:#888">Nenhum orçamento salvo ainda.<br><small>Use o botão verde 💾 Salvar Orçamento na aba Itens do Pedido</small></div>' :
            '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f5f5f5;color:#003144;font-weight:700;text-align:left;font-size:11px;text-transform:uppercase">'+
              '<th style="padding:10px">AGP</th><th style="padding:10px">Cliente</th><th style="padding:10px;text-align:center">Itens</th>'+
              '<th style="padding:10px;text-align:right">Valor Tabela</th><th style="padding:10px;text-align:center">Ver</th>'+
              '<th style="padding:10px">Atualizado</th><th style="padding:10px"></th>'+
            '</tr></thead><tbody>'+rows+'</tbody></table>'
          ) +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  async function orcAbrirOrcamento(id){
    try {
      var rows = await fetchSupa('GET', TABLE + '?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1');
      if(!rows || !rows.length){ toast('❌ Orçamento não encontrado', '#c0392b'); return; }
      var snap = rows[0];

      $('orc-list-modal') && $('orc-list-modal').remove();

      // Entrar em VIEW MODE (suprime calc/recalc)
      window._orcViewMode = true;
      window._orcLoadedId = id;
      window._orcLoadedSnapshot = snap;

      aplicarSnapshot(snap);
      mostrarBannerView(snap);

      toast('📂 <b>Orçamento ' + (snap.agp || id.slice(0,16)) + ' v' + (snap.qtd_versoes||1) + ' aberto</b><br><span style="font-size:11px;font-weight:400;opacity:.9">Modo visualização — clique em ✏ Editar para modificar</span>', '#1a5276', 5000);
    } catch(err){
      console.error('[162-load] erro:', err);
      toast('❌ Erro ao abrir: ' + err.message, '#c0392b', 6000);
    }
  }
  window.orcAbrirOrcamento = orcAbrirOrcamento;

  async function orcExcluirOrcamento(id){
    if(!confirm('Excluir este orçamento? (soft delete)')) return;
    try {
      await fetchSupa('PATCH', TABLE + '?id=eq.' + encodeURIComponent(id),
        { deleted_at: new Date().toISOString() });
      $('orc-list-modal') && $('orc-list-modal').remove();
      abrirModalListaOrcamentos();
      toast('🗑 Orçamento excluído', '#7f8c8d');
    } catch(err){
      toast('❌ Erro: ' + err.message, '#c0392b');
    }
  }
  window.orcExcluirOrcamento = orcExcluirOrcamento;

  // ════════════════════════════════════════════════════════════════════════
  // 4. APLICAR SNAPSHOT (restaura DOM + arrays sem recalcular)
  // ════════════════════════════════════════════════════════════════════════

  function aplicarSnapshot(snap){
    if(!snap) return;
    try {
      // Restaurar arrays globais
      if(snap.resultado && snap.resultado.crmItens){
        window._crmItens = JSON.parse(JSON.stringify(snap.resultado.crmItens));
      }
      if(snap.itens){
        window._orcItens = JSON.parse(JSON.stringify(snap.itens));
      }
      if(snap.resultado && snap.resultado.orcItemAtual != null){
        window._orcItemAtual = snap.resultado.orcItemAtual;
      }

      // Re-renderizar lista de items no orçamento
      if(typeof window.orcItensRender === 'function'){
        try { window.orcItensRender(); } catch(e){}
      }

      // Popular campos do DOM
      var campos = snap.dados_projeto || {};
      Object.keys(campos).forEach(function(id){
        var el = $(id);
        if(!el) return;
        var v = campos[id];
        if(el.type === 'checkbox') el.checked = !!v;
        else el.value = v;
      });

      // Restaurar painel resultado via HTML salvo (fallback visual)
      if(snap.resultado && snap.resultado.html_visual){
        var hv = snap.resultado.html_visual;
        var rPorta = document.querySelector('.r-porta');
        if(rPorta && hv.rPorta) rPorta.innerHTML = hv.rPorta;
        var dre = document.querySelector('.dre');
        if(dre && hv.dre) dre.innerHTML = hv.dre;
      }

      // Restaurar planificador
      if(snap.resultado && snap.resultado.planificador){
        var pln = snap.resultado.planificador;
        if(pln.pieces) window._plnPieces = pln.pieces;
        if(pln.lastResult) window._plnLastResult = pln.lastResult;
        if(pln.cor) setF('plan-chapa', pln.cor);
        if(pln.largura) setF('plan-largura', pln.largura);
        if(pln.altura) setF('plan-altura', pln.altura);
      }
    } catch(e){
      console.error('[162-apply] err:', e);
      toast('⚠ Snapshot aplicado parcialmente: ' + e.message, '#e67e22');
    }
  }
  function setF(id, v){
    var el = $(id); if(!el) return;
    el.value = v;
    try { el.dispatchEvent(new Event('change',{bubbles:true})); } catch(e){}
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. MODO VIEW — suprime calc/recalculos
  // ════════════════════════════════════════════════════════════════════════

  function suprimirCalculosNoViewMode(){
    ['calc','_osAutoUpdate','planUpd','_osAutoGenerate'].forEach(function(fnName){
      var orig = window[fnName];
      if(typeof orig !== 'function') return;
      if(orig.__viewModeHooked) return;
      window[fnName] = function(){
        if(window._orcViewMode){
          // Suprimir silenciosamente no modo view
          return;
        }
        return orig.apply(this, arguments);
      };
      window[fnName].__viewModeHooked = true;
    });
  }

  function mostrarBannerView(snap){
    var existing = $('orc-view-banner'); if(existing) existing.remove();
    var b = document.createElement('div');
    b.id = 'orc-view-banner';
    b.style.cssText = 'position:fixed;top:60px;left:0;right:0;background:linear-gradient(90deg,#1a5276,#2874a6);color:#fff;padding:8px 20px;display:flex;justify-content:space-between;align-items:center;z-index:9998;font-family:inherit;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.2)';
    b.innerHTML =
      '<div>📂 <b>Visualizando:</b> ' + (snap.agp || snap.id.slice(0,20)) + ' · ' + (snap.cliente||'') + ' · v' + (snap.qtd_versoes||1) + ' <span style="opacity:.7;font-weight:400;font-size:11px">(modo somente leitura)</span></div>' +
      '<div style="display:flex;gap:8px">' +
        '<button onclick="orcSairViewMode()" style="background:#fff;color:#1a5276;border:none;border-radius:6px;padding:5px 14px;font-size:11px;font-weight:700;cursor:pointer">✏ Editar</button>' +
        '<button onclick="orcSairViewMode(true)" style="background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer">✕ Fechar</button>' +
      '</div>';
    document.body.insertBefore(b, document.body.firstChild);
  }

  function orcSairViewMode(fechar){
    window._orcViewMode = false;
    var b = $('orc-view-banner'); if(b) b.remove();
    if(fechar){
      window._orcLoadedId = null;
      window._orcLoadedSnapshot = null;
    }
    if(typeof window.calc === 'function') try{ window.calc(); }catch(e){}
    toast(fechar ? '✕ Visualização fechada' : '✏ Modo edição ativado — alterações vão recalcular automaticamente', '#7f8c8d', 3500);
  }
  window.orcSairViewMode = orcSairViewMode;

  // ════════════════════════════════════════════════════════════════════════
  // 6. UI — Botão verde substituído + botão "Meus Orçamentos" no header
  // ════════════════════════════════════════════════════════════════════════

  function instalarBotaoSalvar(){
    // Substituir comportamento do "Salvar Item Atual" (botão verde)
    // Mantém a função antiga rodando (salva no card) MAS antes salva orçamento completo
    var origAntiga = window.salvarItemAtualComBanco;
    window.salvarItemAtualComBanco = function(){
      // Chamar a antiga por compatibilidade (salva _orcItens em crm_oportunidades.extras)
      if(typeof origAntiga === 'function'){
        try { origAntiga.apply(this, arguments); } catch(e){}
      }
      // Chamar o novo save completo
      orcSalvarOrcamento();
    };

    // Atualizar texto do botão
    document.querySelectorAll('button').forEach(function(btn){
      if(btn.textContent && btn.textContent.indexOf('Salvar Item Atual') >= 0){
        btn.innerHTML = '💾 Salvar Orçamento';
        btn.title = 'Salva orçamento completo no Supabase (campos + planificador + resultado)';
      }
    });
  }

  function instalarBotaoMeusOrcamentos(){
    // Adiciona botão no header do CRM
    if($('btn-meus-orc')) return;
    var header = document.querySelector('.crm-header') || document.querySelector('header') || document.body;
    var btn = document.createElement('button');
    btn.id = 'btn-meus-orc';
    btn.innerHTML = '📂 Meus Orçamentos';
    btn.style.cssText = 'position:fixed;top:14px;right:200px;z-index:9997;background:#1a5276;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.15)';
    btn.onclick = abrirModalListaOrcamentos;
    document.body.appendChild(btn);
  }

  // ════════════════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════════════════
  function init(){
    setTimeout(function(){
      suprimirCalculosNoViewMode();
      instalarBotaoSalvar();
      instalarBotaoMeusOrcamentos();
    }, 1000);

    // Reforço periodico (caso o botão verde seja re-renderizado)
    setInterval(function(){
      try {
        instalarBotaoSalvar();
        if(!$('btn-meus-orc')) instalarBotaoMeusOrcamentos();
      } catch(e){}
    }, 4000);

    console.log('[162-orcamento-save-load] iniciado');
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Expor APIs
  window.orcSalvarOrcamento = orcSalvarOrcamento;
  window.orcAbrirListaOrcamentos = abrirModalListaOrcamentos;
  window.orcCapturarSnapshot = capturarSnapshot;
})();
