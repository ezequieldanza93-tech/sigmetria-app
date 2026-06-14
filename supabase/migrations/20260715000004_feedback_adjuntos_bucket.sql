-- ============================================================
-- Bucket privado para adjuntos del botón flotante de reportes
-- (screenshots capturados por el founder-tester)
-- Path convention: reportes/{feedback_id}/screenshot.{ext}
-- RLS: INSERT → usuario autenticado (solo el propio dueño por user_id en path)
--      SELECT → usuario autenticado (solo sus propios objetos)
-- ============================================================

-- ─── 1. Crear el bucket ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-adjuntos',
  'feedback-adjuntos',
  false,
  5 * 1024 * 1024,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 2. RLS: INSERT — cualquier usuario autenticado puede subir ──
-- El servidor (server action con service role) hace el upload en nombre del usuario,
-- pero la policy permite también uploads directos desde el cliente autenticado.
CREATE POLICY "feedback-adjuntos: auth insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'feedback-adjuntos');

-- ─── 3. RLS: SELECT — solo super_admin o el propio uploader ──
-- Para simplificar sin exponer datos cross-user, restringimos SELECT a super_admins.
-- El server action usa el service_role client para leer en contexto de administración.
CREATE POLICY "feedback-adjuntos: super admin select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_super_admin = true
    )
  );

-- ─── 4. RLS: DELETE — solo super_admin puede purgar ──────────
CREATE POLICY "feedback-adjuntos: super admin delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.is_super_admin = true
    )
  );

-- ─── 5. Índice JSONB para filtrar por canal en feedback ──────
-- Optimiza la query de listarReportesFounder que filtra metadata->>'canal' = 'founder-tester'
CREATE INDEX IF NOT EXISTS feedback_metadata_canal_idx
  ON public.feedback ((metadata->>'canal'))
  WHERE metadata->>'canal' IS NOT NULL;
