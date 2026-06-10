-- ============================================================
-- 1FN / 3FN Fix V8: historial_estados JSONB → tablas de audit
--
-- Problema: historial_estados JSONB es un grupo repetido
-- embebido sin FK, sin integridad por actor, no consultable
-- con WHERE, ORDER BY, ni JOIN. El patrón correcto ya existe
-- en este mismo schema: subscription_audit_log, iperc_historial_estados.
--
-- Estructura JSON asumida (la que escribe la app):
--   [{ "estado": "...", "fecha": "ISO8601", "usuario_id": "uuid", "nota": "..." }]
--
-- IMPORTANTE: historial_estados NO se dropea en esta migración.
-- Descomentar los DROP COLUMN al final una vez que el código
-- de la aplicación haya migrado a leer de las nuevas tablas.
--
-- NOTA: incidentes usa establecimiento_id (viene del rename de siniestros).
-- denuncias_historial solo se crea si la tabla denuncias existe.
-- ============================================================


-- ── 1. incidentes_historial ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.incidentes_historial (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incidente_id uuid        NOT NULL REFERENCES public.incidentes(id) ON DELETE CASCADE,
  estado       text        NOT NULL CHECK (estado IN (
    'recibida','en_analisis','accion_planificada','implementada','cerrada'
  )),
  cambiado_por uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  nota         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidentes_historial ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inc_hist_incidente ON public.incidentes_historial(incidente_id);
CREATE INDEX IF NOT EXISTS idx_inc_hist_created   ON public.incidentes_historial(created_at DESC);

-- Migrar entradas válidas desde JSONB (solo si historial_estados aún existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidentes' AND column_name = 'historial_estados'
  ) THEN
    INSERT INTO public.incidentes_historial (incidente_id, estado, cambiado_por, nota, created_at)
    SELECT
      i.id,
      (entry->>'estado'),
      CASE
        WHEN (entry->>'usuario_id') ~ '^[0-9a-f-]{36}$'
        THEN (entry->>'usuario_id')::uuid
        ELSE NULL
      END,
      NULLIF(trim(entry->>'nota'), ''),
      CASE
        WHEN entry->>'fecha' IS NOT NULL
        THEN (entry->>'fecha')::timestamptz
        ELSE i.created_at
      END
    FROM public.incidentes i,
      jsonb_array_elements(i.historial_estados) AS entry
    WHERE jsonb_array_length(i.historial_estados) > 0
      AND (entry->>'estado') IN (
        'recibida','en_analisis','accion_planificada','implementada','cerrada'
      );
  END IF;
END;
$$;

-- RLS: heredar acceso vía incidente padre (incidentes usa establecimiento_id)
DROP POLICY IF EXISTS "incidentes_historial: select" ON public.incidentes_historial;
CREATE POLICY "incidentes_historial: select" ON public.incidentes_historial FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_historial.incidente_id
      AND has_establecimiento_read_access(i.establecimiento_id)
  ));

DROP POLICY IF EXISTS "incidentes_historial: insert" ON public.incidentes_historial;
CREATE POLICY "incidentes_historial: insert" ON public.incidentes_historial FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidente_id
      AND has_establecimiento_write_access(i.establecimiento_id)
  ));


-- ── 2. denuncias_historial (solo si denuncias existe) ─────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'denuncias'
  ) THEN
    RAISE NOTICE 'denuncias no existe — se omite denuncias_historial';
    RETURN;
  END IF;

  -- Crear tabla
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'denuncias_historial'
  ) THEN
    EXECUTE '
      CREATE TABLE public.denuncias_historial (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        denuncia_id  uuid        NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
        estado       text        NOT NULL CHECK (estado IN (
          ''recibida'',''en_analisis'',''accion_planificada'',''implementada'',''cerrada''
        )),
        cambiado_por uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
        nota         text,
        created_at   timestamptz NOT NULL DEFAULT now()
      )
    ';
  END IF;

  EXECUTE 'ALTER TABLE public.denuncias_historial ENABLE ROW LEVEL SECURITY';

  -- Indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_den_hist_denuncia') THEN
    EXECUTE 'CREATE INDEX idx_den_hist_denuncia ON public.denuncias_historial(denuncia_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_den_hist_created') THEN
    EXECUTE 'CREATE INDEX idx_den_hist_created ON public.denuncias_historial(created_at DESC)';
  END IF;

  -- Migrar desde JSONB si historial_estados existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'denuncias' AND column_name = 'historial_estados'
  ) THEN
    INSERT INTO public.denuncias_historial (denuncia_id, estado, cambiado_por, nota, created_at)
    SELECT
      d.id,
      (entry->>'estado'),
      CASE
        WHEN (entry->>'usuario_id') ~ '^[0-9a-f-]{36}$'
        THEN (entry->>'usuario_id')::uuid
        ELSE NULL
      END,
      NULLIF(trim(entry->>'nota'), ''),
      CASE
        WHEN entry->>'fecha' IS NOT NULL
        THEN (entry->>'fecha')::timestamptz
        ELSE d.created_at
      END
    FROM public.denuncias d,
      jsonb_array_elements(d.historial_estados) AS entry
    WHERE jsonb_array_length(d.historial_estados) > 0
      AND (entry->>'estado') IN (
        'recibida','en_analisis','accion_planificada','implementada','cerrada'
      );
  END IF;

  -- RLS policies
  EXECUTE 'DROP POLICY IF EXISTS "denuncias_historial: select" ON public.denuncias_historial';
  EXECUTE '
    CREATE POLICY "denuncias_historial: select" ON public.denuncias_historial FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.denuncias d
        WHERE d.id = denuncias_historial.denuncia_id
          AND has_establecimiento_read_access(d.establecimiento_id)
      ))
  ';

  EXECUTE 'DROP POLICY IF EXISTS "denuncias_historial: insert" ON public.denuncias_historial';
  EXECUTE '
    CREATE POLICY "denuncias_historial: insert" ON public.denuncias_historial FOR INSERT
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.denuncias d
        WHERE d.id = denuncia_id
          AND has_establecimiento_write_access(d.establecimiento_id)
      ))
  ';
END;
$$;


-- ── 3. Trigger: mantener historial_estados en sync (transición) ─
-- Solo se crea si historial_estados aún existe.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidentes' AND column_name = 'historial_estados'
  ) THEN
    CREATE OR REPLACE FUNCTION public.sync_incidente_historial_to_jsonb()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.estado <> OLD.estado THEN
        NEW.historial_estados := NEW.historial_estados || jsonb_build_object(
          'estado',     NEW.estado,
          'fecha',      now(),
          'usuario_id', auth.uid()
        );
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_incidente_historial_jsonb ON public.incidentes;
    CREATE TRIGGER trg_incidente_historial_jsonb
      BEFORE UPDATE OF estado ON public.incidentes
      FOR EACH ROW EXECUTE FUNCTION public.sync_incidente_historial_to_jsonb();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'denuncias'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'denuncias' AND column_name = 'historial_estados'
  ) THEN
    CREATE OR REPLACE FUNCTION public.sync_denuncia_historial_to_jsonb()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.estado <> OLD.estado THEN
        NEW.historial_estados := NEW.historial_estados || jsonb_build_object(
          'estado',     NEW.estado,
          'fecha',      now(),
          'usuario_id', auth.uid()
        );
      END IF;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS trg_denuncia_historial_jsonb ON public.denuncias;
    CREATE TRIGGER trg_denuncia_historial_jsonb
      BEFORE UPDATE OF estado ON public.denuncias
      FOR EACH ROW EXECUTE FUNCTION public.sync_denuncia_historial_to_jsonb();
  END IF;
END;
$$;


-- ── 4. DROP COLUMN (descomentar cuando la app use las nuevas tablas) ─

-- ALTER TABLE public.incidentes DROP COLUMN historial_estados;
-- ALTER TABLE public.denuncias  DROP COLUMN historial_estados;
-- DROP TRIGGER IF EXISTS trg_incidente_historial_jsonb ON public.incidentes;
-- DROP TRIGGER IF EXISTS trg_denuncia_historial_jsonb  ON public.denuncias;
-- DROP FUNCTION IF EXISTS public.sync_incidente_historial_to_jsonb();
-- DROP FUNCTION IF EXISTS public.sync_denuncia_historial_to_jsonb();
