import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mpPreApproval } from '@/lib/mercadopago/client'
import { isMercadoPagoConfigured } from '@/lib/mercadopago/client'

/**
 * Cron diario que expira suscripciones en past_due cuyo grace period ya venció.
 *
 * Busca subscriptions con:
 *   estado = 'past_due'
 *   AND past_due_grace_until < now()
 *
 * Las pasa a 'canceled' y notifica.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error('CRON_SECRET no configurado')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const resultados: { id: string; consultora_id: string; exito: boolean; error?: string }[] = []

  try {
    const { data: subs } = await admin
      .from('subscriptions')
      .select('id, consultora_id, mp_preapproval_id')
      .eq('estado', 'past_due')
      .not('past_due_grace_until', 'is', null)
      .lt('past_due_grace_until', new Date().toISOString())

    if (!subs || subs.length === 0) {
      return NextResponse.json({ expirados: 0, resultados: [] })
    }

    for (const sub of subs) {
      try {
        // Cancelar en MP si está configurado
        if (isMercadoPagoConfigured() && sub.mp_preapproval_id) {
          await mpPreApproval.update({
            id: sub.mp_preapproval_id,
            body: { status: 'cancelled' },
          })
        }

        // Actualizar DB
        await admin.from('subscriptions').update({
          estado: 'canceled' as any,
          motivo_cancelacion: 'grace_period_expired',
          cancelled_at: new Date().toISOString(),
        }).eq('id', sub.id)

        // Log audit
        await admin.from('subscription_audit_log').insert({
          subscription_id: sub.id,
          estado_anterior: 'past_due' as any,
          estado_nuevo: 'canceled' as any,
          motivo: 'Grace period expirado — cancelación automática por cron',
        })

        resultados.push({ id: sub.id, consultora_id: sub.consultora_id, exito: true })
      } catch (error) {
        resultados.push({
          id: sub.id,
          consultora_id: sub.consultora_id,
          exito: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }

    const expirados = resultados.filter(r => r.exito).length

    return NextResponse.json({
      expirados,
      total: subs.length,
      resultados,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error general'
    console.error('[Cron expirar-past-due] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
