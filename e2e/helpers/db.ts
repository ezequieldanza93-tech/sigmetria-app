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

  const { data: testUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', testEmail)
    .maybeSingle()

  if (testUser) {
    await supabase.from('consultoras_members').delete().eq('user_id', testUser.id)
    await supabase.from('profiles').delete().eq('id', testUser.id)
  }

  const { data: testMembers } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('consultoras.razon_social', 'E2E Test Consultora')

  for (const m of testMembers ?? []) {
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

  await supabase.from('consultoras').delete().ilike('razon_social', 'E2E Test%')

  try {
    const { data: adminUser } = await supabase.auth.admin.listUsers()
    const e2eUser = adminUser?.users?.find(u => u.email === testEmail)
    if (e2eUser) {
      await supabase.auth.admin.deleteUser(e2eUser.id)
    }
  } catch {
    console.warn('Could not delete auth user (may need admin权限)')
  }
}
