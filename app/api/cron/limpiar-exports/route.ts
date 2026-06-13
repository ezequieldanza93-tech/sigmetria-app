import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { startCronRun, finishCronRun } from '@/lib/cron/cron-log'

/**
 * Cron: limpieza de paquetes de PORTABILIDAD vencidos del bucket `exports`.
 *
 * Por qué: los paquetes (Res. SRT 48/2025) se entregan vía signed URL temporal;
 * el binario en Storage no necesita persistir más allá de la ventana de descarga.
 * Este cron borra objetos del bucket `exports` con más de RETENCION_HORAS horas.
 *
 * Patrón Vercel Cron (igual que los otros app/api/cron/*): autentica con
 * `Authorization: Bearer ${CRON_SECRET}`. Para activarlo, declarar en vercel.json:
 *   { "crons": [{ "path": "/api/cron/limpiar-exports", "schedule": "0 * * * *" }] }
 *
 * RECONCILIACIÓN del worker async (Estándar 3, SRT Disp. 15/2026): además del
 * GC del bucket, este cron marca como `error` los export_jobs colgados en
 * pending/processing por más de RECONCILIA_MINUTOS (el worker no completó —
 * after() no llegó a correr, cold start raro, etc.). Reusa este slot: NO se
 * agrega un cron nuevo.
 */

const RETENCION_HORAS = 24
const RECONCILIA_MINUTOS = 15

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
  const runId = await startCronRun(admin, 'limpiar-exports')
  const corte = Date.now() - RETENCION_HORAS * 60 * 60 * 1000
  let borrados = 0
  const errores: string[] = []

  // Recorre el bucket por consultora (primer nivel) → empresa → archivos.
  const { data: consultoras, error: listErr } = await admin.storage
    .from('exports')
    .list('', { limit: 1000 })
  if (listErr) {
    await finishCronRun(admin, runId, 'error', {}, listErr.message)
    return NextResponse.json({ error: listErr.message }, { status: 500 })
  }

  for (const c of consultoras ?? []) {
    if (!c.name) continue
    const { data: empresas } = await admin.storage
      .from('exports')
      .list(c.name, { limit: 1000 })
    for (const e of empresas ?? []) {
      if (!e.name) continue
      const prefix = `${c.name}/${e.name}`
      const { data: files } = await admin.storage
        .from('exports')
        .list(prefix, { limit: 1000 })
      const aBorrar: string[] = []
      for (const f of files ?? []) {
        const creado = f.created_at ? Date.parse(f.created_at) : 0
        if (creado && creado < corte) aBorrar.push(`${prefix}/${f.name}`)
      }
      if (aBorrar.length) {
        const { error: delErr } = await admin.storage.from('exports').remove(aBorrar)
        if (delErr) errores.push(delErr.message)
        else borrados += aBorrar.length
      }
    }
  }

  // ── Reconciliación de jobs colgados (worker async no completó) ──
  let jobsReconciliados = 0
  try {
    const { data, error: recErr } = await admin.rpc('export_jobs_reconciliar', {
      p_minutos: RECONCILIA_MINUTOS,
    })
    if (recErr) errores.push(`reconciliar: ${recErr.message}`)
    else jobsReconciliados = (data as number) ?? 0
  } catch (e) {
    errores.push(`reconciliar: ${e instanceof Error ? e.message : 'excepción'}`)
  }

  await finishCronRun(admin, runId, 'success', {
    filas: borrados,
    jobs_reconciliados: jobsReconciliados,
    errores,
  })
  return NextResponse.json({ borrados, jobsReconciliados, errores })
}
