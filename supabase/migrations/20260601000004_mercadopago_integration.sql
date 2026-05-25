-- ============================================================
-- MERCADO PAGO — Integración de suscripciones recurrentes
-- ============================================================

-- Plans: agregar referencia a MP (tipo ya existe como enum plan_tipo)
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS mp_preapproval_plan_id text,
  ADD COLUMN IF NOT EXISTS auto_billing_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS plans_mp_preapproval_plan_id_idx ON public.plans (mp_preapproval_plan_id);

-- Subscriptions: agregar campos MP (mp_subscription_id ya existe)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS mp_payer_id text,
  ADD COLUMN IF NOT EXISTS mp_payer_email text,
  ADD COLUMN IF NOT EXISTS mp_init_point text,
  ADD COLUMN IF NOT EXISTS mp_status text,
  ADD COLUMN IF NOT EXISTS metodo_pago text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS plan_id_pendiente uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aplicar_cambio_en timestamptz,
  ADD COLUMN IF NOT EXISTS past_due_grace_until timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS subs_mp_preapproval_idx ON public.subscriptions (mp_preapproval_id);
CREATE INDEX IF NOT EXISTS subs_estado_grace_idx ON public.subscriptions (estado, past_due_grace_until) WHERE estado = 'past_due';
CREATE INDEX IF NOT EXISTS subs_plan_id_pendiente_idx ON public.subscriptions (aplicar_cambio_en) WHERE plan_id_pendiente IS NOT NULL;

-- Payments: agregar campos MP
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS mp_payment_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS mp_status text,
  ADD COLUMN IF NOT EXISTS mp_status_detail text,
  ADD COLUMN IF NOT EXISTS mp_payment_method text,
  ADD COLUMN IF NOT EXISTS mp_payment_type text,
  ADD COLUMN IF NOT EXISTS mp_card_last4 text,
  ADD COLUMN IF NOT EXISTS mp_card_brand text,
  ADD COLUMN IF NOT EXISTS mp_external_reference text,
  ADD COLUMN IF NOT EXISTS es_prorrata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_url text;

CREATE INDEX IF NOT EXISTS payments_mp_payment_id_idx ON public.payments (mp_payment_id);
CREATE INDEX IF NOT EXISTS payments_mp_external_ref_idx ON public.payments (mp_external_reference);

-- Consultoras: agregar tipo (profesional vs consultora)
ALTER TABLE public.consultoras
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'profesional' CHECK (tipo IN ('profesional', 'consultora'));

-- ============================================================
-- Tabla nueva: mercadopago_webhook_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mercadopago_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  data_id text NOT NULL,
  request_id text,
  signature_valid boolean NOT NULL,
  payload jsonb NOT NULL,
  procesado boolean NOT NULL DEFAULT false,
  respuesta_status int,
  error text,
  recibido_at timestamptz NOT NULL DEFAULT now(),
  procesado_at timestamptz,
  UNIQUE (topic, data_id, request_id)
);

CREATE INDEX IF NOT EXISTS mp_webhook_log_topic_data_idx ON public.mercadopago_webhook_log (topic, data_id);
CREATE INDEX IF NOT EXISTS mp_webhook_log_no_procesado_idx ON public.mercadopago_webhook_log (recibido_at) WHERE procesado = false;
CREATE INDEX IF NOT EXISTS mp_webhook_log_recibido_idx ON public.mercadopago_webhook_log (recibido_at DESC);

ALTER TABLE public.mercadopago_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_webhook_log: super_admin all"
  ON public.mercadopago_webhook_log
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- Helper functions
-- ============================================================

-- has_grace_period_subscription: para gate de creación en past_due
CREATE OR REPLACE FUNCTION public.has_grace_period_subscription(p_consultora_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE consultora_id = p_consultora_id
      AND estado IN ('active', 'trialing')
    UNION ALL
    SELECT 1 FROM public.subscriptions
    WHERE consultora_id = p_consultora_id
      AND estado = 'past_due'
      AND past_due_grace_until IS NOT NULL
      AND past_due_grace_until > now()
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_grace_period_subscription(uuid) TO authenticated;

-- Setear grace period cuando entra en past_due (trigger)
CREATE OR REPLACE FUNCTION public.subscriptions_set_grace_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estado = 'past_due' AND (OLD.estado IS NULL OR OLD.estado != 'past_due') THEN
    NEW.past_due_grace_until := now() + INTERVAL '7 days';
  END IF;
  IF NEW.estado IN ('active', 'trialing') AND OLD.estado = 'past_due' THEN
    NEW.past_due_grace_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_grace_period ON public.subscriptions;
CREATE TRIGGER subscriptions_grace_period
  BEFORE UPDATE OF estado ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.subscriptions_set_grace_period();
