/**
 * Orquestador de BACKUP EXTERNO CIFRADO — DB + Storage → tar → AES-256 → R2/B2.
 *
 * Pipeline:
 *   1. Dump lógico de la DB con Supabase CLI (remoto, SIN Docker):
 *        - schema.sql   (`supabase db dump`)
 *        - data.sql     (`supabase db dump --data-only`)
 *        - roles.sql    (`supabase db dump --role-only`)
 *      Fallback adicional: scripts/backup.ts (JSON lógico de tablas public).
 *   2. Dump de Storage (scripts/backup-storage.ts) → ./backups/<ts>/storage/...
 *   3. manifest.json con timestamp, lista de archivos, tamaño y SHA-256 de cada
 *      uno, + versión de schema (última migración aplicada localmente).
 *   4. Empaqueta TODO en backup-<ts>.tar.
 *   5. Cifra a backup-<ts>.tar.enc con AES-256-CBC (openssl, clave en
 *      BACKUP_ENCRYPTION_KEY).
 *   6. Sube el .enc + manifest.json a S3-compatible (R2/B2) vía AWS CLI
 *      con prefijo por fecha (diario + mensual → ver docs/almacenamiento.md).
 *
 * Variables de entorno:
 *   DB dump (requerido para el dump SQL):
 *     SUPABASE_DB_URL          postgres://...  (connection string del proyecto)
 *   Storage + fallback JSON:
 *     NEXT_PUBLIC_SUPABASE_URL
 *     SUPABASE_SERVICE_ROLE_KEY
 *   Cifrado:
 *     BACKUP_ENCRYPTION_KEY    passphrase fuerte (32+ chars recomendado)
 *   Subida S3-compatible (R2/B2):
 *     S3_ENDPOINT              ej. https://<acct>.r2.cloudflarestorage.com
 *     S3_BUCKET                nombre del bucket
 *     S3_REGION                ej. auto (R2) | us-west-... (B2)
 *     AWS_ACCESS_KEY_ID
 *     AWS_SECRET_ACCESS_KEY
 *
 * Flags:
 *   --no-upload    corre el pipeline local (dump + tar + cifrado) sin subir a S3.
 *   --keep-tar     no borra el .tar intermedio sin cifrar (debug).
 */

import { spawnSync } from 'child_process'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { backupStorage } from './backup-storage'

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

/** Ejecuta un comando heredando stdio; si falla, aborta con mensaje claro. */
function run(cmd: string, args: string[], label: string): void {
  console.log(`\n▶ ${label}\n  $ ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (res.error) die(`${label}: no se pudo ejecutar "${cmd}" (${res.error.message})`)
  if (res.status !== 0) die(`${label}: salió con código ${res.status}`)
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

// ─── 1. DB dump (Supabase CLI remoto, sin Docker) ────────────────────────────

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

// ─── fallback: JSON lógico de tablas public ──────────────────────────────────

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

// ─── main ─────────────────────────────────────────────────────────────────

async function main() {
  const noUpload = process.argv.includes('--no-upload')
  const keepTar = process.argv.includes('--keep-tar')

  requireEnv(['BACKUP_ENCRYPTION_KEY'], 'Cifrado')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(ROOT, 'backups', timestamp)
  fs.mkdirSync(outDir, { recursive: true })

  console.log(`🗄️  Backup externo — ${timestamp}`)
  console.log(`   Directorio de trabajo: ${outDir}`)

  // 1. DB dump (3 archivos SQL).
  const dbFiles = dumpDatabase(outDir)
  dumpJsonFallback(outDir)

  // 2. Storage dump.
  await backupStorage(outDir)

  // 3. Manifest con checksums.
  const allFiles = walk(outDir, outDir).filter((f) => f !== 'manifest.json')
  const manifest = {
    timestamp,
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
  console.log(`\n📄 Manifest: ${manifest.files.length} archivos catalogados con SHA-256.`)

  // 4. Empaquetar en tar (tar viene en Windows 10+, macOS y Linux).
  const tarName = `backup-${timestamp}.tar`
  const tarPath = path.join(ROOT, 'backups', tarName)
  run('tar', ['-cf', tarPath, '-C', outDir, '.'], 'Empaquetado (tar)')

  // 5. Cifrar AES-256-CBC con openssl (clave por env, PBKDF2).
  const encName = `${tarName}.enc`
  const encPath = path.join(ROOT, 'backups', encName)
  run(
    'openssl',
    [
      'enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '100000',
      '-in', tarPath, '-out', encPath,
      '-pass', 'env:BACKUP_ENCRYPTION_KEY',
    ],
    'Cifrado (AES-256-CBC)',
  )
  const encSha = sha256(encPath)
  fs.writeFileSync(`${encPath}.sha256`, `${encSha}  ${encName}\n`)
  console.log(`🔐 Cifrado: ${encName} (SHA-256 ${encSha.slice(0, 16)}…)`)

  if (!keepTar) fs.rmSync(tarPath, { force: true })

  // 6. Subir a S3-compatible (R2/B2).
  if (noUpload) {
    console.log('\n⏭️  --no-upload: pipeline local completo. Bundle cifrado en:')
    console.log(`   ${encPath}`)
    return
  }

  requireEnv(
    ['S3_ENDPOINT', 'S3_BUCKET', 'S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    'Subida S3-compatible (R2/B2)',
  )

  const endpoint = process.env.S3_ENDPOINT!
  const bucket = process.env.S3_BUCKET!
  const region = process.env.S3_REGION!
  const date = timestamp.slice(0, 10) // YYYY-MM-DD
  const month = timestamp.slice(0, 7) // YYYY-MM
  // Prefijo por fecha: daily/ para retención 30d, monthly/ para 12m.
  // (la retención efectiva se aplica vía lifecycle del bucket — ver docs.)
  const dailyKey = `daily/${date}/${encName}`
  const monthlyKey = `monthly/${month}/${encName}`

  const awsEnv = { ...process.env, AWS_REGION: region }
  const cp = (key: string) =>
    run(
      'aws',
      ['s3', 'cp', encPath, `s3://${bucket}/${key}`, '--endpoint-url', endpoint, '--region', region],
      `Subida → s3://${bucket}/${key}`,
    )
  // Subo el bundle a daily/ y monthly/, y el manifest junto al daily.
  process.env.AWS_REGION = awsEnv.AWS_REGION
  cp(dailyKey)
  cp(monthlyKey)
  run(
    'aws',
    ['s3', 'cp', manifestPath, `s3://${bucket}/daily/${date}/manifest.json`, '--endpoint-url', endpoint, '--region', region],
    `Subida manifest → s3://${bucket}/daily/${date}/manifest.json`,
  )

  console.log(`\n✅ Backup externo subido. Bundle: ${encName}`)
  console.log(`   daily/${date}/  +  monthly/${month}/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
