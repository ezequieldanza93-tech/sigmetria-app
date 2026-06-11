# Plan — Prompt 1: Trazabilidad y cadena de custodia

## Estado actual (auditoría)

Ya existe una base sólida:
- `audit_log` **particionada** por `RANGE(created_at)`, PK compuesta `(id, created_at)`.
  Columnas: `id, tabla_nombre, accion, registro_id, user_id, consultora_id, datos_antes, datos_nuevo, created_at`.
- `accion` con CHECK `IN ('INSERT','UPDATE','DELETE')`.
- Inmutabilidad real: RLS `INSERT/UPDATE/DELETE = false`; el trigger `fn_audit_trigger()` es
  `SECURITY DEFINER` (corre como owner, bypasea RLS).
- Triggers en 6 tablas: `incidentes` (ex `siniestros`), `inspecciones`, `capacitaciones`,
  `capacitaciones_asistentes`, `riesgos`, `mediciones`.
- pg_cron crea particiones mensuales.
- RLS SELECT: developer / dueño / admins+responsable_estandares+auditor_externo de la consultora.

## Gap a cubrir

1. **Cobertura incompleta:** faltan tablas críticas (empresas, establecimientos, documentos,
   observaciones, gestiones/registro_gestiones, denuncias, personas_directorio, formularios,
   consultora_members/roles, user_access).
2. **Sin `trace_id`** que correlacione un flujo de negocio multi-tabla.
3. **Sin hash chain** (integridad criptográfica encadenada).
4. **Sin origen** humano/automatizado.
5. **Sin email del actor** snapshot (hoy requiere JOIN a profiles).
6. **Sin auditar eventos de acceso:** login, export, acceso por QR, generación de reporte.
7. **`accion` no admite** eventos no-CRUD (ACCESO/EXPORT/LOGIN/GENERAR_REPORTE/QR_ACCESS).
8. **Vista forense** de reconstrucción por entidad o por trace_id, cronológica.

## Diseño

### Migración `20260702000001_audit_trazabilidad_srt.sql` (additiva)

1. **Columnas nuevas** en `audit_log` (propagan a particiones):
   - `actor_email text` — snapshot vía `auth.jwt() ->> 'email'` (sin query extra).
   - `origen text NOT NULL DEFAULT 'humano'` CHECK `IN ('humano','automatizado','sistema')`.
   - `trace_id uuid` — flujo de negocio.
   - `hash text` / `hash_prev text` — cadena.
   - `seq bigint` — orden dentro de la cadena por consultora.
2. **Ampliar CHECK de `accion`** → agregar `'ACCESO','EXPORT','LOGIN','GENERAR_REPORTE','QR_ACCESS'`.
3. **`audit_chain_state`** (consultora_id PK, last_hash, last_seq) — cabeza de cadena por tenant.
   Una cadena por consultora + una cadena `NULL`/global para eventos sin consultora.
4. **Reescribir `fn_audit_trigger()`**: además de lo actual, computa hash encadenado.
   - Lock por cadena con `pg_advisory_xact_lock(hashtext(coalesce(consultora_id::text,'global')))`
     → serializa solo dentro de la misma consultora (no bloquea cross-tenant).
   - `hash = encode(digest(coalesce(hash_prev,'GENESIS') || payload_canonico, 'sha256'),'hex')`
     con `pgcrypto`. `payload_canonico` = JSON estable de los campos del evento.
   - Lee `trace_id` y `origen` de GUCs de sesión (`current_setting('sigmetria.trace_id', true)`,
     `current_setting('sigmetria.origen', true)`) seteables por la app; default humano.
   - Resuelve `consultora_id` desde la fila cuando es posible (NEW/OLD con columna consultora_id
     o empresa_id→consultora_id), si no NULL.
5. **RPC `log_audit_event(p_accion, p_tabla, p_registro_id, p_consultora_id, p_meta, p_trace_id)`**
   `SECURITY DEFINER` — para eventos de acceso (login/export/qr/reporte). Encadena igual.
   Best-effort desde la app (D3): si falla, no rompe la operación.
6. **Vista `audit_trail`** (o función `fn_audit_historial(p_tabla, p_registro_id)` y
   `fn_audit_por_trace(p_trace_id)`) — reconstrucción cronológica con email/acción/origen.
7. **`fn_verify_audit_chain(p_consultora_id)`** — recalcula la cadena y devuelve la primera fila
   onde el hash no matchea (detección de alteración). Documentar cómo correrla.
8. **Triggers nuevos** en las tablas críticas faltantes (mismo `fn_audit_trigger`).

### Mecanismo de `trace_id` / `origen` desde la app
- Helper `lib/audit/trace.ts`: `withAuditContext(supabase, { traceId, origen }, fn)` que setea
  los GUC vía `select set_config(...)` antes de la operación. Adopción incremental.
- `lib/audit/log-event.ts`: wrapper de `log_audit_event` para login/export/qr.

### Cobertura de eventos de acceso
- Login: en `lib/actions/login.ts` (best-effort).
- Export: en el endpoint de export (Prompt 3) — se integra ahí.
- Acceso QR: en `app/verificar/[token]` — ya hay `registrar_acceso_legajo`; se suma audit event.

## Tests / evidencia
- **Unit (vitest):** algoritmo de hashing canónico replicado en TS
  (`lib/audit/hash-chain.ts`) — verifica que el encadenado en TS coincide con el esperado y que
  alterar un payload rompe la cadena. (No requiere DB.)
- **SQL de prueba (`docs/pruebas/prompt_1_*.sql`):** scripts para correr en staging/local que
  demuestran: (a) UPDATE/DELETE directo sobre audit_log falla incluso con rol app;
  (b) editar una observación deja registro + estado anterior + trace_id;
  (c) `fn_verify_audit_chain` detecta una alteración simulada.
- **Limitación honesta:** sin Docker no se ejecutan los SQL en vivo en esta corrida → quedan
  como scripts listos. Se documenta en docs/trazabilidad.md.

## Entregable
- `supabase/migrations/20260702000001_audit_trazabilidad_srt.sql`
- `lib/audit/hash-chain.ts`, `lib/audit/trace.ts`, `lib/audit/log-event.ts`
- `__tests__`/vitest para hash-chain
- `docs/pruebas/prompt_1_inmutabilidad.sql`, `prompt_1_trace.sql`, `prompt_1_hashchain.sql`
- `docs/trazabilidad.md` (SOLO lo implementado + pendientes separados)
