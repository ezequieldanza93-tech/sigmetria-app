-- Add seats_max to consultoras for user slot management
ALTER TABLE public.consultoras
  ADD COLUMN IF NOT EXISTS seats_max int NOT NULL DEFAULT 3;
