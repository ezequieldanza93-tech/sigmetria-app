CREATE TABLE IF NOT EXISTS sigia_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent TEXT NOT NULL UNIQUE,
  patterns TEXT[] NOT NULL,
  context_required TEXT[] DEFAULT '{}',
  handler TEXT NOT NULL,
  response_template TEXT DEFAULT '',
  requires_establecimiento BOOLEAN DEFAULT false,
  requires_action BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sigia_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL UNIQUE,
  synonyms TEXT[] NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sigia_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sigia_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sigia_intents_select" ON sigia_intents FOR SELECT USING (true);
CREATE POLICY "sigia_synonyms_select" ON sigia_synonyms FOR SELECT USING (true);

CREATE POLICY "sigia_intents_insert" ON sigia_intents FOR INSERT WITH CHECK (true);
CREATE POLICY "sigia_synonyms_insert" ON sigia_synonyms FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sigia_intents_handler ON sigia_intents(handler);
CREATE INDEX IF NOT EXISTS idx_sigia_synonyms_category ON sigia_synonyms(category);
CREATE INDEX IF NOT EXISTS idx_sigia_synonyms_term ON sigia_synonyms(term);
