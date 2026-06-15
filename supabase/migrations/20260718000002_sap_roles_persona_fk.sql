-- Fase: brigada de emergencia → FK al directorio de personas
-- La persona ahora se referencia desde personas_directorio (ID).
-- persona_nombre y persona_dni se conservan por compatibilidad con datos previos.

ALTER TABLE public.sap_roles
  ADD COLUMN IF NOT EXISTS persona_id uuid
    REFERENCES public.personas_directorio(id)
    ON DELETE SET NULL;

-- El nombre ya no es obligatorio: puede venir implícito por la FK.
ALTER TABLE public.sap_roles
  ALTER COLUMN persona_nombre DROP NOT NULL;
