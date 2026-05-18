-- ============================================================
-- Hardening arquitectónico completo
-- 1. updated_at auto-trigger (19 tablas)
-- 2. registro_gestiones.responsable_id → profiles
-- 3. RLS: políticas DELETE/UPDATE faltantes
-- 4. establecimientos: drop columnas huérfanas
-- ============================================================

-- ── 1. updated_at trigger ────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'capacitaciones','consultora_members','consultoras',
    'directorio_personas','documento_tipos','empresas','establecimientos',
    'inspecciones','instrumentos_medicion','observaciones_gestiones',
    'organizaciones_externas','perfiles_profesionales','productos',
    'profiles','puestos_de_trabajo','registro_gestiones',
    'riesgos','sectores_establecimiento','siniestros'
  ]
  LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;

-- ── 2. registro_gestiones.responsable_id → profiles ──────────
-- El responsable que ejecuta la gestión es un profesional (profile),
-- no un empleado del directorio. El aprobador sí es del directorio.

ALTER TABLE registro_gestiones
  DROP CONSTRAINT IF EXISTS registro_gestiones_responsable_id_fkey;

ALTER TABLE registro_gestiones
  ADD CONSTRAINT registro_gestiones_responsable_id_fkey
  FOREIGN KEY (responsable_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ── 3. RLS: políticas DELETE/UPDATE faltantes ─────────────────

-- categoria_gestiones: solo developer puede eliminar catálogo
CREATE POLICY "categoria_gestiones: delete" ON categoria_gestiones
  FOR DELETE TO authenticated
  USING (is_developer());

-- grupo_gestiones
CREATE POLICY "grupo_gestiones: delete" ON grupo_gestiones
  FOR DELETE TO authenticated
  USING (is_developer());

-- gestiones: developer o admin de consultora
CREATE POLICY "gestiones: delete" ON gestiones
  FOR DELETE TO authenticated
  USING (is_developer() OR (EXISTS (
    SELECT 1 FROM consultora_members cm
    WHERE cm.user_id = auth.uid() AND cm.is_active = true
      AND cm.role = ANY(ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role])
  )));

-- matriculas
CREATE POLICY "matriculas: delete" ON matriculas
  FOR DELETE TO authenticated
  USING (is_developer() OR (EXISTS (
    SELECT 1 FROM consultora_members cm
    WHERE cm.user_id = auth.uid() AND cm.is_active = true
      AND cm.role = ANY(ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])
  )));

-- matriculas_profesionales
CREATE POLICY "matriculas_profesionales: delete" ON matriculas_profesionales
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM perfiles_profesionales pp
    WHERE pp.id = matriculas_profesionales.perfil_id
      AND (pp.user_id = auth.uid() OR is_developer())
  ));

-- certificados_calibracion
CREATE POLICY "certificados_calibracion: delete" ON certificados_calibracion
  FOR DELETE TO authenticated
  USING (is_developer() OR (EXISTS (
    SELECT 1 FROM consultora_members cm
    WHERE cm.user_id = auth.uid() AND cm.is_active = true
      AND cm.role = ANY(ARRAY['full_access_main'::user_role, 'full_access_branch'::user_role, 'colaborador'::user_role])
  )));

-- epp_por_puesto UPDATE (tenía INSERT y DELETE pero no UPDATE)
CREATE POLICY "epp_por_puesto: update" ON epp_por_puesto
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM puestos_de_trabajo pt
    JOIN sectores_establecimiento se ON se.id = pt.sector_id
    WHERE pt.id = epp_por_puesto.puesto_id
      AND has_establecimiento_write_access(se.establecimiento_id)
  ));

-- ── 4. establecimientos: drop columnas huérfanas ─────────────
-- construction_type: duplica establecimientos.tipo (TipoEstablecimiento)
-- photo_url: duplica photo_site
-- country: aplicación 100% argentina, innecesaria

ALTER TABLE establecimientos
  DROP COLUMN IF EXISTS construction_type,
  DROP COLUMN IF EXISTS photo_url,
  DROP COLUMN IF EXISTS country;
