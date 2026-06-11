# Decisiones — Corrida autónoma SRT 48/2025 (Bloque A)

> Registro vivo de decisiones tomadas durante la corrida autónoma de implementación
> de estándares SRT (Res. 48/2025 + Disp. 15/2026). Cada entrada: **qué** se decidió,
> **por qué**, y **qué alternativa** había. Todo es revisable.
>
> Fecha de corrida: 2026-06-11. Modo: autónomo (usuario ausente).

---

## D0 — Decisiones confirmadas por el usuario (consulta única inicial)

1. **Plan Supabase / Backups (Prompt 2):** se asume **Free hoy**. Se construye el backup
   lógico externo cifrado + runbook YA. El upgrade a **Pro (~US$25/mes, habilita PITR 7 días
   + branching)** queda **documentado como pendiente** — NO se contrata en la corrida.
2. **Destino del backup externo:** **Cloudflare R2 / Backblaze B2** (S3-compatible). Se dejan
   script + GitHub Action listos; el usuario carga las credenciales en Secrets/env después.
3. **Prueba de recuperación:** **dry-run local + runbook repetible**. La restauración a un
   staging real queda lista para correr cuando exista el proyecto.

## D1 — No pushear migraciones a producción en la corrida desatendida

- **Qué:** ninguna migración se aplica a la base de producción durante la corrida. Se entregan
  como archivos `.sql` nuevos, versionados, listos para que el usuario los aplique tras revisar.
- **Por qué:** un trigger/constraint con un bug podría cortar TODAS las escrituras en prod
  (= cortar acceso a usuarios reales), exactamente lo que el modo autónomo prohíbe hacer solo.
  Además no hay Docker en la máquina → no se puede levantar Supabase local para probar en vivo.
- **Alternativa descartada:** `supabase db push` directo (rechazado por riesgo en prod desatendido).

## D2 — Migraciones que tocan RLS/acceso van "preparadas, no aplicadas"

- **Qué:** las correcciones de RLS/permisos que pueden cortarle el acceso a un usuario real
  (ej. cerrar `directorio_personas INSERT`, revocar sesiones al cambiar email, gate del bypass
  MFA de testing) NO van en `supabase/migrations/`. Van en `docs/migraciones-preparadas/` con
  instrucciones, para que NO se apliquen junto al resto en un `db push`.
- **Por qué:** regla 4 del modo autónomo — dejar la corrección lista sin aplicar.
- **Alternativa descartada:** ponerlas en el folder normal (se aplicarían sin testeo dirigido).

## D3 — Estrategia ante fallo de escritura del audit log (Prompt 1)

- **Qué:** dos estrategias según el tipo de evento:
  - **Escrituras de negocio (vía trigger):** el fallo del log **bloquea** la operación
    (la transacción rollbackea naturalmente). Correcto para cadena de custodia.
  - **Eventos de acceso (login, export, acceso QR):** **best-effort** — si el log falla, la
    operación principal NO se bloquea, pero se registra el incidente en logs de servidor.
- **Por qué:** no se puede bloquear un login porque falló un insert de auditoría (sería un DoS
  autoinfligido). Pero sí se debe garantizar la integridad de los datos de negocio.
- **Alternativa descartada:** bloquear todo (riesgo de DoS) / no bloquear nada (pierde custodia).

## D4 — Mecanismo de cron: reusar Vercel Cron existente

- **Qué:** los jobs periódicos (vencimientos, alertas, inconsistencias, backup) usan el patrón
  **Vercel Cron** que YA existe (`app/api/cron/*` + `vercel.json`), no se introduce pg_cron nuevo
  salvo para lo que ya lo usa (particiones de audit_log).
- **Por qué:** consistencia con lo existente, menos superficie nueva, credenciales ya resueltas
  (`CRON_SECRET`).
- **Nota de plan:** en Vercel Hobby los cron están limitados a frecuencia diaria. Si se necesita
  mayor frecuencia, requiere Vercel Pro (documentado en docs/almacenamiento.md / autocontrol.md).

## D5 — Retención del audit log: nunca auto-purgar

- **Qué:** no se programa DROP PARTITION automático del audit log.
- **Por qué:** la norma exige conservar mientras subsistan obligaciones legales; purgar
  automáticamente destruiría valor probatorio.

## D6 — Canal de alertas por defecto

- **Qué:** in-app siempre + email para severidad crítica (infra Resend ya integrada).
- **Por qué:** evita spam, prioriza lo accionable; ya existe `sendAlertasCriticalEmail()`.

---

> Las decisiones menores adicionales tomadas dentro de cada prompt se anotan abajo a medida
> que surgen.

## Decisiones menores por prompt

### Prompt 1 — Trazabilidad
- **Hash chain por consultora** (no global única): permite serializar la cadena de cada tenant con
  `pg_advisory_xact_lock` sin bloquear a las demás. Cadena "global" (UUID cero) para eventos sin
  consultora. Alternativa descartada: cadena única global (serializaría TODAS las escrituras).
- **Inmutabilidad reforzada con REVOKE de privilegios** (no solo RLS): UPDATE/DELETE directos
  fallan con `permission denied` incluso para `service_role`. La RLS sola los dejaba como no-op.
- **`trace_id`/`origen` vía `request.headers`** (no GUC de sesión): con PostgREST cada request es su
  propia transacción; el header sí vive dentro de la transacción del trigger. Helper
  `createAuditedClient`. Fallback a GUC para flujos en RPC.
- **`actor_email` snapshot vía `auth.jwt()->>'email'`**: sin query extra; inmutable al borrado de
  profiles.
- **Migración defensiva** (DO block que crea triggers solo si la tabla existe y tiene `id`): evita
  romper el push si un nombre cambió; deja `RAISE NOTICE` por tabla cubierta.
- **LOGIN cableado best-effort** en `lib/actions/login.ts`: funciona aun sin la migración aplicada
  (el rpc falla silencioso). EXPORT/QR se cablean en Prompts 3 y 4.

### Prompt 2 — Almacenamiento
- **Backup lógico externo cifrado (no PITR)**: con Supabase Free no hay backups gestionados.
  Se construyó dump lógico (DB + Storage) + AES-256 + subida a R2/B2 vía GitHub Action diaria.
  Alternativa descartada: contratar Pro (~US$25/mes) ahora — queda documentado como pendiente,
  no se contrata en esta corrida.
- **DB dump vía `supabase db dump` (no `pg_dump` directo)**: la máquina no tiene Docker. La CLI
  2.105 dumpea contra la base remota sin Docker. 3 archivos: schema / data-only / role-only.
  Fallback adicional: el `scripts/backup.ts` existente (JSON lógico de tablas public).
- **AES-256-CBC con OpenSSL + PBKDF2 100k (no GPG ni libs node)**: OpenSSL ya viene en
  ubuntu-latest y en la máquina (3.5.5); sin dependencias nuevas. Clave por `BACKUP_ENCRYPTION_KEY`.
- **Subida con AWS CLI + `--endpoint-url` (no SDK S3)**: R2/B2 son S3-compatibles; el AWS CLI ya
  está en ubuntu-latest. Evita sumar `@aws-sdk/*` a las deps de la app.
- **Retención por prefijos `daily/` + `monthly/` en el código; purga vía lifecycle del bucket**:
  rotar/eliminar objetos viejos es responsabilidad del proveedor (regla por prefijo), más barato y
  robusto que un job de borrado propio. La regla de lifecycle queda documentada como pendiente.
- **`BACKUP_OUT_DIR` en `scripts/backup.ts`**: cambio mínimo para que el orquestador redirija la
  salida del fallback JSON al bundle en curso, sin romper el uso standalone.
- **Healthcheck sin auth y liviano** (`/api/health`): count HEAD sobre `consultoras` + `listBuckets()`.
  No expone datos; `Cache-Control: no-store`; apto para uptime monitor externo.
- **Guard anti-prod en `restore-dry-run.sh`**: rechaza URLs con el ref de prod o "prod" salvo
  `CONFIRM=yes`. Evita restaurar accidentalmente sobre producción.
- **`backups/` en `.gitignore`**: los dumps y bundles cifrados nunca se commitean.

---

### Prompt 3 — Portabilidad

- **`select(*)` por entidad en vez de columnas hardcodeadas**: el route viejo
  listaba columnas a mano (`select(nombre, cuit, …)`) con nombres DESACTUALIZADOS
  tras los renombres masivos (20260522000001) → varias queries fallaban en
  silencio (tablas/columnas inexistentes: `directorio_personas`, `tema`,
  `nivel_riesgo`, `persona_id`, etc.). Se pasó a `select(*)`: resiliente al
  esquema y correcto para portabilidad (recuperar TODOS los campos). Alternativa
  descartada: mantener listas de columnas curadas — frágiles y ya rotas.
- **Catálogo declarativo de entidades (`lib/export/entities.ts`)**: una sola
  fuente de verdad para QUÉ tablas se exportan, cómo se scopean a la empresa
  (self / empresa / establecimiento / parent) y su columna de fecha para el
  filtrado parcial. Hace el route delgado y la lógica testeable.
- **Aislamiento en dos capas (RLS + filtro explícito)**: el paquete se arma con
  el cliente de SESIÓN (RLS activa) y ADEMÁS se filtra explícitamente por la
  empresa / el set de establecimientos. El test `isolation.test.ts` prueba que
  aunque el backend "filtre mal", el filtro explícito descarta filas de otra
  empresa (defensa en profundidad). Alternativa descartada: confiar solo en RLS.
- **Binarios desde las filas exportadas (no desde la tabla `archivos`)**: se
  extraen los paths de las columnas `*_url`/`url` de las filas YA scopeadas y se
  descargan de Storage. Así solo se bajan binarios de filas que pasaron el
  scoping de empresa (la tabla `archivos` no tiene empresa_id, solo consultora).
- **Manifest + SHA-256 por archivo**: `manifest.json` describe contenido,
  relaciones (FK a nivel tabla), fecha y checksum de cada archivo (CSV/JSON/
  binario). Web Crypto (`crypto.subtle`), sin dependencias nuevas.
- **Async = guardar en bucket privado `exports` + signed URL + email**: para
  paquetes grandes (umbral 25 MB o `?async=1`) se sube el ZIP al bucket privado
  `exports` (RLS por consultora, migración 20260704000001, NO aplicada) y se
  devuelve un signed URL temporal (TTL 1h), notificado por Resend. El worker de
  generación en background por cola queda como PENDIENTE: hoy el armado es
  síncrono pero el guardado + signed URL + email YA funcionan. Fallback: si el
  guardado async falla, se cae a descarga directa para no perder el export.
- **Cron de limpieza (`/api/cron/limpiar-exports`)**: borra paquetes del bucket
  `exports` con más de 24 h (el signed URL ya expira por TTL). Patrón Vercel Cron
  con `Authorization: Bearer ${CRON_SECRET}`, a declarar en `vercel.json`.
- **Audit log best-effort en cada export**: `logAuditEvent(accion: EXPORT,
  tabla: empresas, registroId: empresaId)` con meta {alcance, fechas, formatos,
  filas, bytes, formato_entrega}. Si el log falla, el export no se rompe.

---

### Prompt 4 — Accesos

- **Bypass MFA gateado tras `ALLOW_MFA_TEST_BYPASS` (cerrado por defecto)**:
  `lib/auth/test-mfa-bypass.ts` ahora exige la env var en `'true'` para que el
  bypass de cuentas `@sigmetria.app` aplique. Por defecto (y en prod, donde NO
  debe setearse) el bypass está DESACTIVADO → rige el MFA real por OTP para todas
  las cuentas. **Por qué:** el bypass estaba activo "duro" en código, lo que viola
  el Art. 4.5 (autenticación adecuada) si llega a prod. **Alternativa descartada:**
  borrar el bypass — se mantiene para testing/preview, pero gateado y seguro.
- **Auditoría de acceso QR best-effort (D3)**: `app/verificar/[token]/page.tsx`
  registra `QR_ACCESS` vía `logAuditEvent` (origen `sistema`, sin datos sensibles)
  para cadena de custodia del legajo público. **Por qué:** Art. 4.5 pide trazar el
  acceso por QR. **Alternativa descartada:** registrar solo `access_count` (ya
  existe) — insuficiente para auditoría forense (no queda quién/cuándo en el log
  inmutable). El RPC `log_audit_event` queda operativo cuando se aplique la
  migración 20260702000001 (Prompt 1); hasta entonces el log se absorbe sin romper.
- **Fixes de RLS que pueden cortar acceso → preparados, no aplicados (D2)**: tres
  `.sql` en `docs/migraciones-preparadas/`: (01) INSERT estricto de
  `personas_directorio` scopeado a `user_access` del colaborador; (02) revocación
  de sesiones al cambiar email/password (`signOut('global')` app-side u RPC sobre
  `auth.sessions`); (03) UPDATE/`regenerar_token` de `verificacion_tokens`
  scopeado al establecimiento (cierra ruptura de aislamiento entre consultoras en
  el QR). **Por qué preparados y no aplicados:** cada uno puede cortarle acceso a
  un usuario real (onboarding de colaborador, deslogueo de dispositivos, regeneración
  de tokens) → regla del modo autónomo. **Alternativa descartada:** ponerlos en
  `supabase/migrations/` (se aplicarían sin testeo dirigido).
- **Corrección de la auditoría previa**: el hueco reportado como
  `directorio_personas INSERT WITH CHECK (true)` YA estaba corregido por la
  migración 20260516000009 (role-gated, sin viewers). El hueco residual real es
  más fino (no scopea establecimiento) → fix 01.
- **Test de viewers solo-lectura sobre lógica TS pura** (`tests/viewer-readonly.test.ts`,
  30 casos): valida `canWrite/canDelete/canManageUsers/isFreeViewerRole` —
  espejo del gating de RLS (`has_*_write_access` nunca incluye un rol viewer).
  **Por qué TS y no SQL:** sin Docker/DB local no se puede correr RLS; la lógica TS
  es el contrato verificable y los tests SQL quedan documentados en accesos.md.

---

### Prompt 5 — Autocontrol

- **CHECK constraints con `NOT VALID` (migración 20260705000001)**: las reglas de
  coherencia que vivían solo en el front (Zod/forms) ahora se refuerzan en el motor
  (R1 `fecha_vencimiento >= fecha_emision`, R2 `dias_aviso > 0`, R3 inspecciones,
  R4 riesgos, R5 reportes, R6 matrículas/certificados). **Por qué NOT VALID:** las
  tablas tienen datos productivos; un CHECK normal validaría todo lo existente y un
  solo dato legacy violatorio rompería el `db push`. NOT VALID protege la carga
  nueva sin tocar lo viejo. **Alternativa descartada:** CHECK validado de una —
  riesgo de fallar el apply. Pendiente: `VALIDATE CONSTRAINT` tras limpiar legacy.
- **Reglas de inconsistencia en UN solo lugar (`fn_detectar_inconsistencias`)**:
  todas las reglas (6) viven en bloques `RETURN QUERY` numerados dentro de una sola
  función SQL; extender = agregar un bloque. **Por qué:** evita reglas dispersas y
  hace el set auditable y fácil de crecer. **Alternativa descartada:** una vista por
  regla — más difícil de mantener y de exponer unificado.
- **Tabla `alertas_umbrales` separada de `configuracion_vencimientos`**: los
  umbrales tempranos (30/15/7) son una capa de escalamiento transversal con su
  propia severidad; `dias_aviso` genera notificaciones por tipo de entidad (10/3/0).
  **Por qué separar:** no acoplar dos conceptos distintos. La lógica de disparo es
  pura y testeada (`lib/alertas/umbrales.ts`, 10 tests). Anti-spam: dispara solo el
  día exacto del umbral, agrupado por consultora.
- **Fix `generar_alertas_consultora` (siniestros → incidentes)**: la función vigente
  referenciaba `public.siniestros`, RENOMBRADA a `public.incidentes` en
  20260614000002 → hoy FALLA. La migración 20260705000002 la reescribe contra
  `incidentes`. **Descubrimiento:** la función nunca se llamaba desde ningún lado
  (ni cron ni server action) — por eso el fallo estaba latente. Ahora se hookea al
  cron `/api/cron/alertas`.
- **Email crítico hookeado al cron (D6)**: `sendAlertasCriticalEmail` ya existía
  pero no se disparaba. `lib/alertas/emit.ts` la conecta: un email agrupado por
  consultora (anti-spam) a los admins, solo para críticas; in-app siempre. Cada
  emisión se registra en `alertas_emitidas_log` (inmutable, service_role).
- **Bitácora `cron_jobs_log` + agendado en `vercel.json`**: antes los endpoints de
  cron existían pero `vercel.json` no agendaba nada. Ahora se agendan diariamente
  (límite Hobby; sub-diario requiere Pro — D4) y cada corrida escribe start/finish
  en `cron_jobs_log` vía helpers SECURITY DEFINER best-effort (`lib/cron/cron-log.ts`).
  **Por qué best-effort:** la bitácora no debe poder romper el trabajo del cron.
  Los crons de facturación no se duplican acá (ya tienen `subscription_audit_log`).
- **Vista `vw_estado_cumplimiento` (`security_invoker`)**: consolida por empresa
  vencimientos, alertas abiertas y cobertura ISO 45001. **Por qué vista y no MV:**
  el volumen por consultora es chico y se prefiere frescura sobre refresco. Panel en
  `/dashboard/cumplimiento` con pestaña de supervisión del cron solo para super admin.
- **Migraciones NO aplicadas**: 20260705000001 y 20260705000002 quedan versionadas y
  aditivas, sin `db push` (regla de la corrida autónoma).
