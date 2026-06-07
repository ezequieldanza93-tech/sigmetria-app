-- ============================================================
-- RLS en particiones hijas de asistencia_diaria y audit_log
-- ============================================================
-- Las tablas particionadas asistencia_diaria y audit_log tienen RLS habilitada
-- + policies en el PADRE, pero sus particiones HIJAS (asistencia_diaria_2026..2031,
-- audit_log_YYYYMM, audit_log_historical) quedaron con relrowsecurity=false y 0
-- policies, mientras anon y authenticated tienen SELECT/INSERT/UPDATE/DELETE sobre
-- ellas.
--
-- Consultar el PADRE aplica la RLS del padre. Pero PostgREST expone cada partición
-- hija como su propio endpoint (/rest/v1/asistencia_diaria_2026), y consultar la
-- HIJA directamente NO aplica la RLS del padre (la hija la tiene apagada) -> con la
-- ANON_KEY pública cualquiera lee/escribe asistencias y audit logs de TODAS las
-- consultoras. Fuga cross-tenant real.
--
-- Fix: habilitar RLS en cada hija. Sin policy propia, el acceso DIRECTO a la hija
-- queda deny-all; el acceso vía el PADRE sigue funcionando con las policies del
-- padre. VERIFICADO empíricamente (tabla particionada de prueba, rolled back):
--   - INSERT autenticado vía el padre -> rutea a la hija deny-all SIN romperse.
--   - SELECT vía el padre -> ve las filas (policy del padre).
--   - SELECT directo a la hija -> 0 filas (deny-all).
-- La app accede siempre por el padre (lib/actions/asistencia.ts), así que no se
-- rompe ningún flujo.
-- Idempotente.
-- ============================================================

-- ─── 1. Habilitar RLS en todas las particiones hijas existentes ─────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c       ON c.oid = i.inhrelid
    JOIN pg_class parent  ON parent.oid = i.inhparent
    JOIN pg_namespace n   ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND parent.relname IN ('asistencia_diaria', 'audit_log')
      AND c.relrowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

-- ─── 2. Que las futuras particiones de audit_log nazcan con RLS ─────────────
CREATE OR REPLACE FUNCTION public.fn_create_audit_partition_next_month()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- La hija nace con RLS habilitada (deny-all en acceso directo; el acceso
    -- legítimo es por el padre audit_log, que tiene sus policies).
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_name);
    RAISE NOTICE 'Partición creada: %', v_name;
  ELSE
    RAISE NOTICE 'Partición ya existe: %', v_name;
  END IF;
END;
$function$;

-- NOTA: las particiones de asistencia_diaria son estáticas por año (2026..2031).
-- Cualquier migración futura que agregue un año nuevo DEBE incluir
-- 'ALTER TABLE asistencia_diaria_YYYY ENABLE ROW LEVEL SECURITY'.
