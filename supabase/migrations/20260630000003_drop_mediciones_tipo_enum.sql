-- ============================================================
-- 3FN Fix V3: mediciones — eliminar fuentes de verdad duplicadas
--
-- Problema A: mediciones.tipo (enum medicion_tipo) coexiste con
-- mediciones.tipo_id (FK→mediciones_tipos). El enum fue marcado
-- deprecated en 20260525000007. Dos columnas para lo mismo.
--
-- Problema B: mediciones.sector text no tiene FK a
-- establecimientos_sectores. Se agrega sector_id FK nullable
-- (los datos legacy no matchean garantizado).
-- ============================================================

-- ── PARTE A: Eliminar tipo enum (deprecated) ─────────────────

ALTER TABLE public.mediciones DROP COLUMN IF EXISTS tipo;

-- Eliminar el tipo enum solo si nada más lo referencia
DO $$
BEGIN
  DROP TYPE IF EXISTS public.medicion_tipo;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'medicion_tipo enum aún tiene dependencias — no se eliminó. Revisar.';
END;
$$;

-- ── PARTE B: sector text → sector_id FK ──────────────────────

-- Agregar FK nullable (legacy data puede no tener match exacto)
ALTER TABLE public.mediciones
  ADD COLUMN IF NOT EXISTS sector_id uuid
    REFERENCES public.establecimientos_sectores(id) ON DELETE SET NULL;

-- Backfill por nombre dentro del mismo establecimiento (solo si sector text aún existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mediciones' AND column_name = 'sector'
  ) THEN
    UPDATE public.mediciones m
    SET sector_id = es.id
    FROM public.establecimientos_sectores es
    WHERE lower(trim(m.sector)) = lower(trim(es.nombre))
      AND es.establecimiento_id = m.establecimiento_id
      AND m.sector IS NOT NULL
      AND m.sector_id IS NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_mediciones_sector_id
  ON public.mediciones(sector_id)
  WHERE sector_id IS NOT NULL;

-- Eliminar columna sector text (IF EXISTS por si fue dropeada en 20260518000003)
ALTER TABLE public.mediciones DROP COLUMN IF EXISTS sector;
