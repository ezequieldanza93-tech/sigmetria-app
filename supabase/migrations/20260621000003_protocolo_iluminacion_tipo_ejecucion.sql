-- Activa el wizard de medición para la gestión "Protocolo de Iluminación".
-- El valor 'medicion_iluminacion' ya está permitido por el CHECK de
-- gestiones.tipo_ejecucion (ver 20260621000001_medicion_iluminacion.sql).
-- En la agenda, ge_tipo_ejecucion se lee por JOIN a gestiones (lib/queries/agenda.ts),
-- así que este UPDATE activa el botón "Ejecutar" (wizard) para todas las
-- instancias planificadas de esta gestión, existentes y nuevas.
UPDATE public.gestiones
SET tipo_ejecucion = 'medicion_iluminacion'
WHERE id = '8eef6646-74c9-476b-81b2-7a2b307b509f';
