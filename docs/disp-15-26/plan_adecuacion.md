# Plan de Adecuación Técnica — Sigmetría HyS

> **Bloque B · Prompt 10.** Plan exigido por la **Disp. SRT 15/2026 (Anexo II, sección E)** para
> el Registro Inicial. Cronograma desde el estado actual al cumplimiento pleno: primero el núcleo
> mínimo del **Registro Provisorio** (almacenamiento, trazabilidad, portabilidad) y luego la
> totalidad para el **Definitivo**.
>
> **Regla de oro:** lista solo lo que falta DE VERDAD (no re-promete lo ya implementado) y solo
> plazos cumplibles para un equipo de una persona. Las dependencias de terceros se marcan.
> Plazos en meses **desde la inscripción**.

---

## 1. Estado de situación (11 estándares — Anexo I, Disp. 15/2026)

| # | Estándar | Estado | Evidencia (operativo) / nota |
|---|----------|--------|------------------------------|
| 1 | Almacenamiento | **Operativo** (parcial fino) | Backup externo cifrado dos tracks + prueba de recuperación ejecutada (`almacenamiento.md`, run 27368489932). Falta: PITR/Pro, credenciales R2 reales, lifecycle. |
| 2 | Trazabilidad y cadena de custodia | **Operativo** | Audit log inmutable + hash chain SHA-256, migración `20260702000001` aplicada (`trazabilidad.md`). Falta: `trace_id` en CRUD, UI de auditoría. |
| 3 | Portabilidad | **Operativo** | Export por empresa (21 entidades, CSV+JSON+binarios, manifest+checksums, signed URL), bucket `exports` aplicado (`portabilidad.md`). Falta: worker async, scoping de subcontratistas. |
| 4 | Disponibilidad | **Parcial** | Healthcheck `/api/health` + cola offline (`almacenamiento.md` §5). Falta: monitor de uptime externo conectado, PITR, re-habilitar Service Worker. |
| 5 | Accesibilidad (acceso de los actores, incl. organismos de control) | **Parcial** | Acceso remoto web por roles + QR público del legajo (`accesos.md` §5). Falta: perfil/acceso de solo lectura específico para el organismo de control. |
| 6 | Omnicanalidad | **Parcial** | App web responsive + QR + email; cola offline. Falta: app móvil nativa / PWA con Service Worker (hoy deshabilitado por bug React #418). |
| 7 | Interoperabilidad | **Parcial** | API v1 autenticada por API key (`/api/v1/`, `api_keys`, middleware). Falta: documentación de la API y endpoints de intercambio estándar. |
| 8 | Auditoría y verificabilidad | **Operativo** | Verificación de cadena (`fn_verify_audit_chain`), historial por entidad y por `trace_id` (`trazabilidad.md` §7). Falta: UI de auditoría en la app. |
| 9 | Autocontrol | **Operativo** | Validación en base + detección de inconsistencias + alertas + panel de cumplimiento (`autocontrol.md`). Falta: `VALIDATE` de constraints, UI de umbrales. |
| 10 | Datos biométricos | **No aplica** | La plataforma **no trata datos biométricos** (verificado contra el esquema). |
| 11 | Certificaciones | **Pendiente** | Objetivo del Registro Definitivo. Depende de la disponibilidad de Certificadores 4.0 inscriptos. |

---

> ### Actualización 2026-06-13 — cierre de pendientes de Trazabilidad y Auditoría (est. 2 y 8)
>
> **Hallazgo crítico corregido:** se detectó (y verificó contra prod) que el flujo central
> —recorridas y observaciones— **no generaba ninguna entrada en `audit_log`**: el trigger de
> auditoría se había colgado de los nombres viejos de las tablas (`registro_gestiones` /
> `observaciones_gestiones`), renombradas antes del despliegue de la auditoría, y la migración
> los salteó. Con 183 recorridas + 27 observaciones + 47 gestiones-establecimiento reales, había
> **0 filas auditadas** de ese flujo. La cadena de custodia NO cubría el corazón operativo.
>
> **Corregido (migraciones `20260713000002` y `20260713000003`, verificado en prod):**
> - Trigger de auditoría colgado en los nombres reales (`gestiones_registros`,
>   `gestiones_observaciones`, `gestiones_establecimientos`, `firmas`, `gestiones`).
> - `fn_resolve_consultora_id` extendida para resolver el tenant de las tablas de gestiones por
>   su FK → caen en la cadena de su consultora, no en la global.
> - Fix de tablas particionadas (`gestiones_registros`): se registra el nombre de la tabla raíz
>   (`pg_partition_root`), no la partición.
>
> **`trace_id` cableado:** las 13 server actions de recorridas/observaciones/firmas pasaron a
> usar `createAuditedClient` → cada flujo queda correlacionado por un `trace_id`. (Verificado: el
> header llega al trigger y se registra.)
>
> **UI de auditoría:** nueva pantalla `/dashboard/auditoria` (gateada a `full_access_main`,
> `full_access_branch`, `responsable_estandares` y developer/super-admin) con: verificar
> integridad de la cadena, historial inmutable de una entidad, y reconstrucción de un flujo por
> `trace_id`. El Responsable de Estándares ya puede verificar la cadena desde la app.
>
> Con esto, los pendientes finos de los estándares **2 (Trazabilidad)** y **8 (Auditoría)**
> quedan **cerrados** del lado del software. Restan los `trace_id` históricos previos al cableado
> (las filas viejas no se reencadenan: comportamiento normal).
>
> **Estándar 5 (Accesibilidad — organismo de control):** se creó el rol `auditor_externo` (solo
> lectura). Lee TODA la información de la consultora, **no puede escribir nada** (doble bloqueo:
> RLS por construcción + capa de app `canWrite`), y verifica la cadena de custodia desde
> `/dashboard/auditoria`. MFA obligatorio. El Admin Principal lo asigna desde la invitación de
> usuarios ("Auditor — organismo de control"). **Verificado en prod** con usuario de prueba: LEE,
> escritura BLOQUEADA (42501), ve la cadena (ÍNTEGRA). Queda **funcional**; el mecanismo concreto
> de acceso que defina la SRT (cuenta nominal por inspector / federado / temporal) se ajustará
> cuando la SRT lo publique (fuera de alcance técnico hoy).

---

## 2. Plan hacia el Registro Provisorio (núcleo mínimo: estándares 1, 2 y 3)

| Acción | Descripción | Criterio de verificación | Plazo (meses) | Dependencia |
|--------|-------------|--------------------------|---------------|-------------|
| Contratar Supabase Pro (PITR) | Habilitar backups gestionados 7 días + Point-in-Time Recovery | Restauración PITR probada a un punto en el tiempo | 1 | **Tercero:** contratación/pago Supabase |
| Cargar credenciales R2/B2 + lifecycle | Secrets reales en GitHub + reglas de expiración por prefijo (`db/daily` 30d, `db/monthly` 365d) | GitHub Action de backup corre verde subiendo a R2; lifecycle activo | 1 | **Tercero:** cuenta R2/B2 |
| Repetir prueba de recuperación contra staging real | Ejecutar el runbook contra un proyecto staging (no solo CI) | RTO medido y documentado | 2 | — |
| Cablear `trace_id` en escrituras CRUD | Usar `createAuditedClient` en las server actions clave (recorridas, observaciones) | Una recorrida completa reconstruible por `trace_id` | 2 | — |
| UI mínima de auditoría / verificación | Pantalla para verificar la cadena y ver el historial de una entidad | El Responsable verifica la cadena desde la app | 3 | — |
| Worker async de export (paquetes grandes) | Mover la generación del ZIP a cola Upstash + drenado por cron | Export de un paquete grande sin timeout | 3 | — |

> Los estándares 1, 2 y 3 ya están **operativos**; estas acciones cierran sus pendientes finos y
> elevan el RPO/RTO y la verificabilidad.

## 3. Plan hacia el Registro Definitivo (resto + certificaciones)

| Acción | Estándar | Descripción | Plazo (meses) | Dependencia |
|--------|----------|-------------|---------------|-------------|
| Monitor de uptime externo + revisar Service Worker | 4, 6 | Conectar `/api/health` a un monitor; resolver el bug que mantiene el SW deshabilitado | 4–6 | Bug React #418 |
| Acceso de solo lectura para el organismo de control | 5 | Perfil/credencial acotada para auditoría externa de la SRT | 4–6 | Definición SRT del mecanismo |
| Documentar y exponer API de interoperabilidad | 7 | Documentar `/api/v1`, formatos de intercambio | 6 | — |
| `VALIDATE CONSTRAINT` + UI de umbrales | 9 | Validar los CHECK `NOT VALID` tras limpiar legacy; formulario de umbrales | 4 | — |
| Registro formal de incidentes de seguridad | (transversal) | Proceso documentado de gestión de incidentes | 4 | — |
| Certificación ante Certificador 4.0 | 11 | Obtener la certificación de un Certificador inscripto en el RC | 9–12 | **Tercero:** disponibilidad de Certificadores 4.0 inscriptos |
| (Opcional) Certificación ISO/IEC 27001 | 11 | Marco de referencia adoptado (D-B0); certificar es objetivo de mediano plazo | 12+ | **Tercero:** organismo certificador |

## 4. Seguimiento del plan

- **Supervisa:** el **Responsable de Estándares** (`[NOMBRE — PLACEHOLDER]`).
- **Cadencia de revisión:** mensual (alertas/inconsistencias), trimestral (estado de seguridad y
  avance del plan), anual (revisión integral del plan y del protocolo) — alineado con
  `protocolo_riesgos.md` §4.
- **Condiciones explícitas:** los ítems marcados "Tercero" dependen de contratación (Supabase Pro,
  R2/B2) o de la disponibilidad de Certificadores 4.0 inscriptos en el Registro Correspondiente;
  sus plazos se cuentan desde que esa condición esté disponible.
