-- ============================================================
-- Sigmetría HyS — Ventana de solo-lectura post-trial = 1 AÑO
--
-- Cambio de negocio (decisión Ezequiel): el flujo de suscripción
-- pasa a ser:
--   trialing (30 días, opera)
--     → trial_view_only (365 días, SOLO LECTURA)
--       → expired (bloqueado)
--
-- Antes la ventana de solo-lectura era de 90 días
-- (grace_period_ends_at = trial_ends_at + 90 días). Ahora son 365 días.
--
-- Solo se redefine handle_new_consultora() (el trigger que crea la
-- suscripción trial al dar de alta una consultora NUEVA). Las
-- suscripciones ya existentes NO se tocan acá — se reconcilian aparte
-- (cuentas de armado protegidas).
--
-- Idempotente: CREATE OR REPLACE. No crea ni borra triggers.
--
-- ROLLBACK (volver a 90 días):
--   reemplazar INTERVAL '365 days' por INTERVAL '90 days' en la función.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_consultora()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'trial' LIMIT 1;

  INSERT INTO public.subscriptions (
    consultora_id,
    plan_id,
    estado,
    trial_starts_at,
    trial_ends_at,
    grace_period_ends_at
  ) VALUES (
    NEW.id,
    v_plan_id,
    'trialing',
    now(),
    now() + INTERVAL '30 days',                       -- 30 días de trial operativo
    now() + INTERVAL '30 days' + INTERVAL '365 days'  -- + 1 año de solo-lectura, luego expira
  );

  RETURN NEW;
END;
$$;
