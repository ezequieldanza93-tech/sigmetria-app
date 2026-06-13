# API de Interoperabilidad `/api/v1` — Sigmetría HyS

> **Estándar 7 (Interoperabilidad) · SRT Disp. 15/2026.** Documentación de la API pública
> y de los endpoints de intercambio que expone la plataforma para integración y validación
> cruzada de datos de cumplimiento normativo.
>
> **Fuente (regla de oro):** código REAL del repo, no supuestos. Cada endpoint, header,
> parámetro y campo de respuesta está tomado de los archivos citados con `archivo:línea`.
> La API ya existe en producción y está autenticada por API key; este documento la describe
> tal cual está implementada hoy.
>
> **Cobertura legal:** la propia base de datos cita la norma — la tabla `api_keys` se creó
> "para interoperabilidad (Art. 4.7 Res. SRT 48/2025)"
> (`supabase/migrations/20260610000001_api_keys.sql:1`). El OpenAPI generado en runtime
> repite esa cita en su `info.description` (`app/api/v1/docs/route.ts:10`).

---

## 1. Visión general

| Dato | Valor |
|------|-------|
| **Base URL** | `https://app.sigmetria.com.ar/api/v1` (configurable vía `NEXT_PUBLIC_APP_URL`) |
| **Versión** | `1` (versionada en el path: `/api/v1`) |
| **Formato** | JSON sobre HTTPS |
| **Auth** | API key vía header `Authorization: Bearer <key>` |
| **Propósito** | Interoperabilidad SRT: exponer estado de cumplimiento, legajos técnicos y nómina de empresas de una consultora para integración / validación cruzada con sistemas externos |
| **Spec OpenAPI** | `GET /api/v1/docs` devuelve un documento OpenAPI 3.0.3 (auto-generado en runtime) |

El base URL sale de `app/api/v1/docs/route.ts:3`:

```ts
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sigmetria.com.ar'
```

La API es de **solo lectura** (`GET`). No hay endpoints de escritura. Las API keys se emiten
hoy con el permiso `['read']` únicamente (`actions.ts:35`).

### Endpoints (resumen)

| Método | Path | Qué devuelve |
|--------|------|--------------|
| `GET` | `/api/v1/docs` | Documento OpenAPI 3.0.3 de la API (no requiere API key) |
| `GET` | `/api/v1/empresas` | Lista de empresas de la consultora dueña de la key |
| `GET` | `/api/v1/empresas/{cuit}/cumplimiento` | Semáforo de cumplimiento por establecimiento de una empresa |
| `GET` | `/api/v1/establecimientos/{id}/legajo` | Legajo técnico completo de un establecimiento |

> **Nota:** son las únicas 4 rutas reales bajo `app/api/v1/`. No hay más endpoints; no se
> inventó ninguno. `/docs` es el endpoint de auto-descripción (OpenAPI); los otros tres son
> los de intercambio de datos.

---

## 2. Autenticación

### Header exacto

```
Authorization: Bearer sig_<64-hex>
```

La validación está en `lib/api/auth.ts:10-40` (`authenticateApiKey`):

1. Lee el header `Authorization`. Si **no existe** o **no empieza con `Bearer `** → devuelve `null` (`auth.ts:11-12`).
2. Extrae el token (todo lo posterior a `Bearer `, trim). Si queda vacío → `null` (`auth.ts:14-15`).
3. Calcula `sha256(rawKey)` en hex y busca en `api_keys` por `key_hash` (`auth.ts:17-24`).
   La key **nunca se guarda en claro**: en la base solo vive el hash SHA-256.
4. Si no hay match, o la key tiene `revoked_at` seteado → `null` (`auth.ts:26`).
5. Si es válida, actualiza `last_used_at` (fire-and-forget) y devuelve el contexto (`auth.ts:28-39`):

```ts
interface ApiKeyContext {
  api_key_id: string
  consultora_id: string   // ← scoping multi-tenant
  permisos: string[]
}
```

Cuando `authenticateApiKey` devuelve `null`, cada ruta responde **401**:

```ts
const ctx = await authenticateApiKey(request)
if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
```
(`empresas/route.ts:7-8`, idéntico en las otras dos rutas de datos).

### Scoping por consultora (tenant)

La API key **está atada a una consultora** vía la columna `api_keys.consultora_id`
(`migrations/20260610000001_api_keys.sql:4`). Ese `consultora_id` viaja en el `ApiKeyContext`
y **filtra todas las queries**:

- `GET /empresas` → `.eq('consultora_id', ctx.consultora_id)` (`empresas/route.ts:17`).
- `GET /empresas/{cuit}/cumplimiento` → la empresa se busca por CUIT **y** `consultora_id`
  (`cumplimiento/route.ts:22-24`); si no hay match → 404.
- `GET /establecimientos/{id}/legajo` → verifica explícitamente que el establecimiento
  pertenezca a la consultora de la key; si `empresa.consultora_id !== ctx.consultora_id`
  → **403 FORBIDDEN** (`legajo/route.ts:28-31`).

Es decir: una key **nunca** puede leer datos de otra consultora. El aislamiento es por
filtro de query (las rutas usan `createServiceClient`, que bypassea RLS, por eso el
scoping se hace a mano en cada handler).

### Cómo obtener una API key

Desde la app: **Configuración → API Keys**
(`app/(dashboard)/dashboard/configuracion/api-keys/page.tsx`).

- **Quién puede crearlas:** solo el rol `full_access_main` (administrador principal) de la
  consultora. Lo refuerzan tanto la server action (`actions.ts:21-23`) como la RLS de INSERT
  de la tabla (`migrations/20260610000001_api_keys.sql:33-44`).
- **Generación** (`actions.ts:25-36`):

  ```ts
  const rawKey  = 'sig_' + crypto.randomBytes(32).toString('hex')   // ej: sig_a1b2...  (68 chars)
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 12)   // ej: sig_a1b2c3d  → para mostrar en la UI
  ```

  - **Formato:** prefijo `sig_` + 64 caracteres hex (32 bytes random).
  - **Hashing:** se guarda `key_hash` = SHA-256 de la key + `key_prefix` (primeros 12 chars)
    para identificarla visualmente. El valor en claro se devuelve **una sola vez** al crearla
    (`actions.ts:41`) y no se puede recuperar después.
  - Se emite con `permisos: ['read']` (`actions.ts:35`).
- **Revocación:** la misma pantalla permite revocar; setea `revoked_at`
  (`actions.ts:44-58`). Una key revocada falla la auth (paso 4 de arriba).

### Tabla `api_keys` (esquema)

`supabase/migrations/20260610000001_api_keys.sql:2-13`:

| Columna | Tipo | Nota |
|---------|------|------|
| `id` | uuid PK | identificador de la key (es el `api_key_id` del contexto y del rate limiting) |
| `consultora_id` | uuid NOT NULL FK → `consultoras` | tenant al que pertenece la key |
| `name` | text NOT NULL | nombre descriptivo que pone el admin |
| `key_hash` | text NOT NULL UNIQUE | SHA-256 de la key (nunca la key en claro) |
| `key_prefix` | text NOT NULL | primeros 12 chars, para mostrar en la UI |
| `permisos` | text[] NOT NULL DEFAULT `{}` | hoy se emite `['read']` |
| `created_by` | uuid FK → `profiles` | quién la creó |
| `created_at` | timestamptz | — |
| `last_used_at` | timestamptz | se actualiza en cada request autenticado |
| `revoked_at` | timestamptz | si está seteado, la key deja de funcionar |

> **Nota de implementación:** el campo `permisos` existe y viaja en el contexto, pero los
> endpoints actuales **no chequean permisos finos** (todas las keys leen todo lo de su
> consultora). Es un gancho para granularidad futura.

---

## 3. Rate limiting

Implementado con **Upstash Redis** (`lib/rate-limit.ts`). Cada ruta de datos lo aplica
**después** de autenticar, usando el `api_key_id` como identificador
(`empresas/route.ts:10-11`):

```ts
const rl = await checkRateLimit(apiRatelimit, ctx.api_key_id)
if (!rl.allowed) return apiError('RATE_LIMITED', 'Too many requests — limit: 60/min', 429)
```

| Parámetro | Valor |
|-----------|-------|
| **Límite** | **60 requests / 60 segundos**, por API key (sliding window) — `rate-limit.ts:27-30` |
| **Identificador** | `api_key_id` (no por IP) → el cupo es por key |
| **Al exceder** | HTTP **429** con `{ "error": { "code": "RATE_LIMITED", "message": "Too many requests — limit: 60/min" } }` |
| **Sin Redis configurado** | si faltan `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, el limiter es un **no-op** que siempre permite (`rate-limit.ts:5-13`) — útil en dev/test |

> **Headers de rate limit:** hoy **no** se devuelven headers tipo `X-RateLimit-Remaining` /
> `Retry-After`. `checkRateLimit` calcula `remaining` internamente (`rate-limit.ts:37-42`)
> pero las rutas solo usan el flag `allowed`; el `remaining` no se propaga a la respuesta.
> Queda como mejora futura (ver §6).

El límite de 60/min también está documentado de cara al usuario en la pantalla de API Keys
(`api-keys/page.tsx:40`).

---

## 4. Endpoints

### 4.0 `GET /api/v1/docs` — Especificación OpenAPI

Devuelve el documento **OpenAPI 3.0.3** de la API, generado en runtime
(`app/api/v1/docs/route.ts:5-139`). **No requiere API key** (es metadata pública de la API).

**Request**

```bash
curl https://app.sigmetria.com.ar/api/v1/docs
```

**Response 200** (estructura — `docs/route.ts:6-136`): objeto OpenAPI con `info` (cita
Art. 4.7 Res. SRT 48/2025), `servers`, `components.securitySchemes.bearerAuth`,
`components.schemas` (`Error`, `Empresa`, `EstadoCumplimiento`, `EstablecimientoCumplimiento`)
y `paths` con los tres endpoints de datos.

> Útil para herramientas externas (Swagger UI, Postman, generadores de cliente). Es la base
> para una validación cruzada automatizada con los sistemas de la SRT.

---

### 4.1 `GET /api/v1/empresas` — Listar empresas

Devuelve todas las empresas gestionadas por la consultora dueña de la API key
(`app/api/v1/empresas/route.ts:6-36`).

**Parámetros:** ninguno (ni query ni body).

**Request**

```bash
curl https://app.sigmetria.com.ar/api/v1/empresas \
  -H "Authorization: Bearer sig_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Response 200** (forma real según `empresas/route.ts:22-35`):

```json
{
  "data": [
    {
      "id": "3f2a...uuid",
      "razon_social": "ACME S.A.",
      "cuit": "30719848531",
      "rubro": "Industria metalúrgica",
      "localidad": "Rosario",
      "provincia": "Santa Fe"
    }
  ],
  "total": 1
}
```

- `cuit`, `rubro`, `localidad`, `provincia` pueden ser `null`.
- `localidad`/`provincia` salen del join `localidades`; `rubro` del join `rubros`
  (`empresas/route.ts:16`).
- Orden: por `razon_social` ascendente (`empresas/route.ts:18`).

**Errores:** `401 UNAUTHORIZED`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR` (error de base —
`empresas/route.ts:20`).

---

### 4.2 `GET /api/v1/empresas/{cuit}/cumplimiento` — Cumplimiento por CUIT

Devuelve el **semáforo de cumplimiento** de cada establecimiento de la empresa identificada
por CUIT (`app/api/v1/empresas/[cuit]/cumplimiento/route.ts:6-89`).

**Parámetros de path**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `cuit` | string | CUIT sin guiones (ej: `30719848531`). Se matchea exacto contra `empresas.cuit`. |

**Request**

```bash
curl https://app.sigmetria.com.ar/api/v1/empresas/30719848531/cumplimiento \
  -H "Authorization: Bearer sig_xxxxxxxx..."
```

**Response 200** (forma real según `cumplimiento/route.ts:70-88`):

```json
{
  "empresa": {
    "id": "emp-uuid",
    "razon_social": "ACME S.A.",
    "cuit": "30719848531"
  },
  "establecimientos": [
    {
      "id": "est-uuid",
      "nombre": "Planta Sur",
      "domicilio": "Av. Siempre Viva 123",
      "estado": "rojo",
      "riesgos_criticos": 2,
      "riesgos_altos": 1,
      "incidentes_abiertos": 3,
      "siniestros_abiertos": 3,
      "documentos_vencidos": 1
    }
  ],
  "generado_en": "2026-06-13T14:05:00.000Z"
}
```

**Lógica del semáforo `estado`** (`cumplimiento/route.ts:61-68`):

| Estado | Condición |
|--------|-----------|
| `rojo` | hay riesgos críticos **o** incidentes con `fecha_ocurrencia` de hace más de 30 días **o** documentos vencidos |
| `amarillo` | hay riesgos altos **o** algún incidente abierto (sin disparar rojo) |
| `verde` | ninguna de las anteriores |

Definiciones de los contadores:
- `riesgos_criticos` / `riesgos_altos`: riesgos con `resuelto = false`, por `nivel`
  (`cumplimiento/route.ts:41`, `56-57`).
- `incidentes_abiertos`: incidentes en estado `pendiente` o `en_investigacion`
  (`cumplimiento/route.ts:44`).
- `documentos_vencidos`: documentos del establecimiento con `fecha_vencimiento` pasada
  (`cumplimiento/route.ts:58`).

> **Campo deprecado:** `siniestros_abiertos` es un **alias de compatibilidad** de
> `incidentes_abiertos` con el mismo valor (`cumplimiento/route.ts:79`). Está marcado como
> deprecado en el código y en el OpenAPI (`docs/route.ts:63`). Usar `incidentes_abiertos`.
> El test de contrato `public-contracts.test.ts:87-119` garantiza que ambos campos sean
> siempre iguales.

**Errores:** `401 UNAUTHORIZED`, `404 NOT_FOUND` ("Empresa not found for this CUIT" — incluye
el caso de que el CUIT exista pero sea de otra consultora, `cumplimiento/route.ts:26`),
`429 RATE_LIMITED`.

---

### 4.3 `GET /api/v1/establecimientos/{id}/legajo` — Legajo técnico

Devuelve el **legajo técnico completo** de un establecimiento: riesgos activos, inspecciones,
documentos, capacitaciones e incidentes abiertos
(`app/api/v1/establecimientos/[id]/legajo/route.ts:6-115`).

**Parámetros de path**

| Param | Tipo | Descripción |
|-------|------|-------------|
| `id` | string (uuid) | UUID del establecimiento |

**Request**

```bash
curl https://app.sigmetria.com.ar/api/v1/establecimientos/est-uuid/legajo \
  -H "Authorization: Bearer sig_xxxxxxxx..."
```

**Response 200** (forma real según `legajo/route.ts:80-114`):

```json
{
  "establecimiento": {
    "id": "est-uuid",
    "nombre": "Planta Sur",
    "domicilio": "Av. Siempre Viva 123",
    "empresa": { "id": "emp-uuid", "razon_social": "ACME S.A.", "cuit": "30719848531" }
  },
  "riesgos_activos": [
    { "nivel": "critico", "descripcion": "Tablero sin protección", "fecha_identificacion": "2026-04-01" }
  ],
  "inspecciones": [
    { "estado": "cerrada", "fecha_realizada": "2026-05-10", "observaciones": "Sin novedades" }
  ],
  "documentos": [
    { "tipo": "Plan de evacuación", "fecha_vencimiento": "2026-12-31", "vigente": true }
  ],
  "capacitaciones": [
    { "titulo": "Uso de extintores", "fecha_realizada": "2026-03-15" }
  ],
  "incidentes_abiertos": [
    { "tipo": "accidente_grave", "estado": "pendiente", "fecha_ocurrencia": "2026-01-10" }
  ],
  "siniestros_abiertos": [
    { "tipo": "accidente_grave", "estado": "pendiente", "fecha_ocurrencia": "2026-01-10" }
  ],
  "generado_en": "2026-06-13T14:05:00.000Z"
}
```

Detalles por sección:
- **`riesgos_activos`**: solo `resuelto = false`, orden por `fecha_identificacion` desc
  (`legajo/route.ts:43-47`).
- **`inspecciones`**: últimas 10, orden por `fecha_realizada` desc (`legajo/route.ts:48-52`).
- **`documentos`**: cada uno con `tipo` (del join `documentos_tipos`, `'—'` si no hay),
  `fecha_vencimiento` y `vigente` (true si no vence o vence en el futuro)
  (`legajo/route.ts:70-78`).
- **`capacitaciones`**: de la **empresa** (no del establecimiento), solo `estado = 'realizada'`,
  últimas 10 (`legajo/route.ts:57-62`).
- **`incidentes_abiertos`**: estados `pendiente` / `en_investigacion`
  (`legajo/route.ts:63-67`).

> **Campo deprecado:** `siniestros_abiertos` repite `incidentes_abiertos` por compatibilidad
> (`legajo/route.ts:108-112`, marcado `@deprecated`). El test `public-contracts.test.ts:37-83`
> verifica la igualdad. Usar `incidentes_abiertos`.

**Errores:** `401 UNAUTHORIZED`, `403 FORBIDDEN` (el establecimiento existe pero es de otra
consultora — `legajo/route.ts:29-31`), `404 NOT_FOUND` (no existe — `legajo/route.ts:26`),
`429 RATE_LIMITED`.

---

## 5. Convenciones

### Estructura de error

Todos los errores siguen el mismo formato (`lib/api/auth.ts:42-44`, `apiError`):

```json
{ "error": { "code": "NOT_FOUND", "message": "Empresa not found for this CUIT" } }
```

| `code` | HTTP | Cuándo |
|--------|------|--------|
| `UNAUTHORIZED` | 401 | API key ausente, mal formada o inválida/revocada |
| `FORBIDDEN` | 403 | el recurso existe pero pertenece a otra consultora |
| `NOT_FOUND` | 404 | el recurso no existe (o no es de tu consultora, en el caso de `/cumplimiento`) |
| `RATE_LIMITED` | 429 | superaste 60 req/min para esa key |
| `INTERNAL_ERROR` | 500 | error de base de datos |

### Fechas

- **Timestamps generados** (`generado_en`): ISO 8601 UTC vía `Date.toISOString()`
  (`cumplimiento/route.ts:87`, `legajo/route.ts:113`), ej. `2026-06-13T14:05:00.000Z`.
- **Fechas de datos** (`fecha_vencimiento`, `fecha_identificacion`, `fecha_ocurrencia`,
  `fecha_realizada`): se devuelven **tal cual están en la base** (string `YYYY-MM-DD`
  típicamente), o `null` si no hay valor.

### IDs

- UUID v4 en formato string para `empresa.id`, `establecimiento.id`, etc.
- El identificador externo de empresa para integración es el **CUIT** (path param en
  `/cumplimiento`).

### Paginación

**No hay paginación.** `GET /empresas` devuelve **todas** las empresas de la consultora con
un campo `total` que es simplemente `data.length` (`empresas/route.ts:35`), no un total de
una página. Las listas internas de `/legajo` están **acotadas por límite fijo**
(inspecciones y capacitaciones: 10 ítems c/u — `legajo/route.ts:52`, `62`), no paginadas.

### Tenant scoping

La key está atada a **una** consultora (`api_keys.consultora_id`). No existe forma de que una
key acceda a datos de otra consultora — el filtro es server-side en cada endpoint (ver §2).

---

## 6. Notas de cumplimiento (Estándar 7 — Interoperabilidad)

### Qué cubre hoy

- **API documentada y endpoints de intercambio:** este documento + el OpenAPI vivo en
  `GET /api/v1/docs` cubren el requisito de "documentación de la API y endpoints de
  intercambio" del Estándar 7.
- **Intercambio / validación cruzada:** los tres endpoints de datos permiten que un sistema
  externo (ej. el de la ART o un tablero de la SRT) consulte, para una consultora:
  - la **nómina de empresas** (`/empresas`),
  - el **estado de cumplimiento** de cada establecimiento por CUIT (`/empresas/{cuit}/cumplimiento`),
  - el **legajo técnico** completo de un establecimiento (`/establecimientos/{id}/legajo`).
  Esto habilita validación cruzada de datos de HyS sin acceso a la app.
- **Autenticación y trazabilidad:** acceso por API key con hash SHA-256 (la key en claro
  nunca se persiste), scoping estricto por consultora, revocación y registro de `last_used_at`.
- **Disponibilidad controlada:** rate limiting de 60 req/min por key (Upstash Redis).
- **Contratos garantizados por test:** `app/api/v1/__tests__/public-contracts.test.ts`
  fija el contrato de los campos `incidentes_abiertos` / `siniestros_abiertos`, evitando
  romper integraciones existentes.

### Trazabilidad normativa en el propio código

- `migrations/20260610000001_api_keys.sql:1` — "claves de acceso externo para
  interoperabilidad (Art. 4.7 Res. SRT 48/2025)".
- `docs/route.ts:10` y `api-keys/page.tsx:32` — citan la misma resolución de cara al usuario.

### Qué falta a futuro

- **Headers de rate limit:** exponer `X-RateLimit-Limit` / `X-RateLimit-Remaining` /
  `Retry-After` (hoy el `remaining` se calcula pero no se devuelve — §3).
- **Permisos finos:** el campo `permisos` existe y viaja en el contexto, pero los endpoints
  no lo chequean todavía (todas las keys leen todo). Implementar scopes (`read:empresas`,
  `read:legajo`, etc.).
- **Webhooks / push:** hoy es 100% pull (el externo consulta). No hay notificación de
  cambios hacia sistemas externos.
- **Escritura:** la API es solo lectura. No hay endpoints de carga/actualización.
- **OpenAPI formal versionado:** el spec se genera en runtime; conviene además publicarlo
  como artefacto estático versionado (y, opcionalmente, montar un Swagger UI).
- **Paginación real** para `/empresas` si una consultora crece a cientos/miles de empresas.

---

> **Mantenimiento:** este documento describe el código en `app/api/v1/`, `lib/api/auth.ts`,
> `lib/rate-limit.ts` y `supabase/migrations/20260610000001_api_keys.sql`. Si cambia
> cualquiera de esos archivos, actualizar acá y regenerar el OpenAPI de `/api/v1/docs`.
