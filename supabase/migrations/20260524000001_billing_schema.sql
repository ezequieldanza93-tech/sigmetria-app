-- ============================================================
-- Sigmetría HyS — Billing Schema
-- Plans, subscriptions, payments, audit log, impersonation log
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS impersonation_log, subscription_audit_log,
--     manual_payments, payments, subscriptions_add_ons,
--     subscriptions, plans CASCADE;
--   DROP TYPE IF EXISTS plan_tipo, subscription_estado,
--     subscription_periodo, payment_provider, payment_estado,
--     add_on_tipo;
-- ============================================================


-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE public.plan_tipo AS ENUM (
  'trial',
  'profesional_independiente',
  'consultora_chica',
  'consultora_grande',
  'empresa'
);

CREATE TYPE public.subscription_estado AS ENUM (
  'trialing',
  'trial_view_only',
  'active',
  'past_due',
  'grace_period',
  'canceled',
  'expired'
);

CREATE TYPE public.subscription_periodo AS ENUM (
  'monthly',
  'annual'
);

CREATE TYPE public.payment_provider AS ENUM (
  'mercadopago',
  'manual'
);

CREATE TYPE public.payment_estado AS ENUM (
  'pending',
  'approved',
  'rejected',
  'refunded'
);

CREATE TYPE public.add_on_tipo AS ENUM (
  'extra_colaborador_seat'
);


-- ============================================================
-- plans — parámetros por plan (nunca hardcodear en app code)
-- ============================================================
CREATE TABLE public.plans (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                    text NOT NULL,
  slug                      text NOT NULL UNIQUE,
  tipo                      public.plan_tipo NOT NULL,

  -- Precios en ARS (neto, sin IVA)
  -- NULL = plan manual/a medida (empresa)
  precio_mensual_neto       numeric(12,2),
  precio_anual_neto         numeric(12,2),

  -- IVA fijo 21%
  iva_porcentaje            numeric(5,2) NOT NULL DEFAULT 21.00,

  -- Límites operativos
  -- NULL = ilimitado
  max_colaboradores         int,          -- pago, cuenta contra cupo
  max_empresas              int,
  max_establecimientos      int,
  max_gestiones_registros   int,          -- hard limit de registros en gestiones
  max_horarios_registros    int,          -- hard limit de registros de horario

  -- visualizadores: siempre ilimitados, no modelar límite acá
  -- add-ons: gestionados en subscriptions_add_ons

  -- Precio por seat adicional (ARS neto)
  precio_extra_seat_neto    numeric(12,2) DEFAULT 15000.00,

  is_active                 boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Solo super_admin puede modificar planes
-- SELECT: cualquier usuario autenticado (lo necesita la UI de selección de plan)
CREATE POLICY "plans: select"
  ON public.plans FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "plans: insert (super_admin)"
  ON public.plans FOR INSERT
  WITH CHECK (public.is_developer());

CREATE POLICY "plans: update (super_admin)"
  ON public.plans FOR UPDATE
  USING (public.is_developer());

CREATE POLICY "plans: delete (super_admin)"
  ON public.plans FOR DELETE
  USING (public.is_developer());


-- ============================================================
-- subscriptions — estado de suscripción por consultora
-- ============================================================
CREATE TABLE public.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id           uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  plan_id                 uuid NOT NULL REFERENCES public.plans(id),

  estado                  public.subscription_estado NOT NULL DEFAULT 'trialing',
  periodo                 public.subscription_periodo,           -- NULL en trial

  -- Ventana temporal del período activo
  current_period_start    timestamptz,
  current_period_end      timestamptz,

  -- Trial
  trial_starts_at         timestamptz,
  trial_ends_at           timestamptz,

  -- Grace period tras fallo de pago o vencimiento de trial_view_only
  grace_period_ends_at    timestamptz,

  -- Referencia al proveedor de pago (MP)
  mp_subscription_id      text UNIQUE,

  -- Cancelación
  canceled_at             timestamptz,
  cancel_reason           text,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  -- Una sola suscripción activa por consultora
  CONSTRAINT uq_consultora_active_subscription
    UNIQUE (consultora_id)
);

CREATE INDEX idx_subscriptions_estado ON public.subscriptions (estado);
CREATE INDEX idx_subscriptions_consultora ON public.subscriptions (consultora_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: select"
  ON public.subscriptions FOR SELECT
  USING (
    public.is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.consultora_id = subscriptions.consultora_id
        AND cm.is_active = true
    )
  );

-- Solo super_admin o el sistema (service role) puede insertar/actualizar
CREATE POLICY "subscriptions: insert"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_developer());

CREATE POLICY "subscriptions: update"
  ON public.subscriptions FOR UPDATE
  USING (public.is_developer());

CREATE POLICY "subscriptions: delete"
  ON public.subscriptions FOR DELETE
  USING (public.is_developer());


-- ============================================================
-- subscriptions_add_ons — add-ons activos por suscripción
-- ============================================================
CREATE TABLE public.subscriptions_add_ons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tipo                public.add_on_tipo NOT NULL,
  cantidad            int NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario_neto numeric(12,2) NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions_add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_add_ons: select"
  ON public.subscriptions_add_ons FOR SELECT
  USING (
    public.is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.subscriptions s
      JOIN public.consultoras_members cm ON cm.consultora_id = s.consultora_id
      WHERE s.id = subscriptions_add_ons.subscription_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
    )
  );

CREATE POLICY "subscriptions_add_ons: insert"
  ON public.subscriptions_add_ons FOR INSERT
  WITH CHECK (public.is_developer());

CREATE POLICY "subscriptions_add_ons: update"
  ON public.subscriptions_add_ons FOR UPDATE
  USING (public.is_developer());


-- ============================================================
-- payments — todos los intentos de pago (MP + manual)
-- ============================================================
CREATE TABLE public.payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id       uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  provider              public.payment_provider NOT NULL,

  -- ID del pago en el proveedor (MP payment_id, o referencia manual)
  provider_payment_id   text,

  -- Montos en ARS
  monto_neto            numeric(12,2) NOT NULL,
  iva_porcentaje        numeric(5,2)  NOT NULL DEFAULT 21.00,
  monto_iva             numeric(12,2) GENERATED ALWAYS AS (monto_neto * iva_porcentaje / 100) STORED,
  monto_total           numeric(12,2) GENERATED ALWAYS AS (monto_neto * (1 + iva_porcentaje / 100)) STORED,
  moneda                char(3)       NOT NULL DEFAULT 'ARS',

  estado                public.payment_estado NOT NULL DEFAULT 'pending',

  -- Período que cubre este pago
  periodo_desde         date,
  periodo_hasta         date,

  -- Payload crudo del proveedor (para auditoría y debugging)
  raw_payload           jsonb,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_subscription ON public.payments (subscription_id);
CREATE INDEX idx_payments_provider_id  ON public.payments (provider, provider_payment_id);
CREATE INDEX idx_payments_estado        ON public.payments (estado);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: select"
  ON public.payments FOR SELECT
  USING (
    public.is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.subscriptions s
      JOIN public.consultoras_members cm ON cm.consultora_id = s.consultora_id
      WHERE s.id = payments.subscription_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role = 'full_access_main'
    )
  );

CREATE POLICY "payments: insert"
  ON public.payments FOR INSERT
  WITH CHECK (public.is_developer());

CREATE POLICY "payments: update"
  ON public.payments FOR UPDATE
  USING (public.is_developer());


-- ============================================================
-- manual_payments — detalle de transferencias manuales
-- ============================================================
CREATE TABLE public.manual_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  numero_operacion    text NOT NULL,
  notas               text,
  confirmado_por      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmado_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_payments: select"
  ON public.manual_payments FOR SELECT
  USING (
    public.is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.payments p
      JOIN public.subscriptions s ON s.id = p.subscription_id
      JOIN public.consultoras_members cm ON cm.consultora_id = s.consultora_id
      WHERE p.id = manual_payments.payment_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role = 'full_access_main'
    )
  );

-- El usuario puede insertar su propio comprobante
CREATE POLICY "manual_payments: insert"
  ON public.manual_payments FOR INSERT
  WITH CHECK (
    public.is_developer()
    OR EXISTS (
      SELECT 1
      FROM public.payments p
      JOIN public.subscriptions s ON s.id = p.subscription_id
      JOIN public.consultoras_members cm ON cm.consultora_id = s.consultora_id
      WHERE p.id = payment_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role = 'full_access_main'
    )
  );

-- Solo super_admin puede confirmar
CREATE POLICY "manual_payments: update"
  ON public.manual_payments FOR UPDATE
  USING (public.is_developer());


-- ============================================================
-- subscription_audit_log — historial de cambios de estado
-- ============================================================
CREATE TABLE public.subscription_audit_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  estado_anterior     public.subscription_estado,
  estado_nuevo        public.subscription_estado NOT NULL,
  motivo              text,
  actor_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_audit_subscription ON public.subscription_audit_log (subscription_id);
CREATE INDEX idx_sub_audit_created      ON public.subscription_audit_log (created_at DESC);

ALTER TABLE public.subscription_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_audit_log: select"
  ON public.subscription_audit_log FOR SELECT
  USING (public.is_developer());

CREATE POLICY "subscription_audit_log: insert"
  ON public.subscription_audit_log FOR INSERT
  WITH CHECK (public.is_developer());


-- ============================================================
-- impersonation_log — registro obligatorio de impersonaciones
-- ============================================================
CREATE TABLE public.impersonation_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  ip_address          inet,
  session_token_hash  text,
  notas               text
);

CREATE INDEX idx_impersonation_admin  ON public.impersonation_log (super_admin_id);
CREATE INDEX idx_impersonation_target ON public.impersonation_log (target_user_id);
CREATE INDEX idx_impersonation_time   ON public.impersonation_log (started_at DESC);

ALTER TABLE public.impersonation_log ENABLE ROW LEVEL SECURITY;

-- Solo super_admin puede ver y escribir logs de impersonación
CREATE POLICY "impersonation_log: select"
  ON public.impersonation_log FOR SELECT
  USING (public.is_developer());

CREATE POLICY "impersonation_log: insert"
  ON public.impersonation_log FOR INSERT
  WITH CHECK (public.is_developer());

CREATE POLICY "impersonation_log: update"
  ON public.impersonation_log FOR UPDATE
  USING (public.is_developer());


-- ============================================================
-- updated_at triggers para tablas nuevas
-- ============================================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.subscriptions_add_ons
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ============================================================
-- FUNCIÓN: registrar cambio de estado de suscripción
-- Llamada siempre que cambia subscriptions.estado
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_subscription_state_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.subscription_audit_log (
      subscription_id,
      estado_anterior,
      estado_nuevo,
      motivo,
      actor_id
    ) VALUES (
      NEW.id,
      OLD.estado,
      NEW.estado,
      TG_ARGV[0],
      (SELECT auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_audit_state
  AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.log_subscription_state_change();


-- ============================================================
-- FUNCIÓN: has_active_subscription
-- Devuelve true si la consultora tiene suscripción que permite
-- operaciones de escritura (active o trialing)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_consultora_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE consultora_id = p_consultora_id
      AND estado IN ('active', 'trialing')
  )
$$;


-- ============================================================
-- FUNCIÓN: get_subscription_state
-- Devuelve el estado actual de la suscripción de una consultora
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_subscription_state(p_consultora_id uuid)
RETURNS public.subscription_estado
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT estado FROM public.subscriptions
  WHERE consultora_id = p_consultora_id
  LIMIT 1
$$;


-- ============================================================
-- FUNCIÓN: get_plan_limits
-- Devuelve los límites efectivos de una consultora
-- (plan base + add-ons de seats)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_consultora_id uuid)
RETURNS TABLE (
  max_colaboradores       int,
  max_empresas            int,
  max_establecimientos    int,
  max_gestiones_registros int,
  max_horarios_registros  int,
  precio_extra_seat_neto  numeric
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    p.max_colaboradores
      + COALESCE((
          SELECT SUM(a.cantidad)
          FROM public.subscriptions_add_ons a
          WHERE a.subscription_id = s.id
            AND a.tipo = 'extra_colaborador_seat'
            AND a.is_active = true
        ), 0)::int                          AS max_colaboradores,
    p.max_empresas                          AS max_empresas,
    p.max_establecimientos                  AS max_establecimientos,
    p.max_gestiones_registros               AS max_gestiones_registros,
    p.max_horarios_registros                AS max_horarios_registros,
    p.precio_extra_seat_neto                AS precio_extra_seat_neto
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.consultora_id = p_consultora_id
  LIMIT 1
$$;


-- ============================================================
-- SEED: planes iniciales
-- ============================================================
INSERT INTO public.plans (
  nombre, slug, tipo,
  precio_mensual_neto, precio_anual_neto,
  max_colaboradores, max_empresas, max_establecimientos,
  max_gestiones_registros, max_horarios_registros,
  precio_extra_seat_neto
) VALUES

-- Trial: límites restrictivos, sin precio
(
  'Trial', 'trial', 'trial',
  NULL, NULL,
  0, 2, 5,
  200, 200,
  NULL
),

-- Profesional Independiente
(
  'Profesional Independiente', 'profesional-independiente', 'profesional_independiente',
  16900.00, 162240.00,
  0, 20, 40,
  NULL, NULL,
  15000.00
),

-- Consultora Chica
(
  'Consultora Chica', 'consultora-chica', 'consultora_chica',
  26320.00, 252672.00,
  3, 8, 80,
  NULL, NULL,
  15000.00
),

-- Consultora Grande
(
  'Consultora Grande', 'consultora-grande', 'consultora_grande',
  34000.00, 326400.00,
  6, 45, NULL,
  NULL, NULL,
  15000.00
),

-- Empresa (a medida, sin precios ni límites fijos)
(
  'Empresa', 'empresa', 'empresa',
  NULL, NULL,
  NULL, NULL, NULL,
  NULL, NULL,
  15000.00
);
