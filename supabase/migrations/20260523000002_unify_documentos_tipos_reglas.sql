-- ============================================================
-- Escalabilidad: unificar pivots de documentos en una sola tabla
-- establecimientos_tipos_documentos + empresas_rubros_documentos
-- → documentos_tipos_reglas
-- ============================================================

-- ── 1. Crear tabla unificada ─────────────────────────────────
-- Mantiene FK tipadas (no polymorphic genérico) para preservar
-- integridad referencial. CHECK garantiza que exactamente una
-- dimensión esté presente por fila.

CREATE TABLE IF NOT EXISTS public.documentos_tipos_reglas (
  id                      uuid        NOT NULL DEFAULT gen_random_uuid(),
  documento_tipo_id       uuid        NOT NULL REFERENCES public.documentos_tipos(id)       ON DELETE CASCADE,
  tipo_establecimiento_id uuid                 REFERENCES public.establecimientos_tipos(id)  ON DELETE CASCADE,
  rubro_empresa_id        uuid                 REFERENCES public.empresas_rubros(id)         ON DELETE CASCADE,
  aplica_iso_45001        boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documentos_tipos_reglas_pkey PRIMARY KEY (id),
  CONSTRAINT exactly_one_dimension CHECK (
    (tipo_establecimiento_id IS NOT NULL)::int + (rubro_empresa_id IS NOT NULL)::int = 1
  )
);

-- Unicidad por dimensión (índices parciales, no un UNIQUE compuesto
-- que fallaría con NULLs en la otra columna)
CREATE UNIQUE INDEX IF NOT EXISTS uq_docregla_tipo_est
  ON public.documentos_tipos_reglas (documento_tipo_id, tipo_establecimiento_id)
  WHERE tipo_establecimiento_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_docregla_rubro
  ON public.documentos_tipos_reglas (documento_tipo_id, rubro_empresa_id)
  WHERE rubro_empresa_id IS NOT NULL;

-- Índices inversos para lookups desde la dimensión
CREATE INDEX IF NOT EXISTS idx_docregla_tipo_est
  ON public.documentos_tipos_reglas (tipo_establecimiento_id)
  WHERE tipo_establecimiento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_docregla_rubro
  ON public.documentos_tipos_reglas (rubro_empresa_id)
  WHERE rubro_empresa_id IS NOT NULL;

ALTER TABLE public.documentos_tipos_reglas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_tipos_reglas: select"
  ON public.documentos_tipos_reglas FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "documentos_tipos_reglas: insert"
  ON public.documentos_tipos_reglas FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "documentos_tipos_reglas: delete"
  ON public.documentos_tipos_reglas FOR DELETE TO authenticated
  USING (is_developer());

-- ── 2. Migrar datos desde tablas antiguas ───────────────────

INSERT INTO public.documentos_tipos_reglas
  (documento_tipo_id, tipo_establecimiento_id, aplica_iso_45001)
SELECT documento_tipo_id, tipo_establecimiento_id, false
FROM   public.establecimientos_tipos_documentos
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'empresas_rubros_documentos'
      AND column_name  = 'aplica_iso_45001'
  ) THEN
    INSERT INTO public.documentos_tipos_reglas (documento_tipo_id, rubro_empresa_id, aplica_iso_45001)
    SELECT documento_tipo_id, rubro_empresa_id, aplica_iso_45001
    FROM public.empresas_rubros_documentos
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.documentos_tipos_reglas (documento_tipo_id, rubro_empresa_id)
    SELECT documento_tipo_id, rubro_empresa_id
    FROM public.empresas_rubros_documentos
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ── 3. DROP tablas antiguas ──────────────────────────────────

DROP TABLE IF EXISTS public.establecimientos_tipos_documentos;
DROP TABLE IF EXISTS public.empresas_rubros_documentos;
