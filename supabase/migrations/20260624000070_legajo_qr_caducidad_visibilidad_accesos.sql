-- ============================================================
-- 2C · Acceso por QR al Legajo Técnico — Art. 4.5 SRT 48/2025
--      Cadena de custodia — Disp. 15/2026
-- ============================================================
-- Completa el QR público del legajo con TRES capacidades nuevas, sin tocar
-- el modelo de token existente (verificacion_tokens, 1 por establecimiento):
--
--   1. CADUCIDAD + REVOCACIÓN del token (2C.3)
--      El QR se pega físico en obra → es PERMANENTE hasta revocarlo, con
--      opción de caducidad configurable. Se agregan columnas `revoked_at` y
--      `expires_at`. La validez se centraliza en `token_legajo_valido()`.
--
--   2. VISIBILIDAD POR DOCUMENTO en la vista pública (2C.1 / 2C.2)
--      El profesional puede OCULTAR un documento puntual del QR público
--      (`establecimientos_documentos.legajo_publico_visible`). Default = visible.
--      El filtro VIGENTES (oculta VENCIDOS) es automático en la vista pública
--      y NO se persiste acá: se resuelve por `fecha_vencimiento` al renderear.
--
--   3. LOG DE ESCANEOS (2C.4)
--      Tabla `legajo_qr_accesos`: una fila por escaneo (timestamp + IP + UA)
--      para reforzar la cadena de custodia. El inspector NO se loguea: el
--      registro es anónimo, lo inserta un SECURITY DEFINER llamado por `anon`.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS; CREATE TABLE IF NOT EXISTS;
--   DROP/CREATE POLICY; CREATE OR REPLACE FUNCTION.
-- RLS: lectura de accesos scopeada por consultora (has_establecimiento_*).
-- ============================================================

BEGIN;

-- ─── 1. Caducidad + revocación del token ────────────────────
ALTER TABLE public.verificacion_tokens
  ADD COLUMN IF NOT EXISTS revoked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz;

COMMENT ON COLUMN public.verificacion_tokens.revoked_at IS
  'Si no es NULL, el QR fue revocado a mano y deja de resolver (404 público). El QR es permanente hasta que se setea esto.';
COMMENT ON COLUMN public.verificacion_tokens.expires_at IS
  'Caducidad OPCIONAL del QR. NULL = sin caducidad (permanente). Si expires_at <= now() el QR deja de resolver.';

-- Helper centralizado: ¿el token es válido AHORA? (no revocado y no caducado).
-- SECURITY DEFINER + STABLE: usable desde la vista pública (anon) sin exponer RLS.
CREATE OR REPLACE FUNCTION public.token_legajo_valido(p_token uuid)
RETURNS TABLE (establecimiento_id uuid, token_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vt.establecimiento_id, vt.id
  FROM public.verificacion_tokens vt
  WHERE vt.token = p_token
    AND vt.revoked_at IS NULL
    AND (vt.expires_at IS NULL OR vt.expires_at > now())
$$;

GRANT EXECUTE ON FUNCTION public.token_legajo_valido(uuid) TO anon, authenticated;

-- regenerar_token: al regenerar, limpiamos revocación y caducidad (QR "fresco").
-- Mantiene el chequeo de acceso de 20260706000001 (no es SECURITY DEFINER "ciego").
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
  SET token = v_new_token,
      revoked_at = NULL,
      expires_at = NULL
  WHERE establecimiento_id = p_establecimiento_id;
  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerar_token(uuid) TO authenticated;

-- Revocar / reactivar el QR sin cambiar el token (el código pegado en obra sigue
-- siendo el mismo si se reactiva). Chequea acceso de escritura al establecimiento.
CREATE OR REPLACE FUNCTION public.set_token_revocado(p_establecimiento_id uuid, p_revocado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_establecimiento_write_access(p_establecimiento_id) THEN
    RAISE EXCEPTION 'No tenés acceso de escritura a este establecimiento';
  END IF;

  UPDATE public.verificacion_tokens
  SET revoked_at = CASE WHEN p_revocado THEN now() ELSE NULL END
  WHERE establecimiento_id = p_establecimiento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_token_revocado(uuid, boolean) TO authenticated;

-- Setear / limpiar la caducidad del QR. NULL = sin caducidad (permanente).
CREATE OR REPLACE FUNCTION public.set_token_caducidad(p_establecimiento_id uuid, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_establecimiento_write_access(p_establecimiento_id) THEN
    RAISE EXCEPTION 'No tenés acceso de escritura a este establecimiento';
  END IF;

  UPDATE public.verificacion_tokens
  SET expires_at = p_expires_at
  WHERE establecimiento_id = p_establecimiento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_token_caducidad(uuid, timestamptz) TO authenticated;

-- ─── 2. Visibilidad por documento en la vista pública ───────
-- Default = visible. El profesional puede ocultar un documento puntual del QR.
-- (El filtro vigentes/vencidos es automático en el render — no se persiste acá.)
ALTER TABLE public.establecimientos_documentos
  ADD COLUMN IF NOT EXISTS legajo_publico_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.establecimientos_documentos.legajo_publico_visible IS
  'Visibilidad del documento en la vista pública del QR (inspector). Default true. El profesional puede ocultarlo. Independiente del filtro automático de vencidos.';

-- ─── 3. Log de escaneos (cadena de custodia) ────────────────
CREATE TABLE IF NOT EXISTS public.legajo_qr_accesos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id           uuid NOT NULL REFERENCES public.verificacion_tokens(id) ON DELETE CASCADE,
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  accessed_at        timestamptz NOT NULL DEFAULT now(),
  ip                 text,
  user_agent         text
);

CREATE INDEX IF NOT EXISTS idx_legajo_qr_accesos_est
  ON public.legajo_qr_accesos (establecimiento_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_legajo_qr_accesos_token
  ON public.legajo_qr_accesos (token_id, accessed_at DESC);

ALTER TABLE public.legajo_qr_accesos ENABLE ROW LEVEL SECURITY;

-- SELECT: solo quien tiene acceso (lectura) al establecimiento dueño del token.
-- has_establecimiento_write_access ya valida pertenencia a la consultora; usamos
-- el mismo gate para que el log sea visible al profesional, nunca cross-tenant.
DROP POLICY IF EXISTS "legajo_qr_accesos_select" ON public.legajo_qr_accesos;
CREATE POLICY "legajo_qr_accesos_select"
  ON public.legajo_qr_accesos FOR SELECT TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

-- Sin policy de INSERT para anon/authenticated: SOLO el SECURITY DEFINER inserta.
-- (El acceso es anónimo; el inspector no se loguea ni puede leer el log.)

-- Registrar un escaneo: mantiene el contador legacy (last_accessed_at/access_count)
-- y agrega una fila al log con timestamp + IP + UA. SOLO registra si el token es
-- VÁLIDO (no revocado, no caducado) → no se inflan métricas con tokens muertos.
CREATE OR REPLACE FUNCTION public.registrar_acceso_legajo(
  p_token uuid,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_id uuid;
  v_est_id   uuid;
BEGIN
  SELECT vt.id, vt.establecimiento_id INTO v_token_id, v_est_id
  FROM public.verificacion_tokens vt
  WHERE vt.token = p_token
    AND vt.revoked_at IS NULL
    AND (vt.expires_at IS NULL OR vt.expires_at > now());

  IF v_token_id IS NULL THEN
    RETURN; -- token inválido: no registramos nada
  END IF;

  UPDATE public.verificacion_tokens
  SET last_accessed_at = now(),
      access_count = access_count + 1
  WHERE id = v_token_id;

  INSERT INTO public.legajo_qr_accesos (token_id, establecimiento_id, ip, user_agent)
  VALUES (v_token_id, v_est_id, p_ip, p_user_agent);
END;
$$;

-- La firma de 1-arg (legacy) sigue existiendo de la migración 20260609000001.
-- La reemplazamos para que también respete la validez del token (sin IP/UA).
CREATE OR REPLACE FUNCTION public.registrar_acceso_legajo(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.registrar_acceso_legajo(p_token, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_acceso_legajo(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_acceso_legajo(uuid) TO anon, authenticated;

COMMIT;
