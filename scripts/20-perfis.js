/* 20-perfis.js — Cadastros > Perfis.
   Tabela mestre de perfis de aluminio.
   Persistencia: Storage.scope('cadastros') chave 'perfis_lista'.
   Seed: 62 perfis extraidos do PDF de cadastro do CEM Pro. */

/* ============================================================
   SUB-MODULO: PERFIS
   ============================================================ */
const Perfis = (() => {
  const store = Storage.scope('cadastros');

  // Felipe (sessao 2026-05): listas migradas para Cadastros > Filtros.
  // Helpers leem de window.Filtros se disponivel; senao caem no
  // fallback hardcoded original (compatibilidade total).
  const _SEED_FORNECEDORES = ['Mercado', 'Tecnoperfil'];
  const _SEED_TRATAMENTOS  = ['Pintura', 'Natural'];
  function getFornecedores() {
    if (window.Filtros && typeof window.Filtros.listar === 'function') {
      return window.Filtros.listar('perfis_fornecedor', _SEED_FORNECEDORES);
    }
    return _SEED_FORNECEDORES.slice();
  }
  function getTratamentos() {
    if (window.Filtros && typeof window.Filtros.listar === 'function') {
      return window.Filtros.listar('perfis_tratamento', _SEED_TRATAMENTOS);
    }
    return _SEED_TRATAMENTOS.slice();
  }

  // Seed: 62 perfis extraidos do PDF de cadastro do CEM Pro
  const SEED_PERFIS_PDF = [
    {
            "id": "seed_1777474312348_000",
            "codigo": "CDA-L-009",
            "descricao": "CANTONEIRA DE ABAS IGUAIS 19,05 X 1,59 MM",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.15
    },
    {
            "id": "seed_1777474312348_001",
            "codigo": "PA-101X101X2.5",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 101.6 X 101.6 X 2.5 - TQ-034",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 2.69
    },
    {
            "id": "seed_1777474312348_002",
            "codigo": "PA-101X101X6.0",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 101.6 X 101.6 X 6.0 - TQ-076",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 6.56
    },
    {
            "id": "seed_1777474312348_003",
            "codigo": "PA-101X38X2.4",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 101.6 X 38.1 X 2.4 - TG-018",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.75
    },
    {
            "id": "seed_1777474312348_004",
            "codigo": "PA-101X51X2",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 101.6 X 50.8 X 2.0 - TG-072",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.61
    },
    {
            "id": "seed_1777474312348_005",
            "codigo": "PA-101X51X3.17",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 101.6 X 50.8 X 3.17 - TG-021",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 2.51
    },
    {
            "id": "seed_1777474312348_006",
            "codigo": "PA-12X12X1.58",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 12.7 X 12.7 X 1.58 - TQ-002",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.19
    },
    {
            "id": "seed_1777474312348_007",
            "codigo": "PA-152X38X3.2",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 152.4 X 38.1 X 3.2 - TG024",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 3.19
    },
    {
            "id": "seed_1777474312348_008",
            "codigo": "PA-15X15X1.58",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 15.87 X 15.87 X 1.58 - TQ-003",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.24
    },
    {
            "id": "seed_1777474312348_009",
            "codigo": "PA-19X19X1.6",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 19.05 X 19.05 X 1.6 - TQ-006",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.3
    },
    {
            "id": "seed_1777474312348_010",
            "codigo": "PA-25X12X1.58",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 25.4 X 12.7 X 1.58 - TG-001",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.3
    },
    {
            "id": "seed_1777474312348_011",
            "codigo": "PA-25X25X1.58",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 25.4 X 25.4 X 1.58 - TQ009",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.41
    },
    {
            "id": "seed_1777474312348_012",
            "codigo": "PA-31X31X1.58",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 31.75 X 31.75 X 1.58 - TQ-012",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.52
    },
    {
            "id": "seed_1777474312348_013",
            "codigo": "PA-35X25-OLHAL",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 35.1 X 25.4 COM OLHAL - D055 (CG-012)",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.5
    },
    {
            "id": "seed_1777474312348_014",
            "codigo": "PA-35X35-OLHAL",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 35.1 X 35.1 X 1,5 OLHAL - D081",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.67
    },
    {
            "id": "seed_1777474312348_015",
            "codigo": "PA-38X38X1.58",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 38.1 X 38.1 X 1.58 - TQ-014",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.59
    },
    {
            "id": "seed_1777474312348_016",
            "codigo": "PA-51X12X1.2",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 50.8 X 12.7 X 1.2",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.4
    },
    {
            "id": "seed_1777474312348_017",
            "codigo": "PA-51X12X1.58",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 50.8 X 12.7 X 1.58 - TG-004",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.52
    },
    {
            "id": "seed_1777474312348_018",
            "codigo": "PA-51X25X1.5",
            "descricao": "FIL TUBULAR DE ALUMINIO 50.8 X 25.4 X 1.5 - TG005",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.59
    },
    {
            "id": "seed_1777474312348_019",
            "codigo": "PA-51X25X2.0",
            "descricao": "FIL TUBULAR DE ALUMINIO 50.8 X 25.4 X 2.0 - TG007",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.78
    },
    {
            "id": "seed_1777474312348_020",
            "codigo": "PA-51X38X1.98",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 50.8 X 38.1 X 1.98 - TG008",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.91
    },
    {
            "id": "seed_1777474312348_021",
            "codigo": "PA-51X51X1.98",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 50.8 X 50.8 X 1.98 - TG017",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.05
    },
    {
            "id": "seed_1777474312348_022",
            "codigo": "PA-76X25X2.0",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 76.2 X 25.4 X 2.0 - TG013",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.06
    },
    {
            "id": "seed_1777474312348_023",
            "codigo": "PA-76X38X1.98",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 76.2 X 38.1 X 1.98 - TG-014",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.18
    },
    {
            "id": "seed_1777474312348_024",
            "codigo": "PA-76X76X2.0",
            "descricao": "PERFIL TUBULAR DE ALUMINIO 76.2 X 76.2 X 2.0 - TQ-072",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.61
    },
    {
            "id": "seed_1777474312348_025",
            "codigo": "PA-CANT-12X12X1.59",
            "descricao": "PERFIL DE ALUMINIO CANT 12X12X1.59 - CT-001",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.1
    },
    {
            "id": "seed_1777474312348_026",
            "codigo": "PA-CANT-16X31X1.3",
            "descricao": "PERFIL DE ALUMINIO CANT 16 X 31 X 1.3 - CT209",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.17
    },
    {
            "id": "seed_1777474312348_027",
            "codigo": "PA-CANT-25X25X1.59",
            "descricao": "PERFIL DE ALUMINIO CANT 25 X 25 X 1.59 - CT-016",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.21
    },
    {
            "id": "seed_1777474312348_028",
            "codigo": "PA-CANT-30X30X2.0",
            "descricao": "PERFIL DE ALUMINIO CANT 30 X 30 X 2.0 - CT-082",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Pintura",
            "kg_m": 0.27
    },
    {
            "id": "seed_1777474312348_029",
            "codigo": "PA-CANT-32X32X3.18",
            "descricao": "PERFIL DE ALUMINIO CANT 31.75 X 31.75 X 3.18 L-018",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.52
    },
    {
            "id": "seed_1777474312348_030",
            "codigo": "PA-CHR908",
            "descricao": "CHR-908 ARREMATE INFERIOR CHROMA NATURAL",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.19
    },
    {
            "id": "seed_1777474312348_031",
            "codigo": "PA-CLICKPERFILBOISER",
            "descricao": "PERFIL CONECTOR CLICK 01 JAT ANOD AN 6MT PLIBL",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.0
    },
    {
            "id": "seed_1777474312348_032",
            "codigo": "PA-DS152",
            "descricao": "TRILHO SUPERIOR PORTA CORRER",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.77
    },
    {
            "id": "seed_1777474312348_033",
            "codigo": "PA-FV001",
            "descricao": "PERFIL DE ALUMINIO FV001 PINT. PRETO",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.46
    },
    {
            "id": "seed_1777474312348_034",
            "codigo": "PA-LG028",
            "descricao": "MATA JUNTA",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.46
    },
    {
            "id": "seed_1777474312348_035",
            "codigo": "PA-PA006F-6M",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8269/T5/6063/6000",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Pintura",
            "kg_m": 3.45
    },
    {
            "id": "seed_1777474312348_036",
            "codigo": "PA-PA006P-6M",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8270/T5/6063/6000",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Pintura",
            "kg_m": 1.7
    },
    {
            "id": "seed_1777474312348_037",
            "codigo": "PA-PA006V",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8271/T5/6063/6000",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Pintura",
            "kg_m": 1.55
    },
    {
            "id": "seed_1777474312348_038",
            "codigo": "PA-PA007F-6M",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8240/T5/6063/6000",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Pintura",
            "kg_m": 5.15
    },
    {
            "id": "seed_1777474312348_039",
            "codigo": "PA-PA007F-7M",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8240/T5/6063/7000",
            "fornecedor": "Tecnoperfil",
            "barra": 7,
            "tratamento": "Pintura",
            "kg_m": 5.15
    },
    {
            "id": "seed_1777474312348_040",
            "codigo": "PA-PA007F-8M",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8240/T5/6063/8000",
            "fornecedor": "Tecnoperfil",
            "barra": 8,
            "tratamento": "Pintura",
            "kg_m": 5.15
    },
    {
            "id": "seed_1777474312348_041",
            "codigo": "PA-PA007P-6M",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8267/T5/6063/6000",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Pintura",
            "kg_m": 2.78
    },
    {
            "id": "seed_1777474312348_042",
            "codigo": "PA-PA007P-7M",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8267/T5/6063/7000",
            "fornecedor": "Tecnoperfil",
            "barra": 7,
            "tratamento": "Pintura",
            "kg_m": 2.78
    },
    {
            "id": "seed_1777474312348_043",
            "codigo": "PA-PA007P-8M",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8267/T5/6063/8000",
            "fornecedor": "Tecnoperfil",
            "barra": 8,
            "tratamento": "Pintura",
            "kg_m": 2.78
    },
    {
            "id": "seed_1777474312348_044",
            "codigo": "PA-PA007V",
            "descricao": "PERFIL TUBULAR DE ALUMINIO TP-8268/T5/6063/6000",
            "fornecedor": "Tecnoperfil",
            "barra": 6,
            "tratamento": "Pintura",
            "kg_m": 2.39
    },
    {
            "id": "seed_1777474312348_045",
            "codigo": "PA-PERFILBOISERIE",
            "descricao": "PERFIL BOISERIE 9602 JAT ANOD 6,0 MT PLIBL",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.0
    },
    {
            "id": "seed_1777474312348_046",
            "codigo": "PA-PF-050",
            "descricao": "PF 050 - 04 A 06 mm",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.28
    },
    {
            "id": "seed_1777474312348_047",
            "codigo": "PA-PF-051",
            "descricao": "PF 051 - 08 A 10 mm",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.26
    },
    {
            "id": "seed_1777474312348_048",
            "codigo": "PA-PF-052",
            "descricao": "PF 052 - 12 A 14 mm",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.24
    },
    {
            "id": "seed_1777474312348_049",
            "codigo": "PA-PF-053",
            "descricao": "PF 053 - 16 A 18 mm",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.21
    },
    {
            "id": "seed_1777474312348_050",
            "codigo": "PA-PF-054",
            "descricao": "PF054 - 20 A 22 mm",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.2
    },
    {
            "id": "seed_1777474312348_051",
            "codigo": "PA-PF-055",
            "descricao": "PF055 - 26 A 28 mm",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.17
    },
    {
            "id": "seed_1777474312348_052",
            "codigo": "PA-PF-104",
            "descricao": "MARCO FIXO PARA VIDRO",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.72
    },
    {
            "id": "seed_1777474312348_053",
            "codigo": "PA-WEIKUBAGUETE",
            "descricao": "PERFIL ALU BAGUETE PIVONTANTE 12MM A 16MM PDS-1769",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.4
    },
    {
            "id": "seed_1777474312348_054",
            "codigo": "PA-WEIKU_BT_QLON",
            "descricao": "PERFIL ALU BATENTE FOLHA PIVOTANTE PDS-1771",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.0
    },
    {
            "id": "seed_1777474312348_055",
            "codigo": "PA-WEIKU_FLH_ALTURA",
            "descricao": "PERFIL ALU FOLHA PIVOTANTE LATERAL PDS-1768",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 2.91
    },
    {
            "id": "seed_1777474312348_056",
            "codigo": "PA-WEIKU_FLH_LARGURA",
            "descricao": "PERFIL ALU FOLHA PIVOTANTE INFERIOR / SUPERIOR PDS-1770",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 2.84
    },
    {
            "id": "seed_1777474312348_057",
            "codigo": "PA-WEIKU_PORTAL",
            "descricao": "PERFIL ALU CAIXILHO PIVOTANTE PDS-1774",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 2.23
    },
    {
            "id": "seed_1777474312348_058",
            "codigo": "PF45.017",
            "descricao": "COMPLEMENTO PIVOTANTE",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.24
    },
    {
            "id": "seed_1777474312348_059",
            "codigo": "PF45.019",
            "descricao": "MARCO PIVOTANTE",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.25
    },
    {
            "id": "seed_1777474312348_060",
            "codigo": "PF45.023",
            "descricao": "MATAJUNTA PIVOTANTE",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 0.41
    },
    {
            "id": "seed_1777474312348_061",
            "codigo": "PF45.024",
            "descricao": "FOLHA PIVOTANTE",
            "fornecedor": "Mercado",
            "barra": 6,
            "tratamento": "Natural",
            "kg_m": 1.56
    }
];
  const PARAMS_DEFAULT = {
    tecnoperfil: { rs_kg: 0 },
    mercado:     { rs_kg: 0 },
    pintura:     { rs_kg: 0 },
    barra: 6,
  };

  let state = { params: PARAMS_DEFAULT, perfis: [] };
  let saveTimer = null;

  // ----------------------------------------------------------------
  // CATEGORIA — removida do cadastro de perfis a pedido do Felipe.
  // Os motores de calculo de cada item nao usam mais essa flag.
  // ----------------------------------------------------------------

  function load() {
    state.params = { ...PARAMS_DEFAULT, ...(store.get('perfis_params') || {}) };
    const lista = store.get('perfis_lista');
    const tc = (s) => (window.Universal && window.Universal.titleCase) ? window.Universal.titleCase(s || '') : (s || '');
    const normPerfil = (p) => ({
      ...p,
      descricao: tc(p.descricao),
      fornecedor: tc(p.fornecedor),
      tratamento: tc(p.tratamento),
      // Categoria removida — propriedade `p.categoria` antiga e' preservada
      // no localStorage por seguranca (nao e' apagada), mas nao e' mais
      // usada nem renderizada.
    });
    if (lista === null || (Array.isArray(lista) && lista.length === 0 && !store.get('perfis_seeded'))) {
      // primeira carga: importa o seed do PDF automaticamente, sem pedir confirmacao
      state.perfis = SEED_PERFIS_PDF.map(p => normPerfil({
        ...p,
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      }));
      store.set('perfis_lista', state.perfis);
      store.set('perfis_seeded', true);
    } else {
      // Normaliza descricoes existentes pra Title Case (R20).
      state.perfis = (lista || []).map(normPerfil);
    }
  }
  function save() {
    store.set('perfis_params', state.params);
    store.set('perfis_lista', state.perfis);
    showSaved();
    // Botao salvar volta pra "Tudo salvo"
    const btn = document.getElementById('perfis-btn-save');
    if (btn) {
      btn.classList.remove('is-dirty');
      btn.textContent = '✓ Tudo salvo';
    }
  }
  function markDirty() {
    const btn = document.getElementById('perfis-btn-save');
    if (btn) {
      btn.classList.add('is-dirty');
      btn.textContent = '💾 Salvar Alteracoes';
    }
  }
  const saveDebounced = debounce(save, 350);

  function showSaved() {
    const el = document.getElementById('cad-saved-pill');
    if (!el) return;
    el.classList.add('is-visible');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => el.classList.remove('is-visible'), 1500);
  }

  function calc(perfil) {
    const kg_m   = Number(perfil.kg_m) || 0;
    // Barra agora vem do proprio perfil (6 / 7 / 8 m). Fallback 6m para perfis legados.
    const barra  = Number(perfil.barra) || 6;
    // Compatibilidade: 'Weiku' (legado) cai para 'Mercado'
    let fornKey  = (perfil.fornecedor || 'mercado').toLowerCase();
    if (!state.params[fornKey]) fornKey = 'mercado';
    const forn   = state.params[fornKey];
    const rs_kg  = Number(forn.rs_kg) || 0;
    const pintRs = Number(state.params.pintura.rs_kg) || 0;
    // Tratamento: 'Pintura' soma pintura, 'Natural' nao soma. Padrao 'Pintura' (compatibilidade).
    const tratamento = perfil.tratamento || 'Pintura';
    const aplicaPintura = (tratamento === 'Pintura');

    const kg_barra   = kg_m * barra;
    const rs_perfil  = kg_barra * rs_kg;
    const rs_pintura = aplicaPintura ? (kg_barra * pintRs) : 0;
    const rs_total   = rs_perfil + rs_pintura;
    return { kg_barra, rs_perfil, rs_pintura, rs_total, aplicaPintura };
  }

  function newId() { return 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000); }

  function render(container) {
    load();

    container.innerHTML = `
      <div class="cad-params">
        <div class="cad-section-title">Parametros globais — precos por kg</div>
        <div class="cad-params-grid">
          ${paramRow('tecnoperfil', 'Tecnoperfil', true)}
          ${paramRow('mercado',     'Mercado',     true)}
          ${paramRow('pintura',     'Pintura',     true)}
        </div>
      </div>

      <div class="cad-toolbar">
        <div class="cad-toolbar-left">
          <span class="cad-section-title" style="margin:0;">Perfis cadastrados</span>
          <span class="cad-count"><strong id="perfis-count">${state.perfis.length}</span> perfis</span>
          <span class="cad-saved-pill" id="cad-saved-pill">✓ salvo automaticamente</span>
        </div>
        <div class="cad-toolbar-right">
          <input type="file" id="file-import" accept=".xlsx,.xls,.csv" style="display:none;" />
          <button class="univ-btn-import" id="btn-import-file">⤓ Importar planilha</button>
          <button class="univ-btn-export" id="btn-export-xlsx">⬇ Exportar Excel</button>
          <button class="univ-btn-save" id="perfis-btn-save">✓ Tudo salvo</button>
        </div>
      </div>

      <div class="cad-table-wrap">
        <table class="cad-table">
          <thead>
            <tr>
              <th style="min-width:180px;">Codigo</th>
              <th style="min-width:380px;">Descricao</th>
              <th style="min-width:120px;">Fornecedor</th>
              <th style="min-width:80px;">Barra</th>
              <th style="min-width:110px;">Tratamento</th>
              <th class="num" style="min-width:90px;">kg/m</th>
              <th class="num" style="min-width:100px;">kg/barra</th>
              <th class="num" data-no-filter="1" style="min-width:120px;">R$ perfil</th>
              <th class="num" data-no-filter="1" style="min-width:120px;">R$ pintura</th>
              <th class="num" data-no-filter="1" style="min-width:150px;">R$ total/barra</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody id="perfis-tbody">
            ${renderRows()}
          </tbody>
        </table>
      </div>

      <div class="cad-add-form">
        <h4>+ Adicionar Novo Perfil</h4>
        <div class="cad-add-grid">
          <div>
            <div class="cad-param-label">Codigo</div>
            <input id="add-codigo" class="cad-input" type="text" placeholder="" />
          </div>
          <div>
            <div class="cad-param-label">Descricao</div>
            <input id="add-descricao" class="cad-input" type="text" placeholder="" />
          </div>
          <div>
            <div class="cad-param-label">kg/m</div>
            <input id="add-kgm" class="cad-input" type="text" inputmode="decimal" placeholder="" />
          </div>
          <div>
            <div class="cad-param-label">Fornecedor</div>
            <select id="add-fornecedor" class="cad-input">
              ${getFornecedores().map(f => `<option value="${f}">${f}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="cad-param-label">Barra</div>
            <select id="add-barra" class="cad-input">
              <option value="6">6 m</option>
              <option value="7">7 m</option>
              <option value="8">8 m</option>
            </select>
          </div>
          <div>
            <div class="cad-param-label">Tratamento</div>
            <select id="add-tratamento" class="cad-input">
              ${getTratamentos().map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add" style="height:34px;">+ Adicionar</button>
        </div>
      </div>
    `;

    bindEvents(container);
  }

  function paramRow(key, label, hasDed) {
    if (key === 'barra') {
      return `
        <div class="cad-param">
          <div class="cad-param-label">${label}</div>
          <div class="cad-param-inputs">
            <input data-param="${key}" data-field="value" type="text" inputmode="decimal" value="${(Number(state.params.barra) || 0).toFixed(2).replace('.', ',')}" />
            <span class="cad-param-suffix">m</span>
          </div>
        </div>`;
    }
    const p = state.params[key] || { rs_kg: 0 };
    return `
      <div class="cad-param">
        <div class="cad-param-label">${label}</div>
        <div class="cad-param-inputs">
          <input data-param="${key}" data-field="rs_kg" type="text" inputmode="decimal" value="${(Number(p.rs_kg) || 0).toFixed(2).replace('.', ',')}" placeholder="" />
          <span class="cad-param-suffix">R$/kg</span>
        </div>
      </div>`;
  }

  function renderRows() {
    const lista = state.perfis;

    if (lista.length === 0) {
      const msg = `Nenhum perfil cadastrado ainda. <span class="t-strong">Use o formulario abaixo para adicionar.</span>`;
      return `<tr><td colspan="11" class="cad-empty">${msg}</td></tr>`;
    }
    return lista.map(p => {
      const c = calc(p);
      const barra = Number(p.barra) || 6;
      const tratamento = p.tratamento || 'Pintura';
      const pinturaCell = c.aplicaPintura ? fmtBR(c.rs_pintura) : '—';
      return `
        <tr data-id="${p.id}">
          <td><input data-field="codigo" type="text" value="${escapeHtml(p.codigo)}" /></td>
          <td><input data-field="descricao" type="text" value="${escapeHtml(p.descricao)}" /></td>
          <td>
            <select data-field="fornecedor">
              ${getFornecedores().map(f => `<option value="${f}" ${p.fornecedor === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </td>
          <td>
            <select data-field="barra">
              ${[6,7,8].map(b => `<option value="${b}" ${barra === b ? 'selected' : ''}>${b} m</option>`).join('')}
            </select>
          </td>
          <td>
            <select data-field="tratamento">
              ${getTratamentos().map(t => `<option value="${t}" ${tratamento === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </td>
          <td class="num"><input data-field="kg_m" type="text" inputmode="decimal" value="${(Number(p.kg_m) || 0).toFixed(2).replace('.', ',')}" /></td>
          <td class="calc">${fmtNum(c.kg_barra)}</td>
          <td class="calc">${fmtBR(c.rs_perfil)}</td>
          <td class="calc">${pinturaCell}</td>
          <td class="calc"><span class="t-strong">${fmtBR(c.rs_total)}</span></td>
          <td class="actions"><button class="row-delete" data-action="delete" title="Excluir">×</button></td>
        </tr>
      `;
    }).join('');
  }

  function bindEvents(container) {
    // Parametros globais
    container.querySelectorAll('[data-param]').forEach(input => {
      input.addEventListener('input', () => {
        const key = input.dataset.param;
        const field = input.dataset.field;
        const val = parseBR(input.value);
        if (key === 'barra') {
          state.params.barra = val;
        } else {
          state.params[key] = state.params[key] || { rs_kg: 0 };
          state.params[key][field] = val;
        }
        refreshRows();
        markDirty();
        saveDebounced();
      });
    });

    // Edicao inline da tabela
    container.querySelector('#perfis-tbody').addEventListener('input', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const id = tr.dataset.id;
      const perfil = state.perfis.find(p => p.id === id);
      if (!perfil) return;
      const field = e.target.dataset.field;
      if (!field) return;
      if (field === 'kg_m') {
        perfil[field] = parseBR(e.target.value);
      } else {
        perfil[field] = e.target.value;
      }
      refreshRow(tr, perfil);
      markDirty();
      saveDebounced();
    });
    container.querySelector('#perfis-tbody').addEventListener('change', (e) => {
      // change event para selects (fornecedor, barra, tratamento)
      if (e.target.tagName !== 'SELECT') return;
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const id = tr.dataset.id;
      const perfil = state.perfis.find(p => p.id === id);
      if (!perfil) return;
      const field = e.target.dataset.field;
      if (field === 'barra') {
        perfil.barra = Number(e.target.value);
      } else {
        perfil[field] = e.target.value;
      }
      refreshRow(tr, perfil);
      markDirty();
      saveDebounced();
    });

    // Excluir linha
    container.querySelector('#perfis-tbody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="delete"]');
      if (!btn) return;
      const tr = btn.closest('tr[data-id]');
      const id = tr.dataset.id;
      const perfil = state.perfis.find(p => p.id === id);
      if (!confirm(`Excluir perfil "${perfil ? perfil.codigo : id}"? Essa acao nao pode ser desfeita.`)) return;
      state.perfis = state.perfis.filter(p => p.id !== id);
      refreshTable();
      save();
    });

    // Adicionar novo perfil
    container.querySelector('#btn-add').addEventListener('click', () => {
      const codigo = container.querySelector('#add-codigo').value.trim();
      const descricao = container.querySelector('#add-descricao').value.trim();
      const kg_m = parseBR(container.querySelector('#add-kgm').value);
      const fornecedor = container.querySelector('#add-fornecedor').value;
      const barra = Number(container.querySelector('#add-barra').value) || 6;
      const tratamento = container.querySelector('#add-tratamento').value;
      if (!codigo) {
        alert('Informe o codigo do perfil.');
        return;
      }
      if (state.perfis.some(p => p.codigo.toLowerCase() === codigo.toLowerCase())) {
        if (!confirm(`Ja existe um perfil com codigo "${codigo}". Adicionar mesmo assim?`)) return;
      }
      state.perfis.push({ id: newId(), codigo, descricao, fornecedor, barra, tratamento, kg_m });
      // limpa form
      container.querySelector('#add-codigo').value = '';
      container.querySelector('#add-descricao').value = '';
      container.querySelector('#add-kgm').value = '';
      container.querySelector('#add-codigo').focus();
      refreshTable();
      save();
    });

    // Exportar Excel
    container.querySelector('#btn-export-xlsx').addEventListener('click', exportXLSX);

    // Botao "Salvar Alteracoes" com popup de confirmacao (regra universal R07)
    const btnSavePerfis = container.querySelector('#perfis-btn-save');
    if (btnSavePerfis) {
      btnSavePerfis.addEventListener('click', () => {
        save();
        btnSavePerfis.classList.remove('is-dirty');
        btnSavePerfis.textContent = '✓ Tudo salvo';
        showSavedDialog('Alteracoes em Perfis salvas com sucesso!');
      });
    }

    // Importar planilha (XLSX ou CSV)
    const fileInput = container.querySelector('#file-import');
    container.querySelector('#btn-import-file').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      handleImportFile(file);
      // limpa pra permitir importar o mesmo arquivo de novo
      fileInput.value = '';
    });
    // R12: aplica sort+filtro universal por coluna
    const tbl = container.querySelector('.cad-table');
    if (tbl && window.Universal) window.Universal.autoEnhance(tbl, { skipCols: ['actions'] });
  }

  function refreshRow(tr, perfil) {
    const c = calc(perfil);
    const cells = tr.querySelectorAll('.calc');
    cells[0].textContent = fmtNum(c.kg_barra);
    cells[1].textContent = fmtBR(c.rs_perfil);
    cells[2].textContent = c.aplicaPintura ? fmtBR(c.rs_pintura) : '—';
    cells[3].innerHTML   = `<span class="t-strong">${fmtBR(c.rs_total)}</span>`;
  }
  function refreshRows() {
    document.querySelectorAll('#perfis-tbody tr[data-id]').forEach(tr => {
      const id = tr.dataset.id;
      const perfil = state.perfis.find(p => p.id === id);
      if (perfil) refreshRow(tr, perfil);
    });
  }
  function refreshTable() {
    const tbody = document.querySelector('#perfis-tbody');
    if (tbody) tbody.innerHTML = renderRows();
    const count = document.querySelector('#perfis-count');
    if (count) count.textContent = state.perfis.length;
  }

  /* ============================================================
     EXPORT XLSX — gera planilha Excel nativa
     Exporta APENAS os 6 campos editaveis. Os demais (kg/barra,
     R$ perfil, R$ pintura, R$ total/barra) sao formulas
     calculadas no sistema e nao devem ser editados na planilha.
     ============================================================ */
  function exportXLSX() {
    if (typeof XLSX === 'undefined') {
      alert('Biblioteca de planilha (SheetJS) nao carregou. Verifique sua conexao com a internet.');
      return;
    }
    const headers = ['Codigo','Descricao','Fornecedor','Barra','Tratamento','kg/m'];
    const rows = state.perfis.map(p => [
      p.codigo || '',
      p.descricao || '',
      p.fornecedor || 'Mercado',
      Number(p.barra) || 6,
      p.tratamento || 'Pintura',
      Number((Number(p.kg_m) || 0).toFixed(2)),
    ]);
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 22 }, { wch: 55 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 8 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Perfis');
    const today = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `perfis_projetta_${today}.xlsx`);
  }

  /* ============================================================
     IMPORT XLSX/CSV — sincronizacao TOTAL
     O arquivo vira a verdade. Codigos novos sao adicionados,
     existentes sao atualizados, ausentes sao removidos.
     ============================================================ */
  function handleImportFile(file) {
    if (typeof XLSX === 'undefined') {
      alert('Biblioteca de planilha (SheetJS) nao carregou. Verifique sua conexao com a internet.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        processImportedRows(aoa, file.name);
      } catch (err) {
        console.error('[Import]', err);
        alert('Nao foi possivel ler o arquivo. Verifique se e um XLSX ou CSV valido.\n\nDetalhe: ' + err.message);
      }
    };
    reader.onerror = () => alert('Falha ao ler o arquivo.');
    reader.readAsArrayBuffer(file);
  }

  function processImportedRows(aoa, fileName) {
    if (!aoa || aoa.length < 2) {
      alert('A planilha esta vazia ou nao tem linhas de dados.');
      return;
    }
    // Normaliza cabecalhos (aceita "Código", "CODIGO", "codigo" etc.)
    const norm = (s) => String(s || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const headers = aoa[0].map(norm);
    const idx = {
      codigo:     headers.indexOf('codigo'),
      descricao:  headers.indexOf('descricao'),
      fornecedor: headers.indexOf('fornecedor'),
      barra:      headers.indexOf('barra'),
      tratamento: headers.indexOf('tratamento'),
      kg_m:       headers.indexOf('kg/m'),
    };
    if (idx.codigo === -1) {
      alert('A planilha precisa ter ao menos a coluna "Codigo".\n\nCabecalhos esperados:\nCodigo, Descricao, Fornecedor, Barra, Tratamento, kg/m');
      return;
    }

    const FORN_MAP = new Map(getFornecedores().map(f => [f.toLowerCase(), f]));
    const TRAT_MAP = new Map(getTratamentos().map(t => [t.toLowerCase(), t]));
    const linhasValidas = [];
    const erros = [];
    // Felipe (sessao 2026-05): coleta valores NOVOS (que nao estao no
    // cadastro de Filtros ainda) — depois oferece adicionar.
    const novosFornecedores = new Set();
    const novosTratamentos  = new Set();

    for (let i = 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;
      const codigo = String(row[idx.codigo] || '').trim();
      if (!codigo) continue;

      // Fornecedor
      let fornecedor = 'Mercado';
      if (idx.fornecedor !== -1) {
        const raw = String(row[idx.fornecedor] || '').trim();
        const match = FORN_MAP.get(raw.toLowerCase());
        if (match) fornecedor = match;
        else if (raw) {
          // Felipe (sessao 2026-05): em vez de cair no fallback "Mercado",
          // mantem o valor original pra preservar a planilha — depois
          // pergunta se quer adicionar ao cadastro.
          fornecedor = raw;
          novosFornecedores.add(raw);
        }
      }
      // Tratamento
      let tratamento = 'Pintura';
      if (idx.tratamento !== -1) {
        const raw = String(row[idx.tratamento] || '').trim();
        const match = TRAT_MAP.get(raw.toLowerCase());
        if (match) tratamento = match;
        else if (raw) {
          tratamento = raw;
          novosTratamentos.add(raw);
        }
      }
      // Barra
      let barra = 6;
      if (idx.barra !== -1) {
        const raw = String(row[idx.barra] || '').replace(/[^\d]/g, '');
        const n = parseInt(raw, 10);
        if ([6,7,8].includes(n)) barra = n;
        else if (raw) erros.push(`Linha ${i+1} (${codigo}): barra "${row[idx.barra]}" invalida, usando 6m`);
      }
      // kg/m
      let kg_m = 0;
      if (idx.kg_m !== -1) kg_m = parseBR(row[idx.kg_m]);

      linhasValidas.push({
        codigo, fornecedor, barra, tratamento, kg_m,
        descricao: idx.descricao !== -1 ? String(row[idx.descricao] || '').trim() : '',
      });
    }

    if (linhasValidas.length === 0) {
      alert('Nenhuma linha valida encontrada.\nA planilha precisa ter pelo menos a coluna Codigo preenchida.');
      return;
    }

    // Detecta duplicatas (mantem a ultima ocorrencia)
    const codSeen = new Map();
    const duplicados = [];
    linhasValidas.forEach(l => {
      const k = l.codigo.toLowerCase();
      if (codSeen.has(k)) duplicados.push(l.codigo);
      codSeen.set(k, l);
    });
    const linhasUnicas = Array.from(codSeen.values());

    // Diff
    const codigosAtuais = new Map(state.perfis.map(p => [(p.codigo || '').toLowerCase(), p]));
    const codigosNovos  = new Set(linhasUnicas.map(l => l.codigo.toLowerCase()));
    const adicionar = linhasUnicas.filter(l => !codigosAtuais.has(l.codigo.toLowerCase()));
    const atualizar = linhasUnicas.filter(l =>  codigosAtuais.has(l.codigo.toLowerCase()));
    const apagar    = state.perfis.filter(p => !codigosNovos.has((p.codigo || '').toLowerCase()));

    // Confirmacao
    let msg = `Importar de "${fileName}"?\n\n`;
    msg += `RESUMO DA SINCRONIZACAO TOTAL:\n`;
    msg += `  + Adicionar:  ${adicionar.length} perfil(is) novo(s)\n`;
    msg += `  ~ Atualizar:  ${atualizar.length} perfil(is) existente(s)\n`;
    msg += `  - APAGAR:     ${apagar.length} perfil(is) (nao estao no arquivo)\n`;
    if (duplicados.length > 0) {
      const lista = duplicados.slice(0, 5).join(', ');
      msg += `\nAVISO: codigos duplicados no arquivo (mantida a ultima ocorrencia): ${lista}${duplicados.length > 5 ? ', ...' : ''}\n`;
    }
    if (erros.length > 0) {
      msg += `\n${erros.length} aviso(s) de validacao (valores corrigidos automaticamente).\n`;
    }
    msg += `\nDeseja continuar?`;
    if (!confirm(msg)) return;

    // Aplica
    const novosPerfis = linhasUnicas.map(l => {
      const existente = codigosAtuais.get(l.codigo.toLowerCase());
      return {
        id: existente ? existente.id : ('p_' + Date.now() + '_' + Math.random().toString(36).slice(2,7)),
        codigo:     l.codigo,
        descricao:  l.descricao,
        fornecedor: l.fornecedor,
        barra:      l.barra,
        tratamento: l.tratamento,
        kg_m:       l.kg_m,
      };
    });
    state.perfis = novosPerfis;
    refreshTable();
    save();

    // Felipe (sessao 2026-05): apos importar com sucesso, perguntar
    // sobre valores novos detectados em fornecedor/tratamento.
    // Se modulo Filtros nao estiver disponivel, ignora silenciosamente.
    if (window.Filtros && typeof window.Filtros.adicionar === 'function') {
      if (novosFornecedores.size > 0) {
        const lista = Array.from(novosFornecedores).sort();
        const msg = `A planilha trouxe ${lista.length} fornecedor(es) que NAO estao no cadastro de Filtros:\n\n` +
                    `• ${lista.join('\n• ')}\n\n` +
                    `Deseja ADICIONAR esses fornecedores ao cadastro de Filtros (Cadastros > Filtros > Fornecedor de Perfis)?\n\n` +
                    `→ OK = adicionar todos\n→ Cancelar = manter fora do cadastro`;
        if (confirm(msg)) {
          let adicionados = 0;
          lista.forEach(f => { if (window.Filtros.adicionar('perfis_fornecedor', f)) adicionados++; });
          console.log(`[perfis] ${adicionados} fornecedor(es) adicionados ao Filtros`);
        }
      }
      if (novosTratamentos.size > 0) {
        const lista = Array.from(novosTratamentos).sort();
        const msg = `A planilha trouxe ${lista.length} tratamento(s) que NAO estao no cadastro de Filtros:\n\n` +
                    `• ${lista.join('\n• ')}\n\n` +
                    `Deseja ADICIONAR esses tratamentos ao cadastro de Filtros (Cadastros > Filtros > Tratamento de Perfis)?\n\n` +
                    `→ OK = adicionar todos\n→ Cancelar = manter fora do cadastro`;
        if (confirm(msg)) {
          let adicionados = 0;
          lista.forEach(t => { if (window.Filtros.adicionar('perfis_tratamento', t)) adicionados++; });
          console.log(`[perfis] ${adicionados} tratamento(s) adicionados ao Filtros`);
        }
      }
    }

    let resultado = `Importacao concluida:\n\n`;
    resultado += `  ${adicionar.length} adicionado(s)\n`;
    resultado += `  ${atualizar.length} atualizado(s)\n`;
    resultado += `  ${apagar.length} removido(s)\n`;
    resultado += `\nTotal de perfis agora: ${state.perfis.length}`;
    const totaisNovos = novosFornecedores.size + novosTratamentos.size;
    if (totaisNovos > 0) {
      resultado += `\n\n${totaisNovos} valor(es) novo(s) detectado(s) em filtros — ver pop-ups acima.`;
    }
    if (erros.length > 0) {
      resultado += `\n\nAvisos de validacao:\n` + erros.slice(0, 10).join('\n');
      if (erros.length > 10) resultado += `\n... e mais ${erros.length - 10} aviso(s)`;
    }
    alert(resultado);
  }

  // Felipe (R-inegociavel): preco do kg e da pintura SEMPRE puxa
  // da aba Cadastro > Perfis. Estes helpers expoem o estado interno
  // pra que outros modulos (Orcamento) leiam sem fallback hardcoded.
  // O `load()` e' chamado preguicosamente pra garantir que o seed
  // foi inserido mesmo se a aba ainda nao foi aberta.
  function listar() {
    load();
    return state.perfis.slice();
  }
  function getParams() {
    load();
    // retorna copia rasa pra nao permitir mutacao externa
    return JSON.parse(JSON.stringify(state.params));
  }

  return { render, listar, getParams };
})();

// Expoe globalmente pra que outros modulos (Orcamento) consumam
// listar() e getParams() sem fallback hardcoded.
if (typeof window !== 'undefined') {
  window.Perfis = Perfis;
}
