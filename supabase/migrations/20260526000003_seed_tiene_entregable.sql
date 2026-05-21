-- ============================================================
-- Sigmetría HyS — Seed: marca tiene_entregable = true
--
-- Las gestiones que producen un entregable con vencimiento:
--   - Mediciones y Cálculos (todos)
--   - Permisos de Trabajo
-- ============================================================

UPDATE public.gestiones
SET tiene_entregable = true
WHERE categoria_id IN (
  SELECT id FROM public.categoria_gestiones
  WHERE nombre IN ('Mediciones y Cálculos', 'Permisos de Trabajo')
);
