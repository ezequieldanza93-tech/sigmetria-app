/**
 * IPERC Seed Script
 *
 * Reads the two CSV files and populates the IPERC reference tables.
 * Run: npx tsx scripts/seed-iperc.ts <consultora_id>
 *
 * Requires:
 * - .sdd/data/IPERC - Library-L3.csv
 * - .sdd/data/IPERC - Matrix-Grid view.csv
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'

const CONSULTORA_ID = process.argv[2]
if (!CONSULTORA_ID) {
  console.error('Usage: npx tsx scripts/seed-iperc.ts <consultora_id>')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

interface LibraryRow {
  'IPERC - Library ID': string
  'Title': string
  'Cantidad Referencia': string
  'Level': string
  'IPERC - L2': string
  'IPERC- L1': string
  'Descrpción': string
  'IPERC - L2 (No eliminar)': string
  'IPERC- L1 (No eliminar)': string
  'IPERC - Matrix (Peligros)': string
  'IPERC - Matrix 4 (Riesgos)': string
  'IPERC - Matrix (Consecuencias)': string
  'IPERC - Matrix (Probabilidad)': string
  'IPERC - Matrix (Nivel de Riesgo)': string
  'IPERC - Matrix (Consecuencias) copy': string
  'IPERC - Matrix (Probabilidad) copy': string
}

interface MatrixRow {
  'IPERC - ID': string
  'Sectores de Trabajo (Master Component)': string
  'Process ES': string
  'Task Number': string
  'Task Description': string
  'Dangers (L3)': string
  'Condición de Peligro': string
  'Risks (L3)': string
  'Initial Consequence (L3)': string
  'Initial Probability (L3)': string
  'Measures Control (Unficate)': string
  'Final Consequence (L3)': string
  'Clasifications Consequence (L3)': string
  'Q Final Consequence (L3)': string
  'Final Probability (L3)': string
  'Cantidad Referencia (from Final Probability (L3))': string
  'FRL Valoration': string
  'FRL Clasification': string
  'IRL Clasification (L1)': string
  'IRL Description Clasification (L1)': string
}

async function main() {
  const dataDir = path.resolve(__dirname, '..', '.sdd', 'data')
  console.log(`Seeding IPERC for consultora: ${CONSULTORA_ID}`)
  console.log(`Data dir: ${dataDir}`)

  // ---- Read CSVs ----
  const libraryRaw = fs.readFileSync(path.join(dataDir, 'IPERC - Library-L3.csv'), 'latin1')
  const matrixRaw = fs.readFileSync(path.join(dataDir, 'IPERC - Matrix-Grid view.csv'), 'latin1')

  const libraryRows = parse(libraryRaw, { columns: true, delimiter: ',', relax_column_count: true }) as LibraryRow[]
  const matrixRows = parse(matrixRaw, { columns: true, delimiter: ',', relax_column_count: true }) as MatrixRow[]

  console.log(`Library rows: ${libraryRows.length}`)
  console.log(`Matrix rows: ${matrixRows.length}`)

  // ---- 1. Seed Consecuencias ----
  const consecData: { nivel: string; valor: number; items: string[] }[] = [
    { nivel: 'Daño Leve', valor: 1, items: [] },
    { nivel: 'Daño Moderado', valor: 2, items: [] },
    { nivel: 'Daño Grave', valor: 3, items: [] },
    { nivel: 'Daño Muy Grave', valor: 4, items: [] },
    { nivel: 'Daño Fatal', valor: 5, items: [] },
  ]

  for (const row of libraryRows) {
    const l2 = row['IPERC - L2']?.trim()
    const l1 = row['IPERC- L1']?.trim()
    if (l1 !== 'Consecuencias') continue
    const item = consecData.find(c => c.nivel === l2)
    if (item) {
      item.items.push(row['Title']?.trim())
    }
  }

  for (const cd of consecData) {
    const { data: conseq, error } = await supabase
      .from('iperc_consecuencias')
      .insert({ consultora_id: CONSULTORA_ID, nivel: cd.nivel, valor_numerico: cd.valor, orden: cd.valor })
      .select('id')
      .single()
    if (error) { console.error('Error inserting consecuencia:', error.message); continue }

    for (const nombre of cd.items) {
      const { error: itemError } = await supabase
        .from('iperc_consecuencia_items')
        .insert({ consecuencia_id: conseq.id, nombre })
      if (itemError) console.error('Error inserting consecuencia item:', itemError.message)
    }
    console.log(`  Consecuencia: ${cd.nivel} (${cd.items.length} items)`)
  }

  // ---- 2. Seed Probabilidades ----
  const probData = [
    { nivel: 'Muy Improbable', valor: 1 },
    { nivel: 'Improbable', valor: 2 },
    { nivel: 'Moderada', valor: 3 },
    { nivel: 'Probable', valor: 4 },
    { nivel: 'Muy Probable', valor: 5 },
  ]

  for (const pd of probData) {
    const { error } = await supabase
      .from('iperc_probabilidades')
      .insert({ consultora_id: CONSULTORA_ID, nivel: pd.nivel, valor_numerico: pd.valor, orden: pd.valor })
    if (error) console.error('Error inserting probabilidad:', error.message)
    console.log(`  Probabilidad: ${pd.nivel}`)
  }

  // ---- 3. Seed Niveles de Riesgo ----
  const nivelesData = [
    { nombre: 'Riesgo Trivial', min: 1, max: 4, valor_ref: 5, color: '#22c55e', acciones: 'Concientización. No requiere implementar métodos de prevención y control sin perjuicio de que se realicen monitoreos.' },
    { nombre: 'Riesgo Tolerable', min: 5, max: 9, valor_ref: 10, color: '#eab308', acciones: 'Monitoreo y control para mantener el riesgo o impacto por lo menos en este nivel, sin perjuicio de que se puedan implementar medidas para reducirlos al nivel inferior.' },
    { nombre: 'Riesgo Moderado', min: 10, max: 14, valor_ref: 15, color: '#f97316', acciones: 'Monitoreo y control reforzado para garantizar que el riesgo o impacto no aumente. Se pueden requerir medidas adicionales de prevención, capacitación específica y, en ciertos casos, permisos de trabajo.' },
    { nombre: 'Riesgo Importante', min: 15, max: 19, valor_ref: 20, color: '#ef4444', acciones: 'Restricción de Tareas. No se permite la operación en esta condición y se deben tomar en forma inmediata las medidas necesarias de prevención y control adicionales para reducir el riesgo o impacto a un Nivel de Riesgo por lo menos Moderado.' },
    { nombre: 'Riesgo Intolerable', min: 20, max: 25, valor_ref: 25, color: '#7f1d1d', acciones: 'Prohibición de Tareas. Se encuentra prohibida en su totalidad la operación en esta condición y se deben realizar en forma inmediata acciones para reducir el riesgo o impacto a un Nivel de Riesgo por lo menos Moderado.' },
  ]

  for (const nd of nivelesData) {
    const { error } = await supabase
      .from('iperc_niveles_riesgo')
      .insert({
        consultora_id: CONSULTORA_ID,
        nombre: nd.nombre,
        valor_ref: nd.valor_ref,
        valor_min: nd.min,
        valor_max: nd.max,
        color: nd.color,
        acciones_requeridas: nd.acciones,
      })
    if (error) console.error('Error insertando nivel de riesgo:', error.message)
    console.log(`  Nivel: ${nd.nombre}`)
  }

  // ---- 4. Seed Peligros Library ----
  const factorMap: Record<string, string> = {
    'Factor Ambiental': 'Ambiental',
    'Factor Biológico': 'Biológico',
    'Factor Ergonómico': 'Ergonómico',
    'Factor Físico': 'Físico',
    'Factor Locativo': 'Locativo',
    'Factor Mecánico': 'Mecánico',
    'Factor Psicosocial': 'Psicosocial',
    'Factor Químico': 'Químico',
  }

  const peligrosSet = new Map<string, string>() // nombre -> factor
  for (const row of libraryRows) {
    const l1 = row['IPERC- L1']?.trim()
    if (l1 !== 'Peligros') continue
    const l2 = row['IPERC - L2']?.trim()
    const factor = factorMap[l2]
    if (factor) {
      const titulo = row['Title']?.trim()
      if (titulo && !peligrosSet.has(titulo)) {
        peligrosSet.set(titulo, factor)
      }
    }
  }

  for (const [nombre, factor] of peligrosSet) {
    const { error } = await supabase
      .from('iperc_peligros_library')
      .insert({ consultora_id: CONSULTORA_ID, nombre, factor })
    if (error) console.error('Error insertando peligro:', error.message)
  }
  console.log(`  Peligros: ${peligrosSet.size}`)

  // ---- 5. Seed Riesgos Library ----
  const riesgoTipoMap: Record<string, string> = {
    'Accidentes': 'Accidente',
    'Enfermedad Profesional': 'Enfermedad Profesional',
    'Daños Materiales': 'Daños Materiales',
  }

  const riesgosSet = new Map<string, string>() // nombre -> tipo
  for (const row of libraryRows) {
    const l1 = row['IPERC- L1']?.trim()
    if (l1 !== 'Riesgos') continue
    const l2 = row['IPERC - L2']?.trim()
    const tipo = riesgoTipoMap[l2]
    if (tipo) {
      const titulo = row['Title']?.trim()
      if (titulo && !riesgosSet.has(titulo)) {
        riesgosSet.set(titulo, tipo)
      }
    }
  }

  for (const [nombre, tipo] of riesgosSet) {
    const { error } = await supabase
      .from('iperc_riesgos_library')
      .insert({ consultora_id: CONSULTORA_ID, nombre, tipo })
    if (error) console.error('Error insertando riesgo:', error.message)
  }
  console.log(`  Riesgos: ${riesgosSet.size}`)

  // ---- 6. Seed Medidas de Control from Matrix CSV ----
  const medidasSet = new Set<string>()
  let medidasCount = 0

  for (const row of matrixRows) {
    const rawText = row['Measures Control (Unficate)']?.trim()
    if (!rawText) continue

    // Split by newlines, look for bullet items
    const lines = rawText.split(/\r?\n/)
    for (const line of lines) {
      // Remove leading bullet markers, trim whitespace
      let texto = line.replace(/^[-–•*]\s*/, '').trim()
      if (!texto) continue

      // Skip headers like "CONTROL DE INGENIERÍA", "CONTROL ADMINISTRATIVO", "EPP"
      const upper = texto.toUpperCase()
      if (upper === 'CONTROL DE INGENIERÍA' || upper === 'CONTROL DE INGENIERIA' ||
          upper === 'CONTROL ADMINISTRATIVO' || upper === 'EPP' ||
          upper === 'CONTROL DE INGENIERIA') continue

      // Clean up: remove trailing periods, normalize whitespace
      texto = texto.replace(/\.+$/, '').trim()
      // Capitalize first letter
      texto = texto.charAt(0).toUpperCase() + texto.slice(1)
      // Truncate to 150 chars
      if (texto.length > 150) texto = texto.substring(0, 147) + '...'

      if (texto && !medidasSet.has(texto)) {
        medidasSet.add(texto)
      }
    }
  }

  for (const texto of medidasSet) {
    const { error } = await supabase
      .from('medidas_control')
      .insert({ consultora_id: CONSULTORA_ID, texto, veces_usada: 1 })
    if (error) console.error('Error insertando medida:', error.message)
    else medidasCount++
  }
  console.log(`  Medidas de Control: ${medidasCount} (from ${medidasSet.size} unique)`)

  // ---- 7. Seed Medidas de Control from Library CSV "Acciones" ----
  // Library rows with L2 matching acciones/medidas patterns
  const accionPatterns = ['Acción', 'Medida', 'Control']
  for (const row of libraryRows) {
    const l2 = row['IPERC - L2']?.trim() || ''
    const l1 = row['IPERC- L1']?.trim() || ''
    const match = accionPatterns.some(p => l2.includes(p) || l1.includes(p))
    if (!match) continue

    const titulo = row['Title']?.trim()
    if (!titulo) continue
    let texto = titulo.replace(/^[-–•*]\s*/, '').trim()
    texto = texto.replace(/\.+$/, '').trim()
    texto = texto.charAt(0).toUpperCase() + texto.slice(1)
    if (texto.length > 150) texto = texto.substring(0, 147) + '...'

    if (texto && !medidasSet.has(texto)) {
      const { error } = await supabase
        .from('medidas_control')
        .insert({ consultora_id: CONSULTORA_ID, texto })
      if (!error) {
        medidasSet.add(texto)
        medidasCount++
      }
    }
  }
  console.log(`  Medidas totales: ${medidasCount}`)

  console.log('Seed IPERC completado.')
}

main().catch(console.error)
