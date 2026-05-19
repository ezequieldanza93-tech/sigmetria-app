-- Denuncias and Feedback tables for establecimiento info section
CREATE TABLE IF NOT EXISTS public.establecimiento_denuncias (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  fecha             date NOT NULL,
  descripcion       text NOT NULL,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT establecimiento_denuncias_pkey PRIMARY KEY (id)
);

ALTER TABLE public.establecimiento_denuncias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "establecimiento_denuncias: select"
  ON public.establecimiento_denuncias FOR SELECT TO authenticated
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "establecimiento_denuncias: insert"
  ON public.establecimiento_denuncias FOR INSERT TO authenticated
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "establecimiento_denuncias: update"
  ON public.establecimiento_denuncias FOR UPDATE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "establecimiento_denuncias: delete"
  ON public.establecimiento_denuncias FOR DELETE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));

CREATE INDEX IF NOT EXISTS idx_establecimiento_denuncias_establecimiento_id
  ON public.establecimiento_denuncias (establecimiento_id);

-- Feedback de Clientes
CREATE TABLE IF NOT EXISTS public.establecimiento_feedback_clientes (
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  fecha             date NOT NULL,
  cliente           text NOT NULL,
  tipo              text NOT NULL DEFAULT 'sugerencia',
  descripcion       text NOT NULL,
  created_at        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT establecimiento_feedback_clientes_pkey PRIMARY KEY (id),
  CONSTRAINT establecimiento_feedback_clientes_tipo_check CHECK (tipo IN ('positivo', 'negativo', 'sugerencia'))
);

ALTER TABLE public.establecimiento_feedback_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "establecimiento_feedback_clientes: select"
  ON public.establecimiento_feedback_clientes FOR SELECT TO authenticated
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "establecimiento_feedback_clientes: insert"
  ON public.establecimiento_feedback_clientes FOR INSERT TO authenticated
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "establecimiento_feedback_clientes: update"
  ON public.establecimiento_feedback_clientes FOR UPDATE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "establecimiento_feedback_clientes: delete"
  ON public.establecimiento_feedback_clientes FOR DELETE TO authenticated
  USING (has_establecimiento_write_access(establecimiento_id));

CREATE INDEX IF NOT EXISTS idx_establecimiento_feedback_clientes_establecimiento_id
  ON public.establecimiento_feedback_clientes (establecimiento_id);
