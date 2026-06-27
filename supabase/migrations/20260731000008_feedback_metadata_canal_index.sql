-- Índice de expresión para el único jsonb que se filtra por contenido (hallazgo JSONB-001)
-- De las 28 columnas jsonb, feedback.metadata es la ÚNICA que se filtra por una clave interna:
--   listarReportesFounder() en lib/actions/reporte-problema.ts → .filter('metadata->>canal','eq',...)
-- Las otras 27 se leen/escriben completas (auditoría, tool_calls, webhooks, snapshots) → sin índice
-- (un GIN ahí sería índice muerto que solo encarece escrituras).
-- btree de EXPRESIÓN, no GIN: el filtro es igualdad sobre una clave escalar (metadata->>'canal').

CREATE INDEX IF NOT EXISTS idx_feedback_metadata_canal
  ON public.feedback ((metadata->>'canal'));
