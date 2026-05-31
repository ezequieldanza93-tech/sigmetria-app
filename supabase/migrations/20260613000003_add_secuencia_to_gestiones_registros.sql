-- ============================================================
-- Sigmetría HyS — Agregar columna `secuencia` a gestiones_registros
--
-- Cada registro recibe un número incremental dentro de su grupo
-- (gestion_establecimiento_id, fecha_planificada). El primer
-- registro de cada grupo es 1, el segundo 2, etc.
--
-- Caso de uso: un establecimiento puede tener varias copias de
-- la misma gestión la misma fecha (ej. 2 amoladoras → 2
-- checklists el mismo día). El número permite diferenciarlas
-- visualmente en la UI.
--
-- - Trigger BEFORE INSERT setea automáticamente la secuencia
--   en cada inserción nueva.
-- - Backfill numera los registros existentes por created_at.
-- ============================================================

-- 1. Agregar la columna (NULL transitorio durante el backfill)
ALTER TABLE public.gestiones_registros
  ADD COLUMN IF NOT EXISTS secuencia integer;

-- 2. Backfill: ROW_NUMBER() particionado por (ge_id, fecha) ordenado por created_at
WITH numerados AS (
  SELECT
    id,
    fecha_planificada,
    ROW_NUMBER() OVER (
      PARTITION BY gestion_establecimiento_id, fecha_planificada
      ORDER BY created_at, id
    ) AS rn
  FROM public.gestiones_registros
)
UPDATE public.gestiones_registros gr
SET secuencia = n.rn
FROM numerados n
WHERE gr.id = n.id
  AND gr.fecha_planificada = n.fecha_planificada;

-- 3. Volver la columna NOT NULL con default 1 (todos los nuevos arrancan ahí; el trigger ajusta si hace falta)
ALTER TABLE public.gestiones_registros
  ALTER COLUMN secuencia SET NOT NULL,
  ALTER COLUMN secuencia SET DEFAULT 1;

-- 4. Función que calcula la próxima secuencia para (ge_id, fecha_planificada)
CREATE OR REPLACE FUNCTION public.set_registro_secuencia()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Solo setea automáticamente si el caller no especificó un valor
  IF NEW.secuencia IS NULL OR NEW.secuencia = 1 THEN
    NEW.secuencia := COALESCE(
      (
        SELECT MAX(secuencia) + 1
        FROM public.gestiones_registros
        WHERE gestion_establecimiento_id = NEW.gestion_establecimiento_id
          AND fecha_planificada = NEW.fecha_planificada
      ),
      1
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Trigger en cada partición — los triggers no se heredan en declarative partitioning,
--    pero Postgres 11+ permite crearlos en la tabla padre y se propagan.
DROP TRIGGER IF EXISTS trg_set_registro_secuencia ON public.gestiones_registros;
CREATE TRIGGER trg_set_registro_secuencia
  BEFORE INSERT ON public.gestiones_registros
  FOR EACH ROW
  EXECUTE FUNCTION public.set_registro_secuencia();

-- 6. Index para queries que ordenen por (ge_id, fecha, secuencia)
CREATE INDEX IF NOT EXISTS idx_gestiones_registros_secuencia
  ON public.gestiones_registros (gestion_establecimiento_id, fecha_planificada, secuencia);
