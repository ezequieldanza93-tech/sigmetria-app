-- Title-caser español: capitaliza cada palabra PERO deja las partículas de enlace
-- (de, del, la, las, los, y, e, da...) en minúscula, salvo cuando son la PRIMERA
-- palabra (ej. apellido "De la Cruz"). Reemplaza el initcap plano anterior.

CREATE OR REPLACE FUNCTION public.fn_titlecase_es(p text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  particulas text[] := ARRAY['de','del','la','las','los','y','e','da','das','do','dos','di','van','von','du'];
  palabras   text[];
  w          text;
  salida     text[] := ARRAY[]::text[];
  i          int := 0;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  p := btrim(regexp_replace(p, '\s+', ' ', 'g'));
  IF p = '' THEN RETURN p; END IF;

  palabras := string_to_array(lower(p), ' ');
  FOREACH w IN ARRAY palabras LOOP
    i := i + 1;
    IF i > 1 AND w = ANY(particulas) THEN
      salida := salida || w;            -- partícula intermedia → minúscula
    ELSE
      salida := salida || initcap(w);   -- palabra normal (initcap respeta guiones/apóstrofes y acentos)
    END IF;
  END LOOP;

  RETURN array_to_string(salida, ' ');
END;
$$;

-- El trigger trg_personas_directorio_titlecase ya existe; solo reapuntamos la
-- función de normalización para que use la versión con partículas.
CREATE OR REPLACE FUNCTION public.fn_personas_directorio_titlecase()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nombre IS NOT NULL THEN NEW.nombre := public.fn_titlecase_es(NEW.nombre); END IF;
  IF NEW.apellido IS NOT NULL THEN NEW.apellido := public.fn_titlecase_es(NEW.apellido); END IF;
  RETURN NEW;
END;
$$;

-- Backfill con la regla nueva (solo los que difieren).
UPDATE public.personas_directorio
SET nombre = public.fn_titlecase_es(nombre)
WHERE nombre IS NOT NULL AND nombre IS DISTINCT FROM public.fn_titlecase_es(nombre);

UPDATE public.personas_directorio
SET apellido = public.fn_titlecase_es(apellido)
WHERE apellido IS NOT NULL AND apellido IS DISTINCT FROM public.fn_titlecase_es(apellido);
