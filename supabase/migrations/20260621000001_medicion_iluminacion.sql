-- ============================================================
-- Protocolo de Medición de Iluminación (SRT 84/2012 — Dec 351/79 Anexo IV)
-- ============================================================
-- Migración FUNDACIONAL del módulo. ADITIVA: tablas nuevas + 1 valor en el
-- discriminador tipo_ejecucion + seeds de referencia. NO toca datos ni tablas
-- existentes.
--
-- Diseño (copia las convenciones de reportes_fotograficos):
--   - gestiones.tipo_ejecucion discrimina el flujo del botón Ejecutar.
--     OJO: tipo_ejecucion es TEXT + CHECK constraint, NO un enum de Postgres.
--     Se agrega 'medicion_iluminacion' recreando el CHECK (igual que se hizo
--     para 'reporte_fotografico'). No hay ALTER TYPE porque no hay enum.
--   - medicion_iluminacion        = cabecera del protocolo (1 fila por ejecución).
--   - medicion_iluminacion_puntos = sectores/puntos medidos.
--   - medicion_iluminacion_celdas = grilla de lux por punto (fila x columna).
--   - La cabecera referencia su gestiones_registros en forma SUELTA
--     (registro_gestion_id + rg_fecha_planificada, ambos sin FK dura): esa tabla
--     está PARTICIONADA por fecha_planificada con PK compuesta (id, fecha_planificada),
--     y reportes_fotograficos resolvió esto SIN FK dura. Replicamos lo MISMO.
--   - Puntos y celdas NO llevan consultora_id (3NF: el tenant se deriva del padre).
--   - Tablas dec351_* = reference data global (NO tenant), admin-editable.
--
-- Idempotente. RLS por establecimiento con has_establecimiento_read/write_access
-- (helpers existentes, igual que gestiones_registros / gestiones_observaciones).
-- ============================================================

BEGIN;

-- ─── 1. Sumar 'medicion_iluminacion' al discriminador tipo_ejecucion ──
-- tipo_ejecucion es TEXT + CHECK (no enum). Se recrea el CHECK añadiendo el valor.
ALTER TABLE public.gestiones DROP CONSTRAINT IF EXISTS chk_gestiones_tipo_ejecucion;
ALTER TABLE public.gestiones ADD CONSTRAINT chk_gestiones_tipo_ejecucion
  CHECK (tipo_ejecucion IN (
    'estandar', 'reporte_fotografico', 'medicion_iluminacion',
    'medicion_ruido', 'medicion_carga_termica', 'calculo_carga_fuego', 'medicion_pat'
  ));
COMMENT ON COLUMN public.gestiones.tipo_ejecucion IS
  'Flujo del botón Ejecutar: estandar | reporte_fotografico | medicion_iluminacion | medicion_ruido | medicion_carga_termica | calculo_carga_fuego | medicion_pat.';

-- ─── 2. Cabecera del protocolo de medición de iluminación ───
CREATE TABLE IF NOT EXISTS public.medicion_iluminacion (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id               uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id          uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  registro_gestion_id         uuid NOT NULL,   -- referencia suelta (gestiones_registros está particionada)
  rg_fecha_planificada        date NOT NULL,   -- compañera de la referencia suelta (PK compuesta del padre)
  gestion_establecimiento_id  uuid REFERENCES public.gestiones_establecimientos(id) ON DELETE SET NULL,
  instrumento_id              uuid REFERENCES public.mediciones_instrumentos(id) ON DELETE SET NULL,
  certificado_id              uuid REFERENCES public.certificados_calibracion(id) ON DELETE SET NULL,
  perfil_profesional_id       uuid REFERENCES public.perfiles_profesionales(id) ON DELETE SET NULL,
  metodologia                 text,
  fecha_medicion              date,
  hora_inicio                 time,
  hora_fin                    time,
  condiciones_atmosfericas    jsonb,
  altura_criterio             text NOT NULL DEFAULT 'piso',
  certificado_url             text,            -- PATH en bucket (no URL)
  plano_url                   text,            -- PATH en bucket (no URL)
  conclusiones                text,
  recomendaciones             text,
  observaciones               text,
  estado                      text NOT NULL DEFAULT 'borrador',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);
ALTER TABLE public.medicion_iluminacion DROP CONSTRAINT IF EXISTS chk_med_ilum_altura_criterio;
ALTER TABLE public.medicion_iluminacion ADD CONSTRAINT chk_med_ilum_altura_criterio
  CHECK (altura_criterio IN ('piso', 'plano_trabajo'));

CREATE INDEX IF NOT EXISTS idx_med_ilum_registro
  ON public.medicion_iluminacion (registro_gestion_id, rg_fecha_planificada);
CREATE INDEX IF NOT EXISTS idx_med_ilum_establecimiento
  ON public.medicion_iluminacion (establecimiento_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_med_ilum_consultora
  ON public.medicion_iluminacion (consultora_id);

-- ─── 3. Puntos / sectores medidos ───────────────────────────
CREATE TABLE IF NOT EXISTS public.medicion_iluminacion_puntos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicion_id            uuid NOT NULL REFERENCES public.medicion_iluminacion(id) ON DELETE CASCADE,
  sector_id              uuid REFERENCES public.establecimientos_sectores(id) ON DELETE SET NULL,
  puesto_id              uuid REFERENCES public.puestos_de_trabajo(id) ON DELETE SET NULL,
  turno                  text,
  tipo_iluminacion       text,
  tipo_fuente            text,
  tipo_sistema           text,
  largo                  numeric,
  ancho                  numeric,
  altura                 numeric,
  valor_requerido_lux    numeric,
  requisito_ref          text,
  localizada_lux         numeric,
  general_requerida_lux  numeric,
  observaciones          text,
  orden                  integer
);
ALTER TABLE public.medicion_iluminacion_puntos DROP CONSTRAINT IF EXISTS chk_med_ilum_pto_tipo_ilum;
ALTER TABLE public.medicion_iluminacion_puntos ADD CONSTRAINT chk_med_ilum_pto_tipo_ilum
  CHECK (tipo_iluminacion IS NULL OR tipo_iluminacion IN ('natural', 'artificial', 'mixta'));
ALTER TABLE public.medicion_iluminacion_puntos DROP CONSTRAINT IF EXISTS chk_med_ilum_pto_tipo_fuente;
ALTER TABLE public.medicion_iluminacion_puntos ADD CONSTRAINT chk_med_ilum_pto_tipo_fuente
  CHECK (tipo_fuente IS NULL OR tipo_fuente IN ('incandescente', 'descarga', 'mixta'));
ALTER TABLE public.medicion_iluminacion_puntos DROP CONSTRAINT IF EXISTS chk_med_ilum_pto_tipo_sistema;
ALTER TABLE public.medicion_iluminacion_puntos ADD CONSTRAINT chk_med_ilum_pto_tipo_sistema
  CHECK (tipo_sistema IS NULL OR tipo_sistema IN ('general', 'localizada', 'mixta'));

CREATE INDEX IF NOT EXISTS idx_med_ilum_puntos_medicion
  ON public.medicion_iluminacion_puntos (medicion_id);

-- ─── 4. Celdas (grilla de lux por punto) ────────────────────
CREATE TABLE IF NOT EXISTS public.medicion_iluminacion_celdas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  punto_id    uuid NOT NULL REFERENCES public.medicion_iluminacion_puntos(id) ON DELETE CASCADE,
  fila        integer NOT NULL,
  columna     integer NOT NULL,
  valor_lux   numeric NOT NULL,
  UNIQUE (punto_id, fila, columna)
);
CREATE INDEX IF NOT EXISTS idx_med_ilum_celdas_punto
  ON public.medicion_iluminacion_celdas (punto_id);

-- ─── 5. Tablas de referencia Anexo IV Dec 351/79 (global, no-tenant) ──
-- Tabla 2: intensidad mínima de iluminación según rubro / local / tarea.
CREATE TABLE IF NOT EXISTS public.dec351_iluminacion_tabla2 (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubro      text,
  local      text,
  tarea      text,
  lux_min    numeric NOT NULL,
  orden      integer,
  is_active  boolean NOT NULL DEFAULT true
);

-- Tabla 1: intensidad media según clase de tarea visual (rango min/max).
CREATE TABLE IF NOT EXISTS public.dec351_iluminacion_tabla1 (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clase_tarea  text,
  detalle      text,
  lux_min      numeric,
  lux_max      numeric,
  orden        integer,
  is_active    boolean NOT NULL DEFAULT true
);

-- Tabla 4: relación iluminación localizada → iluminación general mínima.
CREATE TABLE IF NOT EXISTS public.dec351_iluminacion_tabla4 (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  localizada_lux  numeric NOT NULL,
  general_min_lux numeric NOT NULL,
  orden           integer
);

-- ─── 6. SEED de referencia (solo lo indicado; el resto lo carga el cliente) ──
-- Tabla 4 COMPLETA (guardas para idempotencia por localizada_lux).
INSERT INTO public.dec351_iluminacion_tabla4 (localizada_lux, general_min_lux, orden)
SELECT v.localizada_lux, v.general_min_lux, v.orden
FROM (VALUES
  (250::numeric,  125::numeric, 1),
  (500::numeric,  250::numeric, 2),
  (1000::numeric, 300::numeric, 3),
  (2500::numeric, 500::numeric, 4),
  (5000::numeric, 600::numeric, 5),
  (10000::numeric, 700::numeric, 6)
) AS v(localizada_lux, general_min_lux, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dec351_iluminacion_tabla4 t WHERE t.localizada_lux = v.localizada_lux
);

-- Tabla 2 — ejemplos.
INSERT INTO public.dec351_iluminacion_tabla2 (rubro, local, tarea, lux_min, orden, is_active)
SELECT v.rubro, v.local, v.tarea, v.lux_min, v.orden, v.is_active
FROM (VALUES
  ('Maderería/Carpintería', 'Zona de bancos y máquinas',        NULL::text, 300::numeric, 1, true),
  ('Maderería/Carpintería', 'Armado y terminación de muebles',  NULL::text, 400::numeric, 2, true)
) AS v(rubro, local, tarea, lux_min, orden, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dec351_iluminacion_tabla2 t
  WHERE t.rubro = v.rubro AND t.local = v.local AND t.lux_min = v.lux_min
);

-- Tabla 1 — ejemplos.
INSERT INTO public.dec351_iluminacion_tabla1 (clase_tarea, detalle, lux_min, lux_max, orden, is_active)
SELECT v.clase_tarea, v.detalle, v.lux_min, v.lux_max, v.orden, v.is_active
FROM (VALUES
  ('Tareas moderadamente críticas y prolongadas, detalles medianos', 'Oficinas',            300::numeric, 750::numeric, 1, true),
  ('Iluminación general',                                            'Baños y vestuarios',  100::numeric, 100::numeric, 2, true)
) AS v(clase_tarea, detalle, lux_min, lux_max, orden, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dec351_iluminacion_tabla1 t
  WHERE t.clase_tarea = v.clase_tarea AND t.detalle = v.detalle
);

-- ─── 7. RLS — tablas del protocolo (por establecimiento) ────
ALTER TABLE public.medicion_iluminacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_iluminacion: select" ON public.medicion_iluminacion;
CREATE POLICY "medicion_iluminacion: select" ON public.medicion_iluminacion FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.is_developer())
    AND public.has_establecimiento_read_access(establecimiento_id)
  );

DROP POLICY IF EXISTS "medicion_iluminacion: insert" ON public.medicion_iluminacion;
CREATE POLICY "medicion_iluminacion: insert" ON public.medicion_iluminacion FOR INSERT TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "medicion_iluminacion: update" ON public.medicion_iluminacion;
CREATE POLICY "medicion_iluminacion: update" ON public.medicion_iluminacion FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "medicion_iluminacion: delete" ON public.medicion_iluminacion;
CREATE POLICY "medicion_iluminacion: delete" ON public.medicion_iluminacion FOR DELETE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

-- Puntos: tenant derivado de la cabecera (EXISTS join, igual que gestiones_observaciones).
ALTER TABLE public.medicion_iluminacion_puntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_iluminacion_puntos: select" ON public.medicion_iluminacion_puntos;
CREATE POLICY "medicion_iluminacion_puntos: select" ON public.medicion_iluminacion_puntos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_iluminacion m
    WHERE m.id = medicion_id
      AND (m.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_iluminacion_puntos: insert" ON public.medicion_iluminacion_puntos;
CREATE POLICY "medicion_iluminacion_puntos: insert" ON public.medicion_iluminacion_puntos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medicion_iluminacion m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_iluminacion_puntos: update" ON public.medicion_iluminacion_puntos;
CREATE POLICY "medicion_iluminacion_puntos: update" ON public.medicion_iluminacion_puntos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_iluminacion m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medicion_iluminacion m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_iluminacion_puntos: delete" ON public.medicion_iluminacion_puntos;
CREATE POLICY "medicion_iluminacion_puntos: delete" ON public.medicion_iluminacion_puntos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_iluminacion m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

-- Celdas: tenant derivado por doble join (celda → punto → cabecera).
ALTER TABLE public.medicion_iluminacion_celdas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_iluminacion_celdas: select" ON public.medicion_iluminacion_celdas;
CREATE POLICY "medicion_iluminacion_celdas: select" ON public.medicion_iluminacion_celdas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_iluminacion_puntos p
    JOIN public.medicion_iluminacion m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND (m.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_iluminacion_celdas: insert" ON public.medicion_iluminacion_celdas;
CREATE POLICY "medicion_iluminacion_celdas: insert" ON public.medicion_iluminacion_celdas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.medicion_iluminacion_puntos p
    JOIN public.medicion_iluminacion m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_iluminacion_celdas: update" ON public.medicion_iluminacion_celdas;
CREATE POLICY "medicion_iluminacion_celdas: update" ON public.medicion_iluminacion_celdas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_iluminacion_puntos p
    JOIN public.medicion_iluminacion m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.medicion_iluminacion_puntos p
    JOIN public.medicion_iluminacion m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_iluminacion_celdas: delete" ON public.medicion_iluminacion_celdas;
CREATE POLICY "medicion_iluminacion_celdas: delete" ON public.medicion_iluminacion_celdas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_iluminacion_puntos p
    JOIN public.medicion_iluminacion m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

-- ─── 8. RLS — tablas de referencia dec351_* (lectura global, escritura super admin) ──
ALTER TABLE public.dec351_iluminacion_tabla1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dec351_iluminacion_tabla2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dec351_iluminacion_tabla4 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dec351_tabla1: select" ON public.dec351_iluminacion_tabla1;
CREATE POLICY "dec351_tabla1: select" ON public.dec351_iluminacion_tabla1 FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dec351_tabla1: write" ON public.dec351_iluminacion_tabla1;
CREATE POLICY "dec351_tabla1: write" ON public.dec351_iluminacion_tabla1 FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "dec351_tabla2: select" ON public.dec351_iluminacion_tabla2;
CREATE POLICY "dec351_tabla2: select" ON public.dec351_iluminacion_tabla2 FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dec351_tabla2: write" ON public.dec351_iluminacion_tabla2;
CREATE POLICY "dec351_tabla2: write" ON public.dec351_iluminacion_tabla2 FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "dec351_tabla4: select" ON public.dec351_iluminacion_tabla4;
CREATE POLICY "dec351_tabla4: select" ON public.dec351_iluminacion_tabla4 FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dec351_tabla4: write" ON public.dec351_iluminacion_tabla4;
CREATE POLICY "dec351_tabla4: write" ON public.dec351_iluminacion_tabla4 FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── 9. updated_at trigger en la cabecera ───────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.medicion_iluminacion;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.medicion_iluminacion
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 10. Comentarios de documentación ───────────────────────
COMMENT ON TABLE public.medicion_iluminacion IS
  'Cabecera del Protocolo de Medición de Iluminación (SRT 84/2012). Referencia suelta a gestiones_registros (particionada). RLS por establecimiento.';
COMMENT ON TABLE public.medicion_iluminacion_puntos IS
  'Sectores/puntos medidos de un protocolo de iluminación. Tenant derivado de la cabecera (sin consultora_id, 3NF).';
COMMENT ON TABLE public.medicion_iluminacion_celdas IS
  'Grilla de valores en lux (fila x columna) por punto medido. Tenant derivado por punto → cabecera.';
COMMENT ON TABLE public.dec351_iluminacion_tabla1 IS
  'Referencia global Anexo IV Dec 351/79 — Tabla 1: intensidad media de iluminación según clase de tarea visual.';
COMMENT ON TABLE public.dec351_iluminacion_tabla2 IS
  'Referencia global Anexo IV Dec 351/79 — Tabla 2: intensidad mínima de iluminación según rubro/local/tarea.';
COMMENT ON TABLE public.dec351_iluminacion_tabla4 IS
  'Referencia global Anexo IV Dec 351/79 — Tabla 4: relación iluminación localizada → general mínima.';

COMMIT;
