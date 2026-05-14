-- ============================================================
-- Sigmetria App — Sectores y tipo de establecimiento
-- ============================================================

CREATE TYPE public.tipo_establecimiento AS ENUM (
  'obra_construccion',
  'industria',
  'local_comercial',
  'local_administrativo',
  'otro'
);

ALTER TABLE public.establecimientos
  ADD COLUMN tipo public.tipo_establecimiento;

-- ============================================================
-- SECTORES — por establecimiento (lista base + personalizados)
-- ============================================================
CREATE TABLE public.sectores_establecimiento (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id    uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  es_custom             boolean NOT NULL DEFAULT false,
  cantidad_trabajadores int NOT NULL DEFAULT 0 CHECK (cantidad_trabajadores >= 0),
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.sectores_establecimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sectores: select" ON public.sectores_establecimiento FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));
CREATE POLICY "sectores: insert" ON public.sectores_establecimiento FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "sectores: update" ON public.sectores_establecimiento FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));
CREATE POLICY "sectores: delete" ON public.sectores_establecimiento FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));
