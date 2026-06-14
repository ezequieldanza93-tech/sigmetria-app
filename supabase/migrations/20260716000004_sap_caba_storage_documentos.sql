-- ============================================================
-- Sistema de Autoprotección (SAP) CABA — Ley 5920 · STORAGE + DOCUMENTOS
-- ============================================================
-- Bucket PRIVADO `sap-autoproteccion` para toda la documentación adjunta del
-- SAP (habilitación, planos, croquis de evacuación, planillas, simulaciones,
-- informes de simulacro, DDJJ firmadas, etc.). Datos sensibles → privado, se
-- sirve con signed URLs. Path: {consultora_id}/sap/{presentacion_id}/{kind}.{ext}
-- (primer segmento = consultora_id, como exige storage_path_consultora_id).
--
-- Metadata en `sap_documentos` (se guarda el PATH relativo, nunca la URL).
--
-- Idempotente.
-- ============================================================

-- ─── 1. Bucket privado ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sap-autoproteccion', 'sap-autoproteccion', false, 50 * 1024 * 1024,
  ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/heic',
        'video/mp4','video/quicktime','video/webm',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

UPDATE storage.buckets SET public = false WHERE id = 'sap-autoproteccion';

-- ─── 2. Policies de storage (acceso por tenant según el path) ──
-- Lectura/escritura: miembro ACTIVO de la consultora dueña del path
-- (primer segmento = consultora_id, vía storage_path_consultora_id).
DROP POLICY IF EXISTS "sap assets: members select" ON storage.objects;
CREATE POLICY "sap assets: members select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sap-autoproteccion'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

DROP POLICY IF EXISTS "sap assets: members insert" ON storage.objects;
CREATE POLICY "sap assets: members insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sap-autoproteccion'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

DROP POLICY IF EXISTS "sap assets: members update" ON storage.objects;
CREATE POLICY "sap assets: members update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sap-autoproteccion'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

DROP POLICY IF EXISTS "sap assets: members delete" ON storage.objects;
CREATE POLICY "sap assets: members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sap-autoproteccion'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- ─── 3. Metadata de documentos ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.sap_documentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,
  tipo_id         uuid NOT NULL REFERENCES public.sap_tipos_documento(id),
  path            text NOT NULL,                 -- path relativo en bucket sap-autoproteccion (NO URL)
  nombre_archivo  text,
  mime            text,
  size_bytes      bigint,
  descripcion     text,
  fecha           date,
  uploaded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sap_documentos_pres
  ON public.sap_documentos (presentacion_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sap_documentos_tipo
  ON public.sap_documentos (tipo_id);

ALTER TABLE public.sap_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sap_documentos: select" ON public.sap_documentos;
CREATE POLICY "sap_documentos: select" ON public.sap_documentos FOR SELECT
  USING (
    (deleted_at IS NULL OR public.is_developer())
    AND EXISTS (SELECT 1 FROM public.sap_presentaciones p
                WHERE p.id = sap_documentos.presentacion_id
                  AND public.has_establecimiento_read_access(p.establecimiento_id))
  );

DROP POLICY IF EXISTS "sap_documentos: insert" ON public.sap_documentos;
CREATE POLICY "sap_documentos: insert" ON public.sap_documentos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.sap_presentaciones p
            WHERE p.id = sap_documentos.presentacion_id
              AND public.has_establecimiento_write_access(p.establecimiento_id))
  );

DROP POLICY IF EXISTS "sap_documentos: update" ON public.sap_documentos;
CREATE POLICY "sap_documentos: update" ON public.sap_documentos FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.sap_presentaciones p
            WHERE p.id = sap_documentos.presentacion_id
              AND public.has_establecimiento_write_access(p.establecimiento_id))
  );

DROP POLICY IF EXISTS "sap_documentos: delete" ON public.sap_documentos;
CREATE POLICY "sap_documentos: delete" ON public.sap_documentos FOR DELETE
  USING (public.is_developer());

COMMENT ON TABLE public.sap_documentos IS 'Documentos adjuntos del SAP (bucket privado sap-autoproteccion). Guarda el path relativo, no la URL.';
COMMENT ON COLUMN public.sap_documentos.path IS 'Path relativo en sap-autoproteccion: {consultora_id}/sap/{presentacion_id}/{kind}.{ext}';
COMMENT ON COLUMN public.sap_documentos.deleted_at IS 'Soft-delete (papelera). NULL = vigente.';
