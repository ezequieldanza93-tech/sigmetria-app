-- ============================================================
-- Fix 3FN: capacitaciones.instructor (text) → split en
--   instructor_persona_id (FK directorio_personas) +
--   instructor_externo (text libre para externos)
-- ============================================================

-- Agregar FK a persona interna (nullable)
ALTER TABLE capacitaciones
  ADD COLUMN instructor_persona_id uuid
    REFERENCES directorio_personas(id) ON DELETE SET NULL;

-- Agregar campo libre para instructores externos
ALTER TABLE capacitaciones
  ADD COLUMN instructor_externo text;

-- Migrar datos existentes: el campo libre va a instructor_externo
-- No se puede inferir un match confiable por nombre → preservación segura
UPDATE capacitaciones
SET instructor_externo = instructor
WHERE instructor IS NOT NULL;

-- Dropear columna texto original
ALTER TABLE capacitaciones DROP COLUMN instructor;

-- Índice en la FK
CREATE INDEX IF NOT EXISTS idx_cap_instructor_persona
  ON capacitaciones(instructor_persona_id)
  WHERE instructor_persona_id IS NOT NULL;
