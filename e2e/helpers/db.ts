import { createClient } from '@supabase/supabase-js'

export function getAdminClient() {
  const url = process.env.E2E_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing E2E Supabase credentials. Set E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
    )
  }

  return createClient(url, key, { auth: { persistSession: false } })
}

export async function cleanupTestData() {
  const supabase = getAdminClient()

  const testEmail = process.env.E2E_TEST_USER_EMAIL ?? 'test@sigmetria.e2e'

  let userId: string | null = null
  try {
    const { data: adminUser } = await supabase.auth.admin.listUsers()
    const e2eUser = adminUser?.users?.find(u => u.email === testEmail)
    if (e2eUser) userId = e2eUser.id
  } catch {
    console.warn('Could not list auth users (may need admin permission)')
  }

  if (userId) {
    await supabase.from('consultoras_members').delete().eq('user_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)
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

  if (userId) {
    try {
      await supabase.auth.admin.deleteUser(userId)
    } catch {
      console.warn('Could not delete auth user (may need admin permission)')
    }
  }
}
