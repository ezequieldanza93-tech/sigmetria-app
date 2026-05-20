-- Crea subscripción trialing para consultoras sin subscription
-- Necesario para entornos de demo/dev donde el onboarding no creó la row
INSERT INTO public.subscriptions (consultora_id, plan_id, estado, trial_starts_at, trial_ends_at)
SELECT
  c.id,
  p.id,
  'trialing',
  now(),
  now() + interval '14 days'
FROM public.consultoras c
CROSS JOIN public.plans p
WHERE p.tipo = 'trial'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.consultora_id = c.id
  );
