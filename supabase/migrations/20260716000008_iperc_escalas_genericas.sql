-- ============================================================
-- IPERC — Escalas de la matriz GENÉRICAS ÚNICAS
-- Migration: 20260716000008
--
-- Las escalas (probabilidad, consecuencia + items, niveles de riesgo) NO son
-- catálogos acumulables: son la metodología de cálculo de la matriz IPERC.
-- Mezclar genéricas + propias rompería calcularNivelRiesgo (rangos duplicados).
--
-- Decisión: una sola escala estándar (la de Sigmetría → NULL) para TODAS las
-- consultoras. Solo el staff (developer / super_admin) la edita.
-- La app siempre consulta consultora_id IS NULL para estas tablas.
-- ============================================================

-- ------------------------------------------------------------
-- 1. consultora_id pasa a NULLABLE
-- ------------------------------------------------------------
ALTER TABLE iperc_consecuencias  ALTER COLUMN consultora_id DROP NOT NULL;
ALTER TABLE iperc_probabilidades ALTER COLUMN consultora_id DROP NOT NULL;
ALTER TABLE iperc_niveles_riesgo ALTER COLUMN consultora_id DROP NOT NULL;
-- iperc_consecuencia_items no tiene consultora_id (hereda de la consecuencia padre)

-- ------------------------------------------------------------
-- 2. Promover las escalas de Sigmetría HyS a genéricas (NULL)
-- ------------------------------------------------------------
UPDATE iperc_consecuencias SET consultora_id = NULL
  WHERE consultora_id = (SELECT id FROM consultoras WHERE nombre = 'Sigmetría HyS');
UPDATE iperc_probabilidades SET consultora_id = NULL
  WHERE consultora_id = (SELECT id FROM consultoras WHERE nombre = 'Sigmetría HyS');
UPDATE iperc_niveles_riesgo SET consultora_id = NULL
  WHERE consultora_id = (SELECT id FROM consultoras WHERE nombre = 'Sigmetría HyS');

-- ------------------------------------------------------------
-- 3. RLS: SELECT visible para todo autenticado (genéricas + eventuales propias);
--    escritura SOLO developer (staff de la plataforma).
-- ------------------------------------------------------------

-- ---------- iperc_consecuencias ----------
DROP POLICY IF EXISTS "iperc_consecuencias_select" ON iperc_consecuencias;
DROP POLICY IF EXISTS "iperc_consecuencias_insert" ON iperc_consecuencias;
DROP POLICY IF EXISTS "iperc_consecuencias_update" ON iperc_consecuencias;
DROP POLICY IF EXISTS "iperc_consecuencias_delete" ON iperc_consecuencias;

CREATE POLICY "iperc_consecuencias_select" ON iperc_consecuencias
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "iperc_consecuencias_insert" ON iperc_consecuencias
  FOR INSERT TO authenticated WITH CHECK (is_developer());
CREATE POLICY "iperc_consecuencias_update" ON iperc_consecuencias
  FOR UPDATE TO authenticated USING (is_developer()) WITH CHECK (is_developer());
CREATE POLICY "iperc_consecuencias_delete" ON iperc_consecuencias
  FOR DELETE TO authenticated USING (is_developer());

-- ---------- iperc_consecuencia_items (acceso derivado del padre) ----------
DROP POLICY IF EXISTS "iperc_consecuencia_items_select" ON iperc_consecuencia_items;
DROP POLICY IF EXISTS "iperc_consecuencia_items_insert" ON iperc_consecuencia_items;
DROP POLICY IF EXISTS "iperc_consecuencia_items_update" ON iperc_consecuencia_items;
DROP POLICY IF EXISTS "iperc_consecuencia_items_delete" ON iperc_consecuencia_items;

CREATE POLICY "iperc_consecuencia_items_select" ON iperc_consecuencia_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM iperc_consecuencias c
      WHERE c.id = iperc_consecuencia_items.consecuencia_id
        AND (c.consultora_id IS NULL OR is_active_member_of(c.consultora_id))
    )
  );
CREATE POLICY "iperc_consecuencia_items_insert" ON iperc_consecuencia_items
  FOR INSERT TO authenticated WITH CHECK (is_developer());
CREATE POLICY "iperc_consecuencia_items_update" ON iperc_consecuencia_items
  FOR UPDATE TO authenticated USING (is_developer()) WITH CHECK (is_developer());
CREATE POLICY "iperc_consecuencia_items_delete" ON iperc_consecuencia_items
  FOR DELETE TO authenticated USING (is_developer());

-- ---------- iperc_probabilidades ----------
DROP POLICY IF EXISTS "iperc_probabilidades_select" ON iperc_probabilidades;
DROP POLICY IF EXISTS "iperc_probabilidades_insert" ON iperc_probabilidades;
DROP POLICY IF EXISTS "iperc_probabilidades_update" ON iperc_probabilidades;
DROP POLICY IF EXISTS "iperc_probabilidades_delete" ON iperc_probabilidades;

CREATE POLICY "iperc_probabilidades_select" ON iperc_probabilidades
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "iperc_probabilidades_insert" ON iperc_probabilidades
  FOR INSERT TO authenticated WITH CHECK (is_developer());
CREATE POLICY "iperc_probabilidades_update" ON iperc_probabilidades
  FOR UPDATE TO authenticated USING (is_developer()) WITH CHECK (is_developer());
CREATE POLICY "iperc_probabilidades_delete" ON iperc_probabilidades
  FOR DELETE TO authenticated USING (is_developer());

-- ---------- iperc_niveles_riesgo ----------
DROP POLICY IF EXISTS "iperc_niveles_riesgo_select" ON iperc_niveles_riesgo;
DROP POLICY IF EXISTS "iperc_niveles_riesgo_insert" ON iperc_niveles_riesgo;
DROP POLICY IF EXISTS "iperc_niveles_riesgo_update" ON iperc_niveles_riesgo;
DROP POLICY IF EXISTS "iperc_niveles_riesgo_delete" ON iperc_niveles_riesgo;

CREATE POLICY "iperc_niveles_riesgo_select" ON iperc_niveles_riesgo
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "iperc_niveles_riesgo_insert" ON iperc_niveles_riesgo
  FOR INSERT TO authenticated WITH CHECK (is_developer());
CREATE POLICY "iperc_niveles_riesgo_update" ON iperc_niveles_riesgo
  FOR UPDATE TO authenticated USING (is_developer()) WITH CHECK (is_developer());
CREATE POLICY "iperc_niveles_riesgo_delete" ON iperc_niveles_riesgo
  FOR DELETE TO authenticated USING (is_developer());

COMMENT ON COLUMN iperc_consecuencias.consultora_id  IS 'NULL = escala genérica única (Sigmetría). Escalas IPERC compartidas por todas las consultoras; solo staff edita.';
COMMENT ON COLUMN iperc_probabilidades.consultora_id IS 'NULL = escala genérica única (Sigmetría). Solo staff edita.';
COMMENT ON COLUMN iperc_niveles_riesgo.consultora_id IS 'NULL = escala genérica única (Sigmetría). Solo staff edita.';
