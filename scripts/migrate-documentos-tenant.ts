/**
 * Migración de datos: re-pathea los objetos LEGACY del bucket `documentos` a
 * paths prefijados por tenant ({consultora_id}/...) y actualiza la columna DB
 * del valor (URL pública absoluta legacy) al PATH relativo nuevo.
 *
 * Por qué: para privatizar el bucket `documentos`, la RLS de lectura por tenant
 * exige que el primer segmento del path sea el consultora_id. Los 21 objetos
 * legacy tienen paths tenant-less (formularios/..., evidencias/..., etc.) y la
 * columna guarda una URL pública absoluta que dejaría de funcionar al privatizar.
 *
 * Qué hace, por cada fila legacy:
 *   1. Resuelve el consultora_id por la jerarquía de datos.
 *   2. move(oldPath -> {consultora_id}/{oldPath}) vía la API de Storage (service role).
 *   3. UPDATE de la columna al PATH relativo nuevo (no URL).
 *
 * SEGURO de re-correr (idempotente): salta valores que ya son path relativo, y si
 * el objeto ya está movido (source 404 + destino existe), igual sincroniza la DB.
 *
 * Uso:
 *   npx tsx scripts/migrate-documentos-tenant.ts --dry   # plan, NO toca nada
 *   npx tsx scripts/migrate-documentos-tenant.ts         # ejecuta
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (se leen de
 * process.env o, si faltan, de .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const DRY = process.argv.includes('--dry')
const BUCKET = 'documentos'
const MARKER = `/object/public/${BUCKET}/`

// ── Env (process.env o .env.local) ─────────────────────────────
function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (process.env / .env.local)')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

/** Extrae el path relativo (dentro del bucket) de una URL pública absoluta. */
function pathFromPublicUrl(value: string | null): string | null {
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) return null // ya es path relativo → no migrar
  const i = value.indexOf(MARKER)
  if (i === -1) return null
  return decodeURIComponent(value.substring(i + MARKER.length).split('?')[0])
}

/** Drill seguro por embeds anidados (to-one): toma objeto o primer elemento de array. */
function deep(obj: unknown, keys: string[]): string | null {
  let cur: unknown = obj
  for (const k of keys) {
    if (cur == null) return null
    if (Array.isArray(cur)) cur = cur[0]
    if (cur == null) return null
    cur = (cur as Record<string, unknown>)[k]
  }
  return typeof cur === 'string' ? cur : null
}

interface ColCfg {
  table: string
  urlColumn: string
  select: string
  cid: (row: Record<string, unknown>) => string | null
}

const COLUMNS: ColCfg[] = [
  {
    table: 'gestiones_registros',
    urlColumn: 'evidencia_url',
    select: 'id, evidencia_url, gestiones_establecimientos!inner(establecimientos!inner(empresas!inner(consultora_id)))',
    cid: (r) => deep(r.gestiones_establecimientos, ['establecimientos', 'empresas', 'consultora_id']),
  },
  {
    table: 'gestiones_observaciones',
    urlColumn: 'evidencia_cierre_url',
    select: 'id, evidencia_cierre_url, gestiones_registros!inner(gestiones_establecimientos!inner(establecimientos!inner(empresas!inner(consultora_id))))',
    cid: (r) => deep(r.gestiones_registros, ['gestiones_establecimientos', 'establecimientos', 'empresas', 'consultora_id']),
  },
  {
    table: 'gestiones_observaciones',
    urlColumn: 'foto_url',
    select: 'id, foto_url, gestiones_registros!inner(gestiones_establecimientos!inner(establecimientos!inner(empresas!inner(consultora_id))))',
    cid: (r) => deep(r.gestiones_registros, ['gestiones_establecimientos', 'establecimientos', 'empresas', 'consultora_id']),
  },
  {
    table: 'empresas_documentos',
    urlColumn: 'archivo_url',
    select: 'id, archivo_url, empresas!inner(consultora_id)',
    cid: (r) => deep(r.empresas, ['consultora_id']),
  },
  {
    table: 'observaciones_fotos_cliente',
    urlColumn: 'url',
    select: 'id, url, gestiones_observaciones!inner(gestiones_registros!inner(gestiones_establecimientos!inner(establecimientos!inner(empresas!inner(consultora_id)))))',
    cid: (r) => deep(r.gestiones_observaciones, ['gestiones_registros', 'gestiones_establecimientos', 'establecimientos', 'empresas', 'consultora_id']),
  },
]

async function objectExists(p: string): Promise<boolean> {
  const dir = p.includes('/') ? p.substring(0, p.lastIndexOf('/')) : ''
  const name = p.substring(p.lastIndexOf('/') + 1)
  const { data } = await sb.storage.from(BUCKET).list(dir, { search: name, limit: 100 })
  return !!data?.some((f) => f.name === name)
}

async function run(): Promise<void> {
  console.log(`\n=== Migración documentos → tenant path ${DRY ? '(DRY RUN)' : '(EJECUTANDO)'} ===\n`)
  let total = 0, moved = 0, dbUpdated = 0, skipped = 0, errors = 0

  for (const cfg of COLUMNS) {
    const { data, error } = await sb
      .from(cfg.table)
      .select(cfg.select)
      .like(cfg.urlColumn, `%${MARKER}%`)

    if (error) { console.error(`[${cfg.table}.${cfg.urlColumn}] query error:`, error.message); errors++; continue }
    const rows = (data ?? []) as Record<string, unknown>[]
    console.log(`\n--- ${cfg.table}.${cfg.urlColumn}: ${rows.length} fila(s) legacy ---`)

    for (const row of rows) {
      total++
      const id = row.id as string
      const value = row[cfg.urlColumn] as string | null
      const oldPath = pathFromPublicUrl(value)
      if (!oldPath) { console.log(`  · ${id}: valor no es URL pública de documentos, skip`); skipped++; continue }

      const consultoraId = cfg.cid(row)
      if (!consultoraId) { console.error(`  ✗ ${id}: NO se pudo resolver consultora_id — SE SALTA`); errors++; continue }

      const newPath = `${consultoraId}/${oldPath}`
      if (oldPath === newPath) { console.log(`  · ${id}: ya tenant-prefijado, skip`); skipped++; continue }

      console.log(`  → ${id}\n      old: ${oldPath}\n      new: ${newPath}`)
      if (DRY) continue

      // 1. Mover el objeto (si el source ya no está pero el destino sí, seguimos a la DB).
      const { error: moveErr } = await sb.storage.from(BUCKET).move(oldPath, newPath)
      if (moveErr) {
        const destOk = await objectExists(newPath)
        if (!destOk) { console.error(`  ✗ ${id}: move falló (${moveErr.message}) y el destino no existe — SE SALTA`); errors++; continue }
        console.log(`    (objeto ya estaba en destino, sincronizo DB)`)
      } else {
        moved++
      }

      // 2. Actualizar la DB al PATH relativo nuevo.
      const { error: updErr } = await sb.from(cfg.table).update({ [cfg.urlColumn]: newPath }).eq('id', id)
      if (updErr) { console.error(`  ✗ ${id}: objeto movido pero UPDATE falló: ${updErr.message}`); errors++; continue }
      dbUpdated++
    }
  }

  console.log(`\n=== Resumen: total=${total} movidos=${moved} db_actualizados=${dbUpdated} saltados=${skipped} errores=${errors} ===\n`)
  if (errors > 0) process.exitCode = 1
}

run().catch((e) => { console.error(e); process.exit(1) })
