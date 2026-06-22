-- Botón "Seguir editando" para gestiones estándar: necesitamos distinguir un registro
-- guardado como BORRADOR ("Guardar y continuar luego") de uno recién planificado.
-- gestiones_registros no tenía cómo marcarlo (Realizado = fecha_ejecutada). Agregamos
-- estado nullable: 'borrador' = se guardó sin finalizar (NO marca Realizado, re-editable).
-- Al finalizar, ejecutarGestion setea fecha_ejecutada y deja estado en NULL.
-- (Los protocolos de medición ya tienen su propio `estado` borrador/finalizado.)

ALTER TABLE public.gestiones_registros
  ADD COLUMN IF NOT EXISTS estado text;
