-- Función temporal de introspección (solo service_role) para ver las policies RLS
-- REALES de una tabla en producción y diagnosticar drift. Se elimina luego.
CREATE OR REPLACE FUNCTION public._debug_table_policies(p_table text)
RETURNS TABLE(policyname text, cmd text, permissive text, roles text, qual text, with_check text)
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT policyname::text, cmd::text, permissive::text,
         array_to_string(roles, ',')::text, qual::text, with_check::text
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = p_table
$$;
REVOKE ALL ON FUNCTION public._debug_table_policies(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._debug_table_policies(text) TO service_role;
