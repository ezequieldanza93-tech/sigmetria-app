-- ============================================================
-- Firma de protocolos — extiende el enum firma_entidad_tipo
-- ============================================================
-- Agrega los tipos de entidad de los protocolos de medición/cálculo
-- al enum polimórfico de firmas. ADD VALUE no puede correr dentro de
-- una transacción, por eso NO se envuelve en BEGIN/COMMIT.

ALTER TYPE public.firma_entidad_tipo ADD VALUE IF NOT EXISTS 'medicion_pat';
ALTER TYPE public.firma_entidad_tipo ADD VALUE IF NOT EXISTS 'medicion_iluminacion';
ALTER TYPE public.firma_entidad_tipo ADD VALUE IF NOT EXISTS 'medicion_ruido';
ALTER TYPE public.firma_entidad_tipo ADD VALUE IF NOT EXISTS 'medicion_carga_termica';
ALTER TYPE public.firma_entidad_tipo ADD VALUE IF NOT EXISTS 'calculo_carga_fuego';
