ALTER TABLE public.establecimientos
  ADD COLUMN aplica_iso_45001 boolean NOT NULL DEFAULT false;

ALTER TABLE public.gestiones
  ADD COLUMN aplica_por_iso boolean NOT NULL DEFAULT false;

ALTER TABLE public.documento_tipos
  ADD COLUMN aplica_por_iso boolean NOT NULL DEFAULT false;

ALTER TABLE public.formulario_secciones
  ADD COLUMN aplica_por_iso boolean NOT NULL DEFAULT false;
