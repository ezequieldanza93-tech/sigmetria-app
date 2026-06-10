-- ============================================================
-- 1FN Fix V5: arrays text[] → tablas hijas
--
-- Problema: columnas text[] son grupos repetidos sin FK,
-- sin metadata por archivo, sin integridad referencial.
-- Patrón correcto ya existe: incidentes_fotos / denuncias_fotos.
--
-- Tablas afectadas:
--   personas_documentos   → personas_documentos_archivos
--   inspecciones          → inspecciones_adjuntos (si existe adjuntos_urls)
--   feedback_clientes     → feedback_clientes_adjuntos (si existe adjuntos_urls)
-- ============================================================


-- ── 1. personas_documentos → personas_documentos_archivos ────

CREATE TABLE public.personas_documentos_archivos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid        NOT NULL REFERENCES public.personas_documentos(id) ON DELETE CASCADE,
  url          text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personas_documentos_archivos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pda_documento_id ON public.personas_documentos_archivos(documento_id);

-- RLS: delegar al acceso de la tabla padre
CREATE POLICY "personas_documentos_archivos: select" ON public.personas_documentos_archivos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.personas_documentos pd
    WHERE pd.id = personas_documentos_archivos.documento_id
  ));

CREATE POLICY "personas_documentos_archivos: insert" ON public.personas_documentos_archivos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.personas_documentos pd
    WHERE pd.id = personas_documentos_archivos.documento_id
  ));

CREATE POLICY "personas_documentos_archivos: update" ON public.personas_documentos_archivos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.personas_documentos pd
    WHERE pd.id = personas_documentos_archivos.documento_id
  ));

CREATE POLICY "personas_documentos_archivos: delete" ON public.personas_documentos_archivos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.personas_documentos pd
    WHERE pd.id = personas_documentos_archivos.documento_id
  ));

-- Migrar desde archivo_url (scalar), solo si la columna aún existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'personas_documentos' AND column_name = 'archivo_url'
  ) THEN
    INSERT INTO public.personas_documentos_archivos (documento_id, url)
    SELECT id, archivo_url
    FROM public.personas_documentos
    WHERE archivo_url IS NOT NULL AND archivo_url <> '';
  END IF;
END;
$$;

-- Migrar desde archivo_urls (array), solo si la columna aún existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'personas_documentos' AND column_name = 'archivo_urls'
  ) THEN
    INSERT INTO public.personas_documentos_archivos (documento_id, url)
    SELECT pd.id, unnest(pd.archivo_urls)
    FROM public.personas_documentos pd
    WHERE array_length(pd.archivo_urls, 1) > 0;
  END IF;
END;
$$;

-- Deduplicar: FASE 6 copió archivo_url dentro de archivo_urls,
-- por lo que ambas fuentes pueden producir la misma URL
WITH dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY documento_id, url ORDER BY created_at, id) AS rn
  FROM public.personas_documentos_archivos
)
DELETE FROM public.personas_documentos_archivos
WHERE id IN (SELECT id FROM dupes WHERE rn > 1);

-- Dropear columnas legacy
ALTER TABLE public.personas_documentos DROP COLUMN IF EXISTS archivo_url;
ALTER TABLE public.personas_documentos DROP COLUMN IF EXISTS archivo_urls;


-- ── 2. inspecciones → inspecciones_adjuntos ──────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'inspecciones'
      AND column_name  = 'adjuntos_urls'
  ) THEN
    CREATE TABLE public.inspecciones_adjuntos (
      id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      inspeccion_id uuid        NOT NULL REFERENCES public.inspecciones(id) ON DELETE CASCADE,
      url           text        NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.inspecciones_adjuntos ENABLE ROW LEVEL SECURITY;

    CREATE INDEX idx_insp_adj_inspeccion_id ON public.inspecciones_adjuntos(inspeccion_id);

    INSERT INTO public.inspecciones_adjuntos (inspeccion_id, url)
    SELECT id, unnest(adjuntos_urls)
    FROM public.inspecciones
    WHERE array_length(adjuntos_urls, 1) > 0;

    ALTER TABLE public.inspecciones DROP COLUMN adjuntos_urls;

    RAISE NOTICE 'inspecciones.adjuntos_urls → inspecciones_adjuntos: OK';
  ELSE
    RAISE NOTICE 'inspecciones.adjuntos_urls no existe — skip';
  END IF;
END;
$$;


-- ── 3. establecimientos_feedback_clientes → feedback_clientes_adjuntos ────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'establecimientos_feedback_clientes'
      AND column_name  = 'adjuntos_urls'
  ) THEN
    CREATE TABLE public.feedback_clientes_adjuntos (
      id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
      feedback_id uuid        NOT NULL REFERENCES public.establecimientos_feedback_clientes(id) ON DELETE CASCADE,
      url         text        NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.feedback_clientes_adjuntos ENABLE ROW LEVEL SECURITY;

    CREATE INDEX idx_fca_feedback_id ON public.feedback_clientes_adjuntos(feedback_id);

    INSERT INTO public.feedback_clientes_adjuntos (feedback_id, url)
    SELECT id, unnest(adjuntos_urls)
    FROM public.establecimientos_feedback_clientes
    WHERE array_length(adjuntos_urls, 1) > 0;

    ALTER TABLE public.establecimientos_feedback_clientes DROP COLUMN adjuntos_urls;

    RAISE NOTICE 'establecimientos_feedback_clientes.adjuntos_urls → feedback_clientes_adjuntos: OK';
  ELSE
    RAISE NOTICE 'establecimientos_feedback_clientes.adjuntos_urls no existe — skip';
  END IF;
END;
$$;
