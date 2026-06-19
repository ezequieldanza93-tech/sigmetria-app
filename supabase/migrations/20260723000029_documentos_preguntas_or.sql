-- ============================================================
-- Documentos: N preguntas por documento (OR), igual que en normativa
-- ============================================================
-- Algunos documentos aplican si se da CUALQUIERA de varias condiciones.
-- Caso: "Relevamiento de Medianeras" aplica si hay demolición O excavación O
-- submuración (trabajos que afectan estructuras linderas).
--
-- El gating del legajo pasa a evaluar (OR): documentos_tipos.pregunta_id (caso
-- simple, 1 pregunta) MÁS las filas de esta tabla. Con que UNA sea SÍ, el doc
-- entra al legajo. Sin preguntas vinculadas → aplica siempre.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documentos_tipos_preguntas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_tipo_id uuid NOT NULL REFERENCES public.documentos_tipos(id) ON DELETE CASCADE,
  pregunta_id       uuid NOT NULL REFERENCES public.riesgos_preguntas(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_tipo_id, pregunta_id)
);
CREATE INDEX IF NOT EXISTS idx_dtp_doc ON public.documentos_tipos_preguntas(documento_tipo_id);

ALTER TABLE public.documentos_tipos_preguntas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dtp_select" ON public.documentos_tipos_preguntas;
CREATE POLICY "dtp_select" ON public.documentos_tipos_preguntas
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "dtp_write" ON public.documentos_tipos_preguntas;
CREATE POLICY "dtp_write" ON public.documentos_tipos_preguntas
  FOR ALL USING (public.is_developer()) WITH CHECK (public.is_developer());

-- ─── Relevamiento de Medianeras → demolición OR excavación OR submuración ───
UPDATE public.documentos_tipos
SET requiere_pregunta = true
WHERE nombre = 'Relevamiento de Medianeras';

INSERT INTO public.documentos_tipos_preguntas (documento_tipo_id, pregunta_id)
SELECT dt.id, rp.id
FROM (VALUES
  ('Relevamiento de Medianeras', 'Q_DEMOLICION'),
  ('Relevamiento de Medianeras', 'Q_EXCAV_120'),
  ('Relevamiento de Medianeras', 'Q_SUBMURACION')
) AS m(doc, codigo)
JOIN public.documentos_tipos dt ON dt.nombre = m.doc
JOIN public.riesgos_preguntas rp ON rp.codigo = m.codigo
ON CONFLICT (documento_tipo_id, pregunta_id) DO NOTHING;
