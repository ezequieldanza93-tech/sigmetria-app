-- Create observacion_categoria table (urgency/severity level for observations)
CREATE TABLE IF NOT EXISTS public.observacion_categoria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  nivel smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT observacion_categoria_pkey PRIMARY KEY (id),
  CONSTRAINT observacion_categoria_nombre_key UNIQUE (nombre)
);

ALTER TABLE public.observacion_categoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden leer observacion_categoria"
  ON public.observacion_categoria
  FOR SELECT
  TO authenticated
  USING (has_establecimiento_read_access((SELECT establecimiento_id FROM registro_gestiones rg WHERE rg.id = (SELECT registro_gestion_id FROM observaciones_gestiones og WHERE og.categoria_id = id))));

-- Allow read for all authenticated users (no sensitive data)
DROP POLICY IF EXISTS "Todos pueden leer observacion_categoria" ON public.observacion_categoria;
CREATE POLICY "Lectura pública para autenticados"
  ON public.observacion_categoria
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed data
INSERT INTO public.observacion_categoria (nombre, nivel) VALUES
  ('Oportunidad de Mejora', 1),
  ('Acción Inmediata Media', 2),
  ('Acción Inmediata Alta', 3),
  ('Acción Inmediata Crítica', 4)
ON CONFLICT (nombre) DO NOTHING;

-- Add FK column to observaciones_gestiones
ALTER TABLE public.observaciones_gestiones
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.observacion_categoria(id) ON DELETE SET NULL;
