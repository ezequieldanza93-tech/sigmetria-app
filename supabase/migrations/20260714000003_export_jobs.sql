-- ============================================================
-- Sigmetría HyS — Worker async de EXPORT (Estándar 3 Portabilidad, SRT Disp. 15/2026)
-- ============================================================
--
-- Por qué: hoy el paquete de portabilidad se arma SÍNCRONO dentro del request
-- (timeout/OOM con paquetes grandes). Esta tabla es la COLA de jobs: el route
-- encola un job (pending), responde de inmediato y dispara el worker en
-- background (after()). El worker arma + guarda en el bucket `exports` + firma
-- signed URL + emailea, y va marcando processing → ready / error. El front hace
-- polling al estado.
--
-- MODELO (igual que cron_jobs_log + el bucket exports):
--   - Aislamiento por tenant: consultora_id (primer eje de toda la app).
--   - RLS: los MIEMBROS ACTIVOS de la consultora pueden SELECT/INSERT (encolar y
--     ver el estado de su propio job). UPDATE/DELETE: NADIE por RLS — solo el
--     worker, vía service_role (bypasea RLS) o vía los RPC SECURITY DEFINER.
--   - RPCs SECURITY DEFINER para que el worker marque processing/ready/error sin
--     depender del bypass (consistente con cron_log_start/cron_log_finish).
--
-- ADITIVA. Idempotente (CREATE TABLE IF NOT EXISTS, índices IF NOT EXISTS,
-- DROP POLICY IF EXISTS + CREATE, CREATE OR REPLACE en funciones).
-- ⚠️ NO aplicada — se versiona, la revisa y la pushea el equipo.
-- ============================================================

BEGIN;

-- ─── 1. Tabla de jobs (cola) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id   uuid        NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  empresa_id      uuid        NOT NULL,
  solicitado_por  uuid        NOT NULL,
  estado          text        NOT NULL DEFAULT 'pending'
                    CHECK (estado IN ('pending','processing','ready','error')),
  scope           jsonb       NOT NULL,
  storage_path    text,
  bytes           bigint,
  total_rows      int,
  total_archivos  int,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  expires_at      timestamptz
);

-- Índices: por tenant (listado/UI) y por estado (reconciliación del cron).
CREATE INDEX IF NOT EXISTS idx_export_jobs_consultora
  ON public.export_jobs (consultora_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_estado
  ON public.export_jobs (estado) WHERE estado IN ('pending','processing');

COMMENT ON TABLE public.export_jobs IS
  'Cola de jobs de export de portabilidad (Estándar 3, SRT Disp. 15/2026). El route encola pending y dispara el worker; el worker actualiza vía service_role/RPC. RLS: miembros leen/encolan; nadie actualiza por RLS.';

-- ─── 2. RLS ─────────────────────────────────────────────────
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: miembro activo de la consultora dueña (para que el front haga polling
-- del estado de su job). Patrón is_member_of_consultora (20260617000001).
DROP POLICY IF EXISTS "export_jobs: members select" ON public.export_jobs;
CREATE POLICY "export_jobs: members select" ON public.export_jobs
  FOR SELECT TO authenticated
  USING (public.is_member_of_consultora(consultora_id));

-- INSERT: miembro activo de la consultora puede encolar su propio job
-- (solicitado_por = el usuario en sesión). El estado inicial DEBE ser pending.
DROP POLICY IF EXISTS "export_jobs: members insert" ON public.export_jobs;
CREATE POLICY "export_jobs: members insert" ON public.export_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of_consultora(consultora_id)
    AND solicitado_por = (SELECT auth.uid())
    AND estado = 'pending'
  );

-- UPDATE/DELETE: NADIE por RLS. Solo el worker (service_role bypasea RLS, o vía
-- los RPC SECURITY DEFINER de abajo). No declaramos policies de UPDATE/DELETE
-- → con RLS habilitada y sin policy permisiva, queda bloqueado para authenticated.

-- ─── 3. RPCs del worker (SECURITY DEFINER) ──────────────────
-- Consistente con cron_log_start/cron_log_finish: el worker (service_role) las
-- llama para transicionar el estado sin depender del bypass crudo. Idempotentes.

-- Marca un job como processing (solo si estaba pending). Devuelve true si tomó
-- el job, false si ya no estaba pending (otro worker lo tomó / idempotencia).
CREATE OR REPLACE FUNCTION public.export_job_mark_processing(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_updated int;
BEGIN
  UPDATE public.export_jobs
  SET estado = 'processing',
      started_at = COALESCE(started_at, now())
  WHERE id = p_id
    AND estado = 'pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Marca un job como ready con los metadatos del paquete generado.
CREATE OR REPLACE FUNCTION public.export_job_mark_ready(
  p_id uuid,
  p_storage_path text,
  p_bytes bigint,
  p_total_rows int,
  p_total_archivos int,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.export_jobs
  SET estado = 'ready',
      storage_path = p_storage_path,
      bytes = p_bytes,
      total_rows = p_total_rows,
      total_archivos = p_total_archivos,
      expires_at = p_expires_at,
      error = NULL,
      finished_at = now()
  WHERE id = p_id;
END;
$$;

-- Marca un job como error con el mensaje.
CREATE OR REPLACE FUNCTION public.export_job_mark_error(p_id uuid, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.export_jobs
  SET estado = 'error',
      error = p_error,
      finished_at = now()
  WHERE id = p_id;
END;
$$;

-- Reconciliación: marca como error los jobs colgados (pending/processing más
-- viejos que p_minutos). Devuelve la cantidad marcada. Lo llama el cron de GC.
CREATE OR REPLACE FUNCTION public.export_jobs_reconciliar(p_minutos int DEFAULT 15)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.export_jobs
  SET estado = 'error',
      error = 'El worker no completó la generación a tiempo — reintentá la exportación.',
      finished_at = now()
  WHERE estado IN ('pending','processing')
    AND COALESCE(started_at, created_at) < now() - make_interval(mins => p_minutos);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Permisos: solo el service_role ejecuta los RPC (igual que cron_log_*).
REVOKE EXECUTE ON FUNCTION public.export_job_mark_processing(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.export_job_mark_ready(uuid, text, bigint, int, int, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.export_job_mark_error(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.export_jobs_reconciliar(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.export_job_mark_processing(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.export_job_mark_ready(uuid, text, bigint, int, int, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.export_job_mark_error(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.export_jobs_reconciliar(int) TO service_role;

COMMIT;
