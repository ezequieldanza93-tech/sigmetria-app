-- Temporal: lista TODAS las policies (permissive + restrictive) de una tabla.
CREATE OR REPLACE FUNCTION public._debug_policies2(p_table text)
RETURNS SETOF pg_policies
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table
$$;
GRANT EXECUTE ON FUNCTION public._debug_policies2(text) TO authenticated, service_role;
