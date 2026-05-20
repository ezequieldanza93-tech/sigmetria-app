-- ============================================================
-- Sigmetría HyS — Add mostrar_lt column to gestiones_establecimientos
--
-- Controla qué gestiones aparecen en el Legajo Técnico del
-- establecimiento (Sección "Gestiones de Agenda").
-- Se agregó originalmente via Supabase dashboard sin migración.
-- ============================================================

ALTER TABLE public.gestiones_establecimientos
  ADD COLUMN IF NOT EXISTS mostrar_lt boolean NOT NULL DEFAULT false;
