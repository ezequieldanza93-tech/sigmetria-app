import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Healthcheck liviano — verifica conectividad con Supabase (DB + Storage).
 *
 * Sin auth (es un endpoint de monitoreo / uptime). NO expone datos: solo
 * devuelve el estado de cada dependencia, nunca filas ni nombres de bucket.
 *
 *   200 → { status: 'ok',       checks: { db: 'ok', storage: 'ok' } }
 *   503 → { status: 'degraded', checks: { db, storage } }   (algo falló)
 *
 * Chequeos:
 *   - db:      count HEAD sobre `consultoras` (tabla chica, head:true → no trae filas).
 *   - storage: listBuckets() (operación de control plane, sin leer objetos).
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CheckState = 'ok' | 'fail'

export async function GET() {
  const checks: { db: CheckState; storage: CheckState } = { db: 'fail', storage: 'fail' }

  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch {
    // Falta de env vars → no podemos chequear nada.
    return NextResponse.json(
      { status: 'degraded', checks },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // DB: count liviano sin traer datos.
  try {
    const { error } = await supabase
      .from('consultoras')
      .select('*', { count: 'exact', head: true })
    if (!error) checks.db = 'ok'
  } catch {
    /* checks.db queda 'fail' */
  }

  // Storage: listado de buckets (control plane).
  try {
    const { error } = await supabase.storage.listBuckets()
    if (!error) checks.storage = 'ok'
  } catch {
    /* checks.storage queda 'fail' */
  }

  const healthy = checks.db === 'ok' && checks.storage === 'ok'

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', checks },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
