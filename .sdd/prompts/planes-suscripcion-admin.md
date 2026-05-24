# Múltiples Planes de Suscripción Configurables desde Admin

## Objetivo
Panel de administración para que super_admin pueda crear, editar, ordenar y gestionar planes de suscripción sin modificar código. Incluye: CRUD de planes, control de visibilidad, feature flags por plan, vista de suscriptores por plan, y mejora del comparador de planes en la página de billing.

## Stack
- Next.js 15 App Router + Server Actions
- Supabase PostgreSQL 17
- TanStack React Query 5
- Tailwind CSS + shadcn/ui

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| CRUD de planes | Admin UI dentro de `/dashboard/admin/planes` (super_admin only) |
| Tipo de plan | Cambiar `plan_tipo` de ENUM a TEXT para permitir tipos dinámicos |
| Feature flags | Nueva tabla `plan_features` con toggles booleanos por plan |
| Visibilidad | Nueva columna `sort_order` + `is_visible` en `plans` |
| Precios históricos | No modelar versionado — se actualiza el plan in-place y se audita via `subscription_audit_log` |
| Comparador en billing | Mejorar UI con tabla comparativa de features |

## Estado actual del código (NO repetir)

### Tablas existentes (ya migradas, no recrear)

**`plans`** — catálogo de planes. Columnas:
- `id` (UUID PK), `nombre`, `slug` (UNIQUE), `tipo` (ENUM: trial, profesional_independiente, consultora_chica, consultora_grande, empresa)
- `precio_mensual_neto`, `precio_anual_neto` (numeric(12,2), NULL = plan a medida)
- `iva_porcentaje` (numeric(5,2), default 21.00)
- `max_colaboradores`, `max_empresas`, `max_establecimientos`, `max_gestiones_registros`, `max_horarios_registros` (int, NULL = ilimitado)
- `precio_extra_seat_neto` (numeric(12,2), default 15000.00)
- `is_active` (boolean), `created_at`, `updated_at`

**`subscriptions`** — suscripción activa por consultora (UNIQUE consultora_id).
Con `estado` (trialing|trial_view_only|active|past_due|grace_period|canceled|expired), `periodo` (monthly|annual), timestamps de trial/periodo/grace/cancel.

**`subscriptions_add_ons`** — add-ons por suscripción (tipo: extra_colaborador_seat).

**`payments`** — intentos de pago con montos calculados (GENERATED ALWAYS).

**`manual_payments`** — detalle de transferencias manuales.

### Archivos existentes relevantes

| Archivo | Propósito |
|---------|-----------|
| `app/(dashboard)/dashboard/admin/page.tsx` | Panel super_admin: tabla de suscripciones + pagos pendientes |
| `app/(dashboard)/dashboard/billing/page.tsx` | Página de suscripción: estado, seats, selector de planes, formulario de pago |
| `app/(dashboard)/dashboard/billing/manual-payment-form.tsx` | Formulario de pago: selección de plan + nro operación |
| `app/(dashboard)/dashboard/billing/add-on-seat-form.tsx` | Modal de seats adicionales |
| `supabase/migrations/20260524000001_billing_schema.sql` | Schema completo de billing + seed de 5 planes |
| `supabase/migrations/20260524000005_trial_feature_gates.sql` | Feature gates + cron de estados |
| `supabase/migrations/20260524000006_fix_subscription_cron.sql` | Fix al cron |

### Lo que NO existe (hay que crearlo)

- **Admin CRUD de planes**: `/dashboard/admin/planes` con listado, crear, editar
- **Feature flags por plan**: tabla `plan_features` + integración en feature gates
- **Plan sorting/visibility**: columnas `sort_order`, `is_visible`
- **Plan detail view**: suscriptores activos, revenue estimado, payments por plan
- **Comparador de planes**: mejora del selector actual con tabla comparativa de features
- **Migración `plan_tipo`**: de ENUM a TEXT

## Base de datos — Migraciones

### 1. Cambiar `plan_tipo` de ENUM a TEXT

```sql
-- El ENUM plan_tipo limita la creación de nuevos tipos de plan desde admin.
-- Se cambia la columna a TEXT para permitir valores dinámicos.

ALTER TABLE public.plans
  ALTER COLUMN tipo TYPE text;
```

### 2. Agregar `sort_order` e `is_visible` a `plans`

```sql
ALTER TABLE public.plans
  ADD COLUMN sort_order     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN is_visible     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN descripcion_corta TEXT,     -- para mostrar en cards
  ADD COLUMN destacado      BOOLEAN NOT NULL DEFAULT false; -- plan recomendado

-- Seed para orden inicial (todo visible, orden por precio)
UPDATE public.plans SET sort_order = 1,  descripcion_corta = 'Para profesionales independientes' WHERE slug = 'profesional-independiente';
UPDATE public.plans SET sort_order = 2,  descripcion_corta = 'Para consultoras con equipo pequeño' WHERE slug = 'consultora-chica';
UPDATE public.plans SET sort_order = 3,  descripcion_corta = 'Para consultoras en crecimiento' WHERE slug = 'consultora-grande';
UPDATE public.plans SET sort_order = 4,  descripcion_corta = 'Solución enterprise a medida' WHERE slug = 'empresa';
UPDATE public.plans SET sort_order = 0,  is_visible = false WHERE slug = 'trial';
```

### 3. Feature flags por plan

```sql
CREATE TABLE public.plan_features (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,   -- ej: 'export_pdf', 'firmas_digitales', 'api_webhooks', 'multi_idioma'
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
```

**Catálogo de feature keys** (seed base — consultora puede agregar más):

```sql
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
```

### 4. Actualizar RLS de `plans` para super_admin

```sql
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
```

## Tipos TypeScript (para `lib/types.ts`)

```typescript
export interface Plan {
  id: string
  nombre: string
  slug: string
  tipo: string
  precio_mensual_neto: number | null
  precio_anual_neto: number | null
  iva_porcentaje: number
  max_colaboradores: number | null
  max_empresas: number | null
  max_establecimientos: number | null
  max_gestiones_registros: number | null
  max_horarios_registros: number | null
  precio_extra_seat_neto: number | null
  is_active: boolean
  sort_order: number
  is_visible: boolean
  descripcion_corta: string | null
  destacado: boolean
  created_at: string
  updated_at: string
  plan_features?: PlanFeature[]
}

export interface PlanFeature {
  id: string
  plan_id: string
  feature_key: string
  habilitado: boolean
  created_at: string
}

export interface PlanWithSubscribers extends Plan {
  subscriber_count?: number
  active_subscriptions_count?: number
}
```

## Server Actions

### `lib/actions/admin/plan.ts`

```typescript
'use server'

// createPlan(prev, formData) — crea nuevo plan
// updatePlan(id, prev, formData) — actualiza plan existente
// deletePlan(id) — soft-delete (is_active = false) o hard-delete si 0 subs
// togglePlanVisibility(id, is_visible) — show/hide en billing
// reorderPlans(ids: string[]) — batch update sort_order

// updatePlanFeatures(planId, features: { key: string; enabled: boolean }[])
//   - upsert en plan_features

export async function createPlan(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  // 1. Auth + super_admin check
  // 2. Validar campos (precios numéricos, límites, slug único)
  // 3. Insert en plans
  // 4. Crear feature flags default (opcional)
  // 5. revalidatePath('/dashboard/admin/planes')
  // 6. return
}

export async function updatePlan(
  id: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  // Similar a createPlan pero update
  // Si cambia el slug, verificar que no exista otro plan con ese slug
}
```

## API Routes

### `GET /api/admin/plans` — lista planes (admin, incluye no visibles)
### `GET /api/admin/plans/[id]` — detalle con features + subscriber count
### `POST /api/admin/plans/reorder` — reordenar (batch { id, sort_order }[])
### `POST /api/admin/plans/features/batch` — update masivo de features

## Frontend — Navegación

```
/dashboard/admin
  ├── page.tsx             → Panel actual: suscripciones + pagos pendientes
  └── planes/
      ├── page.tsx         → Listado de planes con toggle visibility + drag reorder
      ├── nuevo/
      │   └── page.tsx     → Crear nuevo plan
      └── [id]/
          ├── page.tsx     → Detalle del plan (info + suscriptores + revenue)
          └── editar/
              └── page.tsx → Editar plan
```

## Frontend — Admin: Listado de Planes

- Tabla con: Orden (drag handle), Nombre, Slug, Precio mensual, Precio anual, Suscriptores activos, Visible (toggle), Destacado (toggle), Acciones
- Drag to reorder (o flechas arriba/abajo)
- Toggle switch para `is_visible` (cambio inmediato via server action)
- Botón "+ Nuevo Plan"
- Cada fila click → detalle del plan

## Frontend — Admin: Crear/Editar Plan

Formulario con secciones:

### Información básica
- Nombre (text)
- Slug (text, auto-generado desde nombre, editable)
- Descripción corta (text, 1 línea)
- Tipo (text, libre)
- ¿Recomendado? (checkbox → `destacado`)
- ¿Visible en billing? (checkbox → `is_visible`)

### Precios (ARS, sin IVA)
- Precio mensual (number, nullable → plan a medida)
- Precio anual (number, nullable)
- IVA % (number, default 21.00)
- Precio seat adicional (number, default 15000.00, nullable = no disponible)

### Límites
- Max colaboradores (number, 0 = solo titular, vacío = ilimitado)
- Max empresas (number, vacío = ilimitado)
- Max establecimientos (number, vacío = ilimitado)
- Max registros de gestión (number, vacío = ilimitado)
- Max registros de horario (number, vacío = ilimitado)

### Feature Flags
- Lista de checkboxes agrupados por categoría
- Features existentes se cargan desde `plan_features`
- Opción "Agregar feature key" si no existe en el catálogo
- Cada feature: key (texto) + checkbox habilitado

## Frontend — Admin: Detalle del Plan

- Card con info del plan (precios, límites, features)
- Tabla de suscriptores activos (consultora, estado, período, vence)
- Revenue estimado (cantidad de suscriptores × precio promedio)
- Botones: Editar, Desactivar plan, Eliminar (solo si 0 suscriptores)

## Frontend — Mejora del Comparador en Billing

Reemplazar el selector de cards actual (`manual-payment-form.tsx`) con tabla comparativa:

- Columnas por plan (solo `is_visible = true`)
- Filas: Precio mensual, Precio anual, Colaboradores, Empresas, Establecimientos, Features checkeadas (✅/❌)
- Fila destacada para plan `destacado = true`
- Botón "Elegir este plan" por fila → lleva al formulario de pago
- Mantener la funcionalidad existente de pago manual

## Integración con Feature Gates

El `check_plan_limit` existente ya usa `get_plan_limits()` que lee de `plans`. Al actualizar límites desde admin, los triggers de feature gates reflejan los cambios automáticamente — no requiere cambios.

Para verificar features habilitadas en la UI del dashboard, crear helper:

```typescript
// lib/utils/plan-features.ts
export async function getPlanFeatures(consultoraId: string): Promise<Record<string, boolean>> {
  // Query: subscriptions → plan → plan_features
  // Return: Record<feature_key, habilitado>
}
```

## Patrones a seguir

- **Admin only**: Usar `is_developer()` o `is_super_admin()` check tanto en server actions como en page layout
- **Form reutilizable**: El formulario de crear/editar plan debe ser el mismo componente con `mode: 'create' | 'edit'`
- **Optimistic updates**: Para toggles de visibilidad y reorden, usar TanStack Query mutations con optimistic update
- **Drag & drop reorder**: Usar `@dnd-kit/core` (ya disponible en el proyecto de ser necesario) o flechas simples
- **Los precios siempre se guardan netos (sin IVA)**: El IVA se calcula al mostrar — consistente con el schema actual
- **Slug validation**: Slug debe ser URL-safe y único, auto-generado desde nombre (opcional editable)

## Archivos existentes relevantes

- `app/(dashboard)/dashboard/admin/page.tsx` — Panel admin existente (agregar link a "Planes")
- `app/(dashboard)/dashboard/billing/page.tsx` — Página de billing (mejorar comparador)
- `app/(dashboard)/dashboard/billing/manual-payment-form.tsx` — Formulario de pago (mejorar selector)
- `supabase/migrations/20260524000001_billing_schema.sql` — Schema de billing + seed
- `supabase/migrations/20260524000005_trial_feature_gates.sql` — Feature gates existentes
- `lib/types.ts` — Agregar tipos Plan, PlanFeature
- `lib/schemas/index.ts` — Agregar schemas de validación
