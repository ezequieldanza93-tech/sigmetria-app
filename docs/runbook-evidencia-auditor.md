# Runbook — Evidencia de recuperación para el auditor (R2 real)

> Objetivo: correr el ciclo backup→R2→restore→verificación contra credenciales REALES y dejar
> el log archivado como evidencia. Todo corre en GitHub Actions (Linux); vos solo creás el bucket
> y cargás los Secrets. **Ningún secreto pasa por el chat ni se commitea.**
>
> Tiempo estimado: ~15 min de setup + ~5 min de corrida.

---

## Paso 1 — Crear el bucket R2 + credenciales (Cloudflare)

1. Cloudflare dashboard → **R2** → **Create bucket** → nombre: `sigmetria-backups` (región: automática).
2. R2 → **Manage R2 API Tokens** → **Create API Token**:
   - Permisos: **Object Read & Write**.
   - Scope: el bucket `sigmetria-backups` (o "all buckets").
3. Anotá lo que te muestra (una sola vez):
   - **Access Key ID**
   - **Secret Access Key**
   - **Endpoint S3**: `https://<TU_ACCOUNT_ID>.r2.cloudflarestorage.com`

> (Si preferís Backblaze B2: creá un bucket + Application Key con S3 API; el endpoint es del estilo
> `https://s3.us-west-004.backblazeb2.com` y `S3_REGION` = `us-west-004`.)

## Paso 2 — Generar la clave de cifrado

En cualquier terminal:
```bash
openssl rand -base64 32
```
Guardá ese string — es tu `BACKUP_ENCRYPTION_KEY`. **Sin esta clave, los backups NO se pueden
descifrar.** Guardala también en tu gestor de contraseñas (si la perdés, los backups son basura).

## Paso 3 — Cargar los Secrets en GitHub

GitHub → repo `sigmetria-app` → **Settings → Secrets and variables → Actions → New repository secret**.
Creá estos 9:

| Secret | Valor |
|---|---|
| `SUPABASE_DB_URL` | Supabase → Settings → Database → **Connection string (URI, conexión directa, puerto 5432)**. Ej: `postgresql://postgres:[PWD]@db.lslzhgmoaxgkcjeweqaz.supabase.co:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lslzhgmoaxgkcjeweqaz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role key** |
| `BACKUP_ENCRYPTION_KEY` | el string del Paso 2 |
| `S3_ENDPOINT` | el endpoint del Paso 1 (`https://<account>.r2.cloudflarestorage.com`) |
| `S3_BUCKET` | `sigmetria-backups` |
| `S3_REGION` | `auto` (R2) · `us-west-004` (B2) |
| `AWS_ACCESS_KEY_ID` | Access Key ID del Paso 1 |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key del Paso 1 |

> **Sobre `SUPABASE_DB_URL`**: el dump es READ-ONLY (no toca nada). Apuntalo a **producción** para
> la evidencia más fuerte (datos reales). Si preferís no exponer la URL de prod en CI, apuntalo a un
> proyecto de **staging**. El restore SIEMPRE va a un Postgres efímero del runner, NUNCA a prod.

## Paso 4 — Correr la prueba de recuperación

GitHub → **Actions** → **"Prueba de recuperación (auditoría)"** → **Run workflow**.
Opcional: escribí una nota (ej. "evidencia auditoría SRT junio 2026"). **Run**.

El workflow hace, en CI:
1. Backup real (dump + Storage) → cifra AES-256 → **sube a R2**.
2. **Descarga el bundle desde R2** (prueba el round-trip real).
3. Restaura en un Postgres efímero + **verifica checksums del manifest** + cuenta tablas/filas.

## Paso 5 — Archivar la evidencia

1. Cuando termine (✅ verde), entrá a la corrida → sección **Artifacts** → descargá
   **`recovery-test-log-<N>`**.
2. Ese `.log` es la evidencia para el auditor: muestra fecha, commit, el upload/download de R2 con
   los hashes, los checksums coincidiendo, y el conteo de filas restauradas.
3. Pasámelo (o pegá su contenido) y te armo el documento formal de evidencia
   (`docs/evidencia-recuperacion-<fecha>.md`) listo para el protocolo.

## Bonus — Activar el backup diario automático

Con esos MISMOS 9 Secrets ya cargados, el workflow **`Backup externo`** (`.github/workflows/backup.yml`)
corre solo todos los días a las 04:00 UTC. No hay que hacer nada más. Configurá en R2 una regla de
**lifecycle** (retención: ej. 30 días en `daily/`, 365 en `monthly/`) desde la consola de Cloudflare.

---

## Notas

- Si el workflow falla en el Paso 1 con "faltan variables de entorno", revisá que los 9 Secrets
  estén con el nombre EXACTO de la tabla.
- Si falla la conexión al dump: verificá que `SUPABASE_DB_URL` use la **conexión directa (5432)**,
  no el pooler de transacciones (6543).
- El `auth` schema (credenciales) NO se respalda a propósito (no se guardan hashes en R2). Es
  gestionado por Supabase. La evidencia mide integridad por checksums + filas, no por "cero errores".
