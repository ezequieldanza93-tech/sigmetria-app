-- ============================================================
-- Sigmetría HyS — Normalización: catálogo provincias + FK
--
-- 1. Crea provincias con las 24 jurisdicciones argentinas
-- 2. provincia_residencia y provincia_matricula → FK
-- 3. Dropea columna legacy localidad (reemplazada por localidad_id)
-- ============================================================

-- ── 1. Tabla catálogo ──────────────────────────────────────

CREATE TABLE public.provincias (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL UNIQUE,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provincias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provincias_select_auth" ON public.provincias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "provincias_write_dev" ON public.provincias
  FOR ALL TO authenticated
  USING  ((SELECT system_role FROM profiles WHERE id = auth.uid()) = 'developer')
  WITH CHECK ((SELECT system_role FROM profiles WHERE id = auth.uid()) = 'developer');

-- ── 2. Seed ─────────────────────────────────────────────────

INSERT INTO public.provincias (nombre) VALUES
  ('Ciudad Autónoma de Buenos Aires'),
  ('Buenos Aires'),
  ('Catamarca'),
  ('Chaco'),
  ('Chubut'),
  ('Córdoba'),
  ('Corrientes'),
  ('Entre Ríos'),
  ('Formosa'),
  ('Jujuy'),
  ('La Pampa'),
  ('La Rioja'),
  ('Mendoza'),
  ('Misiones'),
  ('Neuquén'),
  ('Río Negro'),
  ('Salta'),
  ('San Juan'),
  ('San Luis'),
  ('Santa Cruz'),
  ('Santa Fe'),
  ('Santiago del Estero'),
  ('Tierra del Fuego'),
  ('Tucumán')
ON CONFLICT (nombre) DO NOTHING;

-- ── 3. FK columns en perfiles_profesionales ─────────────────

ALTER TABLE public.perfiles_profesionales
  ADD COLUMN provincia_residencia_id uuid REFERENCES public.provincias(id) ON DELETE SET NULL;

ALTER TABLE public.perfiles_profesionales
  ADD COLUMN provincia_matricula_id  uuid REFERENCES public.provincias(id) ON DELETE SET NULL;

-- ── 4. Backfill ─────────────────────────────────────────────

UPDATE public.perfiles_profesionales pp
SET provincia_residencia_id = p.id
FROM public.provincias p
WHERE lower(trim(pp.provincia_residencia)) = lower(p.nombre)
  AND pp.provincia_residencia IS NOT NULL;

UPDATE public.perfiles_profesionales pp
SET provincia_matricula_id = p.id
FROM public.provincias p
WHERE lower(trim(pp.provincia_matricula)) = lower(p.nombre)
  AND pp.provincia_matricula IS NOT NULL;

-- ── 5. Dropear columnas legacy ──────────────────────────────

ALTER TABLE public.perfiles_profesionales DROP COLUMN IF EXISTS localidad;
ALTER TABLE public.perfiles_profesionales DROP COLUMN IF EXISTS provincia_residencia;
ALTER TABLE public.perfiles_profesionales DROP COLUMN IF EXISTS provincia_matricula;

-- ── 6. Índices ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_perfiles_provincia_residencia
  ON public.perfiles_profesionales (provincia_residencia_id)
  WHERE provincia_residencia_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perfiles_provincia_matricula
  ON public.perfiles_profesionales (provincia_matricula_id)
  WHERE provincia_matricula_id IS NOT NULL;
