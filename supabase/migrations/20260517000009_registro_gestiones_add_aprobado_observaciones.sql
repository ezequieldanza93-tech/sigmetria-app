-- ============================================================
-- registro_gestiones: add aprobado_por_id + observaciones
-- Aligns with Airtable Procedures_Project_Log input columns
-- ============================================================

ALTER TABLE public.registro_gestiones
  ADD COLUMN aprobado_por_id uuid REFERENCES public.directorio_personas(id) ON DELETE SET NULL,
  ADD COLUMN observaciones    text;
