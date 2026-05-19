-- ============================================================
-- Migration: tipos_establecimiento FK + preguntas de riesgo
-- ============================================================

-- ── 1. tipos_establecimiento ──────────────────────────────────
CREATE TABLE public.tipos_establecimiento (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     text NOT NULL UNIQUE,
  nombre     text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tipos_establecimiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipos_establecimiento: select" ON public.tipos_establecimiento
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO public.tipos_establecimiento (codigo, nombre) VALUES
  ('CONSTRUCCION', 'Construcción'),
  ('INDUSTRIA',    'Industria / Manufactura'),
  ('COMERCIO',     'Comercio / Retail'),
  ('OFICINA',      'Oficinas / Administrativo'),
  ('AGRO',         'Agropecuario'),
  ('MINERIA',      'Minería'),
  ('LOGISTICA',    'Logística / Depósito'),
  ('CENTRO_SALUD', 'Centro de Salud'),
  ('OTRO',         'Otro');

-- ── 2. tipo_id FK en establecimientos ────────────────────────
ALTER TABLE public.establecimientos
  ADD COLUMN tipo_id uuid REFERENCES public.tipos_establecimiento(id);

UPDATE public.establecimientos e
SET tipo_id = t.id
FROM public.tipos_establecimiento t
WHERE
  (e.tipo::text = 'obra_construccion'    AND t.codigo = 'CONSTRUCCION') OR
  (e.tipo::text = 'industria'            AND t.codigo = 'INDUSTRIA')    OR
  (e.tipo::text = 'local_comercial'      AND t.codigo = 'COMERCIO')     OR
  (e.tipo::text = 'local_administrativo' AND t.codigo = 'OFICINA')      OR
  (e.tipo::text = 'otro'                 AND t.codigo = 'OTRO');

-- ── 3. preguntas_riesgo ───────────────────────────────────────
CREATE TABLE public.preguntas_riesgo (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     text NOT NULL UNIQUE,
  texto      text NOT NULL,
  orden      int  NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.preguntas_riesgo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "preguntas_riesgo: select" ON public.preguntas_riesgo
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- ── 4. pregunta_tipos (junction) ─────────────────────────────
CREATE TABLE public.pregunta_tipos (
  pregunta_id uuid NOT NULL REFERENCES public.preguntas_riesgo(id)    ON DELETE CASCADE,
  tipo_id     uuid NOT NULL REFERENCES public.tipos_establecimiento(id) ON DELETE CASCADE,
  orden       int  NOT NULL DEFAULT 0,
  PRIMARY KEY (pregunta_id, tipo_id)
);

ALTER TABLE public.pregunta_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pregunta_tipos: select" ON public.pregunta_tipos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- ── 5. Seed preguntas ─────────────────────────────────────────
INSERT INTO public.preguntas_riesgo (codigo, texto, orden) VALUES
  ('Q_CANCERIGENOS',  '¿Se utilizan o producen agentes cancerígenos o mutagénicos?',                              10),
  ('Q_QUIMICOS',      '¿Se trabaja con productos químicos peligrosos?',                                           20),
  ('Q_QUIM_AIRE',     '¿Existen emisiones de contaminantes químicos al aire de trabajo?',                         30),
  ('Q_CARGAS_RAD',    '¿Los trabajadores realizan levantamiento manual de cargas en forma repetitiva?',           40),
  ('Q_TENSION_ALTA',  '¿Existen instalaciones o equipos de alta tensión (más de 1000V)?',                        50),
  ('Q_TENSION_BAJA',  '¿Existen instalaciones o equipos de baja tensión?',                                       60),
  ('Q_CALOR',         '¿Los trabajadores están expuestos a ambientes calurosos o elevadas temperaturas?',         70),
  ('Q_AVISO_OBRA',    '¿La obra requiere aviso de inicio según la normativa vigente?',                            10),
  ('Q_MULTI_CONTRAT', '¿Intervienen múltiples contratistas o subcontratistas en la obra?',                       20),
  ('Q_REPETITIVA',    '¿Es una obra repetitiva (construcción seriada o en serie)?',                               30),
  ('Q_ANDAMIOS',      '¿Se utilizan andamios durante la ejecución de la obra?',                                   40),
  ('Q_DEMOLICION',    '¿Existen trabajos de demolición?',                                                         50),
  ('Q_EXCAV_120',     '¿Hay excavaciones de más de 1,20 metros de profundidad?',                                  60),
  ('Q_ALTURA',        '¿Se realizan trabajos en altura?',                                                         70),
  ('Q_PYME',          '¿La empresa califica como PyME según los criterios vigentes?',                             10),
  ('Q_TV_CABLE',      '¿Se producen o instalan equipos para televisión por cable o señal?',                       20),
  ('Q_CAMPAMENTO',    '¿Existen campamentos para alojamiento de trabajadores rurales?',                           10);

-- ── 6. Seed pregunta_tipos ────────────────────────────────────
-- Comunes a CONSTRUCCION, INDUSTRIA, COMERCIO, OFICINA, AGRO, MINERIA
INSERT INTO public.pregunta_tipos (pregunta_id, tipo_id, orden)
SELECT p.id, t.id, p.orden
FROM public.preguntas_riesgo p
CROSS JOIN public.tipos_establecimiento t
WHERE p.codigo IN ('Q_CANCERIGENOS','Q_QUIMICOS','Q_QUIM_AIRE','Q_CARGAS_RAD','Q_TENSION_ALTA','Q_TENSION_BAJA','Q_CALOR')
  AND t.codigo IN ('CONSTRUCCION','INDUSTRIA','COMERCIO','OFICINA','AGRO','MINERIA');

-- Específicas de CONSTRUCCION
INSERT INTO public.pregunta_tipos (pregunta_id, tipo_id, orden)
SELECT p.id, t.id, p.orden
FROM public.preguntas_riesgo p
JOIN public.tipos_establecimiento t ON t.codigo = 'CONSTRUCCION'
WHERE p.codigo IN ('Q_AVISO_OBRA','Q_MULTI_CONTRAT','Q_REPETITIVA','Q_ANDAMIOS','Q_DEMOLICION','Q_EXCAV_120','Q_ALTURA');

-- INDUSTRIA, COMERCIO, OFICINA: Q_PYME
INSERT INTO public.pregunta_tipos (pregunta_id, tipo_id, orden)
SELECT p.id, t.id, p.orden
FROM public.preguntas_riesgo p
CROSS JOIN public.tipos_establecimiento t
WHERE p.codigo = 'Q_PYME'
  AND t.codigo IN ('INDUSTRIA','COMERCIO','OFICINA');

-- Solo INDUSTRIA: Q_TV_CABLE
INSERT INTO public.pregunta_tipos (pregunta_id, tipo_id, orden)
SELECT p.id, t.id, p.orden
FROM public.preguntas_riesgo p
JOIN public.tipos_establecimiento t ON t.codigo = 'INDUSTRIA'
WHERE p.codigo = 'Q_TV_CABLE';

-- Solo AGRO: Q_CAMPAMENTO
INSERT INTO public.pregunta_tipos (pregunta_id, tipo_id, orden)
SELECT p.id, t.id, p.orden
FROM public.preguntas_riesgo p
JOIN public.tipos_establecimiento t ON t.codigo = 'AGRO'
WHERE p.codigo = 'Q_CAMPAMENTO';

-- ── 7. establecimiento_respuestas ────────────────────────────
CREATE TABLE public.establecimiento_respuestas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  pregunta_id        uuid NOT NULL REFERENCES public.preguntas_riesgo(id) ON DELETE CASCADE,
  respuesta          boolean NOT NULL DEFAULT false,
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (establecimiento_id, pregunta_id)
);

ALTER TABLE public.establecimiento_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "establecimiento_respuestas: select" ON public.establecimiento_respuestas
  FOR SELECT TO authenticated
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "establecimiento_respuestas: insert" ON public.establecimiento_respuestas
  FOR INSERT TO authenticated
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "establecimiento_respuestas: update" ON public.establecimiento_respuestas
  FOR UPDATE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "establecimiento_respuestas: delete" ON public.establecimiento_respuestas
  FOR DELETE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));

-- ── 8. Migrar datos de columnas boolean → establecimiento_respuestas ──
INSERT INTO public.establecimiento_respuestas (establecimiento_id, pregunta_id, respuesta)
SELECT e.id, p.id, e.tiene_demolicion
FROM public.establecimientos e
JOIN public.preguntas_riesgo p ON p.codigo = 'Q_DEMOLICION'
WHERE e.tipo::text = 'obra_construccion'
ON CONFLICT DO NOTHING;

INSERT INTO public.establecimiento_respuestas (establecimiento_id, pregunta_id, respuesta)
SELECT e.id, p.id, e.tiene_excavacion
FROM public.establecimientos e
JOIN public.preguntas_riesgo p ON p.codigo = 'Q_EXCAV_120'
WHERE e.tipo::text = 'obra_construccion'
ON CONFLICT DO NOTHING;

INSERT INTO public.establecimiento_respuestas (establecimiento_id, pregunta_id, respuesta)
SELECT e.id, p.id, e.tiene_alturas_mayores_6m
FROM public.establecimientos e
JOIN public.preguntas_riesgo p ON p.codigo = 'Q_ALTURA'
WHERE e.tipo::text = 'obra_construccion'
ON CONFLICT DO NOTHING;

INSERT INTO public.establecimiento_respuestas (establecimiento_id, pregunta_id, respuesta)
SELECT e.id, p.id, e.tiene_equipamiento_izaje
FROM public.establecimientos e
JOIN public.preguntas_riesgo p ON p.codigo = 'Q_MULTI_CONTRAT'
WHERE e.tipo::text = 'obra_construccion'
ON CONFLICT DO NOTHING;

INSERT INTO public.establecimiento_respuestas (establecimiento_id, pregunta_id, respuesta)
SELECT e.id, p.id, e.tiene_agentes_cancerigenos
FROM public.establecimientos e
JOIN public.preguntas_riesgo p ON p.codigo = 'Q_CANCERIGENOS'
WHERE e.tipo = 'industria'
ON CONFLICT DO NOTHING;

INSERT INTO public.establecimiento_respuestas (establecimiento_id, pregunta_id, respuesta)
SELECT e.id, p.id, e.tiene_sustancias_quimicas
FROM public.establecimientos e
JOIN public.preguntas_riesgo p ON p.codigo = 'Q_QUIMICOS'
WHERE e.tipo = 'industria'
ON CONFLICT DO NOTHING;

INSERT INTO public.establecimiento_respuestas (establecimiento_id, pregunta_id, respuesta)
SELECT e.id, p.id, e.tiene_exposicion_radiaciones
FROM public.establecimientos e
JOIN public.preguntas_riesgo p ON p.codigo = 'Q_CARGAS_RAD'
WHERE e.tipo = 'industria'
ON CONFLICT DO NOTHING;

-- ── 9. Drop columnas boolean obsoletas ───────────────────────
ALTER TABLE public.establecimientos
  DROP COLUMN IF EXISTS tiene_demolicion,
  DROP COLUMN IF EXISTS tiene_excavacion,
  DROP COLUMN IF EXISTS "tiene_submuración",
  DROP COLUMN IF EXISTS tiene_alturas_mayores_6m,
  DROP COLUMN IF EXISTS tiene_equipamiento_izaje,
  DROP COLUMN IF EXISTS tipo_contratista,
  DROP COLUMN IF EXISTS tiene_agentes_cancerigenos,
  DROP COLUMN IF EXISTS tiene_sustancias_quimicas,
  DROP COLUMN IF EXISTS tiene_exposicion_vibraciones,
  DROP COLUMN IF EXISTS tiene_exposicion_radiaciones,
  DROP COLUMN IF EXISTS descripcion_productos;
