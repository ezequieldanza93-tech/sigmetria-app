-- Función helper para verificar si el usuario actual requiere MFA.
-- Control A2, Res. SRT 48/2025 — Roles obligatorios: full_access_main, responsable_estandares
--
-- SETUP MANUAL REQUERIDO: Supabase Dashboard → Authentication → MFA → Enable TOTP

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

REVOKE ALL ON FUNCTION public.requires_mfa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requires_mfa() TO authenticated;
