-- Change riesgos.responsable_id FK from profiles to directorio_personas
-- Table is empty in production so no data migration needed

ALTER TABLE public.riesgos
  DROP CONSTRAINT IF EXISTS riesgos_responsable_id_fkey;

ALTER TABLE public.riesgos
  ADD CONSTRAINT riesgos_responsable_id_fkey
  FOREIGN KEY (responsable_id) REFERENCES public.directorio_personas(id) ON DELETE SET NULL;
