/**
 * Backup de Storage (Supabase).
 *
 * Expone DOS modos de uso:
 *
 * 1. `listSupabaseObjects(supabase?)` — LISTA todos los objetos de todos los
 *    buckets ({ bucket, path, size }) SIN descargarlos. Es la base del espejo
 *    INCREMENTAL a R2 (backup-external.ts calcula el delta contra lo ya subido).
 *
 * 2. `backupStorage(outDir)` — descarga TODOS los objetos a disco
 *    (`./backups/<ts>/storage/<bucket>/<path>`). Uso histórico/standalone:
 *    snapshot local completo. NO lo usa el track incremental.
 *
 * Usage standalone:
 *   npx tsx scripts/backup-storage.ts [--out <dir>]   # descarga completa a disco
 *   npx tsx scripts/backup-storage.ts --list          # solo lista (stdout JSON)
 *
 * Variables de entorno requeridas (mismas que scripts/backup.ts):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (bypassa RLS — solo en backups server-side)
 *
 * Estrategia de descubrimiento de buckets:
 *   1. `supabase.storage.listBuckets()` (fuente de verdad real del proyecto).
 *   2. Si falla o devuelve vacío, fallback a la lista declarada en
 *      `lib/storage/buckets.ts` (BUCKET_IS_PUBLIC).
 *
 * Maneja la paginación de `list()` (Supabase pagina de a 100 por defecto) y
 * recorre recursivamente las "carpetas" (prefijos) de cada bucket.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { BUCKET_IS_PUBLIC } from '../lib/storage/buckets'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const LIST_PAGE_SIZE = 100

export interface FileEntry {
  bucket: string
  /** path relativo dentro del bucket (con prefijos) */
  path: string
  size: number
}

interface BucketSummary {
  bucket: string
  objects: number
  bytes: number
}

/** Crea el cliente Supabase con service_role (aborta si faltan credenciales). */
export function createStorageClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    )
    process.exit(1)
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })
}

/** Lista recursivamente todos los objetos bajo un prefijo, paginando. */
async function listAllObjects(
  supabase: SupabaseClient,
  bucket: string,
  prefix = '',
): Promise<FileEntry[]> {
  const results: FileEntry[] = []
  let offset = 0

  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) {
      console.error(`  ✗ list ${bucket}/${prefix}: ${error.message}`)
      break
    }
    if (!data || data.length === 0) break

    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name
      // Heurística Supabase: las "carpetas" no tienen `id` (ni metadata).
      const isFolder = item.id === null || item.id === undefined
      if (isFolder) {
        const nested = await listAllObjects(supabase, bucket, itemPath)
        results.push(...nested)
      } else {
        const size = (item.metadata?.size as number | undefined) ?? 0
        results.push({ bucket, path: itemPath, size })
      }
    }

    if (data.length < LIST_PAGE_SIZE) break
    offset += LIST_PAGE_SIZE
  }

  return results
}

/** Descubre los buckets reales del proyecto, con fallback a la lista declarada. */
async function discoverBuckets(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.storage.listBuckets()
  if (error || !data || data.length === 0) {
    if (error) console.warn(`  ⚠ listBuckets() falló (${error.message}), usando lista declarada`)
    return Object.keys(BUCKET_IS_PUBLIC)
  }
  return data.map((b) => b.name)
}

/**
 * LISTA todos los objetos de todos los buckets de Supabase Storage SIN
 * descargarlos. Base del espejo incremental: el orquestador compara este set
 * contra lo ya presente en R2 y baja/sube SOLO el delta.
 */
export async function listSupabaseObjects(
  supabase: SupabaseClient = createStorageClient(),
): Promise<FileEntry[]> {
  const buckets = await discoverBuckets(supabase)
  console.log(`Descubiertos ${buckets.length} buckets: ${buckets.join(', ')}`)

  const all: FileEntry[] = []
  for (const bucket of buckets) {
    const objects = await listAllObjects(supabase, bucket)
    console.log(`  📦 ${bucket}: ${objects.length} objetos`)
    all.push(...objects)
  }
  return all
}

/**
 * Descarga COMPLETA a disco (uso standalone/histórico). El track incremental
 * NO usa esta función — usa `listSupabaseObjects` + `aws s3 cp` por objeto.
 */
export async function backupStorage(outDir: string): Promise<BucketSummary[]> {
  const supabase = createStorageClient()

  const buckets = await discoverBuckets(supabase)
  console.log(`Descubiertos ${buckets.length} buckets: ${buckets.join(', ')}`)

  const storageRoot = path.join(outDir, 'storage')
  fs.mkdirSync(storageRoot, { recursive: true })

  const summaries: BucketSummary[] = []

  for (const bucket of buckets) {
    console.log(`\n📦 Bucket: ${bucket}`)
    const objects = await listAllObjects(supabase, bucket)
    let bytes = 0
    let downloaded = 0

    for (const obj of objects) {
      const { data, error } = await supabase.storage.from(bucket).download(obj.path)
      if (error || !data) {
        console.error(`  ✗ ${obj.path}: ${error?.message ?? 'sin datos'}`)
        continue
      }
      const buffer = Buffer.from(await data.arrayBuffer())
      const dest = path.join(storageRoot, bucket, obj.path)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, buffer)
      bytes += buffer.byteLength
      downloaded++
    }

    console.log(`  ✓ ${downloaded}/${objects.length} objetos, ${(bytes / 1024).toFixed(1)} KiB`)
    summaries.push({ bucket, objects: downloaded, bytes })
  }

  const summaryPath = path.join(storageRoot, 'storage-summary.json')
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), buckets: summaries },
      null,
      2,
    ),
  )

  const totalObjects = summaries.reduce((a, s) => a + s.objects, 0)
  const totalBytes = summaries.reduce((a, s) => a + s.bytes, 0)
  console.log(
    `\n✅ Storage backup completo: ${totalObjects} objetos, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB → ${storageRoot}`,
  )

  return summaries
}

// Ejecución directa (no cuando se importa desde backup-external.ts).
const isMain =
  process.argv[1] && /backup-storage\.ts$/.test(process.argv[1].replace(/\\/g, '/'))

if (isMain) {
  if (process.argv.includes('--list')) {
    // Modo lista: imprime el inventario de Supabase como JSON (debug/inspección).
    listSupabaseObjects()
      .then((objects) => {
        const bytes = objects.reduce((a, o) => a + o.size, 0)
        console.log(
          `\n📋 ${objects.length} objetos, ${(bytes / 1024 / 1024).toFixed(2)} MiB`,
        )
        console.log(JSON.stringify(objects, null, 2))
      })
      .catch((e) => {
        console.error(e)
        process.exit(1)
      })
  } else {
    const outFlagIdx = process.argv.indexOf('--out')
    const outDir =
      outFlagIdx !== -1 && process.argv[outFlagIdx + 1]
        ? process.argv[outFlagIdx + 1]
        : path.join(
            __dirname,
            '..',
            'backups',
            new Date().toISOString().replace(/[:.]/g, '-'),
          )

    backupStorage(outDir).catch((e) => {
      console.error(e)
      process.exit(1)
    })
  }
}
