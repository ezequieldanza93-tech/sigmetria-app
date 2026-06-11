-- ============================================================
-- Sigmetría HyS — Trazabilidad y cadena de custodia (Art. 4.2 Res. SRT 48/2025)
-- Extiende el audit_log existente (particionado, inmutable) con:
--   1. Columnas: actor_email, origen, trace_id, hash, hash_prev, seq
--   2. accion ampliada a eventos no-CRUD (ACCESO/EXPORT/LOGIN/GENERAR_REPORTE/QR_ACCESS)
--   3. audit_chain_state: cabeza de cadena por consultora (hash chain)
--   4. fn_audit_trigger reescrita: resuelve consultora_id + computa hash encadenado
--   5. fn_resolve_consultora_id: helper de resolución de tenant
--   6. log_audit_event(): RPC para eventos de acceso (best-effort desde la app)
--   7. fn_verify_audit_chain(): verificación de integridad (detección de alteración)
--   8. Vistas/funciones forenses: por entidad y por trace_id
--   9. Cobertura: triggers en tablas críticas faltantes (defensivo: solo si existen)
--
-- IMPORTANTE (D1/D3 docs/decisiones.md):
--   * Migración ADITIVA. No borra datos. No modifica migraciones aplicadas.
--   * NO aplicada a producción en la corrida autónoma: aplicar primero en staging/local,
--     correr docs/pruebas/prompt_1_*.sql, y recién entonces a prod.
--   * La reescritura de fn_audit_trigger es SECURITY DEFINER y serializa por consultora:
--     si fallara, la transacción de negocio rollbackea (estrategia "bloquear" para CRUD).
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 1. Columnas nuevas en audit_log (propagan a todas las particiones)
-- ============================================================
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS actor_email text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS origen       text NOT NULL DEFAULT 'humano';
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS trace_id     uuid;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS hash         text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS hash_prev    text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS seq          bigint;

-- origen acotado
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_origen_check;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_origen_check
  CHECK (origen IN ('humano','automatizado','sistema'));

-- accion ampliada a eventos no-CRUD.
-- OJO: el CHECK del audit_log particionado quedó con un nombre autogenerado que NO siempre
-- es 'audit_log_accion_check' (en la práctica es 'audit_log_accion_check1'). Un simple
-- DROP CONSTRAINT IF EXISTS audit_log_accion_check NO lo elimina, y el check viejo
-- (solo INSERT/UPDATE/DELETE) sigue rechazando los eventos de acceso. Verificado EN VIVO.
-- Solución: eliminar dinámicamente CUALQUIER check sobre 'accion' del padre (cascadea a las
-- particiones) y agregar el nuevo. Idempotente (re-ejecutable).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid = 'public.audit_log'::regclass
      AND pg_get_constraintdef(c.oid) ILIKE '%accion%'
  LOOP
    EXECUTE format('ALTER TABLE public.audit_log DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_accion_check
  CHECK (accion IN (
    'INSERT','UPDATE','DELETE',
    'ACCESO','EXPORT','LOGIN','GENERAR_REPORTE','QR_ACCESS'
  ));

-- índices para consulta forense
CREATE INDEX IF NOT EXISTS idx_audit_log_trace_id
  ON public.audit_log (trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_accion
  ON public.audit_log (accion);

-- ── Inmutabilidad a nivel PRIVILEGIO de tabla (no solo RLS) ──────────
-- Revoca escritura/borrado para TODOS los roles, incluido el rol de la app
-- (authenticated) y el service_role. Así un UPDATE/DELETE directo FALLA con
-- "permission denied", no es un simple no-op de RLS.
-- El trigger fn_audit_trigger y el RPC log_audit_event son SECURITY DEFINER:
-- corren como el owner de la función (postgres) y conservan el privilegio de
-- INSERT — el único camino de escritura permitido.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM service_role;
GRANT SELECT ON public.audit_log TO authenticated, service_role;

COMMENT ON COLUMN public.audit_log.actor_email IS 'Snapshot del email del actor (auth.jwt email claim) al momento del evento.';
COMMENT ON COLUMN public.audit_log.origen      IS 'humano | automatizado | sistema — origen de la intervención.';
COMMENT ON COLUMN public.audit_log.trace_id    IS 'Correlaciona un flujo de negocio multi-tabla (ej. una recorrida completa).';
COMMENT ON COLUMN public.audit_log.hash        IS 'SHA-256 encadenado: sha256(hash_prev || payload_canonico). Cadena de custodia.';
COMMENT ON COLUMN public.audit_log.hash_prev   IS 'Hash del registro anterior en la misma cadena (por consultora).';
COMMENT ON COLUMN public.audit_log.seq         IS 'Posición secuencial dentro de la cadena de la consultora.';

-- ============================================================
-- 2. Cabeza de cadena por consultora (hash chain state)
--    consultora_id NOT NULL: la cadena "global" (eventos sin consultora)
--    usa el UUID cero como sentinela para que ON CONFLICT funcione.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_chain_state (
  consultora_id uuid        PRIMARY KEY,
  last_hash     text        NOT NULL,
  last_seq      bigint      NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_chain_state ENABLE ROW LEVEL SECURITY;

-- Lectura: developer + admins/responsable de la consultora (para verificar la cadena).
-- Escritura: solo vía funciones SECURITY DEFINER (nadie directo).
DROP POLICY IF EXISTS "audit_chain_state: select" ON public.audit_chain_state;
CREATE POLICY "audit_chain_state: select"
  ON public.audit_chain_state FOR SELECT TO authenticated
  USING (
    public.is_developer()
    OR consultora_id = (
      SELECT cm.consultora_id FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
        AND cm.role::text IN ('full_access_main','full_access_branch','responsable_estandares','auditor_externo')
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "audit_chain_state: insert" ON public.audit_chain_state;
CREATE POLICY "audit_chain_state: insert" ON public.audit_chain_state FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "audit_chain_state: update" ON public.audit_chain_state;
CREATE POLICY "audit_chain_state: update" ON public.audit_chain_state FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "audit_chain_state: delete" ON public.audit_chain_state;
CREATE POLICY "audit_chain_state: delete" ON public.audit_chain_state FOR DELETE TO authenticated USING (false);

-- UUID cero = cadena global (eventos sin consultora asociada)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.audit_chain_state WHERE consultora_id = '00000000-0000-0000-0000-000000000000') THEN
    INSERT INTO public.audit_chain_state (consultora_id, last_hash, last_seq)
    VALUES ('00000000-0000-0000-0000-000000000000', 'GENESIS', 0);
  END IF;
END;
$$;

-- ============================================================
-- 3. Helper: resolución de consultora_id desde la fila auditada
--    Resuelve por columna directa consultora_id, o empresa_id, o establecimiento_id.
--    Para tablas sin ninguna de esas, devuelve NULL (visible solo a developer/dueño).
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_resolve_consultora_id(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cid uuid;
  v_eid uuid;
  v_est uuid;
BEGIN
  IF p_row ? 'consultora_id' AND p_row->>'consultora_id' IS NOT NULL THEN
    RETURN (p_row->>'consultora_id')::uuid;
  END IF;

  IF p_row ? 'empresa_id' AND p_row->>'empresa_id' IS NOT NULL THEN
    v_eid := (p_row->>'empresa_id')::uuid;
    SELECT consultora_id INTO v_cid FROM public.empresas WHERE id = v_eid;
    RETURN v_cid;
  END IF;

  IF p_row ? 'establecimiento_id' AND p_row->>'establecimiento_id' IS NOT NULL THEN
    v_est := (p_row->>'establecimiento_id')::uuid;
    SELECT e.consultora_id INTO v_cid
    FROM public.establecimientos est
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE est.id = v_est;
    RETURN v_cid;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================
-- 4. Payload canónico + hash (replicado en TS en lib/audit/hash-chain.ts)
--    Formato fijo, pipe-delimitado, para paridad determinística TS↔SQL.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_canonical(
  p_seq bigint, p_tabla text, p_accion text, p_registro_id uuid,
  p_user_id uuid, p_consultora_id uuid, p_created_at timestamptz,
  p_trace_id uuid, p_origen text, p_antes jsonb, p_nuevo jsonb
) RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT
    p_seq::text || '|' ||
    coalesce(p_tabla,'') || '|' ||
    coalesce(p_accion,'') || '|' ||
    coalesce(p_registro_id::text,'') || '|' ||
    coalesce(p_user_id::text,'') || '|' ||
    coalesce(p_consultora_id::text,'') || '|' ||
    to_char(p_created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
    coalesce(p_trace_id::text,'') || '|' ||
    coalesce(p_origen,'') || '|' ||
    coalesce(p_antes::text,'') || '|' ||
    coalesce(p_nuevo::text,'');
$$;

-- ============================================================
-- 5. fn_audit_trigger reescrita: igual que antes + consultora_id + hash chain
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
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_registro_id := NEW.id; v_antes := NULL;          v_nuevo := to_jsonb(NEW); v_row := v_nuevo;
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := NEW.id; v_antes := to_jsonb(OLD); v_nuevo := to_jsonb(NEW); v_row := v_nuevo;
  ELSIF TG_OP = 'DELETE' THEN
    v_registro_id := OLD.id; v_antes := to_jsonb(OLD); v_nuevo := NULL;          v_row := v_antes;
  END IF;

  v_cid       := public.fn_resolve_consultora_id(v_row);
  v_chain_key := coalesce(v_cid, '00000000-0000-0000-0000-000000000000');

  -- contexto del request. Con PostgREST cada request es su propia transacción:
  -- request.headers SÍ está disponible dentro de la transacción del trigger.
  -- La app setea x-trace-id / x-audit-origen como headers globales del cliente Supabase
  -- (ver lib/audit/trace.ts). Fallback a GUC sigmetria.* para flujos que corran en RPC.
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

  -- serializar la cadena de ESTA consultora (no bloquea otras consultoras)
  PERFORM pg_advisory_xact_lock(hashtext('audit_chain:' || v_chain_key::text));

  SELECT last_hash, last_seq INTO v_prev_hash, v_seq
  FROM public.audit_chain_state WHERE consultora_id = v_chain_key FOR UPDATE;

  IF NOT FOUND THEN
    v_prev_hash := 'GENESIS'; v_seq := 0;
  END IF;
  v_seq := v_seq + 1;

  v_canon := public.fn_audit_canonical(
    v_seq, TG_TABLE_NAME, TG_OP, v_registro_id, auth.uid(), v_cid,
    v_created, v_trace, v_origen, v_antes, v_nuevo
  );
  v_hash := encode(digest(coalesce(v_prev_hash,'GENESIS') || v_canon, 'sha256'), 'hex');

  INSERT INTO public.audit_log (
    tabla_nombre, accion, registro_id, user_id, consultora_id,
    datos_antes, datos_nuevo, created_at,
    actor_email, origen, trace_id, hash, hash_prev, seq
  ) VALUES (
    TG_TABLE_NAME, TG_OP, v_registro_id, auth.uid(), v_cid,
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

-- ============================================================
-- 6. RPC para eventos de acceso (login, export, qr, reporte).
--    Best-effort desde la app (D3): si esto lanza, el caller NO debe romper la
--    operación principal — debe capturar el error y loguearlo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_accion        text,
  p_tabla         text,
  p_registro_id   uuid,
  p_consultora_id uuid    DEFAULT NULL,
  p_meta          jsonb   DEFAULT NULL,
  p_trace_id      uuid    DEFAULT NULL,
  p_origen        text    DEFAULT 'humano'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_chain_key uuid := coalesce(p_consultora_id, '00000000-0000-0000-0000-000000000000');
  v_created   timestamptz := now();
  v_origen    text := coalesce(p_origen,'humano');
  v_email     text;
  v_prev_hash text;
  v_seq       bigint;
  v_canon     text;
  v_hash      text;
  v_id        uuid;
BEGIN
  IF p_accion NOT IN ('ACCESO','EXPORT','LOGIN','GENERAR_REPORTE','QR_ACCESS') THEN
    RAISE EXCEPTION 'log_audit_event: accion no permitida para eventos: %', p_accion;
  END IF;
  IF v_origen NOT IN ('humano','automatizado','sistema') THEN v_origen := 'humano'; END IF;

  BEGIN v_email := auth.jwt() ->> 'email'; EXCEPTION WHEN OTHERS THEN v_email := NULL; END;

  PERFORM pg_advisory_xact_lock(hashtext('audit_chain:' || v_chain_key::text));

  SELECT last_hash, last_seq INTO v_prev_hash, v_seq
  FROM public.audit_chain_state WHERE consultora_id = v_chain_key FOR UPDATE;
  IF NOT FOUND THEN v_prev_hash := 'GENESIS'; v_seq := 0; END IF;
  v_seq := v_seq + 1;

  v_canon := public.fn_audit_canonical(
    v_seq, p_tabla, p_accion, p_registro_id, auth.uid(), p_consultora_id,
    v_created, p_trace_id, v_origen, NULL, p_meta
  );
  v_hash := encode(digest(coalesce(v_prev_hash,'GENESIS') || v_canon, 'sha256'), 'hex');

  INSERT INTO public.audit_log (
    tabla_nombre, accion, registro_id, user_id, consultora_id,
    datos_antes, datos_nuevo, created_at,
    actor_email, origen, trace_id, hash, hash_prev, seq
  ) VALUES (
    p_tabla, p_accion, p_registro_id, auth.uid(), p_consultora_id,
    NULL, p_meta, v_created,
    v_email, v_origen, p_trace_id, v_hash, v_prev_hash, v_seq
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_chain_state (consultora_id, last_hash, last_seq, updated_at)
  VALUES (v_chain_key, v_hash, v_seq, now())
  ON CONFLICT (consultora_id)
  DO UPDATE SET last_hash = excluded.last_hash, last_seq = excluded.last_seq, updated_at = now();

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(text,text,uuid,uuid,jsonb,uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text,text,uuid,uuid,jsonb,uuid,text) TO authenticated, service_role;

-- ============================================================
-- 7. Verificación de la cadena (detección de alteración)
--    Recorre la cadena de una consultora ordenada por seq, recomputa cada hash
--    y verifica el encadenado. Devuelve la primera fila inconsistente, o ninguna
--    si la cadena está íntegra.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_verify_audit_chain(p_consultora_id uuid)
RETURNS TABLE (
  estado        text,
  primer_fallo_id uuid,
  primer_fallo_seq bigint,
  detalle       text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_chain_key uuid := coalesce(p_consultora_id, '00000000-0000-0000-0000-000000000000');
  r           record;
  v_prev      text := 'GENESIS';
  v_canon     text;
  v_calc      text;
BEGIN
  FOR r IN
    SELECT id, seq, tabla_nombre, accion, registro_id, user_id, consultora_id,
           created_at, trace_id, origen, datos_antes, datos_nuevo, hash, hash_prev
    FROM public.audit_log
    WHERE coalesce(consultora_id,'00000000-0000-0000-0000-000000000000') = v_chain_key
      AND hash IS NOT NULL
    ORDER BY seq ASC
  LOOP
    IF r.hash_prev IS DISTINCT FROM v_prev THEN
      estado := 'ALTERADA'; primer_fallo_id := r.id; primer_fallo_seq := r.seq;
      detalle := format('hash_prev no coincide con el hash del registro anterior (esperado %s, almacenado %s)', v_prev, r.hash_prev);
      RETURN NEXT; RETURN;
    END IF;

    v_canon := public.fn_audit_canonical(
      r.seq, r.tabla_nombre, r.accion, r.registro_id, r.user_id, r.consultora_id,
      r.created_at, r.trace_id, r.origen, r.datos_antes, r.datos_nuevo
    );
    v_calc := encode(digest(coalesce(r.hash_prev,'GENESIS') || v_canon, 'sha256'), 'hex');

    IF v_calc IS DISTINCT FROM r.hash THEN
      estado := 'ALTERADA'; primer_fallo_id := r.id; primer_fallo_seq := r.seq;
      detalle := format('contenido alterado: hash recomputado (%s) != almacenado (%s)', v_calc, r.hash);
      RETURN NEXT; RETURN;
    END IF;

    v_prev := r.hash;
  END LOOP;

  estado := 'INTEGRA'; primer_fallo_id := NULL; primer_fallo_seq := NULL;
  detalle := 'La cadena de custodia está íntegra.';
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_verify_audit_chain(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_verify_audit_chain(uuid) TO authenticated, service_role;

-- ============================================================
-- 8. Vistas/funciones forenses (reconstrucción cronológica)
--    Respetan RLS de audit_log porque son security invoker (default).
-- ============================================================
CREATE OR REPLACE VIEW public.audit_trail AS
  SELECT
    al.id, al.created_at, al.seq, al.trace_id, al.origen,
    al.accion, al.tabla_nombre, al.registro_id,
    al.user_id, al.actor_email, al.consultora_id,
    al.datos_antes, al.datos_nuevo, al.hash, al.hash_prev
  FROM public.audit_log al;

COMMENT ON VIEW public.audit_trail IS 'Vista forense del audit_log (hereda RLS). Ordenar por created_at/seq.';

-- Historial completo de una entidad
CREATE OR REPLACE FUNCTION public.fn_audit_historial(p_tabla text, p_registro_id uuid)
RETURNS SETOF public.audit_trail
LANGUAGE sql STABLE
AS $$
  SELECT * FROM public.audit_trail
  WHERE tabla_nombre = p_tabla AND registro_id = p_registro_id
  ORDER BY created_at ASC, seq ASC;
$$;

-- Reconstrucción completa de un flujo por trace_id
CREATE OR REPLACE FUNCTION public.fn_audit_por_trace(p_trace_id uuid)
RETURNS SETOF public.audit_trail
LANGUAGE sql STABLE
AS $$
  SELECT * FROM public.audit_trail
  WHERE trace_id = p_trace_id
  ORDER BY created_at ASC, seq ASC;
$$;

-- ============================================================
-- 9. Cobertura: triggers en tablas críticas faltantes.
--    Defensivo: crea el trigger solo si la tabla existe y tiene columna id (uuid).
--    Las ya cubiertas (incidentes/siniestros, inspecciones, capacitaciones,
--    capacitaciones_asistentes, riesgos, mediciones) se re-aseguran idempotentes.
-- ============================================================
DO $$
DECLARE
  t       text;
  tablas  text[] := ARRAY[
    -- ya auditadas (re-asegurar)
    'inspecciones','capacitaciones','capacitaciones_asistentes','riesgos','mediciones',
    'incidentes','siniestros',
    -- nuevas (núcleo de negocio + tenant + accesos)
    'empresas','establecimientos','establecimiento_documentos','empresa_documentos',
    'documentos','observaciones_gestiones','registro_gestiones','denuncias',
    'directorio_personas','formulario_respuestas','user_access',
    'consultoras_members','consultora_members'
  ];
  has_id  boolean;
  rel_ok  boolean;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    ) INTO rel_ok;

    IF NOT rel_ok THEN
      RAISE NOTICE 'audit cobertura: tabla % no existe — skip', t;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='id'
    ) INTO has_id;

    IF NOT has_id THEN
      RAISE NOTICE 'audit cobertura: tabla % sin columna id — skip (PK compuesta no soportada por fn_audit_trigger)', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$I ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_%1$I AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger()',
      t
    );
    RAISE NOTICE 'audit cobertura: trigger creado en %', t;
  END LOOP;
END;
$$;

COMMIT;
