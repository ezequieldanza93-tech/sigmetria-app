-- Todos los establecimientos tienen habilitación municipal por defecto.
-- Se puede setear a false cuando un establecimiento está en proceso de obtenerla.
ALTER TABLE establecimientos ALTER COLUMN tiene_habilitacion SET DEFAULT true;

UPDATE establecimientos
SET tiene_habilitacion = true
WHERE tiene_habilitacion IS NULL OR tiene_habilitacion = false;
