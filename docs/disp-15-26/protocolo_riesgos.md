# Protocolo de Gestión de Riesgos Tecnológicos y Seguridad de la Información — Sigmetría

> **Bloque B · Prompt 7.** Borrador del protocolo exigido por el **Art. 4° de la Res. SRT
> 48/2025** (marco de prácticas de control interno y gestión de riesgos tecnológicos), con el
> contenido mínimo del **Anexo 3.1**. Documento técnico-legal — lo revisa un abogado antes de
> presentarse.
>
> **Regla de oro:** cada afirmación se rastrea a un documento del Bloque A
> (`docs/{trazabilidad,almacenamiento,portabilidad,accesos,autocontrol,recuperacion}.md`) o a
> la configuración/código real. Lo no implementado está en "Pendientes de implementación".
>
> **Identificación del prestador:** `[RAZÓN SOCIAL — PLACEHOLDER]`, CUIT `[PLACEHOLDER]`,
> domicilio `[PLACEHOLDER]` (SAS en trámite). Marco de referencia adoptado: **ISO/IEC 27001**
> (como referencia, NO certificación — ver decisión D-B0).

---

## 1. Marco de gestión de riesgos de la tecnología y la seguridad de la información

Riesgos principales del servicio y los controles **reales** que los mitigan:

| Riesgo | Controles implementados (fuente) |
|--------|----------------------------------|
| **Acceso no autorizado** | Autenticación por contraseña + **2FA por OTP email** obligatorio para `full_access_main` y `responsable_estandares` (`accesos.md` §4). Control de acceso por roles con **RLS en la base** (no solo en UI): toda lectura/escritura ancla en `consultora_id` → **aislamiento entre clientes verificado** (`accesos.md` §2, §6). Viewers son solo-lectura a nivel RLS (`tests/viewer-readonly.test.ts`). Acceso por QR no adivinable (UUID v4) y revocable, sin datos personales (`accesos.md` §5). |
| **Alteración de registros** | **Cadena de custodia con hash chain SHA-256** por consultora; inmutabilidad reforzada con **REVOKE** de INSERT/UPDATE/DELETE a todos los roles (incl. `service_role`) — un borrado/edición directa falla con `permission denied`. Verificación de integridad (`fn_verify_audit_chain` → INTEGRA / primer `seq` alterado). (`trazabilidad.md` §3, §6, §7.) |
| **Pérdida de datos** | **Backup lógico externo** independiente del proveedor: DB cifrada AES-256 versionada (30 diarios / 12 mensuales) + Storage espejo incremental a R2/B2; GitHub Action diaria. **Prueba de recuperación ejecutada** (run 27368489932, 2026-06-11). Soft-delete en `archivos`. (`almacenamiento.md` §2–§4, §6.) |
| **Indisponibilidad** | Healthcheck `/api/health` (DB + Storage) apto para monitor externo; cola offline en IndexedDB para trabajo sin red. (`almacenamiento.md` §5.) |
| **Inconsistencia / error de carga** | Validación en dos capas: Zod en el front + **CHECK constraints en la base** (NOT VALID) que cubren la carga nueva aunque saltee la UI; detección de inconsistencias (`fn_detectar_inconsistencias`, 6 reglas) y alertas tempranas configurables. (`autocontrol.md` §1–§3.) |
| **Falla del proveedor de nube** | Backup externo independiente de Supabase (en R2/B2, otro proveedor) → la pérdida total del proveedor primario no implica pérdida de datos. Migraciones versionadas permiten reconstruir el esquema. (`almacenamiento.md` §2; `recuperacion.md`.) |

---

## 2. Gobierno y gestión de la tecnología y la seguridad de la información

- **Gestión del código:** repositorio en GitHub (`github.com/ezequieldanza93-tech/sigmetria-app`).
  Los cambios se integran por commits/PR; CI con GitHub Actions (`.github/workflows/`) corre
  type-check y tests.
- **Gestión de despliegues:** Vercel (proyecto `hys-app-sig`); deploy automático al integrar en
  `master`. Entornos de preview por rama.
- **Gestión de la base de datos:** **migraciones versionadas** en `supabase/migrations/`
  (aplicadas con `supabase db push`, registradas en el historial remoto). Ninguna migración
  aplicada se modifica: los cambios van como migraciones nuevas. El esquema es reconstruible.
- **Gestión de secretos:** las credenciales (claves de Supabase, R2/B2, Resend, `CRON_SECRET`,
  `MFA_COOKIE_SECRET`, `BACKUP_ENCRYPTION_KEY`) **no están en el repositorio**; viven en
  variables de entorno / GitHub Secrets / Vercel env. (`almacenamiento.md` §2.4.)
- **Control de acceso a la administración:** el rol `system_role = 'developer'` (super admin) es
  acotado; las impersonaciones de soporte quedan registradas en `impersonation_log`.

---

## 3. Prevención, análisis, respuesta y recuperación de interrupciones

- **Backups:** dos tracks (DB cifrada versionada + Storage espejo incremental), GitHub Action
  diaria a las 04:00 UTC + on-demand (`almacenamiento.md` §2, §3).
- **Prueba de recuperación REALIZADA:** run GitHub Actions **27368489932 (2026-06-11)** —
  recuperación de la DB end-to-end + verificación del delta de Storage (22 buckets / 55 objetos /
  31,29 MiB). Evidencia: `docs/evidencia-recuperacion-2026-06-11.md`; runbook: `docs/recuperacion.md`.
- **Comportamiento ante caídas:** healthcheck `/api/health` (200/503), cola offline.
- **Monitoreo:** endpoint de health apto para uptime externo; bitácora de cron (`cron_jobs_log`)
  con estado de cada corrida del autocontrol (`autocontrol.md` §5).
- **Respuesta a interrupciones (compromiso):** ante una caída del proveedor, restaurar desde el
  backup externo siguiendo `docs/recuperacion.md`. El RTO objetivo se valida con la prueba de
  recuperación periódica (ver Pendientes y `plan_adecuacion.md`).

---

## 4. Procesos de mejora continua

- **Autocontrol demostrable:** detección de inconsistencias (6 reglas, `fn_detectar_inconsistencias`),
  alertas tempranas (umbrales 30/15/7), vista consolidada `vw_estado_cumplimiento` y panel
  `/dashboard/cumplimiento` (`autocontrol.md`).
- **Registro de incidentes del servicio:** el audit log inmutable y la bitácora de cron son la
  base de evidencia; el registro formal de incidentes de seguridad como proceso documentado es un
  **compromiso** (ver Pendientes).
- **Revisiones periódicas (compromiso, cadencia realista para una empresa unipersonal):**
  - Revisión **mensual** de alertas críticas e inconsistencias abiertas (panel de cumplimiento).
  - Revisión **trimestral** del estado de seguridad: prueba de recuperación, repaso de accesos y
    roles, revisión de dependencias (`npm audit` / `security:audit`).
  - Revisión **anual** de este protocolo y del plan de adecuación.
  > Cadencia declarada como compromiso, no como histórico.

---

## 5. Cultura de gestión de riesgos

Sigmetría es, a la fecha, una **empresa unipersonal** donde el fundador ejerce como Responsable
de Estándares. Proporcional a esa realidad, las prácticas concretas son: este protocolo, los
**runbooks** (`docs/recuperacion.md`), las **validaciones automáticas** (CI: type-check + tests;
CHECK constraints en la base; RLS verificada por tests), la **trazabilidad inmutable** de toda
operación y la revisión periódica del punto 4. La cultura de riesgo se sostiene en controles
automatizados y documentados, no en headcount.

---

## 6. Roles y responsabilidades

- **Responsable de Estándares:** `[NOMBRE — PLACEHOLDER]` (el fundador), contacto
  `[privacidad@sigmetria.com.ar — CONFIRMAR]`. Cumple las funciones del **Art. 5 y Anexo 3.2 de la
  Res. SRT 48/2025**: cumplimiento normativo, gestión de riesgos, desarrollo de políticas internas,
  controles internos y auditorías, capacitación, y emisión de reportes (ver detalle en
  `designacion_responsable_estandares.md`). Responsabilidades operativas: aplicar las revisiones
  del punto 4, supervisar backups y recuperación, y mantener este protocolo.
- **Administración técnica (developer/super admin):** gestión del código, despliegues, base de
  datos y secretos (punto 2). En la etapa unipersonal, coincide con el Responsable de Estándares.

---

## 7. Marco de referencia y estándares internacionales

Sigmetría **adopta como referencia ISO/IEC 27001** (sistema de gestión de seguridad de la
información). **Adoptar como referencia NO es estar certificado** — la certificación es un objetivo
del plan de adecuación. Mapeo de controles implementados a dominios del Anexo A de ISO/IEC 27001:

| Dominio ISO/IEC 27001 (Anexo A) | Control implementado en Sigmetría |
|---|---|
| A.5 Políticas / A.6 Organización | Este protocolo; roles (punto 6) |
| A.8 Gestión de activos | Inventario de datos (`inventario_datos.md`); índice de archivos (`archivos`) |
| A.9 / A.5.15 Control de acceso | RLS por rol y por tenant, 2FA email, viewers solo-lectura (`accesos.md`) |
| A.8.24 Criptografía | Backup DB cifrado AES-256; TLS en tránsito; OTP/cookies HMAC; cifrado en reposo del proveedor |
| A.5.28 / A.8.15 Registro y trazabilidad | Audit log inmutable con hash chain SHA-256 (`trazabilidad.md`) |
| A.8.13 Respaldo de la información | Backup externo dos tracks + prueba de recuperación (`almacenamiento.md`) |
| A.5.30 / A.8.14 Continuidad y disponibilidad | Healthcheck, cola offline, runbook de recuperación |
| A.5.7 / A.8.8 Gestión de vulnerabilidades | CI con `npm audit`/`security:check`; revisión trimestral de dependencias |
| A.8.25 Desarrollo seguro | Migraciones versionadas, validación en base (CHECK), tests, revisión de cambios |

---

## 8. Pendientes de implementación

Honesto, alimenta el plan de adecuación (`plan_adecuacion.md`):

- **Supabase Pro / PITR** (~US$25/mes): backups gestionados de 7 días + Point-in-Time Recovery.
  Hoy el respaldo es el backup lógico externo. (`almacenamiento.md` §7.)
- **Credenciales R2/B2 + lifecycle del bucket:** cargar Secrets reales y configurar expiración por
  prefijo (`db/daily` 30d, `db/monthly` 365d). (`almacenamiento.md` §7.)
- **Re-upload automatizado de Storage** en la recuperación (hoy el re-poblado es manual).
- **UI de auditoría:** las herramientas forenses (verificación de cadena, reconstrucción por
  `trace_id`) hoy se consultan solo por SQL/CI; falta dashboard en la app. (`trazabilidad.md` §7.)
- **`trace_id` en escrituras CRUD:** `createAuditedClient` está definido pero sin call-site; hoy el
  `trace_id` de CRUD queda NULL. (`trazabilidad.md` §5, §10.3.)
- **`VALIDATE CONSTRAINT`** de los CHECK `NOT VALID` tras limpiar datos legacy. (`autocontrol.md`.)
- **Registro formal de incidentes de seguridad** como proceso documentado.
- **Frecuencia sub-diaria de cron / worker async de export:** requieren Vercel Pro. (`autocontrol.md`, `portabilidad.md`.)
- **Certificación ISO/IEC 27001 o ante Certificador 4.0:** objetivo, no estado actual.
