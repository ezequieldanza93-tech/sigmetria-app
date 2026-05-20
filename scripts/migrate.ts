/**
 * Migration helper utilities.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts status     # Show migration status
 *   npx tsx scripts/migrate.ts list       # List all migration files
 */

import * as fs from 'fs'
import * as path from 'path'

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')

function listMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('Migrations directory not found:', MIGRATIONS_DIR)
    process.exit(1)
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`\n📋 Migrations (${files.length} total):\n`)
  
  const applied: string[] = []
  const pending: string[] = []
  
  // Check if .temp directory has applied migration info
  const tempDir = path.join(__dirname, '..', 'supabase', '.temp')
  const localStatePath = path.join(tempDir, 'migration-state.json')
  
  if (fs.existsSync(localStatePath)) {
    const state = JSON.parse(fs.readFileSync(localStatePath, 'utf-8'))
    const appliedSet = new Set(state.applied ?? [])
    
    for (const f of files) {
      if (appliedSet.has(f)) applied.push(f)
      else pending.push(f)
    }
    
    if (applied.length > 0) {
      console.log('✅ Applied:')
      applied.forEach(f => console.log(`   ${f}`))
      console.log()
    }
    
    if (pending.length > 0) {
      console.log('⏳ Pending:')
      pending.forEach(f => console.log(`   ${f}`))
      console.log()
    }
  } else {
    console.log('   (no local state found — showing all files)\n')
    files.forEach(f => console.log(`   ${f}`))
  }

  // Show summary by date
  const byDate = new Map<string, number>()
  for (const f of files) {
    const dateMatch = f.match(/^(\d{8})/)
    if (dateMatch) {
      const date = dateMatch[1]
      byDate.set(date, (byDate.get(date) ?? 0) + 1)
    }
  }

  console.log('\n📊 By date:')
  for (const [date, count] of [...byDate.entries()].sort()) {
    const formatted = `${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`
    console.log(`   ${formatted}: ${count} migration${count > 1 ? 's' : ''}`)
  }
}

function showStatus() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('Migrations directory not found')
    process.exit(1)
  }
  
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`\nMigration files: ${files.length}`)
  
  const latest = files[files.length - 1]
  const earliest = files[0]
  
  if (latest) {
    const latestDate = latest.slice(0, 8)
    const earliestDate = earliest.slice(0, 8)
    console.log(`   First: ${earliestDate}`)
    console.log(`   Latest: ${latestDate} (${latest})`)
  }

  // Check for gaps in sequence
  const nums = files
    .map(f => f.match(/^(\d{14})/)?.[1])
    .filter(Boolean) as string[]
  
  if (nums.length > 0) {
    nums.sort()
    const gaps = []
    for (let i = 1; i < nums.length; i++) {
      const prev = BigInt(nums[i - 1])
      const curr = BigInt(nums[i])
      if (curr - prev > BigInt(1)) {
        gaps.push({ from: nums[i - 1], to: nums[i] })
      }
    }
    if (gaps.length > 0) {
      console.log(`\n⚠️  Gap(s) detected:`)
      gaps.forEach(g => console.log(`   ${g.from} → ${g.to}`))
    }
  }

  console.log()
}

const command = process.argv[2] ?? 'list'

switch (command) {
  case 'list':
    listMigrations()
    break
  case 'status':
    showStatus()
    break
  default:
    console.log('Usage: npx tsx scripts/migrate.ts {list|status}')
    process.exit(1)
}
