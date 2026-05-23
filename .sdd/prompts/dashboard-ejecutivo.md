# Dashboard Ejecutivo con Widgets Configurables

## Objetivo
Mejorar la página `/dashboard` existente convirtiéndola en un panel ejecutivo con KPIs numéricos configurables por usuario, fusionando el contenido actual de `/dashboard/analytics` en el dashboard principal.

## Stack
- Next.js 15 App Router (Server Components + Client Components)
- Supabase PostgreSQL 17
- TanStack React Query 5
- Recharts (ya existe en analytics)
- Tailwind CSS + shadcn/ui primitives

## Requerimientos funcionales

### 1. Dashboard principal (`/dashboard`)
- Debe mostrar una grilla de widgets configurables con KPIs numéricos
- Los widgets se renderizan como Cards con el valor numérico destacado, título, y opcionalmente un ícono
- Cada widget respeta el alcance del usuario (empresas/establecimientos asignados)
- Si el usuario no tiene widgets configurados se muestran todos por defecto
- La página debe cargar los datos con TanStack Query

### 2. KPIs disponibles (todos se implementan como widgets independientes)
- Empresas activas
- Establecimientos totales
- Trabajadores totales
- Siniestros del mes + acumulados del año
- Documentos por vencer (7, 15, 30 días)
- Inspecciones pendientes
- Capacitaciones vencidas / próximas a vencer
- Mediciones ambientales pendientes
- EPP vencidos por puesto
- Tasa de siniestralidad (%)

### 3. Panel de configuración
- Accesible desde un botón "Configurar dashboard" en la página
- Modal/formulario con checkboxes para cada KPI disponible
- Se guarda en la tabla `user_dashboard_widgets` (FK a user_id + widget_id/config)
- Los cambios tienen efecto inmediato al guardar

### 4. Analytics fusionado
- La página `/dashboard/analytics` se elimina (o redirige a `/dashboard`)
- Los gráficos temporales y análisis que estaban en analytics se integran como widgets del dashboard o se eliminan si duplican funcionalidad
- Decidir en implementación: si hay gráficos únicos en analytics, portarlos como widgets adicionales

### 5. Base de datos
Crear migración SQL:
```sql
CREATE TABLE user_dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, widget_key)
);
CREATE INDEX idx_udw_user ON user_dashboard_widgets(user_id);
```

Widget keys predefinidas:
- `empresas_activas`, `establecimientos`, `trabajadores`
- `siniestros_mes`, `siniestros_acumulados`
- `documentos_vencer_7d`, `documentos_vencer_15d`, `documentos_vencer_30d`
- `inspecciones_pendientes`, `capacitaciones_vencidas`, `capacitaciones_proximas`
- `mediciones_pendientes`, `epp_vencidos`
- `tasa_siniestralidad`

### 6. Seguridad / RLS
- Cada widget consulta datos scoped al user_id (vía las funciones RLS existentes)
- RLS policy en `user_dashboard_widgets` para que cada usuario solo vea/edite sus propios widgets
- El panel de configuración usa server action para persistir

### 7. UX
- Diseño responsive: grilla de 2 columnas en desktop, 1 en mobile
- Estado vacío si no hay datos para un KPI (ej: "No hay siniestros registrados")
- Esqueletos de carga (skeleton loaders) mientras se resuelven las queries
- Botón "Configurar dashboard" en la esquina superior derecha
- Reordenamiento: los widgets se muestran en el orden definido por `position` (opcional para versión inicial: orden fijo alfabético o por tipo)

## Archivos existentes relevantes
- `app/(dashboard)/dashboard/page.tsx` — Página actual del dashboard
- `app/(dashboard)/dashboard/analytics/` — Carpeta de analytics a fusionar
- `app/(dashboard)/layout.tsx` — Layout con sidebar
- `lib/queries/` — Queries de React Query existentes (ver ejemplos para patrones)
- `lib/actions/` — Server actions existentes (ver patrones)
- `lib/constants.ts` — Constantes del dominio
- `lib/types.ts` — Tipos TypeScript
- `components/ui/` — Componentes base (Card, Button, Modal, etc.)
- `components/analytics/` — Componentes de analytics existentes
- `supabase/migrations/` — Últimas migraciones (ver formato)

## Notas de implementación
- Usar el mismo patrón de server actions que los módulos existentes
- Las queries deben usar TanStack Query con suspense donde tenga sentido
- No romper la funcionalidad existente del dashboard
- La migración debe seguir el naming convention de migraciones existentes
- Después de implementar, borrar o redirigir la página de analytics
