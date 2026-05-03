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
      email:        raw.email || '',
      representante: representanteFinal,
      // Mantem o followup cru pro CRM poder linkar com o cadastro
      representante_followup: followupCru,
      // Extras da API Weiku (sessao 31)
      codigo_agp: raw.codigo_agp || raw.codigo || raw.agp || '',
      reserva:    raw.reserva || '',
      tipo:       raw.tipo || '',
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
        email: raw.email || '',
        representante: raw.representante || '',
        // FOLLOWUP: codigo cru da intranet (SP_BARUERI_PREVE, THAISAP, etc.)
        followup: raw.followup || '',
        // Extras da API que podem ser uteis
        codigo_agp: raw.codigo || raw.agp || '',
        reserva: raw.reserva || num,
        tipo: raw.tipo || '',
      });
    } catch (e) {
      // Se CORS falhar (localhost), mostra mensagem clara
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        throw new Error('Erro CORS: API Weiku so aceita chamadas de projetta-2026.netlify.app. Se esta em localhost, use modo mock.');
      }
      throw e;
    }
  }

  // Expoe globalmente pra ser configurado de fora (futuro)
  if (typeof window !== 'undefined') {
    window.WeikuClient = { configure, getStatus, buscarReserva };
  }

  return { configure, getStatus, buscarReserva };
})();
