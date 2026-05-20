-- ============================================================
-- Sigmetría HyS — Composite indexes for RLS & query perf
-- Targets 10k users / 50k establecimientos
-- Issues: #1, #5, #6, #8
-- ============================================================

-- ── #1: RLS covering index on consultoras_members ────────────
-- Convierte la cadena de JOINs en index-only scan:
--   cm.user_id = X AND cm.is_active = true AND cm.role IN (...)
-- Sin este índice, cada fila evaluada por RLS hace 3 JOINs.
CREATE INDEX IF NOT EXISTS idx_cm_user_active_role_consultora
  ON public.consultoras_members (user_id, is_active, role, consultora_id)
  WHERE is_active = TRUE;

-- ── #5: Composite (establecimiento_id, executed_at DESC) ─────
-- Query pattern: "traer respuestas de este establecimiento, más recientes primero"
-- Reemplaza idx_formulario_respuestas_establecimiento_id (columna sola)
CREATE INDEX IF NOT EXISTS idx_form_respuestas_estab_executed
  ON public.formulario_respuestas (establecimiento_id, executed_at DESC);

-- ── #6a: BRIN on gestiones_observaciones.created_at ─────────
-- Append-heavy, correlación con orden físico, range scans de reportes
CREATE INDEX IF NOT EXISTS idx_go_created_brin
  ON public.gestiones_observaciones USING brin (created_at)
  WITH (pages_per_range = 32);

-- ── #6b: Composite (registro_gestion_id, fecha_planificada) ───
-- Query pattern: "observaciones de esta gestión, ordenadas por fecha"
-- Cubre el join común: go → gr y ordenamiento sin tocar la tabla
CREATE INDEX IF NOT EXISTS idx_go_registro_gestion_fecha
  ON public.gestiones_observaciones (registro_gestion_id, fecha_planificada);

-- ── #8: Composite (gestion_establecimiento_id, fecha_planificada DESC) ─
-- Query pattern: "gestiones de este establecimiento, ordenadas por fecha"
-- Cubre filtro + ORDER BY sin tocar la tabla.
CREATE INDEX IF NOT EXISTS idx_gr_gestion_estab_fecha
  ON public.gestiones_registros (gestion_establecimiento_id, fecha_planificada DESC);

-- Partial composite: pendientes por establecimiento
CREATE INDEX IF NOT EXISTS idx_gr_pendientes_estab_fecha
  ON public.gestiones_registros (gestion_establecimiento_id, fecha_planificada)
  WHERE fecha_ejecutada IS NULL;

-- ── DROP old single-column index replaced by composite ───────
-- idx_formulario_respuestas_establecimiento_id ya no es necesario
-- porque idx_form_respuestas_estab_executed lo cubre.
DROP INDEX IF EXISTS public.idx_formulario_respuestas_establecimiento_id;
