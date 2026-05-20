-- ============================================================
-- Sigmetría HyS — Partition gestiones_registros by fecha_planificada
-- Issue #3: tabla operativa de mayor crecimiento (~10M filas/año)
--
-- Estrategia:
--   1. Desconectar FK desde gestiones_observaciones
--   2. Agregar columna compuesta a gestiones_observaciones
--   3. Agregar FK compuesta (registro_gestion_id + rg_fecha_planificada)
--   4. Crear nueva tabla particionada + particiones anuales
--   5. Migrar datos
--   6. Recrear FKs, índices, RLS, triggers
--   7. Eliminar tabla vieja
--
-- PARTITION KEY: RANGE (fecha_planificada) anual
-- PK: (id, fecha_planificada)
--
-- ROLLBACK (antes de drop de vieja):
--   DROP TABLE IF EXISTS gestiones_registros;
--   ALTER TABLE gestiones_registros_old RENAME TO gestiones_registros;
--   (reversión manual de FKs, índices, policies)
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Preparar gestiones_observaciones
-- ============================================================
-- 1a. Agregar columna para la FK compuesta
ALTER TABLE public.gestiones_observaciones
  ADD COLUMN IF NOT EXISTS rg_fecha_planificada date;

-- 1b. Backfill desde gestiones_registros
UPDATE public.gestiones_observaciones go
SET rg_fecha_planificada = gr.fecha_planificada
FROM public.gestiones_registros gr
WHERE go.registro_gestion_id = gr.id;

-- 1c. NOT NULL tras backfill
ALTER TABLE public.gestiones_observaciones
  ALTER COLUMN rg_fecha_planificada SET NOT NULL;

-- 1d. Drop FK pointing to gestiones_registros
ALTER TABLE public.gestiones_observaciones
  DROP CONSTRAINT IF EXISTS observaciones_gestiones_registro_gestion_id_fkey;

ALTER TABLE public.gestiones_observaciones
  DROP CONSTRAINT IF EXISTS gestiones_observaciones_registro_gestion_id_fkey;


-- ============================================================
-- STEP 2: Renombrar tabla actual + limpiar constraints
-- ============================================================
-- Drop constraints de gestiones_registros
ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS registro_gestiones_pkey;

ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS gestiones_registros_pkey;

ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS chk_rg_index_positive;

ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS registro_gestiones_responsable_id_fkey;

ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS gestiones_registros_responsable_id_fkey;

ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS registro_gestiones_gestion_establecimiento_id_fkey;

ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS gestiones_registros_gestion_establecimiento_id_fkey;

-- Drop constraint ON DELETE SET NULL (aprobado_por_id) if exist
ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS registro_gestiones_aprobado_por_id_fkey;

ALTER TABLE public.gestiones_registros
  DROP CONSTRAINT IF EXISTS gestiones_registros_aprobado_por_id_fkey;

-- Rename old table
ALTER TABLE public.gestiones_registros RENAME TO gestiones_registros_old;


-- ============================================================
-- STEP 3: Crear nueva tabla particionada
-- ============================================================
CREATE TABLE public.gestiones_registros (
  id                        uuid NOT NULL DEFAULT gen_random_uuid(),
  gestion_establecimiento_id uuid NOT NULL,
  index                     int4 NOT NULL DEFAULT 0,
  fecha_planificada         date NOT NULL,
  fecha_ejecutada           date,
  responsable_id            uuid,
  evidencia_url             text,
  notas                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  aprobado_por_id           uuid,
  observaciones             text,
  PRIMARY KEY (id, fecha_planificada)
) PARTITION BY RANGE (fecha_planificada);


-- ============================================================
-- STEP 4: Crear particiones anuales (2024-2031 + default)
-- ============================================================
CREATE TABLE public.gestiones_registros_2024
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE public.gestiones_registros_2025
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE public.gestiones_registros_2026
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE public.gestiones_registros_2027
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE TABLE public.gestiones_registros_2028
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');

CREATE TABLE public.gestiones_registros_2029
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2029-01-01') TO ('2030-01-01');

CREATE TABLE public.gestiones_registros_2030
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2030-01-01') TO ('2031-01-01');

CREATE TABLE public.gestiones_registros_2031
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2031-01-01') TO ('2032-01-01');

-- Default partition (catch-all for future years)
CREATE TABLE public.gestiones_registros_future
  PARTITION OF public.gestiones_registros
  FOR VALUES FROM ('2032-01-01') TO ('MAXVALUE');


-- ============================================================
-- STEP 5: Migrar datos
-- ============================================================
INSERT INTO public.gestiones_registros (
  id, gestion_establecimiento_id, index, fecha_planificada,
  fecha_ejecutada, responsable_id, evidencia_url, notas,
  created_at, updated_at, aprobado_por_id, observaciones
)
SELECT
  id, gestion_establecimiento_id, index, fecha_planificada,
  fecha_ejecutada, responsable_id, evidencia_url, notas,
  created_at, updated_at, aprobado_por_id, observaciones
FROM public.gestiones_registros_old;


-- ============================================================
-- STEP 6: Recrear FKs desde gestiones_registros
-- ============================================================
ALTER TABLE public.gestiones_registros
  ADD CONSTRAINT gestiones_registros_gestion_establecimiento_id_fkey
  FOREIGN KEY (gestion_establecimiento_id)
  REFERENCES public.gestiones_establecimientos(id) ON DELETE CASCADE;

ALTER TABLE public.gestiones_registros
  ADD CONSTRAINT gestiones_registros_responsable_id_fkey
  FOREIGN KEY (responsable_id)
  REFERENCES public.directorio_personas(id) ON DELETE SET NULL;

ALTER TABLE public.gestiones_registros
  ADD CONSTRAINT gestiones_registros_aprobado_por_id_fkey
  FOREIGN KEY (aprobado_por_id)
  REFERENCES public.directorio_personas(id) ON DELETE SET NULL;


-- ============================================================
-- STEP 7: Recrear FK compuesta DESDE gestiones_observaciones
-- ============================================================
ALTER TABLE public.gestiones_observaciones
  ADD CONSTRAINT gestiones_observaciones_registro_gestion_id_fkey
  FOREIGN KEY (registro_gestion_id, rg_fecha_planificada)
  REFERENCES public.gestiones_registros(id, fecha_planificada)
  ON DELETE CASCADE;


-- ============================================================
-- STEP 8: Recrear índices (por partición)
-- ============================================================
-- Los índices se crean por partición para evitar locks largos
-- en la tabla padre. PG los propaga si se crean con ON ONLY.
-- Aquí los creamos directamente en cada partición.

DO $$
DECLARE
  partitions text[] := ARRAY[
    'gestiones_registros_2024', 'gestiones_registros_2025',
    'gestiones_registros_2026', 'gestiones_registros_2027',
    'gestiones_registros_2028', 'gestiones_registros_2029',
    'gestiones_registros_2030', 'gestiones_registros_2031',
    'gestiones_registros_future'
  ];
  p text;
BEGIN
  FOREACH p IN ARRAY partitions LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (gestion_establecimiento_id, fecha_planificada DESC)',
      p || '_gestion_estab_fecha', p
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (fecha_planificada)',
      p || '_fecha_planificada', p
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (fecha_ejecutada) WHERE fecha_ejecutada IS NOT NULL',
      p || '_fecha_ejecutada', p
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (responsable_id) WHERE responsable_id IS NOT NULL',
      p || '_responsable_id', p
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (aprobado_por_id) WHERE aprobado_por_id IS NOT NULL',
      p || '_aprobado_por_id', p
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I USING brin (created_at) WITH (pages_per_range = 32)',
      p || '_created_brin', p
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (gestion_establecimiento_id, fecha_planificada) WHERE fecha_ejecutada IS NULL',
      p || '_pendientes_estab_fecha', p
    );
  END LOOP;
END;
$$;


-- ============================================================
-- STEP 9: Recrear RLS policies
-- ============================================================
-- Las policies existentes referenciaban registro_gestiones.
-- Las recreamos apuntando a gestiones_registros.

ALTER TABLE public.gestiones_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gestiones_registros: select" ON public.gestiones_registros;
DROP POLICY IF EXISTS "gestiones_registros: insert" ON public.gestiones_registros;
DROP POLICY IF EXISTS "gestiones_registros: update" ON public.gestiones_registros;
DROP POLICY IF EXISTS "gestiones_registros: delete" ON public.gestiones_registros;

-- Recrear desde nombre original (renombradas en 20260522000001)
DROP POLICY IF EXISTS "registro_gestiones: select" ON public.gestiones_registros;
DROP POLICY IF EXISTS "registro_gestiones: insert" ON public.gestiones_registros;
DROP POLICY IF EXISTS "registro_gestiones: update" ON public.gestiones_registros;
DROP POLICY IF EXISTS "registro_gestiones: delete" ON public.gestiones_registros;

CREATE POLICY "gestiones_registros: select"
  ON public.gestiones_registros FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_establecimientos ge
      WHERE ge.id = gestiones_registros.gestion_establecimiento_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "gestiones_registros: insert"
  ON public.gestiones_registros FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gestiones_establecimientos ge
      WHERE ge.id = gestion_establecimiento_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "gestiones_registros: update"
  ON public.gestiones_registros FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_establecimientos ge
      WHERE ge.id = gestiones_registros.gestion_establecimiento_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "gestiones_registros: delete"
  ON public.gestiones_registros FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_establecimientos ge
      WHERE ge.id = gestiones_registros.gestion_establecimiento_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );


-- ============================================================
-- STEP 10: Recrear triggers
-- ============================================================
-- 10a. updated_at en gestiones_registros
DROP TRIGGER IF EXISTS set_updated_at ON public.gestiones_registros;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.gestiones_registros
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 10b. Auto-completar rg_fecha_planificada en gestiones_observaciones
-- Para que INSERTs de la app sigan funcionando sin cambios
CREATE OR REPLACE FUNCTION public.fill_rg_fecha_planificada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT fecha_planificada INTO NEW.rg_fecha_planificada
  FROM public.gestiones_registros
  WHERE id = NEW.registro_gestion_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_rg_fecha_planificada ON public.gestiones_observaciones;

CREATE TRIGGER trg_fill_rg_fecha_planificada
  BEFORE INSERT ON public.gestiones_observaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.fill_rg_fecha_planificada();


-- ============================================================
-- STEP 11: Recrear RLS policies para gestiones_observaciones
-- (necesitan la FK compuesta para la resolución)
-- ============================================================
-- Las policies existentes usan JOIN a gestiones_registros.
-- El nombre en las policies cambió con el rename.
-- Las mantenemos con su lógica actual (SELECT/INSERT/UPDATE/DELETE).

DROP POLICY IF EXISTS "gestiones_observaciones: select" ON public.gestiones_observaciones;
DROP POLICY IF EXISTS "gestiones_observaciones: insert" ON public.gestiones_observaciones;
DROP POLICY IF EXISTS "gestiones_observaciones: update" ON public.gestiones_observaciones;
DROP POLICY IF EXISTS "gestiones_observaciones: delete" ON public.gestiones_observaciones;

DROP POLICY IF EXISTS "observaciones_gestiones: select" ON public.gestiones_observaciones;
DROP POLICY IF EXISTS "observaciones_gestiones: insert" ON public.gestiones_observaciones;
DROP POLICY IF EXISTS "observaciones_gestiones: update" ON public.gestiones_observaciones;
DROP POLICY IF EXISTS "observaciones_gestiones: delete" ON public.gestiones_observaciones;

CREATE POLICY "gestiones_observaciones: select"
  ON public.gestiones_observaciones FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_registros gr
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE gr.id = gestiones_observaciones.registro_gestion_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "gestiones_observaciones: insert"
  ON public.gestiones_observaciones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.gestiones_registros gr
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE gr.id = registro_gestion_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "gestiones_observaciones: update"
  ON public.gestiones_observaciones FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_registros gr
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE gr.id = gestiones_observaciones.registro_gestion_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );

CREATE POLICY "gestiones_observaciones: delete"
  ON public.gestiones_observaciones FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_registros gr
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE gr.id = gestiones_observaciones.registro_gestion_id
        AND has_establecimiento_write_access(ge.establecimiento_id)
    )
  );


-- ============================================================
-- STEP 12: Eliminar tabla vieja
-- ============================================================
DROP TABLE IF EXISTS public.gestiones_registros_old;

COMMIT;
