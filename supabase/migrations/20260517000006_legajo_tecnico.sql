-- Add legajo_tecnico flag to establecimiento_documentos
-- Marks documents to be shown in the technical file (legajo técnico)

ALTER TABLE public.establecimiento_documentos
  ADD COLUMN legajo_tecnico boolean NOT NULL DEFAULT false;
