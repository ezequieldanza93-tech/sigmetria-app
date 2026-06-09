-- ============================================================
-- Protocolo de Medición de Puesta a Tierra (PAT — SRT 900/2015)
-- ============================================================
-- Migración FUNDACIONAL del módulo. ADITIVA: tablas nuevas + 1 valor en el
-- discriminador tipo_ejecucion + seed de instrumento. NO toca datos ni tablas
-- existentes.
--
-- Diseño (mismo molde que medicion_iluminacion / medicion_ruido):
--   - gestiones.tipo_ejecucion discrimina el flujo del botón Ejecutar.
--     OJO: tipo_ejecucion es TEXT + CHECK constraint, NO un enum de Postgres.
--     Se agrega 'medicion_pat' recreando el CHECK de forma ADITIVA, conservando
--     TODOS los valores ya presentes en producción (no se pierde ninguno).
--   - medicion_pat        = cabecera del protocolo (1 fila por ejecución).
--   - medicion_pat_tomas  = tomas de tierra medidas (1 fila por toma).
--   - La cabecera referencia su gestiones_registros en forma SUELTA
--     (registro_gestion_id + rg_fecha_planificada, ambos sin FK dura): esa tabla
--     está PARTICIONADA por fecha_planificada con PK compuesta (id, fecha_planificada),
--     y reportes_fotograficos / medicion_iluminacion / medicion_ruido resolvieron
--     esto SIN FK dura. Replicamos lo MISMO.
--   - Las tomas NO llevan consultora_id (3NF: el tenant se deriva del padre).
--
-- Idempotente. RLS por establecimiento con has_establecimiento_read/write_access
-- (helpers existentes, igual que medicion_iluminacion / medicion_ruido).
-- ============================================================

BEGIN;

-- ─── 1. Sumar 'medicion_pat' al discriminador tipo_ejecucion ──
-- tipo_ejecucion es TEXT + CHECK (no enum). Recreamos el CHECK de forma ADITIVA:
-- conservamos TODOS los valores que ya viven en producción (estandar,
-- reporte_fotografico, medicion_iluminacion, medicion_ruido, medicion_carga_termica,
-- calculo_carga_fuego) y nos aseguramos de incluir 'medicion_pat'. En producción
-- el valor ya puede estar presente; este DROP+ADD es idempotente y no pierde valores.
ALTER TABLE public.gestiones DROP CONSTRAINT IF EXISTS chk_gestiones_tipo_ejecucion;
ALTER TABLE public.gestiones ADD CONSTRAINT chk_gestiones_tipo_ejecucion
  CHECK (tipo_ejecucion IN (
    'estandar',
    'reporte_fotografico',
    'medicion_iluminacion',
    'medicion_ruido',
    'medicion_carga_termica',
    'calculo_carga_fuego',
    'medicion_pat'
  ));
COMMENT ON COLUMN public.gestiones.tipo_ejecucion IS
  'Flujo del botón Ejecutar: estandar | reporte_fotografico | medicion_iluminacion (SRT 84/2012) | medicion_ruido (SRT 85/2012) | medicion_carga_termica | calculo_carga_fuego | medicion_pat (Protocolo de Puesta a Tierra, SRT 900/2015).';

-- ─── 2. Cabecera del protocolo de puesta a tierra ───────────
CREATE TABLE IF NOT EXISTS public.medicion_pat (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id               uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id          uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  registro_gestion_id         uuid NOT NULL,   -- referencia suelta (gestiones_registros está particionada)
  rg_fecha_planificada        date NOT NULL,   -- compañera de la referencia suelta (PK compuesta del padre)
  gestion_establecimiento_id  uuid REFERENCES public.gestiones_establecimientos(id) ON DELETE SET NULL,
  instrumento_id              uuid REFERENCES public.mediciones_instrumentos(id) ON DELETE SET NULL,
  certificado_id              uuid REFERENCES public.certificados_calibracion(id) ON DELETE SET NULL,
  firmante                    text,
  metodologia                 text,
  fecha_medicion              date,
  fecha_medicion_fin          date,
  hora_inicio                 time,
  hora_fin                    time,
  observaciones               text,
  conclusiones                text,
  recomendaciones             text,
  certificado_url             text,            -- PATH en bucket (no URL)
  plano_url                   text,            -- PATH en bucket (no URL)
  estado                      text NOT NULL DEFAULT 'borrador',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_med_pat_registro
  ON public.medicion_pat (registro_gestion_id, rg_fecha_planificada);
CREATE INDEX IF NOT EXISTS idx_med_pat_establecimiento
  ON public.medicion_pat (establecimiento_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_med_pat_consultora
  ON public.medicion_pat (consultora_id);

-- ─── 3. Tomas de tierra medidas ─────────────────────────────
-- Una fila por toma/jabalina de puesta a tierra medida.
--   ect: esquema de conexión a tierra (TT/TN-S/TN-C/TN-C-S/IT).
--   proteccion: dispositivo de protección (DD diferencial / IA interruptor automático / Fus fusible).
--   cumple: valor_medido_ohm <= valor_exigido_ohm (lo calcula la app y se persiste).
CREATE TABLE IF NOT EXISTS public.medicion_pat_tomas (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicion_id              uuid NOT NULL REFERENCES public.medicion_pat(id) ON DELETE CASCADE,
  numero_toma              integer,
  sector_id                uuid REFERENCES public.establecimientos_sectores(id) ON DELETE SET NULL,
  seccion                  text,
  condicion_terreno        text,
  uso_pat                  text,
  ect                      text,
  valor_medido_ohm         numeric,
  valor_exigido_ohm        numeric,
  cumple                   boolean,
  continuidad              boolean,
  capacidad_carga          boolean,
  proteccion               text,
  desconexion_automatica   boolean,
  observaciones            text,
  orden                    integer
);
ALTER TABLE public.medicion_pat_tomas DROP CONSTRAINT IF EXISTS chk_med_pat_toma_ect;
ALTER TABLE public.medicion_pat_tomas ADD CONSTRAINT chk_med_pat_toma_ect
  CHECK (ect IS NULL OR ect IN ('TT', 'TN-S', 'TN-C', 'TN-C-S', 'IT'));
ALTER TABLE public.medicion_pat_tomas DROP CONSTRAINT IF EXISTS chk_med_pat_toma_proteccion;
ALTER TABLE public.medicion_pat_tomas ADD CONSTRAINT chk_med_pat_toma_proteccion
  CHECK (proteccion IS NULL OR proteccion IN ('DD', 'IA', 'Fus'));

CREATE INDEX IF NOT EXISTS idx_med_pat_tomas_medicion
  ON public.medicion_pat_tomas (medicion_id);

-- ─── 4. SEED de instrumento de PAT ──────────────────────────
-- mediciones_instrumentos_tipos columnas: id, nombre, descripcion, created_at
-- (NO hay is_active). El protocolo de PAT usa Telurímetro: lo agregamos si falta.
-- Idempotente por nombre.
INSERT INTO public.mediciones_instrumentos_tipos (nombre)
SELECT v.nombre
FROM (VALUES ('Telurímetro')) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.mediciones_instrumentos_tipos t WHERE t.nombre = v.nombre
);

-- ─── 5. RLS — cabecera (por establecimiento) ────────────────
ALTER TABLE public.medicion_pat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_pat: select" ON public.medicion_pat;
CREATE POLICY "medicion_pat: select" ON public.medicion_pat FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.is_developer())
    AND public.has_establecimiento_read_access(establecimiento_id)
  );

DROP POLICY IF EXISTS "medicion_pat: insert" ON public.medicion_pat;
CREATE POLICY "medicion_pat: insert" ON public.medicion_pat FOR INSERT TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "medicion_pat: update" ON public.medicion_pat;
CREATE POLICY "medicion_pat: update" ON public.medicion_pat FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "medicion_pat: delete" ON public.medicion_pat;
CREATE POLICY "medicion_pat: delete" ON public.medicion_pat FOR DELETE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

-- ─── 6. RLS — tomas (tenant derivado de la cabecera) ────────
-- Tenant derivado por join a la cabecera (igual que iluminacion_puntos / ruido_puntos).
ALTER TABLE public.medicion_pat_tomas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_pat_tomas: select" ON public.medicion_pat_tomas;
CREATE POLICY "medicion_pat_tomas: select" ON public.medicion_pat_tomas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_pat m
    WHERE m.id = medicion_id
      AND (m.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_pat_tomas: insert" ON public.medicion_pat_tomas;
CREATE POLICY "medicion_pat_tomas: insert" ON public.medicion_pat_tomas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medicion_pat m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_pat_tomas: update" ON public.medicion_pat_tomas;
CREATE POLICY "medicion_pat_tomas: update" ON public.medicion_pat_tomas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_pat m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medicion_pat m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_pat_tomas: delete" ON public.medicion_pat_tomas;
CREATE POLICY "medicion_pat_tomas: delete" ON public.medicion_pat_tomas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_pat m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

-- ─── 7. updated_at trigger en la cabecera ───────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.medicion_pat;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.medicion_pat
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 8. Comentarios de documentación ────────────────────────
COMMENT ON TABLE public.medicion_pat IS
  'Cabecera del Protocolo de Medición de Puesta a Tierra (PAT — SRT 900/2015). Referencia suelta a gestiones_registros (particionada). RLS por establecimiento.';
COMMENT ON TABLE public.medicion_pat_tomas IS
  'Tomas de tierra medidas de un protocolo de PAT (1 fila por toma). Tenant derivado de la cabecera (sin consultora_id, 3NF). cumple = valor_medido_ohm <= valor_exigido_ohm.';

COMMIT;
