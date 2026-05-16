-- ============================================================
-- Sigmetría — Puestos de trabajo
-- Reemplaza empleado_sector. Jerarquía:
-- empresa → establecimiento → sector → puesto → empleado
-- ============================================================

-- 1. Eliminar junction anterior (empleado_sector)
DROP POLICY IF EXISTS "empleados: select" ON public.empleados;
DROP POLICY IF EXISTS "empleados: insert" ON public.empleados;
DROP POLICY IF EXISTS "empleados: update" ON public.empleados;
DROP POLICY IF EXISTS "empleados: delete" ON public.empleados;
DROP TABLE public.empleado_sector;

-- 2. Eliminar cargo de empleados (reemplazado por puesto_de_trabajo)
ALTER TABLE public.empleados DROP COLUMN cargo;

-- 3. Puestos de trabajo — pertenecen a un sector
CREATE TABLE public.puestos_de_trabajo (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id  uuid NOT NULL REFERENCES public.sectores_establecimiento(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.puestos_de_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "puestos: select" ON public.puestos_de_trabajo FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

CREATE POLICY "puestos: insert" ON public.puestos_de_trabajo FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "puestos: update" ON public.puestos_de_trabajo FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "puestos: delete" ON public.puestos_de_trabajo FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

-- 4. Junction empleado_puesto
CREATE TABLE public.empleado_puesto (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  puesto_id   uuid NOT NULL REFERENCES public.puestos_de_trabajo(id) ON DELETE CASCADE,
  fecha_desde date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empleado_id, puesto_id)
);

ALTER TABLE public.empleado_puesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empleado_puesto: select" ON public.empleado_puesto FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_puesto: insert" ON public.empleado_puesto FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_puesto: update" ON public.empleado_puesto FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_puesto: delete" ON public.empleado_puesto FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.puestos_de_trabajo pt
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE pt.id = puesto_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

-- 5. Actualizar RLS de empleados para usar la nueva jerarquía
DROP POLICY IF EXISTS "empleados: select" ON public.empleados;
DROP POLICY IF EXISTS "empleados: insert" ON public.empleados;
DROP POLICY IF EXISTS "empleados: update" ON public.empleados;
DROP POLICY IF EXISTS "empleados: delete" ON public.empleados;

CREATE POLICY "empleados: select" ON public.empleados FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.empleado_id = empleados.id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleados: insert" ON public.empleados FOR INSERT
  WITH CHECK (true);

CREATE POLICY "empleados: update" ON public.empleados FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.empleado_id = empleados.id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleados: delete" ON public.empleados FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.empleado_id = empleados.id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );
