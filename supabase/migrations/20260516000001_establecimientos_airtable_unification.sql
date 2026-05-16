-- ============================================================
-- Sigmetría — Unificación establecimientos con Airtable (Aux - Projects)
-- ============================================================

CREATE TYPE public.construction_type AS ENUM (
  'spec_home',
  'cost_center',
  'religious',
  'office',
  'small_works',
  'industrial',
  'condo',
  'custom_home',
  'hotel'
);

CREATE TYPE public.establishment_status AS ENUM (
  'active',
  'finished',
  'proposal',
  'lead',
  'on_hold',
  'not_awarded',
  'cancelled'
);

ALTER TABLE public.establecimientos
  ADD COLUMN code                text,
  ADD COLUMN ref                 text,
  ADD COLUMN status              public.establishment_status NOT NULL DEFAULT 'active',
  ADD COLUMN photo_url           text,
  ADD COLUMN floor_plan_pdf_url  text,
  ADD COLUMN floor_plan_cad_url  text,
  ADD COLUMN country             text,
  ADD COLUMN google_maps_url     text,
  ADD COLUMN description         text,
  ADD COLUMN ac_area             numeric(10,2),
  ADD COLUMN gross_area          numeric(10,2),
  ADD COLUMN construction_type   public.construction_type;

UPDATE public.establecimientos
  SET status = CASE
    WHEN is_active THEN 'active'::public.establishment_status
    ELSE 'on_hold'::public.establishment_status
  END;

ALTER TABLE public.establecimientos DROP COLUMN is_active;
