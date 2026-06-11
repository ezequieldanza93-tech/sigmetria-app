-- ============================================================
-- PRUEBA Prompt 1 — Criterio: la verificación de la hash chain detecta una
-- alteración simulada.
--
-- Correr en staging/local tras aplicar la migración. Requiere privilegios de
-- superusuario SOLO para el paso de tampering (simula a alguien con acceso
-- directo a la DB intentando alterar la auditoría — escenario que la cadena
-- debe poder denunciar).
-- ============================================================

-- 1. Estado inicial de la cadena de la cadena global (consultora NULL → UUID cero)
--    y de alguna consultora real. Debe dar INTEGRA si nadie tocó nada.
SELECT * FROM public.fn_verify_audit_chain(NULL);  -- cadena global

-- Para una consultora concreta:
-- SELECT * FROM public.fn_verify_audit_chain('<consultora_id>'::uuid);

-- 2. Tomar el primer registro con hash de la cadena global y guardarlo.
DO $$
DECLARE
  v_id   uuid;
  v_seq  bigint;
  v_orig jsonb;
BEGIN
  SELECT id, seq, datos_nuevo INTO v_id, v_seq, v_orig
  FROM public.audit_log
  WHERE coalesce(consultora_id,'00000000-0000-0000-0000-000000000000') = '00000000-0000-0000-0000-000000000000'
    AND hash IS NOT NULL
  ORDER BY seq ASC
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'No hay eventos en la cadena global todavía. Generá uno (ej. un login) y reintentá.';
    RETURN;
  END IF;

  -- 3. ALTERACIÓN SIMULADA (como superusuario: bypasea REVOKE/RLS).
  --    Cambiamos el contenido SIN recomputar el hash → la cadena debe detectarlo.
  UPDATE public.audit_log
  SET datos_nuevo = jsonb_set(coalesce(v_orig,'{}'::jsonb), '{__tampered}', 'true')
  WHERE id = v_id;

  RAISE NOTICE 'Registro alterado a propósito: id=% seq=%', v_id, v_seq;
END;
$$;

-- 4. Re-verificar: ahora debe devolver estado = 'ALTERADA' apuntando al seq alterado.
SELECT * FROM public.fn_verify_audit_chain(NULL);

-- 5. (Opcional) Restaurar manualmente o restaurar la DB de prueba desde backup.
--    En un entorno de prueba descartable, simplemente recrealo.

-- Esperado:
--   * Paso 1: estado = 'INTEGRA'
--   * Paso 4: estado = 'ALTERADA', detalle = 'contenido alterado: hash recomputado ... != almacenado ...'
