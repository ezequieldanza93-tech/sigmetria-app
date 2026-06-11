-- Fix 01 (ex docs/migraciones-preparadas/01) — INSERT estricto de personas_directorio.
-- El colaborador solo puede insertar personas si tiene AL MENOS un user_access activo
-- en su consultora (evita que un colaborador sin scope siembre el directorio).
-- Admins (main/branch) y developer siguen sin restricción. Aislamiento entre
-- consultoras intacto (personas_directorio ya está gateado por membresía).
DROP POLICY IF EXISTS "personas_directorio: insert" ON public.personas_directorio;

CREATE POLICY "personas_directorio: insert" ON public.personas_directorio
  FOR INSERT TO authenticated
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id   = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.user_access ua
        ON ua.user_id = cm.user_id
       AND ua.consultora_id = cm.consultora_id
      WHERE cm.user_id   = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role      = 'colaborador'
        AND ua.is_active = true
    )
  );
