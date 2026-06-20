-- Auditoría de Requisitos Legales: archivo de evidencia adjunto por ítem.
-- Se guarda el PATH dentro del bucket privado existente `documentos`
-- (path {consultora_id}/auditoria/{item_id}/evidencia.{ext} → la RLS per-tenant
-- de storage ya lo cubre). `evidencia_url` (link externo) se mantiene en paralelo.

ALTER TABLE public.normativa_auditoria_items
  ADD COLUMN IF NOT EXISTS evidencia_path text;
