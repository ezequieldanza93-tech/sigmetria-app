# Preguntas / decisiones pendientes — Corrida SRT 48/2025

> Lo que NO pude avanzar solo, en formato cerrado para destrabarlo en minutos cuando vuelvas.
> Nada de esto bloqueó al resto: los 5 prompts quedaron implementados y verificados
> (`docs/resumen_corrida.md`). Lo de acá requiere tu mano (credenciales, infra, o una decisión que
> toca plata / puede afectar usuarios reales).

---

## P1 — Aplicar las 4 migraciones aditivas (trazabilidad, exports, autocontrol)
No las apliqué a prod por la regla del modo autónomo (sin Docker no pude probarlas en vivo; un
trigger/constraint con bug podría cortar escrituras).

- **A) (recomendada)** Aplicar primero en **staging**, correr `docs/pruebas/prompt_1_*.sql`, y luego
  a prod con `npx supabase db push`. Es el camino seguro.
- **B)** Aplicar directo a prod (más rápido, más riesgo — no recomendado sin staging).

## P2 — Aplicar los 3 fixes de acceso preparados (`docs/migraciones-preparadas/`)
Pueden **cortarle el acceso a usuarios reales**, por eso quedaron sin aplicar.

- **A) (recomendada)** Revisar uno por uno y aplicar en staging con testeo dirigido del flujo que
  cada uno toca (onboarding de colaboradores / sesiones / QR), luego a prod.
- **B)** Aplicar solo el `03_verificacion_tokens_update_scoped.sql` ahora (cierra un hueco
  cross-tenant y el riesgo de romper acceso es bajo), y diferir el 01 y el 02.
- **C)** Diferir los tres hasta tener staging.

## P3 — Credenciales del backup externo (Cloudflare R2 / Backblaze B2)
Los scripts y la GitHub Action están listos; faltan las llaves (no las tengo).

- **A) (recomendada)** Crear un bucket en **R2** (sin egress fees) y cargar en GitHub Secrets:
  `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `BACKUP_ENCRYPTION_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `S3_REGION`. Después corré la Action manual (`workflow_dispatch`) para validar.
- **B)** Backblaze B2 (un poco más barato en storage) con las mismas vars.

## P4 — Prueba de recuperación real → ✅ YA EJECUTADA localmente
Se corrió la cadena completa end-to-end (Docker + Supabase local + MinIO como R2): backup →
AES-256 → S3 round-trip (SHA-256 idéntico) → descifrado → checksums OK → restore → 180 tablas +
datos. Evidencia en `docs/validacion_en_vivo.md`.
- **Pendiente (opcional, formal):** repetir contra un staging real con credenciales R2 reales y
  archivar el log como evidencia para el auditor. No requiere cambios de código.

## P5 — Upgrade a Supabase Pro (PITR)
Decisión de plata, ya conversada (quedaste en Free + backup externo). Lo dejo explícito por si querés
reconsiderar para el protocolo.

- **A) (recomendada, ya elegida)** Seguir en **Free** con el backup lógico externo cifrado diario.
  Suficiente para el estándar si la prueba de recuperación queda documentada.
- **B)** Upgrade a **Pro (~US$25/mes)**: habilita PITR 7 días + branching (permitiría restauración
  real sobre una branch efímera, cerrando P4 sin Docker).

## P6 — Vercel: frecuencia de los crons
`vercel.json` ahora agenda 7 crons **diarios** (límite del plan Hobby).

- **A) (recomendada)** Dejar diario: alcanza para vencimientos/alertas/inconsistencias.
- **B)** Vercel **Pro** si querés frecuencia sub-diaria (ej. alertas cada hora).

## P7 — `VALIDATE CONSTRAINT` de los CHECK del Prompt 5
Los CHECK se agregaron `NOT VALID` para no romper el `db push` con datos legacy.

- **A) (recomendada)** Tras aplicar la migración, correr una query de detección de filas que violen
  cada CHECK, limpiar/corregir, y recién entonces `ALTER TABLE ... VALIDATE CONSTRAINT ...`.
- **B)** Dejarlos `NOT VALID` (protegen solo cargas nuevas) — aceptable, documentado.
