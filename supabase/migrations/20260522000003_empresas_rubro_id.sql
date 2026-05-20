-- ============================================================
-- Replace rubro (text) with rubro_id (FK → empresas_rubros)
-- ============================================================

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS rubro_id uuid REFERENCES public.empresas_rubros(id) ON DELETE SET NULL;

-- Auto-link existing text rubros that match seeded names (case-insensitive)
UPDATE public.empresas e
  SET rubro_id = r.id
  FROM public.empresas_rubros r
  WHERE e.rubro IS NOT NULL
    AND LOWER(TRIM(e.rubro)) = LOWER(TRIM(r.nombre));

-- Keep rubro text column for backward compatibility during deploy
