-- ============================================================
-- Sigmetría — Junction table empleado_sector
-- Reemplaza establecimiento_id en empleados (Opción A / 3FN)
-- ============================================================

-- 1. Tabla de unión
CREATE TABLE public.empleado_sector (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  sector_id   uuid NOT NULL REFERENCES public.sectores_establecimiento(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empleado_id, sector_id)
);

ALTER TABLE public.empleado_sector ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empleado_sector: select" ON public.empleado_sector FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_sector: insert" ON public.empleado_sector FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_sector: update" ON public.empleado_sector FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_sector: delete" ON public.empleado_sector FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sectores_establecimiento se
      WHERE se.id = sector_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

-- 2. Eliminar RLS policies viejas que dependen de establecimiento_id
DROP POLICY IF EXISTS "empleados: select" ON public.empleados;
DROP POLICY IF EXISTS "empleados: insert" ON public.empleados;
DROP POLICY IF EXISTS "empleados: update" ON public.empleados;
DROP POLICY IF EXISTS "empleados: delete" ON public.empleados;

-- 3. Eliminar establecimiento_id de empleados
ALTER TABLE public.empleados DROP COLUMN establecimiento_id;

-- 4. Nuevas RLS para empleados — acceso derivado via junction table
CREATE POLICY "empleados: select" ON public.empleados FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_sector es
      JOIN public.sectores_establecimiento se ON se.id = es.sector_id
      WHERE es.empleado_id = empleados.id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleados: insert" ON public.empleados FOR INSERT
  WITH CHECK (true);

CREATE POLICY "empleados: update" ON public.empleados FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_sector es
      JOIN public.sectores_establecimiento se ON se.id = es.sector_id
      WHERE es.empleado_id = empleados.id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleados: delete" ON public.empleados FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_sector es
      JOIN public.sectores_establecimiento se ON se.id = es.sector_id
      WHERE es.empleado_id = empleados.id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );
