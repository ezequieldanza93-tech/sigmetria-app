-- Add missing fields to establecimientos: work schedule and establishment info

ALTER TABLE public.establecimientos
  ADD COLUMN horario_trabajo text;

-- NOTE: description column was added in 20260516000001_establecimientos_airtable_unification.sql
-- It is now exposed in the app interface as "Información del establecimiento"
