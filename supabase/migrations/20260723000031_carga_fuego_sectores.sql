BEGIN;

-- Tabla: calculo_carga_fuego_sectores
CREATE TABLE IF NOT EXISTS public.calculo_carga_fuego_sectores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculo_id      uuid NOT NULL REFERENCES public.calculo_carga_fuego(id) ON DELETE CASCADE,
  nombre_sector   text NOT NULL,
  superficie_m2   numeric,
  ventilacion     text,
  riesgo          text,
  qf_kg_m2        numeric,
  f_exigido       text,
  potencial_extintor_a text,
  potencial_extintor_b text,
  orden           integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Constraint idempotente: ventilacion CHECK
DO $$ BEGIN
  ALTER TABLE public.calculo_carga_fuego_sectores
    ADD CONSTRAINT calculo_carga_fuego_sectores_ventilacion_check
    CHECK (ventilacion IN ('natural', 'mecanica'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Constraint idempotente: riesgo CHECK
DO $$ BEGIN
  ALTER TABLE public.calculo_carga_fuego_sectores
    ADD CONSTRAINT calculo_carga_fuego_sectores_riesgo_check
    CHECK (riesgo IN ('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ccf_sectores_calculo ON public.calculo_carga_fuego_sectores (calculo_id);

-- Tabla: calculo_carga_fuego_sector_materiales
CREATE TABLE IF NOT EXISTS public.calculo_carga_fuego_sector_materiales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id       uuid NOT NULL REFERENCES public.calculo_carga_fuego_sectores(id) ON DELETE CASCADE,
  descripcion     text,
  estado          text,
  peso_kg         numeric,
  pci_kcal        numeric,
  coef_c          numeric,
  equiv_madera_kg numeric,
  orden           integer
);

CREATE INDEX IF NOT EXISTS idx_ccf_sector_materiales_sector ON public.calculo_carga_fuego_sector_materiales (sector_id);

-- RLS calculo_carga_fuego_sectores:
ALTER TABLE public.calculo_carga_fuego_sectores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccf_sectores: select" ON public.calculo_carga_fuego_sectores;
CREATE POLICY "ccf_sectores: select" ON public.calculo_carga_fuego_sectores FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND (c.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_sectores: insert" ON public.calculo_carga_fuego_sectores;
CREATE POLICY "ccf_sectores: insert" ON public.calculo_carga_fuego_sectores FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_sectores: update" ON public.calculo_carga_fuego_sectores;
CREATE POLICY "ccf_sectores: update" ON public.calculo_carga_fuego_sectores FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_sectores: delete" ON public.calculo_carga_fuego_sectores;
CREATE POLICY "ccf_sectores: delete" ON public.calculo_carga_fuego_sectores FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

-- RLS calculo_carga_fuego_sector_materiales:
-- El EXISTS hace un JOIN de 2 niveles: sector_materiales → sectores → cabecera → establecimiento_id
ALTER TABLE public.calculo_carga_fuego_sector_materiales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccf_sector_materiales: select" ON public.calculo_carga_fuego_sector_materiales;
CREATE POLICY "ccf_sector_materiales: select" ON public.calculo_carga_fuego_sector_materiales FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego_sectores s
    JOIN public.calculo_carga_fuego c ON c.id = s.calculo_id
    WHERE s.id = sector_id
      AND (c.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_sector_materiales: insert" ON public.calculo_carga_fuego_sector_materiales;
CREATE POLICY "ccf_sector_materiales: insert" ON public.calculo_carga_fuego_sector_materiales FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego_sectores s
    JOIN public.calculo_carga_fuego c ON c.id = s.calculo_id
    WHERE s.id = sector_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_sector_materiales: update" ON public.calculo_carga_fuego_sector_materiales;
CREATE POLICY "ccf_sector_materiales: update" ON public.calculo_carga_fuego_sector_materiales FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego_sectores s
    JOIN public.calculo_carga_fuego c ON c.id = s.calculo_id
    WHERE s.id = sector_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego_sectores s
    JOIN public.calculo_carga_fuego c ON c.id = s.calculo_id
    WHERE s.id = sector_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_sector_materiales: delete" ON public.calculo_carga_fuego_sector_materiales;
CREATE POLICY "ccf_sector_materiales: delete" ON public.calculo_carga_fuego_sector_materiales FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego_sectores s
    JOIN public.calculo_carga_fuego c ON c.id = s.calculo_id
    WHERE s.id = sector_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

COMMENT ON TABLE public.calculo_carga_fuego_sectores IS
  'Sectores de incendio de un cálculo de carga de fuego (multi-sector). Cada sector tiene su propio inventario de materiales, Qf y resultado. RLS deriva del establecimiento de la cabecera.';
COMMENT ON TABLE public.calculo_carga_fuego_sector_materiales IS
  'Materiales de un sector de incendio (nuevo modelo multi-sector). RLS derivado en 2 niveles: sector_materiales → sectores → cabecera → establecimiento_id.';

COMMIT;
