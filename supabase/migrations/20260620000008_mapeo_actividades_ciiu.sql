-- Fase 2 "CIIU manda": tablas de mapeo actividad (CIIU) → norma / tipo de documento.
-- Semántica del evaluador (backward-compatible):
--   una norma / un tipo de documento pasa el filtro de actividad si NO tiene filas
--   en su tabla de mapeo (= aplica a TODAS las actividades, comportamiento actual)
--   O la actividad del establecimiento está entre las cargadas (= se acota a esas).
-- Así, mientras no se curen mapeos, todo sigue aplicando como hoy.
-- RLS espejada de normativa_normas_tipos_establecimiento / documentos_tipos_tipos_establecimiento.

BEGIN;

-- ─── Actividades que hacen aplicable a una NORMA ──────────────
CREATE TABLE IF NOT EXISTS public.normativa_normas_actividades (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norma_id     uuid NOT NULL REFERENCES public.normativa_normas(id) ON DELETE CASCADE,
  actividad_id uuid NOT NULL REFERENCES public.actividades_economicas(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (norma_id, actividad_id)
);
CREATE INDEX IF NOT EXISTS idx_nna_norma ON public.normativa_normas_actividades (norma_id);
CREATE INDEX IF NOT EXISTS idx_nna_actividad ON public.normativa_normas_actividades (actividad_id);

ALTER TABLE public.normativa_normas_actividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nna_select" ON public.normativa_normas_actividades;
CREATE POLICY "nna_select" ON public.normativa_normas_actividades FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.normativa_normas n
    WHERE n.id = norma_id
      AND (n.consultora_id IS NULL OR public.is_active_member_of(n.consultora_id))
  ));

DROP POLICY IF EXISTS "nna_write" ON public.normativa_normas_actividades;
CREATE POLICY "nna_write" ON public.normativa_normas_actividades FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.normativa_normas n
    WHERE n.id = norma_id
      AND ((n.consultora_id IS NULL AND public.puede_gestionar_librerias())
        OR (n.consultora_id IS NOT NULL AND public.is_active_member_of(n.consultora_id)))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.normativa_normas n
    WHERE n.id = norma_id
      AND ((n.consultora_id IS NULL AND public.puede_gestionar_librerias())
        OR (n.consultora_id IS NOT NULL AND public.is_active_member_of(n.consultora_id)))
  ));

-- ─── Actividades que hacen esperado a un TIPO DE DOCUMENTO ────
CREATE TABLE IF NOT EXISTS public.documentos_tipos_actividades (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_tipo_id uuid NOT NULL REFERENCES public.documentos_tipos(id) ON DELETE CASCADE,
  actividad_id      uuid NOT NULL REFERENCES public.actividades_economicas(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_tipo_id, actividad_id)
);
CREATE INDEX IF NOT EXISTS idx_dta_doc ON public.documentos_tipos_actividades (documento_tipo_id);
CREATE INDEX IF NOT EXISTS idx_dta_actividad ON public.documentos_tipos_actividades (actividad_id);

ALTER TABLE public.documentos_tipos_actividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dta_select" ON public.documentos_tipos_actividades;
CREATE POLICY "dta_select" ON public.documentos_tipos_actividades FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "dta_write" ON public.documentos_tipos_actividades;
CREATE POLICY "dta_write" ON public.documentos_tipos_actividades FOR ALL TO authenticated
  USING (public.puede_gestionar_librerias())
  WITH CHECK (public.puede_gestionar_librerias());

COMMIT;
