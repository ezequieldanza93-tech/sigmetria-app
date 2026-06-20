-- Agrega columna pdf_path a normativa_normas para soportar PDF del texto oficial.
-- El path es relativo al bucket 'normativa' (público) y se resuelve on-read.
ALTER TABLE public.normativa_normas ADD COLUMN IF NOT EXISTS pdf_path text;
