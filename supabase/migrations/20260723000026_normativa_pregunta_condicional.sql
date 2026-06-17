-- ============================================================
-- Matriz legal CONDICIONAL: normas que aplican según una pregunta del alta
-- ============================================================
-- Mismo modelo que documentos_tipos: una norma puede "aplicar siempre"
-- (requiere_pregunta=false, default) o requerir que el establecimiento haya
-- respondido SÍ a una pregunta inducida (requiere_pregunta=true + pregunta_id).
-- getNormativasAplicables suma este gating sobre el filtro por tipo/jurisdicción.
--
-- Seed de los condicionales claros (1 pregunta):
--   • Res SRT 61/2023  (trabajo en altura)   → Q_ALTURA
--   • Res SRT 550/2011 (submuración)         → Q_SUBMURACION (pregunta nueva)
-- Res SRT 503/2014 (excavación O demolición) NO se seedea: necesitaría 2
--   preguntas (OR), que el modelo de 1 pregunta no expresa → queda para definir.
--
-- Idempotente.
-- ============================================================

ALTER TABLE public.normativa_normas
  ADD COLUMN IF NOT EXISTS requiere_pregunta boolean NOT NULL DEFAULT false;
ALTER TABLE public.normativa_normas
  ADD COLUMN IF NOT EXISTS pregunta_sugerida text;
ALTER TABLE public.normativa_normas
  ADD COLUMN IF NOT EXISTS pregunta_id uuid REFERENCES public.riesgos_preguntas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.normativa_normas.requiere_pregunta IS
  'false = aplica siempre (según tipo/jurisdicción); true = aplica solo si el establecimiento respondió SÍ a pregunta_id.';
COMMENT ON COLUMN public.normativa_normas.pregunta_id IS
  'FK riesgos_preguntas: pregunta del alta que gatilla la norma.';

CREATE INDEX IF NOT EXISTS idx_normativa_normas_pregunta ON public.normativa_normas(pregunta_id);

-- ─── Pregunta nueva: submuración (para Res SRT 550/2011) ───
INSERT INTO public.riesgos_preguntas (codigo, texto, orden, is_active)
SELECT 'Q_SUBMURACION', '¿Hay subsuelo con submuración (recalce de cimientos linderos)?', 71, true
WHERE NOT EXISTS (SELECT 1 FROM public.riesgos_preguntas WHERE codigo = 'Q_SUBMURACION');

-- Mostrarla en el alta de establecimientos de Construcción.
INSERT INTO public.preguntas_tipos (pregunta_id, tipo_id, orden)
SELECT rp.id, '86fd17d6-7e26-4b21-b5db-2b9fafbb449f', 71
FROM public.riesgos_preguntas rp
WHERE rp.codigo = 'Q_SUBMURACION'
  AND NOT EXISTS (
    SELECT 1 FROM public.preguntas_tipos pt
    WHERE pt.pregunta_id = rp.id AND pt.tipo_id = '86fd17d6-7e26-4b21-b5db-2b9fafbb449f'
  );

-- ─── Gating de normas condicionales ───
UPDATE public.normativa_normas n
SET requiere_pregunta = true, pregunta_id = rp.id, pregunta_sugerida = rp.texto
FROM public.riesgos_preguntas rp
WHERE rp.codigo = 'Q_ALTURA'
  AND n.tipo = 'Resolución' AND n.numero = '61' AND n.anio = 2023;

UPDATE public.normativa_normas n
SET requiere_pregunta = true, pregunta_id = rp.id, pregunta_sugerida = rp.texto
FROM public.riesgos_preguntas rp
WHERE rp.codigo = 'Q_SUBMURACION'
  AND n.tipo = 'Resolución' AND n.numero = '550' AND n.anio = 2011;
