import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startCronRun, finishCronRun } from '@/lib/cron/cron-log'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Cron diario: corre la detección de inconsistencias (fn_detectar_inconsistencias)
 * para TODAS las consultoras y deja el conteo en cron_jobs_log. Esto NO genera
 * notificaciones nuevas (el panel /dashboard/cumplimiento lee la función en vivo);
 * el cron sirve para la BITÁCORA de supervisión: demuestra que el chequeo corrió
 * a diario y con qué resultado (Art. 4.9).
 *
 * Autentica con `Authorization: Bearer ${CRON_SECRET}`. Agendado en vercel.json.
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
  const runId = await startCronRun(admin, 'inconsistencias')

  try {
    const { data: consultoras } = await admin
      .from('consultoras')
      .select('id')
      .eq('is_active', true)

    let totalInconsistencias = 0
    const errores: string[] = []

    for (const c of (consultoras ?? []) as { id: string }[]) {
      const { data, error } = await admin.rpc('fn_detectar_inconsistencias', {
        p_consultora_id: c.id,
      })
      if (error) {
        errores.push(`${c.id}: ${error.message}`)
        continue
      }
      totalInconsistencias += (data as unknown[] | null)?.length ?? 0
    }

    await finishCronRun(admin, runId, 'success', {
      filas: consultoras?.length ?? 0,
      inconsistencias: totalInconsistencias,
      errores,
    })

    return NextResponse.json({
      ok: true,
      consultoras: consultoras?.length ?? 0,
      inconsistencias: totalInconsistencias,
      errores,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    await finishCronRun(admin, runId, 'error', {}, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
