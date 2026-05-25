-- Add photo evidence fields for checklist forms
ALTER TABLE public.gestiones_registros
  ADD COLUMN IF NOT EXISTS foto_evidencia_url text;

ALTER TABLE public.gestiones_observaciones
  ADD COLUMN IF NOT EXISTS foto_url text;
