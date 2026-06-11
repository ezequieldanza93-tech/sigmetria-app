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
