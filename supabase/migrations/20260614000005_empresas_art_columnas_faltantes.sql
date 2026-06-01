-- ============================================================
-- Columnas ART faltantes en `empresas`
-- ============================================================
--
-- QUÉ HACE:
-- Agrega `art` y `art_numero_contrato` a la tabla `empresas`. El código
-- (lib/actions/empresa.ts, components/forms/empresa-form.tsx, tipos) ya las
-- espera, pero no estaban en esta base (la migración 20260517000004 que las
-- definía se aplicó de forma parcial). Sin esto, crear/editar empresa falla:
-- "Could not find the 'art_numero_contrato' column of 'empresas'".
--
-- Idempotente (ADD COLUMN IF NOT EXISTS): las otras 4 columnas de aquella
-- migración (tipo_identidad_impositiva, logo_small_url, logo_destacado_url,
-- informacion_general) ya existen y no se tocan.
--
-- ROLLBACK:
--   ALTER TABLE public.empresas
--     DROP COLUMN IF EXISTS art,
--     DROP COLUMN IF EXISTS art_numero_contrato;
-- ============================================================

BEGIN;

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS art                 text,
  ADD COLUMN IF NOT EXISTS art_numero_contrato text;

COMMIT;
