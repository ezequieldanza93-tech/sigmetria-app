ALTER TABLE public.establecimientos
  ADD COLUMN IF NOT EXISTS aplica_iso_45001 boolean NOT NULL DEFAULT false;

ALTER TABLE public.gestiones
  ADD COLUMN IF NOT EXISTS aplica_por_iso boolean NOT NULL DEFAULT false;

ALTER TABLE public.documento_tipos
  ADD COLUMN IF NOT EXISTS aplica_por_iso boolean NOT NULL DEFAULT false;

ALTER TABLE public.formulario_secciones
  ADD COLUMN IF NOT EXISTS aplica_por_iso boolean NOT NULL DEFAULT false;
