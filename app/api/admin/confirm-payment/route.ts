import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { payment_id, notas } = body as { payment_id: string; notas?: string }

  if (!payment_id) {
    return NextResponse.json({ error: 'payment_id es requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: payment, error: fetchError } = await admin
    .from('payments')
    .select('id, subscription_id, monto_neto, estado, raw_payload')
    .eq('id', payment_id)
    .single()

  if (fetchError || !payment) {
    return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
  }

  if (payment.estado !== 'pending') {
    return NextResponse.json({ error: 'El pago ya fue procesado' }, { status: 409 })
  }

  const now = new Date()

  const { error: paymentUpdateError } = await admin
    .from('payments')
    .update({ estado: 'confirmed' })
    .eq('id', payment_id)

  if (paymentUpdateError) {
    return NextResponse.json({ error: paymentUpdateError.message }, { status: 500 })
  }

  await admin
    .from('manual_payments')
    .update({
      confirmado_por: auth.userId,
      confirmado_at: now.toISOString(),
      notas: notas ?? null,
    })
    .eq('payment_id', payment_id)

  const payload = payment.raw_payload as { type?: string; cantidad?: number; add_on_id?: string } | null

  if (payload?.type === 'extra_seat') {
    const cantidad = payload.cantidad ?? 1

    const { data: sub } = await admin
      .from('subscriptions')
      .select('consultora_id')
      .eq('id', payment.subscription_id)
      .single()

    if (!sub) {
      return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
    }

    const { data: consultora } = await admin
      .from('consultoras')
      .select('seats_max')
      .eq('id', sub.consultora_id)
      .single()

    const currentSeats = consultora?.seats_max ?? 0

    await admin
      .from('consultoras')
      .update({ seats_max: currentSeats + cantidad })
      .eq('id', sub.consultora_id)

    if (payload.add_on_id) {
      await admin
        .from('subscriptions_add_ons')
        .update({ is_active: true })
        .eq('id', payload.add_on_id)
    }

    return NextResponse.json({
      ok: true,
      payment_id,
      type: 'extra_seat',
      seats_max: currentSeats + cantidad,
    })
  }

  // Pago de suscripción regular
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, periodo')
    .eq('id', payment.subscription_id)
    .single()

  if (!sub) {
    return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
  }

  const periodEnd = new Date(now)
  if (sub.periodo === 'anual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const { error: subUpdateError } = await admin
    .from('subscriptions')
    .update({
      estado: 'active',
      current_period_end: periodEnd.toISOString(),
    })
    .eq('id', payment.subscription_id)

  if (subUpdateError) {
    return NextResponse.json({ error: subUpdateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, payment_id, current_period_end: periodEnd.toISOString() })
}
