-- ============================================================
-- Campos médicos faltantes en `incidentes` (ex-siniestros)
-- ============================================================
--
-- QUÉ HACE:
-- Agrega a `incidentes` los campos médicos/investigación que la
-- migración 20260530000002 definía para `siniestros` pero que NUNCA
-- se aplicaron en este entorno (historial de migraciones desincronizado).
-- El código (tipo Incidente, form, action) ya espera estos campos.
--
-- Definición idéntica a 20260530000002 (incluida la columna GENERATED
-- `dias_perdidos_calculados`). Idempotente vía ADD COLUMN IF NOT EXISTS.
--
-- ROLLBACK:
--   ALTER TABLE public.incidentes
--     DROP COLUMN IF EXISTS hora_ocurrencia,
--     DROP COLUMN IF EXISTS tipo_persona,
--     DROP COLUMN IF EXISTS fecha_baja_medica,
--     DROP COLUMN IF EXISTS fecha_alta_medica,
--     DROP COLUMN IF EXISTS dias_perdidos_calculados,
--     DROP COLUMN IF EXISTS tiene_denuncia_adjunta,
--     DROP COLUMN IF EXISTS tiene_evolucion_medica,
--     DROP COLUMN IF EXISTS ente_investigador,
--     DROP COLUMN IF EXISTS fecha_investigacion,
--     DROP COLUMN IF EXISTS causa_inmediata,
--     DROP COLUMN IF EXISTS causa_basica;
-- ============================================================

BEGIN;

ALTER TABLE public.incidentes
  ADD COLUMN IF NOT EXISTS hora_ocurrencia time,
  ADD COLUMN IF NOT EXISTS tipo_persona text
    CHECK (tipo_persona IN ('trabajador_interno', 'trabajador_externo'))
    DEFAULT 'trabajador_interno',
  ADD COLUMN IF NOT EXISTS fecha_baja_medica date,
  ADD COLUMN IF NOT EXISTS fecha_alta_medica date,
  ADD COLUMN IF NOT EXISTS dias_perdidos_calculados int GENERATED ALWAYS AS (
    CASE
      WHEN fecha_baja_medica IS NOT NULL AND fecha_alta_medica IS NOT NULL
        THEN (fecha_alta_medica - fecha_baja_medica)
      ELSE NULL
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS tiene_denuncia_adjunta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_evolucion_medica boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ente_investigador text,
  ADD COLUMN IF NOT EXISTS fecha_investigacion date,
  ADD COLUMN IF NOT EXISTS causa_inmediata text,
  ADD COLUMN IF NOT EXISTS causa_basica text;

COMMIT;
