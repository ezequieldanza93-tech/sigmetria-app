-- ============================================================
-- Feedback + NPS System
-- Tabla única feedback con discriminador tipo
-- ============================================================

-- Tabla feedback
CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  consultora_id uuid REFERENCES consultoras(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('nps', 'bug', 'sugerencia', 'general')),
  nps_score smallint CHECK (nps_score IS NULL OR (nps_score BETWEEN 0 AND 10)),
  nps_categoria text GENERATED ALWAYS AS (
    CASE
      WHEN nps_score IS NULL THEN NULL
      WHEN nps_score >= 9 THEN 'promotor'
      WHEN nps_score >= 7 THEN 'pasivo'
      ELSE 'detractor'
    END
  ) STORED,
  titulo text,
  comentario text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'revisado', 'descartado', 'implementado')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nps_requires_score CHECK (tipo != 'nps' OR nps_score IS NOT NULL),
  CONSTRAINT ticket_requires_titulo CHECK (tipo = 'nps' OR (titulo IS NOT NULL AND length(titulo) > 0))
);

CREATE INDEX feedback_user_id_idx ON feedback (user_id);
CREATE INDEX feedback_consultora_id_idx ON feedback (consultora_id);
CREATE INDEX feedback_tipo_idx ON feedback (tipo);
CREATE INDEX feedback_status_idx ON feedback (status) WHERE status = 'nuevo';
CREATE INDEX feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX feedback_nps_score_idx ON feedback (nps_score) WHERE tipo = 'nps';

-- Trigger updated_at
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- INSERT: cualquier usuario autenticado puede insertar su propio feedback
CREATE POLICY "feedback: insert own" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT: el usuario ve sus propios feedbacks; super_admin ve todos
CREATE POLICY "feedback: select own or super_admin" ON feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin());

-- UPDATE: solo super_admin (para cambiar status)
CREATE POLICY "feedback: update super_admin" ON feedback
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- DELETE: solo super_admin
CREATE POLICY "feedback: delete super_admin" ON feedback
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- Función helper para NPS Score (devuelve número entre -100 y 100)
CREATE OR REPLACE FUNCTION calcular_nps_score(p_desde timestamptz DEFAULT now() - INTERVAL '90 days')
RETURNS TABLE(
  total_respuestas bigint,
  promotores bigint,
  pasivos bigint,
  detractores bigint,
  nps_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE nps_categoria = 'promotor') AS prom,
      COUNT(*) FILTER (WHERE nps_categoria = 'pasivo') AS pas,
      COUNT(*) FILTER (WHERE nps_categoria = 'detractor') AS det
    FROM feedback
    WHERE tipo = 'nps' AND created_at >= p_desde
  )
  SELECT
    total,
    prom,
    pas,
    det,
    CASE WHEN total = 0 THEN 0
         ELSE ROUND(((prom::numeric - det::numeric) / total::numeric) * 100, 1)
    END AS nps_score
  FROM stats;
$$;

GRANT EXECUTE ON FUNCTION calcular_nps_score(timestamptz) TO authenticated;

-- Función helper para trend mensual NPS (últimos 12 meses)
CREATE OR REPLACE FUNCTION nps_trend_mensual(p_meses int DEFAULT 12)
RETURNS TABLE(
  mes date,
  total_respuestas bigint,
  nps_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', created_at)::date AS mes,
    COUNT(*) AS total_respuestas,
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(
           ((COUNT(*) FILTER (WHERE nps_categoria = 'promotor')::numeric
             - COUNT(*) FILTER (WHERE nps_categoria = 'detractor')::numeric)
            / COUNT(*)::numeric) * 100, 1)
    END AS nps_score
  FROM feedback
  WHERE tipo = 'nps'
    AND created_at >= date_trunc('month', now()) - (p_meses || ' months')::interval
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION nps_trend_mensual(int) TO authenticated;
