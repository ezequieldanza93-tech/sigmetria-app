-- ============================================================
-- Protocolo de Estrés Térmico por Calor / Carga Térmica (SRT 30/2023)
-- ============================================================
-- Migración FUNDACIONAL del módulo. ADITIVA: tablas nuevas + 1 valor en el
-- discriminador tipo_ejecucion + lookups de referencia + seed de instrumento.
-- NO toca datos ni tablas existentes (más allá de la gestión a "convertir").
--
-- Diseño (mismo molde que medicion_ruido / medicion_iluminacion):
--   - gestiones.tipo_ejecucion (TEXT + CHECK, NO enum) discrimina el flujo del
--     botón Ejecutar. Se recrea el CHECK conservando TODOS los valores en
--     producción y sumando 'medicion_carga_termica' (idempotente: el valor ya
--     puede existir si otra rama lo agregó).
--   - Anidamiento PROFUNDO: cabecera → puestos → períodos (60 min) → tareas.
--     Es el protocolo más complejo: el método es por trabajador/GHE.
--   - La cabecera referencia su gestiones_registros en forma SUELTA
--     (registro_gestion_id + rg_fecha_planificada, sin FK dura): esa tabla está
--     PARTICIONADA por fecha_planificada con PK compuesta (id, fecha_planificada).
--     Replicamos lo MISMO que ruido/iluminación.
--   - Las tablas hijas NO llevan consultora_id (3NF: el tenant se deriva del padre).
--
-- Idempotente. RLS por establecimiento con has_establecimiento_read/write_access.
-- ============================================================

BEGIN;

-- ─── 1. Sumar 'medicion_carga_termica' al discriminador tipo_ejecucion ──
-- tipo_ejecucion es TEXT + CHECK (no enum). Se recrea el CHECK con TODOS los
-- valores presentes en producción (no perder los previos) + el de carga térmica.
ALTER TABLE public.gestiones DROP CONSTRAINT IF EXISTS chk_gestiones_tipo_ejecucion;
ALTER TABLE public.gestiones ADD CONSTRAINT chk_gestiones_tipo_ejecucion
  CHECK (tipo_ejecucion IN (
    'estandar', 'reporte_fotografico', 'medicion_iluminacion', 'medicion_ruido',
    'medicion_carga_termica', 'calculo_carga_fuego', 'medicion_pat'
  ));
COMMENT ON COLUMN public.gestiones.tipo_ejecucion IS
  'Flujo del botón Ejecutar: estandar | reporte_fotografico | medicion_iluminacion | medicion_ruido | medicion_carga_termica (protocolo SRT 30/2023) | calculo_carga_fuego | medicion_pat.';

-- ─── 2. Cabecera del protocolo de carga térmica ─────────────
CREATE TABLE IF NOT EXISTS public.medicion_carga_termica (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id               uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id          uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  registro_gestion_id         uuid NOT NULL,   -- referencia suelta (gestiones_registros está particionada)
  rg_fecha_planificada        date NOT NULL,   -- compañera de la referencia suelta (PK compuesta del padre)
  gestion_establecimiento_id  uuid REFERENCES public.gestiones_establecimientos(id) ON DELETE SET NULL,
  instrumento_id              uuid REFERENCES public.mediciones_instrumentos(id) ON DELETE SET NULL,
  certificado_id              uuid REFERENCES public.certificados_calibracion(id) ON DELETE SET NULL,
  firmante                    text,
  fecha_medicion              date,
  fecha_medicion_fin          date,
  hora_inicio                 time,
  hora_fin                    time,
  turnos                      text,
  -- Condiciones atmosféricas (fuente: SMN o in situ).
  fuente_datos_atm            text,
  atm_temp_max                numeric,
  atm_temp_min                numeric,
  atm_humedad                 numeric,
  atm_presion                 numeric,
  atm_viento                  text,
  condiciones_puesto          text,
  representante_trabajadores  text,
  representante_empresa       text,
  observaciones               text,
  -- Conclusiones separadas según trabajador aclimatado / no aclimatado.
  conclusiones_aclimatado     text,
  conclusiones_no_aclimatado  text,
  recomendaciones             text,
  certificado_url             text,            -- PATH en bucket (no URL)
  plano_url                   text,            -- PATH en bucket (no URL)
  estado                      text NOT NULL DEFAULT 'borrador',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_med_ct_registro
  ON public.medicion_carga_termica (registro_gestion_id, rg_fecha_planificada);
CREATE INDEX IF NOT EXISTS idx_med_ct_establecimiento
  ON public.medicion_carga_termica (establecimiento_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_med_ct_consultora
  ON public.medicion_carga_termica (consultora_id);

-- ─── 3. Puestos del protocolo (1 fila por trabajador/GHE) ────
CREATE TABLE IF NOT EXISTS public.medicion_carga_termica_puestos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicion_id         uuid NOT NULL REFERENCES public.medicion_carga_termica(id) ON DELETE CASCADE,
  nombre_puesto       text,
  ambiente_homogeneo  boolean,
  altura_medicion     numeric,          -- solo cuando el ambiente NO es homogéneo
  tipo_fuente         text,             -- 'fija' | 'movil'
  trabajador          text,
  ghe                 boolean,          -- Grupo de Exposición Homogénea
  aclimatado          boolean,          -- define el límite a aplicar (VLP/VLA)
  conclusion          text,
  orden               integer
);
ALTER TABLE public.medicion_carga_termica_puestos DROP CONSTRAINT IF EXISTS chk_med_ct_pto_tipo_fuente;
ALTER TABLE public.medicion_carga_termica_puestos ADD CONSTRAINT chk_med_ct_pto_tipo_fuente
  CHECK (tipo_fuente IS NULL OR tipo_fuente IN ('fija', 'movil'));

CREATE INDEX IF NOT EXISTS idx_med_ct_puestos_medicion
  ON public.medicion_carga_termica_puestos (medicion_id);

-- ─── 4. Períodos del puesto (60 min cada uno) ────────────────
CREATE TABLE IF NOT EXISTS public.medicion_carga_termica_periodos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  puesto_id       uuid NOT NULL REFERENCES public.medicion_carga_termica_puestos(id) ON DELETE CASCADE,
  numero          integer,
  hora_inicio     time,
  exterior        boolean,          -- ajusta la fórmula del TGBH (interior vs exterior)
  tgbh_ponderado  numeric,
  tm_ponderado    numeric,
  var_ponderado   numeric,
  tgbhef          numeric,          -- TGBH efectivo = TGBH ponderado + VAR ponderado
  vlp             numeric,          -- Valor Límite Permisible (no aclimatado)
  vla             numeric,          -- Valor Límite de Acción (aclimatado)
  supera_vlp      boolean,
  supera_vla      boolean,
  regimen_ft      numeric,          -- régimen trabajo/descanso (min de trabajo) si supera el límite
  info_adicional  text,
  orden           integer
);
CREATE INDEX IF NOT EXISTS idx_med_ct_periodos_puesto
  ON public.medicion_carga_termica_periodos (puesto_id);

-- ─── 5. Tareas del período (la suma de tiempos debe dar 60 min) ──
CREATE TABLE IF NOT EXISTS public.medicion_carga_termica_tareas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id   uuid NOT NULL REFERENCES public.medicion_carga_termica_periodos(id) ON DELETE CASCADE,
  numero       integer,
  descripcion  text,
  tiempo_min   numeric,
  tm_w         numeric,             -- tasa metabólica (W)
  tgbh         numeric,             -- TGBH de la tarea (interior o exterior)
  var          numeric,             -- valor de adición por ropa (VAR)
  orden        integer
);
CREATE INDEX IF NOT EXISTS idx_med_ct_tareas_periodo
  ON public.medicion_carga_termica_tareas (periodo_id);

-- ─── 6. Lookups de referencia (instructivo SRT 30/2023) ─────
-- ct_var_ropa (Tabla 1): valor de adición por tipo de ropa (VAR).
CREATE TABLE IF NOT EXISTS public.ct_var_ropa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_ropa   text NOT NULL,
  var         numeric NOT NULL,
  orden       integer
);
INSERT INTO public.ct_var_ropa (tipo_ropa, var, orden)
SELECT v.tipo_ropa, v.var, v.orden
FROM (VALUES
  ('Ropa de trabajo (algodón)'::text,           0::numeric,   1),
  ('Overol de tejido',                           0::numeric,   2),
  ('Overol de polipropileno SMS',                0.5::numeric, 3),
  ('Overol de poliolefina',                      1::numeric,   4),
  ('Ropa tejida de doble capa',                  3::numeric,   5),
  ('Overol barrera de vapor con capucha',        11::numeric,  6)
) AS v(tipo_ropa, var, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.ct_var_ropa t WHERE t.tipo_ropa = v.tipo_ropa);

-- ct_tm_actividad (Tabla 4 + Tabla 5): tasa metabólica (W) por actividad.
CREATE TABLE IF NOT EXISTS public.ct_tm_actividad (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actividad   text NOT NULL,
  tm_w        numeric NOT NULL,
  orden       integer
);
INSERT INTO public.ct_tm_actividad (actividad, tm_w, orden)
SELECT v.actividad, v.tm_w, v.orden
FROM (VALUES
  -- Tabla 4 — tasas metabólicas por tipo de tarea (instructivo SRT 30/2023)
  ('Sentado, actividad sedentaria'::text,                        126::numeric,  1),
  ('De pie, trabajo ligero',                                     171::numeric,  2),
  ('De pie, trabajo medio en máquina o banco',                   207::numeric,  3),
  ('Trabajo con herramienta manual: ligero',                     180::numeric,  4),
  ('Trabajo con herramienta manual: pesado',                     414::numeric,  5),
  ('Cavar una zanja',                                            522::numeric,  6),
  ('Caminar en llano a 4 km/h',                                  297::numeric,  7),
  -- Tabla 5 — categorías generales de tasa metabólica
  ('Descanso',                                                   115::numeric,  8),
  ('Trabajo ligero',                                             180::numeric,  9),
  ('Trabajo moderado',                                           300::numeric, 10),
  ('Trabajo pesado',                                             415::numeric, 11),
  ('Trabajo muy pesado',                                         520::numeric, 12)
) AS v(actividad, tm_w, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.ct_tm_actividad t WHERE t.actividad = v.actividad);

-- ─── 7. SEED de instrumento de carga térmica ────────────────
-- mediciones_instrumentos_tipos: id, nombre, descripcion, created_at (sin is_active).
-- El protocolo usa un Monitor de Estrés Térmico (TGBH). Idempotente por nombre.
INSERT INTO public.mediciones_instrumentos_tipos (nombre)
SELECT 'Monitor de Estrés Térmico'
WHERE NOT EXISTS (
  SELECT 1 FROM public.mediciones_instrumentos_tipos t WHERE t.nombre = 'Monitor de Estrés Térmico'
);

-- ─── 8. RLS — cabecera (por establecimiento) ────────────────
ALTER TABLE public.medicion_carga_termica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_carga_termica: select" ON public.medicion_carga_termica;
CREATE POLICY "medicion_carga_termica: select" ON public.medicion_carga_termica FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.is_developer())
    AND public.has_establecimiento_read_access(establecimiento_id)
  );

DROP POLICY IF EXISTS "medicion_carga_termica: insert" ON public.medicion_carga_termica;
CREATE POLICY "medicion_carga_termica: insert" ON public.medicion_carga_termica FOR INSERT TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "medicion_carga_termica: update" ON public.medicion_carga_termica;
CREATE POLICY "medicion_carga_termica: update" ON public.medicion_carga_termica FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "medicion_carga_termica: delete" ON public.medicion_carga_termica;
CREATE POLICY "medicion_carga_termica: delete" ON public.medicion_carga_termica FOR DELETE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

-- ─── 9. RLS — puestos (tenant derivado de la cabecera) ──────
ALTER TABLE public.medicion_carga_termica_puestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_carga_termica_puestos: select" ON public.medicion_carga_termica_puestos;
CREATE POLICY "medicion_carga_termica_puestos: select" ON public.medicion_carga_termica_puestos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_carga_termica m
    WHERE m.id = medicion_id
      AND (m.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_puestos: insert" ON public.medicion_carga_termica_puestos;
CREATE POLICY "medicion_carga_termica_puestos: insert" ON public.medicion_carga_termica_puestos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medicion_carga_termica m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_puestos: update" ON public.medicion_carga_termica_puestos;
CREATE POLICY "medicion_carga_termica_puestos: update" ON public.medicion_carga_termica_puestos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_carga_termica m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.medicion_carga_termica m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_puestos: delete" ON public.medicion_carga_termica_puestos;
CREATE POLICY "medicion_carga_termica_puestos: delete" ON public.medicion_carga_termica_puestos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.medicion_carga_termica m
    WHERE m.id = medicion_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

-- ─── 10. RLS — períodos (período → puesto → cabecera) ───────
ALTER TABLE public.medicion_carga_termica_periodos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_carga_termica_periodos: select" ON public.medicion_carga_termica_periodos;
CREATE POLICY "medicion_carga_termica_periodos: select" ON public.medicion_carga_termica_periodos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_puestos p
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE p.id = puesto_id
      AND (m.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_periodos: insert" ON public.medicion_carga_termica_periodos;
CREATE POLICY "medicion_carga_termica_periodos: insert" ON public.medicion_carga_termica_periodos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_puestos p
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE p.id = puesto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_periodos: update" ON public.medicion_carga_termica_periodos;
CREATE POLICY "medicion_carga_termica_periodos: update" ON public.medicion_carga_termica_periodos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_puestos p
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE p.id = puesto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_puestos p
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE p.id = puesto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_periodos: delete" ON public.medicion_carga_termica_periodos;
CREATE POLICY "medicion_carga_termica_periodos: delete" ON public.medicion_carga_termica_periodos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_puestos p
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE p.id = puesto_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

-- ─── 11. RLS — tareas (tarea → período → puesto → cabecera) ─
ALTER TABLE public.medicion_carga_termica_tareas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicion_carga_termica_tareas: select" ON public.medicion_carga_termica_tareas;
CREATE POLICY "medicion_carga_termica_tareas: select" ON public.medicion_carga_termica_tareas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_periodos per
    JOIN public.medicion_carga_termica_puestos p ON p.id = per.puesto_id
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE per.id = periodo_id
      AND (m.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_tareas: insert" ON public.medicion_carga_termica_tareas;
CREATE POLICY "medicion_carga_termica_tareas: insert" ON public.medicion_carga_termica_tareas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_periodos per
    JOIN public.medicion_carga_termica_puestos p ON p.id = per.puesto_id
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE per.id = periodo_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_tareas: update" ON public.medicion_carga_termica_tareas;
CREATE POLICY "medicion_carga_termica_tareas: update" ON public.medicion_carga_termica_tareas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_periodos per
    JOIN public.medicion_carga_termica_puestos p ON p.id = per.puesto_id
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE per.id = periodo_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_periodos per
    JOIN public.medicion_carga_termica_puestos p ON p.id = per.puesto_id
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE per.id = periodo_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

DROP POLICY IF EXISTS "medicion_carga_termica_tareas: delete" ON public.medicion_carga_termica_tareas;
CREATE POLICY "medicion_carga_termica_tareas: delete" ON public.medicion_carga_termica_tareas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.medicion_carga_termica_periodos per
    JOIN public.medicion_carga_termica_puestos p ON p.id = per.puesto_id
    JOIN public.medicion_carga_termica m ON m.id = p.medicion_id
    WHERE per.id = periodo_id
      AND public.has_establecimiento_write_access(m.establecimiento_id)
  ));

-- ─── 12. RLS — lookups (lectura global, escritura super admin) ──
ALTER TABLE public.ct_var_ropa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ct_var_ropa: select" ON public.ct_var_ropa;
CREATE POLICY "ct_var_ropa: select" ON public.ct_var_ropa FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ct_var_ropa: write" ON public.ct_var_ropa;
CREATE POLICY "ct_var_ropa: write" ON public.ct_var_ropa FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

ALTER TABLE public.ct_tm_actividad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ct_tm_actividad: select" ON public.ct_tm_actividad;
CREATE POLICY "ct_tm_actividad: select" ON public.ct_tm_actividad FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ct_tm_actividad: write" ON public.ct_tm_actividad;
CREATE POLICY "ct_tm_actividad: write" ON public.ct_tm_actividad FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── 13. updated_at trigger en la cabecera ──────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.medicion_carga_termica;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.medicion_carga_termica
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 14. Convertir la gestión "Protocolo de Carga Térmica" ──
-- 1 match verificado en producción. Si el nombre cambiara, este UPDATE no afecta
-- otras gestiones (filtro acotado a los nombres del dominio de estrés térmico).
UPDATE public.gestiones
SET tipo_ejecucion = 'medicion_carga_termica'
WHERE (
  nombre ILIKE '%carga térmica%' OR nombre ILIKE '%carga termica%'
  OR nombre ILIKE '%estrés térmico%' OR nombre ILIKE '%estres termico%'
);

-- ─── 15. Comentarios de documentación ───────────────────────
COMMENT ON TABLE public.medicion_carga_termica IS
  'Cabecera del Protocolo de Estrés Térmico por Calor / Carga Térmica (SRT 30/2023). Referencia suelta a gestiones_registros (particionada). RLS por establecimiento.';
COMMENT ON TABLE public.medicion_carga_termica_puestos IS
  'Puestos medidos (1 por trabajador/GHE). Tenant derivado de la cabecera (sin consultora_id, 3NF).';
COMMENT ON TABLE public.medicion_carga_termica_periodos IS
  'Períodos de 60 min por puesto. Cálculos ponderados + TGBHef + VLP/VLA + supera + régimen f/t. Tenant derivado por puesto → cabecera.';
COMMENT ON TABLE public.medicion_carga_termica_tareas IS
  'Tareas dentro de un período (la suma de tiempos da 60 min). Tenant derivado por período → puesto → cabecera.';
COMMENT ON TABLE public.ct_var_ropa IS
  'Lookup VAR (valor de adición por ropa) — Tabla 1 del instructivo SRT 30/2023.';
COMMENT ON TABLE public.ct_tm_actividad IS
  'Lookup tasa metabólica (W) por actividad — Tablas 4 y 5 del instructivo SRT 30/2023.';

COMMIT;
