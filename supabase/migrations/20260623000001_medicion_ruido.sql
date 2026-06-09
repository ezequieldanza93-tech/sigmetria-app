-- ============================================================
-- Protocolo de Medición de Ruido (SRT 85/2012 — Res 295/03 Anexo V)
-- ============================================================
-- Migración FUNDACIONAL del módulo. ADITIVA: tablas nuevas + 1 valor en el
-- discriminador tipo_ejecucion + seeds de referencia. NO toca datos ni tablas
-- existentes.
--
-- Diseño (mismo molde que medicion_iluminacion / reportes_fotograficos):
--   - gestiones.tipo_ejecucion discrimina el flujo del botón Ejecutar.
--     OJO: tipo_ejecucion es TEXT + CHECK constraint, NO un enum de Postgres.
--     Se agrega 'medicion_ruido' recreando el CHECK (igual que se hizo para
--     'reporte_fotografico' y 'medicion_iluminacion'). No hay ALTER TYPE porque
--     no hay enum. El CHECK actual incluye los 3 valores previos; se recrea con
--     los 4 (sin perder 'medicion_iluminacion').
--   - medicion_ruido          = cabecera del protocolo (1 fila por ejecución).
--   - medicion_ruido_puntos   = puestos / puntos de medición.
--   - medicion_ruido_periodos = períodos del método sonómetro (LAeq + tiempo).
--   - La cabecera referencia su gestiones_registros en forma SUELTA
--     (registro_gestion_id + rg_fecha_planificada, ambos sin FK dura): esa tabla
--     está PARTICIONADA por fecha_planificada con PK compuesta (id, fecha_planificada),
--     y reportes_fotograficos / medicion_iluminacion resolvieron esto SIN FK dura.
--     Replicamos lo MISMO.
--   - Puntos y períodos NO llevan consultora_id (3NF: el tenant se deriva del padre).
--
-- Idempotente. RLS por establecimiento con has_establecimiento_read/write_access
-- (helpers existentes, igual que medicion_iluminacion / gestiones_registros).
-- ============================================================

BEGIN;

-- ─── 1. Sumar 'medicion_ruido' al discriminador tipo_ejecucion ──
-- tipo_ejecucion es TEXT + CHECK (no enum). Se recrea el CHECK añadiendo el valor,
-- conservando los 3 valores ya presentes en producción.
ALTER TABLE public.gestiones DROP CONSTRAINT IF EXISTS chk_gestiones_tipo_ejecucion;
ALTER TABLE public.gestiones ADD CONSTRAINT chk_gestiones_tipo_ejecucion
  CHECK (tipo_ejecucion IN ('estandar', 'reporte_fotografico', 'medicion_iluminacion', 'medicion_ruido'));
COMMENT ON COLUMN public.gestiones.tipo_ejecucion IS
  'Flujo del botón Ejecutar: estandar (carga 1 archivo) | reporte_fotografico (wizard multi-foto + PDF) | medicion_iluminacion (protocolo SRT 84/2012) | medicion_ruido (protocolo SRT 85/2012).';

-- ─── 2. Cabecera del protocolo de medición de ruido ─────────
CREATE TABLE IF NOT EXISTS public.medicion_ruido (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id               uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id          uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  registro_gestion_id         uuid NOT NULL,   -- referencia suelta (gestiones_registros está particionada)
  rg_fecha_planificada        date NOT NULL,   -- compañera de la referencia suelta (PK compuesta del padre)
  gestion_establecimiento_id  uuid REFERENCES public.gestiones_establecimientos(id) ON DELETE SET NULL,
  instrumento_id              uuid REFERENCES public.mediciones_instrumentos(id) ON DELETE SET NULL,
  certificado_id              uuid REFERENCES public.certificados_calibracion(id) ON DELETE SET NULL,
  perfil_profesional_id       uuid REFERENCES public.perfiles_profesionales(id) ON DELETE SET NULL,
  fecha_medicion              date,
  fecha_medicion_fin          date,
  hora_inicio                 time,
  hora_fin                    time,
  jornada_horas               numeric,
  turnos                      text,
  condiciones_normales        text,
  condiciones_medicion        text,
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

CREATE INDEX IF NOT EXISTS idx_med_ruido_registro
  ON public.medicion_ruido (registro_gestion_id, rg_fecha_planificada);
CREATE INDEX IF NOT EXISTS idx_med_ruido_establecimiento
  ON public.medicion_ruido (establecimiento_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_med_ruido_consultora
  ON public.medicion_ruido (consultora_id);

-- ─── 3. Puntos / puestos de medición ────────────────────────
CREATE TABLE IF NOT EXISTS public.medicion_ruido_puntos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicion_id          uuid NOT NULL REFERENCES public.medicion_ruido(id) ON DELETE CASCADE,
  sector_id            uuid REFERENCES public.establecimientos_sectores(id) ON DELETE SET NULL,
  puesto_id            uuid REFERENCES public.puestos_de_trabajo(id) ON DELETE SET NULL,
  tipo_puesto          text,
  te_horas             numeric,
  tiempo_integracion   text,
  caracteristicas_ruido text,
  lcpico_dbc           numeric,
  metodo               text,
  dosis_pct            numeric,
  laeq_dba             numeric,
  suma_fracciones      numeric,
  cumple               boolean,
  info_adicional       text,
  orden                integer
);
ALTER TABLE public.medicion_ruido_puntos DROP CONSTRAINT IF EXISTS chk_med_ruido_pto_tipo_puesto;
ALTER TABLE public.medicion_ruido_puntos ADD CONSTRAINT chk_med_ruido_pto_tipo_puesto
  CHECK (tipo_puesto IS NULL OR tipo_puesto IN ('puesto', 'puesto_tipo', 'movil'));
ALTER TABLE public.medicion_ruido_puntos DROP CONSTRAINT IF EXISTS chk_med_ruido_pto_caracteristicas;
ALTER TABLE public.medicion_ruido_puntos ADD CONSTRAINT chk_med_ruido_pto_caracteristicas
  CHECK (caracteristicas_ruido IS NULL OR caracteristicas_ruido IN ('continuo', 'intermitente', 'impacto'));
ALTER TABLE public.medicion_ruido_puntos DROP CONSTRAINT IF EXISTS chk_med_ruido_pto_metodo;
ALTER TABLE public.medicion_ruido_puntos ADD CONSTRAINT chk_med_ruido_pto_metodo
  CHECK (metodo IS NULL OR metodo IN ('dosimetro', 'sonometro'));

CREATE INDEX IF NOT EXISTS idx_med_ruido_puntos_medicion
  ON public.medicion_ruido_puntos (medicion_id);

-- ─── 4. Períodos del método sonómetro (LAeq + tiempo de exposición) ──
CREATE TABLE IF NOT EXISTS public.medicion_ruido_periodos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  punto_id                 uuid NOT NULL REFERENCES public.medicion_ruido_puntos(id) ON DELETE CASCADE,
  laeq_dba                 numeric NOT NULL,
  tiempo_exposicion_horas  numeric NOT NULL,
  orden                    integer
);
CREATE INDEX IF NOT EXISTS idx_med_ruido_periodos_punto
  ON public.medicion_ruido_periodos (punto_id);

-- ─── 5. SEED de instrumentos de ruido ───────────────────────
-- mediciones_instrumentos_tipos columnas: id, nombre, descripcion, created_at
-- (NO hay is_active). Ya existe 'Decibelímetro'. El protocolo de ruido usa
-- sonómetro/decibelímetro/dosímetro: agregamos los faltantes 'Sonómetro' y
-- 'Dosímetro'. Idempotente por nombre.
INSERT INTO public.mediciones_instrumentos_tipos (nombre)
SELECT v.nombre
FROM (VALUES ('Sonómetro'), ('Dosímetro')) AS v(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.mediciones_instrumentos_tipos t WHERE t.nombre = v.nombre
);

-- ─── 6. RLS — tablas del protocolo (por establecimiento) ────
ALTER TABLE public.medicion_ruido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_ruido: select" ON public.medicion_ruido;
CREATE POLICY "medicion_ruido: select" ON public.medicion_ruido FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.is_developer())
    AND public.has_establecimiento_read_access(establecimiento_id)
  );

DROP POLICY IF EXISTS "medicion_ruido: insert" ON public.medicion_ruido;
CREATE POLICY "medicion_ruido: insert" ON public.medicion_ruido FOR INSERT TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "medicion_ruido: update" ON public.medicion_ruido;
CREATE POLICY "medicion_ruido: update" ON public.medicion_ruido FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "medicion_ruido: delete" ON public.medicion_ruido;
CREATE POLICY "medicion_ruido: delete" ON public.medicion_ruido FOR DELETE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

-- Puntos: tenant derivado de la cabecera (EXISTS join, igual que iluminacion_puntos).
ALTER TABLE public.medicion_ruido_puntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_ruido_puntos: select" ON public.medicion_ruido_puntos;
CREATE POLICY "medicion_ruido_puntos: select" ON public.medicion_ruido_puntos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_ruido m
    WHERE m.id = medicion_id
      AND (m.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_ruido_puntos: insert" ON public.medicion_ruido_puntos;
CREATE POLICY "medicion_ruido_puntos: insert" ON public.medicion_ruido_puntos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medicion_ruido m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_ruido_puntos: update" ON public.medicion_ruido_puntos;
CREATE POLICY "medicion_ruido_puntos: update" ON public.medicion_ruido_puntos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_ruido m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medicion_ruido m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_ruido_puntos: delete" ON public.medicion_ruido_puntos;
CREATE POLICY "medicion_ruido_puntos: delete" ON public.medicion_ruido_puntos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_ruido m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

-- Períodos: tenant derivado por doble join (período → punto → cabecera).
ALTER TABLE public.medicion_ruido_periodos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_ruido_periodos: select" ON public.medicion_ruido_periodos;
CREATE POLICY "medicion_ruido_periodos: select" ON public.medicion_ruido_periodos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_ruido_puntos p
    JOIN public.medicion_ruido m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND (m.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_ruido_periodos: insert" ON public.medicion_ruido_periodos;
CREATE POLICY "medicion_ruido_periodos: insert" ON public.medicion_ruido_periodos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.medicion_ruido_puntos p
    JOIN public.medicion_ruido m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_ruido_periodos: update" ON public.medicion_ruido_periodos;
CREATE POLICY "medicion_ruido_periodos: update" ON public.medicion_ruido_periodos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_ruido_puntos p
    JOIN public.medicion_ruido m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.medicion_ruido_puntos p
    JOIN public.medicion_ruido m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_ruido_periodos: delete" ON public.medicion_ruido_periodos;
CREATE POLICY "medicion_ruido_periodos: delete" ON public.medicion_ruido_periodos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_ruido_puntos p
    JOIN public.medicion_ruido m ON m.id = p.medicion_id
    WHERE p.id = punto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

-- ─── 7. updated_at trigger en la cabecera ───────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.medicion_ruido;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.medicion_ruido
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 8. Comentarios de documentación ────────────────────────
COMMENT ON TABLE public.medicion_ruido IS
  'Cabecera del Protocolo de Medición de Ruido (SRT 85/2012 — Res 295/03 Anexo V). Referencia suelta a gestiones_registros (particionada). RLS por establecimiento.';
COMMENT ON TABLE public.medicion_ruido_puntos IS
  'Puestos/puntos medidos de un protocolo de ruido. Tenant derivado de la cabecera (sin consultora_id, 3NF).';
COMMENT ON TABLE public.medicion_ruido_periodos IS
  'Períodos del método sonómetro (LAeq por tiempo de exposición) por punto medido. Tenant derivado por punto → cabecera.';

COMMIT;
