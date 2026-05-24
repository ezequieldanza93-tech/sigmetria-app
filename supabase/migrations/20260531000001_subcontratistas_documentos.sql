-- ============================================================
-- Sigmetría HyS — Módulo de Subcontratistas: Documentación
--
-- 1. Tabla subcontratistas_documentos
-- 2. Flag aplica_subcontratista en documentos_tipos (seed)
-- 3. Storage bucket subcontratistas + RLS
-- 4. RLS para subcontratistas_documentos
-- ============================================================

-- ============================================================
-- 1. Tabla subcontratistas_documentos
-- ============================================================

CREATE TABLE public.subcontratistas_documentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontratista_id UUID NOT NULL REFERENCES public.subcontratistas(id) ON DELETE CASCADE,
  tipo_id           UUID NOT NULL REFERENCES public.documentos_tipos(id),
  archivo_url       TEXT,
  fecha_emision     DATE,
  fecha_vencimiento DATE,
  observaciones     TEXT,
  subido_por        UUID NOT NULL REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_doc_subcontratista ON public.subcontratistas_documentos(subcontratista_id);
CREATE INDEX idx_sub_doc_vencimiento ON public.subcontratistas_documentos(fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;


-- ============================================================
-- 2. Flag aplica_subcontratista en documentos_tipos
-- ============================================================

ALTER TABLE public.documentos_tipos
  ADD COLUMN aplica_subcontratista BOOLEAN NOT NULL DEFAULT false;

-- Tipos que aplican a subcontratistas (seed)
UPDATE public.documentos_tipos SET aplica_subcontratista = true WHERE nombre IN (
  'Seguro de Vida Obligatorio',
  'ART / Riesgos del Trabajo',
  'Habilitación / Certificado',
  'Seguro',
  'Certificado',
  'Contrato / Acuerdo',
  'Otro'
);


-- ============================================================
-- 3. Storage bucket subcontratistas
-- ============================================================

INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('subcontratistas', 'subcontratistas', false, false)
ON CONFLICT (id) DO NOTHING;

-- RLS: solo authenticated
CREATE POLICY "subcontratistas: select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'subcontratistas' AND auth.role() = 'authenticated');

CREATE POLICY "subcontratistas: insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'subcontratistas' AND auth.role() = 'authenticated');

CREATE POLICY "subcontratistas: update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'subcontratistas' AND auth.role() = 'authenticated');

CREATE POLICY "subcontratistas: delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'subcontratistas' AND auth.role() = 'authenticated');


-- ============================================================
-- 4. RLS para subcontratistas_documentos
-- ============================================================

ALTER TABLE public.subcontratistas_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontratistas_documentos: select" ON public.subcontratistas_documentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizaciones_externas oe ON oe.id = s.organizacion_id
      WHERE s.id = subcontratistas_documentos.subcontratista_id
        AND (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'developer')
          OR EXISTS (SELECT 1 FROM public.consultoras_members cm WHERE cm.user_id = auth.uid() AND cm.is_active = true)
        )
    )
  );

CREATE POLICY "subcontratistas_documentos: insert" ON public.subcontratistas_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizaciones_externas oe ON oe.id = s.organizacion_id
      WHERE s.id = subcontratistas_documentos.subcontratista_id
        AND (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'developer')
          OR EXISTS (SELECT 1 FROM public.consultoras_members cm WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador'))
        )
    )
  );

CREATE POLICY "subcontratistas_documentos: update" ON public.subcontratistas_documentos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizaciones_externas oe ON oe.id = s.organizacion_id
      WHERE s.id = subcontratistas_documentos.subcontratista_id
        AND (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'developer')
          OR EXISTS (SELECT 1 FROM public.consultoras_members cm WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador'))
        )
    )
  );

CREATE POLICY "subcontratistas_documentos: delete" ON public.subcontratistas_documentos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizaciones_externas oe ON oe.id = s.organizacion_id
      WHERE s.id = subcontratistas_documentos.subcontratista_id
        AND (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'developer')
          OR EXISTS (SELECT 1 FROM public.consultoras_members cm WHERE cm.user_id = auth.uid() AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch'))
        )
    )
  );
