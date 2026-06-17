-- ============================================================
-- Catálogo de documentos: modo de aplicación + pregunta + FK a normativa
-- ============================================================
-- Para el legajo técnico CONDICIONAL:
--   • requiere_pregunta  — si false (default) el doc "aplica siempre" (dentro
--     de su nivel/tipo); si true, el doc solo aplica cuando el establecimiento
--     respondió SÍ a la pregunta inducida vinculada.
--   • pregunta_id        — FK a riesgos_preguntas (la pregunta estructurada del
--     alta del establecimiento que gatilla el doc). El gating en getLegajoEsperados
--     mira establecimientos_respuestas[pregunta_id] = true.
--   • pregunta_sugerida  — texto humano de la pregunta inducida (se muestra en el
--     catálogo / legajo). Redactada para que SÍ = aplica, NO = no aplica.
--   • norma_id           — FK a normativa_normas: la norma que EXIGE el documento
--     (1 norma por documento; informativo + base para la matriz legal futura).
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE determinístico por nombre.
-- ============================================================

ALTER TABLE public.documentos_tipos
  ADD COLUMN IF NOT EXISTS requiere_pregunta boolean NOT NULL DEFAULT false;
ALTER TABLE public.documentos_tipos
  ADD COLUMN IF NOT EXISTS pregunta_sugerida text;
ALTER TABLE public.documentos_tipos
  ADD COLUMN IF NOT EXISTS pregunta_id uuid REFERENCES public.riesgos_preguntas(id) ON DELETE SET NULL;
ALTER TABLE public.documentos_tipos
  ADD COLUMN IF NOT EXISTS norma_id uuid REFERENCES public.normativa_normas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documentos_tipos.requiere_pregunta IS
  'false = aplica siempre (default); true = aplica solo si el establecimiento respondió SÍ a pregunta_id.';
COMMENT ON COLUMN public.documentos_tipos.pregunta_id IS
  'FK riesgos_preguntas: pregunta del alta que gatilla el documento (gating del legajo).';
COMMENT ON COLUMN public.documentos_tipos.pregunta_sugerida IS
  'Texto humano de la pregunta inducida (SÍ = aplica, NO = no aplica).';
COMMENT ON COLUMN public.documentos_tipos.norma_id IS
  'FK normativa_normas: norma que exige el documento (1 norma por doc; informativo).';

CREATE INDEX IF NOT EXISTS idx_documentos_tipos_pregunta ON public.documentos_tipos(pregunta_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipos_norma ON public.documentos_tipos(norma_id);

-- ─── Seed de los documentos condicionales identificados ───
-- Demolición → Q_DEMOLICION
UPDATE public.documentos_tipos dt
SET requiere_pregunta = true,
    pregunta_id        = rp.id,
    pregunta_sugerida  = rp.texto
FROM public.riesgos_preguntas rp
WHERE rp.codigo = 'Q_DEMOLICION'
  AND dt.nombre IN ('Acta de Inicio de Demolición','Acta de Fin de Demolición','Informe Técnico Demolición');

-- Excavación → Q_EXCAV_120
UPDATE public.documentos_tipos dt
SET requiere_pregunta = true,
    pregunta_id        = rp.id,
    pregunta_sugerida  = rp.texto
FROM public.riesgos_preguntas rp
WHERE rp.codigo = 'Q_EXCAV_120'
  AND dt.nombre IN ('Acta de Inicio de Excavación','Acta de Fin de Excavación','Informe Técnico Excavación');

-- Aviso de Obra (AIO) → Q_AVISO_OBRA
UPDATE public.documentos_tipos dt
SET requiere_pregunta = true,
    pregunta_id        = rp.id,
    pregunta_sugerida  = rp.texto
FROM public.riesgos_preguntas rp
WHERE rp.codigo = 'Q_AVISO_OBRA'
  AND dt.nombre = 'Aviso de Obra (AIO)';
