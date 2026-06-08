# Auditoría de código — follow-ups pendientes

> Generado en la auditoría integral de 2026-06-06. Los **bugs P1, agujeros de
> seguridad multi-tenant, código muerto y salud de tests YA se arreglaron y
> mergearon** (PRs #64–#74, + verificación adversarial final). Este documento
> lista lo que **quedó pendiente a propósito**: cambios de alto blast-radius
> (auth), hygiene de datos y decisiones de producto que conviene que valide el
> dueño antes de tocar.

## 1. Seguridad — alto blast-radius / decisión de producto (NO tocado)

| Item | Archivo | Riesgo | Fix propuesto |
|------|---------|--------|---------------|
| **Bypass de MFA temporal por dominio `@sigmetria.app`** cableado en los 2 paths de login productivos + middleware | `lib/auth/test-mfa-bypass.ts`, `login/route.ts:70`, `login.ts:77`, `middleware.ts:64` | Si existe cuenta `@sigmetria.app` en prod queda **sin 2FA** (compliance Res. SRT 48/2025) | Gatear tras env var `ALLOW_MFA_TEST_BYPASS` solo-no-prod, o eliminar el archivo + 3 call sites al cerrar testing |
| **Login y MFA-verify sin rate limiting** | `app/api/auth/login/route.ts`, `lib/actions/login.ts`, `lib/actions/mfa-email.ts` (verify) | Brute-force abierto (el código de 6 dígitos es 1M combinaciones sin contador de intentos) | Cablear `authRatelimit` (ya existe en `lib/rate-limit.ts`) por IP en login/signup; agregar contador de intentos + invalidación en `mfa_email_challenges` |
| **Signup self-serve auto-confirmado** vía service-role | `lib/actions/login.ts:35` (`email_confirm: true`) | Squatting de emails ajenos + alta masiva sin verificación | Usar `auth.signUp` con verificación por email, o deshabilitar signup self-serve (SaaS B2B por invitación) |
| **invite-user sin whitelist de role** | `app/api/admin/invite-user/route.ts:12` (`role: z.string()`) | Un `full_access_main` puede invitar con cualquier role, incl. `full_access_main` (escalada intra-tenant) | `z.enum([...roles permitidos])` + regla de no otorgar role de mayor privilegio |
| **Bucket storage `subcontratistas`: writes cross-tenant** (misma clase que #65) | policies `subcontratistas: insert/update/delete/select` (`auth.role()='authenticated'`) en `storage.objects` | Cualquier autenticado puede INSERT/UPDATE/DELETE/SELECT objetos de cualquier consultora. Bucket hoy **vacío (0 objetos)** → latente | DROP de las 4 loose; quedan las tenant-scoped (`write insert/update`, `members read`, `admins delete`) + owner-fallback. **OJO**: la SELECT loose puede estar habilitando lectura global intencional de docs de subcontratistas (modelo global) → confirmar antes de dropear la de SELECT |
| **`verificacion_tokens` SELECT público (`qual=true`)** | policy `verificacion_tokens_select_public` | Con la anon key cualquiera hace `SELECT *` y enumera **todos** los tokens (funcionan como bearer del link público) | SELECT por token exacto o RPC `SECURITY DEFINER` que reciba el token; nunca `qual=true` |

## 2. Hygiene de datos (storage)

- **12 objetos legacy tenant-less en bucket `documentos`** quedaron visibles solo por owner-fallback tras el hardening de RLS (PR #65) — un colega de la misma consultora no los ve. Migrarlos a path `{consultora_id}/...` (mover objeto vía service-role + actualizar la columna que los referencia). Distribución verificada en DB: `reportes-fotograficos/`=5, `formularios/`=4, `evidencias/`=1, `trabajadores/`=1, y 1 nombre crudo.
- **2 fotos de establecimiento** (`establecimientos.photo_site`) con URL pública absoluta legacy → 403 tras privatizar el bucket. Migrar a path relativo.
- **Tabla `archivos` vacía** (0 filas vs ~38 objetos): varios writers usan `storage.upload()` directo en vez de `uploadAsset` (que registra en `archivos` para auditoría/GC). Decidir si `archivos` es fuente de verdad para GC y, si sí, centralizar o hacer backfill.

## 3. Decisiones de producto (no se decidieron solas)

- **`gestiones_registros.index`**: la columna es `integer NOT NULL` pero la UI sugiere decimales (`placeholder "Ej: 85, 4.5, 3"`, `step="any"`). Si índice admite decimales → migrar columna a `numeric`. Si es entero → `step="1"` + `z.coerce.number().int()`. Hoy un `4.5` revienta con error crudo de Postgres.
- **`subcontratistas` / `organizaciones_externas`**: hoy son **globales por diseño** (`scope='global'`, sin `consultora_id`; RLS expone a cualquier miembro activo). Si deberían ser privados por consultora, es un rediseño del modelo (no se tocó — la "fuga" reportada era consistente con el diseño actual).
- **Dead features (riesgo medio, NO borradas)**: confirmar si son roadmap antes de eliminar:
  - Cluster de firmas de trabajador: `firma-trabajador-modal.tsx`, `firma-canvas.tsx`, `lib/actions/firmar-registro-trabajador.ts`, hook `useFirmarRegistroTrabajador`.
  - `BloqueFirmas` / `FirmaBadge` + hooks `useFirmasEntidad`/`useEntidadFirmada`/`useEntidadesPendientesFirma`. (Conservar `useFirmarGestion`, sí está vivo.)
  - Offline-queue: `lib/hooks/use-offline-queue.ts` + `lib/offline-queue.ts` (ligado al SW deshabilitado por React #418).
  - Tabs viejos de establecimiento: `establecimiento/gestiones-tab.tsx`, `establecimiento/riesgos-tab.tsx`, `iperc/iperc-tab.tsx` (la page usa GestionesAgenda + MapaRiesgoTab).
  - `components/cursos/ai-quiz-modal.tsx` (la ruta `api/cursos/ai-quiz` sigue viva).
- **`documentos_tipos` con `categoria_legajo` pero sin `periodicidad`** (11 empresa, 19 establecimiento, 6 persona): excluidos del checklist del legajo. Completar `periodicidad` o limpiar `categoria_legajo`.

## 4. Hardening menor / deuda de tipos

- `tipos_horas` (y revisar `sigia_intents`/`sigia_synonyms`): policies `UPDATE`/`DELETE` con `qual=true` → cualquier autenticado modifica config global. Acotar a admin.
- `lib/mercadopago/webhook-verify.ts:60`: comparación de HMAC no constant-time → `crypto.timingSafeEqual`.
- Fallback de URL base inconsistente (`hys-app-sig.vercel.app` en sitemap/robots/layout vs `app.sigmetria.com.ar` en emails). Centralizar en `lib/config/app-url.ts`.
- `components/invite-modal.tsx:15`: `PAYMENT_URL = '#'` (TODO) → apuntar a `billing/cambiar-plan`.
- **132 `any` explícitos** (concentrados en `iperc.ts`, `curso.ts`, `mercadopago.ts`): regenerar tipos de Supabase y tipar incremental (habría atrapado el bug de `'pending'`). Quitar `as any` de los crons de billing.
- `console.log` en `app/api/mercadopago/webhook/route.ts:134` → logger.
- **Reporte fotográfico — sync de observaciones best-effort**: en `crearReporteFotografico` y `crearReporteFotograficoEjecucion`, si falla el INSERT de `gestiones_observaciones` (pool de Seguimiento) se loguea pero se devuelve `success` (el reporte/fotos SÍ se guardan). La causa principal (fecha NULL) ya se arregló (#64) y el insert de fotos *core* ahora hace rollback (#74). Pendiente: canal de *warning* en el `ActionResult` para avisar degradación parcial sin perder `reporteId`/`pdfSignedUrl`.
- **Ejecución de gestión sin transacción**: `doSave` (agenda) corre `ejecutarGestion` y luego `crearObservaciones` como dos server actions separadas. La validación ya se movió antes de ejecutar (#74), pero si `crearObservaciones` falla por RLS el registro ya quedó Realizado. Ideal: una RPC `SECURITY DEFINER` transaccional para ejecución + observaciones.

## 5. Smoke-tests de runtime recomendados (cambios verificados solo por tsc/lint/build)

- Alta de suscripción MercadoPago (fix de enum `'pending'→'trialing'`, PR #67).
- Cargar documento tipo matrícula (con y sin fechas) y abrir el certificado (PR #71: bucket `certificados` + guard NOT NULL).
- Ejecutor de Reporte Fotográfico multi-foto + editor + PDF (PR #74: rollback si fallan las fotos).
- Subir plano en el mapa IPERC y verlo (PR #66).
