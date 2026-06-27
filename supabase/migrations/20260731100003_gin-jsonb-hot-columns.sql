-- JSONB-001: Índices GIN en columnas jsonb que se consultan con operadores jsonb.
-- Se aplican con CONCURRENTLY (no bloquean escrituras durante la construcción).
-- Los índices de audit_log (datos_antes/datos_nuevo) quedan excluidos: son append-only
-- y se leen enteras, no se filtran con operadores jsonb.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_export_jobs_scope_gin
  ON public.export_jobs USING GIN (scope);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_pending_params_gin
  ON public.agent_pending_actions USING GIN (params);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_erg_factor_paso1_gin
  ON public.ergonomia_evaluacion_factor USING GIN (paso1_respuestas);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_erg_factor_paso2_gin
  ON public.ergonomia_evaluacion_factor USING GIN (paso2_respuestas);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cap_participantes_respuestas_gin
  ON public.capacitacion_participantes USING GIN (respuestas);

-- NOTA: Columnas jsonb excluidas del GIN (payload variable, no se filtran):
--   agent_conversations.context         → contexto de sesión, se lee entero
--   agent_messages.tool_calls           → historial de herramientas, append-only
--   agent_messages.tool_results         → ídem
--   audit_log.datos_antes / datos_nuevo → snapshot inmutable, no se filtra
--   audit_trail.datos_antes / datos_nuevo → ídem
--   consultoras.social_links            → pequeño, se lee entero
--   cron_jobs_log.resultado             → diagnóstico, no se filtra
--   cursos.configuracion_quiz / versiones_material.snapshot → se leen enteros
