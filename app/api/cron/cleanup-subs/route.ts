import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Cron diario: limpiar suscripciones trialing huérfanas.
 *
 * Busca subscriptions con:
 *   estado = 'trialing' AND mp_preapproval_id IS NULL AND created_at < now() - interval '2 hours'
 *
 * Estas son subs que se crearon en el paso 1 de checkout (antes de ir a MP)
 * pero el usuario nunca completó el flujo. Las cancela para mantener la DB limpia.
 *
 * Auth: CRON_SECRET en header Authorization: Bearer <secret>
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error('[Cron cleanup-subs] CRON_SECRET no configurado')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  try {
    // Umbral: hace 2 horas
    const umbral = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

    const { data: subs } = await admin
      .from('subscriptions')
      .select('id, consultora_id, plan_id')
      .eq('estado', 'trialing')
      .is('mp_preapproval_id', null)
      .lt('created_at', umbral)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ canceladas: 0 })
    }

    const resultados: { id: string; exito: boolean; error?: string }[] = []

    for (const sub of subs) {
      try {
        await admin
          .from('subscriptions')
          .update({ estado: 'canceled' as any })
          .eq('id', sub.id)

        await admin.from('subscription_audit_log').insert({
          subscription_id: sub.id,
          estado_anterior: 'trialing',
          estado_nuevo: 'canceled' as any,
          motivo: 'Suscripción trialing huérfana cancelada por cron (sin preapproval MP > 2hs)',
        })

        resultados.push({ id: sub.id, exito: true })
      } catch (error) {
        resultados.push({
          id: sub.id,
          exito: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }

    const canceladas = resultados.filter(r => r.exito).length
    console.log(`[Cron cleanup-subs] Canceladas ${canceladas}/${subs.length} subs huérfanas`)

    return NextResponse.json({
      canceladas,
      total: subs.length,
      resultados,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error general'
    console.error('[Cron cleanup-subs] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
