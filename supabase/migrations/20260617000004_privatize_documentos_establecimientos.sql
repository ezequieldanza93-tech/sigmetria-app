-- ============================================================
-- Privatizar buckets `documentos` y `establecimientos`
-- ============================================================
-- Cierra la EXCEPCIÓN TEMPORAL de 20260617000002: estos buckets quedaban
-- PÚBLICOS porque tenían datos legacy (URL pública absoluta + paths sin tenant).
--
-- Prerequisitos (TODOS cumplidos antes de aplicar esta migración):
--   1. Refactor path-aware deployado en prod (lee por paths, firma signed URLs).
--   2. Los 21 objetos legacy migrados a paths {consultora_id}/... y las 5 columnas
--      DB actualizadas al PATH relativo (scripts/migrate-documentos-tenant.ts).
--   3. lib/storage/buckets.ts con BUCKET_IS_PUBLIC.documentos/establecimientos = false
--      deployado en prod (el código firma en vez de usar getPublicUrl).
--
-- Las policies de lectura ya existen (20260617000002):
--   - "legacy assets: members read"          → miembros de la consultora dueña
--     del path ({consultora_id}/... ahora matchea para los 21 objetos migrados).
--   - "private assets: owner read fallback"   → el que subió, para paths sin tenant.
--
-- Idempotente: UPDATE directo del flag public.
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id IN ('documentos', 'establecimientos');
