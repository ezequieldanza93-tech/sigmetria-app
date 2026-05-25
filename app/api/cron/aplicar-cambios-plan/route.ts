import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mpPreApproval } from '@/lib/mercadopago/client'

/**
 * Cron diario que aplica cambios de plan pendientes (downgrades).
 *
 * Busca subscriptions con:
 *   plan_id_pendiente IS NOT NULL
 *   AND aplicar_cambio_en <= now()
 *
 * Para cada una: cambia el preapproval_plan_id en MP y actualiza plan_id en DB.
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
  const resultados: { id: string; exito: boolean; error?: string }[] = []

  try {
    const { data: subs } = await admin
      .from('subscriptions')
      .select('id, mp_preapproval_id, plan_id_pendiente')
      .not('plan_id_pendiente', 'is', null)
      .not('aplicar_cambio_en', 'is', null)
      .lte('aplicar_cambio_en', new Date().toISOString())

    if (!subs || subs.length === 0) {
      return NextResponse.json({ aplicados: 0, resultados: [] })
    }

    for (const sub of subs) {
      try {
        const { data: planNuevo } = await admin
          .from('plans')
          .select('mp_preapproval_plan_id')
          .eq('id', sub.plan_id_pendiente)
          .single()

        if (!planNuevo?.mp_preapproval_plan_id) {
          resultados.push({ id: sub.id, exito: false, error: 'Plan nuevo sin mp_preapproval_plan_id' })
          continue
        }

        // Cambiar preapproval_plan en MP (usar raw ya que el SDK no tipa este campo)
        if (sub.mp_preapproval_id) {
          await (mpPreApproval.update as any)({
            id: sub.mp_preapproval_id,
            body: { preapproval_plan_id: planNuevo.mp_preapproval_plan_id },
          })
        }

        // Actualizar DB
        await admin.from('subscriptions').update({
          plan_id: sub.plan_id_pendiente,
          plan_id_pendiente: null,
          aplicar_cambio_en: null,
        }).eq('id', sub.id)

        // Log audit
        await admin.from('subscription_audit_log').insert({
          subscription_id: sub.id,
          estado_nuevo: 'active' as any,
          motivo: 'Downgrade aplicado por cron: cambio de plan pendiente ejecutado',
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

    const aplicados = resultados.filter(r => r.exito).length

    return NextResponse.json({
      aplicados,
      total: subs.length,
      resultados,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error general'
    console.error('[Cron aplicar-cambios-plan] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
