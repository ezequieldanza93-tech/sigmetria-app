# Resumen de corrida autónoma — Estándares SRT 48/2025 (Bloque A)

> Corrida del 2026-06-11, modo autónomo (usuario ausente). Implementación de los 5 prompts del
> Bloque A para inscribir a Sigmetría como Prestador de Soluciones 4.0 (Res. SRT 48/2025 +
> Disp. 15/2026). Este documento describe el estado real de cada prompt y la evidencia.

## Verificación global (independiente, al cierre)

```
npx tsc --noEmit            → 0 errores
npx vitest run (suite full) → 29 archivos, 314 tests, 314 passed
```

**Validación EN VIVO (agregada después):** se instaló Docker y se levantó Supabase local. Las 4
migraciones nuevas se validaron contra un Postgres real → ver `docs/validacion_en_vivo.md`. La
prueba en vivo **encontró y corrigió 2 bugs reales** que los tests sin DB no detectaban:
1. El CHECK viejo de `accion` en `audit_log` rechazaba los eventos de acceso (LOGIN/EXPORT/QR) →
   habría roto todo el logging de accesos en prod. Corregido en `20260702000001`.
2. La migración de autocontrol referenciaba la tabla `documentos` (eliminada hace tiempo) →
   abortaba la migración entera. Corregido en `20260705000001`.
También surgió un hallazgo de DR: la cadena de migraciones **no es reproducible desde cero** (drift
de seeds/renames) → la recuperación debe hacerse desde dump lógico, no replayeando migraciones.

Restricciones de la corrida (ver `docs/decisiones.md`): **sin push a producción**, y las
correcciones que pueden cortar acceso a usuarios reales quedaron **preparadas, no aplicadas**.

---

## Estado por prompt

### Prompt 1 — Trazabilidad y cadena de custodia → **COMPLETADO** (aplicación a prod pendiente)
- Migración `supabase/migrations/20260702000001_audit_trazabilidad_srt.sql`: hash chain SHA-256
  por consultora, `trace_id`, `origen`, `actor_email`; `accion` ampliada a eventos de acceso;
  `audit_chain_state`; `fn_audit_trigger` reescrita; RPC `log_audit_event`; `fn_verify_audit_chain`;
  vistas forenses (`audit_trail`, `fn_audit_historial`, `fn_audit_por_trace`); **REVOKE** de
  escritura a todos los roles (incl. `service_role`); triggers en ~18 tablas (defensivo).
- Código: `lib/audit/{hash-chain,trace,log-event}.ts`. Evento **LOGIN** cableado en `login.ts`.
- **Evidencia**: `tests/audit-hash-chain.test.ts` → **13/13 passed**. Scripts SQL de prueba en
  `docs/pruebas/prompt_1_{inmutabilidad,trace,hashchain}.sql` (listos para staging).
- **Doc**: `docs/trazabilidad.md`.

### Prompt 2 — Almacenamiento, respaldo y disponibilidad → **VALIDADO end-to-end** (local)
- `scripts/backup-storage.ts` (descarga todos los buckets), `scripts/backup-external.ts`
  (DB dump vía `supabase db dump` + Storage + `manifest.json` con checksums SHA-256 + AES-256
  OpenSSL + subida R2/B2 vía AWS CLI), `.github/workflows/backup.yml` (diaria + manual),
  `scripts/restore-dry-run.sh` (con guard anti-prod), `app/api/health/route.ts`.
- **Docs**: `docs/almacenamiento.md`, `docs/recuperacion.md` (runbook).
- **✅ Prueba de recuperación EJECUTADA** (Docker + Supabase local + MinIO como R2): backup →
  AES-256 → S3 round-trip (SHA-256 idéntico) → descifrado → **checksums OK** → restore → **180
  tablas + datos recuperados**. Detalle: `docs/validacion_en_vivo.md`.
- **Pendiente**: repetir contra staging real + credenciales R2 reales (GitHub Secrets, las carga
  el usuario). PITR requiere upgrade a Supabase Pro (documentado, no contratado). `tsc` limpio.

### Prompt 3 — Portabilidad y exportación → **COMPLETADO** (migración a aplicar)
- Export ampliado a **21 entidades**, formatos **CSV + JSON + binarios originales** + `manifest.json`
  con checksums; export **parcial** (rango de fechas / tipo de entidad); entrega sync (descarga) o
  async (bucket privado `exports` + **signed URL** TTL 1h + email Resend); registro **EXPORT** en
  audit log; aislamiento multi-tenant. UI en `components/export/export-empresa-button.tsx`.
  Lógica testeable en `lib/export/`.
- Migración `supabase/migrations/20260704000001_exports_bucket.sql` (bucket privado, NO aplicada).
- **Evidencia**: `npx vitest run lib/export` → **41/41 passed** (incluye test de aislamiento A↔B).
- **Hallazgo**: el endpoint de export viejo estaba **roto** (nombres de tabla desactualizados por
  los renames) → corregido.
- **Doc**: `docs/portabilidad.md`.

### Prompt 4 — Perfiles, accesos y QR → **COMPLETADO** (3 fixes preparados-no-aplicados)
- Matriz rol × recurso × acción documentada y contrastada con la RLS real; **aislamiento entre
  empresas-cliente verificado correcto**. Bypass MFA de testing **gateado** (`ALLOW_MFA_TEST_BYPASS`,
  off por defecto/en prod). **QR_ACCESS** registrado en audit log (best-effort) en
  `app/verificar/[token]`. Datos personales: sin exposición indebida.
- **Evidencia**: `tests/viewer-readonly.test.ts` → **30/30** (viewers solo-lectura a nivel RLS).
- **Hallazgo**: divergencia cross-tenant en `verificacion_tokens` UPDATE/`regenerar_token`
  (un admin de A podía invalidar el QR de B) → fix preparado.
- **Fixes preparados (NO aplicados)** en `docs/migraciones-preparadas/`:
  `01_personas_directorio_insert_estricto.sql`, `02_revocar_sesiones_al_cambiar_email_o_password.sql`,
  `03_verificacion_tokens_update_scoped.sql`.
- **Doc**: `docs/accesos.md`.

### Prompt 5 — Autocontrol y alertas → **COMPLETADO** (migraciones a aplicar)
- Migración `20260705000001` (CHECK constraints `NOT VALID`) + `20260705000002`
  (`fn_detectar_inconsistencias` con 6 reglas en un solo lugar, `alertas_umbrales` seed 30/15/7,
  `alertas_emitidas_log`, `cron_jobs_log` de supervisión, vista `vw_estado_cumplimiento`).
- Alertas tempranas configurables + registro de emisión + email crítico agrupado hookeado a cron.
  Panel `app/(dashboard)/dashboard/cumplimiento`. **`vercel.json` ahora agenda 7 crons diarios**.
- **Evidencia**: `npx vitest run lib/alertas` → **10/10**; suite completa 314/314.
- **Hallazgos**: `generar_alertas_consultora` estaba **rota** (tabla `siniestros` renombrada) →
  corregida; `vercel.json` no agendaba ningún cron → agendados.
- **Doc**: `docs/autocontrol.md`.

---

## Migraciones entregadas (NO aplicadas — aplicar en staging primero)

| Archivo | Prompt | Tipo |
|---|---|---|
| `supabase/migrations/20260702000001_audit_trazabilidad_srt.sql` | 1 | aditiva |
| `supabase/migrations/20260704000001_exports_bucket.sql` | 3 | aditiva |
| `supabase/migrations/20260705000001_autocontrol_check_constraints.sql` | 5 | aditiva (CHECK NOT VALID) |
| `supabase/migrations/20260705000002_autocontrol_inconsistencias_y_supervision.sql` | 5 | aditiva |
| `docs/migraciones-preparadas/01,02,03_*.sql` | 4 | **preparadas, NO en el folder de migraciones** (pueden cortar acceso) |

## Cómo continuar (orden sugerido)
1. Revisar las 4 migraciones aditivas y aplicarlas **en staging**; correr `docs/pruebas/prompt_1_*.sql`.
2. Aplicar a producción tras validar en staging (`npx supabase db push`).
3. Cargar credenciales R2/B2 + Secrets en GitHub; correr la GitHub Action de backup; ejecutar el
   runbook de recuperación (`docs/recuperacion.md`) contra un objetivo de prueba.
4. Revisar y, con testeo dirigido, aplicar los 3 fixes de `docs/migraciones-preparadas/`.
5. Ver `docs/preguntas_pendientes.md` para las decisiones que requieren tu mano.

> Documentos insumo del Bloque B (protocolo + DDJJ): `docs/trazabilidad.md`, `docs/almacenamiento.md`,
> `docs/recuperacion.md`, `docs/portabilidad.md`, `docs/accesos.md`, `docs/autocontrol.md`.
