-- SRT 48/2025 — Prompt 4 (accesos/QR): cierre de hueco cross-tenant en verificacion_tokens.
--
-- La policy UPDATE original (20260609000001) sólo exigía ser admin de ALGUNA consultora,
-- sin validar que el establecimiento del token fuera de SU consultora. Un full_access de la
-- consultora A podía invalidar (UPDATE / regenerar_token) el QR de un establecimiento de la
-- consultora B → ruptura de aislamiento entre tenants. Esta migración scopea el UPDATE y la
-- función al establecimiento dueño del token vía has_establecimiento_write_access().
--
-- El SELECT sigue siendo público a propósito (el QR /verificar/[token] se lee sin login y no
-- expone datos personales). El hueco era SOLO el UPDATE y regenerar_token (SECURITY DEFINER ciego).
--
-- Detalle completo + plan de testeo: docs/migraciones-preparadas/03_verificacion_tokens_update_scoped.sql
-- Rollback: recrear policy y función de 20260609000001_verificacion_tokens.sql.

BEGIN;

-- 1. UPDATE scopeado al establecimiento dueño del token.
DROP POLICY IF EXISTS "verificacion_tokens_update_full_access" ON public.verificacion_tokens;
CREATE POLICY "verificacion_tokens_update_full_access"
  ON public.verificacion_tokens FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

-- 2. regenerar_token con chequeo de acceso (deja de ser SECURITY DEFINER "ciego").
CREATE OR REPLACE FUNCTION public.regenerar_token(p_establecimiento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token uuid;
BEGIN
  IF NOT public.has_establecimiento_write_access(p_establecimiento_id) THEN
    RAISE EXCEPTION 'No tenés acceso de escritura a este establecimiento';
  END IF;

  v_new_token := gen_random_uuid();
  UPDATE public.verificacion_tokens
  SET token = v_new_token
  WHERE establecimiento_id = p_establecimiento_id;
  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerar_token(uuid) TO authenticated;

COMMIT;
