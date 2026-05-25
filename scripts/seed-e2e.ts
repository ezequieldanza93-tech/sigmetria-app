import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  const testEmail = process.env.E2E_TEST_USER_EMAIL ?? 'test@sigmetria.e2e'
  const testPassword = process.env.E2E_TEST_USER_PASSWORD ?? 'TestE2E2026!'

  const cleanup = async () => {
    let userId: string | null = null

    try {
      const { data: adminUser } = await supabase.auth.admin.listUsers()
      const e2eUser = adminUser?.users?.find(u => u.email === testEmail)
      if (e2eUser) userId = e2eUser.id
    } catch {
      console.warn('  Could not list auth users (may need admin permission)')
    }

    if (userId) {
      const { data: memberships } = await supabase
        .from('consultoras_members')
        .select('consultora_id')
        .eq('user_id', userId)

      for (const m of memberships ?? []) {
        await supabase.from('consultoras_members').delete().eq('consultora_id', m.consultora_id)
      }

      const { data: empresas } = await supabase
        .from('empresas')
        .select('id')
        .ilike('razon_social', 'E2E Test%')

      for (const e of empresas ?? []) {
        await supabase.from('establecimientos').delete().eq('empresa_id', e.id)
        await supabase.from('empresas').delete().eq('id', e.id)
      }

      await supabase.from('consultoras').delete().ilike('nombre', 'E2E Test%')
      await supabase.from('consultoras_members').delete().eq('user_id', userId)
      await supabase.from('profiles').delete().eq('id', userId)

      try {
        await supabase.auth.admin.deleteUser(userId)
      } catch {
        console.warn('  Could not delete auth user (may need admin permission)')
      }
    }
  }

  console.log('Cleaning up existing E2E test data...')
  await cleanup()

  console.log('Creating test user...')
  const { data: authUser, error: signUpError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })

  if (signUpError) {
    console.error('Failed to create test user:', signUpError.message)
    process.exit(1)
  }

  const userId = authUser!.user!.id
  console.log(`  ✓ User: ${testEmail} (${userId})`)

  console.log('Creating test consultora...')
  const { data: consultora, error: cError } = await supabase
    .from('consultoras')
    .insert({
      nombre: 'E2E Test Consultora',
      cuit: '30999999991',
      is_active: true,
    })
    .select()
    .single()

  if (cError) { console.error('Failed to create consultora:', cError.message); process.exit(1) }
  console.log(`  ✓ Consultora: ${consultora.nombre} (${consultora.id})`)

  const { error: mError } = await supabase
    .from('consultoras_members')
    .insert({
      consultora_id: consultora.id,
      user_id: userId,
      role: 'full_access_main',
      is_active: true,
    })

  if (mError) { console.error('Failed to create membership:', mError.message); process.exit(1) }
  console.log('  ✓ Membership: full_access_main')

  const { error: pError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: 'E2E Test',
      system_role: 'user',
    })

  if (pError) { console.error('Failed to create profile:', pError.message); process.exit(1) }
  console.log('  ✓ Profile created')

  const empresas = [
    { razon_social: 'E2E Test Alpha S.A.', cuit: '30987654321', domicilio: 'Av. Test 100' },
    { razon_social: 'E2E Test Beta S.R.L.', cuit: '30123456789', domicilio: 'Av. Test 200' },
  ]

  for (const emp of empresas) {
    console.log(`Creating empresa: ${emp.razon_social}...`)
    const { data: empresa, error: eError } = await supabase
      .from('empresas')
      .insert({
        consultora_id: consultora.id,
        razon_social: emp.razon_social,
        cuit: emp.cuit,
        domicilio: emp.domicilio,
        is_active: true,
      })
      .select()
      .single()

    if (eError) { console.error(`  ✗ Error: ${eError.message}`); continue }
    console.log(`  ✓ ${empresa.razon_social} (${empresa.id})`)

    const estName = emp === empresas[0] ? 'Planta Test Norte' : 'Planta Test Sur'
    const { data: est, error: estError } = await supabase
      .from('establecimientos')
      .insert({
        empresa_id: empresa.id,
        nombre: estName,
        domicilio: `Av. Test Establecimiento ${empresas.indexOf(emp) + 1}`,
        cantidad_trabajadores: 25,
        status: 'active',
      })
      .select()
      .single()

    if (estError) { console.error(`  ✗ Error creating establecimiento: ${estError.message}`); continue }
    console.log(`  ✓ Establecimiento: ${est.nombre} (${est.id})`)
  }

  console.log('\n✅ E2E seed complete!')
}

main().catch(console.error)
