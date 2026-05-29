-- Función helper para verificar si el usuario actual requiere MFA.
-- Usada por middleware (via DB query) y por la página de seguridad.
-- Roles obligatorios: full_access_main, responsable_estandares (Art. 4.5 Res. SRT 48/2025)

CREATE OR REPLACE FUNCTION public.requires_mfa()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT role IN ('full_access_main', 'responsable_estandares')
  FROM public.consultoras_members
  WHERE user_id = (SELECT auth.uid())
    AND is_active = true
  LIMIT 1
$$;
