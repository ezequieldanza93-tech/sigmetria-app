CREATE TABLE user_dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, widget_key)
);

CREATE INDEX idx_udw_user ON user_dashboard_widgets(user_id);

ALTER TABLE user_dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard widgets"
  ON user_dashboard_widgets FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own dashboard widgets"
  ON user_dashboard_widgets FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own dashboard widgets"
  ON user_dashboard_widgets FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own dashboard widgets"
  ON user_dashboard_widgets FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON user_dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_updated_at();
