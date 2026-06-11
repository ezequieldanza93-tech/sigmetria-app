# Trazabilidad y cadena de custodia — Sigmetría HyS

> Estándar SRT (Art. 4.2 Res. 48/2025 + Disp. 15/2026): *toda la información generada debe poder
> reconstruirse de forma verificable, identificando origen, intervenciones y modificaciones, con
> registros originales inalterables.*
>
> Este documento describe **solo lo implementado**. Lo no implementado está en la sección
> **Pendientes**. Insumo del protocolo legal — no afirma nada que no esté en el código.

Fecha: 2026-06-11. Migración: `supabase/migrations/20260702000001_audit_trazabilidad_srt.sql`.

---

## 1. Resumen

La plataforma ya contaba con un `audit_log` **append-only e inmutable**, particionado por mes,
escrito por triggers `SECURITY DEFINER`. Este cambio lo eleva a una **cadena de custodia
verificable**:

- **Cobertura ampliada** de 6 a ~18 tablas de negocio + eventos de acceso.
- **`trace_id`** para correlacionar un flujo de negocio multi-tabla.
- **Hash chain SHA-256** encadenado por consultora → cualquier alteración es detectable.
- **Origen** (humano / automatizado / sistema) y **email del actor** (snapshot).
- **Inmutabilidad reforzada**: además de RLS, se revocan los privilegios de escritura a nivel de
  tabla para todos los roles (incluido `service_role`).
- **Consulta forense**: por entidad, por `trace_id`, y verificación de integridad.

---

## 2. Esquema

### `audit_log` (particionada por `RANGE(created_at)`, PK `(id, created_at)`)

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Identificador único del evento. |
| `created_at` | timestamptz | **Timestamp del servidor** (`now()`), nunca del cliente. |
| `accion` | text | `INSERT`/`UPDATE`/`DELETE` (CRUD) o `ACCESO`/`EXPORT`/`LOGIN`/`GENERAR_REPORTE`/`QR_ACCESS`. |
| `tabla_nombre` | text | Tipo de entidad afectada. |
| `registro_id` | uuid | Id de la entidad afectada. |
| `user_id` | uuid | Actor (FK lógica a profiles) o NULL si fue el sistema. |
| `actor_email` | text | **Snapshot** del email del actor (claim del JWT) al momento del evento. |
| `consultora_id` | uuid | Empresa-cliente / tenant del evento (scope de visibilidad). |
| `origen` | text | `humano` \| `automatizado` \| `sistema`. |
| `trace_id` | uuid | Correlaciona un flujo de negocio (NULL si no se proveyó). |
| `datos_antes` | jsonb | Estado anterior (NULL en INSERT). |
| `datos_nuevo` | jsonb | Estado nuevo (NULL en DELETE). |
| `hash` | text | `sha256(hash_prev || payload_canónico)`. |
| `hash_prev` | text | Hash del registro anterior en la cadena de esa consultora. |
| `seq` | bigint | Posición secuencial dentro de la cadena. |

### `audit_chain_state` (cabeza de cadena por consultora)

`consultora_id` (PK) · `last_hash` · `last_seq` · `updated_at`. El UUID cero
(`00000000-…-0`) es la **cadena global** para eventos sin consultora asociada. Solo se escribe vía
funciones `SECURITY DEFINER`; RLS de SELECT para developer/admins/responsable de la consultora.

---

## 3. Inmutabilidad (garantías a nivel base de datos)

1. **RLS**: `INSERT/UPDATE/DELETE = WITH CHECK (false) / USING (false)` para `authenticated`.
2. **Privilegios de tabla** (defensa adicional, más fuerte que RLS):
   ```sql
   REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log
     FROM PUBLIC, anon, authenticated, service_role;
   ```
   Un `UPDATE`/`DELETE` directo —incluso desde el cliente admin (`service_role`)— **falla con
   `permission denied`**, no es un no-op silencioso.
3. **Única vía de escritura**: el trigger `fn_audit_trigger()` y el RPC `log_audit_event()` son
   `SECURITY DEFINER` (corren como el owner de la función, que conserva el INSERT). Nadie más
   escribe.
4. **Registros de negocio originales**: ante una modificación, el `datos_antes` queda preservado
   en el audit_log; el dato original nunca se pierde de forma destructiva.

> Prueba: `docs/pruebas/prompt_1_inmutabilidad.sql`.

---

## 4. Cobertura de eventos

### Escrituras de negocio (triggers `AFTER INSERT/UPDATE/DELETE`)

La migración instala el trigger de auditoría —de forma **defensiva** (solo si la tabla existe y
tiene columna `id`)— en:

`inspecciones`, `capacitaciones`, `capacitaciones_asistentes`, `riesgos`, `mediciones`,
`incidentes`, `siniestros`, `empresas`, `establecimientos`, `establecimiento_documentos`,
`empresa_documentos`, `documentos`, `observaciones_gestiones`, `registro_gestiones`, `denuncias`,
`directorio_personas`, `formulario_respuestas`, `user_access`, `consultoras_members`.

Cada `CREATE TRIGGER` emite un `RAISE NOTICE` al aplicar, dejando constancia de qué tablas
quedaron cubiertas (verificable en el log de la migración).

### Eventos de acceso (RPC `log_audit_event`)

Para eventos que no son CRUD. Estado de cableado:

| Evento | Estado | Dónde |
|---|---|---|
| `LOGIN` | **Implementado** | `lib/actions/login.ts` (best-effort, no bloqueante). |
| `EXPORT` | **Implementado** (Prompt 3) | `app/api/export/empresa/[empresa_id]/route.ts`. |
| `QR_ACCESS` | **Implementado** (Prompt 4) | `app/verificar/[token]/page.tsx` (best-effort, origen `sistema`). |
| `GENERAR_REPORTE` | **A cablear** (RPC listo, sin call-site) | cablear donde se genere el PDF/reporte. |

---

## 5. `trace_id` y `origen` — cómo se setean

Con PostgREST cada request es su propia transacción, por lo que un GUC seteado en una llamada no
persiste a la siguiente. La solución nativa es **headers de request**, que sí viven dentro de la
transacción del trigger:

- El trigger lee `request.headers ->> 'x-trace-id'` y `'x-audit-origen'` (fallback a los GUC
  `sigmetria.trace_id` / `sigmetria.origen` para flujos que corran dentro de un RPC).
- El mecanismo previsto es que la app adjunte esos headers usando `createAuditedClient(traceId,
  origen)` (`lib/audit/trace.ts`): toda escritura hecha con ese cliente compartiría el `trace_id`.
- Los **eventos de acceso** reciben el `trace_id` como parámetro explícito de `log_audit_event`.

**Estado real (adopción incremental / preparado, aún NO cableado en CRUD)**:
`createAuditedClient` está **definido** en `lib/audit/trace.ts` pero **no tiene ningún call-site**
todavía — ninguna server action lo usa en lugar de `createClient()`. En consecuencia, **hoy el
`trace_id` de las escrituras CRUD queda NULL en la práctica** (el resto del registro de auditoría
se captura igual). Cablearlo donde se quiera correlacionar un flujo completo (ej. una recorrida)
es trabajo pendiente — ver §10.3.

---

## 6. Hash chain (integridad verificable)

- **Por consultora**: una cadena independiente por `consultora_id` (+ una global). Esto permite
  serializar las escrituras de cada tenant **sin bloquear** a los demás
  (`pg_advisory_xact_lock` sobre la clave de cadena).
- **Encadenado**: `hash = sha256( (hash_prev || 'GENESIS') || payload_canónico )`, con `pgcrypto`.
- **Payload canónico** (`fn_audit_canonical`): cadena pipe-delimitada, orden fijo, fecha en UTC con
  microsegundos. Replicado en TS en `lib/audit/hash-chain.ts` para verificación independiente.
- **Génesis**: la cadena se ancla al primer evento posterior a la migración. Los registros previos
  (pre-chain) tienen `hash` NULL y no participan de la verificación.

> Limitación de paridad documentada: el `jsonb::text` de Postgres normaliza claves de forma
> distinta a `JSON.stringify`, por lo que la re-verificación **client-side** de payloads jsonb no
> puede byte-matchear. El verificador **autoritativo** de cadenas con payload jsonb es
> `fn_verify_audit_chain` en la base. La lib TS verifica el algoritmo de encadenado y los campos
> escalares (defensa en profundidad + tests).

---

## 7. Cómo auditar / reconstruir

| Necesidad | Herramienta |
|---|---|
| Historial completo de una entidad | `SELECT * FROM fn_audit_historial('<tabla>', '<registro_id>');` |
| Reconstruir un flujo de negocio | `SELECT * FROM fn_audit_por_trace('<trace_id>');` |
| Vista cruda (hereda RLS) | `SELECT * FROM audit_trail ORDER BY created_at, seq;` |
| **Verificar integridad de la cadena** | `SELECT * FROM fn_verify_audit_chain('<consultora_id>');` → `INTEGRA` o el primer `seq` alterado. |

> **Superficie de consulta hoy (honesto):** estas herramientas forenses (vista `audit_trail`,
> `fn_audit_historial`, `fn_audit_por_trace`, `fn_verify_audit_chain`) se consultan **SOLO vía SQL
> directo** (consola Supabase / `psql`) o desde **CI**. **NO existe todavía una UI ni un dashboard
> de auditoría dentro de la app** — un operador no puede reconstruir un flujo ni verificar la
> cadena desde la interfaz; es una capacidad de base de datos, no de producto. La UI de auditoría
> queda como trabajo pendiente.

---

## 8. Estrategia ante fallo de escritura del audit log (D3)

- **CRUD (triggers):** si la escritura de auditoría falla, la transacción de negocio **rollbackea**
  (no hay dato sin su rastro). Correcto para valor probatorio.
- **Eventos de acceso (login/export/qr):** **best-effort** — si el registro falla, la operación
  principal NO se bloquea; se loguea el incidente en el servidor. Evita un DoS autoinfligido
  (p. ej. no poder loguearse porque falló un insert de auditoría).

---

## 9. Evidencia / pruebas

- **Unit (vitest)** — `tests/audit-hash-chain.test.ts`: **13 tests, todos en verde**. Cubren el
  formato canónico, el encadenado SHA-256, y la detección de alteración (contenido, ruptura del
  encadenado, borrado de un eslabón, independencia del orden).
  ```
  npx vitest run tests/audit-hash-chain.test.ts   → Test Files 1 passed | Tests 13 passed
  ```
- **SQL de prueba** (listos para correr en staging/local tras aplicar la migración):
  - `docs/pruebas/prompt_1_inmutabilidad.sql` — UPDATE/DELETE directo falla (authenticated y
    service_role).
  - `docs/pruebas/prompt_1_trace.sql` — editar una observación deja registro + estado anterior +
    `trace_id`.
  - `docs/pruebas/prompt_1_hashchain.sql` — `fn_verify_audit_chain` detecta una alteración simulada.
- **✅ Validación EN VIVO (Supabase local + Docker)** — `docs/pruebas/demo_local_srt.sql` corrido
  contra un Postgres real: (1) inmutabilidad → UPDATE/DELETE/INSERT bloqueados con `permission
  denied`; (2) hash chain → `INTEGRA`, y tras alterar una fila → `ALTERADA en seq 1`; (3) trigger →
  estado anterior + `trace_id` capturados. La migración aplica con `exit 0`. **La prueba en vivo
  encontró y corrigió un bug real** (el CHECK viejo de `accion` rechazaba los eventos de acceso).
  Detalle completo: `docs/validacion_en_vivo.md`.
- **Type-check**: `npx tsc --noEmit` → 0 errores. **Unit**: `npx vitest run` → 314/314.

---

## 10. Pendientes / limitaciones (honesto)

1. **Migración APLICADA a producción** (D1): ✅ `20260702000001_audit_trazabilidad_srt.sql`
   **aplicada a prod el 2026-06-11** (run GitHub Actions 27368883915; cadena de auditoría
   **INTEGRA** + escritura OK). Previamente se había validado contra Supabase local (Docker) con
   resultado exitoso — ver `docs/validacion_en_vivo.md`. La reescritura de `fn_audit_trigger`
   cambió el camino de escritura de todas las tablas auditadas y quedó verificada en producción.
2. **Cableado de eventos de acceso**: `EXPORT` y `QR_ACCESS` se integran en los Prompts 3 y 4.
   `GENERAR_REPORTE` queda con el RPC disponible, a cablear donde se generen reportes.
3. **`trace_id` en CRUD**: adopción incremental vía `createAuditedClient()`. Las acciones no
   migradas registran `trace_id` NULL (el resto del evento se captura igual).
4. **Tablas sin columna `id`** (junctions con PK compuesta, ej. `persona_establecimiento`) no
   reciben trigger con el `fn_audit_trigger` actual (usa `NEW.id`). Si se necesita auditarlas,
   requieren una variante del trigger por PK compuesta.
5. **Retención**: NO se purga el audit log automáticamente (D5) — se conserva mientras subsistan
   obligaciones legales.
