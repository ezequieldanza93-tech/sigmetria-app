-- ============================================================
-- Sigmetria App — Agregar dueño a instrumentos de medición
-- ============================================================

ALTER TABLE public.mediciones_instrumentos
  ADD COLUMN dueño_id uuid REFERENCES public.personas_directorio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mediciones_instrumentos_dueño
  ON public.mediciones_instrumentos(dueño_id);
