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
    // Felipe sessao 34: endpoint NOVO de ATP/contrato liberado pelo Ruan
    // (TI Weiku) em 29/05/2026. Antes era URL especulativa
    // (intranet.weiku.com.br/v2/api/contratos/contrato/) que ainda nao
    // existia. Agora:
    //   URL: https://hub.weiku.com.br/api/pedido/{numero_pedido}
    //   Auth: Bearer <token>
    //   Felipe confirmou: 'numero do pedido' = numero ATP que vai no card
    //   apos fechamento do lead.
    // Ambiente novo das integracoes Weiku — Ruan avisou que pode ter
    // instabilidades iniciais. Reporte qualquer erro pra ele investigar.
    apiUrlContrato: 'https://hub.weiku.com.br/api/pedido/',
    apiTokenContrato: 'LPPC6kN2HiJ3K243oxg632GprNHbcRh8rc4pCk2oHzJnKpBDQK',
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
    // Felipe sessao 34: API nova /api/pedido/ pode retornar schema diferente
    // do esperado (Ruan ainda esta normalizando o ambiente). Funcao tolerante:
    // aceita BOTH (1) schema antigo snake_case (auftrag_nr, cliente_nome, ...)
    // e (2) variantes camelCase ou abreviadas que possam vir. Pega o primeiro
    // valor nao-vazio. Se um campo nao aparece no raw, fica string vazia
    // (nao trava o fluxo, nao sobrescreve campos do form com vazio - o
    // helper setField la no CRM ja' preserva edicao manual feita pelo user).
    function pick(...keys) {
      for (const k of keys) {
        if (raw[k] != null && raw[k] !== '') return raw[k];
      }
      return '';
    }
    // tipo_pessoa: 'J' (PJ) ou 'F' (PF). Se vier vazio, infere por presenca de CNPJ.
    const tipoPessoaRaw = String(pick('tipo_pessoa', 'tipoPessoa', 'tipo')).toUpperCase();
    const cnpj = pick('cliente_cnpj', 'clienteCnpj', 'cnpj');
    const cpf  = pick('cliente_cpf',  'clienteCpf',  'cpf');
    const ehPJ = tipoPessoaRaw === 'J' || (tipoPessoaRaw === '' && !!cnpj);
    const cpfCnpj = ehPJ ? cnpj : cpf;
    function montarEndereco(rua, num, compl, bairro, cidade, estado) {
      const partes = [];
      if (rua) partes.push(rua);
      if (num) partes.push(num);
      if (compl) partes.push(compl);
      if (bairro) partes.push(bairro);
      if (cidade || estado) partes.push([cidade, estado].filter(Boolean).join('/'));
      return partes.join(', ');
    }
    // Endereco cobranca: campos cliente_*
    const ec_rua    = pick('cliente_rua', 'clienteRua', 'cobranca_rua');
    const ec_num    = pick('cliente_ruanumero', 'cliente_numero', 'clienteNumero', 'cobranca_numero');
    const ec_compl  = pick('cliente_complemento', 'clienteComplemento', 'cobranca_complemento');
    const ec_bairro = pick('cliente_bairro', 'clienteBairro', 'cobranca_bairro');
    const ec_cidade = pick('cliente_cidade', 'clienteCidade', 'cobranca_cidade');
    const ec_estado = pick('cliente_estado', 'clienteEstado', 'cobranca_estado');
    // Endereco entrega: campos entrega_*
    const ee_rua    = pick('entrega_rua', 'entregaRua');
    const ee_num    = pick('entrega_numero', 'entregaNumero', 'entrega_ruanumero');
    const ee_compl  = pick('entrega_complemento', 'entregaComplemento');
    const ee_bairro = pick('entrega_bairro', 'entregaBairro');
    const ee_cidade = pick('entrega_cidade', 'entregaCidade');
    const ee_estado = pick('entrega_estado', 'entregaEstado');
    return {
      numeroAtp:        pick('auftrag_nr', 'auftragNr', 'numero_pedido', 'numeroPedido', 'numero_atp', 'numeroAtp', 'atp'),
      numeroReserva:    pick('num_reserva', 'numReserva', 'numero_reserva', 'numeroReserva', 'reserva'),
      numeroAgp:        pick('ang_numer', 'angNumer', 'numero_agp', 'numeroAgp', 'agp'),
      // Cliente / responsavel
      nomeContrato:     pick('cliente_nome', 'clienteNome', 'nome_cliente', 'nomeCliente'),
      responsavelLegal: pick('cliente_responsavel', 'clienteResponsavel', 'responsavel', 'responsavel_legal'),
      cpfCnpj:          cpfCnpj,
      rg:               pick('cliente_rg', 'clienteRg', 'rg'),
      emailContrato:    pick('cliente_mail', 'cliente_mailnfe', 'clienteMail', 'clienteEmail', 'email'),
      // Endereco cobranca
      cobranca: {
        cep:               String(pick('cliente_cep', 'clienteCep', 'cobranca_cep', 'cep_cobranca') || '').replace(/[^\d-]/g, ''),
        cidade:            ec_cidade,
        estado:            ec_estado,
        enderecoCompleto:  montarEndereco(ec_rua, ec_num, ec_compl, ec_bairro, ec_cidade, ec_estado),
      },
      // Endereco entrega (obra)
      entrega: {
        cep:               String(pick('entrega_cep', 'entregaCep', 'cep_entrega') || '').replace(/[^\d-]/g, ''),
        cidade:            ee_cidade,
        estado:            ee_estado,
        enderecoCompleto:  montarEndereco(ee_rua, ee_num, ee_compl, ee_bairro, ee_cidade, ee_estado),
        cei:               pick('entrega_cei', 'entregaCei', 'cei'),
        pontoReferencia:   pick('entrega_referencia', 'entregaReferencia', 'ponto_referencia', 'pontoReferencia', 'referencia'),
      },
      telefoneObra:     pick('cliente_celular', 'cliente_fone', 'clienteCelular', 'clienteFone', 'celular', 'telefone'),
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
    // Modo 'api' (default): chama endpoint hub.weiku.
    // Felipe sessao 34: tenta variantes do numero antes de desistir.
    // Felipe digita 'ATP000469' no card, mas a API pode querer formato
    // diferente (so digitos, com/sem zero a esquerda). Variantes:
    //   1. valor original ('ATP000469')
    //   2. so digitos com prefixo zerado ('000469')
    //   3. so digitos sem zero a esquerda ('469')
    //   4. so digitos brutos do input (caso digite 'ATP 469' por erro)
    // Para na primeira que retornar 200. Se TODAS falharem, agrega o erro.
    const digitos = num.replace(/\D/g, '');
    const variantes = [];
    variantes.push(num);                                       // ex: 'ATP000469'
    if (digitos && digitos !== num) variantes.push(digitos);   // ex: '000469'
    const semZero = digitos.replace(/^0+/, '');
    if (semZero && semZero !== digitos) variantes.push(semZero); // ex: '469'
    // Dedup
    const tentativas = Array.from(new Set(variantes)).filter(Boolean);
    const erros = [];
    for (const tentativa of tentativas) {
      try {
        const resultado = await _tentarBuscarContrato(tentativa);
        if (resultado) {
          if (tentativa !== num) {
            console.info('[WeikuClient.buscarContrato] sucesso com variante "' + tentativa + '" (input original: "' + num + '")');
          }
          return resultado;
        }
      } catch (e) {
        erros.push('"' + tentativa + '": ' + e.message);
        // Se for erro NAO-404 (autenticacao, rede, etc), nao adianta tentar
        // outras variantes — para imediatamente.
        if (!/404|nao encontrado/i.test(e.message)) {
          throw e;
        }
      }
    }
    // Todas as variantes deram 404
    throw new Error('Pedido nao encontrado na API Weiku. Tentei: ' + tentativas.join(', ') + '. Confirme o numero ATP ou peca ao Ruan (TI Weiku) pra verificar.');
  }

  // Helper interno — chamada unica pra uma variante de numero. Lanca erro
  // contextualizado pra _buscarContrato decidir se vale tentar proximas.
  async function _tentarBuscarContrato(num) {
    const url = config.apiUrlContrato + encodeURIComponent(num);
    try {
      const headers = {};
      if (config.apiTokenContrato) {
        headers['Authorization'] = 'Bearer ' + config.apiTokenContrato;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) {
        // Ler corpo do erro pra mensagem mais util
        let bodyTxt = '';
        try { bodyTxt = await res.text(); } catch (_) {}
        if (res.status === 401 || res.status === 403) {
          throw new Error('API ATP retornou ' + res.status + ' (autenticacao). Token invalido ou expirado — reporte ao Ruan (TI Weiku). Resposta: ' + bodyTxt.slice(0, 200));
        }
        if (res.status === 404) {
          throw new Error('Pedido ' + num + ' nao encontrado na API Weiku (' + res.status + ').');
        }
        throw new Error('API ATP HTTP ' + res.status + ': ' + bodyTxt.slice(0, 200));
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) {
        throw new Error('Pedido ' + num + ' nao encontrado na API Weiku');
      }
      const raw = Array.isArray(data) ? data[0] : data;
      try { console.info('[WeikuClient.buscarContrato] raw da API /api/pedido/' + num + ':', raw); } catch (_) {}
      if (!raw || typeof raw !== 'object') {
        throw new Error('Pedido ' + num + ' retornou resposta invalida (esperado objeto JSON, recebeu ' + typeof raw + ')');
      }
      // Aceita se tem ALGUM dado minimo pra preencher contrato (nome do
      // cliente em alguma variante OU numero ATP). Se vier 100% vazio,
      // avisa em vez de preencher form com nada.
      const temAlgumDado = ['cliente_nome', 'clienteNome', 'nome_cliente',
                            'auftrag_nr', 'auftragNr', 'numero_pedido']
        .some(k => raw[k] != null && raw[k] !== '');
      if (!temAlgumDado) {
        console.warn('[WeikuClient.buscarContrato] resposta nao parece ter os campos esperados. Raw:', raw);
        throw new Error('Pedido ' + num + ' retornou resposta sem campos reconhecidos. Veja o console (F12) e reporte ao Ruan (TI Weiku) com o JSON.');
      }
      return normalizarContrato(raw);
    } catch (e) {
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        throw new Error('Erro de rede ou CORS: API ATP em hub.weiku.com.br nao respondeu. Verifique se CORS esta liberado pra projetta-2026.netlify.app — reporte ao Ruan (TI Weiku).');
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
