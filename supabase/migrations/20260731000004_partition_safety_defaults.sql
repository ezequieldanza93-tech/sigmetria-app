-- Red de seguridad de particionado (hallazgo PART-001)
-- Si llega un INSERT con una fecha fuera de todos los rangos definidos y NO hay
-- partición DEFAULT, el INSERT FALLA. Esto agrega la red:
--   · asistencia_diaria: rangos 2026–2031, sin catch-all → DEFAULT cubre <2026 y ≥2032.
--   · audit_log: meses + 'historical' (pasado) + fn_create_audit_partition_next_month;
--     DEFAULT actúa como red si el cron de la función no corriera un mes (no perder auditoría).
--   · gestiones_registros: ya tiene 'future' (2032→9999-12-31) → NO requiere DEFAULT.
-- Crear una DEFAULT sobre una particionada ya poblada es instantáneo (no mueve filas).

CREATE TABLE IF NOT EXISTS public.asistencia_diaria_default
  PARTITION OF public.asistencia_diaria DEFAULT;

CREATE TABLE IF NOT EXISTS public.audit_log_default
  PARTITION OF public.audit_log DEFAULT;
