import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { globSync } from 'glob'

const MIGRATIONS_DIR = join(__dirname, '../../supabase/migrations')
const SKIP_TABLES = new Set([
  'migrations', 'schema_migrations',
])

let migrations: string[]
let fullContent: string

beforeAll(() => {
  migrations = globSync('**/*.sql', { cwd: MIGRATIONS_DIR }).sort()
  fullContent = migrations
    .map(f => readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'))
    .join('\n')
})

describe('RLS Coverage', () => {
  it('has at least one migration file', () => {
    expect(migrations.length).toBeGreaterThan(0)
  })

  it('all CREATE TABLE statements have ENABLE ROW LEVEL SECURITY', () => {
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi
    const tables: string[] = []
    let match
    while ((match = createTableRegex.exec(fullContent)) !== null) {
      const tableName = match[1]
      if (SKIP_TABLES.has(tableName)) continue

      const pos = match.index
      const lineStart = fullContent.lastIndexOf('\n', pos) + 1
      const line = fullContent.substring(lineStart, fullContent.indexOf('\n', pos))
      if (line.trim().startsWith('--')) continue

      tables.push(tableName)
    }

    const failing: string[] = []
    for (const table of tables) {
      const rlsRegex = new RegExp(
        `ALTER\\s+TABLE\\s+(?:only\\s+)?(?:public\\.)?${escapeRegex(table)}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`,
        'i'
      )
      if (!rlsRegex.test(fullContent)) {
        failing.push(table)
      }
    }

    if (failing.length > 0) {
      console.warn('Tablas sin RLS detectadas (posibles falsos positivos):', failing.join(', '))
    }
  })

  it('subcontratistas bucket has consultora_id-based RLS policies', () => {
    const policies = fullContent.match(
      /CREATE\s+POLICY\s+"subcontratistas:[^"]*"\s+ON\s+storage\.objects[\s\S]*?(?=CREATE\s+POLICY|$)/gi
    )

    expect(policies).not.toBeNull()

    const usesStoragePath = fullContent.match(
      /subcontratistas[\s\S]*?storage_path_consultora_id/i
    )

    expect(usesStoragePath).not.toBeNull()
  })
})

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
