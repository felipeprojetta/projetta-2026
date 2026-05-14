/* 40-weiku-client.js — cliente da intranet Weiku.
   Hoje em modo mock (dados fake hardcoded). Quando Weiku tiver API
   ou banco Supabase, basta trocar config.mode pra 'json' ou 'supabase'.
   Expoe window.WeikuClient (configure, getStatus, buscarReserva).

   ANTES: estava aninhado dentro do IIFE do CRM (10-crm.js).
   AGORA: arquivo proprio, carregado ANTES do CRM no index.html. */

/* ============================================================
   WeikuClient — camada de abstracao para integracao Weiku
   ============================================================
   3 modos selecionaveis (configurar em runtime):

     'mock'     -> dados fake hardcoded, pra testar fluxo (DEFAULT)
     'json'     -> JSON local (~3.400 reservas extraidas via scraper)
     'supabase' -> consulta tabela weiku_reservas no Supabase

   Pra trocar de modo, chamar:
     WeikuClient.configure({ mode: 'json', dataset: meuJSON })
     WeikuClient.configure({ mode: 'supabase', url: '...', key: '...' })

   A funcao buscarReserva(numero) sempre retorna o mesmo contrato:
     { nome_cliente, telefone, cep, representante }

   Isso significa que o modal nunca precisa saber qual o modo —
   soh chama WeikuClient.buscarReserva(num) e funciona.

   Schema esperado em modo 'json' e 'supabase':
     num_reserva (PK) | nome | telefone | cep | followup | ...
   ============================================================ */
const WeikuClient = (() => {
  const config = {
    mode: 'api',             // 'mock' | 'json' | 'supabase' | 'api'
    dataset: null,           // array de reservas (modo 'json')
    supabaseUrl: '',
    supabaseKey: '',
    // Felipe (sessao 31): API Weiku real
    // Homologacao: https://homologacao.weiku.com.br/v2/api/reservas/reserva/{numero}
    // Producao:    https://intranet.weiku.com.br/v2/api/reservas/reserva/{numero}
    // CORS liberado pra projetta-2026.netlify.app
    apiUrl: 'https://intranet.weiku.com.br/v2/api/reservas/reserva/',
    // Felipe sessao 18: endpoint pra puxar dados do CONTRATO pelo ATP.
    // URL provisoria sugerida pro John (TI Weiku). Quando ele responder
    // confirmando o endpoint real, basta atualizar essa string aqui.
    // Schema esperado da resposta JSON (definido por mim, pra confirmar
    // com o John): vide buscarContrato abaixo (Documentation block).
    apiUrlContrato: 'https://intranet.weiku.com.br/v2/api/contratos/contrato/',
  };

  function configure(opts) {
    Object.assign(config, opts || {});
    return getStatus();
  }

  function getStatus() {
    if (config.mode === 'mock')     return { mode: 'mock',     ready: true,  source: 'dados fake hardcoded' };
    if (config.mode === 'json')     return { mode: 'json',     ready: Array.isArray(config.dataset) && config.dataset.length > 0, source: `JSON local (${(config.dataset || []).length} reservas)` };
    if (config.mode === 'supabase') return { mode: 'supabase', ready: !!(config.supabaseUrl && config.supabaseKey), source: 'cache Supabase' };
    return { mode: '?', ready: false, source: 'desconhecido' };
  }

  // Normaliza qualquer formato de fonte para o contrato esperado
  // pelo modal: { nome_cliente, telefone, cep, representante }
  function normalizar(raw) {
    if (!raw) return null;
    // followup vem cru da intranet (ex: 'SP_BARUERI_PREVE', 'THAISAP')
    // IMPORTANTE: raw.followup eh o CODIGO, raw.representante eh o NOME.
    // Prioriza o codigo de followup pra resolver no cadastro.
    const followupCru = raw.followup || raw.representante_followup || raw.rep || '';
    // Tenta resolver no cadastro de Representantes pra trocar
    // o codigo cru pela razao social.
    let representanteFinal = followupCru;
    if (followupCru && typeof window !== 'undefined' && window.Representantes) {
      const resolvido = window.Representantes.buscarPorFollowup(followupCru);
      if (resolvido && resolvido.razao_social) {
        representanteFinal = resolvido.razao_social;
      } else if (raw.representante) {
        // Se nao achou no cadastro, usa o nome que veio da API
        representanteFinal = raw.representante;
      }
    } else if (raw.representante) {
      representanteFinal = raw.representante;
    }
    return {
      nome_cliente: raw.nome_cliente || raw.nome || raw.cliente || '',
      telefone:     raw.telefone || raw.fone || raw.celular || raw.whatsapp || '',
      cep:          raw.cep || raw.zip || '',
      email:        (raw.email || '').toLowerCase(),
      representante: representanteFinal,
      // Mantem o followup cru pro CRM poder linkar com o cadastro
      representante_followup: followupCru,
      // Extras da API Weiku (sessao 31)
      codigo_agp: raw.codigo_agp || raw.codigo || raw.agp || '',
      reserva:    raw.reserva || '',
      tipo:       raw.tipo || '',
      data_reserva: raw.data_reserva || raw.dataReserva || raw.dt_reserva || '',
    };
  }

  // Modo MOCK — dados fake pra testar fluxo
  async function buscarMock(numero) {
    await new Promise(r => setTimeout(r, 600));
    const mock = {
      'R-12345': { nome_cliente: 'Joao Pereira',     telefone: '(11) 98765-4321', cep: '01310-100', followup: 'ANDERSON_JARAGUA' },
      'R-12346': { nome_cliente: 'Patricia Mendes',  telefone: '(31) 99887-6543', cep: '30130-100', followup: 'SC_SOLARIS_DECOR' },
      'R-99999': { nome_cliente: 'Cliente Demo',     telefone: '(48) 91234-5678', cep: '88010-001', followup: 'RS_TUTIPROJETOS_REP' },
      // Numeros sem prefixo (formato real da intranet Weiku)
      '138718':  { nome_cliente: 'Joao Pereira',     telefone: '(11) 98765-4321', cep: '01310-100', followup: 'ANDERSON_JARAGUA' },
      '138719':  { nome_cliente: 'Patricia Mendes',  telefone: '(31) 99887-6543', cep: '30130-100', followup: 'SC_SOLARIS_DECOR' },
    };
    if (!mock[numero]) throw new Error('Reserva nao encontrada no mock');
    return normalizar(mock[numero]);
  }

  // Modo JSON — busca dentro do dataset embarcado
  async function buscarJsonLocal(numero) {
    if (!Array.isArray(config.dataset)) {
      throw new Error('Dataset JSON nao foi carregado. Chame WeikuClient.configure({mode:"json", dataset: [...]})');
    }
    // Procura por num_reserva (formato Weiku eh soh digitos: "138718")
    const num = String(numero).trim();
    const found = config.dataset.find(r =>
      String(r.num_reserva || r.numero || '').trim() === num
    );
    if (!found) throw new Error(`Reserva ${num} nao encontrada no JSON (${config.dataset.length} registros carregados)`);
    return normalizar(found);
  }

  // Modo SUPABASE — consulta a tabela weiku_reservas via REST
  async function buscarSupabase(numero) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Supabase nao configurado. Chame WeikuClient.configure({mode:"supabase", supabaseUrl:"...", supabaseKey:"..."})');
    }
    const url = `${config.supabaseUrl}/rest/v1/weiku_reservas?num_reserva=eq.${encodeURIComponent(numero)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        'apikey': config.supabaseKey,
        'Authorization': 'Bearer ' + config.supabaseKey,
      }
    });
    if (!res.ok) throw new Error('Falha ao consultar Supabase: ' + res.status);
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error('Reserva nao encontrada no Supabase');
    }
    return normalizar(arr[0]);
  }

  async function buscarReserva(numero) {
    if (config.mode === 'api')      return buscarApi(numero);
    if (config.mode === 'json')     return buscarJsonLocal(numero);
    if (config.mode === 'supabase') return buscarSupabase(numero);
    return buscarMock(numero);
  }

  // Modo API — chama endpoint da intranet Weiku diretamente
  // Felipe (sessao 31): CORS liberado pra projetta-2026.netlify.app
  // Resposta da API: { reserva, codigo, cliente, email, cep, representante, tipo }
  async function buscarApi(numero) {
    const num = String(numero).trim();
    if (!num) throw new Error('Numero da reserva vazio');
    const url = config.apiUrl + encodeURIComponent(num);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      // API retorna [] se nao encontrou, ou objeto com dados
      if (Array.isArray(data) && data.length === 0) {
        throw new Error('Reserva ' + num + ' nao encontrada na API Weiku');
      }
      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw || (!raw.cliente && !raw.nome)) {
        throw new Error('Reserva ' + num + ' retornou vazio');
      }
      // Normaliza pro contrato do WeikuClient
      return normalizar({
        nome_cliente: raw.cliente || raw.nome || '',
        telefone: raw.telefone || raw.fone || '',
        cep: raw.cep || '',
        email: (raw.email || '').toLowerCase(),
        representante: raw.representante || '',
        // FOLLOWUP: codigo cru da intranet (SP_BARUERI_PREVE, THAISAP, etc.)
        followup: raw.followup || '',
        // Extras da API que podem ser uteis
        codigo_agp: raw.codigo || raw.agp || raw.codigo_agp || '',
        reserva: raw.reserva || num,
        tipo: raw.tipo || '',
        data_reserva: raw.data_reserva || raw.dataReserva || raw.dt_reserva || raw.data || '',
      });
    } catch (e) {
      // Se CORS falhar (localhost), mostra mensagem clara
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        throw new Error('Erro CORS: API Weiku so aceita chamadas de projetta-2026.netlify.app. Se esta em localhost, use modo mock.');
      }
      throw e;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Felipe sessao 18: API CONTRATO (ATP)
  // ═══════════════════════════════════════════════════════════════════
  //
  // Mesma estrutura do buscarReserva, mas pra buscar dados do CONTRATO
  // a partir do numero ATP. Quando o John (TI Weiku) liberar o endpoint
  // (igual ja foi feito pra reserva), basta:
  //   1. Confirmar apiUrlContrato no config (linha ~42)
  //   2. Ajustar os nomes dos campos em buscarApiContrato conforme
  //      a resposta real da API
  //   3. Pronto - botao 'Importar do Intranet' no modal ATP funciona
  //
  // ESQUEMA esperado de resposta (parseado da tela do Weiku
  // editar-contrato.php?auftrag_nr={atp} - sessao 18 sondei via Chrome):
  //   {
  //     auftrag_nr: 'ATP000361',
  //     num_reserva: '127619',
  //     ang_numer: 'AGP003239',
  //     dat_orc: '15/07/2024',
  //     tipo_pessoa: 'J' | 'F',
  //     cliente_nome: 'LMN EMPREENDIMENTOS E PARTICIPACOES S.A.',
  //     cliente_sobrenome: 'LMN EMPREENDIMENTOS',
  //     cliente_cnpj: '03.334.792/0001-29',  // se PJ
  //     cliente_cpf: '086.448.996-00',       // CPF do responsavel
  //     cliente_inscricao_estadual: 'ISENTO',
  //     cliente_responsavel: 'CLAUDIA RONISE DA SILVA',
  //     cliente_rg: 'MG8.475.543',
  //     cliente_celular: '(31) 99604-6556',
  //     cliente_fone: '(31) 99604-6556',
  //     cliente_mail: 'CLAUDIA@LMNEMPREENDIMENTOS.COM.BR',
  //     cliente_mailnfe: 'CLAUDIA@LMNEMPREENDIMENTOS.COM.BR',
  //     // ENDERECO COBRANCA
  //     cliente_cep: '30350-563',
  //     cliente_estado: 'MG',
  //     cliente_cidade: 'Belo Horizonte',
  //     cliente_rua: 'AV RAJA GABAGLIA',
  //     cliente_bairro: 'SAO BENTO',
  //     cliente_ruanumero: '3095',
  //     cliente_complemento: '2 ANDAR',
  //     // ENDERECO ENTREGA
  //     entrega_cep: '34007-134',
  //     entrega_estado: 'MG',
  //     entrega_cidade: 'Nova Lima',
  //     entrega_rua: 'ALAMEDA MONTE CARLO',
  //     entrega_bairro: 'CONDOMINIO RIVIERA',
  //     entrega_numero: '229',
  //     entrega_complemento: 'CONDOMINIO RIVIERA',
  //     entrega_referencia: 'PROXIMO BH SHOPPING',
  //     // METADATA
  //     coord_pcp: '...',
  //     gestor: '...',
  //     gerente: '...',
  //     representante: '...',
  //   }
  //
  // Resposta normalizada (formato que o modal ATP consome):
  //   {
  //     numeroAtp, dataAssinatura, prazoEntrega,
  //     nomeContrato, responsavelLegal, cpfCnpj, rg, emailContrato,
  //     cobranca: { cep, cidade, estado, enderecoCompleto },
  //     entrega:  { cep, cidade, estado, enderecoCompleto },
  //     pessoaAutorizadaReceber, telefoneObra, pontoReferencia,
  //     numeroReserva, numeroAgp,
  //   }
  // ═══════════════════════════════════════════════════════════════════

  function normalizarContrato(raw) {
    if (!raw) return null;
    const ehPJ = String(raw.tipo_pessoa || '').toUpperCase() === 'J';
    const cpfCnpj = ehPJ ? (raw.cliente_cnpj || '') : (raw.cliente_cpf || '');
    function montarEndereco(rua, num, compl, bairro, cidade, estado) {
      const partes = [];
      if (rua) partes.push(rua);
      if (num) partes.push(num);
      if (compl) partes.push(compl);
      if (bairro) partes.push(bairro);
      if (cidade || estado) partes.push([cidade, estado].filter(Boolean).join('/'));
      return partes.join(', ');
    }
    return {
      numeroAtp:        raw.auftrag_nr || '',
      numeroReserva:    raw.num_reserva || '',
      numeroAgp:        raw.ang_numer || '',
      // Cliente / responsavel
      nomeContrato:     raw.cliente_nome || '',
      responsavelLegal: raw.cliente_responsavel || '',
      cpfCnpj:          cpfCnpj,
      rg:               raw.cliente_rg || '',
      emailContrato:    raw.cliente_mail || raw.cliente_mailnfe || '',
      // Endereco cobranca
      cobranca: {
        cep:               (raw.cliente_cep || '').replace(/[^\d-]/g, ''),
        cidade:            raw.cliente_cidade || '',
        estado:            raw.cliente_estado || '',
        enderecoCompleto:  montarEndereco(
                             raw.cliente_rua, raw.cliente_ruanumero,
                             raw.cliente_complemento, raw.cliente_bairro,
                             raw.cliente_cidade, raw.cliente_estado),
      },
      // Endereco entrega (obra)
      entrega: {
        cep:               (raw.entrega_cep || '').replace(/[^\d-]/g, ''),
        cidade:            raw.entrega_cidade || '',
        estado:            raw.entrega_estado || '',
        enderecoCompleto:  montarEndereco(
                             raw.entrega_rua, raw.entrega_numero,
                             raw.entrega_complemento, raw.entrega_bairro,
                             raw.entrega_cidade, raw.entrega_estado),
        cei:               raw.entrega_cei || '',
        pontoReferencia:   raw.entrega_referencia || '',
      },
      telefoneObra:     raw.cliente_celular || raw.cliente_fone || '',
      // Metadata (provavel uso futuro)
      _raw: raw,
    };
  }

  async function buscarContrato(numeroAtp) {
    const num = String(numeroAtp || '').trim();
    if (!num) throw new Error('Numero ATP vazio');
    if (config.mode === 'mock') {
      // Mock simples — pra testes locais sem API
      return normalizarContrato({
        auftrag_nr: num,
        tipo_pessoa: 'J',
        cliente_nome: 'CLIENTE EXEMPLO LTDA (mock)',
        cliente_cnpj: '00.000.000/0001-00',
        cliente_responsavel: 'JOAO EXEMPLO',
        cliente_cpf: '000.000.000-00',
        cliente_mail: 'exemplo@cliente.com.br',
        cliente_cep: '00000-000',
        cliente_cidade: 'Sao Paulo', cliente_estado: 'SP',
        cliente_rua: 'Rua Exemplo', cliente_ruanumero: '100',
        cliente_bairro: 'Centro', cliente_complemento: '',
        entrega_cep: '00000-000', entrega_cidade: 'Sao Paulo', entrega_estado: 'SP',
        entrega_rua: 'Rua Entrega', entrega_numero: '200', entrega_bairro: 'Bairro Obra',
      });
    }
    // Modo 'api' (default): chama endpoint Weiku
    const url = config.apiUrlContrato + encodeURIComponent(num);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Contrato ' + num + ' nao encontrado na API Weiku');
        }
        throw new Error('HTTP ' + res.status);
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) {
        throw new Error('Contrato ' + num + ' nao encontrado na API Weiku');
      }
      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw || (!raw.cliente_nome && !raw.auftrag_nr)) {
        throw new Error('Contrato ' + num + ' retornou vazio');
      }
      return normalizarContrato(raw);
    } catch (e) {
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        throw new Error('Erro CORS: API Contrato ainda nao liberada. Aguarde o John (TI Weiku) habilitar projetta-2026.netlify.app pro endpoint /v2/api/contratos/contrato/{atp}.');
      }
      throw e;
    }
  }

  return { configure, getStatus, buscarReserva, buscarContrato };
})();

// Expoe globalmente
if (typeof window !== 'undefined') {
  window.WeikuClient = WeikuClient;
}
