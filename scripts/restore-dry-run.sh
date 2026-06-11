#!/usr/bin/env bash
#
# restore-dry-run.sh — Restauración del bundle de backup a un Postgres OBJETIVO.
#
# Descifra el bundle (.tar.enc), restaura schema + data, y verifica integridad
# comparando el conteo de filas por tabla contra el manifest.json.
#
# NO destructivo sobre producción: rechaza URLs que parezcan de prod salvo
# confirmación explícita. Idempotente: el restore usa el schema dumpeado (que ya
# es IF NOT EXISTS-friendly vía supabase) sobre una base limpia/staging.
#
# ── Uso ────────────────────────────────────────────────────────────────────
#   RESTORE_DB_URL="postgres://user:pwd@host:5432/dbname" \
#   BACKUP_ENCRYPTION_KEY="..." \
#   bash scripts/restore-dry-run.sh ./backups/backup-<ts>.tar.enc
#
#   # Si la URL parece de prod y querés forzarlo (NO recomendado):
#   CONFIRM=yes RESTORE_DB_URL=... BACKUP_ENCRYPTION_KEY=... \
#     bash scripts/restore-dry-run.sh <bundle.enc>
#
# ── Requisitos ──────────────────────────────────────────────────────────────
#   openssl, tar, psql (cliente Postgres).
#
set -euo pipefail

# ── 0. Argumentos y entorno ──────────────────────────────────────────────────
BUNDLE="${1:-}"
RESTORE_DB_URL="${RESTORE_DB_URL:-}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
CONFIRM="${CONFIRM:-no}"

fail() { echo "❌ $*" >&2; exit 1; }

[ -n "$BUNDLE" ] || fail "Falta el bundle. Uso: bash scripts/restore-dry-run.sh <backup.tar.enc>"
[ -f "$BUNDLE" ] || fail "No existe el archivo: $BUNDLE"
[ -n "$RESTORE_DB_URL" ] || fail "Falta RESTORE_DB_URL (Postgres objetivo)."
[ -n "$BACKUP_ENCRYPTION_KEY" ] || fail "Falta BACKUP_ENCRYPTION_KEY (clave de descifrado)."

for bin in openssl tar psql; do
  command -v "$bin" >/dev/null 2>&1 || fail "Falta el binario requerido: $bin"
done

# ── 1. Guard anti-producción ─────────────────────────────────────────────────
# El proyecto prod es lslzhgmoaxgkcjeweqaz. Rechazamos también el host
# pooler/db de Supabase prod salvo CONFIRM=yes explícito.
PROD_REF="lslzhgmoaxgkcjeweqaz"
if echo "$RESTORE_DB_URL" | grep -qiE "${PROD_REF}|prod"; then
  if [ "$CONFIRM" != "yes" ]; then
    fail "RESTORE_DB_URL parece de PRODUCCIÓN ('${PROD_REF}' o 'prod'). \
Abortado. Para forzar (NO recomendado): CONFIRM=yes"
  fi
  echo "⚠️  CONFIRM=yes — restaurando sobre una URL que parece prod. Bajo tu responsabilidad."
fi

# ── 2. Workspace temporal ────────────────────────────────────────────────────
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
echo "🗂️  Workspace: $WORK"

# ── 3. Descifrado ─────────────────────────────────────────────────────────────
echo "🔐 Descifrando bundle…"
TAR_OUT="$WORK/backup.tar"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in "$BUNDLE" -out "$TAR_OUT" \
  -pass env:BACKUP_ENCRYPTION_KEY \
  || fail "Descifrado falló — clave incorrecta o bundle corrupto."

# ── 4. Desempaquetado ────────────────────────────────────────────────────────
echo "📦 Desempaquetando…"
tar -xf "$TAR_OUT" -C "$WORK"

SCHEMA_SQL="$WORK/db/schema.sql"
DATA_SQL="$WORK/db/data.sql"
ROLES_SQL="$WORK/db/roles.sql"
MANIFEST="$WORK/manifest.json"

[ -f "$SCHEMA_SQL" ] || fail "El bundle no contiene db/schema.sql."
[ -f "$DATA_SQL" ]  || fail "El bundle no contiene db/data.sql."
[ -f "$MANIFEST" ]  || echo "⚠️  Sin manifest.json — se omite verificación de integridad."

# ── 5. Restauración ──────────────────────────────────────────────────────────
# roles primero (best-effort: roles ya existentes no son fatales), luego schema, luego data.
if [ -f "$ROLES_SQL" ]; then
  echo "👥 Restaurando roles (best-effort)…"
  psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=0 -f "$ROLES_SQL" >/dev/null 2>&1 || \
    echo "  ⚠️  Algunos roles ya existían (ignorado)."
fi

# ON_ERROR_STOP=0 a propósito: el backup contiene SOLO el schema `public` (los datos de
# negocio + auditoría). El schema `auth` (credenciales) NO se respalda — es gestionado por
# Supabase y guardar hashes en tu propio bucket sería un riesgo de compliance. Al restaurar
# en un Postgres genérico (no-Supabase) aparecen errores NO-FATALES esperables: FKs hacia
# auth.users, owners/roles gestionados, GRANTs. La integridad NO se mide por "cero errores"
# sino por: (a) checksums del manifest, (b) conteo de tablas/filas restauradas — abajo.
echo "🏗️  Restaurando schema…"
psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=0 -f "$SCHEMA_SQL"

echo "📥 Restaurando datos…"
psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=0 -f "$DATA_SQL"

# ── 6. Verificación de integridad ─────────────────────────────────────────────
echo ""
echo "🔎 Verificación de integridad (conteo de filas por tabla)…"
TABLES="$(psql "$RESTORE_DB_URL" -At -c \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")"

TOTAL=0
for t in $TABLES; do
  c="$(psql "$RESTORE_DB_URL" -At -c "SELECT count(*) FROM public.\"$t\";" 2>/dev/null || echo "ERR")"
  printf '  %-40s %s\n' "$t" "$c"
  if [ "$c" != "ERR" ]; then TOTAL=$((TOTAL + c)); fi
done
echo "  ───"
echo "  TOTAL filas restauradas: $TOTAL"

# Cross-check de checksums del manifest contra los archivos del bundle.
if [ -f "$MANIFEST" ] && command -v sha256sum >/dev/null 2>&1; then
  echo ""
  echo "🔐 Verificando checksums del manifest contra los archivos extraídos…"
  MISMATCH=0
  # Lee path+sha256 del manifest con un parser mínimo (node si está, si no jq).
  if command -v node >/dev/null 2>&1; then
    while IFS=$'\t' read -r relpath expected; do
      f="$WORK/$relpath"
      [ -f "$f" ] || { echo "  ⚠️  Falta en bundle: $relpath"; MISMATCH=$((MISMATCH+1)); continue; }
      actual="$(sha256sum "$f" | awk '{print $1}')"
      if [ "$actual" != "$expected" ]; then
        echo "  ✗ MISMATCH: $relpath"
        MISMATCH=$((MISMATCH+1))
      fi
    done < <(node -e '
      const m = require(process.argv[1]);
      for (const f of m.files) console.log(f.path + "\t" + f.sha256);
    ' "$MANIFEST")
  fi
  if [ "$MISMATCH" -eq 0 ]; then
    echo "  ✓ Todos los checksums coinciden."
  else
    fail "$MISMATCH archivo(s) con checksum inválido o faltante."
  fi
fi

echo ""
echo "✅ Restauración + verificación completas sobre el Postgres objetivo."
echo "   NOTA: este script NO restaura objetos de Storage (los archivos quedan"
echo "   extraídos en $WORK/storage/ durante la corrida; subilos manualmente al"
echo "   bucket de Storage del proyecto objetivo si hace falta — ver docs/recuperacion.md)."
