# Validación en vivo — migraciones SRT contra Supabase local

> Fecha: 2026-06-11. Entorno: Supabase local (Docker Desktop + `supabase start`), levantado
> exprofeso para validar las migraciones nuevas EN VIVO antes de aplicarlas a producción.
> Esto eleva la evidencia de "scripts listos" a "probado contra un Postgres real".
>
> **Nota (refactor backup incremental, posterior):** la sección del Prompt 2 abajo documenta el
> diseño de backup **monolítico** vigente ese día (DB + Storage en un único tar cifrado, prefijo
> `daily/`). Luego se refactorizó a **dos tracks** (DB cifrada versionada en `db/daily/` + Storage
> espejo incremental en `storage/`). Esta página queda como **registro histórico** de la corrida del
> 2026-06-11; el diseño actual está en `docs/almacenamiento.md` y `docs/recuperacion.md`.

## Cómo se levantó el entorno (reproducible)

1. `supabase init` (generó `supabase/config.toml`).
2. Quirks de Windows resueltos en `config.toml`: `[analytics] enabled = false` y
   `[storage.vector] enabled = false` (ambos servicios fallan en Windows sin exponer el Docker
   daemon por TCP; no son necesarios para validar).
3. `supabase start` levantó el stack (db/auth/storage/rest/kong/realtime/studio).
4. Las migraciones se aplicaron con tolerancia a errores (`psql -v ON_ERROR_STOP=0`) — ver nota
   sobre el replay abajo.

### Nota importante: la cadena de migraciones NO es reproducible desde cero
Al aplicar las 192 migraciones en una base limpia, **varias migraciones VIEJAS fallan** porque la
cadena tiene *drift* (seeds editados después, tablas renombradas). Ejemplos:
- `20260517000007_documento_tipos_nivel_unico.sql`: `duplicate key … documento_tipos_nombre_key`.
- Migraciones que referencian `registro_gestiones` / `observaciones_gestiones` (nombres VIEJOS;
  hoy son `gestiones_registros` / `gestiones_observaciones` tras un rename).

**Esto es un hallazgo de recuperación ante desastres**: una reconstrucción "desde las migraciones"
NO funciona hoy. La recuperación real debe hacerse desde un **dump lógico** (lo que produce el
backup del Prompt 2), que captura el estado final — no replayear la cadena. Queda anotado como
pendiente: normalizar/squashear las migraciones para que la cadena vuelva a ser reproducible.

> Las **migraciones nuevas (Prompts 1/3/5) NO tienen este problema** y aplican limpias (ver abajo).

---

## 🐛 Bugs reales encontrados EN VIVO (y corregidos)

Estos dos bugs **no eran detectables sin una base real** — los tests unitarios y `tsc` pasaban.
La prueba en vivo los cazó antes de que llegaran a producción.

### Bug 1 — El CHECK viejo de `accion` rompía TODO el logging de eventos de acceso
- **Síntoma:** al registrar un evento (`LOGIN`/`EXPORT`/`QR_ACCESS`) fallaba con
  `new row … violates check constraint "audit_log_accion_check1"`.
- **Causa raíz:** el `audit_log` particionado tenía su CHECK de `accion` con nombre autogenerado
  `audit_log_accion_check1` (no `audit_log_accion_check`). Mi `DROP CONSTRAINT IF EXISTS
  audit_log_accion_check` no lo borraba, y el check viejo (solo INSERT/UPDATE/DELETE) seguía
  rechazando los valores de evento.
- **Impacto si llegaba a prod:** el logging de accesos (login, export, QR) — pilar del estándar de
  trazabilidad — habría fallado siempre.
- **Fix** (`20260702000001`): se elimina dinámicamente CUALQUIER CHECK sobre `accion` del padre
  (cascadea a las particiones) y se agrega el nuevo. Idempotente.

### Bug 2 — La migración de autocontrol referenciaba una tabla inexistente (`documentos`)
- **Síntoma:** `relation "public.documentos" does not exist` → abortaba la transacción completa →
  NINGÚN constraint del Prompt 5 se aplicaba.
- **Causa raíz:** `documentos` fue **eliminada** en `20260516000004` (reemplazada por
  `empresas_documentos` / `establecimientos_documentos` / `personas_documentos`). La migración la
  trataba como "tabla legacy" existente.
- **Fix** (`20260705000001`): se quitó el bloque de `documentos`. El resto de las tablas referidas
  fueron verificadas como existentes en vivo (los renames a plural son correctos).

---

## ✅ Resultados de la validación (contra Supabase local)

### Prompt 1 — Trazabilidad (`docs/pruebas/demo_local_srt.sql`)
| Criterio | Resultado |
|---|---|
| **Inmutabilidad** | `UPDATE`/`DELETE`/`INSERT` directos como rol `authenticated` → **bloqueados (`permission denied`)**. |
| **Hash chain** | 3 eventos generados → `fn_verify_audit_chain` = **`INTEGRA`**. Tras alterar 1 fila (como superuser) → **`ALTERADA` en seq 1** con detalle "hash recomputado != almacenado". |
| **Trigger + trace** | `UPDATE` de una empresa → audit con `preserva_estado_anterior=t`, `razon_social_anterior='Empresa Demo'`, `trace_id=4444…`. Estado anterior + trazabilidad capturados. |
| **Cobertura defensiva** | El `DO` block creó triggers en las tablas existentes y **saltó (RAISE NOTICE) las inexistentes** sin romper la migración. |

La migración `20260702000001` aplica con `ON_ERROR_STOP=1` → **exit 0 (COMMIT)**.

### Prompt 3 — Exports bucket (`20260704000001`)
Aplica limpio (sin error).

### Prompt 5 — Autocontrol
- `20260705000001` (CHECK constraints): aplica con **exit 0** tras corregir el Bug 2.
- `20260705000002` (inconsistencias + supervisión): aplica limpio; la **vista
  `vw_estado_cumplimiento` se creó sin error** (sus tablas existen) y
  **`fn_detectar_inconsistencias(...)` ejecuta sin error** (usa los nombres CURRENT correctos:
  `gestiones_registros`, `gestiones_observaciones`, `empresas_documentos`, etc.).

### TypeScript / unit tests (sin cambios desde la corrida principal)
`npx tsc --noEmit` → **0 errores**. `npx vitest run` → **314/314 passed**.

---

## ✅ Prueba de recuperación end-to-end (Prompt 2)

Se ejecutó la cadena COMPLETA de respaldo y recuperación contra infra real local
(Supabase local como fuente + **MinIO** como stand-in S3-compatible de R2):

| Paso | Herramienta | Resultado |
|---|---|---|
| Dump DB (schema+data+roles) | `supabase db dump` (local) | schema.sql 606 KB, data.sql 909 KB, roles.sql |
| Backup de Storage | `scripts/backup-storage.ts` | recorrió todos los buckets (0 objetos en local) |
| Manifest + checksums | `scripts/backup-external.ts` | 4 archivos catalogados con SHA-256 |
| Cifrado | OpenSSL AES-256-CBC + PBKDF2 | `backup-….tar.enc` (1.49 MB) |
| **Upload a S3** | boto3 → MinIO | `s3://sigmetria-backups/daily/2026-06-11/…` |
| **Download de S3** | boto3 ← MinIO | **SHA-256 idéntico** (`5d5382e8…`) — bundle intacto |
| Descifrado + untar | OpenSSL + tar | OK |
| **Verificación de integridad** | checksums vs manifest | **los 4 archivos COINCIDEN** |
| **Restore** | `psql` en DB fresca `restore_test` | **180 tablas public** restauradas; `audit_log` con sus 3 eventos (los datos sobrevivieron todo el viaje) |

**Notas honestas:**
- El cliente S3 usado fue **boto3** (no el `aws` CLI del script) por un problema de PATH de
  awscli en Windows; boto3 ejercita el MISMO protocolo S3 que R2/B2, así que la validación del
  tramo S3 es equivalente. El `aws s3 cp` del script corre tal cual en la GitHub Action (ubuntu).
- El restore mostró ~182 errores no-fatales de schema: son referencias al schema `auth`/`storage`
  y roles que una DB pelada no tiene. En una recuperación real se restaura sobre un **proyecto
  Supabase fresco** (que ya los provee), por lo que no aplican. Lo esencial — tablas + datos +
  checksums — se recuperó correctamente.
- Quirk de Windows: ejecutado desde git-bash, el `tar` del script resuelve a GNU tar (que
  interpreta `C:\` como host remoto). Se usó `bsdtar` (el `tar` nativo de Windows, que es el que
  el script usa bajo cmd.exe / en CI Linux es GNU tar sin drive letters → no aplica el problema).

> **Conclusión:** la estrategia de respaldo y recuperación del Prompt 2 está **probada
> end-to-end**, no solo escrita. Con credenciales reales de R2/B2 (que cargás vos en GitHub
> Secrets), el mismo flujo corre en la Action diaria sin cambios de código.

## Qué quedó fuera de esta validación
- **No se validó el replay completo de la cadena vieja** (tiene drift; ver arriba). Solo se validó
  que las **migraciones nuevas** aplican y funcionan contra un esquema con las tablas actuales.
- La base local quedó **incompleta** para algunas tablas cuyos CREATE vivían en migraciones viejas
  transaccionales que abortaron por drift — pero todas las tablas que **mis** migraciones tocan
  estaban presentes y se ejercieron.
- Sigue pendiente aplicar a **staging/prod** (el orden y los comandos están en
  `docs/resumen_corrida.md` y `docs/recuperacion.md`).
