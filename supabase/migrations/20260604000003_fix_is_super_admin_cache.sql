-- ============================================================
-- Fix is_super_admin(): no confiar en cache negativo
--
-- Problema: cache_user_permissions() se llama al login y cachea
-- app.is_super_admin. Si el perfil se actualiza DESPUÉS del login
-- (ej: se setea is_super_admin = true), el cache sigue diciendo
-- false y la función nunca consulta la DB.
--
-- Solución: solo usar el cache cuando dice true (fast path).
-- Si el cache dice false o no existe, verificar en DB directamente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_cached text;
BEGIN
  -- Fast path: cache positivo es confiable
  v_cached := current_setting('app.is_super_admin', true);
  IF v_cached = 'true' THEN
    RETURN true;
  END IF;

  -- Cache negativo o ausente: verificar en DB
  -- Permite que cambios en profiles.is_super_admin surtan efecto
  -- sin necesidad de reloguear
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND is_super_admin = true
  );
END;
$$;
