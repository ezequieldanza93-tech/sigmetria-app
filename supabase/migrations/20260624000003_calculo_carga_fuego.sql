-- ============================================================
-- Cálculo de Carga de Fuego (Dec 351/79 Anexo VII)
-- ============================================================
-- Migración FUNDACIONAL del módulo. ADITIVA: tablas nuevas + 1 valor en el
-- discriminador tipo_ejecucion + seeds de referencia. NO toca datos ni tablas
-- existentes.
--
-- Diseño (mismo molde que medicion_iluminacion / medicion_ruido):
--   - gestiones.tipo_ejecucion discrimina el flujo del botón Ejecutar.
--     OJO: tipo_ejecucion es TEXT + CHECK constraint, NO un enum de Postgres.
--     Se agrega 'calculo_carga_fuego' recreando el CHECK conservando TODOS los
--     valores ya presentes en producción.
--   - calculo_carga_fuego            = cabecera del cálculo (1 fila por ejecución).
--   - calculo_carga_fuego_materiales = inventario de materiales combustibles (1 fila
--     por material), con su equivalente en madera.
--   - La cabecera referencia su gestiones_registros en forma SUELTA
--     (registro_gestion_id + rg_fecha_planificada, ambos sin FK dura): esa tabla
--     está PARTICIONADA por fecha_planificada con PK compuesta (id, fecha_planificada).
--     Replicamos lo MISMO que iluminacion / ruido.
--   - Los materiales NO llevan consultora_id (3NF: el tenant se deriva del padre).
--   - SIN instrumento de medición: es un cálculo por inventario, no una medición.
--     Por eso NO hay instrumento_id ni certificado_id (a diferencia de ruido).
--
-- Lookups de referencia (reference data del Anexo VII):
--   - dec351_materiales_pci             = PCI + coeficiente C por material.
--   - dec351_carga_fuego_resistencia    = Cuadros 2.2.1/2.2.2 (F en minutos).
--   - dec351_carga_fuego_extintor       = Tablas de potencial extintor A/B.
--   RLS: SELECT a authenticated (true), WRITE solo is_super_admin (mismo patrón que
--   las tablas dec351_iluminacion_*).
--
-- Idempotente. RLS de las tablas del cálculo por establecimiento con
-- has_establecimiento_read/write_access (helpers existentes).
-- ============================================================

BEGIN;

-- ─── 1. Sumar 'calculo_carga_fuego' al discriminador tipo_ejecucion ──
-- tipo_ejecucion es TEXT + CHECK (no enum). Se recrea el CHECK añadiendo el valor,
-- conservando TODOS los valores ya presentes en producción.
ALTER TABLE public.gestiones DROP CONSTRAINT IF EXISTS chk_gestiones_tipo_ejecucion;
ALTER TABLE public.gestiones ADD CONSTRAINT chk_gestiones_tipo_ejecucion
  CHECK (tipo_ejecucion IN (
    'estandar',
    'reporte_fotografico',
    'medicion_iluminacion',
    'medicion_ruido',
    'medicion_carga_termica',
    'medicion_pat',
    'calculo_carga_fuego'
  ));
COMMENT ON COLUMN public.gestiones.tipo_ejecucion IS
  'Flujo del botón Ejecutar: estandar | reporte_fotografico | medicion_iluminacion | medicion_ruido | medicion_carga_termica | medicion_pat | calculo_carga_fuego (Dec 351/79 Anexo VII).';

-- ─── 2. Cabecera del cálculo de carga de fuego ──────────────
CREATE TABLE IF NOT EXISTS public.calculo_carga_fuego (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id               uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id          uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  registro_gestion_id         uuid NOT NULL,   -- referencia suelta (gestiones_registros está particionada)
  rg_fecha_planificada        date NOT NULL,   -- compañera de la referencia suelta (PK compuesta del padre)
  gestion_establecimiento_id  uuid REFERENCES public.gestiones_establecimientos(id) ON DELETE SET NULL,
  firmante                    text,            -- profesional firmante (texto libre: nombre y matrícula)
  sector_incendio             text,            -- sector de incendio analizado
  superficie_m2               numeric,         -- superficie del sector (S, denominador del Qf)
  ventilacion                 text,            -- 'natural' | 'mecanica'
  riesgo                      text,            -- 'R1'..'R7'
  qf_kg_m2                    numeric,         -- carga de fuego = Σ(peso·C) / S
  f_exigido                   text,            -- resistencia al fuego exigida (minutos), lookup Cuadro 2.2
  potencial_extintor_a        text,            -- potencial extintor clase A, lookup Tabla 1
  potencial_extintor_b        text,            -- potencial extintor clase B, lookup Tabla 2
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

ALTER TABLE public.calculo_carga_fuego DROP CONSTRAINT IF EXISTS chk_ccf_ventilacion;
ALTER TABLE public.calculo_carga_fuego ADD CONSTRAINT chk_ccf_ventilacion
  CHECK (ventilacion IS NULL OR ventilacion IN ('natural', 'mecanica'));
ALTER TABLE public.calculo_carga_fuego DROP CONSTRAINT IF EXISTS chk_ccf_riesgo;
ALTER TABLE public.calculo_carga_fuego ADD CONSTRAINT chk_ccf_riesgo
  CHECK (riesgo IS NULL OR riesgo IN ('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'));

CREATE INDEX IF NOT EXISTS idx_ccf_registro
  ON public.calculo_carga_fuego (registro_gestion_id, rg_fecha_planificada);
CREATE INDEX IF NOT EXISTS idx_ccf_establecimiento
  ON public.calculo_carga_fuego (establecimiento_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ccf_consultora
  ON public.calculo_carga_fuego (consultora_id);

-- ─── 3. Materiales del inventario (1 fila por material) ─────
CREATE TABLE IF NOT EXISTS public.calculo_carga_fuego_materiales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculo_id      uuid NOT NULL REFERENCES public.calculo_carga_fuego(id) ON DELETE CASCADE,
  descripcion     text,
  estado          text,            -- estado físico (sólido / líquido / gas) — informativo
  peso_kg         numeric,
  pci_kcal        numeric,         -- poder calorífico inferior (kcal/kg)
  coef_c          numeric,         -- coeficiente C = pci_kcal / 4400 (madera = 1)
  equiv_madera_kg numeric,         -- equivalente en madera = peso_kg · coef_c
  orden           integer
);
CREATE INDEX IF NOT EXISTS idx_ccf_materiales_calculo
  ON public.calculo_carga_fuego_materiales (calculo_id);

-- ─── 4. Lookup: PCI + coeficiente C por material (Anexo VII) ──
CREATE TABLE IF NOT EXISTS public.dec351_materiales_pci (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text,
  material  text NOT NULL,
  pci_mj    numeric,   -- MJ/kg
  pci_kcal  numeric,   -- kcal/kg
  coef_c    numeric,   -- coeficiente C respecto a la madera (pci_kcal / 4400)
  orden     integer,
  is_active boolean NOT NULL DEFAULT true
);

-- ─── 5. Lookup: resistencia al fuego F (Cuadros 2.2.1 / 2.2.2) ──
CREATE TABLE IF NOT EXISTS public.dec351_carga_fuego_resistencia (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ventilacion text NOT NULL,   -- 'natural' | 'mecanica'
  riesgo      text NOT NULL,   -- 'R1'..'R5'
  franja      text NOT NULL,   -- 'Hasta 15' | '16 a 30' | '31 a 60' | '61 a 100' | '>100'
  f_minutos   text             -- F en minutos ('F 30', etc.) | 'NP' | '—'
);

-- ─── 6. Lookup: potencial extintor por clase A / B (Tablas 1 y 2) ──
CREATE TABLE IF NOT EXISTS public.dec351_carga_fuego_extintor (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clase     text NOT NULL,   -- 'A' | 'B'
  riesgo    text NOT NULL,   -- 'R1'..'R7'
  franja    text NOT NULL,   -- franja de carga de fuego
  potencial text             -- potencial extintor exigido (ej. '1A', '6B') | '—'
);

-- ─── 7. SEED dec351_materiales_pci (tabla de la guía) ───────
-- coef_c = pci_kcal / 4400 (madera = 1.00). Idempotente por material.
INSERT INTO public.dec351_materiales_pci (categoria, material, pci_mj, pci_kcal, coef_c, orden)
SELECT v.categoria, v.material, v.pci_mj, v.pci_kcal, v.coef_c, v.orden
FROM (VALUES
  ('Celulósicos',   'Madera',                18.41,  4400,  1.00,  10),
  ('Celulósicos',   'Papel / cartón',        16.3,   3900,  0.89,  20),
  ('Celulósicos',   'Algodón',               16.7,   4000,  0.91,  30),
  ('Celulósicos',   'Lana',                  21.8,   5200,  1.18,  40),
  ('Celulósicos',   'Cuero',                 18.8,   4500,  1.02,  50),
  ('Celulósicos',   'Corcho',                20.9,   5000,  1.14,  60),
  ('Celulósicos',   'Paja',                  15.5,   3700,  0.84,  70),
  ('Celulósicos',   'Azúcar',                16.7,   4000,  0.91,  80),
  ('Celulósicos',   'Harinas',               16.7,   4000,  0.91,  90),
  ('Carbones',      'Carbón mineral',        30.5,   7300,  1.66, 100),
  ('Carbones',      'Carbón vegetal',        33.5,   8000,  1.82, 110),
  ('Plásticos',     'PVC',                   18.0,   4300,  0.98, 120),
  ('Plásticos',     'Poliéster',             30.9,   7400,  1.68, 130),
  ('Plásticos',     'Poliestireno',          40.2,   9600,  2.18, 140),
  ('Plásticos',     'PE / PP',               44.0,  10500,  2.39, 150),
  ('Plásticos',     'Poliuretano',           26.4,   6300,  1.43, 160),
  ('Plásticos',     'ABS / acrílico',        35.5,   8500,  1.93, 170),
  ('Cauchos',       'Caucho',                41.9,  10000,  2.28, 180),
  ('Cauchos',       'Neumáticos',            32.6,   7800,  1.77, 190),
  ('Líq. inflam.',  'Alcohol etílico',       26.8,   6400,  1.46, 200),
  ('Líq. inflam.',  'Acetona',               30.8,   7350,  1.67, 210),
  ('Líq. inflam.',  'Nafta',                 46.0,  11000,  2.50, 220),
  ('Líq. inflam.',  'Kerosene',              43.1,  10300,  2.34, 230),
  ('Líq. inflam.',  'Gasoil',                42.7,  10200,  2.32, 240),
  ('Líq. inflam.',  'Fueloil',               41.9,  10000,  2.28, 250),
  ('Líq. inflam.',  'Aceites / grasas',      41.9,  10000,  2.28, 260),
  ('Líq. inflam.',  'Parafina',              46.0,  11000,  2.50, 270),
  ('Gases',         'GLP',                   46.1,  11000,  2.50, 280),
  ('Gases',         'Gas natural',           50.0,  11950,  2.72, 290),
  ('Gases',         'Hidrógeno',            120.0,  28700,  6.52, 300)
) AS v(categoria, material, pci_mj, pci_kcal, coef_c, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dec351_materiales_pci m WHERE m.material = v.material
);

-- ─── 8. SEED dec351_carga_fuego_resistencia (Cuadros 2.2.1 / 2.2.2) ──
-- Cuadro 2.2.1 (ventilación natural) y 2.2.2 (ventilación mecánica).
-- Franjas de carga de fuego (kg/m² equiv. madera) × riesgo R1..R5.
-- 'NP' = no permitido; '—' = sin exigencia. Idempotente por (ventilacion, riesgo, franja).
INSERT INTO public.dec351_carga_fuego_resistencia (ventilacion, riesgo, franja, f_minutos)
SELECT v.ventilacion, v.riesgo, v.franja, v.f_minutos
FROM (VALUES
  -- Cuadro 2.2.1 — Ventilación NATURAL
  ('natural', 'R1', 'Hasta 15',  'NP'),    ('natural', 'R1', '16 a 30', 'NP'),    ('natural', 'R1', '31 a 60', 'NP'),    ('natural', 'R1', '61 a 100', 'NP'),    ('natural', 'R1', '>100', 'NP'),
  ('natural', 'R2', 'Hasta 15',  'NP'),    ('natural', 'R2', '16 a 30', 'NP'),    ('natural', 'R2', '31 a 60', 'NP'),    ('natural', 'R2', '61 a 100', 'NP'),    ('natural', 'R2', '>100', 'NP'),
  ('natural', 'R3', 'Hasta 15',  'F 60'),  ('natural', 'R3', '16 a 30', 'F 90'),  ('natural', 'R3', '31 a 60', 'F 120'), ('natural', 'R3', '61 a 100', 'F 180'), ('natural', 'R3', '>100', 'F 180'),
  ('natural', 'R4', 'Hasta 15',  'F 30'),  ('natural', 'R4', '16 a 30', 'F 60'),  ('natural', 'R4', '31 a 60', 'F 90'),  ('natural', 'R4', '61 a 100', 'F 120'), ('natural', 'R4', '>100', 'F 180'),
  ('natural', 'R5', 'Hasta 15',  'F 30'),  ('natural', 'R5', '16 a 30', 'F 60'),  ('natural', 'R5', '31 a 60', 'F 90'),  ('natural', 'R5', '61 a 100', 'F 120'), ('natural', 'R5', '>100', 'F 180'),
  -- Cuadro 2.2.2 — Ventilación MECÁNICA
  ('mecanica', 'R1', 'Hasta 15', 'NP'),    ('mecanica', 'R1', '16 a 30', 'NP'),   ('mecanica', 'R1', '31 a 60', 'NP'),   ('mecanica', 'R1', '61 a 100', 'NP'),   ('mecanica', 'R1', '>100', 'NP'),
  ('mecanica', 'R2', 'Hasta 15', 'NP'),    ('mecanica', 'R2', '16 a 30', 'NP'),   ('mecanica', 'R2', '31 a 60', 'NP'),   ('mecanica', 'R2', '61 a 100', 'NP'),   ('mecanica', 'R2', '>100', 'NP'),
  ('mecanica', 'R3', 'Hasta 15', 'F 90'),  ('mecanica', 'R3', '16 a 30', 'F 120'),('mecanica', 'R3', '31 a 60', 'F 180'),('mecanica', 'R3', '61 a 100', 'F 180'),('mecanica', 'R3', '>100', 'F 180'),
  ('mecanica', 'R4', 'Hasta 15', 'F 60'),  ('mecanica', 'R4', '16 a 30', 'F 90'), ('mecanica', 'R4', '31 a 60', 'F 120'),('mecanica', 'R4', '61 a 100', 'F 180'),('mecanica', 'R4', '>100', 'F 180'),
  ('mecanica', 'R5', 'Hasta 15', 'F 60'),  ('mecanica', 'R5', '16 a 30', 'F 90'), ('mecanica', 'R5', '31 a 60', 'F 120'),('mecanica', 'R5', '61 a 100', 'F 180'),('mecanica', 'R5', '>100', 'F 180')
) AS v(ventilacion, riesgo, franja, f_minutos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dec351_carga_fuego_resistencia r
  WHERE r.ventilacion = v.ventilacion AND r.riesgo = v.riesgo AND r.franja = v.franja
);

-- ─── 9. SEED dec351_carga_fuego_extintor (Tablas 1 y 2) ─────
-- Tabla 1 (clase A) y Tabla 2 (clase B): potencial extintor exigido por riesgo y
-- franja de carga de fuego. Idempotente por (clase, riesgo, franja).
INSERT INTO public.dec351_carga_fuego_extintor (clase, riesgo, franja, potencial)
SELECT v.clase, v.riesgo, v.franja, v.potencial
FROM (VALUES
  -- Tabla 1 — Clase A (sólidos combustibles)
  ('A', 'R1', 'Hasta 15',  '—'),  ('A', 'R1', '16 a 30', '—'),  ('A', 'R1', '31 a 60', '—'),  ('A', 'R1', '61 a 100', '—'),  ('A', 'R1', '>100', '—'),
  ('A', 'R2', 'Hasta 15',  '1A'), ('A', 'R2', '16 a 30', '1A'), ('A', 'R2', '31 a 60', '1A'), ('A', 'R2', '61 a 100', '2A'), ('A', 'R2', '>100', '2A'),
  ('A', 'R3', 'Hasta 15',  '1A'), ('A', 'R3', '16 a 30', '2A'), ('A', 'R3', '31 a 60', '3A'), ('A', 'R3', '61 a 100', '6A'), ('A', 'R3', '>100', '10A'),
  ('A', 'R4', 'Hasta 15',  '2A'), ('A', 'R4', '16 a 30', '3A'), ('A', 'R4', '31 a 60', '6A'), ('A', 'R4', '61 a 100', '10A'),('A', 'R4', '>100', '20A'),
  ('A', 'R5', 'Hasta 15',  '3A'), ('A', 'R5', '16 a 30', '6A'), ('A', 'R5', '31 a 60', '10A'),('A', 'R5', '61 a 100', '20A'),('A', 'R5', '>100', '40A'),
  -- Tabla 2 — Clase B (líquidos / gases inflamables)
  ('B', 'R1', 'Hasta 15',  '6B'), ('B', 'R1', '16 a 30', '8B'), ('B', 'R1', '31 a 60', '10B'),('B', 'R1', '61 a 100', '20B'),('B', 'R1', '>100', '40B'),
  ('B', 'R2', 'Hasta 15',  '6B'), ('B', 'R2', '16 a 30', '8B'), ('B', 'R2', '31 a 60', '10B'),('B', 'R2', '61 a 100', '20B'),('B', 'R2', '>100', '40B'),
  ('B', 'R3', 'Hasta 15',  '—'),  ('B', 'R3', '16 a 30', '—'),  ('B', 'R3', '31 a 60', '—'),  ('B', 'R3', '61 a 100', '—'),  ('B', 'R3', '>100', '—'),
  ('B', 'R4', 'Hasta 15',  '—'),  ('B', 'R4', '16 a 30', '—'),  ('B', 'R4', '31 a 60', '—'),  ('B', 'R4', '61 a 100', '—'),  ('B', 'R4', '>100', '—'),
  ('B', 'R5', 'Hasta 15',  '—'),  ('B', 'R5', '16 a 30', '—'),  ('B', 'R5', '31 a 60', '—'),  ('B', 'R5', '61 a 100', '—'),  ('B', 'R5', '>100', '—')
) AS v(clase, riesgo, franja, potencial)
WHERE NOT EXISTS (
  SELECT 1 FROM public.dec351_carga_fuego_extintor e
  WHERE e.clase = v.clase AND e.riesgo = v.riesgo AND e.franja = v.franja
);

-- ─── 10. RLS — tablas del cálculo (por establecimiento) ─────
ALTER TABLE public.calculo_carga_fuego ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calculo_carga_fuego: select" ON public.calculo_carga_fuego;
CREATE POLICY "calculo_carga_fuego: select" ON public.calculo_carga_fuego FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL OR public.is_developer())
    AND public.has_establecimiento_read_access(establecimiento_id)
  );

DROP POLICY IF EXISTS "calculo_carga_fuego: insert" ON public.calculo_carga_fuego;
CREATE POLICY "calculo_carga_fuego: insert" ON public.calculo_carga_fuego FOR INSERT TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "calculo_carga_fuego: update" ON public.calculo_carga_fuego;
CREATE POLICY "calculo_carga_fuego: update" ON public.calculo_carga_fuego FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "calculo_carga_fuego: delete" ON public.calculo_carga_fuego;
CREATE POLICY "calculo_carga_fuego: delete" ON public.calculo_carga_fuego FOR DELETE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

-- Materiales: tenant derivado de la cabecera (EXISTS join, igual que iluminacion_celdas).
ALTER TABLE public.calculo_carga_fuego_materiales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccf_materiales: select" ON public.calculo_carga_fuego_materiales;
CREATE POLICY "ccf_materiales: select" ON public.calculo_carga_fuego_materiales FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND (c.deleted_at IS NULL OR public.is_developer())
      AND public.has_establecimiento_read_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_materiales: insert" ON public.calculo_carga_fuego_materiales;
CREATE POLICY "ccf_materiales: insert" ON public.calculo_carga_fuego_materiales FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_materiales: update" ON public.calculo_carga_fuego_materiales;
CREATE POLICY "ccf_materiales: update" ON public.calculo_carga_fuego_materiales FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

DROP POLICY IF EXISTS "ccf_materiales: delete" ON public.calculo_carga_fuego_materiales;
CREATE POLICY "ccf_materiales: delete" ON public.calculo_carga_fuego_materiales FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.calculo_carga_fuego c
    WHERE c.id = calculo_id
      AND public.has_establecimiento_write_access(c.establecimiento_id)
  ));

-- ─── 11. RLS — lookups (SELECT authenticated, WRITE super_admin) ──
ALTER TABLE public.dec351_materiales_pci ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dec351_materiales_pci: select" ON public.dec351_materiales_pci;
CREATE POLICY "dec351_materiales_pci: select" ON public.dec351_materiales_pci FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dec351_materiales_pci: write" ON public.dec351_materiales_pci;
CREATE POLICY "dec351_materiales_pci: write" ON public.dec351_materiales_pci FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

ALTER TABLE public.dec351_carga_fuego_resistencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dec351_ccf_resistencia: select" ON public.dec351_carga_fuego_resistencia;
CREATE POLICY "dec351_ccf_resistencia: select" ON public.dec351_carga_fuego_resistencia FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dec351_ccf_resistencia: write" ON public.dec351_carga_fuego_resistencia;
CREATE POLICY "dec351_ccf_resistencia: write" ON public.dec351_carga_fuego_resistencia FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

ALTER TABLE public.dec351_carga_fuego_extintor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dec351_ccf_extintor: select" ON public.dec351_carga_fuego_extintor;
CREATE POLICY "dec351_ccf_extintor: select" ON public.dec351_carga_fuego_extintor FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dec351_ccf_extintor: write" ON public.dec351_carga_fuego_extintor;
CREATE POLICY "dec351_ccf_extintor: write" ON public.dec351_carga_fuego_extintor FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── 12. updated_at trigger en la cabecera ──────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.calculo_carga_fuego;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.calculo_carga_fuego
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 13. Wire: gestión existente → tipo_ejecucion del módulo ──
-- Marca la gestión de carga de fuego para que el botón Ejecutar abra el wizard.
-- Si no hay coincidencia, el UPDATE no toca ninguna fila (no rompe la migración):
-- la gestión se puede marcar luego a mano. Al momento de escribir la migración no
-- existe en producción ninguna gestión con nombre que matchee '%carga de fuego%'.
UPDATE public.gestiones
SET tipo_ejecucion = 'calculo_carga_fuego'
WHERE nombre ILIKE '%carga de fuego%';

-- ─── 14. Comentarios de documentación ───────────────────────
COMMENT ON TABLE public.calculo_carga_fuego IS
  'Cabecera del Cálculo de Carga de Fuego (Dec 351/79 Anexo VII). Cálculo por inventario (sin instrumento). Referencia suelta a gestiones_registros (particionada). RLS por establecimiento.';
COMMENT ON TABLE public.calculo_carga_fuego_materiales IS
  'Inventario de materiales combustibles de un cálculo de carga de fuego (peso, PCI, coef C, equivalente en madera). Tenant derivado de la cabecera (sin consultora_id, 3NF).';
COMMENT ON TABLE public.dec351_materiales_pci IS
  'Reference data Anexo VII: PCI y coeficiente C (= pci_kcal/4400) por material. SELECT authenticated, WRITE super_admin.';
COMMENT ON TABLE public.dec351_carga_fuego_resistencia IS
  'Reference data Anexo VII: resistencia al fuego F (minutos) por ventilación + riesgo + franja de carga de fuego (Cuadros 2.2.1 / 2.2.2).';
COMMENT ON TABLE public.dec351_carga_fuego_extintor IS
  'Reference data Anexo VII: potencial extintor exigido clase A/B por riesgo + franja de carga de fuego (Tablas 1 y 2).';

COMMIT;
