-- Campos para los generadores de documentos (contrato / presupuesto) del modulo Finanzas.
-- Domicilio legal/fiscal de la consultora (parte contratante) y titulo profesional del responsable.

BEGIN;

ALTER TABLE public.consultoras
  ADD COLUMN IF NOT EXISTS domicilio_legal text,
  ADD COLUMN IF NOT EXISTS domicilio_fiscal text;

ALTER TABLE public.perfiles_profesionales
  ADD COLUMN IF NOT EXISTS titulo text; -- ej. 'Ingeniero/a', 'Licenciado/a', 'Tecnico/a en HyS'

COMMIT;
