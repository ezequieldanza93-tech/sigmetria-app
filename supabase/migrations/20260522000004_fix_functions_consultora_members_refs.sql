-- ============================================================
-- Fix stored functions still referencing old table name
-- `consultora_members` → `consultoras_members`
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_consultora_role(p_consultora_id uuid)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.consultoras_members
  WHERE user_id = (SELECT auth.uid())
    AND consultora_id = p_consultora_id
    AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_empresa_admin_access(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND e.id = p_empresa_id
        AND cm.role IN ('full_access_main','full_access_branch')
    )
$$;

CREATE OR REPLACE FUNCTION public.has_empresa_read_access(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND e.id = p_empresa_id
        AND cm.role IN ('full_access_main','full_access_branch','full_viewer')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_access ua
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.empresa_id = p_empresa_id
        AND ua.is_active = true
    )
$$;

CREATE OR REPLACE FUNCTION public.has_empresa_write_access(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND e.id = p_empresa_id
        AND cm.role IN ('full_access_main','full_access_branch')
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN public.consultoras_members cm
        ON cm.user_id = ua.user_id
       AND cm.consultora_id = ua.consultora_id
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.empresa_id = p_empresa_id
        AND ua.is_active = true
        AND cm.role = 'colaborador'
    )
$$;

CREATE OR REPLACE FUNCTION public.has_establecimiento_admin_access(p_establecimiento_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      JOIN public.establecimientos est ON est.empresa_id = e.id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND est.id = p_establecimiento_id
        AND cm.role IN ('full_access_main','full_access_branch')
    )
$$;

CREATE OR REPLACE FUNCTION public.has_establecimiento_read_access(p_establecimiento_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      JOIN public.establecimientos est ON est.empresa_id = e.id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND est.id = p_establecimiento_id
        AND cm.role IN ('full_access_main','full_access_branch','full_viewer')
    )
    OR EXISTS (
      -- Acceso a empresa entera → puede ver todos sus establecimientos
      SELECT 1
      FROM public.user_access ua
      JOIN public.establecimientos est ON est.empresa_id = ua.empresa_id
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.is_active = true
        AND ua.establecimiento_id IS NULL
        AND est.id = p_establecimiento_id
    )
    OR EXISTS (
      -- Acceso explícito al establecimiento puntual
      SELECT 1 FROM public.user_access ua
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.establecimiento_id = p_establecimiento_id
        AND ua.is_active = true
    )
$$;

CREATE OR REPLACE FUNCTION public.has_establecimiento_write_access(p_establecimiento_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.empresas e ON e.consultora_id = cm.consultora_id
      JOIN public.establecimientos est ON est.empresa_id = e.id
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND est.id = p_establecimiento_id
        AND cm.role IN ('full_access_main','full_access_branch')
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN public.establecimientos est ON est.empresa_id = ua.empresa_id
      JOIN public.consultoras_members cm
        ON cm.user_id = ua.user_id
       AND cm.consultora_id = ua.consultora_id
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.is_active = true
        AND ua.establecimiento_id IS NULL
        AND est.id = p_establecimiento_id
        AND cm.role = 'colaborador'
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN public.consultoras_members cm
        ON cm.user_id = ua.user_id
       AND cm.consultora_id = ua.consultora_id
      WHERE ua.user_id = (SELECT auth.uid())
        AND ua.establecimiento_id = p_establecimiento_id
        AND ua.is_active = true
        AND cm.role = 'colaborador'
    )
$$;
