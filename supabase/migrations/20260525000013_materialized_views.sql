-- ============================================================
-- Sigmetría HyS — Materialized Views para dashboards
-- Issue #7: aggregates en tiempo real sobre millones de filas
--
-- Las MVs se refrescan vía cron o trigger.
-- No tienen RLS — la app filtra por scope (consultora/estab).
--
-- ROLLBACK:
--   DROP MATERIALIZED VIEW IF EXISTS public.mv_cumplimiento_establecimiento;
--   DROP MATERIALIZED VIEW IF EXISTS public.mv_observaciones_vencidas;
--   DROP MATERIALIZED VIEW IF EXISTS public.mv_gestiones_pendientes;
--   DROP FUNCTION IF EXISTS public.refresh_dashboard_materialized_views();
-- ============================================================

-- ============================================================
-- 1. mv_gestiones_pendientes
-- Pendientes por establecimiento + responsable
-- Útil para: "cuántas gestiones debe cada persona"
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_gestiones_pendientes AS
SELECT
  ge.establecimiento_id,
  rg.responsable_id,
  count(*)                                             AS total_pendientes,
  count(*) FILTER (WHERE rg.fecha_planificada < CURRENT_DATE) AS vencidas,
  min(rg.fecha_planificada)                            AS mas_antigua,
  max(rg.fecha_planificada)                            AS mas_reciente
FROM public.gestiones_registros rg
JOIN public.gestiones_establecimientos ge ON ge.id = rg.gestion_establecimiento_id
WHERE rg.fecha_ejecutada IS NULL
  AND rg.fecha_planificada <= CURRENT_DATE
GROUP BY ge.establecimiento_id, rg.responsable_id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_gestiones_pendientes_uniq
  ON public.mv_gestiones_pendientes (establecimiento_id, responsable_id);

COMMENT ON MATERIALIZED VIEW public.mv_gestiones_pendientes IS
  'Gestiones pendientes (no ejecutadas, planificadas <= hoy) agrupadas por establecimiento y responsable';


-- ============================================================
-- 2. mv_observaciones_vencidas
-- Observaciones vencidas (sin cierre, pasadas de fecha)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_observaciones_vencidas AS
SELECT
  ge.establecimiento_id,
  og.responsable_cierre_id,
  count(*)                                             AS total_vencidas,
  min(og.fecha_planificada)                            AS mas_antigua
FROM public.gestiones_observaciones og
JOIN public.gestiones_registros rg ON rg.id = og.registro_gestion_id
JOIN public.gestiones_establecimientos ge ON ge.id = rg.gestion_establecimiento_id
WHERE og.fecha_cierre IS NULL
  AND og.fecha_planificada <= CURRENT_DATE
GROUP BY ge.establecimiento_id, og.responsable_cierre_id
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_obs_vencidas_uniq
  ON public.mv_observaciones_vencidas (establecimiento_id, responsable_cierre_id);

COMMENT ON MATERIALIZED VIEW public.mv_observaciones_vencidas IS
  'Observaciones vencidas (sin cierre, pasadas de fecha) agrupadas por establecimiento y responsable';


-- ============================================================
-- 3. mv_cumplimiento_establecimiento
-- % de ejecución mensual por establecimiento
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_cumplimiento_establecimiento AS
SELECT
  ge.establecimiento_id,
  date_trunc('month', rg.fecha_planificada)::date AS mes,
  count(*)                                        AS total,
  count(rg.fecha_ejecutada)                       AS ejecutadas,
  CASE WHEN count(*) > 0
    THEN round(count(rg.fecha_ejecutada)::numeric / count(*) * 100, 1)
    ELSE 0
  END                                             AS cumplimiento_pct
FROM public.gestiones_registros rg
JOIN public.gestiones_establecimientos ge ON ge.id = rg.gestion_establecimiento_id
GROUP BY ge.establecimiento_id, date_trunc('month', rg.fecha_planificada)
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_cumplimiento_uniq
  ON public.mv_cumplimiento_establecimiento (establecimiento_id, mes);

COMMENT ON MATERIALIZED VIEW public.mv_cumplimiento_establecimiento IS
  '% de ejecución mensual de gestiones por establecimiento';


-- ============================================================
-- 4. Función de refresh (llamar desde cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_dashboard_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_gestiones_pendientes;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_observaciones_vencidas;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cumplimiento_establecimiento;
END;
$$;

COMMENT ON FUNCTION public.refresh_dashboard_materialized_views IS
  'Refresca todas las MVs de dashboard. Llamar desde pg_cron o Supabase cron cada 30 min';
