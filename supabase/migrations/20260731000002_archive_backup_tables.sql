-- Archivar tablas de backup fuera del schema public (hallazgo PK-002)
-- 8 tablas _backup_* sin PK ni RLS: snapshots de dedupe/renombrado YA consolidados.
-- Moverlas al schema 'archive' las saca de la API de PostgREST (que solo expone 'public'),
-- elimina el riesgo de filtrado cross-tenant y conserva la data (reversible vs DROP).

CREATE SCHEMA IF NOT EXISTS archive;

-- Defensa en profundidad: los roles de la API no deben poder ni ver el schema.
REVOKE ALL ON SCHEMA archive FROM anon, authenticated;

ALTER TABLE IF EXISTS public._backup_clasif_20260618            SET SCHEMA archive;
ALTER TABLE IF EXISTS public._backup_nombres_pre_renombrar      SET SCHEMA archive;
ALTER TABLE IF EXISTS public._backup_pampero_borrados_20260618  SET SCHEMA archive;
ALTER TABLE IF EXISTS public._backup_pampero_casual_dup         SET SCHEMA archive;
ALTER TABLE IF EXISTS public._backup_pampero_miembrossup_20260618 SET SCHEMA archive;
ALTER TABLE IF EXISTS public._backup_pre_dedupe_map             SET SCHEMA archive;
ALTER TABLE IF EXISTS public._backup_pre_dedupe_prod            SET SCHEMA archive;
ALTER TABLE IF EXISTS public._backup_pre_dedupe_var             SET SCHEMA archive;

COMMENT ON SCHEMA archive IS 'Snapshots de migración fuera de la API. No exponer en PostgREST. Dropeable tras confirmar consolidación.';
