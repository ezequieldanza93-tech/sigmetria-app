-- Activa el wizard de medición para la gestión "Protocolo de Ruido".
-- El valor 'medicion_ruido' ya está permitido por el CHECK de
-- gestiones.tipo_ejecucion (ver 20260623000001_medicion_ruido.sql).
-- En la agenda, ge_tipo_ejecucion se lee por JOIN a gestiones (lib/queries/agenda.ts),
-- así que este UPDATE activa el botón "Ejecutar" (wizard) para todas las
-- instancias planificadas de esta gestión, existentes y nuevas.
-- El nombre 'Protocolo de Ruido' matchea exactamente 1 fila del catálogo.
UPDATE public.gestiones
SET tipo_ejecucion = 'medicion_ruido'
WHERE nombre = 'Protocolo de Ruido';
