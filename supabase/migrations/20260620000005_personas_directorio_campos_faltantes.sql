-- Feedback e497d0ce: "Could not find the 'beneficiario_seguro' column of
-- 'personas_directorio'". El código (lib/actions/persona.ts, lib/schemas, la UI
-- de /dashboard/personas) inserta/actualiza columnas que nunca se crearon en la
-- tabla. Se agregan todas las faltantes (idempotente). Todas opcionales.

ALTER TABLE public.personas_directorio
  ADD COLUMN IF NOT EXISTS direccion                    text,
  ADD COLUMN IF NOT EXISTS talle_calzado                text,
  ADD COLUMN IF NOT EXISTS talle_pantalon               text,
  ADD COLUMN IF NOT EXISTS talle_remera                 text,
  ADD COLUMN IF NOT EXISTS talle_camisa                 text,
  ADD COLUMN IF NOT EXISTS talle_buzo                   text,
  ADD COLUMN IF NOT EXISTS talle_campera                text,
  ADD COLUMN IF NOT EXISTS beneficiario_seguro          text,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre   text,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono text,
  ADD COLUMN IF NOT EXISTS created_in_consultora_id     uuid REFERENCES public.consultoras(id) ON DELETE SET NULL;
