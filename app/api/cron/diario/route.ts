// Dispatcher de cron DIARIO.
//
// Vercel Hobby permite un máximo de 2 cron jobs (diarios). Para no perder ninguno
// de los jobs de la app, este único endpoint los dispara TODOS en una sola corrida
// (vencimientos, alertas, inconsistencias, máquina de estados de suscripciones,
// billing, GC de exports). Así vercel.json tiene un solo cron y entra en el límite
// del plan Hobby.
//
// Si en el futuro se necesita mayor frecuencia o jobs separados → Vercel Pro
// (lifts el límite de crons) y se puede volver a un cron por job.
//
// Auth: Vercel envía `Authorization: Bearer ${CRON_SECRET}` si CRON_SECRET está en el
// entorno. Reenviamos ese header a cada sub-job (que ya validan ese secret).

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const JOBS = [
  '/api/cron/vencimientos',
  '/api/cron/cursos-vencimientos',
  '/api/cron/alertas',
  '/api/cron/inconsistencias',
  // Máquina de estados de suscripciones: trialing → trial_view_only → expired
  // (corre 1 vez/día, idempotente: solo migra las que vencieron). Disjunto de
  // expirar-past-due (estado past_due) y aplicar-cambios-plan (plan pendiente).
  '/api/cron/subscriptions',
  '/api/cron/expirar-past-due',
  '/api/cron/aplicar-cambios-plan',
  // Marca 'vencida' los fin_comprobantes (emitida/pendiente) cuyo vencimiento
  // pasó y siguen sin cobro. Idempotente.
  '/api/cron/comprobantes-vencidos',
  '/api/cron/limpiar-exports',
  '/api/cron/papelera-purga',
] as const

function baseUrl(): string {
  // URL pública de producción del proyecto (sin protección de deployment).
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (prod) return `https://${prod}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const base = baseUrl()
  const headers: Record<string, string> = secret ? { authorization: `Bearer ${secret}` } : {}

  const results = await Promise.allSettled(
    JOBS.map(async (path) => {
      const res = await fetch(`${base}${path}`, { headers })
      return { path, status: res.status, ok: res.ok }
    }),
  )

  const ran = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { path: JOBS[i], error: String(r.reason) },
  )
  const failed = ran.filter((j) => 'error' in j || ('ok' in j && !j.ok)).length

  return Response.json(
    { dispatched: JOBS.length, failed, ran, at: new Date().toISOString() },
    { status: failed > 0 ? 207 : 200 },
  )
}
