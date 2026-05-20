# Matriz de Permisos — Sigmetría HyS

## Roles del sistema

### `is_super_admin` (flag en `profiles`)
Reemplaza al antiguo `developer`. Tiene acceso total a todos los tenants vía service role.
Único usuario actual: `dev@sigmetria.app`

### `user_role` (enum en `consultoras_members`)
| Valor | Label UI | Descripción |
|-------|----------|-------------|
| `full_access_main` | Admin Principal | Control total del tenant: usuarios, billing, configuración |
| `full_access_branch` | Admin Branch | Igual a main pero sin gestionar usuarios ni billing |
| `colaborador` | Colaborador | Carga y edición de registros (gestiones, siniestros, etc.) |
| `full_viewer` | Viewer Global | Solo lectura de toda la consultora |
| `colaborador_viewer` | Viewer Limitado | Solo lectura de empresas asignadas |
| `visualizador_comentarista` | Visualizador Comentarista | Solo lectura + comentarios (sin edición) |

---

## Matriz de acceso por recurso

| Recurso | full_access_main | full_access_branch | colaborador | full_viewer | colaborador_viewer | visualizador_comentarista |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| **Empresas** | CRUD | CRUD | CRUD | R | R (asignadas) | R |
| **Establecimientos** | CRUD | CRUD | CRUD | R | R (asignadas) | R |
| **Gestiones/Registros** | CRUD | CRUD | CRUD | R | R (asignadas) | R |
| **Personas** | CRUD | CRUD | CRUD | R | R | R |
| **Organizaciones externas** | CRUD | CRUD | CRUD | R | R | R |
| **Instrumentos** | CRUD | CRUD | R | R | R | R |
| **Productos EPP** | CRUD | CRUD | R | R | R | R |
| **Usuarios** | CRUD | R | — | — | — | — |
| **Billing / Suscripción** | CRUD | — | — | — | — | — |
| **Panel Super Admin** | — | — | — | — | — | — |

Leyenda: CRUD = Create/Read/Update/Delete · R = Read only · — = Sin acceso

---

## Acceso condicionado por suscripción

| Estado suscripción | Acceso a funcionalidad |
|--------------------|------------------------|
| `trialing` | Acceso completo, con límites de trial: 2 empresas / 5 establecimientos / 200 gestiones / 200 horarios |
| `trial_view_only` | Solo lectura. No permite crear nuevos registros. |
| `active` | Acceso completo según límites del plan contratado |
| `past_due` | Acceso completo (período de gracia implícito) |
| `grace_period` | Solo lectura. 7 días para regularizar. |
| `canceled` / `expired` | Solo lectura |

### Aplicación técnica
Los límites de trial y plan se aplican mediante triggers `BEFORE INSERT` en Postgres.
El error devuelto tiene el código `P0001` y el mensaje `PLAN_LIMIT_REACHED`.

```typescript
// Ejemplo de manejo en el frontend
try {
  await supabase.from('empresas').insert(...)
} catch (e) {
  if (e.code === 'P0001' && e.message === 'PLAN_LIMIT_REACHED') {
    // mostrar modal de upgrade
  }
}
```

---

## Implementación técnica (RLS)

Las policies usan estas funciones helper:

```sql
-- Verifica is_super_admin del usuario autenticado
public.is_super_admin() RETURNS boolean

-- Alias de is_super_admin() para retrocompatibilidad
public.is_developer() RETURNS boolean

-- Verifica que el usuario tenga suscripción activa para crear
public.has_active_subscription(consultora_id uuid) RETURNS boolean

-- Trigger guard: bloquea escritura si no es super_admin
public.guard_super_admin() -- BEFORE INSERT/UPDATE/DELETE en tablas críticas
```

### Archivos clave
- `supabase/migrations/20260524000004_roles_super_admin.sql` — roles, RLS, gates de suscripción
- `supabase/migrations/20260524000005_trial_feature_gates.sql` — límites, cron, state machine
- `lib/auth/require-super-admin.ts` — guard para API routes
- `lib/types.ts` — `UserRole`, `canWrite()`, `canDelete()`, `canManageUsers()`
