-- ============================================================
-- Sigmetría HyS — Add tiene_entregable + fecha_vencimiento
--
-- 1. gestiones.tiene_entregable: flag para identificar qué
--    gestiones producen un documento/certificado con vencimiento
--    (ej: Protocolos, Mediciones, Certificaciones, Permisos)
--
-- 2. gestiones_registros.fecha_vencimiento: fecha de vencimiento
--    del entregable, se setea al ejecutar la gestión.
--    Solo aplica cuando la gestión tiene tiene_entregable = true.
--
-- ROLLBACK:
--   ALTER TABLE public.gestiones DROP COLUMN IF EXISTS tiene_entregable;
--   ALTER TABLE public.gestiones_registros DROP COLUMN IF EXISTS fecha_vencimiento;
-- ============================================================

ALTER TABLE public.gestiones
  ADD COLUMN IF NOT EXISTS tiene_entregable boolean NOT NULL DEFAULT false;

ALTER TABLE public.gestiones_registros
  ADD COLUMN IF NOT EXISTS fecha_vencimiento date;

CREATE INDEX IF NOT EXISTS idx_gestiones_registros_vencimiento
  ON public.gestiones_registros (fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

COMMENT ON COLUMN public.gestiones.tiene_entregable IS
  'TRUE si esta gestión genera un entregable con fecha de vencimiento (ej: protocolos, certificaciones)';

COMMENT ON COLUMN public.gestiones_registros.fecha_vencimiento IS
  'Fecha de vencimiento del entregable. Se setea al ejecutar la gestión cuando tiene_entregable = true';
