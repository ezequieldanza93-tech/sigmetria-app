# Despliegue a producción — SRT 48/2025 (Bloque A) ✅ COMPLETADO

> Estado al 2026-06-11 (cierre). El Bloque A está **construido, validado, desplegado y verificado
> en producción**. Este documento registra el despliegue ya ejecutado y lo único que queda
> deliberadamente pendiente (2 fixes RLS que tocan flujos de usuarios reales).

---

## ✅ Estado de producción HOY

| Componente | ¿En producción? | Evidencia |
|---|---|---|
| App (audit UI, /cumplimiento, export ampliado, QR audit, alertas) | ✅ **SÍ** | deploy `dpl_5RTppXn8iVkMxUBr5jHpy21u1RbW` (commit 515ef02) **READY**; `/api/health` → 200 |
| Migración Prompt 1 (trazabilidad + hash chain) | ✅ Aplicada | run 27368883915; cadena **INTEGRA** |
| Migración Prompt 3 (bucket exports) | ✅ Aplicada | run 27368883915 |
| Migraciones Prompt 5 (constraints + inconsistencias) | ✅ Aplicadas | run 27368883915 |
| Migración Prompt 4 #3 (QR cross-tenant scoped) | ✅ Aplicada | run 27370607649; cadena **INTEGRA** + escritura OK |
| Backup diario (`backup.yml`) | ✅ Activo | secret `SUPABASE_DB_URL` corregido; corre 04:00 UTC |
| Capacidad de recuperación | ✅ **Probada (corrida limpia #6)** | run 27368489932 — `docs/evidencia-recuperacion-2026-06-11.md` |
| Bucket R2 + 9 secrets | ✅ Configurados | — |
| Fix RLS #1 (personas insert estricto) | ⏸️ **Preparado, NO aplicado** | puede romper onboarding de colaboradores |
| Fix RLS #2 (revocar sesiones) | ⏸️ **Preparado, NO aplicado** | desloguea todos los dispositivos; requiere UX |

> En resumen: **implementación 100% / despliegue a prod 100%** salvo los 2 fixes RLS que tocan
> acceso de usuarios reales (decisión consciente — ver abajo).

---

## Lo que se ejecutó (en orden, todo hecho)

1. **Secret `SUPABASE_DB_URL` corregido** → desbloqueó backup + recuperación + migraciones.
   Confirmado con corrida verde de la prueba de recuperación (#6, run 27368489932).
2. **4 migraciones aditivas aplicadas a prod** (run 27368883915) vía workflow `migrate-prod.yml`
   (`supabase db push` + verificación de cadena + prueba de escritura transaccional + auto-rollback).
   Resultado: cadena **INTEGRA**, escritura no rota.
3. **App desplegada** (merge `feat` → `master`). Se diagnosticó y corrigió un error de build real:
   `new Resend()` instanciado a nivel de módulo en `lib/email/alertas.ts` rompía `next build` en la
   fase *collect page data* (sin `RESEND_API_KEY`). Fix: lazy init dentro del handler. Deploy 515ef02
   **READY**, `/api/health` 200.
4. **Fix RLS #3 aplicado** (run 27370607649): `20260706000001_verificacion_tokens_update_scoped.sql`
   — cierra el hueco cross-tenant del QR. Cadena **INTEGRA** + escritura OK tras aplicar.
5. **Evidencia de recuperación archivada** (corrida limpia #6, sin contraseña en claro):
   `docs/evidencia-recuperacion-2026-06-11.md` + log crudo `docs/evidencia/recovery-test-6.log`.

---

## Lo único pendiente (2 fixes RLS — requieren tu mano)

Quedan **preparados, no aplicados**, en `docs/migraciones-preparadas/`. La razón es que **tocan
flujos de usuarios reales** (regla de la corrida autónoma: lo que corta acceso real se deja
preparado, no se aplica solo).

### Fix #1 — `01_personas_directorio_insert_estricto.sql`
Endurece el INSERT de `personas_directorio` para que un `colaborador` necesite al menos un
`user_access` activo. **Riesgo:** puede romper el onboarding de colaboradores recién invitados que
todavía no tienen acceso granular asignado.
**Antes de aplicar:** confirmar el flujo real de alta de colaboradores (¿se asigna `user_access`
antes o después de que empiecen a cargar datos?). Testear los 5 casos del header del archivo.

### Fix #2 — `02_revocar_sesiones_al_cambiar_email_o_password.sql`
Revoca todas las sesiones al cambiar email/contraseña. **Recomendado: Opción A (app-side)** —
agregar `await admin.auth.admin.signOut(targetUserId, 'global')` en `lib/actions/email-change.ts`
(no necesita SQL). **Riesgo:** desloguea al usuario de todos sus dispositivos; la UX debe comunicar
que tendrá que volver a loguearse con el email nuevo.

> Ambos son mejoras de seguridad correctas, pero la decisión de activarlos es de negocio/UX, no de
> código. Cuando los quieras, se aplican igual que el #3 (migración nueva + `migrate-prod.yml`, o el
> cambio app-side para el #2) en ~10 min con testeo del flujo.

---

## Rollback (si alguna vez la migración del audit log rompe escrituras)
La migración es **aditiva** (no borra datos). Rollback = desactivar triggers de auditoría
(`scripts/disable-audit-triggers.sql`) → prod escribe normal sin auditar, hasta revisar
`fn_audit_trigger`. El workflow `migrate-prod.yml` ya lo hace **automáticamente** si la prueba de
escritura falla tras aplicar.
