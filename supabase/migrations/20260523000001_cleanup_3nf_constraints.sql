-- ============================================================
-- 3FN + Seguridad: limpieza de columnas legacy y constraints
-- ============================================================

-- ── 1. empresas.rubro (text) — DROP columna legacy ───────────
-- rubro_id (FK → empresas_rubros) existe desde 20260521000002.
-- El campo de texto libre nunca debió mantenerse.

ALTER TABLE empresas DROP COLUMN IF EXISTS rubro;

-- ── 2. formularios_items.response_type — CHECK constraint ────
-- Solo existía 'compliance' en todo el seed; agregar valores
-- conocidos para bloquear datos basura.

ALTER TABLE formularios_items
  DROP CONSTRAINT IF EXISTS formularios_items_response_type_check;

ALTER TABLE formularios_items
  ADD CONSTRAINT formularios_items_response_type_check
  CHECK (response_type IN ('compliance', 'yes_no', 'text', 'numeric', 'date', 'photo', 'signature'));

-- ── 3. user_access — UNIQUE parcial para acceso empresa-entera ─
-- Postgres trata NULLs como distintos en constraints UNIQUE normales,
-- por lo que UNIQUE(user_id, empresa_id, establecimiento_id) permite
-- múltiples filas con establecimiento_id IS NULL para el mismo par.
-- El índice parcial cierra esta brecha.

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_access_empresa_nivel
  ON user_access (user_id, empresa_id)
  WHERE establecimiento_id IS NULL;

-- ── 4. user_access — índice compuesto para lookups de auth ───
-- Las funciones has_empresa_read/write_access y
-- has_establecimiento_read/write_access hacen WHERE user_id + is_active
-- en cada request autenticado. Sin este índice = seq scan garantizado.

CREATE INDEX IF NOT EXISTS idx_user_access_user_active
  ON user_access (user_id, is_active)
  WHERE is_active = TRUE;
