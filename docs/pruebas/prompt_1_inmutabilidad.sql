-- ============================================================
-- PRUEBA Prompt 1 — Criterio: UPDATE/DELETE directo sobre audit_log FALLA,
-- incluso con el rol de la app (authenticated) y con service_role.
--
-- Cómo correr: psql contra staging/local DESPUÉS de aplicar
--   20260702000001_audit_trazabilidad_srt.sql
--   (o pegar en el SQL Editor de Supabase).
--
-- Resultado esperado: cada UPDATE/DELETE abajo lanza
--   ERROR: permission denied for table audit_log
-- ============================================================

-- Tomamos un id cualquiera existente para el intento (si no hay filas, el
-- permission denied se dispara igual antes de evaluar la fila).
\set ON_ERROR_STOP off

-- ── 1. Como rol de la app (authenticated) ──────────────────────────
SET ROLE authenticated;

-- Debe FALLAR: permission denied for table audit_log
UPDATE public.audit_log SET datos_nuevo = '{"hack":true}'::jsonb
WHERE id = (SELECT id FROM public.audit_log LIMIT 1);

-- Debe FALLAR: permission denied for table audit_log
DELETE FROM public.audit_log
WHERE id = (SELECT id FROM public.audit_log LIMIT 1);

-- Debe FALLAR: permission denied for table audit_log
INSERT INTO public.audit_log (tabla_nombre, accion, registro_id)
VALUES ('hack', 'INSERT', gen_random_uuid());

RESET ROLE;

-- ── 2. Como service_role (cliente admin) ───────────────────────────
SET ROLE service_role;

-- Debe FALLAR igualmente: la inmutabilidad aplica también al service_role.
UPDATE public.audit_log SET origen = 'sistema'
WHERE id = (SELECT id FROM public.audit_log LIMIT 1);

DELETE FROM public.audit_log
WHERE id = (SELECT id FROM public.audit_log LIMIT 1);

RESET ROLE;

-- ── 3. SELECT sigue permitido (vía RLS) ────────────────────────────
SET ROLE authenticated;
SELECT count(*) AS filas_visibles FROM public.audit_log;  -- OK (RLS filtra)
RESET ROLE;

-- Conclusión: la única vía de escritura es el trigger / RPC SECURITY DEFINER.
