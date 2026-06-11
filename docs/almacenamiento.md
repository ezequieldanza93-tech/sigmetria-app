# Almacenamiento, respaldo y disponibilidad — Sigmetría HyS

> Documento del **Prompt 2** para la inscripción como Prestador de Soluciones 4.0
> (SRT Res. 48/2025). Describe **solo lo implementado en el código**. Lo no hecho
> está separado en la sección "Pendiente".

---

## 1. Dónde viven los datos

| Capa | Tecnología | Ubicación |
|------|-----------|-----------|
| Base de datos | Supabase PostgreSQL | proyecto `lslzhgmoaxgkcjeweqaz` (us-east-2) |
| Archivos / adjuntos | Supabase Storage | buckets declarados en `lib/storage/buckets.ts` |
| Índice de archivos | tabla `public.archivos` | bucket+path+size+mime+entity, soft-delete (`deleted_at`) |
| Hosting app | Vercel | proyecto `hys-app-sig` |

**Buckets** (`lib/storage/buckets.ts`, fuente de verdad alineada con la migración
de Storage):

- Públicos (branding inofensivo): `logos`, `consultora`, `consultoras`, `avatars`, `cursos-portadas`.
- Privados (datos sensibles, signed URLs): `documentos`, `establecimientos`, `firmas`,
  `matriculas`, `planos`, `certificados`, `incidentes`, `denuncias`, `subcontratistas`,
  `cursos-material`, `cursos-certificados`.

---

## 2. Estrategia de backup

El plan de Supabase **hoy es Free** → no hay backups automáticos gestionados ni
PITR. Por eso se construyó un **backup lógico externo cifrado**, independiente del
proveedor, que cubre DB + Storage.

### 2.1 Qué se respalda

| Componente | Script | Salida |
|------------|--------|--------|
| Schema (DDL) | `supabase db dump` | `db/schema.sql` |
| Datos | `supabase db dump --data-only` | `db/data.sql` |
| Roles | `supabase db dump --role-only` | `db/roles.sql` |
| Tablas public (fallback JSON) | `scripts/backup.ts` | `db-json/*.json` |
| Objetos de Storage | `scripts/backup-storage.ts` | `storage/<bucket>/<path>` |

El dump de la DB usa la **Supabase CLI (2.105)** contra la base **remota, sin
Docker**. El dump de Storage descarga **todos los objetos de todos los buckets**
(descubiertos vía `listBuckets()`, con fallback a la lista declarada),
preservando las rutas y paginando `list()`.

### 2.2 Empaquetado, cifrado e integridad

`scripts/backup-external.ts` orquesta el pipeline:

1. Corre los dumps de DB y Storage en `./backups/<timestamp>/`.
2. Genera `manifest.json`: timestamp, **versión de schema** (última migración
   aplicada), y por cada archivo su tamaño y **checksum SHA-256**.
3. Empaqueta todo en `backup-<timestamp>.tar`.
4. **Cifra** a `backup-<timestamp>.tar.enc` con **AES-256-CBC** (OpenSSL, PBKDF2
   100k iteraciones, clave desde `BACKUP_ENCRYPTION_KEY`). Escribe también el
   `.sha256` del bundle cifrado.
5. **Sube** a almacenamiento **S3-compatible (Cloudflare R2 / Backblaze B2)** vía
   AWS CLI (`aws s3 cp --endpoint-url`), con prefijos `daily/<fecha>/` y
   `monthly/<mes>/`.

Si faltan credenciales, el script **falla con un mensaje claro** listando las env
vars requeridas (no con stack trace).

### 2.3 Variables de entorno

| Variable | Para qué |
|----------|----------|
| `SUPABASE_DB_URL` | connection string para el dump SQL (requerida) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | dump de Storage + fallback JSON |
| `BACKUP_ENCRYPTION_KEY` | clave AES-256 (requerida) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | subida a R2/B2 |

> Las credenciales **no** están en el repo. Se cargan como **GitHub Secrets**
> (CI) o variables de entorno locales. El usuario las provee al activar el flujo.

---

## 3. Frecuencia y automatización

`.github/workflows/backup.yml`:

- **Diaria** a las `04:00 UTC` (cron `0 4 * * *`).
- **Manual** on-demand (`workflow_dispatch`).
- Instala Node + Supabase CLI; `aws` y `openssl` ya vienen en `ubuntu-latest`.
- Todas las credenciales vienen de **GitHub Secrets**.
- `concurrency` evita solapamiento de corridas.

---

## 4. Política de retención y eliminación segura

### 4.1 Retención por esquema temporal

- **30 backups diarios** (prefijo `daily/<YYYY-MM-DD>/`).
- **12 backups mensuales** (prefijo `monthly/<YYYY-MM>/`).

La separación de prefijos ya está **implementada** en `backup-external.ts` (cada
corrida sube a ambos). La **purga efectiva** se aplica vía **lifecycle del bucket**
R2/B2 (regla por prefijo: expirar `daily/` a 30 días, `monthly/` a 365). Esa
regla de lifecycle queda **documentada como pendiente de configurar** en la consola
del bucket (ver "Pendiente").

### 4.2 Retención por tipo de dato (valor probatorio)

Decisión de política (alineada con `docs/decisiones.md` D5 y la migración de
trazabilidad del Prompt 1):

| Tipo de dato | Política |
|--------------|----------|
| **Audit log** (`audit_log`) | **NUNCA se purga.** Inmutable por REVOKE de privilegios + RLS. |
| Datos de HyS con valor probatorio (incidentes, denuncias, IPERC, documentos legales, certificados) | **Conservar mientras subsistan obligaciones legales.** Nunca borrar sin proceso explícito. |
| Adjuntos (`archivos`) | **Soft-delete** (`deleted_at`) — el binario y el registro no se eliminan automáticamente. |
| Branding (logos, avatars) | Borrado físico permitido (sin valor probatorio). |

### 4.3 Eliminación segura de un cliente (consultora)

Proceso **controlado** (no un DELETE directo):

1. **Exportación previa completa** de los datos del cliente. (El export completo
   se implementa en el **Prompt 3** — acá se referencia el requisito.)
2. **Registro del evento** en el audit log vía `logAuditEvent(...)`
   (`lib/audit/log-event.ts`) con `accion: 'EXPORT'` para la exportación y
   `accion: 'ACCESO'` para el acceso administrativo previo, incluyendo
   `consultora_id` y metadata no sensible (quién, cuándo, alcance).
3. **Soft-delete primero**: la tabla `archivos` ya soporta `deleted_at`; la
   eliminación física del binario en Storage es un paso posterior y manual.
4. El **audit log de esa consultora NO se borra** (valor probatorio).

> Lo barato ya está: la infraestructura de auditoría (`log_audit_event`) y el
> soft-delete (`archivos.deleted_at`) existen. La orquestación del "borrado de
> cliente" como flujo único todavía no es una acción de un clic — ver "Pendiente".

---

## 5. Comportamiento ante caídas (disponibilidad)

### 5.1 Trabajo offline (ya existente)

- **Cola offline** en IndexedDB: `lib/offline-queue.ts`.
- Hooks: `lib/hooks/use-offline-queue.ts`, `lib/hooks/use-network-status.ts`.
- Permite encolar operaciones cuando no hay red y reintentarlas al reconectar.
- El **Service Worker** (`public/sw.js`) está **deshabilitado** (kill-switch por
  el bug React #418) — no se re-habilita hasta resolver ese bug.

### 5.2 Healthcheck (nuevo)

`app/api/health/route.ts` — `GET /api/health`:

- Pingea **DB** (count HEAD sobre `consultoras`, sin traer filas) y **Storage**
  (`listBuckets()`).
- Devuelve `200 { status:'ok', checks:{ db, storage } }` o
  `503 { status:'degraded', ... }` si algo falla.
- **Sin auth** (endpoint de monitoreo), **liviano**, **no expone datos**.
- `Cache-Control: no-store`.
- Apto para un monitor de uptime externo (UptimeRobot, BetterStack, etc.).

---

## 6. Prueba de recuperación

- Script: `scripts/restore-dry-run.sh` — descifra el bundle, restaura schema +
  data + roles a un Postgres objetivo (`RESTORE_DB_URL`), y verifica integridad
  (conteo de filas + cross-check de checksums contra el manifest). Idempotente y
  **no destructivo sobre prod** (guard que rechaza URLs de producción salvo
  `CONFIRM=yes`).
- Runbook paso a paso: `docs/recuperacion.md`.
- **Corrida real PENDIENTE**: requiere Docker o staging (esta máquina no tiene
  Docker). Los scripts están listos y pasan `tsc --noEmit`.

---

## 7. Pendiente

| Ítem | Detalle | Por qué |
|------|---------|---------|
| **Upgrade a Supabase Pro (PITR)** | Contratar el plan **Pro (~US$25/mes)**: habilita backups diarios gestionados de 7 días y **Point-in-Time Recovery** (restauración a cualquier segundo dentro de la ventana). | El backup externo cubre el respaldo lógico, pero PITR da RPO casi nulo y restauración granular sin reconstruir desde un dump. Recomendado antes de salir a producción con datos de clientes reales. |
| **Corrida real de restauración** | Levantar Postgres (Docker/staging) y correr `restore-dry-run.sh` end-to-end; archivar el log como evidencia. | Hoy no hay Docker en la máquina; la prueba real valida el RTO. |
| **Lifecycle del bucket R2/B2** | Configurar reglas de expiración por prefijo (`daily/` 30d, `monthly/` 365d) en la consola del bucket. | La rotación de prefijos ya está en el código; la purga la aplica el proveedor. |
| **Re-upload automatizado de Storage** | Script que recorra `storage/` del bundle y suba cada objeto al bucket destino. | Hoy el re-poblado de Storage es manual. |
| **Borrado de cliente como flujo único** | Action que orqueste export → audit → soft-delete → purga física controlada. | Hoy las piezas existen pero no hay un único punto de entrada. |
| **Re-habilitar Service Worker** | Re-activar `public/sw.js` para caching/offline real. | Bloqueado por el bug React #418; re-habilitar solo cuando se resuelva. |
| **Cron de health en Vercel** | (Opcional) agregar `/api/health` a un monitor externo o cron. | Mejora la detección proactiva de caídas. |
