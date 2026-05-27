-- ============================================================
-- Plans — Admin fields: tipo TEXT, sort_order, is_visible,
--          descripcion_corta, destacado + RLS update
-- ============================================================

-- 1. Cambiar plan_tipo ENUM → TEXT para permitir tipos dinámicos desde admin
ALTER TABLE public.plans
  ALTER COLUMN tipo TYPE text;


-- 2. Nuevas columnas admin
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS sort_order        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_visible        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS descripcion_corta text,
  ADD COLUMN IF NOT EXISTS destacado         boolean NOT NULL DEFAULT false;


-- 3. Seed: orden, descripción y visibilidad inicial
UPDATE public.plans SET
  sort_order        = 0,
  is_visible        = false
WHERE slug = 'trial';

UPDATE public.plans SET
  sort_order        = 1,
  descripcion_corta = 'Para profesionales que trabajan solos'
WHERE slug = 'profesional-independiente';

UPDATE public.plans SET
  sort_order        = 2,
  descripcion_corta = 'Para consultoras con equipo pequeño'
WHERE slug = 'consultora-chica';

UPDATE public.plans SET
  sort_order        = 3,
  descripcion_corta = 'Para consultoras en crecimiento',
  destacado         = true
WHERE slug = 'consultora-grande';

UPDATE public.plans SET
  sort_order        = 4,
  descripcion_corta = 'Solución enterprise a medida'
WHERE slug = 'empresa';


-- 4. Índice para listado ordenado
CREATE INDEX IF NOT EXISTS idx_plans_sort_order ON public.plans(sort_order);


-- 5. Actualizar RLS SELECT: usuarios ven solo visible+activo; admin ve todo
DROP POLICY IF EXISTS "plans: select" ON public.plans;
CREATE POLICY "plans: select"
  ON public.plans FOR SELECT
  TO authenticated
  USING (
    (is_active = true AND is_visible = true)
    OR public.is_developer()
  );
