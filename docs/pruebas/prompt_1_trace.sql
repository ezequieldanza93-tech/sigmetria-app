-- ============================================================
-- PRUEBA Prompt 1 — Criterio: al editar una observación quedan registrados
--   (a) el evento de auditoría del cambio,
--   (b) el estado anterior preservado (datos_antes),
--   (c) el trace_id correcto.
--
-- No destructivo: corre dentro de una transacción que se hace ROLLBACK.
-- Correr en staging/local tras aplicar la migración (psql / SQL Editor).
-- ============================================================

BEGIN;

-- Simular el contexto que la app envía por headers (fallback GUC para psql).
SELECT set_config('sigmetria.trace_id', '44444444-4444-4444-4444-444444444444', true);
SELECT set_config('sigmetria.origen',  'humano', true);

-- Tomar una observación existente.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.observaciones_gestiones LIMIT 1;
  IF v_id IS NULL THEN
    RAISE NOTICE 'No hay observaciones_gestiones para probar; insertá una de prueba primero.';
  ELSE
    -- Editar un campo cualquiera para disparar el trigger de auditoría.
    UPDATE public.observaciones_gestiones
    SET updated_at = now()
    WHERE id = v_id;
    RAISE NOTICE 'Observación editada: %', v_id;
  END IF;
END;
$$;

-- Verificar el registro de auditoría recién generado.
SELECT
  seq,
  accion,
  tabla_nombre,
  registro_id,
  origen,
  trace_id,
  actor_email,
  (datos_antes IS NOT NULL) AS preserva_estado_anterior,
  (datos_nuevo IS NOT NULL) AS tiene_estado_nuevo,
  left(hash, 12) || '…' AS hash,
  left(hash_prev, 12) || '…' AS hash_prev
FROM public.audit_log
WHERE tabla_nombre = 'observaciones_gestiones'
ORDER BY created_at DESC, seq DESC
LIMIT 1;

-- Reconstrucción del flujo por trace_id (debe incluir el evento de arriba).
SELECT seq, accion, tabla_nombre, registro_id, origen
FROM public.fn_audit_por_trace('44444444-4444-4444-4444-444444444444');

ROLLBACK;  -- no persiste el cambio de prueba

-- Esperado:
--   * preserva_estado_anterior = true
--   * trace_id = 44444444-4444-4444-4444-444444444444
--   * origen = 'humano'
--   * hash y hash_prev no nulos
