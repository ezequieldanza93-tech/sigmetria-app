-- ============================================================
-- Normativa: N preguntas por norma (OR) + Corte de Suministro condicional
-- ============================================================
-- 1) normativa_normas_preguntas: una norma puede depender de VARIAS preguntas
--    con semántica OR (si CUALQUIERA es SÍ, la norma aplica — una sola vez, sin
--    duplicar en la matriz). Reemplaza el límite de 1 pregunta por norma.
--    Caso: Res SRT 503/2014 aplica si hay excavación O demolición.
-- 2) Corte de Suministro (Gas/Eléctrico): aplica si los trabajos pueden
--    interferir con líneas de suministro (nueva pregunta Q_INTERF_SUMINISTRO).
-- Idempotente.
-- ============================================================

-- ─── 1. Join N:N norma ↔ pregunta (OR) ───
CREATE TABLE IF NOT EXISTS public.normativa_normas_preguntas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  norma_id    uuid NOT NULL REFERENCES public.normativa_normas(id) ON DELETE CASCADE,
  pregunta_id uuid NOT NULL REFERENCES public.riesgos_preguntas(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (norma_id, pregunta_id)
);
CREATE INDEX IF NOT EXISTS idx_nnp_norma ON public.normativa_normas_preguntas(norma_id);

ALTER TABLE public.normativa_normas_preguntas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nnp_select" ON public.normativa_normas_preguntas;
CREATE POLICY "nnp_select" ON public.normativa_normas_preguntas
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "nnp_write" ON public.normativa_normas_preguntas;
CREATE POLICY "nnp_write" ON public.normativa_normas_preguntas
  FOR ALL USING (public.is_developer()) WITH CHECK (public.is_developer());

-- ─── 2. Poblar el join (incluye 503/2014 con OR de 2 preguntas) ───
INSERT INTO public.normativa_normas_preguntas (norma_id, pregunta_id)
SELECT n.id, rp.id
FROM (VALUES
  ('Resolución', '61',  2023, 'Q_ALTURA'),
  ('Resolución', '550', 2011, 'Q_SUBMURACION'),
  ('Resolución', '503', 2014, 'Q_DEMOLICION'),
  ('Resolución', '503', 2014, 'Q_EXCAV_120')
) AS m(tipo, numero, anio, codigo)
JOIN public.normativa_normas n ON n.tipo = m.tipo AND n.numero = m.numero AND n.anio = m.anio
JOIN public.riesgos_preguntas rp ON rp.codigo = m.codigo
ON CONFLICT (norma_id, pregunta_id) DO NOTHING;

-- 503/2014 pasa a condicional (61 y 550 ya lo eran).
UPDATE public.normativa_normas
SET requiere_pregunta = true
WHERE tipo = 'Resolución' AND numero = '503' AND anio = 2014;

-- ─── 3. Pregunta de interferencia con líneas de suministro ───
INSERT INTO public.riesgos_preguntas (codigo, texto, orden, is_active)
SELECT 'Q_INTERF_SUMINISTRO',
       '¿Los trabajos pueden interferir con líneas de suministro (luz, gas, agua, etc.)?',
       72, true
WHERE NOT EXISTS (SELECT 1 FROM public.riesgos_preguntas WHERE codigo = 'Q_INTERF_SUMINISTRO');

INSERT INTO public.preguntas_tipos (pregunta_id, tipo_id, orden)
SELECT rp.id, '86fd17d6-7e26-4b21-b5db-2b9fafbb449f', 72
FROM public.riesgos_preguntas rp
WHERE rp.codigo = 'Q_INTERF_SUMINISTRO'
  AND NOT EXISTS (
    SELECT 1 FROM public.preguntas_tipos pt
    WHERE pt.pregunta_id = rp.id AND pt.tipo_id = '86fd17d6-7e26-4b21-b5db-2b9fafbb449f'
  );

-- Corte de Suministro (Gas/Eléctrico) → condicional por interferencia.
UPDATE public.documentos_tipos dt
SET requiere_pregunta = true, pregunta_id = rp.id, pregunta_sugerida = rp.texto
FROM public.riesgos_preguntas rp
WHERE rp.codigo = 'Q_INTERF_SUMINISTRO'
  AND dt.nombre IN ('Corte de Suministro de Gas', 'Corte de Suministro Eléctrico');
