-- Fix de nomenclatura de la librería de normativa legal.
-- 1) Asegurar tipo 'Ordenanza' permitido (idempotente, para reproducibilidad en DB nueva)
ALTER TABLE public.normativa_normas DROP CONSTRAINT IF EXISTS normativa_normas_tipo_check;
ALTER TABLE public.normativa_normas ADD CONSTRAINT normativa_normas_tipo_check
  CHECK (tipo IN ('Ley','Decreto','Resolución','Disposición','Laudo','Reglamento','Ordenanza','Otro'));

-- 2) Re-mapear la Ordenanza Municipal a su tipo correcto
UPDATE public.normativa_normas SET tipo = 'Ordenanza'
  WHERE tipo = 'Otro' AND titulo ILIKE 'Ordenanza%';

-- 3) Nomenclatura unificada: el título de origen ya es la cita legal canónica correcta
--    (leyes/decretos sin organismo, resoluciones/disposiciones con él). Reemplaza la
--    reconstrucción buggy ("Ley Congreso de la Nación 587/1972" -> "Ley 19.587/1972").
UPDATE public.normativa_normas SET nombre_completo = titulo
  WHERE nombre_completo IS DISTINCT FROM titulo;

-- 4) Corregir el número estructurado truncado (leyes: 19.587, 24.557, 26.773, 27.348, ...).
--    Toma el primer "NUMERO/AAAA" del título (seguro ante títulos compuestos).
UPDATE public.normativa_normas
  SET numero = substring(titulo from '([0-9][0-9.]*)\s*/\s*[0-9]{4}')
  WHERE titulo ~ '[0-9][0-9.]*\s*/\s*[0-9]{4}'
    AND numero IS DISTINCT FROM substring(titulo from '([0-9][0-9.]*)\s*/\s*[0-9]{4}');
