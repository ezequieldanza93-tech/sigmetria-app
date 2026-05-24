import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { plan_id, features } = body as {
    plan_id: string
    features: { key: string; enabled: boolean }[]
  }

  if (!plan_id || !Array.isArray(features)) {
    return NextResponse.json({ error: 'plan_id y features son requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: existing } = await admin.from('plan_features').select('feature_key').eq('plan_id', plan_id)
  const existingKeys = new Set((existing ?? []).map(f => f.feature_key))

  for (const f of features) {
    if (existingKeys.has(f.key)) {
      const { error } = await admin.from('plan_features').update({ habilitado: f.enabled }).eq('plan_id', plan_id).eq('feature_key', f.key)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await admin.from('plan_features').insert({ plan_id, feature_key: f.key, habilitado: f.enabled })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
