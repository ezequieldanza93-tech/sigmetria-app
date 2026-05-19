-- Establecimiento info categories (denuncias, feedback, etc.)
-- This replaces the old approach of having these as gestion categories
CREATE TABLE IF NOT EXISTS public.categorias_info_establecimiento (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  icono      text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categorias_info_establecimiento_pkey PRIMARY KEY (id),
  CONSTRAINT categorias_info_establecimiento_nombre_key UNIQUE (nombre)
);

ALTER TABLE public.categorias_info_establecimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_info_establecimiento: select"
  ON public.categorias_info_establecimiento FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "categorias_info_establecimiento: insert"
  ON public.categorias_info_establecimiento FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "categorias_info_establecimiento: update"
  ON public.categorias_info_establecimiento FOR UPDATE TO authenticated
  USING (is_developer());

CREATE POLICY "categorias_info_establecimiento: delete"
  ON public.categorias_info_establecimiento FOR DELETE TO authenticated
  USING (is_developer());

INSERT INTO public.categorias_info_establecimiento (nombre, icono) VALUES
  ('Denuncias', 'alert-circle'),
  ('Feedback Clientes', 'message-square')
ON CONFLICT (nombre) DO NOTHING;
