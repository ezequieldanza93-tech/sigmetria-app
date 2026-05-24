-- 1. Cambiar plan_tipo de ENUM a TEXT para permitir tipos dinámicos
ALTER TABLE public.plans ALTER COLUMN tipo TYPE text;

-- Drop el ENUM ya no usado
DROP TYPE IF EXISTS public.plan_tipo;

-- 2. Agregar columnas para admin: orden, visibilidad, descripción, destacado
ALTER TABLE public.plans
  ADD COLUMN sort_order          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN is_visible          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN descripcion_corta   TEXT,
  ADD COLUMN destacado           BOOLEAN NOT NULL DEFAULT false;

-- Seed para orden inicial (todo visible, trial oculto)
UPDATE public.plans SET sort_order = 1,  descripcion_corta = 'Para profesionales independientes' WHERE slug = 'profesional-independiente';
UPDATE public.plans SET sort_order = 2,  descripcion_corta = 'Para consultoras con equipo pequeño' WHERE slug = 'consultora-chica';
UPDATE public.plans SET sort_order = 3,  descripcion_corta = 'Para consultoras en crecimiento' WHERE slug = 'consultora-grande';
UPDATE public.plans SET sort_order = 4,  descripcion_corta = 'Solución enterprise a medida' WHERE slug = 'empresa';
UPDATE public.plans SET sort_order = 0,  is_visible = false WHERE slug = 'trial';

-- 3. Feature flags por plan
CREATE TABLE public.plan_features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  habilitado  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_features: select" ON public.plan_features
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "plan_features: all (super_admin)" ON public.plan_features
  FOR ALL TO authenticated USING (public.is_developer()) WITH CHECK (public.is_developer());

CREATE INDEX idx_plan_features_plan ON public.plan_features(plan_id);

-- Seed de features para planes existentes
INSERT INTO public.plan_features (plan_id, feature_key, habilitado)
SELECT p.id, f.feature_key, 
  CASE 
    WHEN p.slug = 'empresa' THEN true
    WHEN p.slug = 'consultora-grande' AND f.feature_key IN ('export_pdf','notificaciones','firmas_digitales','mapas_riesgo','iperc','subcontratistas') THEN true
    WHEN p.slug = 'consultora-chica' AND f.feature_key IN ('export_pdf','notificaciones','iperc','subcontratistas') THEN true
    WHEN p.slug = 'profesional-independiente' AND f.feature_key IN ('export_pdf','iperc') THEN true
    ELSE false
  END
FROM public.plans p
CROSS JOIN (
  VALUES 
    ('export_pdf'),
    ('export_excel'),
    ('notificaciones'),
    ('firmas_digitales'),
    ('mapas_riesgo'),
    ('iperc'),
    ('subcontratistas'),
    ('denuncias_incidentes'),
    ('workflow_aprobaciones'),
    ('capacitaciones'),
    ('api_webhooks'),
    ('multi_idioma'),
    ('modo_offline'),
    ('sso'),
    ('auditoria_seguridad')
) AS f(feature_key)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- 4. Actualizar RLS de plans para que super_admin vea todos
DROP POLICY IF EXISTS "plans: select" ON public.plans;
CREATE POLICY "plans: select" ON public.plans
  FOR SELECT TO authenticated
  USING (is_visible = true OR public.is_developer());

DROP POLICY IF EXISTS "plans: insert (super_admin)" ON public.plans;
CREATE POLICY "plans: insert" ON public.plans
  FOR INSERT WITH CHECK (public.is_developer());

DROP POLICY IF EXISTS "plans: update (super_admin)" ON public.plans;
CREATE POLICY "plans: update" ON public.plans
  FOR UPDATE USING (public.is_developer());

DROP POLICY IF EXISTS "plans: delete (super_admin)" ON public.plans;
CREATE POLICY "plans: delete" ON public.plans
  FOR DELETE USING (public.is_developer());
