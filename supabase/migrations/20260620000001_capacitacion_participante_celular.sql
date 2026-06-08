-- ============================================================
-- Capacitaciones: celular del participante
-- ============================================================
-- Aditivo e idempotente. El celular se trae del directorio
-- (personas_directorio.telefono) al elegir a la persona, o se carga a mano.
-- Sirve para compartir el enlace personal por WhatsApp.
-- ============================================================

ALTER TABLE public.capacitacion_participantes ADD COLUMN IF NOT EXISTS celular text;
COMMENT ON COLUMN public.capacitacion_participantes.celular IS 'Celular del participante (traido del directorio personas_directorio.telefono o cargado a mano). Para compartir el enlace por WhatsApp.';
