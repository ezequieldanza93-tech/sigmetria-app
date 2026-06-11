import { NextResponse } from 'next/server'
import { refrescarNotificacionesCron } from '@/lib/actions/configuracion-vencimiento'
import { createAdminClient } from '@/lib/supabase/admin'
import { startCronRun, finishCronRun } from '@/lib/cron/cron-log'

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
  const runId = await startCronRun(admin, 'vencimientos')

  const result = await refrescarNotificacionesCron()
  if (!result.success) {
    await finishCronRun(admin, runId, 'error', {}, result.error)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  await finishCronRun(admin, runId, 'success', {
    notificaciones: result.data.procesadas,
  })
  return NextResponse.json({ procesadas: result.data.procesadas })
}
