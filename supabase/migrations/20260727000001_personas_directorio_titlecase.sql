-- Normaliza nombre y apellido del directorio a Title Case (primera letra de cada
-- palabra en MAYÚSCULA, el resto en minúscula) en TODA inserción/actualización,
-- sin importar el camino: formulario de personas, altas inline en selectores,
-- invitación de usuarios, creación de trabajador, etc. Una sola fuente de verdad
-- (no parches por formulario). Usa initcap(), que hace exactamente eso.

CREATE OR REPLACE FUNCTION public.fn_personas_directorio_titlecase()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nombre IS NOT NULL THEN
    NEW.nombre := initcap(btrim(regexp_replace(NEW.nombre, '\s+', ' ', 'g')));
  END IF;
  IF NEW.apellido IS NOT NULL THEN
    NEW.apellido := initcap(btrim(regexp_replace(NEW.apellido, '\s+', ' ', 'g')));
  END IF;
  RETURN NEW;
END;
$$;

-- Solo se dispara si nombre/apellido están en juego (no en updates de otras columnas).
DROP TRIGGER IF EXISTS trg_personas_directorio_titlecase ON public.personas_directorio;
CREATE TRIGGER trg_personas_directorio_titlecase
  BEFORE INSERT OR UPDATE OF nombre, apellido ON public.personas_directorio
  FOR EACH ROW EXECUTE FUNCTION public.fn_personas_directorio_titlecase();

-- Backfill de los registros existentes (solo los que difieren, para no tocar de más).
UPDATE public.personas_directorio
SET nombre = initcap(btrim(regexp_replace(nombre, '\s+', ' ', 'g')))
WHERE nombre IS NOT NULL
  AND nombre IS DISTINCT FROM initcap(btrim(regexp_replace(nombre, '\s+', ' ', 'g')));

UPDATE public.personas_directorio
SET apellido = initcap(btrim(regexp_replace(apellido, '\s+', ' ', 'g')))
WHERE apellido IS NOT NULL
  AND apellido IS DISTINCT FROM initcap(btrim(regexp_replace(apellido, '\s+', ' ', 'g')));
