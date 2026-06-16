-- ============================================================
-- Cálculo de Carga de Fuego: firmante como persona del directorio
-- ============================================================
-- Hoy el firmante del Cálculo de Carga de Fuego (Dec 351/79 Anexo VII) se carga
-- como TEXTO LIBRE (columna `firmante text`, nombre + matrícula). Es el ÚNICO
-- protocolo de medición que nunca migró al selector de persona: los otros 4
-- (PAT, iluminación, ruido, carga térmica) ya tienen `firmante_persona_id`
-- (ver 20260720000002_medicion_pat_firmante_persona.sql).
--
-- Decisión del cliente: ningún campo de PERSONA debe ser texto libre; debe ser
-- FK al directorio (personas_directorio). Este cambio cierra ese hueco para
-- carga de fuego.
--
-- ADITIVA e idempotente (mismo molde que medicion_pat):
--   - Agrega `firmante_persona_id uuid REFERENCES personas_directorio(id)`
--     a la cabecera del cálculo (public.calculo_carga_fuego).
--   - NO se borra la columna `firmante text`: queda nullable para conservar
--     los datos viejos (cálculos cargados antes de este cambio) y como snapshot
--     del nombre/matrícula para el PDF.
--   - ON DELETE SET NULL: si se borra la persona del directorio, el cálculo
--     no se rompe — sólo pierde el vínculo (queda el `firmante` texto si lo había).
--
-- Hereda la RLS de la tabla calculo_carga_fuego (por establecimiento). No agrega
-- políticas nuevas.
-- ============================================================

BEGIN;

ALTER TABLE public.calculo_carga_fuego
  ADD COLUMN IF NOT EXISTS firmante_persona_id uuid
  REFERENCES public.personas_directorio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ccf_firmante_persona
  ON public.calculo_carga_fuego (firmante_persona_id) WHERE firmante_persona_id IS NOT NULL;

COMMENT ON COLUMN public.calculo_carga_fuego.firmante_persona_id IS
  'Profesional firmante del cálculo, elegido del directorio de personas. Reemplaza al texto libre `firmante`, que queda nullable como snapshot (nombre/matrícula) y para conservar datos previos.';

COMMIT;
