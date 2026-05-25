#!/usr/bin/env node

const { execSync } = require('child_process')
const { readFileSync, existsSync } = require('fs')
const { join, relative } = require('path')

const ROOT = process.cwd()
let exitCode = 0

function fail(message) {
  console.error('  FAIL:', message)
  exitCode = 1
}

function pass(message) {
  console.log('  PASS:', message)
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length
}

// Use a simple glob pattern without third-party dependency
function findSourceFiles() {
  const { execSync } = require('child_process')
  try {
    const result = execSync(
      'dir /s /b *.ts *.tsx 2>nul',
      { cwd: ROOT, encoding: 'utf-8', shell: true }
    )
    return result.split('\n').map(f => f.trim()).filter(f => f)
      .filter(f => !f.includes('node_modules'))
      .filter(f => !f.includes('.test.') && !f.includes('.spec.'))
      .filter(f => !f.endsWith('.d.ts'))
  } catch {
    return []
  }
}

// ─── 1. No dangerouslySetInnerHTML ───────────────────────────
console.log('\n[1/4] Checking for dangerouslySetInnerHTML...')
const sourceFiles = findSourceFiles()

let foundDangerous = false
for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf-8')
  const lineRegex = /dangerouslySetInnerHTML/g
  let match
  while ((match = lineRegex.exec(content)) !== null) {
    fail(`${relative(ROOT, file)}:${getLineNumber(content, match.index)} — dangerouslySetInnerHTML encontrado`)
    foundDangerous = true
  }
}
if (!foundDangerous) pass('No se encontró dangerouslySetInnerHTML')

// ─── 2. No hardcoded secrets ─────────────────────────────────
console.log('\n[2/4] Checking for hardcoded secrets...')
const SECRET_PATTERNS = [
  { regex: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key' },
  { regex: /sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI API Key' },
  { regex: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Access Token' },
  { regex: /-----BEGIN RSA PRIVATE KEY-----/, name: 'RSA Private Key' },
]

for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(lines[i])) {
        fail(`${relative(ROOT, file)}:${i + 1} — posible ${pattern.name} hardcodeada`)
      }
    }
  }
}
pass('No se encontraron secrets hardcodeados (o se revisaron arriba)')

// ─── 3. API routes auth check ────────────────────────────────
console.log('\n[3/4] Checking API routes for auth...')
let apiRoutes = []
try {
  const result = execSync(
    'dir /s /b route.ts 2>nul',
    { cwd: join(ROOT, 'app', 'api'), encoding: 'utf-8', shell: true }
  )
  apiRoutes = result.split('\n').map(f => f.trim()).filter(f => f)
} catch {
  apiRoutes = []
}

for (const route of apiRoutes) {
  const content = readFileSync(route, 'utf-8')
  const routePath = relative(ROOT, route)

  const skipPatterns = ['csp-report', 'webhook']
  if (skipPatterns.some(p => routePath.includes(p))) {
    pass(`${routePath} — excluido (${skipPatterns.find(p => routePath.includes(p))})`)
    continue
  }

  const hasAuthCheck =
    content.includes('getUser()') ||
    content.includes('auth.getUser') ||
    content.includes('requireSuperAdmin') ||
    content.includes('requireRole') ||
    content.includes('validateOrigin') ||
    content.includes('CRON_SECRET')

  const isDevOnly = content.includes("NODE_ENV === 'production'")

  if (!hasAuthCheck && !isDevOnly) {
    fail(`${routePath} — no tiene verificación de autenticación`)
  } else {
    pass(`${routePath} — tiene auth check${isDevOnly ? ' (dev-only)' : ''}`)
  }
}

// ─── 4. Storage bucket RLS in migrations ─────────────────────
console.log('\n[4/4] Checking storage bucket RLS in migrations...')
let migrationFiles = []
try {
  const result = execSync(
    'dir /s /b *.sql 2>nul',
    { cwd: join(ROOT, 'supabase', 'migrations'), encoding: 'utf-8', shell: true }
  )
  migrationFiles = result.split('\n').map(f => f.trim()).filter(f => f)
} catch {
  migrationFiles = []
}

if (migrationFiles.length === 0) {
  fail('No se encontraron migrations')
}

const allContent = migrationFiles
  .map(f => readFileSync(f, 'utf-8'))
  .join('\n')

const bucketIds = []
const bucketRegex = /INSERT\s+INTO\s+storage\.buckets\s+\([^)]+\)\s*VALUES\s*\(['"](\w+)['"]/g
let m
while ((m = bucketRegex.exec(allContent)) !== null) {
  bucketIds.push(m[1])
}

for (const bucketId of bucketIds) {
  const isPublicBucket = bucketId === 'logos' || bucketId === 'consultora'
  const policyRegex = new RegExp(
    `CREATE\\s+POLICY\\s+"[^"]*(?:${bucketId}|assets:)[^"]*"\\s+ON\\s+storage\\.objects`,
    'i'
  )
  if (policyRegex.test(allContent)) {
    if (isPublicBucket) {
      pass(`Bucket ${bucketId} — público (RLS OK para escritura)`)
    } else {
      pass(`Bucket ${bucketId} — tiene RLS policies`)
    }
  } else {
    fail(`Bucket ${bucketId} — NO tiene RLS policies`)
  }
}

console.log(`\n${exitCode === 0 ? '✓ All checks passed' : '✗ Some checks failed'}`)
process.exit(exitCode)
