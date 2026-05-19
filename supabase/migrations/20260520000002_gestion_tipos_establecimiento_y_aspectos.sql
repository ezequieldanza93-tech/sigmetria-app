-- Junction table: gestión ↔ tipo de establecimiento
CREATE TABLE IF NOT EXISTS public.gestion_tipos_establecimiento (
  id                        uuid NOT NULL DEFAULT gen_random_uuid(),
  gestion_id                uuid NOT NULL REFERENCES public.gestiones(id) ON DELETE CASCADE,
  tipo_establecimiento_id   uuid NOT NULL REFERENCES public.tipos_establecimiento(id) ON DELETE CASCADE,
  created_at                timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gestion_tipos_establecimiento_pkey PRIMARY KEY (id),
  CONSTRAINT gestion_tipos_establecimiento_unique UNIQUE (gestion_id, tipo_establecimiento_id)
);

ALTER TABLE public.gestion_tipos_establecimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gestion_tipos_establecimiento: select"
  ON public.gestion_tipos_establecimiento FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "gestion_tipos_establecimiento: insert"
  ON public.gestion_tipos_establecimiento FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "gestion_tipos_establecimiento: delete"
  ON public.gestion_tipos_establecimiento FOR DELETE TO authenticated
  USING (is_developer());

CREATE INDEX IF NOT EXISTS idx_gestion_tipos_establecimiento_gestion
  ON public.gestion_tipos_establecimiento (gestion_id);

CREATE INDEX IF NOT EXISTS idx_gestion_tipos_establecimiento_tipo
  ON public.gestion_tipos_establecimiento (tipo_establecimiento_id);


-- Junction table: documentación (documento_tipos) ↔ tipo de establecimiento
CREATE TABLE IF NOT EXISTS public.documentacion_tipos_establecimiento (
  id                        uuid NOT NULL DEFAULT gen_random_uuid(),
  documento_tipo_id         uuid NOT NULL REFERENCES public.documento_tipos(id) ON DELETE CASCADE,
  tipo_establecimiento_id   uuid NOT NULL REFERENCES public.tipos_establecimiento(id) ON DELETE CASCADE,
  created_at                timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT documentacion_tipos_establecimiento_pkey PRIMARY KEY (id),
  CONSTRAINT documentacion_tipos_establecimiento_unique UNIQUE (documento_tipo_id, tipo_establecimiento_id)
);

ALTER TABLE public.documentacion_tipos_establecimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentacion_tipos_establecimiento: select"
  ON public.documentacion_tipos_establecimiento FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "documentacion_tipos_establecimiento: insert"
  ON public.documentacion_tipos_establecimiento FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "documentacion_tipos_establecimiento: delete"
  ON public.documentacion_tipos_establecimiento FOR DELETE TO authenticated
  USING (is_developer());

CREATE INDEX IF NOT EXISTS idx_documentacion_tipos_establecimiento_doc
  ON public.documentacion_tipos_establecimiento (documento_tipo_id);

CREATE INDEX IF NOT EXISTS idx_documentacion_tipos_establecimiento_tipo
  ON public.documentacion_tipos_establecimiento (tipo_establecimiento_id);


-- Seed aspectos de HyS
INSERT INTO public.aspectos (nombre) VALUES
  ('Cargas suspendidas'),
  ('Protección contra incendios'),
  ('Riesgo eléctrico'),
  ('Ergonomía'),
  ('Caídas a mismo nivel'),
  ('Iluminación y señalización'),
  ('Ventilación'),
  ('Explosión / ASP'),
  ('Sustancias químicas'),
  ('Máquinas y herramientas'),
  ('Riesgo biológico'),
  ('Trabajos en altura'),
  ('Ruido'),
  ('Aparatos para izar'),
  ('Vehículos industriales'),
  ('Condiciones higrotérmicas'),
  ('Orden y limpieza'),
  ('EPP'),
  ('Espacios confinados'),
  ('Radiaciones no ionizantes'),
  ('Vibraciones'),
  ('Trabajos en excavaciones / zanjas'),
  ('Demoliciones'),
  ('Trabajos en caliente')
ON CONFLICT (nombre) DO NOTHING;
