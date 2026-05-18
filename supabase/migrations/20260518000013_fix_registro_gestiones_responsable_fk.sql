-- ============================================================
-- Fix: registro_gestiones.responsable_id → directorio_personas
-- La migration 20260518000007 cambió la FK a profiles(id),
-- pero el frontend espera directorio_personas:
--   - EjecucionModal carga responsables desde persona_establecimiento
--     → directorio_personas (nombre, apellido)
--   - La query de agenda hace join a directorio_personas
--   - profiles no tiene nombre/apellido, solo full_name
-- ============================================================

ALTER TABLE registro_gestiones
  DROP CONSTRAINT IF EXISTS registro_gestiones_responsable_id_fkey;

ALTER TABLE registro_gestiones
  ADD CONSTRAINT registro_gestiones_responsable_id_fkey
  FOREIGN KEY (responsable_id) REFERENCES public.directorio_personas(id) ON DELETE SET NULL;
