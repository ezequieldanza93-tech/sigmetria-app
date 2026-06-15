-- Agrega FK peligro_id a sap_riesgos apuntando a iperc_peligros_library.
-- Se mantiene la columna peligro (text) como nullable por compatibilidad hacia atrás.
-- Idempotente.

ALTER TABLE public.sap_riesgos
  ADD COLUMN IF NOT EXISTS peligro_id uuid REFERENCES public.iperc_peligros_library(id) ON DELETE SET NULL;

ALTER TABLE public.sap_riesgos
  ALTER COLUMN peligro DROP NOT NULL;
