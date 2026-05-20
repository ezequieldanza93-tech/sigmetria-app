-- Fix: run_subscription_cron referenciaba trial_used_at_sync (columna inexistente)
CREATE OR REPLACE FUNCTION public.run_subscription_cron()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trialing_expired    int := 0;
  v_view_only_expired   int := 0;
  v_grace_expired       int := 0;
  rec                   record;
BEGIN
  -- trialing → trial_view_only cuando trial_ends_at < now()
  FOR rec IN
    SELECT id, consultora_id FROM public.subscriptions
    WHERE estado = 'trialing'
      AND trial_ends_at < now()
  LOOP
    UPDATE public.subscriptions
    SET estado = 'trial_view_only'
    WHERE id = rec.id;

    UPDATE public.consultoras
    SET trial_used_at = now()
    WHERE id = rec.consultora_id
      AND trial_used_at IS NULL;

    v_trialing_expired := v_trialing_expired + 1;
  END LOOP;

  -- trial_view_only → expired cuando grace_period_ends_at < now()
  FOR rec IN
    SELECT id FROM public.subscriptions
    WHERE estado = 'trial_view_only'
      AND grace_period_ends_at < now()
  LOOP
    UPDATE public.subscriptions
    SET estado = 'expired'
    WHERE id = rec.id;
    v_view_only_expired := v_view_only_expired + 1;
  END LOOP;

  -- grace_period → canceled cuando grace_period_ends_at < now()
  FOR rec IN
    SELECT id FROM public.subscriptions
    WHERE estado = 'grace_period'
      AND grace_period_ends_at < now()
  LOOP
    UPDATE public.subscriptions
    SET estado        = 'canceled',
        canceled_at   = now(),
        cancel_reason = 'grace_period_expired'
    WHERE id = rec.id;
    v_grace_expired := v_grace_expired + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'trialing_to_view_only', v_trialing_expired,
    'view_only_to_expired',  v_view_only_expired,
    'grace_to_canceled',     v_grace_expired,
    'ran_at',                now()
  );
END;
$$;
