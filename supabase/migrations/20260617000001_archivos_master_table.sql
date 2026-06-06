-- ============================================================
-- Tabla maestra de ARCHIVOS — registro central de todos los uploads
-- ============================================================
-- Por qué: hoy los archivos viven dispersos en columnas *_url de cada tabla.
-- No hay forma de listar, auditar ni hacer GC de huérfanos. Esta tabla es el
-- índice central: cada subida (vía lib/storage/upload.ts) se registra acá con
-- {bucket, path, size, mime, entity, uploaded_by}.
--
-- Convención de path (igual que 20260521172801): el primer segmento del path
-- es el consultora_id (UUID) → aislamiento por tenant.
--
-- Idempotente: IF NOT EXISTS en tabla/índices/policies (DROP POLICY IF EXISTS
-- antes de CREATE para poder re-correr).
-- ============================================================

-- ─── 1. Tabla ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.archivos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  bucket        text NOT NULL,
  path          text NOT NULL,
  size_bytes    bigint,
  mime          text,
  entity_type   text,
  entity_id     uuid,
  uploaded_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- Upsert key: un objeto físico (bucket+path) se registra una sola vez.
-- Permite el ON CONFLICT (bucket, path) que usa lib/storage/upload.ts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_archivos_bucket_path
  ON public.archivos (bucket, path);

-- ─── 2. Índices ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_archivos_consultora
  ON public.archivos (consultora_id);

CREATE INDEX IF NOT EXISTS idx_archivos_entity
  ON public.archivos (entity_type, entity_id);

-- Índice parcial para listados de archivos vigentes (excluye borrados).
CREATE INDEX IF NOT EXISTS idx_archivos_vigentes
  ON public.archivos (consultora_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── 3. RLS ─────────────────────────────────────────────────
ALTER TABLE public.archivos ENABLE ROW LEVEL SECURITY;

-- Helper de tenant: ¿el usuario es miembro activo de esta consultora?
-- (espejo del patrón de consultoras_members usado en el resto del repo).
CREATE OR REPLACE FUNCTION public.is_member_of_consultora(p_consultora_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    public.is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.consultora_id = p_consultora_id
        AND cm.is_active = true
    )
$$;

COMMENT ON FUNCTION public.is_member_of_consultora(uuid) IS
  'TRUE si el usuario actual es miembro activo de la consultora (o developer). Usado por RLS de tablas tenant-scoped por consultora_id.';

-- SELECT: miembros de la consultora ven solo los archivos VIGENTES de su tenant.
DROP POLICY IF EXISTS "archivos: select" ON public.archivos;
CREATE POLICY "archivos: select" ON public.archivos FOR SELECT
  USING (deleted_at IS NULL AND public.is_member_of_consultora(consultora_id));

-- INSERT: miembros de la consultora pueden registrar archivos de su tenant.
DROP POLICY IF EXISTS "archivos: insert" ON public.archivos;
CREATE POLICY "archivos: insert" ON public.archivos FOR INSERT
  WITH CHECK (public.is_member_of_consultora(consultora_id));

-- UPDATE: miembros de la consultora (cubre el soft-delete vía deleted_at).
DROP POLICY IF EXISTS "archivos: update" ON public.archivos;
CREATE POLICY "archivos: update" ON public.archivos FOR UPDATE
  USING (public.is_member_of_consultora(consultora_id))
  WITH CHECK (public.is_member_of_consultora(consultora_id));

-- DELETE: solo developer (el borrado normal es soft vía deleted_at).
DROP POLICY IF EXISTS "archivos: delete" ON public.archivos;
CREATE POLICY "archivos: delete" ON public.archivos FOR DELETE
  USING (public.is_developer());

-- ─── 4. Comentarios ─────────────────────────────────────────
COMMENT ON TABLE public.archivos IS
  'Registro maestro de todos los archivos subidos a Storage. Indexado por consultora y entidad. Resuelve listado/auditoría/GC. Path: {consultora_id}/{entity_type}/{entity_id}/{kind}.{ext}';
COMMENT ON COLUMN public.archivos.bucket IS 'Bucket de Storage donde vive el objeto.';
COMMENT ON COLUMN public.archivos.path IS 'Path relativo del objeto dentro del bucket (NO URL).';
COMMENT ON COLUMN public.archivos.deleted_at IS 'Soft-delete. NULL = vigente. Se setea al reemplazar/borrar el asset.';
