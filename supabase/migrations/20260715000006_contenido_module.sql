-- ============================================================
-- Módulo CONTENIDO — planificación de contenido de redes sociales
-- Nivel: CONSULTORA (no empresa ni establecimiento)
-- ============================================================
-- Por qué: las consultoras planifican, previsualizan y almacenan contenido
-- de redes (imágenes/videos + copy + hashtags) antes de publicarlo a mano.
-- Esquema en 3FN: catálogos en tablas propias, sin columnas multivaluadas,
-- FK con integridad referencial en todas las relaciones. El canal se DERIVA
-- del formato (formato_id → canal_id) para no duplicar canal en publicaciones.
--
-- Scope/acceso: solo miembros con rol full_access (full_access_main /
-- full_access_branch) de la consultora, o developer. Espejo del gate del
-- sidebar y del redirect server-side.
--
-- Naming: todo prefijado `contenido_` para no colisionar en el schema public
-- (147+ migraciones). Nombres genéricos (estados, canales, hashtags) sueltos
-- son una bomba de tiempo en un schema compartido.
--
-- Idempotente: IF NOT EXISTS en tablas/índices, DROP POLICY IF EXISTS antes de
-- CREATE, seed con ON CONFLICT DO NOTHING. Re-correr no rompe nada.
-- ============================================================

-- ─── Helper de acceso: ¿el usuario actual es admin (full_access) de esta consultora? ───
-- Reutiliza get_consultora_role() (devuelve el rol del user en la consultora o NULL).
CREATE OR REPLACE FUNCTION public.contenido_can_manage(p_consultora_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    public.is_developer()
    OR public.get_consultora_role(p_consultora_id) IN ('full_access_main','full_access_branch')
$$;

COMMENT ON FUNCTION public.contenido_can_manage(uuid) IS
  'TRUE si el usuario actual es admin full_access de la consultora (o developer). Gate único del módulo Contenido (lectura y escritura).';

-- ============================================================
-- 1. CATÁLOGOS (datos de referencia globales, read-only para la app)
-- ============================================================

-- ─── Canales ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contenido_canales (
  id     smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug   text NOT NULL UNIQUE,
  nombre text NOT NULL
);
COMMENT ON TABLE public.contenido_canales IS 'Catálogo de canales/redes (instagram, youtube, linkedin, tiktok, facebook, blog).';

-- ─── Formatos (cada formato pertenece a un canal) ───────────
-- Elimina la dependencia transitiva canal↔formato en publicaciones.
CREATE TABLE IF NOT EXISTS public.contenido_formatos (
  id               smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canal_id         smallint NOT NULL REFERENCES public.contenido_canales(id) ON DELETE CASCADE,
  slug             text NOT NULL,
  nombre           text NOT NULL,
  ancho_px         int,
  alto_px          int,
  relacion_aspecto text,
  UNIQUE (canal_id, slug)
);
COMMENT ON TABLE public.contenido_formatos IS 'Catálogo de formatos por canal (carrusel, reel, post, short, historia, documento, articulo, etc.) con dimensiones.';

-- ─── Estados (workflow de la publicación) ───────────────────
CREATE TABLE IF NOT EXISTS public.contenido_estados (
  id     smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug   text NOT NULL UNIQUE,
  nombre text NOT NULL,
  orden  smallint NOT NULL
);
COMMENT ON TABLE public.contenido_estados IS 'Catálogo de estados del workflow (idea, borrador, visual_listo, aprobado, programado, publicado).';

-- ─── Tipos de media ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contenido_tipos_media (
  id     smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug   text NOT NULL UNIQUE,
  nombre text NOT NULL
);
COMMENT ON TABLE public.contenido_tipos_media IS 'Catálogo de tipos de media (imagen, video).';

-- ============================================================
-- 2. TABLA PRINCIPAL + RELACIONADAS
-- ============================================================

-- ─── Publicaciones ──────────────────────────────────────────
-- El canal NO se guarda acá: se deriva de formato_id → canal_id (sin redundancia).
CREATE TABLE IF NOT EXISTS public.contenido_publicaciones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id    uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  formato_id       smallint NOT NULL REFERENCES public.contenido_formatos(id),
  estado_id        smallint NOT NULL REFERENCES public.contenido_estados(id),
  titulo           text NOT NULL,
  descripcion      text,
  fecha_programada timestamptz,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.contenido_publicaciones IS 'Publicación de redes de una consultora. Canal derivado de formato_id. Scope: consultora.';

CREATE INDEX IF NOT EXISTS idx_contenido_pub_consultora
  ON public.contenido_publicaciones (consultora_id);
CREATE INDEX IF NOT EXISTS idx_contenido_pub_calendario
  ON public.contenido_publicaciones (consultora_id, fecha_programada);
CREATE INDEX IF NOT EXISTS idx_contenido_pub_formato
  ON public.contenido_publicaciones (formato_id);
CREATE INDEX IF NOT EXISTS idx_contenido_pub_estado
  ON public.contenido_publicaciones (estado_id);

-- ─── Media (1 publicación → N archivos, ordenados para carruseles) ───
CREATE TABLE IF NOT EXISTS public.contenido_publicacion_media (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id uuid NOT NULL REFERENCES public.contenido_publicaciones(id) ON DELETE CASCADE,
  orden          smallint NOT NULL DEFAULT 0,
  tipo_media_id  smallint NOT NULL REFERENCES public.contenido_tipos_media(id),
  storage_path   text NOT NULL,
  width          int,
  height         int,
  size_bytes     bigint,
  mime           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publicacion_id, orden)
);
COMMENT ON TABLE public.contenido_publicacion_media IS 'Archivos de media de una publicación (imagen/video). `orden` define la secuencia del carrusel.';
COMMENT ON COLUMN public.contenido_publicacion_media.storage_path IS 'Path relativo dentro del bucket `contenido` (NO URL). Convención: {consultora_id}/contenido/{publicacion_id}/{id}.{ext}';

CREATE INDEX IF NOT EXISTS idx_contenido_media_publicacion
  ON public.contenido_publicacion_media (publicacion_id, orden);

-- ─── Hashtags (vocabulario normalizado, N a N) ──────────────
CREATE TABLE IF NOT EXISTS public.contenido_hashtags (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL UNIQUE
);
COMMENT ON TABLE public.contenido_hashtags IS 'Vocabulario de hashtags normalizado (texto único, sin el #). Compartido entre publicaciones vía junction.';

CREATE TABLE IF NOT EXISTS public.contenido_publicacion_hashtags (
  publicacion_id uuid NOT NULL REFERENCES public.contenido_publicaciones(id) ON DELETE CASCADE,
  hashtag_id     uuid NOT NULL REFERENCES public.contenido_hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (publicacion_id, hashtag_id)
);
COMMENT ON TABLE public.contenido_publicacion_hashtags IS 'Relación N:N publicación↔hashtag. PK compuesta.';

CREATE INDEX IF NOT EXISTS idx_contenido_pub_hashtags_hashtag
  ON public.contenido_publicacion_hashtags (hashtag_id);

-- ─── Trigger updated_at en publicaciones ────────────────────
CREATE OR REPLACE TRIGGER set_updated_at
  BEFORE UPDATE ON public.contenido_publicaciones
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE public.contenido_canales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contenido_formatos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contenido_estados            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contenido_tipos_media        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contenido_publicaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contenido_publicacion_media  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contenido_hashtags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contenido_publicacion_hashtags ENABLE ROW LEVEL SECURITY;

-- ─── Catálogos: lectura para cualquier autenticado, sin escritura desde la app ───
-- (el seed corre con service role, que bypassa RLS)
DROP POLICY IF EXISTS "contenido_canales: read" ON public.contenido_canales;
CREATE POLICY "contenido_canales: read" ON public.contenido_canales
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contenido_formatos: read" ON public.contenido_formatos;
CREATE POLICY "contenido_formatos: read" ON public.contenido_formatos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contenido_estados: read" ON public.contenido_estados;
CREATE POLICY "contenido_estados: read" ON public.contenido_estados
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contenido_tipos_media: read" ON public.contenido_tipos_media;
CREATE POLICY "contenido_tipos_media: read" ON public.contenido_tipos_media
  FOR SELECT TO authenticated USING (true);

-- ─── Publicaciones: solo admins full_access de la consultora ───
DROP POLICY IF EXISTS "contenido_publicaciones: select" ON public.contenido_publicaciones;
CREATE POLICY "contenido_publicaciones: select" ON public.contenido_publicaciones
  FOR SELECT USING (public.contenido_can_manage(consultora_id));

DROP POLICY IF EXISTS "contenido_publicaciones: insert" ON public.contenido_publicaciones;
CREATE POLICY "contenido_publicaciones: insert" ON public.contenido_publicaciones
  FOR INSERT WITH CHECK (public.contenido_can_manage(consultora_id));

DROP POLICY IF EXISTS "contenido_publicaciones: update" ON public.contenido_publicaciones;
CREATE POLICY "contenido_publicaciones: update" ON public.contenido_publicaciones
  FOR UPDATE USING (public.contenido_can_manage(consultora_id))
  WITH CHECK (public.contenido_can_manage(consultora_id));

DROP POLICY IF EXISTS "contenido_publicaciones: delete" ON public.contenido_publicaciones;
CREATE POLICY "contenido_publicaciones: delete" ON public.contenido_publicaciones
  FOR DELETE USING (public.contenido_can_manage(consultora_id));

-- ─── Media: tenant derivado vía publicacion_id → publicaciones.consultora_id ───
DROP POLICY IF EXISTS "contenido_media: select" ON public.contenido_publicacion_media;
CREATE POLICY "contenido_media: select" ON public.contenido_publicacion_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contenido_publicaciones p
      WHERE p.id = publicacion_id AND public.contenido_can_manage(p.consultora_id)
    )
  );

DROP POLICY IF EXISTS "contenido_media: insert" ON public.contenido_publicacion_media;
CREATE POLICY "contenido_media: insert" ON public.contenido_publicacion_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contenido_publicaciones p
      WHERE p.id = publicacion_id AND public.contenido_can_manage(p.consultora_id)
    )
  );

DROP POLICY IF EXISTS "contenido_media: update" ON public.contenido_publicacion_media;
CREATE POLICY "contenido_media: update" ON public.contenido_publicacion_media
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.contenido_publicaciones p
      WHERE p.id = publicacion_id AND public.contenido_can_manage(p.consultora_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contenido_publicaciones p
      WHERE p.id = publicacion_id AND public.contenido_can_manage(p.consultora_id)
    )
  );

DROP POLICY IF EXISTS "contenido_media: delete" ON public.contenido_publicacion_media;
CREATE POLICY "contenido_media: delete" ON public.contenido_publicacion_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.contenido_publicaciones p
      WHERE p.id = publicacion_id AND public.contenido_can_manage(p.consultora_id)
    )
  );

-- ─── Hashtags: vocabulario compartido. Lectura + alta para autenticados (find-or-create) ───
DROP POLICY IF EXISTS "contenido_hashtags: read" ON public.contenido_hashtags;
CREATE POLICY "contenido_hashtags: read" ON public.contenido_hashtags
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contenido_hashtags: insert" ON public.contenido_hashtags;
CREATE POLICY "contenido_hashtags: insert" ON public.contenido_hashtags
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─── Junction hashtags: tenant derivado vía publicacion_id ───
DROP POLICY IF EXISTS "contenido_pub_hashtags: select" ON public.contenido_publicacion_hashtags;
CREATE POLICY "contenido_pub_hashtags: select" ON public.contenido_publicacion_hashtags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contenido_publicaciones p
      WHERE p.id = publicacion_id AND public.contenido_can_manage(p.consultora_id)
    )
  );

DROP POLICY IF EXISTS "contenido_pub_hashtags: insert" ON public.contenido_publicacion_hashtags;
CREATE POLICY "contenido_pub_hashtags: insert" ON public.contenido_publicacion_hashtags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contenido_publicaciones p
      WHERE p.id = publicacion_id AND public.contenido_can_manage(p.consultora_id)
    )
  );

DROP POLICY IF EXISTS "contenido_pub_hashtags: delete" ON public.contenido_publicacion_hashtags;
CREATE POLICY "contenido_pub_hashtags: delete" ON public.contenido_publicacion_hashtags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.contenido_publicaciones p
      WHERE p.id = publicacion_id AND public.contenido_can_manage(p.consultora_id)
    )
  );

-- ============================================================
-- 4. STORAGE — bucket privado `contenido`
-- ============================================================
-- Path: {consultora_id}/contenido/{publicacion_id}/{media_id}.{ext}
-- Acceso: solo admins full_access de la consultora del path (o developer).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contenido', 'contenido', false,
  314572800,  -- 300 MB (videos de reels/shorts)
  ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "contenido bucket: select" ON storage.objects;
CREATE POLICY "contenido bucket: select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contenido'
    AND public.contenido_can_manage(public.storage_path_consultora_id(name))
  );

DROP POLICY IF EXISTS "contenido bucket: insert" ON storage.objects;
CREATE POLICY "contenido bucket: insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contenido'
    AND public.contenido_can_manage(public.storage_path_consultora_id(name))
  );

DROP POLICY IF EXISTS "contenido bucket: update" ON storage.objects;
CREATE POLICY "contenido bucket: update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contenido'
    AND public.contenido_can_manage(public.storage_path_consultora_id(name))
  );

DROP POLICY IF EXISTS "contenido bucket: delete" ON storage.objects;
CREATE POLICY "contenido bucket: delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contenido'
    AND public.contenido_can_manage(public.storage_path_consultora_id(name))
  );

-- ============================================================
-- 5. SEED de catálogos (idempotente)
-- ============================================================

-- ─── Canales ────────────────────────────────────────────────
INSERT INTO public.contenido_canales (slug, nombre) VALUES
  ('instagram', 'Instagram'),
  ('youtube',   'YouTube'),
  ('linkedin',  'LinkedIn'),
  ('tiktok',    'TikTok'),
  ('facebook',  'Facebook'),
  ('blog',      'Blog')
ON CONFLICT (slug) DO NOTHING;

-- ─── Tipos de media ─────────────────────────────────────────
INSERT INTO public.contenido_tipos_media (slug, nombre) VALUES
  ('imagen', 'Imagen'),
  ('video',  'Video')
ON CONFLICT (slug) DO NOTHING;

-- ─── Estados ────────────────────────────────────────────────
INSERT INTO public.contenido_estados (slug, nombre, orden) VALUES
  ('idea',         'Idea',          1),
  ('borrador',     'Borrador',      2),
  ('visual_listo', 'Visual listo',  3),
  ('aprobado',     'Aprobado',      4),
  ('programado',   'Programado',    5),
  ('publicado',    'Publicado',     6)
ON CONFLICT (slug) DO NOTHING;

-- ─── Formatos por canal ─────────────────────────────────────
-- canal_id resuelto por subquery sobre el slug del canal.
INSERT INTO public.contenido_formatos (canal_id, slug, nombre, ancho_px, alto_px, relacion_aspecto)
SELECT c.id, f.slug, f.nombre, f.ancho_px, f.alto_px, f.relacion_aspecto
FROM (VALUES
  -- Instagram
  ('instagram', 'carrusel_cuadrado', 'Carrusel (1:1)',   1080, 1080, '1:1'),
  ('instagram', 'carrusel_vertical', 'Carrusel (4:5)',   1080, 1350, '4:5'),
  ('instagram', 'reel',              'Reel',             1080, 1920, '9:16'),
  ('instagram', 'post',              'Post feed',        1080, 1080, '1:1'),
  ('instagram', 'historia',          'Historia',         1080, 1920, '9:16'),
  -- YouTube
  ('youtube',   'video',             'Video',            1280,  720, '16:9'),
  ('youtube',   'short',             'Short',            1080, 1920, '9:16'),
  -- LinkedIn
  ('linkedin',  'post',              'Post',             1200,  627, '1.91:1'),
  ('linkedin',  'documento',         'Documento/Carrusel',1080,1080, '1:1'),
  ('linkedin',  'video',             'Video',            1280,  720, '16:9'),
  -- TikTok
  ('tiktok',    'video',             'Video',            1080, 1920, '9:16'),
  -- Facebook
  ('facebook',  'post',              'Post',             1200,  630, '1.91:1'),
  -- Blog
  ('blog',      'articulo',          'Artículo',         1200,  630, '1.91:1')
) AS f(canal_slug, slug, nombre, ancho_px, alto_px, relacion_aspecto)
JOIN public.contenido_canales c ON c.slug = f.canal_slug
ON CONFLICT (canal_id, slug) DO NOTHING;
