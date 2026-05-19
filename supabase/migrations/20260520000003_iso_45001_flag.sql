ALTER TABLE public.gestion_tipos_establecimiento
  ADD COLUMN aplica_iso_45001 boolean NOT NULL DEFAULT false;

ALTER TABLE public.formulario_seccion_aspectos
  ADD COLUMN aplica_iso_45001 boolean NOT NULL DEFAULT false;

ALTER TABLE public.documentacion_tipos_establecimiento
  ADD COLUMN aplica_iso_45001 boolean NOT NULL DEFAULT false;

ALTER TABLE public.establecimientos
  ADD COLUMN aplica_iso_45001 boolean NOT NULL DEFAULT false;
