-- ============================================================
-- Sigmetría HyS — CHECK constraint en registro_gestiones.index
--
-- index es numeric usado para ordenar items dentro de un
-- grupo gestion_establecimiento. Sin constraint permite
-- valores negativos y duplicados que desordenan la UI.
-- ============================================================

-- Corrige valores existentes si los hubiera
UPDATE public.registro_gestiones
SET index = 0
WHERE index IS NULL OR index < 0;

-- NOT NULL + CHECK > 0 (0 es el primer item, no necesariamente el 0,
-- pero usamos >= 0 par ano romper data existente)
ALTER TABLE public.registro_gestiones
  ALTER COLUMN index SET NOT NULL;

ALTER TABLE public.registro_gestiones
  DROP CONSTRAINT IF EXISTS chk_rg_index_positive;

ALTER TABLE public.registro_gestiones
  ADD CONSTRAINT chk_rg_index_positive
  CHECK (index >= 0);
