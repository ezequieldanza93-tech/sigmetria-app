-- ============================================================
-- Ajustes de certificados de calibración
-- ============================================================
-- La tabla `certificados_calibracion` ya tiene todas las columnas necesarias
-- (instrumento_id, fecha_emision, fecha_vencimiento, certificado_url, activo)
-- creadas en 20260516000010. Esta migración sólo agrega un índice que optimiza
-- la lectura del "certificado vigente más reciente" usada por getCertificadoVigente()
-- y por los protocolos de medición:
--   WHERE instrumento_id = $1 AND activo = true ORDER BY fecha_emision DESC LIMIT 1
--
-- El índice existente idx_cert_instrumento (sólo instrumento_id) no cubre el filtro
-- por `activo` ni el orden por `fecha_emision`. Este índice parcial sí.

CREATE INDEX IF NOT EXISTS idx_cert_instrumento_vigente
  ON public.certificados_calibracion (instrumento_id, fecha_emision DESC)
  WHERE activo = true;
