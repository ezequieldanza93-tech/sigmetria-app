-- ============================================================
-- INCIDENTES: adjuntos de denuncia e investigación
-- ============================================================
--
-- QUÉ HACE:
-- Agrega dos columnas de adjuntos REALES a public.incidentes,
-- siguiendo el patrón existente `adjuntos_urls` (text[] de URLs públicas
-- del bucket de Storage `documentos`, que ya existe — NO se crea bucket):
--   * denuncia_adjuntos_urls      → la denuncia del accidente / enfermedad
--                                    profesional.
--   * investigacion_adjuntos_urls → la investigación del accidente.
-- Ambas con DEFAULT '{}' (array vacío) e idempotentes (ADD COLUMN IF NOT
-- EXISTS) para poder re-correr la migración sin error.
--
-- ROLLBACK:
--   BEGIN;
--   ALTER TABLE public.incidentes DROP COLUMN IF EXISTS denuncia_adjuntos_urls;
--   ALTER TABLE public.incidentes DROP COLUMN IF EXISTS investigacion_adjuntos_urls;
--   COMMIT;
-- ============================================================

BEGIN;

ALTER TABLE public.incidentes
  ADD COLUMN IF NOT EXISTS denuncia_adjuntos_urls      text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS investigacion_adjuntos_urls text[] DEFAULT '{}';

COMMIT;
