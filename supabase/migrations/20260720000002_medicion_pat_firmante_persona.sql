-- ============================================================
-- Protocolos de medición: firmante como persona del directorio
-- ============================================================
-- Hoy el firmante de los protocolos de medición se carga como TEXTO LIBRE
-- (columna `firmante text`, nombre + matrícula). Decisión del cliente: el
-- firmante debe elegirse del DIRECTORIO de personas (personas_directorio),
-- igual que el resto de los responsables/roles de la app (mismo patrón que
-- el responsable de una observación o la brigada del SAP).
--
-- ADITIVA e idempotente:
--   - Agrega `firmante_persona_id uuid REFERENCES personas_directorio(id)`
--     a cada cabecera de protocolo (PAT, iluminación, ruido, carga térmica).
--   - NO se borra la columna `firmante text`: queda nullable para conservar
--     los datos viejos (protocolos cargados antes de este cambio).
--   - ON DELETE SET NULL: si se borra la persona del directorio, el protocolo
--     no se rompe — sólo pierde el vínculo (queda el `firmante` texto si lo había).
--
-- Las tablas de iluminación / ruido / carga térmica pueden no existir todavía
-- en algún entorno; el bloque DO con to_regclass evita fallar por eso.
-- ============================================================

BEGIN;

-- ─── PAT (objetivo principal de esta tarea) ─────────────────
ALTER TABLE public.medicion_pat
  ADD COLUMN IF NOT EXISTS firmante_persona_id uuid
  REFERENCES public.personas_directorio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_med_pat_firmante_persona
  ON public.medicion_pat (firmante_persona_id) WHERE firmante_persona_id IS NOT NULL;

COMMENT ON COLUMN public.medicion_pat.firmante_persona_id IS
  'Profesional firmante del protocolo, elegido del directorio de personas. Reemplaza al texto libre `firmante`, que queda nullable para conservar datos previos.';

-- ─── Iluminación / Ruido / Carga térmica (mismo criterio) ───
-- Sólo si la tabla existe (módulos que pueden no estar aplicados en todo entorno).
DO $$
BEGIN
  IF to_regclass('public.medicion_iluminacion') IS NOT NULL THEN
    ALTER TABLE public.medicion_iluminacion
      ADD COLUMN IF NOT EXISTS firmante_persona_id uuid
      REFERENCES public.personas_directorio(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_med_ilum_firmante_persona
      ON public.medicion_iluminacion (firmante_persona_id) WHERE firmante_persona_id IS NOT NULL;
    COMMENT ON COLUMN public.medicion_iluminacion.firmante_persona_id IS
      'Profesional firmante del protocolo, elegido del directorio de personas. El texto libre `firmante` queda nullable para datos previos.';
  END IF;

  IF to_regclass('public.medicion_ruido') IS NOT NULL THEN
    ALTER TABLE public.medicion_ruido
      ADD COLUMN IF NOT EXISTS firmante_persona_id uuid
      REFERENCES public.personas_directorio(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_med_ruido_firmante_persona
      ON public.medicion_ruido (firmante_persona_id) WHERE firmante_persona_id IS NOT NULL;
    COMMENT ON COLUMN public.medicion_ruido.firmante_persona_id IS
      'Profesional firmante del protocolo, elegido del directorio de personas. El texto libre `firmante` queda nullable para datos previos.';
  END IF;

  IF to_regclass('public.medicion_carga_termica') IS NOT NULL THEN
    ALTER TABLE public.medicion_carga_termica
      ADD COLUMN IF NOT EXISTS firmante_persona_id uuid
      REFERENCES public.personas_directorio(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_med_carga_term_firmante_persona
      ON public.medicion_carga_termica (firmante_persona_id) WHERE firmante_persona_id IS NOT NULL;
    COMMENT ON COLUMN public.medicion_carga_termica.firmante_persona_id IS
      'Profesional firmante del protocolo, elegido del directorio de personas. El texto libre `firmante` queda nullable para datos previos.';
  END IF;
END $$;

COMMIT;
