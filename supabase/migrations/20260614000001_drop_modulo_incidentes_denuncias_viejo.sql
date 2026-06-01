-- ============================================================
-- DROP del módulo "Incidentes" + "Denuncias" VIEJO
-- ============================================================
--
-- QUÉ HACE:
-- Elimina por completo el módulo viejo de Incidentes/Denuncias (tablas,
-- fotos, lookups de auditoría, buckets de storage y sus policies) para
-- LIBERAR el nombre `incidentes`, que será reusado en la migración
-- siguiente (20260614000002) al renombrar `siniestros` -> `incidentes`.
--
-- Origen del esquema eliminado:
--   * 20260529000001_incidentes_denuncias.sql  (tablas + fotos + buckets + RLS)
--   * 20260606000001_audit_action_plan.sql      (lookups de auditoría)
--
-- Las tablas están VACÍAS (sin datos productivos) → NO se respalda nada.
-- NO se toca public.trigger_set_updated_at() / set_updated_at(): la usan
-- otras tablas vivas (siniestros, riesgos, etc.).
--
-- ROLLBACK:
--   Re-aplicar 20260529000001_incidentes_denuncias.sql y la sección de
--   lookups de 20260606000001_audit_action_plan.sql. Como no había datos,
--   el rollback restaura únicamente el esquema.
-- ============================================================

BEGIN;

-- ── Lookup tables de auditoría (módulo viejo) ────────────────
DROP TABLE IF EXISTS public.incidentes_tipos             CASCADE;
DROP TABLE IF EXISTS public.incidentes_severidad         CASCADE;
DROP TABLE IF EXISTS public.incidentes_estados           CASCADE;
DROP TABLE IF EXISTS public.denuncias_tipos              CASCADE;
DROP TABLE IF EXISTS public.denuncias_estados            CASCADE;
DROP TABLE IF EXISTS public.denuncias_denunciante_tipos  CASCADE;

-- ── Tablas de fotos (FK a las tablas padre) ──────────────────
DROP TABLE IF EXISTS public.incidentes_fotos CASCADE;
DROP TABLE IF EXISTS public.denuncias_fotos  CASCADE;

-- ── Tablas padre (CASCADE limpia triggers trg_*_updated_at,
--    índices idx_* y policies RLS asociadas) ──────────────────
DROP TABLE IF EXISTS public.incidentes CASCADE;
DROP TABLE IF EXISTS public.denuncias  CASCADE;

-- ── Storage RLS policies del módulo viejo ────────────────────
DROP POLICY IF EXISTS "incidentes storage: select" ON storage.objects;
DROP POLICY IF EXISTS "incidentes storage: insert" ON storage.objects;
DROP POLICY IF EXISTS "incidentes storage: delete" ON storage.objects;
DROP POLICY IF EXISTS "denuncias storage: select"  ON storage.objects;
DROP POLICY IF EXISTS "denuncias storage: insert"  ON storage.objects;
DROP POLICY IF EXISTS "denuncias storage: delete"  ON storage.objects;

-- ── Storage buckets (vacíos) ─────────────────────────────────
-- NOTA: los buckets se eliminan vía Storage API (no por SQL directo,
-- que Postgres bloquea con storage.protect_delete). Buckets vacíos
-- huérfanos no afectan el funcionamiento; se limpian aparte si se desea.

COMMIT;
