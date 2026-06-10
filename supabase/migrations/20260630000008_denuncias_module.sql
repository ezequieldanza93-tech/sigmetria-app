-- ============================================================
-- Módulo Denuncias — Rediseño completo
--
-- Reemplaza la tabla provisional establecimientos_denuncias por
-- el módulo completo: denuncias + denuncias_fotos + denuncias_historial.
--
-- La tabla denuncias fue creada en 20260529000001 y dropeada en
-- 20260614000001 (redesign pendiente). Este migration la recrea
-- con establecimiento_id NOT NULL (siempre opera desde contexto
-- de establecimiento) y sin historial_estados JSONB (va directo
-- a tabla normalizada denuncias_historial).
--
-- La migración de datos desde establecimientos_denuncias es
-- condicional — si la tabla no existe (ya dropeada), se omite.
-- ============================================================


-- ── 1. denuncias ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.denuncias (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id           UUID        NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  empresa_id              UUID        NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  establecimiento_id      UUID        NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  titulo                  TEXT,
  descripcion             TEXT        NOT NULL,
  tipo_denuncia           TEXT        CHECK (tipo_denuncia IN (
    'laboral','acoso','condiciones_inseguras',
    'incumplimiento_normativo','conducta','otro'
  )),
  denunciante_tipo        TEXT        NOT NULL DEFAULT 'interno' CHECK (denunciante_tipo IN (
    'interno','externo','anonimo'
  )),
  persona_id              UUID        REFERENCES public.personas_directorio(id) ON DELETE SET NULL,
  denunciante_nombre      TEXT,
  fecha_denuncia          DATE        NOT NULL DEFAULT CURRENT_DATE,
  estado                  TEXT        NOT NULL DEFAULT 'recibida' CHECK (estado IN (
    'recibida','en_analisis','accion_planificada','implementada','cerrada'
  )),
  confidencial            BOOLEAN     NOT NULL DEFAULT false,
  responsable_asignado_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  acciones_tomadas        TEXT,
  conclusion              TEXT,
  cerrado_por             UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  fecha_cierre            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denuncias_consultora       ON public.denuncias(consultora_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_empresa          ON public.denuncias(empresa_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_establecimiento  ON public.denuncias(establecimiento_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_estado           ON public.denuncias(estado);
CREATE INDEX IF NOT EXISTS idx_denuncias_created_at       ON public.denuncias(created_at DESC);


-- ── 2. denuncias_fotos ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.denuncias_fotos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id UUID        NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  filename    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_denuncias_fotos_denuncia ON public.denuncias_fotos(denuncia_id);


-- ── 3. denuncias_historial ────────────────────────────────────
-- 20260630000006 intentó crear esta tabla pero la omitió porque
-- denuncias no existía aún. La creamos aquí directamente.

CREATE TABLE IF NOT EXISTS public.denuncias_historial (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id  UUID        NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  estado       TEXT        NOT NULL CHECK (estado IN (
    'recibida','en_analisis','accion_planificada','implementada','cerrada'
  )),
  cambiado_por UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  nota         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.denuncias_historial ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_den_hist_denuncia ON public.denuncias_historial(denuncia_id);
CREATE INDEX IF NOT EXISTS idx_den_hist_created  ON public.denuncias_historial(created_at DESC);

DROP POLICY IF EXISTS "denuncias_historial: select" ON public.denuncias_historial;
CREATE POLICY "denuncias_historial: select" ON public.denuncias_historial FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_historial.denuncia_id
      AND has_establecimiento_read_access(d.establecimiento_id)
  ));

DROP POLICY IF EXISTS "denuncias_historial: insert" ON public.denuncias_historial;
CREATE POLICY "denuncias_historial: insert" ON public.denuncias_historial FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncia_id
      AND has_establecimiento_write_access(d.establecimiento_id)
  ));


-- ── 4. updated_at trigger ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_denuncias_updated_at ON public.denuncias;
CREATE TRIGGER trg_denuncias_updated_at
  BEFORE UPDATE ON public.denuncias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── 5. RLS — denuncias ────────────────────────────────────────

ALTER TABLE public.denuncias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "denuncias: select" ON public.denuncias;
CREATE POLICY "denuncias: select" ON public.denuncias FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));

DROP POLICY IF EXISTS "denuncias: insert" ON public.denuncias;
CREATE POLICY "denuncias: insert" ON public.denuncias FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "denuncias: update" ON public.denuncias;
CREATE POLICY "denuncias: update" ON public.denuncias FOR UPDATE
  USING (has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "denuncias: delete" ON public.denuncias;
CREATE POLICY "denuncias: delete" ON public.denuncias FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));


-- ── 6. RLS — denuncias_fotos ──────────────────────────────────

ALTER TABLE public.denuncias_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "denuncias_fotos: select" ON public.denuncias_fotos;
CREATE POLICY "denuncias_fotos: select" ON public.denuncias_fotos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_fotos.denuncia_id
      AND has_establecimiento_read_access(d.establecimiento_id)
  ));

DROP POLICY IF EXISTS "denuncias_fotos: insert" ON public.denuncias_fotos;
CREATE POLICY "denuncias_fotos: insert" ON public.denuncias_fotos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncia_id
      AND has_establecimiento_write_access(d.establecimiento_id)
  ));

DROP POLICY IF EXISTS "denuncias_fotos: delete" ON public.denuncias_fotos;
CREATE POLICY "denuncias_fotos: delete" ON public.denuncias_fotos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_fotos.denuncia_id
      AND has_establecimiento_write_access(d.establecimiento_id)
  ));


-- ── 7. Storage bucket ─────────────────────────────────────────
-- El bucket puede existir si sobrevivió al drop de 20260614000001
-- (las políticas fueron dropeadas pero el bucket no).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'denuncias', 'denuncias', false, 10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "denuncias storage: select" ON storage.objects;
CREATE POLICY "denuncias storage: select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'denuncias'
    AND has_establecimiento_read_access(
      (SELECT establecimiento_id FROM public.denuncias
        WHERE id = (storage.foldername(objects.name))[2]::uuid)
    )
  );

DROP POLICY IF EXISTS "denuncias storage: insert" ON storage.objects;
CREATE POLICY "denuncias storage: insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'denuncias'
    AND has_establecimiento_write_access(
      (SELECT establecimiento_id FROM public.denuncias
        WHERE id = (storage.foldername(name))[2]::uuid)
    )
  );

DROP POLICY IF EXISTS "denuncias storage: delete" ON storage.objects;
CREATE POLICY "denuncias storage: delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'denuncias'
    AND has_establecimiento_write_access(
      (SELECT establecimiento_id FROM public.denuncias
        WHERE id = (storage.foldername(objects.name))[2]::uuid)
    )
  );


-- ── 8. Migración de datos desde establecimientos_denuncias ────
-- Construcción dinámica para manejar schemas variables en prod.
-- (la tabla fue creada por MCP y puede no tener todas las columnas)

DO $$
DECLARE
  has_persona_id boolean := FALSE;
  has_fecha      boolean := FALSE;
  sql_insert     text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'establecimientos_denuncias'
  ) THEN
    RAISE NOTICE 'establecimientos_denuncias no existe — migración de datos omitida';
    RETURN;
  END IF;

  -- Skip si ya migramos (evita duplicados en re-runs)
  IF EXISTS (SELECT 1 FROM public.denuncias LIMIT 1) THEN
    RAISE NOTICE 'denuncias ya tiene filas — migración de datos omitida';
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establecimientos_denuncias' AND column_name = 'persona_id'
  ) INTO has_persona_id;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'establecimientos_denuncias' AND column_name = 'fecha'
  ) INTO has_fecha;

  -- Columna temporal para correlacionar adjuntos
  ALTER TABLE public.denuncias ADD COLUMN IF NOT EXISTS _legacy_id UUID;

  -- Construir INSERT dinámico según columnas disponibles
  sql_insert :=
    'INSERT INTO public.denuncias (consultora_id, empresa_id, establecimiento_id, descripcion, '
    || CASE WHEN has_persona_id THEN 'persona_id, ' ELSE '' END
    || 'fecha_denuncia, created_at, updated_at, _legacy_id) '
    || 'SELECT emp.consultora_id, est.empresa_id, ed.establecimiento_id, ed.descripcion, '
    || CASE WHEN has_persona_id THEN 'ed.persona_id, ' ELSE '' END
    || CASE WHEN has_fecha THEN 'ed.fecha::date, ' ELSE 'CURRENT_DATE, ' END
    || 'ed.created_at, ed.created_at, ed.id '
    || 'FROM public.establecimientos_denuncias ed '
    || 'JOIN public.establecimientos est ON est.id = ed.establecimiento_id '
    || 'JOIN public.empresas emp ON emp.id = est.empresa_id';

  EXECUTE sql_insert;

  -- Migrar adjuntos_urls[] → denuncias_fotos
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'establecimientos_denuncias'
      AND column_name = 'adjuntos_urls'
  ) THEN
    EXECUTE $q$
      INSERT INTO public.denuncias_fotos (denuncia_id, url)
      SELECT d.id, unnest(ed.adjuntos_urls)
      FROM public.establecimientos_denuncias ed
      JOIN public.denuncias d ON d._legacy_id = ed.id
      WHERE ed.adjuntos_urls IS NOT NULL
        AND array_length(ed.adjuntos_urls, 1) > 0
    $q$;
  END IF;

  -- Limpiar columna temporal
  ALTER TABLE public.denuncias DROP COLUMN IF EXISTS _legacy_id;

  RAISE NOTICE 'establecimientos_denuncias → denuncias: migración completada';
END;
$$;
