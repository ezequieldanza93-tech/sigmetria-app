-- ============================================================
-- Catálogo de Protecciones — jerarquía de 3 niveles (patrón HÍBRIDO)
-- Migration: 20260722000001
--
-- Lleva el catálogo de productos a una jerarquía de 3 niveles, copiando el
-- molde híbrido de gestiones (gestiones_grupos → gestiones_categorias → gestiones):
--
--   CLASE (nivel 1)      → productos_clases        (NUEVA)
--   CATEGORÍA (nivel 2)  → productos_categorias    (EXISTENTE, +clase_id +consultora_id)
--   COMPONENTE (interm.) → productos_componentes   (NUEVA, vacía — se llena por UI)
--   PRODUCTO             → productos               (+componente_id; mantiene categoria_id)
--
-- Patrón híbrido (igual que gestiones / productos):
--   consultora_id NULL  = base de Sigmetría (visible para todas, solo staff developer edita)
--   consultora_id = <id> = propio de esa consultora (editable por roles operativos)
--
-- Helpers usados: is_active_member_of(uuid), is_developer()
--
-- Los 261 productos genéricos existentes cuelgan de la categoría EPP (renombrada a
-- "EPP — Sin clasificar") y conservan categoria_id; componente_id queda NULL hasta
-- reclasificar por UI. La clase de un producto se deriva vía categoría → clase.
-- ============================================================

-- ============================================================
-- 1. CLASE (nivel 1) — tabla NUEVA productos_clases
-- ============================================================
CREATE TABLE IF NOT EXISTS public.productos_clases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  descripcion   text,
  consultora_id uuid REFERENCES public.consultoras(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT productos_clases_nombre_consultora_key UNIQUE NULLS NOT DISTINCT (nombre, consultora_id)
);

CREATE INDEX IF NOT EXISTS productos_clases_consultora_id_idx ON public.productos_clases(consultora_id);

COMMENT ON TABLE public.productos_clases IS 'Nivel 1 del catálogo de protecciones (EPP / EPC / Equipamiento). Híbrido: NULL = base Sigmetría, <id> = propio.';
COMMENT ON COLUMN public.productos_clases.consultora_id IS 'NULL = clase base de Sigmetría (solo staff developer). <id> = propia de esa consultora.';

ALTER TABLE public.productos_clases ENABLE ROW LEVEL SECURITY;

-- Seed clases genéricas (consultora_id NULL)
INSERT INTO public.productos_clases (nombre, descripcion, consultora_id) VALUES
  ('EPP',          'Elementos de Protección Personal',  NULL),
  ('EPC',          'Elementos de Protección Colectiva', NULL),
  ('Equipamiento', 'Equipamiento y herramientas',       NULL)
ON CONFLICT ON CONSTRAINT productos_clases_nombre_consultora_key DO NOTHING;

-- RLS híbrida productos_clases
DROP POLICY IF EXISTS "productos_clases: select" ON public.productos_clases;
DROP POLICY IF EXISTS "productos_clases: insert" ON public.productos_clases;
DROP POLICY IF EXISTS "productos_clases: update" ON public.productos_clases;
DROP POLICY IF EXISTS "productos_clases: delete" ON public.productos_clases;

CREATE POLICY "productos_clases: select" ON public.productos_clases
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "productos_clases: insert" ON public.productos_clases
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "productos_clases: update" ON public.productos_clases
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "productos_clases: delete" ON public.productos_clases
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );

-- ============================================================
-- 2. CATEGORÍA (nivel 2) — tabla EXISTENTE productos_categorias
--    +clase_id (FK a productos_clases) y +consultora_id (híbrida).
--    NO se renombra la tabla (rompe imports).
-- ============================================================
ALTER TABLE public.productos_categorias
  ADD COLUMN IF NOT EXISTS clase_id uuid REFERENCES public.productos_clases(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS consultora_id uuid REFERENCES public.consultoras(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS productos_categorias_clase_id_idx     ON public.productos_categorias(clase_id);
CREATE INDEX IF NOT EXISTS productos_categorias_consultora_id_idx ON public.productos_categorias(consultora_id);

COMMENT ON COLUMN public.productos_categorias.clase_id IS 'Clase (nivel 1) a la que pertenece esta categoría.';
COMMENT ON COLUMN public.productos_categorias.consultora_id IS 'NULL = categoría base de Sigmetría (solo staff developer). <id> = propia de esa consultora.';

-- UNIQUE(nombre) global → UNIQUE (nombre, consultora_id) tratando NULL como valor
ALTER TABLE public.productos_categorias DROP CONSTRAINT IF EXISTS categoria_productos_nombre_key;
ALTER TABLE public.productos_categorias DROP CONSTRAINT IF EXISTS productos_categorias_nombre_key;
ALTER TABLE public.productos_categorias
  ADD CONSTRAINT productos_categorias_nombre_consultora_key UNIQUE NULLS NOT DISTINCT (nombre, consultora_id);

-- Vincular la fila EPP existente a la clase EPP y renombrarla a "EPP — Sin clasificar"
-- (ahí quedan los 261 productos existentes hasta reclasificar por UI).
UPDATE public.productos_categorias pc
SET clase_id = (SELECT id FROM public.productos_clases WHERE nombre = 'EPP' AND consultora_id IS NULL),
    nombre   = 'EPP — Sin clasificar'
WHERE pc.nombre = 'EPP' AND pc.consultora_id IS NULL;

-- Seed categorías genéricas (consultora_id NULL), colgadas de cada clase
INSERT INTO public.productos_categorias (nombre, clase_id, consultora_id)
SELECT v.nombre, c.id, NULL
FROM (VALUES
  -- bajo EPP
  ('Trabajo en Altura',                   'EPP'),
  ('Espacio Confinado',                   'EPP'),
  ('Protección de Cabeza y Facial',       'EPP'),
  ('Protección de Miembros Superiores',   'EPP'),
  ('Protección del Cuerpo',               'EPP'),
  ('Protección Auditiva',                 'EPP'),
  ('Protección Ocular',                   'EPP'),
  ('Protección Respiratoria',             'EPP'),
  ('Riesgo Eléctrico',                    'EPP'),
  -- bajo EPC
  ('Barandas y Barreras',                 'EPC'),
  ('Líneas de Vida Colectivas',           'EPC'),
  ('Puntos de Anclaje',                   'EPC'),
  ('Conos y Señalización',                'EPC'),
  ('Cadenas y Cintas',                    'EPC'),
  ('Protectores',                         'EPC'),
  -- bajo Equipamiento
  ('Escaleras y Plataformas',             'Equipamiento'),
  ('Andamios',                            'Equipamiento'),
  ('Herramientas',                        'Equipamiento')
) AS v(nombre, clase_nombre)
JOIN public.productos_clases c ON c.nombre = v.clase_nombre AND c.consultora_id IS NULL
ON CONFLICT ON CONSTRAINT productos_categorias_nombre_consultora_key DO NOTHING;

-- RLS híbrida productos_categorias (drop + recreate; antes era developer-only)
DROP POLICY IF EXISTS "productos_categorias: select" ON public.productos_categorias;
DROP POLICY IF EXISTS "productos_categorias: insert" ON public.productos_categorias;
DROP POLICY IF EXISTS "productos_categorias: update" ON public.productos_categorias;
DROP POLICY IF EXISTS "productos_categorias: delete" ON public.productos_categorias;

CREATE POLICY "productos_categorias: select" ON public.productos_categorias
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "productos_categorias: insert" ON public.productos_categorias
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "productos_categorias: update" ON public.productos_categorias
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "productos_categorias: delete" ON public.productos_categorias
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );

-- ============================================================
-- 3. COMPONENTE (nivel intermedio) — tabla NUEVA productos_componentes
--    Vacía: se llena por UI. Ej. futuro: bajo "Trabajo en Altura" →
--    "Arnés Anticaída", "Cabo de Amarre".
-- ============================================================
CREATE TABLE IF NOT EXISTS public.productos_componentes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id  uuid NOT NULL REFERENCES public.productos_categorias(id) ON DELETE CASCADE,
  nombre        text NOT NULL,
  descripcion   text,
  consultora_id uuid REFERENCES public.consultoras(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT productos_componentes_nombre_categoria_consultora_key UNIQUE NULLS NOT DISTINCT (nombre, categoria_id, consultora_id)
);

CREATE INDEX IF NOT EXISTS productos_componentes_categoria_id_idx  ON public.productos_componentes(categoria_id);
CREATE INDEX IF NOT EXISTS productos_componentes_consultora_id_idx ON public.productos_componentes(consultora_id);

COMMENT ON TABLE public.productos_componentes IS 'Nivel intermedio del catálogo (componente dentro de una categoría). Híbrido: NULL = base Sigmetría, <id> = propio.';
COMMENT ON COLUMN public.productos_componentes.consultora_id IS 'NULL = componente base de Sigmetría (solo staff developer). <id> = propio de esa consultora.';

ALTER TABLE public.productos_componentes ENABLE ROW LEVEL SECURITY;

-- RLS híbrida productos_componentes
DROP POLICY IF EXISTS "productos_componentes: select" ON public.productos_componentes;
DROP POLICY IF EXISTS "productos_componentes: insert" ON public.productos_componentes;
DROP POLICY IF EXISTS "productos_componentes: update" ON public.productos_componentes;
DROP POLICY IF EXISTS "productos_componentes: delete" ON public.productos_componentes;

CREATE POLICY "productos_componentes: select" ON public.productos_componentes
  FOR SELECT TO authenticated
  USING (consultora_id IS NULL OR is_active_member_of(consultora_id));
CREATE POLICY "productos_componentes: insert" ON public.productos_componentes
  FOR INSERT TO authenticated
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "productos_componentes: update" ON public.productos_componentes
  FOR UPDATE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  )
  WITH CHECK (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );
CREATE POLICY "productos_componentes: delete" ON public.productos_componentes
  FOR DELETE TO authenticated
  USING (
    CASE WHEN consultora_id IS NULL THEN is_developer()
    ELSE consultora_id IN (SELECT consultora_id FROM consultoras_members
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('full_access_main','full_access_branch')) END
  );

-- ============================================================
-- 4. PRODUCTO — +componente_id (nullable). Mantiene categoria_id.
--    La clase se deriva: producto → categoria → clase.
--    Los 261 existentes quedan con su categoria_id (EPP — Sin clasificar) y
--    componente_id NULL hasta reclasificar por UI.
-- ============================================================
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS componente_id uuid REFERENCES public.productos_componentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS productos_componente_id_idx ON public.productos(componente_id);

COMMENT ON COLUMN public.productos.componente_id IS 'Componente (nivel intermedio) al que pertenece el producto. NULL = sin reclasificar. La clase se deriva vía categoria_id → clase_id.';
