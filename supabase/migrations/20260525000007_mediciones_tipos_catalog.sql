-- ============================================================
-- Sigmetría HyS — Normalización 2FN: mediciones.tipo (enum)
-- → mediciones_tipos (catálogo) con unidad por defecto
--
-- medicion_tipo enum mezclaba tipo ("ruido") con unidad
-- esperada ("dB"). Si mañana aparece "ruido_impacto" con
-- unidad "dB peak", no se puede agregar sin modificar el
-- schema. Con catálogo + FK, es un INSERT.
-- ============================================================

-- ── 1. Catálogo mediciones_tipos ────────────────────────────

CREATE TABLE public.mediciones_tipos (
  id                   uuid   PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               text   NOT NULL UNIQUE,
  unidad_default_id    uuid   REFERENCES public.unidades(id) ON DELETE SET NULL,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mediciones_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mediciones_tipos: select"
  ON public.mediciones_tipos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "mediciones_tipos: write"
  ON public.mediciones_tipos FOR ALL TO authenticated
  USING  ((SELECT system_role FROM profiles WHERE id = auth.uid()) = 'developer')
  WITH CHECK ((SELECT system_role FROM profiles WHERE id = auth.uid()) = 'developer');

-- ── 2. Seed desde el enum actual ────────────────────────────

INSERT INTO public.mediciones_tipos (nombre, unidad_default_id) VALUES
  ('ruido',         (SELECT id FROM public.unidades WHERE simbolo = 'dB')),
  ('iluminacion',   (SELECT id FROM public.unidades WHERE simbolo = 'lux')),
  ('temperatura',   (SELECT id FROM public.unidades WHERE simbolo = '°C')),
  ('humedad',       (SELECT id FROM public.unidades WHERE simbolo = '%HR')),
  ('vibraciones',   (SELECT id FROM public.unidades WHERE simbolo = 'm/s²')),
  ('gases',         (SELECT id FROM public.unidades WHERE simbolo = 'ppm')),
  ('polvo',         (SELECT id FROM public.unidades WHERE simbolo = 'mg/m³')),
  ('otro',          NULL)
ON CONFLICT (nombre) DO NOTHING;

-- ── 3. Agregar unidad_default a unidades si no existen ──────

INSERT INTO public.unidades (nombre, simbolo, categoria) VALUES
  ('Decibel',        'dB',     'medicion'),
  ('Lux',            'lux',    'medicion'),
  ('Grado Celsius',  '°C',     'medicion'),
  ('Porcentaje',     '%HR',    'medicion'),
  ('Metro/seg²',     'm/s²',   'medicion'),
  ('Partes por millón', 'ppm', 'medicion'),
  ('Miligramo/m³',   'mg/m³',  'medicion')
ON CONFLICT (simbolo) DO NOTHING;

-- Re-seed con los IDs reales tras insertar unidades faltantes
UPDATE public.mediciones_tipos mt
SET unidad_default_id = u.id
FROM public.unidades u
WHERE mt.unidad_default_id IS NULL
  AND mt.nombre IN ('ruido','iluminacion','temperatura','humedad','vibraciones','gases','polvo')
  AND (
    (mt.nombre = 'ruido'        AND u.simbolo = 'dB')    OR
    (mt.nombre = 'iluminacion'  AND u.simbolo = 'lux')   OR
    (mt.nombre = 'temperatura'  AND u.simbolo = '°C')    OR
    (mt.nombre = 'humedad'      AND u.simbolo = '%HR')   OR
    (mt.nombre = 'vibraciones'  AND u.simbolo = 'm/s²')  OR
    (mt.nombre = 'gases'        AND u.simbolo = 'ppm')   OR
    (mt.nombre = 'polvo'        AND u.simbolo = 'mg/m³')
  );

-- ── 4. FK column en mediciones ──────────────────────────────

ALTER TABLE public.mediciones
  ADD COLUMN tipo_id uuid REFERENCES public.mediciones_tipos(id) ON DELETE SET NULL;

-- ── 5. Backfill ─────────────────────────────────────────────

UPDATE public.mediciones m
SET tipo_id = mt.id
FROM public.mediciones_tipos mt
WHERE m.tipo::text = mt.nombre
  AND m.tipo_id IS NULL;

-- ── 6. Índice ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_med_tipo_id
  ON public.mediciones(tipo_id)
  WHERE tipo_id IS NOT NULL;

-- Nota: mediciones.tipo (medicion_tipo enum) se mantiene como
-- deprecated. Eliminar en migración futura cuando todos los
-- consumers migren a tipo_id.
