import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitirAvisosPurgaPapelera } from '@/lib/papelera/purga'
import { startCronRun, finishCronRun } from '@/lib/cron/cron-log'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Cron diario: avisa por email a los admins los elementos de la papelera que
 * cumplen ~87 días (se vuelven NO recuperables a los 90, sin borrado físico).
 * La purga en sí es lógica (la aplican listarPapelera/restaurar por fecha).
 *
 * Auth `Authorization: Bearer ${CRON_SECRET}` (patrón del resto de crons).
 * Se dispara desde el dispatcher /api/cron/diario.
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
  const runId = await startCronRun(admin, 'papelera-purga')

  try {
    const r = await emitirAvisosPurgaPapelera()
    await finishCronRun(admin, runId, 'success', {
      filas: r.avisados,
      consultoras: r.consultoras,
      emails_enviados: r.emailsEnviados,
      errores: r.errores,
    })
    return NextResponse.json({ ok: true, ...r })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    await finishCronRun(admin, runId, 'error', {}, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
