-- ═══════════════════════════════════════════════════════════════════════════
-- PROJETTA CRM 2026 — SCHEMA PROFISSIONAL
-- ═══════════════════════════════════════════════════════════════════════════
-- Executa em: https://supabase.com/dashboard/project/plmliavuwlgpwaizfeds/sql
--
-- Substitui o blob único projetta_crm_v1 em configuracoes por tabelas
-- relacionais com índices, audit trail e Storage para anexos.
--
-- SEGURO: não deleta nada. Tabelas novas convivem com o sistema antigo até
-- migração ser validada. Tudo com IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABELA: crm_oportunidades
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crm_oportunidades (
  id              text PRIMARY KEY,                    -- mantém ID legado "c..."
  cliente         text NOT NULL,
  scope           text DEFAULT 'nacional',             -- nacional | internacional
  pais            text,
  estado          text,
  cidade          text,
  cep             text,
  telefone        text,
  email           text,
  endereco        text,

  -- Pipeline
  stage           text NOT NULL DEFAULT 's2',          -- s2, s3, s3b, s4, s5, s6, s7
  origem          text,
  produto         text,
  responsavel     text,
  wrep            text,                                -- Representante Weiku
  prioridade      text,                                -- alta | media | baixa
  potencial       text,                                -- alto | medio | baixo

  -- Especificações
  largura         numeric,
  altura          numeric,
  abertura        text,
  modelo          text,
  folhas          integer,
  reserva         text,                                -- Reserva interna Weiku
  agp             text,                                -- Número AGP

  -- Valores (cache da última revisão — fonte de verdade fica em crm_revisoes)
  valor           numeric DEFAULT 0,
  valor_tabela    numeric DEFAULT 0,
  valor_faturamento numeric DEFAULT 0,

  -- Datas
  data_contato    date,
  fechamento      date,
  previsao        date,

  -- Revisão exibida no pipeline (índice; -1/null = mais recente)
  rev_pipeline    integer,

  -- Extras livres
  notas           text,
  extras          jsonb DEFAULT '{}'::jsonb,

  -- Controle
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text,
  updated_by      text,
  deleted_at      timestamptz                          -- soft delete
);

CREATE INDEX IF NOT EXISTS idx_crm_opp_stage         ON public.crm_oportunidades(stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_opp_responsavel   ON public.crm_oportunidades(responsavel) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_opp_cliente       ON public.crm_oportunidades(cliente) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_opp_estado_cidade ON public.crm_oportunidades(estado, cidade) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_opp_fechamento    ON public.crm_oportunidades(fechamento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_opp_updated_at    ON public.crm_oportunidades(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_opp_reserva       ON public.crm_oportunidades(reserva) WHERE reserva IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_opp_agp           ON public.crm_oportunidades(agp) WHERE agp IS NOT NULL;

COMMENT ON TABLE public.crm_oportunidades IS 'CRM Projetta 2026 — oportunidades (1 row/card). Substitui blob projetta_crm_v1.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TABELA: crm_revisoes
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crm_revisoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opp_id          text NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  rev_num         integer NOT NULL,                    -- 0 = Original, 1 = Rev 1, etc
  label           text NOT NULL,                       -- "Original", "Revisão 1", "Pós-Reunião"
  data            timestamptz NOT NULL DEFAULT now(),

  -- Valores autoritativos desta revisão
  valor_tabela      numeric DEFAULT 0,
  valor_faturamento numeric DEFAULT 0,

  -- Snapshot completo do orçamento no momento da revisão
  -- (inputs + outputs + carac-* + planificador + perfis + chapas)
  snapshot        jsonb,

  -- Proposta em PDF gerada
  pdf_cloud       text,                                -- URL no Supabase Storage
  pdf_pages       jsonb,                               -- páginas base64 (legado)

  -- Flags
  crm_pronto      boolean DEFAULT false,
  observacoes     text,

  -- Controle
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text,

  UNIQUE(opp_id, rev_num)
);

CREATE INDEX IF NOT EXISTS idx_crm_rev_opp          ON public.crm_revisoes(opp_id, rev_num);
CREATE INDEX IF NOT EXISTS idx_crm_rev_data         ON public.crm_revisoes(data DESC);

COMMENT ON TABLE public.crm_revisoes IS 'Histórico de revisões por oportunidade (snapshot + valores + PDF).';


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. TABELA: crm_eventos (AUDIT LOG)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crm_eventos (
  id              bigserial PRIMARY KEY,
  opp_id          text REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  rev_id          uuid REFERENCES public.crm_revisoes(id) ON DELETE SET NULL,

  -- Tipo: create | update | delete | stage_change | rev_create | rev_update
  --       orc_pronto | pdf_gen | anexo_add | anexo_del | value_change
  tipo            text NOT NULL,

  -- Contexto
  campo           text,                                -- qual campo mudou
  valor_antes     jsonb,
  valor_depois    jsonb,
  descricao       text,

  -- Quem/quando
  user_name       text,
  user_email      text,
  user_agent      text,
  ip              text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_ev_opp      ON public.crm_eventos(opp_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_ev_tipo     ON public.crm_eventos(tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_ev_user     ON public.crm_eventos(user_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_ev_created  ON public.crm_eventos(created_at DESC);

COMMENT ON TABLE public.crm_eventos IS 'Audit trail completo. Toda mudança em card/revisão/stage é registrada.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. TABELA: crm_anexos (metadados — arquivos vão no Storage)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crm_anexos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opp_id          text NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  rev_id          uuid REFERENCES public.crm_revisoes(id) ON DELETE SET NULL,

  nome            text NOT NULL,
  tipo_mime       text,
  tamanho_bytes   bigint,

  -- Storage
  storage_path    text,                                -- ex: "c<id>/2026/foto.jpg"
  storage_bucket  text DEFAULT 'crm-anexos',
  inline_data     text,                                -- LEGADO: base64 pequeno (fallback)

  descricao       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text
);

CREATE INDEX IF NOT EXISTS idx_crm_anx_opp  ON public.crm_anexos(opp_id);
CREATE INDEX IF NOT EXISTS idx_crm_anx_rev  ON public.crm_anexos(rev_id);

COMMENT ON TABLE public.crm_anexos IS 'Anexos: metadados em SQL, arquivos grandes no Storage bucket crm-anexos.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. TABELA: crm_config
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.crm_config (
  chave           text PRIMARY KEY,                    -- stages | origins | products | team | wreps
  valor           jsonb NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      text
);

COMMENT ON TABLE public.crm_config IS 'Config CRM: stages, origins, products, team, wreps. Substitui projetta_crm_settings_v1.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. TRIGGERS: auto-update timestamp
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_opp_updated ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_opp_updated
  BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_crm_cfg_updated ON public.crm_config;
CREATE TRIGGER trg_crm_cfg_updated
  BEFORE UPDATE ON public.crm_config
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. VIEW: crm_opp_full (oportunidade + última revisão pré-juntada)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.crm_opp_full AS
SELECT
  o.*,
  r.id            AS last_rev_id,
  r.rev_num       AS last_rev_num,
  r.label         AS last_rev_label,
  r.data          AS last_rev_data,
  r.valor_tabela      AS last_valor_tabela,
  r.valor_faturamento AS last_valor_faturamento,
  r.crm_pronto    AS last_crm_pronto,
  (SELECT count(*) FROM public.crm_revisoes WHERE opp_id = o.id) AS total_revisoes
FROM public.crm_oportunidades o
LEFT JOIN LATERAL (
  SELECT * FROM public.crm_revisoes
  WHERE opp_id = o.id
  ORDER BY rev_num DESC
  LIMIT 1
) r ON true
WHERE o.deleted_at IS NULL;

COMMENT ON VIEW public.crm_opp_full IS 'Oportunidade + última revisão. Usar para listagens.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. RLS (Row Level Security) — anon pode ler/escrever
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_revisoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_eventos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_anexos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_config        ENABLE ROW LEVEL SECURITY;

-- Política permissiva (mesmo padrão de configuracoes)
DO $$ BEGIN
  CREATE POLICY "crm_opp_all"    ON public.crm_oportunidades FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "crm_rev_all"    ON public.crm_revisoes      FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "crm_ev_all"     ON public.crm_eventos       FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "crm_anx_all"    ON public.crm_anexos        FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "crm_cfg_all"    ON public.crm_config        FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. STORAGE BUCKET: crm-anexos
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-anexos', 'crm-anexos', true)
ON CONFLICT (id) DO NOTHING;

-- Política permissiva para o bucket
DO $$ BEGIN
  CREATE POLICY "crm_anexos_read"   ON storage.objects FOR SELECT USING (bucket_id = 'crm-anexos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "crm_anexos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'crm-anexos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "crm_anexos_update" ON storage.objects FOR UPDATE USING (bucket_id = 'crm-anexos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "crm_anexos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'crm-anexos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. VERIFICAÇÃO FINAL
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 'crm_oportunidades' AS tabela, count(*) FROM public.crm_oportunidades
UNION ALL SELECT 'crm_revisoes', count(*) FROM public.crm_revisoes
UNION ALL SELECT 'crm_eventos',  count(*) FROM public.crm_eventos
UNION ALL SELECT 'crm_anexos',   count(*) FROM public.crm_anexos
UNION ALL SELECT 'crm_config',   count(*) FROM public.crm_config;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIM DO SCHEMA — todas as tabelas, índices, views, RLS, Storage prontos.
-- Próximo passo: rodar migration (js/24-crm-migration.js) no navegador.
-- ═══════════════════════════════════════════════════════════════════════════
