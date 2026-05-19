-- Global aspects catalog — reusable across forms, observations, etc.
CREATE TABLE IF NOT EXISTS public.aspectos (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT aspectos_pkey PRIMARY KEY (id),
  CONSTRAINT aspectos_nombre_key UNIQUE (nombre)
);

ALTER TABLE public.aspectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aspectos: select"
  ON public.aspectos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "aspectos: insert"
  ON public.aspectos FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "aspectos: update"
  ON public.aspectos FOR UPDATE TO authenticated
  USING (is_developer());

CREATE POLICY "aspectos: delete"
  ON public.aspectos FOR DELETE TO authenticated
  USING (is_developer());

-- FK from observaciones_gestiones
ALTER TABLE public.observaciones_gestiones
  ADD COLUMN IF NOT EXISTS aspecto_id uuid REFERENCES public.aspectos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_observaciones_gestiones_aspecto_id
  ON public.observaciones_gestiones (aspecto_id);

-- Junction: form sections ↔ aspects
CREATE TABLE IF NOT EXISTS public.formulario_seccion_aspectos (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id    uuid NOT NULL REFERENCES public.formulario_secciones(id) ON DELETE CASCADE,
  aspecto_id    uuid NOT NULL REFERENCES public.aspectos(id) ON DELETE CASCADE,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT formulario_seccion_aspectos_pkey PRIMARY KEY (id),
  CONSTRAINT formulario_seccion_aspectos_section_aspecto_key UNIQUE (section_id, aspecto_id)
);

ALTER TABLE public.formulario_seccion_aspectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formulario_seccion_aspectos: select"
  ON public.formulario_seccion_aspectos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_seccion_aspectos: insert"
  ON public.formulario_seccion_aspectos FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "formulario_seccion_aspectos: delete"
  ON public.formulario_seccion_aspectos FOR DELETE TO authenticated
  USING (is_developer());

CREATE INDEX IF NOT EXISTS idx_formulario_seccion_aspectos_section_id
  ON public.formulario_seccion_aspectos (section_id);

CREATE INDEX IF NOT EXISTS idx_formulario_seccion_aspectos_aspecto_id
  ON public.formulario_seccion_aspectos (aspecto_id);
