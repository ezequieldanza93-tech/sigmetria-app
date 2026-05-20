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

  if (!membership || membership.role !== 'full_access_main') {
    return NextResponse.json({ error: 'Solo el Admin Principal puede gestionar seats' }, { status: 403 })
  }

  const body = await req.json()
  const { cantidad, numero_operacion, notas } = body as {
    cantidad: number
    numero_operacion: string
    notas?: string
  }

  if (!cantidad || cantidad < 1 || cantidad > 10) {
    return NextResponse.json({ error: 'cantidad debe ser entre 1 y 10' }, { status: 400 })
  }

  if (!numero_operacion?.trim()) {
    return NextResponse.json({ error: 'numero_operacion es requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, estado, plan_id')
    .eq('consultora_id', membership.consultora_id)
    .single()

  if (!sub) {
    return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
  }

  if (!['active', 'trialing', 'past_due', 'grace_period'].includes(sub.estado)) {
    return NextResponse.json({ error: 'No podés agregar seats con suscripción ' + sub.estado }, { status: 409 })
  }

  const { data: plan } = await admin
    .from('plans')
    .select('precio_extra_seat_neto, iva_porcentaje, max_colaboradores')
    .eq('id', sub.plan_id)
    .single()

  if (!plan || plan.precio_extra_seat_neto == null) {
    return NextResponse.json({ error: 'Tu plan no soporta seats adicionales' }, { status: 409 })
  }

  const monto_neto = Number(plan.precio_extra_seat_neto) * cantidad

  // Crear el add-on record (inactivo hasta que se confirme el pago)
  const { data: addOn, error: addOnError } = await admin
    .from('subscriptions_add_ons')
    .insert({
      subscription_id: sub.id,
      tipo: 'extra_seat',
      cantidad,
      precio_unitario_neto: plan.precio_extra_seat_neto,
      is_active: false,
    })
    .select('id')
    .single()

  if (addOnError || !addOn) {
    return NextResponse.json({ error: addOnError?.message ?? 'Error al crear add-on' }, { status: 500 })
  }

  const { data: payment, error: paymentError } = await admin
    .from('payments')
    .insert({
      subscription_id: sub.id,
      provider: 'transferencia',
      monto_neto,
      iva_porcentaje: plan.iva_porcentaje,
      moneda: 'ARS',
      estado: 'pending',
      raw_payload: { type: 'extra_seat', cantidad, add_on_id: addOn.id },
    })
    .select('id')
    .single()

  if (paymentError || !payment) {
    await admin.from('subscriptions_add_ons').delete().eq('id', addOn.id)
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
    await admin.from('subscriptions_add_ons').delete().eq('id', addOn.id)
    return NextResponse.json({ error: manualError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, payment_id: payment.id, add_on_id: addOn.id })
}
