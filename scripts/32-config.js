/* 32-config.js — Modulo Configuracoes.
   Tela informativa do sistema:
     - card ViaCEP: info sobre a API publica usada pra resolver CEP
     - card Sobre o sistema: versao, uso de storage, botao de limpeza
   A integracao Weiku (mock/JSON/Supabase) costumava ficar aqui mas
   foi removida — sera reconstruida do zero direto via Supabase. */

/* ============================================================
   MODULO: CONFIGURACOES
   ============================================================
   Tela informativa do sistema. Atualmente mostra:
     - card ViaCEP    : info sobre a API publica usada pra resolver CEP
     - card Sobre o sistema : versao, uso de storage, botao de limpeza

   A integracao Weiku (mock/JSON/Supabase) costumava ficar aqui mas
   foi removida — sera reconstruida do zero direto via Supabase.
   ============================================================ */
const Config = (() => {

  function fmtBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    return (b/(1024*1024)).toFixed(2) + ' MB';
  }

  function showMsg(el, type, text) {
    if (!el) return;
    el.className = 'cfg-msg is-visible is-' + type;
    el.textContent = text;
  }

  function updateStorageUsage(container) {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('projetta:')) {
          total += (localStorage.getItem(key) || '').length;
        }
      }
      const el = container.querySelector('#cfg-storage-used');
      if (el) el.textContent = fmtBytes(total) + ' (limite ~5MB)';
    } catch (_) {}
  }

  function render(container) {
    // Pega versao mostrada no rodape
    const versaoEl = document.getElementById('build-hash');
    const versao = versaoEl ? versaoEl.textContent.trim() : 'core ?';

    container.innerHTML = `
      <div class="cfg-grid">

        <div class="cfg-card">
          <div class="cfg-card-header">
            <div class="cfg-card-title">💵 Cambio USD - BRL</div>
            <span class="cfg-status-pill ativo" id="cfg-cambio-pill">—</span>
          </div>
          <div class="cfg-info" id="cfg-cambio-info">
            Taxa usada em <strong>todo o sistema</strong> quando o destino e' Internacional
            (proposta comercial, DRE, frete maritimo).
            A PTAX (BCB) e' baixada automaticamente, mas voce pode inserir uma taxa manual
            que vai <strong>sobrescrever</strong> a oficial em todos os calculos.
          </div>
          <div class="cfg-form-row" style="margin-top:12px; display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;">
            <div style="flex:1; min-width:180px;">
              <label class="cfg-label">Taxa manual (BRL/USD)</label>
              <input type="number" step="0.0001" min="0" id="cfg-cambio-manual"
                     placeholder="ex.: 5.4200" style="width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:6px;" />
            </div>
            <button class="cfg-btn cfg-btn-primary" id="cfg-cambio-salvar">Salvar taxa</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-cambio-limpar">Usar PTAX</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-cambio-atualizar">⟳ Atualizar PTAX</button>
          </div>
          <div id="cfg-cambio-hist" style="margin-top:12px;"></div>
          <div class="cfg-msg" id="cfg-cambio-msg"></div>
        </div>

        <!-- Felipe sessao 31: card de TARIFAS DE FRETE INTERNACIONAL editaveis.
             Aplica tudo do modulo 09d-frete-tarifas.js + storage kv_store.
             Pergunta do Felipe: 'aonde estao os parametros que calculam o frete?'. -->
        <div class="cfg-card" style="grid-column: 1 / -1;">
          <div class="cfg-card-header">
            <div class="cfg-card-title">🚢 Tarifas de Frete Internacional</div>
            <span class="cfg-status-pill ativo" id="cfg-frete-pill">—</span>
          </div>
          <div class="cfg-info">
            Parametros usados pra calcular automaticamente o frete LCL no modal do lead Internacional.
            Todos os valores sao em USD. Alteracoes salvas aqui aplicam <strong>imediatamente</strong>
            em todos os calculos do sistema (modal lead, custo fab, DRE, proposta).
          </div>

          <div id="cfg-frete-tabs" style="margin-top:12px; display:flex; gap:4px; flex-wrap:wrap; border-bottom:1px solid #ddd; padding-bottom:0;">
            <button class="cfg-frete-tab is-ativa" data-frete-tab="basicos">📦 Caixa + Terrestre</button>
            <button class="cfg-frete-tab" data-frete-tab="origem_fixos">📋 Origem Fixos</button>
            <button class="cfg-frete-tab" data-frete-tab="origem_var">📊 Origem Variaveis</button>
            <button class="cfg-frete-tab" data-frete-tab="ocean">🌍 Ocean Freight por Regiao</button>
            <button class="cfg-frete-tab" data-frete-tab="condicionais">⚙️ Condicionais</button>
            <button class="cfg-frete-tab" data-frete-tab="seguro">🛡️ Seguro</button>
          </div>

          <div id="cfg-frete-conteudo" style="padding:14px 0; min-height:200px;"></div>

          <div style="display:flex; gap:8px; padding-top:12px; border-top:1px solid #ddd;">
            <button class="cfg-btn cfg-btn-primary" id="cfg-frete-salvar">💾 Salvar alteracoes</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-frete-restaurar">↺ Restaurar padrao</button>
            <div style="flex:1;"></div>
            <span id="cfg-frete-modificado" style="font-size:11px; color:#999;"></span>
          </div>
          <div class="cfg-msg" id="cfg-frete-msg"></div>
        </div>

        <div class="cfg-card">
          <div class="cfg-card-header">
            <div class="cfg-card-title">ViaCEP</div>
            <span class="cfg-status-pill ativo">✓ Ativo</span>
          </div>
          <div class="cfg-info">
            API publica brasileira (<span class="t-strong">viacep.com.br</span>), sem chave nem configuracao.
            Usado pra preencher cidade e estado automaticamente quando voce digita um CEP no modal.
          </div>
        </div>

        <div class="cfg-card">
          <div class="cfg-card-header">
            <div class="cfg-card-title">☁ Sincronizacao com servidor</div>
          </div>
          <div class="cfg-info" id="cfg-sync-info">
            Verificando...
          </div>
          <div class="cfg-btn-row">
            <button class="cfg-btn cfg-btn-secondary" id="cfg-sync-now">🔄 Sincronizar agora</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-sync-test">🧪 Testar conexao</button>
            <button class="cfg-btn cfg-btn-secondary" id="cfg-migrar-imgs">🖼 Migrar imagens p/ Storage</button>
          </div>
          <div class="cfg-msg" id="cfg-sync-msg"></div>
        </div>

        <div class="cfg-card">
          <div class="cfg-card-header">
            <div class="cfg-card-title">Sobre o sistema</div>
          </div>
          <div class="cfg-info">
            Versao: <span class="t-strong">${versao}</span><br>
            Cache local: <strong id="cfg-storage-used">calculando...</strong><br>
            Source of truth: <strong>Supabase</strong> (todos cadastros, orcamentos e imagens).<br>
            O cache local e' apenas para performance — pode ser limpo a qualquer momento.
          </div>
          <div class="cfg-btn-row">
            <button class="cfg-btn cfg-btn-secondary" id="cfg-clear-cache">🗑 Limpar cache local</button>
          </div>
          <div class="cfg-msg" id="cfg-system-msg"></div>
        </div>

      </div>
    `;
    bindEvents(container);
    updateStorageUsage(container);
    updateSyncStatus(container);
    updateCambioCard(container);
    initFreteCard(container);
  }

  /**
   * Felipe sessao 31: gerencia o card de Tarifas de Frete Internacional.
   * Aba ativa, edicao inline, salvar/restaurar via modulo FreteTarifas.
   */
  let _freteEditado = null;
  let _freteAbaAtiva = 'basicos';

  function initFreteCard(container) {
    if (!window.FreteTarifas) return;
    window.FreteTarifas.carregar().then(t => {
      _freteEditado = JSON.parse(JSON.stringify(t));
      renderFreteTab(container);
      // Pill status
      const pill = container.querySelector('#cfg-frete-pill');
      if (pill) {
        pill.textContent = '✓ ' + Object.keys(t.ocean_freight_por_regiao).length + ' regioes';
      }
      // Tabs
      container.querySelectorAll('.cfg-frete-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          _freteAbaAtiva = btn.dataset.freteTab;
          container.querySelectorAll('.cfg-frete-tab').forEach(b => b.classList.toggle('is-ativa', b === btn));
          renderFreteTab(container);
        });
      });
      // Salvar
      const btnSalvar = container.querySelector('#cfg-frete-salvar');
      if (btnSalvar) btnSalvar.addEventListener('click', () => salvarFrete(container));
      // Restaurar padrao
      const btnRest = container.querySelector('#cfg-frete-restaurar');
      if (btnRest) btnRest.addEventListener('click', () => {
        if (!confirm('Restaurar todas as taxas pros valores padrao? Suas customizacoes serao perdidas.')) return;
        _freteEditado = JSON.parse(JSON.stringify(window.FreteTarifas.defaults()));
        renderFreteTab(container);
        showMsg(container.querySelector('#cfg-frete-msg'), 'info', 'Valores padrao carregados — clique em Salvar pra aplicar.');
      });
    });
  }

  function renderFreteTab(container) {
    const cont = container.querySelector('#cfg-frete-conteudo');
    if (!cont || !_freteEditado) return;
    let html = '';
    if (_freteAbaAtiva === 'basicos') {
      html = renderFreteBasicos(_freteEditado);
    } else if (_freteAbaAtiva === 'origem_fixos') {
      html = renderFreteGrupo(_freteEditado.origem_fixos, 'origem_fixos', 'Origem - Fixos (USD por embarque)');
    } else if (_freteAbaAtiva === 'origem_var') {
      html = renderFreteGrupo(_freteEditado.origem_variaveis, 'origem_variaveis', 'Origem - Variaveis (USD por m³)');
    } else if (_freteAbaAtiva === 'ocean') {
      html = renderFreteRegioes(_freteEditado.ocean_freight_por_regiao);
    } else if (_freteAbaAtiva === 'condicionais') {
      html = renderFreteGrupo(_freteEditado.condicionais, 'condicionais', 'Condicionais (USD - aplicam conforme regra)');
    } else if (_freteAbaAtiva === 'seguro') {
      html = renderFreteSeguro(_freteEditado);
    }
    cont.innerHTML = html;
    bindFreteInputs(container);
  }

  function renderFreteBasicos(t) {
    return `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
        <div style="padding:12px; background:#fff8e1; border:1px solid #ffe0a3; border-radius:6px;">
          <div style="font-weight:600; color:#856404; margin-bottom:8px;">📦 Caixa Fumigada</div>
          <label style="display:block; font-size:11px; color:#666; margin-bottom:4px;">Preco USD por m³ (cotacao p/ cliente)</label>
          <input type="number" min="0" step="1" data-frete-path="caixa_fumigada.preco_usd_m3"
                 value="${t.caixa_fumigada.preco_usd_m3}"
                 style="width:100%; padding:8px 10px; border:1px solid #d4a418; border-radius:5px; font-weight:600;" />
          <div style="font-size:10px; color:#856404; margin-top:6px; font-style:italic;">
            ${t.caixa_fumigada.observacao}<br>
            Media observada nos 4 ultimos pedidos: USD ${t.caixa_fumigada.media_real_obs}/m³
          </div>
        </div>
        <div style="padding:12px; background:#e0f2fe; border:1px solid #b8dbff; border-radius:6px;">
          <div style="font-weight:600; color:#0c5485; margin-bottom:8px;">🚛 Frete Terrestre</div>
          <label style="display:block; font-size:11px; color:#666; margin-bottom:4px;">Uberlandia → Santos (USD por viagem)</label>
          <input type="number" min="0" step="50" data-frete-path="frete_terrestre.uberlandia_santos_usd"
                 value="${t.frete_terrestre.uberlandia_santos_usd}"
                 style="width:100%; padding:8px 10px; border:1px solid #0c5485; border-radius:5px; font-weight:600;" />
          <div style="font-size:10px; color:#0c5485; margin-top:6px; font-style:italic;">
            ${t.frete_terrestre.observacao}
          </div>
        </div>
      </div>
    `;
  }

  function renderFreteGrupo(grupo, path, titulo) {
    const linhas = Object.entries(grupo).map(([k, v]) => `
      <div style="display:grid; grid-template-columns:1fr 110px 100px; gap:10px; align-items:center; padding:6px 0; border-bottom:1px solid #eef3f8;">
        <div>
          <div style="font-size:12px; font-weight:500; color:#333;">${v.label}</div>
          <div style="font-size:10px; color:#999;">${v.aplica ? '⚠️ ' + v.aplica : ''}${v.aplica ? ' · ' : ''}por ${v.unidade}</div>
        </div>
        <input type="number" min="0" step="1" data-frete-path="${path}.${k}.valor"
               value="${v.valor}" style="padding:6px 8px; border:1px solid #cfd8e3; border-radius:5px; text-align:right; font-weight:600;" />
        <div style="font-size:10px; color:#999; text-align:right;">USD / ${v.unidade}</div>
      </div>
    `).join('');
    return `<div style="font-size:13px; font-weight:600; color:#0c5485; margin-bottom:8px;">${titulo}</div>${linhas}`;
  }

  function renderFreteRegioes(regioes) {
    const linhas = Object.entries(regioes).map(([k, v]) => `
      <div style="display:grid; grid-template-columns:1fr 110px 100px; gap:10px; align-items:center; padding:6px 0; border-bottom:1px solid #eef3f8;">
        <div>
          <div style="font-size:12px; font-weight:500; color:#333;">${v.label}</div>
          <div style="font-size:10px; color:#999;">${v.exemplos || ''}</div>
        </div>
        <input type="number" min="0" step="5" data-frete-path="ocean_freight_por_regiao.${k}.valor"
               value="${v.valor}" style="padding:6px 8px; border:1px solid #cfd8e3; border-radius:5px; text-align:right; font-weight:600;" />
        <div style="font-size:10px; color:#999; text-align:right;">USD / m³</div>
      </div>
    `).join('');
    return `
      <div style="font-size:13px; font-weight:600; color:#0c5485; margin-bottom:8px;">Ocean Freight LCL — Base por Regiao (USD/m³)</div>
      <div style="font-size:11px; color:#666; margin-bottom:12px;">
        Tarifa base do frete maritimo por regiao do mundo. Valor multiplicado pelo m³ da caixa.
        Editar conforme cotacoes vigentes do seu agente de frete (TPLProvider ou outro).
      </div>
      ${linhas}
    `;
  }

  function renderFreteSeguro(t) {
    return `
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px;">
        <div>
          <label style="display:block; font-size:11px; color:#666; margin-bottom:4px;">Percentual do seguro</label>
          <input type="number" min="0" step="0.05" data-frete-path="seguro.percentual"
                 value="${t.seguro.percentual}"
                 style="width:100%; padding:8px 10px; border:1px solid #cfd8e3; border-radius:5px;" />
          <div style="font-size:10px; color:#999; margin-top:4px;">% sobre valor da carga</div>
        </div>
        <div>
          <label style="display:block; font-size:11px; color:#666; margin-bottom:4px;">Multiplicador (Cobertura)</label>
          <input type="number" min="1" step="0.05" data-frete-path="seguro.cobertura"
                 value="${t.seguro.cobertura}"
                 style="width:100%; padding:8px 10px; border:1px solid #cfd8e3; border-radius:5px;" />
          <div style="font-size:10px; color:#999; margin-top:4px;">1.10 = 110% padrao ICC</div>
        </div>
        <div>
          <label style="display:block; font-size:11px; color:#666; margin-bottom:4px;">Minimo da apolice (USD)</label>
          <input type="number" min="0" step="5" data-frete-path="seguro.minimo_usd"
                 value="${t.seguro.minimo_usd}"
                 style="width:100%; padding:8px 10px; border:1px solid #cfd8e3; border-radius:5px;" />
          <div style="font-size:10px; color:#999; margin-top:4px;">USD por embarque</div>
        </div>
      </div>
      <div style="margin-top:12px; padding:10px; background:#f0f7ff; border-left:3px solid #0c5485; font-size:11px; color:#0c5485;">
        Aplicado quando incoterm = <b>CIF</b> · <b>CIP</b> · <b>DAP</b> · <b>DPU</b> · <b>DDP</b>. Formula:
        <br><code style="background:#fff; padding:2px 6px; border-radius:3px;">max(minimo, valor_carga × percentual × cobertura)</code>
      </div>
    `;
  }

  function bindFreteInputs(container) {
    container.querySelectorAll('input[data-frete-path]').forEach(inp => {
      inp.addEventListener('input', () => {
        const path = inp.dataset.fretePath.split('.');
        let obj = _freteEditado;
        for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
        obj[path[path.length - 1]] = Number(inp.value) || 0;
        const mod = container.querySelector('#cfg-frete-modificado');
        if (mod) mod.textContent = '⚠️ Alteracoes nao salvas';
      });
    });
  }

  async function salvarFrete(container) {
    if (!window.FreteTarifas || !_freteEditado) return;
    try {
      await window.FreteTarifas.salvar(_freteEditado);
      const mod = container.querySelector('#cfg-frete-modificado');
      if (mod) mod.textContent = '';
      showMsg(container.querySelector('#cfg-frete-msg'), 'sucesso',
        '✓ Tarifas salvas! Aplicadas imediatamente em todos os calculos do sistema.');
    } catch (e) {
      showMsg(container.querySelector('#cfg-frete-msg'), 'erro', 'Erro ao salvar: ' + e.message);
    }
  }

  /**
   * Felipe sessao 31: atualiza o card de cambio com PTAX em cache,
   * historico dos ultimos 30 dias e taxa manual atual.
   */
  function updateCambioCard(container) {
    if (!window.Cambio) return;
    const inpManual = container.querySelector('#cfg-cambio-manual');
    const pill = container.querySelector('#cfg-cambio-pill');
    const histDiv = container.querySelector('#cfg-cambio-hist');
    if (!inpManual || !pill || !histDiv) return;

    const manual = window.Cambio.getManual();
    const ptax = window.Cambio.getPtax();
    const hist = window.Cambio.getHistorico();

    inpManual.value = manual > 0 ? manual.toFixed(4) : '';

    if (manual > 0) {
      pill.textContent = 'Manual: R$ ' + manual.toFixed(4);
      pill.className = 'cfg-status-pill ativo';
    } else if (ptax && ptax.valor) {
      pill.textContent = 'PTAX: R$ ' + Number(ptax.valor).toFixed(4) + ' (' + (ptax.data || '?') + ')';
      pill.className = 'cfg-status-pill ativo';
    } else {
      pill.textContent = '⚠ Sem taxa';
      pill.className = 'cfg-status-pill inativo';
    }

    if (hist && hist.length) {
      // Felipe sessao 31: medias dos ultimos 30/60/90 dias uteis.
      // Util pra ver se hoje o dolar esta em pico ou vale.
      const m30 = window.Cambio.mediaPtax(30);
      const m60 = window.Cambio.mediaPtax(60);
      const m90 = window.Cambio.mediaPtax(90);
      function celMedia(label, valor, qtdDias) {
        const usado = Math.min(qtdDias, hist.length);
        if (!valor) {
          return '<div style="padding:8px 12px;"><div style="font-size:11px; color:#666; text-transform:uppercase;">' + label + '</div><div style="font-size:14px; color:#aaa;">—</div></div>';
        }
        return '<div style="padding:8px 12px;">' +
          '<div style="font-size:11px; color:#666; text-transform:uppercase;">' + label + '</div>' +
          '<div style="font-size:15px; font-weight:600; font-variant-numeric:tabular-nums;">R$ ' + valor.toFixed(4) + '</div>' +
          '<div style="font-size:10px; color:#999;">' + usado + ' dias</div>' +
          '</div>';
      }
      const cards =
        '<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:10px; background:#f7f8fa; border:1px solid #e5e7eb; border-radius:8px; padding:6px;">' +
          celMedia('Media 30d', m30, 30) +
          celMedia('Media 60d', m60, 60) +
          celMedia('Media 90d', m90, 90) +
        '</div>';

      const linhas = hist.slice(0, 90).map(h => {
        const d = (h.data || '').split('-').reverse().join('/');
        return '<tr><td style="padding:3px 8px;">' + d + '</td><td style="padding:3px 8px; text-align:right; font-variant-numeric:tabular-nums;">R$ ' + Number(h.valor).toFixed(4) + '</td></tr>';
      }).join('');
      histDiv.innerHTML =
        cards +
        '<div style="font-size:12px; color:#666; margin-bottom:4px;">Historico PTAX (' + hist.length + ' dias uteis):</div>' +
        '<div style="max-height:180px; overflow:auto; border:1px solid #eee; border-radius:6px;">' +
        '<table style="width:100%; font-size:12px; border-collapse:collapse;"><tbody>' + linhas + '</tbody></table>' +
        '</div>';
    } else {
      histDiv.innerHTML =
        '<div style="font-size:12px; color:#999;">Historico PTAX nao baixado ainda. Clique em "Atualizar PTAX".</div>';
    }
  }

  function updateSyncStatus(container) {
    const info = container.querySelector('#cfg-sync-info');
    if (!info) return;
    if (!window.CadastrosAutosync) {
      info.innerHTML = '<span style="color:#c62828">⚠ Modulo de sync nao carregado. Recarregue a pagina.</span>';
      return;
    }
    function fmtTimestamp(ts) {
      if (!ts) return 'nunca';
      const d = new Date(ts);
      return d.toLocaleTimeString('pt-BR') + ' (' + d.toLocaleDateString('pt-BR') + ')';
    }
    function refresh() {
      const s = window.CadastrosAutosync.getStatus();
      const onlineIcon = s.online ? '🟢' : '🔴';
      const onlineLabel = s.online ? 'Online (conectado ao Supabase)' : 'Offline (sem conexao)';
      const loadIcon = s.initialLoadDone ? '✓' : '⏳';
      const loadLabel = s.initialLoadDone ? 'Carga inicial concluida' : 'Carregando dados do servidor...';
      info.innerHTML = ''
        + '<div style="margin-bottom:6px">' + onlineIcon + ' <strong>' + onlineLabel + '</strong></div>'
        + '<div style="margin-bottom:6px">' + loadIcon + ' ' + loadLabel + '</div>'
        + '<div style="margin-bottom:6px">📤 Itens na fila: <strong>' + (s.syncQueueLen || 0) + '</strong></div>'
        + '<div style="margin-bottom:6px">🕒 Ultimo sync: <strong>' + fmtTimestamp(s.lastSync) + '</strong></div>'
        + (s.error ? '<div style="color:#c62828;margin-top:6px">⚠ ' + s.error + '</div>' : '');
    }
    refresh();
    if (window.CadastrosAutosync.onStatusChange) {
      window.CadastrosAutosync.onStatusChange(refresh);
    }
    // Atualiza a cada 3s
    if (!container._syncInterval) {
      container._syncInterval = setInterval(refresh, 3000);
    }
  }

  function bindEvents(container) {
    const btnClearCache = container.querySelector('#cfg-clear-cache');
    const msgSys = container.querySelector('#cfg-system-msg');
    const btnSyncNow = container.querySelector('#cfg-sync-now');
    const btnSyncTest = container.querySelector('#cfg-sync-test');
    const btnMigrarImgs = container.querySelector('#cfg-migrar-imgs');
    const msgSync = container.querySelector('#cfg-sync-msg');

    // Felipe sessao 31: card de cambio
    const inpCambio = container.querySelector('#cfg-cambio-manual');
    const btnSalvar = container.querySelector('#cfg-cambio-salvar');
    const btnLimpar = container.querySelector('#cfg-cambio-limpar');
    const btnAtualizar = container.querySelector('#cfg-cambio-atualizar');
    const msgCambio = container.querySelector('#cfg-cambio-msg');

    if (btnSalvar && inpCambio) {
      btnSalvar.addEventListener('click', () => {
        if (!window.Cambio) return;
        const v = Number(inpCambio.value) || 0;
        if (v <= 0) {
          showMsg(msgCambio, 'error', '✗ Informe um valor maior que zero');
          return;
        }
        window.Cambio.setManual(v);
        showMsg(msgCambio, 'ok', '✓ Taxa manual salva: R$ ' + v.toFixed(4) + ' / USD. Vai ser usada em todo o sistema.');
        updateCambioCard(container);
      });
    }

    if (btnLimpar) {
      btnLimpar.addEventListener('click', () => {
        if (!window.Cambio) return;
        window.Cambio.setManual(0);
        if (inpCambio) inpCambio.value = '';
        showMsg(msgCambio, 'ok', '✓ Taxa manual removida. Sistema vai usar PTAX (BCB).');
        updateCambioCard(container);
      });
    }

    if (btnAtualizar) {
      btnAtualizar.addEventListener('click', async () => {
        if (!window.Cambio) return;
        btnAtualizar.disabled = true;
        btnAtualizar.textContent = '⏳ Baixando...';
        showMsg(msgCambio, 'info', 'Baixando cotacao PTAX dos ultimos 30 dias do BCB...');
        const r = await window.Cambio.atualizarPtax();
        btnAtualizar.disabled = false;
        btnAtualizar.textContent = '⟳ Atualizar PTAX';
        if (r.ok) {
          showMsg(msgCambio, 'ok',
            '✓ PTAX atualizada: R$ ' + Number(r.ptax.valor).toFixed(4) +
            ' (' + (r.ptax.data || '?') + ') — ' + r.historico.length + ' dias uteis baixados');
        } else {
          showMsg(msgCambio, 'error', '✗ Falhou: ' + (r.erro || 'erro desconhecido'));
        }
        updateCambioCard(container);
      });
    }

    if (btnMigrarImgs) {
      btnMigrarImgs.addEventListener('click', async () => {
        if (!window.CadastrosAutosync || !window.CadastrosAutosync.migrarImagensBase64ParaStorage) {
          showMsg(msgSync, 'error', '✗ Funcao de migracao nao disponivel');
          return;
        }
        btnMigrarImgs.disabled = true;
        btnMigrarImgs.textContent = '⏳ Migrando...';
        showMsg(msgSync, 'info', 'Verificando imagens em base64 e enviando para o Storage...');
        try {
          const result = await window.CadastrosAutosync.migrarImagensBase64ParaStorage();
          if (result.erro) {
            showMsg(msgSync, 'error', '✗ Erro: ' + result.erro);
          } else if (result.total === 0) {
            showMsg(msgSync, 'ok', '✓ Nenhuma imagem em base64 encontrada. Tudo ja esta no Storage!');
          } else {
            showMsg(msgSync, 'ok', '✓ ' + result.migradas + ' de ' + result.total + ' imagens migradas para o Storage' + (result.falhas > 0 ? ' (' + result.falhas + ' falharam)' : ''));
          }
        } catch (err) {
          showMsg(msgSync, 'error', '✗ ' + err.message);
        }
        btnMigrarImgs.disabled = false;
        btnMigrarImgs.textContent = '🖼 Migrar imagens p/ Storage';
        updateSyncStatus(container);
      });
    }

    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', async () => {
        if (!window.CadastrosAutosync) {
          showMsg(msgSync, 'error', '✗ Modulo de sync nao disponivel');
          return;
        }
        btnSyncNow.disabled = true;
        btnSyncNow.textContent = '⏳ Sincronizando...';
        showMsg(msgSync, 'info', 'Enviando todos cadastros locais para o Supabase...');
        try {
          const result = await window.CadastrosAutosync.syncTudoAgora();
          if (result.erro) {
            showMsg(msgSync, 'error', '✗ Erro: ' + result.erro);
          } else {
            showMsg(msgSync, 'ok', '✓ ' + result.ok + ' de ' + result.total + ' cadastros sincronizados');
          }
        } catch (err) {
          showMsg(msgSync, 'error', '✗ ' + err.message);
        }
        btnSyncNow.disabled = false;
        btnSyncNow.textContent = '🔄 Sincronizar agora';
        updateSyncStatus(container);
      });
    }

    if (btnSyncTest) {
      btnSyncTest.addEventListener('click', async () => {
        btnSyncTest.disabled = true;
        btnSyncTest.textContent = '⏳ Testando...';
        showMsg(msgSync, 'info', 'Conectando ao Supabase...');
        try {
          const resp = await fetch('https://plmliavuwlgpwaizfeds.supabase.co/rest/v1/cadastros?limit=1&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858', {
            headers: { 'Accept-Profile': 'v7' }
          });
          if (resp.ok) {
            // Conta total de cadastros no Supabase
            const respCount = await fetch('https://plmliavuwlgpwaizfeds.supabase.co/rest/v1/cadastros?select=chave&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbWxpYXZ1d2xncHdhaXpmZWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzI3NTUsImV4cCI6MjA5MDkwODc1NX0.VY8H3RWFGXK11-86Krt7Z-DCbWuiclRKtD3A3h7W858', {
              headers: { 'Accept-Profile': 'v7' }
            });
            const arr = await respCount.json();
            const chaves = Array.isArray(arr) ? arr.map(r => r.chave).join(', ') : '';
            showMsg(msgSync, 'ok', '✓ Conexao OK. ' + (Array.isArray(arr) ? arr.length : 0) + ' cadastros no servidor: ' + chaves);
          } else {
            showMsg(msgSync, 'error', '✗ Erro HTTP ' + resp.status);
          }
        } catch (err) {
          showMsg(msgSync, 'error', '✗ Sem conexao: ' + err.message);
        }
        btnSyncTest.disabled = false;
        btnSyncTest.textContent = '🧪 Testar conexao';
      });
    }

    if (btnClearCache) {
      btnClearCache.addEventListener('click', () => {
        if (!confirm('Limpar TODOS os dados locais (CRM, cadastros, modelos, sessao)?\n\nEsta acao NAO pode ser desfeita. Voce sera deslogado.')) return;
        try {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('projetta:')) keys.push(k);
          }
          keys.forEach(k => localStorage.removeItem(k));
          showMsg(msgSys, 'ok', `✓ ${keys.length} chaves removidas. Recarregue a pagina pra ver mudancas.`);
        } catch (err) {
          showMsg(msgSys, 'error', '✗ ' + err.message);
        }
      });
    }
  }

  return { render };
})();

App.register('config', {
  render(container) {
    Config.render(container);
  }
});

