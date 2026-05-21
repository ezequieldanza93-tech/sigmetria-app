-- ============================================================
-- Storage buckets para uploads de assets de la app
-- 6 buckets nuevos: logos, consultora, firmas, matriculas, planos, certificados
-- ============================================================
-- Path convention: {consultora_id}/{entity_type}/{entity_id}/{kind}.{ext}
-- RLS: SELECT/INSERT/UPDATE/DELETE solo si el path empieza con un consultora_id
--      donde el usuario es miembro activo (rol con write para mutaciones).

-- ─── 1. Crear los buckets ───────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('logos',        'logos',        true,  2  * 1024 * 1024, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('consultora',   'consultora',   true,  2  * 1024 * 1024, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('firmas',       'firmas',       false, 1  * 1024 * 1024, ARRAY['image/png','image/jpeg','image/svg+xml']),
  ('matriculas',   'matriculas',   false, 5  * 1024 * 1024, ARRAY['image/jpeg','image/png','application/pdf']),
  ('planos',       'planos',       false, 20 * 1024 * 1024, ARRAY['application/pdf','image/png','image/jpeg']),
  ('certificados', 'certificados', false, 5  * 1024 * 1024, ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 2. Helper: extraer consultora_id del path del objeto ───
-- Convención: el primer segmento del path es el consultora_id (UUID)
CREATE OR REPLACE FUNCTION public.storage_path_consultora_id(p_path text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  parts text[];
BEGIN
  parts := string_to_array(p_path, '/');
  IF parts IS NULL OR array_length(parts, 1) < 1 THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN parts[1]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;

-- ─── 3. Policies de RLS para los 6 buckets ──────────────────

-- INSERT: usuario debe ser miembro activo de la consultora del path con rol con write
CREATE POLICY "assets: members write insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('logos','consultora','firmas','matriculas','planos','certificados')
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main','full_access_branch','colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- UPDATE: mismo criterio
CREATE POLICY "assets: members write update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('logos','consultora','firmas','matriculas','planos','certificados')
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main','full_access_branch','colaborador')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- DELETE: solo full_access (no colaborador) para evitar borrados accidentales por colabs
CREATE POLICY "assets: admins delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('logos','consultora','firmas','matriculas','planos','certificados')
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main','full_access_branch')
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- SELECT para buckets PRIVADOS: solo miembros activos de la consultora del path
-- (los buckets públicos `logos` y `consultora` no necesitan policy de SELECT — public=true)
CREATE POLICY "assets: members read private" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('firmas','matriculas','planos','certificados')
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- ─── 4. Comentarios para documentación ─────────────────────
COMMENT ON FUNCTION public.storage_path_consultora_id(text) IS
  'Extrae el consultora_id del primer segmento del path de un storage object. Path esperado: {consultora_id}/{entity_type}/{entity_id}/{kind}.{ext}';
