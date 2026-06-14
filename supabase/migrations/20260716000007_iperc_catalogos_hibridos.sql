-- ============================================================
-- IPERC — Librería de catálogos HÍBRIDA (genéricos + propios)
-- Migration: 20260716000007
--
-- Lleva los catálogos acumulables de IPERC (peligros, riesgos, medidas)
-- al mismo patrón que normativa_legal:
--   consultora_id NULL  = base genérica de Sigmetría, visible para TODAS
--   consultora_id = <id> = propio de esa consultora, visible solo para ella
--
-- Se promueve el catálogo curado de "Sigmetría HyS" a genérico (consultora_id → NULL).
-- Helpers usados: is_active_member_of(uuid), is_developer()
-- ============================================================

-- ------------------------------------------------------------
-- 1. consultora_id pasa a NULLABLE
-- ------------------------------------------------------------
ALTER TABLE iperc_peligros_library ALTER COLUMN consultora_id DROP NOT NULL;
ALTER TABLE iperc_riesgos_library  ALTER COLUMN consultora_id DROP NOT NULL;
ALTER TABLE medidas_control        ALTER COLUMN consultora_id DROP NOT NULL;

-- ------------------------------------------------------------
-- 2. Promover el catálogo de Sigmetría HyS a genérico (NULL)
--    Identificación por nombre (no hay flag de plataforma).
--    Si la consultora no existe, los UPDATE afectan 0 filas (no rompe).
-- ------------------------------------------------------------
UPDATE iperc_peligros_library SET consultora_id = NULL
  WHERE consultora_id = (SELECT id FROM consultoras WHERE nombre = 'Sigmetría HyS');
UPDATE iperc_riesgos_library SET consultora_id = NULL
  WHERE consultora_id = (SELECT id FROM consultoras WHERE nombre = 'Sigmetría HyS');
UPDATE medidas_control SET consultora_id = NULL
  WHERE consultora_id = (SELECT id FROM consultoras WHERE nombre = 'Sigmetría HyS');

-- ------------------------------------------------------------
-- 3. RLS híbrida (drop + recreate). Patrón normativa.
--    SELECT: genéricos (NULL) visibles para todo miembro activo + propios
--    INSERT/UPDATE/DELETE: genéricos solo developer; propios solo roles operativos
-- ------------------------------------------------------------

-- ---------- iperc_peligros_library ----------
DROP POLICY IF EXISTS "iperc_peligros_library_select" ON iperc_peligros_library;
DROP POLICY IF EXISTS "iperc_peligros_library_insert" ON iperc_peligros_library;
DROP POLICY IF EXISTS "iperc_peligros_library_update" ON iperc_peligros_library;
DROP POLICY IF EXISTS "iperc_peligros_library_delete" ON iperc_peligros_library;

CREATE POLICY "iperc_peligros_library_select" ON iperc_peligros_library
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));

CREATE POLICY "iperc_peligros_library_insert" ON iperc_peligros_library
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  );

CREATE POLICY "iperc_peligros_library_update" ON iperc_peligros_library
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  );

CREATE POLICY "iperc_peligros_library_delete" ON iperc_peligros_library
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  );

-- ---------- iperc_riesgos_library ----------
DROP POLICY IF EXISTS "iperc_riesgos_library_select" ON iperc_riesgos_library;
DROP POLICY IF EXISTS "iperc_riesgos_library_insert" ON iperc_riesgos_library;
DROP POLICY IF EXISTS "iperc_riesgos_library_update" ON iperc_riesgos_library;
DROP POLICY IF EXISTS "iperc_riesgos_library_delete" ON iperc_riesgos_library;

CREATE POLICY "iperc_riesgos_library_select" ON iperc_riesgos_library
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));

CREATE POLICY "iperc_riesgos_library_insert" ON iperc_riesgos_library
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  );

CREATE POLICY "iperc_riesgos_library_update" ON iperc_riesgos_library
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  );

CREATE POLICY "iperc_riesgos_library_delete" ON iperc_riesgos_library
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  );

-- ---------- medidas_control (incluye rol 'colaborador') ----------
DROP POLICY IF EXISTS "medidas_control_select" ON medidas_control;
DROP POLICY IF EXISTS "medidas_control_insert" ON medidas_control;
DROP POLICY IF EXISTS "medidas_control_update" ON medidas_control;
DROP POLICY IF EXISTS "medidas_control_delete" ON medidas_control;

CREATE POLICY "medidas_control_select" ON medidas_control
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));

CREATE POLICY "medidas_control_insert" ON medidas_control
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch','colaborador')
    ) END
  );

CREATE POLICY "medidas_control_update" ON medidas_control
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch','colaborador')
    ) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch','colaborador')
    ) END
  );

CREATE POLICY "medidas_control_delete" ON medidas_control
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch','colaborador')
    ) END
  );

COMMENT ON COLUMN iperc_peligros_library.consultora_id IS 'NULL = peligro genérico de Sigmetría (visible para todas las consultoras). <id> = propio de esa consultora.';
COMMENT ON COLUMN iperc_riesgos_library.consultora_id  IS 'NULL = riesgo genérico de Sigmetría (visible para todas). <id> = propio.';
COMMENT ON COLUMN medidas_control.consultora_id        IS 'NULL = medida genérica de Sigmetría (visible para todas). <id> = propia.';
