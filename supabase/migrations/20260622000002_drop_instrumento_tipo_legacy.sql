-- Migración B (cleanup, feedback b9f881c0): tras deployar el código que clasifica el
-- instrumento por subcategoría del catálogo (deploy del commit d36d1f2), ya NADA en el
-- código referencia tipo_id ni la tabla de tipos vieja. Se eliminan definitivamente.
-- (La A —20260622000001— fue aditiva + backfill; esta B es la destructiva, separada para
-- no romper el código viejo entre deploys.)

ALTER TABLE public.mediciones_instrumentos DROP COLUMN IF EXISTS tipo_id;
DROP TABLE IF EXISTS public.mediciones_instrumentos_tipos;
