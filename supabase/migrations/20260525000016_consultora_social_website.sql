ALTER TABLE public.consultoras
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;
