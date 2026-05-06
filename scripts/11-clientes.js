/* 11-clientes.js — Modulo Clientes.
   Lista derivada do CRM (leads agregados por nome). Read-only.
   Persistencia: le de Storage.scope('crm'). CSS: prefixo .cli-*. */

  /* ============================================================
     MODULO: CLIENTES
     ============================================================
     Lista derivada do CRM. Le os leads de Storage.scope('crm') e
     agrega por nome de cliente (case-insensitive).

     Decisoes:
     - Read-only: para editar dados de cliente, abrir o card do
       lead correspondente no CRM.
     - Cliente identificado pelo nome trim+lowercase. Se o user
       duplicar grafia ("Joao Silva" vs "Joao da Silva"), serao
       clientes distintos. Tradeoff aceitavel ate termos CPF/CNPJ.
     - "Em aberto": leads com etapa != fechado e != perdido.
     - "Fechados": leads com etapa = fechado.
     - Valor total: soma de leads em aberto (nao conta perdidos).
     ============================================================ */
  const Clientes = (() => {
    const crmStore = Storage.scope('crm');
    // Felipe (req 6 do CRM): ao excluir um cliente do CRM, ele NAO some
    // de Clientes — vira um snapshot independente, persistido aqui. A vista
    // de Clientes agrega: leads do CRM + clientes independentes (que nao
    // tem mais lead). Edicoes posteriores no drawer ficam neste store.
    const cliStore = Storage.scope('clientes');

    function fmtBR(n) {
      return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtData(iso) {
      if (!iso) return '—';
      const [y, m, d] = String(iso).split('-');
      if (!y || !m || !d) return iso;
      return `${d}/${m}/${y}`;
    }
    function escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Le leads do CRM e agrupa por cliente. Tambem mescla com clientes
    // independentes (snapshotados ao excluir do CRM). Se um cliente existe
    // em AMBOS, os leads do CRM sao a fonte autoritativa (independente
    // funciona como fallback caso nao haja mais lead).
    function carregarClientes() {
      const leads = crmStore.get('leads') || [];
      const independentes = cliStore.get('clientes_independentes') || [];
      const map = new Map();

      // Primeiro: leads do CRM
      leads.forEach(l => {
        const key = (l.cliente || '').trim().toLowerCase();
        if (!key) return;

        if (!map.has(key)) {
          map.set(key, {
            key,
            nome: (l.cliente || '').trim(),
            telefone: '',
            email: '',
            cep: '',
            cidade: '',
            estado: '',
            representante: '',
            numerosReserva: new Set(),
            numerosAGP: new Set(),
            negociosAbertos: 0,
            negociosFechados: 0,
            negociosPerdidos: 0,
            valorEmAberto: 0,
            valorFechado: 0,
            ultimaData: '',
            leads: [],
          });
        }
        const c = map.get(key);

        // Mantem dados mais recentes (ultimo lead com info preenchida vence)
        if (l.telefone) c.telefone = l.telefone;
        if (l.email) c.email = l.email;
        if (l.cep) c.cep = l.cep;
        if (l.cidade) c.cidade = l.cidade;
        if (l.estado) c.estado = l.estado;
        if (l.representante) c.representante = l.representante;
        if (l.numeroReserva) c.numerosReserva.add(l.numeroReserva);
        if (l.numeroAGP) c.numerosAGP.add(l.numeroAGP);

        // Conta negocios por etapa
        const valor = Number(l.valor) || 0;
        if (l.etapa === 'fechado') {
          c.negociosFechados++;
          c.valorFechado += valor;
        } else if (l.etapa === 'perdido') {
          c.negociosPerdidos++;
        } else {
          c.negociosAbertos++;
          c.valorEmAberto += valor;
        }

        // Ultima data
        if ((l.data || '') > c.ultimaData) c.ultimaData = l.data || '';

        c.leads.push(l);
      });

      // Felipe (req 6 do CRM): mescla clientes independentes (snapshotados
      // ao excluir do CRM). Se ja existe entrada do CRM, OS DADOS DO CRM
      // VENCEM (sao mais recentes) — independente so' adiciona se nao tem
      // lead correspondente.
      independentes.forEach(ind => {
        const key = (ind.nome || '').trim().toLowerCase();
        if (!key) return;
        if (map.has(key)) {
          // Cliente foi re-adicionado ao CRM depois da exclusao — usa CRM como
          // fonte. Independente fica como historico mas nao prevalece.
          return;
        }
        map.set(key, {
          key,
          nome: ind.nome || '',
          telefone: ind.telefone || '',
          email: ind.email || '',
          cep: ind.cep || '',
          cidade: ind.cidade || '',
          estado: ind.estado || '',
          representante: ind.representante || '',
          numerosReserva: new Set(ind.numerosReserva || []),
          numerosAGP: new Set(ind.numerosAGP || []),
          negociosAbertos: 0,
          negociosFechados: ind.negociosFechados || 0,
          negociosPerdidos: ind.negociosPerdidos || 0,
          valorEmAberto: 0,
          valorFechado: ind.valorFechado || 0,
          ultimaData: ind.ultimaData || '',
          leads: [],
          independenteSnapshotEm: ind.snapshotEm || '',
        });
      });

      return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }

    const state = {
      busca: '',
      drawerCliente: null, // key do cliente aberto no drawer
    };

    function filtrar(clientes) {
      const q = state.busca.trim().toLowerCase();
      if (!q) return clientes;
      return clientes.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        c.telefone.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        c.cidade.toLowerCase().includes(q) ||
        c.estado.toLowerCase().includes(q) ||
        c.representante.toLowerCase().includes(q)
      );
    }

    function renderTabela(clientes) {
      if (clientes.length === 0) {
        return `
          <div class="cli-table-wrap" style="width:100%;">
            <div class="cli-empty">
              <div class="icon-big">👥</div>
              <span class="t-strong">Nenhum cliente ainda</span>
              <p>Clientes aparecem aqui automaticamente conforme voce cria leads no CRM.</p>
            </div>
          </div>
        `;
      }
      const rows = clientes.map(c => {
        const abertoBadge = c.negociosAbertos > 0
          ? `<span class="cli-badge cli-badge-aberto">${c.negociosAbertos}</span>`
          : `<span class="cli-badge cli-badge-zero">0</span>`;
        const fechadoBadge = c.negociosFechados > 0
          ? `<span class="cli-badge cli-badge-fechado">${c.negociosFechados}</span>`
          : `<span class="cli-badge cli-badge-zero">0</span>`;
        return `
          <tr data-key="${escapeHtml(c.key)}">
            <td><span class="cli-nome">${escapeHtml(c.nome)}</span></td>
            <td>${escapeHtml(c.telefone || '—')}</td>
            <td>${escapeHtml(c.email || '—')}</td>
            <td>${escapeHtml(c.cidade || '—')}</td>
            <td>${escapeHtml(c.estado || '—')}</td>
            <td>${escapeHtml(c.representante || '—')}</td>
            <td class="num">${abertoBadge}</td>
            <td class="num">${fechadoBadge}</td>
            <td class="num">R$ ${fmtBR(c.valorEmAberto)}</td>
            <td>${fmtData(c.ultimaData)}</td>
            <td class="actions" onclick="event.stopPropagation();"><button class="row-delete" data-action="delete-cli" data-key="${escapeHtml(c.key)}" title="Excluir cliente">×</button></td>
          </tr>
        `;
      }).join('');
      return `
        <div class="cli-table-wrap">
          <table class="cli-table">
            <thead>
              <tr>
                <th style="min-width:200px;">Nome do Cliente</th>
                <th style="min-width:130px;">Telefone</th>
                <th style="min-width:180px;">Email</th>
                <th style="min-width:160px;">Cidade</th>
                <th style="min-width:60px;">UF</th>
                <th style="min-width:200px;">Representante</th>
                <th class="num" style="min-width:100px;">Em aberto</th>
                <th class="num" style="min-width:90px;">Fechados</th>
                <th class="num" style="min-width:140px;">Valor em aberto</th>
                <th style="min-width:120px;">Ultima atividade</th>
                <th style="min-width:50px;width:50px;"></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    function renderDrawer(cliente) {
      const ETAPAS_LABEL = {
        'qualificacao': 'Qualificacao',
        'fazer-orcamento': 'Fazer Orcamento',
        'orcamento-pronto': 'Orcamento Pronto',
        'orcamento-aprovado': 'Orcamento Aprovado',
        'orcamento-enviado': 'Orcamento Enviado',
        'negociacao': 'Negociacao',
        'fechado': 'Fechado',
        'perdido': 'Perdido',
      };
      const dealsHtml = cliente.leads.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(l => `
        <div class="cli-deal-item">
          <div class="cli-deal-info">
            <div class="cli-deal-titulo">${escapeHtml(ETAPAS_LABEL[l.etapa] || l.etapa)}</div>
            <div class="cli-deal-meta">
              <span>${fmtData(l.data)}</span>
              ${l.numeroReserva ? `<span>Reserva ${escapeHtml(l.numeroReserva)}</span>` : ''}
            </div>
          </div>
          <div class="cli-deal-valor">R$ ${fmtBR(l.valor)}</div>
        </div>
      `).join('');
      const reservas = Array.from(cliente.numerosReserva);
      const agps = Array.from(cliente.numerosAGP);
      return `
        <div class="cli-drawer-overlay" id="cli-drawer-overlay">
          <div class="cli-drawer">
            <div class="cli-drawer-header">
              <div>
                <div class="cli-drawer-title">${escapeHtml(cliente.nome)}</div>
                <div class="cli-drawer-sub">${cliente.leads.length} negocio${cliente.leads.length !== 1 ? 's' : ''} · ${escapeHtml(cliente.cidade || '—')}${cliente.estado ? '/' + escapeHtml(cliente.estado) : ''}</div>
              </div>
              <button class="cli-drawer-close" id="cli-drawer-close" title="Fechar">×</button>
            </div>

            <div class="cli-drawer-section">
              <h4>Contato</h4>
              <div class="cli-info-grid">
                <div class="cli-info-item"><label>Telefone</label><input class="cad-input" data-edit-field="telefone" type="text" value="${escapeHtml(cliente.telefone || '')}" /></div>
                <div class="cli-info-item"><label>Email</label><input class="cad-input" data-edit-field="email" type="email" value="${escapeHtml(cliente.email || '')}" placeholder="" /></div>
                <div class="cli-info-item"><label>CEP</label><input class="cad-input" data-edit-field="cep" type="text" value="${escapeHtml(cliente.cep || '')}" /></div>
                <div class="cli-info-item"><label>Cidade</label><input class="cad-input" data-edit-field="cidade" type="text" value="${escapeHtml(cliente.cidade || '')}" /></div>
                <div class="cli-info-item"><label>Estado</label><input class="cad-input" data-edit-field="estado" type="text" maxlength="2" value="${escapeHtml(cliente.estado || '')}" style="text-transform:uppercase;" /></div>
                <div class="cli-info-item" style="grid-column:1/-1;"><label>Representante</label><input class="cad-input" data-edit-field="representante" type="text" value="${escapeHtml(cliente.representante || '')}" /></div>
              </div>
              <div id="cli-drawer-save-mount" style="margin-top:12px;display:flex;justify-content:flex-end;"></div>
            </div>

            ${reservas.length || agps.length ? `
              <div class="cli-drawer-section">
                <h4>Referencias Weiku</h4>
                <div class="cli-info-grid">
                  ${reservas.length ? `<div class="cli-info-item" style="grid-column:1/-1;"><label>Reservas</label><span>${reservas.map(escapeHtml).join(', ')}</span></div>` : ''}
                  ${agps.length ? `<div class="cli-info-item" style="grid-column:1/-1;"><label>AGPs</label><span>${agps.map(escapeHtml).join(', ')}</span></div>` : ''}
                </div>
              </div>
            ` : ''}

            <div class="cli-drawer-section">
              <h4>Resumo financeiro</h4>
              <div class="cli-info-grid">
                <div class="cli-info-item"><label>Em aberto</label><span>${cliente.negociosAbertos} · R$ ${fmtBR(cliente.valorEmAberto)}</span></div>
                <div class="cli-info-item"><label>Fechados</label><span>${cliente.negociosFechados} · R$ ${fmtBR(cliente.valorFechado)}</span></div>
                <div class="cli-info-item"><label>Perdidos</label><span>${cliente.negociosPerdidos}</span></div>
                <div class="cli-info-item"><label>Total de leads</label><span>${cliente.leads.length}</span></div>
              </div>
            </div>

            <div class="cli-drawer-section">
              <h4>Negocios (${cliente.leads.length})</h4>
              <div class="cli-deals-list">${dealsHtml}</div>
            </div>
          </div>
        </div>
      `;
    }

    function render(container) {
      const todosClientes = carregarClientes();
      const filtrados = filtrar(todosClientes);
      const totalAberto = todosClientes.reduce((acc, c) => acc + c.valorEmAberto, 0);

      container.innerHTML = `
        <div class="cli-toolbar">
          <div class="cli-toolbar-left">
            <span class="cli-count"><span class="t-strong">${todosClientes.length}</span> cliente${todosClientes.length !== 1 ? 's' : ''}</span>
            <span class="cli-count">Total em aberto: <span class="t-strong">R$ ${fmtBR(totalAberto)}</span></span>
          </div>
          <div class="cli-toolbar-right">
            <div class="cli-search">
              <input type="text" id="cli-busca" placeholder="Buscar por nome, telefone, email, cidade..." value="${escapeHtml(state.busca)}" />
            </div>
            <button type="button" class="univ-btn-export" id="cli-btn-export">⬇ Exportar Excel</button>
            <button type="button" class="univ-btn-add" id="cli-btn-add-toggle">+ Adicionar Cliente</button>
            <button type="button" class="univ-btn-save" id="cli-btn-salvar">✓ Tudo salvo</button>
          </div>
        </div>
        <div class="cad-add-form" id="cli-add-form" hidden>
          <h4>+ Adicionar novo cliente</h4>
          <div class="cad-add-grid">
            <div>
              <div class="cad-param-label">Nome do Cliente *</div>
              <input id="cli-add-nome" class="cad-input" type="text" placeholder="" />
            </div>
            <div>
              <div class="cad-param-label">Telefone</div>
              <input id="cli-add-telefone" class="cad-input" type="text" placeholder="" />
            </div>
            <div>
              <div class="cad-param-label">Cidade</div>
              <input id="cli-add-cidade" class="cad-input" type="text" placeholder="" />
            </div>
            <div>
              <div class="cad-param-label">Estado</div>
              <input id="cli-add-estado" class="cad-input" type="text" maxlength="2" placeholder="" style="text-transform:uppercase;" />
            </div>
            <div>
              <div class="cad-param-label">Representante</div>
              <input id="cli-add-representante" class="cad-input" type="text" placeholder="" />
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="cli-btn-add-confirm" style="height:34px;">+ Adicionar</button>
            <button type="button" class="btn btn-sm" id="cli-btn-add-cancel" style="height:34px;">Cancelar</button>
          </div>
        </div>
        <div id="cli-content">${renderTabela(filtrados)}</div>
        <div id="cli-drawer-mount"></div>
      `;
      bindEvents(container);
    }

    function bindEvents(container) {
      // Busca
      const busca = container.querySelector('#cli-busca');
      if (busca) {
        busca.addEventListener('input', (e) => {
          state.busca = e.target.value;
          const todosClientes = carregarClientes();
          const filtrados = filtrar(todosClientes);
          const content = container.querySelector('#cli-content');
          if (content) content.innerHTML = renderTabela(filtrados);
          bindRowEvents(container);
        });
      }

      // Botao Salvar (padronizacao — Clientes e' read-only mas dialog confirma estado)
      container.querySelector('#cli-btn-salvar')?.addEventListener('click', () => {
        if (window.showSavedDialog) window.showSavedDialog('Lista de clientes esta sempre sincronizada com o CRM.');
      });

      // R16: Exportar Excel (Clientes eh read-only — sem importar)
      container.querySelector('#cli-btn-export')?.addEventListener('click', () => {
        const lista = carregarClientes(); // sempre dados atuais
        const headers = ['Nome','Telefone','Email','CEP','Cidade','UF','Em Aberto (R$)','Fechados (R$)','Total Leads','Etapa Atual'];
        const rows = lista.map(c => [
          c.nome || '',
          c.telefone || '',
          c.email || '',
          c.cep || '',
          c.cidade || '',
          c.uf || '',
          Number(c.totalAberto || 0),
          Number(c.totalFechado || 0),
          c.totalLeads || 0,
          c.etapaAtual || '',
        ]);
        if (window.Universal && window.Universal.exportXLSX) {
          window.Universal.exportXLSX({
            headers, rows,
            sheetName: 'Clientes',
            fileName: 'clientes_projetta',
          });
        }
      });

      // Toggle do form de adicionar
      const btnAddToggle = container.querySelector('#cli-btn-add-toggle');
      const addForm = container.querySelector('#cli-add-form');
      if (btnAddToggle && addForm) {
        btnAddToggle.addEventListener('click', () => {
          const isHidden = addForm.hasAttribute('hidden');
          if (isHidden) {
            addForm.removeAttribute('hidden');
            const nome = container.querySelector('#cli-add-nome');
            if (nome) nome.focus();
          } else {
            addForm.setAttribute('hidden', '');
          }
        });
      }

      // Cancelar adicao
      const btnAddCancel = container.querySelector('#cli-btn-add-cancel');
      if (btnAddCancel && addForm) {
        btnAddCancel.addEventListener('click', () => {
          limparAddForm(container);
          addForm.setAttribute('hidden', '');
        });
      }

      // Confirmar adicao
      const btnAddConfirm = container.querySelector('#cli-btn-add-confirm');
      if (btnAddConfirm) {
        btnAddConfirm.addEventListener('click', () => {
          const nome = (container.querySelector('#cli-add-nome')?.value || '').trim();
          if (!nome) {
            alert('Nome do cliente eh obrigatorio.');
            return;
          }
          const dados = {
            cliente: nome,
            telefone: (container.querySelector('#cli-add-telefone')?.value || '').trim(),
            cidade:   (container.querySelector('#cli-add-cidade')?.value || '').trim(),
            estado:   (container.querySelector('#cli-add-estado')?.value || '').trim().toUpperCase(),
            representante: (container.querySelector('#cli-add-representante')?.value || '').trim(),
          };
          criarClienteComoLead(dados);
          limparAddForm(container);
          if (addForm) addForm.setAttribute('hidden', '');
          // Re-render geral
          render(container);
          if (window.showSavedDialog) window.showSavedDialog('Cliente adicionado com sucesso!');
        });
      }

      bindRowEvents(container);
    }

    // Limpa os campos do form de adicao
    function limparAddForm(container) {
      ['#cli-add-nome', '#cli-add-telefone', '#cli-add-cidade', '#cli-add-estado', '#cli-add-representante']
        .forEach(sel => { const el = container.querySelector(sel); if (el) el.value = ''; });
    }

    // Cria um cliente novo como um lead inicial no CRM (etapa qualificacao, valor 0).
    // Clientes sao derivados de leads, entao adicionar cliente = adicionar lead.
    function criarClienteComoLead(dados) {
      const leads = crmStore.get('leads') || [];
      const hoje = new Date().toISOString().slice(0, 10);
      const novoId = 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      leads.push({
        id: novoId,
        cliente: dados.cliente,
        telefone: dados.telefone || '',
        cidade: dados.cidade || '',
        estado: dados.estado || '',
        representante: dados.representante || '',
        cep: '',
        etapa: 'qualificacao',
        valor: 0,
        data: hoje,
      });
      crmStore.set('leads', leads);
    }

    // Exclui um cliente: remove TODOS os leads daquele cliente do CRM.
    function excluirCliente(key) {
      // Felipe (req 6 do CRM): "Excluir cliente do CRM" NAO deve apagar de
      // Clientes — congela um snapshot pra preservar dados, depois remove
      // os leads do CRM. Cliente vira independente e pode ser editado/excluido
      // manualmente em Clientes.
      const cliente = carregarClientes().find(c => c.key === key);
      if (cliente && cliente.leads.length > 0) {
        snapshotarComoIndependente(cliente);
      }
      const leads = crmStore.get('leads') || [];
      const restantes = leads.filter(l => (l.cliente || '').trim().toLowerCase() !== key);
      crmStore.set('leads', restantes);
    }

    /**
     * Cria/atualiza um snapshot independente a partir de um cliente atual.
     * Usado quando o cliente vai sumir do CRM (excluido) ou quando o CRM
     * pede explicitamente.
     */
    function snapshotarComoIndependente(cliente) {
      if (!cliente || !cliente.nome) return;
      const lista = cliStore.get('clientes_independentes') || [];
      const key = cliente.key;
      const idx = lista.findIndex(c => (c.nome || '').trim().toLowerCase() === key);
      const snap = {
        nome: cliente.nome,
        telefone: cliente.telefone || '',
        email: cliente.email || '',
        cep: cliente.cep || '',
        cidade: cliente.cidade || '',
        estado: cliente.estado || '',
        representante: cliente.representante || '',
        numerosReserva: Array.from(cliente.numerosReserva || []),
        numerosAGP: Array.from(cliente.numerosAGP || []),
        negociosFechados: cliente.negociosFechados || 0,
        negociosPerdidos: cliente.negociosPerdidos || 0,
        valorFechado: cliente.valorFechado || 0,
        ultimaData: cliente.ultimaData || '',
        snapshotEm: new Date().toISOString().slice(0, 10),
      };
      if (idx >= 0) lista[idx] = snap; else lista.push(snap);
      cliStore.set('clientes_independentes', lista);
    }

    /**
     * Felipe (req 6): exclui o cliente independente em Clientes (apos ele ja
     * ter sido removido do CRM). Pra excluir definitivamente.
     */
    function excluirIndependente(key) {
      const lista = cliStore.get('clientes_independentes') || [];
      const restantes = lista.filter(c => (c.nome || '').trim().toLowerCase() !== key);
      cliStore.set('clientes_independentes', restantes);
    }

    // Atualiza campos comuns (telefone, cep, cidade, estado, representante)
    // em TODOS os leads do cliente. Usado pelo Salvar do drawer.
    // Tambem atualiza o cliente independente (se existir) — Felipe quer
    // que cliente possa ser editado em Clientes mesmo apos sair do CRM.
    function atualizarCamposCliente(key, dados) {
      const leads = crmStore.get('leads') || [];
      let mudou = false;
      leads.forEach(l => {
        if ((l.cliente || '').trim().toLowerCase() === key) {
          ['telefone', 'cep', 'cidade', 'estado', 'representante'].forEach(f => {
            if (Object.prototype.hasOwnProperty.call(dados, f)) {
              l[f] = dados[f];
              mudou = true;
            }
          });
        }
      });
      if (mudou) crmStore.set('leads', leads);

      // Atualiza independente correspondente (se houver)
      const independentes = cliStore.get('clientes_independentes') || [];
      let mudouInd = false;
      independentes.forEach(ind => {
        if ((ind.nome || '').trim().toLowerCase() === key) {
          ['telefone', 'cep', 'cidade', 'estado', 'representante'].forEach(f => {
            if (Object.prototype.hasOwnProperty.call(dados, f)) {
              ind[f] = dados[f];
              mudouInd = true;
            }
          });
        }
      });
      if (mudouInd) cliStore.set('clientes_independentes', independentes);
    }

    function bindRowEvents(container) {
      // Click numa linha abre drawer com detalhe
      container.querySelectorAll('.cli-table tbody tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
          // Ignora click no botao de excluir (ja tem stopPropagation no td.actions)
          if (e.target.closest('[data-action="delete-cli"]')) return;
          const key = tr.dataset.key;
          const cliente = carregarClientes().find(c => c.key === key);
          if (!cliente) return;
          const mount = container.querySelector('#cli-drawer-mount');
          if (!mount) return;
          mount.innerHTML = renderDrawer(cliente);
          bindDrawerEvents(container);
        });
      });
      // Botao X de excluir cliente
      // Felipe (req 6 do CRM): tem 3 cenarios de exclusao em Clientes:
      //   1) Cliente so' tem leads no CRM → tira do CRM e mantem como
      //      independente (igual o botao Excluir Lead do CRM faz).
      //   2) Cliente so' tem snapshot independente (saiu do CRM antes) →
      //      apaga o independente definitivamente.
      //   3) Cliente tem leads no CRM + ja' eh independente → apaga o
      //      independente E remove leads.
      container.querySelectorAll('[data-action="delete-cli"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = btn.dataset.key;
          const cliente = carregarClientes().find(c => c.key === key);
          if (!cliente) return;
          const total = cliente.leads.length;
          const isIndependente = !!cliente.independenteSnapshotEm;

          let msg;
          if (total > 0 && !isIndependente) {
            // Caso 1: tira do CRM, snapshota como independente
            msg = `Excluir "${cliente.nome}" do CRM?\n\nVai remover ${total} negocio${total !== 1 ? 's' : ''} do CRM, mas o cliente continua aqui em Clientes (com os dados como estao agora).\n\nPra apagar definitivamente, exclua de novo aqui depois.`;
          } else if (total === 0 && isIndependente) {
            // Caso 2: independente puro, apaga definitivo
            msg = `Excluir "${cliente.nome}" definitivamente?\n\nEste cliente nao esta mais no CRM. A exclusao e' permanente — nao pode ser desfeita.`;
          } else {
            // Caso 3: tem leads + e' independente. Apaga ambos.
            msg = `Excluir "${cliente.nome}" definitivamente?\n\nVai remover ${total} negocio${total !== 1 ? 's' : ''} do CRM E apagar o cliente independente.\n\nEsta acao NAO pode ser desfeita.`;
          }
          if (!confirm(msg)) return;

          if (total > 0 && !isIndependente) {
            // Caso 1: tira do CRM (excluirCliente ja' snapshota antes de remover)
            excluirCliente(key);
          } else if (total === 0 && isIndependente) {
            // Caso 2: apaga independente
            excluirIndependente(key);
          } else {
            // Caso 3: apaga ambos
            excluirIndependente(key);
            const leads = crmStore.get('leads') || [];
            const restantes = leads.filter(l => (l.cliente || '').trim().toLowerCase() !== key);
            crmStore.set('leads', restantes);
          }
          render(container);
          if (window.showSavedDialog) window.showSavedDialog('Cliente excluido com sucesso!');
        });
      });
      // R12: sort+filtro universal por coluna
      const tbl = container.querySelector('.cli-table');
      if (tbl && window.Universal) window.Universal.autoEnhance(tbl, { skipCols: ['actions'] });
    }

    function bindDrawerEvents(container) {
      const overlay = container.querySelector('#cli-drawer-overlay');
      const close = container.querySelector('#cli-drawer-close');
      const fechar = () => {
        const mount = container.querySelector('#cli-drawer-mount');
        if (mount) mount.innerHTML = '';
      };
      if (close) close.addEventListener('click', fechar);
      // Felipe: NAO fecha ao clicar fora — so' no X. Comportamento igual ao
      // modal do CRM. Evita perder edicoes acidentalmente.

      // R07: botao "Salvar Alteracoes" universal pros campos editaveis do drawer.
      // O cliente_key vem do tr clicado; pegamos via data-key do drawer.
      const overlayEl = container.querySelector('#cli-drawer-overlay');
      const drawerEl = overlayEl ? overlayEl.querySelector('.cli-drawer') : null;
      const saveMount = container.querySelector('#cli-drawer-save-mount');
      if (saveMount && drawerEl && window.createSaveButton) {
        // Descobre a key do cliente atual via titulo+busca, ou via tr ativa
        // — usa carregarClientes pra resolver pelo nome no header.
        const tituloEl = drawerEl.querySelector('.cli-drawer-title');
        const nomeAtual = (tituloEl?.textContent || '').trim();
        const cliKey = nomeAtual.toLowerCase();

        const inputs = drawerEl.querySelectorAll('input[data-edit-field]');
        const saveBtn = window.createSaveButton({
          id: 'cli-drawer-save-btn',
          savedMessage: 'Alteracoes do cliente salvas com sucesso!',
          onSave: () => {
            const dados = {};
            inputs.forEach(inp => {
              const f = inp.dataset.editField;
              let v = inp.value;
              if (f === 'estado') v = (v || '').toUpperCase();
              dados[f] = (v || '').trim();
            });
            atualizarCamposCliente(cliKey, dados);
            // Atualiza tabela de fundo (sem fechar drawer)
            const content = container.querySelector('#cli-content');
            if (content) {
              const filtrados = filtrar(carregarClientes());
              content.innerHTML = renderTabela(filtrados);
              bindRowEvents(container);
            }
          },
        });
        saveMount.appendChild(saveBtn);

        // Marca dirty quando qualquer campo muda
        inputs.forEach(inp => {
          inp.addEventListener('input', () => saveBtn.setDirty(true));
        });
      }
    }

    return {
      render,
      // API publica pro CRM consumir
      snapshotarComoIndependente,
      excluirIndependente,
    };
  })();

  // Felipe (req 6 do CRM): expoe globalmente pro CRM acessar quando
  // excluir um lead — chama snapshotarComoIndependente() antes de remover
  // o lead, pra garantir que o cliente continua em Clientes.
  if (typeof window !== 'undefined') {
    window.Clientes = Clientes;
  }

  App.register('clientes', {
    render(container) {
      Clientes.render(container);
    }
  });
