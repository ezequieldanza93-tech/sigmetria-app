-- Add geographic coordinates to empresas for map, weather and local time display
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS latitude  FLOAT8,
  ADD COLUMN IF NOT EXISTS longitude FLOAT8;
