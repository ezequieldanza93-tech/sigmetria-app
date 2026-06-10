-- ============================================================
-- Restaurar localidades.provincia (texto) — compatibilidad con app
--
-- La migración 20260630000001 dropeó la columna provincia text y
-- la reemplazó por provincia_id FK. Sin embargo, el código de la
-- aplicación referencia localidades.provincia en 30+ lugares
-- (queries PostgREST, forms, tipos, display). Restaurar la columna
-- es la forma correcta de mantener la 3NF parcial (provincia_id para
-- integridad referencial) sin romper la aplicación.
--
-- Patrón: columna redundante sincronizada por trigger (igual que
-- establecimientos.cantidad_trabajadores).
-- ============================================================

-- 1. Restaurar columna provincia texto
ALTER TABLE public.localidades
  ADD COLUMN IF NOT EXISTS provincia text;

-- 2. Backfill desde provincias vía province_id
UPDATE public.localidades l
SET provincia = p.nombre
FROM public.provincias p
WHERE l.provincia_id = p.id
  AND l.provincia IS NULL;

-- 3. Trigger para mantener provincia sincronizado con provincia_id
CREATE OR REPLACE FUNCTION public.sync_localidad_provincia_text()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.provincia_id IS NOT NULL THEN
    SELECT nombre INTO NEW.provincia
    FROM public.provincias
    WHERE id = NEW.provincia_id;
  ELSE
    NEW.provincia := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_localidad_provincia_text ON public.localidades;
CREATE TRIGGER trg_sync_localidad_provincia_text
  BEFORE INSERT OR UPDATE OF provincia_id ON public.localidades
  FOR EACH ROW EXECUTE FUNCTION public.sync_localidad_provincia_text();

-- 4. Índice para filtros por provincia (los forms filtran localidades por provincia)
CREATE INDEX IF NOT EXISTS idx_localidades_provincia_text
  ON public.localidades(provincia)
  WHERE provincia IS NOT NULL;
