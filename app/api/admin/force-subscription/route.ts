import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { createAdminClient } from '@/lib/supabase/admin'

type SubscriptionEstado =
  | 'trialing' | 'trial_view_only' | 'active'
  | 'past_due' | 'grace_period' | 'canceled' | 'expired'

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { consultora_id, estado, motivo } = body as {
    consultora_id: string
    estado: SubscriptionEstado
    motivo?: string
  }

  if (!consultora_id || !estado) {
    return NextResponse.json({ error: 'consultora_id y estado son requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: sub, error: fetchError } = await admin
    .from('subscriptions')
    .select('id, estado')
    .eq('consultora_id', consultora_id)
    .single()

  if (fetchError || !sub) {
    return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
  }

  const { error } = await admin
    .from('subscriptions')
    .update({ estado })
    .eq('id', sub.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Log en impersonation_log (registramos acciones de admin sobre suscripciones)
  await admin.from('subscription_audit_log').insert({
    subscription_id: sub.id,
    estado_anterior: sub.estado,
    estado_nuevo: estado,
    motivo: motivo ?? 'Forzado por super_admin',
    actor_id: auth.userId,
  })

  return NextResponse.json({
    ok: true,
    subscription_id: sub.id,
    estado_anterior: sub.estado,
    estado_nuevo: estado,
  })
}
