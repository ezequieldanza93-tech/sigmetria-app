-- Art. 5 Res. SRT 48/2025 — Responsable de Estándares
--
-- Agrega el nuevo rol al enum user_role y actualiza las helper functions
-- de RLS para otorgarle los mismos permisos de lectura que full_viewer,
-- más acceso al audit_log completo de su consultora.
--
-- NOTA: ALTER TYPE ... ADD VALUE IF NOT EXISTS no puede correr dentro de
-- una transacción en PG <14. En Supabase (PG 15+) sí es válido.

-- ============================================================
-- 1. Nuevo valor del enum
-- ============================================================
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'responsable_estandares';

-- Necesario para que el valor esté disponible en las funciones siguientes
-- dentro de la misma sesión de migración.
-- (En PG 15 el valor es visible de inmediato tras el COMMIT implícito del ADD VALUE)

-- ============================================================
-- 2. Actualizar has_empresa_read_access
--    Agrega 'responsable_estandares' junto a 'full_viewer'
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_empresa_read_access(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      -- Roles con acceso a todas las empresas de su consultora
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      WHERE cm.user_id  = (SELECT auth.uid())
        AND cm.is_active = true
        AND e.id = p_empresa_id
        AND cm.role IN (
          'full_access_main',
          'full_access_branch',
          'full_viewer',
          'responsable_estandares'
        )
    )
    OR EXISTS (
      -- Colaboradores: solo las explícitamente asignadas
      SELECT 1 FROM public.user_access ua
      WHERE ua.user_id   = (SELECT auth.uid())
        AND ua.empresa_id = p_empresa_id
        AND ua.is_active  = true
    )
$$;

-- ============================================================
-- 3. Actualizar has_establecimiento_read_access
--    Ídem: agrega 'responsable_estandares'
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_establecimiento_read_access(p_establecimiento_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      -- Roles con acceso a todos los establecimientos de su consultora
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      JOIN public.establecimientos est ON est.empresa_id = e.id
      WHERE cm.user_id  = (SELECT auth.uid())
        AND cm.is_active = true
        AND est.id = p_establecimiento_id
        AND cm.role IN (
          'full_access_main',
          'full_access_branch',
          'full_viewer',
          'responsable_estandares'
        )
    )
    OR EXISTS (
      -- Acceso a empresa entera → ve todos sus establecimientos
      SELECT 1
      FROM public.user_access ua
      JOIN public.establecimientos est ON est.empresa_id = ua.empresa_id
      WHERE ua.user_id           = (SELECT auth.uid())
        AND ua.is_active          = true
        AND ua.establecimiento_id IS NULL
        AND est.id = p_establecimiento_id
    )
    OR EXISTS (
      -- Acceso explícito al establecimiento puntual
      SELECT 1 FROM public.user_access ua
      WHERE ua.user_id              = (SELECT auth.uid())
        AND ua.establecimiento_id   = p_establecimiento_id
        AND ua.is_active            = true
    )
$$;

-- ============================================================
-- 4. Actualizar policy SELECT de audit_log
--    Agrega 'responsable_estandares' a la lista de roles que pueden
--    ver todo el audit_log de su consultora (no solo sus propias acciones)
-- ============================================================
DROP POLICY IF EXISTS "audit_log: select" ON public.audit_log;

CREATE POLICY "audit_log: select"
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    public.is_developer()
    OR user_id = (SELECT auth.uid())
    OR (
      user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.consultoras_members cm1
        JOIN public.consultoras_members cm2
          ON cm2.consultora_id = cm1.consultora_id
        WHERE cm1.user_id   = (SELECT auth.uid())
          AND cm1.is_active  = true
          AND cm1.role IN (
            'full_access_main',
            'full_access_branch',
            'responsable_estandares'
          )
          AND cm2.user_id   = audit_log.user_id
          AND cm2.is_active  = true
      )
    )
  );

-- ============================================================
-- 5. Policy SELECT de user_access para responsable_estandares
--    Puede ver los grants de acceso de su consultora (lectura)
--    Si ya existe una policy "user_access: select admin", la reemplazamos.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'user_access'
      AND policyname = 'user_access: select admin'
  ) THEN
    DROP POLICY "user_access: select admin" ON public.user_access;
  END IF;
END$$;

CREATE POLICY "user_access: select admin"
  ON public.user_access FOR SELECT TO authenticated
  USING (
    public.is_developer()
    OR (
      user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      WHERE cm.user_id   = (SELECT auth.uid())
        AND cm.is_active  = true
        AND cm.role IN (
          'full_access_main',
          'responsable_estandares'
        )
        AND cm.consultora_id = (
          SELECT consultora_id FROM public.consultoras_members
          WHERE user_id = user_access.user_id
            AND is_active = true
          LIMIT 1
        )
    )
  );
