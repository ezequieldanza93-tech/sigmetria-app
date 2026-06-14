-- ============================================================
-- EPP — Catálogo de productos HÍBRIDO (genéricos + propios)
-- Migration: 20260716000009
--
-- Hasta ahora `productos` era un catálogo global total (sin consultora_id):
-- todos veían todo y no había productos privados por consultora.
-- Se lo lleva al mismo patrón que el resto de las librerías:
--   consultora_id NULL  = producto genérico de Sigmetría (visible para todas)
--   consultora_id = <id> = propio de esa consultora
--
-- Los productos existentes quedan NULL (genéricos) automáticamente al agregar
-- la columna nullable — no requieren UPDATE.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar consultora_id nullable (existentes → NULL = genéricos)
-- ------------------------------------------------------------
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS consultora_id uuid REFERENCES consultoras(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS productos_consultora_id_idx ON productos(consultora_id);

-- ------------------------------------------------------------
-- 2. RLS híbrida (drop + recreate). Mismos roles que el original.
--    SELECT: genéricos (NULL) + propios de la consultora del usuario
--    INSERT/UPDATE: genéricos solo developer; propios roles operativos
--    DELETE: genéricos solo developer; propios solo full_access
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "productos: select" ON productos;
DROP POLICY IF EXISTS "productos: insert" ON productos;
DROP POLICY IF EXISTS "productos: update" ON productos;
DROP POLICY IF EXISTS "productos: delete" ON productos;

CREATE POLICY "productos: select" ON productos
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));

CREATE POLICY "productos: insert" ON productos
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch','colaborador')
    ) END
  );

CREATE POLICY "productos: update" ON productos
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

CREATE POLICY "productos: delete" ON productos
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (
      SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('full_access_main','full_access_branch')
    ) END
  );

COMMENT ON COLUMN productos.consultora_id IS 'NULL = producto/EPP genérico de Sigmetría (visible para todas). <id> = propio de esa consultora.';
