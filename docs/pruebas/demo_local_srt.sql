-- ============================================================
-- DEMO LOCAL — Prueba EN VIVO de los 3 criterios del Prompt 1 contra Supabase local.
-- Self-contained: siembra sus propios datos, no depende de seed.
-- Correr: docker exec -i supabase_db_<proj> psql -U postgres -d postgres < este_archivo
-- ============================================================
\set ON_ERROR_STOP off

\echo ''
\echo '========================================================'
\echo ' 1) INMUTABILIDAD — UPDATE/DELETE/INSERT como rol de la app deben FALLAR'
\echo '========================================================'
SET ROLE authenticated;
DO $$ BEGIN
  UPDATE public.audit_log SET datos_nuevo = '{"hack":true}'::jsonb WHERE true;
  RAISE NOTICE 'UPDATE: ✗ FALLO DE SEGURIDAD (se permitió)';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'UPDATE: ✓ bloqueado (permission denied)';
         WHEN OTHERS THEN RAISE NOTICE 'UPDATE: ✓ bloqueado (%)', SQLERRM; END $$;
DO $$ BEGIN
  DELETE FROM public.audit_log WHERE true;
  RAISE NOTICE 'DELETE: ✗ FALLO DE SEGURIDAD (se permitió)';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'DELETE: ✓ bloqueado (permission denied)';
         WHEN OTHERS THEN RAISE NOTICE 'DELETE: ✓ bloqueado (%)', SQLERRM; END $$;
DO $$ BEGIN
  INSERT INTO public.audit_log (tabla_nombre, accion, registro_id) VALUES ('hack','INSERT', gen_random_uuid());
  RAISE NOTICE 'INSERT directo: ✗ FALLO DE SEGURIDAD (se permitió)';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'INSERT directo: ✓ bloqueado (permission denied)';
         WHEN OTHERS THEN RAISE NOTICE 'INSERT directo: ✓ bloqueado (%)', SQLERRM; END $$;
RESET ROLE;

\echo ''
\echo '========================================================'
\echo ' 2) HASH CHAIN — generar eventos, verificar ÍNTEGRA, alterar, detectar'
\echo '========================================================'
SELECT public.log_audit_event('LOGIN','auth', gen_random_uuid(), NULL, '{"demo":1}'::jsonb, NULL, 'sistema') AS evento_1;
SELECT public.log_audit_event('ACCESO','auth', gen_random_uuid(), NULL, '{"demo":2}'::jsonb, NULL, 'sistema') AS evento_2;
SELECT public.log_audit_event('EXPORT','empresas', gen_random_uuid(), NULL, '{"demo":3}'::jsonb, NULL, 'sistema') AS evento_3;

\echo '-- Verificación cadena global (esperado: INTEGRA):'
SELECT estado, primer_fallo_seq, detalle FROM public.fn_verify_audit_chain(NULL);

\echo '-- Alteración simulada (superuser bypasea REVOKE/RLS, como un atacante con acceso a la DB):'
UPDATE public.audit_log
SET datos_nuevo = jsonb_set(coalesce(datos_nuevo,'{}'::jsonb), '{__tampered}', 'true')
WHERE id = (
  SELECT id FROM public.audit_log
  WHERE coalesce(consultora_id,'00000000-0000-0000-0000-000000000000') = '00000000-0000-0000-0000-000000000000'
    AND hash IS NOT NULL ORDER BY seq ASC LIMIT 1
);

\echo '-- Re-verificación (esperado: ALTERADA en seq 1):'
SELECT estado, primer_fallo_seq, detalle FROM public.fn_verify_audit_chain(NULL);

\echo ''
\echo '========================================================'
\echo ' 3) TRIGGER — editar un registro deja estado anterior + trace_id'
\echo '========================================================'
BEGIN;
-- Desactivamos SOLO el trigger de billing (no aplica al demo). El audit_empresas queda ACTIVO.
-- El ROLLBACK final restaura el estado del trigger.
ALTER TABLE public.empresas DISABLE TRIGGER check_limit_before_empresa;
SELECT set_config('sigmetria.trace_id','44444444-4444-4444-4444-444444444444', true) AS trace_set;
SELECT set_config('sigmetria.origen','humano', true) AS origen_set;

WITH c AS (
  INSERT INTO public.consultoras (nombre) VALUES ('Demo SRT') RETURNING id
)
INSERT INTO public.empresas (consultora_id, razon_social)
SELECT id, 'Empresa Demo' FROM c;

UPDATE public.empresas SET razon_social = 'Empresa Demo (EDITADA)'
WHERE razon_social = 'Empresa Demo';

\echo '-- Eventos de auditoría de empresas (INSERT + UPDATE), con estado anterior y trace_id:'
SELECT seq, accion, origen, trace_id,
       (datos_antes IS NOT NULL) AS preserva_estado_anterior,
       datos_antes->>'razon_social' AS razon_social_anterior,
       datos_nuevo->>'razon_social' AS razon_social_nueva,
       left(hash,16)||'…' AS hash, left(hash_prev,16)||'…' AS hash_prev
FROM public.audit_log
WHERE tabla_nombre = 'empresas'
ORDER BY seq ASC;
ROLLBACK;

\echo ''
\echo '========================================================'
\echo ' FIN DEMO'
\echo '========================================================'
