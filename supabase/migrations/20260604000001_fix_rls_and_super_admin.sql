-- ============================================================
-- Fix RLS INSERT policy for empresas + set super_admin for user
--
-- Problema:
--   1. La policy "empresas: insert" tiene un bug de resolución
--      de columnas: dentro del subquery EXISTS, `consultora_id`
--      sin calificar se resuelve como cm.consultora_id (la tabla
--      interna), no como empresas.consultora_id (la fila nueva).
--      Esto hace que la comparación sea cm.consultora_id = cm.consultora_id
--      (siempre true), ignorando la consultora destino.
--
--   2. El usuario real (ezequieldanza93@gmail.com) tiene
--      is_super_admin = false porque la migración original solo
--      marcó a dev@sigmetria.app. Necesita is_super_admin = true
--      para operar como owner del sistema.
-- ============================================================

-- Fix 1: Marcar al usuario como super_admin
UPDATE public.profiles
SET is_super_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'ezequieldanza93@gmail.com' LIMIT 1);

-- Fix 2: Recrear la INSERT policy con calificación explícita
DROP POLICY IF EXISTS "empresas: insert" ON public.empresas;

CREATE POLICY "empresas: insert"
  ON public.empresas FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id         = (SELECT auth.uid())
          AND cm.consultora_id   = empresas.consultora_id
          AND cm.is_active       = true
          AND cm.role IN ('full_access_main'::public.user_role, 'full_access_branch'::public.user_role)
      )
      AND public.has_active_subscription(empresas.consultora_id)
    )
  );
