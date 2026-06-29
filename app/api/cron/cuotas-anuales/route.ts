import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mpPreApproval } from '@/lib/mercadopago/client'

/**
 * Cron diario: procesar cuotas anuales vencidas.
 *
 * Busca payment_installments con:
 *   estado = 'pendiente' AND fecha_programada <= now()
 *
 * Para cada una: consulta el estado del preapproval en MP y marca como
 * 'pagado' o 'fallido' según corresponda.
 *
 * Auth: CRON_SECRET en header Authorization: Bearer <secret>
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error('[Cron cuotas-anuales] CRON_SECRET no configurado')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const resultados: { id: string; exito: boolean; nuevoEstado?: string; error?: string }[] = []

  try {
    const { data: cuotas } = await admin
      .from('payment_installments')
      .select('id, subscription_id, monto, mp_payment_id')
      .eq('estado', 'pendiente')
      .lte('fecha_programada', new Date().toISOString().split('T')[0])

    if (!cuotas || cuotas.length === 0) {
      return NextResponse.json({ procesadas: 0, resultados: [] })
    }

    for (const cuota of cuotas) {
      try {
        // Buscar la subscription para obtener el preapproval_id
        const { data: sub } = await admin
          .from('subscriptions')
          .select('mp_preapproval_id')
          .eq('id', cuota.subscription_id)
          .single()

        let nuevoEstado: 'pagado' | 'fallido' = 'fallido'
        let mpPaymentId: string | null = cuota.mp_payment_id

        if (sub?.mp_preapproval_id) {
          try {
            const preapproval = await mpPreApproval.get({ id: sub.mp_preapproval_id })
            const mpStatus = preapproval.status as string

            // 'authorized' en preapproval indica que los cobros automáticos están activos
            nuevoEstado = mpStatus === 'authorized' ? 'pagado' : 'fallido'
          } catch (mpError) {
            console.warn(`[Cron cuotas-anuales] Error consultando preapproval para cuota ${cuota.id}:`, mpError)
            nuevoEstado = 'fallido'
          }
        }

        await admin
          .from('payment_installments')
          .update({
            estado: nuevoEstado,
            ...(nuevoEstado === 'pagado' && { paid_at: new Date().toISOString() }),
            ...(mpPaymentId && { mp_payment_id: mpPaymentId }),
          })
          .eq('id', cuota.id)

        resultados.push({ id: cuota.id, exito: true, nuevoEstado })
      } catch (error) {
        resultados.push({
          id: cuota.id,
          exito: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }

    const procesadas = resultados.filter(r => r.exito).length
    console.log(`[Cron cuotas-anuales] Procesadas ${procesadas}/${cuotas.length} cuotas`)

    return NextResponse.json({
      procesadas,
      total: cuotas.length,
      resultados,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error general'
    console.error('[Cron cuotas-anuales] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
