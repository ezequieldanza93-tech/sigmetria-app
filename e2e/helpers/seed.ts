import { getAdminClient } from './db'

export interface TestData {
  consultoraId: string
  userId: string
  empresas: Array<{ id: string; razon_social: string }>
  establecimientos: Array<{ id: string; nombre: string; empresaId: string }>
}

export async function seedTestData(): Promise<TestData> {
  const supabase = getAdminClient()
  const testEmail = process.env.E2E_TEST_USER_EMAIL ?? 'test@sigmetria.e2e'
  const testPassword = process.env.E2E_TEST_USER_PASSWORD ?? 'TestE2E2026!'

  const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })

  if (signUpError) throw new Error(`Failed to create test user: ${signUpError.message}`)
  if (!newUser.user) throw new Error('No user returned from admin.createUser')

  const userId = newUser.user.id

  const { data: consultora, error: cError } = await supabase
    .from('consultoras')
    .insert({
      nombre: 'E2E Test Consultora',
      cuit: '30999999991',
      is_active: true,
    })
    .select()
    .single()

  if (cError) throw new Error(`Failed to create consultora: ${cError.message}`)

  const consultoraId = consultora.id

  const { error: mError } = await supabase
    .from('consultoras_members')
    .insert({
      consultora_id: consultoraId,
      user_id: userId,
      role: 'full_access_main',
      is_active: true,
    })

  if (mError) throw new Error(`Failed to create membership: ${mError.message}`)

  const { error: pError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: 'E2E Test',
      system_role: 'user',
    })

  if (pError) throw new Error(`Failed to create profile: ${pError.message}`)

  const empresas: Array<{ id: string; razon_social: string }> = []
  const empresaNames = ['E2E Test Alpha S.A.', 'E2E Test Beta S.R.L.']

  for (const name of empresaNames) {
    const { data: empresa, error: eError } = await supabase
      .from('empresas')
      .insert({
        consultora_id: consultoraId,
        razon_social: name,
        cuit: `30${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}${Math.floor(Math.random() * 10)}`,
        domicilio: `Calle Test 1${empresas.length + 1}00`,
        is_active: true,
      })
      .select()
      .single()

    if (eError) throw new Error(`Failed to create empresa ${name}: ${eError.message}`)
    empresas.push({ id: empresa.id, razon_social: empresa.razon_social })
  }

  const establecimientos: Array<{ id: string; nombre: string; empresaId: string }> = []
  const estNames = ['Planta Test Norte', 'Planta Test Sur']

  for (let i = 0; i < empresas.length; i++) {
    const { data: est, error: estError } = await supabase
      .from('establecimientos')
      .insert({
        empresa_id: empresas[i].id,
        nombre: estNames[i],
        domicilio: `Av. Test Establecimiento ${i + 1}`,
        cantidad_trabajadores: 25,
        status: 'active',
      })
      .select()
      .single()

    if (estError) throw new Error(`Failed to create establecimiento: ${estError.message}`)
    establecimientos.push({
      id: est.id,
      nombre: est.nombre,
      empresaId: empresas[i].id,
    })
  }

  return { consultoraId, userId, empresas, establecimientos }
}
