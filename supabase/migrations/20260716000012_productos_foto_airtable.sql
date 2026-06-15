-- ============================================================
-- Productos (EPP) — columnas para import del catálogo de Airtable
-- Migration: 20260716000012
--
-- foto_url: foto del producto rehospedada en Supabase Storage (las URLs de
--   Airtable son temporales). airtable_id: record id de origen, para
--   trazabilidad e idempotencia del import (re-ejecutable sin duplicar).
-- ============================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS airtable_id text;

CREATE UNIQUE INDEX IF NOT EXISTS productos_airtable_id_key
  ON productos(airtable_id) WHERE airtable_id IS NOT NULL;

COMMENT ON COLUMN productos.foto_url IS 'URL de la foto del producto (rehospedada en Storage). Importado del catálogo de Airtable (SCM).';
COMMENT ON COLUMN productos.airtable_id IS 'Record ID de Airtable (catálogo SCM) — trazabilidad e idempotencia del import.';
