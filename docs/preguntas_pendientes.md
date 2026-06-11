# Preguntas / decisiones pendientes — SRT 48/2025 (actualizado al cierre 2026-06-11)

> La mayoría de lo que estaba pendiente **ya se ejecutó y está en producción**. Abajo queda el
> registro de qué se resolvió y lo único que sigue requiriendo tu mano (2 fixes que tocan flujos de
> usuarios reales + decisiones de plata/infra opcionales).

---

## ✅ RESUELTO (en producción)

- **P1 — Migraciones aditivas (trazabilidad, exports, autocontrol):** ✅ aplicadas a prod
  (run 27368883915, vía `migrate-prod.yml` con verificación + auto-rollback). Cadena INTEGRA.
- **P2 (parte) — Fix RLS #3 (QR cross-tenant):** ✅ aplicado a prod (run 27370607649).
- **P3 — Credenciales backup R2:** ✅ bucket + 9 secrets configurados; backup diario activo.
- **P4 — Prueba de recuperación real:** ✅ corrida limpia #6 (run 27368489932) — backup→R2→restore,
  8.217 filas, 180 tablas, checksums OK. Evidencia: `docs/evidencia-recuperacion-2026-06-11.md`
  + log crudo `docs/evidencia/recovery-test-6.log`.
- **P6 — Crons en Vercel:** ✅ resuelto. Hobby permite máx. 2 crons → `vercel.json` agenda **1
  dispatcher** (`/api/cron/diario`) que dispara los 7 jobs en paralelo.
- **Deploy de la app:** ✅ deploy 515ef02 READY; `/api/health` 200. (Se corrigió un error de build:
  `new Resend()` a nivel de módulo en `lib/email/alertas.ts` → lazy init.)

---

## ⏸️ PENDIENTE — requiere tu decisión (tocan usuarios reales o plata)

### P2-bis — Los otros 2 fixes RLS (`docs/migraciones-preparadas/`)
Quedan **preparados, no aplicados** porque cortan/alteran acceso de usuarios reales:

- **#1 `01_personas_directorio_insert_estricto.sql`** — exige que un `colaborador` tenga
  `user_access` activo para insertar personas. **Riesgo:** puede romper el onboarding de
  colaboradores recién invitados. *Antes de aplicar:* confirmar el flujo real de alta.
- **#2 `02_revocar_sesiones_al_cambiar_email_o_password.sql`** — desloguea de todos los dispositivos
  al cambiar email/clave. **Recomendado:** Opción A app-side (`admin.auth.admin.signOut(id,'global')`
  en `lib/actions/email-change.ts`). *Riesgo:* UX debe avisar que hay que re-loguear.

> Cuando los quieras, se aplican igual que el #3 (~10 min con testeo del flujo que cada uno toca).

### P5 — Upgrade a Supabase Pro (PITR) — decisión de plata
- **A) (elegida)** Seguir en **Free** + backup lógico externo cifrado diario (recuperación ya
  probada y documentada → suficiente para el estándar).
- **B)** **Pro (~US$25/mes)**: PITR 7 días + branching.

### P7 — `VALIDATE CONSTRAINT` de los CHECK del Prompt 5
Los CHECK se aplicaron `NOT VALID` (protegen cargas nuevas, no las filas legacy).
- **A) (recomendada)** Detectar filas que violen cada CHECK, limpiar, y luego
  `ALTER TABLE … VALIDATE CONSTRAINT …` para cubrir el histórico.
- **B)** Dejarlos `NOT VALID` — aceptable y documentado.
