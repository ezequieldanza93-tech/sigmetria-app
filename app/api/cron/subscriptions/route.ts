import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startCronRun, finishCronRun } from '@/lib/cron/cron-log'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Cron diario: evalúa la máquina de estados de suscripciones por fecha.
 *
 * Llama a la función SQL `run_subscription_cron()` (SECURITY DEFINER), que
 * aplica las transiciones vencidas:
 *   trialing        → trial_view_only   cuando trial_ends_at < now()
 *   trial_view_only → expired           cuando grace_period_ends_at < now()
 *   grace_period    → canceled          cuando grace_period_ends_at < now()
 *
 * NO se solapa con `expirar-past-due` (que opera sobre estado = 'past_due'
 * y la columna past_due_grace_until) ni con `aplicar-cambios-plan` (que opera
 * sobre plan_id_pendiente). Son caminos disjuntos: estados y columnas distintas.
 *
 * Auth `Authorization: Bearer ${CRON_SECRET}` (patrón del resto de crons).
 * Se dispara desde el dispatcher /api/cron/diario.
 */
export async function GET(request: Request): Promise<Response> {
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
  const runId = await startCronRun(admin, 'subscriptions')

  try {
    const { data, error } = await admin.rpc('run_subscription_cron')
    if (error) throw new Error(error.message)

    const result = (data ?? {}) as {
      trialing_to_view_only?: number
      view_only_to_expired?: number
      grace_to_canceled?: number
      ran_at?: string
    }

    const filas =
      (result.trialing_to_view_only ?? 0) +
      (result.view_only_to_expired ?? 0) +
      (result.grace_to_canceled ?? 0)

    await finishCronRun(admin, runId, 'success', { filas, ...result })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    await finishCronRun(admin, runId, 'error', {}, msg)
    console.error('[Cron subscriptions] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
