-- ============================================================
-- Matriz de Requisitos Legales — aplicabilidad extendida
-- ============================================================
-- Hasta hoy la única dimensión de aplicabilidad de una norma era el tipo de
-- establecimiento (normativa_normas_tipos_establecimiento + aplica_a_todos),
-- evaluada solo como filtro de catálogo. No había forma de expresar:
--   - "aplica solo en una jurisdicción" (ej. CABA),
--   - "aplica solo a establecimientos con habilitación",
--   - "NO aplica a cierto tipo" (ej. obras de construcción).
--
-- Esto agrega esas tres dimensiones, de forma genérica y reutilizable para
-- cualquier norma local. El evaluador por establecimiento vive en
-- lib/actions/normativa-legal.ts (getNormativasAplicables).
--
-- Semántica del evaluador (norma N aplica al establecimiento E):
--   (N.aplica_a_todos OR existe join modo='incluye' con tipo de E)
--   AND NOT existe join modo='excluye' con tipo de E
--   AND (N.provincia_id IS NULL OR N.provincia_id = provincia de E)
--   AND (NOT N.requiere_habilitacion OR E.tiene_habilitacion)
--
-- Idempotente.
-- ============================================================

-- ─── 1. Dimensiones de aplicabilidad en la norma ────────────
ALTER TABLE public.normativa_normas
  ADD COLUMN IF NOT EXISTS provincia_id uuid REFERENCES public.provincias(id) ON DELETE SET NULL;
ALTER TABLE public.normativa_normas
  ADD COLUMN IF NOT EXISTS requiere_habilitacion boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_normativa_normas_provincia
  ON public.normativa_normas (provincia_id);

COMMENT ON COLUMN public.normativa_normas.provincia_id IS
  'Si no es NULL, la norma aplica solo a establecimientos en esa jurisdicción (provincia/CABA). NULL = cualquier jurisdicción.';
COMMENT ON COLUMN public.normativa_normas.requiere_habilitacion IS
  'Si true, la norma aplica solo a establecimientos con habilitación (establecimientos.tiene_habilitacion).';

-- ─── 2. Modo incluye/excluye en el join por tipo ────────────
ALTER TABLE public.normativa_normas_tipos_establecimiento
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'incluye'
    CHECK (modo IN ('incluye', 'excluye'));

COMMENT ON COLUMN public.normativa_normas_tipos_establecimiento.modo IS
  'incluye = la norma aplica a este tipo; excluye = la norma NO aplica a este tipo (ej. obras de construcción). El excluye tiene prioridad.';
