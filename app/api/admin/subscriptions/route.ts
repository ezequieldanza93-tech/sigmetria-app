import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('subscriptions')
    .select(`
      id,
      estado,
      periodo,
      trial_ends_at,
      current_period_end,
      grace_period_ends_at,
      created_at,
      consultoras (
        id,
        nombre,
        cuit,
        trial_used_at
      ),
      plans (
        nombre,
        slug
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ subscriptions: data })
}
