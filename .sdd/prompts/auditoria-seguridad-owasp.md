# Auditoría Completa de Seguridad (OWASP Top 10 + Chequeo General)

## Objetivo
Remediación de hallazgos de seguridad identificados en el codebase, siguiendo OWASP Top 10 2021. Incluye: RLS de Storage, HSTS, CSRF en API routes, rate limiting, CSP hardening, ownership checks, edge function auth, y seguridad en subcontratistas.

## Stack
- Next.js 15 App Router + Server Actions
- Supabase PostgreSQL 17 (RLS + Storage + Auth)
- Zod para validación
- Vitest + Playwright para security tests

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Enfoque | Remediar hallazgos actuales + establecer scanning automatizado |
| Rate limiting | `@upstash/ratelimit` con Redis (Upstash) — serverless-friendly, sin infraestructura extra |
| Security headers | Reforzar `next.config.ts` + agregar HSTS |
| Bucket `subcontratistas` | Reemplazar policies con `storage_path_consultora_id()` como los demás buckets |
| Edge function | Agregar JWT verification o CRON_SECRET |
| Security tests | Tests automatizados en CI: npm audit, RLS coverage check, security headers check |

## Estado actual — Resumen de hallazgos

### Críticos (remediar YA)

| # | Hallazgo | Lugar | Impacto |
|---|----------|-------|---------|
| C1 | Bucket `subcontratistas` sin RLS real | `supabase/migrations/20260531000001` | Cualquier usuario auth puede leer/escribir docs de subcontratistas |
| C2 | Edge function sin JWT verification | `supabase/functions/cron-vencimientos/index.ts` (--no-verify-jwt) | Cualquiera que descubra la URL puede invocar el cron con service role |
| C3 | Agent `/approve` no verifica ownership | `app/api/agent/approve/route.ts` | Usuario A puede aprobar acciones pendientes del Usuario B |

### Altos (remediar pronto)

| # | Hallazgo | Lugar | Impacto |
|---|----------|-------|---------|
| H1 | Sin Strict-Transport-Security (HSTS) | `next.config.ts` — headers | Expuesto a SSL Strip |
| H2 | CSP débil (`unsafe-inline` + `unsafe-eval`) | `next.config.ts` | Defensa en profundidad reducida contra XSS |
| H3 | Sin rate limiting en login ni endpoints | En toda la app | Fuerza bruta en auth, abuso de API |
| H4 | Demo credentials hardcodeadas en login | `app/(auth)/login/page.tsx` | Exposición de credenciales en bundle cliente |
| H5 | Sin protección CSRF en API routes (Origin/Referer) | `app/api/*` | Las API routes no verifican origen |

### Moderados (remediar en la misma tanda)

| # | Hallazgo | Lugar |
|---|----------|-------|
| M1 | `SUPABASE_SERVICE_ROLE_KEY` usado en server actions | `lib/actions/usuario.ts`, `consultora.ts` |
| M2 | `app/api/upload-plano/route.ts` sin validación MIME/tamaño | `app/api/upload-plano/route.ts` |
| M3 | Validación Zod inconsistente en server actions | Varias server actions |
| M4 | Middleware excluye `/api` (aunque rutas se protegen individualmente) | `middleware.ts` |
| M5 | `cron/vencimientos` sin CRON_SECRET obligatorio | `app/api/cron/vencimientos/route.ts` |

### Para destacar (mantener)
- ✅ Cobertura RLS excelente (~113 tablas con RLS)
- ✅ No hay SQL injection vector detectable
- ✅ No hay `dangerouslySetInnerHTML`
- ✅ File uploads con validación MIME + tamaño via `uploadAsset()`
- ✅ Cookies seguras por defecto (Supabase SSR)

## Plan de remediación

### C1 — Bucket `subcontratistas` RLS

Reemplazar las policies actuales con el mismo patrón que los buckets existentes:

```sql
-- Eliminar policies actuales (solo auth.role())
DROP POLICY IF EXISTS "subcontratistas: select" ON storage.objects;
DROP POLICY IF EXISTS "subcontratistas: insert" ON storage.objects;
DROP POLICY IF EXISTS "subcontratistas: update" ON storage.objects;
DROP POLICY IF EXISTS "subcontratistas: delete" ON storage.objects;

-- Recrear con consultora_id desde el path (mismo patrón que logos, firmas, etc.)
CREATE POLICY "subcontratistas: select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'subcontratistas'
    AND storage_path_consultora_id(name) IN (
      SELECT cm.consultora_id FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    )
  );

-- INSERT, UPDATE, DELETE — mismas condiciones + check de rol operativo
```

### C2 — Edge function auth

Opción recomendada: agregar `verify_jwt: true` + validar `CRON_SECRET` como fallback.

```typescript
// En la edge function o en el API route /api/cron/vencimientos
const authHeader = req.headers.get('authorization')
const cronSecret = Deno.env.get('CRON_SECRET')

if (authHeader !== `Bearer ${cronSecret}`) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}
```

O si se deploya con verify_jwt, pasar el JWT del service role como Bearer token.

### C3 — Agent approve ownership

```typescript
// app/api/agent/approve/route.ts
const { data: pendingAction } = await supabase
  .from('pending_agent_actions')
  .select('requested_by')
  .eq('id', actionId)
  .eq('requested_by', user.id)  // ← agregar este filter
  .single()

if (!pendingAction) {
  return Response.json({ error: 'Acción no encontrada o no es tuya para aprobar' }, { status: 403 })
}
```

### H1 — HSTS Header

```typescript
// next.config.ts — async headers()
{
  key: 'Strict-Transport-Security',
  value: 'max-age=31536000; includeSubDomains; preload',
}
```

### H2 — CSP Hardening

Mantener `unsafe-inline` y `unsafe-eval` (requeridos por Next.js) pero agregar:
- `strict-dynamic` como fallback para navegadores modernos
- Report-URI / report-to para monitoreo de violaciones
- Verificar si se puede eliminar unsafe-eval (probablemente no, Next.js lo necesita)

```typescript
{
  key: 'Content-Security-Policy-Report-Only',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic'; ...; report-uri /api/csp-report;"
}
```

O implementar CSP Reporting via endpoint `/api/csp-report` que loguee violaciones.

### H3 — Rate Limiting

Usar `@upstash/ratelimit` + `@upstash/redis` (serverless, sin infraestructura):

```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const authRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '60 s'), // 5 intentos por minuto
  analytics: true,
  prefix: 'ratelimit:auth',
})

export const apiRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(30, '60 s'), // 30 requests por minuto
  analytics: true,
  prefix: 'ratelimit:api',
})
```

Agregar en:
- `app/(auth)/login/page.tsx` — rate limit antes de `signInWithPassword`
- Middleware o wrapper para API routes
- Server actions sensibles (creación de entidades)

### H4 — Demo credentials

Reemplazar el texto hardcodeado con:
```tsx
// Solo mostrar en desarrollo
if (process.env.NODE_ENV === 'development') {
  // mostrar credenciales de demo
}
```

O mejor: crear un componente `DemoCredentials` que solo se renderiza en dev.

```tsx
export function DemoCredentials() {
  if (process.env.NODE_ENV !== 'development') return null
  // ... mostrar credenciales
}
```

### H5 — CSRF protection en API routes

Agregar verificación de Origin/Referer en las API routes sensibles o via middleware helper:

```typescript
// lib/csrf.ts
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL

  if (!origin && !referer) return false
  if (origin && origin !== allowedOrigin) return false
  if (referer && !referer.startsWith(allowedOrigin + '/')) return false

  return true
}
```

### M1 — Service role key en server actions

Crear API routes dedicadas para operaciones que requieren service role, en vez de usar el admin client en server actions:

```typescript
// En vez de:
import { createAdminClient } from '@/lib/supabase/admin'

export async function inviteUser(...) {
  const supabase = createAdminClient() // service role en server action
  // ...
}

// Hacer:
POST /api/admin/invite-user → usa service role server-side
// Y la server action llama al API route
```

### M2 — upload-plano validation

```typescript
// app/api/upload-plano/route.ts
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

if (!ALLOWED_MIMES.includes(file.type)) {
  return Response.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
}
if (file.size > MAX_SIZE) {
  return Response.json({ error: 'Archivo demasiado grande' }, { status: 400 })
}
```

## Security Scanning — CI Integration

### `package.json` scripts

```json
{
  "scripts": {
    "security:audit": "npm audit --audit-level=high",
    "security:check": "node scripts/security-check.js",
    "security:all": "npm run security:audit && npm run security:check"
  }
}
```

### `scripts/security-check.js`

Script que corre en CI y verifica:
1. Que no haya `dangerouslySetInnerHTML` en el codebase (grep)
2. Que no haya credenciales hardcodeadas (regex patterns)
3. Que todas las API routes tengan auth check (parseo básico)
4. Que los storage buckets tengan RLS policies (check de migraciones)

### CI — job de seguridad

```yaml
# .github/workflows/ci.yml
security:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm run security:audit
    - run: npm run security:check
    - name: Check for hardcoded secrets
      run: |
        ! grep -r "AKIA[0-9A-Z]\{16\}" --include="*.ts" --include="*.tsx" .
        ! grep -r "sk-[a-zA-Z0-9]\{20,\}" --include="*.ts" --include="*.tsx" .
```

## Security Tests

### `tests/security/rls.test.ts` — RLS coverage check

```typescript
import { describe, it, expect } from 'vitest'

// Verificar que tablas clave tienen RLS habilitado
// Esto requiere un cliente Supabase con accesso a información del schema
describe('RLS coverage', () => {
  it('subcontratistas has RLS enabled', async () => {
    // query information_schema.tables + pg_class relrowsecurity
    // o simplemente verificar que la migración contiene ENABLE ROW LEVEL SECURITY
  })
})
```

### `tests/security/headers.test.ts` — Security headers check

```typescript
import { describe, it, expect } from 'vitest'
import { headers } from '@/next.config'

describe('security headers', () => {
  it('includes Strict-Transport-Security', () => {
    const hsts = headers.find(h => h.key === 'Strict-Transport-Security')
    expect(hsts).toBeDefined()
  })
  it('includes X-Frame-Options: DENY', () => {
    // ...
  })
})
```

### E2E — Security smoke tests

Agregar a Playwright specs:

```typescript
// e2e/specs/security/headers.spec.ts
test('security headers are present', async ({ request }) => {
  const response = await request.get('/dashboard')
  expect(response.headers()['strict-transport-security']).toBeDefined()
  expect(response.headers()['x-frame-options']).toBe('DENY')
  expect(response.headers()['x-content-type-options']).toBe('nosniff')
})

// e2e/specs/security/rate-limit.spec.ts
test('rate limiting blocks excessive login attempts', async ({ page }) => {
  // Intentar login 10 veces → la 11va debe fallar con rate limit
})
```

## Checklist de remediación

- [ ] **C1**: RLS bucket `subcontratistas` — policies por consultora_id
- [ ] **C2**: Edge function / cron JWT verification
- [ ] **C3**: Agent approve — ownership check
- [ ] **H1**: HSTS header en next.config.ts
- [ ] **H2**: CSP reporting endpoint + monitoreo
- [ ] **H3**: Rate limiting (login + API routes)
- [ ] **H4**: Demo credentials condicionales (solo dev)
- [ ] **H5**: CSRF Origin/Referer check en API routes
- [ ] **M1**: Service role key movido a API routes
- [ ] **M2**: upload-plano validación MIME/tamaño
- [ ] **M3**: Zod validation consistente en server actions
- [ ] **M4**: Revisar exclusión de `/api` del middleware (o mantener + docs)
- [ ] **M5**: CRON_SECRET obligatorio
- [ ] **CI**: npm audit + security check script
- [ ] **Tests**: security headers test + RLS coverage test

## Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `lib/rate-limit.ts` | Rate limiting con Upstash |
| `lib/csrf.ts` | CSRF Origin/Referer validation |
| `scripts/security-check.js` | Security scan script para CI |
| `tests/security/headers.test.ts` | Security headers unit test |
| `tests/security/rls.test.ts` | RLS coverage test |
| `components/demo-credentials.tsx` | Demo credentials condicional (solo dev) |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `next.config.ts` | Agregar HSTS + CSP reporting |
| `middleware.ts` | Opcional: agregar rate limiting |
| `app/api/agent/approve/route.ts` | Ownership check |
| `app/api/cron/vencimientos/route.ts` | CRON_SECRET obligatorio |
| `app/api/upload-plano/route.ts` | MIME + size validation |
| `app/(auth)/login/page.tsx` | Rate limiting + demo credentials condicional |
| `.github/workflows/ci.yml` | Agregar job security |
| `package.json` | Agregar scripts + dependencias |
| `supabase/migrations/20260531000001` | RLS bucket subcontratistas fix |
| `supabase/functions/cron-vencimientos/index.ts` | Auth check |
| `lib/actions/usuario.ts` | Mover service role usage a API route |
| `lib/actions/consultora.ts` | Mover service role usage a API route |

## Archivos existentes relevantes

- `next.config.ts` — Config de headers de seguridad
- `middleware.ts` — Auth middleware (excluye /api)
- `lib/storage/upload.ts` — Sistema de upload (MIME + size validation)
- `lib/supabase/admin.ts` — Admin client (service role)
- `lib/supabase/server.ts` — Server client (cookies)
- `app/api/agent/approve/route.ts` — Agent approve endpoint
- `app/api/upload-plano/route.ts` — Plano upload (sin validación)
- `app/(auth)/login/page.tsx` — Login page (demo creds + rate limit)
- `supabase/functions/cron-vencimientos/index.ts` — Edge function sin auth
- `supabase/migrations/20260521172801_storage_assets_buckets.sql` — Referencia: RLS correcta en buckets
- `.github/workflows/ci.yml` — CI pipeline
- `lib/schemas/index.ts` — Zod schemas (extender validación)
