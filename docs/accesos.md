# Perfiles, Accesos y QR — Sigmetría HyS

> **Art. 4.5 / Art. 5 Res. SRT 48/2025** — Perfiles autorizados, autenticación
> adecuada, protección de datos personales, acceso remoto para los distintos
> actores (incluidos organismos de control) y acceso por QR a la información de
> cumplimiento.
>
> Este documento describe **solo lo verificado en el código** (RLS real +
> server actions + middleware). Lo que NO está aplicado se marca explícitamente.
>
> **NO hay biometría** y no se prepara: la autenticación es contraseña + 2FA por
> OTP email. Queda fuera de alcance por decisión de diseño.
>
> Última verificación: 2026-06-11 (Prompt 4 — corrida autónoma SRT 48/2025).

---

## 1. Perfiles (roles)

Fuente: `lib/types.ts` (`UserRole`, `SystemRole`), `lib/constants.ts`, y el enum
`public.user_role` en las migraciones. Hay **8 roles de consultora** + un
**system_role** transversal.

| Rol (`user_role`) | Label UI | Alcance | Escribe | Borra |
|---|---|---|---|---|
| `full_access_main` | Admin Principal | Toda la consultora | Sí | Sí |
| `full_access_branch` | Admin Branch | Toda la consultora | Sí | Sí |
| `colaborador` | Colaborador | Granular (`user_access`) | Sí | **No** |
| `full_viewer` | Viewer Global | Toda la consultora | No | No |
| `colaborador_viewer` | Viewer Limitado | Granular (`user_access`) | No | No |
| `visualizador_comentarista` | Visualizador Comentarista | Granular (`user_access`) | No¹ | No |
| `responsable_estandares` | Resp. de Estándares | Toda la consultora + audit_log | No | No |
| `viewer_observaciones` | Viewer de Observaciones | Solo sus observaciones | No² | No |

- `system_role = 'developer'` → override total (RLS `is_developer()` / `is_super_admin()`).
- ¹ `visualizador_comentarista` solo comenta observaciones (insert acotado en
  `observaciones_comentarios`), nunca escribe datos transaccionales.
- ² `viewer_observaciones` puede CERRAR sus propias observaciones vía el RPC
  `cerrar_observacion_responsable` (SECURITY DEFINER, exige ser el responsable +
  evidencia obligatoria) — no es escritura libre de tabla.
- `FREE_VIEWER_ROLES = [full_viewer, colaborador_viewer, visualizador_comentarista,
  viewer_observaciones]`: roles de solo-lectura que NO consumen seat del plan.

### Helpers TS (espejo de la RLS, `lib/types.ts`)
- `canWrite` → main/branch/colaborador (o developer).
- `canDelete` → main/branch (o developer). **colaborador NO borra.**
- `canManageUsers` → solo main (o developer).
- `canViewReportes` → main + responsable_estandares (o developer).

---

## 2. Funciones RLS (gating de acceso) — quién las cumple

Definidas como `SECURITY DEFINER STABLE` en
`supabase/migrations/20260514000002_rls_policies.sql` y actualizadas en
`20260527000005_responsable_estandares.sql` y `20260517000010_colaborador_no_delete.sql`.

| Función | Verdadero para | Notas |
|---|---|---|
| `is_developer()` / `is_super_admin()` | developer | override total |
| `get_consultora_role(cid)` | — | devuelve el rol del usuario en esa consultora |
| `has_empresa_read_access(eid)` | main, branch, full_viewer, responsable_estandares (consultora-wide) **+** cualquiera con grant en `user_access` para esa empresa | base de SELECT |
| `has_empresa_write_access(eid)` | main, branch (consultora-wide) **+** `colaborador` con `user_access` a la empresa | base de INSERT/UPDATE |
| `has_empresa_admin_access(eid)` | main, branch | base de DELETE (excluye colaborador) |
| `has_establecimiento_read_access(id)` | main, branch, full_viewer, responsable_estandares **+** `user_access` (empresa entera o establecimiento puntual) | SELECT por establecimiento |
| `has_establecimiento_write_access(id)` | main, branch **+** `colaborador` con `user_access` (empresa o puntual) | INSERT/UPDATE por establecimiento |
| `has_establecimiento_admin_access(id)` | main, branch | DELETE (excluye colaborador) |

**Clave del aislamiento entre clientes:** las read/write funcs SIEMPRE parten de
`consultoras_members` JOIN `empresas` (mismo `consultora_id`) o de `user_access`
(que tiene `consultora_id`). Ningún rol puede leer/escribir empresas de otra
consultora salvo developer.

**Los roles viewer NUNCA aparecen en una write/admin func** → a nivel RLS son
solo-lectura, no solo por UI.

---

## 3. Matriz rol × recurso × acción

Acciones: **V**er (SELECT) / **C**rear (INSERT) / **E**ditar (UPDATE) /
**B**orrar (DELETE). `dev` (developer) = todo en todo. Celda = ✅ permitido /
❌ denegado por RLS, con la **función/policy** que lo implementa.

### 3.1 Datos transaccionales (incidentes, inspecciones, riesgos, mediciones, gestiones, documentos, denuncias, capacitaciones)
Patrón común: SELECT = `has_*_read_access`; INSERT/UPDATE = `has_*_write_access`;
DELETE = `has_*_admin_access`. Policies en
`20260514000003_functional_tables.sql`, `20260614000002_rename_siniestros_a_incidentes.sql`,
`20260516000010_…`, `20260525000014_partition_gestiones_registros.sql`,
`20260517000010_colaborador_no_delete.sql`, `20260630000008/09_denuncias_*.sql`.

| Rol | V | C | E | B |
|---|---|---|---|---|
| full_access_main | ✅ | ✅ | ✅ | ✅ |
| full_access_branch | ✅ | ✅ | ✅ | ✅ |
| colaborador (con `user_access`) | ✅ | ✅ | ✅ | ❌ (`has_*_admin_access`) |
| full_viewer | ✅ | ❌ | ❌ | ❌ |
| colaborador_viewer | ✅ (su scope) | ❌ | ❌ | ❌ |
| visualizador_comentarista | ✅ (su scope) | ❌ | ❌ | ❌ |
| responsable_estandares | ✅ (consultora) | ❌ | ❌ | ❌ |
| viewer_observaciones | solo SUS observaciones (policy "select responsable") | ❌ | ❌ | ❌ |

- INSERT real implementado por `has_establecimiento_write_access(establecimiento_id)`
  (incidentes/inspecciones/riesgos/mediciones), `has_empresa_write_access(empresa_id)`
  (capacitaciones), o el join a `gestiones_registros → gestiones_establecimientos`
  para observaciones/registros.
- DELETE por `has_*_admin_access` → ni colaborador ni viewers borran.

### 3.2 Personas / Directorio (`personas_directorio`)
Policy vigente: `20260516000009_rls_fix_rename_consultor.sql` (reemplazó la
original `WITH CHECK (true)`), renombrada en `20260522000001_rename_tables.sql`.

| Rol | V | C | E | B |
|---|---|---|---|---|
| main / branch | ✅ | ✅ | ✅ | ✅ |
| colaborador | ✅ | ✅ (rol-gated, ver hueco §6.1) | ✅ | ❌ |
| viewers | ✅ (miembro activo de la consultora) | ❌ | ❌ | ❌ |

- SELECT = cualquier miembro activo de la consultora (directorio global del tenant).
- El vínculo persona↔establecimiento vive en `personas_establecimientos`
  (INSERT/DELETE por `has_establecimiento_write/admin_access`).

### 3.3 Documentos de persona (`personas_documentos`)
Acceso derivado vía `puestos_personas → puestos_de_trabajo → establecimientos_sectores`
y `has_establecimiento_read/write/admin_access`
(`20260516000007` + `20260517000010`). Viewers: solo V; colaborador V/C/E; main/branch todo.

### 3.4 Identidad / Consultora
| Recurso | V | C | E | B |
|---|---|---|---|---|
| `profiles` | propio + dev + co-miembros de consultora | dev (o trigger `on_auth_user_created`) | propio (trigger bloquea cambio de `system_role`) + dev | dev |
| `consultoras` | miembros activos + dev | cualquier autenticado (onboarding) | main + dev | dev |
| `consultoras_members` | dev / propio / co-miembro | main + suscripción activa + dev | main + dev | main (no a sí mismo) + dev |
| `empresas` | `has_empresa_read_access` | main/branch + suscripción activa | `has_empresa_write_access` | `has_empresa_admin_access` |
| `establecimientos` | `has_establecimiento_read_access` | `has_empresa_write_access` + suscripción | `has_establecimiento_write_access` | `has_establecimiento_admin_access` |
| `user_access` | dev / propio / main+branch (su consultora) / responsable | main + dev | main + dev | main + dev |
| `audit_log` | dev / propio / main+branch+responsable (de su consultora) | ❌ (solo trigger/RPC DEFINER) | ❌ (inmutable) | ❌ (inmutable) |

Policies: `20260514000002_rls_policies.sql`, `20260524000004_roles_super_admin.sql`
(suscripción + members), `20260527000005_responsable_estandares.sql` (audit_log + user_access),
`20260608000001_audit_log.sql` + `20260702000001_audit_trazabilidad_srt.sql` (inmutabilidad).

### 3.5 Catálogos globales (tipos)
`personas_tipos`, `organizaciones_tipos`, `documentos_tipos`,
`clasificacion_observaciones`, etc.: SELECT = autenticado; INSERT/UPDATE/DELETE =
solo `is_developer()`.

---

## 4. Autenticación, 2FA y sesiones

- **Login:** Supabase Auth password (`lib/actions/login.ts`,
  `app/api/auth/login/route.ts`). Tras login OK → `cache_user_permissions` + evento
  `LOGIN` en audit log (best-effort, no registra credenciales).
- **2FA por OTP email** (`mfa_email_challenges`, SHA256, single-use, 10 min;
  flujo en `app/(auth)` + `lib/actions/mfa-email.ts`). Cookie `mfa_verified` HMAC
  firmada (`MFA_COOKIE_SECRET`), TTL 24h.
- **Enforcement** (`middleware.ts` ~línea 85): obligatorio para
  `full_access_main` y `responsable_estandares`. Si falta MFA → redirige a `/mfa/verify`.
- **Bypass de testing — FASE DE ARMADO (ACTIVO por defecto):** `lib/auth/test-mfa-bypass.ts`.
  Mientras la app está en armado (sin suscriptores ni datos reales), el bypass está **ACTIVO por
  defecto** y cubre las cuentas `@sigmetria.app` + una allowlist puntual (la cuenta del fundador;
  ampliable con `MFA_BYPASS_EMAILS`). **KILL-SWITCH para compliance/launch:**
  `ALLOW_MFA_TEST_BYPASS=false` → el MFA real por OTP se exige a TODAS las cuentas (Art. 4.5).
  Ver §7. El login normal no se toca; el bypass del middleware no depende del email ni del cookie.
- **Cambio de email:** `lib/actions/email-change.ts` (OTP al nuevo email,
  `email_change_challenges`, single-use, 15 min). Solo `full_access_main`.
  **Hueco abierto:** no revoca sesiones activas — ver §6.2.

---

## 5. Acceso por QR (legajo técnico público)

- Ruta pública sin login: `app/verificar/[token]/page.tsx` (excluida del auth en
  `middleware.ts`).
- Tabla `verificacion_tokens(token uuid v4, establecimiento_id, access_count,
  last_accessed_at)` — `20260609000001_verificacion_tokens.sql`. Token generado
  automáticamente al crear el establecimiento (trigger).
- **No adivinable:** el token es `gen_random_uuid()` (UUID v4, 122 bits) — no
  secuencial, no enumerable. Verificado.
- **Revocable:** `regenerar_token(establecimiento_id)` reemplaza el UUID; el QR
  viejo deja de resolver (la página muestra "QR inválido o vencido"). Verificado.
- **Registro de acceso:** `registrar_acceso_legajo(token)` incrementa
  `access_count` y `last_accessed_at` (SECURITY DEFINER, fire-and-forget).
- **Datos expuestos:** nombre/domicilio/actividad/cantidad de trabajadores del
  establecimiento, inspecciones, documentos del legajo, capacitaciones (título +
  conteo de asistentes), riesgos abiertos, mediciones, incidentes abiertos.
  **NO expone DNI ni datos personales de empleados** (las queries no traen
  `personas_directorio`). Verificado en `page.tsx`.
- **Auditoría del acceso QR (implementado en Prompt 4):** se agregó
  `logAuditEvent({ accion: 'QR_ACCESS', tabla: 'verificacion_tokens',
  registroId: establecimiento_id, consultoraId, meta:{ token_id, empresa_id,
  establecimiento_id }, origen: 'sistema' })` en `page.tsx`, best-effort (no rompe
  la página pública). `meta` NO contiene datos sensibles. **Operativo en producción**:
  la migración del audit extendido (`20260702000001`, Prompt 1) está **aplicada a prod**
  (2026-06-11, run GitHub Actions 27368883915; cadena INTEGRA + escritura OK), por lo
  que el RPC `log_audit_event` existe y la acción `QR_ACCESS` se registra efectivamente.

---

## 6. Hallazgos

### Corregidos / verificados como YA correctos
- ✅ **Hueco (a) reportado como `directorio_personas INSERT WITH CHECK (true)`:**
  **YA estaba corregido** en producción por `20260516000009`. El estado real es
  role-gated (no viewers). Hueco residual fino en §6.1.
- ✅ **Dynamic Viewers solo-lectura a nivel RLS:** verificado. Ningún rol viewer
  aparece en `has_*_write_access`/`admin_access`. Test:
  `tests/viewer-readonly.test.ts` (30 casos, pasa).
- ✅ **Aislamiento entre empresas-cliente:** verificado. Toda read/write func
  ancla en `consultora_id` (vía `consultoras_members`/`user_access`). Un usuario
  de la consultora A no ve ni escribe datos de B.
- ✅ **QR no adivinable + revocable + sin datos personales:** verificado (§5).
- ✅ **Bypass MFA de testing:** gateado tras `ALLOW_MFA_TEST_BYPASS` (Prompt 4).

### 6.1 ✅ Corregido — `personas_directorio` INSERT exige scope al colaborador
- **Fix APLICADO:** `supabase/migrations/20260707000001_personas_directorio_insert_estricto.sql`
  (aplicado a prod 2026-06-11, corrida nocturna). Un `colaborador` solo puede insertar
  personas si tiene AL MENOS un `user_access` activo en su consultora; admins (main/branch)
  y developer sin restricción. Cierra el hueco intra-consultora del §6.1 original.

### 6.2 ✅ Corregido — revocación de sesión al cambiar email
- **Fix APLICADO:** RPC `revocar_sesiones_usuario` (`supabase/migrations/20260707000002_revocar_sesiones_usuario.sql`,
  service_role-only, borra `auth.sessions`) + llamada en `lib/actions/email-change.ts`
  tras `updateUserById`. Al cambiar el email, las sesiones viejas dejan de servir y el
  usuario re-loguea con el email nuevo. (Se eligió la Opción B/RPC: la Opción A `signOut(userId)`
  del archivo preparado era incorrecta para supabase-js v2, que espera un JWT, no un user_id.)

### 6.3 ✅ Corregido — `verificacion_tokens` UPDATE / `regenerar_token` ahora scopean tenant
- **Hueco original:** `supabase/migrations/20260609000001_verificacion_tokens.sql:32` y la
  función `regenerar_token` (SECURITY DEFINER sin chequeo de acceso) permitían que un admin de
  la consultora A invalidara el QR de un establecimiento de la consultora B (ruptura de
  aislamiento / DoS cruzado).
- **Fix APLICADO:** el fix preparado #3 fue **promovido** a la migración
  `supabase/migrations/20260706000001_verificacion_tokens_update_scoped.sql` y **aplicado a
  producción** (2026-06-11, run GitHub Actions 27370607649, success). El UPDATE/regeneración de
  tokens ahora queda scopeado por tenant; un admin de A ya no puede regenerar el QR de B.

### 6.4 Datos personales (DNI/teléfono/dirección)
- `personas_directorio` (DNI, teléfono, dirección, contacto de emergencia, talles)
  está gateada por membresía de consultora en SELECT y por write/admin access en
  C/E/B. **Ningún rol ve personas de otra consultora.** Dentro de la consultora,
  TODO miembro activo (incluidos viewers) puede VER el directorio — esto es por
  diseño (directorio compartido del tenant), no un leak cross-tenant.
- El **QR público NO expone** ningún dato personal de trabajadores (§5).
- Endpoint de portabilidad (`/api/.../export`, Prompt 3) scopea por empresa con RLS
  + filtro explícito (defensa en profundidad) — no es un canal de fuga.
- **Sin hallazgos de exposición indebida de datos personales.**

---

## 7. Variables de entorno introducidas (Prompt 4)

| Env var | Default | Efecto |
|---|---|---|
| `ALLOW_MFA_TEST_BYPASS` | ausente → **bypass ACTIVO** (fase de armado) | Bypass MFA activo para `@sigmetria.app` + allowlist. |
| `ALLOW_MFA_TEST_BYPASS=false` | — | **KILL-SWITCH:** desactiva el bypass → MFA real por OTP para todas las cuentas. Setear antes del launch/compliance. |
| `MFA_BYPASS_EMAILS` | ausente | Allowlist extra de emails (coma-separadas) que bypassean, además de `@sigmetria.app` y la cuenta del fundador hardcodeada. |

---

## 8. Resumen de cambios del Prompt 4

**Implementado (app-side, seguro y aditivo):**
- Gate del bypass MFA tras `ALLOW_MFA_TEST_BYPASS` — `lib/auth/test-mfa-bypass.ts`.
- Auditoría de acceso QR (`QR_ACCESS`, best-effort) — `app/verificar/[token]/page.tsx`.
- Test de viewers solo-lectura — `tests/viewer-readonly.test.ts`.

**Aplicado a producción (2026-06-11):**
- `supabase/migrations/20260706000001_verificacion_tokens_update_scoped.sql` (ex fix preparado #3;
  run GitHub Actions 27370607649) — UPDATE/`regenerar_token` scopeado por tenant. Ver §6.3.

**Aplicado a producción (2026-06-11, corrida nocturna — el usuario autorizó aplicar lo pendiente):**
- `supabase/migrations/20260707000001_personas_directorio_insert_estricto.sql` (ex fix preparado #1) —
  INSERT de `personas_directorio` exige scope al colaborador. Hueco §6.1 **cerrado**.
- `supabase/migrations/20260707000002_revocar_sesiones_usuario.sql` (ex fix preparado #2, Opción B) +
  llamada en `email-change.ts` — sesiones revocadas al cambiar email. Hueco §6.2 **cerrado**.

> Con esto, los 3 fixes preparados del Prompt 4 quedaron aplicados (el #3 ya estaba — §6.3).
> No quedan fixes de acceso pendientes.
