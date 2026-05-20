-- ============================================================
-- Sigmetría HyS — Normalización 3NF: localidad en perfiles
-- profesionales y cliente en feedback
--
-- 1. perfiles_profesionales.localidad → localidad_id FK
-- 2. establecimientos_feedback_clientes.cliente → persona_id FK
--
-- Ambas tablas están vacías (0 rows), cambios seguros.
-- ============================================================


-- ============================================================
-- perfiles_profesionales
-- ============================================================

-- Agrega FK a localidades (reemplaza el text libre)
ALTER TABLE public.perfiles_profesionales
  ADD COLUMN localidad_id uuid REFERENCES public.localidades(id) ON DELETE SET NULL;

-- Índice para joins y filtros por localidad
CREATE INDEX idx_perfiles_localidad_id
  ON public.perfiles_profesionales (localidad_id)
  WHERE localidad_id IS NOT NULL;

-- Nota: localidad (text) se mantiene como deprecated para no romper
-- la API. En el futuro se eliminará cuando todos los consumers
-- migren a localidad_id. provincia_residencia y provincia_matricula
-- se mantienen como text porque no existe catálogo de provincias.


-- ============================================================
-- establecimientos_feedback_clientes
-- ============================================================

-- Agrega FK a personas_directorio como referencia canónica
ALTER TABLE public.establecimientos_feedback_clientes
  ADD COLUMN persona_id uuid REFERENCES public.personas_directorio(id) ON DELETE SET NULL;

-- Hace cliente nullable (ahora es opcional, persona_id es la ref canónica)
ALTER TABLE public.establecimientos_feedback_clientes
  ALTER COLUMN cliente DROP NOT NULL;

-- Índice para joins por persona
CREATE INDEX idx_feedback_persona_id
  ON public.establecimientos_feedback_clientes (persona_id)
  WHERE persona_id IS NOT NULL;
