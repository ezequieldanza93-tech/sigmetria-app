-- ============================================================
-- Fix 3FN: empresas.art (text) → art_id (FK organizaciones_externas)
-- ============================================================

-- Agregar tipo "ART" al catálogo si no existe
INSERT INTO tipo_organizaciones (nombre, descripcion)
VALUES ('ART', 'Aseguradora de Riesgos del Trabajo')
ON CONFLICT DO NOTHING;

-- Agregar art_id FK (nullable)
ALTER TABLE empresas
  ADD COLUMN art_id uuid REFERENCES organizaciones_externas(id) ON DELETE SET NULL;

-- Migrar datos existentes: si hay empresas con art text que coincide con una org externa
UPDATE empresas e
SET art_id = o.id
FROM organizaciones_externas o
WHERE lower(e.art) = lower(o.nombre)
  AND e.art IS NOT NULL;

-- Dropear columna texto (dependencia transitiva eliminada)
ALTER TABLE empresas DROP COLUMN art;

-- Índice en la FK
CREATE INDEX IF NOT EXISTS idx_empresas_art ON empresas(art_id) WHERE art_id IS NOT NULL;
