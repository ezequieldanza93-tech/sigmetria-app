# Runbook de recuperación — Sigmetría HyS

> Procedimiento repetible para restaurar la base de datos y el Storage desde el
> backup externo (R2/B2). Pensado para ejecutarse ante pérdida de datos,
> corrupción, o como **prueba de recuperación periódica**.
>
> **Estado de la prueba real (track DB):** ✅ **EJECUTADA end-to-end localmente** (2026-06-11) con
> Docker + Supabase local + MinIO (stand-in S3-compatible de R2). Resultado: backup → AES-256 →
> upload S3 → download (SHA-256 idéntico) → descifrado → **checksums del manifest TODOS COINCIDEN**
> → restore en DB fresca → **180 tablas + datos recuperados**. Evidencia en `docs/validacion_en_vivo.md`.
>
> **Track Storage incremental (refactor 2026):** la lógica de cálculo del delta tiene **tests
> unitarios** (`tests/storage-delta.test.ts`) y el **espejo/delta real** (`s3api list-objects-v2` +
> `aws s3 cp`) **YA fue validado en vivo en CI** (run 27368489932, 2026-06-11): inventario de 22
> buckets / 55 objetos / 31,29 MiB y `Δ Delta: 0 de 55` (incremental demostrado). Evidencia:
> `docs/evidencia-recuperacion-2026-06-11.md`. **Pendiente honesto:** la **recuperación
> end-to-end del Storage** (re-upload de objetos al Supabase destino, Paso 3b) sigue siendo
> **manual y no ejecutada** — lo verificado es el delta/espejo, no el re-poblado.

---

## Qué se restaura

El backup tiene **dos tracks** con orígenes distintos en R2:

| Componente | Origen en R2 | Restaurable hoy |
|------------|--------------|-----------------|
| Schema (DDL) | bundle `db/daily/<fecha>/…tar.enc` → `db/schema.sql` | ✅ vía `psql` |
| Datos (filas) | bundle → `db/data.sql` | ✅ vía `psql` |
| Roles | bundle → `db/roles.sql` | ✅ best-effort |
| Fallback JSON | bundle → `db-json/*.json` | referencia/inspección |
| Storage (objetos) | **espejo** `storage/<bucket>/<path>` (sin cifrar) | ⚠️ manual (re-upload, ver Paso 3) |

El **bundle de la DB** se distribuye cifrado como `backup-<timestamp>.tar.enc`
(AES-256-CBC, PBKDF2) y contiene **solo la DB**. El **Storage** NO está en el
bundle: vive **espejado sin cifrar** en R2 bajo `storage/`, protegido por el
cifrado en reposo de R2 (AES-256) y TLS en tránsito (ver `docs/almacenamiento.md`
§2.2 para la justificación de esta postura).

---

## Prerrequisitos

- `openssl`, `tar`, `psql` (cliente Postgres), `aws` CLI, `node`.
- La clave de cifrado en `BACKUP_ENCRYPTION_KEY` (la misma con la que se cifró).
- Credenciales del bucket R2/B2 (`S3_*`, `AWS_*`) para descargar.
- Un **Postgres objetivo** en `RESTORE_DB_URL` (staging o local — NUNCA prod).

---

## Paso 1 — Descargar el bundle desde R2/B2

```bash
# Listar bundles diarios de la DB disponibles
aws s3 ls "s3://$S3_BUCKET/db/daily/" --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION"

# Descargar el bundle elegido + su manifest
DATE=2026-06-11                       # ajustar a la fecha deseada
aws s3 cp "s3://$S3_BUCKET/db/daily/$DATE/backup-<timestamp>.tar.enc" ./backups/ \
  --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION"
aws s3 cp "s3://$S3_BUCKET/db/daily/$DATE/manifest.json" ./backups/ \
  --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION"
```

El bundle de la DB es chico (datos tabulares): la descarga es rápida (segundos a
1–2 min). El Storage no se descarga acá — se recupera por separado (Paso 3).

---

## Paso 2 — Descifrar + restaurar + verificar (un solo comando)

El script `scripts/restore-dry-run.sh` hace descifrado → desempaquetado →
restore (roles, schema, data) → verificación de integridad (conteo de filas +
cross-check de checksums contra el manifest).

```bash
RESTORE_DB_URL="postgres://postgres:[PWD]@localhost:5432/sigmetria_restore" \
BACKUP_ENCRYPTION_KEY="<la-misma-clave-del-backup>" \
bash scripts/restore-dry-run.sh ./backups/backup-<timestamp>.tar.enc
```

**Guard anti-producción:** el script aborta si `RESTORE_DB_URL` contiene el ref
de prod (`lslzhgmoaxgkcjeweqaz`) o la palabra `prod`. Para forzar (no
recomendado): anteponer `CONFIRM=yes`.

Tiempo estimado: 2–10 min según volumen de datos.

### Qué valida la verificación

1. **Conteo de filas por tabla** (`SELECT count(*)`) — imprime un total global.
2. **Checksums SHA-256** de cada archivo del bundle contra los del `manifest.json`
   (detecta corrupción o manipulación del bundle).

Una restauración correcta termina con `✅ Restauración + verificación completas`.

---

## Paso 3 — Restaurar Storage (desde el espejo de R2)

El Storage **no** viene en el bundle de la DB: vive espejado en R2 bajo
`storage/<bucket>/<path>`. Recuperarlo son dos sub-pasos:

**3a — Bajar el espejo de R2 a local** (egress de R2 = **$0**, a diferencia de
re-bajar de Supabase):

```bash
aws s3 sync "s3://$S3_BUCKET/storage/" ./storage-restore/ \
  --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION"
```

Queda `./storage-restore/<bucket>/<path...>` (un subdirectorio por bucket).

**3b — Re-subir al Supabase objetivo**, preservando bucket + path. Cada subdir de
primer nivel es el nombre del bucket; el resto del path es la key dentro del
bucket. Con la Supabase CLI / SDK (o el dashboard), por bucket:

```bash
# Esquema (pseudo): por cada bucket, subir cada archivo con su key relativa.
# for f in $(find ./storage-restore/<bucket> -type f); do
#   key="${f#./storage-restore/<bucket>/}"
#   # supabase storage cp $f  ->  bucket=<bucket> path=$key
# done
```

`storage/manifest.json` (en R2) lista el total de objetos/bytes y la última sync;
sirve para verificar que el re-poblado quedó completo. (Automatización del
re-upload: ver "Pendiente".)

---

## Validación final (checklist)

- [ ] El descifrado no arrojó error de clave/corrupción.
- [ ] `schema.sql` y `data.sql` se aplicaron sin `ON_ERROR_STOP`.
- [ ] El conteo total de filas es coherente con el sistema en producción.
- [ ] Todos los checksums del manifest coinciden.
- [ ] (Si aplica) los objetos de Storage se re-subieron y se sirven.

---

## Estado y pendientes

- **Restauración end-to-end del track DB**: ✅ **ejecutada localmente** (Docker + Supabase local +
  MinIO) — ver `docs/validacion_en_vivo.md`. La cadena completa (cifrado → S3 round-trip →
  descifrado → verificación de checksums → restore → conteo de filas) funcionó.
- **Track Storage incremental**: la lógica del delta tiene tests unitarios y el espejo real
  (`s3api list-objects-v2` + `aws s3 cp`) **YA fue validado en vivo en CI** (run 27368489932,
  2026-06-11). **PENDIENTE real:** la **recuperación end-to-end** del Storage (re-upload al
  Supabase destino, Paso 3b) sigue siendo **manual y no ejecutada** — lo verificado es el espejo/
  delta, no el re-poblado.
- **Recuperación de DB**: ✅ **probada end-to-end en CI** (run 27368489932). Queda como buena
  práctica repetirla periódicamente como prueba de recuperación archivando cada log.
- **Re-upload automatizado de Storage**: script que recorra el espejo `storage/` de R2
  (`aws s3 sync`) y re-suba cada objeto al Supabase destino preservando bucket+path (hoy es manual).
- **PITR (point-in-time recovery)**: requiere Supabase Pro — ver `docs/almacenamiento.md`.
