/**
 * Orquestador de BACKUP EXTERNO — dos tracks SEPARADOS.
 *
 * ── Track 1: DB (cifrado, versionado diario) ─────────────────────────────────
 *   Dump lógico de la DB con Supabase CLI (remoto, SIN Docker):
 *     - db/schema.sql   (`supabase db dump`)
 *     - db/data.sql     (`supabase db dump --data-only`)
 *     - db/roles.sql    (`supabase db dump --role-only`)
 *     - db-json/*.json  (fallback JSON de tablas public, scripts/backup.ts)
 *   → tar SOLO con `db/` + `db-json/` + `manifest.json`
 *   → cifra AES-256-CBC (openssl, PBKDF2, clave BACKUP_ENCRYPTION_KEY)
 *   → sube a R2 `db/daily/<YYYY-MM-DD>/backup-<ts>.tar.enc` + `db/monthly/<YYYY-MM>/`.
 *   Es chico (datos tabulares) → versionarlo diario está perfecto.
 *
 * ── Track 2: Storage (espejo INCREMENTAL, sin cifrado client-side) ───────────
 *   Espeja los objetos de Supabase Storage a R2 bajo `storage/<bucket>/<path>`,
 *   subiendo SOLO los objetos que NO existen ya en R2 (o cuyo tamaño difiere):
 *     (a) lista las keys existentes en R2 bajo `storage/` (aws s3api list-objects-v2, paginado);
 *     (b) lista los objetos de Supabase (listSupabaseObjects, sin descargar);
 *     (c) calcula el delta (computeStorageDelta, lógica pura testeable);
 *     (d) por cada faltante: descarga de Supabase y sube a R2 con `aws s3 cp`.
 *   Nunca re-sube lo ya presente.
 *
 *   POSTURA DE CIFRADO: los objetos de Storage NO se cifran client-side. Van a
 *   un bucket R2 PRIVADO (cifrado en reposo AES-256 de R2 + TLS en tránsito).
 *   Cifrarlos client-side rompería la deduplicación incremental (cada corrida
 *   produciría bytes distintos por el salt/IV → re-subiría todo). La DB SÍ va
 *   cifrada client-side porque es lo probatorio/sensible y es chica.
 *
 *   Escribe `storage/manifest.json` en R2: total de objetos, total de bytes y
 *   fecha de última sync (evidencia para auditoría SRT 48/2025).
 *
 * Variables de entorno:
 *   DB dump (requerido para el dump SQL):
 *     SUPABASE_DB_URL          postgres://...  (connection string del proyecto)
 *   Storage + fallback JSON:
 *     NEXT_PUBLIC_SUPABASE_URL
 *     SUPABASE_SERVICE_ROLE_KEY
 *   Cifrado (solo DB):
 *     BACKUP_ENCRYPTION_KEY    passphrase fuerte (32+ chars recomendado)
 *   Subida S3-compatible (R2/B2):
 *     S3_ENDPOINT              ej. https://<acct>.r2.cloudflarestorage.com
 *     S3_BUCKET                nombre del bucket
 *     S3_REGION                ej. auto (R2) | us-west-... (B2)
 *     AWS_ACCESS_KEY_ID
 *     AWS_SECRET_ACCESS_KEY
 *
 * Flags:
 *   --no-upload    corre el dump + cifrado local del track DB sin subir nada a S3
 *                  (salta también el track de Storage, que requiere R2).
 *   --db-only      corre SOLO el track DB (dump + cifrado + upload), salta Storage.
 *   --keep-tar     no borra el .tar intermedio sin cifrar (debug).
 */

import { spawnSync } from 'child_process'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createStorageClient, listSupabaseObjects } from './backup-storage'
import {
  computeStorageDelta,
  parseListObjectsV2,
  storageKeyFor,
  type RemoteObject,
} from './storage-delta'

const ROOT = path.join(__dirname, '..')

// ─── helpers ────────────────────────────────────────────────────────────────

function die(msg: string): never {
  console.error(`\n❌ ${msg}`)
  process.exit(1)
}

function requireEnv(vars: string[], context: string): void {
  const missing = vars.filter((v) => !process.env[v])
  if (missing.length > 0) {
    die(
      `${context}: faltan variables de entorno requeridas:\n  ${missing.join('\n  ')}`,
    )
  }
}

/** Enmascara contraseñas de connection strings (ej. postgres://user:PWD@host) para no
 *  filtrarlas a los logs de CI. SEGURIDAD: nunca imprimir credenciales en claro. */
function maskSecrets(s: string): string {
  return s.replace(/([a-z][a-z+.-]*:\/\/[^\s:/@]+:)[^@\s]+(@)/gi, '$1***$2')
}

/** Ejecuta un comando heredando stdio; si falla, aborta con mensaje claro. */
function run(cmd: string, args: string[], label: string): void {
  console.log(`\n▶ ${label}\n  $ ${cmd} ${maskSecrets(args.join(' '))}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (res.error) die(`${label}: no se pudo ejecutar "${cmd}" (${res.error.message})`)
  if (res.status !== 0) die(`${label}: salió con código ${res.status}`)
}

/** Ejecuta un comando capturando stdout (para parsear). Aborta si falla. */
function runCapture(cmd: string, args: string[], label: string): string {
  const res = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (res.error) die(`${label}: no se pudo ejecutar "${cmd}" (${res.error.message})`)
  if (res.status !== 0) die(`${label}: salió con código ${res.status}\n${res.stderr}`)
  return res.stdout
}

function sha256(filePath: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

/** Lista recursiva de archivos (rutas relativas a `base`). */
function walk(dir: string, base: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(abs, base))
    else out.push(path.relative(base, abs))
  }
  return out
}

/** Última migración aplicada localmente = versión del schema dumpeado. */
function latestMigration(): string {
  const dir = path.join(ROOT, 'supabase', 'migrations')
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    return files[files.length - 1] ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// ─── Track 1: DB dump (Supabase CLI remoto, sin Docker) ──────────────────────

function dumpDatabase(outDir: string): string[] {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    die(
      'SUPABASE_DB_URL no está definida. El dump SQL no puede correr sin la ' +
        'connection string del proyecto.\n' +
        'Obtenela en Supabase → Project Settings → Database → Connection string (URI).\n' +
        'Ejemplo: export SUPABASE_DB_URL="postgres://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres"',
    )
  }

  const dbDir = path.join(outDir, 'db')
  fs.mkdirSync(dbDir, { recursive: true })

  const schemaOut = path.join(dbDir, 'schema.sql')
  const dataOut = path.join(dbDir, 'data.sql')
  const rolesOut = path.join(dbDir, 'roles.sql')

  // npx supabase CLI 2.105 dumpea contra DB remota sin necesitar Docker.
  run('npx', ['--yes', 'supabase', 'db', 'dump', '--db-url', dbUrl, '-f', schemaOut], 'DB dump (schema)')
  run('npx', ['--yes', 'supabase', 'db', 'dump', '--db-url', dbUrl, '--data-only', '-f', dataOut], 'DB dump (data)')
  run('npx', ['--yes', 'supabase', 'db', 'dump', '--db-url', dbUrl, '--role-only', '-f', rolesOut], 'DB dump (roles)')

  return ['db/schema.sql', 'db/data.sql', 'db/roles.sql']
}

/** fallback: JSON lógico de tablas public. */
function dumpJsonFallback(outDir: string): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('  ⚠ Sin credenciales REST → se omite el fallback JSON de tablas public.')
    return
  }
  console.log('\n▶ Fallback JSON (tablas public vía REST)')
  // backup.ts escribe a ./backups/<su-propio-timestamp>/. Lo apuntamos al dir actual.
  const res = spawnSync('npx', ['--yes', 'tsx', path.join('scripts', 'backup.ts')], {
    stdio: 'inherit',
    cwd: ROOT,
    shell: process.platform === 'win32',
    env: { ...process.env, BACKUP_OUT_DIR: path.join(outDir, 'db-json') },
  })
  if (res.status !== 0) console.warn('  ⚠ Fallback JSON falló (no bloqueante).')
}

/**
 * Track DB completo: dump → manifest → tar (solo db/ + db-json/) → cifrado.
 * Devuelve la ruta del bundle cifrado y la del manifest (para subirlos).
 */
function runDbTrack(
  outDir: string,
  timestamp: string,
  keepTar: boolean,
): { encPath: string; encName: string; manifestPath: string } {
  // 1. DB dump (3 archivos SQL) + fallback JSON.
  const dbFiles = dumpDatabase(outDir)
  dumpJsonFallback(outDir)

  // 2. Manifest con checksums (SOLO archivos de DB — Storage va por su propio track).
  const allFiles = walk(outDir, outDir).filter((f) => f !== 'manifest.json')
  const manifest = {
    timestamp,
    track: 'db',
    schemaVersion: latestMigration(),
    generatedAt: new Date().toISOString(),
    dbFiles,
    files: allFiles.map((rel) => {
      const abs = path.join(outDir, rel)
      return {
        path: rel.replace(/\\/g, '/'),
        bytes: fs.statSync(abs).size,
        sha256: sha256(abs),
      }
    }),
  }
  const manifestPath = path.join(outDir, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`\n📄 Manifest DB: ${manifest.files.length} archivos catalogados con SHA-256.`)

  // 3. Empaquetar SOLO el contenido de la DB (db/, db-json/, manifest.json) en tar.
  const tarName = `backup-${timestamp}.tar`
  const tarPath = path.join(ROOT, 'backups', tarName)
  run('tar', ['-cf', tarPath, '-C', outDir, '.'], 'Empaquetado DB (tar)')

  // 4. Cifrar AES-256-CBC con openssl (clave por env, PBKDF2).
  const encName = `${tarName}.enc`
  const encPath = path.join(ROOT, 'backups', encName)
  run(
    'openssl',
    [
      'enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '100000',
      '-in', tarPath, '-out', encPath,
      '-pass', 'env:BACKUP_ENCRYPTION_KEY',
    ],
    'Cifrado DB (AES-256-CBC)',
  )
  const encSha = sha256(encPath)
  fs.writeFileSync(`${encPath}.sha256`, `${encSha}  ${encName}\n`)
  console.log(`🔐 Cifrado DB: ${encName} (SHA-256 ${encSha.slice(0, 16)}…)`)

  if (!keepTar) fs.rmSync(tarPath, { force: true })

  return { encPath, encName, manifestPath }
}

// ─── S3 (R2/B2) helpers ──────────────────────────────────────────────────────

interface S3Config {
  endpoint: string
  bucket: string
  region: string
}

function s3Config(): S3Config {
  requireEnv(
    ['S3_ENDPOINT', 'S3_BUCKET', 'S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    'Subida S3-compatible (R2/B2)',
  )
  const cfg: S3Config = {
    endpoint: process.env.S3_ENDPOINT!,
    bucket: process.env.S3_BUCKET!,
    region: process.env.S3_REGION!,
  }
  // El AWS CLI lee AWS_REGION del entorno; lo fijamos por consistencia.
  process.env.AWS_REGION = cfg.region
  return cfg
}

function s3Cp(localPath: string, key: string, cfg: S3Config, label: string): void {
  run(
    'aws',
    ['s3', 'cp', localPath, `s3://${cfg.bucket}/${key}`, '--endpoint-url', cfg.endpoint, '--region', cfg.region],
    label,
  )
}

/** Sube el bundle cifrado de la DB a `db/daily/` + `db/monthly/` + el manifest. */
function uploadDbBundle(
  enc: { encPath: string; encName: string; manifestPath: string },
  timestamp: string,
  cfg: S3Config,
): void {
  const date = timestamp.slice(0, 10) // YYYY-MM-DD
  const month = timestamp.slice(0, 7) // YYYY-MM
  // Prefijo db/ separado del de Storage. daily/ (retención 30d) + monthly/ (12m).
  s3Cp(enc.encPath, `db/daily/${date}/${enc.encName}`, cfg, `Subida DB → s3://${cfg.bucket}/db/daily/${date}/`)
  s3Cp(enc.encPath, `db/monthly/${month}/${enc.encName}`, cfg, `Subida DB → s3://${cfg.bucket}/db/monthly/${month}/`)
  s3Cp(enc.manifestPath, `db/daily/${date}/manifest.json`, cfg, `Subida manifest DB → db/daily/${date}/`)
  console.log(`\n✅ Track DB subido. Bundle: ${enc.encName}`)
  console.log(`   db/daily/${date}/  +  db/monthly/${month}/`)
}

/**
 * Lista TODAS las keys existentes en R2 bajo el prefijo `storage/`, paginando
 * con `aws s3api list-objects-v2` (ContinuationToken). Devuelve { key, size }.
 */
function listRemoteStorageKeys(cfg: S3Config): RemoteObject[] {
  const pages: { Contents?: { Key?: string; Size?: number }[]; NextContinuationToken?: string }[] = []
  let token: string | undefined
  let pageNum = 0

  for (;;) {
    const args = [
      's3api', 'list-objects-v2',
      '--bucket', cfg.bucket,
      '--prefix', 'storage/',
      '--endpoint-url', cfg.endpoint,
      '--region', cfg.region,
      '--output', 'json',
    ]
    if (token) args.push('--starting-token', token)

    const out = runCapture('aws', args, `Listar R2 storage/ (página ${pageNum + 1})`)
    // s3api devuelve {} cuando no hay objetos bajo el prefijo.
    const parsed = out.trim() ? JSON.parse(out) : {}
    pages.push(parsed)
    pageNum++

    token = parsed.NextContinuationToken
    if (!token) break
  }

  const remote = parseListObjectsV2(pages)
  console.log(`  📋 R2 ya tiene ${remote.length} objetos bajo storage/`)
  return remote
}

/**
 * Track Storage incremental: lista R2 + lista Supabase → delta → por cada
 * faltante baja de Supabase a un temp y lo sube a R2. Actualiza el manifest.
 */
async function runStorageTrack(cfg: S3Config): Promise<void> {
  console.log('\n🗂️  Track Storage (espejo incremental → R2, sin cifrado client-side)')

  // (a) lo que ya hay en R2.
  const remote = listRemoteStorageKeys(cfg)

  // (b) lo que hay en Supabase (sin descargar).
  const supabase = createStorageClient()
  const source = await listSupabaseObjects(supabase)
  const totalObjects = source.length
  const totalBytes = source.reduce((a, o) => a + o.size, 0)

  // (c) delta: solo lo que falta en R2 o cambió de tamaño.
  const delta = computeStorageDelta(source, remote)
  console.log(
    `\n  Δ Delta: ${delta.length} de ${totalObjects} objetos a sincronizar ` +
      `(${totalObjects - delta.length} ya presentes, no se re-suben).`,
  )

  // (d) por cada faltante: descargar de Supabase → escribir a temp → aws s3 cp → R2.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-sync-'))
  let uploaded = 0
  let uploadedBytes = 0
  try {
    for (const obj of delta) {
      const { data, error } = await supabase.storage.from(obj.bucket).download(obj.path)
      if (error || !data) {
        console.error(`  ✗ ${obj.bucket}/${obj.path}: ${error?.message ?? 'sin datos'}`)
        continue
      }
      const buffer = Buffer.from(await data.arrayBuffer())
      const tmpFile = path.join(tmpDir, 'obj.bin')
      fs.writeFileSync(tmpFile, buffer)

      const key = storageKeyFor(obj.bucket, obj.path)
      s3Cp(tmpFile, key, cfg, `Sync → s3://${cfg.bucket}/${key}`)
      uploaded++
      uploadedBytes += buffer.byteLength
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }

  console.log(`\n  ✓ Sync Storage: ${uploaded}/${delta.length} objetos nuevos subidos (${(uploadedBytes / 1024 / 1024).toFixed(2)} MiB).`)

  // Manifest de Storage (evidencia): refleja el inventario actual de Supabase.
  const storageManifest = {
    generatedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    totalObjects,
    totalBytes,
    syncedThisRun: uploaded,
    syncedBytesThisRun: uploadedBytes,
  }
  const manifestTmp = path.join(os.tmpdir(), `storage-manifest-${Date.now()}.json`)
  fs.writeFileSync(manifestTmp, JSON.stringify(storageManifest, null, 2))
  s3Cp(manifestTmp, 'storage/manifest.json', cfg, 'Subida manifest Storage → storage/manifest.json')
  fs.rmSync(manifestTmp, { force: true })

  console.log(
    `\n✅ Track Storage sincronizado. Inventario: ${totalObjects} objetos, ` +
      `${(totalBytes / 1024 / 1024).toFixed(2)} MiB.`,
  )
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main() {
  const noUpload = process.argv.includes('--no-upload')
  const dbOnly = process.argv.includes('--db-only')
  const keepTar = process.argv.includes('--keep-tar')

  requireEnv(['BACKUP_ENCRYPTION_KEY'], 'Cifrado')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(ROOT, 'backups', timestamp)
  fs.mkdirSync(outDir, { recursive: true })

  console.log(`🗄️  Backup externo — ${timestamp}`)
  console.log(`   Directorio de trabajo: ${outDir}`)

  // ── Track 1: DB (siempre corre) ──
  const enc = runDbTrack(outDir, timestamp, keepTar)

  if (noUpload) {
    console.log('\n⏭️  --no-upload: track DB local completo (sin subir). Bundle cifrado en:')
    console.log(`   ${enc.encPath}`)
    console.log('   (El track de Storage requiere R2 y se saltea con --no-upload.)')
    return
  }

  const cfg = s3Config()
  uploadDbBundle(enc, timestamp, cfg)

  // ── Track 2: Storage incremental ──
  if (dbOnly) {
    console.log('\n⏭️  --db-only: se saltea el track de Storage.')
    return
  }
  await runStorageTrack(cfg)

  console.log('\n✅ Backup externo completo (DB cifrado + Storage espejado).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
