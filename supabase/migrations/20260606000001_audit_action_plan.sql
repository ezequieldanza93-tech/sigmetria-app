-- ============================================================
-- Sigmetría HyS — Plan de Acción de Auditoría
--
-- Aborda los hallazgos del plan de acción priorizados:
--   🔴 1. RLS en tipos_horas
--   🔴 2. Unificar coordenadas (lat/lon duplicadas)
--   🔴 3. Unificar plano_url / floor_plan_pdf_url
--   🟠 4. Eliminar horario_trabajo text (reemplazado por horarios_establecimiento)
--   🟠 5. CHECK constraints de incidentes/denuncias → lookup tables
--   🟡 6. Dropear partición vacía gestiones_registros_2024
--   🟡 7. art_numero_contrato → tabla de relación empresas_art
--   🟡 8. dias_restantes → trigger de cálculo automático
--   🟡 9. Índice compuesto (establecimiento_id, fecha) en mediciones
--   🟢 10. Trigger updated_at en notificaciones
--   🟢 11. Función de monitoreo tablas sin RLS
-- ============================================================

BEGIN;

-- ============================================================
-- 🔴 1. RLS en tipos_horas
-- ============================================================

ALTER TABLE public.tipos_horas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tipos_horas: select" ON public.tipos_horas;

CREATE POLICY "tipos_horas: select"
  ON public.tipos_horas FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tipos_horas: insert" ON public.tipos_horas;

CREATE POLICY "tipos_horas: insert"
  ON public.tipos_horas FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "tipos_horas: update" ON public.tipos_horas;

CREATE POLICY "tipos_horas: update"
  ON public.tipos_horas FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tipos_horas: delete" ON public.tipos_horas;

CREATE POLICY "tipos_horas: delete"
  ON public.tipos_horas FOR DELETE
  TO authenticated
  USING (true);


-- ============================================================
-- 🔴 2. Unificar coordenadas en establecimientos
-- ============================================================
-- Migrar datos de latitude/longitude (numeric) → latitud/longitud (float8)
UPDATE public.establecimientos
SET latitud  = latitude::double precision,
    longitud = longitude::double precision
WHERE latitude IS NOT NULL
  AND latitud IS NULL;

ALTER TABLE public.establecimientos
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude;


-- ============================================================
-- 🔴 3. Unificar plano_url / floor_plan_pdf_url
-- ============================================================
-- Elegimos plano_url como canónica (nomenclatura español)

UPDATE public.establecimientos
SET plano_url = floor_plan_pdf_url
WHERE floor_plan_pdf_url IS NOT NULL
  AND plano_url IS NULL;

ALTER TABLE public.establecimientos
  DROP COLUMN IF EXISTS floor_plan_pdf_url;


-- ============================================================
-- 🟠 4. Eliminar horario_trabajo text de establecimientos
-- ============================================================
-- Reemplazado por horarios_establecimiento (migración 20260518000011)

ALTER TABLE public.establecimientos
  DROP COLUMN IF EXISTS horario_trabajo;


-- ============================================================
-- 🟠 5. Migrar CHECK constraints → lookup tables
-- Tablas: incidentes, denuncias
-- ============================================================

-- 5a. Lookup tables para incidentes
CREATE TABLE IF NOT EXISTS public.incidentes_tipos (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidentes_tipos ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS incidentes_tipos_nombre_key
  ON public.incidentes_tipos (nombre);

CREATE TABLE IF NOT EXISTS public.incidentes_severidad (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidentes_severidad ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS incidentes_severidad_nombre_key
  ON public.incidentes_severidad (nombre);

CREATE TABLE IF NOT EXISTS public.incidentes_estados (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incidentes_estados ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS incidentes_estados_nombre_key
  ON public.incidentes_estados (nombre);

-- 5b. Lookup tables para denuncias
CREATE TABLE IF NOT EXISTS public.denuncias_tipos (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.denuncias_tipos ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS denuncias_tipos_nombre_key
  ON public.denuncias_tipos (nombre);

CREATE TABLE IF NOT EXISTS public.denuncias_estados (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.denuncias_estados ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS denuncias_estados_nombre_key
  ON public.denuncias_estados (nombre);

CREATE TABLE IF NOT EXISTS public.denuncias_denunciante_tipos (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.denuncias_denunciante_tipos ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS denuncias_denunciante_tipos_nombre_key
  ON public.denuncias_denunciante_tipos (nombre);

-- 5c. Seed lookup tables
INSERT INTO public.incidentes_tipos (nombre) VALUES
  ('electrico'), ('mecanico'), ('estructural'), ('quimico'),
  ('ergonomico'), ('ambiental'), ('incendio'), ('caida'),
  ('herramienta'), ('vehiculo'), ('otro')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.incidentes_severidad (nombre) VALUES
  ('baja'), ('media'), ('alta'), ('critica')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.incidentes_estados (nombre) VALUES
  ('recibida'), ('en_analisis'), ('accion_planificada'),
  ('implementada'), ('cerrada')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.denuncias_tipos (nombre) VALUES
  ('laboral'), ('acoso'), ('condiciones_inseguras'),
  ('incumplimiento_normativo'), ('conducta'), ('otro')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.denuncias_estados (nombre) VALUES
  ('recibida'), ('en_analisis'), ('accion_planificada'),
  ('implementada'), ('cerrada')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.denuncias_denunciante_tipos (nombre) VALUES
  ('interno'), ('externo'), ('anonimo')
ON CONFLICT (nombre) DO NOTHING;

-- 5d. RLS para lookup tables (solo lectura authenticated)
CREATE POLICY "incidentes_tipos: select"
  ON public.incidentes_tipos FOR SELECT TO authenticated USING (true);
CREATE POLICY "incidentes_severidad: select"
  ON public.incidentes_severidad FOR SELECT TO authenticated USING (true);
CREATE POLICY "incidentes_estados: select"
  ON public.incidentes_estados FOR SELECT TO authenticated USING (true);
CREATE POLICY "denuncias_tipos: select"
  ON public.denuncias_tipos FOR SELECT TO authenticated USING (true);
CREATE POLICY "denuncias_estados: select"
  ON public.denuncias_estados FOR SELECT TO authenticated USING (true);
CREATE POLICY "denuncias_denunciante_tipos: select"
  ON public.denuncias_denunciante_tipos FOR SELECT TO authenticated USING (true);

-- 5e. Agregar FK columns a incidentes
ALTER TABLE public.incidentes
  ADD COLUMN IF NOT EXISTS tipo_incidente_id uuid
    REFERENCES public.incidentes_tipos(id),
  ADD COLUMN IF NOT EXISTS severidad_id uuid
    REFERENCES public.incidentes_severidad(id),
  ADD COLUMN IF NOT EXISTS estado_id uuid
    REFERENCES public.incidentes_estados(id);

-- 5f. Agregar FK columns a denuncias
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS tipo_denuncia_id uuid
    REFERENCES public.denuncias_tipos(id),
  ADD COLUMN IF NOT EXISTS estado_id uuid
    REFERENCES public.denuncias_estados(id),
  ADD COLUMN IF NOT EXISTS denunciante_tipo_id uuid
    REFERENCES public.denuncias_denunciante_tipos(id);


-- ============================================================
-- 🟡 6. Dropear partición vacía gestiones_registros_2024
-- ============================================================
-- DETACH primero (FK no permite DROP directo porque PG trackea
-- dependencias del FK con los índices de cada partición)
ALTER TABLE IF EXISTS public.gestiones_registros
  DETACH PARTITION public.gestiones_registros_2024;

DROP TABLE IF EXISTS public.gestiones_registros_2024;


-- ============================================================
-- 🟡 7. Migrar art_numero_contrato → tabla empresas_art
-- ============================================================

-- 7a. Crear tabla de relación empresa ↔ ART
CREATE TABLE IF NOT EXISTS public.empresas_art (
  id              uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id      uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  art_id          uuid NOT NULL REFERENCES public.organizaciones_externas(id) ON DELETE RESTRICT,
  numero_contrato text,
  fecha_inicio    date,
  fecha_fin       date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, art_id)
);

ALTER TABLE public.empresas_art ENABLE ROW LEVEL SECURITY;

-- 7b. Migrar datos existentes
INSERT INTO public.empresas_art (empresa_id, art_id, numero_contrato)
SELECT e.id, e.art_id, e.art_numero_contrato
FROM public.empresas e
WHERE e.art_id IS NOT NULL;

-- 7c. Dropear columna legacy de empresas
ALTER TABLE public.empresas
  DROP COLUMN IF EXISTS art_numero_contrato;

-- 7d. Dropear columna legacy de subcontratistas
ALTER TABLE public.subcontratistas
  DROP COLUMN IF EXISTS art_numero_contrato;

-- 7e. RLS policies para empresas_art
CREATE POLICY "empresas_art: select"
  ON public.empresas_art FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresas_art.empresa_id
      AND public.has_empresa_read_access(e.id)
  ));

CREATE POLICY "empresas_art: insert"
  ON public.empresas_art FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id
      AND public.has_empresa_write_access(e.id)
  ));

CREATE POLICY "empresas_art: update"
  ON public.empresas_art FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresas_art.empresa_id
      AND public.has_empresa_write_access(e.id)
  ));

CREATE POLICY "empresas_art: delete"
  ON public.empresas_art FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresas_art.empresa_id
      AND public.has_empresa_write_access(e.id)
  ));

-- 7f. Trigger updated_at para empresas_art
DROP TRIGGER IF EXISTS set_updated_at ON public.empresas_art;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.empresas_art
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ============================================================
-- 🟡 8. dias_restantes → trigger de cálculo automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.calc_notificaciones_dias_restantes()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.fecha_vencimiento IS NOT NULL THEN
    NEW.dias_restantes = (NEW.fecha_vencimiento - CURRENT_DATE);
  ELSE
    NEW.dias_restantes = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_dias_restantes ON public.notificaciones;

CREATE TRIGGER trg_calc_dias_restantes
  BEFORE INSERT OR UPDATE OF fecha_vencimiento ON public.notificaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.calc_notificaciones_dias_restantes();

-- Backfill valores existentes
UPDATE public.notificaciones
SET dias_restantes = (fecha_vencimiento - CURRENT_DATE)
WHERE fecha_vencimiento IS NOT NULL
  AND (dias_restantes IS NULL OR dias_restantes <> (fecha_vencimiento - CURRENT_DATE));


-- ============================================================
-- 🟡 9. Índice compuesto (establecimiento_id, fecha) en mediciones
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_med_establecimiento_fecha
  ON public.mediciones (establecimiento_id, fecha DESC);


-- ============================================================
-- 🟢 10. Trigger updated_at en notificaciones
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON public.notificaciones;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.notificaciones
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();


-- ============================================================
-- 🟢 11. Función de monitoreo de tablas sin RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_tables_without_rls()
RETURNS TABLE(tablename text, reason text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::text,
    'Tabla sin RLS habilitado'::text AS reason
  FROM pg_catalog.pg_tables t
  WHERE t.schemaname = 'public'
    AND NOT t.rowsecurity
    AND t.tablename NOT LIKE '%_2024'
    AND t.tablename NOT LIKE '%_2025'
    AND t.tablename NOT LIKE '%_2026'
    AND t.tablename NOT LIKE '%_2027'
    AND t.tablename NOT LIKE '%_2028'
    AND t.tablename NOT LIKE '%_2029'
    AND t.tablename NOT LIKE '%_2030'
    AND t.tablename NOT LIKE '%_2031'
    AND t.tablename NOT LIKE '%_future'
    AND t.tablename NOT IN ('_prisma_migrations', 'schema_migrations')
  ORDER BY t.tablename;
END;
$$;

COMMIT;
