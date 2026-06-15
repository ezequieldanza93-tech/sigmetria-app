-- Migración: geo-sello para registros de gestión.
-- Agrega coordenadas, precisión, timestamp y estado de captura GPS al momento
-- de completar una gestión en campo. Sirve como evidencia de presencia física.
--
-- gestiones_registros está PARTICIONADA por fecha_planificada (8 particiones);
-- el ADD COLUMN sobre el padre se propaga automáticamente a todas las particiones.
-- Todas las columnas son opcionales: una gestión puede completarse sin geo
-- (permiso denegado, sin soporte, etc.) y geo_estado deja registro del motivo.

ALTER TABLE public.gestiones_registros
  ADD COLUMN IF NOT EXISTS geo_lat        double precision,
  ADD COLUMN IF NOT EXISTS geo_lng        double precision,
  ADD COLUMN IF NOT EXISTS geo_precision_m double precision,
  ADD COLUMN IF NOT EXISTS geo_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo_estado     text;

-- Restringe geo_estado a los estados del contrato del geo-sello.
-- NOT VALID para no bloquear sobre filas existentes (no las hay con geo, pero
-- evita el escaneo completo de las 8 particiones al aplicar).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gestiones_registros_geo_estado_check'
  ) THEN
    ALTER TABLE public.gestiones_registros
      ADD CONSTRAINT gestiones_registros_geo_estado_check
      CHECK (geo_estado IS NULL OR geo_estado IN ('capturada', 'sin_permiso', 'no_soportado', 'error', 'timeout'))
      NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.gestiones_registros.geo_lat         IS 'Latitud capturada al completar la gestión (WGS84). NULL si no se pudo capturar.';
COMMENT ON COLUMN public.gestiones_registros.geo_lng         IS 'Longitud capturada al completar la gestión (WGS84). NULL si no se pudo capturar.';
COMMENT ON COLUMN public.gestiones_registros.geo_precision_m IS 'Precisión reportada por el navegador en metros (GeolocationCoordinates.accuracy).';
COMMENT ON COLUMN public.gestiones_registros.geo_captured_at IS 'Timestamp del servidor (now()) al aplicar el sello geo.';
COMMENT ON COLUMN public.gestiones_registros.geo_estado      IS 'Resultado de la captura GPS: capturada | sin_permiso | no_soportado | error | timeout.';
