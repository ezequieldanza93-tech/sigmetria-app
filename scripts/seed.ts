/**
 * Database seed script for development.
 * Usage: npx tsx scripts/seed.ts
 *
 * Seeds:
 *   - Sample empresa with establecimientos
 *   - Sample sectores, puestos, personas
 *   - Admin user assignment
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function seed() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const consultoraId = process.argv[2] // pass as argument

  if (!consultoraId) {
    console.error('Usage: npx tsx scripts/seed.ts <consultora_id>')
    process.exit(1)
  }

  // Create empresa
  const { data: empresa, error: e1 } = await supabase
    .from('empresas')
    .insert({
      consultora_id: consultoraId,
      razon_social: 'Empresa Demo S.A.',
      cuit: '20123456789',
      domicilio: 'Av. Corrientes 1234',
    })
    .select()
    .single()

  if (e1) { console.error('Error creating empresa:', e1); process.exit(1) }
  console.log(`✓ Created empresa: ${empresa.razon_social} (${empresa.id})`)

  // Create establecimiento
  const { data: est, error: e2 } = await supabase
    .from('establecimientos')
    .insert({
      empresa_id: empresa.id,
      nombre: 'Planta Central',
      actividad_principal: 'Producción industrial',
      cantidad_trabajadores: 50,
      status: 'active',
    })
    .select()
    .single()

  if (e2) { console.error('Error creating establecimiento:', e2); process.exit(1) }
  console.log(`✓ Created establecimiento: ${est.nombre} (${est.id})`)

  // Create sectores
  const sectores = ['Administración', 'Producción 1', 'Producción 2', 'Logística']
  for (const nombre of sectores) {
    const { error: e } = await supabase
      .from('establecimientos_sectores')
      .insert({
        establecimiento_id: est.id,
        nombre,
        es_custom: false,
        cantidad_trabajadores: 10,
        is_active: true,
      })
    if (e) console.error(`  ✗ Error creating sector ${nombre}:`, e.message)
    else console.log(`  ✓ Sector: ${nombre}`)
  }

  console.log('\n✅ Seed complete!')
}

seed().catch(console.error)
