/* 24-cadastros-register.js — registra o modulo Cadastros no App.
   Routing por aba: chama Perfis.render / Modelos.render / Representantes.render /
   UsuariosCadastro.render / Acessorios.render conforme a tab selecionada.
   Demais sub-abas (superficies, fretes, mensagens, permissoes)
   sao placeholders.

   IMPORTANTE: este arquivo precisa ser carregado DEPOIS de:
     - 20-perfis.js, 21-modelos.js, 22-representantes.js, 23-usuarios.js, 25-acessorios.js
   senao as referencias quebram. */

/* ============================================================
   Aba Configuracao — parametros globais do sistema
   ============================================================ */
function renderConfiguracao(container) {
  const store = window.Storage ? Storage.scope('cadastros') : null;
  const vars = (store && store.get('regras_variaveis_chapas')) || {};

  // Defaults conforme MaxCut
  const kerf    = vars.KERF_NEST      != null ? vars.KERF_NEST      : 4;
  const aparar  = vars.APARAR_NEST    != null ? vars.APARAR_NEST    : 5;
  const giros   = vars.MAX_GIROS_NEST != null ? vars.MAX_GIROS_NEST : 6;
  const metodo  = vars.METODO_NEST    || 'multi_horiz';

  container.innerHTML = `
    <div style="max-width:900px;margin:0 auto;padding:20px 0;">
      <h2 style="font-size:1.4em;font-weight:700;color:var(--azul-escuro);margin-bottom:24px;">
        Configuracao do Sistema
      </h2>

      <!-- CORTE DE CHAPAS -->
      <div style="background:#fff;border:1px solid #d0d5dd;border-radius:8px;padding:24px;margin-bottom:24px;">
        <div style="font-size:1.1em;font-weight:700;color:var(--azul-escuro);margin-bottom:4px;">
          Corte de Chapas — Otimizacao
        </div>
        <div style="font-size:0.9em;color:#666;margin-bottom:20px;">
          Parametros usados no calculo de aproveitamento de chapas (Levantamento de Superficies).
          Baseado nas configuracoes do MaxCut.
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <!-- Espessura da Serra -->
          <div style="background:#f8f9fa;border-radius:6px;padding:16px;border:1px solid #e0e0e0;">
            <label style="display:block;font-weight:600;margin-bottom:6px;color:var(--azul-escuro);">
              Espessura da Serra (KERF)
            </label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="number" id="cfg-kerf" value="${kerf}" min="0" max="10" step="0.5"
                style="width:80px;padding:8px;font-size:1em;border:1px solid #ccc;border-radius:4px;font-weight:500;" />
              <span style="font-weight:500;color:#555;">mm</span>
            </div>
            <div style="font-size:0.85em;color:#888;margin-top:6px;">
              Espaco entre pecas no corte. Padrao MaxCut: 4 mm
            </div>
          </div>

          <!-- Aparar Chapa -->
          <div style="background:#f8f9fa;border-radius:6px;padding:16px;border:1px solid #e0e0e0;">
            <label style="display:block;font-weight:600;margin-bottom:6px;color:var(--azul-escuro);">
              Aparar Chapa (margem)
            </label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="number" id="cfg-aparar" value="${aparar}" min="0" max="20" step="1"
                style="width:80px;padding:8px;font-size:1em;border:1px solid #ccc;border-radius:4px;font-weight:500;" />
              <span style="font-weight:500;color:#555;">mm (todos os lados)</span>
            </div>
            <div style="font-size:0.85em;color:#888;margin-top:6px;">
              Margem de descarte na borda da chapa. Padrao MaxCut: 5 mm
            </div>
          </div>

          <!-- Metodo de Otimizacao -->
          <div style="background:#f8f9fa;border-radius:6px;padding:16px;border:1px solid #e0e0e0;">
            <label style="display:block;font-weight:600;margin-bottom:6px;color:var(--azul-escuro);">
              Metodo de Otimizacao
            </label>
            <select id="cfg-metodo"
              style="width:100%;padding:8px;font-size:1em;border:1px solid #ccc;border-radius:4px;font-weight:500;">
              <option value="multi_horiz" ${metodo === 'multi_horiz' ? 'selected' : ''}>Multiplos estagios — primeiro corte segue o comprimento</option>
              <option value="multi_vert" ${metodo === 'multi_vert' ? 'selected' : ''}>Multiplos estagios — primeiro corte segue a largura</option>
              <option value="normal" ${metodo === 'normal' ? 'selected' : ''}>Normal (encaixe livre)</option>
            </select>
            <div style="font-size:0.85em;color:#888;margin-top:6px;">
              Recomendado para CNC router: "comprimento" (linhas retas no eixo longo)
            </div>
          </div>

          <!-- Niveis / Giros -->
          <div style="background:#f8f9fa;border-radius:6px;padding:16px;border:1px solid #e0e0e0;">
            <label style="display:block;font-weight:600;margin-bottom:6px;color:var(--azul-escuro);">
              Niveis de Varias Fases
            </label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="number" id="cfg-giros" value="${giros}" min="1" max="20" step="1"
                style="width:80px;padding:8px;font-size:1em;border:1px solid #ccc;border-radius:4px;font-weight:500;" />
            </div>
            <div style="font-size:0.85em;color:#888;margin-top:6px;">
              Numero maximo de giros por folha. Padrao MaxCut: 6
            </div>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;gap:12px;align-items:center;">
          <button type="button" id="cfg-salvar-chapas"
            style="padding:10px 24px;background:var(--azul-escuro);color:#fff;border:none;border-radius:6px;font-weight:600;font-size:1em;cursor:pointer;">
            Salvar Configuracao
          </button>
          <button type="button" id="cfg-restaurar-chapas"
            style="padding:10px 24px;background:#f5f5f5;color:#555;border:1px solid #ccc;border-radius:6px;font-weight:500;font-size:1em;cursor:pointer;">
            Restaurar Padroes
          </button>
          <span id="cfg-chapas-status" style="color:#2e7d32;font-weight:500;display:none;">Salvo!</span>
        </div>
      </div>
    </div>
  `;

  // Event: Salvar
  container.querySelector('#cfg-salvar-chapas').addEventListener('click', function() {
    if (!store) return;
    var novoVars = Object.assign({}, store.get('regras_variaveis_chapas') || {});
    novoVars.KERF_NEST      = Number(container.querySelector('#cfg-kerf').value) || 0;
    novoVars.APARAR_NEST    = Number(container.querySelector('#cfg-aparar').value) || 0;
    novoVars.MAX_GIROS_NEST = Number(container.querySelector('#cfg-giros').value) || 6;
    novoVars.METODO_NEST    = container.querySelector('#cfg-metodo').value || 'multi_horiz';
    store.set('regras_variaveis_chapas', novoVars);
    var status = container.querySelector('#cfg-chapas-status');
    status.style.display = 'inline';
    status.textContent = 'Salvo!';
    setTimeout(function() { status.style.display = 'none'; }, 2000);
  });

  // Event: Restaurar
  container.querySelector('#cfg-restaurar-chapas').addEventListener('click', function() {
    container.querySelector('#cfg-kerf').value = 4;
    container.querySelector('#cfg-aparar').value = 5;
    container.querySelector('#cfg-giros').value = 6;
    container.querySelector('#cfg-metodo').value = 'multi_horiz';
    var status = container.querySelector('#cfg-chapas-status');
    status.style.display = 'inline';
    status.textContent = 'Padroes restaurados — clique Salvar para confirmar';
    setTimeout(function() { status.style.display = 'none'; }, 3000);
  });
}

/* ============================================================
   Registra modulo no App
   ============================================================ */
App.register('cadastros', {
  render(container, tab) {
    if (tab === 'perfis') {
      Perfis.render(container);
      return;
    }
    if (tab === 'modelos') {
      Modelos.render(container);
      return;
    }
    if (tab === 'representantes') {
      Representantes.render(container);
      return;
    }
    if (tab === 'usuarios') {
      UsuariosCadastro.render(container);
      return;
    }
    if (tab === 'acessorios') {
      Acessorios.render(container);
      return;
    }
    if (tab === 'superficies') {
      Superficies.render(container);
      return;
    }
    if (tab === 'regras') {
      if (typeof Regras !== 'undefined') {
        Regras.render(container);
      } else {
        container.innerHTML = '<div class="info-banner">Modulo Regras nao carregado.</div>';
      }
      return;
    }
    if (tab === 'precificacao') {
      if (typeof Precificacao !== 'undefined') {
        Precificacao.render(container);
      } else {
        container.innerHTML = '<div class="info-banner">Modulo Precificacao nao carregado.</div>';
      }
      return;
    }
    if (tab === 'filtros') {
      if (typeof Filtros !== 'undefined') {
        Filtros.render(container);
      } else {
        container.innerHTML = '<div class="info-banner">Modulo Filtros nao carregado.</div>';
      }
      return;
    }
    if (tab === 'configuracao') {
      renderConfiguracao(container);
      return;
    }
    // Demais sub-abas ainda nao implementadas
    const labelMap = {
      acessorios: 'Acessorios', superficies: 'Superficies',
      fretes: 'Frete Internacional',
      mensagens: 'Mensagens', usuarios: 'Usuarios', permissoes: 'Permissoes',
    };
    const label = labelMap[tab] || tab;
    container.innerHTML = `
      <div class="info-banner">
        <span class="t-strong">Aba "${label.toLowerCase()}":</span> sera implementada em breve. O banco de dados ja esta preparado e isolado nas demais abas.
      </div>
      <div class="placeholder">
        <div class="icon-big">⚙️</div>
        <h3>Em construcao</h3>
        <p>Modulo Cadastros — aba <span class="t-strong">${tab}</span></p>
      </div>
    `;
  }
});
