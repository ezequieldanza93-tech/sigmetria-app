-- Feedback f2bb485e: foto de perfil de la persona + imágenes del DNI (frente/dorso).
-- Se guardan como PATH en el bucket privado existente `documentos`
-- (path {consultora_id}/persona/{persona_id}/{kind}.{ext}). El número de DNI ya existe
-- (personas_directorio.dni) y se edita con updatePersona.

ALTER TABLE public.personas_directorio
  ADD COLUMN IF NOT EXISTS foto_url       text,
  ADD COLUMN IF NOT EXISTS dni_frente_url text,
  ADD COLUMN IF NOT EXISTS dni_dorso_url  text;
