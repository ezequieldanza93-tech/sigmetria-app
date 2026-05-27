-- ============================================================
-- Plan Features — Feature flags booleanos por plan
-- ============================================================

CREATE TABLE public.plan_features (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid        NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text        NOT NULL,
  habilitado  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (plan_id, feature_key)
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_features: select"
  ON public.plan_features FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "plan_features: all (super_admin)"
  ON public.plan_features FOR ALL
  TO authenticated
  USING (public.is_developer())
  WITH CHECK (public.is_developer());

CREATE INDEX idx_plan_features_plan ON public.plan_features(plan_id);


-- ============================================================
-- Seed: catálogo base de features por plan
-- ============================================================

INSERT INTO public.plan_features (plan_id, feature_key, habilitado)
SELECT
  p.id,
  f.feature_key,
  CASE
    WHEN p.slug = 'empresa'
      THEN true
    WHEN p.slug = 'consultora-grande' AND f.feature_key IN (
      'export_pdf', 'notificaciones', 'firmas_digitales',
      'mapas_riesgo', 'iperc', 'subcontratistas'
    ) THEN true
    WHEN p.slug = 'consultora-chica' AND f.feature_key IN (
      'export_pdf', 'notificaciones', 'iperc', 'subcontratistas'
    ) THEN true
    WHEN p.slug = 'profesional-independiente' AND f.feature_key IN (
      'export_pdf', 'iperc'
    ) THEN true
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
