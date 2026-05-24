-- ============================================================
-- Sigmetría HyS — Fix Architecture Issues Batch
-- Applied: 2026-05-23
-- ============================================================

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- FIX 1: latitud/longitud column mismatch
-- DB has latitud/longitud but code queries latitude/longitude
-- Solution: Add computed alias columns
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ALTER TABLE establecimientos
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION
  GENERATED ALWAYS AS (latitud::double precision) STORED;

ALTER TABLE establecimientos
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION
  GENERATED ALWAYS AS (longitud::double precision) STORED;

COMMENT ON COLUMN establecimientos.latitude IS 'Computed alias of latitud — for code compatibility';
COMMENT ON COLUMN establecimientos.longitude IS 'Computed alias of longitud — for code compatibility';

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- FIX 2: personas_documentos RLS — alternative access path
-- Old path: → puesto → sector → establecimiento
-- New dual path: ALSO → personas_establecimientos → establecimiento
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

-- First, drop the old policies (both naming conventions)
DROP POLICY IF EXISTS "personas_documentos: select" ON personas_documentos;
DROP POLICY IF EXISTS "personas_documentos: insert" ON personas_documentos;
DROP POLICY IF EXISTS "personas_documentos: update" ON personas_documentos;
DROP POLICY IF EXISTS "personas_documentos: delete" ON personas_documentos;
DROP POLICY IF EXISTS "personas_documentos: select (via puesto)" ON personas_documentos;
DROP POLICY IF EXISTS "personas_documentos: insert (via puesto)" ON personas_documentos;
DROP POLICY IF EXISTS "personas_documentos: update (via puesto)" ON personas_documentos;
DROP POLICY IF EXISTS "personas_documentos: delete (admin)" ON personas_documentos;

CREATE POLICY "personas_documentos: select (dual path)"
  ON personas_documentos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM puestos_personas pp
      JOIN puestos_de_trabajo pt ON pp.puesto_id = pt.id
      JOIN establecimientos_sectores se ON pt.sector_id = se.id
      WHERE pp.persona_id = personas_documentos.persona_id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
    OR
    EXISTS (
      SELECT 1 FROM personas_establecimientos pe
      WHERE pe.persona_id = personas_documentos.persona_id
        AND has_establecimiento_read_access(pe.establecimiento_id)
    )
  );

CREATE POLICY "personas_documentos: insert (dual path)"
  ON personas_documentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM puestos_personas pp
      JOIN puestos_de_trabajo pt ON pp.puesto_id = pt.id
      JOIN establecimientos_sectores se ON pt.sector_id = se.id
      WHERE pp.persona_id = personas_documentos.persona_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
    OR
    EXISTS (
      SELECT 1 FROM personas_establecimientos pe
      WHERE pe.persona_id = personas_documentos.persona_id
        AND has_establecimiento_write_access(pe.establecimiento_id)
    )
  );

CREATE POLICY "personas_documentos: update (dual path)"
  ON personas_documentos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM puestos_personas pp
      JOIN puestos_de_trabajo pt ON pp.puesto_id = pt.id
      JOIN establecimientos_sectores se ON pt.sector_id = se.id
      WHERE pp.persona_id = personas_documentos.persona_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
    OR
    EXISTS (
      SELECT 1 FROM personas_establecimientos pe
      WHERE pe.persona_id = personas_documentos.persona_id
        AND has_establecimiento_write_access(pe.establecimiento_id)
    )
  );

CREATE POLICY "personas_documentos: delete (admin dual path)"
  ON personas_documentos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM puestos_personas pp
      JOIN puestos_de_trabajo pt ON pp.puesto_id = pt.id
      JOIN establecimientos_sectores se ON pt.sector_id = se.id
      WHERE pp.persona_id = personas_documentos.persona_id
        AND has_establecimiento_admin_access(se.establecimiento_id)
    )
    OR
    EXISTS (
      SELECT 1 FROM personas_establecimientos pe
      WHERE pe.persona_id = personas_documentos.persona_id
        AND has_establecimiento_admin_access(pe.establecimiento_id)
    )
  );

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- FIX 4: Organizaciones soft delete (BEFORE DELETE trigger)
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ALTER TABLE organizaciones_externas
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_organizaciones_externas_is_active
  ON organizaciones_externas (is_active)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION trg_prevent_hard_delete_organizacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE organizaciones_externas
  SET is_active = false
  WHERE id = OLD.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_hard_delete_organizacion ON organizaciones_externas;
CREATE TRIGGER trg_prevent_hard_delete_organizacion
  BEFORE DELETE ON organizaciones_externas
  FOR EACH ROW
  EXECUTE FUNCTION trg_prevent_hard_delete_organizacion();

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- FIX 5: Add missing UPDATE policy for personas_establecimientos
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
CREATE POLICY "personas_establecimientos: update"
  ON personas_establecimientos
  FOR UPDATE
  TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- FIX 7: Rename organizaciones_externas policies and fix puestos_epp
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
DROP POLICY IF EXISTS "organizaciones: select" ON organizaciones_externas;
DROP POLICY IF EXISTS "organizaciones: insert" ON organizaciones_externas;
DROP POLICY IF EXISTS "organizaciones: update" ON organizaciones_externas;
DROP POLICY IF EXISTS "organizaciones: delete" ON organizaciones_externas;

CREATE POLICY "organizaciones_externas: select"
  ON organizaciones_externas
  FOR SELECT
  TO authenticated
  USING (is_developer() OR EXISTS (
    SELECT 1 FROM consultoras_members cm
    WHERE cm.user_id = auth.uid() AND cm.is_active = true
  ));

CREATE POLICY "organizaciones_externas: insert"
  ON organizaciones_externas
  FOR INSERT
  TO authenticated
  WITH CHECK (is_developer() OR EXISTS (
    SELECT 1 FROM consultoras_members cm
    WHERE cm.user_id = auth.uid() AND cm.is_active = true
      AND cm.role IN ('full_access_main','full_access_branch','colaborador')
  ));

CREATE POLICY "organizaciones_externas: update"
  ON organizaciones_externas
  FOR UPDATE
  TO authenticated
  USING (is_developer() OR EXISTS (
    SELECT 1 FROM consultoras_members cm
    WHERE cm.user_id = auth.uid() AND cm.is_active = true
      AND cm.role IN ('full_access_main','full_access_branch','colaborador')
  ));

CREATE POLICY "organizaciones_externas: delete"
  ON organizaciones_externas
  FOR DELETE
  TO authenticated
  USING (is_developer() OR EXISTS (
    SELECT 1 FROM consultoras_members cm
    WHERE cm.user_id = auth.uid() AND cm.is_active = true
      AND cm.role IN ('full_access_main','full_access_branch')
  ));

-- Fix puestos_epp: update policy had "TO public"
DROP POLICY IF EXISTS "puestos_epp: update" ON puestos_epp;

CREATE POLICY "puestos_epp: update"
  ON puestos_epp
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM puestos_de_trabajo pt
      JOIN establecimientos_sectores se ON pt.sector_id = se.id
      WHERE pt.id = puestos_epp.puesto_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- FIX 9: tipos_hora seed data
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
CREATE TABLE IF NOT EXISTS tipos_horas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  color text,
  created_at timestamptz DEFAULT now()
);

INSERT INTO tipos_horas (nombre, descripcion, color) VALUES
  ('Horas Normales', 'Jornada laboral estándar', '#4ade80'),
  ('ART', 'Ausencia por ART / accidente laboral', '#f87171'),
  ('Vacaciones', 'Período de vacaciones', '#fbbf24'),
  ('Feriados', 'Feriado nacional / provincial', '#60a5fa'),
  ('Lluvia', 'Suspensión por lluvia (construcción)', '#93c5fd'),
  ('Licencia Médica', 'Ausencia por enfermedad / certificado médico', '#fca5a5')
ON CONFLICT (nombre) DO NOTHING;

ALTER TABLE establecimientos
  ADD COLUMN IF NOT EXISTS default_tipo_hora_id uuid REFERENCES tipos_horas(id);

UPDATE establecimientos
SET default_tipo_hora_id = (SELECT id FROM tipos_horas WHERE nombre = 'Horas Normales')
WHERE default_tipo_hora_id IS NULL;

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- FIX 10: Add visualizador_comentarista to user role enum
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'visualizador_comentarista';