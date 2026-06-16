-- ============================================================
-- Carga Térmica: trabajador y representantes como personas del directorio
-- ============================================================
-- OBJETIVO global del proyecto: ningún campo de PERSONA debe ser texto libre;
-- debe ser FK al directorio (personas_directorio) vía un selector. El directorio
-- ya incluye trabajadores del establecimiento, no sólo staff de la consultora.
--
-- Este protocolo (SRT 30/2023) tenía 3 personas cargadas como TEXTO LIBRE:
--   - medicion_carga_termica_puestos.trabajador  (1 por puesto/GHE: trabajador medido)
--   - medicion_carga_termica.representante_trabajadores (cabecera: lado cliente)
--   - medicion_carga_termica.representante_empresa      (cabecera: lado cliente)
--
-- ADITIVA e idempotente, mismo criterio que 20260720000002 (firmante_persona_id):
--   - Agrega las columnas *_persona_id uuid REFERENCES personas_directorio(id).
--   - NO se borran las columnas TEXT existentes: quedan nullable como SNAPSHOT
--     (conservan el nombre cargado al momento + datos previos a este cambio).
--   - ON DELETE SET NULL: si se borra la persona del directorio, el protocolo
--     no se rompe — sólo pierde el vínculo (queda el snapshot de texto si lo había).
--   - Índices parciales (WHERE ... IS NOT NULL) igual que el resto del módulo.
--   - Sin RLS nueva: las columnas heredan la RLS por establecimiento ya vigente
--     en cada tabla (cabecera por establecimiento; puestos derivan de la cabecera).
--
-- Los bloques con to_regclass evitan fallar si el módulo aún no está aplicado.
-- ============================================================

BEGIN;

-- ─── Cabecera: representantes (lado cliente) ────────────────
DO $$
BEGIN
  IF to_regclass('public.medicion_carga_termica') IS NOT NULL THEN
    ALTER TABLE public.medicion_carga_termica
      ADD COLUMN IF NOT EXISTS representante_empresa_persona_id uuid
      REFERENCES public.personas_directorio(id) ON DELETE SET NULL;
    ALTER TABLE public.medicion_carga_termica
      ADD COLUMN IF NOT EXISTS representante_trabajadores_persona_id uuid
      REFERENCES public.personas_directorio(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_med_ct_rep_empresa_persona
      ON public.medicion_carga_termica (representante_empresa_persona_id)
      WHERE representante_empresa_persona_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_med_ct_rep_trab_persona
      ON public.medicion_carga_termica (representante_trabajadores_persona_id)
      WHERE representante_trabajadores_persona_id IS NOT NULL;

    COMMENT ON COLUMN public.medicion_carga_termica.representante_empresa_persona_id IS
      'Representante de la empresa (lado cliente), elegido del directorio de personas. El texto libre `representante_empresa` queda nullable como snapshot.';
    COMMENT ON COLUMN public.medicion_carga_termica.representante_trabajadores_persona_id IS
      'Representante de los trabajadores (lado cliente), elegido del directorio de personas. El texto libre `representante_trabajadores` queda nullable como snapshot.';
  END IF;
END $$;

-- ─── Puestos: trabajador medido (persona del establecimiento) ──
DO $$
BEGIN
  IF to_regclass('public.medicion_carga_termica_puestos') IS NOT NULL THEN
    ALTER TABLE public.medicion_carga_termica_puestos
      ADD COLUMN IF NOT EXISTS trabajador_persona_id uuid
      REFERENCES public.personas_directorio(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_med_ct_pto_trabajador_persona
      ON public.medicion_carga_termica_puestos (trabajador_persona_id)
      WHERE trabajador_persona_id IS NOT NULL;

    COMMENT ON COLUMN public.medicion_carga_termica_puestos.trabajador_persona_id IS
      'Trabajador medido (1 por puesto/GHE), elegido del directorio de personas del establecimiento. El texto libre `trabajador` queda nullable como snapshot.';
  END IF;
END $$;

COMMIT;
