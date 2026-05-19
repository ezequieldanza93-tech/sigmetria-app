-- Create forms system: categorias, formularios, secciones, items, respuestas
-- Migration 20260518000015

-- 1. categorias_formularios ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias_formularios (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categorias_formularios_pkey PRIMARY KEY (id),
  CONSTRAINT categorias_formularios_nombre_key UNIQUE (nombre)
);

ALTER TABLE public.categorias_formularios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_formularios: select"
  ON public.categorias_formularios FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "categorias_formularios: insert"
  ON public.categorias_formularios FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "categorias_formularios: update"
  ON public.categorias_formularios FOR UPDATE TO authenticated
  USING (is_developer());

CREATE POLICY "categorias_formularios: delete"
  ON public.categorias_formularios FOR DELETE TO authenticated
  USING (is_developer());

INSERT INTO public.categorias_formularios (nombre) VALUES
  ('checklist'),
  ('permisos_de_trabajo'),
  ('cuestionario'),
  ('examen'),
  ('protocolos_de_medicion'),
  ('auditorias')
ON CONFLICT (nombre) DO NOTHING;

-- 2. formularios ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.formularios (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  gestion_id   uuid NOT NULL REFERENCES public.gestiones(id),
  categoria_id uuid NOT NULL REFERENCES public.categorias_formularios(id),
  descripcion  text,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT formularios_pkey PRIMARY KEY (id),
  CONSTRAINT formularios_gestion_categoria_key UNIQUE (gestion_id, categoria_id)
);

ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formularios: select"
  ON public.formularios FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "formularios: insert"
  ON public.formularios FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "formularios: update"
  ON public.formularios FOR UPDATE TO authenticated
  USING (is_developer());

CREATE POLICY "formularios: delete"
  ON public.formularios FOR DELETE TO authenticated
  USING (is_developer());

CREATE INDEX IF NOT EXISTS idx_formularios_gestion_id ON public.formularios (gestion_id);
CREATE INDEX IF NOT EXISTS idx_formularios_categoria_id ON public.formularios (categoria_id);

-- 3. formulario_secciones ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.formulario_secciones (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  title         text NOT NULL,
  order_index   integer NOT NULL DEFAULT 0,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT formulario_secciones_pkey PRIMARY KEY (id)
);

ALTER TABLE public.formulario_secciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formulario_secciones: select"
  ON public.formulario_secciones FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_secciones: insert"
  ON public.formulario_secciones FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "formulario_secciones: update"
  ON public.formulario_secciones FOR UPDATE TO authenticated
  USING (is_developer());

CREATE POLICY "formulario_secciones: delete"
  ON public.formulario_secciones FOR DELETE TO authenticated
  USING (is_developer());

CREATE INDEX IF NOT EXISTS idx_formulario_secciones_formulario_id ON public.formulario_secciones (formulario_id);

-- 4. formulario_items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.formulario_items (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  section_id    uuid NOT NULL REFERENCES public.formulario_secciones(id) ON DELETE CASCADE,
  question      text NOT NULL,
  order_index   integer NOT NULL DEFAULT 0,
  response_type text NOT NULL DEFAULT 'compliance',
  required      boolean NOT NULL DEFAULT true,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT formulario_items_pkey PRIMARY KEY (id)
);

ALTER TABLE public.formulario_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formulario_items: select"
  ON public.formulario_items FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_items: insert"
  ON public.formulario_items FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "formulario_items: update"
  ON public.formulario_items FOR UPDATE TO authenticated
  USING (is_developer());

CREATE POLICY "formulario_items: delete"
  ON public.formulario_items FOR DELETE TO authenticated
  USING (is_developer());

CREATE INDEX IF NOT EXISTS idx_formulario_items_section_id ON public.formulario_items (section_id);

-- 5. formulario_respuestas ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.formulario_respuestas (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.formularios(id),
  executed_by   uuid,
  executed_at   timestamp with time zone NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'in_progress',
  CONSTRAINT formulario_respuestas_pkey PRIMARY KEY (id),
  CONSTRAINT formulario_respuestas_status_check CHECK (status IN ('in_progress', 'completed'))
);

ALTER TABLE public.formulario_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formulario_respuestas: select"
  ON public.formulario_respuestas FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_respuestas: insert"
  ON public.formulario_respuestas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_respuestas: update"
  ON public.formulario_respuestas FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_respuestas: delete"
  ON public.formulario_respuestas FOR DELETE TO authenticated
  USING (is_developer());

CREATE INDEX IF NOT EXISTS idx_formulario_respuestas_formulario_id ON public.formulario_respuestas (formulario_id);

-- 6. formulario_item_respuestas ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.formulario_item_respuestas (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  respuesta_id uuid NOT NULL REFERENCES public.formulario_respuestas(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES public.formulario_items(id),
  answer       text NOT NULL,
  comment      text,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT formulario_item_respuestas_pkey PRIMARY KEY (id),
  CONSTRAINT formulario_item_respuestas_respuesta_item_key UNIQUE (respuesta_id, item_id)
);

ALTER TABLE public.formulario_item_respuestas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formulario_item_respuestas: select"
  ON public.formulario_item_respuestas FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_item_respuestas: insert"
  ON public.formulario_item_respuestas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_item_respuestas: update"
  ON public.formulario_item_respuestas FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "formulario_item_respuestas: delete"
  ON public.formulario_item_respuestas FOR DELETE TO authenticated
  USING (is_developer());

CREATE INDEX IF NOT EXISTS idx_formulario_item_respuestas_respuesta_id ON public.formulario_item_respuestas (respuesta_id);
CREATE INDEX IF NOT EXISTS idx_formulario_item_respuestas_item_id ON public.formulario_item_respuestas (item_id);

-- Trigger updated_at on formularios ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_formularios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_formularios_updated_at ON public.formularios;
CREATE TRIGGER trg_formularios_updated_at
  BEFORE UPDATE ON public.formularios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_formularios_updated_at();
