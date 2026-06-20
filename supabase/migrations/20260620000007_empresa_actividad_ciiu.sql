-- Fase 1 "CIIU manda": la empresa pasa a tener su actividad económica del catálogo
-- CIIU unificado (actividades_economicas), igual que el establecimiento. El viejo
-- `rubro_id` (catálogo empresas_rubros) queda como legacy: no se borra, pero el alta
-- nueva usa actividad_id. Empresa y establecimiento comparten el mismo catálogo CIIU,
-- cada uno con su valor (pueden diferir).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS actividad_id uuid
  REFERENCES public.actividades_economicas(id) ON DELETE SET NULL;
