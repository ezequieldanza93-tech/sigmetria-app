# Autocontrol y Alertas — Res. SRT 48/2025 (Art. 4.9)

Sistema de **autocontrol demostrable** de Sigmetría: validación en carga,
detección de inconsistencias, alertas tempranas configurables, vista consolidada
de cumplimiento por empresa, y supervisión del propio mecanismo (bitácora de
cron). Este documento describe **únicamente lo implementado**. Lo que falta está
en la sección [Pendiente](#pendiente).

> La app YA tenía vencimientos, notificaciones e indicadores. El Prompt 5 los
> **formaliza y completa** como sistema verificable ante un auditor.

---

## 1. Validación en la carga

### 1.1 Frontend (ya existente)
- **Zod**: `lib/schemas/index.ts` y `lib/validation/schemas.ts`.
- **Forms**: `components/forms/*.tsx` (cada entidad valida tipos, requeridos y
  coherencia básica antes de enviar).

### 1.2 Constraints de base de datos (NUEVO — migración `20260705000001`)
Refuerzan en el motor las reglas que antes solo vivían en el front, de modo que
una inconsistencia no entre ni por una vía que saltee la UI (API directa, import,
SIGIA, script). **Todas se crean con `NOT VALID`** (ver [Por qué NOT VALID](#por-qué-not-valid)).

| Regla | Constraint | Tablas |
|------|------------|--------|
| R1 — `fecha_vencimiento >= fecha_emision` | `chk_*_fechas_coherentes` | `empresas_documentos`, `establecimientos_documentos`, `personas_documentos`, `subcontratistas_documentos`, `documentos`, `matriculas_profesionales` |
| R2 — `dias_aviso > 0` | `chk_cv_dias_aviso_positivo` | `configuracion_vencimientos` |
| R3 — `fecha_realizada >= fecha_programada` | `chk_inspecciones_fechas_coherentes` | `inspecciones` |
| R4 — `fecha_resolucion >= fecha_identificacion` | `chk_riesgos_fechas_coherentes` | `riesgos` |
| R5 — `periodo_hasta >= periodo_desde` | `chk_reportes_periodo_coherente` | `reportes_fotograficos` |
| R6 — `fecha_vencimiento >= fecha_emision` (NOT NULL) | `chk_matriculas_fechas_coherentes`, `chk_certcalib_fechas_coherentes` | `matriculas`, `certificados_calibracion` |

Las columnas nullable solo disparan el CHECK cuando ambas fechas están cargadas.

#### Por qué NOT VALID
Estas tablas tienen datos productivos. Un CHECK normal validaría TODAS las filas
existentes al aplicar la migración; si una sola fila legacy violara la regla, el
`db push` fallaría. `NOT VALID` aplica el constraint a todo INSERT/UPDATE **futuro**
(protege la carga nueva) pero no valida lo existente. Tras limpiar datos legacy:

```sql
ALTER TABLE <tabla> VALIDATE CONSTRAINT <nombre>;  -- online, no bloquea escrituras
```

---

## 2. Detección de inconsistencias

Función SQL **`fn_detectar_inconsistencias(p_consultora_id uuid)`**
(migración `20260705000002`). **TODAS las reglas viven en un solo lugar** dentro
de esa función, cada una en un bloque `RETURN QUERY` numerado y comentado.
**Extender = agregar un bloque** siguiendo el patrón `(codigo, severidad, mensaje)`;
el resto del sistema (panel, log) no requiere cambios.

| Código | Severidad | Qué detecta |
|--------|-----------|-------------|
| `inspeccion_sin_reporte` | warning | Inspección realizada sin reporte fotográfico que cubra su fecha |
| `documento_vencido_sin_renovacion` | critical | Documento (empresa/establecimiento) vencido sin otro del mismo tipo con vencimiento posterior |
| `observacion_vencida_sin_seguimiento` | warning | Observación de gestión con fecha planificada pasada y sin cierre |
| `gestion_no_ejecutada` | warning | Gestión con entregable, planificada en fecha pasada y no ejecutada |
| `riesgo_critico_sin_resolver` | critical | Riesgo de nivel `critico` con `resuelto = false` |
| `incidente_sin_cerrar` | critical | Incidente abierto >30 días desde la ocurrencia |

Devuelve `codigo, severidad, empresa_id, establecimiento_id, referencia_tabla,
referencia_id, mensaje`. Es `SECURITY DEFINER` y se expone vía la server action
`getInconsistencias()` (`lib/actions/autocontrol.ts`), que scopea por la
consultora del usuario.

---

## 3. Alertas tempranas configurables

### 3.1 Umbrales (NUEVO — tabla `alertas_umbrales`)
Avisos **antes** del vencimiento, configurables por consultora. Seed por defecto:
**30 (info) / 15 (warning) / 7 (critical) días**. Cada fila: `dias_antes`
(`> 0`), `severidad`, `activo`. Esta capa es de **escalamiento**, complementaria a
las notificaciones in-app de **10/3/0 días** que ya genera `refrescarNotificacionesCron`
(`lib/actions/configuracion-vencimiento.ts`) según `configuracion_vencimientos.dias_aviso`.

> Se eligió una tabla aparte (y no extender `configuracion_vencimientos`) porque
> los `dias_aviso` generan NOTIFICACIONES por tipo de entidad, mientras que los
> umbrales son una capa transversal de escalamiento con su propia severidad.

La lógica de **cuándo dispara un umbral** es pura y testeada:
`lib/alertas/umbrales.ts` (`diasHastaVencimiento`, `umbralQueDispara`,
`agruparPorConsultora`). Anti-spam: un umbral dispara **solo el día exacto** en
que `dias_restantes` lo iguala, no todos los días de la ventana.

### 3.2 Canales (D6)
- **In-app: siempre.** Notificaciones (`notificaciones`) + alertas SRT (`alertas`).
- **Email: solo para críticas.** `sendAlertasCriticalEmail()` (`lib/email/alertas.ts`)
  envía **un email agrupado por consultora** (no uno por alerta) a los admins
  (`full_access_main` / `full_access_branch`). Ahora está **hookeado** al cron
  `/api/cron/alertas` vía `emitAlertasTodasLasConsultoras()` (`lib/alertas/emit.ts`).

### 3.3 Registro de emisión (NUEVO — tabla `alertas_emitidas_log`)
Bitácora **inmutable** (escrita solo por el server con service_role) de cada
aviso emitido: `canal` (in_app/email), `tipo`, `severidad`, `destinatarios[]`,
`cantidad` (cuántos ítems agrupó), `referencia_*`, `meta`, `emitida_at`. Es la
evidencia de que el aviso **se emitió** (qué, a quién, cuándo).

---

## 4. Vista de estado de cumplimiento por empresa

Vista SQL **`vw_estado_cumplimiento`** (`security_invoker`, respeta RLS).
Consolida por empresa:
- `docs_vencidos`, `docs_por_vencer` (≤30 días) — empresa + establecimiento.
- `alertas_abiertas`, `alertas_criticas` (de `alertas` sin resolver).
- `establecimientos_total`, `establecimientos_iso`, `iso_cobertura_pct`
  (avance ISO 45001 vía `establecimientos.aplica_iso_45001`).

Expuesta en `getEstadoCumplimiento()` y renderizada en el panel
`/dashboard/cumplimiento` (`app/(dashboard)/dashboard/cumplimiento/page.tsx` +
`components/cumplimiento/cumplimiento-panel.tsx`). El panel tiene tres pestañas:
**Estado por empresa**, **Inconsistencias** y **Supervisión del cron** (esta última
solo para super admin). Acceso desde la campana de alertas del header.

---

## 5. Supervisión del propio mecanismo

### 5.1 Bitácora de cron (NUEVO — tabla `cron_jobs_log`)
Cada corrida de cron escribe una fila: `job_name`, `started_at`, `finished_at`,
`status` (running/success/error), `error`, `filas_procesadas`,
`notificaciones_generadas`, `alertas_generadas`, `inconsistencias_detectadas`,
`resultado` (jsonb). Helpers SECURITY DEFINER `cron_log_start` / `cron_log_finish`,
envueltos por `lib/cron/cron-log.ts` (`startCronRun` / `finishCronRun`,
best-effort: nunca rompen el cron). Solo super admin lee la bitácora (RLS).

Crons hookeados al log: `vencimientos`, `cursos-vencimientos`, `alertas`,
`inconsistencias`, `limpiar-exports`. Los crons de facturación
(`expirar-past-due`, `aplicar-cambios-plan`) tienen su propia auditoría
(`subscription_audit_log`) y no se duplican en esta bitácora.

### 5.2 Demostración ante auditor
La pestaña **Supervisión del cron** del panel muestra las últimas corridas con
su estado y contadores → evidencia de que el autocontrol corrió, cuándo y con qué
resultado.

---

## 6. Agendado del cron (`vercel.json`) — dispatcher único (límite Hobby)

Antes `vercel.json` no agendaba ningún cron (los endpoints existían pero nada los
disparaba). El plan **Vercel Hobby permite máximo 2 cron jobs** (y solo diarios), así
que `vercel.json` agenda **un único cron** — `/api/cron/diario` (`0 6 * * *`) — que actúa
como **dispatcher**: dispara los 7 jobs en paralelo en una sola corrida y devuelve el
estado de cada uno. (Código: `app/api/cron/diario/route.ts`.)

| Job disparado por el dispatcher | Qué hace |
|------|----------|
| `/api/cron/vencimientos` | Refresca notificaciones de vencimiento (10/3/0) |
| `/api/cron/cursos-vencimientos` | Marca cursos vencidos + notifica (30/7/1) |
| `/api/cron/alertas` | Regenera alertas SRT + email crítico agrupado |
| `/api/cron/inconsistencias` | Corre la detección y registra el conteo |
| `/api/cron/expirar-past-due` | (Facturación) expira past_due |
| `/api/cron/aplicar-cambios-plan` | (Facturación) aplica downgrades |
| `/api/cron/limpiar-exports` | GC de paquetes de portabilidad |

El dispatcher y cada job autentican con `Authorization: Bearer ${CRON_SECRET}` (el
dispatcher reenvía el header a cada sub-job). Si en el futuro se necesita frecuencia
sub-diaria o jobs con horarios separados → Vercel Pro (levanta el límite de crons).

---

## 7. Fix relevante incluido

`generar_alertas_consultora()` (de la migración `20260527000004`) referenciaba la
tabla `siniestros`, **renombrada a `incidentes`** en `20260614000002`. La función
vigente **fallaba** con _"relation siniestros does not exist"_. La migración
`20260705000002` la reescribe contra `incidentes` (enum `incidente_estado`:
pendiente/en_investigacion/cerrado; campo `fecha_ocurrencia`).

---

## Pendiente

- **Validar los CHECK `NOT VALID`**: tras limpiar datos legacy, promover cada
  constraint con `ALTER TABLE … VALIDATE CONSTRAINT …` para que también cubra las
  filas históricas. Hoy solo protegen la carga nueva.
- **Migraciones**: ✅ `20260705000001` y `20260705000002` **APLICADAS a producción**
  (2026-06-11, run GitHub Actions 27368883915; cadena de auditoría INTEGRA + escritura OK).
- **Frecuencia sub-diaria**: en Vercel Hobby los cron son **diarios** y hay 1 solo
  (el dispatcher). Mayor frecuencia (ej. alertas cada hora) o jobs separados requiere
  **Vercel Pro**.
- **Email de avisos tempranos no-críticos**: hoy el email es solo para alertas
  críticas (D6). Los avisos tempranos por umbral (30/15) se registran in-app y en
  `alertas_emitidas_log`, pero no envían email.
- **Configuración de umbrales desde la UI**: `alertas_umbrales` se siembra con
  30/15/7 y se puede editar por SQL/RLS, pero falta el formulario en el dashboard.
- **Notificación in-app por inconsistencia**: `fn_detectar_inconsistencias` se
  consulta en vivo desde el panel; no genera filas en `notificaciones`. El cron
  `/api/cron/inconsistencias` solo registra el conteo en la bitácora.
