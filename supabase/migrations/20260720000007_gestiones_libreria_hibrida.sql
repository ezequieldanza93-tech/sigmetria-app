-- ============================================================
-- Librería de Gestiones — patrón HÍBRIDO (base + propios por consultora)
-- Migration: 20260720000007
--
-- Lleva el catálogo de gestiones (grupos → categorías → gestiones) al patrón
-- híbrido de las demás librerías:
--   consultora_id NULL  = base de la app (Sigmetría), visible para todas, solo staff edita
--   consultora_id = <id> = propio de esa consultora (editable por ella)
--
-- Límites por consultora (para conservar orden/estructura y reportes comparables):
--   - máx 4 GRUPOS propios
--   - máx 14 CATEGORÍAS propias
--   - GESTIONES propias: sin límite
--
-- Helpers: is_active_member_of(uuid), is_developer()
-- ============================================================

-- ------------------------------------------------------------
-- 1. consultora_id NULLABLE (filas existentes quedan NULL = base)
-- ------------------------------------------------------------
ALTER TABLE gestiones_grupos     ADD COLUMN IF NOT EXISTS consultora_id uuid REFERENCES consultoras(id) ON DELETE CASCADE;
ALTER TABLE gestiones_categorias ADD COLUMN IF NOT EXISTS consultora_id uuid REFERENCES consultoras(id) ON DELETE CASCADE;
ALTER TABLE gestiones            ADD COLUMN IF NOT EXISTS consultora_id uuid REFERENCES consultoras(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS gestiones_grupos_consultora_idx     ON gestiones_grupos(consultora_id);
CREATE INDEX IF NOT EXISTS gestiones_categorias_consultora_idx ON gestiones_categorias(consultora_id);
CREATE INDEX IF NOT EXISTS gestiones_consultora_idx            ON gestiones(consultora_id);

-- ------------------------------------------------------------
-- 2. UNIQUE(nombre) global → UNIQUE (nombre, consultora_id) tratando NULL como valor
--    Permite que una consultora tenga un grupo/categoría/gestión con el mismo
--    nombre que la base (NULL) o que otra consultora, sin chocar.
-- ------------------------------------------------------------
ALTER TABLE gestiones_grupos     DROP CONSTRAINT IF EXISTS grupo_gestiones_nombre_key;
ALTER TABLE gestiones_categorias DROP CONSTRAINT IF EXISTS categoria_gestiones_nombre_key;
ALTER TABLE gestiones            DROP CONSTRAINT IF EXISTS gestiones_nombre_key;

ALTER TABLE gestiones_grupos     ADD CONSTRAINT gestiones_grupos_nombre_consultora_key     UNIQUE NULLS NOT DISTINCT (nombre, consultora_id);
ALTER TABLE gestiones_categorias ADD CONSTRAINT gestiones_categorias_nombre_consultora_key UNIQUE NULLS NOT DISTINCT (nombre, consultora_id);
ALTER TABLE gestiones            ADD CONSTRAINT gestiones_nombre_consultora_key            UNIQUE NULLS NOT DISTINCT (nombre, consultora_id);

-- ------------------------------------------------------------
-- 3. RLS híbrida (drop + recreate)
--    SELECT: base (NULL) + propias de la consultora del usuario
--    INSERT/UPDATE/DELETE: base solo developer; propias solo full_access de esa consultora
-- ------------------------------------------------------------

-- ---------- gestiones_grupos ----------
DROP POLICY IF EXISTS "gestiones_grupos: select" ON gestiones_grupos;
DROP POLICY IF EXISTS "gestiones_grupos: insert" ON gestiones_grupos;
DROP POLICY IF EXISTS "gestiones_grupos: update" ON gestiones_grupos;
DROP POLICY IF EXISTS "gestiones_grupos: delete" ON gestiones_grupos;

CREATE POLICY "gestiones_grupos: select" ON gestiones_grupos
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "gestiones_grupos: insert" ON gestiones_grupos
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "gestiones_grupos: update" ON gestiones_grupos
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "gestiones_grupos: delete" ON gestiones_grupos
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );

-- ---------- gestiones_categorias ----------
DROP POLICY IF EXISTS "gestiones_categorias: select" ON gestiones_categorias;
DROP POLICY IF EXISTS "gestiones_categorias: insert" ON gestiones_categorias;
DROP POLICY IF EXISTS "gestiones_categorias: update" ON gestiones_categorias;
DROP POLICY IF EXISTS "gestiones_categorias: delete" ON gestiones_categorias;

CREATE POLICY "gestiones_categorias: select" ON gestiones_categorias
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "gestiones_categorias: insert" ON gestiones_categorias
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "gestiones_categorias: update" ON gestiones_categorias
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "gestiones_categorias: delete" ON gestiones_categorias
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );

-- ---------- gestiones ----------
DROP POLICY IF EXISTS "gestiones: select" ON gestiones;
DROP POLICY IF EXISTS "gestiones: insert" ON gestiones;
DROP POLICY IF EXISTS "gestiones: update" ON gestiones;
DROP POLICY IF EXISTS "gestiones: delete" ON gestiones;

CREATE POLICY "gestiones: select" ON gestiones
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "gestiones: insert" ON gestiones
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "gestiones: update" ON gestiones
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "gestiones: delete" ON gestiones
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );

-- ------------------------------------------------------------
-- 4. Trigger de límites por consultora (grupos ≤ 4, categorías ≤ 14)
--    SECURITY DEFINER para contar sin depender de RLS del invocador.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_limite_gestiones_grupos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.consultora_id IS NOT NULL THEN
    IF (SELECT count(*) FROM gestiones_grupos WHERE consultora_id = NEW.consultora_id) >= 4 THEN
      RAISE EXCEPTION 'LIMITE_GRUPOS: máximo 4 grupos propios por consultora (sugerimos usar los grupos base)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_limite_gestiones_categorias()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.consultora_id IS NOT NULL THEN
    IF (SELECT count(*) FROM gestiones_categorias WHERE consultora_id = NEW.consultora_id) >= 14 THEN
      RAISE EXCEPTION 'LIMITE_CATEGORIAS: máximo 14 categorías propias por consultora (sugerimos usar las categorías base)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limite_gestiones_grupos ON gestiones_grupos;
CREATE TRIGGER trg_limite_gestiones_grupos
  BEFORE INSERT ON gestiones_grupos
  FOR EACH ROW EXECUTE FUNCTION public.check_limite_gestiones_grupos();

DROP TRIGGER IF EXISTS trg_limite_gestiones_categorias ON gestiones_categorias;
CREATE TRIGGER trg_limite_gestiones_categorias
  BEFORE INSERT ON gestiones_categorias
  FOR EACH ROW EXECUTE FUNCTION public.check_limite_gestiones_categorias();

COMMENT ON COLUMN gestiones_grupos.consultora_id     IS 'NULL = grupo base de Sigmetría (solo staff). <id> = propio de esa consultora (máx 4). Debe ser un concepto genérico.';
COMMENT ON COLUMN gestiones_categorias.consultora_id IS 'NULL = categoría base de Sigmetría (solo staff). <id> = propia de esa consultora (máx 14).';
COMMENT ON COLUMN gestiones.consultora_id            IS 'NULL = gestión base de Sigmetría (solo staff). <id> = propia de esa consultora (sin límite).';
