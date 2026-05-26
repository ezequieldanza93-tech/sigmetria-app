-- Fase 0: Sistema global de categorías de observaciones
--
-- Cambios:
-- 1. Agrega columna `color` (hex) a observaciones_categorias
-- 2. Renombra los seeds al wording del spec ("Oportunidades de mejora", "Acción inmediata crítica/alta/media")
-- 3. Setea colores: blanco / rojo / naranja / amarillo
-- 4. Agrega categoria_id FK a inspecciones_observaciones
-- 5. Backfill de filas existentes con la categoría nivel 1 (Oportunidades de mejora)
-- 6. NOT NULL en categoria_id en ambas tablas

BEGIN;

-- 1) Color column
ALTER TABLE public.observaciones_categorias
  ADD COLUMN IF NOT EXISTS color text;

-- 2 + 3) Actualizar nombres + setear colores (idempotente por nivel)
UPDATE public.observaciones_categorias
SET nombre = 'Oportunidades de mejora', color = '#FFFFFF'
WHERE nivel = 1;

UPDATE public.observaciones_categorias
SET nombre = 'Acción inmediata media', color = '#FACC15'
WHERE nivel = 2;

UPDATE public.observaciones_categorias
SET nombre = 'Acción inmediata alta', color = '#EA580C'
WHERE nivel = 3;

UPDATE public.observaciones_categorias
SET nombre = 'Acción inmediata crítica', color = '#DC2626'
WHERE nivel = 4;

-- Si por alguna razón faltara algún nivel, garantizar la presencia (idempotente)
INSERT INTO public.observaciones_categorias (nombre, nivel, color)
VALUES
  ('Oportunidades de mejora', 1, '#FFFFFF'),
  ('Acción inmediata media', 2, '#FACC15'),
  ('Acción inmediata alta', 3, '#EA580C'),
  ('Acción inmediata crítica', 4, '#DC2626')
ON CONFLICT (nombre) DO UPDATE SET color = EXCLUDED.color, nivel = EXCLUDED.nivel;

ALTER TABLE public.observaciones_categorias
  ALTER COLUMN color SET NOT NULL;

-- 4 + 5 + 6) Backfill + NOT NULL + FK RESTRICT
-- Se hace condicional a la existencia de cada tabla, porque en algunos entornos
-- inspecciones_observaciones no fue creada aunque su migración figure aplicada.
DO $$
DECLARE
  default_cat_id uuid;
BEGIN
  SELECT id INTO default_cat_id
  FROM public.observaciones_categorias
  WHERE nivel = 1
  LIMIT 1;

  IF default_cat_id IS NULL THEN
    RAISE EXCEPTION 'No existe categoría nivel 1 para backfill';
  END IF;

  -- gestiones_observaciones
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='gestiones_observaciones') THEN
    UPDATE public.gestiones_observaciones
    SET categoria_id = default_cat_id
    WHERE categoria_id IS NULL;

    ALTER TABLE public.gestiones_observaciones
      ALTER COLUMN categoria_id SET NOT NULL;

    ALTER TABLE public.gestiones_observaciones
      DROP CONSTRAINT IF EXISTS observaciones_gestiones_categoria_id_fkey;
    ALTER TABLE public.gestiones_observaciones
      DROP CONSTRAINT IF EXISTS gestiones_observaciones_categoria_id_fkey;
    ALTER TABLE public.gestiones_observaciones
      ADD CONSTRAINT gestiones_observaciones_categoria_id_fkey
      FOREIGN KEY (categoria_id) REFERENCES public.observaciones_categorias(id) ON DELETE RESTRICT;
  END IF;

  -- inspecciones_observaciones (puede no existir en algunos entornos)
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='inspecciones_observaciones') THEN
    ALTER TABLE public.inspecciones_observaciones
      ADD COLUMN IF NOT EXISTS categoria_id uuid
        REFERENCES public.observaciones_categorias(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_inspecciones_observaciones_categoria
      ON public.inspecciones_observaciones(categoria_id);

    UPDATE public.inspecciones_observaciones
    SET categoria_id = default_cat_id
    WHERE categoria_id IS NULL;

    ALTER TABLE public.inspecciones_observaciones
      ALTER COLUMN categoria_id SET NOT NULL;

    ALTER TABLE public.inspecciones_observaciones
      DROP CONSTRAINT IF EXISTS inspecciones_observaciones_categoria_id_fkey;
    ALTER TABLE public.inspecciones_observaciones
      ADD CONSTRAINT inspecciones_observaciones_categoria_id_fkey
      FOREIGN KEY (categoria_id) REFERENCES public.observaciones_categorias(id) ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;
