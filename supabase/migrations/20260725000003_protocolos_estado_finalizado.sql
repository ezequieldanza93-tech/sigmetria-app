-- ════════════════════════════════════════════════════════════════════════════
-- Protocolos / mediciones: normalización del ciclo de vida del campo `estado`.
--
-- Propósito:
--   Unificar los estados de los protocolos a un par binario simple:
--     'borrador'   → en edición, todavía no emitido.
--     'finalizado' → cerrado / emitido (antes se usaba 'completado').
--
--   1) Migra los registros existentes: 'completado' → 'finalizado'
--      (hoy hay ~26 registros en 'completado' entre las 6 tablas).
--   2) Acota el dominio del campo con un CHECK (estado IN ('borrador','finalizado'))
--      en las 6 tablas de protocolo/medición.
--
--   La columna `estado` ya existe (text, default 'borrador') en las 6 tablas, así
--   que acá NO se crea ni se altera el tipo/default. Tampoco se agrega pdf_url:
--   la evidencia del protocolo vive en gestiones_registros.evidencia_url.
--
--   Idempotente: el UPDATE solo toca filas en 'completado'; los CHECK se recrean
--   con DROP CONSTRAINT IF EXISTS antes del ADD CONSTRAINT.
--
-- Tablas afectadas:
--   medicion_iluminacion, medicion_ruido, medicion_pat,
--   medicion_carga_termica, calculo_carga_fuego, ergonomia_evaluaciones
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Migración de datos: 'completado' → 'finalizado'
UPDATE public.medicion_iluminacion   SET estado = 'finalizado' WHERE estado = 'completado';
UPDATE public.medicion_ruido         SET estado = 'finalizado' WHERE estado = 'completado';
UPDATE public.medicion_pat           SET estado = 'finalizado' WHERE estado = 'completado';
UPDATE public.medicion_carga_termica SET estado = 'finalizado' WHERE estado = 'completado';
UPDATE public.calculo_carga_fuego    SET estado = 'finalizado' WHERE estado = 'completado';
UPDATE public.ergonomia_evaluaciones SET estado = 'finalizado' WHERE estado = 'completado';

-- 2) CHECK del dominio del estado (idempotente: drop-then-add)
ALTER TABLE public.medicion_iluminacion
  DROP CONSTRAINT IF EXISTS medicion_iluminacion_estado_check;
ALTER TABLE public.medicion_iluminacion
  ADD CONSTRAINT medicion_iluminacion_estado_check
  CHECK (estado IN ('borrador', 'finalizado'));

ALTER TABLE public.medicion_ruido
  DROP CONSTRAINT IF EXISTS medicion_ruido_estado_check;
ALTER TABLE public.medicion_ruido
  ADD CONSTRAINT medicion_ruido_estado_check
  CHECK (estado IN ('borrador', 'finalizado'));

ALTER TABLE public.medicion_pat
  DROP CONSTRAINT IF EXISTS medicion_pat_estado_check;
ALTER TABLE public.medicion_pat
  ADD CONSTRAINT medicion_pat_estado_check
  CHECK (estado IN ('borrador', 'finalizado'));

ALTER TABLE public.medicion_carga_termica
  DROP CONSTRAINT IF EXISTS medicion_carga_termica_estado_check;
ALTER TABLE public.medicion_carga_termica
  ADD CONSTRAINT medicion_carga_termica_estado_check
  CHECK (estado IN ('borrador', 'finalizado'));

ALTER TABLE public.calculo_carga_fuego
  DROP CONSTRAINT IF EXISTS calculo_carga_fuego_estado_check;
ALTER TABLE public.calculo_carga_fuego
  ADD CONSTRAINT calculo_carga_fuego_estado_check
  CHECK (estado IN ('borrador', 'finalizado'));

ALTER TABLE public.ergonomia_evaluaciones
  DROP CONSTRAINT IF EXISTS ergonomia_evaluaciones_estado_check;
ALTER TABLE public.ergonomia_evaluaciones
  ADD CONSTRAINT ergonomia_evaluaciones_estado_check
  CHECK (estado IN ('borrador', 'finalizado'));
