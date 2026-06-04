-- ============================================================
-- Vinculación opcional entre usuarios del sistema (profiles)
-- y personas del directorio (personas_directorio).
--
-- Un usuario del sistema puede estar asociado a su registro
-- como persona en el directorio (tipo "Profesionales").
-- La relación es opcional (NULL permitido) para no romper
-- usuarios existentes.
-- ============================================================

-- 1. Agregar tipo "Profesionales" si no existe
INSERT INTO public.personas_tipos (nombre)
SELECT 'Profesionales'
WHERE NOT EXISTS (
  SELECT 1 FROM public.personas_tipos WHERE nombre = 'Profesionales'
);

-- 2. Agregar FK persona_id a profiles (opcional, SET NULL si se borra la persona)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS persona_id uuid
    REFERENCES public.personas_directorio(id)
    ON DELETE SET NULL;

-- 3. Índice para lookup inverso (persona → usuario)
CREATE INDEX IF NOT EXISTS idx_profiles_persona_id
  ON public.profiles(persona_id)
  WHERE persona_id IS NOT NULL;
