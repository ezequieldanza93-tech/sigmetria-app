-- ============================================================
-- Sigmetría HyS — Audit log: escalabilidad fase 2 (particionamiento)
--
-- Problema:
--   Una sola tabla audit_log crece sin límite. Con 50 consultoras × 100
--   empleados × 10 eventos/día → ~1.8M filas/año. VACUUM y sequential scans
--   degradan con el tiempo.
--
-- Solución: PARTITION BY RANGE (created_at) mensual
--   - Particiones pasadas → potencialmente movibles a tablespace frío
--   - Partition pruning automático en queries con filtro de fecha
--   - DROP PARTITION para purgar datos históricos sin VACUUM total
--
-- Procedimiento (no hay ALTER TABLE ... SET PARTITIONED en PG):
--   1. Renombrar tabla actual → audit_log_pre_partition
--   2. Crear audit_log nueva como partitioned (composite PK requerido)
--   3. Crear particiones: histórica + mes actual + próximos 3 meses
--   4. Copiar datos desde audit_log_pre_partition
--   5. Eliminar tabla temporal
--   6. Recrear índices, RLS y función de creación automática de particiones
--   7. Registrar job pg_cron para crear particiones mensualmente
--
-- Nota: Los triggers sobre las tablas funcionales (siniestros, etc.)
--   siguen apuntando a fn_audit_trigger() que inserta en public.audit_log —
--   no requieren cambios.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Renombrar tabla existente (preserva datos durante migración)
-- ============================================================
ALTER TABLE public.audit_log RENAME TO audit_log_pre_partition;

-- Desactivar RLS temporalmente en la tabla legacy para evitar
-- conflictos durante la copia de datos (corre como postgres via migration)
ALTER TABLE public.audit_log_pre_partition DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Crear tabla particionada
--    PK compuesto (id, created_at): requisito de PostgreSQL para
--    partitioned tables — la partition key debe estar en la PK.
-- ============================================================
CREATE TABLE public.audit_log (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  tabla_nombre  text        NOT NULL,
  accion        text        NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  registro_id   uuid        NOT NULL,
  user_id       uuid,
  consultora_id uuid,
  datos_antes   jsonb,
  datos_nuevo   jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ============================================================
-- 3. Crear particiones
--    - audit_log_historical: todo lo anterior al mes actual
--    - audit_log_YYYYMM: mes actual + 3 meses siguientes
--    Los límites son exclusivos por el lado superior (LESS THAN).
-- ============================================================

-- Partición histórica: todo antes del mes actual
CREATE TABLE public.audit_log_historical
  PARTITION OF public.audit_log
  FOR VALUES FROM (MINVALUE) TO (date_trunc('month', now()));

-- Mes actual y próximos 3 meses
DO $$
DECLARE
  v_start  timestamptz;
  v_end    timestamptz;
  v_name   text;
  i        int;
BEGIN
  FOR i IN 0..3 LOOP
    v_start := date_trunc('month', now()) + (i  || ' month')::interval;
    v_end   := date_trunc('month', now()) + ((i+1) || ' month')::interval;
    v_name  := 'audit_log_' || to_char(v_start, 'YYYYMM');

    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.audit_log FOR VALUES FROM (%L) TO (%L)',
      v_name, v_start, v_end
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 4. Copiar datos desde la tabla legacy
-- ============================================================
INSERT INTO public.audit_log (
  id, tabla_nombre, accion, registro_id,
  user_id, consultora_id, datos_antes, datos_nuevo, created_at
)
SELECT
  id, tabla_nombre, accion, registro_id,
  user_id, consultora_id, datos_antes, datos_nuevo, created_at
FROM public.audit_log_pre_partition;

-- ============================================================
-- 5. Eliminar tabla legacy
-- ============================================================
DROP TABLE public.audit_log_pre_partition;

-- ============================================================
-- 6. Índices en la tabla particionada
--    En PostgreSQL 11+ los índices en la tabla padre se propagan
--    automáticamente a las particiones hijas.
-- ============================================================
CREATE INDEX idx_audit_log_tabla_registro
  ON public.audit_log (tabla_nombre, registro_id);

CREATE INDEX idx_audit_log_user_id
  ON public.audit_log (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

CREATE INDEX idx_audit_log_consultora_fecha
  ON public.audit_log (consultora_id, created_at DESC)
  WHERE consultora_id IS NOT NULL;

-- ============================================================
-- 7. RLS en la tabla particionada
--    Las políticas definidas en el padre se heredan por las particiones.
-- ============================================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log: select"
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    public.is_developer()
    OR user_id = (SELECT auth.uid())
    OR (
      consultora_id IS NOT NULL
      AND consultora_id = (
        SELECT cm.consultora_id
        FROM public.consultoras_members cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.is_active = true
          AND cm.role IN (
            'full_access_main',
            'full_access_branch',
            'responsable_estandares',
            'auditor_externo'
          )
        LIMIT 1
      )
    )
  );

CREATE POLICY "audit_log: insert"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "audit_log: update"
  ON public.audit_log FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "audit_log: delete"
  ON public.audit_log FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- 8. Función para crear la partición del mes siguiente
--    Llamada por pg_cron el día 25 de cada mes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_create_audit_partition_next_month()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_next_start  timestamptz;
  v_next_end    timestamptz;
  v_name        text;
BEGIN
  -- Crear partición para el mes que viene al mes actual
  -- (ejecutado el 25: crea la partición con 1 mes de anticipación)
  v_next_start := date_trunc('month', now() + interval '1 month');
  v_next_end   := date_trunc('month', now() + interval '2 months');
  v_name       := 'audit_log_' || to_char(v_next_start, 'YYYYMM');

  -- Verificar que la partición no exista ya
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.audit_log FOR VALUES FROM (%L) TO (%L)',
      v_name, v_next_start, v_next_end
    );
    RAISE NOTICE 'Partición creada: %', v_name;
  ELSE
    RAISE NOTICE 'Partición ya existe: %', v_name;
  END IF;
END;
$$;

-- ============================================================
-- 9. Registrar job en pg_cron
--    Cron: día 25 de cada mes a las 02:00 UTC
--    Requiere extensión pg_cron habilitada (disponible en Supabase Pro).
--    Si pg_cron no está disponible, comentar este bloque y crear
--    la partición manualmente cada mes o via Edge Function con schedule.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'crear-particion-audit-mensual',
      '0 2 25 * *',
      'SELECT public.fn_create_audit_partition_next_month();'
    );
    RAISE NOTICE 'pg_cron job registrado: crear-particion-audit-mensual';
  ELSE
    RAISE NOTICE 'pg_cron no disponible. Crear particiones manualmente con fn_create_audit_partition_next_month().';
  END IF;
END;
$$;

COMMIT;
