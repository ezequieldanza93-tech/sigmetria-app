-- Fix 02 (ex docs/migraciones-preparadas/02, Opción B) — Revocar sesiones de un usuario.
-- Se invoca desde lib/actions/email-change.ts tras cambiar el email: las sesiones
-- viejas dejan de servir y el usuario debe re-loguearse con el email nuevo.
-- Solo service_role puede ejecutarlo (un usuario no debe poder desloguear a otro).
CREATE OR REPLACE FUNCTION public.revocar_sesiones_usuario(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.revocar_sesiones_usuario(uuid) FROM public;
REVOKE ALL ON FUNCTION public.revocar_sesiones_usuario(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.revocar_sesiones_usuario(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.revocar_sesiones_usuario(uuid) TO service_role;
