import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mpPreApproval, mpPayment } from '@/lib/mercadopago/client'
import { verifyWebhookSignature } from '@/lib/mercadopago/webhook-verify'

/**
 * Webhook handler de Mercado Pago.
 *
 * Endpoint público (sin auth de usuario), protegido por HMAC.
 * Responde 200 rápido para evitar reintentos de MP.
 *
 * Topics manejados:
 * - payment → sincronizar pago en payments
 * - subscription_preapproval → actualizar estado de subscriptions
 * - subscription_authorized_payment → mismo que payment
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    const xSignature = request.headers.get('x-signature') ?? ''
    const xRequestId = request.headers.get('x-request-id') ?? ''

    // Leer el body como texto para poder parsear después
    const rawBody = await request.text()
    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const dataId = (body.data as Record<string, unknown> | null)?.id as string | null
    const topic = body.type as string ?? (body.topic as string) ?? ''

    // Verificar HMAC
    const verification = verifyWebhookSignature(
      { 'x-signature': xSignature, 'x-request-id': xRequestId },
      dataId,
    )

    const admin = createAdminClient()

    // Log del webhook
    const { data: logEntry } = await admin
      .from('mercadopago_webhook_log')
      .insert({
        topic,
        data_id: dataId ?? 'unknown',
        request_id: xRequestId,
        signature_valid: verification.valid,
        payload: body,
        procesado: false,
      })
      .select('id')
      .single()

    const logId = logEntry?.id

    if (!verification.valid) {
      // Marcar como procesado con error
      if (logId) {
        await admin.from('mercadopago_webhook_log').update({
          procesado: true,
          respuesta_status: 401,
          error: verification.error ?? 'Firma inválida',
          procesado_at: new Date().toISOString(),
        }).eq('id', logId)
      }
      return NextResponse.json({ error: 'bad signature' }, { status: 401 })
    }

    if (!dataId) {
      if (logId) {
        await admin.from('mercadopago_webhook_log').update({
          procesado: true,
          respuesta_status: 400,
          error: 'data.id no encontrado',
          procesado_at: new Date().toISOString(),
        }).eq('id', logId)
      }
      return NextResponse.json({ error: 'data.id required' }, { status: 400 })
    }

    // Idempotencia: si ya procesamos este evento, responder 200
    const { data: existing } = await admin
      .from('mercadopago_webhook_log')
      .select('id, procesado')
      .eq('topic', topic)
      .eq('data_id', dataId)
      .eq('request_id', xRequestId)
      .maybeSingle()

    if (existing && existing.procesado) {
      return NextResponse.json({ message: 'already processed' })
    }

    // Procesar según topic
    try {
      if (topic === 'payment' || topic === 'subscription_authorized_payment') {
        await handlePaymentWebhook(dataId, admin)
      } else if (topic === 'subscription_preapproval') {
        await handlePreapprovalWebhook(dataId, admin)
      } else {
        console.warn(`[MP Webhook] Topic no manejado: ${topic}`)
      }
    } catch (processError) {
      const errorMessage = processError instanceof Error ? processError.message : 'Error procesando webhook'
      console.error(`[MP Webhook] Error procesando ${topic}:`, errorMessage)

      if (logId) {
        await admin.from('mercadopago_webhook_log').update({
          procesado: true,
          respuesta_status: 500,
          error: errorMessage,
          procesado_at: new Date().toISOString(),
        }).eq('id', logId)
      }

      // De todas formas responder 200 para evitar reintentos
      return NextResponse.json({ message: 'accepted but processing failed', error: errorMessage })
    }

    // Marcar como procesado exitoso
    if (logId) {
      await admin.from('mercadopago_webhook_log').update({
        procesado: true,
        respuesta_status: 200,
        procesado_at: new Date().toISOString(),
      }).eq('id', logId)
    }

    const elapsed = Date.now() - startTime
    console.log(`[MP Webhook] Procesado ${topic}/${dataId} en ${elapsed}ms`)

    return NextResponse.json({ message: 'ok' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error interno'
    console.error('[MP Webhook] Error general:', errorMessage)
    // Siempre 200 para evitar reintentos de MP
    return NextResponse.json({ message: 'accepted', error: errorMessage })
  }
}

// ─── Handlers específicos ────────────────────────────────

async function handlePaymentWebhook(paymentId: string, admin: ReturnType<typeof createAdminClient>) {
  // Fetch payment details from MP
  const payment = await mpPayment.get({ id: paymentId })

  const externalRef = payment.external_reference as string | undefined
  if (!externalRef) {
    console.warn(`[MP Webhook] Payment ${paymentId} sin external_reference`)
    return
  }

  // Buscar subscription por external_reference
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id')
    .eq('id', externalRef)
    .maybeSingle()

  if (!sub) {
    console.warn(`[MP Webhook] Payment ${paymentId} apunta a sub inexistente: ${externalRef}`)
    return
  }

  const mpStatus = payment.status as string
  const mpStatusDetail = payment.status_detail as string | undefined

  // Mapear estado MP a payment_estado local
  let localEstado: string
  switch (mpStatus) {
    case 'approved':
      localEstado = 'approved'
      break
    case 'rejected':
    case 'refunded':
    case 'charged_back':
      localEstado = 'rejected'
      break
    default:
      localEstado = 'pending'
  }

  // Buscar si ya existe el payment
  const { data: existingPayment } = await admin
    .from('payments')
    .select('id')
    .eq('mp_payment_id', paymentId)
    .maybeSingle()

  const paymentMethodId = (payment.payment_method_id as string) ?? null
  const paymentTypeId = (payment.payment_type_id as string) ?? null
  const cardLastFour = (payment.card as any)?.last_four_digits ?? null

  const montoNeto = payment.transaction_amount
    ? Number(payment.transaction_amount) / 1.21
    : 0

  if (existingPayment) {
    // Actualizar
    await admin.from('payments').update({
      estado: localEstado,
      mp_status: mpStatus,
      mp_status_detail: mpStatusDetail,
      mp_payment_method: paymentMethodId,
      mp_payment_type: paymentTypeId,
      mp_card_last4: cardLastFour,
    }).eq('id', existingPayment.id)
  } else {
    // Insertar nuevo payment
    const { data: newPayment } = await admin
      .from('payments')
      .insert({
        subscription_id: sub.id,
        provider: 'mercadopago',
        provider_payment_id: paymentId,
        mp_payment_id: paymentId,
        mp_status: mpStatus,
        mp_status_detail: mpStatusDetail,
        mp_payment_method: paymentMethodId,
        mp_payment_type: paymentTypeId,
        mp_card_last4: cardLastFour,
        mp_external_reference: externalRef,
        monto_neto: Math.round(montoNeto * 100) / 100,
        estado: localEstado,
      })
      .select('id')
      .single()

    // Si es un pago aprobado, actualizar current_period_end
    if (mpStatus === 'approved' && newPayment) {
      const { data: currentSub } = await admin
        .from('subscriptions')
        .select('current_period_end')
        .eq('id', sub.id)
        .single()

      // Extender 30 días desde ahora o desde current_period_end (lo que sea mayor)
      const baseDate = currentSub?.current_period_end
        ? new Date(Math.max(Date.now(), new Date(currentSub.current_period_end).getTime()))
        : new Date()

      const newPeriodEnd = new Date(baseDate)
      newPeriodEnd.setDate(newPeriodEnd.getDate() + 30)

      await admin.from('subscriptions').update({
        current_period_start: new Date().toISOString(),
        current_period_end: newPeriodEnd.toISOString(),
        mp_card_last4: cardLastFour,
        mp_payment_method: paymentMethodId,
        card_last4: cardLastFour,
        card_brand: paymentMethodId,
        metodo_pago: paymentTypeId === 'credit_card' ? 'Tarjeta de crédito' : 'Tarjeta de débito',
      }).eq('id', sub.id)

      // Log audit
      await admin.from('subscription_audit_log').insert({
        subscription_id: sub.id,
        estado_nuevo: 'active' as any,
        motivo: `Pago recurrente aprobado (MP: ${paymentId})`,
      })
    }
  }
}

async function handlePreapprovalWebhook(preapprovalId: string, admin: ReturnType<typeof createAdminClient>) {
  // Fetch preapproval details from MP
  const preapproval = await mpPreApproval.get({ id: preapprovalId })

  const mpStatus = preapproval.status as string

  // Mapear estado MP a estado local
  let localEstado: string
  switch (mpStatus) {
    case 'pending':
      localEstado = 'pending'
      break
    case 'authorized':
      // Determinar si está en trial
      localEstado = 'active'
      break
    case 'paused':
      localEstado = 'past_due'
      break
    case 'cancelled':
      localEstado = 'canceled'
      break
    default:
      localEstado = 'active'
  }

  // Buscar subscription por mp_preapproval_id
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, estado')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle()

  if (!sub) {
    // Si no existe, buscar por external_reference
    const externalRef = preapproval.external_reference as string | undefined
    if (externalRef) {
      const { data: subByRef } = await admin
        .from('subscriptions')
        .select('id, estado')
        .eq('id', externalRef)
        .maybeSingle()

      if (subByRef) {
        await updateSubscriptionState(admin, subByRef.id, localEstado, preapproval, subByRef.estado)
      }
    }
    return
  }

  await updateSubscriptionState(admin, sub.id, localEstado, preapproval, sub.estado)
}

async function updateSubscriptionState(
  admin: ReturnType<typeof createAdminClient>,
  subscriptionId: string,
  localEstado: string,
  preapproval: Record<string, any>,
  estadoAnterior: string,
) {
  const updateData: Record<string, unknown> = {
    estado: localEstado,
    mp_status: preapproval.status,
    mp_payer_id: preapproval.payer?.id?.toString() ?? preapproval.payer?.email ?? null,
    mp_payer_email: preapproval.payer?.email ?? null,
  }

  // Setear fechas si está activo
  if (localEstado === 'active') {
    updateData.current_period_start = preapproval.date_created ?? new Date().toISOString()
    // Calcular current_period_end: 30 días desde la fecha de inicio
    const startDate = preapproval.date_created ? new Date(preapproval.date_created) : new Date()
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 30)
    updateData.current_period_end = endDate.toISOString()
  }

  await admin.from('subscriptions').update(updateData).eq('id', subscriptionId)

  // Log audit
  await admin.from('subscription_audit_log').insert({
    subscription_id: subscriptionId,
    estado_anterior: estadoAnterior,
    estado_nuevo: localEstado,
    motivo: `Webhook MP: preapproval ${preapproval.id} → ${localEstado}`,
  })
}
