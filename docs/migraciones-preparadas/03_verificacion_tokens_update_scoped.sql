-- ════════════════════════════════════════════════════════════════════════════
-- PREPARADA — NO APLICAR SIN REVISIÓN (D1/D2 docs/decisiones.md)
--
-- QUÉ CORRIGE (DIVERGENCIA RLS — aislamiento entre consultoras en el QR)
--   La policy UPDATE de `verificacion_tokens`
--   (migración 20260609000001_verificacion_tokens.sql) es:
--
--     CREATE POLICY "verificacion_tokens_update_full_access"
--       ON verificacion_tokens FOR UPDATE
--       USING (EXISTS (SELECT 1 FROM consultoras_members cm
--                      WHERE cm.user_id = auth.uid()
--                        AND cm.role IN ('full_access_main','full_access_branch')
--                        AND cm.is_active = true));
--
--   PROBLEMA: el EXISTS comprueba que el usuario sea admin de ALGUNA consultora,
--   pero NO que el establecimiento del token pertenezca a SU consultora. Un
--   full_access_main/branch de la consultora A podría hacer UPDATE (o invocar
--   `regenerar_token`, que corre como SECURITY DEFINER y NO chequea acceso) sobre
--   un token de un establecimiento de la consultora B. Eso permite a un admin de
--   A INVALIDAR el QR público de un establecimiento de B (denegación de servicio
--   cruzada entre clientes / ruptura de aislamiento de tenant).
--
--   NOTA: el SELECT es público a propósito (el QR debe leerse sin login) y la
--   lectura no expone datos personales — eso está OK. El hueco es SOLO el UPDATE
--   y la función regenerar_token.
--
-- QUÉ HACE ESTA MIGRACIÓN
--   1. Reemplaza la policy UPDATE para que valide acceso de ESCRITURA al
--      establecimiento dueño del token (has_establecimiento_write_access), que ya
--      resuelve el tenant correcto.
--   2. Endurece `regenerar_token(uuid)`: antes de regenerar, exige que el usuario
--      tenga acceso de escritura al establecimiento (deja de ser un SECURITY
--      DEFINER "ciego").
--
-- RIESGO (POR QUÉ NO SE APLICA AUTOMÁTICAMENTE)
--   ⚠️ Cambia quién puede regenerar tokens. Hoy cualquier admin de cualquier
--   consultora puede; tras el fix solo quien tenga write access al establecimiento.
--   Es el comportamiento correcto, pero si alguna automatización interna llamaba
--   regenerar_token sin un usuario con scope, dejará de funcionar. Verificar que
--   regenerar_token solo se invoca desde la UI por el dueño del establecimiento.
--
-- CÓMO TESTEAR ANTES DE APLICAR
--   1. Como admin de consultora A, regenerar el token de un establecimiento de A
--      → debe FUNCIONAR.
--   2. Como admin de consultora A, intentar UPDATE / regenerar_token de un token
--      de consultora B → debe FALLAR.
--   3. Verificar que la página pública /verificar/[token] sigue leyéndose sin login.
--
-- ROLLBACK
--   -- recrear la policy y la función originales de 20260609000001.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. UPDATE scopeado al establecimiento dueño del token.
DROP POLICY IF EXISTS "verificacion_tokens_update_full_access" ON public.verificacion_tokens;
CREATE POLICY "verificacion_tokens_update_full_access"
  ON public.verificacion_tokens FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

-- 2. regenerar_token con chequeo de acceso (deja de ser DEFINER ciego).
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
