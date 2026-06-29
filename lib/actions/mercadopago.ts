'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { mpPreApproval, mpPreApprovalPlan, mpPayment, isMercadoPagoConfigured } from '@/lib/mercadopago/client'
import { calcularProrrata } from '@/lib/mercadopago/prorrata'
import { getUserAndMembership, requireMainAdmin } from '@/lib/auth/require-active-subscription'
import { calcularPrecioFinal, generarCuotasAnuales } from '@/lib/billing/descuento'
import type { ActionResult } from '@/lib/types'

// ─── Admin: sincronizar plan con MP ───────────────────────

export async function sincronizarPlanMP(planId: string): Promise<ActionResult<{ mpPlanId: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) return { success: false, error: 'No autorizado' }

    if (!isMercadoPagoConfigured()) {
      return { success: false, error: 'Mercado Pago no está configurado' }
    }

    const admin = createAdminClient()
    const { data: plan } = await admin.from('plans').select('*').eq('id', planId).single()
    if (!plan) return { success: false, error: 'Plan no encontrado' }

    const precio = plan.precio_mensual_neto
    if (!precio) return { success: false, error: 'El plan no tiene precio mensual configurado' }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) return { success: false, error: 'NEXT_PUBLIC_APP_URL no configurada' }

    let mpPlanId: string

    if (plan.mp_preapproval_plan_id) {
      // Re-sync: intentar update
      try {
        const updated = await mpPreApprovalPlan.update({
          id: plan.mp_preapproval_plan_id,
          updatePreApprovalPlanRequest: {
            reason: plan.nombre,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months' as const,
              transaction_amount: Number(precio),
              currency_id: 'ARS',
            },
            back_url: `${appUrl}/dashboard/billing/checkout/success`,
          },
        })
        mpPlanId = updated.id!
      } catch {
        // Si falla (ej: plan con subs activas), crear nuevo
        const created = await mpPreApprovalPlan.create({
          body: {
            reason: plan.nombre,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months' as const,
              transaction_amount: Number(precio),
              currency_id: 'ARS',
            },
            back_url: `${appUrl}/dashboard/billing/checkout/success`,
            payment_methods_allowed: {
              payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }],
              payment_methods: [],
            },
          },
        })
        mpPlanId = created.id!
      }
    } else {
      // Crear nuevo plan en MP
      const created = await mpPreApprovalPlan.create({
        body: {
          reason: plan.nombre,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months' as const,
            transaction_amount: Number(precio),
            currency_id: 'ARS',
          },
          back_url: `${appUrl}/dashboard/billing/checkout/success`,
          payment_methods_allowed: {
            payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }],
            payment_methods: [],
          },
        },
      })
      mpPlanId = created.id!
    }

    await admin.from('plans').update({
      mp_preapproval_plan_id: mpPlanId,
      auto_billing_enabled: true,
    }).eq('id', planId)

    revalidatePath('/dashboard/admin/planes')
    return { success: true, data: { mpPlanId } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al sincronizar plan con MP'
    return { success: false, error: message }
  }
}

export async function resincronizarPlanMP(planId: string): Promise<ActionResult<void>> {
  const result = await sincronizarPlanMP(planId)
  if (!result.success) return result
  return { success: true, data: undefined }
}

// ─── Iniciar suscripción ─────────────────────────────────

export async function iniciarSuscripcionMP(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ init_point: string; subscription_id: string }>> {
  try {
    if (!isMercadoPagoConfigured()) {
      return { success: false, error: 'Mercado Pago no está configurado' }
    }

    const { user, membership } = await getUserAndMembership()
    await requireMainAdmin(membership.consultora_id)

    const planId = formData.get('plan_id') as string
    if (!planId) return { success: false, error: 'plan_id requerido' }

    // Leer ciclo e intento_founder del FormData
    const ciclo = (formData.get('ciclo') as 'monthly' | 'annual') ?? 'monthly'
    const intentoFounder = formData.get('intento_founder') === 'true'

    const admin = createAdminClient()

    // Verificar que no haya sub activa
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('id, estado')
      .eq('consultora_id', membership.consultora_id)
      .single()

    if (existingSub && ['active', 'trialing'].includes(existingSub.estado)) {
      return { success: false, error: 'Ya tenés una suscripción activa' }
    }

    // Leer plan
    const { data: plan } = await admin.from('plans').select('*').eq('id', planId).single()
    if (!plan) return { success: false, error: 'Plan no encontrado' }
    if (!plan.mp_preapproval_plan_id) return { success: false, error: 'Este plan no tiene cobro automático configurado. Contactá al administrador.' }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) return { success: false, error: 'NEXT_PUBLIC_APP_URL no configurada' }

    // Calcular precio según ciclo y descuentos
    let montoTransaccion: number | undefined
    if (ciclo === 'annual') {
      const precioCalculado = calcularPrecioFinal(
        plan.precio_mensual_neto ? Number(plan.precio_mensual_neto) : null,
        'annual',
        false, // El descuento founder se aplica si se otorga el cupo (oportunístico en webhook)
      )
      if (precioCalculado) {
        montoTransaccion = precioCalculado.precioFinal
      }
    }

    // Crear o actualizar subscription row
    let subscriptionId: string

    if (existingSub) {
      subscriptionId = existingSub.id
    } else {
      const { data: newSub } = await admin
        .from('subscriptions')
        .insert({
          consultora_id: membership.consultora_id,
          plan_id: planId,
          // Estado inicial mientras MP confirma el preapproval. 'pending' NO existe
          // en el enum subscription_estado (es de payment_estado) -> el INSERT
          // reventaba con 'invalid input value for enum' y el alta fallaba.
          // El webhook la pasa a 'active' al confirmarse el pago.
          estado: 'trialing',
          ciclo,
          intento_founder: intentoFounder,
        })
        .select('id')
        .single()

      if (!newSub) return { success: false, error: 'Error al crear suscripción' }
      subscriptionId = newSub.id

      // Log audit
      await admin.from('subscription_audit_log').insert({
        subscription_id: subscriptionId,
        estado_nuevo: 'trialing',
        motivo: `Inicio de suscripción MP (ciclo: ${ciclo}, intento_founder: ${intentoFounder})`,
        actor_id: user.id,
      })
    }

    // Llamar a MP
    const preapproval = await mpPreApproval.create({
      body: {
        preapproval_plan_id: plan.mp_preapproval_plan_id,
        payer_email: user.email!,
        back_url: `${appUrl}/dashboard/billing/checkout/success`,
        reason: `Suscripción ${plan.nombre}${ciclo === 'annual' ? ' (anual)' : ''}`,
        external_reference: subscriptionId,
        status: 'pending',
        ...(montoTransaccion !== undefined && {
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months' as const,
            transaction_amount: montoTransaccion,
            currency_id: 'ARS',
          },
        }),
      },
    })

    // Actualizar subscription en DB
    await admin.from('subscriptions').update({
      mp_preapproval_id: preapproval.id,
      mp_init_point: preapproval.init_point,
      mp_payer_email: user.email,
      mp_status: 'pending',
      plan_id: planId,
    }).eq('id', subscriptionId)

    // Si es ciclo anual, generar cuotas programadas en payment_installments
    if (ciclo === 'annual' && montoTransaccion !== undefined) {
      const cuotas = generarCuotasAnuales(subscriptionId, planId, montoTransaccion)
      await admin.from('payment_installments').insert(cuotas)
    }

    if (!preapproval.init_point) {
      return { success: false, error: 'MP no devolvió init_point' }
    }

    return {
      success: true,
      data: {
        init_point: preapproval.init_point,
        subscription_id: subscriptionId,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al iniciar suscripción'
    return { success: false, error: message }
  }
}

// ─── Obtener estado de suscripción ────────────────────────

export async function obtenerEstadoSuscripcion(): Promise<ActionResult<{
  estado: string
  mp_status: string | null
  current_period_end: string | null
}>> {
  try {
    const { membership } = await getUserAndMembership()
    const admin = createAdminClient()

    const { data: sub } = await admin
      .from('subscriptions')
      .select('estado, mp_status, current_period_end')
      .eq('consultora_id', membership.consultora_id)
      .single()

    if (!sub) return { success: false, error: 'No hay suscripción' }

    return {
      success: true,
      data: {
        estado: sub.estado,
        mp_status: sub.mp_status,
        current_period_end: sub.current_period_end?.toISOString() ?? null,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener estado'
    return { success: false, error: message }
  }
}

// ─── Cambiar plan ────────────────────────────────────────

export async function cambiarPlanMP(nuevoPlanId: string): Promise<ActionResult<{
  prorrataMonto: number
  aplicaInmediato: boolean
  fechaAplicacion?: string
}>> {
  try {
    if (!isMercadoPagoConfigured()) {
      return { success: false, error: 'Mercado Pago no está configurado' }
    }

    const { user, membership } = await getUserAndMembership()
    await requireMainAdmin(membership.consultora_id)

    const admin = createAdminClient()

    // Leer sub actual y plan nuevo
    const { data: sub } = await admin
      .from('subscriptions')
      .select('*, plans!inner(*)')
      .eq('consultora_id', membership.consultora_id)
      .single()

    if (!sub) return { success: false, error: 'No hay suscripción activa' }

    const planActual = sub.plans as any
    const precioActual = Number(planActual.precio_mensual_neto ?? 0)

    const { data: planNuevo } = await admin.from('plans').select('*').eq('id', nuevoPlanId).single()
    if (!planNuevo) return { success: false, error: 'Plan nuevo no encontrado' }
    if (!planNuevo.mp_preapproval_plan_id) {
      return { success: false, error: 'El plan nuevo no tiene cobro automático configurado' }
    }

    const precioNuevo = Number(planNuevo.precio_mensual_neto ?? 0)
    const esUpgrade = precioNuevo > precioActual

    if (esUpgrade) {
      // Calcular prorrata
      const prorrata = calcularProrrata({
        precioActual,
        precioNuevo,
        currentPeriodStart: sub.current_period_start ?? new Date(),
        currentPeriodEnd: sub.current_period_end ?? new Date(),
      })

      // Si hay monto a cobrar, crear payment one-off
      if (prorrata.monto > 0 && sub.mp_preapproval_id) {
        try {
          const preapprovalData = await mpPreApproval.get({ id: sub.mp_preapproval_id })
          const payerEmail = preapprovalData.payer_email

          if (payerEmail) {
            await mpPayment.create({
              body: {
                transaction_amount: prorrata.monto,
                description: `Prorrata cambio de plan: ${planActual.nombre} → ${planNuevo.nombre}`,
                payer: { email: payerEmail },
                external_reference: sub.id,
              },
            })
          }
        } catch {
          // Si falla el pago one-off, continuar igual (mejor tener el plan cambiado)
          console.warn('[MP] No se pudo cobrar la prorrata, continuando con cambio de plan')
        }
      }

      // Cambiar preapproval_plan_id en MP (usar raw ya que el SDK no tipa este campo)
      await (mpPreApproval.update as any)({
        id: sub.mp_preapproval_id,
        body: { preapproval_plan_id: planNuevo.mp_preapproval_plan_id },
      })

      // Actualizar DB inmediatamente
      await admin.from('subscriptions').update({
        plan_id: nuevoPlanId,
        plan_id_pendiente: null,
        aplicar_cambio_en: null,
      }).eq('id', sub.id)

      // Log audit
      await admin.from('subscription_audit_log').insert({
        subscription_id: sub.id,
        estado_anterior: sub.estado,
        estado_nuevo: sub.estado,
        motivo: `Upgrade: ${planActual.nombre} → ${planNuevo.nombre} (prorrata: $${prorrata.monto})`,
        actor_id: user.id,
      })

      return {
        success: true,
        data: {
          prorrataMonto: prorrata.monto,
          aplicaInmediato: true,
        },
      }
    } else {
      // Downgrade: aplicar al final del ciclo
      await admin.from('subscriptions').update({
        plan_id_pendiente: nuevoPlanId,
        aplicar_cambio_en: sub.current_period_end,
      }).eq('id', sub.id)

      // Log audit
      await admin.from('subscription_audit_log').insert({
        subscription_id: sub.id,
        estado_anterior: sub.estado,
        estado_nuevo: sub.estado,
        motivo: `Downgrade programado: ${planActual.nombre} → ${planNuevo.nombre} (vigente desde ${sub.current_period_end?.toISOString()?.split('T')[0]})`,
        actor_id: user.id,
      })

      return {
        success: true,
        data: {
          prorrataMonto: 0,
          aplicaInmediato: false,
          fechaAplicacion: sub.current_period_end?.toISOString(),
        },
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cambiar plan'
    return { success: false, error: message }
  }
}

// ─── Convertir a consultora ──────────────────────────────

export async function convertirAConsultora(nuevoPlanId: string): Promise<ActionResult<void>> {
  try {
    const { membership } = await getUserAndMembership()
    await requireMainAdmin(membership.consultora_id)

    const planResult = await cambiarPlanMP(nuevoPlanId)
    if (!planResult.success) return planResult

    const admin = createAdminClient()

    await admin.from('consultoras').update({
      tipo: 'consultora',
    }).eq('id', membership.consultora_id)

    revalidatePath('/dashboard/billing')
    return { success: true, data: undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al convertir a consultora'
    return { success: false, error: message }
  }
}

// ─── Cancelar suscripción ────────────────────────────────

export async function cancelarSuscripcion(motivo?: string): Promise<ActionResult<void>> {
  try {
    if (!isMercadoPagoConfigured()) {
      return { success: false, error: 'Mercado Pago no está configurado' }
    }

    const { user, membership } = await getUserAndMembership()
    await requireMainAdmin(membership.consultora_id)

    const admin = createAdminClient()

    const { data: sub } = await admin
      .from('subscriptions')
      .select('*')
      .eq('consultora_id', membership.consultora_id)
      .single()

    if (!sub) return { success: false, error: 'No hay suscripción activa' }

    // Cancelar en MP
    if (sub.mp_preapproval_id) {
      await mpPreApproval.update({
        id: sub.mp_preapproval_id,
        body: { status: 'cancelled' },
      })
    }

    // Actualizar DB — acceso sigue hasta current_period_end
    await admin.from('subscriptions').update({
      estado: 'canceled' as any,
      motivo_cancelacion: motivo ?? null,
      cancelled_at: new Date().toISOString(),
    }).eq('id', sub.id)

    // Log audit
    await admin.from('subscription_audit_log').insert({
      subscription_id: sub.id,
      estado_anterior: sub.estado,
      estado_nuevo: 'canceled' as any,
      motivo: `Cancelación: ${motivo ?? 'Sin motivo'}`,
      actor_id: user.id,
    })

    revalidatePath('/dashboard/billing')
    return { success: true, data: undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cancelar suscripción'
    return { success: false, error: message }
  }
}

// ─── Actualizar método de pago ───────────────────────────

export async function actualizarMetodoPago(): Promise<ActionResult<{ update_url: string }>> {
  try {
    const { membership } = await getUserAndMembership()
    await requireMainAdmin(membership.consultora_id)

    const admin = createAdminClient()
    const { data: sub } = await admin
      .from('subscriptions')
      .select('mp_preapproval_id')
      .eq('consultora_id', membership.consultora_id)
      .single()

    if (!sub?.mp_preapproval_id) {
      return { success: false, error: 'No hay suscripción activa con MP' }
    }

    // MP devuelve URL para actualizar método de pago en el preapproval
    const preapproval = await mpPreApproval.get({ id: sub.mp_preapproval_id })
    const updateUrl = (preapproval as any).update_url ?? null

    if (!updateUrl) {
      // Fallback: redirigir al portal de MP
      return {
        success: true,
        data: {
          update_url: `https://www.mercadopago.com.ar/subscriptions/${sub.mp_preapproval_id}/edit`,
        },
      }
    }

    return { success: true, data: { update_url: updateUrl } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener link de actualización'
    return { success: false, error: message }
  }
}

// ─── Listar pagos ────────────────────────────────────────

export async function listarPagos(): Promise<ActionResult<Array<{
  id: string
  fecha: string
  monto_neto: number
  monto_total: number
  estado: string
  metodo: string | null
  receipt_url: string | null
  mp_payment_id: string | null
}>>> {
  try {
    const { membership } = await getUserAndMembership()
    const admin = createAdminClient()

    const { data: sub } = await admin
      .from('subscriptions')
      .select('id')
      .eq('consultora_id', membership.consultora_id)
      .single()

    if (!sub) return { success: true, data: [] }

    const { data: payments } = await admin
      .from('payments')
      .select('id, created_at, monto_neto, monto_total, estado, mp_payment_method, receipt_url, mp_payment_id')
      .eq('subscription_id', sub.id)
      .order('created_at', { ascending: false })

    return {
      success: true,
      data: (payments ?? []).map(p => ({
        id: p.id,
        fecha: p.created_at,
        monto_neto: Number(p.monto_neto),
        monto_total: Number(p.monto_total),
        estado: p.estado,
        metodo: p.mp_payment_method,
        receipt_url: p.receipt_url,
        mp_payment_id: p.mp_payment_id,
      })),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al listar pagos'
    return { success: false, error: message }
  }
}

// ─── Obtener datos completos de billing ──────────────────

export async function obtenerDatosBilling(): Promise<ActionResult<{
  sub: Record<string, unknown> | null
  plan: Record<string, unknown> | null
  consultora: Record<string, unknown> | null
  planes: Record<string, unknown>[]
}>> {
  try {
    const { membership } = await getUserAndMembership()
    const admin = createAdminClient()

    const [subResult, consultoraResult, planesResult] = await Promise.all([
      admin.from('subscriptions').select('*').eq('consultora_id', membership.consultora_id).single(),
      admin.from('consultoras').select('*').eq('id', membership.consultora_id).single(),
      admin.from('plans').select('*').eq('is_active', true).eq('is_visible', true).order('sort_order', { ascending: true }),
    ])

    let plan = null
    if (subResult.data?.plan_id) {
      const { data: p } = await admin.from('plans').select('*').eq('id', subResult.data.plan_id).single()
      plan = p
    }

    return {
      success: true,
      data: {
        sub: subResult.data ?? null,
        plan,
        consultora: consultoraResult.data ?? null,
        planes: planesResult.data ?? [],
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener datos de billing'
    return { success: false, error: message }
  }
}
