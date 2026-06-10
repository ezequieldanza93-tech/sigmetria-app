-- Descripción ("de qué trata") por norma
ALTER TABLE public.normativa_normas ADD COLUMN IF NOT EXISTS descripcion text;
-- Aplicabilidad por tipo de establecimiento: default "aplica a todos"
ALTER TABLE public.normativa_normas ADD COLUMN IF NOT EXISTS aplica_a_todos boolean NOT NULL DEFAULT true;

-- Join normalizado norma <-> tipo de establecimiento (espeja gestiones_tipos_establecimiento)
CREATE TABLE IF NOT EXISTS public.normativa_normas_tipos_establecimiento (
  id uuid primary key default gen_random_uuid(),
  norma_id uuid not null references public.normativa_normas(id) on delete cascade,
  tipo_establecimiento_id uuid not null references public.establecimientos_tipos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (norma_id, tipo_establecimiento_id)
);
CREATE INDEX IF NOT EXISTS idx_nnte_norma ON public.normativa_normas_tipos_establecimiento(norma_id);
CREATE INDEX IF NOT EXISTS idx_nnte_tipo ON public.normativa_normas_tipos_establecimiento(tipo_establecimiento_id);

ALTER TABLE public.normativa_normas_tipos_establecimiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nnte_select" ON public.normativa_normas_tipos_establecimiento;
CREATE POLICY "nnte_select" ON public.normativa_normas_tipos_establecimiento FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.normativa_normas n WHERE n.id = norma_id
          AND (n.consultora_id IS NULL OR is_active_member_of(n.consultora_id)))
);
DROP POLICY IF EXISTS "nnte_write" ON public.normativa_normas_tipos_establecimiento;
CREATE POLICY "nnte_write" ON public.normativa_normas_tipos_establecimiento FOR ALL USING (
  EXISTS (SELECT 1 FROM public.normativa_normas n WHERE n.id = norma_id
          AND ((n.consultora_id IS NULL AND is_developer()) OR (n.consultora_id IS NOT NULL AND is_active_member_of(n.consultora_id))))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.normativa_normas n WHERE n.id = norma_id
          AND ((n.consultora_id IS NULL AND is_developer()) OR (n.consultora_id IS NOT NULL AND is_active_member_of(n.consultora_id))))
);
