-- ============================================================
-- Sigmetría HyS — Session-level caching para RLS functions
-- Issue #4: is_developer() pega a profiles en cada fila
--
-- Problema:
--   is_developer() → is_super_admin() → SELECT 1 FROM profiles
--   Cada fila evaluada por RLS ejecuta este query.
--   A 10k usuarios × N tablas × M filas, es N*M viajes a profiles.
--
-- Solución:
--   1. cache_user_permissions() se llama al login
--   2. Setea current_setting('app.is_super_admin')
--   3. is_super_admin() usa el cache en lugar de consultar profiles
--   4. Fallback automático si no hay cache (migraciones, etc.)
--
-- Uso desde la app (edge function / auth hook):
--   SELECT public.cache_user_permissions();
--
-- ROLLBACK:
--   git checkout HEAD~1 -- supabase/migrations/[nombre].sql
--   Luego recrear is_super_admin() desde 20260524000004
-- ============================================================

-- ============================================================
-- 1. Función de cache: llama al login
-- ============================================================
CREATE OR REPLACE FUNCTION public.cache_user_permissions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin boolean;
BEGIN
  SELECT is_super_admin INTO v_is_super_admin
  FROM public.profiles
  WHERE id = (SELECT auth.uid());

  PERFORM set_config('app.is_super_admin', COALESCE(v_is_super_admin, false)::text, false);
END;
$$;


-- ============================================================
-- 2. is_super_admin() cache-aware
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_cached text;
BEGIN
  -- Fast path: session variable seteada al login
  v_cached := current_setting('app.is_super_admin', true);

  IF v_cached IS NOT NULL THEN
    RETURN v_cached::boolean;
  END IF;

  -- Fallback: consulta directa (migraciones, auth hooks sin cache)
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND is_super_admin = true
  );
END;
$$;


-- ============================================================
-- 3. Recrear is_developer() → is_super_admin() (misma semántica)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.is_super_admin()
$$;


-- ============================================================
-- 4. Trigger per-login: cachea permisos al autenticar
-- ============================================================
-- Se ejecuta en cada auth.users login, cachea is_super_admin
-- en la session variable ANTES de que cualquier RLS query se ejecute.
CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.cache_user_permissions();
  RETURN NEW;
END;
$$;

-- NOTA IMPORTANTE: Supabase no soporta triggers AFTER LOGIN en auth.users.
-- La app DEBE llamar cache_user_permissions() al iniciar sesión:
--   await supabase.rpc('cache_user_permissions')
--
-- Como alternativa, se puede integrar en un Auth Hook (edge function)
-- o en el middleware de la aplicación.
