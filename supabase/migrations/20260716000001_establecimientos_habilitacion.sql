-- ============================================================
-- Habilitación del establecimiento (flag declarado)
-- ============================================================
-- Por qué: varios requisitos legales (p.ej. el Sistema de Autoprotección de
-- CABA, Ley 5920) solo aplican a establecimientos QUE CUENTAN CON HABILITACIÓN.
-- Hoy el modelo no tiene forma de saber si un establecimiento está habilitado.
-- Se agrega un flag declarado simple (+ nro y fecha opcionales) a nivel
-- establecimiento, suficiente para gatillar la aplicabilidad. Los datos
-- detallados de la habilitación (plancheta/QR/en trámite/exenta) viven dentro
-- del propio trámite que los necesite.
--
-- Decisión (ver engram features/sistema-autoproteccion-caba/alcance): flag
-- declarado, NO entidad completa.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE public.establecimientos
  ADD COLUMN IF NOT EXISTS tiene_habilitacion boolean NOT NULL DEFAULT false;
ALTER TABLE public.establecimientos
  ADD COLUMN IF NOT EXISTS habilitacion_numero text;
ALTER TABLE public.establecimientos
  ADD COLUMN IF NOT EXISTS habilitacion_fecha date;

COMMENT ON COLUMN public.establecimientos.tiene_habilitacion IS
  'Declaración simple: el establecimiento cuenta con habilitación comercial/municipal. Gatilla aplicabilidad de requisitos que la exigen (ej. SAP Ley 5920 CABA).';
COMMENT ON COLUMN public.establecimientos.habilitacion_numero IS 'Nro de habilitación (opcional, declarado).';
COMMENT ON COLUMN public.establecimientos.habilitacion_fecha IS 'Fecha de habilitación (opcional, declarada).';
