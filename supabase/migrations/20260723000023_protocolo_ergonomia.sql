-- ============================================================
-- Protocolo de Ergonomía (Res. SRT 886/15 + Disp. SRT 1/2016)
-- ============================================================
-- Módulo NUEVO. ADITIVA: tablas nuevas + 1 valor en el discriminador
-- tipo_ejecucion. NO toca datos ni tablas existentes (salvo el CHECK).
--
-- Diseño (mismo molde que medicion_carga_termica / medicion_pat):
--   - gestiones.tipo_ejecucion TEXT + CHECK (no enum) discrimina el flujo.
--   - Jerarquía: cabecera (ergonomia_evaluaciones)
--                  → tareas habituales (ergonomia_tareas)
--                  → factores por tarea (ergonomia_factores_tarea)  [9 factores A-I]
--                  → evaluación inicial por factor (ergonomia_evaluacion_factor)  [Planilla 2]
--                  → medidas correctivas (ergonomia_medidas)         [Planilla 3]
--                  → seguimiento (ergonomia_seguimiento)             [Planilla 4]
--   - La cabecera referencia gestiones_registros en forma SUELTA
--     (registro_gestion_id + rg_fecha_planificada), igual que los demás protocolos.
--   - Las tablas hijas NO llevan consultora_id (3NF: el tenant se deriva del padre).
--
-- Idempotente. RLS por establecimiento con has_establecimiento_read/write_access.
-- ============================================================

BEGIN;

-- ─── 1. Sumar 'protocolo_ergonomia' al discriminador tipo_ejecucion ─────
-- Se conservan TODOS los valores ya presentes en producción.
ALTER TABLE public.gestiones DROP CONSTRAINT IF EXISTS chk_gestiones_tipo_ejecucion;
ALTER TABLE public.gestiones ADD CONSTRAINT chk_gestiones_tipo_ejecucion
  CHECK (tipo_ejecucion IN (
    'estandar',
    'reporte_fotografico',
    'medicion_iluminacion',
    'medicion_ruido',
    'medicion_carga_termica',
    'calculo_carga_fuego',
    'medicion_pat',
    'presentacion_autoproteccion',
    'protocolo_ergonomia'
  ));
COMMENT ON COLUMN public.gestiones.tipo_ejecucion IS
  'Flujo del botón Ejecutar: estandar | reporte_fotografico | medicion_iluminacion | medicion_ruido | medicion_carga_termica | calculo_carga_fuego | medicion_pat | presentacion_autoproteccion | protocolo_ergonomia (Res. SRT 886/15).';

-- ─── 2. Cabecera del protocolo (Planilla 1 – datos generales) ────────────
CREATE TABLE IF NOT EXISTS public.ergonomia_evaluaciones (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id               uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id          uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  -- Referencia suelta a gestiones_registros (tabla particionada → sin FK dura).
  registro_gestion_id         uuid NOT NULL,
  rg_fecha_planificada        date NOT NULL,
  gestion_establecimiento_id  uuid REFERENCES public.gestiones_establecimientos(id) ON DELETE SET NULL,

  -- Cabecera Planilla 1
  area_sector                 text,
  puesto_de_trabajo           text,
  n_trabajadores              integer,
  capacitacion                boolean,              -- SI/NO
  procedimiento_escrito       boolean,              -- SI/NO
  ubicacion_sintoma           text,
  nombre_trabajadores         text,                 -- texto libre o derivado de persona
  trabajador_persona_id       uuid REFERENCES public.personas_directorio(id) ON DELETE SET NULL,
  manifestacion_temprana      boolean,              -- SI/NO

  -- Firmante
  firmante                    text,
  firmante_persona_id         uuid REFERENCES public.personas_directorio(id) ON DELETE SET NULL,

  -- Observaciones globales y conclusiones
  observaciones               text,
  conclusiones                text,
  recomendaciones             text,

  -- Estado del registro
  estado                      text NOT NULL DEFAULT 'borrador',
  fecha_evaluacion            date,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_erg_ev_registro
  ON public.ergonomia_evaluaciones (registro_gestion_id, rg_fecha_planificada);
CREATE INDEX IF NOT EXISTS idx_erg_ev_establecimiento
  ON public.ergonomia_evaluaciones (establecimiento_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_erg_ev_consultora
  ON public.ergonomia_evaluaciones (consultora_id);

-- ─── 3. Tareas habituales del puesto (Planilla 1 – grilla de tareas) ─────
-- Hasta 3 tareas (1, 2, 3) según el formulario oficial.
CREATE TABLE IF NOT EXISTS public.ergonomia_tareas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id   uuid NOT NULL REFERENCES public.ergonomia_evaluaciones(id) ON DELETE CASCADE,
  numero          integer NOT NULL CHECK (numero BETWEEN 1 AND 3),
  descripcion     text,
  orden           integer,
  UNIQUE (evaluacion_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_erg_tareas_evaluacion
  ON public.ergonomia_tareas (evaluacion_id);

-- ─── 4. Factores de riesgo por tarea (Planilla 1 – grilla 9 factores × 3 tareas) ─
-- Cada fila representa 1 factor (A–I) × 1 tarea (1–3).
-- tiempo_exposicion y nivel_riesgo son los campos de la grilla.
CREATE TABLE IF NOT EXISTS public.ergonomia_factores_tarea (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id       uuid NOT NULL REFERENCES public.ergonomia_evaluaciones(id) ON DELETE CASCADE,
  factor              text NOT NULL,          -- 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'
  tarea_numero        integer NOT NULL CHECK (tarea_numero BETWEEN 1 AND 3),
  presente            boolean DEFAULT false,
  tiempo_exposicion   text,                   -- ej. "2 h/día", "30 min"
  nivel_riesgo        text,                   -- 'tolerable' | 'no_tolerable' | 'requiere_evaluacion'
  UNIQUE (evaluacion_id, factor, tarea_numero)
);
ALTER TABLE public.ergonomia_factores_tarea DROP CONSTRAINT IF EXISTS chk_erg_ft_factor;
ALTER TABLE public.ergonomia_factores_tarea ADD CONSTRAINT chk_erg_ft_factor
  CHECK (factor IN ('A','B','C','D','E','F','G','H','I'));
ALTER TABLE public.ergonomia_factores_tarea DROP CONSTRAINT IF EXISTS chk_erg_ft_nivel;
ALTER TABLE public.ergonomia_factores_tarea ADD CONSTRAINT chk_erg_ft_nivel
  CHECK (nivel_riesgo IS NULL OR nivel_riesgo IN ('tolerable','no_tolerable','requiere_evaluacion'));

CREATE INDEX IF NOT EXISTS idx_erg_ft_evaluacion
  ON public.ergonomia_factores_tarea (evaluacion_id);

-- ─── 5. Evaluación inicial por factor (Planilla 2) ───────────────────────
-- Una fila por factor × tarea_numero evaluado (solo los que resultaron presentes).
-- Paso 1 y Paso 2 se guardan como JSONB arrays de { n: number, respuesta: boolean }.
CREATE TABLE IF NOT EXISTS public.ergonomia_evaluacion_factor (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id       uuid NOT NULL REFERENCES public.ergonomia_evaluaciones(id) ON DELETE CASCADE,
  factor              text NOT NULL,
  tarea_numero        integer NOT NULL CHECK (tarea_numero BETWEEN 1 AND 3),
  -- Paso 1: array [{ n: 1, respuesta: true }, ...]
  paso1_respuestas    jsonb NOT NULL DEFAULT '[]'::jsonb,
  paso1_implica       boolean,                -- resumen: ¿la tarea implica el factor?
  -- Paso 2: array [{ n: 1, respuesta: true }, ...]
  paso2_respuestas    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Nivel resultante de la evaluación inicial de este factor+tarea
  nivel_resultante    text,                   -- 'tolerable' | 'no_tolerable' | 'requiere_evaluacion'
  observaciones       text,
  -- Para vibraciones: subtipo (mano_brazo | cuerpo_entero) — solo factor G
  vibracion_subtipo   text,
  UNIQUE (evaluacion_id, factor, tarea_numero)
);
ALTER TABLE public.ergonomia_evaluacion_factor DROP CONSTRAINT IF EXISTS chk_erg_ef_factor;
ALTER TABLE public.ergonomia_evaluacion_factor ADD CONSTRAINT chk_erg_ef_factor
  CHECK (factor IN ('A','B','C','D','E','F','G','H','I'));
ALTER TABLE public.ergonomia_evaluacion_factor DROP CONSTRAINT IF EXISTS chk_erg_ef_nivel;
ALTER TABLE public.ergonomia_evaluacion_factor ADD CONSTRAINT chk_erg_ef_nivel
  CHECK (nivel_resultante IS NULL OR nivel_resultante IN ('tolerable','no_tolerable','requiere_evaluacion'));
ALTER TABLE public.ergonomia_evaluacion_factor DROP CONSTRAINT IF EXISTS chk_erg_ef_vib_subtipo;
ALTER TABLE public.ergonomia_evaluacion_factor ADD CONSTRAINT chk_erg_ef_vib_subtipo
  CHECK (vibracion_subtipo IS NULL OR vibracion_subtipo IN ('mano_brazo','cuerpo_entero'));

CREATE INDEX IF NOT EXISTS idx_erg_ef_evaluacion
  ON public.ergonomia_evaluacion_factor (evaluacion_id);

-- ─── 6. Medidas correctivas y preventivas (Planilla 3) ──────────────────
CREATE TABLE IF NOT EXISTS public.ergonomia_medidas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id           uuid NOT NULL REFERENCES public.ergonomia_evaluaciones(id) ON DELETE CASCADE,
  tarea_numero            integer CHECK (tarea_numero BETWEEN 1 AND 3),
  -- Medidas generales (3 fijas del formulario oficial)
  -- MG1: informado el trabajador/es, supervisor/es, etc.
  mg1_informado           boolean,
  mg1_fecha               date,
  mg1_observaciones       text,
  -- MG2: capacitado en identificación de síntomas
  mg2_capacitado_sintomas boolean,
  mg2_fecha               date,
  mg2_observaciones       text,
  -- MG3: capacitado en medidas/procedimientos preventivos
  mg3_capacitado_medidas  boolean,
  mg3_fecha               date,
  mg3_observaciones       text,
  -- Medidas específicas (libres — hasta 35 según el formulario)
  medidas_especificas     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ descripcion: string, tipo: 'administrativa'|'ingenieria', fecha?: string, observaciones?: string }]
  observaciones           text
);
CREATE INDEX IF NOT EXISTS idx_erg_medidas_evaluacion
  ON public.ergonomia_medidas (evaluacion_id);

-- ─── 7. Matriz de seguimiento de medidas preventivas (Planilla 4) ────────
CREATE TABLE IF NOT EXISTS public.ergonomia_seguimiento (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluacion_id                   uuid NOT NULL REFERENCES public.ergonomia_evaluaciones(id) ON DELETE CASCADE,
  numero_mcp                      integer,           -- N° medida correctiva/preventiva
  nombre_puesto                   text,
  fecha_evaluacion                date,
  nivel_riesgo                    text,
  fecha_implementacion_admin      date,
  fecha_implementacion_ingenieria date,
  fecha_cierre                    date,
  observaciones                   text,
  orden                           integer
);
CREATE INDEX IF NOT EXISTS idx_erg_seg_evaluacion
  ON public.ergonomia_seguimiento (evaluacion_id);

-- ─── 8. RLS — cabecera ───────────────────────────────────────────────────
ALTER TABLE public.ergonomia_evaluaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ergonomia_evaluaciones: select" ON public.ergonomia_evaluaciones;
CREATE POLICY "ergonomia_evaluaciones: select" ON public.ergonomia_evaluaciones FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.is_developer())
    AND public.has_establecimiento_read_access(establecimiento_id)
  );

DROP POLICY IF EXISTS "ergonomia_evaluaciones: insert" ON public.ergonomia_evaluaciones;
CREATE POLICY "ergonomia_evaluaciones: insert" ON public.ergonomia_evaluaciones FOR INSERT TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "ergonomia_evaluaciones: update" ON public.ergonomia_evaluaciones;
CREATE POLICY "ergonomia_evaluaciones: update" ON public.ergonomia_evaluaciones FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "ergonomia_evaluaciones: delete" ON public.ergonomia_evaluaciones;
CREATE POLICY "ergonomia_evaluaciones: delete" ON public.ergonomia_evaluaciones FOR DELETE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

-- ─── 9. RLS — tareas (tenant derivado de la cabecera) ───────────────────
ALTER TABLE public.ergonomia_tareas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ergonomia_tareas: select" ON public.ergonomia_tareas;
CREATE POLICY "ergonomia_tareas: select" ON public.ergonomia_tareas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id
      AND (e.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_tareas: insert" ON public.ergonomia_tareas;
CREATE POLICY "ergonomia_tareas: insert" ON public.ergonomia_tareas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_tareas: update" ON public.ergonomia_tareas;
CREATE POLICY "ergonomia_tareas: update" ON public.ergonomia_tareas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_tareas: delete" ON public.ergonomia_tareas;
CREATE POLICY "ergonomia_tareas: delete" ON public.ergonomia_tareas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

-- ─── 10. RLS — factores por tarea ────────────────────────────────────────
ALTER TABLE public.ergonomia_factores_tarea ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ergonomia_factores_tarea: select" ON public.ergonomia_factores_tarea;
CREATE POLICY "ergonomia_factores_tarea: select" ON public.ergonomia_factores_tarea FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id
      AND (e.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_factores_tarea: insert" ON public.ergonomia_factores_tarea;
CREATE POLICY "ergonomia_factores_tarea: insert" ON public.ergonomia_factores_tarea FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_factores_tarea: update" ON public.ergonomia_factores_tarea;
CREATE POLICY "ergonomia_factores_tarea: update" ON public.ergonomia_factores_tarea FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_factores_tarea: delete" ON public.ergonomia_factores_tarea;
CREATE POLICY "ergonomia_factores_tarea: delete" ON public.ergonomia_factores_tarea FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

-- ─── 11. RLS — evaluación inicial por factor ─────────────────────────────
ALTER TABLE public.ergonomia_evaluacion_factor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ergonomia_evaluacion_factor: select" ON public.ergonomia_evaluacion_factor;
CREATE POLICY "ergonomia_evaluacion_factor: select" ON public.ergonomia_evaluacion_factor FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id
      AND (e.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_evaluacion_factor: insert" ON public.ergonomia_evaluacion_factor;
CREATE POLICY "ergonomia_evaluacion_factor: insert" ON public.ergonomia_evaluacion_factor FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_evaluacion_factor: update" ON public.ergonomia_evaluacion_factor;
CREATE POLICY "ergonomia_evaluacion_factor: update" ON public.ergonomia_evaluacion_factor FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_evaluacion_factor: delete" ON public.ergonomia_evaluacion_factor;
CREATE POLICY "ergonomia_evaluacion_factor: delete" ON public.ergonomia_evaluacion_factor FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

-- ─── 12. RLS — medidas ───────────────────────────────────────────────────
ALTER TABLE public.ergonomia_medidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ergonomia_medidas: select" ON public.ergonomia_medidas;
CREATE POLICY "ergonomia_medidas: select" ON public.ergonomia_medidas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id
      AND (e.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_medidas: insert" ON public.ergonomia_medidas;
CREATE POLICY "ergonomia_medidas: insert" ON public.ergonomia_medidas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_medidas: update" ON public.ergonomia_medidas;
CREATE POLICY "ergonomia_medidas: update" ON public.ergonomia_medidas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_medidas: delete" ON public.ergonomia_medidas;
CREATE POLICY "ergonomia_medidas: delete" ON public.ergonomia_medidas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

-- ─── 13. RLS — seguimiento ───────────────────────────────────────────────
ALTER TABLE public.ergonomia_seguimiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ergonomia_seguimiento: select" ON public.ergonomia_seguimiento;
CREATE POLICY "ergonomia_seguimiento: select" ON public.ergonomia_seguimiento FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id
      AND (e.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_seguimiento: insert" ON public.ergonomia_seguimiento;
CREATE POLICY "ergonomia_seguimiento: insert" ON public.ergonomia_seguimiento FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_seguimiento: update" ON public.ergonomia_seguimiento;
CREATE POLICY "ergonomia_seguimiento: update" ON public.ergonomia_seguimiento FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ergonomia_seguimiento: delete" ON public.ergonomia_seguimiento;
CREATE POLICY "ergonomia_seguimiento: delete" ON public.ergonomia_seguimiento FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ergonomia_evaluaciones e
    WHERE e.id = evaluacion_id AND public.has_establecimiento_write_access(e.establecimiento_id)
  ));

-- ─── 14. updated_at trigger en la cabecera ───────────────────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.ergonomia_evaluaciones;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.ergonomia_evaluaciones
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 15. Mapear gestión "ergonomía" existente al nuevo tipo_ejecucion ─────
-- Si en el catálogo ya existe una gestión con nombre tipo "ergonomía" / "886",
-- la asociamos al nuevo flujo.  Idempotente (solo cambia si aún es 'estandar').
UPDATE public.gestiones
SET tipo_ejecucion = 'protocolo_ergonomia'
WHERE tipo_ejecucion = 'estandar'
  AND (
    nombre ILIKE '%ergono%'
    OR nombre ILIKE '%886%'
  );

-- ─── 16. Comentarios de documentación ────────────────────────────────────
COMMENT ON TABLE public.ergonomia_evaluaciones IS
  'Cabecera del Protocolo de Ergonomía (Res. SRT 886/15 + Disp. SRT 1/2016). Planilla 1 – datos generales. Referencia suelta a gestiones_registros (particionada). RLS por establecimiento.';
COMMENT ON TABLE public.ergonomia_tareas IS
  'Tareas habituales del puesto (hasta 3). Planilla 1 – columnas de la grilla.';
COMMENT ON TABLE public.ergonomia_factores_tarea IS
  'Factor de riesgo (A–I) × tarea (1–3): tiempo de exposición y nivel de riesgo preliminar. Planilla 1 – cuerpo de la grilla.';
COMMENT ON TABLE public.ergonomia_evaluacion_factor IS
  'Evaluación inicial por factor + tarea. PASO 1 y PASO 2 como JSONB. Planilla 2.';
COMMENT ON TABLE public.ergonomia_medidas IS
  'Medidas correctivas y preventivas (3 generales fijas + libres específicas). Planilla 3.';
COMMENT ON TABLE public.ergonomia_seguimiento IS
  'Matriz de seguimiento de medidas preventivas. Planilla 4.';

COMMIT;
