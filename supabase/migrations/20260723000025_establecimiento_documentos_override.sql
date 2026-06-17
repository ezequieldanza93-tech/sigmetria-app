-- ============================================================
-- Override del legajo por establecimiento (incluir / excluir documentos)
-- ============================================================
-- El profesional de HyS ajusta el legajo de UN establecimiento puntual:
--   • incluido = false → fuerza EXCLUIR un documento que el motor computó.
--   • incluido = true  → fuerza INCLUIR un documento que el motor NO computó
--     (p.ej. un doc condicional cuya pregunta respondieron NO, pero igual aplica).
-- Sin fila para un (establecimiento, documento) → vale lo que computa el motor.
--
-- RLS espeja establecimientos_respuestas (has_establecimiento_read/write_access).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.establecimiento_documentos_override (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  documento_tipo_id  uuid NOT NULL REFERENCES public.documentos_tipos(id) ON DELETE CASCADE,
  incluido           boolean NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establecimiento_id, documento_tipo_id)
);

CREATE INDEX IF NOT EXISTS idx_edo_estab ON public.establecimiento_documentos_override(establecimiento_id);

ALTER TABLE public.establecimiento_documentos_override ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "edo_select" ON public.establecimiento_documentos_override;
CREATE POLICY "edo_select" ON public.establecimiento_documentos_override
  FOR SELECT USING (public.has_establecimiento_read_access(establecimiento_id));

DROP POLICY IF EXISTS "edo_write" ON public.establecimiento_documentos_override;
CREATE POLICY "edo_write" ON public.establecimiento_documentos_override
  FOR ALL USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));
