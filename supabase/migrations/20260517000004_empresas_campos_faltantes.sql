-- Add missing fields to empresas: fiscal type, ART, logos, general info

ALTER TABLE public.empresas
  ADD COLUMN tipo_identidad_impositiva text,
  ADD COLUMN art                       text,
  ADD COLUMN art_numero_contrato       text,
  ADD COLUMN logo_small_url            text,
  ADD COLUMN logo_destacado_url        text,
  ADD COLUMN informacion_general       text;
