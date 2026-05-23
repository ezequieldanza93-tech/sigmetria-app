# Notificaciones en Tiempo Real + Sistema de Vencimientos

## Objetivo
Sistema completo de notificaciones in-app (web) + email para vencimientos de documentos, gestiones, capacitaciones y EPP. Incluye panel de configuración donde el admin define qué tipos de documento/gestión tienen vencimiento y los días de anticipación para notificar.

## Stack
- Next.js 15 App Router + Server Actions
- Supabase PostgreSQL 17 + Realtime + Edge Functions
- TanStack React Query 5
- Tailwind CSS + shadcn/ui primitives
- Supabase Auth email (Resend) para envío de emails

## Decisiones tomadas

| Decisión | Opción elegida |
|----------|---------------|
| Canales | In-app (web) + email |
| Eventos | Solo vencimientos (documentos, gestiones, capacitaciones, EPP, mediciones) |
| Scope | Mismo criterio que dashboard — solo notifica sobre lo que el usuario tiene asignado |
| Detección | Cron automático (Edge Function o pg_cron), 1 vez por día |
| Servicio email | Supabase Auth email (Resend) |
| UI notificaciones | Bell + dropdown con últimas notificaciones |
| Tiempo real | Sí, con Supabase Realtime para badge en vivo |
| Push mobile | Se difiere a cuando exista la app nativa |
| Config panel | En el menú del avatar, submenú "Herramientas" |
| Documentos existentes | No tienen fecha_vencimiento, hay que agregarlo |

## Requerimientos funcionales

### 1. Base de datos — Migraciones

#### 1a. Tabla `configuracion_vencimientos`
Catálogo master donde el admin define qué tipos de documento/gestión tienen vencimiento.
```sql
CREATE TABLE configuracion_vencimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  tipo_entidad TEXT NOT NULL CHECK (tipo_entidad IN ('empresa', 'establecimiento', 'persona', 'gestion')),
  nombre TEXT NOT NULL,
  tiene_vencimiento BOOLEAN NOT NULL DEFAULT false,
  dias_aviso INTEGER NOT NULL DEFAULT 7,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cv_consultora ON configuracion_vencimientos(consultora_id);
```
Los registros se crean automáticamente al seed inicial con los tipos de documento y gestión que ya existen en la librería de la consultora (investigar cómo se almacenan actualmente).

#### 1b. Tabla `notificaciones`
```sql
CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT,
  entidad_tipo TEXT,
  entidad_id UUID,
  leida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON notificaciones(user_id);
CREATE INDEX idx_notif_user_leida ON notificaciones(user_id, leida);
```

#### 1c. Agregar `fecha_vencimiento` a tablas existentes
Determinar las tablas exactas investigando el schema actual:
- documentos de empresa → tabla `documentos` (agregar `fecha_vencimiento DATE`)
- documentos de establecimiento → tabla `documentos` o la que corresponda
- documentos de persona → tabla que corresponda
- gestiones → tabla `gestiones` (agregar `fecha_vencimiento DATE`)

Investigar el schema actual para determinar los nombres exactos de tablas y columnas.

### 2. Cron de verificación

Edge Function o pg_cron que corre 1 vez por día:
- Consulta `configuracion_vencimientos` para saber qué entidades tienen vencimiento activo y sus días_aviso
- Busca registros en documentos/gestiones donde `fecha_vencimiento` esté dentro del rango [hoy, hoy + dias_aviso]
- Para cada registro encontrado, determina qué usuarios tienen acceso a esa empresa/establecimiento (vía tabla de asignaciones existente)
- Crea registros en `notificaciones` para cada usuario
- Envía email vía Supabase Auth email (Resend) a cada usuario notificado

### 3. API / Server Actions

- `get_notificaciones` — Query TanStack: últimas notificaciones del usuario
- `get_notificaciones_no_leidas_count` — Query TanStack: count de no leídas (para el badge)
- `marcar_notificacion_leida` — Server action: marca una notif como leída
- `marcar_todas_leidas` — Server action: marca todas como leídas
- `get_configuracion_vencimientos` — Query: trae config de la consultora
- `update_configuracion_vencimiento` — Server action: actualiza tiene_vencimiento y dias_aviso
- `update_fecha_vencimiento_documento` — Server action: actualiza fecha_vencimiento en un documento
- `update_fecha_vencimiento_gestion` — Server action: actualiza fecha_vencimiento en una gestión

### 4. Frontend — Notificaciones

#### 4a. Bell + Dropdown (header)
- Ícono de campana en el header con badge de cantidad no leídas
- Al hacer clic, dropdown con las últimas 10 notificaciones
- Al hacer clic en una notif, se marca como leída
- Opción "Marcar todas como leídas"
- Última notif muestra "Ver más" → redirige a lista completa (opcional para MVP)

#### 4b. Realtime para badge en vivo
- Usar Supabase Realtime para subscribirse a cambios en `notificaciones` del usuario
- El badge se actualiza automáticamente sin recargar

### 5. Frontend — Panel de Configuración (Herramientas)

Nuevo ítem en el menú del avatar → "Herramientas" → "Vencimientos y Notificaciones"

Dos secciones:

#### 5a. Configuración de Vencimientos
Tabla con:
- Columna: Tipo (empresa | establecimiento | persona | gestión)
- Columna: Nombre del documento/gestión
- Columna: Tiene vencimiento (switch/checkbox)
- Columna: Días de aviso (input numérico, editable solo si "tiene vencimiento" está activo)
- Columna: Activo (switch)
- Cada fila es editable in-line o vía modal

#### 5b. Vincular Fecha de Vencimiento a Instancias
Para cada empresa/establecimiento/persona/gestión:
- En el formulario de alta/edición de documentos, si el tipo de documento tiene `tiene_vencimiento=true` en la config, mostrar campo `fecha_vencimiento` (date picker)
- En el formulario de gestión, similar: si la gestión está marcada con vencimiento, mostrar campo fecha

### 6. Seguridad / RLS

- `configuracion_vencimientos`: RLS por consultora_id (solo admin y usuarios con permiso de config)
- `notificaciones`: RLS por user_id (cada usuario solo ve sus notificaciones)
- Las server actions deben validar permisos (usar el sistema de roles existente)
- El cron debe ejecutarse con service_role (sin RLS)

### 7. UX

- Dropdown de notificaciones: diseño limpio, cada notif con ícono según tipo, relative time ("hace 2 horas")
- Badge de la campana: rojo con número blanco
- Esqueletos de carga mientras se resuelven las queries
- Panel de Herramientas: tabla responsive, switches con confirmación

## Archivos existentes relevantes
- `app/(dashboard)/layout.tsx` — Header donde va la campana
- `components/layout/` — Componentes del layout (sidebar, header)
- `lib/types.ts` — Tipos existentes
- `lib/actions/` — Server actions existentes
- `lib/queries/` — React Query hooks existentes
- `components/ui/` — Componentes base (Switch, Badge, DropdownMenu, etc.)
- `supabase/migrations/` — Últimas migraciones
- Tablas actuales de documentos — investigar schema para saber exactamente dónde agregar fecha_vencimiento
- Tabla de gestiones — investigar schema

## Notas de implementación
- Investigar el schema actual de documentos y gestiones antes de escribir migraciones
- La migración debe seguir el naming convention existente (fecha como parte del nombre)
- El cron debe ser idempotente (no crear notificaciones duplicadas)
- Para email transaccional, usar el edge function de Supabase o trigger de base de datos + pg_net
- No romper funcionalidad existente de documentos/gestiones
- Investigar cómo se determina el acceso del usuario a empresas/establecimientos (tabla de asignaciones)
