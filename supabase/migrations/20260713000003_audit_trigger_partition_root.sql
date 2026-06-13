-- ============================================================
-- FIX: en tablas PARTICIONADAS (gestiones_registros), el trigger row-level dispara
-- sobre la partición y TG_TABLE_NAME es el nombre FÍSICO (ej. gestiones_registros_2026),
-- no el lógico. Eso parte el historial por año y rompe fn_audit_historial('gestiones_registros',…).
--
-- Solución: registrar el nombre de la tabla RAÍZ (pg_partition_root). Para tablas NO
-- particionadas pg_partition_root devuelve la propia tabla (o NULL → fallback a
-- TG_TABLE_NAME), así que el canónico/hash de las tablas ya auditadas NO cambia →
-- las cadenas existentes siguen íntegras.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_registro_id uuid;
  v_antes       jsonb;
  v_nuevo       jsonb;
  v_row         jsonb;
  v_cid         uuid;
  v_chain_key   uuid;
  v_created     timestamptz := now();
  v_trace       uuid;
  v_origen      text;
  v_email       text;
  v_prev_hash   text;
  v_seq         bigint;
  v_canon       text;
  v_hash        text;
  v_headers     json;
  v_tabla       text;
BEGIN
  -- Nombre lógico: si TG_RELID es una partición, usar la tabla raíz.
  v_tabla := COALESCE(
    (SELECT c.relname FROM pg_class c WHERE c.oid = pg_partition_root(TG_RELID)),
    TG_TABLE_NAME
  );

  IF TG_OP = 'INSERT' THEN
    v_registro_id := NEW.id; v_antes := NULL;          v_nuevo := to_jsonb(NEW); v_row := v_nuevo;
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := NEW.id; v_antes := to_jsonb(OLD); v_nuevo := to_jsonb(NEW); v_row := v_nuevo;
  ELSIF TG_OP = 'DELETE' THEN
    v_registro_id := OLD.id; v_antes := to_jsonb(OLD); v_nuevo := NULL;          v_row := v_antes;
  END IF;

  v_cid       := public.fn_resolve_consultora_id(v_row);
  v_chain_key := coalesce(v_cid, '00000000-0000-0000-0000-000000000000');

  BEGIN v_headers := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN OTHERS THEN v_headers := NULL; END;

  BEGIN
    v_trace := coalesce(
      nullif(v_headers ->> 'x-trace-id', ''),
      nullif(current_setting('sigmetria.trace_id', true), '')
    )::uuid;
  EXCEPTION WHEN OTHERS THEN v_trace := NULL; END;

  v_origen := coalesce(
    nullif(v_headers ->> 'x-audit-origen', ''),
    nullif(current_setting('sigmetria.origen', true), ''),
    'humano'
  );
  IF v_origen NOT IN ('humano','automatizado','sistema') THEN v_origen := 'humano'; END IF;

  BEGIN v_email := auth.jwt() ->> 'email'; EXCEPTION WHEN OTHERS THEN v_email := NULL; END;

  PERFORM pg_advisory_xact_lock(hashtext('audit_chain:' || v_chain_key::text));

  SELECT last_hash, last_seq INTO v_prev_hash, v_seq
  FROM public.audit_chain_state WHERE consultora_id = v_chain_key FOR UPDATE;

  IF NOT FOUND THEN
    v_prev_hash := 'GENESIS'; v_seq := 0;
  END IF;
  v_seq := v_seq + 1;

  v_canon := public.fn_audit_canonical(
    v_seq, v_tabla, TG_OP, v_registro_id, auth.uid(), v_cid,
    v_created, v_trace, v_origen, v_antes, v_nuevo
  );
  v_hash := encode(digest(coalesce(v_prev_hash,'GENESIS') || v_canon, 'sha256'), 'hex');

  INSERT INTO public.audit_log (
    tabla_nombre, accion, registro_id, user_id, consultora_id,
    datos_antes, datos_nuevo, created_at,
    actor_email, origen, trace_id, hash, hash_prev, seq
  ) VALUES (
    v_tabla, TG_OP, v_registro_id, auth.uid(), v_cid,
    v_antes, v_nuevo, v_created,
    v_email, v_origen, v_trace, v_hash, v_prev_hash, v_seq
  );

  INSERT INTO public.audit_chain_state (consultora_id, last_hash, last_seq, updated_at)
  VALUES (v_chain_key, v_hash, v_seq, now())
  ON CONFLICT (consultora_id)
  DO UPDATE SET last_hash = excluded.last_hash, last_seq = excluded.last_seq, updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;
