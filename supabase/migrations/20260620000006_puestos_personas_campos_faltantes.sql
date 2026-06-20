-- Feedback a3124de7: "Could not find the 'fecha_alta' column of 'puestos_personas'".
-- El código (lib/actions/trabajador.ts: createTrabajador / assignTrabajadorToPuesto /
-- updateTrabajador / baja; lib/actions/persona.ts) escribe columnas que nunca se
-- crearon en puestos_personas (la tabla solo tenía fecha_desde). Se agregan las
-- faltantes (idempotente). tipo_relacion con CHECK + default 'permanente'.

ALTER TABLE public.puestos_personas
  ADD COLUMN IF NOT EXISTS fecha_alta    date,
  ADD COLUMN IF NOT EXISTS fecha_baja    date,
  ADD COLUMN IF NOT EXISTS motivo_baja   text,
  ADD COLUMN IF NOT EXISTS tipo_relacion text;

ALTER TABLE public.puestos_personas
  ALTER COLUMN tipo_relacion SET DEFAULT 'permanente';

ALTER TABLE public.puestos_personas DROP CONSTRAINT IF EXISTS chk_puestos_personas_tipo_relacion;
ALTER TABLE public.puestos_personas ADD CONSTRAINT chk_puestos_personas_tipo_relacion
  CHECK (tipo_relacion IS NULL OR tipo_relacion IN ('permanente', 'temporal', 'contratista', 'pasante'));
