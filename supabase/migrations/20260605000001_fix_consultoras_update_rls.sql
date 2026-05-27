-- ============================================================
-- Fix consultoras: update RLS policy
--
-- Problema:
--   La policy original usa get_consultora_role(id) para el USING,
--   y como no tiene WITH CHECK explícito, PostgreSQL usa el mismo
--   USING como WITH CHECK evaluando contra la fila nueva.
--   En edge cases (función VOLATILE sin search_path fijo) el
--   WITH CHECK puede fallar causando:
--     "new row violates row-level security policy for table consultoras"
--
-- Solución:
--   1. Reemplazar get_consultora_role() por EXISTS directo (más robusto)
--   2. Agregar WITH CHECK explícito = USING para eliminar ambigüedad
--   3. Usar is_super_admin() en lugar de is_developer() (canónico actual)
-- ============================================================

DROP POLICY IF EXISTS "consultoras: update" ON public.consultoras;

CREATE POLICY "consultoras: update"
  ON public.consultoras FOR UPDATE
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.consultora_id = consultoras.id
        AND cm.role          = 'full_access_main'
        AND cm.is_active     = true
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id       = (SELECT auth.uid())
        AND cm.consultora_id = consultoras.id
        AND cm.role          = 'full_access_main'
        AND cm.is_active     = true
    )
  );
