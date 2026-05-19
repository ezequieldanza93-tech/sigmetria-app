-- ============================================================
-- Auditoría DB — Issues #2 y #3: Integridad estructural
-- ============================================================

-- ── 1. establecimientos: backfill tipo_id y drop columna tipo ─
-- tipo_id (FK → tipos_establecimiento) reemplazó al enum tipo.
-- Los registros pre-migración tenían tipo_id NULL; backfillamos.

UPDATE establecimientos e
SET tipo_id = t.id
FROM tipos_establecimiento t
WHERE e.tipo_id IS NULL
  AND e.tipo IS NOT NULL
  AND (
    (e.tipo::text IN ('obra_construccion', 'construccion')       AND t.codigo = 'CONSTRUCCION') OR
    (e.tipo::text = 'industria'                                  AND t.codigo = 'INDUSTRIA')    OR
    (e.tipo::text IN ('local_comercial', 'comercio')             AND t.codigo = 'COMERCIO')     OR
    (e.tipo::text IN ('local_administrativo', 'administrativo')  AND t.codigo = 'OFICINA')      OR
    (e.tipo::text = 'agro'                                       AND t.codigo = 'AGRO')         OR
    (e.tipo::text = 'logistica'                                  AND t.codigo = 'LOGISTICA')    OR
    (e.tipo::text = 'centro_salud'                               AND t.codigo = 'CENTRO_SALUD') OR
    (e.tipo::text = 'otro'                                       AND t.codigo = 'OTRO')
  );

ALTER TABLE establecimientos DROP COLUMN IF EXISTS tipo;

-- ── 2. empresas: FK rubro_id → rubros_empresa ─────────────────
-- rubros_empresa existe pero nunca se wired con FK.
-- Convive con rubro (text) hasta actualizar el form.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS rubro_id uuid
  REFERENCES rubros_empresa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_rubro_id
  ON empresas(rubro_id)
  WHERE rubro_id IS NOT NULL;

UPDATE empresas e
SET rubro_id = r.id
FROM rubros_empresa r
WHERE lower(trim(e.rubro)) = lower(trim(r.nombre))
  AND e.rubro_id IS NULL
  AND e.rubro IS NOT NULL;

-- ── 3. formulario_respuestas.executed_by: agregar FK ─────────
-- Era uuid sin FK → silenciosamente aceptaba UUIDs huérfanos.

UPDATE formulario_respuestas
SET executed_by = NULL
WHERE executed_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = formulario_respuestas.executed_by
  );

ALTER TABLE formulario_respuestas
  DROP CONSTRAINT IF EXISTS formulario_respuestas_executed_by_fkey;

ALTER TABLE formulario_respuestas
  ADD CONSTRAINT formulario_respuestas_executed_by_fkey
  FOREIGN KEY (executed_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 4. organizaciones_externas: CHECK scope/empresa_id ────────

UPDATE organizaciones_externas
SET scope = 'global'
WHERE scope = 'empresa' AND empresa_id IS NULL;

ALTER TABLE organizaciones_externas
  DROP CONSTRAINT IF EXISTS chk_org_ext_scope_empresa_id;

ALTER TABLE organizaciones_externas
  ADD CONSTRAINT chk_org_ext_scope_empresa_id
  CHECK (scope = 'global' OR empresa_id IS NOT NULL);

-- ── 5. capacitaciones: CHECK instructor XOR ───────────────────

ALTER TABLE capacitaciones
  DROP CONSTRAINT IF EXISTS chk_cap_instructor_not_both;

ALTER TABLE capacitaciones
  ADD CONSTRAINT chk_cap_instructor_not_both
  CHECK (NOT (instructor_persona_id IS NOT NULL AND instructor_externo IS NOT NULL));

-- ── 6. instrumentos_medicion: UNIQUE en numero_serie ─────────

CREATE UNIQUE INDEX IF NOT EXISTS uniq_inst_numero_serie
  ON instrumentos_medicion(numero_serie)
  WHERE numero_serie IS NOT NULL;

-- ── 7. subcontratistas: trigger updated_at + política DELETE ──

CREATE OR REPLACE TRIGGER set_updated_at
  BEFORE UPDATE ON subcontratistas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'subcontratistas' AND policyname = 'subcontratistas: delete'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "subcontratistas: delete"
        ON subcontratistas FOR DELETE TO authenticated
        USING (
          is_developer() OR EXISTS (
            SELECT 1 FROM consultora_members cm
            JOIN organizaciones_externas oe ON oe.id = subcontratistas.organizacion_id
            JOIN empresas emp ON emp.id = oe.empresa_id
            WHERE cm.user_id = auth.uid()
              AND cm.is_active = true
              AND cm.consultora_id = emp.consultora_id
              AND cm.role = ANY(ARRAY['full_access_main'::user_role,'full_access_branch'::user_role])
          )
        )
    $pol$;
  END IF;
END;
$$;

-- ── 8. horarios_establecimiento: RLS correcta ─────────────────
-- USING (true) daba acceso sin discriminar tenant

DROP POLICY IF EXISTS "Authenticated read horarios"  ON horarios_establecimiento;
DROP POLICY IF EXISTS "Authenticated write horarios" ON horarios_establecimiento;

CREATE POLICY "horarios_establecimiento: select"
  ON horarios_establecimiento FOR SELECT TO authenticated
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "horarios_establecimiento: insert"
  ON horarios_establecimiento FOR INSERT TO authenticated
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "horarios_establecimiento: update"
  ON horarios_establecimiento FOR UPDATE TO authenticated
  USING  (has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "horarios_establecimiento: delete"
  ON horarios_establecimiento FOR DELETE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));
