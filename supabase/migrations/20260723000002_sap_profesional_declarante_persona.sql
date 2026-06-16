-- ============================================================
-- SAP CABA (Ley 5920): profesional interviniente y declarante DDJJ G1
-- como personas del directorio
-- ============================================================
-- Hoy el SAP guarda dos identidades de persona como TEXTO LIBRE:
--   - el PROFESIONAL interviniente (profesional_nombre/titulo/matricula/email/
--     telefono) que firma el SAP G2/G3 — es el firmante de la consultora;
--   - el DECLARANTE de la DDJJ Grupo 1 (g1_declarante_nombre/g1_declarante_dni_cuit)
--     — es gente del lado del cliente.
--
-- Decisión: ningún campo de PERSONA debe ser texto libre; debe ser FK al
-- directorio (personas_directorio), igual que el firmante de los protocolos de
-- medición (ver 20260720000002_medicion_pat_firmante_persona.sql) y la brigada
-- del propio SAP (sap_roles.persona_id).
--
-- ADITIVA e idempotente:
--   - Agrega profesional_persona_id y g1_declarante_persona_id (FK nullable) a
--     sap_presentaciones.
--   - NO se borran las columnas text (profesional_* / g1_declarante_*): quedan
--     nullable como SNAPSHOT — conservan los datos cargados antes de este cambio
--     y alimentan el PDF / payload aunque se borre la persona del directorio.
--   - ON DELETE SET NULL: si se borra la persona, la presentación no se rompe;
--     pierde el vínculo y conserva el snapshot de texto.
--
-- RLS: no se agrega ninguna policy nueva — las nuevas columnas viven en
-- sap_presentaciones, que ya tiene RLS por establecimiento
-- (ver 20260716000003_sap_caba_presentaciones.sql).
-- ============================================================

BEGIN;

-- ─── Profesional interviniente (firma el SAP G2/G3) ─────────
ALTER TABLE public.sap_presentaciones
  ADD COLUMN IF NOT EXISTS profesional_persona_id uuid
  REFERENCES public.personas_directorio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sap_pres_profesional_persona
  ON public.sap_presentaciones (profesional_persona_id)
  WHERE profesional_persona_id IS NOT NULL;

COMMENT ON COLUMN public.sap_presentaciones.profesional_persona_id IS
  'Profesional interviniente que firma el SAP G2/G3, elegido del directorio de personas. Las columnas profesional_* (texto) quedan nullable como snapshot para datos previos y el PDF.';

-- ─── Declarante DDJJ Grupo 1 (lado del cliente) ─────────────
ALTER TABLE public.sap_presentaciones
  ADD COLUMN IF NOT EXISTS g1_declarante_persona_id uuid
  REFERENCES public.personas_directorio(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sap_pres_g1_declarante_persona
  ON public.sap_presentaciones (g1_declarante_persona_id)
  WHERE g1_declarante_persona_id IS NOT NULL;

COMMENT ON COLUMN public.sap_presentaciones.g1_declarante_persona_id IS
  'Declarante de la DDJJ Grupo 1, elegido del directorio de personas (lado del cliente). Las columnas g1_declarante_nombre / g1_declarante_dni_cuit quedan nullable como snapshot para datos previos.';

COMMIT;
