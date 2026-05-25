# Mercado Pago — Suscripciones Recurrentes Automáticas

## Objetivo
Integrar Mercado Pago para que las consultoras (y profesionales independientes) puedan suscribirse a un plan y pagarlo automáticamente todos los meses sin intervención manual. Reemplaza el flujo actual de `manual_payments` para los usuarios que adopten cobro automático.

Incluye: alta de suscripción, webhook handler con verificación HMAC, sync de pagos en `payments`, cambio de plan con prorrateo (solo full_access_main), cancelación del usuario, dunning automático para pagos fallidos, "customer portal" en `/dashboard/billing`, y conversión de cuenta profesional → consultora.

NO incluye: cobros internacionales, multi-moneda, integraciones con otros gateways. Solo MP, ARS, Argentina.

## Stack
- Next.js 15 App Router (API routes + server actions)
- Supabase PostgreSQL 17 con RLS
- `mercadopago` (SDK oficial de MP) — agregar a deps
- `crypto` (built-in Node) para verificación HMAC del webhook
- Zod 4 (validación)
- TanStack React Query 5
- Tailwind + shadcn primitives + custom UI
- Toast (`lib/hooks/use-toast.ts`)
- useActionState (no react-hook-form)

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| API de MP | **Preapproval + Preapproval Plan** (única forma sensata de recurring billing). NO Checkout Pro. |
| Mapeo de planes | Cada `plans` row tiene un `mp_preapproval_plan_id`. Si NULL, ese plan no acepta cobro automático todavía (admin lo sincroniza después). |
| Cambio de plan | Permitido solo a `full_access_main` (o super_admin). Con prorrateo: upgrade cobra prorrata inmediata, downgrade aplica al próximo ciclo. |
| Conversión profesional → consultora | Un profesional independiente (plan con `tipo='profesional'`) puede "convertirse en consultora" cambiando a un plan con `tipo='consultora'`. Esto habilita multi-seat. Es un plan change + un flag en la consultora. |
| Cancelación | Permitida al usuario `full_access_main` desde la app. Inmediata (cancela en MP) pero acceso sigue hasta `current_period_end`. Después pasa a `cancelled`. |
| Grace period | Después de 3 reintentos fallidos de MP (manejado por MP automáticamente), la subscripción entra en `past_due`. 7 días de gracia con acceso degradado (banner amarillo, no se puede crear nada nuevo). Después de 7 días → `cancelled`. |
| Dunning | MP maneja los reintentos automáticamente (la política la setea MP). Nosotros solo reaccionamos a los webhooks. |
| Receipts | NO se manda email. Notificación in-app via tabla `notificaciones` ya existente. |
| Currency | ARS exclusivamente. |
| Trial period | Respeta el `trial_dias` del plan existente. MP lo soporta nativamente via `auto_recurring.free_trial`. |
| Sandbox vs prod | Toggle via env var `MERCADOPAGO_ENV=sandbox|production`. Tokens distintos por env. |
| Webhook signature | Verificación HMAC obligatoria con `MERCADOPAGO_WEBHOOK_SECRET`. Si falla → 401, no procesar. |
| Idempotencia | Webhook handler es idempotente: si el evento ya se procesó (lookup en `mercadopago_webhook_log`), responde 200 sin re-procesar. |
| Audit | Cada cambio de estado de suscripción se loguea en `subscription_audit_log` (tabla existente). Cada webhook recibido se loguea en `mercadopago_webhook_log` (nueva). |

## Requerimientos funcionales

### 1. Configuración

**Env vars nuevas** (agregar a `.env.example` y Vercel):
```
MERCADOPAGO_ACCESS_TOKEN=APP_USR-... (prod) / TEST-... (sandbox)
MERCADOPAGO_PUBLIC_KEY=APP_USR-... / TEST-...
MERCADOPAGO_WEBHOOK_SECRET=...  (configurado en panel MP)
MERCADOPAGO_ENV=production | sandbox
NEXT_PUBLIC_APP_URL=https://...  (ya existe, asegurarse que está)
```

**Cliente MP**: helper en `lib/mercadopago/client.ts`:
```ts
import { MercadoPagoConfig, PreApproval, PreApprovalPlan, Payment } from 'mercadopago'

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  options: { timeout: 10000, idempotencyKey: undefined },
})

export const mpPreApproval = new PreApproval(mpClient)
export const mpPreApprovalPlan = new PreApprovalPlan(mpClient)
export const mpPayment = new Payment(mpClient)
```

### 2. Sync de planes (admin)

**Página `/dashboard/admin/planes/[id]/editar`** (ya existe, extender):
- Agregar sección "Cobro automático Mercado Pago":
  - Si `mp_preapproval_plan_id` está vacío → botón "Sincronizar con MP" → crea el plan en MP
  - Si está sincronizado → muestra ID + botón "Re-sincronizar" + estado activo/inactivo
- Server action `sincronizarPlanMP(planId)`:
  1. Lee el plan de la DB
  2. Llama a `mpPreApprovalPlan.create({ body: { reason: plan.nombre, auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: plan.precio_ars, currency_id: 'ARS', free_trial: trial_dias > 0 ? { frequency: trial_dias, frequency_type: 'days' } : undefined }, back_url: `${APP_URL}/dashboard/billing/checkout/success`, payment_methods_allowed: {...} } })`
  3. Guarda `response.id` en `plans.mp_preapproval_plan_id`
- Si el plan se actualiza (precio o nombre): re-sync usando `mpPreApprovalPlan.update(...)`. MP NO permite cambiar precio de plans con subscriptions activas → en ese caso, crear un plan NUEVO en MP y migrar.

### 3. Alta de suscripción (usuario)

**Página `/dashboard/billing`** (ya existe, extender):
- Si la consultora tiene `subscriptions.estado IN ('trialing', 'active')` → mostrar info de la suscripción + botones (cambiar plan, cancelar, actualizar tarjeta)
- Si está en `past_due` → banner rojo + botón "Actualizar método de pago"
- Si NO tiene suscripción activa (canceled/expired) → mostrar grilla de planes disponibles + botón "Suscribirme"
- Solo `full_access_main` o `super_admin` ven los botones de mutación. Para otros roles → solo lectura.

**Flujo alta** (botón "Suscribirme"):
1. Server action `iniciarSuscripcionMP(planId)`:
   - Verifica que user es `full_access_main` de la consultora
   - Verifica que no haya una sub activa
   - Verifica que el plan tenga `mp_preapproval_plan_id`
   - Llama a `mpPreApproval.create({ body: { preapproval_plan_id: plan.mp_preapproval_plan_id, payer_email: user.email, back_url: `${APP_URL}/dashboard/billing/checkout/success`, reason: `Suscripción ${plan.nombre}`, external_reference: subscription.id, status: 'pending' } })`
   - Inserta `subscriptions` con estado `pending`, `mp_preapproval_id`, `mp_init_point=response.init_point`
   - Retorna `{ init_point: response.init_point }` al cliente
2. Frontend redirige a `init_point` (URL de checkout de MP)
3. Usuario carga tarjeta en MP
4. MP redirige a `/dashboard/billing/checkout/success?preapproval_id=...`
5. Webhook llega en paralelo → activa la subscripción

**Página `/dashboard/billing/checkout/success`**:
- Muestra "¡Listo! Estamos activando tu suscripción..."
- Polling cada 2s al server action `obtenerEstadoSuscripcion()` hasta que `estado='active'` o pasa 30s
- Si pasa 30s y sigue pending → mostrar "Tomamos tu pago. Recibirás confirmación en minutos."

**Páginas `/dashboard/billing/checkout/failure`** y `/pending`** : mensajes apropiados con CTA "Volver a intentar" / "Estado actual".

### 4. Webhook handler

**Endpoint `app/api/mercadopago/webhook/route.ts`**:

MP envía webhooks tipo:
- `payment` (con id del pago) — preguntar a MP por detalles
- `subscription_preapproval` (con id del preapproval) — cambios de estado de la sub
- `subscription_authorized_payment` — pago automático recurrente
- `plan` — cambios en planes

Flujo:
1. Recibir POST con `x-signature` y `x-request-id` headers
2. **Verificar HMAC**:
   ```ts
   const xSignature = req.headers.get('x-signature')!
   const xRequestId = req.headers.get('x-request-id')!
   const { data } = await req.json()
   const dataId = req.nextUrl.searchParams.get('data.id')
   const ts = xSignature.match(/ts=(\d+)/)![1]
   const sig = xSignature.match(/v1=([a-f0-9]+)/)![1]
   const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
   const hmac = crypto.createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET!).update(manifest).digest('hex')
   if (hmac !== sig) return NextResponse.json({ error: 'bad signature' }, { status: 401 })
   ```
3. Insertar en `mercadopago_webhook_log` con `procesado=false`. Si ya existe el mismo `(topic, data_id)` → 200 sin re-procesar (idempotencia).
4. Según el `topic`:
   - `payment` → fetch `mpPayment.get(id)` → si está asociado a una `preapproval_id` (recurring), insertar/actualizar `payments` row, actualizar `subscriptions.current_period_end` si aprobado
   - `subscription_preapproval` → fetch `mpPreApproval.get(id)` → actualizar `subscriptions.estado` según `status`:
     - `pending` → estado `pending`
     - `authorized` → estado `active` (o `trialing` si trial está activo) + setear `current_period_start`/`end`
     - `paused` → estado `past_due`
     - `cancelled` → estado `cancelled`
   - `subscription_authorized_payment` → es un pago recurrente exitoso, mismo que `payment`
5. Insertar entrada en `subscription_audit_log` con el cambio
6. Marcar `mercadopago_webhook_log.procesado=true`, guardar `respuesta_status`
7. Responder 200

**Importante**: el handler debe responder 200 RÁPIDO (MP timeout a los 22s y reintenta). Si el procesamiento es lento, encolar (no aplica acá, pero mantener fast path).

### 5. Cambio de plan (con prorrateo)

**Restricción**: solo `full_access_main` o `super_admin`.

**Server action `cambiarPlanMP(nuevoPlanId)`**:
1. Verifica permisos
2. Lee la suscripción actual + plan actual + plan nuevo
3. Calcula si es upgrade (precio nuevo > precio actual) o downgrade
4. Si **upgrade**:
   - Calcula prorrata: días restantes del ciclo × (precio nuevo - precio actual) / días del ciclo
   - Si prorrata > 0, crear un pago one-off en MP con `mpPayment.create({...transaction_amount: prorrata...})` usando el método de pago guardado del usuario (`payer.id` del preapproval)
   - Actualiza el `preapproval_plan_id` de la sub con `mpPreApproval.update({ id, body: { preapproval_plan_id: nuevoPlan.mp_preapproval_plan_id } })`
   - Update `subscriptions.plan_id` en DB
   - Insert en `subscription_audit_log`
5. Si **downgrade**:
   - NO cobra prorrata
   - Marca `subscriptions.plan_id_pendiente = nuevoPlanId` + `subscription.aplicar_en = current_period_end`
   - El cron `/api/cron/aplicar-cambios-plan` (correr diario) aplica los cambios cuando llega la fecha
   - O alternativa más simple: hacer el switch del preapproval_plan al final del ciclo via webhook

**UI** `/dashboard/billing/cambiar-plan`:
- Grilla de planes disponibles
- Plan actual marcado
- Para cada plan diferente: precio + diferencial + indicador "Upgrade (+$X ahora)" o "Downgrade (efectivo el [fecha])"
- Botón "Cambiar"
- Modal de confirmación con detalle de prorrata (si aplica)

### 6. Conversión profesional → consultora

**Contexto**: hay dos tipos de planes en `plans.tipo`:
- `profesional` — single user, sin equipo
- `consultora` — multi-seat, equipo

**Flujo**:
- Usuario con plan profesional ve botón "Convertirme en consultora" en `/dashboard/billing`
- Click → wizard de 2 pasos:
  1. Selección de plan consultora (grilla de planes con `tipo='consultora'`)
  2. Confirmación: "Vas a convertirte en consultora. Tu cuenta actual pasa a ser `full_access_main`. Podrás invitar más miembros."
- Server action `convertirAConsultora(nuevoPlanId)`:
  - Actualiza `consultoras.tipo='consultora'` (o flag equivalente)
  - Habilita invitaciones de miembros en la UI
  - Cambia el plan en MP siguiendo el flujo de cambio de plan (con prorrata)
- Una vez convertido, el usuario ve el menu de "Gestionar equipo" en su sidebar

NOTA: si `consultoras.tipo` no existe todavía, agregar columna en la migración. Default `'profesional'`.

### 7. Cancelación

**Solo `full_access_main` o `super_admin`** desde `/dashboard/billing`.

**Server action `cancelarSuscripcion(motivo?: string)`**:
1. Verifica permisos
2. Llama a `mpPreApproval.update({ id: preapproval_id, body: { status: 'cancelled' } })`
3. Actualiza `subscriptions.estado='cancelled'`, `cancelled_at=now()`, `motivo_cancelacion=motivo`
4. NO revoca acceso inmediato. El user sigue teniendo acceso hasta `current_period_end`. Después, `has_active_subscription()` retorna false y la app bloquea.
5. Inserta en `subscription_audit_log`
6. Inserta notificación in-app

**UI**: botón "Cancelar suscripción" con modal "¿Estás seguro? Vas a perder acceso a partir del [fecha]". Textarea opcional para motivo.

### 8. Customer portal en `/dashboard/billing`

Layout:
- Card "Suscripción actual":
  - Plan, precio, ciclo (Mensual/Anual), próximo cobro [fecha], método de pago (•••• 1234 Visa), botón "Actualizar tarjeta" (link a MP card management)
- Card "Estado":
  - Badge de estado con color
  - Si `past_due`: banner rojo con "Tu último pago falló. Actualizá tu método antes del [fecha + 7 días]."
- Sección "Historial de pagos":
  - Tabla con fecha, monto, estado (aprobado/rechazado/pendiente), método, comprobante (link)
- Sección "Cambiar plan" (solo `full_access_main`):
  - Link a `/dashboard/billing/cambiar-plan`
- Sección "Cancelar":
  - Botón rojo con confirmación

### 9. Acceso degradado en `past_due`

En `lib/auth/require-active-subscription.ts` (helper para usar en server actions):
- `has_active_subscription()` (DB function existente) retorna true para `active` y `trialing`
- Crear `has_grace_period_subscription()` que retorna true si estado es `past_due` AND `past_due_grace_until > now()`
- En server actions de creación/edición, usar `has_grace_period_subscription()` y bloquear si es false
- UI: si en `past_due`, mostrar banner rojo en todo el dashboard + bloquear botones de creación (con tooltip "Tu pago falló, regularizá para crear")

### 10. Migración SQL

Crear `supabase/migrations/20260601000004_mercadopago_integration.sql`:

```sql
-- ============================================================
-- MERCADO PAGO — extensiones al schema de billing existente
-- ============================================================

-- Plans: agregar referencia a MP
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS mp_preapproval_plan_id text,
  ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('profesional', 'consultora')) DEFAULT 'consultora',
  ADD COLUMN IF NOT EXISTS auto_billing_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS plans_mp_preapproval_plan_id_idx ON plans (mp_preapproval_plan_id);
CREATE INDEX IF NOT EXISTS plans_tipo_idx ON plans (tipo);

-- Subscriptions: agregar campos MP
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS mp_preapproval_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS mp_payer_id text,
  ADD COLUMN IF NOT EXISTS mp_payer_email text,
  ADD COLUMN IF NOT EXISTS mp_init_point text,
  ADD COLUMN IF NOT EXISTS mp_status text,
  ADD COLUMN IF NOT EXISTS metodo_pago text,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS plan_id_pendiente uuid REFERENCES plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aplicar_cambio_en timestamptz,
  ADD COLUMN IF NOT EXISTS past_due_grace_until timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE INDEX IF NOT EXISTS subs_mp_preapproval_idx ON subscriptions (mp_preapproval_id);
CREATE INDEX IF NOT EXISTS subs_estado_grace_idx ON subscriptions (estado, past_due_grace_until) WHERE estado = 'past_due';
CREATE INDEX IF NOT EXISTS subs_plan_id_pendiente_idx ON subscriptions (aplicar_cambio_en) WHERE plan_id_pendiente IS NOT NULL;

-- Payments: agregar campos MP
ALTER TABLE payments
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

CREATE INDEX IF NOT EXISTS payments_mp_payment_id_idx ON payments (mp_payment_id);
CREATE INDEX IF NOT EXISTS payments_mp_external_ref_idx ON payments (mp_external_reference);

-- Consultoras: agregar tipo
ALTER TABLE consultoras
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'profesional' CHECK (tipo IN ('profesional', 'consultora'));

-- ============================================================
-- Tabla nueva: mercadopago_webhook_log
-- ============================================================
CREATE TABLE IF NOT EXISTS mercadopago_webhook_log (
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

CREATE INDEX mp_webhook_log_topic_data_idx ON mercadopago_webhook_log (topic, data_id);
CREATE INDEX mp_webhook_log_no_procesado_idx ON mercadopago_webhook_log (recibido_at) WHERE procesado = false;
CREATE INDEX mp_webhook_log_recibido_idx ON mercadopago_webhook_log (recibido_at DESC);

ALTER TABLE mercadopago_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_webhook_log: super_admin only" ON mercadopago_webhook_log
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- ============================================================
-- Helper functions
-- ============================================================

-- has_grace_period_subscription: para gate de creación en past_due
CREATE OR REPLACE FUNCTION has_grace_period_subscription(p_consultora_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE consultora_id = p_consultora_id
      AND estado IN ('active', 'trialing')
    UNION ALL
    SELECT 1 FROM subscriptions
    WHERE consultora_id = p_consultora_id
      AND estado = 'past_due'
      AND past_due_grace_until IS NOT NULL
      AND past_due_grace_until > now()
  );
$$;

GRANT EXECUTE ON FUNCTION has_grace_period_subscription(uuid) TO authenticated;

-- Setear grace period cuando entra en past_due (trigger)
CREATE OR REPLACE FUNCTION subscriptions_set_grace_period()
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

DROP TRIGGER IF EXISTS subscriptions_grace_period ON subscriptions;
CREATE TRIGGER subscriptions_grace_period
  BEFORE UPDATE OF estado ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION subscriptions_set_grace_period();
```

### 11. Server actions / API routes

**`lib/actions/mercadopago.ts`**:
```ts
// Admin
export async function sincronizarPlanMP(planId: string): Promise<ActionResult<{ mpPlanId: string }>>
export async function resincronizarPlanMP(planId: string): Promise<ActionResult<void>>

// User (full_access_main)
export async function iniciarSuscripcionMP(prev, formData): Promise<ActionResult<{ init_point: string; subscription_id: string }>>
export async function obtenerEstadoSuscripcion(): Promise<ActionResult<SubscriptionState>>
export async function cambiarPlanMP(nuevoPlanId: string): Promise<ActionResult<{ prorrataMonto: number; aplicaInmediato: boolean }>>
export async function convertirAConsultora(nuevoPlanId: string): Promise<ActionResult<void>>
export async function cancelarSuscripcion(motivo?: string): Promise<ActionResult<void>>
export async function actualizarMetodoPago(): Promise<ActionResult<{ update_url: string }>>  // redirect a MP

// Histórico (todos los miembros de la consultora pueden leer)
export async function listarPagos(): Promise<ActionResult<Payment[]>>
```

**`app/api/mercadopago/webhook/route.ts`** — handler descripto arriba.

**`app/api/cron/aplicar-cambios-plan/route.ts`** — cron diario que:
- Busca subs con `plan_id_pendiente IS NOT NULL AND aplicar_cambio_en <= now()`
- Para cada una: llama a MP para cambiar el preapproval_plan, actualiza `plan_id` en DB, limpia `plan_id_pendiente`
- Auth: `CRON_SECRET` (patrón existente)

**`app/api/cron/expirar-past-due/route.ts`** — cron diario que:
- Busca subs con `estado='past_due' AND past_due_grace_until < now()`
- Las pasa a `cancelled`
- Inserta notificación al usuario

### 12. Queries `lib/queries/mercadopago.ts`

```ts
export const mpKeys = {
  all: ['mercadopago'] as const,
  suscripcion: () => [...mpKeys.all, 'suscripcion'] as const,
  pagos: () => [...mpKeys.all, 'pagos'] as const,
}

export function useSuscripcion()
export function usePagos()
export function useIniciarSuscripcion()
export function useCambiarPlan()
export function useConvertirAConsultora()
export function useCancelarSuscripcion()
```

### 13. Tipos (extender `lib/types.ts`)

```ts
export type SubscriptionEstadoMP = 'pending' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'
export type PlanTipo = 'profesional' | 'consultora'
export type MPTopic = 'payment' | 'subscription_preapproval' | 'subscription_authorized_payment' | 'plan'

export interface SubscriptionState {
  id: string
  consultora_id: string
  plan_id: string
  plan_nombre: string
  plan_precio: number
  plan_tipo: PlanTipo
  estado: SubscriptionEstadoMP
  current_period_start?: string
  current_period_end?: string
  trial_end?: string
  past_due_grace_until?: string
  mp_preapproval_id?: string
  card_last4?: string
  card_brand?: string
  cancelled_at?: string
  plan_id_pendiente?: string
  aplicar_cambio_en?: string
}

export interface ProrrataResult {
  monto: number
  dias_restantes: number
  precio_actual: number
  precio_nuevo: number
}
```

## Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `supabase/migrations/20260601000004_mercadopago_integration.sql` | Schema + RLS + funciones |
| `lib/mercadopago/client.ts` | Cliente MP + helpers |
| `lib/mercadopago/webhook-verify.ts` | Verificación HMAC del webhook |
| `lib/mercadopago/prorrata.ts` | Cálculo de prorrata |
| `lib/actions/mercadopago.ts` | Server actions |
| `lib/queries/mercadopago.ts` | Query hooks |
| `lib/auth/require-active-subscription.ts` | Helper guard |
| `app/api/mercadopago/webhook/route.ts` | Webhook handler |
| `app/api/cron/aplicar-cambios-plan/route.ts` | Cron downgrade application |
| `app/api/cron/expirar-past-due/route.ts` | Cron expirar gracia |
| `app/(dashboard)/dashboard/billing/checkout/success/page.tsx` | Return URL OK |
| `app/(dashboard)/dashboard/billing/checkout/failure/page.tsx` | Return URL fail |
| `app/(dashboard)/dashboard/billing/checkout/pending/page.tsx` | Return URL pending |
| `app/(dashboard)/dashboard/billing/cambiar-plan/page.tsx` | Selector de plan nuevo |
| `app/(dashboard)/dashboard/billing/convertir-consultora/page.tsx` | Wizard conversión |
| `components/billing/suscripcion-actual.tsx` | Card de suscripción actual |
| `components/billing/historial-pagos.tsx` | Tabla de pagos |
| `components/billing/plan-grilla.tsx` | Grilla de planes para alta o cambio |
| `components/billing/modal-cancelar.tsx` | Modal con confirmación + motivo |
| `components/billing/banner-past-due.tsx` | Banner global cuando past_due |
| `components/billing/badge-estado-sub.tsx` | Badge de estado de subscription |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `app/(dashboard)/dashboard/billing/page.tsx` | Reemplazar con UI del customer portal |
| `app/(dashboard)/dashboard/admin/planes/[id]/editar/page.tsx` | Agregar sección sync MP |
| `app/(dashboard)/layout.tsx` o header | Agregar `<BannerPastDue />` cuando aplique |
| `components/app-header.tsx` | (sin cambios) |
| `lib/types.ts` | Nuevos tipos |
| `package.json` | `mercadopago` dep |
| `.env.example` | Env vars de MP |
| `middleware.ts` | Asegurar que `/api/mercadopago/webhook` está exento de auth (es público) |

## Archivos existentes relevantes (LEER antes de implementar)

- `supabase/migrations/20260524000001_billing_schema.sql` — tablas `plans`, `subscriptions`, `payments`, `manual_payments`, `subscription_audit_log`
- `supabase/migrations/20260524000006_fix_subscription_cron.sql` — pattern de cron
- `supabase/migrations/20260601000001_admin_planes.sql` — admin CRUD de planes
- `lib/rate-limit.ts` — patrón Upstash (aunque webhook no se rate-limita, MP confía en signature)
- `lib/actions/empresa.ts` — patrón server action canónico
- `lib/supabase/server.ts` / `admin.ts`
- `app/api/cron/vencimientos/route.ts` — patrón de cron con CRON_SECRET
- `middleware.ts` — exclusión de auth para webhook

## Casos edge

1. **Webhook llega ANTES que el redirect**: el handler crea/actualiza la subscripción incluso si el redirect aún no ocurrió. El `external_reference` apunta a la `subscriptions.id` ya creada.
2. **Webhook DUPLICADO**: la unique `(topic, data_id, request_id)` impide doble inserción. Responde 200 sin re-procesar.
3. **MP cae**: el cron `expirar-past-due` corre igual; las suscripciones se mantienen consistentes con DB. Si el webhook llega tarde, el estado eventualmente se sincroniza.
4. **Cambio de plan con prorrata = $0** (mismo precio o downgrade): no se cobra prorrata, solo se cambia el preapproval_plan_id.
5. **Usuario cancela y vuelve a suscribir**: nueva fila en `subscriptions` (NO se reutiliza la anterior). El histórico se preserva.
6. **Past_due → reactivación exitosa**: webhook con `authorized` payment → trigger limpia `past_due_grace_until` → estado vuelve a `active`. Notificación in-app "¡Pago recibido!".
7. **Past_due más de 7 días**: cron pasa a `cancelled`. Banner cambia. Acceso bloqueado.
8. **Cuenta profesional convertida a consultora**: NO se pierde data. La consultora ya existía (con 1 miembro), solo se cambia el tipo + plan.
9. **Plan en MP fue eliminado manualmente** (admin tocó el panel de MP): re-sync detecta el mismatch y crea uno nuevo, actualiza `plans.mp_preapproval_plan_id`. Las subs activas siguen en el plan viejo de MP hasta que terminen su ciclo.
10. **Trial expira sin método de pago válido**: MP marca como `cancelled` → webhook → DB. Usuario ve banner "Tu prueba terminó, suscribite para continuar".
11. **Card del usuario expira**: MP tira fail → past_due → user actualiza card via portal MP → siguiente reintento es exitoso → vuelve a active.

## Seguridad

- **NUNCA loguear el `access_token`** ni el `webhook_secret`. Si se loguea el payload del webhook, scrubear datos sensibles (token, card_number — aunque MP nunca lo manda).
- El webhook endpoint NO requiere auth de usuario (es público). La SEGURIDAD es la verificación HMAC. Si falla → 401.
- El `external_reference` debe ser un UUID (subscription.id), nunca un email o data PII.
- `payments.receipt_url` debe ser signed URL o link a panel de MP (público pero solo con conocimiento del ID).
- En `mercadopago_webhook_log.payload` guardar lo que MP mandó tal cual, sin scrubbing — solo super_admin lo ve.
- En cada server action de MP: verificar `consultora_id` del user matchea con el de la sub. NO confiar solo en RLS.

## Tests sugeridos

- Unit: verificación HMAC con firma válida e inválida (mock signature)
- Unit: cálculo de prorrata para varios casos (mid-cycle upgrade, exacto día 1, último día)
- Integration: webhook simulado con payload de MP — testear todos los topics
- E2E Playwright (con sandbox de MP):
  - Alta: usuario suscribe, completa pago en MP sandbox, vuelve a app, ve sub activa
  - Cancelación: usuario cancela, ve "se cancela el [fecha]", después de la fecha pierde acceso
  - Cambio de plan: upgrade muestra prorrata, downgrade dice "efectivo el [fecha]"
  - Past_due: simular webhook de pago fallido, verificar banner + bloqueo de creación
  - Webhook signature inválida → 401

## Checklist de implementación

- [ ] Migración aplicada (schema + funciones + trigger past_due grace)
- [ ] Env vars de MP configuradas en Vercel (sandbox + prod)
- [ ] Webhook endpoint con HMAC verification funcionando
- [ ] Server actions completas (sincronizar, iniciar, cancelar, cambiar plan, convertir)
- [ ] Cron `aplicar-cambios-plan` corriendo en Vercel cron
- [ ] Cron `expirar-past-due` corriendo
- [ ] Customer portal en `/dashboard/billing` funcionando
- [ ] Página `/dashboard/admin/planes/[id]/editar` con sync MP
- [ ] Banner global de past_due
- [ ] Acceso degradado durante grace period (server actions retornan error claro)
- [ ] Test E2E con sandbox de MP cubriendo alta + cancelación
- [ ] `npm run type-check` sin errores
- [ ] `npm run lint` sin errores
- [ ] Reporte final con qué se implementó y qué quedó pendiente

## Notas para zen

- **No probar en producción de MP**: usar SIEMPRE sandbox (TEST tokens) para development. El sandbox de MP tiene cuentas de prueba documentadas (https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/test-cards).
- Si la suite de tests requiere sandbox real, dejar `MERCADOPAGO_ENV=sandbox` y documentar al final que para activar prod hay que cambiar tokens.
- El SDK de MP tiene **breaking changes frecuentes**. Si la API que uses no matchea exactamente lo descripto, leer el SDK actualizado de la versión instalada y adaptar (los nombres `PreApproval` / `PreApprovalPlan` / `Payment` son del SDK >=2.x).
- Si MP devuelve error 4xx en cualquier llamada: NO retry automático. Loguear y devolver error al usuario con mensaje claro.
- El webhook puede llegar fuera de orden (un pago antes que su preapproval, p.ej.). El handler debe ser tolerante: si recibe un payment con `external_reference` que apunta a una sub que no existe todavía, esperar 5s y reintentar lookup, o encolar y reintentar.
- Si en algún punto el contexto se vuelve ingobernable, parar y reportar lo que tenés hecho. Esta feature tiene alto riesgo de regression — preferí estado parcial probado a estado completo con bugs.
