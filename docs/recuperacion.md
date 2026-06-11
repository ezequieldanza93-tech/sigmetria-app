# Runbook de recuperación — Sigmetría HyS

> Procedimiento repetible para restaurar la base de datos y el Storage desde el
> backup externo cifrado (R2/B2). Pensado para ejecutarse ante pérdida de datos,
> corrupción, o como **prueba de recuperación periódica**.
>
> **Estado de la prueba real:** ✅ **EJECUTADA end-to-end localmente** (2026-06-11) con Docker +
> Supabase local + MinIO (stand-in S3-compatible de R2). Resultado: backup → AES-256 → upload S3 →
> download (SHA-256 idéntico) → descifrado → **checksums del manifest TODOS COINCIDEN** → restore
> en DB fresca → **180 tablas + datos recuperados**. Evidencia completa en `docs/validacion_en_vivo.md`.
> Pendiente solo la corrida contra un **staging real** y con **credenciales R2 reales** (que se
> cargan en GitHub Secrets), no cambios de código.

---

## Qué se restaura

| Componente | Origen en el bundle | Restaurable hoy |
|------------|---------------------|-----------------|
| Schema (DDL) | `db/schema.sql` | ✅ vía `psql` |
| Datos (filas) | `db/data.sql` | ✅ vía `psql` |
| Roles | `db/roles.sql` | ✅ best-effort |
| Storage (objetos) | `storage/<bucket>/<path>` | ⚠️ manual (re-upload) |
| Fallback JSON | `db-json/*.json` | referencia/inspección |

El bundle se distribuye como `backup-<timestamp>.tar.enc` (AES-256-CBC, PBKDF2).

---

## Prerrequisitos

- `openssl`, `tar`, `psql` (cliente Postgres), `aws` CLI, `node`.
- La clave de cifrado en `BACKUP_ENCRYPTION_KEY` (la misma con la que se cifró).
- Credenciales del bucket R2/B2 (`S3_*`, `AWS_*`) para descargar.
- Un **Postgres objetivo** en `RESTORE_DB_URL` (staging o local — NUNCA prod).

---

## Paso 1 — Descargar el bundle desde R2/B2

```bash
# Listar backups diarios disponibles
aws s3 ls "s3://$S3_BUCKET/daily/" --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION"

# Descargar el bundle elegido + su manifest
DATE=2026-06-11                       # ajustar a la fecha deseada
aws s3 cp "s3://$S3_BUCKET/daily/$DATE/backup-<timestamp>.tar.enc" ./backups/ \
  --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION"
aws s3 cp "s3://$S3_BUCKET/daily/$DATE/manifest.json" ./backups/ \
  --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION"
```

Tiempo estimado: 1–5 min según el tamaño del Storage.

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

## Paso 3 — Restaurar Storage (manual)

El script extrae los objetos a `storage/<bucket>/<path>` en su workspace temporal.
Para repoblar el Storage del proyecto objetivo:

```bash
# Ejemplo con la Supabase CLI o el SDK; subir cada bucket preservando rutas.
# (Automatización del re-upload de Storage: ver "Pendiente".)
```

Mientras tanto, el dump de Storage queda como copia fiel de los binarios y puede
re-subirse a mano vía el dashboard de Supabase Storage o un script de `upload`.

---

## Validación final (checklist)

- [ ] El descifrado no arrojó error de clave/corrupción.
- [ ] `schema.sql` y `data.sql` se aplicaron sin `ON_ERROR_STOP`.
- [ ] El conteo total de filas es coherente con el sistema en producción.
- [ ] Todos los checksums del manifest coinciden.
- [ ] (Si aplica) los objetos de Storage se re-subieron y se sirven.

---

## Estado y pendientes

- **Restauración end-to-end**: ✅ **ejecutada localmente** (Docker + Supabase local + MinIO) — ver
  `docs/validacion_en_vivo.md`. La cadena completa (cifrado → S3 round-trip → descifrado →
  verificación de checksums → restore → conteo de filas) funcionó.
- **Pendiente**: repetir contra un **staging real** con **credenciales R2 reales** (cargadas por
  el usuario en GitHub Secrets) y archivar el log como evidencia formal. No requiere cambios de
  código — el mismo flujo corre en la GitHub Action diaria.
- **Re-upload automatizado de Storage**: script que recorra `storage/` y suba cada objeto al
  bucket correspondiente (hoy es manual).
- **PITR (point-in-time recovery)**: requiere Supabase Pro — ver `docs/almacenamiento.md`.
