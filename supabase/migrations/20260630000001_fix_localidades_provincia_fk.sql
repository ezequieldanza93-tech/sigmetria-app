-- ============================================================
-- 3FN Fix V1: localidades.provincia text → FK a provincias
--
-- Problema: localidades.provincia es texto libre redundante.
-- Ya existe la tabla provincias con las 24 jurisdicciones.
-- Sin FK, pueden divergir por typos o mayúsculas.
-- ============================================================

-- 1. Agregar columna FK
ALTER TABLE public.localidades
  ADD COLUMN provincia_id uuid REFERENCES public.provincias(id) ON DELETE RESTRICT;

-- 2. Backfill por nombre (case-insensitive)
UPDATE public.localidades l
SET provincia_id = p.id
FROM public.provincias p
WHERE lower(trim(l.provincia)) = lower(trim(p.nombre));

-- 3. Verificar que no queden filas sin match antes de NOT NULL
DO $$
DECLARE unmatched int;
BEGIN
  SELECT COUNT(*) INTO unmatched
  FROM public.localidades
  WHERE provincia_id IS NULL;

  IF unmatched > 0 THEN
    RAISE EXCEPTION
      '% localidad/es sin provincia_id — backfill incompleto. Revisar nombres en localidades vs provincias.',
      unmatched;
  END IF;
END;
$$;

-- 4. Aplicar NOT NULL
ALTER TABLE public.localidades ALTER COLUMN provincia_id SET NOT NULL;

-- 5. Reemplazar UNIQUE constraint (nombre, provincia) → (nombre, provincia_id)
ALTER TABLE public.localidades DROP CONSTRAINT uq_localidad_provincia;
ALTER TABLE public.localidades ADD CONSTRAINT uq_localidad_provincia_id UNIQUE (nombre, provincia_id);

-- 6. Reemplazar índice de texto por índice de FK
DROP INDEX IF EXISTS idx_localidades_provincia;
CREATE INDEX idx_localidades_provincia_id ON public.localidades(provincia_id);

-- 7. Eliminar columna legacy (el índice se elimina automáticamente junto con la columna)
ALTER TABLE public.localidades DROP COLUMN provincia;
