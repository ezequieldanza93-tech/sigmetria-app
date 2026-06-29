ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS art_fecha_inicio date,
  ADD COLUMN IF NOT EXISTS art_fecha_vencimiento date;
