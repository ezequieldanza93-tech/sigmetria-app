-- 20260803000001_consultoras_contrato_defaults.sql
-- Agrega columnas de defaults para el formulario de contratos a la tabla consultoras.
-- Cada columna es nullable; si es NULL, el formulario se muestra vacío (el usuario lo completa manualmente).
-- Si tiene valor, el formulario de contrato lo precarga (editable).

ALTER TABLE public.consultoras
  ADD COLUMN IF NOT EXISTS contrato_plazo_respuesta_default               text,
  ADD COLUMN IF NOT EXISTS contrato_honorarios_plazo_pago_dias_default    text,
  ADD COLUMN IF NOT EXISTS contrato_honorarios_medio_pago_default         text,
  ADD COLUMN IF NOT EXISTS contrato_actualizacion_periodicidad_default    text,
  ADD COLUMN IF NOT EXISTS contrato_actualizacion_indice_default          text,
  ADD COLUMN IF NOT EXISTS contrato_dias_no_renovacion_default            text,
  ADD COLUMN IF NOT EXISTS contrato_responsable_caracter_default          text,
  ADD COLUMN IF NOT EXISTS contrato_responsable_matricula_emisor_default  text,
  ADD COLUMN IF NOT EXISTS contrato_suma_asegurada_rc_default             text,
  ADD COLUMN IF NOT EXISTS contrato_jurisdiccion_default                  text,
  ADD COLUMN IF NOT EXISTS contrato_responsable_dni_default               text;

COMMENT ON TABLE public.consultoras IS 'Consultora (tenant). Los campos contrato_*_default son valores precargados en el formulario de contratos para no tener que tipearlos cada vez.';
COMMENT ON COLUMN public.consultoras.contrato_plazo_respuesta_default               IS 'Default para "Plazo de respuesta" ej: "48 horas hábiles"';
COMMENT ON COLUMN public.consultoras.contrato_honorarios_plazo_pago_dias_default    IS 'Default para "Plazo de pago en días" ej: "10"';
COMMENT ON COLUMN public.consultoras.contrato_honorarios_medio_pago_default         IS 'Default para "Medio de pago" ej: "transferencia bancaria"';
COMMENT ON COLUMN public.consultoras.contrato_actualizacion_periodicidad_default    IS 'Default para "Periodicidad de actualización" ej: "trimestral"';
COMMENT ON COLUMN public.consultoras.contrato_actualizacion_indice_default          IS 'Default para "Índice de actualización" ej: "IPC INDEC"';
COMMENT ON COLUMN public.consultoras.contrato_dias_no_renovacion_default            IS 'Default para "Días de preaviso de no renovación" ej: "30"';
COMMENT ON COLUMN public.consultoras.contrato_responsable_caracter_default          IS 'Default para "Carácter del responsable técnico" ej: "Titular"';
COMMENT ON COLUMN public.consultoras.contrato_responsable_matricula_emisor_default  IS 'Default para "Emisor de la matrícula del responsable"';
COMMENT ON COLUMN public.consultoras.contrato_suma_asegurada_rc_default             IS 'Default para "Suma asegurada RC" ej: "$ 10.000.000"';
COMMENT ON COLUMN public.consultoras.contrato_jurisdiccion_default                  IS 'Default para "Jurisdicción" ej: "Tribunales Ordinarios de la Ciudad de Córdoba"';
COMMENT ON COLUMN public.consultoras.contrato_responsable_dni_default               IS 'Default para "DNI del responsable técnico"';
