-- ============================================================
-- Estándar 5 — permisos del rol `auditor_externo` (organismo de control).
--
-- Lectura: MISMO alcance consultora-wide que full_viewer / responsable_estandares.
-- Escritura: NINGUNA. A propósito NO se lo agrega a has_empresa_write_access ni a
-- has_establecimiento_write_access (siguen siendo full_access_main/branch + colaborador
-- vía user_access) → el auditor queda bloqueado para INSERT/UPDATE/DELETE en empresas,
-- establecimientos, gestiones, observaciones, etc. (bloqueo por construcción).
-- Su acceso a la cadena de custodia (audit_log/audit_chain_state) ya está contemplado en
-- las policies de esas tablas.
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
          'responsable_estandares',
          'auditor_externo'
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
          'responsable_estandares',
          'auditor_externo'
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
