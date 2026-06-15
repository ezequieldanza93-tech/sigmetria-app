-- Migración: campos de dotación para cálculo Dec. 1338/96 (HyS)
-- Agrega operativos, administrativos y categoría_hys a establecimientos.
-- El campo cantidad_trabajadores (legacy) NO se toca.

ALTER TABLE establecimientos
  ADD COLUMN IF NOT EXISTS cantidad_trabajadores_operativos  int CHECK (cantidad_trabajadores_operativos  >= 0),
  ADD COLUMN IF NOT EXISTS cantidad_trabajadores_administrativos int CHECK (cantidad_trabajadores_administrativos >= 0),
  ADD COLUMN IF NOT EXISTS categoria_hys text CHECK (categoria_hys IN ('A', 'B', 'C'));

COMMENT ON COLUMN establecimientos.cantidad_trabajadores_operativos   IS 'Trabajadores que realizan tareas de producción/operación (Art. 4, Dec. 1338/96)';
COMMENT ON COLUMN establecimientos.cantidad_trabajadores_administrativos IS 'Trabajadores que realizan tareas administrativas (Art. 4, Dec. 1338/96)';
COMMENT ON COLUMN establecimientos.categoria_hys IS 'Categoría de riesgo según Dec. 1338/96: A (bajo), B (medio), C (alto)';
