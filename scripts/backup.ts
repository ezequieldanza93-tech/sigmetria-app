/**
 * Database backup helper.
 * Usage: npx tsx scripts/backup.ts [table1 table2 ...]
 *
 * If no tables specified, backs up all user-defined tables.
 * Output: ./backups/<timestamp>/
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const EXCLUDED_TABLES = new Set([
  '_prisma_migrations', 'schema_migrations', 'spatial_ref_sys',
  'geography_columns', 'geometry_columns',
])

async function getTables(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_tables' as any)
  if (error) {
    // Fallback: query information_schema
    const { data: tables } = await supabase
      .from('information_schema.tables' as any)
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE') as any

    if (tables) {
      return tables
        .map((t: any) => t.table_name)
        .filter((t: string) => !EXCLUDED_TABLES.has(t))
    }
    throw error
  }
  return (data as string[]).filter(t => !EXCLUDED_TABLES.has(t))
}

async function backup() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const tables = process.argv[2] ? process.argv.slice(2) : await getTables(supabase as any)

  // BACKUP_OUT_DIR permite al orquestador (backup-external.ts) redirigir la
  // salida a un subdirectorio del bundle en curso, en vez de crear su propio
  // timestamp. Si no está seteada, mantiene el comportamiento standalone.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = process.env.BACKUP_OUT_DIR
    ? process.env.BACKUP_OUT_DIR
    : path.join(__dirname, '..', 'backups', timestamp)
  fs.mkdirSync(dir, { recursive: true })

  console.log(`Backing up ${tables.length} tables to ${dir}`)

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      console.error(`  ✗ ${table}: ${error.message}`)
      continue
    }
    const filePath = path.join(dir, `${table}.json`)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    console.log(`  ✓ ${table}: ${data.length} rows`)
  }

  // Write summary
  const summary = tables.map(t => `${t}.json`).join('\n')
  fs.writeFileSync(path.join(dir, 'index.txt'), summary)

  console.log(`\n✅ Backup complete: ${dir}`)
}

backup().catch(console.error)
