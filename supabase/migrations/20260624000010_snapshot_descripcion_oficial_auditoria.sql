-- ============================================================
-- Auditoría de Requisitos Legales: snapshot del TEXTO LARGO del artículo
-- ============================================================
-- Cierra un hueco de compliance (Disp. 15/2026): hasta ahora el snapshot del
-- ítem de auditoría congelaba número/título/tipo/categoría/ámbito/artículo y la
-- descripción CORTA, pero NO el texto curado largo (`descripcion_oficial`), que
-- es el contenido normativo real que el auditor evaluó. Si después se edita o
-- borra la norma, el historial perdía ese texto.
--
-- Esta columna congela `normativa_requisitos.descripcion_oficial` al CREAR la
-- auditoría (lo escribe lib/actions/normativa-auditoria.ts → createAuditoria).
-- Backfill best-effort de los ítems existentes cuyo requisito sigue vivo
-- (FK ON DELETE SET NULL → puede ser NULL si la norma/requisito se borró).
--
-- Idempotente. No toca RLS (el tenant se deriva de la cabecera vía las policies
-- ya existentes en 20260620000003_normativa_auditorias.sql).
-- ============================================================

BEGIN;

ALTER TABLE public.normativa_auditoria_items
  ADD COLUMN IF NOT EXISTS descripcion_oficial text;

COMMENT ON COLUMN public.normativa_auditoria_items.descripcion_oficial IS
  'Snapshot del texto curado largo del artículo (normativa_requisitos.descripcion_oficial) al crear la auditoría. Congela el contenido normativo evaluado aunque después cambie el catálogo.';

-- Backfill: ítems existentes que todavía referencian un requisito vivo.
UPDATE public.normativa_auditoria_items i
SET descripcion_oficial = r.descripcion_oficial
FROM public.normativa_requisitos r
WHERE i.requisito_id = r.id
  AND i.descripcion_oficial IS NULL
  AND r.descripcion_oficial IS NOT NULL;

COMMIT;
