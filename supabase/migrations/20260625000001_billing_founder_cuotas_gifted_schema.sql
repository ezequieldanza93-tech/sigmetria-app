-- 20260625000001_billing_founder_cuotas_gifted_schema.sql
-- Lanzamiento Sigmetría: columnas y tablas para Programa Fundadores, cuotas anuales
-- (anual en 3 cobros programados) y regalo de planes (super-admin).
-- Idempotente. Aplicado vía Management API (no db push). NO modificar; crear nueva si hace falta.

-- ─── Columnas Fundador en plans ───────────────────────────
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS founder_slots_total integer NOT NULL DEFAULT 8;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS founder_seed_taken  integer NOT NULL DEFAULT 0;

-- ─── Columnas Fundador / tarjeta en subscriptions ─────────
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_founder           boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS founder_discount_pct integer;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS mp_customer_id       text; -- MP customer para cobrar tarjeta guardada (cuotas 2 y 3)

-- ─── Bonus por reseña (Fundadores): video=+3 meses, nota=+1 mes ───
CREATE TABLE IF NOT EXISTS public.founder_review_bonuses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('video','nota')),
  meses_otorgados integer NOT NULL,
  estado          text NOT NULL DEFAULT 'pending' CHECK (estado IN ('pending','verificado','rechazado')),
  url             text,
  verificado_por  uuid REFERENCES auth.users(id),
  verificado_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.founder_review_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frb_select" ON public.founder_review_bonuses;
CREATE POLICY "frb_select" ON public.founder_review_bonuses FOR SELECT
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.consultoras_members cm ON cm.consultora_id = s.consultora_id
    WHERE s.id = founder_review_bonuses.subscription_id
      AND cm.user_id = auth.uid() AND cm.is_active
  )
);

DROP POLICY IF EXISTS "frb_insert" ON public.founder_review_bonuses;
CREATE POLICY "frb_insert" ON public.founder_review_bonuses FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.consultoras_members cm ON cm.consultora_id = s.consultora_id
    WHERE s.id = founder_review_bonuses.subscription_id
      AND cm.user_id = auth.uid() AND cm.is_active AND cm.role = 'full_access_main'
  )
);

-- Verificación (aprobar/rechazar) → solo super-admin
DROP POLICY IF EXISTS "frb_update_super" ON public.founder_review_bonuses;
CREATE POLICY "frb_update_super" ON public.founder_review_bonuses FOR UPDATE
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── Cuotas programadas (anual en 3 cobros) ───────────────
CREATE TABLE IF NOT EXISTS public.payment_installments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  plan_id         uuid REFERENCES public.plans(id),
  ciclo           text NOT NULL DEFAULT 'annual',
  nro_cuota       integer NOT NULL,
  total_cuotas    integer NOT NULL DEFAULT 3,
  monto           numeric(12,2) NOT NULL,
  estado          text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagado','fallido')),
  fecha_programada date NOT NULL,
  mp_payment_id   text,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, nro_cuota)
);
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pi_select" ON public.payment_installments;
CREATE POLICY "pi_select" ON public.payment_installments FOR SELECT
USING (
  public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.consultoras_members cm ON cm.consultora_id = s.consultora_id
    WHERE s.id = payment_installments.subscription_id
      AND cm.user_id = auth.uid() AND cm.is_active
  )
);
-- Escrituras de cuotas: solo vía service role (cron/server). Sin policy de INSERT/UPDATE para usuarios.

-- ─── Regalo de planes (super-admin) ───────────────────────
CREATE TABLE IF NOT EXISTS public.gifted_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  plan_id       uuid NOT NULL REFERENCES public.plans(id),
  ciclo         text NOT NULL DEFAULT 'monthly' CHECK (ciclo IN ('monthly','annual')),
  is_founder    boolean NOT NULL DEFAULT false,
  otorgado_por  uuid REFERENCES auth.users(id),
  estado        text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','activado','cancelado')),
  consultora_id uuid REFERENCES public.consultoras(id),
  nota          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  activated_at  timestamptz
);
-- Índice para el pickup por email en el onboarding (solo regalos pendientes)
CREATE INDEX IF NOT EXISTS gifted_plans_email_pendiente_idx
  ON public.gifted_plans (lower(email)) WHERE estado = 'pendiente';
ALTER TABLE public.gifted_plans ENABLE ROW LEVEL SECURITY;

-- Solo super-admin opera regalos. El pickup en onboarding usa service role.
DROP POLICY IF EXISTS "gp_super_all" ON public.gifted_plans;
CREATE POLICY "gp_super_all" ON public.gifted_plans FOR ALL
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
