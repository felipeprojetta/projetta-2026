/* 10-crm.js — Modulo CRM (Kanban + Lista de leads).
   Inclui WeikuClient nested (sera extraido em fase posterior).
   Persistencia: Storage.scope('crm'). CSS: prefixo .crm-*.
   Etapas do pipeline:
     qualificacao -> fazer-orcamento -> orcamento-pronto ->
     orcamento-enviado -> negociacao -> fechado / perdido */

  /* ============================================================
     MODULO: CRM (Kanban + Lista)
     ============================================================
     Isolado: Storage.scope('crm'), CSS prefixado .crm-*.
     Nao chama funcoes de outros modulos. Tudo encapsulado na IIFE.

     Etapas do pipeline (ordem importa pro Kanban):
       qualificacao → fazer-orcamento → orcamento-pronto →
       orcamento-enviado → negociacao → fechado / perdido

     Persistencia: leads em projetta:crm:leads (localStorage).
     Drag-and-drop: HTML5 nativo (dragstart/dragover/drop).
     ============================================================ */
  const Crm = (() => {
    // ISO 3166-1 — paises do mundo em ingles, ordenada A-Z.
    // Aparece quando destino do lead = "Internacional".
    const PAISES = [
      'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina',
      'Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados',
      'Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana',
      'Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon',
      'Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros',
      'Congo (Brazzaville)','Congo (Kinshasa)','Costa Rica','Croatia','Cuba','Cyprus',
      'Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt',
      'El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji',
      'Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada',
      'Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland',
      'India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica',
      'Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos',
      'Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
      'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania',
      'Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco',
      'Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua',
      'Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau',
      'Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland',
      'Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia',
      'Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe',
      'Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia',
      'Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain',
      'Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan',
      'Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia',
      'Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom',
      'United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam',
      'Yemen','Zambia','Zimbabwe',
    ];

    const ETAPAS = [
      { id: 'qualificacao',      label: 'Qualificacao',      color: '#94A3B8' },
      { id: 'fazer-orcamento',   label: 'Fazer Orcamento',   color: '#3B82F6' },
      { id: 'orcamento-pronto',  label: 'Orcamento Pronto',  color: '#8B5CF6' },
      { id: 'orcamento-enviado', label: 'Orcamento Enviado', color: '#F59E0B' },
      { id: 'negociacao',        label: 'Negociacao',        color: '#EAB308' },
      { id: 'fechado',           label: 'Fechado',           color: '#10B981' },
      { id: 'perdido',           label: 'Perdido',           color: '#EF4444' },
    ];

    // Cards de exemplo. Sera substituido por leads reais quando
    // integrarmos com o modulo de Clientes/Orcamento.
    const SEED_LEADS = [
      { id: 'lead_01', cliente: 'Maria Silva',      valor: 25000, etapa: 'qualificacao',      data: '2026-04-22' },
      { id: 'lead_02', cliente: 'Joao Santos',      valor: 80000, etapa: 'qualificacao',      data: '2026-04-23' },
      { id: 'lead_03', cliente: 'Ana Costa',        valor: 18500, etapa: 'fazer-orcamento',   data: '2026-04-19' },
      { id: 'lead_04', cliente: 'Pedro Lima',       valor: 12000, etapa: 'orcamento-pronto',  data: '2026-04-15' },
      { id: 'lead_05', cliente: 'Carla Mendes',     valor: 32000, etapa: 'orcamento-enviado', data: '2026-04-12' },
      { id: 'lead_06', cliente: 'Ricardo Alves',    valor: 45000, etapa: 'negociacao',        data: '2026-04-08' },
      { id: 'lead_07', cliente: 'Fernanda Dias',    valor: 95000, etapa: 'fechado',           data: '2026-04-02' },
      { id: 'lead_08', cliente: 'Marcos Rocha',     valor: 28000, etapa: 'perdido',           data: '2026-03-28' },
    ];

    const store = Storage.scope('crm');
    const state = {
      view: 'kanban',  // 'kanban' | 'lista'
      leads: [],
      // Felipe: filtros do CRM. Aplicados sobre os leads do pipeline.
      // Os KPIs (Fechado Ano/Mes) e os totais por coluna do kanban
      // recalculam reativamente quando o usuario muda qualquer filtro.
      filtros: {
        busca: '',           // busca livre: cliente, AGP, reserva
        cidade: '',
        estado: '',
        representante: '',   // followup
        gerente: '',
        coordenador: '',
        supervisor: '',
        destino: '',         // '' | 'nacional' | 'internacional'
      },
      // KPIs Fechado: ano civil + mes fiscal (16-15).
      // Default: ano e mes atual.
      kpiAno: (new Date()).getFullYear(),
      kpiMesAno: (new Date()).getFullYear(),
      kpiMes: (new Date()).getMonth() + 1,  // 1-12
    };
    let loaded = false;

    function load() {
      if (loaded) return;
      const lista = store.get('leads');
      if (lista === null || (Array.isArray(lista) && lista.length === 0 && !store.get('seeded'))) {
        state.leads = SEED_LEADS.slice();
        store.set('leads', state.leads);
        store.set('seeded', true);
      } else {
        state.leads = lista || [];
      }
      // Filtra leads deletados (impede sync trazer de volta)
      try {
        var deletados = JSON.parse(localStorage.getItem('projetta_leads_deletados') || '[]');
        if (deletados.length > 0) {
          var setDel = new Set(deletados);
          var antes = state.leads.length;
          state.leads = state.leads.filter(function(l) { return !setDel.has(l.id); });
          if (state.leads.length < antes) store.set('leads', state.leads);
        }
      } catch(_){}
      const v = store.get('view');
      if (v === 'kanban' || v === 'lista') state.view = v;
      // Migracao: pra leads ja em 'fechado' que nao tem `fechadoEm`, copia `data`.
      // Isso preserva o seed antigo e o historico antes desta feature existir.
      migrarFechadoEm();
      loaded = true;
    }

    function migrarFechadoEm() {
      if (store.get('migracao_fechadoEm_done')) return;
      let mudou = false;
      state.leads.forEach(lead => {
        if (lead.etapa === 'fechado' && !lead.fechadoEm && lead.data) {
          lead.fechadoEm = lead.data;
          mudou = true;
        }
      });
      if (mudou) save();
      store.set('migracao_fechadoEm_done', true);
    }

    function save() {
      store.set('leads', state.leads);
      store.set('view', state.view);
    }

    // Felipe (sessao 31): AGP automatico.
    // Ultimo: AGP004645. Proximo: AGP004646, etc.
    // Escaneia todos os leads pra achar o maior numero e incrementar.
    function proximoAGP() {
      var max = 4645; // piso definido pelo Felipe
      (state.leads || []).forEach(function(l) {
        if (!l.numeroAGP) return;
        var m = String(l.numeroAGP).match(/(\d+)/);
        if (m) {
          var n = parseInt(m[1], 10);
          if (n > max) max = n;
        }
      });
      var prox = max + 1;
      return 'AGP' + String(prox).padStart(6, '0');
    }

    function fmtBR(n) {
      return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtData(iso) {
      if (!iso) return '';
      const [y, m, d] = String(iso).split('-');
      if (!y || !m || !d) return iso;
      return `${d}/${m}/${y}`;
    }
    function escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function etapaPorId(id) { return ETAPAS.find(e => e.id === id) || ETAPAS[0]; }


    // ViaCEP — API publica brasileira (gratis, sem auth)
    async function buscarCEP(cep) {
      const limpo = String(cep || '').replace(/\D/g, '');
      if (limpo.length !== 8) throw new Error('CEP precisa ter 8 digitos');
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      if (!res.ok) throw new Error('Falha ao consultar CEP');
      const data = await res.json();
      if (data.erro) throw new Error('CEP nao encontrado');
      return { cidade: data.localidade || '', estado: data.uf || '' };
    }

    // Estado do modal
    const modalState = {
      modo: 'reserva',
      editandoId: null,  // null = criando novo; string = editando lead existente
      numeroReserva: '', numeroAGP: '',
      cliente: '', telefone: '', email: '',
      cep: '', cidade: '', estado: '',
      // Felipe (do doc): card comeca VAZIO em representante. Apos integracao
      // Weiku, vai puxar automatico. Ate la, fica em branco.
      representante: '',  // razao social (auto via lookup do followup)
      representante_followup: '',  // followup digitado pelo user
      representante_contato: '',  // nome do contato principal (auto)
      valor: '', etapa: 'qualificacao',
      destinoTipo: 'nacional',
      destinoPais: '',
    };
    function resetModalState() {
      Object.assign(modalState, {
        modo: 'reserva',
        editandoId: null,
        numeroReserva: '', numeroAGP: '',
        cliente: '', telefone: '', email: '',
        cep: '', cidade: '', estado: '',
        representante: '',
        representante_followup: '',
        representante_contato: '',
        valor: '', etapa: 'qualificacao',
        destinoTipo: 'nacional',
        destinoPais: '',
      });
    }
    function preencherModalComLead(lead) {
      Object.assign(modalState, {
        modo: 'manual',  // edicao nao tem busca
        editandoId: lead.id,
        numeroReserva: lead.numeroReserva || '',
        numeroAGP: lead.numeroAGP || '',
        cliente: lead.cliente || '',
        telefone: lead.telefone || '',
        email: lead.email || '',
        cep: lead.cep || '',
        cidade: lead.cidade || '',
        estado: lead.estado || '',
        representante: lead.representante || '',
        representante_followup: lead.representante_followup || '',
        representante_contato: lead.representante_contato || '',
        data_reserva: lead.data_reserva || '',
        // R01: valor SEMPRE com 2 casas decimais formato BR (ex: 80.000,00)
        valor: lead.valor != null ? fmtBR(lead.valor) : '',
        etapa: lead.etapa || 'qualificacao',
        fechadoEm: lead.fechadoEm || '',
        destinoTipo: lead.destinoTipo || 'nacional',
        destinoPais: lead.destinoPais || '',
        porta_largura: lead.porta_largura || '',
        porta_altura: lead.porta_altura || '',
        porta_modelo: lead.porta_modelo || '',
        porta_cor: lead.porta_cor || '',
        porta_fechadura_digital: lead.porta_fechadura_digital || '',
      });
    }

    function renderModal() {
      const m = modalState;
      const tabBtn = (id, label) => `<button class="crm-modal-tab ${m.modo===id?'is-active':''}" data-modo="${id}">${label}</button>`;
      const editando = m.editandoId !== null;
      // No modo "Por Reserva" (criar) tem busca Weiku.
      // No modo edicao mostra so o campo (sem botao de busca).
      const searchSection = m.modo === 'reserva' && !editando ? `
        <div class="crm-form-row cols-1">
          <div class="crm-field">
            <label>Numero da Reserva</label>
            <div class="crm-search-inline">
              <input type="text" id="crm-search-input"
                value="${escapeHtml(m.numeroReserva)}"
                placeholder="" />
              <button class="crm-btn-search" id="crm-btn-search">Buscar Weiku</button>
            </div>
            <span class="crm-field-hint" id="crm-search-status"></span>
          </div>
        </div>
      ` : (editando ? `
        <div class="crm-form-row cols-1">
          <div class="crm-field">
            <label>Numero da Reserva</label>
            <input type="text" data-field="numeroReserva" value="${escapeHtml(m.numeroReserva)}" placeholder="" />
          </div>
        </div>
      ` : '');
      const etapasOpts = ETAPAS.map(e => `<option value="${e.id}" ${m.etapa===e.id?'selected':''}>${e.label}</option>`).join('');
      const tituloModal = editando ? 'Editar Lead' : 'Novo Lead';
      const tabsHtml = editando ? '' : `
              <div class="crm-modal-tabs">
                ${tabBtn('reserva', 'Por Reserva')}
                ${tabBtn('manual', 'Manual')}
              </div>
      `;
      const labelEtapa = editando ? 'Etapa atual' : 'Etapa inicial';
      const labelBotao = editando ? 'Salvar Alteracoes' : 'Criar Lead';
      const botaoExcluir = editando
        ? `<button class="crm-btn-cancel" id="crm-btn-delete" style="color:#c0392b;border-color:#e8c5c0;">Excluir Lead</button>`
        : '';
      return `
        <div class="crm-modal-overlay" id="crm-modal-overlay">
          <div class="crm-modal" role="dialog" aria-modal="true">
            <div class="crm-modal-header">
              <div class="crm-modal-title">${tituloModal}</div>
              <button class="crm-modal-close" id="crm-modal-close" title="Fechar">×</button>
            </div>
            <div class="crm-modal-body">
              ${tabsHtml}
              ${searchSection}
              <div class="crm-form-row cols-3">
                <div class="crm-field">
                  <label>Nome do Cliente</label>
                  <input type="text" data-field="cliente" data-titlecase="1" value="${escapeHtml(m.cliente)}" placeholder="" />
                </div>
                <div class="crm-field">
                  <label>Telefone</label>
                  <input type="text" data-field="telefone" value="${escapeHtml(m.telefone)}" />
                </div>
                <div class="crm-field">
                  <label>Email</label>
                  <input type="email" data-field="email" value="${escapeHtml(m.email || '')}" placeholder="" />
                </div>
              </div>
              <div class="crm-form-row cols-3" id="crm-field-endereco-br" style="${m.destinoTipo === 'internacional' ? 'display:none;' : ''}">
                <div class="crm-field">
                  <label>CEP</label>
                  <input type="text" data-field="cep" value="${escapeHtml(m.cep)}" placeholder="" maxlength="9" />
                  <span class="crm-field-hint" id="crm-cep-status"></span>
                </div>
                <div class="crm-field">
                  <label>Cidade</label>
                  <input type="text" data-field="cidade" list="crm-cidades-list" data-titlecase="1" value="${escapeHtml(m.cidade)}" placeholder="" />
                  <datalist id="crm-cidades-list"></datalist>
                </div>
                <div class="crm-field">
                  <label>Estado</label>
                  <input type="text" data-field="estado" list="crm-estados-list" value="${escapeHtml(m.estado)}" placeholder="" maxlength="2" />
                  <datalist id="crm-estados-list">
                    ${['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => `<option value="${uf}">`).join('')}
                  </datalist>
                </div>
              </div>
              <div class="crm-form-row cols-1">
                <div class="crm-field" style="max-width:460px;">
                  <label>Representante (Follow Up)</label>
                  <input type="text" list="crm-followup-list" data-field="representante_followup" value="${escapeHtml(m.representante_followup || '')}" placeholder="" />
                  <datalist id="crm-followup-list">
                    ${(() => {
                      const cadStore = Storage.scope('cadastros');
                      // Garante seed se Representantes ainda nao foi aberto.
                      let reps = cadStore.get('representantes_lista');
                      if ((!reps || reps.length === 0) && window.Representantes && window.Representantes.listar) {
                        window.Representantes.listar();
                        reps = cadStore.get('representantes_lista') || [];
                      }
                      const followups = (reps || [])
                        .map(r => String(r.followup || '').trim())
                        .filter(Boolean);
                      const ordenados = Array.from(new Set(followups))
                        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
                      return ['<option value="PROJETTA"></option>', ...ordenados
                        .map(f => `<option value="${escapeHtml(f)}"></option>`)].join('');
                    })()}
                  </datalist>
                </div>
              </div>
              <div class="crm-form-row">
                <div class="crm-field">
                  <label>Razao Social <span class="crm-field-hint">auto pelo Follow Up</span></label>
                  <input type="text" data-field="representante" value="${escapeHtml(m.representante || '')}" readonly placeholder="Selecione um Follow Up acima" />
                </div>
                <div class="crm-field">
                  <label>Contato Principal <span class="crm-field-hint">auto pelo Follow Up</span></label>
                  <select data-field="representante_contato" id="crm-contato-select">
                    ${(() => {
                      const fup = m.representante_followup || '';
                      if (!fup) {
                        return '<option value="">— preencha o Follow Up acima —</option>';
                      }
                      if (fup === 'PROJETTA') {
                        return '<option value="">— venda interna —</option>';
                      }
                      const cadStore = Storage.scope('cadastros');
                      const reps = cadStore.get('representantes_lista') || [];
                      const rep = reps.find(r => r.followup === fup);
                      const contatos = rep && Array.isArray(rep.contatos) ? rep.contatos : [];
                      if (contatos.length === 0) {
                        return '<option value="">— sem contatos cadastrados —</option>';
                      }
                      const sel = m.representante_contato || (contatos[0] || {}).nome || '';
                      return contatos.map(c => {
                        const nome = c.nome || '';
                        const cargo = c.cargo ? ` (${c.cargo})` : '';
                        return `<option value="${escapeHtml(nome)}" ${nome === sel ? 'selected' : ''}>${escapeHtml(nome)}${escapeHtml(cargo)}</option>`;
                      }).join('');
                    })()}
                  </select>
                </div>
              </div>
              <div class="crm-form-row">
                <div class="crm-field">
                  <label>Destino</label>
                  <select data-field="destinoTipo">
                    <option value="nacional"      ${m.destinoTipo === 'nacional'      ? 'selected' : ''}>Nacional</option>
                    <option value="internacional" ${m.destinoTipo === 'internacional' ? 'selected' : ''}>Internacional</option>
                  </select>
                </div>
                <div class="crm-field" id="crm-field-pais" style="${m.destinoTipo === 'internacional' ? '' : 'display:none;'}">
                  <label>Pais</label>
                  <input type="text" list="crm-paises-list" data-field="destinoPais" value="${escapeHtml(m.destinoPais)}" placeholder="" />
                  <datalist id="crm-paises-list">
                    ${PAISES.map(p => `<option value="${escapeHtml(p)}"></option>`).join('')}
                  </datalist>
                </div>
              </div>
              ${(() => {
                // Felipe (sessao 2026-05): "valor estimado" foi REMOVIDO
                // do modal de criacao. So' aparece em EDICAO E APENAS se
                // a etapa atual ja e' "orcamento-pronto" pra frente —
                // antes disso o sistema nao sabe o preco ainda. Quando
                // etapa for orcamento-pronto+, o valor real vem do DRE
                // via botao "Aprovar Orcamento" (que empurra pro lead).
                const editando = m.editandoId !== null;
                const etapaPermiteValor = ['orcamento-pronto', 'orcamento-enviado', 'negociacao', 'fechado'].includes(m.etapa);
                const mostrarValor = editando && etapaPermiteValor;
                return `
                <div class="crm-form-row${mostrarValor ? '' : ' cols-1'}">
                  ${mostrarValor ? `
                  <div class="crm-field">
                    <label>Valor do Orcamento (R$)</label>
                    <input type="text" data-field="valor" value="${escapeHtml(m.valor)}" placeholder="" />
                    <span class="crm-field-hint">Vem do DRE apos aprovacao. Edicao manual permitida.</span>
                  </div>
                  ` : ''}
                  <div class="crm-field">
                    <label>${labelEtapa}</label>
                    <select data-field="etapa">${etapasOpts}</select>
                  </div>
                </div>
                `;
              })()}
              ${(m.etapa === 'fechado' && m.fechadoEm) ? `
              <div class="crm-form-row cols-1">
                <div class="crm-field">
                  <label>Data de Fechamento</label>
                  <input type="text" value="${escapeHtml(fmtData(m.fechadoEm))}" readonly style="background:#F2F4F8;cursor:not-allowed;color:var(--text-muted);" />
                  <span class="crm-field-hint">Definida quando o lead foi movido pra coluna 'Fechado'.</span>
                </div>
              </div>
              ` : ''}
              <div style="border-top:2px solid #1a5276;margin-top:16px;padding-top:14px">
                <div style="font-weight:700;font-size:14px;color:#1a5276;margin-bottom:10px">🚪 Dados da Porta</div>
                <div class="crm-form-row">
                  <div class="crm-field" style="width:100%">
                    <label>Largura (mm)</label>
                    <input type="text" data-field="porta_largura" value="${escapeHtml(m.porta_largura || '')}" placeholder="" />
                  </div>
                </div>
                <div class="crm-form-row">
                  <div class="crm-field" style="width:100%">
                    <label>Altura (mm)</label>
                    <input type="text" data-field="porta_altura" value="${escapeHtml(m.porta_altura || '')}" placeholder="" />
                  </div>
                </div>
                <div class="crm-form-row">
                  <div class="crm-field" style="width:100%">
                    <label>Modelo</label>
                    <select data-field="porta_modelo" style="width:100%">
                      <option value="" ${!m.porta_modelo ? 'selected' : ''}>—</option>
                      ${(() => {
                        try {
                          const cadStore = Storage.scope('cadastros');
                          const modelos = cadStore.get('modelos_lista') || [];
                          return modelos
                            .slice()
                            .sort((a, b) => (a.numero || 0) - (b.numero || 0))
                            .map(mod => {
                              const num = String(mod.numero || '').padStart(2, '0');
                              const label = 'Modelo ' + num + (mod.nome ? ' - ' + mod.nome : '');
                              const sel = (m.porta_modelo == num || m.porta_modelo == mod.numero) ? 'selected' : '';
                              return '<option value="' + num + '" ' + sel + '>' + escapeHtml(label) + '</option>';
                            })
                            .join('');
                        } catch(_) { return ''; }
                      })()}
                    </select>
                  </div>
                </div>
                <div class="crm-form-row">
                  <div class="crm-field" style="width:100%">
                    <label>Cor</label>
                    <input type="text" data-field="porta_cor" list="crm-cores-porta-list" value="${escapeHtml(m.porta_cor || '')}" placeholder="Digite ou escolha uma cor" style="width:100%" />
                    <datalist id="crm-cores-porta-list">
                      ${(() => {
                        try {
                          const cadStore = Storage.scope('cadastros');
                          const superficies = cadStore.get('superficies_lista') || [];
                          // Felipe sessao 2026-05: deduplica pelo NOME CURTO
                          // (sem o sufixo " - 1500 X 5000", "1500 X 6000" etc)
                          // pra mostrar so cor uma vez. O cadastro tem 4 entradas
                          // por cor (uma pra cada altura de chapa).
                          const vistas = new Set();
                          const opts = [];
                          superficies.forEach(s => {
                            const desc = String(s.descricao || '').trim();
                            if (!desc) return;
                            const limpo = desc.replace(/\s*[-–]\s*\d{3,4}\s*[xX×]\s*\d{3,4}\s*$/, '').trim();
                            if (!limpo) return;
                            const k = limpo.toUpperCase();
                            if (vistas.has(k)) return;
                            vistas.add(k);
                            opts.push('<option value="' + escapeHtml(limpo) + '">');
                          });
                          return opts.join('');
                        } catch(_) { return ''; }
                      })()}
                    </datalist>
                  </div>
                </div>
                <div class="crm-form-row">
                  <div class="crm-field" style="width:100%">
                    <label>Fechadura Digital</label>
                    <select data-field="porta_fechadura_digital" style="width:100%">
                      <option value="" ${!m.porta_fechadura_digital ? 'selected' : ''}>—</option>
                      <option value="nao" ${m.porta_fechadura_digital === 'nao' ? 'selected' : ''}>Nao se aplica</option>
                      ${(() => {
                        try {
                          const cadStore = Storage.scope('cadastros');
                          const acessorios = cadStore.get('acessorios_lista') || [];
                          return acessorios
                            .filter(a => (a.familia || '') === 'Fechadura Digital')
                            .sort((a, b) => (a.descricao || '').localeCompare(b.descricao || ''))
                            .map(a => {
                              const cod = a.codigo || '';
                              const desc = a.descricao || cod;
                              const sel = m.porta_fechadura_digital === cod ? 'selected' : '';
                              return '<option value="' + escapeHtml(cod) + '" ' + sel + '>' + escapeHtml(desc) + '</option>';
                            })
                            .join('');
                        } catch(_) { return ''; }
                      })()}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div class="crm-modal-footer">
              ${botaoExcluir}
              <div style="flex:1;"></div>
              <button class="crm-btn-cancel" id="crm-btn-cancel">Cancelar</button>
              <button class="crm-btn-primary" id="crm-btn-create">${labelBotao}</button>
            </div>
          </div>
        </div>
      `;
    }

    function abrirModal(container) {
      resetModalState();
      const mount = container.querySelector('#crm-modal-mount');
      if (!mount) return;
      mount.innerHTML = renderModal();
      bindModalEvents(container);
    }

    function abrirModalEdicao(container, leadId) {
      const lead = state.leads.find(l => l.id === leadId);
      if (!lead) return;
      preencherModalComLead(lead);
      const mount = container.querySelector('#crm-modal-mount');
      if (!mount) return;
      mount.innerHTML = renderModal();
      bindModalEvents(container);
    }

    function reRenderModal(container) {
      const mount = container.querySelector('#crm-modal-mount');
      if (!mount) return;
      mount.innerHTML = renderModal();
      bindModalEvents(container);
    }

    function fecharModal(container) {
      const mount = container.querySelector('#crm-modal-mount');
      if (mount) mount.innerHTML = '';
    }

    function bindModalEvents(container) {
      const overlay = container.querySelector('#crm-modal-overlay');
      if (!overlay) return;

      // Fechar — Felipe: SO via X ou botao Cancelar. Click fora (no overlay
      // escuro) NAO fecha mais — antes ele acidentalmente fechava ao sair
      // do card com o mouse.
      container.querySelector('#crm-modal-close')?.addEventListener('click', () => fecharModal(container));
      container.querySelector('#crm-btn-cancel')?.addEventListener('click', () => fecharModal(container));
      // overlay click: REMOVIDO de proposito.

      // Tabs (modo)
      container.querySelectorAll('.crm-modal-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          modalState.modo = btn.dataset.modo;
          reRenderModal(container);
        });
      });

      // Inputs do form -> sincroniza modalState
      container.querySelectorAll('.crm-modal [data-field]').forEach(el => {
        const evt = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(evt, (e) => { modalState[el.dataset.field] = e.target.value; });
      });

      // Quando o user muda o Follow Up: busca o representante e preenche
      // automaticamente Razao Social + lista de Contatos. Felipe pediu R/L only.
      const followupInput = container.querySelector('input[data-field="representante_followup"]');
      if (followupInput) {
        const aplicarFollowup = () => {
          const fup = (followupInput.value || '').trim();
          const razaoInput = container.querySelector('input[data-field="representante"]');
          const contatoSel = container.querySelector('#crm-contato-select');
          if (!fup || fup === 'PROJETTA') {
            modalState.representante = 'Projetta Portas Exclusivas LTDA';
            modalState.representante_contato = '';
            if (razaoInput) razaoInput.value = 'Projetta Portas Exclusivas LTDA';
            if (contatoSel) contatoSel.innerHTML = '<option value="">— venda interna —</option>';
            return;
          }
          const cadStore = Storage.scope('cadastros');
          const reps = cadStore.get('representantes_lista') || [];
          const rep = reps.find(r => r.followup === fup);
          if (!rep) {
            // Followup digitado nao corresponde a nenhum cadastro
            modalState.representante = '';
            modalState.representante_contato = '';
            if (razaoInput) razaoInput.value = '';
            if (contatoSel) contatoSel.innerHTML = '<option value="">— Follow Up nao encontrado —</option>';
            return;
          }
          modalState.representante = rep.razao_social || '';
          if (razaoInput) razaoInput.value = rep.razao_social || '';
          const contatos = Array.isArray(rep.contatos) ? rep.contatos : [];
          if (contatos.length === 0) {
            modalState.representante_contato = '';
            if (contatoSel) contatoSel.innerHTML = '<option value="">— sem contatos cadastrados —</option>';
            return;
          }
          const primeiro = (contatos[0] || {}).nome || '';
          modalState.representante_contato = primeiro;
          if (contatoSel) {
            contatoSel.innerHTML = contatos.map(c => {
              const nome = c.nome || '';
              const cargo = c.cargo ? ` (${c.cargo})` : '';
              return `<option value="${escapeHtml(nome)}" ${nome === primeiro ? 'selected' : ''}>${escapeHtml(nome)}${escapeHtml(cargo)}</option>`;
            }).join('');
          }
        };
        // Dispara em change (combobox tambem dispara change ao selecionar)
        followupInput.addEventListener('change', aplicarFollowup);
        // Tambem em blur, caso digite manualmente
        followupInput.addEventListener('blur', aplicarFollowup);
      }

      // Destino: mostra/esconde campos dinamicamente sem re-render do modal.
      // Internacional → esconde CEP/Cidade/Estado (campos do Brasil), mostra Pais.
      // Nacional → mostra CEP/Cidade/Estado, esconde Pais.
      function aplicarDestino(tipo) {
        const paisField = container.querySelector('#crm-field-pais');
        const enderecoBR = container.querySelector('#crm-field-endereco-br');
        if (paisField)  paisField.style.display  = (tipo === 'internacional') ? '' : 'none';
        if (enderecoBR) enderecoBR.style.display = (tipo === 'internacional') ? 'none' : '';
        if (tipo === 'nacional') {
          modalState.destinoPais = '';
          const paisInput = container.querySelector('input[data-field="destinoPais"]');
          if (paisInput) paisInput.value = '';
        } else {
          // Internacional: limpa CEP/Cidade/Estado pra nao gravar dado de outro destino
          modalState.cep = '';
          modalState.cidade = '';
          modalState.estado = '';
          ['cep','cidade','estado'].forEach(f => {
            const el = container.querySelector(`input[data-field="${f}"]`);
            if (el) el.value = '';
          });
        }
      }
      const destinoSelect = container.querySelector('select[data-field="destinoTipo"]');
      if (destinoSelect) {
        destinoSelect.addEventListener('change', (e) => aplicarDestino(e.target.value));
      }

      // Felipe (do doc): formatacao progressiva do valor, estilo terminal
      // de banco. O usuario digita numeros e o sistema vai deslocando os
      // centavos pra esquerda. Sequencia ao digitar 7-0-0-0-0-0:
      //   "" → ",07" → ",70" → "7,00" → "70,00" → "700,00" → "7.000,00"
      // Backspace divide por 10. Em qualquer momento o valor numerico
      // armazenado em modalState.valor e' a string formatada (ex: "7.000,00").
      const valorInput = container.querySelector('input[data-field="valor"]');
      if (valorInput) {
        // Helper: formata centavos (inteiro) como string BR "R$ X.XXX,XX"
        const formatarCentavos = (cents) => {
          const valor = (cents || 0) / 100;
          return valor.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        };
        // Helper: extrai os digitos da string atual (ignora pontos, virgulas)
        const lerCentavosAtuais = () => {
          const apenasDigitos = String(valorInput.value || '').replace(/\D/g, '');
          if (!apenasDigitos) return 0;
          return parseInt(apenasDigitos, 10) || 0;
        };
        // Substitui handlers anteriores: usa keydown pra interceptar digitos
        // E impede entrada de outros caracteres.
        valorInput.addEventListener('keydown', (e) => {
          // Permite Tab, navegacao, Ctrl/Cmd+A, etc
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;

          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            const atual = lerCentavosAtuais();
            const novo = Math.floor(atual / 10);
            valorInput.value = novo > 0 ? formatarCentavos(novo) : '';
            modalState.valor = valorInput.value;
            return;
          }
          // Aceita apenas digitos 0-9
          if (e.key.length === 1 && /\d/.test(e.key)) {
            e.preventDefault();
            const atual = lerCentavosAtuais();
            const digito = parseInt(e.key, 10);
            const novo = atual * 10 + digito;
            // Limite razoavel: 9 digitos = R$ 9.999.999,99
            if (novo > 999999999) return;
            valorInput.value = formatarCentavos(novo);
            modalState.valor = valorInput.value;
            return;
          }
          // Bloqueia qualquer outro caractere
          if (e.key.length === 1) e.preventDefault();
        });
        // Paste: extrai digitos
        valorInput.addEventListener('paste', (e) => {
          e.preventDefault();
          const txt = (e.clipboardData || window.clipboardData).getData('text');
          const digits = String(txt).replace(/\D/g, '');
          if (!digits) return;
          const cents = parseInt(digits, 10) || 0;
          if (cents > 999999999) return;
          valorInput.value = formatarCentavos(cents);
          modalState.valor = valorInput.value;
        });
      }

      // Input de busca (reserva)
      const searchInput = container.querySelector('#crm-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          modalState.numeroReserva = e.target.value;
        });
      }

      // Botao Buscar Weiku
      container.querySelector('#crm-btn-search')?.addEventListener('click', async () => {
        const btn = container.querySelector('#crm-btn-search');
        const status = container.querySelector('#crm-search-status');
        const num = modalState.numeroReserva;
        if (!num || !num.trim()) {
          if (status) { status.textContent = 'Informe um numero antes de buscar.'; status.className = 'crm-field-hint crm-field-error'; }
          return;
        }
        btn.disabled = true;
        if (status) { status.textContent = 'Buscando na intranet Weiku...'; status.className = 'crm-field-hint'; }
        try {
          const dados = await WeikuClient.buscarReserva(num.trim());
          modalState.cliente = dados.nome_cliente || '';
          modalState.telefone = dados.telefone || '';
          modalState.cep = dados.cep || '';
          modalState.email = dados.email || '';
          modalState.representante = dados.representante || '';
          modalState.representante_followup = dados.representante_followup || '';
          modalState.data_reserva = dados.data_reserva || '';
          // API Weiku retorna campo 'codigo' com o AGP (ex: AGP004589)
          if (dados.codigo_agp && !modalState.numeroAGP) {
            modalState.numeroAGP = dados.codigo_agp;
          }
          // Tenta resolver CEP automaticamente
          if (modalState.cep) {
            try {
              const cepInfo = await buscarCEP(modalState.cep);
              modalState.cidade = cepInfo.cidade;
              modalState.estado = cepInfo.estado;
            } catch (_) { /* ignora */ }
          }
          reRenderModal(container);
          const s2 = container.querySelector('#crm-search-status');
          if (s2) {
            const st = WeikuClient.getStatus();
            s2.textContent = `✓ Dados carregados — fonte: ${st.source}`;
            s2.className = 'crm-field-hint crm-field-ok';
          }
        } catch (err) {
          if (status) { status.textContent = '✗ ' + (err.message || 'Erro na busca'); status.className = 'crm-field-hint crm-field-error'; }
        } finally {
          btn.disabled = false;
        }
      });

      // CEP -> ViaCEP automatico ao perder foco ou ao digitar 8 numeros
      const cepInput = container.querySelector('input[data-field="cep"]');
      if (cepInput) {
        const tryCep = async () => {
          const status = container.querySelector('#crm-cep-status');
          const limpo = (modalState.cep || '').replace(/\D/g, '');
          if (limpo.length !== 8) return;
          cepInput.classList.add('is-loading');
          if (status) { status.textContent = 'Consultando ViaCEP...'; status.className = 'crm-field-hint'; }
          try {
            const info = await buscarCEP(modalState.cep);
            modalState.cidade = info.cidade;
            modalState.estado = info.estado;
            const ci = container.querySelector('input[data-field="cidade"]');
            const es = container.querySelector('input[data-field="estado"]');
            if (ci) ci.value = info.cidade;
            if (es) es.value = info.estado;
            if (status) { status.textContent = '✓ CEP encontrado'; status.className = 'crm-field-hint crm-field-ok'; }
            // Dispara busca da lista de cidades do estado encontrado
            await carregarCidadesDoEstado(info.estado);
          } catch (err) {
            if (status) { status.textContent = '✗ ' + (err.message || 'CEP invalido'); status.className = 'crm-field-hint crm-field-error'; }
          } finally {
            cepInput.classList.remove('is-loading');
          }
        };
        cepInput.addEventListener('blur', tryCep);
        cepInput.addEventListener('input', (e) => {
          modalState.cep = e.target.value;
          const limpo = e.target.value.replace(/\D/g, '');
          if (limpo.length === 8) tryCep();
        });
      }

      // Quando user muda Estado manualmente, carrega cidades daquele estado
      const estadoInput = container.querySelector('input[data-field="estado"]');
      const cidadeInput = container.querySelector('input[data-field="cidade"]');
      const dlCidades   = container.querySelector('#crm-cidades-list');
      const cidadesCache = {}; // uf -> [nomes]

      // Felipe (sessao 2026-08): "ja pedi 10x quando nao coloco cep nao
      // esta puxando as cidade". As tentativas anteriores dependiam de
      // o Estado estar preenchido. Mas o usuario muitas vezes digita a
      // cidade SEM tocar no estado. Solucao definitiva: lista
      // GLOBAL de todas as cidades brasileiras (IBGE retorna ~5570
      // municipios) cacheada. Carrega 1 vez e usa pra autocompletar
      // SEMPRE — independente do estado. Quando o usuario seleciona
      // uma cidade da lista, preenche AMBOS cidade + estado.
      let cidadesGlobal = null;  // [{ nome, uf }]
      let cidadesGlobalLoading = false;

      async function carregarCidadesGlobal() {
        if (cidadesGlobal || cidadesGlobalLoading) return cidadesGlobal;
        cidadesGlobalLoading = true;
        try {
          const r = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
          if (!r.ok) { cidadesGlobalLoading = false; return null; }
          const data = await r.json();
          // IBGE pode retornar UF em varios caminhos diferentes dependendo
          // da versao da API. Tenta todos antes de desistir.
          cidadesGlobal = (data || []).map(m => {
            let uf = '';
            // Caminhos possiveis (mais comum primeiro):
            uf = m.microrregiao?.mesorregiao?.UF?.sigla
              || m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
              || m.UF?.sigla
              || '';
            return { nome: m.nome, uf };
          }).filter(c => c.uf && c.nome).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        } catch (e) {
          console.warn('[CRM] falha carregando cidades IBGE:', e);
        } finally {
          cidadesGlobalLoading = false;
        }
        return cidadesGlobal;
      }

      // Atualiza o datalist com base no que o usuario esta digitando.
      // Se ha estado, filtra por estado. Se nao ha, mostra TODAS as
      // cidades cuja inicial bate com o que ja foi digitado (limitado
      // a 200 pra nao travar o navegador).
      function atualizarDatalistCidades() {
        if (!dlCidades) return;
        const ufFiltro = (estadoInput?.value || '').toUpperCase().trim();
        const txtCidade = (cidadeInput?.value || '').trim().toLowerCase();

        // Se tem UF e cidades por UF carregadas → usa lista por UF
        if (ufFiltro.length === 2 && cidadesCache[ufFiltro]) {
          dlCidades.innerHTML = cidadesCache[ufFiltro]
            .map(n => `<option value="${escapeHtml(n)}"></option>`)
            .join('');
          return;
        }

        // Sem UF → usa lista GLOBAL filtrada pelo que foi digitado
        if (cidadesGlobal && txtCidade.length >= 1) {
          const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const txtN = norm(txtCidade);
          const matches = cidadesGlobal
            .filter(c => norm(c.nome).startsWith(txtN))
            .slice(0, 200);
          // Felipe (sessao 2026-08): formato "Cidade — UF" no value pra
          // que ao selecionar, o handler split() preenche cidade+estado.
          dlCidades.innerHTML = matches
            .map(c => `<option value="${escapeHtml(c.nome)} — ${escapeHtml(c.uf)}"></option>`)
            .join('');
        } else if (cidadesGlobal) {
          // Mostra primeiras 50 cidades se ainda nao digitou nada
          dlCidades.innerHTML = cidadesGlobal.slice(0, 50)
            .map(c => `<option value="${escapeHtml(c.nome)} — ${escapeHtml(c.uf)}"></option>`)
            .join('');
        }
      }

      async function carregarCidadesDoEstado(uf) {
        uf = String(uf || '').toUpperCase().trim();
        if (uf.length !== 2 || !dlCidades) return;
        if (!cidadesCache[uf]) {
          try {
            // API IBGE — publica e gratis, mesma confianca do ViaCEP.
            const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
            if (!r.ok) return;
            const data = await r.json();
            cidadesCache[uf] = (data || []).map(m => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
          } catch (e) {
            return;
          }
        }
        atualizarDatalistCidades();
      }

      // Carrega lista GLOBAL no background (nao bloqueia UI)
      carregarCidadesGlobal().then(() => atualizarDatalistCidades());

      // Listeners de input (dispara a cada tecla, mais responsivo que change)
      estadoInput?.addEventListener('input', () => {
        const v = estadoInput.value.toUpperCase().trim();
        modalState.estado = v;
        estadoInput.value = v;
        if (v.length === 2) carregarCidadesDoEstado(v);
        else atualizarDatalistCidades();
      });
      cidadeInput?.addEventListener('input', () => {
        const valor = cidadeInput.value;
        // Detecta se o usuario selecionou um item do datalist
        // (formato "Cidade — UF") — extrai e preenche estado tambem
        const match = valor.match(/^(.+?)\s+—\s+([A-Z]{2})$/);
        if (match) {
          modalState.cidade = match[1];
          modalState.estado = match[2];
          cidadeInput.value = match[1];
          if (estadoInput) estadoInput.value = match[2];
          carregarCidadesDoEstado(match[2]);
        } else {
          modalState.cidade = valor;
          atualizarDatalistCidades();
        }
      });
      cidadeInput?.addEventListener('change', () => {
        // Idem ao input — detecta formato "Cidade — UF"
        const valor = cidadeInput.value;
        const match = valor.match(/^(.+?)\s+—\s+([A-Z]{2})$/);
        if (match) {
          modalState.cidade = match[1];
          modalState.estado = match[2];
          cidadeInput.value = match[1];
          if (estadoInput) estadoInput.value = match[2];
        } else {
          modalState.cidade = valor;
        }
      });

      // Carga inicial: se modalState ja tem UF (edicao de lead), carrega
      const ufInicial = (modalState.estado || estadoInput?.value || '').toUpperCase().trim();
      if (ufInicial && ufInicial.length === 2) {
        carregarCidadesDoEstado(ufInicial);
      }


      // Botao Criar Lead / Salvar Alteracoes
      container.querySelector('#crm-btn-create')?.addEventListener('click', () => {
        const m = modalState;
        if (!m.cliente.trim()) {
          alert('Nome do Cliente e obrigatorio.');
          return;
        }
        const valorNum = parseFloat(String(m.valor).replace(/\./g, '').replace(',', '.')) || 0;

        if (m.editandoId) {
          // Modo edicao: atualiza lead existente
          const lead = state.leads.find(l => l.id === m.editandoId);
          if (!lead) { fecharModal(container); return; }
          lead.cliente = m.cliente.trim();
          lead.telefone = m.telefone.trim();
          lead.email = (m.email || '').trim();
          lead.cep = m.cep.trim();
          lead.cidade = m.cidade.trim();
          lead.estado = m.estado.trim();
          lead.representante = m.representante.trim();
          lead.representante_followup = (m.representante_followup || '').trim();
          lead.representante_contato  = (m.representante_contato || '').trim();
          lead.numeroReserva = m.numeroReserva.trim();
          lead.numeroAGP = m.numeroAGP.trim();
          lead.valor = valorNum;
          lead.destinoTipo = m.destinoTipo || 'nacional';
          lead.destinoPais = m.destinoTipo === 'internacional' ? (m.destinoPais || '') : '';
          lead.porta_largura = (m.porta_largura || '').trim();
          lead.porta_altura = (m.porta_altura || '').trim();
          lead.porta_modelo = (m.porta_modelo || '').trim();
          lead.porta_cor = (m.porta_cor || '').trim();
          lead.porta_fechadura_digital = m.porta_fechadura_digital || '';
          // data NAO eh atualizada — fica como criacao

          // Felipe (req 1 do CRM): mudanca de etapa via modal precisa do
          // mesmo tratamento do drag — se entrou em 'fechado', pede data.
          // Se saiu de 'fechado' pra outra coisa, limpa fechadoEm.
          const etapaAntiga = lead.etapa;
          const etapaNova = m.etapa;
          if (etapaAntiga !== etapaNova && etapaNova === 'fechado') {
            const hoje = (new Date()).toISOString().slice(0, 10);
            const dataDefault = lead.fechadoEm || hoje;
            // Fecha o modal de edicao primeiro (UX) e abre o de data
            save();
            fecharModal(container);
            render(container);
            abrirModalDataFechamento(container, dataDefault, (dataConfirmada) => {
              if (!dataConfirmada) return;  // cancelou — fica na etapa antiga
              lead.etapa = 'fechado';
              lead.fechadoEm = dataConfirmada;
              save();
              render(container);
            });
            return;
          }
          if (etapaAntiga === 'fechado' && etapaNova !== 'fechado') {
            lead.fechadoEm = null;
          }
          lead.etapa = etapaNova;

          // Felipe (do doc): sync bidirecional. Quando edito tel/cidade/etc
          // num card do CRM, deve refletir em Clientes (vista derivada ja
          // releria). Mas tambem deve sincronizar com OUTROS leads do mesmo
          // cliente (mesmo nome) e com o independente se houver.
          const keySync = (lead.cliente || '').trim().toLowerCase();
          if (keySync) {
            // Sync outros leads do mesmo cliente
            state.leads.forEach(other => {
              if (other.id !== lead.id && (other.cliente || '').trim().toLowerCase() === keySync) {
                ['telefone', 'email', 'cep', 'cidade', 'estado',
                 'representante', 'representante_followup', 'representante_contato'].forEach(f => {
                  if (lead[f] !== undefined && lead[f] !== '') other[f] = lead[f];
                });
              }
            });
            // Sync independente em Clientes (se existir)
            try {
              const cliStore = Storage.scope('clientes');
              const lista = cliStore.get('clientes_independentes') || [];
              const idx = lista.findIndex(c => (c.nome || '').trim().toLowerCase() === keySync);
              if (idx >= 0) {
                ['telefone', 'email', 'cep', 'cidade', 'estado', 'representante'].forEach(f => {
                  if (lead[f] !== undefined && lead[f] !== '') lista[idx][f] = lead[f];
                });
                cliStore.set('clientes_independentes', lista);
              }
            } catch (e) {
              console.warn('[CRM] sync independente falhou:', e);
            }
          }
        } else {
          // Modo criacao: novo lead
          const novo = {
            id: 'lead_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            cliente: m.cliente.trim(),
            telefone: m.telefone.trim(),
            email: (m.email || '').trim(),
            cep: m.cep.trim(),
            cidade: m.cidade.trim(),
            estado: m.estado.trim(),
            representante: m.representante.trim(),
            representante_followup: (m.representante_followup || '').trim(),
            representante_contato:  (m.representante_contato || '').trim(),
            numeroReserva: m.numeroReserva.trim(),
            numeroAGP: m.numeroAGP.trim(),
            data_reserva: (m.data_reserva || '').trim(),
            valor: valorNum,
            etapa: m.etapa,
            destinoTipo: m.destinoTipo || 'nacional',
            destinoPais: m.destinoTipo === 'internacional' ? (m.destinoPais || '') : '',
            // Felipe sessao 2026-05: BUG FIX CRITICO - dados da porta
            // do card "Novo Lead" estavam sumindo. Felipe preenchia
            // Largura/Altura/Modelo/Cor/Fechadura e arrastava pra
            // "Fazer Orcamento" - chegava no orcamento sem dados da porta.
            // Causa: estes 5 campos NUNCA eram persistidos no objeto novo.
            // Agora fluem corretamente pro orcamento via lead.porta_*.
            porta_largura:           (m.porta_largura || '').trim(),
            porta_altura:            (m.porta_altura || '').trim(),
            porta_modelo:            (m.porta_modelo || '').trim(),
            porta_cor:               (m.porta_cor || '').trim(),
            porta_fechadura_digital: (m.porta_fechadura_digital || '').trim(),
            data: new Date().toISOString().slice(0, 10),
          };
          state.leads.push(novo);
        }
        save();
        fecharModal(container);
        render(container);
      });

      // Botao Excluir Lead (so existe em modo edicao)
      container.querySelector('#crm-btn-delete')?.addEventListener('click', () => {
        if (!modalState.editandoId) return;
        const lead = state.leads.find(l => l.id === modalState.editandoId);
        if (!lead) return;
        const ok = confirm(`Excluir o lead de "${lead.cliente}" do CRM?\n\nO cliente vai continuar em Clientes (com os dados como estao agora).\nLa voce pode editar ou excluir definitivamente.`);
        if (!ok) return;
        // Felipe (req 6): snapshota o cliente em Clientes ANTES de remover
        // o lead. So' tem efeito se este e' o ultimo lead deste cliente —
        // se houver outros leads do mesmo cliente no CRM, eles continuam
        // alimentando a vista normalmente.
        const cliKey = (lead.cliente || '').trim().toLowerCase();
        const outrosLeadsDoMesmoCliente = state.leads.some(l =>
          l.id !== lead.id && (l.cliente || '').trim().toLowerCase() === cliKey
        );
        if (!outrosLeadsDoMesmoCliente && cliKey && window.Clientes && typeof window.Clientes.snapshotarComoIndependente === 'function') {
          // Monta cliente "agregado" com os dados do proprio lead
          window.Clientes.snapshotarComoIndependente({
            key: cliKey,
            nome: lead.cliente || '',
            telefone: lead.telefone || '',
            email: lead.email || '',
            cep: lead.cep || '',
            cidade: lead.cidade || '',
            estado: lead.estado || '',
            representante: lead.representante || '',
            numerosReserva: lead.numeroReserva ? [lead.numeroReserva] : [],
            numerosAGP: lead.numeroAGP ? [lead.numeroAGP] : [],
            negociosFechados: lead.etapa === 'fechado' ? 1 : 0,
            negociosPerdidos: lead.etapa === 'perdido' ? 1 : 0,
            valorFechado: lead.etapa === 'fechado' ? (Number(lead.valor) || 0) : 0,
            ultimaData: lead.fechadoEm || lead.data || '',
          });
        }
        state.leads = state.leads.filter(l => l.id !== modalState.editandoId);
        // Salva ID deletado pra sync nao trazer de volta
        try {
          var deletados = JSON.parse(localStorage.getItem('projetta_leads_deletados') || '[]');
          deletados.push(modalState.editandoId);
          localStorage.setItem('projetta_leads_deletados', JSON.stringify(deletados));
        } catch(_){}
        save();
        fecharModal(container);
        render(container);
      });
    }

    // ============================================================
    // FILTROS E KPIs
    // ============================================================

    /**
     * Lê hierarquia (coordenador, supervisor) do cadastro de Representantes
     * via API publica (R09 — sem acesso direto ao storage de outro modulo).
     * Cacheado pra nao recarregar a cada lead. Indexado por followup
     * (case-insensitive).
     */
    let _repsCache = null;
    function getRepsIndex() {
      if (_repsCache) return _repsCache;
      const reps = (window.Representantes && typeof window.Representantes.listar === 'function')
        ? window.Representantes.listar()
        : [];
      const idx = {};
      reps.forEach(r => {
        const key = String(r.followup || '').trim().toLowerCase();
        if (key) idx[key] = r;
      });
      _repsCache = idx;
      return idx;
    }
    /** Limpa o cache — chamar quando lead/representante muda */
    function invalidarRepsCache() { _repsCache = null; }

    /** Devolve { gerente, coordenador, supervisor } pro lead (derivado do rep) */
    function hierarquiaDoLead(lead) {
      const idx = getRepsIndex();
      const key = String(lead.representante_followup || '').trim().toLowerCase();
      const r = idx[key];
      if (!r) return { gerente: '', coordenador: '', supervisor: '' };
      return {
        gerente: r.gerente || '',
        coordenador: r.coordenador || '',
        supervisor: r.supervisor || '',
      };
    }

    /**
     * Aplica os filtros do `state.filtros` em uma lista de leads.
     * Combinacao AND. Strings comparadas case-insensitive e via "contains".
     * Selects exigem match exato (depois de normalizar).
     */
    function aplicarFiltros(leads) {
      const f = state.filtros;
      const buscaNorm = (f.busca || '').trim().toLowerCase();
      const has = (s) => String(s || '').toLowerCase().includes(buscaNorm);

      return leads.filter(l => {
        // Busca livre: cliente, AGP, reserva
        if (buscaNorm && !(has(l.cliente) || has(l.numeroAGP) || has(l.numeroReserva))) {
          return false;
        }
        if (f.cidade && (l.cidade || '') !== f.cidade) return false;
        if (f.estado && (l.estado || '') !== f.estado) return false;
        if (f.representante && (l.representante_followup || '') !== f.representante) return false;
        if (f.destino && (l.destinoTipo || 'nacional') !== f.destino) return false;
        if (f.gerente || f.coordenador || f.supervisor) {
          const h = hierarquiaDoLead(l);
          if (f.gerente && h.gerente !== f.gerente) return false;
          if (f.coordenador && h.coordenador !== f.coordenador) return false;
          if (f.supervisor && h.supervisor !== f.supervisor) return false;
        }
        return true;
      });
    }

    /**
     * Devolve listas distintas pra popular os <select> de filtros.
     * Sempre derivadas dos leads atuais — nao dos cadastros — pra
     * mostrar so' valores que existem no pipeline.
     */
    function opcoesFiltros() {
      const cidades = new Set();
      const estados = new Set();
      const reps = new Set();
      const gers = new Set();
      const coords = new Set();
      const sups = new Set();
      state.leads.forEach(l => {
        if (l.cidade) cidades.add(l.cidade);
        if (l.estado) estados.add(l.estado);
        if (l.representante_followup) reps.add(l.representante_followup);
        const h = hierarquiaDoLead(l);
        if (h.gerente)     gers.add(h.gerente);
        if (h.coordenador) coords.add(h.coordenador);
        if (h.supervisor)  sups.add(h.supervisor);
      });
      const sort = (s) => Array.from(s).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
      return {
        cidades: sort(cidades),
        estados: sort(estados),
        representantes: sort(reps),
        gerentes: sort(gers),
        coordenadores: sort(coords),
        supervisores: sort(sups),
      };
    }

    /**
     * Felipe (regra de fechamento):
     *   - Ano: civil (1/jan a 31/dez)
     *   - Mes: FISCAL (dia 16 do mes anterior ate dia 15 do mes corrente)
     * Ex: "Janeiro/2026" = 16/dez/2025 a 15/jan/2026.
     *
     * Recebe ano (numero), mes (1-12 ou null pra so ano).
     * Devolve { ini: Date, fim: Date } com inicio inclusive e fim exclusivo.
     */
    function periodoFechamento(ano, mes) {
      if (mes == null) {
        return {
          ini: new Date(ano, 0, 1),
          fim: new Date(ano + 1, 0, 1),
        };
      }
      // Mes fiscal: 16 do mes anterior ate 15 do mes corrente (inclusive).
      // Em Date: ini = (mes-1) dia 16, fim = mes dia 16 (exclusivo).
      const m0 = mes - 1;             // mes do ini (mes anterior em base 0)
      // Se mes corrente eh janeiro (1), o anterior eh dezembro do ano-1.
      const iniAno = (m0 - 1) < 0 ? ano - 1 : ano;
      const iniMes = (m0 - 1 + 12) % 12;
      return {
        ini: new Date(iniAno, iniMes, 16),
        fim: new Date(ano, m0, 16),
      };
    }

    /**
     * Soma valores dos leads `fechado` cuja `fechadoEm` cai no periodo.
     * `leadsBase` ja' deve vir filtrado (se houver filtros aplicados).
     */
    function somarFechadosNoPeriodo(leadsBase, ano, mes) {
      const { ini, fim } = periodoFechamento(ano, mes);
      let total = 0;
      let count = 0;
      leadsBase.forEach(l => {
        if (l.etapa !== 'fechado') return;
        if (!l.fechadoEm) return;
        const d = new Date(l.fechadoEm + 'T00:00:00');
        if (isNaN(d.getTime())) return;
        if (d >= ini && d < fim) {
          total += Number(l.valor) || 0;
          count++;
        }
      });
      return { total, count };
    }

    /** Anos disponiveis no filtro do KPI: 2021 ate ano atual */
    function anosFiltroKPI() {
      const atual = (new Date()).getFullYear();
      const anos = [];
      for (let a = atual; a >= 2021; a--) anos.push(a);
      return anos;
    }

    function renderKanban() {
      // Aplica filtros antes de montar as colunas
      const leadsFiltrados = aplicarFiltros(state.leads);
      const cols = ETAPAS.map(et => {
        const leadsCol = leadsFiltrados.filter(l => l.etapa === et.id);
        // Felipe (do doc): em Qualificacao e Fazer Orcamento o preco nao
        // existe ainda, entao o total da coluna nao tem sentido. Esconde
        // nessas 2 colunas.
        const escondeTotal = (et.id === 'qualificacao' || et.id === 'fazer-orcamento');
        const totalCol = escondeTotal
          ? null
          : leadsCol.reduce((s, l) => s + (Number(l.valor) || 0), 0);
        const cards = leadsCol.map(l => {
          const destinoLabel = l.destinoTipo === 'internacional'
            ? (l.destinoPais ? `🌎 ${escapeHtml(l.destinoPais)}` : '🌎 Internacional')
            : '';
          // Botao "Montar Orcamento" so aparece a partir da etapa "Fazer Orcamento"
          const etapasComBotao = ['fazer-orcamento', 'orcamento-pronto', 'orcamento-enviado', 'negociacao'];
          const mostraBtnOrc = etapasComBotao.includes(l.etapa);
          // Reserva: sempre que existir, em qualquer etapa
          const reservaLabel = l.numeroReserva
            ? `<span class="crm-card-reserva">Res ${escapeHtml(l.numeroReserva)}</span>`
            : '';
          // AGP: campo EDITAVEL no card quando em fase de orcamento.
          // Se ja preenchido, mostra como label clicavel pra editar.
          const agpField = etapasComBotao.includes(l.etapa)
            ? `<div class="crm-card-agp-field">
                 <label>AGP:</label>
                 <input type="text" data-action="edit-agp" data-lead-id="${l.id}" value="${escapeHtml(l.numeroAGP || '')}" placeholder="" />
               </div>`
            : '';

          // Felipe: caracteristicas do produto (Modelo / N folhas / Cor /
          // Rep / Cidade / Estado) so aparecem APOS salvar uma versao do
          // orcamento. Antes disso, card fica enxuto (so' nome/contato).
          // Lemos via API publica do orcamento — modulo isolado.
          const resumo = (window.Orcamento && window.Orcamento.resumoParaCardCRM)
            ? window.Orcamento.resumoParaCardCRM(l.id) : null;
          const temVersaoFechada = !!(resumo && resumo.hasVersaoFechada);

          // Cor: prefere corInterna; se vazia, usa corExterna
          const corPrefere = (resumo && (resumo.corInterna || resumo.corExterna)) || '';

          // Linhas do bloco "produto" (so se tem versao fechada)
          const blocoProduto = temVersaoFechada ? `
            <div class="crm-card-produto">
              ${resumo.modelo  ? `<div class="crm-card-prod-row"><span class="crm-card-prod-lbl">Modelo:</span> ${escapeHtml(resumo.modelo)}</div>` : ''}
              ${resumo.nFolhas ? `<div class="crm-card-prod-row"><span class="crm-card-prod-lbl">Folhas:</span> ${escapeHtml(resumo.nFolhas)}</div>` : ''}
              ${corPrefere    ? `<div class="crm-card-prod-row"><span class="crm-card-prod-lbl">Cor:</span> ${escapeHtml(corPrefere)}</div>` : ''}
            </div>` : '';

          // Bloco "local + representante" — mostra o representante, sua
          // classificacao (Show Room/Representante/Coordenador/etc) e a
          // comissao atribuida. Felipe pediu pra ver direto no card pra
          // saber se eh 6% ou 7%.
          const fup = l.representante_followup || '';
          let repInfo = null;
          if (fup) {
            // Lookup no cadastro de representantes (R09: via API publica)
            const reps = (window.Representantes && typeof window.Representantes.listar === 'function')
              ? window.Representantes.listar()
              : [];
            const rep = reps.find(r => String(r.followup || '').trim() === fup);
            if (rep) {
              repInfo = {
                nome: rep.razao_social || fup,
                classificacao: rep.classificacao || 'Representante',
                comissaoPct: ((Number(rep.comissao_maxima) || 0) * 100).toFixed(1).replace(/\.0$/, '') + '%',
              };
            } else if (fup === 'PROJETTA') {
              repInfo = { nome: 'PROJETTA (venda interna)', classificacao: 'Projetta', comissaoPct: '0%' };
            } else {
              repInfo = { nome: fup, classificacao: '—', comissaoPct: '—' };
            }
          }
          const cidadeEstado = [l.cidade, l.estado].filter(Boolean).join(' / ');
          const blocoLocal = (repInfo || cidadeEstado) ? `
            <div class="crm-card-local">
              ${repInfo ? `
                <div class="crm-card-loc-row">👤 ${escapeHtml(repInfo.nome)}</div>
                <div class="crm-card-loc-row crm-card-loc-meta">
                  <span class="crm-card-rep-class crm-card-rep-class-${escapeHtml(String(repInfo.classificacao).toLowerCase())}">${escapeHtml(repInfo.classificacao)}</span>
                  <span class="crm-card-rep-comissao">comissao ${escapeHtml(repInfo.comissaoPct)}</span>
                </div>
              ` : ''}
              ${cidadeEstado ? `<div class="crm-card-loc-row">📍 ${escapeHtml(cidadeEstado)}</div>` : ''}
            </div>` : '';

          // Data de fechamento — so aparece em leads na etapa 'fechado'
          const fechadoEmLabel = (l.etapa === 'fechado' && l.fechadoEm)
            ? `<div class="crm-card-fechado-em">✓ Fechado em ${fmtData(l.fechadoEm)}</div>`
            : '';

          // Lista de versoes — Felipe (sessao 2026-11): nova UI com botoes
          // de Abrir/Revisar/Nova Versao/Gerar Documentos. Quando lead tem
          // versao fechada, aparece resumo compacto da ultima versao + os
          // 4 botoes substituem o "Montar Orcamento".
          // (temVersaoFechada ja' foi declarada na linha 1354)
          const totalVersoes = (resumo && resumo.versoes) ? resumo.versoes.length : 0;
          let versoesUI = '';
          if (temVersaoFechada && resumo) {
            const ultimaVersao = (resumo.versoes || [])[0]; // ja vem ordenada (imutaveis primeiro)
            const numAprovadas = (resumo.versoes || []).filter(v => v.ehImutavelParaCard).length;
            versoesUI = `
              <div class="crm-card-versoes-resumo" style="
                background:#f0fdf4;border:1px solid #86efac;border-radius:4px;
                padding:6px 8px;margin:6px 0;font-size:11px;color:#14532d;
              ">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="background:#16a34a;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;">✓ V${ultimaVersao.numero}</span>
                  <span style="font-weight:700;">${totalVersoes} ${totalVersoes === 1 ? 'versão' : 'versões'}</span>
                  ${numAprovadas > 0 ? `<span style="color:#15803d;">(${numAprovadas} aprovada${numAprovadas > 1 ? 's' : ''})</span>` : ''}
                </div>
              </div>
            `;
          }

          return `
          <div class="crm-card" draggable="true" data-id="${l.id}">
            <div class="crm-card-titulo">${escapeHtml(l.cliente || '(sem nome)')}</div>
            ${reservaLabel ? `<div class="crm-card-numeros">${reservaLabel}</div>` : ''}
            ${l.data ? `<div class="crm-card-contato" style="font-size:11px;color:var(--text-muted);">📅 ${escapeHtml(fmtData(l.data))}</div>` : ''}
            ${l.telefone ? `<div class="crm-card-contato">📞 ${escapeHtml(l.telefone)}</div>` : ''}
            ${l.email ? `<div class="crm-card-contato">✉ ${escapeHtml(l.email)}</div>` : ''}
            ${agpField}
            ${blocoProduto}
            ${blocoLocal}
            ${(() => {
              // Felipe (do doc): em Qualificacao e Fazer Orcamento NAO se
              // sabe o preco ainda, entao NAO mostra valor. So' a partir de
              // Orcamento Pronto: ai' o valor vem do orcamento de verdade
              // (resumo.valor da ultima versao fechada). Se nao tem versao
              // fechada ainda mas o lead esta em etapa avancada (algum
              // backfill), cai no l.valor antigo.
              // Felipe (sessao 2026-06): "deixe no card ambos valores
              // Preco da Proposta e Cliente Paga (esse Cliente Paga
              // substitua para Preco da proposta com desconto)". Mostra
              // os 2 quando ha precoProposta diferente do valorFinal.
              // Felipe (sessao 2026-07): "MAIS preco cliente paga" —
              // adiciona 3a linha "Cliente Paga" pra deixar claro.
              const escondeValor = (l.etapa === 'qualificacao' || l.etapa === 'fazer-orcamento');
              if (escondeValor) return '';
              const valorFinal = (resumo && resumo.hasVersaoFechada) ? resumo.valor : (Number(l.valor) || 0);
              const precoProposta = (resumo && resumo.hasVersaoFechada)
                ? resumo.precoProposta
                : (Number(l.precoProposta) || 0);
              // Felipe (sessao 2026-08): "LEVE DOIS VALORES PARA CARD,
              // ORIGINAL E COM DESCONTO". Antes mostrava 3 linhas
              // (Preco Proposta + Com desconto + Cliente Paga) sendo
              // que linhas 2 e 3 eram o MESMO valor — redundante.
              // Agora mostra 2 linhas: Original (riscado) + Com Desconto.
              if (precoProposta > 0 && Math.abs(precoProposta - valorFinal) > 0.01) {
                return `
                  <div class="crm-card-valor-bloco">
                    <div class="crm-card-valor-row">
                      <span class="crm-card-valor-label">Original:</span>
                      <span class="crm-card-valor-tabela">R$ ${fmtBR(precoProposta)}</span>
                    </div>
                    <div class="crm-card-valor-row crm-card-valor-row-final">
                      <span class="crm-card-valor-label">Com Desconto:</span>
                      <span class="crm-card-valor">R$ ${fmtBR(valorFinal)}</span>
                    </div>
                  </div>`;
              }
              // Sem desconto (ou valor unico) — mostra 1 so'
              return `<div class="crm-card-valor">R$ ${fmtBR(valorFinal)}</div>`;
            })()}
            <div class="crm-card-meta">
              <span class="crm-card-data">${fmtData(l.data)}</span>
              ${destinoLabel ? `<span class="crm-card-destino">${destinoLabel}</span>` : ''}
            </div>
            ${fechadoEmLabel}
            ${(l.porta_largura || l.porta_modelo || l.porta_cor || mostraBtnOrc) ? `
              <div style="background:#f0f7ff;border:1px solid #c5d9ed;border-radius:4px;padding:6px 8px;margin:6px 0;font-size:11px;">
                <div>📐 <b>${l.porta_largura && l.porta_altura ? escapeHtml(l.porta_largura) + ' × ' + escapeHtml(l.porta_altura) + ' mm' : '—'}</b></div>
                <div>🚪 Modelo <b>${l.porta_modelo ? escapeHtml(l.porta_modelo) : '—'}</b></div>
                <div>🎨 ${l.porta_cor ? escapeHtml(l.porta_cor) : '—'}</div>
                <div>🔐 Fechadura: <b>${l.porta_fechadura_digital === 'sim' ? 'Digital' : l.porta_fechadura_digital === 'nao' ? 'Não' : '—'}</b></div>
              </div>
            ` : ''}
            ${versoesUI}
            ${mostraBtnOrc ? `
              <div class="crm-card-actions ${temVersaoFechada ? 'is-orcdocs' : ''}">
                ${!temVersaoFechada ? `
                  <button class="crm-card-btn-orc" data-action="montar-orcamento" data-lead-id="${l.id}" title="Abrir orcamento deste lead">📐 Montar Orcamento</button>
                ` : `
                  <button class="crm-orcdocs-btn" data-action="abrir-orcamento" data-lead-id="${l.id}" title="Escolha versao e abra o orcamento">
                    <span class="icon">📂</span><span>Abrir Orçamento</span>
                  </button>
                  <button class="crm-orcdocs-btn" data-action="revisar-versao" data-lead-id="${l.id}" title="Revisar — sobrescreve versao atual">
                    <span class="icon">✏️</span><span>Revisar</span>
                  </button>
                  <button class="crm-orcdocs-btn" data-action="nova-versao" data-lead-id="${l.id}" title="Cria Versao N+1 mantendo as anteriores">
                    <span class="icon">➕</span><span>Nova Versão</span>
                  </button>
                  <button class="crm-orcdocs-btn is-primary" data-action="gerar-documentos" data-lead-id="${l.id}" title="Gera PDF Proposta + 4 PNGs">
                    <span class="icon">📄</span><span>Gerar Documentos</span>
                  </button>
                  <div class="crm-orcdocs-btn-secundarios">
                    <button class="crm-card-btn-wpp" data-action="whatsapp" data-lead-id="${l.id}" title="Enviar via WhatsApp" style="background:rgba(37,211,102,0.45);color:#1a5276;border:none;padding:6px 8px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;">💬 WhatsApp</button>
                    ${l.numeroReserva ? `<button class="crm-card-btn-email" data-action="enviar-proposta" data-lead-id="${l.id}" title="Responder email da reserva" style="background:rgba(0,120,212,0.4);color:#1a5276;border:none;padding:6px 8px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;">📧 Email</button>` : ''}
                  </div>
                `}
                ${!temVersaoFechada ? `
                  <button class="crm-card-btn-wpp" data-action="whatsapp" data-lead-id="${l.id}" title="Enviar via WhatsApp" style="background:rgba(37,211,102,0.45);color:#1a5276;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;">💬 WhatsApp</button>
                  ${l.numeroReserva ? `<button class="crm-card-btn-email" data-action="enviar-proposta" data-lead-id="${l.id}" title="Responder email da reserva com proposta" style="background:rgba(0,120,212,0.4);color:#1a5276;border:none;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;font-weight:600;">📧 Enviar Proposta</button>` : ''}
                ` : ''}
              </div>
            ` : ''}
          </div>
          `;
        }).join('');
        return `
          <div class="crm-column" data-etapa="${et.id}">
            <div class="crm-column-header">
              ${totalCol !== null
                ? `<div class="crm-column-total">R$ ${fmtBR(totalCol)}</div>`
                : `<div class="crm-column-total crm-column-total-empty">—</div>`}
              <div class="crm-column-title-row">
                <div class="crm-column-title">
                  <span class="crm-column-dot" style="background:${et.color};"></span>
                  ${et.label}
                </div>
                <span class="crm-column-count">${leadsCol.length}</span>
              </div>
            </div>
            <div class="crm-column-body" data-etapa="${et.id}">${cards}</div>
          </div>
        `;
      }).join('');
      return `<div class="crm-kanban">${cols}</div>`;
    }

    function renderLista() {
      if (state.leads.length === 0) {
        return `<div class="crm-lista" style="padding:24px;text-align:center;color:var(--text-muted);">Nenhum lead cadastrado.</div>`;
      }
      const rows = state.leads.slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).map(l => {
        const et = etapaPorId(l.etapa);
        return `
          <tr data-id="${l.id}">
            <td>${escapeHtml(l.cliente || '(sem nome)')}</td>
            <td>${escapeHtml(l.telefone || '—')}</td>
            <td style="text-align:right;font-variant-numeric:tabular-nums;">R$ ${fmtBR(l.valor)}</td>
            <td>
              <span class="crm-etapa-pill">
                <span class="crm-column-dot" style="background:${et.color};"></span>
                ${et.label}
              </span>
            </td>
            <td>${fmtData(l.data)}</td>
          </tr>
        `;
      }).join('');
      return `
        <div class="crm-lista">
          <table>
            <thead>
              <tr>
                <th style="min-width:220px;">Cliente</th>
                <th style="min-width:140px;">Telefone</th>
                <th style="min-width:120px;text-align:right;">Valor</th>
                <th style="min-width:160px;">Etapa</th>
                <th style="min-width:100px;">Data</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    /**
     * Felipe: ao arrastar pra "Fechado", pede data manual.
     * Modal compacto, default = hoje (ou fechadoEm anterior).
     * `onConfirm(data)` recebe ISO yyyy-mm-dd, ou null se cancelou.
     */
    // Felipe (sessao 32): ao arrastar pra "Fazer Orcamento" sem AGP,
    // pergunta: gerar automatico ou informar existente?
    function abrirModalAGP(container, lead, onConfirm) {
      var mount = container.querySelector('#crm-modal-mount');
      if (!mount) return;
      var sugestao = proximoAGP();
      mount.innerHTML = [
        '<div class="crm-modal-overlay" id="crm-agp-overlay">',
        '  <div class="crm-modal crm-modal-compact" role="dialog" aria-modal="true">',
        '    <div class="crm-modal-head">',
        '      <span class="crm-modal-titulo">Numero AGP</span>',
        '      <button class="crm-modal-close" id="crm-agp-cancel" aria-label="Fechar">&times;</button>',
        '    </div>',
        '    <div class="crm-modal-body" style="padding:20px 24px;">',
        '      <p style="font-size:13px;color:var(--text-soft);margin:0 0 14px 0;">',
        '        Este lead ainda nao tem AGP. Deseja gerar automaticamente ou informar um existente?',
        '      </p>',
        '      <div style="display:flex;gap:8px;margin-bottom:14px;">',
        '        <button class="crm-btn-new" id="crm-agp-auto" style="flex:1;">Gerar Automatico<br><small style="opacity:.7;">' + escapeHtml(sugestao) + '</small></button>',
        '        <button class="btn btn-ghost btn-sm" id="crm-agp-manual-btn" style="flex:1;padding:10px;">Informar Existente</button>',
        '      </div>',
        '      <div id="crm-agp-manual-area" style="display:none;">',
        '        <label style="display:block;font-size:11px;color:var(--text-muted);letter-spacing:0.04em;margin-bottom:6px;">Numero AGP existente</label>',
        '        <input type="text" id="crm-agp-input" placeholder="AGP004..." style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:13px;font-family:var(--font-body);" />',
        '        <button class="crm-btn-new" id="crm-agp-ok" style="margin-top:10px;width:100%;">Confirmar</button>',
        '      </div>',
        '    </div>',
        '    <div class="crm-modal-actions" style="display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid var(--line);">',
        '      <button class="btn btn-ghost btn-sm" id="crm-agp-cancel-2">Cancelar</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('\n');

      var fechar = function() { mount.innerHTML = ''; };

      mount.querySelector('#crm-agp-cancel').addEventListener('click', fechar);
      mount.querySelector('#crm-agp-cancel-2').addEventListener('click', fechar);

      // Gerar automatico
      mount.querySelector('#crm-agp-auto').addEventListener('click', function() {
        lead.numeroAGP = sugestao;
        fechar();
        if (typeof onConfirm === 'function') onConfirm();
      });

      // Mostrar campo manual
      mount.querySelector('#crm-agp-manual-btn').addEventListener('click', function() {
        mount.querySelector('#crm-agp-manual-area').style.display = 'block';
        setTimeout(function() { mount.querySelector('#crm-agp-input').focus(); }, 50);
      });

      // Confirmar manual
      mount.querySelector('#crm-agp-ok').addEventListener('click', function() {
        var val = (mount.querySelector('#crm-agp-input').value || '').trim();
        if (!val) { alert('Informe o numero AGP.'); return; }
        lead.numeroAGP = val;
        fechar();
        if (typeof onConfirm === 'function') onConfirm();
      });
    }

    function abrirModalDataFechamento(container, dataDefault, onConfirm) {
      const mount = container.querySelector('#crm-modal-mount');
      if (!mount) return;
      mount.innerHTML = `
        <div class="crm-modal-overlay" id="crm-fech-overlay">
          <div class="crm-modal crm-modal-compact" role="dialog" aria-modal="true">
            <div class="crm-modal-head">
              <span class="crm-modal-titulo">Data de Fechamento</span>
              <button class="crm-modal-close" id="crm-fech-cancel" aria-label="Fechar">×</button>
            </div>
            <div class="crm-modal-body" style="padding:20px 24px;">
              <p style="font-size:13px;color:var(--text-soft);margin:0 0 14px 0;">
                Informe a data em que este lead foi fechado.
              </p>
              <label style="display:block;font-size:11px;color:var(--text-muted);letter-spacing:0.04em;margin-bottom:6px;">Data</label>
              <input type="date" id="crm-fech-input" value="${escapeHtml(dataDefault)}" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:13px;font-family:var(--font-body);" />
            </div>
            <div class="crm-modal-actions" style="display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid var(--line);">
              <button class="btn btn-ghost btn-sm" id="crm-fech-cancel-2">Cancelar</button>
              <button class="crm-btn-new" id="crm-fech-ok">Confirmar</button>
            </div>
          </div>
        </div>
      `;
      const fechar = (data) => {
        mount.innerHTML = '';
        if (typeof onConfirm === 'function') onConfirm(data);
      };
      mount.querySelector('#crm-fech-cancel')?.addEventListener('click', () => fechar(null));
      mount.querySelector('#crm-fech-cancel-2')?.addEventListener('click', () => fechar(null));
      // Felipe: NAO fecha mais por click no overlay (so X / Cancelar / Confirmar).
      mount.querySelector('#crm-fech-ok')?.addEventListener('click', () => {
        const inp = mount.querySelector('#crm-fech-input');
        const data = inp ? inp.value : '';
        if (!data) {
          alert('Informe uma data valida.');
          return;
        }
        fechar(data);
      });
      // Foca o input
      setTimeout(() => { mount.querySelector('#crm-fech-input')?.focus(); }, 50);
    }

    function render(container) {
      load();
      // Filtros aplicados ao pipeline para os contadores e o kanban
      const leadsFiltrados = aplicarFiltros(state.leads);
      const total = leadsFiltrados.length;
      const totalValor = leadsFiltrados.reduce((acc, l) => acc + (Number(l.valor) || 0), 0);

      // KPIs (Fechado Ano e Fechado Mes) — calculados sobre leadsFiltrados
      const kpiAno = somarFechadosNoPeriodo(leadsFiltrados, state.kpiAno, null);
      const kpiMes = somarFechadosNoPeriodo(leadsFiltrados, state.kpiMesAno, state.kpiMes);

      // Felipe: KPI "Em Aberto" — soma valor de leads em qualquer etapa
      // EXCETO fechado e perdido. Usa ano civil (data do lead = l.data).
      // Ano default = ano atual (compartilha estado com 'kpiAno' do filtro).
      const ANO_EM_ABERTO = state.kpiAno;
      const leadsEmAberto = leadsFiltrados.filter(l => {
        if (l.etapa === 'fechado' || l.etapa === 'perdido') return false;
        if (!l.data) return false;
        const ano = parseInt(String(l.data).slice(0, 4), 10);
        return ano === ANO_EM_ABERTO;
      });
      const kpiEmAberto = {
        total: leadsEmAberto.reduce((s, l) => s + (Number(l.valor) || 0), 0),
        count: leadsEmAberto.length,
      };

      const anos = anosFiltroKPI();
      const opcs = opcoesFiltros();
      const f = state.filtros;
      const algumFiltroAtivo = !!(f.busca || f.cidade || f.estado || f.representante || f.gerente || f.coordenador || f.supervisor || f.destino);
      const MESES = [
        'Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
      ];

      // Felipe (req KPIs reordenaveis): cada KPI eh montado individualmente
      // e a ordem e' persistida via Storage.scope('app'):'crm_kpis_order'.
      // Ids: 'ano' / 'mes' / 'em-aberto'. Ordem default: ano, mes, em-aberto.
      const KPI_BLOCKS = {
        'ano': `
          <div class="crm-kpi" data-kpi-id="ano" draggable="true">
            <div class="crm-kpi-lbl">Fechado no Ano</div>
            <div class="crm-kpi-val">R$ ${fmtBR(kpiAno.total)}</div>
            <div class="crm-kpi-sub">
              <select class="crm-kpi-select" data-kpi="ano">
                ${anos.map(a => `<option value="${a}" ${a === state.kpiAno ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
              <span class="crm-kpi-count">${kpiAno.count} ${kpiAno.count === 1 ? 'lead' : 'leads'}</span>
            </div>
          </div>`,
        'mes': `
          <div class="crm-kpi" data-kpi-id="mes" draggable="true">
            <div class="crm-kpi-lbl">Fechado no Mes <span class="crm-kpi-help" title="Mes fiscal: dia 16 do mes anterior ate dia 15 do mes corrente">?</span></div>
            <div class="crm-kpi-val">R$ ${fmtBR(kpiMes.total)}</div>
            <div class="crm-kpi-sub">
              <select class="crm-kpi-select" data-kpi="mes-ano">
                ${anos.map(a => `<option value="${a}" ${a === state.kpiMesAno ? 'selected' : ''}>${a}</option>`).join('')}
              </select>
              <select class="crm-kpi-select" data-kpi="mes">
                ${MESES.map((nome, i) => `<option value="${i+1}" ${(i+1) === state.kpiMes ? 'selected' : ''}>${nome}</option>`).join('')}
              </select>
              <span class="crm-kpi-count">${kpiMes.count} ${kpiMes.count === 1 ? 'lead' : 'leads'}</span>
            </div>
          </div>`,
        'em-aberto': `
          <div class="crm-kpi crm-kpi-em-aberto" data-kpi-id="em-aberto" draggable="true">
            <div class="crm-kpi-lbl">Em Aberto <span class="crm-kpi-help" title="Soma de todos os leads em negociacao no ano civil escolhido (exclui fechados e perdidos)">?</span></div>
            <div class="crm-kpi-val">R$ ${fmtBR(kpiEmAberto.total)}</div>
            <div class="crm-kpi-sub">
              <span class="crm-kpi-fixo">${state.kpiAno}</span>
              <span class="crm-kpi-count">${kpiEmAberto.count} ${kpiEmAberto.count === 1 ? 'lead' : 'leads'}</span>
            </div>
          </div>`,
      };
      const KPI_DEFAULT_ORDER = ['ano', 'mes', 'em-aberto'];
      const _appStore = Storage.scope('app');
      const ordemSalva = _appStore.get('crm_kpis_order');
      let ordemKpis = Array.isArray(ordemSalva) && ordemSalva.length === 3
        ? ordemSalva.filter(id => KPI_BLOCKS[id])
        : KPI_DEFAULT_ORDER.slice();
      // Garante que todos os KPIs aparecem (caso storage tenha lista incompleta)
      KPI_DEFAULT_ORDER.forEach(id => { if (!ordemKpis.includes(id)) ordemKpis.push(id); });
      const kpisHtml = ordemKpis.map(id => KPI_BLOCKS[id]).join('');

      container.innerHTML = `
        <!-- Linha superior: KPIs (reordenaveis) + Toggle vista + Acoes -->
        <div class="crm-header-row">
          <div class="crm-kpis">
            ${kpisHtml}
          </div>
          <div class="crm-header-actions">
            <div class="crm-view-toggle">
              <button data-view="kanban" class="${state.view === 'kanban' ? 'is-active' : ''}">Kanban</button>
              <button data-view="lista"  class="${state.view === 'lista'  ? 'is-active' : ''}">Lista</button>
            </div>
            <button class="btn btn-ghost btn-sm" id="crm-btn-import">⤓ Importar planilha</button>
            <button class="btn btn-ghost btn-sm" id="crm-btn-export">⬇ Exportar Excel</button>
            <button class="btn btn-ghost btn-sm" id="crm-btn-modelo" title="Baixa modelo Excel em branco com todos os campos para preencher e reimportar">📋 Modelo Excel</button>
            <input type="file" id="crm-import-file" accept=".xlsx,.xls,.csv" style="display:none" />
            <button class="crm-btn-new" id="crm-btn-new-lead">+ Novo Lead</button>
          </div>
        </div>

        <!-- Linha de filtros do pipeline -->
        <div class="crm-filtros-wrap">
          <div class="crm-filtros-titulo t-label">🔍 Filtros</div>
          <div class="crm-filtros">
            <input type="text" class="crm-filtro-busca" id="crm-f-busca" placeholder="Buscar por cliente, AGP ou reserva..." value="${escapeHtml(f.busca)}" />
            <select class="crm-filtro-sel" id="crm-f-cidade">
              <option value="">— cidade —</option>
              ${opcs.cidades.map(v => `<option value="${escapeHtml(v)}" ${v === f.cidade ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
            </select>
            <select class="crm-filtro-sel" id="crm-f-estado">
              <option value="">— estado —</option>
              ${opcs.estados.map(v => `<option value="${escapeHtml(v)}" ${v === f.estado ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
            </select>
            <select class="crm-filtro-sel" id="crm-f-representante">
              <option value="">— representante —</option>
              ${opcs.representantes.map(v => `<option value="${escapeHtml(v)}" ${v === f.representante ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
            </select>
            <select class="crm-filtro-sel" id="crm-f-gerente">
              <option value="">— gerente —</option>
              ${opcs.gerentes.map(v => `<option value="${escapeHtml(v)}" ${v === f.gerente ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
            </select>
            <select class="crm-filtro-sel" id="crm-f-coordenador">
              <option value="">— coordenador —</option>
              ${opcs.coordenadores.map(v => `<option value="${escapeHtml(v)}" ${v === f.coordenador ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
            </select>
            <select class="crm-filtro-sel" id="crm-f-supervisor">
              <option value="">— supervisor —</option>
              ${opcs.supervisores.map(v => `<option value="${escapeHtml(v)}" ${v === f.supervisor ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
            </select>
            <select class="crm-filtro-sel" id="crm-f-destino">
              <option value="">— destino —</option>
              <option value="nacional" ${f.destino === 'nacional' ? 'selected' : ''}>Nacional</option>
              <option value="internacional" ${f.destino === 'internacional' ? 'selected' : ''}>Internacional</option>
            </select>
            ${algumFiltroAtivo ? '<button class="crm-filtro-limpar" id="crm-f-limpar" title="Limpar todos os filtros">🗑 Limpar</button>' : ''}
            <span class="crm-filtro-resumo"><b>${total}</b> ${total === 1 ? 'lead' : 'leads'} · <b>R$ ${fmtBR(totalValor)}</b></span>
          </div>
        </div>

        <div id="crm-content">
          ${state.view === 'kanban' ? renderKanban() : renderLista()}
        </div>
        <div id="crm-modal-mount"></div>
      `;
      bindEvents(container);
    }

    function bindEvents(container) {
      // Toggle Kanban / Lista
      container.querySelectorAll('.crm-view-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
          state.view = btn.dataset.view;
          save();
          render(container);
        });
      });

      // Botao + Novo Lead
      container.querySelector('#crm-btn-new-lead')?.addEventListener('click', () => {
        abrirModal(container);
      });

      // KPI: dropdown de ano (Fechado no Ano)
      container.querySelector('.crm-kpi-select[data-kpi="ano"]')?.addEventListener('change', (e) => {
        state.kpiAno = parseInt(e.target.value, 10) || (new Date()).getFullYear();
        render(container);
      });
      // KPI: dropdown ano e mes (Fechado no Mes)
      container.querySelector('.crm-kpi-select[data-kpi="mes-ano"]')?.addEventListener('change', (e) => {
        state.kpiMesAno = parseInt(e.target.value, 10) || (new Date()).getFullYear();
        render(container);
      });
      container.querySelector('.crm-kpi-select[data-kpi="mes"]')?.addEventListener('change', (e) => {
        state.kpiMes = parseInt(e.target.value, 10) || (new Date()).getMonth() + 1;
        render(container);
      });

      // Felipe (req KPIs reordenaveis): drag-and-drop entre KPIs.
      // Persiste em Storage.scope('app'):'crm_kpis_order'.
      const kpisCont = container.querySelector('.crm-kpis');
      if (kpisCont) {
        kpisCont.querySelectorAll('.crm-kpi[data-kpi-id]').forEach(el => {
          el.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', el.dataset.kpiId);
            el.classList.add('is-dragging');
          });
          el.addEventListener('dragend', () => {
            el.classList.remove('is-dragging');
            kpisCont.querySelectorAll('.is-drop-target').forEach(x => x.classList.remove('is-drop-target'));
          });
          el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            el.classList.add('is-drop-target');
          });
          el.addEventListener('dragleave', () => {
            el.classList.remove('is-drop-target');
          });
          el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('is-drop-target');
            const draggedId = e.dataTransfer.getData('text/plain');
            const targetId = el.dataset.kpiId;
            if (!draggedId || draggedId === targetId) return;
            const ids = Array.from(kpisCont.querySelectorAll('.crm-kpi[data-kpi-id]')).map(x => x.dataset.kpiId);
            const fromIdx = ids.indexOf(draggedId);
            const toIdx   = ids.indexOf(targetId);
            if (fromIdx < 0 || toIdx < 0) return;
            ids.splice(fromIdx, 1);
            ids.splice(toIdx, 0, draggedId);
            Storage.scope('app').set('crm_kpis_order', ids);
            render(container);
          });
        });
        // Click no dropdown nao deve iniciar drag
        kpisCont.querySelectorAll('.crm-kpi-select').forEach(s => {
          s.addEventListener('mousedown', (e) => e.stopPropagation());
        });
      }

      // FILTROS — busca livre + 6 selects + limpar
      const filtroBusca = container.querySelector('#crm-f-busca');
      if (filtroBusca) {
        // Debounce simples pra busca: aplica no `input`, mas s/ render a cada tecla
        let t = null;
        filtroBusca.addEventListener('input', (e) => {
          state.filtros.busca = e.target.value;
          if (t) clearTimeout(t);
          t = setTimeout(() => render(container), 200);
        });
      }
      const bindSelectFiltro = (selId, campo) => {
        container.querySelector(selId)?.addEventListener('change', (e) => {
          state.filtros[campo] = e.target.value;
          render(container);
        });
      };
      bindSelectFiltro('#crm-f-cidade',        'cidade');
      bindSelectFiltro('#crm-f-estado',        'estado');
      bindSelectFiltro('#crm-f-representante', 'representante');
      bindSelectFiltro('#crm-f-gerente',       'gerente');
      bindSelectFiltro('#crm-f-coordenador',   'coordenador');
      bindSelectFiltro('#crm-f-supervisor',    'supervisor');
      bindSelectFiltro('#crm-f-destino',       'destino');
      container.querySelector('#crm-f-limpar')?.addEventListener('click', () => {
        state.filtros = { busca: '', cidade: '', estado: '', representante: '', gerente: '', coordenador: '', supervisor: '', destino: '' };
        render(container);
      });

      // R16: Importar/Exportar Excel
      container.querySelector('#crm-btn-export')?.addEventListener('click', exportarLeadsXLSX);
      container.querySelector('#crm-btn-modelo')?.addEventListener('click', exportarTemplateXLSX);
      const fileInputCrm = container.querySelector('#crm-import-file');
      container.querySelector('#crm-btn-import')?.addEventListener('click', () => fileInputCrm?.click());
      fileInputCrm?.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        importarLeadsXLSX(file, container);
        e.target.value = '';
      });

      // Click numa linha da Lista abre edicao
      if (state.view === 'lista') {
        container.querySelectorAll('.crm-lista tbody tr').forEach(tr => {
          tr.style.cursor = 'pointer';
          tr.addEventListener('click', () => {
            const id = tr.dataset.id;
            if (id) abrirModalEdicao(container, id);
          });
        });
        // R12: sort+filtro universal por coluna
        const tbl = container.querySelector('.crm-lista table');
        if (tbl && window.Universal) window.Universal.autoEnhance(tbl, { skipCols: ['actions'] });
      }

      // Drag-and-drop dos cards entre colunas
      let dragId = null;
      // Flag pra distinguir click de drag.
      // Marca true em dragstart, reseta em dragend (com delay pra que o
      // click pos-drag seja ignorado).
      let wasDragged = false;

      container.querySelectorAll('.crm-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          dragId = card.dataset.id;
          wasDragged = true;
          card.classList.add('is-dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragId);
          }
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('is-dragging');
          container.querySelectorAll('.crm-column.is-drop-target').forEach(c => c.classList.remove('is-drop-target'));
          // Delay pra que o click pos-drag seja descartado
          setTimeout(() => { wasDragged = false; }, 60);
        });
        // Click no card abre modal de edicao (se nao foi drag)
        card.addEventListener('click', (e) => {
          if (wasDragged) return;
          // Se clicou no input AGP, nao abre modal — deixa editar
          if (e.target.matches('[data-action="edit-agp"]')) {
            e.stopPropagation();
            return;
          }
          // Se clicou no dropdown de versoes, deixa o handler proprio rodar
          if (e.target.matches('[data-action="abrir-versao"]')) {
            e.stopPropagation();
            return;
          }
          // Se clicou no botao "Montar Orcamento", roteia em vez de abrir modal
          const btnOrc = e.target.closest('[data-action="montar-orcamento"]');
          if (btnOrc) {
            e.stopPropagation();
            const leadId = btnOrc.dataset.leadId;
            if (leadId && typeof App !== 'undefined' && App.navigateTo) {
              // Sinaliza pro modulo Orcamento qual lead esta ativo
              Storage.scope('app').set('orcamento_lead_ativo', leadId);
              // Felipe sessao 2026-08 REVISAO: "SEMPRE QUE APERTAR ESSE
              // BOTAO NO CARD MONTAR ORCAMENTO DEVE LEVAR DADOS DO CARD
              // PRA TELA INICIAL ORCAMENTO". Sinal explicito pra forcar
              // repopulacao em inicializarSessao (limpa flag de Zerar).
              Storage.scope('app').set('orcamento_repopular_do_lead', '1');
              App.navigateTo('orcamento', 'item');
            }
            return;
          }
          // Felipe (sessao 2026-11): novos botoes OrcDocs no card —
          // 📂 Abrir Orcamento | ✏️ Revisar | ➕ Nova Versao | 📄 Gerar Documentos
          const btnAbrirOrc = e.target.closest('[data-action="abrir-orcamento"]');
          if (btnAbrirOrc) {
            e.stopPropagation();
            const leadId = btnAbrirOrc.dataset.leadId;
            if (leadId && window.OrcDocs) window.OrcDocs.abrirVersoesModal(leadId);
            return;
          }
          const btnRevisar = e.target.closest('[data-action="revisar-versao"]');
          if (btnRevisar) {
            e.stopPropagation();
            const leadId = btnRevisar.dataset.leadId;
            if (leadId && window.OrcDocs) window.OrcDocs.revisarVersaoComConfirma(leadId);
            return;
          }
          const btnNovaV = e.target.closest('[data-action="nova-versao"]');
          if (btnNovaV) {
            e.stopPropagation();
            const leadId = btnNovaV.dataset.leadId;
            if (leadId && window.OrcDocs) window.OrcDocs.criarNovaVersao(leadId);
            return;
          }
          const btnGerarDoc = e.target.closest('[data-action="gerar-documentos"]');
          if (btnGerarDoc) {
            e.stopPropagation();
            const leadId = btnGerarDoc.dataset.leadId;
            if (leadId && window.OrcDocs) window.OrcDocs.gerarDocumentos(leadId);
            return;
          }
          // WhatsApp — abre link wa.me com mensagem template
          const btnWpp = e.target.closest('[data-action="whatsapp"]');
          if (btnWpp) {
            e.stopPropagation();
            const leadId = btnWpp.dataset.leadId;
            const lead = state.leads.find(l => l.id === leadId);
            if (!lead) return;
            // Busca contato do representante
            let repContato = '';
            let repNome = '';
            try {
              const cadStore = Storage.scope('cadastros');
              const reps = cadStore.get('representantes_lista') || [];
              const fup = lead.representante_followup || '';
              const rep = reps.find(r => r.followup === fup);
              if (rep && rep.contatos && rep.contatos.length) {
                const c = rep.contatos.find(ct => ct.nome === lead.representante_contato) || rep.contatos[0];
                repContato = (c.telefone || c.celular || '').replace(/\D/g,'');
                repNome = c.nome || fup;
              }
            } catch(_){}
            // Popup de escolha
            const existing = document.getElementById('wpp-choice-modal');
            if (existing) existing.remove();
            const modal = document.createElement('div');
            modal.id = 'wpp-choice-modal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';
            const clienteFone = lead.telefone ? lead.telefone.replace(/\D/g,'') : '';
            modal.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:400px;width:90%;text-align:center">'
              + '<div style="font-weight:700;font-size:16px;color:#1a5276;margin-bottom:16px">💬 Enviar WhatsApp para:</div>'
              + '<div style="display:flex;flex-direction:column;gap:10px">'
              + (clienteFone ? '<button id="wpp-cliente" style="padding:12px;background:#25d366;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">👤 Cliente: ' + (lead.cliente||'').substring(0,30) + '<br><span style="font-size:11px;font-weight:400">' + (lead.telefone||'') + '</span></button>' : '<div style="color:#888;font-size:13px">👤 Cliente sem telefone</div>')
              + (repContato ? '<button id="wpp-rep" style="padding:12px;background:#1a5276;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🏢 Representante: ' + repNome.substring(0,30) + '<br><span style="font-size:11px;font-weight:400">' + repContato + '</span></button>' : '<div style="color:#888;font-size:13px">🏢 Representante sem contato</div>')
              + '<button id="wpp-cancel" style="padding:8px;background:#f5f5f5;color:#666;border:1px solid #ddd;border-radius:8px;font-size:13px;cursor:pointer">Cancelar</button>'
              + '</div></div>';
            document.body.appendChild(modal);
            modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
            modal.querySelector('#wpp-cancel').addEventListener('click', () => modal.remove());
            // Valor
            let valor = 'a combinar';
            try {
              if (window.Orcamento && typeof window.Orcamento.resumoParaCardCRM === 'function') {
                const resumo = window.Orcamento.resumoParaCardCRM(leadId);
                if (resumo && resumo.pFatReal > 0) valor = 'R$ ' + fmtBR(resumo.pFatReal);
              }
            } catch(_){}
            // Felipe sessao 2026-08: usa templates editaveis do modulo Mensagens
            // em vez de mensagens chumbadas. Variaveis substituidas pelo
            // contexto do lead. Fallback chumbado se modulo nao carregado.
            const ctxMsg = {
              nome_cliente:       lead.cliente || '',
              nome_representante: repNome || '',
              nome_usuario:       (window.UsuarioAtivo?.nome || 'Equipe Projetta'),
              agp:                lead.numeroAGP || '',
              numero_reserva:     lead.numeroReserva || '',
              valor_orcamento:    valor,
              data_atual:         new Date().toLocaleDateString('pt-BR'),
            };
            let msgCliente = `Olá ${lead.cliente || ''},\n\nSegue nossa proposta comercial.\n\nValor: ${valor}\n\nAtt,\nEquipe Projetta by Weiku`;
            let msgRep     = `Olá ${repNome},\n\nSegue proposta do cliente ${lead.cliente || ''}.\n\nValor: ${valor}\n\nAtt,\nEquipe Projetta by Weiku`;
            try {
              if (window.Mensagens && typeof window.Mensagens.getTemplates === 'function') {
                const tpls = window.Mensagens.getTemplates();
                if (tpls.whatsapp_cliente?.body) {
                  msgCliente = window.Mensagens.aplicarVariaveis(tpls.whatsapp_cliente.body, ctxMsg);
                }
                if (tpls.whatsapp_rep?.body) {
                  msgRep = window.Mensagens.aplicarVariaveis(tpls.whatsapp_rep.body, ctxMsg);
                }
              }
            } catch(_){}
            if (clienteFone) {
              modal.querySelector('#wpp-cliente').addEventListener('click', () => {
                let f = clienteFone; if (f.length <= 11 && !f.startsWith('55')) f = '55' + f;
                window.open('https://wa.me/' + f + '?text=' + encodeURIComponent(msgCliente), 'projetta_whatsapp', 'width=900,height=700,scrollbars=yes,resizable=yes');
                modal.remove();
              });
            }
            if (repContato) {
              modal.querySelector('#wpp-rep').addEventListener('click', () => {
                let f = repContato; if (f.length <= 11 && !f.startsWith('55')) f = '55' + f;
                window.open('https://wa.me/' + f + '?text=' + encodeURIComponent(msgRep), 'projetta_whatsapp', 'width=900,height=700,scrollbars=yes,resizable=yes');
                modal.remove();
              });
            }
            return;
          }
          // Enviar Proposta por Email — busca email da reserva e responde a todos
          const btnEmail = e.target.closest('[data-action="enviar-proposta"]');
          if (btnEmail) {
            e.stopPropagation();
            const leadId = btnEmail.dataset.leadId;
            const lead = state.leads.find(l => l.id === leadId);
            if (!lead || !lead.numeroReserva) return;
            btnEmail.textContent = '⏳ Buscando...';
            (async function() {
              try {
                if (!window.outlookIsAuth || !window.outlookIsAuth()) {
                  alert('Conecte ao Outlook primeiro (aba Email)');
                  btnEmail.textContent = '📧 Enviar Proposta';
                  return;
                }
                // Busca email com a reserva no assunto
                const inbox = await window.outlookListInbox({ top: 20, search: 'subject:reserva ' + lead.numeroReserva });
                const emails = (inbox && inbox.emails) || [];
                if (!emails.length) {
                  alert('Email com reserva ' + lead.numeroReserva + ' nao encontrado no inbox');
                  btnEmail.textContent = '📧 Enviar Proposta';
                  return;
                }
                // Pega o primeiro email encontrado
                const emailOrigem = emails[0];
                btnEmail.textContent = '📧 Enviar Proposta';

                // Felipe sessao 2026-08: pergunta destino antes de abrir composer
                // Opcoes: Cliente do card (mailto:) ou Reserva (OutlookComposer reply-all)
                const remetenteReserva = (emailOrigem.from && emailOrigem.from.address) || '';
                const clienteEmail = (lead.email || '').trim();

                // Templates editaveis vindos do modulo Mensagens
                let subjectCliente = 'Proposta Comercial Projetta — AGP ' + (lead.numeroAGP || '');
                let bodyCliente    = `Prezado(a) ${lead.cliente || ''},\n\nSegue nossa proposta comercial.\n\nReserva: ${lead.numeroReserva}\n\nAtenciosamente,\nProjetta Portas Exclusivas`;
                let subjectRep     = 'Re: Reserva ' + lead.numeroReserva;
                let bodyRep        = '<p>Prezado(a),</p><p>Segue proposta comercial em anexo.</p>';

                // Valor pro contexto
                let valorTxt = 'a combinar';
                try {
                  if (window.Orcamento?.resumoParaCardCRM) {
                    const resumo = window.Orcamento.resumoParaCardCRM(leadId);
                    if (resumo && resumo.pFatReal > 0) valorTxt = 'R$ ' + fmtBR(resumo.pFatReal);
                  }
                } catch(_){}
                // Nome representante pro contexto
                let repNomeMail = '';
                try {
                  const cadStore2 = Storage.scope('cadastros');
                  const reps2 = cadStore2.get('representantes_lista') || [];
                  const fup2 = lead.representante_followup || '';
                  const rep2 = reps2.find(r => r.followup === fup2);
                  if (rep2) repNomeMail = rep2.followup || '';
                } catch(_){}

                const ctxMail = {
                  nome_cliente:       lead.cliente || '',
                  nome_representante: repNomeMail,
                  nome_usuario:       (window.UsuarioAtivo?.nome || 'Equipe Projetta'),
                  agp:                lead.numeroAGP || '',
                  numero_reserva:     lead.numeroReserva || '',
                  valor_orcamento:    valorTxt,
                  data_atual:         new Date().toLocaleDateString('pt-BR'),
                };
                try {
                  if (window.Mensagens?.getTemplates) {
                    const tpls = window.Mensagens.getTemplates();
                    if (tpls.email_cliente) {
                      subjectCliente = window.Mensagens.aplicarVariaveis(tpls.email_cliente.subject || '', ctxMail);
                      bodyCliente    = window.Mensagens.aplicarVariaveis(tpls.email_cliente.body || '', ctxMail);
                    }
                    if (tpls.email_rep) {
                      subjectRep = window.Mensagens.aplicarVariaveis(tpls.email_rep.subject || '', ctxMail);
                      // Email pra reserva mantém HTML (vai em reply-all)
                      const bodyRepText = window.Mensagens.aplicarVariaveis(tpls.email_rep.body || '', ctxMail);
                      bodyRep = '<p>' + bodyRepText.split('\n').join('<br>') + '</p>';
                    }
                  }
                } catch(_){}

                // Modal de escolha de destino
                const old = document.getElementById('email-choice-modal');
                if (old) old.remove();
                const modalE = document.createElement('div');
                modalE.id = 'email-choice-modal';
                modalE.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99999;display:flex;align-items:center;justify-content:center';
                modalE.innerHTML = '<div style="background:#fff;border-radius:12px;padding:24px;max-width:440px;width:90%;text-align:center">'
                  + '<div style="font-weight:700;font-size:16px;color:#1a5276;margin-bottom:16px">📧 Enviar email para:</div>'
                  + '<div style="display:flex;flex-direction:column;gap:10px">'
                  + (clienteEmail
                      ? '<button id="email-cliente" style="padding:12px;background:#0078d4;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;text-align:left">👤 Cliente do card<br><span style="font-size:11px;font-weight:400">' + (lead.cliente || '') + ' &lt;' + clienteEmail + '&gt;</span></button>'
                      : '<div style="padding:12px;background:#f5f5f5;color:#888;border-radius:8px;font-size:12px">👤 Cliente do card sem email cadastrado</div>')
                  + (remetenteReserva
                      ? '<button id="email-reserva" style="padding:12px;background:#1a5276;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;text-align:left">📨 Email da Reserva ' + lead.numeroReserva + '<br><span style="font-size:11px;font-weight:400">' + remetenteReserva + '</span></button>'
                      : '')
                  + '<button id="email-cancel" style="padding:8px;background:#f5f5f5;color:#666;border:1px solid #ddd;border-radius:8px;font-size:13px;cursor:pointer;margin-top:6px">Cancelar</button>'
                  + '</div></div>';
                document.body.appendChild(modalE);
                modalE.addEventListener('click', (ev) => { if (ev.target === modalE) modalE.remove(); });
                modalE.querySelector('#email-cancel').addEventListener('click', () => modalE.remove());

                // Cliente do card → mailto: (abre cliente nativo de email)
                if (clienteEmail) {
                  modalE.querySelector('#email-cliente').addEventListener('click', () => {
                    modalE.remove();
                    const link = 'mailto:' + encodeURIComponent(clienteEmail)
                               + '?subject=' + encodeURIComponent(subjectCliente)
                               + '&body=' + encodeURIComponent(bodyCliente);
                    window.location.href = link;
                  });
                }

                // Email da Reserva → OutlookComposer reply-all (atual)
                if (remetenteReserva) {
                  modalE.querySelector('#email-reserva').addEventListener('click', () => {
                    modalE.remove();
                    if (!window.OutlookComposer?.open) {
                      alert('Composer de email nao carregado. Recarregue a pagina.');
                      return;
                    }
                    window.OutlookComposer.open({
                      msgId: emailOrigem.id,
                      subject: subjectRep,
                      bodyHtml: bodyRep,
                      attachments: [],
                      onSent: function() {
                        btnEmail.textContent = '✅ Enviado!';
                        btnEmail.style.background = '#2e7d32';
                        if (window._outlookToggleFlag) {
                          window._outlookToggleFlag(emailOrigem.id, 'Orcamento Pronto', null);
                        }
                        setTimeout(() => { btnEmail.textContent = '📧 Enviar Proposta'; btnEmail.style.background = '#0078d4'; }, 3000);
                      },
                      onCancel: function() {
                        btnEmail.textContent = '📧 Enviar Proposta';
                      },
                    });
                  });
                }
              } catch(err) {
                console.error('[enviar-proposta]', err);
                alert('Erro ao enviar: ' + err.message);
                btnEmail.textContent = '📧 Enviar Proposta';
              }
            })();
            return;
          }
          const id = card.dataset.id;
          if (id) abrirModalEdicao(container, id);
        });

        // Input AGP no card — salva ao perder foco
        card.querySelectorAll('[data-action="edit-agp"]').forEach(inp => {
          inp.addEventListener('change', () => {
            const leadId = inp.dataset.leadId;
            const lead = state.leads.find(l => l.id === leadId);
            if (!lead) return;
            lead.numeroAGP = inp.value.trim();
            save();
          });
          // Impede que keystrokes no input acionem drag
          inp.addEventListener('mousedown', (e) => e.stopPropagation());
        });

        // Felipe: dropdown de versoes — ao escolher uma versao, abre o
        // orcamento ja' posicionado nela (Storage sinaliza pro modulo
        // Orcamento qual versao deve carregar).
        card.querySelectorAll('[data-action="abrir-versao"]').forEach(sel => {
          sel.addEventListener('mousedown', (e) => e.stopPropagation());
          sel.addEventListener('change', () => {
            const versaoId = sel.value;
            const leadId = sel.dataset.leadId;
            if (!versaoId || !leadId) return;
            Storage.scope('app').set('orcamento_lead_ativo', leadId);
            Storage.scope('app').set('orcamento_versao_ativa', versaoId);
            if (typeof App !== 'undefined' && App.navigateTo) {
              App.navigateTo('orcamento', 'item');
            }
          });
        });

        // Felipe (sessao 2026-06): "preciso de uma opcao para deletar
        // as versoes". Botao 🗑 aparece quando ha mais de 1 versao.
        card.querySelectorAll('[data-action="deletar-versao"]').forEach(btn => {
          btn.addEventListener('mousedown', (e) => e.stopPropagation());
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const leadId = btn.dataset.leadId;
            if (!leadId) return;
            const resumo = (window.Orcamento && window.Orcamento.resumoParaCardCRM)
              ? window.Orcamento.resumoParaCardCRM(leadId) : null;
            if (!resumo || !resumo.versoes || resumo.versoes.length < 2) {
              alert('Nada pra deletar — pelo menos 1 versao deve sobrar.');
              return;
            }
            // Lista versoes pra escolher
            const opcoes = resumo.versoes.map((v, i) => {
              const tag = v.status === 'fechada' ? '[FECHADA]' : '[draft]';
              const valor = v.valor > 0 ? ` R$ ${fmtBR(v.valor)}` : '';
              return `${i + 1} = ${tag} Opcao ${v.opcaoLetra} V${v.numero}${valor}`;
            }).join('\n');
            const escolha = prompt(
              `Qual versao deletar? (${resumo.versoes.length} versoes existem)\n\n` +
              opcoes + '\n\n' +
              'Digite o numero da versao (1-' + resumo.versoes.length + '):'
            );
            const idx = parseInt(escolha, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= resumo.versoes.length) return;
            const alvo = resumo.versoes[idx];
            const conf = confirm(
              `DELETAR Opcao ${alvo.opcaoLetra} V${alvo.numero}?\n\n` +
              'Essa acao e PERMANENTE — nao tem como desfazer.\n\n' +
              'Confirma?'
            );
            if (!conf) return;
            try {
              if (window.Orcamento && typeof window.Orcamento.deletarVersao === 'function') {
                window.Orcamento.deletarVersao(alvo.id);
                if (window.showSavedDialog) window.showSavedDialog('Versao deletada.');
                rerender();
              } else {
                alert('Funcao deletarVersao nao disponivel — recarregue a pagina (Ctrl+F5).');
              }
            } catch (e2) {
              alert('Falha ao deletar: ' + e2.message);
            }
          });
        });
      });

      container.querySelectorAll('.crm-column-body').forEach(body => {
        const col = body.closest('.crm-column');
        body.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          if (col) col.classList.add('is-drop-target');
        });
        body.addEventListener('dragleave', (e) => {
          // so remove o highlight se realmente saiu da coluna (nao se entrou em filho)
          if (col && !col.contains(e.relatedTarget)) col.classList.remove('is-drop-target');
        });
        body.addEventListener('drop', (e) => {
          e.preventDefault();
          const id = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || dragId;
          const novaEtapa = body.dataset.etapa;
          if (col) col.classList.remove('is-drop-target');
          if (!id || !novaEtapa) return;
          const lead = state.leads.find(l => l.id === id);
          if (!lead || lead.etapa === novaEtapa) return;

          // Felipe: ao mover pra coluna "Fazer Orcamento", se nao tem AGP,
          // pergunta se quer gerar automatico ou informar existente.
          if (novaEtapa === 'fazer-orcamento' && !lead.numeroAGP) {
            abrirModalAGP(container, lead, function() {
              lead.etapa = novaEtapa;
              save();
              render(container);
            });
            return;
          }

          // Felipe: ao mover pra coluna "Fechado", abre modal pedindo
          // a data manual de fechamento. Se cancelar, NAO move o card.
          if (novaEtapa === 'fechado') {
            const hoje = (new Date()).toISOString().slice(0, 10);
            const dataDefault = lead.fechadoEm || hoje;
            abrirModalDataFechamento(container, dataDefault, (dataConfirmada) => {
              if (!dataConfirmada) return;  // cancelou
              lead.etapa = 'fechado';
              lead.fechadoEm = dataConfirmada;
              save();
              render(container);
            });
            return;
          }

          // Saindo de "fechado" pra outra etapa: limpa fechadoEm pra
          // nao contar nos KPIs como fechado anterior.
          if (lead.etapa === 'fechado' && novaEtapa !== 'fechado') {
            lead.fechadoEm = null;
          }
          lead.etapa = novaEtapa;
          save();
          render(container);
        });
      });
    }

    /* ============================================================
       R16 — EXPORT/IMPORT XLSX (CRM Lista)
       ============================================================
       Exporta leads. Importacao:
       - Lead com id existente → atualiza
       - Sem id ou id novo → cria novo lead com id auto
       - Leads ausentes do arquivo → MANTEM (import nao remove)
       ============================================================ */
    function exportarLeadsXLSX() {
      // Felipe (sessao 2026-06): cabecalhos completos pedidos no chat —
      // "nome cliente, telefone, email, cep, cidade, estado, largura
      // altura da porta, modelo, cor interna, cor externa". Os campos
      // tecnicos da porta sao OPCIONAIS no lead (so pra pre-popular
      // o orcamento depois). ID, Valor, Etapa, Data, Followup ficam
      // pra preservar compat com export anterior.
      const headers = [
        'ID','Cliente','Telefone','Email',
        'CEP','Cidade','Estado',
        'Largura Porta (mm)','Altura Porta (mm)','Modelo','Cor Interna','Cor Externa',
        'Valor','Etapa','Data','Followup',
      ];
      const rows = state.leads.map(l => [
        l.id || '',
        l.cliente || '',
        l.telefone || '',
        l.email || '',
        l.cep || '',
        l.cidade || '',
        l.estado || '',
        l.largura_porta || '',
        l.altura_porta || '',
        l.modelo_porta || '',
        l.cor_interna || '',
        l.cor_externa || '',
        Number(l.valor) || 0,
        l.etapa || 'qualificacao',
        l.data || '',
        l.followup || '',
      ]);
      if (window.Universal && window.Universal.exportXLSX) {
        window.Universal.exportXLSX({
          headers, rows,
          sheetName: 'Leads',
          fileName: 'crm_leads_projetta',
        });
      }
    }

    /**
     * Felipe (sessao 2026-06): "modelo Excel" — planilha em branco com
     * APENAS os cabecalhos + 1 linha vazia de exemplo. O usuario baixa,
     * preenche varias linhas e reimporta. Pedido textual: "crm nao esta
     * exportando excel de modelo para em importar novamente".
     */
    function exportarTemplateXLSX() {
      const headers = [
        'ID','Cliente','Telefone','Email',
        'CEP','Cidade','Estado',
        'Largura Porta (mm)','Altura Porta (mm)','Modelo','Cor Interna','Cor Externa',
        'Valor','Etapa','Data','Followup',
      ];
      // 1 linha de exemplo pra Felipe ver como preencher
      const rows = [[
        '', 'Joao da Silva', '(34) 99999-9999', 'joao@email.com',
        '38400-000', 'Uberlandia', 'MG',
        '1300', '5000', 'Modelo 1', 'Wood Sucupira', 'Acabamento Externo',
        '0', 'qualificacao', '', '',
      ]];
      if (window.Universal && window.Universal.exportXLSX) {
        window.Universal.exportXLSX({
          headers, rows,
          sheetName: 'Modelo Leads',
          fileName: 'crm_modelo_template',
        });
      }
    }

    function importarLeadsXLSX(file, container) {
      if (!window.Universal || !window.Universal.readXLSXFile) return;
      window.Universal.readXLSXFile(file, (aoa, fileName) => {
        if (!aoa || aoa.length < 2) {
          alert('A planilha esta vazia ou sem linhas de dados.');
          return;
        }
        // Felipe (sessao 2026-06): le todos os campos do template, com
        // backwards-compat (planilhas antigas sem email/cidade/etc
        // continuam funcionando — campos faltantes ficam em branco).
        const idx = window.Universal.parseHeaders(aoa[0], {
          id:            'id',
          cliente:       'cliente',
          telefone:      'telefone',
          email:         'email',
          cep:           'cep',
          cidade:        'cidade',
          estado:        'estado',
          largura_porta: 'largura',
          altura_porta:  'altura',
          modelo_porta:  'modelo',
          cor_interna:   'cor interna',
          cor_externa:   'cor externa',
          valor:         'valor',
          etapa:         'etapa',
          data:          'data',
          followup:      'followup',
        });
        if (idx.cliente === -1) {
          alert('Planilha sem coluna "Cliente". Esse campo eh obrigatorio.');
          return;
        }
        let novos = 0, atualizados = 0;
        const get = (row, key) => idx[key] >= 0 ? String(row[idx[key]] || '').trim() : '';
        const getNum = (row, key) =>
          idx[key] >= 0 ? (Number(String(row[idx[key]] || '0').replace(',','.')) || 0) : 0;
        for (let i = 1; i < aoa.length; i++) {
          const row = aoa[i];
          const cliente = get(row, 'cliente');
          if (!cliente) continue;
          const id = get(row, 'id');
          const dados = {
            cliente,
            telefone:      get(row, 'telefone'),
            email:         get(row, 'email'),
            cep:           get(row, 'cep'),
            cidade:        get(row, 'cidade'),
            estado:        get(row, 'estado'),
            largura_porta: get(row, 'largura_porta'),
            altura_porta:  get(row, 'altura_porta'),
            modelo_porta:  get(row, 'modelo_porta'),
            cor_interna:   get(row, 'cor_interna'),
            cor_externa:   get(row, 'cor_externa'),
            valor:         getNum(row, 'valor'),
            etapa:         get(row, 'etapa') || 'qualificacao',
            data:          get(row, 'data'),
            followup:      get(row, 'followup'),
          };
          const existente = id ? state.leads.find(l => l.id === id) : null;
          if (existente) {
            Object.assign(existente, dados);
            atualizados++;
          } else {
            const novoId = id || ('lead_' + Math.random().toString(36).slice(2,8));
            state.leads.push({ id: novoId, ...dados });
            novos++;
          }
        }
        if (novos + atualizados === 0) {
          alert(`Nenhuma linha valida em "${fileName}".`);
          return;
        }
        const ok = confirm(`Importar de "${fileName}"?\n\n${novos} novo(s), ${atualizados} atualizado(s).\n\nLeads ja existentes que nao estao no arquivo serao MANTIDOS.`);
        if (!ok) {
          state.leads = store.get('leads') || state.leads;
          return;
        }
        save();
        render(container);
        if (window.showSavedDialog) {
          window.showSavedDialog(`Importacao OK!\n${novos} novo(s), ${atualizados} atualizado(s).`);
        }
      });
    }

    // Felipe sessao 2026-08: forceReload exposto pra uso externo (handler
    // crm:reload em App.register, robo de email, etc). Antes o handler
    // tentava chamar 'loaded' e 'load' diretamente fora do closure - dava
    // ReferenceError silencioso. Agora externos chamam Crm.forceReload().
    function forceReload(container) {
      loaded = false;
      load();
      if (container) {
        render(container);
      }
    }

    return { render, forceReload };
  })();

  // Felipe sessao 2026-08: expoe Crm em window pra uso externo
  // (45-email-import.js chama Crm.forceReload apos importar email).
  window.Crm = Crm;

  /* ============================================================
     Registra modulo CRM no App
     ============================================================ */
  App.register('crm', {
    render(container) {
      Crm.render(container);
      // Realtime: quando chegar mudanca do cloud, re-renderiza CRM
      if (!container._realtimeSubscribed) {
        container._realtimeSubscribed = true;
        Events.on('db:realtime-sync', function() {
          if (window.App && window.App.state && window.App.state.currentModule !== 'crm') return;
          Crm.render(container);
        });
        Events.on('crm:reload', function() {
          // Felipe sessao 2026-08: BUGFIX - handler tentava acessar
          // 'loaded' e 'load' fora do closure do Crm IIFE -> ReferenceError.
          // Agora usa funcao publica Crm.forceReload(container) que faz
          // loaded=false; load() e re-renderiza se container passado.
          var deveRenderizar = (window.App && window.App.state &&
                                window.App.state.currentModule === 'crm');
          Crm.forceReload(deveRenderizar ? container : null);
        });
      }
    }
  });
