# Sistema de Feedback + NPS interno

## Objetivo
Permitir que los usuarios de Sigmetría manden feedback desde la app (NPS de 0-10 + comentarios categorizados como bug / sugerencia / general). Toda la información queda almacenada en la DB y es accesible exclusivamente para super_admin desde un dashboard dedicado.

No se notifica a nadie por email, no aparecen modales automáticos, no hay botón flotante. La única vía de entrada es desde el menú **Configuración → Feedback**.

## Stack
- Next.js 15 App Router (Server Components + Client Components)
- Supabase PostgreSQL 17 con RLS
- TanStack React Query 5
- Zod 4 (validación)
- Recharts (gráfico de trend NPS)
- Tailwind + shadcn primitives (Card, Tabs, Textarea, Button, Modal, Badge, EmptyState, Skeleton)
- Toast custom (`lib/hooks/use-toast.ts`)
- useActionState (no react-hook-form)

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Modelo de datos | Tabla única `feedback` con discriminador `tipo` (nps, bug, sugerencia, general) |
| Categoría NPS | Columna generada `nps_categoria` (promotor 9-10, pasivo 7-8, detractor 0-6) |
| Estado del ticket | Columna `status` (nuevo, revisado, descartado, implementado) — sólo aplica a no-NPS, NPS queda en `nuevo` |
| Trigger UI | Solo desde menú Configuración. Sin botón flotante. Sin auto-modal. |
| Audience del dashboard | Super_admin exclusivamente (`is_super_admin()`) |
| Notificaciones | Ninguna — solo guardado en DB |
| Visibilidad del usuario | El usuario puede ver su propio histórico de feedbacks enviados |
| Anonimato | NO — el feedback se guarda con `user_id`. No es anónimo. |
| Frecuencia | Sin límite — el usuario puede mandar todos los feedbacks que quiera |
| Multi-tenancy | `consultora_id` se persiste para análisis por cliente, pero RLS lo hace global (super_admin ve todo) |

## Requerimientos funcionales

### 1. Tabla `feedback` (única tabla del feature)
- `id` uuid PK
- `user_id` uuid FK → `auth.users(id)` ON DELETE SET NULL
- `consultora_id` uuid FK → `consultoras(id)` ON DELETE SET NULL (puede ser NULL si el user no tiene consultora activa)
- `tipo` text CHECK IN ('nps', 'bug', 'sugerencia', 'general')
- `nps_score` smallint CHECK (0-10) — NULL para no-NPS
- `nps_categoria` text GENERATED — 'promotor' / 'pasivo' / 'detractor' / NULL
- `titulo` text — obligatorio para no-NPS, NULL para NPS
- `comentario` text NOT NULL — el cuerpo del feedback (también es el comentario opcional del NPS, pero allí puede ser cadena vacía)
- `status` text NOT NULL DEFAULT 'nuevo' CHECK IN ('nuevo', 'revisado', 'descartado', 'implementado')
- `metadata` jsonb DEFAULT `{}` — para guardar info útil: user agent, ruta donde estaba el usuario, versión de la app
- `created_at`, `updated_at` timestamptz

Constraint adicional: NPS exige `nps_score` no nulo; tipos no-NPS exigen `titulo` no nulo.

### 2. UI del usuario — Página `/dashboard/configuracion/feedback`
Una página con dos secciones bien separadas:

**Sección 1: Calificá Sigmetría (NPS)**
- Texto: "¿Qué tan probable es que recomiendes Sigmetría a un colega del sector?"
- Escala visual 0-10 (botones numerados o slider) con colores: rojo 0-6, amarillo 7-8, verde 9-10
- Textarea opcional: "Contanos por qué"
- Botón "Enviar NPS"
- Si el usuario ya respondió en los últimos 90 días, mostrar mensaje "Ya nos calificaste el [fecha]. Podés volver a hacerlo cuando quieras." y un botón "Calificar de nuevo"

**Sección 2: Mandanos un mensaje (categorizado)**
- Tabs: **Reportar un bug** | **Sugerir mejora** | **Comentario general**
- Cada tab tiene un form igual:
  - Input título (obligatorio, max 120 chars)
  - Textarea descripción (obligatorio, max 4000 chars)
  - Botón "Enviar"
- Submit dispara server action, toast de éxito, limpia el form

**Sección 3 (opcional dentro de la misma página, debajo de las anteriores): Mis envíos**
- Lista de los feedbacks enviados por el usuario (NPS y tickets juntos)
- Muestra: tipo, título o score, fecha, status
- Si el usuario no envió nada, mostrar `<EmptyState>` con CTA hacia la sección 1

Permisos: cualquier usuario autenticado puede entrar a esta página. No requiere permission check de rol.

### 3. UI super_admin — Página `/dashboard/admin/feedback`
Solo accesible si `profile.is_super_admin = true`. Si no, redirect a `/dashboard`.

**KPIs en cards arriba**:
- **NPS Score actual** (últimos 90 días): `(% promotores - % detractores)`, rango -100 a +100. Card grande con número grande.
- Total respuestas NPS (últimos 90 días)
- Total tickets `nuevo`
- Total tickets `revisado`

**Gráfico de trend**:
- Line chart con NPS Score mensual de los últimos 12 meses
- Usar Recharts

**Tabs con tablas**:
- **NPS** — columnas: fecha, usuario (email + nombre), consultora, score, categoría (badge color), comentario truncado, click → modal con detalle
- **Bugs** — columnas: fecha, usuario, consultora, título, status (badge), acciones
- **Sugerencias** — igual a bugs
- **General** — igual a bugs

Modal de detalle (click en una fila):
- Mostrar todos los campos
- Selector para cambiar `status` (excepto en NPS)
- Botón "Guardar status"
- Botón "Cerrar"

Todas las tablas usan el patrón custom del proyecto (no TanStack Table). Mobile: accordion.

### 4. Menú
Agregar dos items:
- En **menú Configuración** (acceso para todos los users autenticados): `Feedback` → `/dashboard/configuracion/feedback`
- En **menú Admin** (solo super_admin): `Feedback` → `/dashboard/admin/feedback`

Ambos items hay que agregarlos editando `components/app-header.tsx` (no hay archivo de config de menú).

### 5. Migración SQL
Crear `supabase/migrations/20260601000002_feedback_system.sql`:

```sql
-- Tabla feedback
CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  consultora_id uuid REFERENCES consultoras(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('nps', 'bug', 'sugerencia', 'general')),
  nps_score smallint CHECK (nps_score IS NULL OR (nps_score BETWEEN 0 AND 10)),
  nps_categoria text GENERATED ALWAYS AS (
    CASE
      WHEN nps_score IS NULL THEN NULL
      WHEN nps_score >= 9 THEN 'promotor'
      WHEN nps_score >= 7 THEN 'pasivo'
      ELSE 'detractor'
    END
  ) STORED,
  titulo text,
  comentario text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'revisado', 'descartado', 'implementado')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nps_requires_score CHECK (tipo != 'nps' OR nps_score IS NOT NULL),
  CONSTRAINT ticket_requires_titulo CHECK (tipo = 'nps' OR (titulo IS NOT NULL AND length(titulo) > 0))
);

CREATE INDEX feedback_user_id_idx ON feedback (user_id);
CREATE INDEX feedback_consultora_id_idx ON feedback (consultora_id);
CREATE INDEX feedback_tipo_idx ON feedback (tipo);
CREATE INDEX feedback_status_idx ON feedback (status) WHERE status = 'nuevo';
CREATE INDEX feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX feedback_nps_score_idx ON feedback (nps_score) WHERE tipo = 'nps';

-- Trigger updated_at
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
-- (asume que existe set_updated_at() — verificar; si no, crearlo)

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- INSERT: cualquier usuario autenticado puede insertar su propio feedback
CREATE POLICY "feedback: insert own" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT: el usuario ve sus propios feedbacks; super_admin ve todos
CREATE POLICY "feedback: select own or super_admin" ON feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin());

-- UPDATE: solo super_admin (para cambiar status)
CREATE POLICY "feedback: update super_admin" ON feedback
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- DELETE: solo super_admin
CREATE POLICY "feedback: delete super_admin" ON feedback
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- Función helper para NPS Score (devuelve número entre -100 y 100)
CREATE OR REPLACE FUNCTION calcular_nps_score(p_desde timestamptz DEFAULT now() - INTERVAL '90 days')
RETURNS TABLE(
  total_respuestas bigint,
  promotores bigint,
  pasivos bigint,
  detractores bigint,
  nps_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE nps_categoria = 'promotor') AS prom,
      COUNT(*) FILTER (WHERE nps_categoria = 'pasivo') AS pas,
      COUNT(*) FILTER (WHERE nps_categoria = 'detractor') AS det
    FROM feedback
    WHERE tipo = 'nps' AND created_at >= p_desde
  )
  SELECT
    total,
    prom,
    pas,
    det,
    CASE WHEN total = 0 THEN 0
         ELSE ROUND(((prom::numeric - det::numeric) / total::numeric) * 100, 1)
    END AS nps_score
  FROM stats;
$$;

GRANT EXECUTE ON FUNCTION calcular_nps_score(timestamptz) TO authenticated;

-- Función helper para trend mensual NPS (últimos 12 meses)
CREATE OR REPLACE FUNCTION nps_trend_mensual(p_meses int DEFAULT 12)
RETURNS TABLE(
  mes date,
  total_respuestas bigint,
  nps_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', created_at)::date AS mes,
    COUNT(*) AS total_respuestas,
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE ROUND(
           ((COUNT(*) FILTER (WHERE nps_categoria = 'promotor')::numeric
             - COUNT(*) FILTER (WHERE nps_categoria = 'detractor')::numeric)
            / COUNT(*)::numeric) * 100, 1)
    END AS nps_score
  FROM feedback
  WHERE tipo = 'nps'
    AND created_at >= date_trunc('month', now()) - (p_meses || ' months')::interval
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION nps_trend_mensual(int) TO authenticated;
```

**Importante**: las funciones son `SECURITY DEFINER` para que devuelvan datos agregados aún cuando RLS bloquea el SELECT directo. El endpoint que las llama debe verificar `is_super_admin()` en la capa de aplicación (server action) antes de invocarlas.

### 6. Server actions — `lib/actions/feedback.ts`
Implementar:

```ts
// Validación
const feedbackNpsSchema = z.object({
  score: z.coerce.number().int().min(0).max(10),
  comentario: z.string().max(2000).default(''),
})

const feedbackTicketSchema = z.object({
  tipo: z.enum(['bug', 'sugerencia', 'general']),
  titulo: z.string().min(1).max(120),
  descripcion: z.string().min(1).max(4000),
})

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['nuevo', 'revisado', 'descartado', 'implementado']),
})

// Actions
export async function enviarFeedbackNps(prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>>
export async function enviarFeedbackTicket(prev: unknown, formData: FormData): Promise<ActionResult<{ id: string }>>
export async function listarMisFeedbacks(): Promise<ActionResult<Feedback[]>>
// Admin only:
export async function listarFeedbackAdmin(tipo?: 'nps'|'bug'|'sugerencia'|'general', status?: string): Promise<ActionResult<Feedback[]>>
export async function obtenerNpsStats(): Promise<ActionResult<NpsStats>>
export async function obtenerNpsTrend(): Promise<ActionResult<NpsTrendPoint[]>>
export async function actualizarStatusFeedback(prev: unknown, formData: FormData): Promise<ActionResult<void>>
```

Patrón estándar del proyecto:
1. `'use server'`
2. `getUser()` — si no hay user → `{ success: false, error: 'No autenticado' }`
3. Validar con `validateFormData()`
4. Para actions admin: fetch profile + check `profile.is_super_admin`
5. Mutate DB
6. `revalidatePath()` sobre la página afectada
7. Return `ActionResult<T>`

**Tip para metadata**: capturar en el frontend antes de enviar:
```ts
const metadata = {
  pathname: window.location.pathname,
  user_agent: navigator.userAgent,
}
// Stringify y agregar como hidden input en el form
```

### 7. Queries — `lib/queries/feedback.ts`
```ts
export const feedbackKeys = {
  all: ['feedback'] as const,
  mine: () => [...feedbackKeys.all, 'mine'] as const,
  admin: () => [...feedbackKeys.all, 'admin'] as const,
  adminList: (tipo?: string, status?: string) => [...feedbackKeys.admin(), 'list', tipo, status] as const,
  npsStats: () => [...feedbackKeys.admin(), 'nps-stats'] as const,
  npsTrend: () => [...feedbackKeys.admin(), 'nps-trend'] as const,
}

export function useMisFeedbacks() { /* useQuery */ }
export function useFeedbackAdmin(tipo?: string, status?: string) { /* useQuery */ }
export function useNpsStats() { /* useQuery */ }
export function useNpsTrend() { /* useQuery */ }
export function useEnviarFeedbackNps() { /* useMutation, invalida mine */ }
export function useEnviarFeedbackTicket() { /* useMutation, invalida mine */ }
export function useActualizarStatusFeedback() { /* useMutation, invalida admin */ }
```

### 8. Tipos — extender `lib/types.ts`
```ts
export type FeedbackTipo = 'nps' | 'bug' | 'sugerencia' | 'general'
export type FeedbackStatus = 'nuevo' | 'revisado' | 'descartado' | 'implementado'
export type NpsCategoria = 'promotor' | 'pasivo' | 'detractor'

export interface Feedback {
  id: string
  user_id: string | null
  consultora_id: string | null
  tipo: FeedbackTipo
  nps_score: number | null
  nps_categoria: NpsCategoria | null
  titulo: string | null
  comentario: string
  status: FeedbackStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joins opcionales
  user_email?: string
  user_nombre?: string
  consultora_nombre?: string
}

export interface NpsStats {
  total_respuestas: number
  promotores: number
  pasivos: number
  detractores: number
  nps_score: number
}

export interface NpsTrendPoint {
  mes: string
  total_respuestas: number
  nps_score: number
}
```

## Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `supabase/migrations/20260601000002_feedback_system.sql` | Tabla, indexes, RLS, funciones helper |
| `lib/actions/feedback.ts` | Server actions (enviar, listar, actualizar status) |
| `lib/queries/feedback.ts` | Hooks de TanStack Query |
| `app/(dashboard)/dashboard/configuracion/feedback/page.tsx` | Página del usuario (NPS + tickets) |
| `app/(dashboard)/dashboard/admin/feedback/page.tsx` | Dashboard super_admin |
| `components/feedback/nps-input.tsx` | Componente de escala 0-10 con colores |
| `components/feedback/nps-form.tsx` | Form del NPS (escala + comentario opcional) |
| `components/feedback/ticket-form.tsx` | Form de bug/sugerencia/general |
| `components/feedback/mis-feedbacks-list.tsx` | Lista de envíos del usuario |
| `components/feedback/admin-feedback-tabs.tsx` | Tabs principales del admin (NPS/Bugs/Sugerencias/General) |
| `components/feedback/admin-feedback-table.tsx` | Tabla genérica para cada tab |
| `components/feedback/admin-feedback-detail-modal.tsx` | Modal con detalle y cambiar status |
| `components/feedback/admin-nps-stats.tsx` | Cards de KPIs (NPS Score, conteos) |
| `components/feedback/admin-nps-trend-chart.tsx` | Line chart con Recharts |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `components/app-header.tsx` | Agregar item "Feedback" en menú Configuración (todos) y en menú Admin (solo super_admin) |
| `lib/types.ts` | Agregar `Feedback`, `FeedbackTipo`, `FeedbackStatus`, `NpsCategoria`, `NpsStats`, `NpsTrendPoint` |

## Archivos existentes relevantes (leer antes de implementar)

- `lib/actions/notificacion.ts` o `lib/actions/empresa.ts` — patrón canónico de server action con auth + validación + ActionResult
- `lib/queries/iperc.ts` — patrón canónico de query keys + hooks (es el más completo)
- `lib/validation/helpers.ts` — `validateFormData()` y `formatZodErrors()`
- `lib/supabase/server.ts` — `createClient()` para server actions
- `lib/hooks/use-toast.ts` — toast.success / toast.error
- `components/ui/modal.tsx` — modal pattern usando native `<dialog>`
- `components/ui/empty-state.tsx` — EmptyState con variantes
- `components/ui/skeleton.tsx` — SkeletonTable para loading
- `components/app-header.tsx` — ver cómo se agregan items al menú (no hay nav.ts)
- `supabase/migrations/20260524000004_roles_super_admin.sql` — `is_super_admin()` definition
- `supabase/migrations/20260525000013_materialized_views.sql` — referencia de funciones SECURITY DEFINER agregadas
- Algún componente de Recharts existente (buscar en `components/analytics/` o similar) para mantener consistencia visual del gráfico

## Casos edge a manejar

1. **Usuario sin consultora activa**: `consultora_id` se guarda como NULL. El feedback igual se acepta.
2. **NPS sin comentario**: `comentario` queda como cadena vacía. La constraint lo permite (`DEFAULT ''`).
3. **Usuario eliminado**: `user_id` queda NULL (ON DELETE SET NULL). En el dashboard mostrar "Usuario eliminado".
4. **Consultora eliminada**: `consultora_id` queda NULL. Mostrar "Sin consultora".
5. **NPS repetido**: permitido. El usuario puede enviar NPS las veces que quiera. Para el cálculo del score se considera todo dentro de la ventana de 90 días.
6. **Super_admin que también envía feedback**: funciona normal — se guarda como cualquier otro y aparece en el dashboard.
7. **RLS y `is_super_admin()`**: verificar en server action ANTES de llamar a las funciones SECURITY DEFINER. No confiar solo en la DB.

## Tests sugeridos (no obligatorios pero recomendados)

- Unit: validación de schemas (NPS exige score, ticket exige título)
- Integration: insert de feedback como user normal, select solo el propio, super_admin ve todos
- E2E Playwright:
  - Usuario común envía NPS desde Configuración → aparece en su lista "Mis envíos"
  - Usuario común envía ticket de bug → aparece en su lista con status `nuevo`
  - Super_admin entra a `/dashboard/admin/feedback` → ve los registros, cambia status → persistido
  - Usuario común NO puede entrar a `/dashboard/admin/feedback` → redirect a /dashboard

## Checklist de implementación

- [ ] Migración SQL aplicada (tabla + indexes + RLS + funciones)
- [ ] Types agregados en `lib/types.ts`
- [ ] Server actions completas con auth + validación
- [ ] Query hooks con invalidación correcta
- [ ] Página `/dashboard/configuracion/feedback` (NPS + tickets + mis envíos)
- [ ] Componente `NpsInput` con escala visual 0-10
- [ ] Dashboard admin `/dashboard/admin/feedback` con KPIs + chart + tabs
- [ ] Modal de detalle con cambio de status
- [ ] Menu items agregados en `components/app-header.tsx`
- [ ] Guard de super_admin en página admin (redirect si no es super_admin)
- [ ] `npm run type-check` sin errores
- [ ] `npm run lint` sin errores
- [ ] Reporte final indicando qué se hizo y qué quedó pendiente
