/* ============================================================
   27-precificacao.js — Cadastros > Precificacao
   ============================================================
   Felipe (sessao 2026-05): centraliza valores padrao que antes
   eram hardcoded ou preenchidos manualmente em cada orcamento.

   Valores cadastrados aqui sao usados como DEFAULTS quando uma
   nova versao de orcamento e' criada. O usuario ainda pode
   alterar manualmente em cada orcamento (a precificacao e' so'
   um ponto de partida).

   Campos:
     - n_operarios:        operarios padrao (default 2)
     - custo_hora_fab:     custo/hora fabricacao (default 110)
     - custo_hora_inst:    custo/hora instalacao (default 110)
     - diaria_pessoa:      diaria por pessoa em viagem (default 550)
     - diaria_hotel:       fallback hotel se cidade nao cadastrada (default 350)
     - alimentacao_dia:    alimentacao R$/pax/dia (default 90)

   Cotacoes de hotel por cidade:
     - lista de { cidade, uf, diaria, atualizadoEm }
     - quando o orcamento detectar a cidade do lead, prioriza essa
       cotacao especifica; senao cai no fallback (diaria_hotel).

   Storage:
     scope 'cadastros', chaves:
       - precificacao_valores  (objeto principal)
       - precificacao_hoteis   (lista de cotacoes por cidade)

   API publica em window.Precificacao:
     - obterValores()                → objeto com todos os valores padrao
     - salvarValores(obj)            → persiste alteracoes
     - obterValor(chave, fallback)   → 1 valor especifico, com fallback
     - obterDiariaHotelCidade(cid)   → cotacao por cidade ou fallback
     - listarHoteis() / salvarHoteis(arr)
     - render(container)             → UI do cadastro
   ============================================================ */
const Precificacao = (() => {
  'use strict';

  // Valores default (aplicados APENAS se o cadastro estiver vazio).
  // Felipe pediu pra manter os 2 operarios e 110/h como referencia.
  const DEFAULTS = Object.freeze({
    n_operarios:      2,
    custo_hora_fab:   110,
    custo_hora_inst:  110,
    diaria_pessoa:    550,
    diaria_hotel:     350,
    alimentacao_dia:  90,
  });

  function store() { return Storage.scope('cadastros'); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtBR(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function parseBR(s) {
    if (s === null || s === undefined) return 0;
    const t = String(s).replace(/\./g, '').replace(',', '.').trim();
    return parseFloat(t) || 0;
  }

  // ---------------- ESTADO ----------------
  function obterValores() {
    const salvo = store().get('precificacao_valores') || {};
    return Object.assign({}, DEFAULTS, salvo);
  }
  function salvarValores(obj) {
    const atual = obterValores();
    const novo  = Object.assign({}, atual, obj || {});
    store().set('precificacao_valores', novo);
    return novo;
  }
  function obterValor(chave, fallback) {
    const v = obterValores()[chave];
    return (v === '' || v === null || v === undefined) ? fallback : v;
  }

  function listarHoteis() {
    return store().get('precificacao_hoteis') || [];
  }
  function salvarHoteis(arr) {
    store().set('precificacao_hoteis', Array.isArray(arr) ? arr : []);
  }
  function obterDiariaHotelCidade(cidadeOuLead) {
    // Aceita string (cidade) ou objeto lead com {cidade, estado}
    let cidade = '', uf = '';
    if (typeof cidadeOuLead === 'string') {
      cidade = cidadeOuLead;
    } else if (cidadeOuLead && typeof cidadeOuLead === 'object') {
      cidade = cidadeOuLead.cidade || '';
      uf     = cidadeOuLead.estado || cidadeOuLead.uf || '';
    }
    const norm = (s) => String(s || '').trim().toLowerCase();
    const lista = listarHoteis();
    if (cidade) {
      // 1. Match exato cidade+uf
      const exato = lista.find(h =>
        norm(h.cidade) === norm(cidade) &&
        (!uf || norm(h.uf) === norm(uf))
      );
      if (exato && Number(exato.diaria) > 0) return Number(exato.diaria);
      // 2. Match so' por cidade
      const soCidade = lista.find(h => norm(h.cidade) === norm(cidade));
      if (soCidade && Number(soCidade.diaria) > 0) return Number(soCidade.diaria);
    }
    // 3. Fallback: valor padrao do cadastro
    return Number(obterValor('diaria_hotel', DEFAULTS.diaria_hotel));
  }

  // ---------------- RENDER ----------------
  function render(container) {
    const vals = obterValores();
    const hoteis = listarHoteis();

    const linhasHoteis = hoteis.length === 0
      ? `<tr class="prc-hot-empty"><td colspan="5">Nenhuma cotacao cadastrada — sera usado o fallback (R$ ${fmtBR(vals.diaria_hotel)}).</td></tr>`
      : hoteis.map((h, idx) => `
          <tr data-idx="${idx}">
            <td><input type="text" class="cad-input prc-hot-cidade" data-field="cidade" value="${escapeHtml(h.cidade || '')}" /></td>
            <td><input type="text" class="cad-input prc-hot-uf" data-field="uf" maxlength="2" value="${escapeHtml(h.uf || '')}" /></td>
            <td><input type="text" class="cad-input prc-hot-money" data-field="diaria" value="${escapeHtml(fmtBR(h.diaria || 0))}" /></td>
            <td class="prc-hot-data">${escapeHtml(h.atualizadoEm || '—')}</td>
            <td class="actions"><button type="button" class="row-delete prc-hot-del" data-idx="${idx}" title="Remover">×</button></td>
          </tr>
        `).join('');

    container.innerHTML = `
      <div class="prc-wrap">
        <!-- ============================================
             VALORES PADRAO (PARAMETROS GLOBAIS)
             ============================================ -->
        <div class="prc-section">
          <div class="prc-section-head">
            <h3 class="prc-section-titulo">Valores Padrao — Parametros Globais</h3>
            <p class="prc-section-sub">Esses valores sao aplicados como defaults em <span class="t-strong">cada novo orcamento</span>. O usuario ainda pode alterar manualmente na aba <span class="t-strong">Custo Fab/Inst</span>.</p>
          </div>

          <div class="prc-grid">
            <!-- Bloco: Fabricacao -->
            <div class="prc-bloco">
              <div class="prc-bloco-titulo">Fabricacao</div>

              <div class="prc-field">
                <label>Operarios padrao</label>
                <input type="text" class="cad-input prc-input prc-w-num" data-field="n_operarios" value="${escapeHtml(String(vals.n_operarios))}" />
                <span class="prc-help">multiplica as horas — ex: 2 operarios em paralelo</span>
              </div>

              <div class="prc-field">
                <label>Custo por hora — Fabricacao (R$/h)</label>
                <input type="text" class="cad-input prc-input prc-w-money" data-field="custo_hora_fab" value="${escapeHtml(fmtBR(vals.custo_hora_fab))}" />
                <span class="prc-help">aplicado nas etapas Portal, Folha, Colagem, Corte, Conferencia</span>
              </div>
            </div>

            <!-- Bloco: Equipe em viagem -->
            <div class="prc-bloco">
              <div class="prc-bloco-titulo">Equipe em viagem (Instalacao)</div>

              <div class="prc-field">
                <label>Diaria por pessoa (R$/dia)</label>
                <input type="text" class="cad-input prc-input prc-w-money" data-field="diaria_pessoa" value="${escapeHtml(fmtBR(vals.diaria_pessoa))}" />
                <span class="prc-help">salario diario por instalador</span>
              </div>

              <div class="prc-field">
                <label>Alimentacao (R$/pax/dia)</label>
                <input type="text" class="cad-input prc-input prc-w-money" data-field="alimentacao_dia" value="${escapeHtml(fmtBR(vals.alimentacao_dia))}" />
                <span class="prc-help">3 refeicoes por dia, por pessoa</span>
              </div>

              <div class="prc-field">
                <label>Diaria de hotel — fallback (R$)</label>
                <input type="text" class="cad-input prc-input prc-w-money" data-field="diaria_hotel" value="${escapeHtml(fmtBR(vals.diaria_hotel))}" />
                <span class="prc-help">aplicado quando NAO ha cotacao especifica para a cidade do lead</span>
              </div>
            </div>
          </div>

          <div class="prc-actions">
            <button type="button" class="btn btn-primary" id="prc-btn-salvar">💾 Salvar valores padrao</button>
            <span class="prc-msg" id="prc-msg"></span>
          </div>
        </div>

        <!-- ============================================
             COTACOES DE HOTEL POR CIDADE
             ============================================ -->
        <div class="prc-section">
          <div class="prc-section-head">
            <h3 class="prc-section-titulo">Cotacoes de Hotel por Cidade</h3>
            <p class="prc-section-sub">Adicione cotacoes obtidas para cada cidade. Se a cidade do lead estiver cadastrada aqui, o orcamento usa essa diaria; senao, usa o <span class="t-strong">fallback</span> (R$ ${fmtBR(vals.diaria_hotel)}).</p>
          </div>

          <div class="prc-add">
            <input type="text" id="prc-hot-add-cidade" class="cad-input" placeholder="Cidade" />
            <input type="text" id="prc-hot-add-uf"     class="cad-input prc-w-uf" placeholder="UF" maxlength="2" />
            <input type="text" id="prc-hot-add-diaria" class="cad-input prc-w-money" placeholder="Diaria (R$)" />
            <button type="button" class="btn btn-primary btn-sm" id="prc-btn-add-hotel">+ Adicionar cotacao</button>
          </div>

          <table class="prc-hot-table cad-table">
            <thead>
              <tr>
                <th>Cidade</th>
                <th class="prc-th-uf">UF</th>
                <th class="prc-th-money">Diaria (R$)</th>
                <th>Atualizado em</th>
                <th class="prc-th-acoes"></th>
              </tr>
            </thead>
            <tbody id="prc-hot-tbody">
              ${linhasHoteis}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindHandlers(container);
  }

  function bindHandlers(container) {
    const btnSalvar = container.querySelector('#prc-btn-salvar');
    const btnAddHot = container.querySelector('#prc-btn-add-hotel');
    const tbody     = container.querySelector('#prc-hot-tbody');
    const msg       = container.querySelector('#prc-msg');

    function flashMsg(texto, ok = true) {
      if (!msg) return;
      msg.textContent = texto;
      msg.className = 'prc-msg ' + (ok ? 'prc-msg-ok' : 'prc-msg-err');
      setTimeout(() => { msg.textContent = ''; msg.className = 'prc-msg'; }, 3000);
    }

    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => {
        const colher = (sel) => container.querySelector(`[data-field="${sel}"]`);
        const obj = {
          n_operarios:     Math.max(1, Math.floor(parseBR(colher('n_operarios').value)) || DEFAULTS.n_operarios),
          custo_hora_fab:  parseBR(colher('custo_hora_fab').value) || DEFAULTS.custo_hora_fab,
          // Felipe (sessao 2026-05): custo_hora_inst removido — instalacao
          // nao cobra por hora, cobra por diaria (diaria_pessoa). Campo
          // tirado do form. Preserva compatibilidade legado: se ja existe
          // valor salvo, mantem; senao zera.
          diaria_pessoa:   parseBR(colher('diaria_pessoa').value) || DEFAULTS.diaria_pessoa,
          alimentacao_dia: parseBR(colher('alimentacao_dia').value) || DEFAULTS.alimentacao_dia,
          diaria_hotel:    parseBR(colher('diaria_hotel').value) || DEFAULTS.diaria_hotel,
        };
        salvarValores(obj);
        flashMsg('✓ Valores padrao salvos');
      });
    }

    if (btnAddHot) {
      btnAddHot.addEventListener('click', () => {
        const cidade = container.querySelector('#prc-hot-add-cidade').value.trim();
        const uf     = container.querySelector('#prc-hot-add-uf').value.trim().toUpperCase();
        const diaria = parseBR(container.querySelector('#prc-hot-add-diaria').value);
        if (!cidade) { flashMsg('Informe a cidade', false); return; }
        if (diaria <= 0) { flashMsg('Informe a diaria (R$)', false); return; }
        const lista = listarHoteis();
        const dataStr = new Date().toLocaleDateString('pt-BR');
        // Atualizar se ja existe match exato
        const idx = lista.findIndex(h =>
          String(h.cidade || '').toLowerCase() === cidade.toLowerCase() &&
          (!uf || String(h.uf || '').toUpperCase() === uf)
        );
        if (idx >= 0) {
          lista[idx] = Object.assign({}, lista[idx], { cidade, uf, diaria, atualizadoEm: dataStr });
        } else {
          lista.push({ cidade, uf, diaria, atualizadoEm: dataStr });
        }
        salvarHoteis(lista);
        flashMsg('✓ Cotacao adicionada');
        render(container); // re-render
      });
    }

    // Edicao inline + remocao
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const btnDel = e.target.closest('.prc-hot-del');
        if (!btnDel) return;
        const idx = Number(btnDel.dataset.idx);
        if (!Number.isInteger(idx)) return;
        if (!confirm('Remover esta cotacao?')) return;
        const lista = listarHoteis();
        lista.splice(idx, 1);
        salvarHoteis(lista);
        render(container);
      });
      tbody.addEventListener('change', (e) => {
        const inp = e.target.closest('input[data-field]');
        if (!inp) return;
        const tr = inp.closest('tr');
        const idx = Number(tr.dataset.idx);
        const lista = listarHoteis();
        if (!lista[idx]) return;
        const field = inp.dataset.field;
        if (field === 'diaria') {
          lista[idx].diaria = parseBR(inp.value);
        } else if (field === 'uf') {
          lista[idx].uf = String(inp.value || '').trim().toUpperCase();
        } else {
          lista[idx][field] = String(inp.value || '').trim();
        }
        lista[idx].atualizadoEm = new Date().toLocaleDateString('pt-BR');
        salvarHoteis(lista);
        // re-render so' essa linha (mantem foco no campo)
        const dataCell = tr.querySelector('.prc-hot-data');
        if (dataCell) dataCell.textContent = lista[idx].atualizadoEm;
      });
    }
  }

  // API publica
  return {
    DEFAULTS,
    obterValores,
    salvarValores,
    obterValor,
    listarHoteis,
    salvarHoteis,
    obterDiariaHotelCidade,
    render,
  };
})();

// Expoe globalmente — orcamento le valores via window.Precificacao
window.Precificacao = Precificacao;
