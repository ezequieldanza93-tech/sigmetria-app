-- ============================================================
-- Sigmetría HyS — BRIN indexes para tablas append-only
--
-- BRIN (Block Range INdex) es ~100x más compacto que B-tree
-- para columnas monotónicas (created_at, timestamps con now()).
--
-- Aplica a tablas donde:
--   a) Los inserts son append-only (sin UPDATE masivo)
--   b) El valor del índice correlaciona con orden físico
--   c) Las queries son rangos (reportes, calendar views)
--
-- Esto da el beneficio de particionado sin el overhead.
-- ============================================================

-- ── subscription_audit_log: created_at ──────────────────────
-- Solo crece, solo range queries de auditoría
CREATE INDEX IF NOT EXISTS idx_sub_audit_created_brin
  ON public.subscription_audit_log USING brin (created_at)
  WITH (pages_per_range = 32);

-- ── impersonation_log: started_at ──────────────────────────
-- Append-only, range queries por fecha
CREATE INDEX IF NOT EXISTS idx_impersonation_started_brin
  ON public.impersonation_log USING brin (started_at)
  WITH (pages_per_range = 32);

-- ── formularios_respuestas: executed_at ────────────────────
-- Crecimiento O(n*m), queries por rango de fecha
CREATE INDEX IF NOT EXISTS idx_form_respuestas_executed_brin
  ON public.formularios_respuestas USING brin (executed_at)
  WITH (pages_per_range = 32);

-- ── registro_gestiones: created_at ─────────────────────────
-- Ya tiene idx_rg_fecha_planificada (B-tree) para el campo
-- fecha_planificada (que NO es monotónico). Este BRIN cubre
-- created_at que SÍ es correlativo al orden físico.
CREATE INDEX IF NOT EXISTS idx_rg_created_brin
  ON public.registro_gestiones USING brin (created_at)
  WITH (pages_per_range = 32);
