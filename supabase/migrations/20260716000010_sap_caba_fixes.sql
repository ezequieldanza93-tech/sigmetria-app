-- ============================================================
-- SAP CABA — correcciones post-revisión adversaria
-- ============================================================
-- Fixes a hallazgos confirmados:
--  HIGH-1: faltan columnas procesos_soldadura/tiene_internacion/gases_medicinales
--          (el motor las usa para G3 en INDUSTRIA/SANITARIO) + requisitos_tecnicos
--          (para rehidratar las secciones de doc técnico G3 al retomar).
--  HIGH-2: falta el tipo de documento MEDIO_IFCI (el wizard lo usa para el
--          comprobante de operatividad del IFCI).
--  HIGH-3: hardening de RLS de storage del bucket sap-autoproteccion (escritura
--          solo para roles con write real; los read-only no pueden mutar evidencia).
--  MED-7 : índice único parcial → una presentación activa por establecimiento.
--  LOW   : guard de papelera en policies de escritura de hijas + cabecera;
--          upsert del bucket reconcilia mime/size.
-- Idempotente.
-- ============================================================

-- ─── HIGH-1: columnas faltantes en sap_presentaciones ───────
ALTER TABLE public.sap_presentaciones
  ADD COLUMN IF NOT EXISTS procesos_soldadura boolean,
  ADD COLUMN IF NOT EXISTS tiene_internacion boolean,
  ADD COLUMN IF NOT EXISTS gases_medicinales boolean,
  ADD COLUMN IF NOT EXISTS requisitos_tecnicos text[];

COMMENT ON COLUMN public.sap_presentaciones.requisitos_tecnicos IS
  'Requisitos técnicos computados por el motor (fds/simulacion_evacuacion/brigada_emergencias/codigo_edificacion). Persistido para rehidratar el wizard al retomar.';

-- ─── HIGH-2: tipo de documento para el comprobante del IFCI ──
INSERT INTO public.sap_tipos_documento (codigo, nombre, descripcion, orden) VALUES
  ('MEDIO_IFCI', 'Comprobante de operatividad del IFCI', 'Informe de operatividad / QR de la Instalación Fija Contra Incendios (medio técnico).', 35)
ON CONFLICT (codigo) DO NOTHING;

-- ─── MED-7: una presentación ACTIVA por establecimiento ─────
-- (deduplicar por las dudas antes de crear el índice único)
DELETE FROM public.sap_presentaciones a
USING public.sap_presentaciones b
WHERE a.establecimiento_id = b.establecimiento_id
  AND a.deleted_at IS NULL AND b.deleted_at IS NULL
  AND a.estado <> 'vencido' AND b.estado <> 'vencido'
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sap_presentaciones_activa
  ON public.sap_presentaciones (establecimiento_id)
  WHERE deleted_at IS NULL AND estado <> 'vencido';

-- ─── HIGH-3: hardening RLS storage bucket sap-autoproteccion ─
-- Escritura solo para roles con write real (full_access_main/branch + colaborador);
-- borrado solo full_access_main/branch. SELECT sigue abierto a miembros activos.
DROP POLICY IF EXISTS "sap assets: members insert" ON storage.objects;
CREATE POLICY "sap assets: members insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sap-autoproteccion'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
        AND cm.role IN ('full_access_main','full_access_branch','colaborador')
    )
  );

DROP POLICY IF EXISTS "sap assets: members update" ON storage.objects;
CREATE POLICY "sap assets: members update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sap-autoproteccion'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
        AND cm.role IN ('full_access_main','full_access_branch','colaborador')
    )
  );

DROP POLICY IF EXISTS "sap assets: members delete" ON storage.objects;
CREATE POLICY "sap assets: members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sap-autoproteccion'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
        AND cm.role IN ('full_access_main','full_access_branch')
    )
  );

-- ─── LOW: upsert del bucket reconcilia mime/size en re-corridas ──
UPDATE storage.buckets
SET file_size_limit = 50 * 1024 * 1024,
    allowed_mime_types = ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/heic',
      'video/mp4','video/quicktime','video/webm',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
WHERE id = 'sap-autoproteccion';

-- ─── LOW: guard de papelera en escritura de cabecera + hijas ──
-- Cabecera: no permitir MUTAR una presentación en papelera (salvo developer, p/restaurar).
-- Soft-delete sigue funcionando: USING evalúa la fila VIEJA (deleted_at IS NULL).
DROP POLICY IF EXISTS "sap_presentaciones: update" ON public.sap_presentaciones;
CREATE POLICY "sap_presentaciones: update" ON public.sap_presentaciones FOR UPDATE
  USING ((deleted_at IS NULL OR public.is_developer())
         AND public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

-- Hijas: las policies de escritura exigen que el padre NO esté en papelera.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sap_presentaciones_sustancias','sap_actividades_planta','sap_riesgos',
    'sap_medios_tecnicos','sap_roles','sap_simulacros'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s: insert" ON public.%I;', t, t);
    EXECUTE format($f$CREATE POLICY "%s: insert" ON public.%I FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.sap_presentaciones p
              WHERE p.id = %I.presentacion_id
                AND p.deleted_at IS NULL
                AND public.has_establecimiento_write_access(p.establecimiento_id)));$f$, t, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s: update" ON public.%I;', t, t);
    EXECUTE format($f$CREATE POLICY "%s: update" ON public.%I FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.sap_presentaciones p
              WHERE p.id = %I.presentacion_id
                AND (p.deleted_at IS NULL OR public.is_developer())
                AND public.has_establecimiento_write_access(p.establecimiento_id)));$f$, t, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s: delete" ON public.%I;', t, t);
    EXECUTE format($f$CREATE POLICY "%s: delete" ON public.%I FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.sap_presentaciones p
              WHERE p.id = %I.presentacion_id
                AND (p.deleted_at IS NULL OR public.is_developer())
                AND public.has_establecimiento_write_access(p.establecimiento_id)));$f$, t, t, t);
  END LOOP;
END $$;

-- sap_documentos: misma guarda de papelera en escritura.
DROP POLICY IF EXISTS "sap_documentos: insert" ON public.sap_documentos;
CREATE POLICY "sap_documentos: insert" ON public.sap_documentos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.sap_presentaciones p
            WHERE p.id = sap_documentos.presentacion_id
              AND p.deleted_at IS NULL
              AND public.has_establecimiento_write_access(p.establecimiento_id))
  );
DROP POLICY IF EXISTS "sap_documentos: update" ON public.sap_documentos;
CREATE POLICY "sap_documentos: update" ON public.sap_documentos FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.sap_presentaciones p
            WHERE p.id = sap_documentos.presentacion_id
              AND (p.deleted_at IS NULL OR public.is_developer())
              AND public.has_establecimiento_write_access(p.establecimiento_id))
  );
