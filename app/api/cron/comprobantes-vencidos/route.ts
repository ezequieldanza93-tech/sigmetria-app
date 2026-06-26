import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startCronRun, finishCronRun } from '@/lib/cron/cron-log'

/**
 * Cron diario que marca como 'vencida' los comprobantes de finanzas cuyo
 * vencimiento ya pasó y siguen sin cobrarse.
 *
 * Busca fin_comprobantes con:
 *   estado IN ('emitida','pendiente')
 *   AND fecha_vencimiento < hoy
 *   AND fecha_cobro IS NULL
 *
 * Los pasa a estado = 'vencida'. Idempotente: una vez en 'vencida' ya no
 * vuelve a matchear el filtro. Usa el cliente service_role (RLS no aplica).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error('CRON_SECRET no configurado — el endpoint no puede autenticarse')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const runId = await startCronRun(admin, 'comprobantes-vencidos')

  try {
    // current_date en la zona del servidor (UTC). El comprobante vence cuando
    // su fecha_vencimiento es ESTRICTAMENTE anterior a hoy.
    const hoy = new Date().toISOString().slice(0, 10)

    const { data, error } = await admin
      .from('fin_comprobantes')
      .update({ estado: 'vencida' as never, updated_at: new Date().toISOString() })
      .in('estado', ['emitida', 'pendiente'])
      .lt('fecha_vencimiento', hoy)
      .is('fecha_cobro', null)
      .select('id')

    if (error) {
      await finishCronRun(admin, runId, 'error', {}, error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const vencidos = data?.length ?? 0
    await finishCronRun(admin, runId, 'success', { filas: vencidos, comprobantes: vencidos })
    return NextResponse.json({ vencidos })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error general'
    console.error('[Cron comprobantes-vencidos] Error:', message)
    await finishCronRun(admin, runId, 'error', {}, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
