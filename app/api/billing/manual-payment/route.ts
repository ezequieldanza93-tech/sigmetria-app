import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Sin consultora activa' }, { status: 403 })
  }

  if (!['full_access_main'].includes(membership.role)) {
    return NextResponse.json({ error: 'Solo el Admin Principal puede gestionar pagos' }, { status: 403 })
  }

  const body = await req.json()
  const { plan_id, periodo, numero_operacion, notas } = body as {
    plan_id: string
    periodo: 'mensual' | 'anual'
    numero_operacion: string
    notas?: string
  }

  if (!plan_id || !periodo || !numero_operacion?.trim()) {
    return NextResponse.json({ error: 'plan_id, periodo y numero_operacion son requeridos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const [planResult, subResult] = await Promise.all([
    admin.from('plans').select('id, precio_mensual_neto, precio_anual_neto, iva_porcentaje').eq('id', plan_id).eq('is_active', true).single(),
    admin.from('subscriptions').select('id').eq('consultora_id', membership.consultora_id).single(),
  ])

  const plan = planResult.data
  if (!plan) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  }

  const sub = subResult.data
  if (!sub) {
    return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
  }

  const monto_neto = periodo === 'mensual'
    ? Number(plan.precio_mensual_neto)
    : Number(plan.precio_anual_neto)

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({
      subscription_id: sub.id,
      provider: 'transferencia',
      monto_neto,
      iva_porcentaje: plan.iva_porcentaje,
      moneda: 'ARS',
      estado: 'pending',
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: paymentError?.message ?? 'Error al crear pago' }, { status: 500 })
  }

  const { error: manualError } = await admin
    .from('manual_payments')
    .insert({
      payment_id: payment.id,
      numero_operacion: numero_operacion.trim(),
      notas: notas?.trim() || null,
    })

  if (manualError) {
    await admin.from('payments').delete().eq('id', payment.id)
    return NextResponse.json({ error: manualError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, payment_id: payment.id })
}
