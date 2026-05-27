-- Art. 4.5 SRT 48/2025 — Token de verificación pública por establecimiento
CREATE TABLE verificacion_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES establecimientos(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  access_count int NOT NULL DEFAULT 0,
  CONSTRAINT verificacion_tokens_est_unique UNIQUE (establecimiento_id),
  CONSTRAINT verificacion_tokens_token_unique UNIQUE (token)
);

CREATE INDEX idx_verificacion_tokens_token ON verificacion_tokens(token);
CREATE INDEX idx_verificacion_tokens_est ON verificacion_tokens(establecimiento_id);

ALTER TABLE verificacion_tokens ENABLE ROW LEVEL SECURITY;

-- SELECT público sin autenticación (anon puede leer por token)
CREATE POLICY "verificacion_tokens_select_public"
  ON verificacion_tokens FOR SELECT
  USING (true);

-- INSERT: solo usuarios autenticados (el trigger maneja la creación automática)
CREATE POLICY "verificacion_tokens_insert_auth"
  ON verificacion_tokens FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: solo full_access_main o full_access_branch
CREATE POLICY "verificacion_tokens_update_full_access"
  ON verificacion_tokens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('full_access_main', 'full_access_branch')
        AND cm.is_active = true
    )
  );

-- SECURITY DEFINER: registra acceso sin necesitar privilegios UPDATE del anon
CREATE OR REPLACE FUNCTION registrar_acceso_legajo(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE verificacion_tokens
  SET last_accessed_at = now(),
      access_count = access_count + 1
  WHERE token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_acceso_legajo(uuid) TO anon;
GRANT EXECUTE ON FUNCTION registrar_acceso_legajo(uuid) TO authenticated;

-- SECURITY DEFINER: invalida token actual generando uno nuevo
CREATE OR REPLACE FUNCTION regenerar_token(p_establecimiento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_token uuid;
BEGIN
  v_new_token := gen_random_uuid();
  UPDATE verificacion_tokens
  SET token = v_new_token
  WHERE establecimiento_id = p_establecimiento_id;
  RETURN v_new_token;
END;
$$;

GRANT EXECUTE ON FUNCTION regenerar_token(uuid) TO authenticated;

-- Trigger: genera token automáticamente al crear un establecimiento
CREATE OR REPLACE FUNCTION auto_crear_verificacion_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO verificacion_tokens (establecimiento_id)
  VALUES (NEW.id)
  ON CONFLICT (establecimiento_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_establecimiento_create_token
  AFTER INSERT ON establecimientos
  FOR EACH ROW
  EXECUTE FUNCTION auto_crear_verificacion_token();
