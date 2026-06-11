import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitAlertasTodasLasConsultoras } from '@/lib/alertas/emit'
import { startCronRun, finishCronRun } from '@/lib/cron/cron-log'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Cron diario: regenera las alertas SRT de TODAS las consultoras (in-app) y
 * envía email agrupado de las críticas a los admins (D6). Registra cada emisión
 * en alertas_emitidas_log y la corrida completa en cron_jobs_log.
 *
 * Autentica con `Authorization: Bearer ${CRON_SECRET}` (patrón del resto de cron).
 * Agendado en vercel.json.
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
  const runId = await startCronRun(admin, 'alertas')

  try {
    const r = await emitAlertasTodasLasConsultoras()
    await finishCronRun(admin, runId, 'success', {
      filas: r.consultoras,
      alertas: r.alertasGeneradas,
      emails_enviados: r.emailsEnviados,
      errores: r.errores,
    })
    return NextResponse.json({
      ok: true,
      consultoras: r.consultoras,
      alertas_generadas: r.alertasGeneradas,
      emails_enviados: r.emailsEnviados,
      errores: r.errores,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    await finishCronRun(admin, runId, 'error', {}, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
