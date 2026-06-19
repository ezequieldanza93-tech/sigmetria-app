-- Fase C: agrega columna pdf_url a medicion_iluminacion para persistir el path
-- del PDF generado por el motor Chromium server-side (render-protocolo.ts).
-- Aditiva y segura: IF NOT EXISTS garantiza idempotencia.

ALTER TABLE public.medicion_iluminacion
  ADD COLUMN IF NOT EXISTS pdf_url text;

COMMENT ON COLUMN public.medicion_iluminacion.pdf_url IS
  'Path relativo en bucket privado documentos (tenant-prefixed) del PDF del protocolo SRT 84/2012 generado por render-protocolo.ts. NULL = aún no generado. Se deriva a signed URL on-read.';
