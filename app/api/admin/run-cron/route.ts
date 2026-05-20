import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('run_subscription_cron')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, result: data })
}
