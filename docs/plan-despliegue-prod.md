# Plan de despliegue a producción — SRT 48/2025 (Bloque A)

> Estado al 2026-06-11. Todo el Bloque A está **construido, validado y documentado**. Falta el
> **despliegue a producción**, que está bloqueado por una credencial y por pasos irreversibles que
> conviene hacer con supervisión. Este documento es la guía de ejecución, en orden.

---

## 🔴 Bloqueo actual (resolver PRIMERO)

**El secret `SUPABASE_DB_URL` tiene una contraseña que no autentica.** Las corridas de la prueba de
recuperación (#3, #4) fallan con `password authentication failed for user "postgres"`. Esto **también
bloquea** aplicar migraciones a prod y hace **fallar el backup diario**.

**Causas probables (revisar en este orden):**
1. La contraseña tipeada en Supabase ≠ la pegada en el secret (mismatch).
2. Un espacio o salto de línea al pegar el secret.
3. La cadena usa el usuario equivocado: debe ser `postgres.lslzhgmoaxgkcjeweqaz` (no `postgres`).
4. Caracteres especiales en la contraseña (rompen la URL) — **usar contraseña alfanumérica**.

**Plantilla exacta del secret** (alfanumérica, sin símbolos):
```
postgresql://postgres.lslzhgmoaxgkcjeweqaz:<CLAVE_ALFANUMERICA>@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

**Cómo confirmar que quedó bien:** Actions → "Prueba de recuperación (auditoría)" → Run workflow.
Si pasa (verde), el secret está OK y el backup diario también funcionará.

---

## Estado de producción HOY (honesto)

| Componente | ¿En producción? |
|---|---|
| App (código de los 5 prompts: audit UI, /cumplimiento, export ampliado, QR audit) | ❌ NO — vive en la rama `feat/srt-48-2025-compliance`, sin deployar |
| Migraciones (1/3/5) | ❌ NO aplicadas a prod |
| Backup diario (`backup.yml`) | ⚠️ Deployado en master, pero **fallando** hasta arreglar el secret |
| Capacidad de recuperación | ✅ **Probada** (corrida #2, datos reales) — ver `docs/evidencia-recuperacion-2026-06-11.md` |
| Bucket R2 + 9 secrets | ✅ Configurados (1 secret a corregir) |

> En resumen: **implementación 100% / despliegue a prod ~0%**. Nada de las features nuevas está
> "vivo" para usuarios todavía; está todo listo para rodar.

---

## Plan de ejecución (en orden)

### Paso 0 — Arreglar el secret `SUPABASE_DB_URL`
Ver "Bloqueo actual". Confirmar con una corrida verde de la prueba de recuperación.
→ Esto desbloquea: backup diario + recuperación + aplicar migraciones.

### Paso 1 — Aplicar las 4 migraciones a producción
Método sancionado del proyecto (CLAUDE.md), corrido en local con `SUPABASE_ACCESS_TOKEN` en `.env.local`:
```bash
npx supabase db push          # revisar el diff que muestra antes de confirmar
```
Migraciones que aplica (additivas, validadas en local):
- `20260702000001_audit_trazabilidad_srt.sql` — ⚠️ **la de mayor riesgo**: reescribe el trigger de
  auditoría de ~18 tablas. Tras aplicar, **probar una escritura real** (crear/editar una empresa)
  para confirmar que el trigger no rompe nada. Si algo falla, hay rollback documentado abajo.
- `20260704000001_exports_bucket.sql` — bucket privado de exports (bajo riesgo).
- `20260705000001_autocontrol_check_constraints.sql` — CHECK `NOT VALID` (bajo riesgo).
- `20260705000002_autocontrol_inconsistencias_y_supervision.sql` — tablas/funciones nuevas (bajo riesgo).

**Verificación post-aplicación:**
```sql
SELECT * FROM public.fn_verify_audit_chain(NULL);          -- cadena íntegra
SELECT count(*) FROM public.audit_chain_state;             -- existe
-- crear/editar una empresa de prueba y confirmar fila en audit_log
```

### Paso 2 — Desplegar la app (merge → deploy)
**Solo DESPUÉS del Paso 1** (las pantallas nuevas dependen de las migraciones).
```bash
# PR de feat/srt-48-2025-compliance → master, revisar, y mergear.
# Vercel deploya master automáticamente.
```
Smoke test post-deploy: abrir `/dashboard/cumplimiento`, probar un export, confirmar `/api/health`.

### Paso 3 — Aplicar los 3 fixes de RLS (Prompt 4)
Están en `docs/migraciones-preparadas/`. Aplicar **de a uno**, probando el flujo que cada uno toca:
1. `03_verificacion_tokens_update_scoped.sql` — el más seguro (cierra hueco cross-tenant del QR). Aplicar primero.
2. `01_personas_directorio_insert_estricto.sql` — probar onboarding de colaboradores después.
3. `02_revocar_sesiones_al_cambiar_email_o_password.sql` — avisa que desloguea otros dispositivos.

### Paso 4 — Cerrar evidencia
Re-correr la prueba de recuperación (ahora con secret OK) → log limpio → es la evidencia "oficial"
sin la contraseña vieja. Reemplaza la referencia a la corrida #2 en `docs/evidencia-recuperacion-*.md`.

---

## Rollback (si la migración del audit log rompe escrituras en prod)
```sql
-- Desactivar los triggers de auditoría en las tablas afectadas (escrituras vuelven a funcionar):
-- por cada tabla: ALTER TABLE public.<tabla> DISABLE TRIGGER audit_<tabla>;
-- o restaurar fn_audit_trigger a la versión previa (migración 20260608000001).
```
La migración es additiva (no borra datos), así que el rollback es desactivar triggers, no perder nada.

---

## Quién hace qué
- **Vos:** Paso 0 (arreglar el secret — sólo vos tenés la contraseña). Autorizar/supervisar Pasos 1–3 (son producción).
- **Yo:** puedo guiar/ejecutar los Pasos 1–4 con vos presente (el `db push` necesita el token de
  `.env.local`, que no toco solo). Una vez desbloqueado el secret, esto son ~30–45 min con supervisión.
